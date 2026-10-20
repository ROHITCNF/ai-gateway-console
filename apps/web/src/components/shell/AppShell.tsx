import { MessageSquare } from 'lucide-react';
import { lazy, Suspense, useEffect } from 'react';
import { NavLink, Outlet } from 'react-router';
import { useSession } from '@/auth/session';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { DevControls } from '@/features/dev/DevControls';
import { ReviewDialog } from '@/features/routing/ReviewDialog';
import { useGateway } from '@/gateway';
import { cn } from '@/lib/utils';
import { applyConfirmed, connectRequests, gatewayStore, requestStore } from '@/store';
import { setChatOpen, useChatState } from '@/store/chat';
import { ConnectionBanner } from './ConnectionBanner';
import { ConnectionIndicator } from './ConnectionIndicator';

// The chat panel loads only when first opened (NFR-4).
const ChatPanel = lazy(() => import('@/features/chat/ChatPanel'));

const NAV = [
  { to: '/', label: 'Live Requests', end: true },
  { to: '/cost', label: 'Cost & Speed' },
  { to: '/routing', label: 'Routing' },
  { to: '/history', label: 'History' },
];

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

/** S1: top bar, navigation, connection banner and panel slots (FR-2, FR-31, NFR-11). */
export function AppShell() {
  const client = useGateway();
  const { user, signOut } = useSession();
  const chatOpen = useChatState((s) => s.open);

  useEffect(() => {
    client
      .getDev()
      .then((dev) => gatewayStore.setState({ dev }))
      .catch(() => {});
    return connectRequests(client, requestStore, {
      onDev: (dev) => gatewayStore.setState({ dev }),
      // Another viewer's confirmed change (or our own, echoed): same path as Confirm.
      onRouteChange: applyConfirmed,
    });
  }, [client]);

  if (!user) return null;
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 flex h-14 items-center gap-6 border-b bg-card px-4 lg:px-6">
        <Logo />
        <nav aria-label="Main" className="flex gap-1 overflow-x-auto">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                cn(
                  'rounded-md px-3 py-1.5 text-sm whitespace-nowrap text-muted-foreground hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 outline-none',
                  isActive && 'bg-secondary font-medium text-foreground',
                )
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-4">
          <ConnectionIndicator />
          <Button
            variant={chatOpen ? 'secondary' : 'outline'}
            size="sm"
            aria-expanded={chatOpen}
            onClick={() => setChatOpen(!chatOpen)}
          >
            <MessageSquare />
            Ask
          </Button>
          <span className="flex items-center gap-2 text-sm">
            <span
              className="grid size-8 place-items-center rounded-full bg-secondary text-xs font-medium"
              aria-hidden
            >
              {initials(user.name)}
            </span>
            <span className="font-medium" data-testid="user-name">
              {user.name}
            </span>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              {user.role === 'admin' ? 'Admin' : 'Viewer'}
            </span>
          </span>
          <Button variant="outline" size="sm" onClick={() => void signOut()}>
            Sign out
          </Button>
        </div>
      </header>
      <div className="flex min-h-0 flex-1">
        <main className="min-w-0 flex-1 space-y-4 p-4 lg:p-6">
          <ConnectionBanner />
          <Outlet />
          <DevControls />
        </main>
        {chatOpen && (
          <Suspense
            fallback={
              <p
                role="status"
                className="w-full max-w-sm border-l p-4 text-sm text-muted-foreground"
              >
                Loading chat…
              </p>
            }
          >
            <ChatPanel />
          </Suspense>
        )}
        <ReviewDialog />
      </div>
    </div>
  );
}
