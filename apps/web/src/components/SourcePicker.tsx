'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { WAKE_SOUNDS, wakeSoundName, type AudioSource, type MusicItem } from '@wake/domain';

import { fetchRecordings, type Recording } from '../lib/data/recordings';
import type { Locale } from '../lib/i18n';
import { useLocale } from '../lib/i18n/client';
import { myPlaylists, searchSpotify } from '../lib/spotify/browseApi';
import { getSupabaseBrowserClient } from '../lib/supabase/client';

const STR: Record<Locale, {
  playlistsError: string;
  searchError: string;
  restricted: string;
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
  yourPlaylists: string;
  results: string;
  noResults: string;
  loading: string;
  kinds: Record<string, string>;
}> = {
  en: {
    playlistsError: 'Could not load your Spotify playlists',
    searchError: 'Search failed',
    restricted: 'Your Spotify account is not enabled for this app yet.',
    chooseSound: 'Choose sound',
    done: 'Done',
    wakeSounds: 'Wake sounds',
    intensity: { soft: 'soft', medium: 'medium', strong: 'strong' },
    myRecordings: 'My recordings',
    noRecordings: 'No recordings yet.',
    recordOne: 'Record one',
    connectPrompt: 'Wake up to your playlists.',
    connectSpotify: 'Connect Spotify',
    searchPlaceholder: 'What do you want to wake up to?',
    yourPlaylists: 'Your playlists',
    results: 'Results',
    noResults: 'No results for that search.',
    loading: 'Loading…',
    kinds: { playlist: 'Playlist', album: 'Album', track: 'Song' },
  },
  es: {
    playlistsError: 'No se pudieron cargar tus playlists de Spotify',
    searchError: 'La búsqueda falló',
    restricted: 'Tu cuenta de Spotify todavía no está habilitada para esta app.',
    chooseSound: 'Elegir sonido',
    done: 'Listo',
    wakeSounds: 'Sonidos de Wake',
    intensity: { soft: 'suave', medium: 'medio', strong: 'fuerte' },
    myRecordings: 'Mis grabaciones',
    noRecordings: 'Todavía no hay grabaciones.',
    recordOne: 'Grabar una',
    connectPrompt: 'Despierta con tus playlists.',
    connectSpotify: 'Conectar Spotify',
    searchPlaceholder: '¿Con qué te quieres despertar?',
    yourPlaylists: 'Tus playlists',
    results: 'Resultados',
    noResults: 'Sin resultados para esa búsqueda.',
    loading: 'Cargando…',
    kinds: { playlist: 'Playlist', album: 'Álbum', track: 'Canción' },
  },
};

function SpotifyRow({ item, kindLabel, onPick }: { item: MusicItem; kindLabel: string; onPick: () => void }) {
  return (
    <button type="button" className="sp-row" onClick={onPick}>
      {item.artworkUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.artworkUrl} alt="" className={`sp-art ${item.kind === 'track' || item.kind === 'album' ? '' : 'round'}`} loading="lazy" />
      ) : (
        <span className="sp-art sp-art-empty" aria-hidden="true">♪</span>
      )}
      <span className="sp-meta">
        <span className="sp-title">{item.title}</span>
        <span className="sp-sub">{kindLabel}{item.subtitle ? ` · ${item.subtitle}` : ''}</span>
      </span>
    </button>
  );
}

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
  const [results, setResults] = useState<MusicItem[] | null>(null);
  const [loadingSpotify, setLoadingSpotify] = useState(false);
  const [spotifyError, setSpotifyError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchSeq = useRef(0);

  const describeError = (base: string, e: unknown) => {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[spotify picker]', base, e);
    if (/403/.test(msg)) return t.restricted;
    return `${base} (${msg})`;
  };

  useEffect(() => {
    void fetchRecordings(supabase, userId).then(setRecordings).catch(() => setRecordings([]));
  }, [supabase, userId]);

  useEffect(() => {
    if (!spotifyConnected) return;
    setLoadingSpotify(true);
    myPlaylists()
      .then((items) => {
        setPlaylists(items);
        setSpotifyError(null);
      })
      .catch((e) => setSpotifyError(describeError(t.playlistsError, e)))
      .finally(() => setLoadingSpotify(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spotifyConnected]);

  // Search-as-you-type with debounce (Spotify-style: no search button).
  useEffect(() => {
    if (!spotifyConnected) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (!q) {
      setResults(null);
      setLoadingSpotify(false);
      return;
    }
    debounceRef.current = setTimeout(() => {
      const seq = ++searchSeq.current;
      setLoadingSpotify(true);
      searchSpotify(q)
        .then((items) => {
          if (searchSeq.current !== seq) return;
          setResults(items);
          setSpotifyError(null);
        })
        .catch((e) => {
          if (searchSeq.current !== seq) return;
          setSpotifyError(describeError(t.searchError, e));
        })
        .finally(() => {
          if (searchSeq.current === seq) setLoadingSpotify(false);
        });
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, spotifyConnected]);

  const showing = results ?? playlists;
  const showingLabel = results ? t.results : t.yourPlaylists;

  return (
    <div className="picker-overlay" role="dialog" aria-modal="true" aria-label={t.chooseSound}>
      <div className="picker-sheet">
        <div className="row-between picker-head">
          <h2>{t.chooseSound}</h2>
          <button className="btn btn-ghost" onClick={onClose}>{t.done}</button>
        </div>

        <div className="section">
          <h2>{t.wakeSounds}</h2>
          {WAKE_SOUNDS.map((s) => (
            <button key={s.id} type="button" className="sp-row" onClick={() => onPick({ type: 'local', soundId: s.id })}>
              <span className={`sp-art sp-art-sound sp-${s.intensity}`} aria-hidden="true">((•))</span>
              <span className="sp-meta">
                <span className="sp-title">{wakeSoundName(s.id, locale) ?? s.name}</span>
                <span className="sp-sub">{t.intensity[s.intensity]}</span>
              </span>
            </button>
          ))}
        </div>

        <div className="section">
          <h2>{t.myRecordings}</h2>
          {recordings.length === 0 ? (
            <div className="list-row"><span className="value">{t.noRecordings}</span><Link href="/app/sounds" className="btn btn-ghost">{t.recordOne}</Link></div>
          ) : (
            recordings.map((r) => (
              <button key={r.id} type="button" className="sp-row" onClick={() => onPick({ type: 'recording', recordingId: r.id, title: r.name })}>
                <span className="sp-art sp-art-voice" aria-hidden="true">●</span>
                <span className="sp-meta"><span className="sp-title">{r.name}</span></span>
              </button>
            ))
          )}
        </div>

        <div className="section sp-section">
          <h2 className="sp-brand"><span className="sp-dot" aria-hidden="true" />Spotify</h2>
          {!spotifyConnected ? (
            <div className="list-row">
              <span className="value">{t.connectPrompt}</span>
              <a className="btn btn-spotify" href="/api/spotify/connect">{t.connectSpotify}</a>
            </div>
          ) : (
            <>
              <div className="sp-search">
                <span className="sp-search-icon" aria-hidden="true">⌕</span>
                <input
                  placeholder={t.searchPlaceholder}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  aria-label={t.searchPlaceholder}
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
              {spotifyError ? <p className="alert warn" style={{ margin: '4px 16px 12px' }}>{spotifyError}</p> : null}
              {showing.length > 0 ? <p className="sp-group">{showingLabel}</p> : null}
              {showing.map((item, i) => (
                <SpotifyRow
                  key={`${item.uri}-${i}`}
                  item={item}
                  kindLabel={t.kinds[item.kind] ?? item.kind}
                  onPick={() => onPick({ type: 'music', provider: 'spotify', uri: item.uri, title: item.title, subtitle: item.subtitle, artworkUrl: item.artworkUrl })}
                />
              ))}
              {loadingSpotify ? <p className="sp-group">{t.loading}</p> : null}
              {!loadingSpotify && results !== null && results.length === 0 && !spotifyError ? <p className="sp-group">{t.noResults}</p> : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
