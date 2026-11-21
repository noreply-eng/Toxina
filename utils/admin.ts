/**
 * Seguridad de SuperAdmin:
 * Ya NO se almacena ningún correo de administrador en el código cliente.
 * La identidad de administrador (`user_profiles.role = 'super_admin'`)
 * se resuelve únicamente desde PostgreSQL (public.is_super_admin() +
 * public.get_my_entitlements()) y se consume mediante useEntitlements() / useIsAdmin().
 */

export function isSuperAdminRole(role?: string | null): boolean {
  return role === 'super_admin';
}

export function isEnterpriseRole(role?: string | null): boolean {
  return role === 'enterprise';
}
