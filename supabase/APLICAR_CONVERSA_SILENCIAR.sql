-- ═══════════════════════════════════════════════════════════════════════════
-- AS CINCO COLUNAS DO DIRECT QUE O CÓDIGO USA E NENHUM SQL CRIAVA
--
-- ⚠️ **ESTE ARQUIVO ERA NOMEADO PELO CÓDIGO E NÃO EXISTIA.**
-- `conversa.functions.ts` cita `APLICAR_CONVERSA_SILENCIAR` em dois comentários,
-- explicando que é ele quem cria `silenciada_*` e `saiu_*`. Ele nunca foi
-- escrito. E `APLICAR_CONTEUDO_DA_REDE` afirma que `rede_mensagens` "já aceita
-- `imagem_path` desde o APLICAR_CONVERSA_E_COMENTARIOS" — não aceita: o
-- `CREATE TABLE` de lá tem só id, conversa_id, autor_id, texto, criada_em e
-- apagada_em.
--
-- ⚠️ **NADA QUEBRAVA VISIVELMENTE, e é isso que fez durar.** Toda leitura do
-- direct tem degrau de recuo, então o app degradava em silêncio — e três
-- recursos inteiros ficaram permanentemente mortos:
--
--   · **Silenciar uma conversa** — o interruptor grava e o valor não tem onde
--     morar; a gravação falha, e o push continua chegando. Um interruptor
--     decorativo é pior que não ter o botão: ela silencia, confia, e continua
--     sendo acordada de madrugada pelo mesmo canal por onde chega o aviso de
--     emergência.
--   · **Sair de uma conversa** — a conversa que ela mandou sumir continua na
--     lista, em toda abertura.
--   · **A FOTO e o ANEXO da mensagem** — `imagem_path`, `ref_tipo` e `ref_id`
--     são a foto do direct, a resposta a um story e a publicação encaminhada.
--     Sem as colunas, a mensagem grava só o texto: a foto que ela mandou
--     simplesmente não chega do outro lado.
--
-- É idempotente: rodar de novo é seguro.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. SILENCIAR E SAIR ────────────────────────────────────────────────────
--
-- ⚠️ **DUAS COLUNAS, UMA POR LADO** — e nunca uma só. Silenciar e sair são
-- preferências de QUEM OLHA a lista: com uma coluna compartilhada, a decisão de
-- uma sumiria a conversa da tela da outra. É a mesma razão de `fixada_*` e
-- `arquivada_*`, que já nasceram assim.
--
-- ⚠️ **`timestamptz`, e não `boolean`.** O instante é o que permite responder
-- "desde quando", e é o mesmo formato dos quatro pares vizinhos — um booleano
-- solto no meio deles seria a exceção que alguém lê errado.

ALTER TABLE public.rede_conversas
  ADD COLUMN IF NOT EXISTS silenciada_a timestamptz,
  ADD COLUMN IF NOT EXISTS silenciada_b timestamptz,
  ADD COLUMN IF NOT EXISTS saiu_a       timestamptz,
  ADD COLUMN IF NOT EXISTS saiu_b       timestamptz;

-- ─── 2. A FOTO E O ANEXO DA MENSAGEM ───────────────────────────────────────
--
-- ⚠️ **A FOTO VAI PARA O BALDE; a coluna guarda só o CAMINHO.** Guardar bytes
-- numa coluna de texto estoura o limite de linha e faz toda leitura da conversa
-- arrastar as imagens junto — a tela que a paciente abre mais que qualquer
-- outra desta aba.
--
-- ⚠️ **O balde é `conversas`, PRÓPRIO, e nunca o `rede`.** A régua de quem pode
-- ver uma foto de publicação é `podeVerPost`; a de uma foto de conversa é "as
-- duas pessoas dela". Misturar os dois baldes faria uma régua governar a outra.
--
-- `ref_tipo` + `ref_id` são o ANEXO: a publicação ou o story que ela
-- compartilhou dentro da conversa.
--
-- ⚠️ **O anexo guarda SÓ O ID, e nunca uma cópia do conteúdo.** Quem abrir
-- passa por `podeVerPost` com o contexto DE QUEM ABRE — a autora pode ter
-- fechado o perfil depois, e uma cópia sobreviveria a essa decisão. É a mesma
-- lei do carimbo da semana no story.

ALTER TABLE public.rede_mensagens
  ADD COLUMN IF NOT EXISTS imagem_path text,
  ADD COLUMN IF NOT EXISTS ref_tipo    text,
  ADD COLUMN IF NOT EXISTS ref_id      uuid;

-- ⚠️ **CHECK com a lista COMPLETA, e o `DROP` antes.** Três arquivos deste
-- repositório já reescreveram um CHECK com uma lista curta e apagaram valores
-- que o app grava — `rede_atividade_especie_check` e `rede_denuncias_alvo_check`
-- custaram isso, e as duas catracas que nasceram daí (`especies-da-atividade`,
-- `alvos-da-denuncia`) existem por causa disso. Aqui a lista é a completa desde
-- o primeiro dia.
ALTER TABLE public.rede_mensagens DROP CONSTRAINT IF EXISTS rede_mensagens_ref_tipo_check;
ALTER TABLE public.rede_mensagens
  ADD CONSTRAINT rede_mensagens_ref_tipo_check
  CHECK (ref_tipo IS NULL OR ref_tipo IN ('post', 'story'));

-- ⚠️ **O par tem de estar completo ou vazio.** Um `ref_tipo` sem `ref_id`
-- desenha um cartão de anexo apontando para nada, e um `ref_id` sem tipo não diz
-- o que buscar. Os dois estados são invisíveis no código e feios na tela.
ALTER TABLE public.rede_mensagens DROP CONSTRAINT IF EXISTS rede_mensagens_ref_completo;
ALTER TABLE public.rede_mensagens
  ADD CONSTRAINT rede_mensagens_ref_completo
  CHECK ((ref_tipo IS NULL) = (ref_id IS NULL));

-- ─── 3. A CONFERÊNCIA ──────────────────────────────────────────────────────
--
-- Rode e leia: qualquer `false` aqui é um recurso do direct que continua morto.

SELECT
  (SELECT count(*) = 4 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'rede_conversas'
       AND column_name IN ('silenciada_a','silenciada_b','saiu_a','saiu_b'))
    AS silenciar_e_sair_ok,
  (SELECT count(*) = 3 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'rede_mensagens'
       AND column_name IN ('imagem_path','ref_tipo','ref_id'))
    AS foto_e_anexo_ok;
