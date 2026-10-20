import type { StreamEventName } from '@gateway/contracts';

export interface SseEvent {
  event: StreamEventName;
  data: string;
  id?: string;
}

interface Connection {
  send(event: SseEvent): void;
  close(): void;
}

/** Fans server events out to every open live-stream connection (FR-30, D15.6). */
export class StreamHub {
  #connections = new Map<string, Connection>();
  #blockedUntil = new Map<string, number>();

  /** Refuses reconnects from `connectionId` until `untilMs` (developer "drop connection"). */
  block(connectionId: string, untilMs: number): void {
    this.#blockedUntil.set(connectionId, untilMs);
  }

  isBlocked(connectionId: string, now: number): boolean {
    const until = this.#blockedUntil.get(connectionId);
    if (until === undefined) return false;
    if (now < until) return true;
    this.#blockedUntil.delete(connectionId);
    return false;
  }

  add(connectionId: string, conn: Connection): () => void {
    this.#connections.get(connectionId)?.close();
    this.#connections.set(connectionId, conn);
    return () => {
      if (this.#connections.get(connectionId) === conn) this.#connections.delete(connectionId);
    };
  }

  get size(): number {
    return this.#connections.size;
  }

  broadcast(event: StreamEventName, payload: unknown, id?: string): void {
    const ev: SseEvent = { event, data: JSON.stringify(payload), id };
    for (const conn of this.#connections.values()) conn.send(ev);
  }

  /** Closes one connection; returns whether it was open. */
  close(connectionId: string): boolean {
    const conn = this.#connections.get(connectionId);
    if (!conn) return false;
    this.#connections.delete(connectionId);
    conn.close();
    return true;
  }
}
