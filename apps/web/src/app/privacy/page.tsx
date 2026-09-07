import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Wake — Privacy Policy' };

export default function PrivacyPage() {
  return (
    <article className="legal">
      <h1>Privacy Policy</h1>
      <p>Last updated: September 2026 · Applies to the Wake mobile application (working title) and this website.</p>

      <h2>Summary</h2>
      <ul>
        <li>Wake works without an account. Your alarms, settings and recordings are stored only on your device.</li>
        <li>Voice recordings never leave your phone. We do not upload, analyse or back them up.</li>
        <li>If you connect Spotify, authentication happens on Spotify&apos;s own pages. Wake never sees your Spotify password.</li>
        <li>Spotify access tokens are stored in the device&apos;s secure storage (iOS Keychain / Android Keystore) and are never logged or transmitted to us.</li>
        <li>Wake currently has no servers of its own and collects no analytics.</li>
      </ul>

      <h2>Data we process on your device</h2>
      <ul>
        <li>Alarm configuration (time, days, sound, volume, snooze, vibration).</li>
        <li>Audio recordings you create, stored in the app&apos;s private storage.</li>
        <li>A local alarm history (when an alarm was scheduled, fired, stopped or snoozed) used only to help you and us understand reliability. It contains no audio.</li>
        <li>Diagnostic information shown in the in-app Diagnostics screen (OS version, permission states). It is displayed to you and not sent anywhere automatically.</li>
      </ul>

      <h2>Spotify</h2>
      <p>
        When you choose to connect Spotify, Wake requests the minimum permissions needed to list your playlists, search, and start or pause playback on your
        device. Spotify&apos;s own privacy policy governs data processed by Spotify. You can disconnect at any time from the app; this deletes the stored tokens.
        You can also revoke access at <a href="https://www.spotify.com/account/apps/">spotify.com/account/apps</a>.
      </p>

      <h2>Permissions</h2>
      <ul>
        <li>Alarms &amp; reminders / AlarmKit: required so alarms ring while the phone is locked.</li>
        <li>Microphone: only while you record a wake-up message.</li>
        <li>Notifications and full-screen alarm display (Android): to show STOP / SNOOZE while the phone is locked.</li>
      </ul>

      <h2>Children</h2>
      <p>Wake is not directed at children under 13 and does not knowingly collect personal information from them.</p>

      <h2>Changes</h2>
      <p>If Wake gains optional accounts, sync or analytics in the future, this policy will be updated before those features ship, and they will be opt-in.</p>

      <h2>Contact</h2>
      <p>Questions: open an issue at <a href="https://github.com/daviduek/spotify-alarm">github.com/daviduek/spotify-alarm</a>.</p>
    </article>
  );
}
