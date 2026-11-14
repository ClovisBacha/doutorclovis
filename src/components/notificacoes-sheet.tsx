import { Bell, ChevronRight, X } from "lucide-react";
/* As peças da família do coração no lugar dos emojis das quatro
   notificações derivadas (set/2026). O mapa é por EMOJI porque é o campo que
   `Notificacao.icone` carrega: uma notificação nova nasce com emoji e
   aparece com ele até ganhar peça — nunca com um buraco. */
import icMedico from "@/assets/avisos/medico.webp";
import icPresente from "@/assets/avisos/presente.webp";
import icLocalizacao from "@/assets/avisos/localizacao.webp";
import icContato from "@/assets/avisos/contato.webp";
const ARTE_DO_AVISO: Readonly<Record<string, string>> = {
  "👩‍⚕️": icMedico,
  "🎁": icPresente,
  "📍": icLocalizacao,
  "🆘": icContato,
};
import type { Lidas, Notificacao } from "@/lib/notificacoes";
import { useVoltar } from "@/lib/use-voltar";
import { useTravarRolagemDeFundo } from "@/lib/use-travar-rolagem";

/**
 * A caixa de entrada do app.
 *
 * Ela abre por cima de tudo (o ☰ fecha antes), e é uma folha e não um modal
 * pequeno porque a lista cresce: recado do médico, novidade do app e os avisos
 * do próprio aplicativo vão todos parar aqui.
 *
 * O item lido não sai da lista nem fica cinza-morto: perde só o ponto e o
 * peso do título. Sumir com o que foi lido é o que faz alguém não achar mais
 * aquele aviso que dispensou sem querer — o defeito que esta tela existe para
 * corrigir.
 */
export function NotificacoesSheet({
  lista,
  lidas,
  onLer,
  onFechar,
}: {
  lista: Notificacao[];
  lidas: Lidas;
  /**
   * Marca UM recado como lido.
   *
   * ⚠️ Antes, abrir a gaveta marcava a lista inteira. Pedido do dono junto com
   * o bebê bolha: quem lê é o toque na mensagem. A diferença não é detalhe —
   * quem abria a caixa e via cinco recados sem tempo de ler perdia o rastro
   * dos cinco de uma vez, e o emblema zerava sem nada ter sido lido.
   *
   * Vale para os DOIS tipos: o que tem ação leva a algum lugar, e o que não
   * tem é só um aviso — mas os dois foram lidos ao serem tocados.
   */
  onLer?: (id: string) => void;
  onFechar: () => void;
}) {
  /* Voltar (Android) e Escape fecham a folha, não o app. */
  useVoltar(true, onFechar);
  /* A página de trás não anda enquanto esta folha está aberta — ver
     `useTravarRolagemDeFundo`, que guarda e restaura o valor anterior. */
  useTravarRolagemDeFundo(true);
  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/35 backdrop-blur-sm sm:items-center"
      onClick={onFechar}
    >
      <div
        role="dialog"
        aria-label="Notificações"
        onClick={(e) => e.stopPropagation()}
        className="tab-enter max-h-[82vh] w-full overflow-hidden rounded-t-3xl border border-white/70 bg-card/97 shadow-[var(--shadow-float)] backdrop-blur-xl sm:max-w-md sm:rounded-3xl"
        style={{ paddingBottom: "var(--safe-bottom)" }}
      >
        <div className="flex items-center gap-3 border-b border-border/60 px-5 py-4">
          <Bell className="h-5 w-5 shrink-0 text-primary" strokeWidth={1.9} />
          <p className="flex-1 font-serif text-lg leading-tight text-foreground">Notificações</p>
          <button
            onClick={onFechar}
            aria-label="Fechar"
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-primary/8 hover:text-foreground"
          >
            <X className="h-[18px] w-[18px]" strokeWidth={1.9} />
          </button>
        </div>

        <div className="max-h-[calc(82vh-4.5rem)] overflow-y-auto px-2 py-2">
          {lista.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <Bell className="mx-auto h-8 w-8 text-muted-foreground/40" strokeWidth={1.4} />
              <p className="mt-3 text-sm font-semibold text-foreground">Tudo em dia</p>
              {/* ⚠️ O texto NÃO promete recado do médico.
                  Ele prometia — "avisos do app e recados do seu médico aparecem
                  aqui" —, e não é verdade: esta caixa só monta notificações
                  DERIVADAS do estado da conta (ver `lib/notificacoes.ts`). As
                  mensagens que o médico manda chegam pela conversa e por push,
                  e nunca aparecem aqui. A paciente que lesse isso passaria a
                  vir olhar uma caixa vazia esperando o médico dela — e o
                  silêncio de um obstetra de alto risco não é um detalhe de
                  interface. Volte a citá-lo aqui SÓ quando as enviadas
                  existirem de fato. */}
              <p className="mt-1 text-xs text-muted-foreground">
                Quando o app tiver algo para lembrar você, aparece aqui.
              </p>
            </div>
          ) : (
            lista.map((n) => {
              const naoLida = !lidas.has(n.id);
              /* Todo item vira BOTÃO, tenha ação ou não: tocar é ler, e o
                 aviso sem destino também precisa poder ser lido. Antes, o que
                 não tinha para onde levar era uma `div` e ficava com o ponto
                 vermelho para sempre. */
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => {
                    /* Marcar ANTES de executar: a ação pode fechar a folha,
                       trocar de aba e desmontar tudo — e aí a marcação nunca
                       aconteceria. É o mesmo motivo pelo qual o lembrete de
                       consulta é gravado antes de ser enviado. */
                    onLer?.(n.id);
                    n.acao?.executar();
                  }}
                  className="flex w-full items-start gap-3 rounded-2xl px-3.5 py-3.5 text-left transition-colors hover:bg-primary/8 active:bg-primary/12"
                >
                  <span className="relative mt-0.5 shrink-0 text-xl leading-none">
                    {ARTE_DO_AVISO[n.icone] ? (
                      <img
                        src={ARTE_DO_AVISO[n.icone]}
                        alt=""
                        aria-hidden
                        className="h-9 w-9 object-contain drop-shadow-[0_6px_10px_rgba(0,0,0,0.12)]"
                      />
                    ) : (
                      n.icone
                    )}
                    {/* O ponto no ITEM, além do ponto no ☰: sem ele, uma lista
                        de cinco avisos com um novo no meio não diz qual é o
                        novo. */}
                    {naoLida && (
                      <span
                        aria-hidden
                        className="absolute -right-1 -top-0.5 h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-card"
                      />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block text-sm leading-snug text-foreground ${
                        naoLida ? "font-bold" : "font-semibold"
                      }`}
                    >
                      {n.titulo}
                      {naoLida && <span className="sr-only"> (não lida)</span>}
                    </span>
                    <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
                      {n.corpo}
                    </span>
                    {n.acao && (
                      <span className="mt-1.5 inline-flex items-center gap-0.5 text-xs font-semibold text-primary">
                        {n.acao.rotulo}
                        <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.2} />
                      </span>
                    )}
                  </span>
                </button>
              );
            })
          )}
        </div>

        {/* ─── ⚠️ "RÉGUA DO APARELHO" SAIU DAQUI (ago/2026) ─────────────────
            Havia um link no pé desta folha levando a `/preview-regua`, uma
            tela de DIAGNÓSTICO com `safe-area`, `innerHeight`, `devicePixelRatio`
            e afins. Ele existia porque o app instalado não tem barra de
            endereço, e sem esse atalho não havia como abrir a régua dentro do
            aplicativo para investigar defeitos que só acontecem lá.

            O dono abriu a caixa de recados, encontrou aquilo e disse: "não
            entendi o que é isso… em nenhum momento é pra estar essa função
            ali". Ele está certo, e a razão é simples: a caixa de entrada é
            onde a PACIENTE lê o que o médico mandou. Uma ferramenta de
            desenvolvimento no meio disso não é discreta, é confusa.

            A rota `/preview-regua` CONTINUA de pé — ela é `noindex` e se
            alcança digitando o endereço no Safari. O que saiu foi a porta na
            tela da paciente, não a capacidade de diagnosticar. */}
      </div>
    </div>
  );
}
