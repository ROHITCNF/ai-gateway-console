import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { SessionProvider, useSession } from '@/auth/session';
import { AppShell } from '@/components/shell/AppShell';
import { LoadingState } from '@/components/states';
import { type GatewayClient, GatewayProvider } from '@/gateway';
import { HistoryPage } from '@/pages/History';
import { LiveRequestsPage } from '@/pages/LiveRequests';
import { RoutingPage } from '@/pages/Routing';

// Charts load only with the Cost & Speed screen (NFR-4).
const CostSpeedPage = lazy(() => import('@/pages/CostSpeed'));

import { SignIn } from '@/pages/SignIn';

function AppRoutes() {
  const { user } = useSession();
  // While the session check runs, SignIn shows the boot screen and lets the user fill the form.
  if (!user) return <SignIn />;
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<LiveRequestsPage />} />
        <Route
          path="cost"
          element={
            <Suspense fallback={<LoadingState label="Loading charts…" />}>
              <CostSpeedPage />
            </Suspense>
          }
        />
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
