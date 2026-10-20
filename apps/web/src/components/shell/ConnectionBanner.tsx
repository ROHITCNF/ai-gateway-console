import { Check, WifiOff } from 'lucide-react';
import { useEffect } from 'react';
import { useRequests } from '@/store';

const SHOW_RECONNECTED_MS = 5000;

/** "Disconnected" / "Reconnected" banner (FR-31, Flow H). Data on screen is kept. */
export function ConnectionBanner() {
  const status = useRequests((s) => s.connection);
  const reconnected = useRequests((s) => s.reconnected);
  const dismiss = useRequests((s) => s.dismissReconnected);

  useEffect(() => {
    if (!reconnected) return;
    const t = setTimeout(dismiss, SHOW_RECONNECTED_MS);
    return () => clearTimeout(t);
  }, [reconnected, dismiss]);

  if (status === 'disconnected') {
    return (
      <div
        role="alert"
        className="flex items-center gap-3 rounded-lg border border-warning/40 bg-warning-soft px-4 py-2.5 text-sm text-warning"
      >
        <WifiOff className="size-4 shrink-0" aria-hidden />
        <span>
          <strong>Disconnected from the gateway.</strong> Reconnecting… The requests already on
          screen are kept.
        </span>
      </div>
    );
  }
  if (reconnected) {
    return (
      <div
        role="status"
        className="flex items-center gap-3 rounded-lg border border-success/40 bg-success-soft px-4 py-2.5 text-sm text-success"
      >
        <Check className="size-4 shrink-0" aria-hidden />
        <span>
          <strong>Reconnected.</strong> Filled in {reconnected.missed.toLocaleString()} request
          {reconnected.missed === 1 ? '' : 's'} that arrived while the connection was down.
        </span>
      </div>
    );
  }
  return null;
}
