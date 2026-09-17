/**
 * A LEITURA DA PASTA `supabase/` — o que cada `APLICAR_*.sql` promete ao banco.
 *
 * ⚠️ **ISTO É MÓDULO, e não o corpo do script, por causa do TESTE.** A primeira
 * versão vivia dentro de `scripts/gerar-mapa-do-banco.mjs`, e a catraca
 * conferia a sincronia RODANDO o script e comparando os bytes do arquivo
 * gerado. Isso fazia o teste sair do processo duas vezes — `node` e, dentro
 * dele, `npx prettier`. Aqui levava 905 ms; **no runner limpo da CI passou de
 * 5 s e o teste estourou o tempo limite**, com a suíte verde na minha máquina.
 *
 * Um teste que depende do tempo de partida de um processo externo é instável
 * por construção, e o conserto NÃO é aumentar o limite: é não sair do
 * processo. Com a leitura aqui, a catraca compara o DADO — `MAPA_DO_BANCO`
 * contra uma releitura da pasta — sem escrever arquivo e sem `npx`.
 *
 * O gerador continua existindo para ESCREVER o arquivo formatado; ele só
 * deixou de ser o caminho pelo qual o teste descobre a verdade.
 */
import { readFileSync, readdirSync } from "node:fs";
import type { ArquivoDoBanco } from "./mapa-do-banco";

export function construirMapaDoBanco(): ArquivoDoBanco[] {
  const DIR = "supabase";
  const arquivos = readdirSync(DIR)
    .filter((f) => f.startsWith("APLICAR_") && f.endsWith(".sql"))
    .sort();

  /** Tira comentários de SQL — a prosa deste repositório CITA o que ela proíbe. */
  const semComentarios = (t: string) =>
    t.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*--.*$/gm, " ");

  const semEsquema = (n: string) => n.replace(/^public\./, "").replace(/"/g, "");

  const mapa: ArquivoDoBanco[] = [];
  for (const arquivo of arquivos) {
    const sql = semComentarios(readFileSync(`${DIR}/${arquivo}`, "utf8"));

    /* Tabelas que o arquivo CRIA. */
    const tabelas = new Set<string>();
    for (const m of sql.matchAll(/CREATE TABLE IF NOT EXISTS\s+([\w".]+)/gi))
      tabelas.add(semEsquema(m[1]));

    /* Colunas que o arquivo ACRESCENTA, casadas com a tabela do `ALTER` mais
       próximo acima — um `ALTER TABLE` pode trazer vários `ADD COLUMN`, e essa
       armadilha já fez uma catraca deste repositório acusar código correto. */
    const colunas = new Map<string, Set<string>>(); // tabela -> Set(coluna)
    let atual: string | null = null;
    for (const m of sql.matchAll(
      /ALTER TABLE\s+(?:IF EXISTS\s+)?([\w".]+)|ADD COLUMN(?:\s+IF NOT EXISTS)?\s+([\w"]+)/gi,
    )) {
      if (m[1]) atual = semEsquema(m[1]);
      else if (m[2] && atual) {
        const jaTem = colunas.get(atual) ?? new Set<string>();
        colunas.set(atual, jaTem);
        jaTem.add(m[2].replace(/"/g, ""));
      }
    }

    const alvos: { tabela: string; colunas: string[] }[] = [];
    for (const t of [...tabelas].sort()) alvos.push({ tabela: t, colunas: [] });
    for (const [t, cs] of [...colunas.entries()].sort()) {
      const ja = alvos.find((a) => a.tabela === t);
      /* ⚠️ Coluna de tabela que o PRÓPRIO arquivo cria não vira conferência
         separada: se a tabela existe, ela nasceu com as colunas. Conferi-las
         daria falso vermelho num banco correto. */
      if (ja) continue;
      alvos.push({ tabela: t, colunas: [...cs].sort() });
    }
    if (alvos.length) mapa.push({ arquivo, alvos });
  }
  return mapa;
}
