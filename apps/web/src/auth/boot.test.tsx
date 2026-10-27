import type { User } from '@gateway/contracts';
import { act, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bootMessage } from '@/components/boot';
import { GatewayError } from '@/gateway';
import { FakeGatewayClient } from '@/gateway/fake';
import { renderApp } from '@/test/render';
import { whenAwake } from './session';

/** A session check that stays pending until the test settles it, like a sleeping server. */
function coldClient(user: User | null = null) {
  const client = new FakeGatewayClient({ user });
  let wake!: (u: User | null) => void;
  client.getSession = () =>
    new Promise((resolve) => {
      wake = resolve;
    });
  return { client, wake: (u: User | null) => act(() => wake(u)) };
}

describe('cold start boot screen (FR-1, #80)', () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
  afterEach(() => vi.useRealTimers());

  it('shows the skeleton and status first, then the form after 3 s', async () => {
    const { client } = coldClient();
    renderApp({ client });
    expect(screen.getByTestId('sign-in-skeleton')).toBeDefined();
    expect(screen.getByRole('status').textContent).toContain('Connecting to the gateway');
    expect(screen.queryByLabelText('Your name')).toBeNull();

    await act(() => vi.advanceTimersByTimeAsync(3000));
    expect(screen.getByLabelText('Your name')).toBeDefined();
    expect(screen.getByRole('status').textContent).toContain('Waking the server');
  });

  it('shows the form at once when the server answers fast', async () => {
    renderApp();
    expect(await screen.findByLabelText('Your name')).toBeDefined();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('signs in while the session check is still pending, and ignores its late answer', async () => {
    const { client, wake } = coldClient();
    renderApp({ client });
    await act(() => vi.advanceTimersByTimeAsync(3000));
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Priya Rao' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByTestId('user-name')).toHaveProperty('textContent', 'Priya Rao');
    wake(null);
    expect(screen.getByTestId('user-name')).toHaveProperty('textContent', 'Priya Rao');
  });

  it('takes a returning user straight in when the session comes back', async () => {
    const { client, wake } = coldClient();
    renderApp({ client });
    await act(() => vi.advanceTimersByTimeAsync(3000));
    wake({ name: 'Sam', role: 'viewer' });
    expect(await screen.findByTestId('user-name')).toHaveProperty('textContent', 'Sam');
  });
});

describe('whenAwake', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('retries while the host is waking (502–504, no answer)', async () => {
    const call = vi
      .fn()
      .mockRejectedValueOnce(new GatewayError('down', 0))
      .mockRejectedValueOnce(new GatewayError('bad gateway', 502))
      .mockResolvedValue('ok');
    const result = whenAwake(call);
    await vi.advanceTimersByTimeAsync(4000);
    await expect(result).resolves.toBe('ok');
    expect(call).toHaveBeenCalledTimes(3);
  });

  it('does not retry real errors', async () => {
    const call = vi.fn().mockRejectedValue(new GatewayError('Forbidden', 403));
    await expect(whenAwake(call)).rejects.toThrow('Forbidden');
    expect(call).toHaveBeenCalledTimes(1);
  });

  it('gives up after 90 s', async () => {
    let t = 0;
    const call = vi.fn().mockRejectedValue(new GatewayError('down', 503));
    const result = whenAwake(call, () => t);
    const settled = expect(result).rejects.toThrow('down');
    for (let i = 0; i < 50; i++) {
      t += 2000;
      await vi.advanceTimersByTimeAsync(2000);
    }
    await settled;
  });
});

describe('bootMessage', () => {
  it('moves through the cold start stages', () => {
    expect(bootMessage(0)).toMatch(/Connecting/);
    expect(bootMessage(5)).toMatch(/Waking/);
    expect(bootMessage(15)).toMatch(/simulator/);
    expect(bootMessage(45)).toMatch(/Almost there/);
  });
});
