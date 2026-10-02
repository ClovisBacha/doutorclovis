import type { Blob } from "~/lib/jornada/momentos";
import { ehBancada, parametroDaBancada } from "~/lib/bancada";

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
 */

export function estadoDaBancada(): string | null {
  return parametroDaBancada("estado");
}

/** Os parâmetros que valem para a bancada inteira (passam de tela em tela). */
const QUE_VIAJAM = ["bancada", "semana", "luto", "pos", "bebe"] as const;

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
  const blob: Blob = {};
  const cinco = { desafio: true, w_movement: true, w_meditation: true, w_bonding: true, w_gratitude: true, bemestar: true };
  if (pos) {
    for (let d = hojeD - 6; d < hojeD; d++) if (d >= 7 && d !== hojeD - 3) blob[`dc-path-pos-day-${d}`] = { desafio: true };
    if (estado === "fechado") blob[`dc-path-pos-day-${hojeD}`] = { desafio: true, w_meditation: true, w_gratitude: true };
    return blob;
  }
  const feitos: number[] = [];
  for (let d = hojeD - 14; d < hojeD; d++) {
    if (d < 7) continue;
    const resto = (hojeD - d) % 4;
    if (resto === 2) {
      blob[`dc-path-day-${d}`] = { desafio: true, w_meditation: true, w_gratitude: true, bemestar: true };
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
  return blob;
}
