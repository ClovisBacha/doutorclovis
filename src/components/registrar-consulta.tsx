/**
 * Onde o médico registra a consulta.
 *
 * Sem esta tela a consulta como objeto é inerte: a tabela existe, o bloco
 * "Desde a última consulta" existe, e não há de onde vir o primeiro registro.
 *
 * O desenho segue a ordem em que ele já trabalha — mede, conclui, decide, conta
 * para ela — e não a ordem das colunas do banco.
 *
 * A decisão mais importante aqui é a separação dos dois textos. `achados` e
 * `conduta` são o prontuário: escritos para outro médico, abreviados, às vezes
 * com hipótese que assustaria sem contexto. `resumo_paciente` é o que ele
 * escolhe contar, escrito para ela. Um campo só obrigaria a escolher entre
 * registrar mal e assustar — e hoje o produto não tem nenhum dos dois, então
 * ela sai da consulta anotando à mão o que ele disse.
 */

import { useState } from "react";
import { toast } from "sonner";
import { salvarConsulta } from "@/lib/clinical.functions";
import { sinalPressao } from "@/lib/sinais-clinicos";

type Campos = {
  ocorridaEm: string;
  /** A HORA da consulta. Sem ela, registrar às 22h a consulta das 14h punha o
      corte às 22h — e o registro que ela fez às 15h, logo depois de ele mandá-la
      para casa, sumia do "o que mudou". */
  hora: string;
  tipo: "presencial" | "teleconsulta" | "retorno" | "urgencia";
  systolic: string;
  diastolic: string;
  pesoKg: string;
  alturaUterinaCm: string;
  bpmFetal: string;
  achados: string;
  conduta: string;
  resumoPaciente: string;
};

const VAZIO: Campos = {
  ocorridaEm: "",
  hora: "",
  tipo: "presencial",
  systolic: "",
  diastolic: "",
  pesoKg: "",
  alturaUterinaCm: "",
  bpmFetal: "",
  achados: "",
  conduta: "",
  resumoPaciente: "",
};

/** `""` vira `null`; vírgula decimal vira ponto (ele digita "72,4"). */
function num(v: string): number | null {
  const t = v.trim().replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function Campo({
  rot,
  valor,
  onChange,
  tipo = "text",
  sufixo,
  larg = "",
  max,
}: {
  rot: string;
  valor: string;
  onChange: (v: string) => void;
  tipo?: string;
  sufixo?: string;
  larg?: string;
  max?: string;
}) {
  return (
    <label className={`block ${larg}`}>
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {rot}
      </span>
      <div className="mt-0.5 flex items-center gap-1">
        <input
          type={tipo}
          inputMode={tipo === "number" ? "decimal" : undefined}
          value={valor}
          max={max}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-xl border border-border bg-background px-2.5 py-1.5 text-sm tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        />
        {sufixo && <span className="shrink-0 text-[11px] text-muted-foreground">{sufixo}</span>}
      </div>
    </label>
  );
}

export function RegistrarConsulta({
  pacienteId,
  tokenFn,
  onSalvou,
}: {
  pacienteId: string;
  tokenFn: () => Promise<string>;
  onSalvou: () => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [f, setF] = useState<Campos>(VAZIO);
  const [salvando, setSalvando] = useState(false);
  const set = (k: keyof Campos) => (v: string) => setF((x) => ({ ...x, [k]: v }));

  /* A pressão aferida ganha a MESMA etiqueta que a caseira dela — a régua é uma
     só. Aparece enquanto ele digita: um 175/115 marcado na hora do registro é
     mais útil que o mesmo número marcado três dias depois na ficha. */
  const sinal = sinalPressao(num(f.systolic), num(f.diastolic));

  if (!aberto) {
    return (
      <button
        onClick={() => setAberto(true)}
        className="press w-full rounded-2xl border border-dashed border-primary/40 bg-primary/5 px-4 py-3 text-sm font-semibold text-primary"
      >
        + Registrar consulta
      </button>
    );
  }

  /* As faixas, do lado do FORMULÁRIO. Sem elas, o `inputValidator` do servidor
     lança e o `catch` dizia "Falha de conexão — a consulta não foi salva": um
     obstetra que digitou 18 em vez de 180 ia olhar a rede. */
  const FAIXAS: Record<string, { min: number; max: number; nome: string }> = {
    systolic: { min: 50, max: 300, nome: "A sistólica" },
    diastolic: { min: 20, max: 200, nome: "A diastólica" },
    pesoKg: { min: 25, max: 350, nome: "O peso" },
    alturaUterinaCm: { min: 5, max: 60, nome: "A altura uterina" },
    bpmFetal: { min: 60, max: 220, nome: "O BCF" },
  };

  function foraDeFaixa(): string | null {
    for (const [campo, faixa] of Object.entries(FAIXAS)) {
      const v = num(f[campo as keyof Campos]);
      if (v == null) continue;
      if (v < faixa.min || v > faixa.max) {
        return `${faixa.nome} precisa ficar entre ${faixa.min} e ${faixa.max}. Confira o número.`;
      }
    }
    return null;
  }

  async function salvar() {
    /* O par de pressão é tudo-ou-nada, igual ao CHECK do banco e à validação do
       servidor. Barrar aqui é o que faz ele ler a frase certa em vez de perder
       o que digitou num erro genérico. */
    const s = num(f.systolic);
    const d = num(f.diastolic);
    if ((s == null) !== (d == null)) {
      toast.error("A pressão precisa dos dois números — sistólica e diastólica.");
      return;
    }
    const erroFaixa = foraDeFaixa();
    if (erroFaixa) {
      toast.error(erroFaixa);
      return;
    }
    /* Altura uterina, BCF e o resumo para ela CONTAM. Antes, "AU 32 cm, BCF
       142, escrevi para ela o que fazer" era recusado com "registre ao menos
       uma medida" — dizendo que ele não registrou nada tendo registrado três
       coisas, incluindo as duas medidas que só existem em consultório. */
    const vazio =
      !f.achados.trim() &&
      !f.conduta.trim() &&
      !f.resumoPaciente.trim() &&
      s == null &&
      num(f.pesoKg) == null &&
      num(f.alturaUterinaCm) == null &&
      num(f.bpmFetal) == null;
    if (vazio) {
      toast.error("Registre ao menos uma medida ou uma anotação.");
      return;
    }
    setSalvando(true);
    try {
      const r = await salvarConsulta({
        data: {
          accessToken: await tokenFn(),
          pacienteId,
          /* Sem data digitada, agora. Com data, o meio-dia daquele dia: o
             médico registra "a consulta de terça" e não a hora exata, e um
             timestamp à meia-noite cairia no dia anterior em fuso negativo. */
          /* Data + hora locais convertidas para UTC pelo próprio navegador.
             Sem hora, meio-dia local — que cai no dia certo em qualquer fuso. */
          ocorridaEm: f.ocorridaEm
            ? new Date(`${f.ocorridaEm}T${f.hora || "12:00"}:00`).toISOString()
            : undefined,
          tipo: f.tipo,
          achados: f.achados.trim() || undefined,
          conduta: f.conduta.trim() || undefined,
          resumoPaciente: f.resumoPaciente.trim() || undefined,
          systolic: s == null ? null : Math.round(s),
          diastolic: d == null ? null : Math.round(d),
          pesoKg: num(f.pesoKg),
          alturaUterinaCm: num(f.alturaUterinaCm),
          bpmFetal: (() => {
            const b = num(f.bpmFetal);
            return b == null ? null : Math.round(b);
          })(),
        },
      });
      if (!r.ok) {
        const motivo = "motivo" in r ? r.motivo : null;
        toast.error(
          motivo === "pa_incompleta"
            ? "A pressão precisa dos dois números."
            : motivo === "duplicada"
              ? "Já existe uma consulta registrada nesta data e hora."
              : motivo === "banco_desatualizado"
                ? "Falta aplicar o SQL das consultas (APLICAR_CONSULTA.sql) no Supabase."
                : "Não consegui salvar a consulta. Tente de novo.",
        );
        return;
      }
      toast.success("Consulta registrada ✓");
      setF(VAZIO);
      setAberto(false);
      onSalvou();
    } catch {
      toast.error("Falha de conexão — a consulta não foi salva.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="rounded-3xl border border-border bg-card p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h4 className="font-serif text-lg text-foreground">Registrar consulta</h4>
        <button
          onClick={() => setAberto(false)}
          className="text-xs text-muted-foreground underline underline-offset-2"
        >
          cancelar
        </button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {/* `max` de hoje: uma data em 2027 fazia `consultas[0]` ser uma consulta
            no futuro, o corte de "o que mudou" ficava no futuro, e o painel
            passava a dizer "ela não registrou nada" para sempre — escondendo a
            175/115 que ela registrou hoje de manhã. */}
        <Campo
          rot="Data"
          tipo="date"
          valor={f.ocorridaEm}
          onChange={set("ocorridaEm")}
          max={new Date().toLocaleDateString("en-CA")}
        />
        <Campo rot="Hora" tipo="time" valor={f.hora} onChange={set("hora")} />
        <label className="block">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Tipo
          </span>
          <select
            value={f.tipo}
            onChange={(e) => set("tipo")(e.target.value)}
            className="mt-0.5 w-full rounded-xl border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <option value="presencial">Presencial</option>
            <option value="retorno">Retorno</option>
            <option value="teleconsulta">Teleconsulta</option>
            <option value="urgencia">Urgência</option>
          </select>
        </label>
        <Campo rot="Peso" tipo="number" sufixo="kg" valor={f.pesoKg} onChange={set("pesoKg")} />
        <Campo
          rot="Altura uterina"
          tipo="number"
          sufixo="cm"
          valor={f.alturaUterinaCm}
          onChange={set("alturaUterinaCm")}
        />
        <Campo rot="Sistólica" tipo="number" valor={f.systolic} onChange={set("systolic")} />
        <Campo rot="Diastólica" tipo="number" valor={f.diastolic} onChange={set("diastolic")} />
        <Campo
          rot="BCF (bebê)"
          tipo="number"
          sufixo="bpm"
          valor={f.bpmFetal}
          onChange={set("bpmFetal")}
        />
      </div>

      {sinal && sinal.gravidade !== "normal" && (
        <p className="mt-2 rounded-xl bg-rose-50 px-3 py-1.5 text-[12px] font-semibold text-rose-800">
          {sinal.nota}
        </p>
      )}

      <div className="mt-3 space-y-2">
        <label className="block">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Achados
          </span>
          <textarea
            rows={2}
            value={f.achados}
            onChange={(e) => set("achados")(e.target.value)}
            placeholder="O que você viu e mediu."
            className="mt-0.5 w-full rounded-xl border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          />
        </label>
        <label className="block">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Conduta
          </span>
          <textarea
            rows={2}
            value={f.conduta}
            onChange={(e) => set("conduta")(e.target.value)}
            placeholder="O que você decidiu — é isto que aparece na próxima consulta."
            className="mt-0.5 w-full rounded-xl border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          />
        </label>
        <label className="block">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-primary">
            O que ela vai ler
          </span>
          <textarea
            rows={2}
            value={f.resumoPaciente}
            onChange={(e) => set("resumoPaciente")(e.target.value)}
            placeholder="Escrito para ela. Os dois campos acima ficam só com você."
            className="mt-0.5 w-full rounded-xl border border-primary/30 bg-primary/5 px-2.5 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          />
          <span className="mt-0.5 block text-[10px] leading-snug text-muted-foreground">
            Sem isto ela sai da consulta anotando à mão o que você disse — e o que ela anota é o que
            ela lembrou.
          </span>
        </label>
      </div>

      <button
        onClick={salvar}
        disabled={salvando}
        className="press mt-3 w-full rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
      >
        {salvando ? "Salvando…" : "Salvar consulta"}
      </button>
    </div>
  );
}
