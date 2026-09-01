import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { CANTINHO_BY_ID, fundoBgFor } from "@/lib/cantinho";
import {
  BONUS_DA_DUPLA,
  MESADA_DA_ASSINANTE,
  PRESENTE_ENTRE_AMIGAS,
} from "@/lib/economia-sementinhas";
import {
  corDoAvatar,
  inicialDoNome,
  tempoNoApp,
  ultimaVez,
  type EnfeitePosto,
  type PerfilDeAmiga,
} from "@/lib/amigas";
import { linkDeIndicacao, mensagemDeConvite } from "@/lib/indicacao";
import { creditarSementinhas } from "@/lib/evento-sementinhas";
import type { EstadoDaMesadaAmiga } from "@/lib/mesada-paciente.functions";
import type { DuplaNaTela } from "@/lib/amigas.functions";
import { ChamaDaSequencia } from "@/components/chama-sequencia";
import { TrofeuIcone } from "@/components/trofeu";
import { Bolha } from "@/components/bolha";
import { TRILHA_SKINS } from "@/lib/trilha-skins";
import heroiDasAmigas from "@/assets/amigas/heroi.webp";

/**
 * A ABA DAS AMIGAS.
 *
 * ─── O QUE ELA É, E O QUE ELA DELIBERADAMENTE NÃO É ─────────────────────────
 *
 * É o Cantinho das amigas, o presente entre elas e a dupla de sequência. NÃO é
 * um placar, não tem caixa de comentário e não mostra uma linha de dado
 * clínico — nem semana, nem DPP, nem medida.
 *
 * As três ausências são a mesma decisão: num app de idioma comparar é ganhar um
 * jogo; aqui é comparar cuidado com o próprio bebê, e uma das duas pode perder
 * a gestação. O que se mostra é o que ela CONSTRUIU.
 *
 * A lista de amigas é o grafo de indicação nos dois sentidos — sem busca e sem
 * pedido de estranho, não há o que moderar.
 */
/**
 * O estado que a BANCADA injeta.
 *
 * ⚠️ Ela fabrica o DADO, nunca o desenho: a lista, a dupla e o bolso entram
 * pelos mesmos `useState` da produção, e daí para baixo é o componente de
 * verdade. Uma bancada que cravasse números na tela mostraria um estado que o
 * app nunca produz — foi exatamente assim que a folha da chama passou a
 * fotografar um texto que ninguém via.
 */
export type BancadaDasAmigas = {
  amigas: PerfilDeAmiga[];
  dupla: DuplaNaTela | null;
  /** `true` liga o botão 🎁 na linha da amiga (é o bolso do Premium). */
  assinante: boolean;
  /** O código de indicação. Sem ele o botão "Convidar" explica em vez de
      mandar um link que não liga ninguém a ninguém. */
  codigo?: string | null;
  /** Pedidos de amizade recebidos — a seção só existe quando há algum. */
  pedidos?: { id: string; nome: string; diasNoApp: number }[];
  /** O Cantinho que a TELA DA AMIGA desenha. Sem ele a bancada parava na
      lista: o perfil pede tudo ao servidor e, sem sessão, mostra só "não foi
      possível abrir este perfil". */
  cantinho: Cantinho;
};

export function AmigasTab({
  careMode,
  bancada,
}: {
  careMode?: boolean;
  bancada?: BancadaDasAmigas;
}) {
  const [amigas, setAmigas] = useState<PerfilDeAmiga[]>(bancada?.amigas ?? []);
  const [dupla, setDupla] = useState<DuplaNaTela | null>(bancada?.dupla ?? null);
  const [carregando, setCarregando] = useState(!bancada);
  const [aberta, setAberta] = useState<string | null>(null);
  /* ─── O PRESENTE MUDOU DE CASA (ago/2026) ─────────────────────────────
     Pedido do dono: "vai ser agora somente nas amizades". Ele vivia num
     cartão dentro do Cantinho (`PresentearAmigas`), que é a aba de COMPRAR
     enfeite — dar Sementinhas a uma amiga não tem nada a ver com aquilo, e
     quem quer presentear vai procurar onde as amigas estão. */
  const [mesada, setMesada] = useState<EstadoDaMesadaAmiga | null>(
    bancada
      ? {
          assinante: bancada.assinante,
          total: MESADA_DA_ASSINANTE,
          usado: 0,
          restante: MESADA_DA_ASSINANTE,
          sugerido: PRESENTE_ENTRE_AMIGAS,
        }
      : null,
  );
  const [enviando, setEnviando] = useState<string | null>(null);
  const [presenteadas, setPresenteadas] = useState<Set<string>>(new Set());
  /* ─── ⚠️ O CÓDIGO DE INDICAÇÃO ────────────────────────────────────────
     O botão "Convidar" mandava `${origin}/auth` — o link de login, PURO. O
     grafo de amizade deste app É o de indicação, então a amiga que entrasse por
     ali criava a conta e NUNCA virava amiga dela: não aparecia na lista, não
     dava para formar dupla nem presentear, e as 100 🌱 não eram pagas a
     ninguém. O botão da tela cujo assunto inteiro é trazer alguém era o único
     caminho do app que não trazia. Ver `indicacao.ts`. */
  const [codigo, setCodigo] = useState<string | null>(bancada?.codigo ?? null);
  /* ─── SAIR DA AMIZADE ─────────────────────────────────────────────────
     Guarda QUEM está sendo confirmada, não um booleano: com um booleano, abrir
     a confirmação numa linha e tocar "Sim" noutra encerraria a amiga errada.
     É a mesma decisão do ✕ do calendário do médico, que pede confirmação numa
     mensagem à parte em vez de virar "tem certeza?" no lugar. */
  const [saindoDe, setSaindoDe] = useState<PerfilDeAmiga | null>(null);
  /** A amiga cuja folha de "quanto dar" está aberta. */
  const [escolhendo, setEscolhendo] = useState<PerfilDeAmiga | null>(null);
  /* ─── O CONVITE ENTRE CONTAS QUE JÁ EXISTEM ───────────────────────────
     O buraco central da aba: a indicação só liga quem entrou pelo link de
     alguém, então duas pacientes que já usavam o app não tinham caminho
     nenhum. Ver `convidarAmiga` — resolve por CÓDIGO ou E-MAIL, nunca por
     nome, e sempre com aceite da outra. */
  const [termo, setTermo] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [pedidos, setPedidos] = useState<{ id: string; nome: string; diasNoApp: number }[]>(
    bancada?.pedidos ?? [],
  );

  /* ⚠️ Um BOOLEANO, não o objeto, nas listas de dependência. `bancada` é um
     literal remontado a cada render da rota de preview: usá-lo direto faria os
     três efeitos re-rodarem em toda pintura — inofensivo aqui (todos saem na
     primeira linha), mas é assim que um efeito com rede dentro vira um laço. */
  const ehBancada = !!bancada;

  const carregar = useCallback(async () => {
    if (ehBancada) return;
    try {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session?.access_token) return;
      const { minhasAmigas } = await import("@/lib/amigas.functions");
      const r = await minhasAmigas({ data: { accessToken: s.session.access_token } });
      if (r.ok) {
        setAmigas(r.amigas);
        setDupla(r.dupla);
      }
    } catch {
      /* sem rede: a aba mostra o estado vazio, que é honesto */
    } finally {
      setCarregando(false);
    }
  }, [ehBancada]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  /* O bolso de presentear. Sem assinatura ele não existe, e aí o botão de
     presente simplesmente não aparece na linha da amiga. */
  useEffect(() => {
    if (ehBancada) return;
    (async () => {
      try {
        const { data: s } = await supabase.auth.getSession();
        if (!s.session?.access_token) return;
        const { getMesadaDaAmiga } = await import("@/lib/mesada-paciente.functions");
        const r = await getMesadaDaAmiga({ data: { accessToken: s.session.access_token } });
        if (r.ok) setMesada(r.mesada);
      } catch {
        /* sem bolso: a linha da amiga fica sem o botão, e mais nada muda */
      }
    })();
  }, [ehBancada]);

  /* O código de indicação, que é o que faz o convite valer. Consulta própria e
     barata (`getReferral` lê uma coluna e a cria na primeira vez). */
  useEffect(() => {
    if (ehBancada) return;
    (async () => {
      try {
        const { data: s } = await supabase.auth.getSession();
        if (!s.session?.access_token) return;
        const { getReferral } = await import("@/lib/referral.functions");
        const r = await getReferral({ data: { accessToken: s.session.access_token } });
        if (r.ok) setCodigo(r.code);
      } catch {
        /* sem código: o botão explica, em vez de mandar um convite quebrado */
      }
    })();
  }, [ehBancada]);

  /* Os pedidos de amizade que ela recebeu e ainda não respondeu. */
  const carregarPedidos = useCallback(async () => {
    if (ehBancada) return;
    try {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session?.access_token) return;
      const { pedidosDeAmizade } = await import("@/lib/amigas.functions");
      const r = await pedidosDeAmizade({ data: { accessToken: s.session.access_token } });
      if (r.ok) setPedidos(r.pedidos);
    } catch {
      /* sem a tabela (SQL não aplicado) a seção some, e o resto continua */
    }
  }, [ehBancada]);
  useEffect(() => {
    void carregarPedidos();
  }, [carregarPedidos]);

  async function convidarPorTermo() {
    const t = termo.trim();
    if (!t || buscando) return;
    setBuscando(true);
    try {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session?.access_token) return;
      const { convidarAmiga } = await import("@/lib/amigas.functions");
      const r = await convidarAmiga({ data: { accessToken: s.session.access_token, termo: t } });
      if (!r.ok) {
        toast(
          r.error === "nao_encontrada"
            ? "Não achei esse código. Confira com ela — são 7 letras e números."
            : r.error === "muitos_convites"
              ? "Você já mandou muitos convites hoje. Tente de novo amanhã."
              : /* ⚠️ Texto PRÓPRIO: dizer "tente amanhã" sobre uma contagem que
                   falhou faria ela desistir por um dia inteiro de um convite
                   que o servidor aceitaria em dez segundos. */
                r.error === "instavel"
                ? "Não consegui conferir seus convites de hoje — tente de novo."
                : r.error === "termo_curto"
                  ? "Digite o código completo ou o e-mail dela."
                  : r.error === "indisponivel"
                    ? "Não é possível agora."
                    : "Não foi possível. O convite precisa do SQL aplicado no banco.",
          { duration: 6000 },
        );
        return;
      }
      setTermo("");
      /* ⚠️ `achou === null` é o caminho do E-MAIL, e a frase é a MESMA com e
         sem acerto: dizer "não existe conta com esse e-mail" transformaria o
         campo num verificador de contas — dá para descobrir se uma pessoa
         específica é paciente daqui, e isso é informação de saúde. */
      toast.success(
        r.achou && r.nome
          ? `Convite enviado para ${r.nome} 💌`
          : "Convite enviado! Se ela usa o app, vai ver o seu pedido.",
        { duration: 6000 },
      );
    } catch {
      toast("Não foi possível agora.");
    } finally {
      setBuscando(false);
    }
  }

  async function responderPedido(amigaId: string, aceitar: boolean) {
    try {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session?.access_token) return;
      const { responderAmizade } = await import("@/lib/amigas.functions");
      const r = await responderAmizade({
        data: { accessToken: s.session.access_token, amigaId, aceitar },
      });
      if (!r.ok) {
        toast("Não foi possível agora.");
        return;
      }
      if (aceitar) toast.success("Amizade formada 💛");
      setPedidos((v) => v.filter((p) => p.id !== amigaId));
      if (aceitar) void carregar();
    } catch {
      toast("Não foi possível agora.");
    }
  }

  /* ─── A OFENSIVA PAGA ────────────────────────────────────────────────
     Até ago/2026 a dupla dava só a chama compartilhada — nenhuma Sementinha.
     O incentivo existia no desenho e não existia na carteira. `cobrarBonusDaDupla`
     é idempotente e confere hoje e ontem, então abrir a aba dez vezes paga uma. */
  useEffect(() => {
    if (careMode || ehBancada) return;
    (async () => {
      try {
        const { data: s } = await supabase.auth.getSession();
        if (!s.session?.access_token) return;
        const { cobrarBonusDaDupla } = await import("@/lib/amigas.functions");
        const r = await cobrarBonusDaDupla({ data: { accessToken: s.session.access_token } });
        if (r.ok && r.ganho > 0) {
          creditarSementinhas(r.ganho);
          toast.success(`+${r.ganho} 🌱 da ofensiva com sua dupla 🔥`);
        }
      } catch {
        /* o bônus é secundário; a aba continua inteira sem ele */
      }
    })();
  }, [careMode, ehBancada]);

  /* ⚠️ O 🎁 ABRE A ESCOLHA, e não envia direto. Antes ele mandava 40 fixo no
     primeiro toque — o presente saía sem ela decidir nada, e "quanto eu quero
     dar" não existia como pergunta. */
  async function presentear(amiga: PerfilDeAmiga, quanto: number) {
    if (enviando) return;
    setEnviando(amiga.id);
    try {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session?.access_token) return;
      const { presentearAmiga } = await import("@/lib/mesada-paciente.functions");
      const r = await presentearAmiga({
        data: { accessToken: s.session.access_token, amigaId: amiga.id, quantidade: quanto },
      });
      if (r.ok) {
        setMesada(r.mesada);
        setPresenteadas((v) => new Set(v).add(amiga.id));
        setEscolhendo(null);
        toast.success(`${quanto} Sementinhas para ${amiga.nome} 🌱💌`);
        return;
      }
      /* Cada recusa com a sua frase: três delas são estados normais, não erros,
         e "não foi possível" faria ela tentar de novo contra uma parede. */
      toast(
        r.error === "ja_presenteada"
          ? `Você já presenteou ${amiga.nome} neste mês 💛`
          : r.error === "mesada_esgotada"
            ? "Seu bolso deste mês acabou. Ele volta na virada."
            : r.error === "sem_premium"
              ? "O bolso de presentear é do Premium."
              : r.error === "modo_cuidado"
                ? "Não é possível agora."
                : r.error === "nao_indicada"
                  ? "Vocês precisam estar conectadas pelo convite."
                  : "Não foi possível enviar.",
        { duration: 6000 },
      );
    } catch {
      toast("Não foi possível enviar.");
    } finally {
      setEnviando(null);
    }
  }

  async function encerrar(amiga: PerfilDeAmiga) {
    setSaindoDe(null);
    try {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session?.access_token) return;
      const { encerrarAmizade } = await import("@/lib/amigas.functions");
      const r = await encerrarAmizade({
        data: { accessToken: s.session.access_token, amigaId: amiga.id },
      });
      if (!r.ok) {
        toast(
          r.error === "sem_vinculo"
            ? "Vocês já não estão conectadas."
            : "Não foi possível agora. A saída precisa do SQL aplicado no banco.",
          { duration: 6000 },
        );
        return;
      }
      /* Sem festa e sem drama: ela sai da lista, e é isso. */
      toast(`${amiga.nome} não aparece mais aqui.`);
      void carregar();
    } catch {
      toast("Não foi possível agora.");
    }
  }

  /**
   * Já ganhou presente meu neste ciclo?
   *
   * ⚠️ A verdade é a do SERVIDOR (`a.jaPresenteada`, derivada do ledger). O
   * `Set` local só existe para o ✓ aparecer no mesmo instante do toque, antes
   * de a lista ser recarregada — se ele fosse a única fonte, trocar de aba
   * desmontaria a aba e os 🎁 voltariam ao normal para o servidor recusar. Foi
   * esse exato defeito que motivou tirar a segunda porta do Cantinho.
   */
  const jaFoi = (a: PerfilDeAmiga) => a.jaPresenteada || presenteadas.has(a.id);

  /* Compartilhar o link de indicação. `navigator.share` no celular; sem ele,
     copia — nunca um botão que não faz nada. */
  async function convidar() {
    const url = linkDeIndicacao(codigo, window.location.origin);
    /* ⚠️ SEM CÓDIGO, NÃO MANDA. Um convite sem indicação é indistinguível de um
       bom — para quem manda e para quem recebe. A amiga entra, e o vínculo
       simplesmente não acontece; a descoberta vem semanas depois, sem nada a
       que apontar. Melhor pedir que ela tente de novo do que gastar o convite
       dela num link que não liga ninguém a ninguém. */
    if (!url) {
      toast("Ainda estou preparando o seu link. Tente de novo em instantes.");
      return;
    }
    const texto = mensagemDeConvite(url);
    try {
      if (navigator.share) {
        await navigator.share({ title: "Obstétrica", text: texto, url });
        return;
      }
      /* O TEXTO INTEIRO na área de transferência, e não só o link: colado no
         WhatsApp, "https://..." sozinho não diz de quem veio nem o que é. */
      await navigator.clipboard.writeText(texto);
      toast.success("Link copiado 💌");
    } catch {
      /* ⚠️ CANCELAR E FALHAR CHEGAM AQUI IGUAIS, e antes os dois eram tratados
         como cancelamento. Uma recusa de `clipboard.writeText` (contexto
         inseguro, permissão negada) ficava indistinguível de "ela desistiu": o
         botão não fazia nada e não dizia nada, e o link não aparece como texto
         em lugar nenhum desta aba.

         Não dá para saber qual dos dois foi — então o recuo mostra o link, que
         serve aos dois casos e não acusa ninguém de nada. É o mesmo recuo que
         o cartão da aba Perfil sempre teve. */
      toast(`Copie o seu link: ${url}`, { duration: 12000 });
    }
  }

  /* Modo Cuidado: a aba inteira se cala, como a loja e o saldo. O servidor já
     devolve vazio; isto evita até o esqueleto piscar. */
  if (careMode) {
    return (
      <div className="rounded-3xl border border-dashed border-border p-8 text-center">
        <p className="text-sm text-muted-foreground">
          As Amigas voltam quando você quiser. Está tudo guardado.
        </p>
      </div>
    );
  }

  if (carregando) return <div className="skeleton h-64 rounded-3xl" />;

  if (aberta) {
    const daAberta = amigas.find((a) => a.id === aberta) ?? null;
    return (
      <>
        <PerfilDaAmigaTela
          amigaId={aberta}
          aoVoltar={() => setAberta(null)}
          /* O bolso vem da aba, que já o carregou — pedi-lo de novo aqui seria
             uma segunda ida ao servidor para responder a mesma pergunta, e as
             duas respostas poderiam discordar entre si. */
          assinante={!!mesada?.assinante}
          restanteDoBolso={mesada?.restante ?? 0}
          /* ⚠️ A saída da amizade veio da LINHA para cá (ver a lista). Ela
             chega como callback, e não como uma segunda cópia do fluxo: quem
             confirma, encerra e recarrega continua sendo a aba — a folha de
             confirmação e a lista que precisa ser recarregada moram nela. */
          aoSairDaAmizade={daAberta ? () => setSaindoDe(daAberta) : null}
          /* ⚠️ Sem isto a bancada não abre esta tela — ver `bancada` lá dentro.
             O Cantinho é o único pedaço que a lista não tem, e por isso vem da
             bancada da aba; o perfil sai da própria lista, que já o carrega. */
          bancada={bancada && daAberta ? { perfil: daAberta, cantinho: bancada.cantinho } : null}
        />
        {/* A folha de confirmação é a MESMA, e por isso é desenhada aqui
            também: renderizá-la só no ramo da lista faria o botão da tela dela
            abrir um diálogo que ninguém veria. */}
        <FolhaDeSair
          amiga={saindoDe}
          aoFechar={() => setSaindoDe(null)}
          aoConfirmar={() => saindoDe && encerrar(saindoDe)}
        />
      </>
    );
  }

  return (
    /* ─── O CHÃO DA ABA ───────────────────────────────────────────────────
       O lavanda-a-rosa da referência, AMOSTRADO dela linha a linha na coluna
       x=840 (a mais limpa da imagem) por `scripts/amigas-do-drive.mjs`. Não é
       enfeite: é ele que faz os cartões brancos da lista lerem como cartões, e
       sem ele o herói pintado ficava boiando sobre o creme do resto do app —
       uma ilustração colada numa página que não é dela.

       O raio de fora (28) e o do herói (20) guardam a diferença exata do
       recuo (12px): raios concêntricos que não fecham a conta é como uma tela
       passa a parecer montada às pressas. */
    /* ⚠️ O RECUO LATERAL É PEQUENO (`px-2`, 8px). Esta aba já vive dentro de um
       container com `px-5` (minha-conta) — somar mais 12px de cada lado deixava
       ~90px para o nome na linha da amiga, e "Camila Souza" saía "Camila…".
       Medido em 393px. */
    <div
      className="space-y-5 overflow-hidden rounded-[28px] px-2 py-3"
      style={{
        background:
          "linear-gradient(180deg, #feede6 0%, #fcecf0 8%, #ffeef0 16%, #f7e7f4 25%, #f1eaf7 33%, #f6eef8 43%, #f9edf8 54%, #fbf0f9 65%, #faf3f8 76%, #fcf5fa 87%, #fbf5f8 100%)",
      }}
    >
      {/* ── O HERÓI ───────────────────────────────────────────────────────
          ⚠️ É UMA COLAGEM, e a pergunta do dono foi exatamente essa: "você só
          não consegue colar ela, já que é o mesmo modelo de proporção, e
          depois atribuir as funções?". Consegue, e é a escolha certa aqui.

          A primeira versão reconstruiu isto em CSS — um `linear-gradient` no
          lugar do fundo pintado, a bolha `feliz` que já existia no lugar da
          bolha de olhos de coração, emoji 💗 no lugar dos corações desenhados.
          Ficou parecida de estrutura e completamente diferente de acabamento,
          e o dono resumiu: "uma tem cara de feita aqui, a outra de
          profissional". Gradiente não vira pintura e emoji não vira ícone.

          ⚠️ NADA AQUI É DADO. O fundo, a bolha, o balão e os corações são
          iguais para todas as pacientes, para sempre — então virar imagem não
          custa verdade nenhuma. O que é dado (nome, troféus, "há 2h") continua
          em código, logo abaixo: um número pintado numa imagem vira mentira no
          dia em que ele mudar.

          ⚠️ E O TEXTO VIRA `alt`, palavra por palavra: quem usa leitor de tela
          não perde o título nem a frase só porque eles são pixels agora.

          A faixa começa ABAIXO do cabeçalho da referência ("Amigas", ⚙️,
          "Sair") — aqueles são controles, e esta é uma ABA dentro da conta,
          que já tem cabeçalho e já tem sair. Colar uma segunda linha de botões
          desenhados seria fidelidade virando defeito. */}
      {/* ⚠️ O HERÓI SANGRA ATÉ A BORDA (`-mx-2 -mt-3 w-[calc(100%+1rem)]`) — ele
          está assim na referência, e a arte tem sombra e brilho nas quatro
          pontas: recuá-lo poria uma moldura de gradiente em volta de um desenho
          que já traz a própria. Quem arredonda o topo é o `overflow-hidden` do
          container, com o mesmo raio, sem uma segunda medida para divergir. */}
      <img
        src={heroiDasAmigas}
        alt="Amizade que faz bem 💗 — convide suas amigas, formem duplas e joguem juntas! Quanto mais conexão, mais recompensas!"
        className="-mx-2 -mt-3 block w-[calc(100%+1rem)] max-w-none"
        draggable={false}
      />

      {/* ─── PEDIDOS RECEBIDOS ─────────────────────────────────────────────
          Primeiro de tudo quando existe: é a única coisa da aba que espera uma
          decisão dela, e é o que muda de um dia para o outro. Some quando não
          há nenhum — uma seção vazia dizendo "nenhum pedido" só informa uma
          ausência que ela já vê. */}
      {pedidos.length > 0 && (
        <section>
          <h3 className="mb-2 flex items-center gap-2 px-1">
            <span
              className="flex h-8 w-8 items-center justify-center rounded-full text-base"
              style={{ background: "#fce7f3" }}
              aria-hidden
            >
              💌
            </span>
            <span className="font-serif text-lg">
              {pedidos.length === 1
                ? "Um pedido de amizade"
                : `${pedidos.length} pedidos de amizade`}
            </span>
          </h3>
          <ul className="space-y-2">
            {pedidos.map((ped) => (
              <li
                key={ped.id}
                className="rounded-2xl bg-white p-3 shadow-[0_1px_4px_rgba(0,0,0,0.05)] dark:bg-white/5"
              >
                <div className="flex items-center gap-2.5">
                  <Bolha tamanho={40} humor="feliz" flutua={false} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold">{ped.nome}</span>
                    <span className="mt-0.5 block text-[12px] text-muted-foreground">
                      {tempoNoApp(ped.diasNoApp)}
                    </span>
                  </span>
                </div>
                <div className="mt-2.5 flex gap-2">
                  <button
                    onClick={() => responderPedido(ped.id, true)}
                    className="press min-h-11 flex-1 rounded-full bg-primary text-[13px] font-bold text-primary-foreground"
                  >
                    Aceitar 💛
                  </button>
                  {/* "Agora não" e não "Recusar": ela pode mudar de ideia, e a
                      linha é APAGADA na recusa (marcar "recusada" bloquearia o
                      par para sempre pela chave única). E ninguém é avisado —
                      recusa que notifica vira constrangimento. */}
                  <button
                    onClick={() => responderPedido(ped.id, false)}
                    className="press min-h-11 flex-1 rounded-full border border-border text-[13px] font-semibold text-muted-foreground"
                  >
                    Agora não
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── DUPLAS FORMADAS ───────────────────────────────────────────────
          ⚠️ SINGULAR NO APP, PLURAL NA REFERÊNCIA — e a diferença é o banco,
          não o desenho. A imagem mostra três cartões de dupla lado a lado; o
          app tem um ÍNDICE PARCIAL que garante UMA dupla ativa por pessoa, e
          isso é deliberado: duas duplas viram um placar de várias frentes, que
          é o que esta aba decidiu não ser. Colar três cartões seria desenhar
          um estado que o banco recusa. */}
      <section>
        <CabecalhoDaSecao titulo="Dupla de sequência" />
        <DuplaCard dupla={dupla} amigas={amigas} aoMudar={carregar} />
      </section>

      {/* ── SUAS AMIGAS ─────────────────────────────────────────────────── */}
      <section>
        <CabecalhoDaSecao titulo="Suas amigas" />

        {amigas.length === 0 ? (
          /* Vazio que ENSINA o caminho. "Nenhuma amiga" só informaria a
             ausência, e a ausência ela já vê. */
          <div className="rounded-[20px] border border-dashed border-purple-200 bg-white/60 p-6 text-center">
            <span
              className="mx-auto flex h-12 w-12 items-center justify-center rounded-full"
              style={{ background: "#f6e9fb", color: "#9333ea" }}
            >
              <IconePessoas tamanho={24} />
            </span>
            <p className="mt-2.5 text-[15px] font-bold" style={{ color: "#2f2140" }}>
              Ainda não tem ninguém por aqui
            </p>
            <p className="mt-1 text-[13px] leading-snug" style={{ color: "#6d5b85" }}>
              Convide uma amiga pelo seu link de indicação. Vocês duas ganham Sementinhas, e ela
              aparece aqui.
            </p>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {amigas.map((a) => (
              <li
                key={a.id}
                /* ⚠️ `gap-1.5` e não `gap-2`. Medido em 393px: a coluna do nome
                   ficava com 117,5px e "Marina Costa" pede 119 — truncava por
                   DOIS pixels. Cada folga desta linha foi apertada até o nome
                   caber, porque o nome é a única coisa que a linha existe para
                   dizer. Em `minha-conta` o container é `px-5` (8px a menos que
                   a bancada), então a medida tem de sobrar. */
                className="flex items-center gap-1.5 rounded-[20px] bg-white/85 p-2.5 shadow-[0_1px_5px_rgba(80,40,110,0.06)] dark:bg-white/5"
              >
                <button
                  onClick={() => setAberta(a.id)}
                  className="press flex min-w-0 flex-1 items-center gap-2.5 text-left"
                >
                  <Avatar nome={a.nome} id={a.id} url={a.avatarUrl} tamanho={44} />
                  <span className="min-w-0 flex-1">
                    {/* ⚠️ 15px, e não 16. Medido: com 16px "Marina Costa" pedia
                        119px e a coluna dava 117,5 numa tela de 375 — truncava
                        justamente na linha que TEM o 🎁 (as outras sobram
                        largura). E 15px não é uma concessão: na referência de
                        852px de largura o nome mede ~30px de caixa, que numa
                        tela de 393 dá ~14px. O 16 é que estava grande demais. */}
                    <span
                      className="block truncate text-[15px] font-bold"
                      style={{ color: "#2f2140" }}
                    >
                      {a.nome}
                    </span>
                    {/* ⚠️ "há 2h" com o pontinho, como na referência — mas nunca
                        "Online". Ver `UltimaVez`. Sem `last_seen_at` a linha
                        some e entra o "no app há X", que é o dado que sempre
                        existiu: a lista nunca fica sem nada embaixo do nome. */}
                    {ultimaVez(a.vistaEm) ? (
                      <UltimaVez quando={a.vistaEm} />
                    ) : (
                      <span className="mt-0.5 block text-[12.5px]" style={{ color: "#6d5b85" }}>
                        {tempoNoApp(a.diasNoApp)}
                      </span>
                    )}
                  </span>
                </button>
                <PilulaDeTrofeus quantos={a.trofeus} />
                {/* O PRESENTE mora aqui agora — e só aqui. Ver o cabeçalho.

                    ⚠️ TRÊS condições, e as três vêm de fora da tela:
                    · `assinante` — o bolso é do Premium;
                    · `possoPresentear` — a lista é o grafo nos DOIS sentidos,
                      mas só se presenteia quem EU trouxe. Sem isto, quem entrou
                      pelo convite de alguém via o 🎁 na linha de quem a trouxe
                      e recebia "vocês precisam estar conectadas pelo convite",
                      que é falso: estão, pelo lado oposto;
                    · `jaPresenteada` — sai do LEDGER, não de um `Set` local que
                      zerava ao trocar de aba. */}
                {mesada?.assinante && a.possoPresentear && (
                  <button
                    onClick={() => setEscolhendo(a)}
                    disabled={enviando !== null || jaFoi(a)}
                    aria-label={
                      jaFoi(a)
                        ? `${a.nome} já ganhou presente seu neste mês`
                        : `Dar ${PRESENTE_ENTRE_AMIGAS} Sementinhas para ${a.nome}`
                    }
                    /* 44px é o alvo mínimo do HIG, e este é o ÚNICO controle do
                       recurso que o dono mandou trazer para cá — era 36. */
                    className="press flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-base disabled:opacity-40"
                    style={{ background: jaFoi(a) ? "#e7f6ec" : "#fce7f3" }}
                  >
                    {jaFoi(a) ? "✓" : "🎁"}
                  </button>
                )}
                {/* ─── ⚠️ O "SAIR DA AMIZADE" NÃO MORA MAIS AQUI ───────────
                    Ele era um ⋯ de 44px no fim da linha, e a conta não fechava:
                    medido em 393px, com avatar + nome + pílula + 🎁 + ⋯ sobravam
                    ~90px para o nome, e "Juliana Almeida" saía "Juliana Al…". O
                    nome da amiga é a única coisa que a linha existe para dizer.

                    Mudou de casa para a TELA DELA, onde cabe inteiro e com o
                    contexto todo — e onde ele já pertencia: sair de uma amizade
                    é uma decisão sobre uma pessoa, não um item de lista. É a
                    mesma lição do receituário, que saiu de aba própria e passou
                    a abrir dentro do cartão da paciente já escolhida.

                    A confirmação (a folha `saindoDe`) continua exatamente igual,
                    e continua morando AQUI: ela precisa recarregar a lista
                    depois de encerrar, e a lista é desta tela.

                    No lugar dele entra a setinha da referência, que diz o que a
                    linha faz: abre. Ela é `aria-hidden` e não um botão — quem
                    abre é o botão do nome, que ocupa a linha inteira; um
                    segundo alvo para o mesmo destino só daria ao leitor de tela
                    dois caminhos idênticos para anunciar. */}
                <span className="shrink-0" style={{ color: "#b8a6c9" }} aria-hidden>
                  <Chevron tamanho={18} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <FolhaDeSair
        amiga={saindoDe}
        aoFechar={() => setSaindoDe(null)}
        aoConfirmar={() => saindoDe && encerrar(saindoDe)}
      />

      <FolhaDePresente
        amiga={escolhendo}
        restante={mesada?.restante ?? 0}
        enviando={enviando !== null}
        aoFechar={() => setEscolhendo(null)}
        aoEnviar={(quanto) => escolhendo && presentear(escolhendo, quanto)}
      />

      {/* ─── ⚠️ O BOLSO DE PRESENTEAR, QUE NINGUÉM VIA ────────────────────
          Pedido do dono: "que tal aquele bônus de sementes ser elegível
          somente para enviar para uma amizade?"

          A resposta é que ISSO JÁ EXISTE — `MESADA_DA_ASSINANTE`, Sementinhas
          que a assinante só pode dar, nunca gastar consigo. O que faltava era
          a tela: o bolso era invisível, então quem paga o Premium não sabia
          que tinha um, e o único benefício visível da assinatura dentro desta
          aba era um 🎁 sem explicação.

          Um saldo que ela não sabe que tem não presenteia ninguém — é a mesma
          família de defeito do presente que chegava sem aviso. */}
      {mesada?.assinante && (
        <div
          className="flex items-center gap-3 rounded-3xl border p-3.5"
          style={{ background: "#f3fbf4", borderColor: "#cdeacf" }}
        >
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl"
            style={{ background: "#dff2e1" }}
            aria-hidden
          >
            🎁
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-bold leading-tight text-emerald-900">
              {mesada.restante > 0
                ? `Você tem ${mesada.restante} 🌱 para dar`
                : "Seu bolso deste mês acabou"}
            </p>
            <p className="mt-1 text-[12.5px] leading-tight text-emerald-800/80">
              {mesada.restante > 0
                ? `São do Premium e só servem para presentear — ${PRESENTE_ENTRE_AMIGAS} por amiga, no 🎁 ao lado do nome dela.`
                : "Ele enche de novo na virada do mês."}
            </p>
          </div>
        </div>
      )}

      {/* ─── ACHAR UMA AMIGA QUE JÁ USA O APP ──────────────────────────────
          O buraco que a aba tinha desde que nasceu: a indicação só liga quem
          entrou pelo link de alguém. Duas pacientes do mesmo obstetra que se
          conheceram na sala de espera e baixaram o app cada uma por conta
          própria não tinham caminho nenhum — e nada na tela explicava por quê.

          ⚠️ CÓDIGO OU E-MAIL, NUNCA NOME. Busca por nome transformaria a base
          de pacientes numa lista navegável, e num app de gestação de alto risco
          esse é o dado que menos pode vazar. O código é uma capacidade (só se
          tem se a outra der); o e-mail exige saber o e-mail. Ver
          `convidarAmiga`. */}
      <section className="rounded-3xl border border-border bg-card p-4">
        <p className="font-serif text-lg">Já tem uma amiga no app?</p>
        <p className="mt-1 text-[13px] leading-snug text-muted-foreground">
          Peça o código dela (7 letras e números, no cartão de indicação) ou use o e-mail que ela
          cadastrou. Ela recebe um pedido e escolhe se aceita.
        </p>
        <div className="mt-3 flex gap-2">
          <input
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void convidarPorTermo();
            }}
            placeholder="Código ou e-mail"
            aria-label="Código de indicação ou e-mail da amiga"
            /* `none` nos três: o código é maiúsculo e sem acento, e o teclado
               do celular capitaliza e corrige sozinho — foi assim que um código
               digitado certo virou um "não encontrei". O servidor normaliza de
               qualquer jeito, mas o campo não pode brigar com ela enquanto ela
               digita. */
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="min-h-11 min-w-0 flex-1 rounded-full border border-border bg-background px-4 text-[14px]"
          />
          <button
            onClick={() => void convidarPorTermo()}
            disabled={buscando || termo.trim().length < 3}
            className="press min-h-11 shrink-0 rounded-full px-4 text-[14px] font-bold text-white disabled:opacity-40"
            style={{ background: "#c9316f" }}
          >
            {/* ⚠️ "Enviar" e não "Convidar": o cartão amarelo logo abaixo tem
                um botão "Convidar" que faz outra coisa (compartilha o LINK,
                para quem ainda não tem conta). Dois botões com o mesmo rótulo
                e comportamentos diferentes na mesma tela é como a paciente
                aprende que os botões daqui não querem dizer nada. */}
            {buscando ? "…" : "Enviar"}
          </button>
        </div>
        {/* O código DELA, para mandar. Sem isto o campo pede uma coisa que ela
            não sabe onde encontrar — e o cartão que mostra o código vive noutra
            aba. */}
        {codigo && (
          <p className="mt-2.5 text-[12px] text-muted-foreground">
            O seu código é{" "}
            <strong className="font-mono font-bold tracking-wider text-foreground">{codigo}</strong>{" "}
            — mande para ela te achar também.
          </p>
        )}
      </section>

      {/* ── CONVIDAR ──────────────────────────────────────────────────────
          O cartão do pé da referência: o círculo roxo com a silhueta e o `+`,
          o título, a linha do link, e o botão rosa com a setinha. */}
      <div
        /* `gap-2.5` e `p-3`: medido em 393px, com `gap-3`/`p-3.5` a legenda
           quebrava em TRÊS linhas ao lado de um botão de uma — o cartão ficava
           três vezes mais alto que o da referência. */
        className="flex items-center gap-2.5 rounded-[20px] p-3"
        style={{ background: "linear-gradient(100deg,#fdf3e0,#fbeef4 55%,#f6ecfb)" }}
      >
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white"
          style={{ background: "linear-gradient(150deg,#a855f7,#7c3aed)" }}
        >
          <IconeConvidar tamanho={22} />
        </span>
        {/* `leading-tight` não é enfeite: com a entrelinha padrão o título
            quebrava em duas linhas bem separadas e a legenda em mais duas, e o
            cartão virava um bloco de quatro linhas do lado de um botão de uma.
            Medido em 393px — a largura que sobra aqui é ~145px, então o título
            SEMPRE quebra; o que se ajusta é a entrelinha, não a quebra.

            ⚠️ E ela vai em CADA `<p>`, nunca no pai. Medido: com a classe no
            pai, o parágrafo computava 26,25px (15 × 1,75) — há uma regra base
            de `p` no projeto, e regra de ELEMENTO vence valor herdado, por mais
            específica que seja a classe de quem herda. */}
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-bold leading-tight" style={{ color: "#2f2140" }}>
            Convide mais amigas!
          </p>
          {/* ⚠️ "Vocês duas ganham", e não o "Compartilhe seu link e ganhe" da
              referência. Duas razões, e a primeira é medida: o texto da
              referência ocupa TRÊS linhas ao lado do botão numa tela de 393px
              (a coluna que sobra aqui tem ~140px), e o cartão saía três vezes
              mais alto que o do desenho. A segunda é que o texto curto é mais
              VERDADEIRO — quem indica e quem entra ganham as duas, e é isso
              que faz o convite valer a pena mandar. */}
          <p className="mt-1 text-[12.5px] leading-tight" style={{ color: "#6d5b85" }}>
            Vocês duas ganham Sementinhas 🌱
          </p>
        </div>
        <button
          onClick={convidar}
          /* `min-h-11` = 44px, o alvo mínimo do HIG. Media 102×38: o botão que
             a paciente precisa achar para trazer alguém, na tela cujo assunto
             inteiro é trazer alguém. */
          className="press flex min-h-11 shrink-0 items-center gap-0.5 rounded-full px-3.5 text-[14px] font-bold text-white"
          /* ⚠️ `#c9316f` e não o `#e04f8f` da referência: medido, o rosa
             original dá 3,69:1 com o branco. Texto de 14px em negrito NÃO é
             "texto grande" pela WCAG (o corte é 18,66px), então o mínimo é
             4,5:1 — este dá 5,06:1. É o botão que a paciente precisa achar
             para trazer alguém, na tela cujo assunto inteiro é trazer alguém. */
          style={{ background: "#c9316f" }}
        >
          Convidar <Chevron tamanho={15} />
        </button>
      </div>
    </div>
  );
}

/**
 * ─── QUANTO ELA QUER DAR ────────────────────────────────────────────────────
 *
 * Pedido do dono: "a amizade ali ela pode escolher o quanto que ela dá".
 *
 * ⚠️ O SERVIDOR JÁ ACEITAVA `quantidade` E VALIDAVA CONTRA O BOLSO — o que
 * faltava era só a tela, que mandava `PRESENTE_ENTRE_AMIGAS` fixo. Este
 * componente não afrouxa trava nenhuma: o teto continua sendo
 * `mesada.restante`, conferido no servidor, e daqui só sai um número.
 *
 * ⚠️ OS VALORES SÃO DEGRAUS, e não um campo livre. Um campo aberto obriga a
 * paciente a inventar um número — e o presente entre amigas é um gesto, não uma
 * transferência bancária. Os degraus saem do sugerido (`PRESENTE_ENTRE_AMIGAS`)
 * para cima e para baixo, e os que não cabem no bolso dela nem aparecem: um
 * botão que o servidor vai recusar é pior que um botão a menos.
 *
 * ⚠️ E O BOLSO INTEIRO ENTRA COMO ÚLTIMO DEGRAU quando sobra pouco. Sem isso,
 * quem tem 25 🌱 no bolso não veria degrau nenhum (todos acima de 25) e o
 * recurso simplesmente sumiria da tela sem explicação, com saldo disponível.
 */
function degraus(restante: number): number[] {
  const base = [20, PRESENTE_ENTRE_AMIGAS, 80, 120];
  const cabem = base.filter((v) => v <= restante);
  /* O bolso inteiro, quando ele não é um degrau já listado. */
  if (restante > 0 && !cabem.includes(restante)) cabem.push(restante);
  return [...new Set(cabem)].sort((a, b) => a - b);
}

function FolhaDePresente({
  amiga,
  restante,
  enviando,
  aoFechar,
  aoEnviar,
}: {
  amiga: { id: string; nome: string } | null;
  restante: number;
  enviando: boolean;
  aoFechar: () => void;
  aoEnviar: (quanto: number) => void;
}) {
  const opcoes = degraus(restante);
  const [quanto, setQuanto] = useState<number>(
    /* Abre no sugerido quando ele cabe; senão, no maior que cabe. */
    opcoes.includes(PRESENTE_ENTRE_AMIGAS)
      ? PRESENTE_ENTRE_AMIGAS
      : (opcoes[opcoes.length - 1] ?? 0),
  );
  if (!amiga) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 p-4 backdrop-blur-sm sm:items-center"
      onClick={aoFechar}
    >
      <div
        role="dialog"
        aria-label={`Presentear ${amiga.nome}`}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow-float)]"
      >
        <p className="font-serif text-lg">Quanto para {amiga.nome}?</p>
        <p className="mt-1 text-[12.5px] leading-snug text-muted-foreground">
          Você tem <strong className="font-semibold">{restante} 🌱</strong> no bolso do Premium
          neste mês. Ele só serve para presentear.
        </p>

        {opcoes.length === 0 ? (
          <p className="mt-4 text-[13px] text-muted-foreground">
            Seu bolso deste mês acabou. Ele enche de novo na virada.
          </p>
        ) : (
          <>
            <div className="mt-4 flex flex-wrap gap-2">
              {opcoes.map((v) => (
                <button
                  key={v}
                  onClick={() => setQuanto(v)}
                  aria-pressed={quanto === v}
                  className={`press min-h-11 rounded-full px-4 text-[15px] font-bold transition-colors ${
                    quanto === v
                      ? "bg-primary text-primary-foreground"
                      : "border border-border text-muted-foreground"
                  }`}
                >
                  {v} 🌱
                </button>
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={aoFechar}
                className="press min-h-11 flex-1 rounded-full border border-border text-[13px] font-semibold text-muted-foreground"
              >
                Agora não
              </button>
              <button
                onClick={() => aoEnviar(quanto)}
                disabled={enviando || quanto <= 0}
                className="press min-h-11 flex-1 rounded-full bg-primary text-[13px] font-bold text-primary-foreground disabled:opacity-50"
              >
                {enviando ? "Enviando…" : `Enviar ${quanto} 🌱`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * ⚠️ A CONFIRMAÇÃO DE SAIR DA AMIZADE.
 *
 * Uma folha à parte, e não o botão virando "tem certeza?": o pedido do dono no
 * calendário foi explicitamente por uma mensagem separada, e a razão vale aqui
 * em dobro — é uma ação sobre uma PESSOA e não há desfazer na tela.
 *
 * O texto diz as três coisas que ela precisa saber para decidir, e nenhuma a
 * mais:
 *  · o que acontece (some da lista, dos dois lados);
 *  · o que NÃO acontece (ninguém é avisado — é o que faz isto ser uma saída e
 *    não uma briga);
 *  · e que as Sementinhas já dadas continuam de quem recebeu, porque a pergunta
 *    "vou perder o que ganhei?" é a primeira que aparece.
 *
 * ⚠️ VIROU COMPONENTE porque agora há DOIS lugares que abrem: a lista e a tela
 * da amiga. Duplicar o JSX faria as duas versões divergirem no primeiro ajuste
 * de texto — e este texto é o que separa uma saída de uma briga.
 */
function FolhaDeSair({
  amiga,
  aoFechar,
  aoConfirmar,
}: {
  amiga: PerfilDeAmiga | null;
  aoFechar: () => void;
  aoConfirmar: () => void;
}) {
  if (!amiga) return null;
  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 p-4 backdrop-blur-sm sm:items-center"
      onClick={aoFechar}
    >
      <div
        role="dialog"
        aria-label="Sair da amizade"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow-float)]"
      >
        <p className="font-serif text-lg">Sair da amizade com {amiga.nome}?</p>
        <p className="mt-2 text-[13px] leading-snug text-muted-foreground">
          Vocês deixam de aparecer uma para a outra: sem Cantinho, sem dupla e sem presentes.{" "}
          <strong className="font-semibold">Ela não é avisada.</strong> As Sementinhas que já foram
          dadas continuam com quem recebeu.
        </p>
        <div className="mt-4 flex gap-2">
          <button
            onClick={aoConfirmar}
            className="press min-h-11 flex-1 rounded-full border border-border text-[13px] font-semibold text-muted-foreground"
          >
            Sair da amizade
          </button>
          {/* Ficar é o botão CHEIO e o primeiro para o polegar direito: a ação
              reversível é a que deve ser fácil de acertar. */}
          <button
            onClick={aoFechar}
            className="press min-h-11 flex-1 rounded-full bg-primary text-[13px] font-bold text-primary-foreground"
          >
            Ficar
          </button>
        </div>
      </div>
    </div>
  );
}

/* ⚠️ O ARRAY `CORACOES` SAIU. Ele espalhava 💗 pelo herói reconstruído em CSS;
   com o herói virando a colagem da referência, os corações são os DESENHADOS
   pelo ilustrador — com volume, sombra e reflexo, no lugar exato em que ele os
   pôs. Manter os emoji por cima seria pintar coração sobre coração. */

/* ══════════════════════ AS PEÇAS QUE A LISTA REPETE ══════════════════════ */

/**
 * ⚠️ O ÍCONE DE "DUAS PESSOAS" É DESENHADO, NÃO EMOJI.
 *
 * A referência tem um glifo roxo de duas silhuetas, do mesmo peso de traço em
 * todos os cabeçalhos. O emoji equivalente é 👭 — e emoji tem COR E DESENHO
 * PRÓPRIOS DE CADA SISTEMA: sai duas mulheres coloridas no iOS, dois bonecos
 * planos no Android, e nenhum dos dois é roxo. É a mesma lição do 📞 que sai
 * preto no iOS na Central de Emergência e do calendário da fita.
 *
 * `currentColor` para o cabeçalho escolher a cor uma vez, no lugar onde ela
 * está escrita.
 */
function IconePessoas({ tamanho = 18 }: { tamanho?: number }) {
  return (
    <svg
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19" />
      <circle cx="10" cy="7.5" r="3.2" />
      <path d="M20 19v-1.5a3.5 3.5 0 0 0-2.6-3.38" />
      <path d="M15.4 4.62a3.5 3.5 0 0 1 0 5.76" />
    </svg>
  );
}

/** A silhueta com o `+` do cartão de convite. Desenhada pelo mesmo motivo. */
function IconeConvidar({ tamanho = 20 }: { tamanho?: number }) {
  return (
    <svg
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M15 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-4A3.5 3.5 0 0 0 4 17.5V19" />
      <circle cx="9.5" cy="7.5" r="3.2" />
      <path d="M18.5 8v5M21 10.5h-5" />
    </svg>
  );
}

/**
 * O CABEÇALHO DE SEÇÃO — a bolinha com o ícone, o título e o "Ver todas ›".
 *
 * ⚠️ "VER TODAS" SÓ APARECE QUANDO HÁ O QUE VER. Na referência ele está nos
 * dois cabeçalhos, sempre; aqui só nasce com `aoVerTodas`, porque um link que
 * abre a mesma lista que já está na tela ensina a paciente que os links desta
 * tela não levam a lugar nenhum. Hoje a lista inteira já cabe na aba — então
 * ele fica de fora, e volta no dia em que ela for cortada.
 */
function CabecalhoDaSecao({
  titulo,
  aoVerTodas,
}: {
  titulo: string;
  aoVerTodas?: (() => void) | null;
}) {
  return (
    <div className="mb-2.5 flex items-center gap-2.5 px-1">
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
        style={{ background: "#f6e9fb", color: "#9333ea" }}
      >
        <IconePessoas />
      </span>
      <h3 className="min-w-0 flex-1 truncate font-serif text-[19px]" style={{ color: "#2f2140" }}>
        {titulo}
      </h3>
      {aoVerTodas && (
        <button
          onClick={aoVerTodas}
          className="press flex shrink-0 items-center gap-1 text-[13px] font-semibold"
          style={{ color: "#6d5b85" }}
        >
          Ver todas <Chevron />
        </button>
      )}
    </div>
  );
}

/** A setinha ›, desenhada — o caractere tipográfico muda de peso por fonte. */
function Chevron({ tamanho = 16 }: { tamanho?: number }) {
  return (
    <svg
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M9 5l7 7-7 7" />
    </svg>
  );
}

/**
 * O AVATAR — a foto dela, ou a inicial num círculo colorido.
 *
 * ⚠️ A REFERÊNCIA TEM FOTO EM TODA LINHA, e a primeira versão desta tela
 * substituiu isso por uma bolha genérica igual para todo mundo, sem dizer nada.
 * O resultado é o que o dono viu: uma lista em que todas são a mesma pessoa. O
 * problema não era layout — era um DADO que não existia (`avatar_url`), e
 * trocá-lo em silêncio por um genérico foi o erro.
 *
 * Sem foto, a inicial. NUNCA a bolha: a Bolha é a personagem do app, a mesma
 * para todas — usá-la como avatar é reintroduzir o defeito com outro desenho.
 */
function Avatar({
  nome,
  id,
  url,
  tamanho = 44,
  className = "",
}: {
  nome: string;
  id: string;
  url: string | null;
  tamanho?: number;
  className?: string;
}) {
  const estilo = { width: tamanho, height: tamanho };
  if (url) {
    return (
      <img
        src={url}
        alt=""
        style={estilo}
        className={`shrink-0 rounded-full object-cover ${className}`}
        draggable={false}
      />
    );
  }
  return (
    <span
      style={{
        ...estilo,
        background: corDoAvatar(id),
        /* A inicial acompanha o círculo: cravada em px, ela ficaria minúscula
           no avatar de 56px da dupla e apertada no de 36px. */
        fontSize: Math.round(tamanho * 0.42),
      }}
      className={`flex shrink-0 items-center justify-center rounded-full font-bold text-white ${className}`}
      aria-hidden
    >
      {inicialDoNome(nome)}
    </span>
  );
}

/**
 * A PÍLULA DE TROFÉUS — a estrela e o número, à direita da linha.
 *
 * ⚠️ A referência mostra uma estrela e um número que ela chama de pontos; aqui
 * o número são os TROFÉUS dela (dias de cinco estrelas), que é o que o app de
 * fato conta e o que o perfil dela já mostrava. Inventar uma pontuação nova só
 * para caber num desenho seria criar um placar — exatamente o que esta aba
 * decidiu não ter.
 */
function PilulaDeTrofeus({ quantos }: { quantos: number }) {
  return (
    <span
      className="flex shrink-0 items-center gap-1 rounded-full px-2 py-1.5 text-[14px] font-bold tabular-nums"
      style={{ background: "#f3e8fd", color: "#6b21a8" }}
      title={`${quantos} ${quantos === 1 ? "troféu" : "troféus"} dela`}
    >
      <TrofeuIcone tamanho={16} /> {quantos}
    </span>
  );
}

/**
 * O PONTINHO + "há 2h" embaixo do nome.
 *
 * ⚠️ A COR DO PONTO É RECÊNCIA, NUNCA PRESENÇA. A referência tem um ponto
 * verde escrito "Online", e presença ao vivo exige conexão persistente, que o
 * app não tem — ver `ultimaVez`. O verde aqui quer dizer "apareceu na última
 * hora", que é um fato; e o texto ao lado diz exatamente qual fato é.
 *
 * ⚠️ E sem `last_seen_at` a linha inteira some, em vez de virar "Offline":
 * quem nunca abriu desde que a coluna existe não tem última vez, e um
 * "Offline" ali seria o app afirmando um comportamento que ele não observou.
 */
function UltimaVez({ quando }: { quando: string | null }) {
  const texto = ultimaVez(quando);
  if (!texto) return null;
  const cor =
    texto === "agora mesmo"
      ? "#22c55e"
      : texto.startsWith("há ") && texto.endsWith("h")
        ? "#f59e0b"
        : "#a8a29e";
  return (
    <span className="mt-0.5 flex items-center gap-1.5 text-[12.5px]" style={{ color: "#6d5b85" }}>
      <span
        className="inline-block h-[7px] w-[7px] shrink-0 rounded-full"
        style={{ background: cor }}
        aria-hidden
      />
      {texto}
    </span>
  );
}

/**
 * A partir de quantos dias sem a outra a tela reconhece a PAUSA.
 *
 * Quatro, e não dois: dois dias sem aparecer é um fim de semana, e anunciar
 * pausa aí ensinaria que a dupla é frágil. Quatro já é uma ausência que a outra
 * percebeu sozinha — e é aí que o silêncio da tela começa a ser lido como
 * abandono.
 */
const DIAS_PARA_PAUSA = 4;

/* ══════════════════════════ A DUPLA ══════════════════════════ */

/**
 * A CHAMA COMPARTILHADA.
 *
 * Quatro estados, quatro telas. "Convite que eu mandei" e "convite que me
 * mandaram" pedem coisas opostas — uma espera, a outra decide —, e tratá-los
 * como um "pendente" só é o que faz aparecer um botão "Aceitar" para quem
 * acabou de convidar.
 */
function DuplaCard({
  dupla,
  amigas,
  aoMudar,
}: {
  dupla: DuplaNaTela | null;
  amigas: PerfilDeAmiga[];
  aoMudar: () => void;
}) {
  const [ocupado, setOcupado] = useState(false);

  async function chamar(fn: "convidar" | "aceitar" | "recusar" | "desfazer", amigaId?: string) {
    setOcupado(true);
    try {
      const { data: s } = await supabase.auth.getSession();
      const token = s.session?.access_token;
      if (!token) return;
      const m = await import("@/lib/amigas.functions");
      const r =
        fn === "convidar"
          ? await m.convidarDupla({ data: { accessToken: token, amigaId: amigaId! } })
          : fn === "desfazer"
            ? await m.desfazerDupla({ data: { accessToken: token } })
            : await m.responderDupla({
                data: { accessToken: token, amigaId: amigaId!, aceitar: fn === "aceitar" },
              });
      if (!r.ok) {
        toast(
          "error" in r && r.error === "indisponivel"
            ? "Não é possível agora."
            : "error" in r && r.error === "sem_vinculo"
              ? "Vocês precisam estar conectadas pelo convite."
              : "Não foi possível. A dupla precisa do SQL aplicado no banco.",
          { duration: 6000 },
        );
        return;
      }
      if (fn === "convidar") toast.success("Convite enviado 🔥");
      if (fn === "aceitar") toast.success("Dupla formada! A chama começa hoje 🔥");
      aoMudar();
    } catch {
      toast("Não foi possível agora.");
    } finally {
      setOcupado(false);
    }
  }

  const estado = dupla?.estado ?? "sem";

  return (
    <div className="rounded-3xl border border-amber-200 bg-gradient-to-b from-amber-50 to-white p-5 dark:border-amber-500/25 dark:from-amber-500/10 dark:to-transparent">
      {/* ⚠️ O TÍTULO INTERNO SAIU. O cabeçalho da seção já diz "Dupla de
          sequência", e o cartão dizia de novo, logo abaixo — a mesma palavra
          duas vezes em duas linhas seguidas. É o defeito que a seção de
          Teleconsultas do painel já teve e que foi resolvido do mesmo jeito:
          fica UM título, o de fora, e o texto explicativo sobe para o lugar
          onde o título estava. */}
      <div className="flex items-start gap-3">
        <ChamaDaSequencia acesa={estado === "ativa" && (dupla?.sequencia ?? 0) > 0} tamanho={34} />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] leading-snug text-muted-foreground">
            Vocês duas seguram a mesma chama: o dia conta quando as duas aparecem, e vocês ganham{" "}
            <strong className="font-semibold">+{BONUS_DA_DUPLA} 🌱 cada uma</strong>.{" "}
            {/* ⚠️ O número sai da fonte única, nunca digitado — o servidor é
                quem paga, e um texto divergente prometeria o que ele não dá.
                Dito em voz alta porque o dono pediu ("vocês ganham mais
                sementinhas juntas") e porque até ago/2026 a dupla não pagava
                nada: o incentivo existia no desenho e não na carteira. */}
            {/* Dito em voz alta porque é o que separa isto de um placar — e é a
                primeira coisa que alguém teme ao ler "dupla". */}
            <strong className="font-semibold">Ninguém perde nada</strong> se a outra não vier.
          </p>
        </div>
      </div>

      {estado === "ativa" && dupla && (
        /* ⚠️ VERTICAL, e não a linha que estava aqui. A referência empilha os
           dois rostos, o "Você + Juliana" e a pílula — e não é gosto: medido em
           393px, a linha horizontal deixava ~90px para o nome ao lado do par de
           avatares e do botão "Desfazer", e "Você + Marina Costa" saía como
           "Você + M…". Empilhado, o nome tem a largura inteira do cartão. */
        <div className="mt-4 flex flex-col items-center gap-2 rounded-2xl bg-white/70 p-3.5 dark:bg-white/5">
          {/* ─── OS DOIS ROSTOS COM O CORAÇÃO ────────────────────────────
              É o desenho da referência ("Você + Juliana", duas fotos
              sobrepostas com um coração no encontro delas) trazido para o
              único lugar onde ele tem dado por trás: a dupla ATIVA.

              ⚠️ O da esquerda é um lugar SEM foto, de propósito: quem olha
              esta tela é ela, e a paciente não precisa de retrato para se
              reconhecer numa dupla de duas. O da direita é a amiga, com a
              foto dela quando existe — é ela que a tela está identificando.
              ⚠️ E a sobreposição é `-ml-2` (8px de 56), não `-ml-4`: com 16px o
              círculo "Você" cobria um terço do rosto dela, e o rosto dela é o
              que este par existe para mostrar. O coração pousa na emenda. */}
          <span className="relative flex shrink-0 items-center pb-1" aria-hidden>
            {/* ⚠️ `relative z-10` no PRIMEIRO, e não no segundo. Sem isso o
                avatar da amiga (que vem depois no DOM e por isso pinta por
                cima) cobria a ponta direita deste — e a palavra "Você" saía
                cortada no meio do "ê". Em pilha de avatares sobrepostos quem
                fica na frente é sempre o primeiro. */}
            <span
              className="relative z-10 flex h-14 w-14 items-center justify-center rounded-full border-[3px] border-white text-[11px] font-bold text-white"
              style={{ background: "linear-gradient(150deg,#f0a8c8,#d47ab0)" }}
            >
              Você
            </span>
            <Avatar
              nome={dupla.nome ?? ""}
              /* Sem `amigaId` a cor cai num id vazio — determinística do mesmo
                 jeito, que é o que a hidratação do SSR exige. */
              id={dupla.amigaId ?? ""}
              url={amigas.find((a) => a.id === dupla.amigaId)?.avatarUrl ?? null}
              tamanho={56}
              className="-ml-2 border-[3px] border-white"
            />
            <span
              className="absolute bottom-0 left-1/2 z-20 flex h-7 w-7 -translate-x-1/2 items-center justify-center rounded-full border-[3px] border-white text-[12px] text-white"
              style={{ background: "linear-gradient(150deg,#f472b6,#db2777)" }}
            >
              ♥
            </span>
          </span>
          <span className="w-full min-w-0 text-center">
            <span className="block truncate text-[16px] font-bold" style={{ color: "#2f2140" }}>
              Você + {dupla.nome}
            </span>
            {/* ⚠️ A PÍLULA SÓ NASCE COM A CHAMA ACESA. A referência tem uma
                pílula de pontos sempre visível; aqui, em zero, ela mostraria
                "0" — e um zero em destaque numa dupla que segurou sessenta
                dias é o oposto do que esta seção existe para dizer. Em zero
                fica a frase, que explica; com dias, a pílula, que celebra. */}
            {dupla.sequencia > 0 ? (
              <span
                className="mt-1.5 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[14px] font-bold tabular-nums"
                style={{ background: "#fdf0d4", color: "#a35a09" }}
              >
                🔥 {dupla.sequencia} {dupla.sequencia === 1 ? "dia" : "dias"} juntas
              </span>
            ) : (
              <span className="mt-0.5 block text-[12px] text-muted-foreground">
                {/* ⚠️ "a chama começa quando as duas aparecerem" é frase de
                    dupla NOVA, e ela aparecia também numa dupla com 41 dias de
                    história — dizendo "começa" para quem já tinha começado há
                    meses. Com recorde, quem explica o zero é a memória logo
                    abaixo e a pausa logo adiante; aqui não falta nada. */}
                {dupla.recorde > 0
                  ? "a chama está esperando vocês duas"
                  : "a chama começa quando as duas aparecerem"}
              </span>
            )}
            {/* ─── A MEMÓRIA ────────────────────────────────────────────
                `sequencia` zera quando a chama quebra, e deve mesmo — é o
                número que acende o fogo. Mas uma dupla que segurou sessenta
                dias e parou numa semana de internação ficava com ZERO, como se
                nunca tivesse existido, e o vínculo é o ponto desta aba.

                Só aparece quando o recorde é MAIOR que a chama de hoje: com os
                dois iguais seria a mesma frase escrita duas vezes. */}
            {dupla.recorde > dupla.sequencia && (
              <span className="mt-0.5 block text-[11px] text-amber-700 dark:text-amber-300">
                🏅 A melhor de vocês foi {dupla.recorde} dias seguidos
                {dupla.juntas > dupla.recorde ? ` · ${dupla.juntas} dias juntas no total` : ""}
              </span>
            )}
          </span>
          <button
            onClick={() => chamar("desfazer")}
            disabled={ocupado}
            /* 44px de altura, como o resto. Desfazer a dupla é uma ação que
               ela toma UMA vez e precisa acertar — errar o alvo aqui e acertar
               o "Desfazer" por engano é justamente o que não pode acontecer. */
            className="min-h-11 shrink-0 rounded-full border border-border px-3 text-[11px] font-semibold text-muted-foreground"
          >
            Desfazer
          </button>
        </div>
      )}

      {/* ─── ⚠️ A PAUSA, E O QUE ELA NUNCA DIZ ─────────────────────────────
          Quando a chama está em zero e a outra não aparece há dias, a tela
          calava — e o silêncio tem uma leitura só: "ela me abandonou".

          O motivo mais provável de um sumiço longo numa gestação de alto risco
          é justamente o que ninguém tem o direito de insinuar. Então o texto
          diz o FATO (a chama está parada), tira a culpa das duas, e para por
          aí. Nada de "ela está de licença", "ela está bem?" ou qualquer coisa
          que convide a imaginar — o app não sabe, e adivinhar em voz alta é o
          que o Modo Cuidado existe para impedir.

          `DIAS_PARA_PAUSA` é 4 e não 2: dois dias sem aparecer é fim de semana.
          Anunciar pausa aí ensinaria a paciente a achar que a dupla é frágil. */}
      {estado === "ativa" &&
        dupla &&
        dupla.sequencia === 0 &&
        dupla.paradaHa != null &&
        dupla.paradaHa >= DIAS_PARA_PAUSA && (
          <p className="mt-2 rounded-2xl bg-white/70 p-3 text-[12px] leading-snug text-muted-foreground dark:bg-white/5">
            A chama de vocês está em pausa. <strong className="font-semibold">Está tudo bem</strong>{" "}
            — ela volta a contar no dia em que as duas aparecerem, e nada do que vocês já fizeram se
            perdeu.
          </p>
        )}

      {estado === "convite-recebido" && dupla && (
        <div className="mt-4 rounded-2xl bg-white/70 p-3 dark:bg-white/5">
          <p className="text-sm">
            <strong>{dupla.nome}</strong> te chamou para uma dupla.
          </p>
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => chamar("aceitar", dupla.amigaId!)}
              disabled={ocupado}
              /* ⚠️ `amber-700` e 44px. Medido: branco sobre `amber-500` dá
                 **2,15:1** — menos da metade do mínimo — num alvo de 100×30. É
                 o botão que FORMA a dupla, e ele estava pior que o "Convidar"
                 ao lado, cujo comentário explica que 3,69:1 foi corrigido para
                 5,06. O 700 dá 5,02:1 e continua âmbar. */
              className="press min-h-11 rounded-full bg-amber-700 px-4 text-xs font-bold text-white"
            >
              Aceitar 🔥
            </button>
            <button
              onClick={() => chamar("recusar", dupla.amigaId!)}
              disabled={ocupado}
              className="min-h-11 rounded-full border border-border px-4 text-xs font-semibold text-muted-foreground"
            >
              Agora não
            </button>
          </div>
        </div>
      )}

      {/* ⚠️ ESTE BLOCO NÃO TINHA BOTÃO NENHUM, e isso era uma armadilha
          permanente: os chips de convidar só existem em `estado === "sem"`, e
          `desfazerDupla` só apagava dupla ACEITA. Quem convidasse uma amiga
          que nunca abre o app ficava sem dupla para sempre — sem poder
          cancelar e sem poder convidar outra pessoa. */}
      {estado === "convite-enviado" && dupla && (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-white/70 p-3 dark:bg-white/5">
          <p className="min-w-0 text-sm text-muted-foreground">
            Convite enviado para <strong>{dupla.nome}</strong>. Esperando ela aceitar.
          </p>
          <button
            onClick={() => chamar("desfazer")}
            disabled={ocupado}
            className="min-h-11 shrink-0 rounded-full border border-border px-3 text-[11px] font-semibold text-muted-foreground"
          >
            Cancelar
          </button>
        </div>
      )}

      {estado === "sem" &&
        (amigas.length === 0 ? (
          <p className="mt-4 text-[13px] text-muted-foreground">
            Quando uma amiga entrar pelo seu convite, ela aparece aqui para formar dupla.
          </p>
        ) : (
          <div className="mt-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Chamar para a dupla
            </p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {amigas.slice(0, 8).map((a) => (
                <li key={a.id}>
                  <button
                    onClick={() => chamar("convidar", a.id)}
                    disabled={ocupado}
                    className="press rounded-full border border-amber-300 px-3 py-1.5 text-xs font-semibold text-amber-800 disabled:opacity-50 dark:text-amber-200"
                  >
                    {a.nome}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
    </div>
  );
}

/* ══════════════════════════ O PERFIL + O CANTINHO ══════════════════════════ */

type Cantinho = {
  possui: string[];
  fundo: string | null;
  skin: string | null;
  postos: EnfeitePosto[];
};

function PerfilDaAmigaTela({
  amigaId,
  aoVoltar,
  assinante,
  restanteDoBolso,
  aoSairDaAmizade,
  bancada,
}: {
  amigaId: string;
  aoVoltar: () => void;
  assinante: boolean;
  /** Quanto sobra no bolso do Premium dela neste mês — o TETO da escolha.
      Vem da aba, que já o carregou: pedi-lo de novo aqui seria uma segunda ida
      ao servidor para a mesma pergunta, e as duas respostas poderiam discordar. */
  restanteDoBolso: number;
  /** ⚠️ Veio da LINHA da lista para cá — ver o comentário lá. `null` quando a
      amiga não está na lista carregada (perfil aberto por deep-link, por
      exemplo): sem ela em mãos não há o que confirmar na folha. */
  aoSairDaAmizade?: (() => void) | null;
  /**
   * ⚠️ O QUE A BANCADA INJETA — e por que ele precisou existir.
   *
   * Esta tela pede perfil e Cantinho ao servidor, então sem sessão ela mostra
   * "Não foi possível abrir este perfil.": a bancada NUNCA conseguiu chegar
   * aqui. Isso passou despercebido enquanto ela só mostrava dados; no dia em
   * que o "Sair da amizade" mudou da linha da lista para cá, mudou-se um
   * controle para uma tela que ninguém consegue olhar sem duas contas reais e
   * um convite aceito — que é exatamente o defeito que as bancadas existem
   * para não deixar acontecer.
   *
   * Continua fabricando só o DADO: perfil e Cantinho entram pelos mesmos
   * `useState` da produção, e daí para baixo é o componente de verdade.
   */
  bancada?: { perfil: PerfilDeAmiga; cantinho: Cantinho } | null;
}) {
  const [perfil, setPerfil] = useState<PerfilDeAmiga | null>(null);
  const [cantinho, setCantinho] = useState<Cantinho | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [presenteando, setPresenteando] = useState(false);
  const [presenteado, setPresenteado] = useState(false);
  /** A folha de "quanto dar" — a MESMA da lista, para as duas portas do
      presente não divergirem no primeiro ajuste de degraus. */
  const [escolhendo, setEscolhendo] = useState(false);

  useEffect(() => {
    /* A bancada já entrega tudo pronto — pedir ao servidor daria o erro de
       sessão por cima do estado que ela acabou de injetar. */
    if (bancada) {
      setPerfil(bancada.perfil);
      setCantinho(bancada.cantinho);
      return;
    }
    (async () => {
      try {
        const { data: s } = await supabase.auth.getSession();
        if (!s.session?.access_token) {
          /* Sem sessão o esqueleto giraria para sempre. Um erro nomeado é a
             diferença entre "está carregando" e "não vai carregar". */
          setErro("Não foi possível abrir este perfil.");
          return;
        }
        const { perfilDaAmiga } = await import("@/lib/amigas.functions");
        const r = await perfilDaAmiga({
          data: { accessToken: s.session.access_token, amigaId },
        });
        if (r.ok) {
          setPerfil(r.perfil);
          setCantinho(r.cantinho as Cantinho);
        } else {
          /* "indisponivel" nunca diz o motivo — dizer contaria a perda dela. */
          setErro(
            r.error === "indisponivel"
              ? "O Cantinho dela não está aberto para visitas agora."
              : "Não foi possível abrir este perfil.",
          );
        }
      } catch {
        setErro("Não foi possível abrir este perfil.");
      }
    })();
  }, [amigaId, bancada]);

  async function presentear(quanto: number) {
    setPresenteando(true);
    try {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session?.access_token) return;
      const { presentearAmiga } = await import("@/lib/mesada-paciente.functions");
      const r = await presentearAmiga({
        data: { accessToken: s.session.access_token, amigaId, quantidade: quanto },
      });
      if (r.ok) {
        setPresenteado(true);
        setEscolhendo(false);
        toast.success(`${quanto} Sementinhas para ${perfil?.nome ?? "ela"} 🌱`);
        return;
      }
      /* Cada recusa com frase própria: "não foi possível" faz tentar de novo
         contra uma parede que não vai ceder. */
      toast(
        r.error === "sem_premium"
          ? "O bolso de presentear é do Premium."
          : r.error === "mesada_esgotada"
            ? "Seu bolso deste mês acabou. Ele volta na virada."
            : r.error === "ja_presenteada"
              ? `${perfil?.nome ?? "Ela"} já ganhou um presente seu neste mês.`
              : r.error === "modo_cuidado"
                ? "Não é possível agora."
                : r.error === "nao_indicada"
                  ? "Vocês precisam estar conectadas pelo convite."
                  : "Não foi possível enviar.",
        { duration: 6000 },
      );
    } catch {
      toast("Não foi possível enviar.");
    } finally {
      setPresenteando(false);
    }
  }

  const voltar = (
    <button
      onClick={aoVoltar}
      className="press mb-3 rounded-full border border-border px-3 py-1.5 text-xs font-semibold"
    >
      ← Amigas
    </button>
  );

  if (erro) {
    return (
      <div>
        {voltar}
        <div className="rounded-3xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {erro}
        </div>
      </div>
    );
  }
  /* ⚠️ O ESQUELETO CARREGA O «← Amigas». Sem ele, um soluço de sessão prendia
     a paciente num retângulo cinza sem saída: o `return` sem sessão (acima) não
     seta `perfil` nem `erro`, e este ramo devolvia só a caixa vazia — a seta de
     voltar ficava de fora. A espera pode durar; a saída não pode sumir. */
  if (!perfil || !cantinho)
    return (
      <div>
        {voltar}
        <div className="skeleton h-72 rounded-3xl" />
      </div>
    );

  const fundo = fundoBgFor(cantinho.fundo) ?? "linear-gradient(180deg,#fff5f4,#ffdfd8)";
  /* A pele das bolinhas que ela equipou. Entra como uma bolinha ao lado do
     mascote, e não vestindo a Bolha: a Bolha é a personagem do app, igual para
     todo mundo, e trocar a pele DELA confundiria as duas coisas. */
  const pele = cantinho.skin ? TRILHA_SKINS[cantinho.skin] : null;

  return (
    <div>
      {voltar}

      {/* ── O CANTINHO DELA ──────────────────────────────────────────────
          O cenário que ela comprou e arrumou, com os enfeites nas posições
          que ela escolheu. É a peça que transforma a economia de Sementinhas
          em vitrine: comprar enfeite passa a ter público. */}
      <div
        className="relative h-52 overflow-hidden rounded-3xl border border-border"
        style={{ background: fundo }}
      >
        {cantinho.postos.map((e, i) => {
          const item = CANTINHO_BY_ID[e.id];
          if (!item) return null;
          return (
            <span
              key={`${e.id}-${i}`}
              aria-hidden
              className="dc-flutua absolute select-none leading-none"
              style={{
                left: `${e.x}%`,
                /* `y` dela é px ao longo de uma trilha longa; aqui vira % de
                   uma faixa curta. Sem a dobra, tudo cairia fora da moldura. */
                top: `${(e.y % 900) / 9}%`,
                fontSize: `${Math.round(22 * e.s)}px`,
                animationDelay: `${i * 0.7}s`,
              }}
            >
              {item.emoji}
            </span>
          );
        })}
        {cantinho.postos.length === 0 && (
          <span className="absolute inset-0 flex items-center justify-center text-sm text-white/80">
            O Cantinho dela ainda está começando
          </span>
        )}
        <span className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-end gap-2">
          <Bolha tamanho={72} humor="feliz" />
          {pele && (
            <img
              src={pele.arte.feito}
              alt=""
              title={`bolinha ${pele.nome}`}
              className="mb-2 h-7 w-7 object-contain drop-shadow-sm"
            />
          )}
        </span>
      </div>

      {/* ── QUEM ELA É — e o que NÃO está aqui ───────────────────────────
          Sem semana, sem DPP, sem medida. É o que permite esta tela existir
          quando uma gestação termina mal. */}
      <div className="mt-4 rounded-3xl border border-border bg-card p-5 text-center">
        <p className="font-serif text-2xl">{perfil.nome}</p>
        {perfil.bebe && (
          <p className="mt-0.5 text-sm text-muted-foreground">esperando {perfil.bebe} 💜</p>
        )}
        <p className="mt-1 text-xs text-muted-foreground">{tempoNoApp(perfil.diasNoApp)}</p>

        <div className="mt-4 flex items-center justify-center gap-6">
          <span className="flex items-center gap-1.5">
            <ChamaDaSequencia acesa={perfil.sequencia > 0} tamanho={26} />
            <span className="text-lg font-extrabold text-amber-500">{perfil.sequencia}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <TrofeuIcone />
            <span className="text-lg font-extrabold text-violet-500">{perfil.trofeus}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="text-xl leading-none">🪴</span>
            <span className="text-lg font-extrabold text-emerald-500">{perfil.itens}</span>
          </span>
        </div>

        {/* ⚠️ A SEGUNDA PORTA DO PRESENTE, e ela tinha de obedecer às MESMAS
            três condições da linha da lista. Não obedecia a nenhuma: quem não
            assina via este botão verde de largura inteira e levava "o bolso de
            presentear é do Premium" do servidor; quem chegou pelo convite de
            alguém via o botão na pessoa que a trouxe, que ela nunca pode
            presentear; e quem já tinha presenteado neste mês via "Presentear"
            de novo. Uma auditoria achou os três, e o teste que dizia cobrir o
            primeiro provava só a linha da lista. */}
        {assinante && perfil.possoPresentear && (
          <>
            <button
              onClick={() => setEscolhendo(true)}
              disabled={presenteando || presenteado || perfil.jaPresenteada}
              className="press mt-5 w-full rounded-full bg-emerald-700 py-3 text-sm font-bold text-white disabled:opacity-50"
            >
              {presenteado || perfil.jaPresenteada
                ? "Enviado ✓"
                : presenteando
                  ? "Enviando…"
                  : `Presentear ${PRESENTE_ENTRE_AMIGAS} 🌱`}
            </button>
            <p className="mt-2 text-[11px] text-muted-foreground">
              {presenteado || perfil.jaPresenteada
                ? "Ela já ganhou um presente seu neste mês. O bolso volta na virada."
                : "Ela recebe um aviso com o seu nome ao abrir o Caminho."}
            </p>
          </>
        )}
      </div>

      {/* ─── SAIR DA AMIZADE ────────────────────────────────────────────────
          Veio do ⋯ da linha da lista, que estava espremendo o nome da amiga
          (ver lá). Aqui ele cabe por extenso e no contexto certo: quem lê esta
          tela está olhando para uma pessoa, e é sobre essa pessoa que a decisão
          é.

          ⚠️ FORA do cartão branco e no PÉ da tela, cinza e sem emoji: é uma
          saída, não uma ação que o app sugere. Quem procura acha; quem está
          passeando pelo Cantinho dela não tropeça. */}
      <FolhaDePresente
        amiga={escolhendo ? { id: amigaId, nome: perfil.nome } : null}
        restante={restanteDoBolso}
        enviando={presenteando}
        aoFechar={() => setEscolhendo(false)}
        aoEnviar={(quanto) => presentear(quanto)}
      />

      {aoSairDaAmizade && (
        <button
          onClick={aoSairDaAmizade}
          className="press mt-5 min-h-11 w-full rounded-full border border-border text-[13px] font-semibold text-muted-foreground"
        >
          Sair da amizade com {perfil.nome}
        </button>
      )}
    </div>
  );
}
