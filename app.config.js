// Expo dynamic config — replaces app.json so we can read environment
// variables (.env / EAS Secrets) at build time. The Spotify Client ID is
// embedded here so end-users never have to type it.

const SPOTIFY_CLIENT_ID = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID || '';

module.exports = {
  expo: {
    name: 'Spotify Alarm',
    slug: 'spotify-alarm',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'dark',
    newArchEnabled: false,
    scheme: 'spotifyalarm',
    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#080c10',
    },
    ios: {
      supportsTablet: false,
      bundleIdentifier: 'com.daviduek.spotifyalarm',
      infoPlist: {
        UIBackgroundModes: ['audio', 'fetch'],
        NSMicrophoneUsageDescription:
          'Spotify Alarm needs microphone access for audio playback.',
        NSAppleMusicUsageDescription:
          'Spotify Alarm uses audio to wake you up with Spotify music.',
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#080c10',
      },
      package: 'com.daviduek.spotifyalarm',
      permissions: [
        'android.permission.RECEIVE_BOOT_COMPLETED',
        'android.permission.VIBRATE',
        'android.permission.USE_EXACT_ALARM',
        'android.permission.SCHEDULE_EXACT_ALARM',
        'android.permission.FOREGROUND_SERVICE',
        'android.permission.INTERNET',
      ],
    },
    web: {
      favicon: './assets/favicon.png',
    },
    plugins: [
      'expo-web-browser',
      ['expo-font', { fonts: [] }],
      [
        'expo-notifications',
        {
          icon: './assets/icon.png',
          color: '#1db954',
          sounds: [],
        },
      ],
      'expo-av',
    ],
    extra: {
      eas: {
        projectId: '706db67f-6b89-452c-b45b-f9c0214ebfca',
      },
      // Embedded Spotify app credentials. The Client ID is PUBLIC and safe
      // to ship in the binary when using PKCE — there's no client secret.
      spotifyClientId: SPOTIFY_CLIENT_ID,
    },
  },
};
