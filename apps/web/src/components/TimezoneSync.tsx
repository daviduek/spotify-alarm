'use client';

import { useEffect } from 'react';

import { getSupabaseBrowserClient } from '../lib/supabase/client';

/**
 * Persists the device time zone to the user's profile (spec: profiles.time_zone).
 * The web always rings in device-local time; this is for the mobile app and any future
 * server-side reminders. Synced at most once per zone per device.
 */
export function TimezoneSync({ userId }: { userId: string }) {
  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (!tz) return;
      const key = 'wake_tz_synced';
      if (localStorage.getItem(key) === tz) return;
      const supabase = getSupabaseBrowserClient();
      void supabase
        .from('profiles')
        .update({ time_zone: tz })
        .eq('id', userId)
        .then(({ error }) => {
          if (!error) {
            try {
              localStorage.setItem(key, tz);
            } catch {
              /* ignore */
            }
          }
        });
    } catch {
      /* Intl or storage unavailable — nothing to do */
    }
  }, [userId]);
  return null;
}
