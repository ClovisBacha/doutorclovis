import {
  leituraDaGlicemia,
  sinalPressao,
  validaRegistro,
  vozDaPaciente,
  type Gravidade,
} from "@/lib/sinais-clinicos";
import { dataCurta, numeroBR } from "./formato";

/**
 * OS REGISTROS DE SAÚDE (health_logs) — o que a tela precisa decidir, puro.
 *
 * ⚠️ Nenhum limite clínico mora aqui: a gravidade de cada número vem SÓ de
 * `@/lib/sinais-clinicos` (a régua do site e do painel). Este arquivo só
 * monta a linha, escolhe a frase e resume.
 */

export type RegistroDeSaude = {
  id: string;
  user_id?: string;
  log_date: string;
  weight_kg: number | null;
  systolic: number | null;
  diastolic: number | null;
  glucose_mg_dl: number | null;
  notes: string | null;
  created_at?: string | null;
};

export type FormDeRegistro = {
  weight_kg: string;
  systolic: string;
  diastolic: string;
  glucose_mg_dl: string;
  notes: string;
};

export const FORM_VAZIO: FormDeRegistro = {
  weight_kg: "",
  systolic: "",
  diastolic: "",
  glucose_mg_dl: "",
  notes: "",
};

/** "68,4" → 68.4; vazio → null. */
export function numeroDoCampo(v: string): number | null {
  const t = (v ?? "").trim();
  if (t === "") return null;
  return Number(t.replace(",", "."));
}

/**
 * A linha para o `insert`, só com os campos preenchidos (coluna que ainda não
 * existe no banco não pode derrubar o registro), ou a frase do problema.
 *
 * ⚠️ Pressão e glicemia são `integer` no banco: "118,5" chegaria lá como erro
 * de sintaxe e a paciente leria "tente de novo" sobre um número que falha
 * sempre. Isto é FORMATO da coluna, não limite clínico.
 */
export function linhaParaInserir(
  form: FormDeRegistro,
  uid: string,
  hoje: string,
): { ok: true; linha: Record<string, unknown> } | { ok: false; erro: string } {
  const campos = {
    weight_kg: form.weight_kg,
    systolic: form.systolic,
    diastolic: form.diastolic,
    glucose_mg_dl: form.glucose_mg_dl,
  };
  const algum = Object.values(campos).some((v) => (v ?? "").trim() !== "");
  if (!algum) return { ok: false, erro: "Preencha pelo menos uma medida." };
  const erro = validaRegistro(campos);
  if (erro) return { ok: false, erro };
  for (const [campo, nome] of [
    ["systolic", "A pressão"],
    ["diastolic", "A pressão"],
    ["glucose_mg_dl", "A glicemia"],
  ] as const) {
    const n = numeroDoCampo(campos[campo]);
    if (n != null && !Number.isInteger(n)) {
      return { ok: false, erro: `${nome} vai em número inteiro, sem vírgula.` };
    }
  }
  const linha: Record<string, unknown> = { user_id: uid, log_date: hoje };
  for (const campo of ["weight_kg", "systolic", "diastolic", "glucose_mg_dl"] as const) {
    const n = numeroDoCampo(campos[campo]);
    if (n != null) linha[campo] = n;
  }
  const nota = (form.notes ?? "").trim();
  if (nota) linha.notes = nota;
  return { ok: true, linha };
}

/**
 * A frase de quando o banco recusou.
 *
 * ⚠️ 23514 é o CHECK do banco: o código chega antes do SQL, e nessa janela o
 * app aceita um número que o banco ainda recusa. "Tente de novo" seria
 * conselho errado — repetir o mesmo número falha para sempre.
 */
export function mensagemDoErroDeGravacao(erro: { code?: string } | null | undefined): string {
  if (erro?.code === "23514") {
    return "O número está certo, mas o banco do app ainda não aceita esse valor. Anote e mostre na sua próxima consulta.";
  }
  return "Não conseguimos salvar agora. Confira a internet e tente de novo — nada foi gravado.";
}

export type LeituraDoRegistro = {
  /** null quando o registro não tem pressão (ou o par é incompleto). */
  pressao: { gravidade: Gravidade; rotulo: string; orientacao: string | null } | null;
  glicemia: { gravidade: Gravidade; rotulo: string; orientacao: string | null } | null;
  pior: Gravidade;
};

const PESO: Record<Gravidade, number> = { grave: 0, atencao: 1, normal: 2 };

/** A gravidade de cada medida, SÓ pela régua de sinais-clinicos. */
export function lerRegistro(r: Pick<RegistroDeSaude, "systolic" | "diastolic" | "glucose_mg_dl">) {
  const sp = sinalPressao(r.systolic, r.diastolic);
  const voz = vozDaPaciente(sp, "pressao");
  const pressao = sp
    ? { gravidade: sp.gravidade, rotulo: voz?.rotulo ?? sp.nota, orientacao: voz?.orientacao ?? null }
    : null;
  const glicemia = leituraDaGlicemia(r.glucose_mg_dl);
  const gs = [pressao?.gravidade, glicemia?.gravidade].filter(Boolean) as Gravidade[];
  const pior = gs.sort((a, b) => PESO[a] - PESO[b])[0] ?? "normal";
  return { pressao, glicemia, pior } satisfies LeituraDoRegistro;
}

/** Ordena do mais recente ao mais antigo (data civil, depois o carimbo). */
export function maisRecentesPrimeiro(lista: readonly RegistroDeSaude[]): RegistroDeSaude[] {
  return [...lista].sort((a, b) => {
    if (a.log_date !== b.log_date) return a.log_date < b.log_date ? 1 : -1;
    return (b.created_at ?? "").localeCompare(a.created_at ?? "");
  });
}

const temPressao = (r: RegistroDeSaude) => r.systolic != null && r.diastolic != null;

/** O registro de pressão mais recente — é ele que decide o cartão vermelho. */
export function ultimaPressao(lista: readonly RegistroDeSaude[]): RegistroDeSaude | null {
  return maisRecentesPrimeiro(lista).find(temPressao) ?? null;
}

/**
 * "68,4 kg · pressão 118/76" — o último peso e a última pressão, cada um do
 * seu registro mais recente. `null` quando não há nenhum dos dois.
 */
export function resumoParaOHub(lista: readonly RegistroDeSaude[]): string | null {
  const ordem = maisRecentesPrimeiro(lista);
  const peso = ordem.find((r) => r.weight_kg != null);
  const pressao = ordem.find(temPressao);
  const partes: string[] = [];
  if (peso) partes.push(`${numeroBR(Number(peso.weight_kg))} kg`);
  if (pressao) partes.push(`pressão ${pressao.systolic}/${pressao.diastolic}`);
  if (!partes.length) {
    const g = ordem.find((r) => r.glucose_mg_dl != null);
    if (g) partes.push(`glicemia ${g.glucose_mg_dl}`);
  }
  return partes.length ? partes.join(" · ") : null;
}

/** O que o registro tem, em uma linha: "68,4 kg · pressão 118/76 · glicemia 92 mg/dL". */
export function valoresDoRegistro(r: RegistroDeSaude): string {
  const p: string[] = [];
  if (r.weight_kg != null) p.push(`${numeroBR(Number(r.weight_kg))} kg`);
  if (temPressao(r)) p.push(`pressão ${r.systolic}/${r.diastolic}`);
  if (r.glucose_mg_dl != null) p.push(`glicemia ${r.glucose_mg_dl} mg/dL`);
  if (!p.length && r.notes) p.push("só a observação");
  return p.join(" · ");
}

/** A pergunta da confirmação — diz exatamente o que vai sumir. */
export function perguntaParaApagar(r: RegistroDeSaude): string {
  const quando = dataCurta(r.log_date);
  const o = valoresDoRegistro(r);
  return `Apagar o registro de ${quando}${o ? ` (${o})` : ""}? Isso não tem volta.`;
}

export type PontoDoGrafico = { rotulo: string; valor: number; valor2?: number; gravidade: Gravidade };

/** A série da pressão, em ordem cronológica, cada ponto com a gravidade do par. */
export function serieDePressao(lista: readonly RegistroDeSaude[], maximo = 14): PontoDoGrafico[] {
  return maisRecentesPrimeiro(lista)
    .filter(temPressao)
    .slice(0, maximo)
    .reverse()
    .map((r) => ({
      rotulo: dataCurta(r.log_date),
      valor: r.systolic as number,
      valor2: r.diastolic as number,
      gravidade: sinalPressao(r.systolic, r.diastolic)?.gravidade ?? "normal",
    }));
}

/** A série do peso. Peso sozinho não tem gravidade aqui — todo ponto é neutro. */
export function serieDePeso(lista: readonly RegistroDeSaude[], maximo = 14): PontoDoGrafico[] {
  return maisRecentesPrimeiro(lista)
    .filter((r) => r.weight_kg != null)
    .slice(0, maximo)
    .reverse()
    .map((r) => ({
      rotulo: dataCurta(r.log_date),
      valor: Number(r.weight_kg),
      gravidade: "normal" as const,
    }));
}
