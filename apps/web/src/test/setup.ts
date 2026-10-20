import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { requestStore, resetGatewayState } from '@/store';
import { resetChatState } from '@/store/chat';

afterEach(() => {
  cleanup();
  requestStore.getState().reset();
  resetGatewayState();
  resetChatState();
});
