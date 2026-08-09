-- ============================================================================
--  IMAGENS SAEM DO POSTGRES E VÃO PARA O STORAGE
--  Idempotente: pode rodar mais de uma vez sem medo.
-- ----------------------------------------------------------------------------
--  POR QUE
--
--  Foto do álbum da família e laudo de exame eram gravados como base64 numa
--  coluna TEXT. base64 infla o binário em ~33%, então um JPEG de 200 KB ocupa
--  266 KB DENTRO DA LINHA. Isso pesa em três lugares ao mesmo tempo:
--
--   · disco de banco custa US$ 0,125/GB contra US$ 0,021/GB de Storage — seis
--     vezes mais caro pelo mesmo byte;
--   · todo backup carrega as imagens junto, e restaurar vira operação de horas;
--   · qualquer SELECT que toque a coluna traz o arquivo inteiro pela rede.
--
--  O QUE ESTE ARQUIVO FAZ
--
--   1. cria os dois baldes PRIVADOS (album, exames);
--   2. acrescenta a coluna `image_path` nas duas tabelas;
--   3. NÃO apaga nada. `image_data` continua lá, com as linhas antigas, até o
--      backfill terminar e você mandar apagar.
--
--  SOBRE AS POLICIES: não há nenhuma, e isso é deliberado.
--  Toda leitura e toda escrita de imagem passa pelo servidor com a chave de
--  serviço, que ignora RLS — o navegador nunca fala com o Storage. Sem policy
--  não existe policy mal escrita, e laudo de exame exposto por uma cláusula
--  errada é o pior acidente possível neste produto. O acesso continua sendo
--  decidido nas funções que checam o vínculo médico-paciente.
-- ============================================================================

-- ── 1. OS BALDES ────────────────────────────────────────────────────────────
-- `public = false`: sem URL pública. A tela recebe URL assinada de 1 hora.
insert into storage.buckets (id, name, public)
values ('album', 'album', false)
on conflict (id) do update set public = false;

insert into storage.buckets (id, name, public)
values ('exames', 'exames', false)
on conflict (id) do update set public = false;

-- ── 2. AS COLUNAS ───────────────────────────────────────────────────────────
-- Caminho dentro do balde, no formato "<uuid do dono>/<uuid do arquivo>.jpg".
-- O uuid do dono na frente faz o caminho dizer de quem é o arquivo mesmo para
-- quem estiver olhando só o Storage.
alter table if exists public.family_album_posts
  add column if not exists image_path text;

alter table if exists public.exam_files
  add column if not exists image_path text;

-- ── 3. ÍNDICES DO BACKFILL ──────────────────────────────────────────────────
-- O backfill varre "quem ainda tem base64 e não tem caminho". Sem isto, cada
-- lote faz varredura completa da tabela, e a tabela é justamente a que está
-- gigante por causa das imagens.
create index if not exists exam_files_por_migrar
  on public.exam_files (id)
  where image_path is null and image_data is not null;

create index if not exists album_posts_por_migrar
  on public.family_album_posts (id)
  where image_path is null and image_data is not null;

-- ============================================================================
--  DEPOIS DO BACKFILL — não rode agora.
--
--  Quando `select count(*) from exam_files where image_path is null and
--  image_data is not null` devolver 0 nas duas tabelas, e só então, o espaço
--  se recupera com:
--
--    update public.exam_files set image_data = null where image_path is not null;
--    update public.family_album_posts set image_data = null where image_path is not null;
--    vacuum full public.exam_files;
--    vacuum full public.family_album_posts;
--
--  O VACUUM FULL é o que devolve o disco de fato — sem ele o Postgres só marca
--  o espaço como reutilizável e o gráfico de uso não desce. Ele TRAVA a tabela
--  enquanto roda: faça de madrugada.
-- ============================================================================
