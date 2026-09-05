import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import {
  buscarFuncoes,
  FUNCOES_DO_APP,
  funcoesVisiveis,
  GRUPOS_DO_MAPA,
  type FuncaoDoApp,
} from "@/lib/mapa-do-app";
import { useVoltar } from "@/lib/use-voltar";
import { useTravarRolagemDeFundo } from "@/lib/use-travar-rolagem";

/**
 * "TUDO O QUE O APP FAZ" — o mapa do app, dentro do app.
 *
 * A rede de segurança de quem procura alguma coisa e não acha. Nasceu do
 * estudo de navegação (set/2026): mais de trinta funções que nenhum tutorial,
 * onboarding ou frase da bolha mencionava. A lista é `FUNCOES_DO_APP` — a
 * MESMA que alimenta o "Você sabia?" da bolha, então função nova entra nos
 * dois lugares sozinha.
 *
 * Agrupada por PERGUNTA ("estou bem?", "e o bebê?", "quem está comigo?") e
 * não por aba: a paciente não pensa em abas, pensa no que quer resolver.
 *
 * ⚠️ O que ela já abriu não ganha selo nenhum; o que ela NUNCA abriu ganha
 * "novo para você". Marcar o que já foi visto viraria um placar de uso do
 * app, e placar é o que este produto decidiu não ter.
 */
export function MapaDoApp({
  careMode,
  weeks,
  visitadas,
  onNavegar,
  onFechar,
}: {
  careMode: boolean;
  weeks: number | null | undefined;
  visitadas: ReadonlySet<string>;
  onNavegar: (tab: string, sub?: string) => void;
  onFechar: () => void;
}) {
  const [termo, setTermo] = useState("");
  useVoltar(true, onFechar);
  /* A página de trás não anda enquanto esta folha está aberta — ver
     `useTravarRolagemDeFundo`, que guarda e restaura o valor anterior. */
  useTravarRolagemDeFundo(true);
  const visiveis = useMemo(() => funcoesVisiveis({ careMode, weeks }), [careMode, weeks]);
  const lista = useMemo(() => buscarFuncoes(termo, visiveis), [termo, visiveis]);
  const buscando = termo.trim().length > 0;

  const abrir = (f: FuncaoDoApp) => onNavegar(f.tab, f.sub);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Tudo o que o app faz"
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/35 backdrop-blur-sm sm:items-center"
      onClick={onFechar}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="tab-enter flex max-h-[88svh] w-full flex-col overflow-hidden rounded-t-3xl border border-white/70 bg-card/97 shadow-[var(--shadow-float)] backdrop-blur-xl sm:max-w-md sm:rounded-3xl"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <header className="flex items-center gap-2 px-5 pt-4 pb-2">
          <h2 className="min-w-0 flex-1 font-serif text-[19px] font-bold text-foreground">
            Tudo o que o app faz
          </h2>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            className="press -mr-2 flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </header>
        <label className="mx-5 mb-2 flex items-center gap-2 rounded-2xl border border-border bg-background px-3 py-2">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <input
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            placeholder="Procurar uma função"
            aria-label="Procurar uma função"
            className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground"
          />
          {buscando && (
            <button
              type="button"
              onClick={() => setTermo("")}
              aria-label="Limpar a busca"
              className="press text-xs font-semibold text-primary"
            >
              limpar
            </button>
          )}
        </label>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
          {buscando && lista.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              Nada com esse nome. Tente outra palavra — ou me pergunte no chat, que eu te levo.
            </p>
          )}
          {GRUPOS_DO_MAPA.map((g) => {
            const doGrupo = lista.filter((f) => f.grupo === g.id);
            if (doGrupo.length === 0) return null;
            return (
              <section key={g.id} className="mb-2">
                <h3 className="px-3 pt-3 pb-1 text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground">
                  {g.titulo}
                </h3>
                {doGrupo.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => abrir(f)}
                    className="flex w-full items-start gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors hover:bg-primary/8"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="text-[15px] font-semibold text-foreground">
                          {f.titulo}
                        </span>
                        {!visitadas.has(f.id) && (
                          <span className="rounded-full bg-primary/10 px-2 py-px text-xs font-bold text-primary">
                            novo para você
                          </span>
                        )}
                      </span>
                      <span className="block text-xs leading-snug text-muted-foreground">
                        {f.descricao}
                      </span>
                    </span>
                  </button>
                ))}
              </section>
            );
          })}
        </div>
        <p className="border-t border-border/60 px-5 py-2.5 text-center text-xs text-muted-foreground">
          {FUNCOES_DO_APP.length} funções · {visiveis.filter((f) => !visitadas.has(f.id)).length}{" "}
          que você ainda não abriu
        </p>
      </div>
    </div>
  );
}
