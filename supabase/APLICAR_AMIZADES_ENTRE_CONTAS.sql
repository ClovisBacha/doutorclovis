-- ═════════════════════════════════════════════════════════════════════════════
-- APLICAR_AMIZADES_ENTRE_CONTAS.sql — duas pacientes que JÁ usam o app podem
-- virar amigas. Idempotente: rode quantas vezes quiser.
--
-- ─── O BURACO QUE ISTO FECHA ─────────────────────────────────────────────────
--
-- Até aqui o grafo de amizade era EXCLUSIVAMENTE o da indicação: para duas
-- contas se enxergarem, uma tinha de mandar o link para a outra ANTES de a
-- outra existir, e a outra tinha de criar a conta por ali.
--
-- Isso deixava de fora o caso mais comum de todos: **as duas já usam o app**.
-- Duas grávidas do mesmo obstetra, que se conheceram na sala de espera, que
-- baixaram o app cada uma por conta própria — não havia caminho nenhum. A aba
-- inteira (Cantinho visitável, presente, dupla de sequência) era invisível para
-- elas, e nada na tela explicava por quê.
--
-- ─── POR QUE PEDIDO + ACEITE, E NÃO ADIÇÃO DIRETA ────────────────────────────
--
-- A indicação dispensava aceite porque ela JÁ era uma prova de consentimento:
-- a pessoa só entrava se tivesse recebido o link e clicado nele. Entre contas
-- existentes essa prova não existe — quem digita um código ou um e-mail está
-- afirmando que conhece a outra, e afirmar não é consentir.
--
-- Então ninguém aparece na lista de ninguém sem ter aceitado. É o que mantém a
-- promessa que a aba faz desde que nasceu: **só quem já se conhece**, sem
-- moderação, num app onde o risco é conselho médico de leiga e assédio ao mesmo
-- tempo.
--
-- ─── ⚠️ E POR QUE NÃO EXISTE BUSCA POR NOME ──────────────────────────────────
--
-- O convite resolve por CÓDIGO (o `referral_code` que cada paciente já tem) ou
-- por E-MAIL EXATO. Nunca por nome, e nunca por trecho.
--
-- Uma busca por nome transformaria a base de pacientes numa lista navegável:
-- qualquer conta poderia enumerar grávidas por nome, e num app de gestação de
-- alto risco esse é o dado que menos pode vazar. O código é uma CAPACIDADE —
-- 32^7 combinações, e só se tem se a outra tiver dado. O e-mail exato exige
-- saber o e-mail, que é a mesma prova que o WhatsApp pede.
--
-- E o servidor NUNCA responde se o e-mail existe: a resposta é sempre "se ela
-- usa o app, o convite chegou". Sem isso, o campo viraria um verificador de
-- contas — dá para descobrir se uma pessoa específica é paciente daqui, e isso
-- é informação de saúde.
--
-- O par é ordenado pela mesma razão de `duplas` e `amizades_encerradas`: (A,B)
-- e (B,A) são o mesmo fato.
-- ═════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.amizades (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  menor         uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  maior         uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  quem_convidou uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  aceita        boolean NOT NULL DEFAULT false,
  criada_em     timestamptz NOT NULL DEFAULT now(),
  aceita_em     timestamptz,
  CONSTRAINT amizades_par_ordenado CHECK (menor < maior)
);

-- Um par, uma linha. Convidar de novo é reenvio, nunca uma segunda linha que a
-- outra tela não vê — a mesma decisão de `duplas`.
CREATE UNIQUE INDEX IF NOT EXISTS amizades_par ON public.amizades (menor, maior);
CREATE INDEX IF NOT EXISTS amizades_menor ON public.amizades (menor);
CREATE INDEX IF NOT EXISTS amizades_maior ON public.amizades (maior);

ALTER TABLE public.amizades ENABLE ROW LEVEL SECURITY;

-- ⚠️ SEM POLÍTICA DE ESCRITA PARA `authenticated`, de propósito.
--
-- Quem escreve é a server function, com a chave de serviço, depois de resolver
-- o código/e-mail e de conferir que quem aceita É a destinatária. Uma política
-- de INSERT aberta deixaria qualquer conta inserir um par de duas OUTRAS
-- pessoas, ou marcar `aceita = true` numa amizade que ninguém aceitou — que é
-- exatamente a porta que o aceite existe para fechar.
--
-- É a mesma lição que fez `doctor_slots`/`doctor_blocks` serem revogadas e
-- reescritas: tabela social sem dono e com política larga é uma tabela que
-- qualquer autenticado reescreve.
DROP POLICY IF EXISTS "amizades_leitura_propria" ON public.amizades;
CREATE POLICY "amizades_leitura_propria"
  ON public.amizades FOR SELECT
  TO authenticated
  USING (auth.uid() = menor OR auth.uid() = maior);

COMMENT ON TABLE public.amizades IS
  'Amizade entre contas que já existem. Pedido + aceite; o grafo da indicação continua valendo em paralelo.';
