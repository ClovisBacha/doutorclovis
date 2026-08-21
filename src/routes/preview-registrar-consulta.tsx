/**
 * BANCADA DO FORMULÁRIO DE REGISTRAR CONSULTA (painel do médico).
 *
 * ⚠️ **É onde o dado clínico é ESCRITO, e não tinha bancada.** A varredura de
 * alcance achou 41 componentes que bancada nenhuma toca, quase todos do painel
 * do médico. Depois do alerta de SOS, este é o de maior consequência: um
 * defeito aqui não some da tela — fica no prontuário, e outro profissional o lê
 * meses depois.
 *
 * O que precisa ser OLHADO aqui é a decisão central do componente, que é fácil
 * de quebrar sem ninguém notar:
 *
 * ⚠️ **O rascunho entra SÓ no campo de ACHADOS.** `consultas.systolic` é o que
 * o MÉDICO aferiu no consultório; preenchê-lo com a pressão que ela mediu em
 * casa faria o prontuário afirmar uma aferição que não aconteceu. `?desde=` põe
 * eventos no período justamente para provar que os campos de medida continuam
 * VAZIOS.
 *
 * Endereços:
 *   /preview-registrar-consulta            → retorno, com o que ela registrou
 *                                            desde a última consulta
 *   /preview-registrar-consulta?primeira=1 → ⚠️ primeira consulta: `desde` é
 *                                            `null`, e o rascunho pega TUDO
 *   /preview-registrar-consulta?vazio=1    → nada registrado no período (o
 *                                            campo de achados abre em branco)
 */
import { createFileRoute } from "@tanstack/react-router";
import { RegistrarConsulta } from "@/components/registrar-consulta";
import type { EventoClinico } from "@/lib/clinical.functions";

export const Route = createFileRoute("/preview-registrar-consulta")({
  component: Bancada,
  validateSearch: (q: Record<string, unknown>) => ({
    /* ⚠️ `== null` e NÃO `=== undefined` — na revalidação chega `null`. */
    primeira: q.primeira == null ? 0 : Number(q.primeira),
    vazio: q.vazio == null ? 0 : Number(q.vazio),
  }),
});

/* ⚠️ Instantes FIXOS, nunca `Date.now()`: o rascunho carimba as datas, e um
   relógio vivo faria a bancada mudar de texto entre duas fotos. */
function evento(
  ocorrido_em: string,
  especie: EventoClinico["especie"],
  dados: EventoClinico["dados"],
  texto: string | null = null,
): EventoClinico {
  return {
    fonte: "health_logs",
    fonte_id: ocorrido_em,
    user_id: "00000000-0000-4000-8000-000000000001",
    ocorrido_em,
    especie,
    dados,
    texto,
    gravidade: "normal",
    notas: [],
    tratado_em: null,
  };
}

function Bancada() {
  const { primeira, vazio } = Route.useSearch();

  const eventos: EventoClinico[] = vazio
    ? []
    : [
        evento("2026-08-04T09:10:00.000Z", "medida", { systolic: 128, diastolic: 84 }),
        evento("2026-08-09T21:40:00.000Z", "medida", { glucose_mg_dl: 96 }),
        evento("2026-08-12T08:00:00.000Z", "medida", { weight_kg: 71.4 }),
        evento("2026-08-15T19:20:00.000Z", "sintoma", {}, "Dor nas costas à noite"),
        evento("2026-08-18T07:30:00.000Z", "medida", { systolic: 136, diastolic: 88 }),
      ];

  return (
    <div className="mx-auto max-w-2xl p-4">
      <RegistrarConsulta
        pacienteId="00000000-0000-4000-8000-000000000001"
        /* ⚠️ Salvar vai ao servidor de verdade e falha sem sessão — o que se
           confere aqui é o FORMULÁRIO, não a gravação. */
        tokenFn={async () => ""}
        onSalvou={() => {}}
        eventos={eventos}
        desdeAConsulta={primeira ? null : "2026-08-01T00:00:00.000Z"}
      />
    </div>
  );
}
