#!/usr/bin/env bash
# O portão do app React Native: tipos, testes, e o Metro empacotando para iOS.
# Sai com erro se qualquer passo falhar (nunca "verde" sobre um passo vermelho).
set -u
cd "$(dirname "$0")/.."
falhou=0
passo() { echo "── $1"; shift; if "$@"; then echo "   ok"; else echo "   ❌ FALHOU"; falhou=1; fi; }
passo "tsc" npx tsc --noEmit
passo "testes" bun test src/
passo "export iOS (Metro + Hermes)" bash -c 'rm -rf dist-ios && npx expo export --platform ios --output-dir dist-ios >/tmp/export-ios.log 2>&1 || { tail -30 /tmp/export-ios.log; exit 1; }'
if [ $falhou -ne 0 ]; then echo "❌ NÃO COMMITE: o portão do app falhou."; exit 1; fi
echo "✅ app: tudo verde"
