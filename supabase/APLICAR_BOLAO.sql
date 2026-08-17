-- ═════════════════════════════════════════════════════════════════════════════
-- APLICAR_BOLAO.sql — o bolão do nascimento.
-- Idempotente: rode quantas vezes quiser.
--
-- ─── O QUE É ─────────────────────────────────────────────────────────────────
--
-- Cada pessoa da torcida palpita QUANDO o bebê nasce, QUANTO pesa e A QUE
-- HORAS. No dia do parto a mãe registra o que aconteceu e o bolão fecha com um
-- ganhador.
--
-- A régua (faixas plausíveis, pontuação, ranking, empate) mora em
-- `src/lib/bolao.ts` e é testada. Aqui ficam só as garantias que o banco tem de
-- dar: um palpite por pessoa, ninguém escreve palpite alheio, e o resultado
-- real só a mãe registra.
--
-- ─── POR QUE DUAS TABELAS ────────────────────────────────────────────────────
--
-- `bolao_palpites` é de MUITA gente; `bolao_resultado` é uma linha por gestante
-- e é o que FECHA o bolão. Guardar o resultado numa coluna repetida em cada
-- palpite obrigaria a escrever N linhas no instante do parto — e um parto é
-- exatamente o momento em que ninguém vai conferir se as N deram certo.
--
-- ─── ⚠️ O PALPITE É DA PESSOA, O BOLÃO É DA GESTANTE ─────────────────────────
--
-- `dona_id` é de quem está grávida; `autor_id` é de quem palpitou. A gestante
-- também palpita (o `autor_id` dela aparece como qualquer outro), e é por isso
-- que a chave única é do PAR — sem ela, um toque nervoso viraria dois palpites
-- da mesma pessoa e o ranking teria a mesma tia duas vezes.
--
-- ─── ⚠️ E O MODO CUIDADO ─────────────────────────────────────────────────────
--
-- O bolão some inteiro quando a gestante liga o Modo Cuidado. Isso NÃO é feito
-- aqui: uma política de RLS que lesse `patient_profiles.care_mode` a cada
-- SELECT amarraria a régua clínica ao banco, e ela mora em `bolao.ts`
-- (`bolaoDisponivel`), que é a mesma régua que a tela usa. O portão é conferido
-- em `bolao.functions.ts`, no servidor, ANTES de qualquer leitura — filtrar só
-- na tela deixaria os palpites viajando pela rede antes de sumirem.
--
-- As linhas NÃO são apagadas quando o modo liga. Apagar seria irreversível, e
-- o Modo Cuidado pode ser desligado — ver a mesma decisão em `exam_files`.
-- ═════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.bolao_palpites (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- De quem é a gestação. O bolão inteiro pendura aqui.
  dona_id      uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  -- Quem palpitou. Pode ser a própria gestante.
  autor_id     uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  -- Nome que aparece na lista. Congelado no envio de propósito: quem palpitou
  -- como "Vó Ana" continua "Vó Ana" mesmo que ela troque o nome do perfil
  -- depois — o bolão é um registro do que aconteceu, não uma view do presente.
  autor_nome   text NOT NULL,
  dia          date NOT NULL,
  peso_gramas  integer NOT NULL,
  -- Minutos depois da meia-noite (0–1439), ou NULL: palpitar hora é opcional.
  hora_minutos integer,
  criado_em    timestamptz NOT NULL DEFAULT now(),
  editado_em   timestamptz,

  -- Guardas de sanidade. Espelham `PESO_MINIMO`/`PESO_MAXIMO` de `bolao.ts`;
  -- são generosas de PROPÓSITO, porque um prematuro de 900 g é a paciente
  -- deste app e não um caso improvável.
  CONSTRAINT bolao_peso_plausivel CHECK (peso_gramas BETWEEN 500 AND 7000),
  CONSTRAINT bolao_hora_plausivel CHECK (hora_minutos IS NULL
                                         OR hora_minutos BETWEEN 0 AND 1439)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- UM PALPITE POR PESSOA, POR BOLÃO.
--
-- O palpite é EDITÁVEL até o parto (ver `bolao.ts`: travar no primeiro envio
-- faz quem palpitou na 20ª semana não voltar mais). Editar é UPDATE nesta
-- linha; sem a chave única, "editar" viraria uma segunda linha e a mesma tia
-- apareceria duas vezes no ranking.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS bolao_um_por_pessoa
  ON public.bolao_palpites (dona_id, autor_id);
CREATE INDEX IF NOT EXISTS bolao_por_dona ON public.bolao_palpites (dona_id);

ALTER TABLE public.bolao_palpites ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS: leitura para quem participa; escrita nenhuma pelo cliente.
--
-- ⚠️ A leitura direta é só do PRÓPRIO palpite e do bolão da própria gestante.
-- Ver o bolão de OUTRA pessoa exige provar o vínculo (amizade ou acompanhante),
-- e isso é `saoAmigas`/o convite aceito — uma conferência que não cabe numa
-- política de RLS sem duplicar a régua. Quem lê o bolão dos outros é
-- `bolao.functions.ts`, com service role, depois de conferir.
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Vê o próprio palpite e o próprio bolão" ON public.bolao_palpites;
CREATE POLICY "Vê o próprio palpite e o próprio bolão" ON public.bolao_palpites
  FOR SELECT USING (auth.uid() = autor_id OR auth.uid() = dona_id);

DROP POLICY IF EXISTS "Service manages bolao_palpites" ON public.bolao_palpites;
CREATE POLICY "Service manages bolao_palpites" ON public.bolao_palpites
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- ═════════════════════════════════════════════════════════════════════════════
-- O RESULTADO — uma linha por gestante, e é ela que FECHA o bolão.
-- ═════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.bolao_resultado (
  dona_id      uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  dia          date NOT NULL,
  peso_gramas  integer NOT NULL,
  hora_minutos integer,
  registrado_em timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT bolao_res_peso_plausivel CHECK (peso_gramas BETWEEN 500 AND 7000),
  CONSTRAINT bolao_res_hora_plausivel CHECK (hora_minutos IS NULL
                                             OR hora_minutos BETWEEN 0 AND 1439)
);

ALTER TABLE public.bolao_resultado ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Vê o próprio resultado" ON public.bolao_resultado;
CREATE POLICY "Vê o próprio resultado" ON public.bolao_resultado
  FOR SELECT USING (auth.uid() = dona_id);

DROP POLICY IF EXISTS "Service manages bolao_resultado" ON public.bolao_resultado;
CREATE POLICY "Service manages bolao_resultado" ON public.bolao_resultado
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

COMMENT ON TABLE public.bolao_palpites IS
  'Bolão do nascimento: um palpite (dia, peso, hora) por pessoa por gestante. '
  'Editável até o parto — a chave única (dona_id, autor_id) é o que faz editar '
  'ser UPDATE e não uma segunda linha. Régua em src/lib/bolao.ts.';

COMMENT ON TABLE public.bolao_resultado IS
  'O que aconteceu de verdade. Uma linha por gestante; só ela registra. '
  'Existir aqui é o que FECHA o bolão e libera o ranking.';

-- ─────────────────────────────────────────────────────────────────────────────
-- CONFERÊNCIA. As quatro linhas têm que voltar `true`.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  EXISTS (SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'bolao_palpites')   AS palpites_ok,
  EXISTS (SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'bolao_resultado')  AS resultado_ok,
  EXISTS (SELECT 1 FROM pg_indexes
          WHERE schemaname = 'public' AND indexname = 'bolao_um_por_pessoa') AS um_por_pessoa_ok,
  EXISTS (SELECT 1 FROM pg_constraint
          WHERE conname = 'bolao_peso_plausivel')                            AS faixa_ok;
