import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { useFonts } from 'expo-font';
import { ActivateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';

WebBrowser.maybeCompleteAuthSession();

// ─── Constants ────────────────────────────────────────────────────────────────

const BACKGROUND_TASK = 'SPOTIFY_ALARM_TASK';
const STORAGE_KEYS = {
  CLIENT_ID: 'spotify_client_id',
  ACCESS_TOKEN: 'spotify_access_token',
  REFRESH_TOKEN: 'spotify_refresh_token',
  TOKEN_EXPIRY: 'spotify_token_expiry',
  ALARM_CONFIG: 'alarm_config',
};

const SPOTIFY_SCOPES = [
  'user-read-playback-state',
  'user-modify-playback-state',
  'playlist-read-private',
  'streaming',
  'user-read-private',
];

const REDIRECT_URI = 'spotifyalarm://callback';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AlarmConfig {
  hour: number;
  minute: number;
  playlistUri: string;
  playlistName: string;
  startVolume: number;
  endVolume: number;
  fadeDurationMin: number;
  active: boolean;
}

interface SpotifyPlaylist {
  id: string;
  name: string;
  uri: string;
  images: { url: string }[];
  tracks: { total: number };
}

type Screen = 'setup' | 'alarm';

// ─── Notification handler ─────────────────────────────────────────────────────

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// ─── Spotify helpers (module-level, used by background task) ──────────────────

async function getValidToken(): Promise<string | null> {
  try {
    const [token, expiryStr, refreshToken, clientId] = await Promise.all([
      AsyncStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN),
      AsyncStorage.getItem(STORAGE_KEYS.TOKEN_EXPIRY),
      AsyncStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN),
      AsyncStorage.getItem(STORAGE_KEYS.CLIENT_ID),
    ]);

    if (!token) return null;

    const expiry = expiryStr ? parseInt(expiryStr, 10) : 0;
    const isExpired = Date.now() > expiry - 60000;

    if (!isExpired) return token;
    if (!refreshToken || !clientId) return null;

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
    });

    const res = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!res.ok) return null;

    const data = await res.json();
    const newExpiry = Date.now() + data.expires_in * 1000;

    await Promise.all([
      AsyncStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, data.access_token),
      AsyncStorage.setItem(STORAGE_KEYS.TOKEN_EXPIRY, String(newExpiry)),
      ...(data.refresh_token
        ? [AsyncStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, data.refresh_token)]
        : []),
    ]);

    return data.access_token;
  } catch {
    return null;
  }
}

async function setSpotifyVolume(token: string, volumePct: number): Promise<void> {
  const vol = Math.max(0, Math.min(100, Math.round(volumePct)));
  await fetch(`https://api.spotify.com/v1/me/player/volume?volume_percent=${vol}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Background task ──────────────────────────────────────────────────────────

TaskManager.defineTask(BACKGROUND_TASK, async () => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.ALARM_CONFIG);
    if (!raw) return BackgroundFetch.BackgroundFetchResult.NoData;

    const config: AlarmConfig = JSON.parse(raw);
    if (!config.active) return BackgroundFetch.BackgroundFetchResult.NoData;

    const token = await getValidToken();
    if (!token) return BackgroundFetch.BackgroundFetchResult.Failed;

    const playRes = await fetch('https://api.spotify.com/v1/me/player/play', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ context_uri: config.playlistUri }),
    });

    if (playRes.status === 404) {
      console.warn('[SpotifyAlarm] No active device, will retry on next tick.');
      return BackgroundFetch.BackgroundFetchResult.Failed;
    }

    await setSpotifyVolume(token, config.startVolume);

    const totalSteps = Math.floor((config.fadeDurationMin * 60) / 30);
    const volStep = (config.endVolume - config.startVolume) / Math.max(totalSteps, 1);

    for (let i = 1; i <= totalSteps; i++) {
      await sleep(30000);
      const freshToken = await getValidToken();
      if (!freshToken) continue;
      const newVol = Math.min(
        Math.round(config.startVolume + volStep * i),
        config.endVolume
      );
      await setSpotifyVolume(freshToken, newVol);
    }

    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (err) {
    console.error('[SpotifyAlarm] Background task error:', err);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [fontsLoaded] = useFonts({
    Orbitron: require('./assets/Orbitron-Regular.ttf'),
    'Orbitron-Bold': require('./assets/Orbitron-Bold.ttf'),
  });

  const [screen, setScreen] = useState<Screen>('setup');
  const [clientId, setClientId] = useState('');
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [playlists, setPlaylists] = useState<SpotifyPlaylist[]>([]);
  const [loadingPlaylists, setLoadingPlaylists] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);

  const [alarmHour, setAlarmHour] = useState(7);
  const [alarmMinute, setAlarmMinute] = useState(0);
  const [selectedPlaylist, setSelectedPlaylist] = useState<SpotifyPlaylist | null>(null);
  const [startVolume, setStartVolume] = useState(10);
  const [endVolume, setEndVolume] = useState(80);
  const [fadeDuration, setFadeDuration] = useState(10);
  const [alarmActive, setAlarmActive] = useState(false);
  const [notifId, setNotifId] = useState<string | null>(null);

  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    (async () => {
      const [savedClientId, savedToken, savedExpiry, savedConfig] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.CLIENT_ID),
        AsyncStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN),
        AsyncStorage.getItem(STORAGE_KEYS.TOKEN_EXPIRY),
        AsyncStorage.getItem(STORAGE_KEYS.ALARM_CONFIG),
      ]);

      if (savedClientId) setClientId(savedClientId);

      if (savedToken && savedExpiry && Date.now() < parseInt(savedExpiry, 10)) {
        setAccessToken(savedToken);
        setScreen('alarm');
      }

      if (savedConfig) {
        const cfg: AlarmConfig = JSON.parse(savedConfig);
        setAlarmHour(cfg.hour);
        setAlarmMinute(cfg.minute);
        setStartVolume(cfg.startVolume);
        setEndVolume(cfg.endVolume);
        setFadeDuration(cfg.fadeDurationMin);
        setAlarmActive(cfg.active);
      }

      await requestPermissions();
    })();
  }, []);

  useEffect(() => {
    if (accessToken) fetchPlaylists();
  }, [accessToken]);

  async function requestPermissions() {
    if (Platform.OS !== 'web') {
      const { status } = await Notifications.requestPermissionsAsync({
        ios: { allowAlert: true, allowBadge: true, allowSound: true },
      });
      if (status !== 'granted') {
        Alert.alert(
          'Permission needed',
          'Notification permission is required for the alarm to work when the screen is locked.'
        );
      }
    }
  }

  // ── Auth ─────────────────────────────────────────────────────────────────────

  const discovery = AuthSession.useAutoDiscovery('https://accounts.spotify.com');

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: clientId || 'placeholder',
      scopes: SPOTIFY_SCOPES,
      redirectUri: REDIRECT_URI,
      usePKCE: true,
      responseType: AuthSession.ResponseType.Code,
    },
    discovery
  );

  useEffect(() => {
    if (response?.type === 'success' && response.params.code) {
      exchangeCode(response.params.code, request?.codeVerifier ?? '');
    } else if (response?.type === 'error') {
      Alert.alert('Auth error', response.error?.message ?? 'Unknown error');
      setAuthLoading(false);
    } else if (response?.type === 'dismiss') {
      setAuthLoading(false);
    }
  }, [response]);

  async function exchangeCode(code: string, codeVerifier: string) {
    try {
      const body = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
        client_id: clientId,
        code_verifier: codeVerifier,
      });

      const res = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });

      const data = await res.json();

      if (!res.ok) {
        Alert.alert('Token error', data.error_description ?? data.error ?? 'Auth failed');
        setAuthLoading(false);
        return;
      }

      const expiry = Date.now() + data.expires_in * 1000;
      await Promise.all([
        AsyncStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, data.access_token),
        AsyncStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, data.refresh_token ?? ''),
        AsyncStorage.setItem(STORAGE_KEYS.TOKEN_EXPIRY, String(expiry)),
        AsyncStorage.setItem(STORAGE_KEYS.CLIENT_ID, clientId),
      ]);

      setAccessToken(data.access_token);
      setScreen('alarm');
    } catch {
      Alert.alert('Error', 'Failed to exchange auth code.');
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleConnect() {
    if (!clientId.trim()) {
      Alert.alert('Missing Client ID', 'Please enter your Spotify Client ID.');
      return;
    }
    await AsyncStorage.setItem(STORAGE_KEYS.CLIENT_ID, clientId.trim());
    setAuthLoading(true);
    await promptAsync();
  }

  // ── Playlists ─────────────────────────────────────────────────────────────────

  async function fetchPlaylists() {
    setLoadingPlaylists(true);
    try {
      const token = await getValidToken();
      if (!token) return;

      const res = await fetch('https://api.spotify.com/v1/me/playlists?limit=50', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (data.items) {
        setPlaylists(data.items);
        if (data.items.length > 0) {
          setSelectedPlaylist((prev) => prev ?? data.items[0]);
        }
      }
    } catch {
      Alert.alert('Error', 'Could not fetch playlists.');
    } finally {
      setLoadingPlaylists(false);
    }
  }

  // ── Alarm ─────────────────────────────────────────────────────────────────────

  async function persistConfig(active: boolean) {
    const cfg: AlarmConfig = {
      hour: alarmHour,
      minute: alarmMinute,
      playlistUri: selectedPlaylist?.uri ?? '',
      playlistName: selectedPlaylist?.name ?? '',
      startVolume,
      endVolume,
      fadeDurationMin: fadeDuration,
      active,
    };
    await AsyncStorage.setItem(STORAGE_KEYS.ALARM_CONFIG, JSON.stringify(cfg));
  }

  async function activateAlarm() {
    if (!selectedPlaylist) {
      Alert.alert('No playlist', 'Please select a playlist first.');
      return;
    }

    await persistConfig(true);

    if (notifId) await Notifications.cancelScheduledNotificationAsync(notifId);

    const trigger = buildTrigger(alarmHour, alarmMinute);
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: '⏰ Spotify Alarm',
        body: `Time to wake up! Playing: ${selectedPlaylist.name}`,
        sound: true,
        priority: Notifications.AndroidNotificationPriority.MAX,
      },
      trigger,
    });

    setNotifId(id);
    await registerBackgroundTask();
    setAlarmActive(true);
    await ActivateKeepAwakeAsync();

    const timeStr = `${String(alarmHour).padStart(2, '0')}:${String(alarmMinute).padStart(2, '0')}`;
    Alert.alert('Alarm set!', `Alarm set for ${timeStr} — "${selectedPlaylist.name}"`);
  }

  async function deactivateAlarm() {
    await persistConfig(false);

    if (notifId) {
      await Notifications.cancelScheduledNotificationAsync(notifId);
      setNotifId(null);
    }

    try {
      const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_TASK);
      if (isRegistered) await BackgroundFetch.unregisterTaskAsync(BACKGROUND_TASK);
    } catch { /* ignore */ }

    setAlarmActive(false);
    deactivateKeepAwake();
    Alert.alert('Alarm off', 'Alarm has been deactivated.');
  }

  function buildTrigger(hour: number, minute: number): Notifications.NotificationTriggerInput {
    if (Platform.OS === 'ios') {
      return {
        type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
        hour,
        minute,
        second: 0,
        repeats: true,
      };
    }
    return {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    };
  }

  async function registerBackgroundTask() {
    try {
      const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_TASK);
      if (!isRegistered) {
        await BackgroundFetch.registerTaskAsync(BACKGROUND_TASK, {
          minimumInterval: 60,
          stopOnTerminate: false,
          startOnBoot: true,
        });
      }
    } catch (err) {
      console.warn('[SpotifyAlarm] Could not register background task:', err);
    }
  }

  async function testAlarm() {
    if (!selectedPlaylist) {
      Alert.alert('No playlist', 'Please select a playlist first.');
      return;
    }

    const token = await getValidToken();
    if (!token) {
      Alert.alert('Not connected', 'Please reconnect your Spotify account.');
      return;
    }

    try {
      const res = await fetch('https://api.spotify.com/v1/me/player/play', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ context_uri: selectedPlaylist.uri }),
      });

      if (res.status === 404) {
        Alert.alert(
          'No active device',
          'Open Spotify on your phone, play any track to activate a device, then try again.'
        );
        return;
      }
      if (res.status === 403) {
        Alert.alert(
          'Spotify Premium required',
          'Playback control via API requires a Spotify Premium subscription.'
        );
        return;
      }

      await setSpotifyVolume(token, startVolume);
      Alert.alert('Test started!', `Playing "${selectedPlaylist.name}" at ${startVolume}% volume.`);
    } catch {
      Alert.alert('Error', 'Failed to start test playback.');
    }
  }

  async function handleLogout() {
    await Promise.all([
      AsyncStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN),
      AsyncStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN),
      AsyncStorage.removeItem(STORAGE_KEYS.TOKEN_EXPIRY),
    ]);
    setAccessToken(null);
    setPlaylists([]);
    setSelectedPlaylist(null);
    setScreen('setup');
  }

  // ── UI components ─────────────────────────────────────────────────────────────

  function SliderRow({
    label,
    value,
    min,
    max,
    step,
    unit,
    onChange,
  }: {
    label: string;
    value: number;
    min: number;
    max: number;
    step: number;
    unit: string;
    onChange: (v: number) => void;
  }) {
    const pct = ((value - min) / (max - min)) * 100;
    return (
      <View style={styles.sliderRow}>
        <Text style={styles.sliderLabel}>
          {label}:{' '}
          <Text style={styles.sliderValue}>
            {value}
            {unit}
          </Text>
        </Text>
        <View style={styles.sliderControls}>
          <TouchableOpacity
            style={styles.sliderBtn}
            onPress={() => onChange(Math.max(min, value - step))}
          >
            <Text style={styles.sliderBtnText}>−</Text>
          </TouchableOpacity>
          <View style={styles.sliderTrack}>
            <View style={[styles.sliderFill, { width: `${pct}%` }]} />
          </View>
          <TouchableOpacity
            style={styles.sliderBtn}
            onPress={() => onChange(Math.min(max, value + step))}
          >
            <Text style={styles.sliderBtnText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  function TimeAdjustRow() {
    return (
      <View style={styles.timePickerRow}>
        <View style={styles.timeUnit}>
          <TouchableOpacity
            onPress={() => setAlarmHour((h) => (h + 1) % 24)}
            style={styles.timeBtn}
          >
            <Text style={styles.timeBtnText}>▲</Text>
          </TouchableOpacity>
          <Text style={styles.timeDigit}>{String(alarmHour).padStart(2, '0')}</Text>
          <TouchableOpacity
            onPress={() => setAlarmHour((h) => (h - 1 + 24) % 24)}
            style={styles.timeBtn}
          >
            <Text style={styles.timeBtnText}>▼</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.timeColon}>:</Text>
        <View style={styles.timeUnit}>
          <TouchableOpacity
            onPress={() => setAlarmMinute((m) => (m + 1) % 60)}
            style={styles.timeBtn}
          >
            <Text style={styles.timeBtnText}>▲</Text>
          </TouchableOpacity>
          <Text style={styles.timeDigit}>{String(alarmMinute).padStart(2, '0')}</Text>
          <TouchableOpacity
            onPress={() => setAlarmMinute((m) => (m - 1 + 60) % 60)}
            style={styles.timeBtn}
          >
            <Text style={styles.timeBtnText}>▼</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  if (!fontsLoaded) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color="#1db954" size="large" />
      </View>
    );
  }

  const clockStr = [
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
  ].join(':');

  // ── Setup screen ──────────────────────────────────────────────────────────────

  if (screen === 'setup') {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <StatusBar barStyle="light-content" backgroundColor="#080c10" />

        <Text style={styles.clock}>{clockStr}</Text>
        <Text style={styles.title}>Spotify Alarm</Text>
        <Text style={styles.subtitle}>Smart Wake-Up with Gradual Volume Fade</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Spotify Setup</Text>

          <Text style={styles.instructionText}>
            1. Go to{' '}
            <Text style={styles.link}>developer.spotify.com/dashboard</Text>
          </Text>
          <Text style={styles.instructionText}>
            2. Create an app (or open an existing one)
          </Text>
          <Text style={styles.instructionText}>
            3. In "Edit Settings" → Redirect URIs, add exactly:
          </Text>
          <View style={styles.codeBlock}>
            <Text style={styles.codeText}>spotifyalarm://callback</Text>
          </View>
          <Text style={styles.instructionText}>4. Copy your Client ID and paste it below:</Text>

          <TextInput
            style={styles.input}
            placeholder="Paste Spotify Client ID here"
            placeholderTextColor="#444"
            value={clientId}
            onChangeText={setClientId}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <TouchableOpacity
            style={[styles.primaryBtn, authLoading && styles.btnDisabled]}
            onPress={handleConnect}
            disabled={authLoading || !request}
          >
            {authLoading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.primaryBtnText}>Connect Spotify</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.premiumWarning}>
          <Text style={styles.premiumText}>
            ⚠️  Spotify Premium is required for API playback control. Free accounts cannot start
            or control playback remotely.
          </Text>
        </View>
      </ScrollView>
    );
  }

  // ── Alarm screen ──────────────────────────────────────────────────────────────

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
    >
      <StatusBar barStyle="light-content" backgroundColor="#080c10" />

      <Text style={styles.clock}>{clockStr}</Text>

      <View style={styles.headerRow}>
        <Text style={styles.title}>Spotify Alarm</Text>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Disconnect</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.premiumWarning}>
        <Text style={styles.premiumText}>
          ⚠️  Spotify Premium required for remote playback control.
        </Text>
      </View>

      {/* Time picker */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Alarm Time</Text>
        <TimeAdjustRow />
      </View>

      {/* Playlist selector */}
      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <Text style={styles.cardTitle}>Playlist</Text>
          <TouchableOpacity onPress={fetchPlaylists} style={styles.refreshBtn}>
            <Text style={styles.refreshText}>↻ Refresh</Text>
          </TouchableOpacity>
        </View>

        {loadingPlaylists ? (
          <ActivityIndicator color="#1db954" style={{ marginVertical: 12 }} />
        ) : (
          <ScrollView style={styles.playlistScroll} nestedScrollEnabled>
            {playlists.map((pl) => (
              <TouchableOpacity
                key={pl.id}
                style={[
                  styles.playlistItem,
                  selectedPlaylist?.id === pl.id && styles.playlistItemSelected,
                ]}
                onPress={() => setSelectedPlaylist(pl)}
              >
                <Text
                  style={[
                    styles.playlistName,
                    selectedPlaylist?.id === pl.id && styles.playlistNameSelected,
                  ]}
                  numberOfLines={1}
                >
                  {pl.name}
                </Text>
                <Text style={styles.playlistMeta}>{pl.tracks.total} tracks</Text>
              </TouchableOpacity>
            ))}
            {playlists.length === 0 && (
              <Text style={styles.emptyText}>No playlists found. Tap Refresh.</Text>
            )}
          </ScrollView>
        )}
      </View>

      {/* Volume fade */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Volume Fade</Text>
        <SliderRow
          label="Start volume"
          value={startVolume}
          min={1}
          max={40}
          step={1}
          unit="%"
          onChange={setStartVolume}
        />
        <SliderRow
          label="End volume"
          value={endVolume}
          min={40}
          max={100}
          step={1}
          unit="%"
          onChange={setEndVolume}
        />
        <SliderRow
          label="Fade duration"
          value={fadeDuration}
          min={1}
          max={30}
          step={1}
          unit=" min"
          onChange={setFadeDuration}
        />
      </View>

      {/* Actions */}
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[
            styles.primaryBtn,
            styles.activateBtn,
            alarmActive && styles.deactivateBtn,
          ]}
          onPress={alarmActive ? deactivateAlarm : activateAlarm}
        >
          <Text style={styles.primaryBtnText}>
            {alarmActive ? '⏹  Deactivate Alarm' : '⏰  Activate Alarm'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.testBtn} onPress={testAlarm}>
          <Text style={styles.testBtnText}>▶  Test Now</Text>
        </TouchableOpacity>
      </View>

      {alarmActive && selectedPlaylist && (
        <View style={styles.activeIndicator}>
          <Text style={styles.activeText}>
            ✓ Alarm active — {String(alarmHour).padStart(2, '0')}:
            {String(alarmMinute).padStart(2, '0')} • {selectedPlaylist.name}
          </Text>
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const GREEN = '#1db954';
const BG = '#080c10';
const CARD_BG = '#111820';
const BORDER = '#1e2a38';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  scrollContent: { padding: 20, paddingTop: 60 },
  center: { justifyContent: 'center', alignItems: 'center' },

  clock: {
    fontFamily: 'Orbitron-Bold',
    fontSize: 40,
    color: GREEN,
    textAlign: 'center',
    letterSpacing: 4,
    marginBottom: 8,
  },
  title: {
    fontFamily: 'Orbitron',
    fontSize: 20,
    color: '#ffffff',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: '#6b7fa3',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 28,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  logoutBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: BORDER,
  },
  logoutText: { color: '#6b7fa3', fontSize: 12 },

  card: {
    backgroundColor: CARD_BG,
    borderRadius: 14,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: BORDER,
  },
  cardTitle: {
    fontFamily: 'Orbitron',
    fontSize: 11,
    color: GREEN,
    letterSpacing: 1.5,
    marginBottom: 14,
    textTransform: 'uppercase',
  },
  cardTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },

  instructionText: { color: '#8fa0c0', fontSize: 13, marginBottom: 6, lineHeight: 20 },
  link: { color: GREEN },

  codeBlock: {
    backgroundColor: '#0d1520',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: GREEN + '44',
  },
  codeText: { fontFamily: 'Orbitron', color: GREEN, fontSize: 13 },

  input: {
    backgroundColor: '#0d1520',
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 14,
    marginBottom: 14,
  },

  primaryBtn: {
    backgroundColor: GREEN,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  primaryBtnText: { fontFamily: 'Orbitron', color: '#000', fontSize: 13, letterSpacing: 1 },

  premiumWarning: {
    backgroundColor: '#2a1a00',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#5a3a00',
  },
  premiumText: { color: '#f0a030', fontSize: 12, lineHeight: 18 },

  timePickerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  timeUnit: { alignItems: 'center' },
  timeBtn: { paddingHorizontal: 24, paddingVertical: 8 },
  timeBtnText: { color: GREEN, fontSize: 20 },
  timeDigit: {
    fontFamily: 'Orbitron-Bold',
    fontSize: 52,
    color: '#fff',
    letterSpacing: 2,
  },
  timeColon: {
    fontFamily: 'Orbitron-Bold',
    fontSize: 52,
    color: '#fff',
    marginHorizontal: 6,
    marginBottom: 8,
  },

  playlistScroll: { maxHeight: 220 },
  playlistItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  playlistItemSelected: {
    backgroundColor: GREEN + '22',
    borderColor: GREEN + '88',
  },
  playlistName: { color: '#c0cfdf', fontSize: 14, flex: 1 },
  playlistNameSelected: { color: GREEN },
  playlistMeta: { color: '#4a6080', fontSize: 11, marginLeft: 8 },
  emptyText: { color: '#4a6080', textAlign: 'center', marginVertical: 12 },
  refreshBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: BORDER,
  },
  refreshText: { color: GREEN, fontSize: 12 },

  sliderRow: { marginBottom: 16 },
  sliderLabel: { color: '#8fa0c0', fontSize: 13, marginBottom: 8 },
  sliderValue: { color: '#fff', fontFamily: 'Orbitron' },
  sliderControls: { flexDirection: 'row', alignItems: 'center' },
  sliderBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#1e2a38',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sliderBtnText: { color: GREEN, fontSize: 22, lineHeight: 24 },
  sliderTrack: {
    flex: 1,
    height: 6,
    backgroundColor: '#1e2a38',
    borderRadius: 3,
    marginHorizontal: 10,
    overflow: 'hidden',
  },
  sliderFill: { height: '100%', backgroundColor: GREEN, borderRadius: 3 },

  actionRow: { gap: 12, marginBottom: 12 },
  activateBtn: { paddingVertical: 18 },
  deactivateBtn: { backgroundColor: '#c0392b' },
  testBtn: {
    borderWidth: 1.5,
    borderColor: GREEN,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  testBtnText: { fontFamily: 'Orbitron', color: GREEN, fontSize: 13, letterSpacing: 1 },

  activeIndicator: {
    backgroundColor: GREEN + '18',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: GREEN + '55',
  },
  activeText: { color: GREEN, fontSize: 13, textAlign: 'center' },
});
