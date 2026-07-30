/**
 * A primeira coisa que o médico vê: o que precisa dele AGORA.
 *
 * O painel tem doze abas, e um médico não abre painel para navegar — abre para
 * responder "o que precisa de mim?". Com doze abas ele precisa procurar essa
 * resposta em doze lugares, e o custo disso não é teórico: o dono do produto
 * mandou uma solicitação de paciente e o painel mostrou "0", porque o número do
 * topo contava outra coisa e o item morava numa aba fora da tela.
 *
 * A fila não substitui as abas. Elas continuam para quem quer PROCURAR; a fila é
 * para quem quer TRABALHAR. E ela não busca nada: monta-se do que o painel já
 * carregou, então não custa uma consulta a mais nem pode divergir das abas.
 *
 * A ordem é por urgência real, não por tipo:
 *   1. emergência sem desfecho — alguém pode estar em risco agora
 *   2. paciente esperando aceite — ela está vendo "aguardando" na tela dela
 *   3. pergunta sem resposta — ela perguntou e ninguém respondeu
 *   4. pedido de consulta — tem prazo, mas é de horas, não de minutos
 *   5. pré-consulta nova — leitura antes do atendimento
 */

export type ItemFila = {
  id: string;
  /** Governa cor e posição. */
  nivel: "emergencia" | "espera" | "pergunta" | "consulta" | "leitura";
  titulo: string;
  detalhe: string;
  /** Quando o item nasceu — vira "há 2h" na tela. */
  em: string | null;
  acao: string;
  onAcao: () => void;
};

const PESO: Record<ItemFila["nivel"], number> = {
  emergencia: 0,
  espera: 1,
  pergunta: 2,
  consulta: 3,
  leitura: 4,
};

const ESTILO: Record<ItemFila["nivel"], { faixa: string; rotulo: string; texto: string }> = {
  emergencia: {
    faixa: "bg-rose-600",
    rotulo: "Emergência",
    texto: "text-rose-700 dark:text-rose-300",
  },
  espera: {
    faixa: "bg-amber-500",
    rotulo: "Esperando você",
    texto: "text-amber-700 dark:text-amber-300",
  },
  pergunta: { faixa: "bg-primary", rotulo: "Pergunta", texto: "text-primary" },
  consulta: { faixa: "bg-sky-500", rotulo: "Consulta", texto: "text-sky-700 dark:text-sky-300" },
  leitura: {
    faixa: "bg-muted-foreground/50",
    rotulo: "Para ler",
    texto: "text-muted-foreground",
  },
};

function faz(iso: string | null): string {
  if (!iso) return "";
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  /* Data ilegível renderizava literalmente "Emergência · há NaN dias" — os
     três `if` abaixo comparam contra NaN e todos dão false. Numa emergência,
     essa linha é a única pista de tempo que ele tem. */
  if (!Number.isFinite(min)) return "";
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  return `há ${d} ${d === 1 ? "dia" : "dias"}`;
}

function quando(iso: string | null): number {
  if (!iso) return Number.MAX_SAFE_INTEGER;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : Number.MAX_SAFE_INTEGER;
}

export function FilaDeTrabalho({
  itens,
  /** Fontes que não puderam ser lidas — muda o que o estado vazio pode afirmar. */
  fontesComFalha = [],
}: {
  itens: ItemFila[];
  fontesComFalha?: string[];
}) {
  const ordenada = [...itens].sort((a, b) => {
    const p = PESO[a.nivel] - PESO[b.nivel];
    if (p !== 0) return p;
    /* Dentro do mesmo nível, o MAIS ANTIGO primeiro. É o contrário da ordem
       natural de feed, e de propósito: quem esperou mais tempo é quem está mais
       perto de desistir.

       Sem data vai para o FIM, e não para o começo. Com `?? 0` o item ia parar
       em 1970 e liderava o nível como "o mais antigo de todos" — a posição de
       maior urgência — sendo o único da lista sem o rótulo de idade que
       justificaria essa posição. */
    return quando(a.em) - quando(b.em);
  });

  if (ordenada.length === 0) {
    /* Fila vazia por FALHA não pode ser contada como boa notícia. Se uma das
       fontes não respondeu, o que a gente sabe é "não consegui olhar", e é
       isso que a tela diz — porque o médico que lê "nada esperando" fecha o
       painel tranquilo, e do outro lado pode haver uma emergência não lida. */
    if (fontesComFalha.length > 0) {
      return (
        <div className="mt-6 rounded-3xl border border-amber-300 bg-amber-50/60 p-6 text-center">
          <p className="text-3xl">📡</p>
          <p className="mt-2 font-serif text-lg text-foreground">
            Não consegui conferir tudo agora
          </p>
          <p className="mt-1 text-[13px] leading-snug text-muted-foreground">
            Falhou a leitura de: {fontesComFalha.join(", ")}. Pode ser conexão — atualize a página
            antes de considerar a fila vazia.
          </p>
        </div>
      );
    }
    return (
      <div className="mt-6 rounded-3xl border border-emerald-200 bg-emerald-50/60 p-6 text-center">
        <p className="text-3xl">☕</p>
        <p className="mt-2 font-serif text-lg text-foreground">Nada esperando por você</p>
        <p className="mt-1 text-[13px] leading-snug text-muted-foreground">
          Nenhuma emergência, nenhuma paciente aguardando aceite, nenhuma pergunta sem resposta.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-serif text-lg text-foreground">Precisa de você</h2>
        <span className="text-[11px] text-muted-foreground">
          {ordenada.length} {ordenada.length === 1 ? "item" : "itens"}
        </span>
      </div>

      <ul className="mt-2 space-y-2">
        {ordenada.map((i) => {
          const e = ESTILO[i.nivel];
          return (
            <li
              key={i.id}
              className="flex items-stretch overflow-hidden rounded-2xl border border-border bg-card"
            >
              {/* Faixa de cor à esquerda: dá para varrer a lista pelo canto e
                  saber o que é urgente sem ler uma palavra. */}
              <span aria-hidden className={`w-1.5 shrink-0 ${e.faixa}`} />
              <div className="flex min-w-0 flex-1 items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className={`text-[10px] font-bold uppercase tracking-[0.18em] ${e.texto}`}>
                    {e.rotulo}
                    {i.em ? ` · ${faz(i.em)}` : ""}
                  </p>
                  <p className="mt-0.5 truncate text-sm font-semibold text-foreground">
                    {i.titulo}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-muted-foreground">
                    {i.detalhe}
                  </p>
                </div>
                <button
                  onClick={i.onAcao}
                  className="press shrink-0 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
                >
                  {i.acao}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
