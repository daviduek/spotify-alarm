import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, TextInput, View } from 'react-native';
import type { MusicItem } from '@wake/domain';

import { Button, Divider, Note, Row, Screen, Section, Subtitle, Title } from '../../src/components/ui';
import { logger } from '../../src/services/logger';
import { setTestSource } from '../../src/services/settings';
import { spotifyProvider } from '../../src/services/spotify/spotifyProvider';
import { colors, radius, spacing, type } from '../../src/theme';

/** Spec §23 — choose a playlist / album / track. Stores the Spotify URI, never just a name. */
export default function SpotifyPickerScreen() {
  const router = useRouter();
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
      setError("Couldn't load your playlists. Check the Spotify connection in Diagnostics.");
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
      setError("Search didn't work. Try again in a moment.");
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
        <Title>Choose Spotify source</Title>
        <Subtitle>Your alarm stores the Spotify URI. If Spotify can't start at wake time, the fallback sound rings instead.</Subtitle>
      </View>
      <View style={styles.searchRow}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={search}
          placeholder="Search playlists, albums, tracks"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          returnKeyType="search"
          autoCapitalize="none"
          accessibilityLabel="Search Spotify"
        />
        <Button title="Search" onPress={search} loading={loading} />
      </View>
      {error ? <Note tone="warning">{error}</Note> : null}
      <Section title={mode === 'playlists' ? 'Your playlists' : `Results for “${query}”`}>
        {items.length === 0 && !loading ? <Note>{'\n'}  Nothing here yet.{'\n'}</Note> : null}
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
      <Text style={styles.legal}>Spotify Premium is required for remote playback. Wake never stores your Spotify password.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  searchRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  input: { flex: 1, minHeight: 50, borderRadius: radius.sm, backgroundColor: colors.surface2, color: colors.text, paddingHorizontal: spacing.md, ...type.body },
  art: { width: 36, height: 36, borderRadius: 6 },
  legal: { ...type.caption, color: colors.textMuted, textAlign: 'center' },
});
