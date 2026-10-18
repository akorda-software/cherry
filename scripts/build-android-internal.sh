#!/usr/bin/env bash
# Internal, self-contained APK against Cherry España. Not a Play Store release.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root/apps/mobile"

# Keep the development application ID/signing identity used by Google Android.
# Do not overwrite .env, upload to a store or put server credentials in a bundle.
export EXPO_ANDROID_PACKAGE="${EXPO_ANDROID_PACKAGE:-app.cherry.mobile.dev}"
if [[ "$EXPO_ANDROID_PACKAGE" == *.dev ]]; then
  export EXPO_APP_NAME="Cherry Dev"
else
  export EXPO_APP_NAME=Cherry
fi
export EXPO_APP_SCHEME="${EXPO_APP_SCHEME:-cherry-dev}"
export EXPO_PUBLIC_API_BASE_URL_ANDROID=https://cherry.org.es
export EXPO_PUBLIC_API_BASE_URL_IOS=https://cherry.org.es
export EXPO_PUBLIC_API_BASE_URL_WEB=https://cherry.org.es
export EXPO_PUBLIC_APPLE_BROWSER_ENABLED=true
export EXPO_PUBLIC_MOCK_AUTH=false
export EXPO_PUBLIC_TEST_LOGIN=false
export JAVA_HOME="${CHERRY_BUILD_JAVA_HOME:-$HOME/.local/share/mise/installs/java/21.0.2}"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/.local/share/android-sdk}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"
export CI=1

test -x "$JAVA_HOME/bin/java"
test -d "$ANDROID_HOME"
pnpm exec expo prebuild --platform android --no-install
cd android
./gradlew :app:assembleRelease -PreactNativeArchitectures=arm64-v8a \
  --no-daemon --console=plain --max-workers=4

echo "APK interna: apps/mobile/android/app/build/outputs/apk/release/app-release.apk"
