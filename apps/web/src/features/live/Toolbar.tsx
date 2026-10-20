import { FeatureId, ModelId, RequestStatus, Team } from '@gateway/contracts';
import { Search } from 'lucide-react';
import { Field, Input, Select } from '@/components/ui/field';
import { Segmented } from '@/components/ui/segmented';
import { useRequests } from '@/store';
import {
  FEATURE_OPTIONS,
  MODEL_OPTIONS,
  STATUS_OPTIONS,
  TEAM_OPTIONS,
  TIME_LABEL,
  TIME_OPTIONS,
} from './options';

/** Parses a select value with its enum; empty = no filter. */
function pick<T>(
  schema: { safeParse(v: unknown): { success: boolean; data?: T } },
  v: string,
): T | null {
  const r = schema.safeParse(v);
  return r.success ? (r.data ?? null) : null;
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
        <Select
          id="f-feature"
          value={f.featureId ?? ''}
          onChange={(e) => setFilters({ featureId: pick(FeatureId, e.target.value) })}
        >
          <option value="">All features</option>
          {FEATURE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Team" htmlFor="f-team">
        <Select
          id="f-team"
          value={f.team ?? ''}
          onChange={(e) => setFilters({ team: pick(Team, e.target.value) })}
        >
          <option value="">All teams</option>
          {TEAM_OPTIONS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Model" htmlFor="f-model">
        <Select
          id="f-model"
          value={f.modelId ?? ''}
          onChange={(e) => setFilters({ modelId: pick(ModelId, e.target.value) })}
        >
          <option value="">All models</option>
          {MODEL_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Status" htmlFor="f-status">
        <Select
          id="f-status"
          value={f.status ?? ''}
          onChange={(e) => setFilters({ status: pick(RequestStatus, e.target.value) })}
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
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
