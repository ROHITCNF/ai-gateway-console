import { Activity } from 'lucide-react';

export function Logo() {
  return (
    <span className="flex items-center gap-2 font-semibold">
      <span className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground">
        <Activity className="size-4" aria-hidden />
      </span>
      Gateway Console
    </span>
  );
}
