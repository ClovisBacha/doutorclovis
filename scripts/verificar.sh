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

# ⚠️ **A QUARTA CHECAGEM: a árvore está ATRASADA?**
#
# O contêiner restaura instantâneos antigos do espaço de trabalho — cinco vezes
# numa noite. Quando isso acontece, os arquivos "modificados" são versões
# ANTERIORES às do remoto, e um `git add -A && git commit` reverte a sessão
# inteira com um diff que parece legítimo. É o erro que mais custou aqui, e o
# que o dono pediu para consertar.
#
# O hook de início (`.claude/hooks/session-start.sh`) conserta na ABERTURA da
# sessão; esta trava pega o caso em que o contêiner reinicia NO MEIO do
# trabalho, que foi como aconteceu todas as vezes.
#
# ⚠️ **O que ela NÃO alcança:** um instantâneo velho o bastante para ser
# anterior a este próprio arquivo vem sem a trava. Não há como uma proteção que
# mora no repositório se defender de uma cópia do repositório sem ela — o que
# fecha esse caso é o instantâneo ser refeito depois desta mudança.
passo "git"
BR="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '')"
if [ -z "$BR" ] || [ "$BR" = "HEAD" ]; then
  echo "sem branch (ok)"
elif ! git fetch --quiet origin "$BR" 2>/dev/null; then
  echo "ok (sem remoto para comparar)"
elif [ "$(git rev-parse HEAD)" != "$(git rev-parse "origin/$BR" 2>/dev/null || echo x)" ] &&
     git merge-base --is-ancestor HEAD "origin/$BR" 2>/dev/null; then
  echo "FALHOU"
  echo "  ⚠️  a árvore está $(git rev-list --count "HEAD..origin/$BR") commit(s) ATRÁS de origin/$BR."
  echo "  ⚠️  NÃO COMMITE: os arquivos daqui são versões ANTIGAS, e o commit reverteria o trabalho."
  echo "      Rode:  git reset --hard origin/$BR"
  falhou=1
else
  echo "ok"
fi

[ "$falhou" = "0" ] && echo "— tudo verde" || echo "— NÃO COMMITE"
exit $falhou
