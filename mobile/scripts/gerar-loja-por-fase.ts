// Grava mobile/supabase/APLICAR_LOJA_POR_FASE.sql a partir da régua do app
// (mobile/src/lib/jornada/loja-por-fase.ts). Rode depois de mudar uma fase:
//
//   cd mobile && bun scripts/gerar-loja-por-fase.ts
//
// A catraca em loja-por-fase.test.ts reprova o arquivo que divergir da régua.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { sqlDaLojaPorFase } from "../src/lib/jornada/loja-por-fase-sql";

/* Em mobile/supabase/, e não na supabase/ da raiz: o mapa do banco do painel
   do site (`src/lib/mapa-do-banco.ts`) é gerado daquela pasta, e `src/` não
   muda mais. O SQL do app mora com o app. */
const destino = join(import.meta.dir, "..", "supabase", "APLICAR_LOJA_POR_FASE.sql");
writeFileSync(destino, sqlDaLojaPorFase());
console.log(`✅ ${destino}`);
