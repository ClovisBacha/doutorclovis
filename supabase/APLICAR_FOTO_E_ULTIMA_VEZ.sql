-- ═════════════════════════════════════════════════════════════════════════════
-- APLICAR_FOTO_E_ULTIMA_VEZ.sql — o "apareceu há 2h" da lista de amigas.
-- Idempotente: rode quantas vezes quiser.
--
-- ─── POR QUE ─────────────────────────────────────────────────────────────────
--
-- A referência da aba Amigas mostra, em cada linha, uma FOTO da amiga e um
-- status ("Online", "Há 2h", "Offline"). A primeira versão da tela substituiu
-- os dois em silêncio: todas as amigas com a mesma bolha genérica e sem linha
-- de status.
--
-- O resultado é o que o dono viu — uma lista em que todo mundo é igual. Não era
-- um problema de layout: eram dois DADOS, e trocá-los por um genérico sem
-- avisar foi o erro.
--
-- ─── ⚠️ A FOTO JÁ EXISTIA, E EU QUASE CONSTRUÍ UMA SEGUNDA ───────────────────
--
-- Este arquivo criava um balde `avatares` com RLS por pasta, e escrevi a
-- justificativa inteira antes de conferir. `patient_profiles.avatar_url` está
-- na PRIMEIRA migration do projeto (20260607050155), e o app já a preenche em
-- dois lugares: o campo de foto do Perfil e o ritual de boas-vindas. O formato
-- não é URL de balde — é uma DATA URL (JPEG reduzido a 256px pelo canvas, ver
-- `handleAvatar` em `minha-conta.tsx`).
--
-- Um balde que nada escreve é infraestrutura morta com política de segurança
-- para manter, e a foto continuaria vindo de onde sempre veio. O que faltava
-- não era guardar a foto: era a aba das Amigas LER a coluna — que agora ela lê
-- (`minhasAmigas` e `perfilDaAmiga` em `amigas.functions.ts`).
--
-- Fica só o `ADD COLUMN IF NOT EXISTS` abaixo, como rede para um banco antigo
-- que por algum motivo não a tenha. É no-op no banco de produção.
--
-- ─── O "APARECEU HÁ 2H" ──────────────────────────────────────────────────────
--
-- `last_seen_at` é carimbado quando ela abre o app (`carimbarQueApareceu`,
-- chamada de `minha-conta.tsx`, no máximo uma vez por hora). A tela mostra
-- "há 2h", "ontem", "há 5 dias" — nunca "Online".
--
-- ⚠️ "ONLINE" SERIA MENTIRA. Presença ao vivo exige conexão persistente
-- (websocket/realtime), e o app não tem nenhuma. Um ponto verde que na verdade
-- diz "abriu o app nos últimos 5 minutos" é o tipo de dado que parece exato e
-- não é — e numa aba onde uma amiga espera resposta da outra, "ela está online
-- e não me respondeu" é uma conclusão que o app não pode induzir.
--
-- ⚠️ E NULL NÃO VIRA "OFFLINE". Quem nunca abriu desde que a coluna existe não
-- tem última vez, e a linha simplesmente não aparece (a lista mostra o "no app
-- há X", que sempre existiu). Inventar um "Offline" seria o app afirmando um
-- comportamento que ele não observou.
-- ═════════════════════════════════════════════════════════════════════════════

-- ── 1. A foto — rede para banco antigo; no-op no de produção ────────────────
ALTER TABLE public.patient_profiles
  ADD COLUMN IF NOT EXISTS avatar_url text;

COMMENT ON COLUMN public.patient_profiles.avatar_url IS
  'Foto de perfil como DATA URL (JPEG 256px, reduzida no navegador). NULL = avatar com a inicial do nome.';

-- ── 2. A última vez que apareceu ────────────────────────────────────────────
ALTER TABLE public.patient_profiles
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;

COMMENT ON COLUMN public.patient_profiles.last_seen_at IS
  'Quando ela abriu o app pela última vez. Vira "há 2h" na lista de amigas — nunca "Online".';

-- A lista de amigas lê por isto.
CREATE INDEX IF NOT EXISTS patient_profiles_last_seen
  ON public.patient_profiles (last_seen_at DESC NULLS LAST);
