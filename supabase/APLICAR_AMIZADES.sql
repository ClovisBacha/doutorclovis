-- ═════════════════════════════════════════════════════════════════════════════
-- APLICAR_AMIZADES.sql — o aviso da ofensiva e a saída da amizade.
-- Idempotente: rode quantas vezes quiser.
--
-- Duas coisas pequenas, das quais a segunda é a que importa.
--
-- ─── 1. `duplas.avisada_em` — para o empurrão não virar spam ─────────────────
--
-- A dupla passou a avisar: quando UMA fecha o dia e a outra ainda não, a outra
-- recebe um push ("a Marina já fechou o dia de vocês"). É o mecanismo que faz
-- a dupla funcionar — sem ele, as duas só descobrem se abrirem o app por conta
-- própria, e aí a dupla não convida ninguém a voltar.
--
-- O que impede o spam é esta coluna: UM aviso por PAR por DIA. Ela guarda a
-- data local do último aviso daquela dupla, e a régua confere antes de mandar.
--
-- ⚠️ É `date` e não `timestamptz` de propósito: a pergunta é "já avisei HOJE?",
-- e um instante obrigaria a comparar fusos para responder isso. O servidor
-- carimba o dia local da paciente, que é o mesmo dia que a chama conta.
--
-- ─── 2. `amizades_encerradas` — uma amiga pode sair ──────────────────────────
--
-- Até aqui não havia como desfazer um vínculo de amizade. O grafo é o da
-- INDICAÇÃO (`referred_by`), que é fixado uma vez e nunca reescrito — e isso
-- está certo: é ele que prova quem trouxe quem, e é ele que pagou as 100 🌱.
--
-- Só que "quem me trouxe para o app" e "com quem eu quero jogar" são coisas
-- diferentes, e a segunda pode mudar. Amizade que azeda, um contato que ela
-- não quer mais, alguém que ela indicou por engano — hoje a única saída era
-- apagar a conta.
--
-- ⚠️ POR QUE UMA TABELA, E NÃO `referred_by = NULL`:
--
--   · a indicação é o RECIBO de uma recompensa já paga. Apagá-la faria o app
--     esquecer que aquelas 100 🌱 foram devidas, e `attributeReferral` só
--     escreve quando o campo está nulo — ou seja, o vínculo poderia ser
--     RECLAMADO DE NOVO por outro código, pagando duas vezes pela mesma amiga;
--   · e o histórico do Cantinho, dos presentes e da dupla aponta para pessoas.
--     Sumir com a origem deixa linhas órfãs num livro-caixa que a migration da
--     gamificação diz, por escrito, que nunca é apagado.
--
-- Então o vínculo continua no banco e a AMIZADE sai de cena. O par é ordenado
-- pela mesma razão da tabela `duplas`: A encerrar com B e B encerrar com A são
-- o mesmo fato, e duas linhas fariam cada tela ler a sua.
--
-- ⚠️ E O EFEITO É DOS DOIS LADOS. Esconder só de quem pediu deixaria a outra
-- continuar vendo, convidando para dupla e presenteando — ou seja, a pessoa de
-- quem ela quis distância continuaria alcançando-a. Uma saída que não separa
-- não é uma saída.
--
-- ⚠️ E NUNCA SE ANUNCIA. A outra simplesmente deixa de ver, como acontece no
-- Modo Cuidado: "Fulana te removeu" é uma frase que transforma um gesto
-- privado numa briga. Ela some como quem não entrou.
-- ═════════════════════════════════════════════════════════════════════════════

-- ── 1. O carimbo do aviso ───────────────────────────────────────────────────
ALTER TABLE public.duplas
  ADD COLUMN IF NOT EXISTS avisada_em date;

COMMENT ON COLUMN public.duplas.avisada_em IS
  'Dia local do último push "a outra já fechou". Um por par por dia.';

-- ── 2. A amizade encerrada ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.amizades_encerradas (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  menor        uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  maior        uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  -- Quem pediu. Não aparece para ninguém: existe para o suporte entender um
  -- caso, e para uma futura tela de "desfazer" saber de quem é a decisão.
  quem_pediu   uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  criada_em    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT amizades_par_ordenado CHECK (menor < maior)
);

-- Um par, uma linha. Encerrar de novo é no-op, não uma segunda linha.
CREATE UNIQUE INDEX IF NOT EXISTS amizades_encerradas_par
  ON public.amizades_encerradas (menor, maior);

ALTER TABLE public.amizades_encerradas ENABLE ROW LEVEL SECURITY;

-- ⚠️ SEM POLÍTICA DE ESCRITA PARA `authenticated`, de propósito.
--
-- Quem encerra é a server function (`encerrarAmizade`), com a chave de serviço,
-- depois de conferir que quem pede É uma das duas pontas. Uma política de
-- INSERT aberta deixaria qualquer autenticada inserir um par de duas OUTRAS
-- pessoas e separar duas desconhecidas — o mesmo defeito que fez as tabelas de
-- disponibilidade serem revogadas e reescritas.
--
-- A leitura própria fica liberada para o dia em que uma tela quiser listar o
-- que ela encerrou; hoje ninguém lê pelo cliente.
DROP POLICY IF EXISTS "amizades_encerradas_leitura_propria" ON public.amizades_encerradas;
CREATE POLICY "amizades_encerradas_leitura_propria"
  ON public.amizades_encerradas FOR SELECT
  TO authenticated
  USING (auth.uid() = menor OR auth.uid() = maior);

CREATE INDEX IF NOT EXISTS amizades_encerradas_menor ON public.amizades_encerradas (menor);
CREATE INDEX IF NOT EXISTS amizades_encerradas_maior ON public.amizades_encerradas (maior);
