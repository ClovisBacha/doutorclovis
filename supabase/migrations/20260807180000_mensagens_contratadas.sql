-- ─────────────────────────────────────────────────────────────────────────────
-- A QUANTIDADE DE MENSAGENS QUE O MÉDICO COMPROU
--
-- A escada de planos passou a ter UM eixo só: mensagens de IA por mês
-- (`src/lib/planos-medico.ts`). Entrada R$ 29,90 = 150 mensagens; faixas
-- graduadas de R$ 0,15 / 0,12 / 0,09; topo R$ 295,40 = 2.500. Acima disso é
-- contrato de Clínica.
--
-- Isso significa que o plano deixou de ser um NOME (`pro`, `elite`, `black`) e
-- passou a ser um NÚMERO — a quantidade comprada no Stripe, que o webhook lê de
-- `subscription.items.data[0].quantity`.
--
-- ─── POR QUE ESTA COLUNA PRECISA EXISTIR ANTES DE QUALQUER OUTRA COISA ───────
--
-- Uma auditoria mediu o que acontece sem ela: o checkout manda a compra, o
-- webhook recebe `plan: "mensagens"`, `normalizePlan` não conhece esse nome e
-- devolve `"free"` — o médico **paga R$ 295,40 e recebe o plano grátis**, sem
-- erro em lugar nenhum, e o webhook responde 200 para o Stripe, que nunca
-- reenvia. É silencioso dos dois lados.
--
-- ─── NULL É "NÃO COMPROU", E ISSO IMPORTA ───────────────────────────────────
--
-- Sem DEFAULT de propósito. `NULL` significa "este médico não tem plano de
-- mensagens" — o que é verdade para todo mundo até o primeiro checkout novo, e
-- continua sendo verdade para quem está no Free.
--
-- O leitor (`cota-ia.server.ts`) já foi ajustado para tratar teto 0/ausente como
-- `estourada`, e não como `ok`. Essa ordem é a que importa: se a coluna
-- chegasse antes daquele conserto, todo médico sem linha nela cairia num
-- fail-open — cérebro liberado sem limite nenhum.
--
-- A FAIXA (CHECK) existe porque a quantidade vem de fora. O Stripe é confiável,
-- mas `items.data[0].quantity` é um número que atravessa a rede e um webhook
-- que qualquer um pode tentar POSTar; um valor absurdo aqui vira mesada de
-- Sementinhas absurda e cota infinita. O teto do CHECK é generoso (20.000, oito
-- vezes o topo do autoatendimento) para não brigar com um contrato de Clínica
-- provisionado à mão.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS ai_messages_per_cycle integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'doctors_ai_messages_faixa'
  ) THEN
    ALTER TABLE public.doctors
      ADD CONSTRAINT doctors_ai_messages_faixa
      CHECK (ai_messages_per_cycle IS NULL
             OR (ai_messages_per_cycle >= 0 AND ai_messages_per_cycle <= 20000));
  END IF;
END $$;

COMMENT ON COLUMN public.doctors.ai_messages_per_cycle IS
  'Mensagens de IA por ciclo que o médico comprou no Stripe (quantity do item). '
  'NULL = não comprou. É a fonte do teto da cota e do tamanho da mesada de '
  'Sementinhas. Ver src/lib/planos-medico.ts.';
