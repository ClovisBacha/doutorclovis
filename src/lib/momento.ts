/**
 * OS MOMENTOS COMPARTILHÁVEIS — a régua, num lugar só.
 *
 * Pedido do dono: "se a pessoa fez ali cinco exercícios e ganhou cinco
 * estrelas, isso na página do jogo tem que depois refletir também essa mensagem
 * pra ela compartilhar ali na comunidade, compartilhar ali o nosso Instagram.
 * É muito importante que tenha essa integração de compartilhamento desses
 * momentos que acontecem em todo o app."
 *
 * ─── O QUE O MAPEAMENTO ACHOU ──────────────────────────────────────────────
 *
 * O app tem trinta e quatro momentos de conquista. **Dois saíam do app, e os
 * dois eram a mesma coisa** — "N semanas", pelo `share-card.ts`. Troféu, chama,
 * conquista, marco de gratidão, cinco estrelas, álbum da semana, aula, conjunto
 * do Cantinho: nenhum tinha caminho nenhum para fora, nem para dentro da
 * Comunidade.
 *
 * ─── AS TRÊS DECISÕES QUE ATRAVESSAM O ARQUIVO ─────────────────────────────
 *
 * ⚠️ **1. O PORTÃO DE MODO CUIDADO MORA AQUI.** `momentoDe` devolve `null` no
 * luto, e nenhuma das oito telas precisa lembrar disso. É a mesma decisão de
 * `humorDaJornada` — e ela existe porque o mapeamento encontrou o defeito
 * gêmeo: os sprites de check, estrela e cinco estrelas disparam de
 * `handleEarn` SEM portão nenhum, e um botão de compartilhar pendurado ali
 * herdaria o buraco inteiro.
 *
 * ⚠️ **2. NADA CLÍNICO, E NENHUMA PROMESSA.** O cartão sai do aparelho dela e
 * vai para o Instagram: ele fala do que ELA fez, nunca do bebê estar bem, nunca
 * de exame, nunca de conduta. Há teste com lista de palavras proibidas — a
 * mesma proibição das frases do mascote e do rodapé de convite.
 *
 * ⚠️ **3. A SEMANA SÓ APARECE NO MOMENTO QUE É A SEMANA.** O dia gestacional é
 * a semana disfarçada (`D = semana × 7 + dia`), e por isso nenhum outro momento
 * carrega número de dia: o troféu diz "12 dias de cinco estrelas", que é sobre
 * o esforço dela, e não sobre onde ela está na gestação. Quem publica a semana
 * é o marco de semana, que a paciente abre sabendo o que ele diz.
 */

export type EspecieDeMomento =
  | "semana"
  | "cinco_estrelas"
  | "trofeu"
  | "chama"
  | "conquista"
  | "marco_gratidao"
  | "album_semana"
  | "aula";

/** Os fatos, do jeito que a tela os tem em mãos. */
export type EntradaDoMomento = {
  especie: EspecieDeMomento;
  /** O número grande. `null` nos momentos que não têm número. */
  numero?: number | null;
  /** Um rótulo livre do próprio momento: o nome da conquista, o tema da aula. */
  rotulo?: string | null;
  /** O emoji do momento, quando ele tem um próprio (conquista, fruta). */
  emoji?: string | null;
  emCuidado: boolean;
};

export type Momento = {
  especie: EspecieDeMomento;
  /** O número gigante do cartão, ou `null`. */
  numero: number | null;
  /** A palavra embaixo do número ("dias seguidos"). */
  unidade: string | null;
  /** A linha de cima, pequena e em caixa alta no cartão. */
  chapeu: string;
  /** A frase principal. */
  titulo: string;
  emoji: string;
  /** O rascunho da legenda do post da Comunidade. */
  legenda: string;
  /** O texto que acompanha a imagem no compartilhamento externo. */
  textoDeShare: string;
  /** Vira o nome do arquivo PNG. */
  arquivo: string;
};

/** Plural sem drama, para as unidades. */
function plural(n: number, um: string, muitos: string): string {
  return n === 1 ? um : muitos;
}

/**
 * O momento, pronto para virar cartão — ou `null`.
 *
 * ⚠️ **`null` em Modo Cuidado, sempre e antes de tudo.** Ver a decisão 1.
 *
 * ⚠️ **E `null` quando o número não faz sentido** (zero, negativo, ausente num
 * momento que precisa dele): um cartão "0 dias seguidos" é a paciente
 * publicando o que ela não fez, e ele nasceria de um estado transitório da tela
 * — não de uma conquista.
 */
export function momentoDe(e: EntradaDoMomento): Momento | null {
  if (e.emCuidado) return null;

  const n = typeof e.numero === "number" && Number.isFinite(e.numero) ? Math.floor(e.numero) : null;
  const rotulo = (e.rotulo ?? "").trim();

  switch (e.especie) {
    case "semana": {
      if (n === null || n < 1) return null;
      return {
        especie: e.especie,
        numero: n,
        unidade: plural(n, "semana", "semanas"),
        chapeu: "Minha gestação",
        titulo: rotulo || "Mais uma semana 💛",
        emoji: e.emoji || "🤰",
        legenda: `${n} ${plural(n, "semana", "semanas")} 💛`,
        textoDeShare: `${n} ${plural(n, "semana", "semanas")} 💛`,
        arquivo: `obstetrica-semana-${n}`,
      };
    }
    case "cinco_estrelas":
      return {
        especie: e.especie,
        numero: null,
        unidade: null,
        chapeu: "Meu dia no app",
        titulo: "Fechei o dia com cinco estrelas",
        emoji: "⭐",
        legenda: "Fechei o dia com as cinco estrelas ⭐",
        textoDeShare: "Fechei o dia com cinco estrelas no Obstétrica ⭐",
        arquivo: "obstetrica-cinco-estrelas",
      };
    case "trofeu": {
      if (n === null || n < 1) return null;
      return {
        especie: e.especie,
        numero: n,
        unidade: plural(n, "dia completo", "dias completos"),
        chapeu: "Meus troféus",
        titulo: "Mais um dia de cinco estrelas",
        emoji: "🏆",
        legenda: `${n}º dia de cinco estrelas 🏆`,
        textoDeShare: `Já são ${n} ${plural(n, "dia", "dias")} de cinco estrelas 🏆`,
        arquivo: `obstetrica-trofeu-${n}`,
      };
    }
    case "chama": {
      if (n === null || n < 1) return null;
      return {
        especie: e.especie,
        numero: n,
        unidade: plural(n, "dia seguido", "dias seguidos"),
        chapeu: "Minha sequência",
        titulo: "Vim todo dia",
        emoji: "🔥",
        legenda: `${n} ${plural(n, "dia seguido", "dias seguidos")} 🔥`,
        textoDeShare: `${n} ${plural(n, "dia seguido", "dias seguidos")} cuidando de mim 🔥`,
        arquivo: `obstetrica-sequencia-${n}`,
      };
    }
    case "conquista": {
      if (!rotulo) return null;
      return {
        especie: e.especie,
        numero: null,
        unidade: null,
        chapeu: "Conquista",
        titulo: rotulo,
        emoji: e.emoji || "🏅",
        legenda: `Desbloqueei: ${rotulo}`,
        textoDeShare: `Desbloqueei "${rotulo}" no Obstétrica`,
        arquivo: "obstetrica-conquista",
      };
    }
    case "marco_gratidao": {
      if (n === null || n < 1) return null;
      return {
        especie: e.especie,
        numero: n,
        unidade: plural(n, "coisa boa", "coisas boas"),
        chapeu: "Minha gratidão",
        titulo: "Guardei mais uma",
        emoji: "💛",
        legenda: `${n} ${plural(n, "coisa boa", "coisas boas")} guardadas 💛`,
        textoDeShare: `Já guardei ${n} ${plural(n, "coisa boa", "coisas boas")} desta gestação 💛`,
        arquivo: `obstetrica-gratidao-${n}`,
      };
    }
    case "album_semana": {
      if (n === null || n < 1) return null;
      return {
        especie: e.especie,
        numero: n,
        unidade: plural(n, "semana no álbum", "semanas no álbum"),
        chapeu: "Meu álbum",
        titulo: rotulo || "Mais uma página",
        emoji: e.emoji || "📖",
        legenda: `Fechei a semana ${n} no álbum 📖`,
        textoDeShare: `Mais uma semana no meu álbum 📖`,
        arquivo: `obstetrica-album-${n}`,
      };
    }
    case "aula": {
      if (!rotulo) return null;
      return {
        especie: e.especie,
        numero: null,
        unidade: null,
        chapeu: "Aula de hoje",
        titulo: `Aprendi sobre ${rotulo}`,
        emoji: e.emoji || "📚",
        legenda: `Fiz a aula de hoje — sobre ${rotulo} 📚`,
        textoDeShare: `Fiz a aula de hoje no Obstétrica — sobre ${rotulo} 📚`,
        arquivo: "obstetrica-aula",
      };
    }
  }
}

/**
 * O que a paciente lê no botão.
 *
 * ⚠️ **"Compartilhar", e nunca "publicar".** O botão abre uma folha com DUAS
 * saídas (a imagem e o post) e não publica nada sozinho — prometer "publicar"
 * faria metade das pacientes não tocar, com medo de que já fosse ao ar.
 */
export const ROTULO_COMPARTILHAR = "Compartilhar";
