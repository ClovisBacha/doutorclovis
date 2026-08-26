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
import type { ConversaNaTela, MensagemNaTela, NotaNaTela } from "@/lib/conversa.functions";
import {
  BYTES_DA_FOTO,
  LIMITE_DA_MENSAGEM,
  REACOES_DE_MENSAGEM,
  textoDaCitacao,
  TAMANHO_DA_NOTA,
} from "@/lib/conversa";
import { MOTIVOS, type MotivoDaDenuncia } from "@/lib/denuncias";
import { FIGURINHAS, figurinhaDoTexto, textoDaFigurinha } from "@/lib/figurinhas";
import {
  EXPLICACAO_DA_SUGESTAO,
  RASCUNHO_DA_PRIMEIRA,
  TITULO_DA_SUGESTAO,
  type CandidataAConversa,
} from "@/lib/conversa-sugerida";

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

/**
 * De quanto em quanto tempo a conversa aberta pergunta se chegou coisa nova.
 *
 * ⚠️ **Seis segundos, e não um.** Um segundo daria sensação de tempo real e
 * multiplicaria por seis a carga no banco por conversa aberta — numa tela que a
 * paciente deixa aberta enquanto faz outra coisa. Seis fica abaixo do que se
 * percebe como atraso numa conversa escrita, e é o que o gênero usa quando não
 * há socket.
 */
const INTERVALO_DA_SONDAGEM = 6000;

/**
 * Junta o que já estava na tela com a página que acabou de chegar.
 *
 * ⚠️ **SEM ISTO, A SONDAGEM ENCOLHERIA A CONVERSA a cada seis segundos.** Ela
 * devolve só as últimas 50; sobrescrever direto apagaria as antigas que a
 * paciente carregou ao subir — e o trecho que ela estava lendo sumiria debaixo
 * dela, sozinho, sem nada explicando.
 *
 * ⚠️ **E a versão NOVA de cada id vence.** Uma mensagem apagada pela outra
 * pessoa volta como `apagada: true`: mantendo a antiga, o texto que ela apagou
 * continuaria na tela de quem já o tinha carregado.
 */
export function juntarMensagens(
  antigas: MensagemNaTela[],
  novas: MensagemNaTela[],
): MensagemNaTela[] {
  if (antigas.length === 0) return novas;
  const por = new Map<string, MensagemNaTela>();
  for (const m of antigas) por.set(m.id, m);
  for (const m of novas) {
    /**
     * ⚠️ **A URL DA FOTO É PRESERVADA, e este defeito era MEU.**
     *
     * O servidor reassina TODA foto da página a cada leitura, e a sondagem
     * refaz a página inteira de 6 em 6 segundos. Trocar o objeto inteiro
     * arrastava `imagemUrl` junto — URL nova a cada seis segundos, e URL nova é
     * chave de cache nova: o navegador **baixava a foto de novo**, para sempre,
     * numa conversa aberta.
     *
     * ⚠️ **Mas o resto do objeto TEM de vir do novo**: é assim que uma mensagem
     * apagada pela outra pessoa chega como `apagada: true` e que o ✓✓ acende.
     * O que se preserva é só a URL — e só quando as duas apontam para a mesma
     * foto (a antiga existir prova isso; a nova sumir significa apagada, e aí
     * a preservação não deve acontecer).
     */
    const antiga = por.get(m.id);
    const mantemFoto = !!antiga?.imagemUrl && !!m.imagemUrl && !m.apagada;
    por.set(m.id, mantemFoto ? { ...m, imagemUrl: antiga.imagemUrl } : m);
  }
  return [...por.values()].sort(
    (a, b) => new Date(a.criadaEm).getTime() - new Date(b.criadaEm).getTime(),
  );
}

/**
 * Reduz e sobe a foto pela URL assinada. Devolve o CAMINHO, ou `null`.
 *
 * ⚠️ **Reduz no APARELHO, antes de sair.** Uma foto de iPhone tem 3 a 5 MB; a
 * paciente manda pelo 4G dela e o app guarda o arquivo para sempre, pago pelo
 * consultório. `LADO_DA_FOTO` (900) é o tamanho de uma foto olhada uma vez
 * dentro de um balão — nem o do post (1080), que é publicação, nem o do avatar
 * (512), que é uma bolinha.
 */
async function subirFoto(token: string, conversaId: string, arquivo: File): Promise<string | null> {
  try {
    const [mod, { LADO_DA_FOTO }] = await Promise.all([
      import("@/lib/conversa.functions"),
      import("@/lib/conversa"),
    ]);

    /* ⚠️ **NÃO CORTA EM QUADRADO, ao contrário do avatar.** O recorte central de
       `prepararAvatar` existe porque o avatar é exibido em círculo; aqui a foto
       mais provável é uma ULTRASSOM em pé, e cortá-la ao quadrado comeria a
       cabeça e os pés do bebê — o conteúdo inteiro da mensagem. A proporção é
       mantida e só o LADO MAIOR é limitado. */
    const bitmap = await createImageBitmap(arquivo);
    const escala = Math.min(1, LADO_DA_FOTO / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * escala));
    canvas.height = Math.max(1, Math.round(bitmap.height * escala));
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((ok) =>
      canvas.toBlob((b) => ok(b), "image/jpeg", 0.82),
    );
    if (!blob) return null;

    const r = await mod.urlParaSubirFotoDaConversa({
      data: { accessToken: token, conversaId, extensao: "jpg" },
    });
    if (!r.ok) return null;

    /* ⚠️ Sobe DIRETO para o endereço assinado. Passar o arquivo pelo servidor
       faria uma foto de MB atravessar a função serverless — que tem teto de
       corpo e cobra por tempo de execução. */
    const posta = await fetch(r.url, {
      method: "PUT",
      body: blob,
      headers: { "content-type": "image/jpeg" },
    });
    if (!posta.ok) return null;
    return r.caminho;
  } catch {
    return null;
  }
}

export function CaixaDeEntrada({
  aoVoltar,
  aoAbrir,
  aoFalarCom,
  bancada,
  sugeridasDeBancada,
  notasDeBancada,
  grupos,
}: {
  aoVoltar: () => void;
  aoAbrir: (conversa: ConversaNaTela) => void;
  /** Puxa conversa com quem a fileira sugeriu. Ver `conversa-sugerida.ts`. */
  aoFalarCom?: (id: string, rascunho: string) => void;
  /** Só a bancada preenche — a lista vem do servidor e exige sessão. */
  bancada?: ConversaNaTela[];
  /**
   * A fileira de "mesma fase", injetada pela bancada.
   *
   * ⚠️ Ela depende de duas contas reais, na mesma fase, com perfil aberto e sem
   * conversa entre si — sem a bancada, conferir este desenho seria impossível, e
   * é exatamente assim que uma tela passa meses sem ninguém nunca ter olhado.
   */
  sugeridasDeBancada?: CandidataAConversa[];
  /**
   * As notas, injetadas pela bancada.
   *
   * ⚠️ Elas vivem 24 h e dependem do grafo — sem a bancada, fotografar a
   * fileira exigiria duas contas reais e uma nota escrita na última hora.
   */
  notasDeBancada?: NotaNaTela[];
  /**
   * A lista de grupos, injetada pela tela de fora.
   *
   * ⚠️ **É um NÓ, e não uma lista de dados.** `CaixaDeEntrada` não conhece
   * grupo nenhum: quem sabe abrir, criar e navegar é `RedeNoApp`, que tem os
   * destinos. Passar os dados aqui obrigaria esta tela a saber o que fazer com
   * eles, e ela já tem uma responsabilidade.
   */
  grupos?: React.ReactNode;
}) {
  const [lista, setLista] = useState<ConversaNaTela[] | null>(bancada ?? null);
  const [erro, setErro] = useState(false);
  const [vendoPedidos, setVendoPedidos] = useState(false);
  const [sugeridas, setSugeridas] = useState<CandidataAConversa[]>(sugeridasDeBancada ?? []);
  const [notas, setNotas] = useState<NotaNaTela[]>(notasDeBancada ?? []);
  /** `null` = ninguém aberto. A minha abre o campo; a das outras, o texto. */
  const [notaAberta, setNotaAberta] = useState<NotaNaTela | null>(null);
  const [rascunhoDaNota, setRascunhoDaNota] = useState("");

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

      /* ⚠️ **Num `try` PRÓPRIO, e depois da lista.** A fileira é um acessório:
         uma falha nela não pode derrubar a caixa de entrada, que é a tela. E
         `conversasSugeridas` já devolve lista vazia em vez de erro, pela mesma
         razão. */
      try {
        const mod = await import("@/lib/conversa.functions");
        /* ⚠️ Notas e sugeridas na MESMA onda: são duas consultas independentes,
           e em série a fileira só apareceria depois da outra. */
        const [sug, nt] = await Promise.all([
          mod.conversasSugeridas({ data: { accessToken: t } }),
          mod.notasDeQuemEuSigo({ data: { accessToken: t } }),
        ]);
        if (sug.ok) setSugeridas(sug.sugeridas);
        if (nt.ok) setNotas(nt.notas as NotaNaTela[]);
      } catch {
        /* Sem fileira e sem notas, a caixa continua inteira. */
      }
    } catch {
      setErro(true);
    }
  }, [bancada]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const [recadoDaNota, setRecadoDaNota] = useState<string | null>(null);

  async function marcarNaoLida(conversaId: string) {
    /* Pinta na hora: é um toque, e esperar a rede deixaria o ponto apagado. */
    setLista((atual) =>
      (atual ?? []).map((c) => (c.id === conversaId ? { ...c, naoLida: true } : c)),
    );
    try {
      const t = await token();
      if (!t) return;
      const { marcarConversaNaoLida } = await import("@/lib/conversa.functions");
      const r = await marcarConversaNaoLida({ data: { accessToken: t, conversaId } });
      if (!r.ok) throw new Error("recusado");
    } catch {
      /* ⚠️ Desfaz: um ponto aceso sobre uma conversa que o servidor considera
         lida some sozinho na próxima abertura, e ela acharia que o app perde
         a marcação. */
      setLista((atual) =>
        (atual ?? []).map((c) => (c.id === conversaId ? { ...c, naoLida: false } : c)),
      );
    }
  }

  async function salvarNota(texto: string | null) {
    setRecadoDaNota(null);
    try {
      const t = await token();
      if (!t) return;
      const { escreverNota } = await import("@/lib/conversa.functions");
      const r = await escreverNota({ data: { accessToken: t, texto } });
      if (!r.ok) {
        /* ⚠️ **A recusa clínica é DITA, e o texto NÃO é apagado.** É a mesma
           decisão do comentário: ela acabou de escrever, e limpar o campo
           obriga a redigitar tudo para trocar uma frase. */
        setRecadoDaNota(
          "motivo" in r && r.motivo === "clinico"
            ? "Essa frase parece pedir ou dar uma orientação de saúde. Fale com o seu médico — aqui a gente guarda o resto."
            : "Não deu para publicar agora.",
        );
        return;
      }
      setNotaAberta(null);
      void carregar();
    } catch {
      setRecadoDaNota("Não deu para publicar agora.");
    }
  }

  /* ⚠️ Pedido que EU mandei fica na lista NORMAL: ele é uma conversa minha
     esperando resposta, não um pedido para eu decidir. A caixa de pedidos é só
     do que chegou. */
  const pedidos = (lista ?? []).filter((c) => c.pedido && !c.euIniciei);
  const normais = (lista ?? []).filter((c) => !(c.pedido && !c.euIniciei));
  const mostrando = vendoPedidos ? pedidos : normais;

  return (
    <div className="pb-24">
      <header className="flex h-11 items-center gap-3 px-4">
        <button
          type="button"
          onClick={aoVoltar}
          aria-label="Voltar"
          className="press -ml-2 flex h-11 w-11 items-center justify-center text-[15px]"
        >
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

      {/* ─── AS NOTAS ────────────────────────────────────────────────────
          ⚠️ **O FORMATO DE MENOR RISCO DA ABA, e ele faltava.** "Não consigo
          dormir 😅" às três da manhã é exatamente o que ninguém publica como
          POST — post é para sempre e tem plateia — e é o que começa uma
          conversa numa comunidade de gestação.

          ⚠️ **E ela fica na caixa PRINCIPAL, nunca na de pedidos**, pela mesma
          razão da fileira de sugeridas logo abaixo. */}
      {!vendoPedidos && (
        <section className="border-b border-border px-4 pb-3 pt-1">
          {/* ⚠️ **O BALÃO FICA ACIMA DO AVATAR, e não POR CIMA dele.** A
              primeira versão pendurava o balão em `absolute -top-3` sobre uma
              coluna de 68px: "hoje foi um dia bom 💛" quebrava em cinco linhas
              dentro de 92px, cobria o avatar inteiro e deixava o nome ilegível
              atrás dele. Foi a FOTO da bancada que pegou — nenhuma asserção
              estava perto disso.

              O `pt-9` reserva a faixa do balão, e o balão ocupa a largura
              inteira da coluna: o avatar aparece limpo embaixo, e o texto que
              não couber em duas linhas é cortado — quem quiser o resto toca, e
              a folha mostra inteiro. */}
          <div className="flex gap-2 overflow-x-auto pt-9">
            {/* A minha vem primeiro: é ela que abre o campo de escrever. */}
            {!notas.some((n) => n.souEu) && (
              <button
                type="button"
                onClick={() => {
                  setRascunhoDaNota("");
                  setNotaAberta({
                    autor: { id: "eu", nome: "Você", avatarUrl: null },
                    texto: "",
                    criadaEm: "",
                    souEu: true,
                  });
                }}
                className="press flex w-[84px] shrink-0 flex-col items-center gap-1"
              >
                <span className="flex h-14 w-14 items-center justify-center rounded-full border border-dashed border-border text-[18px] text-muted-foreground">
                  ＋
                </span>
                <span className="w-full truncate text-center text-[11px] text-muted-foreground">
                  Sua nota
                </span>
              </button>
            )}
            {notas.map((n) => (
              <button
                key={n.autor.id}
                type="button"
                onClick={() => {
                  setRascunhoDaNota(n.souEu ? n.texto : "");
                  setNotaAberta(n);
                }}
                className="press relative flex w-[84px] shrink-0 flex-col items-center gap-1"
              >
                {/* ⚠️ `-top-9` casa com o `pt-9` do container: o balão vive na
                    faixa reservada, e nunca sobre o avatar. */}
                <span className="absolute -top-9 left-0 right-0 rounded-xl bg-muted px-1.5 py-1 text-[10px] leading-tight">
                  <span className="line-clamp-2 block break-words">{n.texto}</span>
                </span>
                <span className="relative">
                  {n.autor.avatarUrl ? (
                    <img
                      src={n.autor.avatarUrl}
                      alt=""
                      className="h-14 w-14 rounded-full object-cover"
                    />
                  ) : (
                    <span className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-[16px] font-semibold">
                      {(n.autor.nome.trim()[0] ?? "?").toUpperCase()}
                    </span>
                  )}
                </span>
                <span className="w-full truncate text-center text-[11px] text-muted-foreground">
                  {n.souEu ? "Você" : n.autor.nome}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ⚠️ **OS GRUPOS SÓ NA CAIXA PRINCIPAL**, pela mesma razão da fileira de
          sugeridas: a caixa de pedidos é uma tela de DECISÃO, e uma lista de
          grupos ali empurra mais conversa para dentro no momento em que ela
          está filtrando quem entra. */}
      {!vendoPedidos && grupos}

      {/* ⚠️ **A FILEIRA SÓ APARECE NA CAIXA PRINCIPAL, nunca na de pedidos.**
          A caixa de pedidos é uma tela de DECISÃO — alguém está esperando
          resposta —, e uma fileira de desconhecidas ali empurraria mais gente
          para dentro no exato momento em que ela está filtrando quem entra. */}
      {!vendoPedidos && sugeridas.length > 0 && (
        <section className="border-b border-border px-4 pb-3 pt-1">
          <h2 className="text-[13px] font-semibold">{TITULO_DA_SUGESTAO}</h2>
          {/* ⚠️ A régua de privacidade é DITA. Sem a frase, quem fechou o perfil
              e não se vê aqui conclui que a fileira quebrou — e quem deixou
              aberto não sabe que está aparecendo para desconhecidas. */}
          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
            {EXPLICACAO_DA_SUGESTAO}
          </p>
          <div className="mt-2 flex gap-2 overflow-x-auto">
            {sugeridas.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => aoFalarCom?.(p.id, RASCUNHO_DA_PRIMEIRA)}
                className="press flex w-[104px] shrink-0 flex-col items-center gap-1 rounded-2xl border border-border p-2"
              >
                <Avatar url={p.avatarUrl} nome={p.nome} />
                <span className="w-full truncate text-center text-[12px] font-medium">
                  {p.nome}
                </span>
                <span className="text-[11px] text-primary">Falar</span>
              </button>
            ))}
          </div>
        </section>
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
        /* ⚠️ **A LINHA VIROU `div`, e o botão está DENTRO dela.** Um `<button>`
            dentro de outro é HTML inválido — o navegador desmonta a árvore, e o
            botão de dentro simplesmente não recebe o toque. */
        <div key={c.id} className="flex w-full items-center gap-1 px-4 py-2.5">
          <button
            type="button"
            onClick={() => aoAbrir(c)}
            className="press flex min-w-0 flex-1 items-center gap-3 text-left"
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
          {/* ⚠️ **MARCAR COMO NÃO LIDA — e o caso de uso é o desta base.** Ela lê
              a mensagem às três da manhã, não consegue responder, e quer
              lembrar. Sem isto o emblema zera no instante em que ela abre, e a
              conversa some do topo da cabeça dela junto.

              ⚠️ Só aparece no que ela JÁ leu: num ponto aceso o botão não teria
              o que fazer. */}
          {!c.naoLida && !c.pedido && (
            <button
              type="button"
              onClick={() => void marcarNaoLida(c.id)}
              aria-label={`Marcar a conversa com ${c.comNome} como não lida`}
              className="press flex h-11 w-8 shrink-0 items-center justify-center text-[13px] text-muted-foreground"
            >
              ⌾
            </button>
          )}
        </div>
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
      {/* ─── A FOLHA DA NOTA ─────────────────────────────────────────────
          ⚠️ **A MINHA abre o CAMPO; a das outras, só o texto.** Não há
          responder, curtir nem reagir — uma nota é um sinal, e transformá-la
          em conversa criaria um segundo direct dentro do direct. Quem quer
          responder abre a conversa, que está logo abaixo na mesma tela. */}
      {notaAberta && (
        <div className="fixed inset-x-0 bottom-0 z-30 rounded-t-3xl border-t border-border bg-card p-4 pb-[calc(1rem+var(--safe-area-inset-bottom,0px))]">
          <div className="flex items-start justify-between gap-3">
            <p className="text-[14px] font-semibold">
              {notaAberta.souEu ? "Sua nota" : `Nota de ${notaAberta.autor.nome}`}
            </p>
            <button
              type="button"
              onClick={() => setNotaAberta(null)}
              aria-label="Fechar"
              className="press -m-2 flex h-11 w-11 shrink-0 items-center justify-center text-[13px] text-muted-foreground"
            >
              ×
            </button>
          </div>

          {notaAberta.souEu ? (
            <>
              <textarea
                value={rascunhoDaNota}
                onChange={(e) => setRascunhoDaNota(e.target.value.slice(0, TAMANHO_DA_NOTA))}
                rows={2}
                placeholder="Uma frase que some em 24 horas…"
                className="mt-2 w-full resize-none rounded-2xl border border-border bg-background px-3 py-2 text-[14px]"
              />
              <div className="mt-1 flex items-center justify-between">
                {/* ⚠️ O contador diz o LIMITE, e não só quantos faltam: sem ele
                    ela digita e o campo para de aceitar sem explicar. */}
                <span className="text-[11px] text-muted-foreground">
                  {rascunhoDaNota.length}/{TAMANHO_DA_NOTA} · some em 24 horas
                </span>
                <div className="flex gap-2">
                  {notaAberta.texto && (
                    <button
                      type="button"
                      onClick={() => void salvarNota(null)}
                      className="press min-h-[44px] text-[13px] text-muted-foreground"
                    >
                      Apagar
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={!rascunhoDaNota.trim()}
                    onClick={() => void salvarNota(rascunhoDaNota)}
                    className="press min-h-[44px] rounded-full px-3 text-[13px] font-semibold text-primary disabled:opacity-40"
                  >
                    Publicar
                  </button>
                </div>
              </div>
              {recadoDaNota && (
                <p className="mt-2 rounded-xl bg-muted/60 px-3 py-2 text-[12px] leading-snug">
                  {recadoDaNota}
                </p>
              )}
            </>
          ) : (
            <p className="mt-2 whitespace-pre-wrap break-words text-[14px] leading-snug">
              {notaAberta.texto}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function Conversa({
  conversa,
  aoVoltar,
  aoAbrirPerfil,
  bancada,
  rascunho,
  aoAbrirRef,
  aoEncaminhar,
  aoFixar,
  aoDenunciarConversa,
}: {
  conversa: ConversaNaTela;
  aoVoltar: () => void;
  aoAbrirPerfil?: (id: string) => void;
  /** Abre a folha de escolher para onde. `undefined` = não oferece. */
  aoEncaminhar?: (mensagemId: string) => void;
  /** Fixa (ou tira) a conversa do topo da lista. */
  aoFixar?: (fixar: boolean) => void;
  /** Denuncia a conversa INTEIRA — o padrão, não uma frase solta. */
  aoDenunciarConversa?: (motivo: string) => void;
  bancada?: { mensagens: MensagemNaTela[]; pedido?: boolean; euIniciei?: boolean };
  /**
   * A primeira linha já escrita, quando a conversa nasce de uma sugestão.
   *
   * ⚠️ **SÓ SEMEIA O CAMPO VAZIO.** Se ela já digitou alguma coisa — porque
   * voltou do perfil da pessoa e reabriu —, sobrescrever apagaria o texto dela
   * por causa de um rascunho que o app ofereceu. É a mesma decisão de
   * `aplicarSugestao` na legenda: acrescenta ou respeita, nunca apaga.
   */
  rascunho?: string | null;
  /** Abre o que a mensagem anexou. Sem a prop, o cartão não leva a lugar nenhum. */
  aoAbrirRef?: (tipo: "post" | "story", id: string) => void;
}) {
  const [mensagens, setMensagens] = useState<MensagemNaTela[]>(bancada?.mensagens ?? []);
  const [texto, setTexto] = useState(rascunho ?? "");
  const [enviando, setEnviando] = useState(false);
  const [recado, setRecado] = useState<string | null>(null);
  const [pedido, setPedido] = useState(bancada?.pedido ?? conversa.pedido);
  /** A mensagem que ela tocou, esperando confirmação para apagar. */
  const [apagando, setApagando] = useState<string | null>(null);
  /** A mensagem cuja folha de ações está aberta. */
  const [acaoEm, setAcaoEm] = useState<string | null>(null);
  /** ⚠️ Local e por mensagem — ver o bloco do filtro de palavras abaixo. */
  const [reveladas, setReveladas] = useState<Set<string>>(() => new Set());
  const [denunciandoConversa, setDenunciandoConversa] = useState(false);
  const [abrindoFigurinhas, setAbrindoFigurinhas] = useState(false);
  /** A mensagem que estou citando ao escrever. */
  const [citando, setCitando] = useState<MensagemNaTela | null>(null);
  /** A mensagem que estou denunciando (a folha do motivo). */
  const [denunciando, setDenunciando] = useState<string | null>(null);
  const [euIniciei, setEuIniciei] = useState(bancada?.euIniciei ?? conversa.euIniciei);
  const [silenciada, setSilenciada] = useState(false);
  /** O cursor da página anterior; `null` = já cheguei no começo da conversa. */
  const [antesDe, setAntesDe] = useState<string | null>(null);
  const [buscandoAntigas, setBuscandoAntigas] = useState(false);
  const [menu, setMenu] = useState(false);
  const [foto, setFoto] = useState<{ arquivo: File; previa: string } | null>(null);
  const fim = useRef<HTMLDivElement>(null);
  /** O id da última mensagem já mostrada — ver o efeito de rolagem. */
  const ultimaVista = useRef<string | null>(null);

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
        /* ⚠️ **A PÁGINA MAIS NOVA NÃO PODE APAGAR AS ANTIGAS JÁ CARREGADAS.**
           A sondagem devolve só as 50 últimas; sobrescrever direto faria a
           conversa "encolher" a cada seis segundos para quem tinha subido para
           ler o começo — e o trecho que ela estava lendo sumiria debaixo dela.
           Junta por id, na ordem do tempo. */
        setMensagens((antigas) => juntarMensagens(antigas, r.mensagens));
        setPedido(r.pedido);
        setEuIniciei(r.euIniciei);
        setSilenciada(!!r.silenciada);
        /* Só na PRIMEIRA carga: depois, quem manda no cursor é "ver as
           anteriores". Sobrescrever aqui reabriria o botão a cada sondagem. */
        setAntesDe((a) => (a === null && ultimaVista.current === null ? (r.antesDe ?? null) : a));
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

  /**
   * ⚠️ **O DEFEITO CENTRAL DO DIRECT, e ele estava lá desde o primeiro dia:
   * a conversa NÃO SE ATUALIZAVA SOZINHA.**
   *
   * `carregar()` rodava uma vez, na montagem. Se a outra respondesse com a tela
   * aberta — que é o caso normal de uma conversa —, nada aparecia: a paciente
   * ficava olhando a própria mensagem, sem saber se a amiga tinha lido, sumido
   * ou se o app tinha quebrado. Uma caixa de entrada que só mostra o passado
   * não é uma conversa.
   *
   * ⚠️ **É SONDAGEM, e não `realtime`, e a escolha é deliberada.** O canal ao
   * vivo do Supabase abre um WebSocket por conversa aberta, precisa de RLS de
   * leitura em `rede_mensagens` — que esta tabela NÃO TEM de propósito, porque
   * ali o texto é o segredo inteiro — e morre em segundo plano no iOS sem
   * avisar, deixando a tela parada com cara de funcionando. A sondagem custa
   * uma consulta a cada 6 s e reaparece sozinha quando o app volta.
   *
   * ⚠️ **E ELA PARA QUANDO O APP SAI DA FRENTE.** Sem isso, um celular no bolso
   * com a conversa aberta consultaria o servidor a noite inteira, gastando o 4G
   * dela e batendo no banco por uma tela que ninguém está vendo. É a mesma
   * lição que a meditação já pagou com o áudio suspenso pelo iOS.
   */
  useEffect(() => {
    if (bancada) return;
    let vivo = true;
    let id: ReturnType<typeof setInterval> | null = null;

    const parar = () => {
      if (id) clearInterval(id);
      id = null;
    };
    const comecar = () => {
      if (id || document.hidden) return;
      id = setInterval(() => {
        if (vivo && !document.hidden) void carregar();
      }, INTERVALO_DA_SONDAGEM);
    };
    const aoTrocar = () => {
      if (document.hidden) parar();
      else {
        /* Voltou para a frente: busca AGORA, e só depois volta ao ritmo. Sem a
           busca imediata, ela abre o app e espera seis segundos olhando o
           estado velho. */
        if (vivo) void carregar();
        comecar();
      }
    };

    comecar();
    document.addEventListener("visibilitychange", aoTrocar);
    return () => {
      vivo = false;
      parar();
      document.removeEventListener("visibilitychange", aoTrocar);
    };
  }, [carregar, bancada]);

  /**
   * ⚠️ **ROLA PARA O FIM SÓ QUANDO CHEGA COISA NOVA, e nunca ao carregar o
   * ANTIGO.** A dependência era `mensagens.length`, e ela sobe nos dois casos:
   * com paginação, pedir as mensagens antigas aumentava o total e a tela pulava
   * de volta para o rodapé — jogando a paciente fora exatamente do trecho que
   * ela tinha subido para ler.
   */
  const totalAntes = useRef(0);
  useEffect(() => {
    const ultima = mensagens[mensagens.length - 1]?.id ?? null;
    const cresceuNoFim = mensagens.length > totalAntes.current && ultima !== ultimaVista.current;
    totalAntes.current = mensagens.length;
    if (!cresceuNoFim) return;
    ultimaVista.current = ultima;
    fim.current?.scrollIntoView({ block: "end" });
  }, [mensagens]);

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

  /**
   * Busca a página ANTERIOR e a coloca em cima.
   *
   * ⚠️ **NÃO rola para o fim depois.** É o defeito clássico de paginação em
   * conversa: a lista cresce, o efeito de rolagem dispara e joga a paciente de
   * volta ao rodapé — exatamente fora do trecho que ela subiu para ler. Quem
   * impede é a comparação por ID do efeito, não este bloco.
   */
  /**
   * REAGIR — pinta na hora e desfaz se o servidor recusar.
   *
   * ⚠️ **Otimista aqui, ao contrário do fixar e do destacar.** Nada pode
   * recusar uma reação a não ser uma falha de rede: não há teto, não há
   * contagem a conferir. E numa conversa a resposta precisa ser imediata — um
   * emoji que só aparece meio segundo depois lê como toque que não pegou.
   */
  async function reagir(mensagemId: string, tipo: string | null) {
    setAcaoEm(null);
    const antes = mensagens;
    setMensagens((ms) =>
      ms.map((m) => {
        if (m.id !== mensagemId) return m;
        const semAMinha = (m.reacoes ?? [])
          .map((r) => (r.tipo === m.minhaReacao ? { ...r, quantas: r.quantas - 1 } : r))
          .filter((r) => r.quantas > 0);
        const comANova = tipo
          ? (() => {
              const achou = semAMinha.find((r) => r.tipo === tipo);
              return achou
                ? semAMinha.map((r) => (r.tipo === tipo ? { ...r, quantas: r.quantas + 1 } : r))
                : [...semAMinha, { tipo, quantas: 1 }];
            })()
          : semAMinha;
        return { ...m, reacoes: comANova, minhaReacao: tipo };
      }),
    );
    try {
      const t = await token();
      if (!t) return;
      const { reagirAMensagem } = await import("@/lib/conversa.functions");
      const r = await reagirAMensagem({
        data: { accessToken: t, conversaId: conversa.id, mensagemId, tipo },
      });
      if (!r.ok) {
        setMensagens(antes);
        const { toast } = await import("sonner");
        toast.error(
          r.motivo === "sem_suporte"
            ? "Reagir ainda não está pronto no servidor."
            : "Não deu para reagir agora.",
        );
      }
    } catch {
      setMensagens(antes);
    }
  }

  /** Denunciar uma mensagem. */
  async function denunciar(mensagemId: string, motivo: MotivoDaDenuncia) {
    setDenunciando(null);
    try {
      const t = await token();
      if (!t) return;
      const { denunciarMensagem } = await import("@/lib/conversa.functions");
      const r = await denunciarMensagem({
        data: { accessToken: t, conversaId: conversa.id, mensagemId, motivo },
      });
      const { toast } = await import("sonner");
      /* ⚠️ O recado NÃO promete uma providência, e diz o que é verdade: fica
         registrada, e quem escreveu não é avisada. É a mesma frase da denúncia
         de post — prometer "vamos remover" seria a promessa que este app já
         quebrou uma vez. */
      if (r.ok) toast.success("Denúncia registrada. Quem escreveu não é avisada.");
      else if (r.motivo === "sem_suporte") toast.error("Denunciar ainda não está pronto aqui.");
      else toast.error("Não deu para denunciar agora.");
    } catch {
      const { toast } = await import("sonner");
      toast.error("Não deu para denunciar agora.");
    }
  }

  async function verAnteriores() {
    if (!antesDe || buscandoAntigas) return;
    setBuscandoAntigas(true);
    try {
      const t = await token();
      if (!t) return;
      const mod = await import("@/lib/conversa.functions");
      const r = await mod.mensagensDaConversa({
        data: { accessToken: t, conversaId: conversa.id, antes: antesDe },
      });
      if (!r.ok) {
        setRecado("Não deu para buscar as anteriores.");
        return;
      }
      setMensagens((atuais) => juntarMensagens(r.mensagens, atuais));
      /* `null` quando chegou no começo — e aí o botão some, que é a única forma
         de ela saber que leu tudo. */
      setAntesDe(r.antesDe ?? null);
    } catch {
      setRecado("Não deu para buscar as anteriores.");
    } finally {
      setBuscandoAntigas(false);
    }
  }

  async function alternarSilencio() {
    setMenu(false);
    const alvo = !silenciada;
    setSilenciada(alvo);
    try {
      const t = await token();
      if (!t) return;
      const { silenciarConversa } = await import("@/lib/conversa.functions");
      const r = await silenciarConversa({
        data: { accessToken: t, conversaId: conversa.id, silenciar: alvo },
      });
      /* ⚠️ **VOLTA ATRÁS SE O SERVIDOR RECUSOU.** Um interruptor que fica ligado
         sobre uma recusa é pior que um que não liga: ela acha que silenciou e o
         celular continua tocando. */
      if (!r.ok) {
        setSilenciada(!alvo);
        setRecado(
          r.motivo === "sem_suporte"
            ? "Silenciar ainda não está pronto no servidor."
            : "Não deu para salvar.",
        );
      }
    } catch {
      setSilenciada(!alvo);
      setRecado("Não deu para salvar.");
    }
  }

  async function sair() {
    setMenu(false);
    try {
      const t = await token();
      if (!t) return;
      const { sairDaConversa } = await import("@/lib/conversa.functions");
      const r = await sairDaConversa({ data: { accessToken: t, conversaId: conversa.id } });
      if (r.ok) aoVoltar();
      else setRecado("Não deu para sair agora.");
    } catch {
      setRecado("Não deu para sair agora.");
    }
  }

  /**
   * MANDAR UMA FIGURINHA.
   *
   * ⚠️ **Ela viaja como TEXTO MARCADO** (`:dc-fig:abraco:`), e por isso passa
   * por tudo que já existe — citação, encaminhar, busca local, apagar, prévia da
   * lista — sem uma linha nova em nenhum desses lugares. Ver `figurinhas.ts`.
   *
   * ⚠️ **E ela vai SOZINHA, sem o que estava digitado.** A régua só reconhece a
   * mensagem que É a figurinha; juntá-la ao texto faria a tela ter de decidir
   * como desenhar as duas coisas, e o formato existe para ser um gesto.
   */
  async function mandarFigurinha(id: string) {
    if (enviando || esperando) return;
    setAbrindoFigurinhas(false);
    setEnviando(true);
    try {
      const t0 = await token();
      if (!t0) return;
      const { enviarMensagem } = await import("@/lib/conversa.functions");
      const r = await enviarMensagem({
        data: { accessToken: t0, conversaId: conversa.id, texto: textoDaFigurinha(id) },
      });
      if (!r.ok) {
        setRecado("Não deu para mandar agora.");
        return;
      }
      void carregar();
    } catch {
      setRecado("Não deu para mandar agora.");
    } finally {
      setEnviando(false);
    }
  }

  async function enviar() {
    const t = texto.trim();
    /* ⚠️ **Foto SEM legenda é mensagem válida.** Exigir texto aqui faria o botão
       ficar morto com a ultrassom já escolhida na tela — e ela não teria como
       adivinhar que faltava escrever alguma coisa. */
    if ((!t && !foto) || enviando || esperando) return;
    setEnviando(true);
    setRecado(null);
    try {
      const tk = await token();
      if (!tk) return;
      const mod = await import("@/lib/conversa.functions");

      /* A foto sobe ANTES, pela URL assinada: o caminho é montado no servidor,
         e é ele que a mensagem referencia. */
      let imagemPath: string | undefined;
      if (foto) {
        const subiu = await subirFoto(tk, conversa.id, foto.arquivo);
        if (!subiu) {
          setRecado("Não deu para enviar a foto. Tente de novo.");
          return;
        }
        imagemPath = subiu;
      }

      const r = await mod.enviarMensagem({
        data: {
          accessToken: tk,
          conversaId: conversa.id,
          texto: t,
          imagemPath,
          /* ⚠️ Lido ANTES de zerar: `setCitando(null)` é assíncrono, e ler o
             estado depois dele mandaria `undefined` — a resposta sairia solta,
             sem dizer a que ela responde. */
          respondeA: citando?.id,
        },
      });
      if (r.ok) {
        setTexto("");
        setFoto(null);
        /* ⚠️ A citação some SÓ depois de o envio dar certo: numa falha ela
           continua ali, e o segundo toque manda a resposta certa. */
        setCitando(null);
        /* ⚠️ **O AVISO CLÍNICO É PARA QUEM ESCREVEU, e a mensagem FOI enviada.**
           A régua não censura conversa privada entre duas adultas — ela lembra
           quem escreveu de que aquilo é experiência, não conduta. Esconder o
           aviso seria a régua rodando para nada; recusar a mensagem seria o app
           decidindo o que duas pessoas podem dizer uma à outra. */
        if ("avisoClinico" in r && r.avisoClinico === "conduta") {
          setRecado("Enviado. Lembre que só o médico dela pode orientar sobre sintoma.");
        }
        await carregar();
      } else {
        setRecado(
          r.motivo === "aguardando_aceite"
            ? "Você já enviou sua mensagem. Espere a resposta."
            : r.motivo === "bloqueio"
              ? "Não é possível enviar."
              : r.motivo === "muitas"
                ? "Muitas mensagens hoje. Tente amanhã."
                : r.motivo === "emergencia"
                  ? /* ⚠️ O único desfecho que RECUSA — e ele dá o caminho, nunca
                       só o "não". Uma paciente descrevendo emergência para uma
                       amiga precisa do SOS, não de um erro. */
                    "Isso precisa de atendimento, não de conversa. Use o botão de emergência."
                  : r.motivo === "sem_suporte"
                    ? "As fotos ainda não estão prontas no servidor."
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
        <button
          type="button"
          onClick={aoVoltar}
          aria-label="Voltar"
          className="press -ml-2 flex h-11 w-11 items-center justify-center text-[15px]"
        >
          ←
        </button>
        <button
          type="button"
          onClick={() => aoAbrirPerfil?.(conversa.comId)}
          className="press flex min-w-0 items-center gap-2"
        >
          <span className="truncate text-[15px] font-semibold">{conversa.comNome}</span>
          {silenciada && (
            <span aria-label="Conversa silenciada" title="Conversa silenciada" className="shrink-0">
              🔕
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setMenu(true)}
          aria-label="Opções da conversa"
          className="press ml-auto flex h-11 w-11 items-center justify-center text-[18px] leading-none"
        >
          ⋯
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {pedido && !euIniciei && (
          <p className="mx-auto mb-3 max-w-[280px] rounded-xl bg-muted/60 px-3 py-2 text-center text-[12px] leading-snug text-muted-foreground">
            Pedido de mensagem. Se você responder, a conversa fica aberta.
          </p>
        )}
        {/* ⚠️ **A CONVERSA NÃO PAGINAVA: eram 50 e acabou.** Uma dupla que se
            escreve todo dia passa disso na primeira semana, e o começo — que é
            justamente o que se procura ao subir — ficava inalcançável para
            sempre, sem nada na tela dizendo que havia mais. */}
        {antesDe && (
          <div className="mb-2 flex justify-center">
            <button
              type="button"
              disabled={buscandoAntigas}
              onClick={() => void verAnteriores()}
              className="press min-h-[44px] rounded-full border border-border px-4 text-[13px] font-medium disabled:opacity-50"
            >
              {buscandoAntigas ? "Buscando…" : "Ver mensagens anteriores"}
            </button>
          </div>
        )}
        {mensagens.map((m) => (
          /* ⚠️ **COLUNA, e não linha.** A reação é irmã do balão e pendura
             EMBAIXO dele; num `flex` de linha os dois ficariam lado a lado e a
             reação empurraria o texto. O alinhamento horizontal passou para
             `items-*`. */
          <div
            key={m.id}
            className={`mb-1.5 flex flex-col ${m.souEu ? "items-end" : "items-start"}`}
          >
            {/* ⚠️ **O TOQUE ABRE A FOLHA DE AÇÕES, e não mais só o apagar.**
                Antes só a MINHA mensagem era tocável, porque a única ação era
                apagar. Agora toda mensagem viva tem o que fazer — responder e
                reagir valem para as duas, apagar só para a minha e denunciar só
                para a dela. Quem confere cada uma continua sendo o servidor;
                isto aqui só evita oferecer o que seria recusado. */}
            <div
              onClick={() => !m.apagada && setAcaoEm(m.id)}
              className={`max-w-[78%] text-[14px] leading-snug ${
                figurinhaDoTexto(m.texto) ? "" : "rounded-2xl px-3 py-2"
              } ${!m.apagada ? "cursor-pointer" : ""} ${
                figurinhaDoTexto(m.texto)
                  ? /* ⚠️ Figurinha NÃO tem fundo — ver o comentário na bolha. */
                    "bg-transparent"
                  : m.apagada
                    ? "bg-muted/50 italic text-muted-foreground"
                    : m.souEu
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
              }`}
            >
              {m.apagada ? (
                "Mensagem apagada"
              ) : (
                <>
                  {m.imagemUrl && (
                    /* ⚠️ A foto vem numa URL ASSINADA de uma hora; a conversa
                       aberta a noite inteira a renova na próxima sondagem. */
                    <img
                      src={m.imagemUrl}
                      alt="Foto enviada na conversa"
                      className="mb-1 max-h-[340px] w-full rounded-xl object-contain"
                    />
                  )}
                  {/* ⚠️ **A CITAÇÃO VEM ANTES DE TUDO, e é UMA LINHA.** Ela
                      existe para lembrar QUAL mensagem, não para reler: uma
                      citação de cinco linhas empurra a resposta para fora da
                      tela e inverte a hierarquia. O corte é do servidor
                      (`textoDaCitacao`), e não daqui — a tela não decide o que
                      cabe numa citação. */}
                  {m.citacao && (
                    <span
                      className={`mb-1 block border-l-2 pl-2 text-[12px] leading-snug ${
                        m.souEu ? "border-white/40 opacity-80" : "border-foreground/25 opacity-70"
                      }`}
                    >
                      <span className="block font-semibold">
                        {m.citacao.deQuem === "eu" ? "Você" : conversa.comNome}
                      </span>
                      <span className="line-clamp-1 block">{m.citacao.trecho}</span>
                    </span>
                  )}
                  {/* ⚠️ **O ANEXO É UM CARTÃO, e não o conteúdo inteiro.** Um
                      story vive 24 h: desenhá-lo aqui faria a conversa mostrar
                      uma imagem que some no dia seguinte, deixando um buraco na
                      linha. O cartão diz o que era e leva até lá enquanto
                      existir — e continua legível depois, como contexto. */}
                  {m.refTipo && (
                    <button
                      type="button"
                      onClick={() => m.refId && aoAbrirRef?.(m.refTipo!, m.refId)}
                      className={`press mb-1 block min-h-[44px] w-full rounded-xl px-2.5 py-1.5 text-left text-[12px] ${
                        m.souEu ? "bg-white/15" : "bg-background/70"
                      }`}
                    >
                      {m.refTipo === "story" ? "↩ Respondeu ao story" : "🖼 Publicação"}
                    </button>
                  )}
                  {/* ⚠️ **RECOLHIDA PELO FILTRO DE PALAVRAS: a linha existe, o
                      texto não.** Entregar o texto e avisar depois é o pior
                      desfecho possível de um filtro — ela já leu. Aqui, ao
                      contrário do comentário, a linha NÃO some: a conversa é de
                      duas pessoas, e uma mensagem que desaparece faria a
                      conversa deixar de fazer sentido. Ela abre no toque.

                      ⚠️ E o estado é LOCAL e por MENSAGEM (`reveladas`): revelar
                      uma não pode revelar as outras — ela escondeu aquela
                      palavra de propósito. */}
                  {/* ⚠️ **A FIGURINHA SUBSTITUI A BOLHA, e não vive dentro
                      dela.** Um emoji de 44px dentro de um balão com fundo lê
                      como um texto grande; solto, lê como figurinha — é a mesma
                      distinção que o WhatsApp faz, e ela é o formato inteiro. */}
                  {figurinhaDoTexto(m.texto) ? (
                    <span
                      aria-label={figurinhaDoTexto(m.texto)!.rotulo}
                      className="block text-[52px] leading-none"
                    >
                      {figurinhaDoTexto(m.texto)!.arte}
                    </span>
                  ) : m.recolhida && !reveladas.has(m.id) ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setReveladas((v) => new Set(v).add(m.id));
                      }}
                      className="press block text-left italic opacity-80"
                    >
                      Mensagem escondida pelo seu filtro de palavras.{" "}
                      <span className="font-medium not-italic underline">Ver mesmo assim</span>
                    </button>
                  ) : (
                    m.texto && <span className="whitespace-pre-wrap break-words">{m.texto}</span>
                  )}
                  {/* ⚠️ **O ✓✓ SÓ EXISTE NA MINHA MENSAGEM.** Do lado dela seria
                      o app afirmando que EU li — informação que ela não tem como
                      conferir. `foiLidaPeloOutro` já garante isso no servidor;
                      aqui é só o desenho. */}
                  {m.souEu && (
                    <span
                      aria-label={m.lidaPelaOutra ? "Lida" : "Enviada"}
                      className="ml-1.5 align-baseline text-[11px] opacity-70"
                    >
                      {m.lidaPelaOutra ? "✓✓" : "✓"}
                    </span>
                  )}
                </>
              )}
            </div>
            {/* ⚠️ **AS REAÇÕES PENDURAM NA BORDA DO BALÃO**, meio para fora: é
                assim que se lê como "reação AO balão" e não como mais uma
                mensagem. E elas ficam FORA do `<div>` do balão para não herdar o
                fundo dele — sobre o roxo da minha mensagem, um emoji some. */}
            {(m.reacoes ?? []).length > 0 && (
              <span
                className={`-mt-1.5 flex gap-0.5 rounded-full border border-border bg-background px-1.5 py-0.5 text-[12px] shadow-sm ${
                  m.souEu ? "mr-1 self-end" : "ml-1 self-start"
                }`}
              >
                {(m.reacoes ?? []).map((r) => (
                  <span key={r.tipo}>
                    {r.tipo}
                    {r.quantas > 1 && (
                      <span className="ml-0.5 align-middle text-[10px] tabular-nums">
                        {r.quantas}
                      </span>
                    )}
                  </span>
                ))}
              </span>
            )}
          </div>
        ))}
        <div ref={fim} />
      </div>

      {/* ─── A FOLHA DE AÇÕES DA MENSAGEM ──────────────────────────────────
          ⚠️ **Os seis emojis ficam NA PRIMEIRA LINHA, acima dos itens de
          texto.** Reagir é o gesto mais frequente e o mais barato; pô-lo atrás
          de um item de lista faria a ação de um toque custar dois. */}
      {acaoEm &&
        (() => {
          const m = mensagens.find((x) => x.id === acaoEm);
          if (!m) return null;
          return (
            <div className="shrink-0 border-t border-border px-4 py-3">
              <div className="flex justify-between gap-1">
                {REACOES_DE_MENSAGEM.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => void reagir(m.id, m.minhaReacao === e ? null : e)}
                    aria-label={m.minhaReacao === e ? `Tirar ${e}` : `Reagir com ${e}`}
                    aria-pressed={m.minhaReacao === e}
                    className={`press flex h-11 w-11 items-center justify-center rounded-full text-[20px] ${
                      m.minhaReacao === e ? "bg-muted" : ""
                    }`}
                  >
                    {e}
                  </button>
                ))}
              </div>

              <div className="mt-1 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setCitando(m);
                    setAcaoEm(null);
                  }}
                  className="press min-h-[44px] rounded-full border border-border px-4 text-[13px] font-medium"
                >
                  Responder
                </button>
                {/* ⚠️ **ENCAMINHAR É SÓ TEXTO**, e o botão só aparece quando há
                    texto: a foto e o áudio que alguém me mandou numa conversa
                    privada não saem dali — é a mesma razão do ✈ do story ser do
                    dono. Um botão que o servidor recusa promete e não cumpre. */}
                {!!m.texto && !m.apagada && aoEncaminhar && (
                  <button
                    type="button"
                    onClick={() => {
                      setAcaoEm(null);
                      aoEncaminhar(m.id);
                    }}
                    className="press min-h-[44px] rounded-full border border-border px-4 text-[13px] font-medium"
                  >
                    Encaminhar
                  </button>
                )}
                {m.souEu ? (
                  <button
                    type="button"
                    onClick={() => {
                      setAcaoEm(null);
                      setApagando(m.id);
                    }}
                    className="press min-h-[44px] rounded-full border border-border px-4 text-[13px] font-medium"
                  >
                    Apagar
                  </button>
                ) : (
                  /* ⚠️ **Denunciar só na mensagem DELA.** Denunciar a própria não
                     quer dizer nada e encheria a fila com linhas que ninguém tem
                     o que julgar — o servidor recusa, e a tela não oferece. */
                  <button
                    type="button"
                    onClick={() => {
                      setAcaoEm(null);
                      setDenunciando(m.id);
                    }}
                    className="press min-h-[44px] rounded-full border border-border px-4 text-[13px] font-medium text-destructive"
                  >
                    Denunciar
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setAcaoEm(null)}
                  className="press ml-auto min-h-[44px] px-3 text-[13px] text-muted-foreground"
                >
                  Fechar
                </button>
              </div>
            </div>
          );
        })()}

      {/* ⚠️ **A DENÚNCIA PRECISA DO MOTIVO** — sem ele a fila da plataforma não
          sabe o que julgar. É a mesma folha da denúncia de post, com a mesma
          lista fechada: campo aberto numa denúncia de app de gestação é onde
          alguém escreve a informação clínica de outra pessoa. */}
      {denunciando && (
        <div className="shrink-0 border-t border-border px-4 py-3">
          <p className="text-[13px] font-semibold">Por que você está denunciando?</p>
          <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">
            Fica registrada para a gente olhar, e quem escreveu não é avisada.
          </p>
          <div className="mt-2 flex flex-col gap-1">
            {MOTIVOS.map((mo) => (
              <button
                key={mo.motivo}
                type="button"
                onClick={() => void denunciar(denunciando, mo.motivo)}
                className="press min-h-[44px] rounded-xl border border-border px-3 text-left"
              >
                <span className="block text-[13px] font-medium">{mo.rotulo}</span>
                <span className="block text-[11px] leading-snug text-muted-foreground">
                  {mo.explica}
                </span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => setDenunciando(null)}
              className="press min-h-[44px] text-[13px] text-muted-foreground"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* ⚠️ **A BARRA DA CITAÇÃO FICA COLADA NO COMPOSITOR**, e não no topo da
          tela: ela descreve o que ESTE texto vai responder, e longe do campo
          deixaria de ser óbvio o que está sendo citado. O × é o que desiste. */}
      {citando && (
        <div className="flex shrink-0 items-center gap-2 border-t border-border bg-muted/40 px-4 py-2">
          <span className="min-w-0 flex-1 border-l-2 border-foreground/25 pl-2">
            <span className="block text-[11px] font-semibold">
              Respondendo {citando.souEu ? "a você" : `a ${conversa.comNome}`}
            </span>
            <span className="line-clamp-1 block text-[12px] text-muted-foreground">
              {textoDaCitacao({
                texto: citando.texto,
                apagada: citando.apagada,
                imagemUrl: citando.imagemUrl,
                refTipo: citando.refTipo,
              })}
            </span>
          </span>
          <button
            type="button"
            onClick={() => setCitando(null)}
            aria-label="Cancelar resposta"
            className="press flex h-11 w-11 shrink-0 items-center justify-center text-[15px] text-muted-foreground"
          >
            ×
          </button>
        </div>
      )}

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

      {denunciandoConversa && aoDenunciarConversa && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Denunciar esta conversa"
          className="fixed inset-0 z-[70] flex items-end bg-black/40"
          onClick={() => setDenunciandoConversa(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full rounded-t-3xl bg-card p-4 pb-[max(1rem,var(--safe-area-inset-bottom))]"
          >
            <p className="text-[15px] font-semibold">Denunciar esta conversa</p>
            {/* ⚠️ A tela NÃO promete o que vai acontecer com a pessoa — a fila é
                da plataforma, e prometer remoção seria prometer o que ninguém
                garante. Mesma decisão das outras seis denúncias. */}
            <p className="mt-1 text-[12px] leading-snug text-muted-foreground">
              A gente vai olhar as últimas mensagens dela. Só as dela — o que você escreveu não vai
              junto.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {MOTIVOS.map((mo) => (
                <button
                  key={mo.motivo}
                  type="button"
                  onClick={() => {
                    aoDenunciarConversa(mo.motivo);
                    setDenunciandoConversa(false);
                  }}
                  className="press min-h-[44px] rounded-full border border-border px-3 text-[12px]"
                >
                  {mo.rotulo}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setDenunciandoConversa(false)}
              className="press mt-3 min-h-[44px] text-[13px] text-muted-foreground"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {menu && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Opções da conversa"
          className="fixed inset-0 z-[70] flex items-end bg-black/40"
          onClick={() => setMenu(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full rounded-t-3xl bg-card p-4 pb-[max(1rem,var(--safe-area-inset-bottom))]"
          >
            <button
              type="button"
              onClick={() => void alternarSilencio()}
              className="press flex min-h-[48px] w-full items-center justify-between text-left text-[15px]"
            >
              <span>{silenciada ? "Voltar a receber avisos" : "Silenciar esta conversa"}</span>
              <span aria-hidden>{silenciada ? "🔔" : "🔕"}</span>
            </button>
            {/* ⚠️ **DIZ O QUE SILENCIAR FAZ, e o que NÃO faz.** Sem a frase, a
                paciente lê "silenciar" como "bloquear" — e a outra continua
                escrevendo, o que a faz concluir que o app não funciona. */}
            <p className="mb-2 text-[12px] leading-snug text-muted-foreground">
              Para de avisar no celular. Ela continua podendo escrever, e você continua vendo aqui.
              Ninguém é avisado.
            </p>

            {/* ⚠️ **FIXAR É PREFERÊNCIA DE QUEM OLHA A LISTA**, e a frase diz
                isso: sem ela, a paciente imagina que a conversa sobe também na
                tela da outra — e hesita em fixar a conversa do pior dia. */}
            {aoFixar && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    aoFixar(!conversa.fixadaEm);
                    setMenu(false);
                  }}
                  className="press flex min-h-[48px] w-full items-center justify-between text-left text-[15px]"
                >
                  <span>{conversa.fixadaEm ? "Tirar do topo" : "Fixar no topo"}</span>
                  <span aria-hidden>📌</span>
                </button>
                <p className="mb-2 text-[12px] leading-snug text-muted-foreground">
                  Só na sua lista. A outra pessoa não vê nem é avisada.
                </p>
              </>
            )}

            {/* ⚠️ **DENUNCIAR A CONVERSA INTEIRA, e não mensagem a mensagem.**
                O que caracteriza assédio é o PADRÃO — vinte mensagens que, uma a
                uma, não dizem nada. A denúncia por mensagem existe e continua;
                esta é a que serve para o caso que importa. */}
            {aoDenunciarConversa && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setMenu(false);
                    setDenunciandoConversa(true);
                  }}
                  className="press flex min-h-[48px] w-full items-center justify-between text-left text-[15px] text-destructive"
                >
                  <span>Denunciar esta conversa</span>
                  <span aria-hidden>⚑</span>
                </button>
                <p className="mb-2 text-[12px] leading-snug text-muted-foreground">
                  A gente vai olhar as últimas mensagens dela. Você também pode bloquear.
                </p>
              </>
            )}

            <button
              type="button"
              onClick={() => void sair()}
              className="press flex min-h-[48px] w-full items-center justify-between text-left text-[15px]"
            >
              <span>Sair desta conversa</span>
              <span aria-hidden>↩</span>
            </button>
            {/* ⚠️ **"SAIR" NÃO APAGA NADA, e a tela precisa dizer.** Apagar as
                mensagens apagaria as DELA junto — o texto dela, no aparelho
                dela, sumindo porque eu limpei a minha lista. E a conversa volta
                se ela escrever: quem quer que ela não escreva mais tem o
                bloqueio, no perfil, com o nome certo. */}
            <p className="mb-2 text-[12px] leading-snug text-muted-foreground">
              Some da sua lista. Nada é apagado, e ela volta se {conversa.comNome} escrever de novo.
              Para não receber mais, bloqueie pelo perfil.
            </p>

            <button
              type="button"
              onClick={() => setMenu(false)}
              className="press min-h-[44px] w-full text-[13px] text-muted-foreground"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      <div className="shrink-0 border-t border-border p-2 pb-[max(0.5rem,var(--safe-area-inset-bottom))]">
        {esperando ? (
          <p className="px-2 py-2 text-center text-[13px] text-muted-foreground">
            Você já enviou sua mensagem. Espere a resposta.
          </p>
        ) : (
          <>
            {/* ⚠️ **A PRÉVIA APARECE ANTES DE MANDAR, com um × para desistir.**
                Sem ela, escolher a foto não produz efeito visível nenhum: a
                paciente toca no 📷, a galeria fecha, e a tela fica igual — ela
                escolhe de novo e manda duas. */}
            {foto && (
              <div className="mb-2 flex items-center gap-2 rounded-2xl border border-border p-2">
                <img
                  src={foto.previa}
                  alt="Foto escolhida"
                  className="h-14 w-14 rounded-lg object-cover"
                />
                <span className="flex-1 text-[12px] text-muted-foreground">
                  {texto.trim() ? "Vai junto com o texto." : "Vai sem legenda."}
                </span>
                <button
                  type="button"
                  onClick={() => setFoto(null)}
                  aria-label="Tirar a foto"
                  className="press min-h-[44px] px-2 text-[16px]"
                >
                  ✕
                </button>
              </div>
            )}
            {/* ⚠️ A grade fica ACIMA do campo e some ao escolher: uma gaveta
                que continua aberta depois do gesto obriga a fechá-la à mão, e o
                formato existe para ser um toque. */}
            {abrindoFigurinhas && (
              <div className="mb-2 grid grid-cols-6 gap-1 rounded-2xl border border-border p-2">
                {FIGURINHAS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => void mandarFigurinha(f.id)}
                    aria-label={f.rotulo}
                    className="press flex h-11 w-full items-center justify-center text-[24px]"
                  >
                    {f.arte}
                  </button>
                ))}
              </div>
            )}
            <div className="flex items-end gap-2">
              <label
                className="press flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full border border-border text-[17px]"
                aria-label="Mandar uma foto"
              >
                📷
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    /* ⚠️ Limpa o `value`: escolher A MESMA foto duas vezes não
                       dispara `change` de novo, e o segundo toque não faria
                       nada — sem erro e sem explicação. */
                    e.target.value = "";
                    if (!f) return;
                    if (f.size > BYTES_DA_FOTO) {
                      setRecado("Essa foto é muito grande. Tente outra.");
                      return;
                    }
                    setRecado(null);
                    setFoto({ arquivo: f, previa: URL.createObjectURL(f) });
                  }}
                />
              </label>
              {/* ⚠️ **A FIGURINHA É NOSSA, e não um GIF de fora.** Giphy exigiria
                  abrir a CSP para um host externo, tem custo por chamada e —
                  o que decide — entrega conteúdo NÃO MODERADO: a busca por
                  "grávida" lá devolve piada de parto e imagem de teor sexual.
                  Ver `figurinhas.ts`. */}
              <button
                type="button"
                onClick={() => setAbrindoFigurinhas((v) => !v)}
                aria-label="Figurinhas"
                aria-expanded={abrindoFigurinhas}
                className="press flex h-10 w-10 shrink-0 items-center justify-center text-[18px]"
              >
                ☺
              </button>
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
                /* ⚠️ Foto SEM legenda é mensagem válida — ver `enviar()`. */
                disabled={(!texto.trim() && !foto) || enviando}
                className="press h-10 shrink-0 rounded-full bg-primary px-4 text-[14px] font-semibold text-primary-foreground disabled:opacity-40"
              >
                {enviando ? "…" : "Enviar"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * MANDAR UMA PUBLICAÇÃO PARA ALGUÉM — a folha de escolher a conversa.
 *
 * O terceiro pedaço do "conversa que nasce do app": no modelo, mandar um post a
 * uma amiga é a segunda origem de mensagem direta, depois da resposta ao story.
 * E aqui vale mais do que lá — o que se manda é a ultrassom de alguém, não um
 * meme.
 *
 * ⚠️ **SÓ PARA CONVERSAS QUE JÁ EXISTEM, e essa é a decisão central.** Uma busca
 * de pessoas aqui abriria um segundo caminho para escrever a desconhecidas,
 * contornando a trava de pedido que a caixa de entrada inteira existe para
 * sustentar — e faria isso pela porta mais inocente do app, um botão de
 * compartilhar. Quem quer falar com alguém novo passa pelo perfil, como sempre.
 *
 * ⚠️ **E O ANEXO NÃO AMPLIA A VISIBILIDADE DO POST.** A mensagem carrega o
 * `ref_id`; quem abrir passa por `postQueEuVejo`, a mesma régua de sempre. Sem
 * isso, mandar um post da camada `amigas` a quem não é amiga entregaria o
 * conteúdo pela porta dos fundos — e o remetente nem saberia que fez isso.
 */
/**
 * A FOLHA DE "MANDAR PARA UMA CONVERSA".
 *
 * ⚠️ **Uma folha só, para post E story** — e é por isso que ela recebe `ref` em
 * vez de `postId`. Duas folhas divergiriam no primeiro ajuste, e a régua que
 * importa (só conversas que JÁ existem) precisaria ser escrita duas vezes.
 *
 * ⚠️ **E o story precisa MAIS disto que o post: ele expira em 24 h.** Mandar é
 * justamente o que o salva — e antes o post podia ser mandado e o story não.
 */
export function MandarPublicacao({
  /* ⚠️ **`alvo`, e NUNCA `ref`.** `ref` é prop reservada do React: passá-la
     assim não chega ao componente como uma prop comum, e o `tsc` só reclama
     porque o tipo não bate — em JavaScript puro isso viraria `undefined` em
     silêncio. */
  alvo,
  aoFechar,
  bancada,
}: {
  /**
   * ⚠️ **`mensagem` é o terceiro tipo, e ele reusa a MESMA folha de propósito.**
   * A lista de para-quem-mandar é a mesma (só conversas que já existem), e é
   * ela que carrega a trava de não abrir conversa nova por este caminho. Uma
   * folha própria para encaminhar divergiria dela no primeiro ajuste.
   */
  alvo:
    | { tipo: "post" | "story"; id: string }
    | { tipo: "mensagem"; id: string; deConversaId: string };
  aoFechar: () => void;
  bancada?: ConversaNaTela[];
}) {
  const [lista, setLista] = useState<ConversaNaTela[] | null>(bancada ?? null);
  const [enviadas, setEnviadas] = useState<Record<string, boolean>>({});
  const [ocupada, setOcupada] = useState<string | null>(null);

  useEffect(() => {
    if (bancada) return;
    let vivo = true;
    void (async () => {
      try {
        const t = await token();
        if (!t) return;
        const { minhasConversas } = await import("@/lib/conversa.functions");
        const r = await minhasConversas({ data: { accessToken: t } });
        if (vivo) setLista(r.ok ? r.conversas : []);
      } catch {
        if (vivo) setLista([]);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [bancada]);

  async function mandar(c: ConversaNaTela) {
    if (ocupada || enviadas[c.id]) return;
    setOcupada(c.id);
    try {
      const t = await token();
      if (!t) return;
      /**
       * ⚠️ **ENCAMINHAR É OUTRA FUNÇÃO, e não um `refTipo` a mais.** O servidor
       * precisa conferir a conversa de ORIGEM (senão um `mensagemId` de
       * terceiros seria copiado para a minha), e é ele que aplica a régua
       * clínica de novo no destino. Um `refTipo: "mensagem"` faria a mensagem
       * virar um CARTÃO que aponta para uma conversa privada — pior ainda.
       *
       * ⚠️ **E os dois ramos chamam a função DIRETO.** A primeira versão
       * escolhia a função numa variável (`const chamar = … ? mod.encaminhar :
       * mod.enviar`) e a catraca de portas ficou vermelha — com razão: uma
       * chamada indireta é invisível para quem lê o arquivo procurando quem usa
       * o quê, que é exatamente o defeito que a catraca existe para pegar.
       */
      const { enviarMensagem, encaminharMensagem } = await import("@/lib/conversa.functions");
      const r =
        alvo.tipo === "mensagem"
          ? await encaminharMensagem({
              data: {
                accessToken: t,
                deConversaId: alvo.deConversaId,
                mensagemId: alvo.id,
                paraConversaId: c.id,
              },
            })
          : await enviarMensagem({
              data: { accessToken: t, conversaId: c.id, refTipo: alvo.tipo, refId: alvo.id },
            });
      /* ⚠️ Só marca "Enviado" se o servidor confirmou — a trava de
         uma-mensagem-antes-do-aceite recusa aqui como recusa em qualquer outro
         lugar, e pintar sucesso sobre a recusa seria mentir na tela. */
      if (r.ok) setEnviadas((e) => ({ ...e, [c.id]: true }));
    } catch {
      /* Fica sem o "Enviado", que é o sinal certo de que não foi. */
    } finally {
      setOcupada(null);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Mandar para uma conversa"
      className="fixed inset-0 z-[70] flex items-end bg-black/40"
      onClick={aoFechar}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[70vh] w-full overflow-y-auto rounded-t-3xl bg-card p-4 pb-[max(1rem,var(--safe-area-inset-bottom))]"
      >
        <p className="text-[15px] font-semibold">
          {alvo.tipo === "story"
            ? "Mandar este story para"
            : alvo.tipo === "mensagem"
              ? "Encaminhar para"
              : "Mandar para"}
        </p>
        {lista === null ? (
          <p className="py-6 text-center text-[13px] text-muted-foreground">Carregando…</p>
        ) : lista.length === 0 ? (
          /* ⚠️ O vazio EXPLICA a régua. Sem a frase, quem nunca conversou
             conclui que o botão está quebrado, e não que ainda não há para quem
             mandar. */
          <p className="py-6 text-center text-[13px] leading-snug text-muted-foreground">
            Você ainda não tem conversas.
            <br />
            Abra uma pelo perfil de alguém.
          </p>
        ) : (
          <ul className="mt-2">
            {lista.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  disabled={!!enviadas[c.id] || ocupada === c.id}
                  onClick={() => void mandar(c)}
                  className="press flex min-h-[56px] w-full items-center gap-3 text-left disabled:opacity-60"
                >
                  <Avatar url={c.comAvatar} nome={c.comNome} />
                  <span className="flex-1 truncate text-[14px] font-medium">{c.comNome}</span>
                  <span className="shrink-0 text-[13px] text-primary">
                    {enviadas[c.id] ? "Enviado ✓" : ocupada === c.id ? "…" : "Enviar"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          onClick={aoFechar}
          className="press mt-2 min-h-[44px] w-full text-[13px] text-muted-foreground"
        >
          Fechar
        </button>
      </div>
    </div>
  );
}
