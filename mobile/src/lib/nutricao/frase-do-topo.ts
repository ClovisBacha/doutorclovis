import { computeGestation } from "@/lib/gestacao";
import {
  nutricaoDaSemana,
  nutricaoDoPosParto,
  type FraseDaSemana,
} from "@/lib/nutricao-da-semana";

/**
 * A frase do topo: a da semana da gestação, ou a do pós-parto (pela idade do
 * bebê). As frases e as cinco proibições delas moram no site
 * (`nutricao-da-semana.ts`); aqui só se escolhe QUAL régua chamar.
 *
 * ⚠️ Modo Cuidado → nada (as duas réguas já calam, e o `if` aqui é a segunda
 * tranca). Sem data → nada: frase genérica com cara de personalizada ensina
 * que o "para a sua semana" do app não quer dizer nada.
 */
type PerfilDaFrase = {
  birth_date?: string | null;
  lmp_date?: string | null;
  reference_date?: string | null;
  reference_weeks?: number | null;
  reference_days?: number | null;
} | null;

/** Dias inteiros entre a data civil `ymd` e hoje, no relógio do aparelho. */
export function diasDesde(ymd: string, hoje: Date = new Date()): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd);
  if (!m) return null;
  const inicio = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const dia = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const d = Math.round((dia.getTime() - inicio.getTime()) / 86400000);
  return d >= 0 ? d : null;
}

/**
 * ⚠️ O APP NUNCA CRAVA O GÊNERO DO BEBÊ, e as frases do site dizem "ele"
 * ("Ele está fazendo o próprio sangue", "os ossos dele"). Copiar as frases
 * para reescrever divergiria no primeiro ajuste do site; por isso a troca é
 * feita na hora, sobre o texto de lá: "ele" → "o bebê", "dele" → "do bebê",
 * "nele" → "no bebê". Nessas frases o "ele" é SEMPRE o bebê (é a regra de
 * escrita do arquivo: o sujeito é o bebê), e `socorro.test.ts` varre todas.
 */
export function semGeneroDoBebe(texto: string): string {
  const fora = "(?![\\p{L}\\p{N}])";
  const antes = "(?<![\\p{L}\\p{N}])";
  return texto
    .replace(new RegExp(`${antes}dele${fora}`, "gu"), "do bebê")
    .replace(new RegExp(`${antes}nele${fora}`, "gu"), "no bebê")
    .replace(new RegExp(`${antes}Ele${fora}`, "gu"), "O bebê")
    .replace(new RegExp(`${antes}ele${fora}`, "gu"), "o bebê");
}

export function fraseDoTopo(
  perfil: PerfilDaFrase,
  cuidado: boolean,
  hoje: Date = new Date(),
): FraseDaSemana | null {
  if (cuidado || !perfil) return null;
  let frase: FraseDaSemana | null;
  if (perfil.birth_date) {
    frase = nutricaoDoPosParto(diasDesde(perfil.birth_date, hoje), false);
  } else {
    const g = computeGestation({
      lmp: perfil.lmp_date ?? null,
      referenceDate: perfil.reference_date ?? null,
      referenceWeeks: perfil.reference_weeks ?? null,
      referenceDays: perfil.reference_days ?? null,
      today: hoje,
    });
    frase = nutricaoDaSemana(g?.weeks ?? null, false);
  }
  return frase ? { titulo: semGeneroDoBebe(frase.titulo), texto: semGeneroDoBebe(frase.texto) } : null;
}
