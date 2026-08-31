#!/usr/bin/env bash
# ⚠️ O PORTÃO ÚNICO ANTES DE COMMITAR.
#
# Duas vezes eu commitei com vermelho, e as duas pela mesma causa: encadear o
# commit com `&&` depois de rodar as checagens verifica o `git`, não as
# checagens. Elas imprimem o problema e seguem com código 0.
#
# Este script SAI COM ERRO se qualquer uma falhar. `bash scripts/verificar.sh &&
# git commit` passa a ser verdade.
set -uo pipefail
falhou=0
passo() { printf "%-12s " "$1"; }

# ⚠️ **O `npm notice` JÁ REPROVOU ESTE PORTÃO DUAS VEZES.** O `npx` imprime aviso
# de atualização em stderr; com `2>&1` ele entra na captura, e um passo que
# julga por "a saída está vazia?" vira vermelho sem nada de errado no código.
# Um portão que reprova por motivo alheio ao código é um portão que a pessoa
# aprende a ignorar — e no dia em que o vermelho for de verdade, ele é ignorado
# junto. Tudo que é ruído do gerenciador de pacotes sai antes de qualquer
# decisão.
limpo() { grep -vE '^npm (notice|warn)|^$' || true; }

# ─── tsc ─────────────────────────────────────────────────────────────────────
# ⚠️ Julgado pelo CÓDIGO DE SAÍDA, e não por "imprimiu alguma coisa?". O `tsc`
# sai 2 quando há erro de tipo e 0 quando não há — é o sinal exato. A regra
# antiga ("saída vazia = ok") tratava qualquer linha estranha como erro de tipo.
passo "tsc"
saida=$(npx tsc --noEmit 2>&1); rc=$?
if [ "$rc" = "0" ]; then echo "ok"; else
  echo "FALHOU (código $rc)"; echo "$saida" | limpo | head -6; falhou=1
fi

# ─── lint ────────────────────────────────────────────────────────────────────
# ⚠️ **ESTE PASSO FALHAVA ABERTO.** Ele era `npx eslint . | grep -c " error "`:
# se o eslint QUEBRA (configuração inválida, plugin faltando, falta de memória),
# a saída não tem nenhuma linha com " error ", a contagem dá ZERO, e o portão
# dizia **ok**. Ou seja: a checagem de lint desligava sozinha exatamente quando
# o lint parava de funcionar — a mesma classe de defeito que este repositório
# passou a noite consertando no produto, aqui no próprio instrumento.
#
# Agora o código de saída manda: 0 = limpo, 1 = achou problema (aí a contagem
# diz quantos), qualquer outro = o eslint quebrou, e isso NUNCA é "ok".
passo "lint"
saida=$(npx eslint . 2>&1); rc=$?
erros=$(printf '%s\n' "$saida" | grep -c " error " || true)
if [ "$rc" = "0" ]; then echo "ok"
elif [ "$rc" = "1" ]; then
  echo "FALHOU ($erros)"; printf '%s\n' "$saida" | grep " error " | head -5; falhou=1
else
  echo "FALHOU — o eslint quebrou (código $rc), e isso não é 'sem erros'"
  printf '%s\n' "$saida" | limpo | head -6; falhou=1
fi

# ─── testes ──────────────────────────────────────────────────────────────────
# ⚠️ UMA execução só. A versão anterior rodava `bun test src/` TRÊS vezes (uma
# para o resumo, uma para decidir, uma para listar os vermelhos): triplicava o
# tempo do portão e, pior, permitia que as três execuções DISCORDASSEM entre si
# num teste intermitente — o portão passando a depender de qual rodada alguém
# olhasse.
passo "testes"
saida=$(bun test src/ 2>&1); rc=$?
printf '%s\n' "$saida" | grep -E "^ [0-9]+ (pass|fail)" | tr '\n' ' '; echo
if ! printf '%s\n' "$saida" | grep -qE "^ 0 fail"; then
  echo "  TESTES VERMELHOS:"
  printf '%s\n' "$saida" | grep -E "^\(fail\)" | head -8
  # ⚠️ Sem a linha de resumo, o `bun` morreu antes de terminar (falta de
  # memória, import quebrado). Isso é vermelho, e nunca "nenhum teste falhou".
  printf '%s\n' "$saida" | grep -qE "^ [0-9]+ pass" || {
    echo "  ⚠️  o bun não chegou ao resumo (código $rc) — a suíte não rodou inteira"
    printf '%s\n' "$saida" | limpo | tail -6
  }
  falhou=1
fi

# ─── git: a árvore está ATRASADA? ────────────────────────────────────────────
#
# O contêiner restaura instantâneos antigos do espaço de trabalho — cinco vezes
# numa noite. Quando isso acontece, os arquivos "modificados" são versões
# ANTERIORES às do remoto, e um `git add -A && git commit` reverte a sessão
# inteira com um diff que parece legítimo. É o erro que mais custou aqui.
#
# O hook de início conserta na ABERTURA da sessão; esta trava pega o caso em que
# o contêiner reinicia NO MEIO do trabalho, que foi como aconteceu todas as
# vezes.
#
# ⚠️ **O que ela NÃO alcança:** um instantâneo velho o bastante para ser anterior
# a este próprio arquivo vem sem a trava. Não há como uma proteção que mora no
# repositório se defender de uma cópia do repositório sem ela — o que fecha esse
# caso é o instantâneo ser refeito depois desta mudança.
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
