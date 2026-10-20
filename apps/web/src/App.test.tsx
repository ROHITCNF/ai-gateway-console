import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { requestStore } from '@/store';
import { renderApp } from '@/test/render';

describe('sign in (FR-1, FR-2)', () => {
  it('requires a name, then shows name and role in the top bar', async () => {
    const { client } = renderApp();
    const button = await screen.findByRole('button', { name: 'Sign in' });
    expect(button).toHaveProperty('disabled', true);
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Priya Rao' } });
    fireEvent.click(screen.getByLabelText(/Admin/));
    fireEvent.click(button);
    expect(await screen.findByTestId('user-name')).toHaveProperty('textContent', 'Priya Rao');
    expect(screen.getByText('Admin')).toBeDefined();
    expect(client.user).toEqual({ name: 'Priya Rao', role: 'admin' });
  });

  it('signs out back to the sign-in page', async () => {
    renderApp({ user: { name: 'Sam', role: 'viewer' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Sign out' }));
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeDefined();
  });
});

describe('app shell (S1)', () => {
  it('has navigation to every screen and an intro sentence (NFR-9)', async () => {
    renderApp({ user: { name: 'Sam', role: 'viewer' } });
    const nav = await screen.findByRole('navigation', { name: 'Main' });
    for (const name of ['Live Requests', 'Cost & Speed', 'Routing', 'History']) {
      expect(nav.textContent).toContain(name);
    }
    expect(screen.getByText(/Every AI request your features send/)).toBeDefined();
  });

  it('shows disconnected and reconnected banners (FR-31)', async () => {
    const { client } = renderApp({ user: { name: 'Sam', role: 'viewer' } });
    await screen.findByRole('navigation', { name: 'Main' });
    act(() => client.emitStatus('connected'));
    expect(screen.getByText('Connected')).toBeDefined();
    act(() => client.emitStatus('disconnected'));
    expect(screen.getByRole('alert').textContent).toContain('Disconnected from the gateway');
    act(() => client.emitStatus('connected'));
    await waitFor(() => expect(screen.getByText(/Reconnected\./)).toBeDefined());
    expect(requestStore.getState().reconnected?.missed).toBe(0);
  });
});
