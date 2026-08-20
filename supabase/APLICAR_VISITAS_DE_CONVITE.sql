-- ═══════════════════════════════════════════════════════════════════════════
-- VISITAS DE CONVITE — o degrau que faltava no topo do funil
--
-- O painel de indicacao media "criaram conta", "publicaram" e "seguem alguem",
-- e o degrau de cima aparecia como NAO MEDIDO com todas as letras: o codigo
-- fica no navegador e so vira linha quando a conta e criada. Sem esse numero,
-- todas as taxas abaixo dele sao cegas -- nao da para saber se o problema e o
-- link nao circular ou a pagina nao converter, que sao dois problemas com
-- consertos opostos.
--
-- ⚠️ O QUE ESTA TABELA NAO GUARDA, e por que
--
-- Nao ha IP, nao ha user agent, nao ha identificador de visitante e nao ha
-- hora -- so o DIA. Isto e um contador de alcance, e nao um rastreador: quem
-- abre o link de uma gestante pode ser a chefe dela, a sogra ou o ex, e a
-- unica pergunta que o dono precisa responder e "quantas pessoas abriram".
-- Guardar mais seria colher dado de terceiro sem conta e sem consentimento
-- para uma pergunta que ja esta respondida sem ele.
--
-- ⚠️ E E UM CONTADOR AGREGADO, nao uma linha por visita. Uma criadora com
-- trinta mil seguidoras geraria trinta mil linhas num dia; agregado por
-- (codigo, tipo, dia) sao no maximo duas por dia por codigo.
--
-- Idempotente: rode quantas vezes quiser.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.visitas_de_convite (
  -- O codigo que trouxe a visita. `referral_code` de paciente ou
  -- `affiliates.code` de criadora -- por isso `text`, e nao uma FK: as duas
  -- origens vivem em tabelas diferentes, e uma FK obrigaria a escolher uma.
  codigo      text        NOT NULL,
  -- 'amiga' | 'criadora'. Guardado porque as duas convertem de formas
  -- diferentes e o dono precisa saber qual das duas esta funcionando.
  tipo        text        NOT NULL CHECK (tipo IN ('amiga', 'criadora')),
  dia         date        NOT NULL,
  contagem    integer     NOT NULL DEFAULT 0,
  PRIMARY KEY (codigo, tipo, dia)
);

COMMENT ON TABLE public.visitas_de_convite IS
  'Contador agregado de aberturas de link de convite. Sem IP, sem user agent, sem hora: so o dia.';

CREATE INDEX IF NOT EXISTS visitas_de_convite_dia ON public.visitas_de_convite (dia DESC);

-- ── RLS ────────────────────────────────────────────────────────────────────
-- ⚠️ NINGUEM le e ninguem escreve pelo cliente. A escrita passa por uma funcao
-- de servidor com service role e limitador por IP; a leitura e do painel do
-- dono, tambem no servidor. Sem policy nenhuma, `anon` e `authenticated` ficam
-- barrados por construcao -- que e o certo para uma tabela de metrica.
ALTER TABLE public.visitas_de_convite ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.visitas_de_convite FROM anon, authenticated;

-- ── O incremento ───────────────────────────────────────────────────────────
-- ⚠️ RPC e nao UPDATE do cliente: `contagem = contagem + 1` feito por leitura
-- e escrita separadas perde contagem em corrida, e uma criadora traz visitas
-- em rajada. O `ON CONFLICT DO UPDATE` resolve no banco, numa instrucao.
CREATE OR REPLACE FUNCTION public.contar_visita_de_convite(
  p_codigo text,
  p_tipo   text,
  p_dia    date
) RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.visitas_de_convite (codigo, tipo, dia, contagem)
  VALUES (p_codigo, p_tipo, p_dia, 1)
  ON CONFLICT (codigo, tipo, dia)
  DO UPDATE SET contagem = public.visitas_de_convite.contagem + 1;
$$;

REVOKE ALL ON FUNCTION public.contar_visita_de_convite(text, text, date) FROM anon, authenticated;

-- ── Conferencia ────────────────────────────────────────────────────────────
SELECT
  EXISTS (SELECT 1 FROM information_schema.tables
          WHERE table_schema='public' AND table_name='visitas_de_convite')      AS tabela_ok,
  EXISTS (SELECT 1 FROM information_schema.routines
          WHERE routine_schema='public' AND routine_name='contar_visita_de_convite') AS rpc_ok,
  (SELECT coalesce(sum(contagem), 0) FROM public.visitas_de_convite)            AS visitas_ate_agora;
