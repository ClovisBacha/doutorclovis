/**
 * BANCADA DO CALENDÁRIO DO MÊS E DO DIA DA AGENDA (painel do médico).
 *
 * ⚠️ **A agenda inteira do consultório, e nunca tinha sido olhada.** A varredura
 * de alcance achou 41 componentes que bancada nenhuma toca, quase todos do
 * painel. Estes dois somam 833 linhas e decidem o que o médico vê do próprio
 * mês — e a primeira tela do painel que ganhou bancada (o alerta de SOS) tinha
 * um defeito à vista.
 *
 * `CalendarioDoMes` recebe tudo por prop, então a bancada não custou uma linha
 * de mudança na produção.
 *
 * O que ela existe para provar:
 *
 * ⚠️ **`firme: false` aparece TRACEJADO.** Um pedido não confirmado e uma
 * consulta particular sem horário aparecem no calendário para ele não esquecer
 * que existem — mas pintá-los como compromisso faria o médico contar com uma
 * hora que ninguém combinou. É a régua central do componente e só se confere
 * olhando.
 *
 * ⚠️ **As três cores por TIPO** (🟢 presencial · 🟠 teleconsulta · 🟣
 * particular), porque é o tipo que muda o dia dele — status vira texto ao abrir.
 *
 * Endereços:
 *   /preview-agenda             → o mês cheio, com os três tipos
 *   /preview-agenda?vazio=1     → mês sem nada (o estado que ensina)
 *   /preview-agenda?firme=0     → só o que NÃO tem hora combinada
 *   /preview-agenda?dia=12      → abre a tela grande do dia 12
 */
import { createFileRoute } from "@tanstack/react-router";
import { CalendarioDoMes } from "@/components/calendario-do-mes";
import type { EventoDaAgenda } from "@/lib/agenda-unificada";

export const Route = createFileRoute("/preview-agenda")({
  validateSearch: (q: Record<string, unknown>) => ({
    /* ⚠️ `== null`, como todas as outras — na revalidação chega `null`. */
    vazio: q.vazio == null ? 0 : Number(q.vazio),
    firme: q.firme == null ? 1 : Number(q.firme),
    dia: q.dia == null ? 0 : Number(q.dia),
  }),
  head: () => ({
    meta: [{ title: "Bancada da agenda" }, { name: "robots", content: "noindex" }],
  }),
  component: Bancada,
});

/* ⚠️ Mês FIXO, nunca `new Date()`: o calendário desenha o mês corrente, e uma
   bancada que muda de conteúdo conforme o dia da execução não serve para
   comparar duas fotos. Agosto de 2026 tem 31 dias e começa num sábado. */
const MES = "2026-08";

function ev(
  id: string,
  dia: number,
  hora: string | null,
  tipo: EventoDaAgenda["tipo"],
  titulo: string,
  situacao: string,
  firme: boolean,
  duracaoMinutos = 30,
): EventoDaAgenda {
  return {
    id,
    tipo,
    dia: `${MES}-${String(dia).padStart(2, "0")}`,
    hora,
    titulo,
    situacao,
    firme,
    pago: tipo === "particular" ? true : null,
    duracaoMinutos,
  };
}

function Bancada() {
  const { vazio, firme, dia } = Route.useSearch();

  const todos: EventoDaAgenda[] = [
    ev("ped:1", 12, "09:00", "presencial", "Marina Costa", "Confirmada", true),
    ev("ped:2", 12, "09:30", "presencial", "Ana Beatriz", "Confirmada", true),
    ev("tele:1", 12, "14:00", "teleconsulta", "Júlia Ramos", "Agendada", true, 40),
    ev("part:1", 18, "10:00", "particular", "Carolina Dias", "Paga", true, 60),
    ev("ped:3", 20, "10:00", "presencial", "Fernanda Lima", "Confirmada", true),
    /* Os dois SEM hora combinada — o caso que o tracejado existe para mostrar. */
    ev("ped:4", 25, null, "presencial", "Patrícia Souza", "Pedido — manhã", false),
    ev("part:2", 27, null, "particular", "Renata Alves", "Aguardando horário", false),
  ];

  const eventos = vazio ? [] : firme ? todos : todos.filter((e) => !e.firme);

  return (
    <div className="mx-auto max-w-3xl p-4">
      <CalendarioDoMes
        eventos={eventos}
        pacientes={[
          { id: "p1", nome: "Marina Costa", email: "marina@exemplo.com" },
          { id: "p2", nome: "Ana Beatriz", email: null },
        ]}
        /* ⚠️ Devolvem sucesso sem ir ao servidor: o que se confere aqui é a
           TELA (o formulário do dia, o tracejado, as cores), não a gravação. */
        aoMarcar={async () => ({ ok: true })}
        aoEnviarLink={async () => ({ ok: true })}
        aoBuscarContato={async () => ({
          email: "marina@exemplo.com",
          telefone: "+55 31 99999-0000",
        })}
        aoCancelar={async () => ({ ok: true })}
      />
      {dia > 0 && (
        <p className="mt-3 text-center text-[12px] text-muted-foreground">
          Toque no dia {dia} para abrir a tela grande.
        </p>
      )}
    </div>
  );
}
