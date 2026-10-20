import { useSession } from './session';

/** UI mirror of the backend role check (FR-21, NFR-6). The API enforces it regardless. */
export function useCanChangeRoutes(): boolean {
  return useSession().user?.role === 'admin';
}

export const ADMIN_ONLY = 'Only Admins can change routes.';
