#!/bin/bash
#
# INÍCIO DE SESSÃO — dependências, e a branch no lugar certo.
#
# ─── POR QUE ESTE HOOK EXISTE ────────────────────────────────────────────────
#
# ⚠️ O contêiner desta sessão NÃO clona o repositório do zero quando reinicia:
# ele restaura um INSTANTÂNEO antigo do espaço de trabalho. Cinco vezes numa
# única noite ele devolveu a árvore num commit de dois dias antes, com arquivos
# "modificados" que eram, na verdade, versões ANTERIORES às do remoto — num caso
# medido, 4.572 linhas a menos.
#
# O perigo não é perder trabalho (ele está no remoto): é **commitar aqueles
# arquivos**. Um `git add -A && git commit` ali reverte a sessão inteira, e o
# diff parece legítimo. Foi o que o dono chamou de "toda vez pega uma versão
# antiga do código".
#
# ─── O QUE ELE FAZ, E O QUE ELE SE RECUSA A FAZER ────────────────────────────
#
#   · local IGUAL ao remoto            → não faz nada
#   · local ATRÁS (ancestral)          → guarda o que estiver na árvore num
#                                        arquivo `.patch` e alinha ao remoto
#   · local À FRENTE                   → NÃO TOCA. Avisa que falta empurrar.
#   · local DIVERGIU                   → NÃO TOCA. Avisa alto.
#
# ⚠️ Ele só mexe no caso INEQUÍVOCO — quando o HEAD local é ancestral do remoto,
# ou seja, o remoto contém tudo o que existe aqui e mais. Nos outros dois casos
# há trabalho local que só uma pessoa pode julgar, e um hook que decide sozinho
# ali destrói exatamente o que veio proteger.
#
# ⚠️ E mesmo no caso seguro ele NÃO APAGA: o que estiver na árvore vai para
# `restos-<data>.patch` na raiz do repositório, com o nome impresso.
set -uo pipefail

# Só no ambiente remoto — na máquina do dono, quem manda no git é ele.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0

echo "── início de sessão ──"

# ─── 1. A BRANCH NO LUGAR CERTO ──────────────────────────────────────────────
BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '')"
if [ -n "$BRANCH" ] && [ "$BRANCH" != "HEAD" ]; then
  if git fetch --quiet origin "$BRANCH" 2>/dev/null; then
    LOCAL="$(git rev-parse HEAD)"
    REMOTO="$(git rev-parse "origin/$BRANCH" 2>/dev/null || echo '')"

    if [ -z "$REMOTO" ] || [ "$LOCAL" = "$REMOTO" ]; then
      echo "git: em dia com origin/$BRANCH"

    elif git merge-base --is-ancestor "$LOCAL" "$REMOTO" 2>/dev/null; then
      # Caso INEQUÍVOCO: o remoto contém tudo o que há aqui, e mais.
      ATRAS="$(git rev-list --count "$LOCAL..$REMOTO")"
      echo "git: ⚠️  instantâneo ANTIGO — $ATRAS commit(s) atrás de origin/$BRANCH"

      if ! git diff --quiet HEAD 2>/dev/null || [ -n "$(git ls-files --others --exclude-standard)" ]; then
        RESTOS="restos-$(date +%Y%m%d-%H%M%S).patch"
        git diff HEAD > "$RESTOS" 2>/dev/null || true
        git ls-files --others --exclude-standard >> "$RESTOS" 2>/dev/null || true
        echo "git:    a árvore tinha mudanças — guardadas em $RESTOS (nada foi apagado)"
      fi

      git reset --hard "origin/$BRANCH" --quiet 2>/dev/null && \
        echo "git: ✅ alinhado a origin/$BRANCH ($(git rev-parse --short HEAD))"

    elif git merge-base --is-ancestor "$REMOTO" "$LOCAL" 2>/dev/null; then
      FRENTE="$(git rev-list --count "$REMOTO..$LOCAL")"
      echo "git: ⚠️  $FRENTE commit(s) À FRENTE do remoto — FALTA EMPURRAR. Não toquei em nada."

    else
      echo "git: 🛑 local e remoto DIVERGIRAM. Não toquei em nada — isto precisa de decisão humana."
    fi
  else
    echo "git: não consegui falar com o remoto (segue como está)"
  fi
fi

# ─── 2. DEPENDÊNCIAS ─────────────────────────────────────────────────────────
#
# `bun install` e não `--frozen-lockfile`: o estado do contêiner é guardado
# depois do hook, e o install normal aproveita melhor esse cache.
#
# ⚠️ **FALHA DE REDE AQUI NÃO É FALHA DA SESSÃO, e a diferença importa.**
# Medido neste contêiner: `bun install` morre com `ConnectionClosed downloading
# tarball` em três tentativas seguidas, e mesmo assim `node_modules` está
# inteiro — ele vem na imagem. Um hook que gritasse "‼️ falhou" faria a sessão
# começar com um alarme sobre algo que está funcionando.
#
# A pergunta certa não é "o install passou?" — é **"dá para trabalhar?"**. Quem
# responde isso é a presença do `node_modules`.
if [ -f package.json ]; then
  OK=""
  for _ in 1 2 3; do
    if bun install --silent 2>/dev/null; then OK="sim"; break; fi
    sleep 3
  done
  if [ -n "$OK" ]; then
    echo "deps: ✅ bun install"
  elif [ -d node_modules ] && [ -d node_modules/react ]; then
    echo "deps: ✅ node_modules já de pé (o install não completou — rede — mas dá para trabalhar)"
  else
    echo "deps: ‼️  sem node_modules E o install não completou. Rode 'bun install' à mão."
  fi
fi

echo "──────────────────────"
