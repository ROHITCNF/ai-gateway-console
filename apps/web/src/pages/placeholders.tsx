import { PageHeader } from '@/components/PageHeader';

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
