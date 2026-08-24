-- Push nativo: o token do APARELHO (APNs no iPhone, FCM no Android).
--
-- Por que não cabe em `push_subscriptions`: aquela tabela guarda uma inscrição
-- de Web Push (endpoint + duas chaves de criptografia), e o navegador é quem
-- cifra o conteúdo. Aqui o que existe é um token opaco, o conteúdo vai em claro
-- para a Apple ou para o Google, e a chave de conflito é outra. Enfiar as duas
-- coisas na mesma tabela deixaria metade das colunas nula em metade das linhas.
--
-- A DECISÃO QUE IMPORTA: `UNIQUE (token)`, e não `UNIQUE (user_id, token)`.
--
-- O token pertence ao APARELHO, não à pessoa. Quando outra conta entra no mesmo
-- celular — a paciente que empresta o telefone, o médico que abre a conta de
-- teste —, com a chave composta as duas linhas conviveriam e os avisos da
-- primeira continuariam chegando ali. Num app de gestação de alto risco isso
-- não é inconveniente de interface: é dado de saúde entregue à pessoa errada.
--
-- Com `UNIQUE (token)`, o `upsert` do servidor troca o dono. A mesma pessoa em
-- dois aparelhos continua com duas linhas — e recebe nos dois, que é o certo
-- para o médico com celular e tablet.

CREATE TABLE IF NOT EXISTS public.native_push_tokens (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  platform text NOT NULL CHECK (platform IN ('ios', 'android')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- O envio busca por user_id; sem isto vira varredura da tabela a cada aviso.
CREATE INDEX IF NOT EXISTS native_push_tokens_user_idx
  ON public.native_push_tokens (user_id);

ALTER TABLE public.native_push_tokens ENABLE ROW LEVEL SECURITY;

-- Leitura e remoção pela própria pessoa: ela pode conferir e desligar os avisos
-- deste aparelho. A GRAVAÇÃO fica só com o serviço, de propósito — trocar o
-- dono de um token exige apagar a linha de OUTRA pessoa, e nenhuma política de
-- RLS deveria permitir isso a partir do navegador.
DROP POLICY IF EXISTS "Dono le os proprios tokens" ON public.native_push_tokens;
CREATE POLICY "Dono le os proprios tokens"
  ON public.native_push_tokens FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Dono apaga os proprios tokens" ON public.native_push_tokens;
CREATE POLICY "Dono apaga os proprios tokens"
  ON public.native_push_tokens FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Servico administra tokens" ON public.native_push_tokens;
CREATE POLICY "Servico administra tokens"
  ON public.native_push_tokens FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

GRANT SELECT, DELETE ON public.native_push_tokens TO authenticated;
GRANT ALL ON public.native_push_tokens TO service_role;
