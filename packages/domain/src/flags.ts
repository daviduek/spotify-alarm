/** Spec §63 — build-time defaults; a remote override layer can be added later. */
export type FeatureFlags = {
  spotify_enabled: boolean;
  recordings_enabled: boolean;
  alarm_sequences_enabled: boolean;
  cloud_sync_enabled: boolean;
  diagnostics_enabled: boolean;
};

export const DEFAULT_FLAGS: FeatureFlags = {
  spotify_enabled: true,
  recordings_enabled: true,
  alarm_sequences_enabled: false,
  cloud_sync_enabled: false,
  diagnostics_enabled: true,
};

export function resolveFlags(overrides: Partial<Record<keyof FeatureFlags, unknown>> = {}): FeatureFlags {
  const out: FeatureFlags = { ...DEFAULT_FLAGS };
  for (const key of Object.keys(DEFAULT_FLAGS) as (keyof FeatureFlags)[]) {
    const v = overrides[key];
    if (typeof v === 'boolean') out[key] = v;
    else if (v === 'true' || v === '1') out[key] = true;
    else if (v === 'false' || v === '0') out[key] = false;
  }
  return out;
}
