# Audio assets required

This folder must contain two `.m4a` files before building. They are not
committed (binary blobs in source control are wasteful and tooling-dependent
to generate without an iOS toolchain).

## Files to add

### `SilentLoop.m4a`
A ~10-second AAC-encoded file of pure digital silence (or a near-zero
amplitude sine wave). Used to keep the `AVAudioSession` and app alive in
background while waiting for an alarm to fire.

Recommended specs:
- Duration: 10 s
- Codec: AAC-LC, 64 kbps, mono
- Sample rate: 44.1 kHz

Quick way to generate on macOS:
```bash
ffmpeg -f lavfi -i "anullsrc=channel_layout=mono:sample_rate=44100" \
       -t 10 -c:a aac -b:a 64k SilentLoop.m4a
```

### `FallbackTone.m4a`
A pleasant, loopable wake-up tone (5–10 s). Played at full volume if Spotify
cannot be reached at fire time, so the user still wakes up.

Recommended specs:
- Duration: 5–10 s
- Codec: AAC-LC, 128 kbps, stereo
- Loopable: should end on the same amplitude/phase as it starts

Suggestion: a warm pad or chime that crescendos gracefully.

## Wiring

Both files are referenced from `project.yml` under `targets.SpotifyAlarm.resources`.
After dropping them here, regenerate the Xcode project with `xcodegen`.
