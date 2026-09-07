import { makeRedirectUri } from 'expo-auth-session';

import { APP_SCHEME, spotifyClientId } from '../config';

/** OAuth 2.0 Authorization Code + PKCE (spec §10). No client secret exists anywhere in the app. */
export const SPOTIFY_DISCOVERY = {
  authorizationEndpoint: 'https://accounts.spotify.com/authorize',
  tokenEndpoint: 'https://accounts.spotify.com/api/token',
};

export const SPOTIFY_SCOPES = [
  'user-read-private',
  'user-read-playback-state',
  'user-modify-playback-state',
  'playlist-read-private',
  'playlist-read-collaborative',
  'user-library-read',
];

/** Must match the Redirect URI registered in the Spotify Developer Dashboard: wake://spotify-callback */
export const SPOTIFY_REDIRECT_URI = makeRedirectUri({ scheme: APP_SCHEME, path: 'spotify-callback' });

export const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';

export const isSpotifyConfigured = (): boolean => spotifyClientId.length > 0;
export { spotifyClientId };
