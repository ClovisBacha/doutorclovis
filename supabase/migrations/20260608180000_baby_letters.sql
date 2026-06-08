-- Feature 21: Carta Semanal do Bebê
CREATE TABLE IF NOT EXISTS public.baby_letters (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        REFERENCES auth.users NOT NULL,
  week         smallint    NOT NULL,
  content      text        NOT NULL,
  generated_at timestamptz DEFAULT now(),
  UNIQUE (user_id, week)
);

ALTER TABLE public.baby_letters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own baby_letters"
  ON public.baby_letters FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

GRANT ALL ON public.baby_letters TO authenticated;
