/**
 * Notificações no aparelho do médico.
 *
 * ─── O defeito que este arquivo conserta ────────────────────────────────
 *
 * O envio de push para o médico já existia e funcionava: SOS, pedido de
 * vínculo de paciente, avisos da clínica. Quatro pontos do servidor chamam
 * `sendPushToUser(medicoUserId, …)`.
 *
 * Só que `subscribeToPush` — a função que registra o APARELHO dele — era
 * importada num lugar só do projeto: a área da paciente. O painel do médico
 * nunca inscreveu aparelho nenhum.
 *
 * O resultado é o pior tipo de defeito, o que não deixa rastro: o código roda,
 * não dá erro, o log diz "enviado", e `sent` volta 0 porque não há aparelho
 * inscrito. **Um SOS de paciente disparava um push que não chegava a lugar
 * nenhum**, e o médico só saberia pelo e-mail — se estivesse com o e-mail
 * aberto.
 *
 * ─── Por que fica visível em vez de silencioso ──────────────────────────
 *
 * Não dá para inscrever sozinho: o navegador exige um gesto do usuário para
 * pedir a permissão, e pedir sem explicar é o jeito mais rápido de o médico
 * negar para sempre. Então o cartão diz o que ele vai receber ANTES de pedir —
 * e o primeiro item da lista é o SOS, porque é o único que não pode esperar.
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ativarAvisos, renovarAvisosSeJaAutorizado, suporteAAvisos } from "@/lib/avisos";
import { ehNativo } from "@/lib/nativo";

type Estado = "carregando" | "ligado" | "desligado" | "negado" | "indisponivel";

export function NotificacoesDoMedico() {
  const [estado, setEstado] = useState<Estado>("carregando");
  const [motivo, setMotivo] = useState<string | undefined>();
  const [ligando, setLigando] = useState(false);

  useEffect(() => {
    const sup = suporteAAvisos();
    if (!sup.ok) {
      setEstado("indisponivel");
      setMotivo(sup.reason);
      return;
    }
    /* Dentro da casca nativa não existe `Notification.permission`: quem sabe da
       permissão é o sistema, e perguntar a ele custa uma chamada assíncrona.
       O cartão nasce em "desligado" e a renovação corrige em silêncio se a
       permissão já estava dada — o pior que acontece é o médico ver o botão de
       ativar por um instante em algo que já está ativo. */
    if (ehNativo()) {
      setEstado("desligado");
      void renovarAvisosSeJaAutorizado();
      return;
    }
    if (Notification.permission === "denied") return setEstado("negado");
    if (Notification.permission === "granted") {
      /* Já autorizou antes: garante que a inscrição existe no banco. Sem isto,
         trocar de aparelho ou limpar dados deixa a permissão concedida e o
         banco vazio — permissão sem inscrição não entrega nada. */
      ativarAvisos()
        .then((r) => setEstado(r.ok ? "ligado" : "desligado"))
        .catch(() => setEstado("desligado"));
      return;
    }
    setEstado("desligado");
  }, []);

  async function ligar() {
    if (ligando) return;
    setLigando(true);
    try {
      const r = await ativarAvisos();
      if (r.ok) {
        setEstado("ligado");
        toast.success("Pronto — os avisos chegam neste aparelho.");
      } else {
        setEstado(r.reason === "denied" ? "negado" : "desligado");
        setMotivo(r.reason);
        toast.error(textoDoMotivo(r.reason));
      }
    } catch {
      toast.error("Não consegui ativar agora. Tente de novo em instantes.");
    }
    setLigando(false);
  }

  if (estado === "carregando") return null;

  if (estado === "ligado") {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:bg-emerald-500/10">
        <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
          Avisos ligados neste aparelho ✓
        </p>
        <p className="mt-1 text-[13px] leading-relaxed text-emerald-900/80 dark:text-emerald-200/80">
          SOS de paciente, pedidos de consulta e novas pacientes chegam aqui. Cada aparelho se ativa
          separado — se você usa o computador também, ative lá.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-sm font-semibold text-foreground">
        {estado === "negado" ? "Avisos bloqueados neste aparelho" : "Receber avisos neste aparelho"}
      </p>
      <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
        {estado === "negado" || estado === "indisponivel" ? (
          textoDoMotivo(motivo)
        ) : (
          <>
            O que chega aqui: <strong className="text-foreground">SOS de uma paciente</strong>,
            pedidos de consulta para confirmar e pacientes novas pedindo para te acompanhar. Nada de
            marketing.
          </>
        )}
      </p>
      {estado === "desligado" && (
        <button
          onClick={ligar}
          disabled={ligando}
          className="press mt-3 rounded-full bg-primary px-5 py-2 text-xs font-bold text-primary-foreground disabled:opacity-60"
        >
          {ligando ? "Ativando…" : "Ativar avisos"}
        </button>
      )}
    </div>
  );
}

/** Traduz o motivo técnico numa frase que diz o que FAZER. */
function textoDoMotivo(motivo?: string): string {
  switch (motivo) {
    case "denied":
      return "Você bloqueou os avisos para este site. Para voltar a receber, libere as notificações nos ajustes do navegador ou do aparelho — daqui não dá para reverter.";
    case "ios-not-installed":
      /* O iPhone só entrega push para site instalado na tela de início. É a
         causa mais comum de "não recebo nada" e não tem erro nenhum no log. */
      return "No iPhone, os avisos só funcionam com o app instalado na Tela de Início: toque em Compartilhar e depois em “Adicionar à Tela de Início”.";
    case "no-key":
      return "O envio de avisos ainda está sendo configurado no servidor.";
    case "sem-token":
      /* No app, "sem token" quase sempre é rede: o aparelho precisa falar com
         a Apple ou com o Google antes de existir para onde enviar. */
      return "O aparelho não conseguiu se registrar agora. Confira a conexão e tente de novo.";
    case "indisponivel":
      return "Não consegui guardar o registro deste aparelho. Tente de novo em instantes.";
    case "no-sw":
    case "no-push":
    case "no-notif":
      return "Este navegador não entrega notificações. Tente pelo Chrome, Edge ou Safari.";
    default:
      return "Não foi possível ativar os avisos neste aparelho.";
  }
}
