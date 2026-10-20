import { Navigate, Route, Routes } from 'react-router';
import { SessionProvider, useSession } from '@/auth/session';
import { AppShell } from '@/components/shell/AppShell';
import { type GatewayClient, GatewayProvider } from '@/gateway';
import { CostSpeedPage, HistoryPage, LiveRequestsPage, RoutingPage } from '@/pages/placeholders';
import { SignIn } from '@/pages/SignIn';

function AppRoutes() {
  const { user, checking } = useSession();
  if (checking) {
    return (
      <p role="status" className="p-8 text-muted-foreground">
        Loading…
      </p>
    );
  }
  if (!user) return <SignIn />;
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<LiveRequestsPage />} />
        <Route path="cost" element={<CostSpeedPage />} />
        <Route path="routing" element={<RoutingPage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export function App({ client }: { client: GatewayClient }) {
  return (
    <GatewayProvider client={client}>
      <SessionProvider>
        <AppRoutes />
      </SessionProvider>
    </GatewayProvider>
  );
}
