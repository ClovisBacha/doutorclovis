/**
 * BANCADA DO ALERTA DE SOS NO PAINEL DO MÉDICO.
 *
 * ⚠️ **É a tela de MAIOR risco do produto, e nunca tinha sido olhada.** Uma
 * varredura de alcance (fecho transitivo de imports a partir de todas as
 * `/preview-*`) achou 41 componentes que bancada nenhuma alcança, e o padrão é
 * nítido: o app da paciente tem bancadas, o painel do MÉDICO quase nenhuma —
 * prontuário, agenda do dia, registrar consulta, grade de horários e este.
 *
 * Este é o que mais pesa: é o que o médico vê quando uma paciente aperta o SOS,
 * com a localização dela. Para olhá-lo era preciso uma paciente de verdade
 * apertando o botão de emergência — ou seja, na prática ninguém olhava. Os dois
 * defeitos achados hoje (as cotas que não nasciam e o link com
 * `location.origin`) estavam os dois em telas sem bancada.
 *
 * ⚠️ **A bancada injeta o DADO nas mesmas props da produção**, nunca o desenho.
 * `AlertaSosMedico` recebe tudo por prop e não busca nada — o que se confere
 * aqui é a TELA.
 *
 * Endereços:
 *   /preview-sos-medico              → o caso completo (ficha inteira, GPS, fila)
 *   /preview-sos-medico?magro=1      → ⚠️ sem ficha, sem GPS, sem motivo: é o
 *                                      caso REAL de quem apertou o SOS com o
 *                                      perfil incompleto, e o que não pode
 *                                      virar tela vazia.
 *   /preview-sos-medico?atendendo=1  → o botão em curso
 *   /preview-sos-medico?fila=0       → sem ninguém atrás
 *   /preview-sos-medico?falhou=1     → um canal de aviso não saiu
 */
import { createFileRoute } from "@tanstack/react-router";
import { AlertaSosMedico } from "@/components/alerta-sos-medico";
import type { AcionamentoSos } from "@/lib/acionamentos.functions";

export const Route = createFileRoute("/preview-sos-medico")({
  component: Bancada,
  validateSearch: (q: Record<string, unknown>) => ({
    /* ⚠️ `== null` e NÃO `=== undefined`: o router serializa e revalida, e na
       segunda passada chega `null` — `Number(null)` é 0. A mesma armadilha que
       `preview-saude` e `preview-jogo` documentam. */
    magro: q.magro == null ? 0 : Number(q.magro),
    atendendo: q.atendendo == null ? 0 : Number(q.atendendo),
    fila: q.fila == null ? 2 : Number(q.fila),
    falhou: q.falhou == null ? 0 : Number(q.falhou),
  }),
});

function Bancada() {
  const { magro, atendendo, fila, falhou } = Route.useSearch();
  const semFicha = magro === 1;

  /* ⚠️ Instante FIXO, nunca `Date.now()`: a tela mostra "há quanto tempo", e um
     relógio vivo faria a bancada mudar de texto entre duas fotos — além de
     divergir entre servidor e cliente na hidratação. */
  const acionamento: AcionamentoSos = {
    id: "sos-bancada",
    created_at: "2026-08-21T14:52:00.000Z",
    paciente: semFicha ? null : "Marina Costa",
    paciente_id: "00000000-0000-4000-8000-000000000001",
    motivo: semFicha ? null : "Sangramento com dor forte desde agora de manhã",
    latitude: semFicha ? null : -19.9245,
    longitude: semFicha ? null : -43.9352,
    address: semFicha ? null : "Rua Pium-í, 500 — Cruzeiro, Belo Horizonte",
    atendido_em: null,
    ficha: semFicha
      ? null
      : {
          nome: "Marina Costa",
          telefone: "+55 31 99999-0000",
          bebe: "Helena",
          semana: "31s4d",
          dpp: "2026-10-30",
          sangue: "O-",
          alergias: "Dipirona",
          medicamentos: "AAS 100mg, sulfato ferroso",
          contato: "Rafael (marido)",
          contatoTel: "+55 31 98888-0000",
          medico: "Dr. Clóvis Bacha",
          medicoTel: "+55 31 98634-2903",
          endereco: "Rua Pium-í, 500 — Cruzeiro, Belo Horizonte",
          avisados: [
            { nome: "Dr. Clóvis Bacha", via: "push" },
            { nome: "Rafael (marido)", via: "WhatsApp" },
          ],
        },
    channels: {
      push: true,
      medicoEmail: true,
      contatoEmail: !falhou,
      whatsapp: true,
      /* ⚠️ O canal que FALTOU é informação clínica, não detalhe técnico: o
         médico precisa saber que o contato de emergência dela pode não ter
         sido avisado. */
      faltou: falhou ? "e-mail do contato de emergência" : null,
      destinos: [
        { nome: "Dr. Clóvis Bacha", via: "push" },
        { nome: "Rafael (marido)", via: "WhatsApp" },
      ],
    },
  };

  return (
    <div className="min-h-screen bg-background">
      <AlertaSosMedico
        acionamento={acionamento}
        onAtender={() => {}}
        onFechar={() => {}}
        atendendo={atendendo === 1}
        restantes={fila}
      />
    </div>
  );
}
