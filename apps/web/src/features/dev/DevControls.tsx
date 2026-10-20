import type { RequestRate } from '@gateway/contracts';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/segmented';
import { useGateway } from '@/gateway';
import { gatewayStore, useGatewayState } from '@/store';

const RATES = [
  { value: 1, label: '1/s' },
  { value: 5, label: '5/s' },
  { value: 20, label: '20/s' },
] as const satisfies readonly { value: RequestRate; label: string }[];

const DROP_SECONDS = 5;
const OPEN_KEY = 'gw.devControls.open';

function readOpen(): boolean {
  try {
    return localStorage.getItem(OPEN_KEY) !== 'false';
  } catch {
    return true;
  }
}

/**
 * S8: simulator controls, visible to every role (D13.14). Rate and fail-next are global to the
 * backend; drop affects only this browser (D15.12).
 */
export function DevControls() {
  const client = useGateway();
  const dev = useGatewayState((s) => s.dev);
  const [open, setOpen] = useState(readOpen);
  const [error, setError] = useState<string | null>(null);
  const [dropping, setDropping] = useState(false);

  const toggle = () => {
    setOpen(!open);
    try {
      localStorage.setItem(OPEN_KEY, String(!open));
    } catch {
      // Per-viewer convenience only.
    }
  };

  const run = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Simulator control failed');
    }
  };

  const update = (body: Parameters<typeof client.updateDev>[0]) =>
    run(async () => gatewayStore.setState({ dev: await client.updateDev(body) }));

  const drop = () =>
    run(async () => {
      setDropping(true);
      try {
        await client.dropConnection(DROP_SECONDS);
        await new Promise((r) => setTimeout(r, DROP_SECONDS * 1000));
      } finally {
        setDropping(false);
      }
    });

  return (
    <section
      aria-label="Simulator controls"
      className="rounded-xl border border-dashed bg-card/60 px-4 py-3 text-sm"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Simulator
        </span>
        {open && (
          <>
            <span className="flex items-center gap-2">
              Request rate
              <Segmented
                label="Request rate"
                value={dev?.rate ?? 1}
                options={RATES}
                onChange={(rate) => void update({ rate })}
              />
            </span>
            <Button variant="outline" disabled={dropping} onClick={() => void drop()}>
              {dropping ? 'Connection dropped…' : `Drop connection for ${DROP_SECONDS} s`}
            </Button>
            <Button
              variant="outline"
              aria-pressed={dev?.failNextRouteChange ?? false}
              onClick={() => void update({ failNextRouteChange: !dev?.failNextRouteChange })}
            >
              {dev?.failNextRouteChange
                ? 'Next route change will fail · undo'
                : 'Fail next route change'}
            </Button>
            <span className="ml-auto text-xs text-muted-foreground">
              Simulated gateway · sample data. These controls affect every viewer except “Drop”.
            </span>
          </>
        )}
        <Button
          variant="link"
          size="sm"
          className={open ? '' : 'ml-auto'}
          onClick={toggle}
          aria-expanded={open}
        >
          {open ? 'Hide' : 'Show'}
        </Button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
