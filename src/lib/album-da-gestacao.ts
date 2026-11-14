/**
 * O ÁLBUM DA GESTAÇÃO — a grade do perfil dela contada em ordem, por semana.
 *
 * A grade é cronológica INVERSA, como toda grade: o mais novo primeiro. Isso
 * serve para "o que ela andou publicando" e é péssimo para a pergunta que este
 * app promete responder — *"como foi a minha gestação?"*. O álbum é a mesma
 * coleção lida do começo, agrupada pela semana em que cada publicação nasceu.
 *
 * ⚠️ **É SÓ PARA ELA, e isso não é preferência: é o que impede um vazamento.**
 *
 * Agrupar por semana significa carimbar uma linha do tempo GESTACIONAL em cada
 * publicação. Num perfil que outra pessoa abre, os títulos "22 semanas",
 * "30 semanas" publicariam a semana de TODO post — passando por cima da chave
 * `mostrar_semana`, que existe exatamente para essa decisão ser dela, por
 * publicação. O álbum não tem `alvoId`: o recorte é a sessão e nada mais.
 *
 * ⚠️ **E a semana sai do SERVIDOR.** `lmp_date` nunca viaja para o navegador —
 * é o que sustenta a chave. Quem monta as seções é quem tem a DUM em mãos.
 */

/** Uma publicação, com o mínimo que o agrupamento precisa. */
export type PostDoAlbum = {
  id: string;
  /** ISO. */
  criadoEm: string;
};

export type SecaoDoAlbum = {
  /**
   * A chave da seção.
   *
   * ⚠️ `semana:N` para o que nasceu dentro da gestação; `antes` e `depois` para
   * o que ficou fora dela. **Nunca uma semana inventada** — ver `faixaDoPost`.
   */
  chave: string;
  titulo: string;
  posts: PostDoAlbum[];
};

/** Depois disto a gestação acabou, e não há semana a contar. */
export const SEMANA_MAXIMA = 42;

/**
 * Em que semana esta publicação nasceu, ou `null`.
 *
 * ⚠️ **`null` NÃO é um detalhe — é a recusa a inventar.** Uma publicação
 * anterior à DUM (a conta é mais velha que a gestação) ou posterior à 42ª
 * semana não tem semana gestacional. Chutar uma poria "38 semanas" numa foto
 * tirada depois do parto.
 */
export function semanaDoPost(criadoEm: string, lmp: string): number | null {
  const nasceu = Date.parse(`${lmp}T00:00:00`);
  const quando = Date.parse(criadoEm);
  if (!Number.isFinite(nasceu) || !Number.isFinite(quando)) return null;
  const dias = Math.floor((quando - nasceu) / 86_400_000);
  if (dias < 0) return null;
  const semana = Math.floor(dias / 7) + 1;
  if (semana > SEMANA_MAXIMA) return null;
  return semana;
}

/**
 * Monta o álbum.
 *
 * ⚠️ **DO COMEÇO PARA O FIM**, ao contrário da grade. É a única diferença que
 * justifica o recurso existir: a grade responde "o que ela publicou por
 * último", e o álbum responde "como foi".
 *
 * ⚠️ **Uma seção por SEMANA, e não por trimestre.** Trimestre daria três
 * blocos gigantes — a mesma grade com três títulos. A semana é a unidade em que
 * ela viveu a gestação, e é a unidade que o app inteiro usa.
 *
 * ⚠️ **Semanas VAZIAS não viram seção.** Um álbum com "17 semanas" em branco
 * transforma a ausência em cobrança: houve semanas em que ela não teve o que
 * publicar, e o app não precisa apontá-las.
 *
 * ⚠️ **E sem DUM não há álbum** (`[]`): sem ela toda semana seria um chute.
 */
export function montarAlbum(posts: readonly PostDoAlbum[], lmp: string | null): SecaoDoAlbum[] {
  if (!lmp) return [];

  const porSemana = new Map<number, PostDoAlbum[]>();
  const antes: PostDoAlbum[] = [];
  const depois: PostDoAlbum[] = [];

  /* Ordenar ANTES de agrupar: dentro de cada semana a ordem também é a da
     história, e depender da ordem que veio do banco faria o álbum mudar
     conforme a consulta. */
  const emOrdem = [...posts].sort((a, b) => Date.parse(a.criadoEm) - Date.parse(b.criadoEm));

  for (const p of emOrdem) {
    const s = semanaDoPost(p.criadoEm, lmp);
    if (s === null) {
      /* Anterior à DUM ou posterior à 42ª: cada um no seu lado, sem semana. */
      const nasceu = Date.parse(`${lmp}T00:00:00`);
      const quando = Date.parse(p.criadoEm);
      if (!Number.isFinite(quando) || !Number.isFinite(nasceu)) continue;
      (quando < nasceu ? antes : depois).push(p);
      continue;
    }
    const lista = porSemana.get(s) ?? [];
    lista.push(p);
    porSemana.set(s, lista);
  }

  const secoes: SecaoDoAlbum[] = [];
  if (antes.length) {
    secoes.push({ chave: "antes", titulo: "Antes da gestação", posts: antes });
  }
  for (const s of [...porSemana.keys()].sort((a, b) => a - b)) {
    secoes.push({
      chave: `semana:${s}`,
      titulo: `${s} ${s === 1 ? "semana" : "semanas"}`,
      posts: porSemana.get(s)!,
    });
  }
  if (depois.length) {
    /* ⚠️ **"Depois", e nunca "Pós-parto".** O app não sabe se houve parto: a
       única coisa que ele sabe é que a publicação nasceu passada a 42ª semana.
       Nomear o desfecho é o tipo de afirmação que este app não faz. */
    secoes.push({ chave: "depois", titulo: "Depois", posts: depois });
  }
  return secoes;
}
