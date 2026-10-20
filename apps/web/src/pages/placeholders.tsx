import { PageHeader } from '@/components/PageHeader';

export function LiveRequestsPage() {
  return (
    <PageHeader
      title="Live Requests"
      intro="Every AI request your features send through the gateway, newest first. Click a row to see what happened."
    />
  );
}

export function CostSpeedPage() {
  return (
    <PageHeader
      title="Cost & Speed"
      intro="What your AI traffic costs and how fast it answers, by model and by feature."
    />
  );
}

export function RoutingPage() {
  return (
    <PageHeader
      title="Routing"
      intro="Which model each feature uses first, and which backup answers when it fails."
    />
  );
}

export function HistoryPage() {
  return <PageHeader title="History" intro="Every confirmed routing change, newest first." />;
}
