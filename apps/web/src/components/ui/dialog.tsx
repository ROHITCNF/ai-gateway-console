import { Dialog as D } from 'radix-ui';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

/** shadcn-style dialog on Radix: focus trap, Esc and outside click handled (D14.2, NFR-11). */
export const Dialog = D.Root;
export const DialogTitle = D.Title;
export const DialogDescription = D.Description;

export function DialogContent({ className, children, ...props }: ComponentProps<typeof D.Content>) {
  return (
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-40 bg-slate-900/40" />
      <D.Content
        className={cn(
          'fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-card shadow-xl outline-none',
          className,
        )}
        {...props}
      >
        {children}
      </D.Content>
    </D.Portal>
  );
}
