import { cn } from '@/lib/utils';
import { useRequests } from '@/store';

const LABEL = { connecting: 'Connecting…', connected: 'Connected', disconnected: 'Disconnected' };

/** Top-bar stream status; dot plus text so colour is not the only signal (NFR-11). */
export function ConnectionIndicator() {
  const status = useRequests((s) => s.connection);
  return (
    <span
      role="status"
      className={cn(
        'flex items-center gap-1.5 text-sm',
        status === 'connected' && 'text-success',
        status === 'disconnected' && 'text-warning',
        status === 'connecting' && 'text-muted-foreground',
      )}
    >
      <span className="size-2 rounded-full bg-current" aria-hidden />
      {LABEL[status]}
    </span>
  );
}
