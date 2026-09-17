-- ═════════════════════════════════════════════════════════════════════════════
-- OS AVISOS QUE FALTAVAM  (ago/2026)
--
-- ⚠️ **DEFEITO ENCONTRADO POR SONDAGEM, e ele era meu.** A mensagem direta e os
-- comentários foram construídos inteiros e NÃO AVISAVAM NINGUÉM: zero
-- referências à caixa de Atividade, zero push. Alguém comentava na foto dela e
-- ela nunca ficava sabendo, a menos que abrisse aquele post exato; mandava
-- mensagem e ela só descobria se por acaso abrisse a caixa.
--
-- Uma caixa de entrada sem aviso é um canal morto — é o mesmo defeito que o
-- presente do médico teve por meses ("o saldo subia sozinho e nenhuma tela
-- dizia de onde veio").
--
-- Idempotente: rodar de novo é seguro.
-- ═════════════════════════════════════════════════════════════════════════════

-- ⚠️ `CREATE TABLE IF NOT EXISTS` NÃO TOCA EM TABELA QUE JÁ EXISTE, então a
-- espécie nova entra por `ALTER` — a mesma lição que `carimbo_semana` custou.
ALTER TABLE public.rede_atividade DROP CONSTRAINT IF EXISTS rede_atividade_especie_check;
ALTER TABLE public.rede_atividade ADD CONSTRAINT rede_atividade_especie_check
  CHECK (especie IN (
    /* ⚠️ **A LISTA É SEMPRE A COMPLETA, e nunca só o que este arquivo cria.**
       Três arquivos reescrevem este CHECK com DROP+ADD, e o dono os roda à mão,
       em qualquer ordem e mais de uma vez. Uma lista parcial aqui apagaria
       `mencionou` na primeira re-execução — e toda linha de atividade de menção
       passaria a ser recusada pelo banco, em SILÊNCIO, porque
       `registrarAtividade` engole a falha de propósito.
       `especies-da-atividade.test.ts` cobra que nenhuma lista seja menor. */
    'seguiu','pediu_para_seguir','aceitou','reagiu','marcou','reagiu_story',
    'comentou','mencionou'
  ));

SELECT EXISTS (
  SELECT 1 FROM information_schema.check_constraints
  WHERE constraint_name = 'rede_atividade_especie_check'
    AND check_clause LIKE '%comentou%'
) AS comentou_ok;
