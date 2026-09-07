'use client';

import type { MusicItem } from '@wake/domain';

const API = 'https://api.spotify.com/v1';

async function token(): Promise<string> {
  const res = await fetch('/api/spotify/token', { cache: 'no-store' });
  if (!res.ok) throw new Error(`spotify token ${res.status}`);
  return ((await res.json()) as { accessToken: string }).accessToken;
}

async function api<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${await token()}` } });
  if (!res.ok) throw new Error(`spotify ${res.status}`);
  return (await res.json()) as T;
}

type Img = { url: string }[];
type Playlist = { uri: string; name: string; images?: Img; owner?: { display_name?: string } };

export async function myPlaylists(): Promise<MusicItem[]> {
  const data = await api<{ items: (Playlist | null)[] }>('/me/playlists?limit=50');
  return data.items
    .filter((p): p is Playlist => Boolean(p))
    .map((p) => ({ provider: 'spotify', kind: 'playlist', uri: p.uri, title: p.name, subtitle: p.owner?.display_name, artworkUrl: p.images?.[0]?.url }));
}

export async function searchSpotify(query: string): Promise<MusicItem[]> {
  if (!query.trim()) return [];
  const data = await api<{
    playlists?: { items: (Playlist | null)[] };
    albums?: { items: ({ uri: string; name: string; images?: Img; artists?: { name: string }[] } | null)[] };
    tracks?: { items: ({ uri: string; name: string; artists?: { name: string }[]; album?: { images?: Img } } | null)[] };
  }>(`/search?q=${encodeURIComponent(query)}&type=playlist,album,track&limit=8`);
  const items: MusicItem[] = [];
  for (const p of data.playlists?.items ?? []) if (p) items.push({ provider: 'spotify', kind: 'playlist', uri: p.uri, title: p.name, subtitle: p.owner?.display_name, artworkUrl: p.images?.[0]?.url });
  for (const a of data.albums?.items ?? []) if (a) items.push({ provider: 'spotify', kind: 'album', uri: a.uri, title: a.name, subtitle: a.artists?.map((x) => x.name).join(', '), artworkUrl: a.images?.[0]?.url });
  for (const t of data.tracks?.items ?? []) if (t) items.push({ provider: 'spotify', kind: 'track', uri: t.uri, title: t.name, subtitle: t.artists?.map((x) => x.name).join(', '), artworkUrl: t.album?.images?.[0]?.url });
  return items;
}
