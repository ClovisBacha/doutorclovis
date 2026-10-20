import type { Blob } from "~/lib/jornada/momentos";
import { ehBancada, parametroDaBancada } from "~/lib/bancada";
import { CHAVE_AGENDA } from "~/lib/agenda/agenda";

/**
 * A BANCADA DA JORNADA — os dados de exemplo que entram nos MESMOS estados da
 * produção (a loja, a carteira, a grade de conquistas). Nada daqui chama o
 * servidor nem grava no aparelho.
 *
 *   /jornada?bancada=1                  dia com 2 de 5 feitos
 *   /jornada?bancada=1&estado=fechado   5 de 5
 *   /jornada?bancada=1&estado=falhou    a carteira não carregou
 *   /jornada?bancada=1&luto=1           Modo Cuidado
 *   /jornada?bancada=1&semana=38        outra semana
 *   /jornada?bancada=1&pos=1            pós-parto (bebê com 20 dias)
 *   /jornada?bancada=1&presente=1       com um presente para anunciar
 *   &pele=trilha-jardim                 as bolinhas com a pele (a do site)
 *   &itens=bicho-coelho,luz-vela        itens a mais no Cantinho de exemplo
 *   &clima=clima-petalas                o ar da trilha (a `?clima=` do site)
 *   &fundo=fundo-amanhecer              o cenário equipado
 *   &agenda=vazia                       a agenda sem nada marcado
 */

export function estadoDaBancada(): string | null {
  return parametroDaBancada("estado");
}

/** Os parâmetros que valem para a bancada inteira (passam de tela em tela). */
const QUE_VIAJAM = [
  "bancada",
  "semana",
  "luto",
  "pos",
  "bebe",
  "saldo",
  "pele",
  "itens",
  "clima",
  "fundo",
  "agenda",
] as const;

/**
 * A agenda de exemplo (`/agenda?bancada=1`): uma consulta daqui a 3 dias, um
 * morfológico daqui a 12 e um exame que já foi, com anotação. `&agenda=vazia`
 * mostra a agenda sem nada.
 */
function agendaDaBancada(): Blob {
  if (parametroDaBancada("agenda") === "vazia") return {};
  const dia = (n: number, hora: string) => {
    const d = new Date();
    d.setDate(d.getDate() + n);
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${m}-${dd}T${hora}`;
  };
  return {
    [CHAVE_AGENDA]: [
      { id: "b1", tipo: "consulta", quando: dia(3, "14:30"), onde: "Clínica Bem Nascer" },
      {
        id: "b2",
        tipo: "ultrassom",
        titulo: "Morfológico",
        quando: dia(12, "09:00"),
        onde: "Fetal Imagem · sala 3",
        nota: "Levar o pedido e o ultrassom anterior.",
      },
      {
        id: "b3",
        tipo: "exame",
        titulo: "Exames de sangue",
        quando: dia(-9, "07:30"),
        onde: "Laboratório Vida",
        nota: "Tudo normal. Repetir o hemograma com 28 semanas.",
      },
    ],
  };
}

/** Uma rota com a bancada junto, para a navegação dentro dela não perdê-la. */
export function rota(caminho: string): string {
  if (!ehBancada()) return caminho;
  const q = new URLSearchParams();
  for (const k of QUE_VIAJAM) {
    const v = k === "bancada" ? "1" : parametroDaBancada(k);
    if (v != null) q.set(k, v);
  }
  return `${caminho}${caminho.includes("?") ? "&" : "?"}${q.toString()}`;
}

/** O blob de uma jornada em andamento: a semana com dias fechados, parciais e hoje. */
export function blobDaBancada(hojeD: number, pos: boolean): Blob {
  const estado = estadoDaBancada();
  const blob: Blob = { ...agendaDaBancada() };
  const cinco = {
    desafio: true,
    w_movement: true,
    w_meditation: true,
    w_bonding: true,
    w_gratitude: true,
    bemestar: true,
  };
  if (pos) {
    for (let d = hojeD - 6; d < hojeD; d++)
      if (d >= 7 && d !== hojeD - 3) blob[`dc-path-pos-day-${d}`] = { desafio: true };
    if (estado === "fechado")
      blob[`dc-path-pos-day-${hojeD}`] = { desafio: true, w_meditation: true, w_gratitude: true };
    return blob;
  }
  const feitos: number[] = [];
  for (let d = hojeD - 14; d < hojeD; d++) {
    if (d < 7) continue;
    const resto = (hojeD - d) % 4;
    if (resto === 2) {
      blob[`dc-path-day-${d}`] = {
        desafio: true,
        w_meditation: true,
        w_gratitude: true,
        bemestar: true,
      };
    } else {
      blob[`dc-path-day-${d}`] = cinco;
      feitos.push(d);
    }
  }
  if (estado === "fechado") {
    blob[`dc-path-day-${hojeD}`] = cinco;
    feitos.push(hojeD);
  } else {
    blob[`dc-path-day-${hojeD}`] = { desafio: true, w_meditation: true, bemestar: true };
  }
  blob["dc-path-done-days"] = feitos;
  blob["dc-path-stickers"] = Array.from(new Set(feitos.map((d) => Math.floor(d / 7))));
  const pele = parametroDaBancada("pele");
  if (pele) blob["dc-path-skin"] = pele;
  return blob;
}
