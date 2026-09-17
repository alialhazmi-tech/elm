#!/bin/sh
# أرشفة تطبيق العلم ورفعه إلى App Store Connect (TestFlight).
#
#   ios/scripts/archive.sh            # أرشفة فقط → ios/build/Elm.xcarchive
#   ios/scripts/archive.sh --upload   # أرشفة ثم رفع عبر ExportOptions.plist (يحتاج جلسة Xcode/Apple ID أو مفتاح ASC)
#
# متغيرات اختيارية: BUILD_NUMBER (يُمرَّر كـ CURRENT_PROJECT_VERSION)، ASC_KEY_ID/ASC_ISSUER_ID/ASC_KEY_PATH لمفتاح API.
set -eu
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ARCHIVE="$ROOT/build/Elm.xcarchive"
EXPORT="$ROOT/build/export"
BUILD_NUMBER="${BUILD_NUMBER:-}"

rm -rf "$ARCHIVE" "$EXPORT"
xcodebuild -project "$ROOT/Elm.xcodeproj" -scheme Elm -configuration Release \
  -destination 'generic/platform=iOS' -archivePath "$ARCHIVE" \
  -allowProvisioningUpdates ${BUILD_NUMBER:+CURRENT_PROJECT_VERSION="$BUILD_NUMBER"} archive

if [ "${1:-}" = "--upload" ]; then
  AUTH=""
  if [ -n "${ASC_KEY_ID:-}" ] && [ -n "${ASC_ISSUER_ID:-}" ] && [ -n "${ASC_KEY_PATH:-}" ]; then
    AUTH="-authenticationKeyID $ASC_KEY_ID -authenticationKeyIssuerID $ASC_ISSUER_ID -authenticationKeyPath $ASC_KEY_PATH"
  fi
  # shellcheck disable=SC2086
  xcodebuild -exportArchive -archivePath "$ARCHIVE" -exportPath "$EXPORT" \
    -exportOptionsPlist "$ROOT/ExportOptions.plist" -allowProvisioningUpdates $AUTH
fi
echo "الأرشيف: $ARCHIVE"
