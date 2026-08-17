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
 *  2. **Traz o bolão do nascimento**, que é a função nova.
 *
 * ⚠️ As portas são ATALHOS, nunca cópias — elas abrem a tela que já existe, no
 * lugar onde ela já mora. É a mesma decisão do hub da Saúde com Chutes e
 * Contrações: duas implementações da mesma coisa divergem no primeiro conserto.
 */
import { BolaoDoNascimento, type BancadaDoBolao } from "@/components/bolao-do-nascimento";
import { portasDaComunidade } from "@/lib/comunidade";

export function ComunidadeTab({
  donaId,
  careMode = false,
  onAbrir,
  bancadaDoBolao,
}: {
  /** A própria paciente — o bolão dela. */
  donaId: string | null;
  careMode?: boolean;
  /** Leva à aba (e sub-tela) de destino. Mesma assinatura do hub da Saúde. */
  onAbrir: (destino: string, subDestino?: string) => void;
  bancadaDoBolao?: BancadaDoBolao;
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

      {/* O bolão primeiro: é a única coisa desta tela que muda sozinha, e o
          que faz alguém voltar. As portas são estáveis — quem já sabe onde
          fica o álbum não precisa vê-lo no topo todo dia. */}
      <BolaoDoNascimento donaId={donaId} careMode={careMode} bancada={bancadaDoBolao} />

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
