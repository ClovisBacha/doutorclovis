import { useState } from "react";
import { MOTIVOS, type MotivoDaDenuncia } from "@/lib/denuncias";

/**
 * A FOLHA DE MOTIVO — a mesma nas CINCO portas de denúncia.
 *
 * ⚠️ **Ela mora em arquivo PRÓPRIO, e a razão é de arquitetura.** Ela nasceu
 * dentro de `rede-instagram.tsx`; no dia em que a fila do painel passou a usá-la
 * (para escolher o motivo de uma suspensão), o import puxou aquele arquivo
 * inteiro para o pacote do painel — e com ele a régua clínica, que tem `(?<!`
 * nas fronteiras e derruba Safari antigo. A catraca "a régua clínica não entra
 * no pacote do navegador" ficou vermelha na hora.
 *
 * ⚠️ **O motivo é CATÁLOGO FECHADO em todas as portas.** Campo livre numa
 * denúncia de app de gestação é onde alguém escreve a informação clínica de
 * outra pessoa — e, na suspensão, o texto que alguém escreve às pressas sobre
 * uma paciente.
 */
export function EscolherMotivo({
  titulo,
  aviso,
  aoCancelar,
  aoEnviar,
}: {
  titulo: string;
  aviso: string;
  aoCancelar: () => void;
  aoEnviar: (motivo: MotivoDaDenuncia) => void;
}) {
  const [motivo, setMotivo] = useState<MotivoDaDenuncia | null>(null);
  return (
    <div className="rounded-2xl border border-border bg-muted/40 p-3">
      <p className="text-[13px] font-semibold leading-snug">{titulo}</p>
      {/* ⚠️ Diz que é CALADO: sem isso ela hesita achando que a outra vai
          saber — a mesma razão pela qual o bloqueio é mudo. */}
      <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">{aviso}</p>

      <div className="mt-2.5 space-y-1">
        {MOTIVOS.map((m) => (
          <button
            key={m.motivo}
            type="button"
            onClick={() => setMotivo(m.motivo)}
            aria-pressed={motivo === m.motivo}
            className={`press block min-h-[44px] w-full rounded-xl border px-3 py-1.5 text-left ${
              motivo === m.motivo ? "border-primary bg-primary/10" : "border-border"
            }`}
          >
            <span className="block text-[13px] font-medium">{m.rotulo}</span>
            <span className="block text-[11px] leading-tight text-muted-foreground">
              {m.explica}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-2.5 flex gap-2">
        <button
          type="button"
          onClick={aoCancelar}
          className="press flex-1 rounded-xl border border-border py-1.5 text-[13px]"
        >
          Cancelar
        </button>
        <button
          type="button"
          /* ⚠️ Só habilita com motivo escolhido: sem isso a fila recebe
             "outro" por omissão, e o campo que existe para dizer POR QUÊ passa
             a não dizer nada. */
          disabled={!motivo}
          onClick={() => motivo && aoEnviar(motivo)}
          className="press flex-1 rounded-xl bg-destructive py-1.5 text-[13px] font-semibold text-destructive-foreground disabled:opacity-45"
        >
          Denunciar
        </button>
      </div>
    </div>
  );
}
