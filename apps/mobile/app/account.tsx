import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { Button, Note, Row, Screen, Section, Subtitle, Title } from '../src/components/ui';
import { getLocale, type Locale } from '../src/services/i18n';
import { logger } from '../src/services/logger';
import { getSupabase, isSupabaseConfigured } from '../src/services/supabase';
import { getLastSyncedAt, syncNow } from '../src/services/sync';
import { colors, radius, spacing, type } from '../src/theme';

const STR: Record<Locale, {
  title: string;
  subtitle: string;
  notConfigured: string;
  email: string;
  password: string;
  signIn: string;
  signUp: string;
  signOut: string;
  signedInAs: string;
  syncNow: string;
  lastSynced: string;
  never: string;
  syncOk: string;
  notSignedIn: string;
  checkEmail: string;
  fillBoth: string;
  localNote: string;
}> = {
  en: {
    title: 'Account',
    subtitle: 'Optional. Sign in to keep your alarms and recordings in sync with the web app.',
    notConfigured: 'Cloud sync is not configured in this build (EXPO_PUBLIC_SUPABASE_URL missing).',
    email: 'Email',
    password: 'Password',
    signIn: 'Sign in',
    signUp: 'Create account',
    signOut: 'Sign out',
    signedInAs: 'Signed in as',
    syncNow: 'Sync now',
    lastSynced: 'Last synced',
    never: 'Never',
    syncOk: 'Synced ✓',
    notSignedIn: 'Sign in first to sync.',
    checkEmail: 'Account created. Check your email to confirm, then sign in.',
    fillBoth: 'Enter your email and password.',
    localNote: 'Alarms always ring from this device, even offline or signed out. The cloud is only a backup and a bridge to the web app.',
  },
  es: {
    title: 'Cuenta',
    subtitle: 'Opcional. Inicia sesión para mantener tus alarmas y grabaciones sincronizadas con la app web.',
    notConfigured: 'La sincronización en la nube no está configurada en esta build (falta EXPO_PUBLIC_SUPABASE_URL).',
    email: 'Email',
    password: 'Contraseña',
    signIn: 'Iniciar sesión',
    signUp: 'Crear cuenta',
    signOut: 'Cerrar sesión',
    signedInAs: 'Sesión iniciada como',
    syncNow: 'Sincronizar ahora',
    lastSynced: 'Última sincronización',
    never: 'Nunca',
    syncOk: 'Sincronizado ✓',
    notSignedIn: 'Primero inicia sesión para sincronizar.',
    checkEmail: 'Cuenta creada. Revisa tu email para confirmar y luego inicia sesión.',
    fillBoth: 'Escribe tu email y contraseña.',
    localNote: 'Las alarmas siempre suenan desde este dispositivo, incluso sin conexión o sin sesión. La nube es solo un respaldo y un puente hacia la app web.',
  },
};

export default function AccountScreen() {
  const str = STR[getLocale()];
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    const supabase = getSupabase();
    if (supabase) {
      const { data } = await supabase.auth.getSession();
      setUserEmail(data.session?.user?.email ?? null);
    }
    setLastSynced(await getLastSyncedAt());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const run = async (label: string, fn: () => Promise<string | null>) => {
    setBusy(label);
    setError(null);
    setInfo(null);
    try {
      const message = await fn();
      if (message) setInfo(message);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      logger.warn('account_action_failed', { label, message });
      setError(message);
    } finally {
      setBusy(null);
      void refresh();
    }
  };

  const signIn = () =>
    run('signIn', async () => {
      const supabase = getSupabase();
      if (!supabase) return null;
      if (!email.trim() || !password) throw new Error(str.fillBoth);
      const { error: e } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (e) throw new Error(e.message);
      logger.info('account_signed_in');
      setPassword('');
      void syncNow().then(() => refresh());
      return null;
    });

  const signUp = () =>
    run('signUp', async () => {
      const supabase = getSupabase();
      if (!supabase) return null;
      if (!email.trim() || !password) throw new Error(str.fillBoth);
      const { data, error: e } = await supabase.auth.signUp({ email: email.trim(), password });
      if (e) throw new Error(e.message);
      logger.info('account_signed_up');
      if (data.session) {
        void syncNow().then(() => refresh());
        return null;
      }
      return str.checkEmail;
    });

  const signOut = () =>
    run('signOut', async () => {
      const supabase = getSupabase();
      if (!supabase) return null;
      const { error: e } = await supabase.auth.signOut();
      if (e) throw new Error(e.message);
      logger.info('account_signed_out');
      return null;
    });

  const sync = () =>
    run('sync', async () => {
      const result = await syncNow();
      if (!result.ok) throw new Error(result.error === 'not_signed_in' ? str.notSignedIn : result.error);
      return str.syncOk;
    });

  if (!isSupabaseConfigured()) {
    return (
      <Screen>
        <View>
          <Title>{str.title}</Title>
          <Subtitle>{str.subtitle}</Subtitle>
        </View>
        <Note tone="warning">{str.notConfigured}</Note>
      </Screen>
    );
  }

  return (
    <Screen>
      <View>
        <Title>{str.title}</Title>
        <Subtitle>{str.subtitle}</Subtitle>
      </View>

      {userEmail ? (
        <Section>
          <Row label={str.signedInAs} value={userEmail} />
          <Row label={str.lastSynced} value={lastSynced ? lastSynced.toLocaleString() : str.never} />
          <View style={styles.actions}>
            <Button title={str.syncNow} variant="primary" onPress={sync} loading={busy === 'sync'} />
            <Button title={str.signOut} variant="ghost" onPress={signOut} loading={busy === 'signOut'} />
          </View>
        </Section>
      ) : (
        <Section>
          <View style={styles.form}>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder={str.email}
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              accessibilityLabel={str.email}
            />
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder={str.password}
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              secureTextEntry
              autoComplete="password"
              accessibilityLabel={str.password}
            />
            <Button title={str.signIn} variant="primary" onPress={signIn} loading={busy === 'signIn'} />
            <Button title={str.signUp} onPress={signUp} loading={busy === 'signUp'} />
          </View>
        </Section>
      )}

      {error ? <Note tone="danger">{error}</Note> : null}
      {info ? <Note tone="success">{info}</Note> : null}
      <Note>{str.localNote}</Note>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { padding: spacing.md, gap: spacing.sm },
  actions: { padding: spacing.md, gap: spacing.sm },
  input: { minHeight: 50, borderRadius: radius.sm, backgroundColor: colors.surface2, color: colors.text, paddingHorizontal: spacing.md, ...type.body },
});
