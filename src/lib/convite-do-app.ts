/**
 * O CONVITE NO PÉ DAS PÁGINAS PÚBLICAS — a régua.
 *
 * ─── O QUE ISTO CONSERTA ────────────────────────────────────────────────────
 *
 * O app tem TRÊS páginas que vivem fora do login e chegam a gente que não tem
 * conta — e nenhuma delas convidava ninguém (conferido: zero menção a criar
 * conta nas três):
 *
 *  · `/presente/<token>` — a lista do chá de bebê. Um link só na mão de trinta
 *    pessoas, quase todas mulheres da mesma idade e do mesmo círculo;
 *  · `/album/<token>` — as fotos, no grupo da família;
 *  · `/acompanhar/<token>` — o painel de quem acompanha, quase sempre o
 *    companheiro ou a mãe dela.
 *
 * São as superfícies de maior alcance que o app tem hoje, e as três terminavam
 * sem dizer o que é aquilo.
 *
 * ─── E O TOM É O RECURSO ───────────────────────────────────────────────────
 *
 * ⚠️ **A página é DELA, não nossa.** A lista de presentes é a festa dela; o
 * álbum é a família dela. Um bloco grande de propaganda no meio disso é o app
 * se convidando para a festa — e o dono já recusou esse tom noutros lugares
 * ("nesse ponto eu não quero que tenha as funções de alertas"). Por isso: uma
 * linha, no PÉ, depois do conteúdo inteiro, e nunca um cartão colorido no meio.
 *
 * ⚠️ **E o convite carrega o código DELA.** É `linkDeIndicacao`, a mesma função
 * do convite pelo WhatsApp — então quem cria conta pela lista de presentes vira
 * indicação dela e paga as 100 🌱. Um link sem código seria o defeito que
 * `indicacao.ts` existe para não deixar voltar: a amiga entra e o vínculo
 * simplesmente não acontece.
 */

/** A página de onde o convite está sendo mostrado. Muda a FRASE, nada mais. */
export type OndeConvida = "presentes" | "album" | "acompanhante";

/**
 * A frase, por página.
 *
 * ⚠️ **Cada uma fala do que a pessoa acabou de ver**, e não do app em abstrato.
 * Quem estava escolhendo uma fralda não quer ler "acompanhamento semana a
 * semana"; quem estava vendo as fotos do sobrinho, sim.
 *
 * ⚠️ **E nenhuma promete cuidado, segurança ou desfecho** — é a mesma proibição
 * das frases do mascote e da faixa de quem convidou. Quem lê pode estar
 * grávida, e a promessa clínica é do médico dela, não de um rodapé.
 */
export function fraseDoRodape(onde: OndeConvida): { titulo: string; sub: string } {
  switch (onde) {
    case "presentes":
      return {
        titulo: "Esta lista foi feita no Obstétrica",
        sub: "O app da gestação dela — do positivo ao pós-parto.",
      };
    case "album":
      return {
        titulo: "Este álbum vive no Obstétrica",
        sub: "O app onde ela acompanha a gestação, semana a semana.",
      };
    case "acompanhante":
      return {
        titulo: "Você está acompanhando pelo Obstétrica",
        sub: "Se você também está grávida, o app é seu também.",
      };
  }
}

/**
 * O texto do botão.
 *
 * ⚠️ "Conheça o app", e NUNCA "crie sua conta". Metade de quem abre estes links
 * não é gestante — é a tia, o colega de trabalho, o marido. Mandar um homem
 * "criar sua conta" num app de gestação é o rodapé não ter entendido para quem
 * está falando, e queima a única chance de a pessoa certa clicar.
 */
export const ROTULO_DO_BOTAO = "Conhecer o app";
