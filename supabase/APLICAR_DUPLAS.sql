-- ═════════════════════════════════════════════════════════════════════════════
-- APLICAR_DUPLAS.sql — a dupla de sequência entre duas pacientes.
-- Idempotente: rode quantas vezes quiser.
--
-- ─── O QUE É ─────────────────────────────────────────────────────────────────
--
-- Duas pacientes seguram uma chama JUNTAS: o dia só conta para a dupla se as
-- DUAS fizeram alguma coisa. É a versão cooperativa do streak — e a escolha de
-- ser cooperativa, e não um ranking, é clínica antes de ser de produto.
--
-- Num app de idioma, comparar é inofensivo: quem faz mais lições ganhou um
-- jogo. Aqui, comparar é comparar cuidado com o próprio bebê, e num público de
-- gestação de alto risco isso não motiva — culpa. Por isso não existe placar,
-- não existe "você está atrás", e ninguém perde nada por causa da outra: a
-- chama da dupla é um bônus que aparece, nunca uma dívida que cobra.
--
-- ─── POR QUE UMA TABELA, E NÃO O `journey_state` ─────────────────────────────
--
-- A dupla é um acordo entre DUAS contas. O `journey_state` é um blob escrito
-- pelo navegador de UMA delas — nele, qualquer paciente poderia se declarar
-- dupla de qualquer outra, e a outra descobriria depois. Convite e aceite
-- precisam de um lugar que as duas enxergam e nenhuma das duas escreve
-- sozinha.
--
-- ─── O PAR É ORDENADO, E ISSO É O QUE IMPEDE DUPLICATA ───────────────────────
--
-- `menor`/`maior` guardam os dois uuids em ordem, então (A,B) e (B,A) são a
-- MESMA linha e o índice único recusa a segunda. Sem essa normalização, duas
-- convidando uma à outra ao mesmo tempo criariam duas duplas entre as mesmas
-- pessoas, e cada tela leria a sua.
--
-- `quem_convidou` fica à parte justamente porque o par perdeu a ordem: é ele
-- que diz de quem é o convite, e é por ele que a outra vê "Fulana te convidou"
-- em vez de um pedido sem remetente.
-- ═════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.duplas (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  menor         uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  maior         uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  quem_convidou uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  aceita        boolean NOT NULL DEFAULT false,
  criada_em     timestamptz NOT NULL DEFAULT now(),
  aceita_em     timestamptz,
  -- Guarda de sanidade: par sempre ordenado, e nunca consigo mesma.
  CONSTRAINT duplas_par_ordenado CHECK (menor < maior)
);

-- Uma dupla por PAR. É o que faz "convidar de novo" ser reenvio e não uma
-- segunda linha que a outra tela nunca vê.
CREATE UNIQUE INDEX IF NOT EXISTS duplas_par ON public.duplas (menor, maior);
CREATE INDEX IF NOT EXISTS duplas_menor ON public.duplas (menor);
CREATE INDEX IF NOT EXISTS duplas_maior ON public.duplas (maior);

-- ─────────────────────────────────────────────────────────────────────────────
-- UMA DUPLA ATIVA POR PESSOA.
--
-- Índice parcial sobre as ACEITAS. Duas duplas simultâneas transformariam a
-- chama compartilhada num placar de várias frentes — que é exatamente o
-- desenho competitivo que este arquivo existe para não ter. Convites pendentes
-- podem ser vários; compromisso, um só.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS duplas_uma_por_menor
  ON public.duplas (menor) WHERE aceita;
CREATE UNIQUE INDEX IF NOT EXISTS duplas_uma_por_maior
  ON public.duplas (maior) WHERE aceita;

ALTER TABLE public.duplas ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS: a paciente LÊ as duplas de que participa, e nada mais.
--
-- Escrita nenhuma pelo cliente. Convite, aceite e desfazer passam por
-- `amigas.functions.ts`, que confere o vínculo de amizade antes — o navegador
-- não pode criar uma dupla com quem ela nunca convidou.
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Paciente vê as duplas dela" ON public.duplas;
CREATE POLICY "Paciente vê as duplas dela" ON public.duplas
  FOR SELECT USING (auth.uid() = menor OR auth.uid() = maior);

DROP POLICY IF EXISTS "Service manages duplas" ON public.duplas;
CREATE POLICY "Service manages duplas" ON public.duplas
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

COMMENT ON TABLE public.duplas IS
  'Dupla de sequência: duas pacientes seguram uma chama compartilhada. O par é '
  'ordenado (menor<maior) para (A,B) e (B,A) serem a mesma linha. Uma dupla '
  'ACEITA por pessoa (índices parciais). Ver src/lib/amigas.ts.';

-- ─────────────────────────────────────────────────────────────────────────────
-- CONFERÊNCIA. As quatro linhas têm que voltar `true`.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  EXISTS (SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'duplas')      AS tabela_ok,
  EXISTS (SELECT 1 FROM pg_indexes
          WHERE schemaname = 'public' AND indexname = 'duplas_par')     AS indice_par_ok,
  EXISTS (SELECT 1 FROM pg_indexes
          WHERE schemaname = 'public' AND indexname = 'duplas_uma_por_menor')
                                                                        AS uma_por_pessoa_ok,
  EXISTS (SELECT 1 FROM pg_constraint
          WHERE conname = 'duplas_par_ordenado')                        AS par_ordenado_ok;
