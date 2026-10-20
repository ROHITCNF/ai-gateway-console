import type { FeatureId, GatewayRequest, ModelId, RequestRate } from '@gateway/contracts';
import { count, desc, lt } from 'drizzle-orm';
import type { Db } from '../db/client';
import { requests, routingRules } from '../db/schema';
import { generateHistory, generateRequest, type RuleMap } from './engine';
import { createRng, type Rng } from './rng';

export const TICK_MS = 250;
export const SEED_COUNT = 10_000;
export const SEED_WINDOW_MS = 3 * 3600_000;
export const DB_MAX_REQUESTS = 200_000;
const INSERT_CHUNK = 1000;
const TRIM_EVERY_TICKS = 120;

export interface SimulatorOptions {
  db: Db;
  seed: number;
  rate?: RequestRate;
  now?: () => number;
  maxRows?: number;
}

type BatchListener = (batch: GatewayRequest[]) => void;

/**
 * Runs the simulator inside the backend (D15.2): seeds history when the table is empty (D13.4),
 * then generates `rate` requests per second, writes them in 250 ms batches and tells listeners.
 */
export class Simulator {
  readonly #db: Db;
  readonly #rng: Rng;
  readonly #now: () => number;
  readonly #maxRows: number;
  #rules: RuleMap | null = null;
  #rate: RequestRate;
  #carry = 0;
  #lastTick = 0;
  #ticks = 0;
  #timer: ReturnType<typeof setInterval> | null = null;
  #busy = false;
  #listeners = new Set<BatchListener>();

  constructor(opts: SimulatorOptions) {
    this.#db = opts.db;
    this.#rng = createRng(opts.seed);
    this.#rate = opts.rate ?? 1;
    this.#now = opts.now ?? Date.now;
    this.#maxRows = opts.maxRows ?? DB_MAX_REQUESTS;
  }

  get rate(): RequestRate {
    return this.#rate;
  }

  setRate(rate: RequestRate): void {
    this.#rate = rate;
  }

  /** Called after a confirmed route change; applies from the next request (FR-20). */
  setRule(featureId: FeatureId, mainModelId: ModelId, fallbackModelId: ModelId): void {
    if (this.#rules) this.#rules[featureId] = { mainModelId, fallbackModelId };
  }

  onBatch(listener: BatchListener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  /** Loads rules and seeds history if needed. */
  async init(): Promise<void> {
    const rows = await this.#db.select().from(routingRules);
    this.#rules = Object.fromEntries(
      rows.map((r) => [
        r.featureId,
        { mainModelId: r.mainModelId, fallbackModelId: r.fallbackModelId },
      ]),
    ) as RuleMap;
    const [row] = await this.#db.select({ n: count() }).from(requests);
    const now = this.#now();
    if ((row?.n ?? 0) === 0) {
      await this.#insert(
        generateHistory(this.#rng, SEED_COUNT, now - SEED_WINDOW_MS, now, this.#rules),
      );
    }
    this.#lastTick = now;
  }

  start(): void {
    if (this.#timer) return;
    this.#timer = setInterval(() => void this.tick(), TICK_MS);
  }

  stop(): void {
    if (this.#timer) clearInterval(this.#timer);
    this.#timer = null;
  }

  /** One batch: requests due since the last tick, spread over that interval. */
  async tick(): Promise<GatewayRequest[]> {
    if (!this.#rules || this.#busy) return [];
    this.#busy = true;
    try {
      const now = this.#now();
      const elapsed = Math.max(0, now - this.#lastTick);
      const due = this.#carry + (elapsed / 1000) * this.#rate;
      const n = Math.floor(due);
      this.#carry = due - n;
      const start = this.#lastTick;
      this.#lastTick = now;
      const batch: GatewayRequest[] = [];
      for (let i = 0; i < n; i++) {
        const t = Math.floor(start + ((i + this.#rng.next()) / n) * elapsed);
        batch.push(generateRequest(this.#rng, Math.min(t, now), this.#rules));
      }
      if (batch.length > 0) {
        await this.#insert(batch);
        for (const l of this.#listeners) l(batch);
      }
      if (++this.#ticks % TRIM_EVERY_TICKS === 0) await this.trim();
      return batch;
    } finally {
      this.#busy = false;
    }
  }

  /** Keeps only the newest `maxRows` requests (D15.4). */
  async trim(): Promise<void> {
    const [cut] = await this.#db
      .select({ ts: requests.timestamp })
      .from(requests)
      .orderBy(desc(requests.timestamp))
      .offset(this.#maxRows)
      .limit(1);
    if (cut) await this.#db.delete(requests).where(lt(requests.timestamp, cut.ts + 1));
  }

  async #insert(batch: GatewayRequest[]): Promise<void> {
    for (let i = 0; i < batch.length; i += INSERT_CHUNK) {
      await this.#db
        .insert(requests)
        .values(batch.slice(i, i + INSERT_CHUNK))
        .onConflictDoNothing();
    }
  }
}
