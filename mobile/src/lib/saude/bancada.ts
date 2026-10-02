import type { SessaoDeChutes } from "@/lib/serie-de-chutes";
import type { SessaoEmCurso } from "./chutes";
import type { ContracaoDaTela } from "./contracoes";
import { inicioDoDia } from "./formato";
import type { RegistroDeSaude } from "./registros";

/**
 * Os dados de exemplo da BANCADA (só web, só com ?bancada=1). Entram nos
 * MESMOS estados da produção; nada aqui chama servidor nem grava.
 */

function ymd(agora: number, diasAtras: number): string {
  const d = new Date(agora - diasAtras * 86400000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Uma pressão grave no registro mais recente e uma glicemia de 118. */
export function registrosDeExemplo(agora: number): RegistroDeSaude[] {
  const r = (
    dias: number,
    w: number | null,
    s: number | null,
    d: number | null,
    g: number | null,
    notes: string | null = null,
  ): RegistroDeSaude => ({
    id: `exemplo-${dias}`,
    log_date: ymd(agora, dias),
    weight_kg: w,
    systolic: s,
    diastolic: d,
    glucose_mg_dl: g,
    notes,
    created_at: new Date(agora - dias * 86400000).toISOString(),
  });
  return [
    r(0, 68.4, 165, 112, null, "Dor de cabeça desde a tarde"),
    r(1, null, null, null, 118),
    r(2, 68.1, 132, 84, 88),
    r(4, 67.9, 118, 76, null),
    r(6, 67.6, 121, 78, 92),
    r(9, 67.2, 114, 72, null),
    r(12, 66.8, 142, 92, null),
    r(15, 66.5, 116, 74, 85),
  ];
}

/** Seis contagens: cinco completas e normais e uma de ontem que não chegou a 10. */
export function sessoesDeExemplo(agora: number): SessaoDeChutes[] {
  const s = (dias: number, hora: number, min: number, kicks: number): SessaoDeChutes => {
    const ini = new Date(agora - dias * 86400000);
    ini.setHours(hora, 0, 0, 0);
    return {
      started_at: ini.toISOString(),
      ended_at: new Date(ini.getTime() + min * 60000).toISOString(),
      kick_count: kicks,
    };
  };
  const lista = [
    s(1, 20, 25, 10),
    s(2, 20, 14, 10),
    s(3, 21, 11, 10),
    s(4, 20, 17, 10),
    s(5, 20, 12, 10),
    s(6, 21, 15, 10),
  ];
  /* Uma de hoje, a qualquer hora do relógio: dá número ao bloco do hub. */
  const ini = noDiaDeHoje(agora, 0.5);
  lista.unshift({
    started_at: new Date(ini).toISOString(),
    ended_at: new Date(Math.min(agora, ini + 19 * 60000)).toISOString(),
    kick_count: 12,
  });
  return lista;
}

export function sessaoEmCursoDeExemplo(agora: number, estado: string | null): SessaoEmCurso | null {
  if (estado === "contando")
    return { startedAt: new Date(agora - 12 * 60000 - 14000).toISOString(), count: 6, forca: 2 };
  if (estado === "alerta")
    return { startedAt: new Date(agora - 125 * 60000).toISOString(), count: 4, forca: 1 };
  return null;
}

/** Contrações de exemplo por estado: padrão 5-1-1, prematuro, ou poucas hoje. */
export function contracoesDeExemplo(agora: number, estado: string | null): ContracaoDaTela[] {
  const serie = (n: number, cadaMin: number, durSeg: number, intens: (i: number) => number) =>
    Array.from({ length: n }, (_, i) => {
      const ini = agora - (n - i) * cadaMin * 60000 + 30000;
      return {
        id: `exemplo-${i}`,
        started_at: new Date(ini).toISOString(),
        ended_at: new Date(ini + durSeg * 1000).toISOString(),
        intensity: intens(i),
      };
    });
  if (estado === "cinco") return serie(14, 5, 62, (i) => (i < 5 ? 2 : 3));
  if (estado === "prematuro") return serie(7, 8, 45, () => 2);
  /* Três hoje (em qualquer hora do relógio) e duas ontem à noite. */
  const de = (t: number, dur: number, intensity: number, id: string): ContracaoDaTela => ({
    id: `exemplo-${id}`,
    started_at: new Date(t).toISOString(),
    ended_at: new Date(Math.min(agora, t + dur * 1000)).toISOString(),
    intensity,
  });
  const ontem = (h: number, m: number) => {
    const d = new Date(inicioDoDia(agora) - 86400000);
    d.setHours(h, m, 0, 0);
    return d.getTime();
  };
  return [
    de(noDiaDeHoje(agora, 0.92), 51, 2, "h3"),
    de(noDiaDeHoje(agora, 0.7), 44, 2, "h2"),
    de(noDiaDeHoje(agora, 0.4), 38, 1, "h1"),
    de(ontem(22, 10), 40, 1, "o2"),
    de(ontem(21, 15), 35, 1, "o1"),
  ];
}

/** Um instante de hoje: a fração `f` do que já passou do dia. */
function noDiaDeHoje(agora: number, f: number): number {
  const hoje = inicioDoDia(agora);
  return Math.round(hoje + f * (agora - hoje));
}
