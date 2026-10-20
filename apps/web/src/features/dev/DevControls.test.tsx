import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp } from '@/test/render';

describe('developer controls (S8, D13.14)', () => {
  it('sets the rate, arms fail-next and drops the connection, for viewers too', async () => {
    const { client } = renderApp({ user: { name: 'Sam', role: 'viewer' } });
    const panel = await screen.findByRole('region', { name: 'Simulator controls' });
    const rate = within(panel).getByRole('group', { name: 'Request rate' });
    await waitFor(() =>
      expect(within(rate).getByRole('button', { name: '1/s' }).getAttribute('aria-pressed')).toBe(
        'true',
      ),
    );

    fireEvent.click(within(rate).getByRole('button', { name: '20/s' }));
    await waitFor(() => expect(client.dev.rate).toBe(20));
    expect(await screen.findByText('Streaming · 20 requests/s')).toBeDefined();

    fireEvent.click(within(panel).getByRole('button', { name: 'Fail next route change' }));
    await waitFor(() => expect(client.dev.failNextRouteChange).toBe(true));

    act(() => {
      fireEvent.click(within(panel).getByRole('button', { name: /Drop connection/ }));
    });
    await waitFor(() => expect(client.calls.some((c) => c.method === 'dropConnection')).toBe(true));
    expect(await screen.findByText(/Disconnected from the gateway/)).toBeDefined();
  });

  it('follows dev changes from other viewers via the stream', async () => {
    const { client } = renderApp({ user: { name: 'Sam', role: 'viewer' } });
    await screen.findByRole('region', { name: 'Simulator controls' });
    act(() => client.emitDev({ rate: 5, failNextRouteChange: false }));
    expect(await screen.findByText('Streaming · 5 requests/s')).toBeDefined();
  });

  it('collapses', async () => {
    renderApp({ user: { name: 'Sam', role: 'viewer' } });
    const panel = await screen.findByRole('region', { name: 'Simulator controls' });
    fireEvent.click(within(panel).getByRole('button', { name: 'Hide' }));
    expect(within(panel).queryByRole('group', { name: 'Request rate' })).toBeNull();
    fireEvent.click(within(panel).getByRole('button', { name: 'Show' }));
  });
});
