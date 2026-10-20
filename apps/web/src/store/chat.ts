import {
  CHAT_ACTION_KINDS,
  ChatAction,
  type ChatMessage,
  type ChatResponse,
} from '@gateway/contracts';
import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import type { GatewayClient } from '@/gateway';
import { openReview } from './gateway';
import { requestStore } from './index';

/** A chat message plus the action it carried, for the buttons under a reply (S7). */
export interface ChatEntry extends ChatMessage {
  action: ChatAction | null;
  /** True when the reply is our own error, not the gateway's answer. */
  error?: boolean;
}

export interface ChatState {
  open: boolean;
  messages: ChatEntry[];
  /** A message is on its way to `POST /api/chat`. */
  sending: boolean;
}

const initial: ChatState = { open: false, messages: [], sending: false };

/** Chat panel state, kept outside components so it survives navigation (S7). */
export const chatStore = createStore<ChatState>()(() => initial);

export function useChatState<T>(selector: (s: ChatState) => T): T {
  return useStore(chatStore, selector);
}

export function resetChatState() {
  chatStore.setState(initial, true);
}

export function setChatOpen(open: boolean) {
  chatStore.setState({ open });
}

/**
 * Client-side check of the returned action against the fixed list (D15.10, NFR-7). Anything else
 * is dropped and shown as not understood.
 */
export function allowedAction(action: unknown): ChatAction | null {
  const parsed = ChatAction.safeParse(action);
  if (!parsed.success) return null;
  return (CHAT_ACTION_KINDS as readonly string[]).includes(parsed.data.kind) ? parsed.data : null;
}

let seq = 0;
const nextId = () => `msg_${Date.now().toString(36)}_${++seq}`;

export interface ChatEffects {
  /** Show Live Requests, where a filter action lands (FR-25). */
  showLiveRequests(): void;
}

/**
 * Sends one message and carries out the reply's action. Only filters and opening the review step
 * happen here: a proposal never applies a change (FR-26, NFR-5).
 */
export async function sendChat(client: GatewayClient, text: string, effects: ChatEffects) {
  const trimmed = text.trim();
  if (!trimmed || chatStore.getState().sending) return;
  const user: ChatEntry = {
    id: nextId(),
    role: 'user',
    text: trimmed,
    understood: null,
    proposedChange: null,
    action: null,
  };
  chatStore.setState((s) => ({ messages: [...s.messages, user], sending: true }));

  let entry: ChatEntry;
  try {
    const res: ChatResponse = await client.chat({
      text: trimmed,
      timezoneOffsetMinutes: -new Date().getTimezoneOffset(),
    });
    const action = allowedAction(res.action);
    entry = action
      ? {
          id: nextId(),
          role: 'assistant',
          text: res.reply,
          // Always show what was understood (FR-28).
          understood: res.understood,
          proposedChange:
            action.kind === 'propose_route_change'
              ? {
                  featureId: action.featureId,
                  mainModelId: action.mainModelId,
                  fallbackModelId: action.fallbackModelId,
                }
              : null,
          action,
        }
      : {
          id: nextId(),
          role: 'assistant',
          text: 'Sorry, that reply contained an action I am not allowed to take.',
          understood: 'Not understood',
          proposedChange: null,
          action: { kind: 'not_understood' },
        };
  } catch (e) {
    entry = {
      id: nextId(),
      role: 'assistant',
      text: e instanceof Error ? e.message : 'Could not reach the gateway. Try again.',
      understood: null,
      proposedChange: null,
      action: null,
      error: true,
    };
  }
  chatStore.setState((s) => ({ messages: [...s.messages, entry], sending: false }));
  if (entry.action) runAction(entry.action, effects);
}

/** Carries out an allowed action. Filters drive Live Requests; proposals open the review step. */
export function runAction(action: ChatAction, effects: ChatEffects) {
  switch (action.kind) {
    case 'filter':
      requestStore.getState().setFilters(action.filters);
      effects.showLiveRequests();
      return;
    case 'propose_route_change':
      reviewProposal(action);
      return;
    default:
      return;
  }
}

/** Opens S5 with source `chat` (Flow D). Confirm there is the only way to apply it. */
export function reviewProposal(p: Extract<ChatAction, { kind: 'propose_route_change' }>) {
  openReview({
    featureId: p.featureId,
    mainModelId: p.mainModelId,
    fallbackModelId: p.fallbackModelId,
    source: 'chat',
  });
}
