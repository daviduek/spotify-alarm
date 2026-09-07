import Constants from 'expo-constants';
import { resolveFlags, type FeatureFlags } from '@wake/domain';

type Extra = {
  spotifyClientId?: string;
  appVariant?: string;
  featureFlags?: Record<string, unknown>;
};

const extra = (Constants.expoConfig?.extra ?? {}) as Extra;

export const spotifyClientId: string = extra.spotifyClientId ?? '';
export const appVariant: string = extra.appVariant ?? 'development';
export const flags: FeatureFlags = resolveFlags(extra.featureFlags ?? {});
export const APP_SCHEME = 'wake';
