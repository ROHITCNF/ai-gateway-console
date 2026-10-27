import { useEffect, useState } from 'react';

/** Boot screen pieces shown while a sleeping server wakes up (cold start). */

/** Seconds since mount, ticking once a second while `running`. */
export function useElapsedSeconds(running: boolean): number {
  const [start] = useState(() => Date.now());
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setSeconds(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(id);
  }, [running, start]);
  return seconds;
}

/** Honest status line for each stage of a cold start. */
export function bootMessage(seconds: number): string {
  if (seconds < 3) return 'Connecting to the gateway…';
  if (seconds < 10) return 'Waking the server. The demo sleeps when nobody is using it.';
  if (seconds < 30) return 'Starting the traffic simulator…';
  return 'Almost there. A cold start can take up to a minute.';
}

// Same heartbeat as the lucide `Activity` icon in the regular logo.
const TRACE =
  'M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2';

/** The brand mark with a heartbeat trace drawing across it and a soft pulse ring. */
export function BootLogo() {
  return (
    <span className="relative grid size-14 place-items-center">
      <span className="boot-ring absolute inset-0 rounded-xl bg-primary/30" aria-hidden />
      <span className="relative grid size-14 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
        <svg
          viewBox="0 0 24 24"
          className="boot-trace size-8"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d={TRACE} opacity={0.35} />
          <path d={TRACE} pathLength={1} />
        </svg>
      </span>
    </span>
  );
}

/** Status strip at the top of the sign-in card: eased progress bar plus the stage message. */
export function BootStatus({ seconds }: { seconds: number }) {
  return (
    <div role="status" className="border-b">
      <div className="h-1 bg-muted" aria-hidden>
        <div className="boot-progress h-full bg-primary" />
      </div>
      <p className="px-8 py-3 text-sm text-muted-foreground">{bootMessage(seconds)}</p>
    </div>
  );
}

/** Shimmer placeholder in the shape of the sign-in form, so nothing jumps when it appears. */
export function SignInSkeleton() {
  return (
    <div className="p-8" aria-hidden data-testid="sign-in-skeleton">
      <div className="shimmer h-7 w-28 rounded" />
      <div className="shimmer mt-3 h-4 w-full rounded" />
      <div className="shimmer mt-2 h-4 w-3/4 rounded" />
      <div className="shimmer mt-6 h-4 w-20 rounded" />
      <div className="shimmer mt-2 h-10 w-full rounded-md" />
      <div className="shimmer mt-5 h-4 w-12 rounded" />
      <div className="shimmer mt-2 h-16 w-full rounded-lg" />
      <div className="shimmer mt-2 h-16 w-full rounded-lg" />
      <div className="shimmer mt-6 h-10 w-full rounded-md" />
    </div>
  );
}
