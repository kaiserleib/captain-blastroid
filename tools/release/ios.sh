#!/bin/sh
# Archives the iOS app and uploads it to App Store Connect (it then appears in TestFlight).
# Needs an App Store Connect API key in ~/.appstoreconnect/private_keys/AuthKey_<id>.p8 and
#   ASC_KEY_ID      the key's id (the <id> in the file name)
#   ASC_ISSUER_ID   App Store Connect → Users and Access → Integrations → Issuer ID
# The app record must exist in App Store Connect first. `--no-upload` stops after the export.
set -eu
: "${ASC_KEY_ID:?set ASC_KEY_ID}" "${ASC_ISSUER_ID:?set ASC_ISSUER_ID}"
KEY="$HOME/.appstoreconnect/private_keys/AuthKey_${ASC_KEY_ID}.p8"
cd "$(dirname "$0")/../.."
npm run build
npx cap sync ios
cd ios/App
AUTH="-allowProvisioningUpdates -authenticationKeyPath $KEY -authenticationKeyID $ASC_KEY_ID -authenticationKeyIssuerID $ASC_ISSUER_ID"
# Archived unsigned: a signed archive wants a development profile, which needs a registered
# device. The export below signs for distribution, which doesn't.
xcodebuild -project App.xcodeproj -scheme App -configuration Release \
  -destination 'generic/platform=iOS' -archivePath build/CaptainBlastroid.xcarchive \
  CODE_SIGNING_ALLOWED=NO archive
DEST=upload
[ "${1:-}" = "--no-upload" ] && DEST=export
cat > build/ExportOptions.plist <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>method</key><string>app-store-connect</string>
  <key>destination</key><string>$DEST</string>
  <key>teamID</key><string>V9498DP3CU</string>
  <key>signingStyle</key><string>automatic</string>
</dict></plist>
PLIST
# shellcheck disable=SC2086
xcodebuild -exportArchive -archivePath build/CaptainBlastroid.xcarchive \
  -exportOptionsPlist build/ExportOptions.plist -exportPath build/export $AUTH
