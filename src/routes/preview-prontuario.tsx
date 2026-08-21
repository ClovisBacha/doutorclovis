/**
 * BANCADA DO PRONTUÁRIO DA PACIENTE (painel do médico).
 *
 * ⚠️ **A maior tela clínica do app — 689 linhas — e nunca tinha sido olhada.**
 * A varredura de alcance achou 41 componentes que bancada nenhuma toca, quase
 * todos do painel. Esta é a de leitura clínica: é onde o médico decide o que
 * fazer com a paciente hoje.
 *
 * `ProntuarioPaciente` recebe TUDO por prop — "ele desenha, quem chama age" —
 * então a bancada não custou uma linha de mudança na produção.
 *
 * O que ela existe para provar são os três estados que ninguém consegue
 * fabricar numa conta de teste:
 *
 * ⚠️ **`?degradada=1` — "NADA RELATADO" ≠ "DESCONHECIDO".** Quando o banco não
 * tem as colunas do perfil rico, os campos ausentes são DESCONHECIDOS, não
 * vazios. Espaço em branco onde deveria estar "alergias" é lido como "não tem
 * alergia", e a diferença entre os dois é uma prescrição.
 *
 * ⚠️ **`?incompleto=1` — uma fonte não pôde ser lida.** A tela avisa em vez de
 * fingir completude: um prontuário que parece inteiro e não está é pior que um
 * que assume a falha.
 *
 * ⚠️ **`?semficha=1`** — o caso em que nem a ficha carregou.
 *
 * Endereços:
 *   /preview-prontuario              → o caso completo
 *   /preview-prontuario?degradada=1  → campos desconhecidos (âmbar, com ⚠️)
 *   /preview-prontuario?incompleto=1 → alguma fonte falhou
 *   /preview-prontuario?carregando=1 → o esqueleto
 *   /preview-prontuario?semficha=1   → a ficha não carregou
 *   /preview-prontuario?secao=quem   → uma seção só (quem · mudou · pendentes ·
 *                                      numeros · linha), como as abas usam
 */
import { createFileRoute } from "@tanstack/react-router";
import { ProntuarioPaciente } from "@/components/prontuario-paciente";
import type { SecaoDoProntuario } from "@/lib/abas-da-paciente";
import type { Consulta, EventoClinico, FichaClinica } from "@/lib/clinical.functions";

export const Route = createFileRoute("/preview-prontuario")({
  component: Bancada,
  validateSearch: (q: Record<string, unknown>) => ({
    /* ⚠️ `== null` e NÃO `=== undefined` — na revalidação chega `null`. */
    degradada: q.degradada == null ? 0 : Number(q.degradada),
    incompleto: q.incompleto == null ? 0 : Number(q.incompleto),
    carregando: q.carregando == null ? 0 : Number(q.carregando),
    semficha: q.semficha == null ? 0 : Number(q.semficha),
    secao: q.secao == null ? "" : String(q.secao),
  }),
});

/* ⚠️ Instantes FIXOS, nunca `Date.now()`: a linha do tempo carimba as datas, e
   um relógio vivo faria a bancada mudar de texto entre duas fotos. */
function ev(
  ocorrido_em: string,
  especie: EventoClinico["especie"],
  dados: EventoClinico["dados"],
  gravidade: EventoClinico["gravidade"],
  texto: string | null = null,
  notas: string[] = [],
): EventoClinico {
  return {
    fonte: "health_logs",
    fonte_id: ocorrido_em,
    user_id: "00000000-0000-4000-8000-000000000001",
    ocorrido_em,
    especie,
    dados,
    texto,
    gravidade,
    notas,
    tratado_em: null,
  };
}

function Bancada() {
  const { degradada, incompleto, carregando, semficha, secao } = Route.useSearch();

  const ficha: FichaClinica = {
    nome: "Marina Costa",
    bebe: "Helena",
    /* Em DIAS: 31s4d. A tela nunca arredonda para semanas — em obstetrícia os
       dias decidem conduta (36+6 contra 37+0). */
    gestDias: 221,
    dpp: "2026-10-30",
    gestacaoNumero: 2,
    tipoSanguineo: degradada ? null : "O-",
    alergias: degradada ? null : "Dipirona",
    medicamentos: degradada ? null : "AAS 100mg, sulfato ferroso",
    alturaCm: degradada ? null : 165,
    pesoPreGestacional: degradada ? null : 62,
    telefone: "+55 31 99999-0000",
    contatoEmergencia: "Rafael (marido)",
    telefoneEmergencia: "+55 31 98888-0000",
    riscos: degradada ? [] : ["Pré-eclâmpsia na gestação anterior"],
    observacoesPrevias: degradada ? null : "Cesárea em 2023, sem intercorrências.",
    modoCuidado: false,
    degradada: degradada === 1,
  };

  const eventos: EventoClinico[] = [
    ev("2026-08-18T07:30:00.000Z", "medida", { systolic: 148, diastolic: 96 }, "atencao", null, [
      "Pressão acima do esperado",
    ]),
    ev("2026-08-15T19:20:00.000Z", "sintoma", {}, "normal", "Dor nas costas à noite"),
    ev("2026-08-12T08:00:00.000Z", "medida", { weight_kg: 71.4 }, "normal"),
    ev("2026-08-09T21:40:00.000Z", "medida", { glucose_mg_dl: 96 }, "normal"),
    ev("2026-08-04T09:10:00.000Z", "medida", { systolic: 128, diastolic: 84 }, "normal"),
  ];

  const consultas: Consulta[] = [
    {
      id: "c1",
      occurred_at: "2026-08-01T14:00:00.000Z",
      kind: "presencial",
      achados: "Altura uterina compatível. BCF 142.",
      conduta: "Manter AAS. Retorno em 3 semanas.",
      systolic: 126,
      diastolic: 80,
      weight_kg: 70.2,
      fundal_height_cm: 30,
      fetal_bpm: 142,
      resumo_paciente: "Está tudo bem com a Helena. Continue o AAS e nos vemos em 3 semanas.",
    },
  ];

  return (
    <div className="mx-auto max-w-3xl p-4">
      <ProntuarioPaciente
        ficha={semficha ? null : ficha}
        eventos={eventos}
        carregando={carregando === 1}
        incompleto={incompleto === 1}
        onRegistrarDesfecho={() => {}}
        registrando={null}
        consultas={consultas}
        secoes={secao ? ([secao] as SecaoDoProntuario[]) : undefined}
      />
    </div>
  );
}
