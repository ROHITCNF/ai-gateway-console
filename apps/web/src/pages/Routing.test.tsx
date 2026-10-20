import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { confirmReview, gatewayStore } from '@/store';
import { renderApp } from '@/test/render';

const admin = { name: 'Priya', role: 'admin' as const };
const mainPicker = () => screen.getByLabelText('Main model for support-bot') as HTMLSelectElement;

describe('Routing screen (FR-16, FR-17, FR-32)', () => {
  it('lists every feature with team, main and backup model', async () => {
    renderApp({ user: admin, path: '/routing' });
    await screen.findByLabelText('Main model for support-bot');
    expect(screen.getAllByRole('row')).toHaveLength(6);
    expect(mainPicker().value).toBe('claude-opus');
    expect((screen.getByLabelText('Backup model for support-bot') as HTMLSelectElement).value).toBe(
      'claude-sonnet',
    );
    expect(screen.getByText('Customer Support')).toBeDefined();
  });

  it('picking a model opens the review and changes nothing yet (FR-18)', async () => {
    const { client } = renderApp({ user: admin, path: '/routing' });
    await screen.findByLabelText('Main model for support-bot');
    fireEvent.change(mainPicker(), { target: { value: 'claude-haiku' } });
    expect(gatewayStore.getState().review).toEqual({
      featureId: 'support-bot',
      mainModelId: 'claude-haiku',
      fallbackModelId: 'claude-sonnet',
      source: 'click',
    });
    expect(mainPicker().value).toBe('claude-opus');
    expect(client.calls.some((c) => c.method === 'changeRoute')).toBe(false);
  });

  it('shows the new route only after the gateway confirms', async () => {
    const { client } = renderApp({ user: admin, path: '/routing' });
    await screen.findByLabelText('Main model for support-bot');
    fireEvent.change(mainPicker(), { target: { value: 'claude-haiku' } });
    let done: Promise<boolean> = Promise.resolve(false);
    act(() => {
      done = confirmReview(client);
    });
    expect(screen.getByText(/Applying… waiting for gateway/)).toBeDefined();
    await act(() => done);
    expect(mainPicker().value).toBe('claude-haiku');
    expect(gatewayStore.getState().history.data).toBeNull();
  });

  it('keeps the old route and shows an inline error when the change fails', async () => {
    const { client } = renderApp({ user: admin, path: '/routing' });
    await screen.findByLabelText('Main model for support-bot');
    client.fail.changeRoute = 'The gateway rejected the change. Try again.';
    fireEvent.change(mainPicker(), { target: { value: 'claude-haiku' } });
    await act(() => confirmReview(client));
    expect(mainPicker().value).toBe('claude-opus');
    expect(screen.getByText(/Not changed: .* support-bot still uses Claude Opus\./)).toBeDefined();
  });

  it('follows changes confirmed by other viewers via the stream', async () => {
    const { client } = renderApp({ user: admin, path: '/routing' });
    await screen.findByLabelText('Main model for support-bot');
    const rule = {
      featureId: 'support-bot' as const,
      mainModelId: 'gemini' as const,
      fallbackModelId: 'claude-sonnet' as const,
      updatedAt: new Date().toISOString(),
    };
    act(() =>
      client.emitRouteChange({
        rule,
        change: {
          id: 'chg_x',
          timestamp: rule.updatedAt,
          changedBy: 'Ana',
          featureId: 'support-bot',
          oldMainModelId: 'claude-opus',
          newMainModelId: 'gemini',
          oldFallbackModelId: 'claude-sonnet',
          newFallbackModelId: 'claude-sonnet',
          source: 'click',
          estimatedCostChangePercent: -90,
        },
      }),
    );
    await waitFor(() => expect(mainPicker().value).toBe('gemini'));
  });

  it('shows an error state when routes cannot load', async () => {
    const client = new (await import('@/gateway/fake')).FakeGatewayClient({ user: admin });
    client.fail.getRoutes = 'Cannot reach the gateway';
    renderApp({ client, path: '/routing' });
    expect(await screen.findByText('Could not load routes')).toBeDefined();
  });
});
