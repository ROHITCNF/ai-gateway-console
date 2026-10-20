import { Activity } from 'lucide-react';
import { Navigate, Route, Routes } from 'react-router';

function Home() {
  return (
    <main className="mx-auto max-w-5xl p-8">
      <h1 className="flex items-center gap-2 text-2xl font-semibold">
        <Activity className="size-6 text-primary" aria-hidden />
        Gateway Console
      </h1>
      <p className="mt-1 text-muted-foreground">
        Every AI request your features send through the gateway.
      </p>
    </main>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
