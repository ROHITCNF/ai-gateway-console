import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { gatewayStore, requestStore } from '@/store';

afterEach(() => {
  cleanup();
  requestStore.getState().reset();
  gatewayStore.setState({ dev: null });
});
