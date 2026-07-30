/**
 * O prontuário da paciente, na tela do médico.
 *
 * O que existia no lugar disto era um desenho do bebê ocupando metade da altura
 * do modal, quatro etiquetas (semana, DPP, bpm, Premium) e o log do chatbot.
 * Nenhuma pressão, nenhum peso, nenhuma medicação, nenhuma alergia. Para saber
 * o peso de uma paciente o médico tinha de sair daqui, abrir a aba de
 * Engajamento — uma tela de MÉTRICA DE USO —, achar o nome numa lista sem busca
 * e clicar "ver relatório", que só mostrava os últimos catorze dias.
 *
 * A ordem aqui não é estética, é a ordem em que um obstetra pergunta:
 *
 *   1. quem é, quantas semanas e dias, e o que na história dela muda conduta
 *   2. o que está fora de faixa AGORA
 *   3. para onde os números estão indo (tendência, não último valor)
 *   4. o que aconteceu desde a última vez
 *
 * Idade gestacional em SEMANAS E DIAS de propósito. "32 semanas" é o que a tela
 * antiga mostrava, e em obstetrícia o dia decide: corticoide, viabilidade,
 * 36+6 contra 37+0 são condutas diferentes.
 */

import { ESTILO_SINAL, sinalGlicemia, sinalPressao, type Gravidade } from "@/lib/sinais-clinicos";
import {
  serieDe,
  type EventoClinico,
  type FichaClinica,
  type Serie,
} from "@/lib/clinical.functions";
import { formataTelefone, linkTel } from "@/lib/telefone";

function idadeGestacional(dias: number | null): string {
  if (dias == null || dias < 0) return "—";
  return `${Math.floor(dias / 7)}s${dias % 7}d`;
}

function quando(iso: string): string {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (d <= 0) return "hoje";
  if (d === 1) return "ontem";
  if (d < 30) return `há ${d} dias`;
  return new Date(iso).toLocaleDateString("pt-BR");
}

const ROTULO_ESPECIE: Record<string, string> = {
  medida: "Medida",
  sintoma: "Sintomas",
  emergencia: "SOS",
  exame: "Exame",
  contracao: "Contração",
  humor: "Humor",
  movimento: "Movimentos",
  consulta: "Pré-consulta",
  pergunta: "Pergunta",
};

/** Um número com a etiqueta da própria régua clínica. */
function Medida({
  rotulo,
  valor,
  gravidade,
  nota,
}: {
  rotulo: string;
  valor: string;
  gravidade?: Gravidade;
  nota?: string;
}) {
  const marcado = gravidade && gravidade !== "normal";
  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {rotulo}
      </p>
      <p className="mt-0.5 font-serif text-xl tabular-nums text-foreground">{valor}</p>
      {marcado && (
        <span
          className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${ESTILO_SINAL[gravidade]}`}
        >
          {nota}
        </span>
      )}
    </div>
  );
}

/**
 * Tendência em palavras, não em seta.
 *
 * Uma seta para cima ao lado de "+0,3 mmHg/semana" sugere alarme onde não há —
 * e o oposto, uma seta igual para +12, esconde o que importa. O texto diz o
 * número e deixa o médico julgar.
 */
function Tendencia({ s }: { s: Serie }) {
  if (s.ultimo == null) return null;
  const v = s.variacaoSemanal;
  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {s.rotulo}
      </p>
      <p className="mt-0.5 font-serif text-xl tabular-nums text-foreground">
        {s.ultimo}
        <span className="ml-1 text-xs font-normal text-muted-foreground">{s.unidade}</span>
      </p>
      <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
        {v == null
          ? `${s.pontos.length} ${s.pontos.length === 1 ? "registro" : "registros"} — poucos para tendência`
          : v === 0
            ? "estável nas últimas semanas"
            : `${v > 0 ? "+" : ""}${v} ${s.unidade}/semana`}
      </p>
      {s.pontos.length > 1 && <Faisca pontos={s.pontos} />}
    </div>
  );
}

/** Linha da série, sem eixo e sem legenda: serve para ver a FORMA. */
function Faisca({ pontos }: { pontos: { em: string; valor: number }[] }) {
  const ultimos = pontos.slice(-20);
  const vs = ultimos.map((p) => p.valor);
  const min = Math.min(...vs);
  const max = Math.max(...vs);
  const faixa = max - min || 1;
  const d = ultimos
    .map((p, i) => {
      const x = (i / Math.max(1, ultimos.length - 1)) * 100;
      const y = 24 - ((p.valor - min) / faixa) * 20;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg viewBox="0 0 100 28" className="mt-1.5 h-7 w-full" preserveAspectRatio="none" aria-hidden>
      <path
        d={d}
        fill="none"
        stroke="var(--primary)"
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
      <circle
        cx="100"
        cy={(24 - ((vs[vs.length - 1] - min) / faixa) * 20).toFixed(1)}
        r="2"
        fill="var(--primary)"
      />
    </svg>
  );
}

export function ProntuarioPaciente({
  ficha,
  eventos,
  carregando,
  incompleto,
  onRegistrarDesfecho,
  registrando,
}: {
  ficha: FichaClinica | null;
  eventos: EventoClinico[];
  carregando: boolean;
  /** Alguma fonte não pôde ser lida — a tela avisa em vez de fingir completude. */
  incompleto: boolean;
  onRegistrarDesfecho: (fonte: string, fonteId: string) => void;
  registrando: string | null;
}) {
  if (carregando) return <div className="skeleton h-72 rounded-3xl" />;
  if (!ficha) {
    return (
      <p className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
        Não consegui carregar a ficha desta paciente.
      </p>
    );
  }

  const pa = serieDe(eventos, "systolic", "Pressão (sistólica)", "mmHg");
  const paD = serieDe(eventos, "diastolic", "Diastólica", "mmHg");
  const peso = serieDe(eventos, "weight_kg", "Peso", "kg");
  const gli = serieDe(eventos, "glucose_mg_dl", "Glicemia", "mg/dL");

  const sinalPA = sinalPressao(pa.ultimo, paD.ultimo);
  const sinalG = sinalGlicemia(gli.ultimo);

  const pendentes = eventos.filter((e) => e.gravidade !== "normal" && !e.tratado_em);
  const ganho =
    ficha.pesoPreGestacional != null && peso.ultimo != null
      ? Math.round((peso.ultimo - Number(ficha.pesoPreGestacional)) * 10) / 10
      : null;

  return (
    <div className="space-y-5">
      {incompleto && (
        <p className="rounded-2xl border border-amber-300 bg-amber-50/70 px-4 py-3 text-[12px] leading-snug text-amber-900">
          📡 Não consegui ler todos os registros dela. O que está abaixo pode estar incompleto —
          atualize antes de tomar uma decisão a partir desta tela.
        </p>
      )}

      {/* 1. QUEM É — e o que na história dela muda conduta */}
      <div className="rounded-3xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-serif text-2xl text-foreground">{ficha.nome ?? "Paciente"}</h3>
          <span className="font-serif text-lg tabular-nums text-primary">
            {idadeGestacional(ficha.gestDias)}
          </span>
        </div>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted-foreground">
          {ficha.dpp && <span>DPP {new Date(ficha.dpp).toLocaleDateString("pt-BR")}</span>}
          {ficha.gestacaoNumero != null && <span>{ficha.gestacaoNumero}ª gestação</span>}
          {ficha.tipoSanguineo && <span>Sangue {ficha.tipoSanguineo}</span>}
          {ficha.telefone && linkTel(ficha.telefone) && (
            <a href={linkTel(ficha.telefone)!} className="font-medium text-primary">
              {formataTelefone(ficha.telefone)}
            </a>
          )}
        </div>

        {/* Os quatro fatores que antes só a IA lia. */}
        {ficha.riscos.length > 0 && (
          <div className="mt-3 rounded-2xl bg-rose-50 p-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-rose-700">
              História que muda conduta
            </p>
            <ul className="mt-1 space-y-0.5">
              {ficha.riscos.map((r) => (
                <li key={r} className="text-[13px] leading-snug text-rose-900">
                  • {r}
                </li>
              ))}
            </ul>
          </div>
        )}

        {(ficha.alergias || ficha.medicamentos) && (
          <div className="mt-3 space-y-1 text-[13px] leading-snug">
            {ficha.alergias && (
              <p>
                <span className="text-muted-foreground">Alergias: </span>
                <strong className="text-foreground">{ficha.alergias}</strong>
              </p>
            )}
            {ficha.medicamentos && (
              <p>
                <span className="text-muted-foreground">Em uso: </span>
                <strong className="text-foreground">{ficha.medicamentos}</strong>
              </p>
            )}
          </div>
        )}
        {ficha.observacoesPrevias && (
          <p className="mt-2 text-[12px] leading-snug text-muted-foreground">
            {ficha.observacoesPrevias}
          </p>
        )}
      </div>

      {/* 2. O QUE PEDE OLHAR AGORA */}
      {pendentes.length > 0 && (
        <div className="rounded-3xl border border-rose-200 bg-rose-50/60 p-4">
          <p className="text-sm font-bold text-rose-900">
            {pendentes.length === 1
              ? "1 registro fora de faixa sem desfecho"
              : `${pendentes.length} registros fora de faixa sem desfecho`}
          </p>
          <ul className="mt-2 space-y-2">
            {pendentes.slice(0, 6).map((e) => (
              <li
                key={`${e.fonte}-${e.fonte_id}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-card p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                    {ROTULO_ESPECIE[e.especie] ?? e.especie} · {quando(e.ocorrido_em)}
                  </p>
                  <p className="mt-0.5 text-[13px] leading-snug text-foreground">
                    {e.notas.join(" · ") || "Registro fora de faixa"}
                  </p>
                  {e.texto && (
                    <p className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-muted-foreground">
                      {e.texto}
                    </p>
                  )}
                </div>
                {/* "Já cuidei disto", não "li". Marcar como lido faz o item
                    sumir sem que nada tenha sido feito, e o próximo médico não
                    tem como saber se houve conduta. */}
                <button
                  onClick={() => onRegistrarDesfecho(e.fonte, e.fonte_id)}
                  disabled={registrando === `${e.fonte}:${e.fonte_id}`}
                  className="press shrink-0 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-foreground disabled:opacity-50"
                >
                  {registrando === `${e.fonte}:${e.fonte_id}` ? "…" : "Já cuidei"}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 3. PARA ONDE OS NÚMEROS ESTÃO INDO */}
      <div>
        <h4 className="font-serif text-lg text-foreground">Números dela</h4>
        <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
          Informados por ela no app, não aferidos em consultório. Sem etiqueta significa dentro da
          faixa de referência ou sem registro — não é diagnóstico.
        </p>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Medida
            rotulo="Última pressão"
            valor={pa.ultimo != null && paD.ultimo != null ? `${pa.ultimo}/${paD.ultimo}` : "—"}
            gravidade={sinalPA?.gravidade}
            nota={sinalPA?.nota}
          />
          <Medida
            rotulo="Última glicemia"
            valor={gli.ultimo != null ? `${gli.ultimo}` : "—"}
            gravidade={sinalG?.gravidade}
            nota={sinalG?.nota}
          />
          <Medida
            rotulo="Peso"
            valor={peso.ultimo != null ? `${peso.ultimo} kg` : "—"}
            nota={ganho != null ? `${ganho > 0 ? "+" : ""}${ganho} kg na gestação` : undefined}
            gravidade={ganho != null ? "normal" : undefined}
          />
          <Medida
            rotulo="Registros"
            valor={String(eventos.length)}
            nota={eventos.length ? quando(eventos[0].ocorrido_em) : undefined}
          />
        </div>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Tendencia s={pa} />
          <Tendencia s={peso} />
          <Tendencia s={gli} />
        </div>
      </div>

      {/* 4. O QUE ACONTECEU */}
      <div>
        <h4 className="font-serif text-lg text-foreground">Linha do tempo</h4>
        {eventos.length === 0 ? (
          <p className="mt-2 rounded-2xl border border-border bg-card p-4 text-[13px] text-muted-foreground">
            Nenhum registro dela no período. Pode ser que ela ainda não use o app — vale combinar
            isso na próxima consulta.
          </p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {eventos.slice(0, 40).map((e) => (
              <li
                key={`${e.fonte}-${e.fonte_id}`}
                className="flex items-start gap-3 rounded-2xl border border-border bg-card p-3"
              >
                <span
                  aria-hidden
                  className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                    e.gravidade === "grave"
                      ? "bg-rose-500"
                      : e.gravidade === "atencao"
                        ? "bg-amber-500"
                        : "bg-muted-foreground/30"
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                    {ROTULO_ESPECIE[e.especie] ?? e.especie} · {quando(e.ocorrido_em)}
                  </p>
                  <p className="mt-0.5 text-[13px] leading-snug text-foreground">{resumo(e)}</p>
                  {e.texto && (
                    <p className="mt-0.5 line-clamp-3 text-[12px] leading-snug text-muted-foreground">
                      {e.texto}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/** Uma linha que diz o que aconteceu, sem obrigar o médico a ler um objeto. */
function resumo(e: EventoClinico): string {
  const d = e.dados;
  const partes: string[] = [];
  if (d.systolic != null && d.diastolic != null) partes.push(`PA ${d.systolic}/${d.diastolic}`);
  if (d.glucose_mg_dl != null) {
    partes.push(`glicemia ${d.glucose_mg_dl}${d.momento ? ` (${d.momento})` : ""}`);
  }
  if (d.weight_kg != null) partes.push(`peso ${d.weight_kg} kg`);
  if (d.sintomas?.length) partes.push(d.sintomas.join(", "));
  if (d.nivel) partes.push(`triagem ${d.nivel}`);
  if (d.chutes != null) partes.push(`${d.chutes} movimentos`);
  if (d.intensidade != null) {
    partes.push(`intensidade ${d.intensidade}${d.duracao_seg ? ` · ${d.duracao_seg}s` : ""}`);
  }
  if (d.nome) partes.push(d.nome);
  if (d.humor) partes.push(`humor: ${d.humor}`);
  if (d.epds != null) partes.push(`EPDS ${d.epds}`);
  if (d.medicamentos) partes.push(`medicações: ${d.medicamentos}`);
  if (d.emocional) partes.push(`emocional: ${d.emocional}`);
  if (e.especie === "emergencia") partes.push("acionou o SOS");
  if (e.especie === "pergunta") partes.push(d.respondida ? "respondida" : "sem resposta");
  return partes.join(" · ") || (ROTULO_ESPECIE[e.especie] ?? "Registro");
}
