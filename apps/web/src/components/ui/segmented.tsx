import { cn } from '@/lib/utils';

interface Props<T extends string | number> {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange(value: T): void;
  className?: string;
}

/** Small button group; the pressed state is announced, not only coloured (NFR-11). */
export function Segmented<T extends string | number>({
  label,
  value,
  options,
  onChange,
  className,
}: Props<T>) {
  return (
    <fieldset
      aria-label={label}
      className={cn('m-0 inline-flex min-w-0 rounded-md border bg-card p-0.5', className)}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn(
            'h-8 rounded-[5px] px-3 text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50',
            o.value === value && 'bg-secondary font-medium text-foreground',
          )}
        >
          {o.label}
        </button>
      ))}
    </fieldset>
  );
}
