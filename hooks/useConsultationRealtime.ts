import { useEffect } from 'react';
import { supabase } from '../supabaseClient';

export function useConsultationRealtime(
  userId: string | undefined,
  onChange: () => void
): void {
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`consultations:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'consultations',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          onChange();
        }
      )
      .subscribe();

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        onChange();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      supabase.removeChannel(channel);
    };
  }, [userId, onChange]);
}
