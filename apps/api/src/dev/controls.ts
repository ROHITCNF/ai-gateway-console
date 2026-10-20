import type { DevState, DevUpdateBody, RequestRate } from '@gateway/contracts';

export interface RateTarget {
  readonly rate: RequestRate;
  setRate(rate: RequestRate): void;
}

/**
 * Global simulator controls (D13.14, D15.12): request rate and "fail next route change" affect
 * every viewer of the demo.
 */
export class DevControls {
  #failNext = false;

  constructor(
    readonly target: RateTarget,
    readonly onChange: (state: DevState) => void = () => {},
  ) {}

  get state(): DevState {
    return { rate: this.target.rate, failNextRouteChange: this.#failNext };
  }

  update(body: DevUpdateBody): DevState {
    if (body.rate !== undefined) this.target.setRate(body.rate);
    if (body.failNextRouteChange !== undefined) this.#failNext = body.failNextRouteChange;
    this.onChange(this.state);
    return this.state;
  }

  /** Consumes the "fail next route change" flag (D13.9). */
  takeFailNext(): boolean {
    const f = this.#failNext;
    if (f) {
      this.#failNext = false;
      this.onChange(this.state);
    }
    return f;
  }
}
