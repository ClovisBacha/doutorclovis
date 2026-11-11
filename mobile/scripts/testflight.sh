#!/bin/zsh
# Gera o build do iPhone e envia para o TestFlight, num comando só — o mesmo
# caminho do Marca Ponto (app-tenis-/scripts/archive-testflight.sh), adaptado
# ao Expo: o projeto do iPhone (`ios/`) não fica no git, então o prebuild o
# gera antes do archive.
#
# Roda SÓ no Mac (a Apple só compila app de iPhone com o Xcode). Precisa do
# Apple ID logado no Xcode (Settings > Accounts) no time 8PL2X9F9PV — o mesmo
# que assinou os builds até aqui. O número do build é o `buildNumber` do
# app.json, que sobe a cada build feito na nuvem.
#
# Uso, de dentro de mobile/:   ./scripts/testflight.sh
set -euo pipefail
cd "$(dirname "$0")/.."

echo "1/4 — trazendo a versão nova"
git pull --ff-only

echo "2/4 — instalando as peças"
bun install

echo "3/4 — gerando o projeto do iPhone"
npx expo prebuild --platform ios --no-install
(cd ios && pod install)

WORKSPACE=$(ls -d ios/*.xcworkspace | head -1)
SCHEME=$(basename "$WORKSPACE" .xcworkspace)
ARCHIVE="build/$SCHEME.xcarchive"
rm -rf "$ARCHIVE" build/export

echo "4/4 — gerando e enviando o build $(grep -o '"buildNumber": "[0-9]*"' app.json | grep -o '[0-9]*') ($SCHEME)"
xcodebuild -workspace "$WORKSPACE" -scheme "$SCHEME" -configuration Release \
  -destination 'generic/platform=iOS' -archivePath "$ARCHIVE" \
  -allowProvisioningUpdates archive
xcodebuild -exportArchive -archivePath "$ARCHIVE" -exportOptionsPlist scripts/ExportOptions.plist \
  -exportPath build/export -allowProvisioningUpdates

echo "Enviado para o App Store Connect. Em 10 a 30 minutos aparece no TestFlight."
