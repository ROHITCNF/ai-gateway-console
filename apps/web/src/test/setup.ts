import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { requestStore, resetGatewayState } from '@/store';
import { resetChatState } from '@/store/chat';

// jsdom lacks the pointer-capture and scroll APIs Radix Select calls.
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.releasePointerCapture ??= () => {};
Element.prototype.scrollIntoView ??= () => {};

afterEach(() => {
  cleanup();
  requestStore.getState().reset();
  resetGatewayState();
  resetChatState();
});
