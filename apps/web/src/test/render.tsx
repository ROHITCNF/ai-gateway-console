import type { User } from '@gateway/contracts';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { App } from '@/App';
import { FakeGatewayClient } from '@/gateway/fake';

/** Renders the whole app on a fake gateway, optionally already signed in. */
export function renderApp(
  opts: { user?: User | null; path?: string; client?: FakeGatewayClient } = {},
) {
  const client = opts.client ?? new FakeGatewayClient({ user: opts.user ?? null });
  const utils = render(
    <MemoryRouter initialEntries={[opts.path ?? '/']}>
      <App client={client} />
    </MemoryRouter>,
  );
  return { client, ...utils };
}
