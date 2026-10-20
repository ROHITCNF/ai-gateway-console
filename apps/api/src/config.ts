/** Backend config from environment. Secrets stay here, never in the browser (NFR-8, D15.13). */
export interface Config {
  port: number;
  /** Postgres connection string (D16.1). Unset → PGlite. */
  databaseUrl: string | undefined;
  /** PGlite data directory used when `databaseUrl` is unset. */
  pgliteDir: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    port: Number(env.PORT ?? 8787),
    databaseUrl: env.DATABASE_URL || undefined,
    pgliteDir: env.PGLITE_DIR ?? '.data/pglite',
  };
}
