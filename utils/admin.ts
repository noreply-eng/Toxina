import type { Session, User } from '@supabase/supabase-js';

/**
 * Correo del único administrador de la aplicación.
 * El control real de permisos vive en la base de datos (función public.is_admin()
 * y políticas RLS). Esta constante solo se usa para mostrar/ocultar la UI de admin.
 */
export const ADMIN_EMAIL = 'jmyocupicior@gmail.com';

export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === ADMIN_EMAIL;
}

export function isAdminUser(user?: User | null): boolean {
  return isAdminEmail(user?.email);
}

export function isAdminSession(session?: Session | null): boolean {
  return isAdminEmail(session?.user?.email);
}
