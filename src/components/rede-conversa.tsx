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
import { BYTES_DA_FOTO, LIMITE_DA_MENSAGEM } from "@/lib/conversa";
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
}) {
  const [lista, setLista] = useState<ConversaNaTela[] | null>(bancada ?? null);
  const [erro, setErro] = useState(false);
  const [vendoPedidos, setVendoPedidos] = useState(false);
  const [sugeridas, setSugeridas] = useState<CandidataAConversa[]>(sugeridasDeBancada ?? []);

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
        const { conversasSugeridas } = await import("@/lib/conversa.functions");
        const sug = await conversasSugeridas({ data: { accessToken: t } });
        if (sug.ok) setSugeridas(sug.sugeridas);
      } catch {
        /* Sem fileira, a caixa continua inteira. */
      }
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
  rascunho,
  aoAbrirRef,
}: {
  conversa: ConversaNaTela;
  aoVoltar: () => void;
  aoAbrirPerfil?: (id: string) => void;
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
        data: { accessToken: tk, conversaId: conversa.id, texto: t, imagemPath },
      });
      if (r.ok) {
        setTexto("");
        setFoto(null);
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
          <div key={m.id} className={`mb-1.5 flex ${m.souEu ? "justify-end" : "justify-start"}`}>
            {/* ⚠️ **SÓ A MINHA MENSAGEM É TOCÁVEL, e o servidor confere de novo.**
                Apagar a mensagem da outra pessoa não é "apagar para mim" — seria
                reescrever a conversa dela. O `.eq("autor_id", eu)` do servidor é
                quem manda; isto aqui só evita oferecer o que seria recusado. */}
            <div
              onClick={() => m.souEu && !m.apagada && setApagando(m.id)}
              className={`max-w-[78%] rounded-2xl px-3 py-2 text-[14px] leading-snug ${
                m.souEu && !m.apagada ? "cursor-pointer" : ""
              } ${
                m.apagada
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
                  {m.texto && <span className="whitespace-pre-wrap break-words">{m.texto}</span>}
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
export function MandarPublicacao({
  postId,
  aoFechar,
  bancada,
}: {
  postId: string;
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
      const { enviarMensagem } = await import("@/lib/conversa.functions");
      const r = await enviarMensagem({
        data: { accessToken: t, conversaId: c.id, refTipo: "post", refId: postId },
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
        <p className="text-[15px] font-semibold">Mandar para</p>
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
