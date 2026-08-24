/**
 * A PRÓXIMA LIVE, NO TOPO DO FEED — a régua.
 *
 * ─── O QUE ISTO LIGA ────────────────────────────────────────────────────────
 *
 * O dono já faz lives, e o app já as tem (`lives.functions.ts`, tabela `lives`,
 * página `/lives`). A Comunidade não sabia disso: a aba onde as pacientes estão
 * todo dia ignorava o único conteúdo com HORA MARCADA que o produto produz.
 *
 * Um aviso na aba onde elas já estão é audiência de graça — e dá à conta
 * oficial exatamente o conteúdo recorrente que falta a ela.
 *
 * ⚠️ **A LISTA JÁ VEM RECORTADA PELO MÉDICO DELA.** `listLivesPublic` devolve as
 * lives do obstetra da paciente quando há vínculo, e as globais quando não há.
 * Este arquivo não repete esse recorte — repeti-lo seria a segunda régua de
 * "que live é minha", e a divergência apareceria como paciente vendo a live de
 * outro consultório.
 */

export type LiveNoTopo = {
  id: string;
  titulo: string;
  /** ISO. Quem formata é a tela — ver `quandoAcontece`. */
  quando: string;
  link: string | null;
  /** Está no ar AGORA (começou há menos de {@link DURACAO_SUPOSTA} minutos). */
  aoVivo: boolean;
};

/**
 * Com quanta antecedência o cartão aparece.
 *
 * ⚠️ **Sete dias, e não "sempre".** Um cartão anunciando uma live de setembro
 * no topo do feed em agosto ocupa, todo dia, o lugar mais valioso da aba com
 * uma informação que a paciente não pode usar hoje — e ensina a pular o topo
 * do feed, que é onde o aviso precisa funcionar na semana em que ele importa.
 */
export const ANTECEDENCIA_DIAS = 7;

/**
 * Quanto tempo depois do horário ela ainda conta como "ao vivo".
 *
 * ⚠️ **A tabela não guarda duração**, e inventar uma coluna para isso seria
 * pedir ao dono um dado que ele não tem no momento em que marca a live. Noventa
 * minutos é generoso para o formato e curto o bastante para o cartão não ficar
 * dizendo "ao vivo agora" na manhã seguinte.
 */
export const DURACAO_SUPOSTA = 90;

/**
 * A live que o topo do feed deve mostrar — ou `null`.
 *
 * ⚠️ **`null` é o caso NORMAL**, e a tela precisa tratá-lo como tal: na maioria
 * dos dias não há live marcada, e o topo do feed é dos stories.
 *
 * ⚠️ **Sem `scheduled_at` não entra.** A tabela aceita live sem horário (o dono
 * pode cadastrar antes de decidir quando), e um cartão "acontece em breve" sem
 * data é um aviso que não dá o que fazer a seguir.
 *
 * ⚠️ **A que já passou some**, e some sozinha: nada precisa ser despublicado à
 * mão. Uma live de ontem no topo do feed é a prova mais barata de que o app
 * está abandonado.
 *
 * ⚠️ **A MAIS PRÓXIMA, e não a primeira da lista.** `listLivesPublic` ordena por
 * `scheduled_at` DESCENDENTE (a página de lives mostra a mais recente em cima),
 * então pegar `lives[0]` traria a mais DISTANTE no futuro. Foi por isso que
 * esta função escolhe explicitamente em vez de confiar na ordem de chegada.
 */
export function liveDoTopo(
  lives: {
    id: string;
    title: string;
    scheduled_at: string | null;
    link: string | null;
    is_published?: boolean;
  }[],
  agora: number,
  emCuidado = false,
): LiveNoTopo | null {
  /* ⚠️ Modo Cuidado: nada de convite para uma aula sobre a gestação em curso.
     É o mesmo portão do rodapé de convite e do "Nome do bebê". */
  if (emCuidado) return null;

  const limite = agora + ANTECEDENCIA_DIAS * 86400_000;
  const cedoDemais = (t: number) => t > limite;
  const tarde = (t: number) => agora - t > DURACAO_SUPOSTA * 60_000;

  const candidatas = lives
    .filter((l) => l.is_published !== false && !!l.scheduled_at)
    .map((l) => ({ l, t: Date.parse(l.scheduled_at as string) }))
    .filter(({ t }) => Number.isFinite(t) && !tarde(t) && !cedoDemais(t))
    /* A MAIS PRÓXIMA — inclusive uma que começou há dez minutos, que é a que
       mais importa: é a única em que o toque leva a alguma coisa agora. */
    .sort((a, b) => a.t - b.t);

  const escolhida = candidatas[0];
  if (!escolhida) return null;
  return {
    id: escolhida.l.id,
    titulo: escolhida.l.title,
    quando: escolhida.l.scheduled_at as string,
    link: escolhida.l.link ?? null,
    aoVivo: escolhida.t <= agora,
  };
}

/**
 * "hoje às 20h", "amanhã às 20h", "sábado às 20h".
 *
 * ⚠️ **Relativo, e nunca uma data por extenso.** "20 de agosto às 20h" obriga a
 * paciente a lembrar que dia é hoje para saber se ainda dá tempo — e o cartão
 * existe para responder exatamente isso num relance.
 *
 * ⚠️ **O `agora` é PARÂMETRO.** Um teste que dependesse do relógio do contêiner
 * falharia às terças, e o servidor roda em UTC enquanto ela vive em São Paulo.
 */
export function quandoAcontece(iso: string, agora: number): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const hora = new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(t);

  const dia = (n: number) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(n);
  const hoje = dia(agora);
  const amanha = dia(agora + 86400_000);
  const dela = dia(t);

  if (dela === hoje) return `hoje às ${hora}`;
  if (dela === amanha) return `amanhã às ${hora}`;
  const semana = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    timeZone: "America/Sao_Paulo",
  }).format(t);
  return `${semana} às ${hora}`;
}
