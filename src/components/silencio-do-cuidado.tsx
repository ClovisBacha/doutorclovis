import { X } from "lucide-react";
/**
 * ⚠️ `import type` — apagado na compilação, então não há ciclo em execução.
 * O lugar certo de `Tab` é `lib/`, mas movê-lo toca dezenas de referências e
 * um corte que também faz isso deixa de ser um MOVE.
 */
import type { Tab } from "@/routes/_authenticated/minha-conta";

/**
 * O CARTÃO DO MODO CUIDADO — o que cinco abas mostram no lugar do conteúdo.
 *
 * ⚠️ **Saiu de `minha-conta.tsx` como um MOVE, byte a byte.** Ele vem primeiro
 * porque é COMPARTILHADO: `KicksTab`, `SonsBebêTab`, `ConquistasTab`,
 * `CantinhoTab` e `LojaTab` o desenham. Sem tirá-lo daqui, mover qualquer uma
 * dessas abas exigiria exportá-lo de um arquivo de ROTA — a dívida que estes
 * cortes existem para pagar.
 */
export function SilencioDoCuidado({ onNavigate }: { onNavigate?: (t: Tab) => void }) {
  return (
    <div className="rounded-3xl card-material p-8 text-center">
      <p className="text-sm leading-relaxed text-muted-foreground">
        Esta parte do aplicativo está em pausa enquanto o Modo Cuidado estiver ligado.
      </p>
      {onNavigate && (
        <button
          onClick={() => onNavigate("Perfil")}
          className="press mt-4 rounded-full border border-border px-5 py-2 text-xs font-semibold text-foreground"
        >
          Ajustes do Modo Cuidado
        </button>
      )}
    </div>
  );
}
