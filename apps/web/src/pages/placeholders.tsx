import { PageHeader } from '@/components/PageHeader';

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
