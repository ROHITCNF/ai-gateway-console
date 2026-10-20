import { getModel } from '@gateway/contracts';
import { Send, X } from 'lucide-react';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useSession } from '@/auth/session';
import { Button } from '@/components/ui/button';
import { useGateway } from '@/gateway';
import { cn } from '@/lib/utils';
import { type ChatEntry, reviewProposal, sendChat, setChatOpen, useChatState } from '@/store/chat';

const EXAMPLES = [
  'Show failed requests from support-bot today',
  'How much did the payments team spend in the last hour?',
  'What model does code-review use?',
];
const ADMIN_EXAMPLE = 'Move support-bot to a cheaper model';

/**
 * S7: "Ask your gateway" side panel (FR-24..FR-28). Loaded on demand (NFR-4). It filters and
 * answers; a route change only opens the review step (FR-26, NFR-5).
 */
export default function ChatPanel() {
  const client = useGateway();
  const navigate = useNavigate();
  const { user } = useSession();
  const messages = useChatState((s) => s.messages);
  const sending = useChatState((s) => s.sending);
  const [text, setText] = useState('');
  const input = useRef<HTMLTextAreaElement>(null);
  const list = useRef<HTMLOListElement>(null);

  const examples = user?.role === 'admin' ? [...EXAMPLES, ADMIN_EXAMPLE] : EXAMPLES;
  const effects = { showLiveRequests: () => navigate('/') };

  useEffect(() => {
    input.current?.focus();
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll when a message arrives
  useEffect(() => {
    list.current?.lastElementChild?.scrollIntoView?.({ block: 'end' });
  }, [messages.length]);

  const send = (value: string) => {
    if (!value.trim() || sending) return;
    setText('');
    void sendChat(client, value, effects);
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    send(text);
  };

  return (
    <aside
      aria-label="Ask your gateway"
      className="sticky top-14 flex h-[calc(100vh-3.5rem)] w-full max-w-sm shrink-0 flex-col border-l bg-card"
      onKeyDown={(e) => {
        if (e.key === 'Escape') setChatOpen(false);
      }}
    >
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">Ask your gateway</h2>
          <p className="text-xs text-muted-foreground">
            Filters and answers. Never applies changes.
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Close chat"
          onClick={() => setChatOpen(false)}
        >
          <X />
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {messages.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Ask about requests, cost or routes. Try one of these:
            </p>
            <ul className="flex flex-wrap gap-2" aria-label="Example questions">
              {examples.map((ex) => (
                <li key={ex}>
                  <button
                    type="button"
                    className="rounded-full border bg-background px-3 py-1 text-left text-xs hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 outline-none"
                    onClick={() => send(ex)}
                  >
                    {ex}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <ol ref={list} className="space-y-3" aria-label="Conversation" aria-live="polite">
            {messages.map((m) => (
              <Message key={m.id} entry={m} />
            ))}
            {sending && (
              <li role="status" className="text-xs text-muted-foreground">
                Thinking…
              </li>
            )}
          </ol>
        )}
      </div>

      <form onSubmit={onSubmit} className="flex items-end gap-2 border-t p-3">
        <label htmlFor="chat-input" className="sr-only">
          Message
        </label>
        <textarea
          id="chat-input"
          ref={input}
          rows={2}
          maxLength={500}
          value={text}
          placeholder="e.g. show failed requests today"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send(text);
            }
          }}
          className="min-h-9 flex-1 resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        />
        <Button type="submit" size="icon" aria-label="Send" disabled={sending || !text.trim()}>
          <Send />
        </Button>
      </form>
    </aside>
  );
}

function Message({ entry }: { entry: ChatEntry }) {
  const navigate = useNavigate();
  if (entry.role === 'user') {
    return (
      <li className="ml-8 rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground">
        {entry.text}
      </li>
    );
  }
  const a = entry.action;
  return (
    <li className="mr-4 space-y-2 rounded-lg border bg-background px-3 py-2 text-sm">
      {entry.understood && (
        <div className="rounded-md bg-secondary px-2 py-1 text-xs">
          <span className="font-medium">Understood: </span>
          <span data-testid="understood">{entry.understood}</span>
        </div>
      )}
      <p role={entry.error ? 'alert' : undefined} className={cn(entry.error && 'text-destructive')}>
        {entry.text}
      </p>
      {a?.kind === 'propose_route_change' && (
        <Button
          size="sm"
          className="h-auto min-h-8 max-w-full whitespace-normal py-1.5 text-left"
          onClick={() => reviewProposal(a)}
        >
          Review change: {a.featureId} → {getModel(a.mainModelId).displayName}
        </Button>
      )}
      {(a?.kind === 'show_route' || a?.kind === 'refuse') && (
        <Button size="sm" variant="outline" onClick={() => navigate('/routing')}>
          Open Routing
        </Button>
      )}
      {a?.kind === 'filter' && (
        <Button size="sm" variant="outline" onClick={() => navigate('/')}>
          Open Live Requests
        </Button>
      )}
    </li>
  );
}
