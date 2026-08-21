#!/usr/bin/env bash
# ⚠️ O PORTÃO ÚNICO ANTES DE COMMITAR.
#
# Duas vezes nesta sessão eu commitei com vermelho, e as duas pela mesma causa:
# encadear o commit com `&&` depois de rodar as checagens verifica o `git`, não
# as checagens. Elas imprimem o problema e seguem com código 0.
#
# Este script SAI COM ERRO se qualquer uma falhar. `bash scripts/verificar.sh &&
# git commit` passa a ser verdade.
set -uo pipefail
falhou=0
passo() { printf "%-12s " "$1"; }

passo "tsc";     out=$(npx tsc --noEmit 2>&1); [ -z "$out" ] && echo "ok" || { echo "FALHOU"; echo "$out" | head -6; falhou=1; }
passo "lint";    n=$(npx eslint . 2>&1 | grep -c " error "); [ "$n" = "0" ] && echo "ok" || { echo "FALHOU ($n)"; npx eslint . 2>&1 | grep " error " | head -5; falhou=1; }
passo "testes";  out=$(bun test src/ 2>&1 | grep -E "^ [0-9]+ (pass|fail)"); echo "$out" | tr '\n' ' '; echo
         bun test src/ 2>&1 | grep -qE "^ 0 fail" || { echo "  TESTES VERMELHOS:"; bun test src/ 2>&1 | grep -E "^\(fail\)" | head -5; falhou=1; }

[ "$falhou" = "0" ] && echo "— tudo verde" || echo "— NÃO COMMITE"
exit $falhou
