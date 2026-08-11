-- ═════════════════════════════════════════════════════════════════════════════
-- APLICAR_STRIPE_MEDICO.sql — o que falta no BANCO para o plano do médico
-- funcionar. Idempotente: rode quantas vezes quiser.
--
-- ─── POR QUE ESTE ARQUIVO EXISTE ─────────────────────────────────────────────
--
-- A coluna abaixo nasceu em `supabase/migrations/20260807180000_mensagens_
-- contratadas.sql`. Só que o combinado deste projeto é que o dono aplica os
-- `APLICAR_*.sql` — e não havia nenhum para ela. Resultado: a coluna existe no
-- repositório e provavelmente NÃO existe em produção.
--
-- E isso derruba a compra inteira, de um jeito que não parece um erro de banco.
-- O webhook do Stripe faz, em `applySubscription`:
--
--     .from("doctors").update({ plan, active, plan_expires_at,
--                               ai_messages_per_cycle: mensagens })
--
-- Sem a coluna, o PostgREST recusa o UPDATE (PGRST204 / 42703). O `gravar()`
-- do webhook LANÇA nesse caso — o que está certo, é falha fechada —, o
-- endpoint devolve erro, e o Stripe fica reentregando o evento para sempre.
--
-- O médico paga, o cartão passa, a Stripe mostra a assinatura ativa, e no app
-- ele continua no `free`. Não há tela de erro em lugar nenhum: o que falha é o
-- webhook, que ninguém olha.
--
-- ─── NULL É "NÃO COMPROU", E ISSO IMPORTA ────────────────────────────────────
--
-- Sem DEFAULT de propósito. `NULL` quer dizer "este médico não tem plano de
-- mensagens" — verdade para todo mundo até o primeiro checkout, e verdade para
-- sempre para quem fica no Free. O leitor da cota trata teto ausente como
-- ESTOURADA, nunca como ilimitada: falha fechada dos dois lados.
--
-- ─── O CHECK EXISTE PORQUE O NÚMERO VEM DE FORA ──────────────────────────────
--
-- A quantidade chega em `items.data[0].quantity`, atravessando a rede, num
-- endpoint que qualquer um pode tentar POSTar. Um valor absurdo aqui vira cota
-- infinita e mesada de Sementinhas absurda. O teto de 20.000 é generoso de
-- propósito — oito vezes o topo do autoatendimento (11.100) — para não brigar
-- com um contrato de Clínica provisionado à mão.
-- ═════════════════════════════════════════════════════════════════════════════

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

-- ─────────────────────────────────────────────────────────────────────────────
-- CONFERÊNCIA. Rode e leia o resultado: as três linhas têm que voltar `true`.
-- Se alguma voltar `false`, a compra do médico não vai completar.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  EXISTS (SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'doctors'
            AND column_name = 'ai_messages_per_cycle')            AS coluna_mensagens_ok,
  EXISTS (SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'subscriptions')
                                                                  AS tabela_subscriptions_ok,
  EXISTS (SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'doctors'
            AND column_name = 'plan_expires_at')                  AS coluna_validade_ok;
