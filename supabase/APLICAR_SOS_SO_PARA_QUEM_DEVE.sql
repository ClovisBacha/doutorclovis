-- ═════════════════════════════════════════════════════════════════════════════
-- APLICAR_SOS_SO_PARA_QUEM_DEVE.sql — separa o link do ÁLBUM do link do
-- ACOMPANHANTE. Idempotente.
--
-- ─── ⚠️ O BURACO QUE ISTO FECHA ──────────────────────────────────────────────
--
-- `companion_invites.token` abria TRÊS portas com o mesmo valor:
--
--   1. `/album/<token>`       — o álbum do bebê (LER e POSTAR)
--   2. `/acompanhar/<token>`  — o painel do acompanhante
--   3. `getRecentPanicByToken` — os SOS dos últimos 30 min, COM LATITUDE E
--      LONGITUDE dela
--
-- E `minha-conta.tsx` montava o link do ÁLBUM com esse mesmo token. Quem
-- recebia "olha o álbum da Helena" no grupo da família recebia junto o painel
-- de emergência — o comentário de `escola.functions.ts` já dizia quem tem esse
-- token: "a cunhada, a vizinha, o grupo da família".
--
-- Pedido do dono, sobre uma influenciadora que chama seguidores para o app:
-- "se ela tiver um SOS, os seguidores dela NÃO têm que saber isso. Somente o
-- médico e o contato de emergência que ela deixou."
--
-- ─── ⚠️ A ROTAÇÃO É O PONTO, E ELA É DELIBERADA ──────────────────────────────
--
-- Não basta criar uma coluna nova e usá-la daqui para frente: os links JÁ
-- COMPARTILHADOS continuariam abrindo o SOS. Então o token antigo é REBAIXADO —
-- ele vira o `album_token`, que é o de MENOR privilégio — e o `token` (o de
-- acompanhante, que abre o SOS) recebe um valor NOVO.
--
-- O efeito é exatamente o desejado:
--
--   · todo link de álbum já espalhado continua abrindo o álbum, e para de
--     abrir o SOS;
--   · todo link de acompanhante já espalhado PARA DE FUNCIONAR, e ela precisa
--     mandar o novo para quem ela designar.
--
-- Quebrar os links de acompanhante é o preço, e é o certo a pagar: são poucos
-- (um por paciente, mandado a uma pessoa), e o que está do outro lado é a
-- localização dela numa emergência.
-- ═════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.companion_invites
  ADD COLUMN IF NOT EXISTS album_token text;

-- ─────────────────────────────────────────────────────────────────────────────
-- A ROTAÇÃO. Só nas linhas que ainda não passaram por ela — é o que torna este
-- arquivo idempotente: rodar de novo não gera tokens novos nem quebra links
-- que já foram redistribuídos.
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE public.companion_invites
SET
  -- O token antigo VIRA o do álbum: os links já espalhados continuam abrindo o
  -- álbum, agora sem o SOS junto.
  album_token = token,
  -- E o de acompanhante passa a ser outro. `gen_random_uuid()` duas vezes para
  -- o mesmo comprimento dos demais tokens do app (32 hex).
  token = replace(gen_random_uuid()::text, '-', '') ||
          left(replace(gen_random_uuid()::text, '-', ''), 0)
WHERE album_token IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS companion_invites_album_token
  ON public.companion_invites (album_token) WHERE album_token IS NOT NULL;

COMMENT ON COLUMN public.companion_invites.album_token IS
  'Token de MENOR privilégio: abre só o álbum do bebê. É o que vai no link que '
  'ela manda para o grupo da família. O `token` (maior privilégio) abre o '
  'painel do acompanhante E os SOS recentes — e só vai para quem ela designar.';

-- ─────────────────────────────────────────────────────────────────────────────
-- CONFERÊNCIA. As três linhas têm que voltar `true`.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  EXISTS (SELECT 1 FROM information_schema.columns
          WHERE table_name = 'companion_invites' AND column_name = 'album_token')
                                                                        AS coluna_ok,
  NOT EXISTS (SELECT 1 FROM public.companion_invites WHERE album_token IS NULL)
                                                                        AS rotacao_ok,
  NOT EXISTS (SELECT 1 FROM public.companion_invites WHERE album_token = token)
                                                                        AS separados_ok;
