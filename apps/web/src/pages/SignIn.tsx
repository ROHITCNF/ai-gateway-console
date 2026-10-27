import type { Role } from '@gateway/contracts';
import { type FormEvent, useState } from 'react';
import { useSession } from '@/auth/session';
import { BootLogo, BootStatus, SignInSkeleton, useElapsedSeconds } from '@/components/boot';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const ROLES: { value: Role; label: string; hint: string }[] = [
  {
    value: 'viewer',
    label: 'Viewer',
    hint: 'Watch traffic, costs and history. Cannot change routes.',
  },
  {
    value: 'admin',
    label: 'Admin',
    hint: 'Everything a Viewer can do, plus change and undo routes.',
  },
];

/** Before this many seconds a cold start shows only the skeleton; after it, the form. */
const FORM_AFTER_S = 3;

/**
 * S0: role picker sign-in (FR-1, D4). While the session check runs (slow on a cold start), it
 * shows a boot screen, then lets the user fill the form so sign-in goes through once the
 * server is up.
 */
export function SignIn() {
  const { signIn, checking } = useSession();
  const [name, setName] = useState('');
  const [role, setRole] = useState<Role>('viewer');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const empty = name.trim() === '';
  const seconds = useElapsedSeconds(checking);
  const showForm = !checking || seconds >= FORM_AFTER_S;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (empty) return;
    setBusy(true);
    setError(null);
    try {
      await signIn({ name: name.trim(), role });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed');
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 py-12">
      {checking ? <BootLogo /> : <Logo />}
      <div className="w-full max-w-md overflow-hidden rounded-xl border bg-card shadow-xs">
        {checking && <BootStatus seconds={seconds} />}
        {showForm ? (
          <form onSubmit={submit} className="p-8">
            <h1 className="text-2xl font-semibold">Sign in</h1>
            <p className="mt-2 text-muted-foreground">
              See every AI request your company makes, what it costs, and which model each feature
              uses.
            </p>

            <label htmlFor="name" className="mt-6 block text-sm font-medium">
              Your name
            </label>
            <input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              autoComplete="name"
              className="mt-1.5 h-10 w-full rounded-md border border-input bg-card px-3 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              placeholder="e.g. Priya Rao"
            />

            <fieldset className="mt-5">
              <legend className="text-sm font-medium">Role</legend>
              <div className="mt-1.5 space-y-2">
                {ROLES.map((r) => (
                  <label
                    key={r.value}
                    className={cn(
                      'flex cursor-pointer gap-3 rounded-lg border p-3 has-focus-visible:ring-[3px] has-focus-visible:ring-ring/50',
                      role === r.value && 'border-primary bg-primary/5',
                    )}
                  >
                    <input
                      type="radio"
                      name="role"
                      value={r.value}
                      checked={role === r.value}
                      onChange={() => setRole(r.value)}
                      className="mt-1 accent-primary"
                    />
                    <span>
                      <span className="block font-medium">{r.label}</span>
                      <span className="block text-sm text-muted-foreground">{r.hint}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <Button type="submit" size="lg" className="mt-6 w-full" disabled={empty || busy}>
              {busy ? (checking ? 'Waiting for the server…' : 'Signing in…') : 'Sign in'}
            </Button>
            {empty && (
              <p className="mt-2 text-sm text-muted-foreground">Enter your name to sign in.</p>
            )}
            {checking && !empty && (
              <p className="mt-2 text-sm text-muted-foreground">
                You can sign in now. It goes through as soon as the server is up.
              </p>
            )}
            {error && (
              <p role="alert" className="mt-2 text-sm text-destructive">
                {error}
              </p>
            )}
            <p className="mt-6 text-xs text-muted-foreground">
              Demo sign-in: the role is picked here so you can try both views. In a company setup
              the role comes from your organisation.
            </p>
          </form>
        ) : (
          <SignInSkeleton />
        )}
      </div>
    </main>
  );
}
