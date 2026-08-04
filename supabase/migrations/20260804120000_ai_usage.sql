-- Medição de uso de IA — ver supabase/APLICAR_USO_IA.sql para o porquê e para
-- as consultas prontas.

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

