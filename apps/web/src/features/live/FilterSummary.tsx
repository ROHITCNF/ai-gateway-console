import { getFeature, type RequestFilters } from '@gateway/contracts';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatInt, modelName } from '@/lib/format';
import { useRequests } from '@/store';
import { STATUS_OPTIONS, TIME_LABEL } from './options';

type Chip = { key: keyof RequestFilters; label: string };

export function describeFilters(f: RequestFilters): Chip[] {
  const chips: Chip[] = [];
  if (f.featureId)
    chips.push({ key: 'featureId', label: `Feature: ${getFeature(f.featureId).displayName}` });
  if (f.team) chips.push({ key: 'team', label: `Team: ${f.team}` });
  if (f.modelId) chips.push({ key: 'modelId', label: `Model: ${modelName(f.modelId)}` });
  if (f.status)
    chips.push({
      key: 'status',
      label: `Status: ${STATUS_OPTIONS.find((s) => s.value === f.status)?.label}`,
    });
  if (f.timeRange !== 'all')
    chips.push({ key: 'timeRange', label: `Time: ${TIME_LABEL[f.timeRange]}` });
  if (f.requestId.trim())
    chips.push({ key: 'requestId', label: `ID contains “${f.requestId.trim()}”` });
  return chips;
}

const RESET: { [K in keyof RequestFilters]: RequestFilters[K] } = {
  featureId: null,
  team: null,
  modelId: null,
  status: null,
  timeRange: 'all',
  requestId: '',
};

/** Row count plus removable chips for active filters, so chat-set filters are visible (S2). */
export function FilterSummary({ shown }: { shown: number }) {
  const filters = useRequests((s) => s.filters);
  const total = useRequests((s) => s.requests.length);
  const setFilters = useRequests((s) => s.setFilters);
  const clear = useRequests((s) => s.clearFilters);
  const chips = describeFilters(filters);

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span aria-live="polite" className="mr-auto text-muted-foreground">
        Showing {formatInt(shown)} of {formatInt(total)} requests
      </span>
      {chips.length === 0 ? (
        <span className="text-muted-foreground">No filters applied</span>
      ) : (
        <>
          {chips.map((c) => (
            <span
              key={c.key}
              className="inline-flex items-center gap-1 rounded-full border bg-card py-0.5 pr-1 pl-2.5"
            >
              {c.label}
              <button
                type="button"
                aria-label={`Remove ${c.label}`}
                onClick={() => setFilters({ [c.key]: RESET[c.key] })}
                className="rounded-full p-0.5 text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </span>
          ))}
          <Button variant="link" size="sm" onClick={clear} className="h-auto px-1">
            Clear all
          </Button>
        </>
      )}
    </div>
  );
}
