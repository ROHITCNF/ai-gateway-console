import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { gatewayStore, openReview } from '@/store';
import { renderApp } from '@/test/render';
import { describeEstimate } from './ReviewDialog';

const admin = { name: 'Priya', role: 'admin' as const };

async function openFromRouting() {
  const utils = renderApp({ user: admin, path: '/routing' });
  const picker = await screen.findByLabelText('Main model for support-bot');
  fireEvent.change(picker, { target: { value: 'claude-haiku' } });
  const dialog = await screen.findByRole('dialog', { name: 'Review route change' });
  return { ...utils, dialog };
}

describe('describeEstimate (FR-18, D13.10)', () => {
  it('words the estimate with its basis', () => {
    expect(
      describeEstimate({ percent: -80, basis: 'last_hour', sampleSize: 4820 }, 'support-bot'),
    ).toMatchObject({
      headline: 'About 80% cheaper',
      basis: 'Estimated from support-bot’s last hour of traffic (4,820 requests).',
    });
    expect(describeEstimate({ percent: 25, basis: 'all_data', sampleSize: 30 }, 'x').headline).toBe(
      'About 25% more expensive',
    );
    expect(
      describeEstimate({ percent: 25, basis: 'all_data', sampleSize: 30 }, 'x').basis,
    ).toContain('fewer than 50');
    expect(
      describeEstimate({ percent: null, basis: 'all_data', sampleSize: 0 }, 'x').headline,
    ).toBe('No estimate yet');
  });
});

describe('Review step (S5, FR-18, FR-19, FR-32)', () => {
  it('shows old → new models, source and the estimate', async () => {
    const { dialog } = await openFromRouting();
    expect(within(dialog).getByText('Picked on Routing')).toBeDefined();
    expect(dialog.textContent).toContain('MainClaude OpusClaude Haiku');
    expect(dialog.textContent).toContain('BackupClaude SonnetNo change');
    expect(await within(dialog).findByText('About 80% cheaper')).toBeDefined();
  });

  it('Cancel closes with no change', async () => {
    const { client, dialog } = await openFromRouting();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(client.calls.some((c) => c.method === 'changeRoute')).toBe(false);
  });

  it('Esc cancels (NFR-11)', async () => {
    const { dialog } = await openFromRouting();
    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(gatewayStore.getState().review).toBeNull();
  });

  it('Confirm applies the change after the gateway confirms', async () => {
    const { client, dialog } = await openFromRouting();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm change' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(client.rules.find((r) => r.featureId === 'support-bot')?.mainModelId).toBe(
      'claude-haiku',
    );
    expect((screen.getByLabelText('Main model for support-bot') as HTMLSelectElement).value).toBe(
      'claude-haiku',
    );
  });

  it('shows the gateway error in the dialog and keeps the old route', async () => {
    const { client, dialog } = await openFromRouting();
    client.fail.changeRoute = 'The gateway rejected the change. Try again.';
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm change' }));
    const alert = await within(dialog).findByRole('alert');
    expect(alert.textContent).toContain('support-bot still uses Claude Opus. Nothing was changed.');
    expect(within(dialog).getByRole('button', { name: 'Try again' })).toBeDefined();
    expect(
      (
        screen.getByLabelText('Main model for support-bot', {
          selector: 'select',
        }) as HTMLSelectElement
      ).value,
    ).toBe('claude-opus');
  });

  it('labels chat proposals', async () => {
    renderApp({ user: admin, path: '/routing' });
    await screen.findByLabelText('Main model for support-bot');
    openReview({
      featureId: 'support-bot',
      mainModelId: 'claude-haiku',
      fallbackModelId: 'claude-sonnet',
      source: 'chat',
    });
    expect(await screen.findByText('Suggested via chat')).toBeDefined();
  });
});
