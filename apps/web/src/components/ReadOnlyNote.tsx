import { Lock } from 'lucide-react';

export function ReadOnlyNote({ text }: { text: string }) {
  return (
    <p className="flex items-center gap-2 rounded-lg border bg-muted/60 px-4 py-2.5 text-sm text-muted-foreground">
      <Lock className="size-4 shrink-0" aria-hidden />
      {text}
    </p>
  );
}
