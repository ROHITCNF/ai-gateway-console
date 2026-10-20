import { fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { beforeAll, describe, expect, it } from 'vitest';
import { makeRequest } from '@/test/factories';
import { mockLayout } from '@/test/layout';
import { RequestTable } from './RequestTable';

function Harness({ count }: { count: number }) {
  const [rows] = useState(() =>
    Array.from({ length: count }, (_, i) =>
      makeRequest(
        i === 1
          ? { status: 'fallback', servedModelId: 'claude-sonnet', errorReason: 'timeout' }
          : i === 2
            ? {
                status: 'failed',
                servedModelId: null,
                outputTokens: 0,
                cost: 0,
                errorReason: 'rate limit',
              }
            : {},
      ),
    ),
  );
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <>
      <output data-testid="selected">{selected ?? ''}</output>
      <RequestTable rows={rows} selectedId={selected} onSelect={setSelected} />
    </>
  );
}

beforeAll(() => mockLayout());

const dataRows = () => screen.getAllByRole('row').filter((r) => r.hasAttribute('data-request-id'));

describe('RequestTable (FR-3, FR-8, FR-9)', () => {
  it('shows the FR-3 columns', () => {
    render(<Harness count={3} />);
    const headers = screen.getAllByRole('columnheader').map((h) => h.textContent);
    expect(headers).toEqual([
      'Time',
      'Feature',
      'Model used',
      'Status',
      'Latency',
      'Tokens',
      'Cost',
    ]);
  });

  it('marks fallbacks and failures with icon + label and the planned model', () => {
    render(<Harness count={3} />);
    const rows = dataRows();
    expect(within(rows[1] as HTMLElement).getByText('Fallback')).toBeDefined();
    expect(rows[1]?.textContent).toContain('Claude Sonnet · planned Claude Opus');
    expect(within(rows[2] as HTMLElement).getByText('Failed')).toBeDefined();
    expect(rows[2]?.textContent).toContain('—');
  });

  it('draws only the rows on screen for 10k rows (NFR-1)', () => {
    render(<Harness count={10_000} />);
    const drawn = dataRows().length;
    expect(drawn).toBeGreaterThan(5);
    expect(drawn).toBeLessThan(60);
    expect(screen.getByRole('table').getAttribute('aria-rowcount')).toBe('10001');
  });

  it('selects rows by click and arrow keys (NFR-11)', () => {
    render(<Harness count={5} />);
    const rows = dataRows();
    fireEvent.click(rows[0] as HTMLElement);
    const first = screen.getByTestId('selected').textContent;
    expect(first).toBe(rows[0]?.getAttribute('data-request-id'));
    const body = screen.getByRole('region', { name: /Use arrow keys/ });
    fireEvent.keyDown(body, { key: 'ArrowDown' });
    expect(screen.getByTestId('selected').textContent).toBe(
      rows[1]?.getAttribute('data-request-id'),
    );
    fireEvent.keyDown(body, { key: 'End' });
    expect(screen.getByTestId('selected').textContent).toBe(
      rows[4]?.getAttribute('data-request-id'),
    );
  });
});
