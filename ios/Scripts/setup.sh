#!/usr/bin/env bash
# Bootstraps the Spotify Alarm iOS project on a Mac:
#   1. Generates the two .m4a audio assets (silent loop + fallback tone)
#   2. Downloads the Spotify iOS SDK xcframework if missing
#   3. Runs XcodeGen to produce SpotifyAlarm.xcodeproj
#
# Idempotent — safe to run multiple times.

set -euo pipefail

cd "$(dirname "$0")/.."

ROOT="$(pwd)"
RES="$ROOT/SpotifyAlarm/Resources"
VENDOR="$ROOT/Vendor"

echo "▶ Spotify Alarm — iOS setup"
echo "  Root: $ROOT"

# -----------------------------------------------------------------------------
# 1. Audio assets
# -----------------------------------------------------------------------------
mkdir -p "$RES"

if [[ ! -f "$RES/SilentLoop.m4a" ]]; then
  echo "→ Generating SilentLoop.m4a (10s of digital silence)"
  if ! command -v ffmpeg >/dev/null 2>&1; then
    echo "  ⚠ ffmpeg not found. Install with:  brew install ffmpeg"
    echo "    Skipping audio generation. You can re-run this script later."
  else
    ffmpeg -hide_banner -loglevel error -y \
      -f lavfi -i "anullsrc=channel_layout=mono:sample_rate=44100" \
      -t 10 -c:a aac -b:a 64k "$RES/SilentLoop.m4a"
    echo "  ✓ $RES/SilentLoop.m4a"
  fi
else
  echo "  ✓ SilentLoop.m4a already exists"
fi

if [[ ! -f "$RES/FallbackTone.m4a" ]]; then
  echo "→ Generating FallbackTone.m4a (8s rising sine — wake-up tone)"
  if command -v ffmpeg >/dev/null 2>&1; then
    # Soft 440Hz sine with a slow fade-in and gentle vibrato.
    ffmpeg -hide_banner -loglevel error -y \
      -f lavfi -i "sine=frequency=440:duration=8" \
      -af "afade=t=in:st=0:d=2,vibrato=f=5:d=0.3,volume=0.6" \
      -c:a aac -b:a 128k "$RES/FallbackTone.m4a"
    echo "  ✓ $RES/FallbackTone.m4a"
  fi
else
  echo "  ✓ FallbackTone.m4a already exists"
fi

# -----------------------------------------------------------------------------
# 2. Spotify iOS SDK (optional — only needed for App Remote)
# -----------------------------------------------------------------------------
mkdir -p "$VENDOR"

if [[ ! -d "$VENDOR/SpotifyiOS.xcframework" ]]; then
  echo "→ Spotify iOS SDK not found in Vendor/"
  echo ""
  echo "  The App Remote SDK ships as a binary .xcframework. To enable"
  echo "  high-fidelity playback control with the Spotify app:"
  echo ""
  echo "    1. Download the latest release from:"
  echo "       https://github.com/spotify/ios-sdk/releases"
  echo ""
  echo "    2. Unzip it and move SpotifyiOS.xcframework into:"
  echo "       $VENDOR/"
  echo ""
  echo "  Without the framework, the app still builds — it falls back to"
  echo "  the Spotify Web API for playback control."
else
  echo "  ✓ Spotify iOS SDK found"
fi

# -----------------------------------------------------------------------------
# 3. XcodeGen
# -----------------------------------------------------------------------------
if ! command -v xcodegen >/dev/null 2>&1; then
  echo "  ⚠ xcodegen not found. Install with:  brew install xcodegen"
  exit 1
fi

echo "→ Generating Xcode project"
xcodegen --quiet

echo ""
echo "✅ Setup complete."
echo "   Open with:  open SpotifyAlarm.xcodeproj"
echo ""
echo "Next steps:"
echo "  1. Set your Spotify Client ID in SpotifyAlarm/Spotify/SpotifyConfig.swift"
echo "  2. Update the Apple Team in Signing & Capabilities"
echo "  3. (Optional) Request Critical Alerts entitlement at developer.apple.com"
