import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { useNativeAlarmEvents } from '../src/hooks/useNativeAlarmEvents';
import { getDb } from '../src/services/db';
import { getLocale, type Locale } from '../src/services/i18n';
import { logger } from '../src/services/logger';
import { requestSync } from '../src/services/sync';
import { colors } from '../src/theme';

const theme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: colors.bg, card: colors.bg, text: colors.text, primary: colors.accent, border: colors.border },
};

const STR: Record<Locale, { lab: string; diagnostics: string; recordings: string; spotify: string; account: string }> = {
  en: { lab: 'Wake · Lab', diagnostics: 'Diagnostics', recordings: 'My Recordings', spotify: 'Spotify', account: 'Account' },
  es: { lab: 'Wake · Lab', diagnostics: 'Diagnóstico', recordings: 'Mis grabaciones', spotify: 'Spotify', account: 'Cuenta' },
};

export default function RootLayout() {
  useNativeAlarmEvents();
  const str = STR[getLocale()];

  useEffect(() => {
    getDb().catch((error) => logger.error('db_open_failed', { message: String(error) }));
  }, []);

  // Cloud sync on app foreground (fire-and-forget; no-op when signed out).
  useEffect(() => {
    requestSync('app_start');
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') requestSync('foreground');
    });
    return () => sub.remove();
  }, []);

  return (
    <ThemeProvider value={theme}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.bg },
          headerBackButtonDisplayMode: 'minimal',
        }}
      >
        <Stack.Screen name="index" options={{ title: str.lab }} />
        <Stack.Screen name="diagnostics" options={{ title: str.diagnostics }} />
        <Stack.Screen name="recordings" options={{ title: str.recordings }} />
        <Stack.Screen name="spotify/picker" options={{ title: str.spotify }} />
        <Stack.Screen name="account" options={{ title: str.account }} />
        <Stack.Screen name="alarm/[id]" options={{ headerShown: false, presentation: 'fullScreenModal', gestureEnabled: false, animation: 'fade' }} />
      </Stack>
    </ThemeProvider>
  );
}
