import { createFileRoute } from "@tanstack/react-router";
import { SaudeDoBancoTab } from "@/components/saude-do-banco-tab";
import type { ArquivoConferido } from "@/lib/saude-do-banco.functions";

/**
 * ⚠️ A bancada da saúde do banco.
 *
 * Os três estados que mais importam — **faltando**, **incerto** e **sem chave
 * de serviço** — não se fabricam num banco em dia, que é justamente o banco de
 * quem desenvolve. Sem esta rota, a tela que existe para avisar do defeito
 * mais repetido do repositório seria vista uma vez só, no caso verde.
 */
export const Route = createFileRoute("/preview-banco")({
  component: Bancada,
  validateSearch: (q: Record<string, unknown>) => ({
    estado: typeof q.estado === "string" ? q.estado : "faltando",
  }),
});

const FALTANDO: ArquivoConferido[] = [
  {
    arquivo: "APLICAR_CONVERSA_SILENCIAR.sql",
    estado: "faltando",
    alvos: [
      {
        tabela: "rede_conversas",
        colunas: ["silenciada_a", "silenciada_b", "saiu_a", "saiu_b"],
        estado: "coluna_ausente",
      },
      {
        tabela: "rede_mensagens",
        colunas: ["imagem_path", "ref_tipo", "ref_id"],
        estado: "coluna_ausente",
      },
    ],
  },
  {
    arquivo: "APLICAR_DURACAO_DA_CONSULTA.sql",
    estado: "faltando",
    alvos: [
      {
        tabela: "appointment_requests",
        colunas: ["duration_minutes"],
        estado: "coluna_ausente",
      },
    ],
  },
  {
    arquivo: "APLICAR_AMIZADES.sql",
    estado: "aplicado",
    alvos: [{ tabela: "duplas", colunas: ["avisada_em"], estado: "ok" }],
  },
  {
    arquivo: "APLICAR_MEDICO.sql",
    estado: "aplicado",
    alvos: [{ tabela: "doctors", colunas: [], estado: "ok" }],
  },
];

const INCERTO: ArquivoConferido[] = [
  {
    arquivo: "APLICAR_EVENTOS_CLINICOS.sql",
    estado: "incerto",
    alvos: [
      {
        tabela: "clinical_acks",
        colunas: [],
        estado: "erro",
        detalhe: "PGRST301 JWT expired",
      },
    ],
  },
  ...FALTANDO.slice(2),
];

const TUDO_OK: ArquivoConferido[] = FALTANDO.slice(2);

function Bancada() {
  const { estado } = Route.useSearch();
  const comum = { conferidoEm: new Date("2026-08-31T02:14:00-03:00").toISOString() };

  return (
    <div className="mx-auto max-w-2xl p-5">
      {estado === "semchave" && (
        <SaudeDoBancoTab estado={{ t: "sem_chave" }} aoConferir={() => {}} carregando={false} />
      )}
      {estado === "falhou" && (
        <SaudeDoBancoTab estado={{ t: "falhou" }} aoConferir={() => {}} carregando={false} />
      )}
      {estado === "nunca" && (
        <SaudeDoBancoTab estado={{ t: "nunca" }} aoConferir={() => {}} carregando={false} />
      )}
      {estado === "incerto" && (
        <SaudeDoBancoTab
          estado={{ t: "ok", arquivos: INCERTO }}
          {...comum}
          aoConferir={() => {}}
          carregando={false}
        />
      )}
      {estado === "verde" && (
        <SaudeDoBancoTab
          estado={{ t: "ok", arquivos: TUDO_OK }}
          {...comum}
          aoConferir={() => {}}
          carregando={false}
        />
      )}
      {estado === "faltando" && (
        <SaudeDoBancoTab
          estado={{ t: "ok", arquivos: FALTANDO }}
          {...comum}
          aoConferir={() => {}}
          carregando={false}
        />
      )}
    </div>
  );
}
