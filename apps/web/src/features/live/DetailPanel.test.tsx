import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { makeRequest } from '@/test/factories';
import { DetailPanel } from './DetailPanel';
import { explainRequest } from './explain';

describe('explainRequest (FR-8)', () => {
  it('explains a fallback with planned, reason and backup model', () => {
    const r = makeRequest({
      status: 'fallback',
      servedModelId: 'claude-sonnet',
      errorReason: 'timeout',
    });
    expect(explainRequest(r)?.text).toBe(
      'Claude Opus timed out, so the gateway sent the request to the backup model, Claude Sonnet, which answered.',
    );
  });

  it('explains a failure and says nothing for a success', () => {
    const r = makeRequest({ status: 'failed', servedModelId: null, errorReason: 'rate limit' });
    expect(explainRequest(r)?.text).toContain('Claude Opus hit a rate limit');
    expect(explainRequest(makeRequest())).toBeNull();
  });
});

describe('DetailPanel (FR-7)', () => {
  it('shows planned vs served model, tokens, cost, latency and error', () => {
    const r = makeRequest({
      id: 'req_x1',
      status: 'fallback',
      servedModelId: 'claude-sonnet',
      errorReason: 'timeout',
      inputTokens: 1240,
      outputTokens: 386,
      latencyMs: 9412,
      cost: 0.0095,
    });
    render(<DetailPanel request={r} onClose={() => {}} />);
    expect(screen.getByText('req_x1')).toBeDefined();
    expect(screen.getByText('Why it fell back')).toBeDefined();
    expect(screen.getByText('Claude Opus')).toBeDefined();
    expect(screen.getByText('Claude Sonnet')).toBeDefined();
    expect(screen.getByText('1,240')).toBeDefined();
    expect(screen.getByText('386')).toBeDefined();
    expect(screen.getByText('9,412 ms')).toBeDefined();
    expect(screen.getByText('$0.0095')).toBeDefined();
    expect(screen.getByText('timeout')).toBeDefined();
  });

  it('closes on Esc and the close button', () => {
    const onClose = vi.fn();
    render(<DetailPanel request={makeRequest()} onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'Close details' }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
