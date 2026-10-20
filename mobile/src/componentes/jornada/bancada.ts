import type { Blob } from "~/lib/jornada/momentos";
import { ehBancada, parametroDaBancada } from "~/lib/bancada";
import { CHAVE_AGENDA } from "~/lib/agenda/agenda";
import { CHAVE_NASCIMENTO } from "~/lib/jornada/nascimento";
import {
  CHAVE_FEITOS_POS,
  CHAVE_FIGURINHAS_POS,
  CHAVE_NASCIMENTO_FESTEJADO,
} from "~/lib/jornada/pos-parto";

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
 *   /jornada?bancada=1&pos=1            pós-parto (bebê com 20 dias; `&idade=N`, outra idade)
 *   /jornada?bancada=1&pos=1&festa=1    a festa da chegada (`&idade=0`: nasceu hoje)
 *   /jornada?bancada=1&pos=1&humor=Triste  o check-in marcado (e o apoio)
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
  "idade",
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
    /* O 4º trimestre: as duas últimas semanas com dias completos (as três
       tarefas) e alguns pela metade; hoje com 1 de 3 (ou 3 de 3, `fechado`). */
    const feitosPos: number[] = [];
    for (let d = Math.max(7, hojeD - 13); d < hojeD && d <= 90; d++) {
      if ((hojeD - d) % 4 === 2) blob[`dc-path-pos-day-${d}`] = { humor: true, desafio: true };
      else {
        blob[`dc-path-pos-day-${d}`] = { humor: true, desafio: true, leitura: true };
        feitosPos.push(d);
      }
    }
    if (hojeD <= 90)
      blob[`dc-path-pos-day-${hojeD}`] =
        estado === "fechado"
          ? { humor: true, desafio: true, leitura: true, w_meditation: true }
          : { desafio: true };
    if (estado === "fechado" && hojeD <= 90) feitosPos.push(hojeD);
    blob[CHAVE_FEITOS_POS] = feitosPos;
    blob[CHAVE_FIGURINHAS_POS] = Array.from(new Set(feitosPos.map((d) => Math.floor(d / 7))));
    /* O que a gestação deixou: o álbum (sem as semanas 1–3 e 17) e os dias de cinco estrelas. */
    blob["dc-path-stickers"] = Array.from({ length: 40 }, (_, i) => i + 1).filter(
      (w) => w > 3 && w !== 17,
    );
    blob["dc-path-done-days"] = Array.from({ length: 221 }, (_, i) => i + 60).filter(
      (d) => d % 3 !== 0,
    );
    const nasc = new Date();
    nasc.setDate(nasc.getDate() - (hojeD - 7));
    const ymd = `${nasc.getFullYear()}-${String(nasc.getMonth() + 1).padStart(2, "0")}-${String(nasc.getDate()).padStart(2, "0")}`;
    blob[CHAVE_NASCIMENTO] = { date: ymd, hora: "6:42", pesoG: 3250, cm: 48.5 };
    /* `&humor=Triste`: o check-in de hoje já marcado (o apoio aparece). */
    const humor = parametroDaBancada("humor");
    if (humor && hojeD <= 90) {
      const h = new Date();
      const hoje = `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, "0")}-${String(h.getDate()).padStart(2, "0")}`;
      blob["dc-path-checkin"] = { last: hoje, streak: 3, mood: humor };
      blob[`dc-path-pos-day-${hojeD}`] = {
        ...(blob[`dc-path-pos-day-${hojeD}`] as object),
        humor: true,
      };
    }
    /* `&festa=1`: a festa da chegada ainda não foi vista. */
    blob[CHAVE_NASCIMENTO_FESTEJADO] = parametroDaBancada("festa") !== "1";
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
