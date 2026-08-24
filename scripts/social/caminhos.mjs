/**
 * Onde estão a fonte, as artes, a logo e o conteúdo.
 *
 * O gerador roda em dois lugares: dentro deste repositório, onde tudo mora em
 * `src/`, e num pacote solto — o que se manda para um sandbox de terceiro, que
 * é descartado a cada execução e não tem repositório nenhum. Lá o mesmo
 * material vem em `arte/` e `dados/`, ao lado dos scripts.
 *
 * Podia haver duas cópias do gerador, uma para cada layout. Não há, de
 * propósito: duas cópias da mesma lógica divergem no primeiro ajuste que
 * alguém fizer só de um lado. Este arquivo escolhe o layout olhando se a pasta
 * `dados/` existe ao lado dele, e o resto do código não fica sabendo.
 */

import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, "..", "..");

/** No pacote solto, o conteúdo viaja junto, em `dados/`. */
const SOLTO = existsSync(join(AQUI, "dados"));

export const CAMINHOS = SOLTO
  ? {
      quizzes: join(AQUI, "dados", "daily-quizzes.data.json"),
      arte: join(AQUI, "arte"),
      logo: join(AQUI, "arte", "logo-obstetrica.png"),
      fonte: join(AQUI, "fontes", "nunito.woff2"),
      saida: join(AQUI, "saida"),
      estado: join(AQUI, ".usado.json"),
    }
  : {
      quizzes: join(RAIZ, "src", "lib", "daily-quizzes.data.json"),
      arte: join(RAIZ, "src", "assets", "social"),
      logo: join(RAIZ, "src", "assets", "logo-obstetrica.png"),
      fonte: join(AQUI, "fontes", "nunito.woff2"),
      saida: join(RAIZ, "saida", "social"),
      estado: join(AQUI, ".usado.json"),
    };
