#!/bin/sh
# Builds the signed Play bundle: android/app/build/outputs/bundle/release/app-release.aab.
# Signing reads RELEASE_* from android/local.properties (see docs/mobile.md → "Store release").
set -eu
cd "$(dirname "$0")/../.."
npm run build
npx cap sync android
cd android
JAVA_HOME="${JAVA_HOME:-$(brew --prefix openjdk)/libexec/openjdk.jdk/Contents/Home}" \
  ./gradlew bundleRelease
ls -l app/build/outputs/bundle/release/app-release.aab
