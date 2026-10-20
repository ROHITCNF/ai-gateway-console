import { RequestRate } from '@gateway/contracts';

/** Backend config from environment. Secrets stay here, never in the browser (NFR-8, D15.13). */
export interface Config {
  port: number;
  /** Postgres connection string (D16.1). Unset → PGlite. */
  databaseUrl: string | undefined;
  /** PGlite data directory used when `databaseUrl` is unset. */
  pgliteDir: string;
  /** Fixed simulator seed (D2, D15.2). */
  simSeed: number;
  /** `SIM_ENABLED=false` runs without the simulator (D16.4). */
  simEnabled: boolean;
  simRate: RequestRate;
  /** Signs session cookies (NFR-8). */
  sessionSecret: string | undefined;
  /** `Secure` cookies when served over https. */
  secureCookie: boolean;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    port: Number(env.PORT ?? 8787),
    databaseUrl: env.DATABASE_URL || undefined,
    pgliteDir: env.PGLITE_DIR ?? '.data/pglite',
    simSeed: Number(env.SIM_SEED ?? 42),
    simEnabled: env.SIM_ENABLED !== 'false',
    simRate: RequestRate.catch(1).parse(Number(env.SIM_RATE ?? 1)),
    sessionSecret: env.SESSION_SECRET || undefined,
    secureCookie: env.NODE_ENV === 'production',
  };
}
