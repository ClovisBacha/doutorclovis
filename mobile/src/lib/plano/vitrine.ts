import { conteudoDoApp, type LinhaDoTempo } from "~/lib/plano/numeros";
import { MOMENTO_NA_FRASE, oBebe } from "~/lib/plano/passos";
import type { Pilar, RespostasDoPlano } from "~/lib/plano/respostas";

/**
 * O QUE AS VITRINES DO FUNIL DIZEM, em puro (20/11/2026): a montagem, a
 * diferença e o plano pronto. Cada linha descreve o que o app TEM, com os
 * números DELA e os do app; a catraca de voz está em `plano.test.ts`.
 */

type Conteudo = ReturnType<typeof conteudoDoApp>;

/**
 * "107 aulas até a data provável", ou `null` quando o plano já está no fim
 * (passou da data provável, ou o bebê já passou das 12 semanas): "1 aula"
 * ou "0 desafios" soariam como pouco, e o plano continua todo dia.
 */
export function contagemDoPlano(t: LinhaDoTempo, aulas: number): string | null {
  if (aulas < 2) return null;
  return t.modo === "gravida"
    ? `${aulas} aulas até a data provável`
    : `${aulas} desafios até as 12 semanas`;
}

export type PecaDoPlano = { icone: string; titulo: string; quanto: string; pilar: Pilar | null };

/** As peças do "plano pronto": as dos pilares que ela marcou primeiro, depois as outras. */
export function pecasDoPlano(
  r: RespostasDoPlano,
  t: LinhaDoTempo,
  aulas: number,
  c: Conteudo,
): PecaDoPlano[] {
  const gravida = t.modo === "gravida";
  const todas: PecaDoPlano[] = [
    {
      icone: "graduation-cap",
      titulo: gravida ? "A aula do dia" : "O desafio do dia",
      /* A contagem já está no número grande, logo acima: aqui, o ritmo. */
      quanto: gravida ? "Uma por dia, da sua semana" : "Um por dia, da semana do bebê",
      pilar: "aprender",
    },
    {
      icone: "wind",
      titulo: "Pausas para respirar",
      quanto: `${c.meditacoes} temas guiados`,
      pilar: "calma",
    },
    { icone: "moon", titulo: "Sons para a noite", quanto: `${c.sons} sons`, pilar: "calma" },
    {
      icone: "activity",
      titulo: "Movimentos leves",
      quanto: `${c.movimentos} movimentos, no seu ritmo`,
      pilar: "mexer",
    },
    {
      icone: "heart-handshake",
      titulo: `Cartas para ${oBebe(r)}`,
      quanto: `${c.cartas} cartas para ler em voz alta`,
      pilar: "vinculo",
    },
    { icone: "book-heart", titulo: "Gratidão", quanto: "Uma coisa boa por dia", pilar: "memorias" },
    { icone: "sprout", titulo: "A sua trilha", quanto: "Sementinhas e conquistas", pilar: null },
    { icone: "users", titulo: "Amigas", quanto: "Uma dupla para manter a chama", pilar: null },
  ];
  const marcou = (p: PecaDoPlano) => (p.pilar && r.pilares.includes(p.pilar) ? 0 : 1);
  return todas
    .map((p, i) => ({ p, i }))
    .sort((a, b) => marcou(a.p) - marcou(b.p) || a.i - b.i)
    .map(({ p }) => p);
}

/** Os itens que ganham o visto na montagem. */
export function itensDaMontagem(
  r: RespostasDoPlano,
  t: LinhaDoTempo,
  aulas: number,
  c: Conteudo,
): string[] {
  const gravida = t.modo === "gravida";
  return [
    aulas < 2
      ? gravida
        ? "Uma aula curta por dia"
        : "Um desafio por dia"
      : gravida
        ? `${aulas} aulas, uma para cada dia até a data provável`
        : `${aulas} desafios, um por dia até as 12 semanas`,
    r.momento ? `Pausas para respirar ${MOMENTO_NA_FRASE[r.momento]}` : "Pausas para respirar",
    `${c.movimentos} movimentos leves, no seu ritmo`,
    `${c.cartas} cartas para ler para ${oBebe(r)}`,
    "A sua trilha, com sementinhas e conquistas",
  ];
}

/** As linhas do "a diferença de ter um plano": o que muda, com as escolhas dela. */
export function linhasDaDiferenca(r: RespostasDoPlano, t: LinhaDoTempo) {
  const gravida = t.modo === "gravida";
  const linhas = [
    {
      sem: "Informação solta na internet",
      com: gravida ? "Uma aula da sua semana, todo dia" : "O mundo do bebê, semana a semana",
    },
    { sem: "Não saber por onde começar", com: "O passo de hoje já pronto na trilha" },
    {
      sem: "Cuidar de você fica para depois",
      com:
        r.minutos && r.momento
          ? `${r.minutos} minutos só seus, ${MOMENTO_NA_FRASE[r.momento]}`
          : "Alguns minutos só seus, todo dia",
    },
  ];
  if (r.preocupacoes.includes("sozinha"))
    linhas.push({ sem: "Passar por isso sozinha", com: "Uma amiga na sua dupla" });
  return linhas;
}

/** "8h" ou "45 min": o número grande do plano pronto. */
export function numeroDoTempo(minutos: number): string {
  return minutos < 60 ? `${minutos} min` : `${Math.floor(minutos / 60)}h`;
}

/** "21h", "12h30": a hora do lembrete no meio de uma frase. */
export function horaNaFrase(hhmm: string): string {
  const [h, m] = hhmm.split(":");
  return `${Number(h)}h${m && m !== "00" ? m : ""}`;
}

/**
 * O "O QUE MUDA COM O SEU PLANO", depois da conta: o que ela escolheu, dito
 * de volta. Sem a prova social da referência ("junte-se a 58.364 mães"): o
 * app não tem esse número.
 */
export function linhasDoQueMuda(
  r: RespostasDoPlano,
  t: LinhaDoTempo,
  aulas: number,
  lembrete: string | null,
): { titulo: string; sub: string }[] {
  const gravida = t.modo === "gravida";
  const linhas = [
    {
      titulo: gravida ? "Uma aula por dia, da sua semana" : "Um desafio por dia, da semana do bebê",
      sub: contagemDoPlano(t, aulas) ?? "No seu ritmo, um dia de cada vez",
    },
    {
      titulo:
        r.minutos && r.momento
          ? `${r.minutos} minutos só seus, ${MOMENTO_NA_FRASE[r.momento]}`
          : "Alguns minutos só seus, todo dia",
      sub: lembrete ? `Com lembrete às ${horaNaFrase(lembrete)}` : "No seu tempo, sem cobrança",
    },
    {
      titulo: gravida
        ? `A semana de ${oBebe(r)}, todo dia`
        : `As semanas de ${oBebe(r)}, uma a uma`,
      sub: gravida
        ? "O tamanho, a data provável e quanto falta"
        : "O mundo do bebê, semana a semana",
    },
  ];
  if (r.amiga && r.amiga !== "sozinha")
    linhas.push({ titulo: "Uma amiga na sua dupla", sub: "Na aba Amigas, quando você quiser" });
  return linhas;
}

/** O resumo do plano na hora de salvar (a conta): a semana, o bebê, o tempo e as aulas. */
export function resumoDoPlano(
  r: RespostasDoPlano,
  t: LinhaDoTempo,
  aulas: number,
): { icone: string; texto: string }[] {
  const linhas: { icone: string; texto: string }[] = [];
  if (t.modo === "gravida")
    linhas.push({
      icone: "calendar",
      texto:
        t.diasAteADpp > 0
          ? `Semana ${t.semana}, faltam ${t.diasAteADpp} ${t.diasAteADpp === 1 ? "dia" : "dias"}`
          : `Semana ${t.semana}`,
    });
  else
    linhas.push({
      icone: "calendar",
      texto: `${t.semanasDeVida} ${t.semanasDeVida === 1 ? "semana" : "semanas"} de vida`,
    });
  if (r.bebe.trim()) linhas.push({ icone: "heart", texto: r.bebe.trim() });
  if (r.minutos && r.momento)
    linhas.push({
      icone: "clock",
      texto: `${r.minutos} minutos por dia, ${MOMENTO_NA_FRASE[r.momento]}`,
    });
  linhas.push({
    icone: "graduation-cap",
    texto:
      contagemDoPlano(t, aulas) ??
      (t.modo === "gravida" ? "Uma aula curta por dia" : "Um desafio por dia"),
  });
  return linhas;
}
