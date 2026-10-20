import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { requestStore } from '@/store';

afterEach(() => {
  cleanup();
  requestStore.getState().reset();
});
