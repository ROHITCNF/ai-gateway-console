import { Pause, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatInt } from '@/lib/format';
import { useRequests } from '@/store';

/** Pause stops new rows appearing; Resume catches up (FR-4). */
export function PauseControl() {
  const paused = useRequests((s) => s.paused);
  const pending = useRequests((s) => s.pending.length);
  const pause = useRequests((s) => s.pause);
  const resume = useRequests((s) => s.resume);

  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-muted-foreground" aria-live="polite">
        {paused ? `Paused · ${formatInt(pending)} new` : 'Streaming'}
      </span>
      {paused ? (
        <Button variant="outline" onClick={resume}>
          <Play aria-hidden /> Resume
        </Button>
      ) : (
        <Button variant="outline" onClick={pause}>
          <Pause aria-hidden /> Pause
        </Button>
      )}
    </div>
  );
}
