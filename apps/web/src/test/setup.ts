import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { requestStore, resetGatewayState } from '@/store';

afterEach(() => {
  cleanup();
  requestStore.getState().reset();
  resetGatewayState();
});
