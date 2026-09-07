import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { useNativeAlarmEvents } from '../src/hooks/useNativeAlarmEvents';
import { getDb } from '../src/services/db';
import { logger } from '../src/services/logger';
import { colors } from '../src/theme';

const theme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: colors.bg, card: colors.bg, text: colors.text, primary: colors.accent, border: colors.border },
};

export default function RootLayout() {
  useNativeAlarmEvents();

  useEffect(() => {
    getDb().catch((error) => logger.error('db_open_failed', { message: String(error) }));
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
        <Stack.Screen name="index" options={{ title: 'Wake · Lab' }} />
        <Stack.Screen name="diagnostics" options={{ title: 'Diagnostics' }} />
        <Stack.Screen name="recordings" options={{ title: 'My Recordings' }} />
        <Stack.Screen name="spotify/picker" options={{ title: 'Spotify' }} />
        <Stack.Screen name="alarm/[id]" options={{ headerShown: false, presentation: 'fullScreenModal', gestureEnabled: false, animation: 'fade' }} />
      </Stack>
    </ThemeProvider>
  );
}
