'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { WAKE_SOUNDS, wakeSoundName, type AudioSource, type MusicItem } from '@wake/domain';

import { fetchRecordings, type Recording } from '../lib/data/recordings';
import type { Locale } from '../lib/i18n';
import { useLocale } from '../lib/i18n/client';
import { myPlaylists, searchSpotify } from '../lib/spotify/browseApi';
import { getSupabaseBrowserClient } from '../lib/supabase/client';

const STR: Record<Locale, {
  playlistsError: string;
  searchError: string;
  chooseSound: string;
  done: string;
  wakeSounds: string;
  intensity: Record<'soft' | 'medium' | 'strong', string>;
  myRecordings: string;
  noRecordings: string;
  recordOne: string;
  connectPrompt: string;
  connectSpotify: string;
  searchPlaceholder: string;
  searchSpotify: string;
  search: string;
  loading: string;
  kinds: Record<string, string>;
}> = {
  en: {
    playlistsError: 'Could not load your Spotify playlists.',
    searchError: 'Search failed.',
    chooseSound: 'Choose sound',
    done: 'Done',
    wakeSounds: 'Wake sounds',
    intensity: { soft: 'soft', medium: 'medium', strong: 'strong' },
    myRecordings: 'My recordings',
    noRecordings: 'No recordings yet.',
    recordOne: 'Record one',
    connectPrompt: 'Connect Spotify to pick a playlist.',
    connectSpotify: 'Connect Spotify',
    searchPlaceholder: 'Search playlists, albums, tracks',
    searchSpotify: 'Search Spotify',
    search: 'Search',
    loading: 'Loading…',
    kinds: { playlist: 'playlist', album: 'album', track: 'track' },
  },
  es: {
    playlistsError: 'No se pudieron cargar tus playlists de Spotify.',
    searchError: 'La búsqueda falló.',
    chooseSound: 'Elegir sonido',
    done: 'Listo',
    wakeSounds: 'Sonidos de Wake',
    intensity: { soft: 'suave', medium: 'medio', strong: 'fuerte' },
    myRecordings: 'Mis grabaciones',
    noRecordings: 'Todavía no hay grabaciones.',
    recordOne: 'Grabar una',
    connectPrompt: 'Conecta Spotify para elegir una playlist.',
    connectSpotify: 'Conectar Spotify',
    searchPlaceholder: 'Busca playlists, álbumes, canciones',
    searchSpotify: 'Buscar en Spotify',
    search: 'Buscar',
    loading: 'Cargando…',
    kinds: { playlist: 'playlist', album: 'álbum', track: 'canción' },
  },
};

/** Modal: choose a Wake sound, one of your recordings, or a Spotify item (spec §23). */
export function SourcePicker({
  userId,
  spotifyConnected,
  onPick,
  onClose,
}: {
  userId: string;
  spotifyConnected: boolean;
  onPick: (source: AudioSource) => void;
  onClose: () => void;
}) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const locale = useLocale();
  const t = STR[locale];
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [playlists, setPlaylists] = useState<MusicItem[]>([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MusicItem[]>([]);
  const [loadingSpotify, setLoadingSpotify] = useState(false);
  const [spotifyError, setSpotifyError] = useState<string | null>(null);

  useEffect(() => {
    void fetchRecordings(supabase, userId).then(setRecordings).catch(() => setRecordings([]));
    if (spotifyConnected) {
      setLoadingSpotify(true);
      myPlaylists()
        .then(setPlaylists)
        .catch(() => setSpotifyError(t.playlistsError))
        .finally(() => setLoadingSpotify(false));
    }
  }, [supabase, userId, spotifyConnected, t]);

  const runSearch = async () => {
    if (!query.trim()) return;
    setLoadingSpotify(true);
    try {
      setResults(await searchSpotify(query));
    } catch {
      setSpotifyError(t.searchError);
    } finally {
      setLoadingSpotify(false);
    }
  };

  const spotifyItems = results.length ? results : playlists;

  return (
    <div className="ringing" style={{ justifyContent: 'flex-start', overflowY: 'auto', paddingTop: '6vh' }} role="dialog" aria-modal="true" aria-label={t.chooseSound}>
      <div className="app-shell" style={{ width: '100%', padding: 0 }}>
        <div className="row-between">
          <h2 style={{ fontSize: 22 }}>{t.chooseSound}</h2>
          <button className="btn btn-ghost" onClick={onClose}>{t.done}</button>
        </div>

        <div className="section">
          <h2>{t.wakeSounds}</h2>
          {WAKE_SOUNDS.map((s) => (
            <button key={s.id} className="list-row" style={{ width: '100%', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }} onClick={() => onPick({ type: 'local', soundId: s.id })}>
              <span className="label">{wakeSoundName(s.id, locale) ?? s.name}</span>
              <span className="value">{t.intensity[s.intensity]}</span>
            </button>
          ))}
        </div>

        <div className="section">
          <h2>{t.myRecordings}</h2>
          {recordings.length === 0 ? (
            <div className="list-row"><span className="value">{t.noRecordings}</span><Link href="/app/sounds" className="btn btn-ghost">{t.recordOne}</Link></div>
          ) : (
            recordings.map((r) => (
              <button key={r.id} className="list-row" style={{ width: '100%', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }} onClick={() => onPick({ type: 'recording', recordingId: r.id, title: r.name })}>
                <span className="label">▶ {r.name}</span>
              </button>
            ))
          )}
        </div>

        <div className="section">
          <h2>Spotify</h2>
          {!spotifyConnected ? (
            <div className="list-row">
              <span className="value">{t.connectPrompt}</span>
              <a className="btn btn-spotify" href="/api/spotify/connect">{t.connectSpotify}</a>
            </div>
          ) : (
            <>
              <div className="list-row" style={{ gap: 8 }}>
                <input placeholder={t.searchPlaceholder} value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void runSearch()} style={{ flex: 1, minHeight: 42, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', padding: '0 12px' }} aria-label={t.searchSpotify} />
                <button className="btn" onClick={() => void runSearch()}>{t.search}</button>
              </div>
              {spotifyError ? <p className="alert warn" style={{ margin: '8px 18px' }}>{spotifyError}</p> : null}
              {loadingSpotify ? <div className="list-row"><span className="value">{t.loading}</span></div> : null}
              {spotifyItems.map((item, i) => (
                <button key={`${item.uri}-${i}`} className="list-row" style={{ width: '100%', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }} onClick={() => onPick({ type: 'music', provider: 'spotify', uri: item.uri, title: item.title, subtitle: item.subtitle, artworkUrl: item.artworkUrl })}>
                  <span className="label">{item.title}</span>
                  <span className="value">{item.subtitle ?? t.kinds[item.kind] ?? item.kind}</span>
                </button>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
