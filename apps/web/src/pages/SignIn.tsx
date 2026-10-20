import type { Role } from '@gateway/contracts';
import { type FormEvent, useState } from 'react';
import { useSession } from '@/auth/session';
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

/** S0: role picker sign-in (FR-1, D4). */
export function SignIn() {
  const { signIn } = useSession();
  const [name, setName] = useState('');
  const [role, setRole] = useState<Role>('viewer');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const empty = name.trim() === '';

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
      <Logo />
      <form onSubmit={submit} className="w-full max-w-md rounded-xl border bg-card p-8 shadow-xs">
        <h1 className="text-2xl font-semibold">Sign in</h1>
        <p className="mt-2 text-muted-foreground">
          See every AI request your company makes, what it costs, and which model each feature uses.
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
          {busy ? 'Signing in…' : 'Sign in'}
        </Button>
        {empty && <p className="mt-2 text-sm text-muted-foreground">Enter your name to sign in.</p>}
        {error && (
          <p role="alert" className="mt-2 text-sm text-destructive">
            {error}
          </p>
        )}
        <p className="mt-6 text-xs text-muted-foreground">
          Demo sign-in: the role is picked here so you can try both views. In a company setup the
          role comes from your organisation.
        </p>
      </form>
    </main>
  );
}
