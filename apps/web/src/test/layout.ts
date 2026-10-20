import { vi } from 'vitest';

/** jsdom has no layout: give elements a viewport so virtualised lists draw rows. */
export function mockLayout(height = 440, width = 1200) {
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(height);
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(width);
}
