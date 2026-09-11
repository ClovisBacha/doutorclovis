/**
 * Excluir a conta — a tela.
 *
 * Ver `src/lib/conta.functions.ts` para o porquê de existir (5.1.1(v) da Apple,
 * art. 18 da LGPD, e a promessa que os Termos já faziam sem o botão existir).
 *
 * ─── As decisões de interface, e o que cada uma evita ───────────────────
 *
 * **Fica fechada, e abre em dois passos.** Um botão "excluir conta" direto, no
 * meio de uma tela que a paciente rola todo dia, é um toque acidental caro. Ela
 * abre, lê o que vai acontecer, e só então aparece o campo.
 *
 * **Pede uma palavra digitada, não um "tem certeza?".** Diálogo de confirmação
 * é respondido no automático; digitar EXCLUIR não é. A mesma palavra é
 * conferida no servidor — no cliente ela protege do toque sem querer, no
 * servidor protege de um pedido montado à mão.
 *
 * **Diz o que NÃO some, antes de ela decidir.** O que o médico registrou sobre
 * um atendimento é obrigação legal dele guardar (CFM, 20 anos). Descobrir isso
 * depois de apagar seria descobrir que a exclusão não foi o que ela entendeu.
 *
 * **Avisa sobre a assinatura.** Apagar a conta não cancela a cobrança da loja —
 * quem cancela é a Apple ou o Google, nos ajustes do aparelho. É exigência de
 * revisão e, mais que isso, é o tipo de coisa que vira cobrança indevida três
 * meses depois, sem ninguém para reclamar porque a conta não existe mais.
 */
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { excluirMinhaConta, PALAVRA_DE_CONFIRMACAO } from "@/lib/conta.functions";
import { useVoltar } from "@/lib/use-voltar";
import { useTravarRolagemDeFundo } from "@/lib/use-travar-rolagem";

export function ExcluirConta({ ehMedico = false }: { ehMedico?: boolean }) {
  const [aberto, setAberto] = useState(false);
  const [palavra, setPalavra] = useState("");
  const [indo, setIndo] = useState(false);

  useVoltar(aberto, () => setAberto(false));

  /* A página de trás não anda enquanto esta folha está aberta — ver

     `useTravarRolagemDeFundo`, que guarda e restaura o valor anterior. */

  useTravarRolagemDeFundo(aberto);

  const podeConfirmar = palavra.trim().toUpperCase() === PALAVRA_DE_CONFIRMACAO;

  async function excluir() {
    if (!podeConfirmar || indo) return;
    setIndo(true);
    try {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session) {
        toast.error("Sua sessão expirou. Entre de novo e tente outra vez.");
        setIndo(false);
        return;
      }
      const r = await excluirMinhaConta({
        data: { accessToken: s.session.access_token, confirmacao: palavra },
      });
      if (r.ok) {
        /* Sai da sessão ANTES de mandar para a home: a conta não existe mais, e
           uma sessão apontando para um usuário apagado deixa o app em estados
           que ninguém previu. */
        await supabase.auth.signOut();
        window.location.href = "/";
        return;
      }
      toast.error(textoDoErro(r.motivo), { duration: 8000 });
    } catch {
      toast.error("Não consegui concluir agora. Tente de novo em instantes.");
    }
    setIndo(false);
  }

  return (
    <div className="rounded-3xl border border-destructive/25 bg-destructive/[0.03] p-6">
      <p className="font-serif text-lg text-foreground">Excluir minha conta</p>

      {ehMedico ? (
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          A sua conta é o vínculo das suas pacientes e a autoria do que você registrou — apagá-la de
          um toque desligaria o SOS de quem está grávida agora. Por isso a exclusão de conta de
          médico passa por um pedido no suporte, onde a transferência das pacientes e a guarda do
          prontuário são tratadas antes.{" "}
          <strong className="text-foreground">Escreva para o suporte pelo site</strong> e a gente
          conduz.
        </p>
      ) : !aberto ? (
        <>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Apaga a sua conta e os seus dados deste aplicativo. Não tem volta.
          </p>
          <button
            onClick={() => setAberto(true)}
            className="press mt-4 rounded-full border border-destructive/40 px-5 py-2.5 text-sm font-medium text-destructive"
          >
            Quero excluir minha conta
          </button>
        </>
      ) : (
        <div className="mt-3 space-y-4">
          <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">
            <p>
              <strong className="text-foreground">O que some:</strong> seu perfil, o diário, os
              registros de saúde, as conversas com a assistente, as fotos do álbum e o seu vínculo
              com o médico. Não dá para recuperar depois.
            </p>
            <p>
              <strong className="text-foreground">O que fica:</strong> o que o seu médico registrou
              sobre um atendimento — prontuário e receitas emitidas. A lei obriga o médico a guardar
              isso por 20 anos, e essa obrigação é dele, não sua.
            </p>
            <p>
              <strong className="text-foreground">Sobre a assinatura:</strong> apagar a conta não
              cancela a cobrança. O cancelamento é feito nos ajustes do seu aparelho, na App Store
              ou na Play Store — faça isso antes.
            </p>
          </div>

          <label className="block text-sm">
            <span className="text-muted-foreground">
              Para confirmar, digite{" "}
              <strong className="text-foreground">{PALAVRA_DE_CONFIRMACAO}</strong>
            </span>
            <input
              value={palavra}
              onChange={(e) => setPalavra(e.target.value)}
              autoComplete="off"
              autoCapitalize="characters"
              aria-label={`Digite ${PALAVRA_DE_CONFIRMACAO} para confirmar`}
              className="mt-1.5 w-full rounded-xl border border-border bg-background px-4 py-2.5 font-mono uppercase tracking-widest"
            />
          </label>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={excluir}
              disabled={!podeConfirmar || indo}
              className="press rounded-full bg-destructive px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-45"
            >
              {indo ? "Excluindo…" : "Excluir definitivamente"}
            </button>
            <button
              onClick={() => {
                setAberto(false);
                setPalavra("");
              }}
              className="rounded-full border border-border px-5 py-2.5 text-sm text-foreground"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** O motivo técnico vira uma frase que diz o que fazer. */
function textoDoErro(motivo: string): string {
  switch (motivo) {
    case "confirmacao":
      return `Digite ${PALAVRA_DE_CONFIRMACAO} para confirmar.`;
    case "sessao":
      return "Sua sessão expirou. Entre de novo e tente outra vez.";
    case "medico":
      return "Contas de médico são encerradas pelo suporte — fale com a gente pelo site.";
    default:
      /* "falhou" quase sempre é o banco recusando por vínculo — e a paciente
         não pode ficar achando que apagou quando não apagou. */
      return "Não consegui concluir a exclusão. Nada foi apagado. Fale com o suporte pelo site e a gente resolve.";
  }
}
