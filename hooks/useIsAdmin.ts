import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { getAuthUser } from '../utils/auth';
import { isAdminEmail } from '../utils/admin';

/**
 * Hook que indica si el usuario autenticado actual es el administrador.
 * La verificación de UI se basa en el correo; la seguridad real la aplica RLS.
 */
export function useIsAdmin(): { isAdmin: boolean; loading: boolean } {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const resolve = async () => {
      const user = await getAuthUser();
      if (mounted) {
        setIsAdmin(isAdminEmail(user?.email));
        setLoading(false);
      }
    };

    resolve();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAdmin(isAdminEmail(session?.user?.email));
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return { isAdmin, loading };
}
