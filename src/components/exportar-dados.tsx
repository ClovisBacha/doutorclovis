import { useState } from "react";
import { toast } from "sonner";
import { Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { nomeDoArquivo } from "@/lib/exportar-dados";

/**
 * BAIXAR OS MEUS DADOS (LGPD Art. 18, II e V).
 *
 * ⚠️ **Fica ao lado de "excluir conta", e não numa aba de privacidade nova.**
 * É onde ela já vai quando pensa "quero tirar minhas coisas daqui" — e o app
 * só tinha, nesse lugar, a opção DESTRUTIVA. Quem queria levar o próprio
 * diário tinha de apagar tudo.
 *
 * ⚠️ **E vem ANTES da caixa de excluir, de propósito.** Muita gente que chega
 * ali quer o dado, não o fim da conta; oferecer a saída não-destrutiva
 * primeiro é o que evita uma exclusão que ela não queria.
 */
export function ExportarDados({ ehMedico = false }: { ehMedico?: boolean }) {
  const [baixando, setBaixando] = useState(false);

  /* O médico não exporta por aqui — o dado dele é outro assunto (pacientes de
     terceiros, cérebro, faturamento), e o servidor recusa de qualquer forma. */
  if (ehMedico) return null;

  async function baixar() {
    setBaixando(true);
    try {
      const s = await supabase.auth.getSession();
      const token = s.data.session?.access_token;
      if (!token) {
        toast.error("Entre de novo para baixar seus dados.");
        return;
      }
      const { exportarMeusDados } = await import("@/lib/exportar-dados.functions");
      const r = await exportarMeusDados({ data: { accessToken: token } });
      if (!r.ok) {
        toast.error(
          r.motivo === "medico"
            ? "Esta conta é de médico — o export é da paciente."
            : "Não consegui montar o arquivo agora. Tente de novo.",
        );
        return;
      }

      /* ⚠️ **Blob + `<a download>`, e o objeto é REVOGADO.** Sem o revoke, o
         arquivo inteiro fica preso na memória da aba até ela recarregar — e
         aqui ele carrega a gestação inteira, que pode ser megabytes. */
      const texto = JSON.stringify(r.arquivo, null, 2);
      const url = URL.createObjectURL(new Blob([texto], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = nomeDoArquivo(new Date());
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      /* ⚠️ **As falhas são DITAS.** Um export silenciosamente incompleto é pior
         que nenhum: ela acredita que levou tudo, apaga a conta, e o que faltou
         some junto. */
      if (r.arquivo.falhas.length > 0) {
        toast.warning(
          `Baixei, mas ${r.arquivo.falhas.length} ${
            r.arquivo.falhas.length === 1
              ? "parte não pôde ser lida"
              : "partes não puderam ser lidas"
          }. Está escrito dentro do arquivo, em "falhas".`,
        );
      } else {
        toast.success("Pronto — o arquivo está nos seus downloads 💛");
      }
    } catch {
      toast.error("Não consegui montar o arquivo agora. Tente de novo.");
    } finally {
      setBaixando(false);
    }
  }

  return (
    <section className="rounded-2xl card-material p-4">
      <h3 className="text-[15px] font-semibold">Baixar meus dados</h3>
      <p className="mt-1.5 text-[13px] leading-snug text-muted-foreground">
        Um arquivo com o que você registrou aqui: diário, medidas, cartas, plano de parto, conversas
        e os resumos das suas consultas. É seu, e você pode levar para onde quiser.
      </p>
      <button
        type="button"
        onClick={() => void baixar()}
        disabled={baixando}
        className="press mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-primary/40 text-sm font-semibold text-primary disabled:opacity-50"
      >
        <Download className="h-4 w-4" strokeWidth={2.2} />
        {baixando ? "Montando o arquivo…" : "Baixar meus dados"}
      </button>
      {/* ⚠️ O aviso de que o arquivo tem dado de saúde e não tem senha. Quem
          exporta manda por WhatsApp sem pensar, e este é o único momento em que
          dá para dizer isso. */}
      <p className="mt-2 text-[11.5px] leading-snug text-muted-foreground">
        O arquivo tem informações de saúde e não tem senha. Guarde com o mesmo cuidado que teria com
        um exame.
      </p>
    </section>
  );
}
