/**
 * A CAIXA DE ENTRADA E A CONVERSA.
 *
 * A régua mora em `conversa.ts` e a lei em `conversa.functions.ts`. Aqui só se
 * desenha — e as duas decisões de tela que importam são:
 *
 * ⚠️ **OS PEDIDOS FICAM NUMA CAIXA SEPARADA, com aviso.** Misturados à lista
 * principal, uma mensagem de estranha chega com a mesma cara de uma amiga — e é
 * exatamente essa indistinção que faz a paciente abrir por reflexo.
 *
 * ⚠️ **A CONVERSA MARCA COMO LIDA AO ABRIR, e não ao rolar até o fim.** Abrir e
 * fechar sem ler acontece; mas um emblema que só apaga no fim da rolagem fica
 * aceso para sempre em conversa longa, e o número perde o sentido.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { ConversaNaTela, MensagemNaTela } from "@/lib/conversa.functions";
import { LIMITE_DA_MENSAGEM } from "@/lib/conversa";

async function token() {
  const { supabase } = await import("@/integrations/supabase/client");
  const s = await supabase.auth.getSession();
  return s.data.session?.access_token ?? null;
}

function Avatar({ url, nome }: { url: string | null; nome: string }) {
  if (url) return <img src={url} alt="" className="h-12 w-12 rounded-full object-cover" />;
  return (
    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-[15px] font-semibold">
      {(nome.trim()[0] ?? "?").toUpperCase()}
    </div>
  );
}

export function CaixaDeEntrada({
  aoVoltar,
  aoAbrir,
  bancada,
}: {
  aoVoltar: () => void;
  aoAbrir: (conversa: ConversaNaTela) => void;
  /** Só a bancada preenche — a lista vem do servidor e exige sessão. */
  bancada?: ConversaNaTela[];
}) {
  const [lista, setLista] = useState<ConversaNaTela[] | null>(bancada ?? null);
  const [erro, setErro] = useState(false);
  const [vendoPedidos, setVendoPedidos] = useState(false);

  const carregar = useCallback(async () => {
    if (bancada) return;
    try {
      const t = await token();
      if (!t) return;
      const { minhasConversas } = await import("@/lib/conversa.functions");
      const r = await minhasConversas({ data: { accessToken: t } });
      if (r.ok) {
        setLista(r.conversas);
        setErro(false);
      } else setErro(true);
    } catch {
      setErro(true);
    }
  }, [bancada]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  /* ⚠️ Pedido que EU mandei fica na lista NORMAL: ele é uma conversa minha
     esperando resposta, não um pedido para eu decidir. A caixa de pedidos é só
     do que chegou. */
  const pedidos = (lista ?? []).filter((c) => c.pedido && !c.euIniciei);
  const normais = (lista ?? []).filter((c) => !(c.pedido && !c.euIniciei));
  const mostrando = vendoPedidos ? pedidos : normais;

  return (
    <div className="pb-24">
      <header className="flex h-11 items-center gap-3 px-4">
        <button type="button" onClick={aoVoltar} className="press text-[15px]">
          ←
        </button>
        <h1 className="text-[16px] font-semibold">
          {vendoPedidos ? "Pedidos de mensagem" : "Mensagens"}
        </h1>
      </header>

      {!vendoPedidos && pedidos.length > 0 && (
        <button
          type="button"
          onClick={() => setVendoPedidos(true)}
          className="press flex w-full items-center justify-between px-4 py-3 text-left"
        >
          <span className="text-[14px] font-medium">
            {pedidos.length} {pedidos.length === 1 ? "pedido" : "pedidos"} de mensagem
          </span>
          <span className="text-[13px] text-muted-foreground">ver ›</span>
        </button>
      )}
      {vendoPedidos && (
        <p className="px-4 pb-2 text-[12px] leading-snug text-muted-foreground">
          Elas não podem escrever de novo até você responder.
        </p>
      )}

      {erro && (
        <p className="px-4 py-6 text-[14px] text-muted-foreground">
          Não consegui carregar agora. Tente de novo daqui a pouco.
        </p>
      )}

      {lista && !erro && mostrando.length === 0 && (
        <p className="px-4 py-10 text-center text-[14px] text-muted-foreground">
          {vendoPedidos ? "Nenhum pedido por aqui." : "Nenhuma conversa ainda 💛"}
        </p>
      )}

      {mostrando.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => aoAbrir(c)}
          className="press flex w-full items-center gap-3 px-4 py-2.5 text-left"
        >
          <Avatar url={c.comAvatar} nome={c.comNome} />
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5">
              <span className="truncate text-[15px] font-semibold">{c.comNome}</span>
              {c.pedido && c.euIniciei && (
                <span className="shrink-0 text-[11px] text-muted-foreground">aguardando</span>
              )}
            </span>
            <span className="block truncate text-[13px] text-muted-foreground">{c.previa}</span>
          </span>
          {/* ⚠️ O ponto, e não um número: numa conversa "quantas não li" não
              muda o que ela vai fazer — ela vai abrir do mesmo jeito. */}
          {c.naoLida && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-primary" />}
        </button>
      ))}

      {vendoPedidos && (
        <button
          type="button"
          onClick={() => setVendoPedidos(false)}
          className="press mt-4 w-full px-4 text-left text-[14px]"
        >
          ‹ voltar para as mensagens
        </button>
      )}
    </div>
  );
}

export function Conversa({
  conversa,
  aoVoltar,
  aoAbrirPerfil,
  bancada,
}: {
  conversa: ConversaNaTela;
  aoVoltar: () => void;
  aoAbrirPerfil?: (id: string) => void;
  bancada?: { mensagens: MensagemNaTela[]; pedido?: boolean; euIniciei?: boolean };
}) {
  const [mensagens, setMensagens] = useState<MensagemNaTela[]>(bancada?.mensagens ?? []);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [recado, setRecado] = useState<string | null>(null);
  const [pedido, setPedido] = useState(bancada?.pedido ?? conversa.pedido);
  /** A mensagem que ela tocou, esperando confirmação para apagar. */
  const [apagando, setApagando] = useState<string | null>(null);
  const [euIniciei, setEuIniciei] = useState(bancada?.euIniciei ?? conversa.euIniciei);
  const fim = useRef<HTMLDivElement>(null);

  const carregar = useCallback(async () => {
    if (bancada) return;
    try {
      const t = await token();
      if (!t) return;
      const mod = await import("@/lib/conversa.functions");
      const r = await mod.mensagensDaConversa({
        data: { accessToken: t, conversaId: conversa.id },
      });
      if (r.ok) {
        setMensagens(r.mensagens);
        setPedido(r.pedido);
        setEuIniciei(r.euIniciei);
      }
      /* ⚠️ MARCA LIDA AO ABRIR. Ver o cabeçalho: um emblema que só apaga no fim
         da rolagem fica aceso para sempre em conversa longa. */
      await mod.marcarConversaLida({ data: { accessToken: t, conversaId: conversa.id } });
    } catch {
      /* A tela fica com o que já tinha. */
    }
  }, [bancada, conversa.id]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  useEffect(() => {
    fim.current?.scrollIntoView({ block: "end" });
  }, [mensagens.length]);

  /* ⚠️ A trava do pedido é do SERVIDOR; a tela só a explica. Quem pediu e já
     mandou a sua mensagem vê o campo desligado com o motivo — melhor que um
     campo que aceita texto e devolve erro depois de ela escrever. */
  const esperando = pedido && euIniciei && mensagens.some((m) => m.souEu);

  async function apagar(id: string) {
    setApagando(null);
    try {
      const t = await token();
      if (!t) return;
      const { apagarMensagem } = await import("@/lib/conversa.functions");
      const r = await apagarMensagem({ data: { accessToken: t, id } });
      /* ⚠️ Só repinta se o servidor confirmou: pintar "apagada" sobre uma
         recusa deixaria a tela dizendo que sumiu algo que a outra pessoa
         continua vendo. */
      if (r.ok) await carregar();
      else setRecado("Não deu para apagar agora.");
    } catch {
      setRecado("Não deu para apagar agora.");
    }
  }

  async function enviar() {
    const t = texto.trim();
    if (!t || enviando || esperando) return;
    setEnviando(true);
    setRecado(null);
    try {
      const tk = await token();
      if (!tk) return;
      const { enviarMensagem } = await import("@/lib/conversa.functions");
      const r = await enviarMensagem({
        data: { accessToken: tk, conversaId: conversa.id, texto: t },
      });
      if (r.ok) {
        setTexto("");
        await carregar();
      } else {
        setRecado(
          r.motivo === "aguardando_aceite"
            ? "Você já enviou sua mensagem. Espere a resposta."
            : r.motivo === "bloqueio"
              ? "Não é possível enviar."
              : r.motivo === "muitas"
                ? "Muitas mensagens hoje. Tente amanhã."
                : "Não deu para enviar agora.",
        );
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex h-[100dvh] flex-col">
      <header className="flex h-11 shrink-0 items-center gap-3 border-b border-border px-4">
        <button type="button" onClick={aoVoltar} className="press text-[15px]">
          ←
        </button>
        <button
          type="button"
          onClick={() => aoAbrirPerfil?.(conversa.comId)}
          className="press flex min-w-0 items-center gap-2"
        >
          <span className="truncate text-[15px] font-semibold">{conversa.comNome}</span>
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {pedido && !euIniciei && (
          <p className="mx-auto mb-3 max-w-[280px] rounded-xl bg-muted/60 px-3 py-2 text-center text-[12px] leading-snug text-muted-foreground">
            Pedido de mensagem. Se você responder, a conversa fica aberta.
          </p>
        )}
        {mensagens.map((m) => (
          <div key={m.id} className={`mb-1.5 flex ${m.souEu ? "justify-end" : "justify-start"}`}>
            {/* ⚠️ **SÓ A MINHA MENSAGEM É TOCÁVEL, e o servidor confere de novo.**
                Apagar a mensagem da outra pessoa não é "apagar para mim" — seria
                reescrever a conversa dela. O `.eq("autor_id", eu)` do servidor é
                quem manda; isto aqui só evita oferecer o que seria recusado. */}
            <p
              onClick={() => m.souEu && !m.apagada && setApagando(m.id)}
              className={`max-w-[78%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-[14px] leading-snug ${
                m.souEu && !m.apagada ? "cursor-pointer" : ""
              } ${
                m.apagada
                  ? "bg-muted/50 italic text-muted-foreground"
                  : m.souEu
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
              }`}
            >
              {m.apagada ? "Mensagem apagada" : m.texto}
            </p>
          </div>
        ))}
        <div ref={fim} />
      </div>

      {/* ⚠️ **CONFIRMAÇÃO EM MENSAGEM SEPARADA, e não o mesmo balão virando
          "tem certeza?".** É a mesma decisão do cancelar consulta, pedida pelo
          dono explicitamente — e aqui vale mais: o alvo é pequeno e fica junto
          dos outros balões, então um toque errado apagaria o que ela escreveu. */}
      {apagando && (
        <div className="shrink-0 border-t border-border px-4 py-3">
          <p className="text-[14px]">Apagar esta mensagem?</p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => void apagar(apagando)}
              className="press rounded-full bg-destructive px-4 py-1.5 text-[13px] font-semibold text-destructive-foreground"
            >
              Apagar
            </button>
            <button
              type="button"
              onClick={() => setApagando(null)}
              className="press rounded-full border border-border px-4 py-1.5 text-[13px]"
            >
              Manter
            </button>
          </div>
        </div>
      )}

      {recado && <p className="px-4 pb-1 text-[12px] text-muted-foreground">{recado}</p>}

      <div className="shrink-0 border-t border-border p-2 pb-[max(0.5rem,var(--safe-area-inset-bottom))]">
        {esperando ? (
          <p className="px-2 py-2 text-center text-[13px] text-muted-foreground">
            Você já enviou sua mensagem. Espere a resposta.
          </p>
        ) : (
          <div className="flex items-end gap-2">
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value.slice(0, LIMITE_DA_MENSAGEM))}
              rows={1}
              placeholder="Mensagem…"
              className="max-h-28 min-h-[40px] flex-1 resize-none rounded-2xl border border-border bg-background px-3 py-2 text-[14px]"
            />
            <button
              type="button"
              onClick={() => void enviar()}
              disabled={!texto.trim() || enviando}
              className="press h-10 shrink-0 rounded-full bg-primary px-4 text-[14px] font-semibold text-primary-foreground disabled:opacity-40"
            >
              Enviar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
