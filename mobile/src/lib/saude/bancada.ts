import type { SessaoDeChutes } from "@/lib/serie-de-chutes";
import type { SessaoEmCurso } from "./chutes";
import type { ContracaoDaTela } from "./contracoes";
import { inicioDoDia } from "./formato";

/**
 * Os dados de exemplo da BANCADA (só web, só com ?bancada=1). Entram nos
 * MESMOS estados da produção; nada aqui chama servidor nem grava.
 */

/** Seis contagens dos últimos dias e uma de hoje (dá número ao bloco do hub). */
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
  /* Contagens de tamanhos diferentes: sem meta, ninguém conta "até 10". */
  const lista = [
    s(1, 20, 25, 14),
    s(2, 20, 14, 9),
    s(3, 21, 11, 11),
    s(4, 20, 17, 16),
    s(5, 20, 12, 8),
    s(6, 21, 15, 12),
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

/**
 * A contagem em curso. Não há mais estado de "alerta": o app não julga a
 * contagem (21/10/2026) — quem sente o bebê diferente abre o SOS.
 */
export function sessaoEmCursoDeExemplo(agora: number, estado: string | null): SessaoEmCurso | null {
  if (estado === "contando")
    return { startedAt: new Date(agora - 12 * 60000 - 14000).toISOString(), count: 6, forca: 2 };
  return null;
}

/** Contrações de exemplo: três hoje (em qualquer hora do relógio) e duas ontem à noite. */
export function contracoesDeExemplo(agora: number): ContracaoDaTela[] {
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
