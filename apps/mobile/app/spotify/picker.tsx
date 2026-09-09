import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, TextInput, View } from 'react-native';
import type { MusicItem } from '@wake/domain';

import { Button, Divider, Note, Row, Screen, Section, Subtitle, Title } from '../../src/components/ui';
import { getLocale, type Locale } from '../../src/services/i18n';
import { logger } from '../../src/services/logger';
import { setTestSource } from '../../src/services/settings';
import { spotifyProvider } from '../../src/services/spotify/spotifyProvider';
import { colors, radius, spacing, type } from '../../src/theme';

const STR: Record<Locale, {
  title: string; subtitle: string; playlistsFailed: string; searchFailed: string;
  searchPlaceholder: string; searchA11y: string; search: string;
  yourPlaylists: string; resultsFor: string; nothingHere: string; legal: string;
}> = {
  en: {
    title: 'Choose Spotify source',
    subtitle: "Your alarm stores the Spotify URI. If Spotify can't start at wake time, the fallback sound rings instead.",
    playlistsFailed: "Couldn't load your playlists. Check the Spotify connection in Diagnostics.",
    searchFailed: "Search didn't work. Try again in a moment.",
    searchPlaceholder: 'Search playlists, albums, tracks',
    searchA11y: 'Search Spotify',
    search: 'Search',
    yourPlaylists: 'Your playlists',
    resultsFor: 'Results for',
    nothingHere: 'Nothing here yet.',
    legal: 'Spotify Premium is required for remote playback. Wake never stores your Spotify password.',
  },
  es: {
    title: 'Elegir fuente de Spotify',
    subtitle: 'Tu alarma guarda el URI de Spotify. Si Spotify no puede iniciar al despertar, suena el sonido de respaldo.',
    playlistsFailed: 'No se pudieron cargar tus playlists. Revisa la conexión con Spotify en Diagnóstico.',
    searchFailed: 'La búsqueda no funcionó. Intenta de nuevo en un momento.',
    searchPlaceholder: 'Buscar playlists, álbumes, canciones',
    searchA11y: 'Buscar en Spotify',
    search: 'Buscar',
    yourPlaylists: 'Tus playlists',
    resultsFor: 'Resultados para',
    nothingHere: 'Nada por aquí todavía.',
    legal: 'Se requiere Spotify Premium para la reproducción remota. Wake nunca guarda tu contraseña de Spotify.',
  },
};

/** Spec §23 — choose a playlist / album / track. Stores the Spotify URI, never just a name. */
export default function SpotifyPickerScreen() {
  const router = useRouter();
  const str = STR[getLocale()];
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<MusicItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'playlists' | 'search'>('playlists');

  const loadPlaylists = async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await spotifyProvider.getPlaylists());
      setMode('playlists');
    } catch (e) {
      setError(str.playlistsFailed);
      logger.warn('spotify_playlists_failed', { message: String(e) });
    } finally {
      setLoading(false);
    }
  };

  const search = async () => {
    if (!query.trim()) return loadPlaylists();
    setLoading(true);
    setError(null);
    try {
      setItems(await spotifyProvider.search(query));
      setMode('search');
    } catch (e) {
      setError(str.searchFailed);
      logger.warn('spotify_search_failed', { message: String(e) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPlaylists();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const choose = async (item: MusicItem) => {
    await setTestSource({ type: 'music', provider: 'spotify', uri: item.uri, title: item.title, subtitle: item.subtitle, artworkUrl: item.artworkUrl });
    logger.info('spotify_selected', { kind: item.kind });
    router.back();
  };

  return (
    <Screen>
      <View>
        <Title>{str.title}</Title>
        <Subtitle>{str.subtitle}</Subtitle>
      </View>
      <View style={styles.searchRow}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={search}
          placeholder={str.searchPlaceholder}
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          returnKeyType="search"
          autoCapitalize="none"
          accessibilityLabel={str.searchA11y}
        />
        <Button title={str.search} onPress={search} loading={loading} />
      </View>
      {error ? <Note tone="warning">{error}</Note> : null}
      <Section title={mode === 'playlists' ? str.yourPlaylists : `${str.resultsFor} “${query}”`}>
        {items.length === 0 && !loading ? <Note>{'\n'}  {str.nothingHere}{'\n'}</Note> : null}
        {items.map((item, i) => (
          <View key={`${item.uri}-${i}`}>
            <Row
              label={item.title}
              value={item.subtitle ?? item.kind}
              onPress={() => void choose(item)}
              right={item.artworkUrl ? <Image source={{ uri: item.artworkUrl }} style={styles.art} accessibilityIgnoresInvertColors /> : null}
            />
            {i < items.length - 1 ? <Divider /> : null}
          </View>
        ))}
      </Section>
      <Text style={styles.legal}>{str.legal}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  searchRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  input: { flex: 1, minHeight: 50, borderRadius: radius.sm, backgroundColor: colors.surface2, color: colors.text, paddingHorizontal: spacing.md, ...type.body },
  art: { width: 36, height: 36, borderRadius: 6 },
  legal: { ...type.caption, color: colors.textMuted, textAlign: 'center' },
});
