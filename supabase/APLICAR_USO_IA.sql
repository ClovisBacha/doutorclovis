-- ════════════════════════════════════════════════════════════════════════════
-- APLICAR NO SQL EDITOR DO SUPABASE — medição de uso de IA
--
-- Idempotente: pode rodar mais de uma vez.
-- ════════════════════════════════════════════════════════════════════════════
--
-- POR QUE ESTA TABELA EXISTE
--
-- Toda decisão de preço da plataforma depende de uma pergunta que hoje ninguém
-- sabe responder: quanto custa uma resposta da IA, e quantas respostas um
-- médico consome por mês. Sem isso, "1.000 mensagens por R$49,90" é chute — e
-- chute em preço vira margem negativa que só aparece na fatura do trimestre.
--
-- O que se grava aqui são os tokens que o PRÓPRIO modelo reportou, não uma
-- estimativa: o `usage` que volta da chamada.
--
-- ─── A decisão que parece detalhe: guardar TOKEN, não REAL ──────────────────
--
-- É tentador gravar o custo em centavos e pronto. Mas o preço do token muda, o
-- câmbio muda e o modelo muda — e um custo gravado congela a conta de hoje num
-- número que estará errado no mês que vem, sem ninguém perceber que envelheceu.
--
-- Token é fato; real é interpretação. Guardamos o fato e a interpretação é
-- feita na leitura, com a tabela de preços vigente.
--
-- ─── Por que também se grava a chamada de MEMÓRIA ───────────────────────────
--
-- Cada mensagem da paciente dispara até três chamadas: o embedding da pergunta,
-- a conversa em si, e — a cada 6 mensagens — a regeneração da memória dela, que
-- manda 40 mensagens de histórico ao modelo. Essa terceira é invisível no
-- produto e some numa medição ingênua, mas responde por cerca de 20% da conta.

CREATE TABLE IF NOT EXISTS public.ai_usage (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now() NOT NULL,
  -- Quem paga. Nulo quando a conversa é do site público (sem médico envolvido).
  doctor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  -- Quem consumiu. `ON DELETE SET NULL` e não CASCADE: apagar a conta da
  -- paciente é direito dela (LGPD) e não pode apagar o CUSTO que já foi pago —
  -- senão o histórico financeiro muda retroativamente toda vez que alguém sai.
  patient_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  -- 'chat' = a resposta que a paciente leu · 'memoria' = o resumo interno.
  especie text NOT NULL CHECK (especie IN ('chat', 'memoria', 'embedding')),
  -- 'app' | 'site' | 'whatsapp' — de onde veio.
  -- 'app'     = conversa clínica (consome o plano do médico)
  -- 'suporte' = pergunta sobre o aplicativo — é da plataforma, não dele
  -- 'site'    = visitante anônimo
  canal text NOT NULL DEFAULT 'app',
  modelo text NOT NULL,
  input_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0
);

-- As três leituras que interessam: por médico, por período, por espécie.
CREATE INDEX IF NOT EXISTS ai_usage_doctor_idx ON public.ai_usage (doctor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_usage_data_idx ON public.ai_usage (created_at DESC);

ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;

-- Só o serviço. A linha liga médico a paciente e a volume de conversa — é
-- dado de negócio E de relacionamento clínico. O médico verá o AGREGADO dele
-- por uma função no servidor, nunca as linhas.
DROP POLICY IF EXISTS "Servico administra uso de ia" ON public.ai_usage;
CREATE POLICY "Servico administra uso de ia"
  ON public.ai_usage FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

GRANT ALL ON public.ai_usage TO service_role;

-- ════════════════════════════════════════════════════════════════════════════
-- CONSULTAS PRONTAS — cole no SQL Editor quando quiser olhar
-- ════════════════════════════════════════════════════════════════════════════
--
-- Preços de referência (Gemini 2.5 Flash, USD por 1M de tokens) e câmbio ficam
-- AQUI, na consulta, e não gravados na tabela — mude os três números e todo o
-- histórico se recalcula com o preço novo.
--
--   WITH preco AS (SELECT 0.30::numeric AS entrada, 2.50::numeric AS saida,
--                         5.80::numeric AS dolar)
--   SELECT
--     date_trunc('month', u.created_at) AS mes,
--     u.doctor_id,
--     count(*) FILTER (WHERE u.especie = 'chat')     AS respostas,
--     count(*) FILTER (WHERE u.especie = 'memoria')  AS resumos,
--     sum(u.input_tokens)                            AS entrada,
--     sum(u.output_tokens)                           AS saida,
--     round(((sum(u.input_tokens)  / 1e6 * p.entrada)
--          + (sum(u.output_tokens) / 1e6 * p.saida)) * p.dolar, 2) AS custo_reais,
--     round((((sum(u.input_tokens)  / 1e6 * p.entrada)
--           + (sum(u.output_tokens) / 1e6 * p.saida)) * p.dolar)
--           / NULLIF(count(*) FILTER (WHERE u.especie = 'chat'), 0), 4)
--                                                    AS custo_por_resposta
--   FROM public.ai_usage u, preco p
--   GROUP BY 1, 2, p.entrada, p.saida, p.dolar
--   ORDER BY 1 DESC, custo_reais DESC;
--
-- E a distribuição que decide o tamanho do plano — quantas respostas cada
-- PACIENTE consome por mês:
--
--   SELECT date_trunc('month', created_at) AS mes,
--          percentile_disc(0.50) WITHIN GROUP (ORDER BY n) AS mediana,
--          percentile_disc(0.90) WITHIN GROUP (ORDER BY n) AS p90,
--          percentile_disc(0.99) WITHIN GROUP (ORDER BY n) AS p99,
--          max(n) AS maior
--   FROM (
--     SELECT patient_id, date_trunc('month', created_at) AS created_at, count(*) AS n
--     FROM public.ai_usage
--     WHERE especie = 'chat' AND patient_id IS NOT NULL
--     GROUP BY 1, 2
--   ) t
--   GROUP BY 1 ORDER BY 1 DESC;
