import {
  Archive,
  Ban,
  Bookmark,
  ChevronRight,
  Compass,
  Flag,
  History,
  MessageCircleQuestion,
  Search,
  Star,
  X,
} from "lucide-react";
import { useVoltar } from "@/lib/use-voltar";

/**
 * "MAIS" DA COMUNIDADE — a folha que guarda o que não é uso diário.
 *
 * Pedido do dono, com a foto do aparelho (set/2026): o leque que sobe do
 * ícone da Comunidade tinha CATORZE bolinhas numa coluna só. Ele nasceu com
 * seis e cada função nova entrou ali; com catorze ele passava por cima do
 * relógio e do sinal do celular, três ícones se repetiam (a grade três vezes,
 * a pessoa três vezes) e ele misturava três naturezas de coisa — o que ela faz
 * todo dia, o que é dela, e segurança. "Muitas opções e muito confuso."
 *
 * O leque ficou com o uso diário (Publicar · Mensagens · Atividade · Meu
 * perfil) e a quinta bolinha é "Mais", que abre ESTA folha, em três grupos:
 *
 *   Minhas coisas   Salvos · Arquivados · Meus stories · Favoritas
 *   Descobrir       Explorar · Buscar
 *   Segurança       Bloqueados · Suas denúncias · Caixinha
 *
 * ⚠️ **Cada item tem ícone PRÓPRIO.** Era o defeito mais visível do leque:
 * sem ler o rótulo, ninguém distinguia "Arquivados" de "Meus stories" nem
 * "Bloqueados" de "Suas denúncias".
 *
 * ⚠️ **Chá de bebê, álbum, amigas e acompanhante NÃO estão aqui.** A porta
 * deles é a bolinha ⊞ da fileira de stories, que já existia. Dois "Mais" na
 * mesma tela com destinos parecidos era metade da confusão — cada um passa a
 * ter um assunto só.
 *
 * ⚠️ **A folha não sabe o que cada item FAZ** — recebe tudo por prop, como
 * `ListaDeBloqueados` e o alerta de SOS. É o que a torna fotografável na
 * bancada (`/preview-instagram?tela=mais`) sem conta nenhuma: o leque nunca
 * teve bancada, e foi assim que ele chegou a catorze sem ninguém olhar.
 *
 * ⚠️ **Fecha ANTES de agir**, como a nuvem de atalhos: a ação troca de tela e
 * desmonta a folha, e fechar depois seria escrever num componente que já saiu.
 */
export type IconeDoMais =
  | "salvos"
  | "arquivados"
  | "stories"
  | "favoritas"
  | "explorar"
  | "buscar"
  | "bloqueados"
  | "denuncias"
  | "caixinha";

export type ItemDoMais = {
  id: string;
  rotulo: string;
  /** Uma linha, no que ela pensa — não no que o código faz. */
  descricao: string;
  icone: IconeDoMais;
  /** Número, nunca booleano — a mesma régua do emblema do bebê bolha. */
  emblema?: number;
  aoTocar: () => void;
};

export type GrupoDoMais = {
  id: string;
  titulo: string;
  itens: ItemDoMais[];
};

const ICONE: Record<IconeDoMais, typeof Bookmark> = {
  salvos: Bookmark,
  arquivados: Archive,
  stories: History,
  favoritas: Star,
  explorar: Compass,
  buscar: Search,
  bloqueados: Ban,
  denuncias: Flag,
  caixinha: MessageCircleQuestion,
};

export function MaisDaComunidade({
  grupos,
  onFechar,
}: {
  grupos: readonly GrupoDoMais[];
  onFechar: () => void;
}) {
  useVoltar(true, onFechar);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Mais da Comunidade"
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/35 backdrop-blur-sm sm:items-center"
      onClick={onFechar}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="tab-enter flex max-h-[88svh] w-full flex-col overflow-hidden rounded-t-3xl border border-white/70 bg-card/97 shadow-[var(--shadow-float)] backdrop-blur-xl sm:max-w-md sm:rounded-3xl"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <header className="flex items-center gap-2 px-5 pt-4 pb-1">
          <h2 className="min-w-0 flex-1 font-serif text-[19px] font-bold text-foreground">
            Mais da Comunidade
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

        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
          {grupos.map((g) => (
            <section key={g.id} className="mb-1">
              <h3 className="px-3 pt-3 pb-1 font-serif text-[15px] font-semibold text-muted-foreground">
                {g.titulo}
              </h3>
              <ul className="card-material rounded-2xl p-1" style={{ listStyle: "none" }}>
                {g.itens.map((it) => {
                  const Icone = ICONE[it.icone];
                  return (
                    <li key={it.id}>
                      <button
                        type="button"
                        onClick={() => {
                          onFechar();
                          it.aoTocar();
                        }}
                        className="press flex min-h-[52px] w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left hover:bg-primary/8"
                      >
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                          <Icone className="h-5 w-5" aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className="text-[15px] font-semibold text-foreground">
                              {it.rotulo}
                            </span>
                            {typeof it.emblema === "number" && it.emblema > 0 && (
                              <span className="rounded-full bg-rose-700 px-1.5 text-xs font-bold leading-5 text-white">
                                {it.emblema > 9 ? "9+" : it.emblema}
                              </span>
                            )}
                          </span>
                          <span className="block text-xs leading-snug text-muted-foreground">
                            {it.descricao}
                          </span>
                        </span>
                        <ChevronRight
                          className="h-4 w-4 shrink-0 text-muted-foreground"
                          aria-hidden
                        />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
