import type { RequestStatus } from '@gateway/contracts';
import { Check, CornerDownRight, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const STYLE: Record<RequestStatus, { label: string; Icon: typeof Check; className: string }> = {
  success: { label: 'Success', Icon: Check, className: 'bg-success-soft text-success' },
  fallback: { label: 'Fallback', Icon: CornerDownRight, className: 'bg-warning-soft text-warning' },
  failed: { label: 'Failed', Icon: X, className: 'bg-danger-soft text-destructive' },
};

/** Status with icon and label, never colour alone (NFR-11, FR-8). */
export function StatusBadge({ status }: { status: RequestStatus }) {
  const { label, Icon, className } = STYLE[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {label}
    </span>
  );
}
