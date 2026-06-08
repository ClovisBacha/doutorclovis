-- Feature 33: Álbum Familiar
CREATE TABLE IF NOT EXISTS public.family_album_posts (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_user_id  uuid        REFERENCES auth.users NOT NULL,
  author_name      text        NOT NULL DEFAULT 'Família',
  caption          text,
  image_data       text,        -- base64 JPEG, optional
  emoji            text,
  created_at       timestamptz DEFAULT now()
);

ALTER TABLE public.family_album_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Patient manages own album"
  ON public.family_album_posts FOR ALL
  USING  (auth.uid() = patient_user_id)
  WITH CHECK (auth.uid() = patient_user_id);

GRANT ALL ON public.family_album_posts TO authenticated;
GRANT ALL ON public.family_album_posts TO service_role;

-- Feature 34: Votação de Nome do Bebê
CREATE TABLE IF NOT EXISTS public.baby_name_sessions (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_user_id  uuid        REFERENCES auth.users NOT NULL UNIQUE,
  share_token      text        NOT NULL DEFAULT gen_random_uuid()::text UNIQUE,
  is_active        boolean     DEFAULT true,
  reveal_winner    boolean     DEFAULT false,
  created_at       timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.baby_name_entries (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       uuid        REFERENCES public.baby_name_sessions(id) ON DELETE CASCADE NOT NULL,
  name             text        NOT NULL,
  suggested_by     text        NOT NULL DEFAULT 'Anônimo',
  created_at       timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.baby_name_votes (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id         uuid        REFERENCES public.baby_name_entries(id) ON DELETE CASCADE NOT NULL,
  voter_name       text        NOT NULL DEFAULT 'Anônimo',
  voter_token      text        NOT NULL,
  created_at       timestamptz DEFAULT now(),
  UNIQUE (entry_id, voter_token)
);

ALTER TABLE public.baby_name_sessions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.baby_name_entries   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.baby_name_votes     ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Patient manages own name session"
  ON public.baby_name_sessions FOR ALL
  USING (auth.uid() = patient_user_id)
  WITH CHECK (auth.uid() = patient_user_id);

GRANT ALL ON public.baby_name_sessions TO authenticated;
GRANT ALL ON public.baby_name_sessions TO service_role;
GRANT ALL ON public.baby_name_entries  TO service_role;
GRANT ALL ON public.baby_name_votes    TO service_role;
