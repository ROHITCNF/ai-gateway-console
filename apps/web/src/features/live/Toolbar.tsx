import { FeatureId, ModelId, RequestStatus, Team } from '@gateway/contracts';
import { Search } from 'lucide-react';
import { Field, Input } from '@/components/ui/field';
import { Segmented } from '@/components/ui/segmented';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useRequests } from '@/store';
import {
  FEATURE_OPTIONS,
  MODEL_OPTIONS,
  STATUS_OPTIONS,
  TEAM_OPTIONS,
  TIME_LABEL,
  TIME_OPTIONS,
} from './options';

const ALL = 'all';

/** Parses a select value with its enum; `ALL` = no filter. */
function pick<T>(
  schema: { safeParse(v: unknown): { success: boolean; data?: T } },
  v: string,
): T | null {
  const r = schema.safeParse(v);
  return r.success ? (r.data ?? null) : null;
}

function FilterSelect({
  id,
  value,
  allLabel,
  options,
  onChange,
}: {
  id: string;
  value: string | null;
  allLabel: string;
  options: readonly { value: string; label: string }[];
  onChange(v: string): void;
}) {
  return (
    <Select value={value ?? ALL} onValueChange={onChange}>
      <SelectTrigger id={id} className="min-w-40">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{allLabel}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Live Requests filters: ID search, feature, team, model, status, time range (FR-5, FR-6). */
export function Toolbar() {
  const f = useRequests((s) => s.filters);
  const setFilters = useRequests((s) => s.setFilters);
  const timeOptions =
    f.timeRange === 'today'
      ? [...TIME_OPTIONS, { value: 'today' as const, label: TIME_LABEL.today }]
      : TIME_OPTIONS;

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4">
      <Field label="Request ID" htmlFor="f-id" className="min-w-52 flex-1">
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-2.5 left-3 size-4 text-muted-foreground"
            aria-hidden
          />
          <Input
            id="f-id"
            type="search"
            value={f.requestId}
            onChange={(e) => setFilters({ requestId: e.target.value })}
            placeholder="Search by request ID"
            className="w-full pl-9"
          />
        </div>
      </Field>
      <Field label="Feature" htmlFor="f-feature">
        <FilterSelect
          id="f-feature"
          value={f.featureId}
          allLabel="All features"
          options={FEATURE_OPTIONS}
          onChange={(v) => setFilters({ featureId: pick(FeatureId, v) })}
        />
      </Field>
      <Field label="Team" htmlFor="f-team">
        <FilterSelect
          id="f-team"
          value={f.team}
          allLabel="All teams"
          options={TEAM_OPTIONS.map((t) => ({ value: t, label: t }))}
          onChange={(v) => setFilters({ team: pick(Team, v) })}
        />
      </Field>
      <Field label="Model" htmlFor="f-model">
        <FilterSelect
          id="f-model"
          value={f.modelId}
          allLabel="All models"
          options={MODEL_OPTIONS}
          onChange={(v) => setFilters({ modelId: pick(ModelId, v) })}
        />
      </Field>
      <Field label="Status" htmlFor="f-status">
        <FilterSelect
          id="f-status"
          value={f.status}
          allLabel="All statuses"
          options={STATUS_OPTIONS}
          onChange={(v) => setFilters({ status: pick(RequestStatus, v) })}
        />
      </Field>
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium" aria-hidden>
          Time range
        </span>
        <Segmented
          label="Time range"
          value={f.timeRange}
          options={timeOptions}
          onChange={(timeRange) => setFilters({ timeRange })}
        />
      </div>
    </div>
  );
}
