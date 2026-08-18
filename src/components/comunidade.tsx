/**
 * A ABA COMUNIDADE — a porta única.
 *
 * Ela assumiu o lugar do Chat na barra de baixo. Ver `src/lib/comunidade.ts`
 * para a régua de quais portas aparecem (e por que a votação de nome sai no
 * Modo Cuidado enquanto a rede de apoio fica).
 *
 * A primeira versão faz duas coisas:
 *
 *  1. **Reúne o que já existia solto** — Amigas, Acompanhante, Álbum e a
 *     votação de nomes viviam em quatro caminhos diferentes, nenhum deles onde
 *     alguém procuraria "as pessoas que estão comigo nisso".
 *  2. **Recebe a lista de presentes e o chá de bebê**, que é o que vem a
 *     seguir e o motivo de a aba existir com porta própria.
 *
 * ⚠️ As portas são ATALHOS, nunca cópias — elas abrem a tela que já existe, no
 * lugar onde ela já mora. É a mesma decisão do hub da Saúde com Chutes e
 * Contrações: duas implementações da mesma coisa divergem no primeiro conserto.
 */
import { portasDaComunidade } from "@/lib/comunidade";

export function ComunidadeTab({
  careMode = false,
  onAbrir,
}: {
  careMode?: boolean;
  /** Leva à aba (e sub-tela) de destino. Mesma assinatura do hub da Saúde. */
  onAbrir: (destino: string, subDestino?: string) => void;
}) {
  const portas = portasDaComunidade({ careMode });

  return (
    <div className="space-y-5">
      <header>
        <h2 className="text-xl font-semibold">Comunidade</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          As pessoas que estão com você nessa jornada.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-2.5">
        {portas.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => onAbrir(p.destino, p.subDestino)}
            className="press flex flex-col items-start gap-1 rounded-2xl border border-border bg-card p-4 text-left shadow-[var(--shadow-card)]"
          >
            <span className="text-2xl leading-none">{p.emoji}</span>
            <span className="mt-1 font-semibold leading-tight">{p.label}</span>
            <span className="text-xs leading-snug text-muted-foreground">{p.sub}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
