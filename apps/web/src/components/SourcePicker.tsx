'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { WAKE_SOUNDS, type AudioSource, type MusicItem } from '@wake/domain';

import { fetchRecordings, signedUrl, type Recording } from '../lib/data/recordings';
import { myPlaylists, searchSpotify } from '../lib/spotify/browseApi';
import { getSupabaseBrowserClient } from '../lib/supabase/client';

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
        .catch(() => setSpotifyError('Could not load your Spotify playlists.'))
        .finally(() => setLoadingSpotify(false));
    }
  }, [supabase, userId, spotifyConnected]);

  const runSearch = async () => {
    if (!query.trim()) return;
    setLoadingSpotify(true);
    try {
      setResults(await searchSpotify(query));
    } catch {
      setSpotifyError('Search failed.');
    } finally {
      setLoadingSpotify(false);
    }
  };

  const spotifyItems = results.length ? results : playlists;

  return (
    <div className="ringing" style={{ justifyContent: 'flex-start', overflowY: 'auto', paddingTop: '6vh' }} role="dialog" aria-modal="true" aria-label="Choose sound">
      <div className="app-shell" style={{ width: '100%', padding: 0 }}>
        <div className="row-between">
          <h2 style={{ fontSize: 22 }}>Choose sound</h2>
          <button className="btn btn-ghost" onClick={onClose}>Done</button>
        </div>

        <div className="section">
          <h2>Wake sounds</h2>
          {WAKE_SOUNDS.map((s) => (
            <button key={s.id} className="list-row" style={{ width: '100%', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }} onClick={() => onPick({ type: 'local', soundId: s.id })}>
              <span className="label">{s.name}</span>
              <span className="value">{s.intensity}</span>
            </button>
          ))}
        </div>

        <div className="section">
          <h2>My recordings</h2>
          {recordings.length === 0 ? (
            <div className="list-row"><span className="value">No recordings yet.</span><Link href="/app/sounds" className="btn btn-ghost">Record one</Link></div>
          ) : (
            recordings.map((r) => (
              <button key={r.id} className="list-row" style={{ width: '100%', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }} onClick={async () => onPick({ type: 'recording', recordingId: r.id, fileUri: (await signedUrl(supabase, r.storagePath)) ?? undefined, title: r.name })}>
                <span className="label">▶ {r.name}</span>
              </button>
            ))
          )}
        </div>

        <div className="section">
          <h2>Spotify</h2>
          {!spotifyConnected ? (
            <div className="list-row">
              <span className="value">Connect Spotify to pick a playlist.</span>
              <a className="btn btn-spotify" href="/api/spotify/connect">Connect Spotify</a>
            </div>
          ) : (
            <>
              <div className="list-row" style={{ gap: 8 }}>
                <input placeholder="Search playlists, albums, tracks" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void runSearch()} style={{ flex: 1, minHeight: 42, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', padding: '0 12px' }} aria-label="Search Spotify" />
                <button className="btn" onClick={() => void runSearch()}>Search</button>
              </div>
              {spotifyError ? <p className="alert warn" style={{ margin: '8px 18px' }}>{spotifyError}</p> : null}
              {loadingSpotify ? <div className="list-row"><span className="value">Loading…</span></div> : null}
              {spotifyItems.map((item, i) => (
                <button key={`${item.uri}-${i}`} className="list-row" style={{ width: '100%', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }} onClick={() => onPick({ type: 'music', provider: 'spotify', uri: item.uri, title: item.title, subtitle: item.subtitle, artworkUrl: item.artworkUrl })}>
                  <span className="label">{item.title}</span>
                  <span className="value">{item.subtitle ?? item.kind}</span>
                </button>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
