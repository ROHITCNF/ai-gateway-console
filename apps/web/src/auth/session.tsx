import type { User } from '@gateway/contracts';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useGateway } from '@/gateway';
import { requestStore } from '@/store';

interface SessionValue {
  user: User | null;
  /** True until the backend says who is signed in. */
  checking: boolean;
  signIn(user: User): Promise<void>;
  signOut(): Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

/** Auth seam (D4, D15.7): the session lives in the backend cookie; this only mirrors it. */
export function SessionProvider({ children }: { children: ReactNode }) {
  const client = useGateway();
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let live = true;
    client
      .getSession()
      .then((u) => live && setUser(u))
      .catch(() => live && setUser(null))
      .finally(() => live && setChecking(false));
    return () => {
      live = false;
    };
  }, [client]);

  const signIn = useCallback(
    async (u: User) => {
      setUser(await client.signIn(u));
    },
    [client],
  );
  const signOut = useCallback(async () => {
    await client.signOut().catch(() => {});
    requestStore.getState().reset();
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
