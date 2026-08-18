-- ═════════════════════════════════════════════════════════════════════════════
-- APLICAR_CHA_DE_BEBE.sql — a lista de presentes e o chá de bebê.
-- Idempotente: rode quantas vezes quiser.
--
-- ─── O QUE É ─────────────────────────────────────────────────────────────────
--
-- A paciente monta uma lista, manda o link, e as amigas RESERVAM o que vão dar.
-- Fralda por tamanho, cota de item caro, recado em áudio, presente que só se
-- revela num momento marcado, e o agradecimento depois.
--
-- As réguas (metas de fralda, tetos, divisão de cotas, ordem da lista, texto do
-- agradecimento) moram em `src/lib/fraldas.ts`, `cotas.ts`, `presentes.ts` e
-- `agradecimento.ts`, todas testadas sem banco. Aqui ficam só as garantias que
-- o banco tem de dar.
--
-- ─── ⚠️ NÃO HÁ DINHEIRO PASSANDO POR AQUI ────────────────────────────────────
--
-- Uma reserva é uma PROMESSA ("eu vou dar isto"), não uma transação. Cota de
-- R$ 100 é uma promessa combinada por fora, exatamente como já acontece num chá
-- de verdade — o app CONTA, não cobra.
--
-- Isso dispensa, de uma vez: merchant of record de produto físico, endereço da
-- paciente (que não existe em `patient_profiles` e é decisão de LGPD à parte),
-- estorno, e a armadilha documentada de `createOneTimeCheckout` cravar
-- `metadata[product] = 'sementinhas'` — reusá-lo sem parametrizar faria o
-- webhook creditar moeda em vez de registrar presente.
--
-- ─── ⚠️ TRÊS TABELAS, E O SALDO NÃO É COLUNA DE NENHUMA ──────────────────────
--
-- Quanto já foi reservado de um item é `SUM(quantidade) WHERE cancelada_em IS
-- NULL`, lido no servidor. Contador materializado é o defeito que vira "faltam
-- 3 M" numa tela e "faltam 5 M" na outra na primeira corrida — e não há trigger
-- que o segure sem duplicar a régua fora de `lib/`. É a mesma lição do troféu
-- contar o LEDGER e não `doneDays`.
-- ═════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. A LISTA — uma por paciente.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.presente_listas (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- UNIQUE: duas listas circulando é a garantia de metade das amigas reservar
  -- na errada, e a dona nunca saber por quê.
  user_id     uuid NOT NULL UNIQUE REFERENCES auth.users ON DELETE CASCADE,
  -- ⚠️ Gerado no SERVIDOR, nunca derivado do user_id. Um token previsível
  -- deixaria qualquer um enumerar a lista de qualquer gestante.
  --
  -- ⚠️ E é um token PRÓPRIO, nunca o de `companion_invites`. Aquele abre TRÊS
  -- portas — o álbum, o painel do acompanhante e os SOS dos últimos 30 minutos
  -- (`getRecentPanicByToken`, com latitude e longitude). Reusá-lo faria o link
  -- do chá de bebê, que ela manda para o grupo do trabalho, abrir junto o
  -- painel de emergência dela.
  token       text NOT NULL UNIQUE,
  titulo      text,
  recado      text,
  data_do_cha date,
  aberta      boolean NOT NULL DEFAULT true,
  criada_em   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS presente_listas_token ON public.presente_listas (token);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. OS ITENS.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.presente_itens (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lista_id       uuid NOT NULL REFERENCES public.presente_listas ON DELETE CASCADE,
  tipo           text NOT NULL CHECK (tipo IN ('item','fralda','cota')),
  titulo         text NOT NULL,
  nota           text,
  ordem          integer NOT NULL DEFAULT 0,

  tamanho        text CHECK (tamanho IN ('RN','P','M','G','XG')),

  -- Meta em UNIDADES do tipo: item→peças, fralda→PACOTES, cota→cotas.
  meta           integer NOT NULL DEFAULT 1 CHECK (meta > 0),

  -- ⚠️ `teto` É O RECURSO DAS FRALDAS, e por isso é coluna separada de `meta`.
  -- `meta` é "quanto eu quero"; `teto` é "acima disto o servidor RECUSA".
  -- Em RN, meta 4 e teto 6. Sem o teto, a lista mostra "RN completo" e a
  -- próxima amiga reserva RN assim mesmo — o erro universal do chá de bebê
  -- reproduzido com um contador bonito por cima.
  teto           integer CHECK (teto IS NULL OR teto >= meta),

  -- Dinheiro em CENTAVOS INTEIROS, nunca numeric/float (ver src/lib/dinheiro.ts).
  centavos_total integer CHECK (centavos_total IS NULL OR centavos_total > 0),

  -- ⚠️ `arquivado`, nunca DELETE: apagar um item já reservado apaga a promessa
  -- de alguém e deixa o agradecimento com um buraco que ninguém explica.
  arquivado      boolean NOT NULL DEFAULT false,
  criado_em      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT fralda_tem_tamanho CHECK (tipo <> 'fralda' OR tamanho IS NOT NULL),
  CONSTRAINT cota_tem_valor     CHECK (tipo <> 'cota'   OR centavos_total IS NOT NULL)
);

-- Um cartão por tamanho de fralda. Dois cartões de "M" na mesma lista fazem
-- dois contadores independentes, cada um dizendo que falta metade.
CREATE UNIQUE INDEX IF NOT EXISTS presente_itens_fralda_unica
  ON public.presente_itens (lista_id, tamanho) WHERE tipo = 'fralda';
CREATE INDEX IF NOT EXISTS presente_itens_lista ON public.presente_itens (lista_id, ordem);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. AS RESERVAS — quem prometeu o quê.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.presente_reservas (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id        uuid NOT NULL REFERENCES public.presente_itens ON DELETE CASCADE,
  -- Redundante com o item, e de propósito: a leitura da dona filtra por lista
  -- sem passar por `presente_itens`, e o índice parcial de revelação também.
  lista_id       uuid NOT NULL REFERENCES public.presente_listas ON DELETE CASCADE,

  -- ⚠️ Texto livre de terceiro SEM CONTA. Sanitizado em
  -- `sanitizarNomeDeQuemDeu` antes de gravar, e nunca renderizado como HTML.
  quem_nome      text NOT NULL,
  -- NULL é o caso comum: a amiga do trabalho não tem conta no app e não vai
  -- criar uma para reservar uma fralda.
  quem_user_id   uuid REFERENCES auth.users ON DELETE SET NULL,
  -- Como ela volta para editar ou cancelar sem login.
  token_reserva  text NOT NULL UNIQUE,

  quantidade     integer NOT NULL DEFAULT 1 CHECK (quantidade > 0),
  recado         text,

  -- O recado de voz. Caminho no balde privado `presentes`.
  audio_path     text,
  audio_segundos integer CHECK (audio_segundos IS NULL OR audio_segundos <= 90),

  -- O presente que chega num momento marcado.
  revelar_em     date,
  revelada_em    timestamptz,

  agradecida_em  timestamptz,

  -- ⚠️ Cancelar MARCA, nunca apaga: o agradecimento e o contador precisam
  -- saber que houve e voltou.
  cancelada_em   timestamptz,
  criada_em      timestamptz NOT NULL DEFAULT now(),

  -- ⚠️ Idempotência por INTENÇÃO, o mesmo desenho de `tokenDePresente`: token
  -- nascido no navegador, um por clique. Sem ele, o toque nervoso da amiga na
  -- rede ruim reserva duas cotas do carrinho. Achar a linha é SUCESSO
  -- REPETIDO, não erro — mesma lição já documentada do presente do médico.
  idem_key       text
);

CREATE UNIQUE INDEX IF NOT EXISTS presente_reservas_idem
  ON public.presente_reservas (item_id, idem_key) WHERE idem_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS presente_reservas_item
  ON public.presente_reservas (item_id) WHERE cancelada_em IS NULL;
CREATE INDEX IF NOT EXISTS presente_reservas_lista
  ON public.presente_reservas (lista_id) WHERE cancelada_em IS NULL;
-- A consulta que o cron roda todo dia. Sem o índice ele varre a tabela inteira.
CREATE INDEX IF NOT EXISTS presente_reservas_revelar
  ON public.presente_reservas (revelar_em)
  WHERE revelar_em IS NOT NULL AND revelada_em IS NULL AND cancelada_em IS NULL;

-- ═════════════════════════════════════════════════════════════════════════════
-- RLS
--
-- ⚠️ **NÃO COPIE A POLÍTICA DE `companion_invites`.** Aquela tabela tem uma
-- policy de leitura pública por token que dá SELECT ao papel `anon`. Um `anon`
-- que possa varrer `presente_listas` lê a lista — e o token — de toda gestante
-- da plataforma, e daí a lista de quem é próximo de cada uma.
--
-- Aqui: a DONA gerencia o que é dela, o service role faz o resto, e `anon` não
-- tem política nenhuma. Quem lê por token é SEMPRE server function com
-- `supabaseAdmin`, como `getAlbumByToken` já faz.
-- ═════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.presente_listas   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presente_itens    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presente_reservas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Dona gerencia a própria lista" ON public.presente_listas;
CREATE POLICY "Dona gerencia a própria lista" ON public.presente_listas
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service manages presente_listas" ON public.presente_listas;
CREATE POLICY "Service manages presente_listas" ON public.presente_listas
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Dona gerencia os próprios itens" ON public.presente_itens;
CREATE POLICY "Dona gerencia os próprios itens" ON public.presente_itens
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.presente_listas l
            WHERE l.id = lista_id AND l.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.presente_listas l
            WHERE l.id = lista_id AND l.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Service manages presente_itens" ON public.presente_itens;
CREATE POLICY "Service manages presente_itens" ON public.presente_itens
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- ⚠️ A dona LÊ as reservas — e NÃO escreve nelas.
--
-- Sem esse recorte, o navegador dela governaria `revelar_em` (podendo revelar
-- hoje o presente que a avó marcou para a 36ª semana) e `quantidade` (mudando
-- o que a amiga prometeu). Marcar como agradecida é a única escrita que ela
-- precisa, e passa pelo servidor.
DROP POLICY IF EXISTS "Dona lê as reservas dela" ON public.presente_reservas;
CREATE POLICY "Dona lê as reservas dela" ON public.presente_reservas
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.presente_listas l
            WHERE l.id = lista_id AND l.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Service manages presente_reservas" ON public.presente_reservas;
CREATE POLICY "Service manages presente_reservas" ON public.presente_reservas
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- ═════════════════════════════════════════════════════════════════════════════
-- O BALDE DO ÁUDIO — privado, sem policy nenhuma.
--
-- Mesmo desenho de `album` e `exames`: `public = false` e ZERO policies de
-- storage. Quem entrega o arquivo é o servidor, por URL assinada de 1 hora
-- (`urlAssinada` em `src/lib/imagens.server.ts`), e o caminho passa por
-- `pastaDoDono` — sha256 do uuid, para a URL não revelar quem é a paciente.
-- ═════════════════════════════════════════════════════════════════════════════
INSERT INTO storage.buckets (id, name, public)
VALUES ('presentes', 'presentes', false)
ON CONFLICT (id) DO UPDATE SET public = false;

COMMENT ON TABLE public.presente_listas IS
  'Lista de presentes / chá de bebê. Uma por paciente. O token é PRÓPRIO — '
  'nunca o de companion_invites, que abre também o painel de SOS. '
  'Régua em src/lib/presentes.ts.';

COMMENT ON TABLE public.presente_itens IS
  'Itens da lista. `tipo` = item | fralda | cota. `teto` é o que impede o erro '
  'universal do chá (sobra RN, falta M e G) — ver src/lib/fraldas.ts.';

COMMENT ON TABLE public.presente_reservas IS
  'Quem prometeu o quê. Reserva é PROMESSA, não transação — não há dinheiro '
  'passando por aqui. O saldo de um item é SUM(quantidade) das vivas, nunca '
  'uma coluna.';

-- ─────────────────────────────────────────────────────────────────────────────
-- CONFERÊNCIA. As seis linhas têm que voltar `true`.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  EXISTS (SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'presente_listas')    AS listas_ok,
  EXISTS (SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'presente_itens')     AS itens_ok,
  EXISTS (SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'presente_reservas')  AS reservas_ok,
  EXISTS (SELECT 1 FROM pg_indexes
          WHERE schemaname = 'public' AND indexname = 'presente_itens_fralda_unica')
                                                                               AS fralda_unica_ok,
  EXISTS (SELECT 1 FROM pg_indexes
          WHERE schemaname = 'public' AND indexname = 'presente_reservas_idem')
                                                                               AS idempotencia_ok,
  EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'presentes' AND public = false)
                                                                               AS balde_ok;
