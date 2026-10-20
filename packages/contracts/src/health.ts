import { z } from 'zod';

/** Response of `GET /api/health`. Proves web and api share one schema (D15.1). */
export const HealthResponse = z.object({
  status: z.literal('ok'),
});
export type HealthResponse = z.infer<typeof HealthResponse>;
