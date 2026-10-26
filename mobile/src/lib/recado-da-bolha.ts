import { recadoDaBolha } from "@/lib/recado-da-bolha";

/**
 * O RECADO DA BOLHA COMO O APP O DIZ — as frases do site
 * (`@/lib/recado-da-bolha`, congelado), com quatro trocadas.
 *
 * ⚠️ 21/10/2026, decisão do dono: o app é rede social + gamificação, e não
 * conselho médico — e, desde as aulas, nunca dá gênero ao bebê. Do site vinham
 * "Cuidar de você hoje é cuidar DELE também" (na gestação e no pós-parto),
 * "Tarde é ótima pra alongar. {bebê} gosta quando você se mexe" (exercício e
 * uma afirmação sobre o bebê), "Quando você desacelera, {bebê} sente" (que
 * amarra o bebê ao nervoso dela) e "O corpo pesa mais agora", que no pós-parto
 * fala do corpo e não do cansaço.
 *
 * A troca casa pelo TEXTO, e não pela posição: a rotação do site (`dia % n`)
 * segue a mesma, e cada frase trocada ocupa o lugar da dela. `{bebe}` é o
 * primeiro nome que o site já pôs no texto; a troca o leva junto.
 */
export const RECADOS_NO_APP: readonly { site: string; app: string }[] = [
  {
    site: "💗 Cuidar de você hoje é cuidar dele também — as duas coisas juntas.",
    app: "💗 Cuidar de você hoje é cuidar do bebê também — as duas coisas juntas.",
  },
  {
    site: "💜 Quando você desacelera, {bebe} sente. Respira comigo? 💗",
    app: "💜 Respira comigo um pouquinho? Um minuto seu e de {bebe}. 💗",
  },
  {
    site: "🌤️ Tarde é ótima pra alongar. {bebe} gosta quando você se mexe. 💜",
    app: "🌤️ Tarde boa pra conversar um pouquinho com {bebe}. 💜",
  },
  {
    site: "🌆 Fim de tarde. O corpo pesa mais agora — vai com jeitinho. 💜",
    app: "🌆 Fim de tarde. O cansaço pesa mais agora — vai com jeitinho. 💜",
  },
];

const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const TROCAS = RECADOS_NO_APP.map((t) => ({
  molde: new RegExp(`^${escapar(t.site).replace(/\\\{bebe\\\}/g, "(.+?)")}$`, "u"),
  app: t.app,
}));

/** O recado do momento (a régua do site), com as frases do app no lugar das trocadas. */
export function recadoDaBolhaNoApp(e: Parameters<typeof recadoDaBolha>[0]): string {
  const texto = recadoDaBolha(e);
  for (const t of TROCAS) {
    const m = t.molde.exec(texto);
    if (m) return t.app.replace(/\{bebe\}/g, m[1] ?? "");
  }
  return texto;
}
