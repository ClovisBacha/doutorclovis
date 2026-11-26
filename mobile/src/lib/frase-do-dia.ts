import { fraseDoDia } from "@/lib/frases-do-mascote";

/**
 * As frases do mascote que o APP não diz (a lista é do site, congelada).
 *
 * ⚠️ 21/10/2026: o registro de peso saiu do app, e a v1 não tem médico que
 * "vê" o que ela anota. A frase prometia as duas coisas. "Toque nele" chamava o
 * bebê de "ele" e mandava tocar num cartão que o pós-parto não tem.
 */
export const FRASES_FORA_DO_APP: ReadonlySet<string> = new Set([
  "Anotar seu peso hoje leva dez segundos — e o seu médico vê ⚖️",
  "Sabia que dá para ver o bebê crescer semana a semana? Toque nele ☝️",
]);

/**
 * As frases que o app diz de outro jeito, no mesmo lugar da rotação: "Já sentiu
 * o bebê hoje?" (o que ela sente das mexidinhas fica fora — quem sentiu pouco lê
 * ali um sinal, e sinal mora no SOS), "Bebeu água hoje?" (hidratação como
 * orientação) e o movimento e o alongamento oferecidos também no pós-parto, de
 * onde o Mexer saiu ("só se o médico já liberou"). `{nome}` é o do site: vira
 * ", Ana" ou nada.
 */
export const FRASES_TROCADAS_NO_APP: readonly { site: string; app: string }[] = [
  {
    site: "Já sentiu o bebê hoje{nome}? Dá para contar os chutes na aba Saúde 👣",
    app: "Já leu uma cartinha para o bebê hoje{nome}? Leva um minutinho 💌",
  },
  {
    site: "Bebeu água hoje{nome}? Eu pergunto porque me importo 💧",
    app: "Como está a sua tarde{nome}? Eu pergunto porque me importo 💛",
  },
  {
    site: "Acordou! Eu também. Hoje é um bom dia para um movimento leve 🤸",
    app: "Acordou! Eu também. Hoje é um bom dia para guardar uma coisa boa ✨",
  },
  {
    site: "Que tal um alongamento devagar antes de deitar? 🌙",
    app: "Que tal uma história para dormir antes de deitar? 🌙",
  },
];

const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const TROCAS = FRASES_TROCADAS_NO_APP.map((t) => ({
  molde: new RegExp(`^${escapar(t.site).replace(/\\\{nome\\\}/g, "(.*?)")}$`, "u"),
  app: t.app,
}));

function trocada(f: string): string {
  for (const t of TROCAS) {
    const m = t.molde.exec(f);
    if (m) return t.app.replace(/\{nome\}/g, m[1] ?? "");
  }
  return f;
}

/**
 * A frase de hoje, sem as de fora e com as trocadas. Quando o dia cai numa de
 * fora, vale a do dia seguinte — a rotação do site (`dia % n`) segue a mesma no
 * resto dos dias.
 */
export function fraseDoDiaNoApp(o: Parameters<typeof fraseDoDia>[0]): string | null {
  for (let passo = 0; passo < 3; passo++) {
    const f = fraseDoDia({ ...o, dia: o.dia + passo });
    if (f == null) return f;
    if (!FRASES_FORA_DO_APP.has(f)) return trocada(f);
  }
  return null;
}
