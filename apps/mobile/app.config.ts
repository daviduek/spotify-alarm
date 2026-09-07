import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Wake — Expo app config (Continuous Native Generation).
 *
 * Native folders (ios/, android/) are generated with `npx expo prebuild`; everything
 * platform-specific that the spec requires (AlarmKit usage string, exact-alarm
 * permissions, alarm sounds) is declared here or inside modules/wake-alarm.
 */
const SPOTIFY_CLIENT_ID = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID ?? '';
const APP_VARIANT = process.env.APP_VARIANT ?? 'development';
const IS_DEV = APP_VARIANT === 'development';

const bundleId = IS_DEV ? 'com.daviduek.wake.dev' : 'com.daviduek.wake';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: IS_DEV ? 'Wake (dev)' : 'Wake',
  // Keep the historical slug so the existing EAS project stays linked.
  slug: 'spotify-alarm',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  scheme: 'wake',
  userInterfaceStyle: 'automatic',
  ios: {
    bundleIdentifier: bundleId,
    supportsTablet: false,
    infoPlist: {
      // AlarmKit (iOS 26+) — required or the authorization request is rejected.
      NSAlarmKitUsageDescription: 'Wake schedules system alarms so they ring even when the phone is locked.',
      NSMicrophoneUsageDescription: 'Wake uses the microphone to record your own wake-up message.',
      // Lets the in-app fade / Spotify hand-off keep playing when you leave the app.
      UIBackgroundModes: ['audio'],
      // Deep-link into Spotify to check whether it is installed / launch it (spec §12, §13).
      LSApplicationQueriesSchemes: ['spotify'],
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: bundleId,
    adaptiveIcon: {
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
      backgroundColor: '#000000',
    },
    predictiveBackGestureEnabled: false,
    // Alarm permissions live ONLY in modules/wake-alarm/android/src/main/AndroidManifest.xml (manifest
    // merger). Declaring SCHEDULE_EXACT_ALARM here too (without maxSdkVersion) makes the merger fail.
    permissions: [
      'android.permission.RECORD_AUDIO',
      'android.permission.INTERNET',
    ],
    intentFilters: [
      {
        action: 'VIEW',
        autoVerify: false,
        data: [{ scheme: 'wake' }],
        category: ['BROWSABLE', 'DEFAULT'],
      },
    ],
  },
  web: {
    favicon: './assets/favicon.png',
    bundler: 'metro',
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    'expo-sqlite',
    'expo-web-browser',
    [
      'expo-audio',
      {
        microphonePermission: 'Wake uses the microphone to record your own wake-up message.',
      },
    ],
    [
      'expo-build-properties',
      {
        ios: {
          // AlarmKit lives in the iOS 26 SDK — EAS must build with Xcode 26+ (see eas.json image).
          deploymentTarget: '26.0',
        },
        android: {
          // Android 14 (34)+ APIs are used (FOREGROUND_SERVICE_MEDIA_PLAYBACK, canUseFullScreenIntent).
          compileSdkVersion: 36,
          targetSdkVersion: 36,
        },
      },
    ],
    [
      'expo-splash-screen',
      {
        backgroundColor: '#000000',
        image: './assets/splash-icon.png',
        imageWidth: 160,
      },
    ],
  ],
  experiments: {
    typedRoutes: false,
  },
  extra: {
    eas: {
      projectId: '706db67f-6b89-452c-b45b-f9c0214ebfca',
    },
    appVariant: APP_VARIANT,
    // PUBLIC identifier — safe to embed. PKCE means there is no client secret anywhere (spec §10).
    spotifyClientId: SPOTIFY_CLIENT_ID,
    featureFlags: {
      spotify_enabled: process.env.EXPO_PUBLIC_FLAG_SPOTIFY ?? 'true',
      recordings_enabled: process.env.EXPO_PUBLIC_FLAG_RECORDINGS ?? 'true',
      alarm_sequences_enabled: 'false',
      cloud_sync_enabled: 'false',
      diagnostics_enabled: process.env.EXPO_PUBLIC_FLAG_DIAGNOSTICS ?? 'true',
    },
  },
});
