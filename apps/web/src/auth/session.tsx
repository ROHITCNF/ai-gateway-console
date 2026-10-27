import type { User } from '@gateway/contracts';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { GatewayError, useGateway } from '@/gateway';
import { requestStore, resetGatewayState } from '@/store';
import { resetChatState } from '@/store/chat';

interface SessionValue {
  user: User | null;
  /** True until the backend says who is signed in; long on a cold start. */
  checking: boolean;
  signIn(user: User): Promise<void>;
  signOut(): Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

const RETRY_MS = 2000;
const GIVE_UP_MS = 90_000;

/**
 * A sleeping free-tier host answers 502–504 (or nothing) while it boots. Keep retrying until it
 * is up, so a cold start looks slow rather than broken.
 */
export async function whenAwake<T>(call: () => Promise<T>, now = Date.now): Promise<T> {
  const start = now();
  for (;;) {
    try {
      return await call();
    } catch (err) {
      const waking = err instanceof GatewayError && (err.status === 0 || err.status >= 502);
      if (!waking || now() - start > GIVE_UP_MS) throw err;
      await new Promise((r) => setTimeout(r, RETRY_MS));
    }
  }
}

/** Auth seam (D4, D15.7): the session lives in the backend cookie; this only mirrors it. */
export function SessionProvider({ children }: { children: ReactNode }) {
  const client = useGateway();
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  // Once the user signs in, a late session answer from a cold start must not overwrite it.
  const signedIn = useRef(false);

  useEffect(() => {
    let live = true;
    whenAwake(() => client.getSession())
      .then((u) => live && !signedIn.current && setUser(u))
      .catch(() => live && !signedIn.current && setUser(null))
      .finally(() => live && setChecking(false));
    return () => {
      live = false;
    };
  }, [client]);

  const signIn = useCallback(
    async (u: User) => {
      const signed = await whenAwake(() => client.signIn(u));
      signedIn.current = true;
      setUser(signed);
    },
    [client],
  );
  const signOut = useCallback(async () => {
    await client.signOut().catch(() => {});
    requestStore.getState().reset();
    resetGatewayState();
    resetChatState();
    signedIn.current = false;
    setUser(null);
  }, [client]);

  const value = useMemo(
    () => ({ user, checking, signIn, signOut }),
    [user, checking, signIn, signOut],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const v = useContext(SessionContext);
  if (!v) throw new Error('useSession outside SessionProvider');
  return v;
}
