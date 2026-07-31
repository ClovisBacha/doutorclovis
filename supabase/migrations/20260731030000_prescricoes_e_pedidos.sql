-- ============================================================================
-- PRESCRIÇÕES E PEDIDOS DE EXAME — o que o médico emite
-- ============================================================================
--
-- A aba "Ferramentas" do painel tem receituário e painéis de exame prontos:
-- ~1.150 linhas de UI escritas. E ela faz duas coisas — copiar para a área de
-- transferência e imprimir. Não grava, não tem paciente, não entrega.
--
-- O resultado é que a receita existe só no papel que ela leva, o pedido de
-- exame idem, e o sistema — que tem a caixa de entrada onde o laudo volta —
-- nunca soube que o exame foi pedido. O ciclo tem começo e fim e falta o meio.
--
-- Uma tabela só para as três coisas (`prescricao`, `exame`, `orientacao`)
-- porque são o mesmo ato do ponto de vista do produto: o médico escreve algo
-- para ELA e isso precisa ficar registrado e chegar. Separar em três tabelas
-- criaria três telas, três consultas e três lugares para ela olhar.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.doctor_orders (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id  uuid        NOT NULL,
  user_id    uuid        NOT NULL,
  kind       text        NOT NULL CHECK (kind IN ('prescricao', 'exame', 'orientacao')),
  titulo     text        NOT NULL,
  -- O corpo: os medicamentos, a lista de exames, ou a orientação.
  conteudo   text        NOT NULL,
  -- Recado curto para ela, quando o corpo é técnico demais para servir sozinho.
  nota       text,
  -- Vínculo com a consulta em que foi emitido, quando houve uma.
  consultation_id uuid,

  /* CUMPRIDO — e é ELA quem marca.

     Um pedido de exame que ninguém fecha vira uma lista que só cresce, e o
     médico perde a única informação que importa depois de pedir: ela fez ou
     não fez? Marcar do lado dele seria adivinhação; do lado dela é o fato. */
  cumprido_em timestamptz,

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_paciente
    ON public.doctor_orders (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_medico
    ON public.doctor_orders (doctor_id, created_at DESC);
-- Os pendentes são a pergunta frequente ("o que eu pedi e ela ainda não fez?").
CREATE INDEX IF NOT EXISTS idx_orders_pendentes
    ON public.doctor_orders (doctor_id, created_at DESC)
    WHERE cumprido_em IS NULL;

DO $fks$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.doctor_orders'::regclass
       AND conname = 'doctor_orders_user_id_fkey'
  ) THEN
    ALTER TABLE public.doctor_orders
      ADD CONSTRAINT doctor_orders_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END
$fks$;

ALTER TABLE public.doctor_orders ENABLE ROW LEVEL SECURITY;

/* AQUI A PACIENTE LÊ, e é diferente de `consultations` de propósito.

   O prontuário tem campos que não são para ela — por isso aquela tabela ficou
   fechada e o resumo sai por server function. Uma receita não tem esse
   problema: ela foi ESCRITA para ela, é o documento que ela leva à farmácia e
   ao laboratório. Fechar seria esconder da paciente o que é dela.

   Ela também ATUALIZA, para poder marcar "já fiz" — mas só a própria linha, e o
   `WITH CHECK` impede que ela mexa em `user_id` para alcançar a de outra. */
DROP POLICY IF EXISTS "paciente le os proprios pedidos" ON public.doctor_orders;
CREATE POLICY "paciente le os proprios pedidos" ON public.doctor_orders
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "paciente marca como cumprido" ON public.doctor_orders;
CREATE POLICY "paciente marca como cumprido" ON public.doctor_orders
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "servico gerencia pedidos" ON public.doctor_orders;
CREATE POLICY "servico gerencia pedidos" ON public.doctor_orders
  FOR ALL TO service_role USING (true) WITH CHECK (true);

/* GRANT por COLUNA no UPDATE: ela pode marcar que fez, e não reescrever a
   receita. Sem isto a policy de UPDATE deixaria a paciente trocar a posologia
   do próprio medicamento — e o médico veria o texto alterado como se fosse o
   dele. É o mesmo cuidado que `trg_protect_doctor_id` faz em patient_profiles,
   pela via do privilégio em vez do gatilho. */
REVOKE ALL ON public.doctor_orders FROM anon, authenticated;
GRANT SELECT ON public.doctor_orders TO authenticated;
GRANT UPDATE (cumprido_em) ON public.doctor_orders TO authenticated;
GRANT ALL ON public.doctor_orders TO service_role;

COMMENT ON TABLE public.doctor_orders IS
  'Receitas, pedidos de exame e orientacoes que o medico emite para a paciente. Ela le e pode marcar como cumprido (GRANT por coluna: so `cumprido_em`).';
