import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Terms of Use' };

export default function TermsPage() {
  return (
    <article className="legal">
      <h1>Terms of Use</h1>
      <p>Last updated: September 2026 · Wake is pre-release software in technical validation.</p>

      <h2>Use at your own risk</h2>
      <p>
        Wake is designed so that the system alarm rings even when music services are unavailable, but no software can guarantee that a phone will wake you.
        Do not rely on a pre-release build for anything critical. Keep a second alarm for important commitments while Wake is in beta.
      </p>

      <h2>Third-party services</h2>
      <p>
        Spotify is a trademark of Spotify AB. Wake is an independent application that uses Spotify&apos;s public developer APIs under Spotify&apos;s Developer
        Terms. A Spotify Premium account may be required for remote playback. Spotify integration may be disabled at any time if platform terms change.
      </p>

      <h2>Your content</h2>
      <p>Recordings you create remain yours and remain on your device. You are responsible for the content you record.</p>

      <h2>Open source</h2>
      <p>
        The source code is available at <a href="https://github.com/daviduek/spotify-alarm">github.com/daviduek/spotify-alarm</a> under the licence stated in
        the repository.
      </p>

      <h2>Liability</h2>
      <p>To the maximum extent permitted by law, Wake is provided &quot;as is&quot; without warranties of any kind, and its authors are not liable for missed alarms or any consequential damages.</p>
    </article>
  );
}
