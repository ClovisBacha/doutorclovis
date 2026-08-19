/**
 * BANCADA DAS DUAS TELAS NO MODELO INSTAGRAM.
 *
 * ⚠️ Sem ela, conferir a grade de nove fotos, o anel de story aceso e apagado,
 * e o rótulo "Sugerido para você" exigiria três contas reais, uma seguindo a
 * outra, com dez publicações. É assim que uma tela passa meses sem ninguém
 * nunca ter olhado para ela.
 *
 * Endereços:
 *   /preview-instagram              → a tela principal (feed)
 *   /preview-instagram?tela=perfil  → o perfil de outra pessoa
 *   /preview-instagram?tela=perfil&meu=1 → o PRÓPRIO perfil (com os números)
 *   /preview-instagram?vazio=1      → quem chegou agora
 *   /preview-instagram?tela=editar  → editar perfil (foto, nome, bio)
 *   /preview-instagram?tela=lista   → a lista de seguidores
 *   /preview-instagram?tela=post    → um post sozinho, o que a grade abre
 *   /preview-instagram?tela=story   → o visor de story em tela cheia
 *   /preview-instagram?tela=story&meu=1 → o MEU story (visto por + lixeira)
 *   /preview-instagram?tela=atividade → a aba do coração
 *   /preview-instagram?tela=novo    → a nova publicação (o que o ＋ abre)
 *   /preview-instagram?tela=salvos  → a coleção privada
 *   /preview-instagram?tela=busca   → a busca de perfis
 *   /preview-instagram?tela=espelho → "ver como os outros veem" (o espelho)
 *   /preview-instagram?tela=conferir → a conferência do story, com a moldura
 *   /preview-instagram?tela=conferir&selo=0 → sem semana para carimbar
 *   /preview-instagram?tela=story&carimbo=1 → o visor com a moldura
 *   /preview-instagram?tela=espelho&trancado=1 → o estado da MAIORIA: perfil fechado
 *   /preview-instagram?tela=perfil&meu=1&selo=0 → o perfil sem os selos
 *   /preview-instagram?vazio=1      → conta NOVA: a fileira de pessoas é tudo
 *   /preview-instagram?sugeridas=0  → o feed sem a zona de sugestões
 *   /preview-instagram?desafio=fora → o convite do desafio (ainda não entrou)
 *   /preview-instagram?desafio=meio → dentro, 1 de 3 dias
 *   /preview-instagram?desafio=fim  → fechou, com o contador do grupo
 *
 * ⚠️ A zona de sugestões ("Você está em dia" + pessoas + publicações) só abre
 * quando o feed de quem ela segue ACABOU — aqui, depois de rolar até o fim.
 */
import { useMemo, useState } from "react";
import type { Persona } from "@/lib/selo-do-perfil";
import { createFileRoute } from "@tanstack/react-router";
import {
  ConferirStory,
  EditarPerfil,
  EspelhoDoPerfil,
  ListaDeGente,
  NovoPost,
  TelaDeBusca,
  TelaDosSalvos,
  TelaDePerfil,
  TelaDoPost,
  TelaDeAtividade,
  TelaDaCaixinha,
  TelaPrincipal,
  VisorDeStory,
  FolhaDeQuemReagiu,
  type PerguntaNaTela,
  type PessoaNaLista,
  type Story,
} from "@/components/rede-instagram";
import type {
  AtividadeNaTela,
  BolhaDeStory,
  PerfilNaTela,
  PostNaTela,
} from "@/lib/rede-social.functions";
import type { TipoDeReacao } from "@/lib/rede-social";

export const Route = createFileRoute("/preview-instagram")({
  component: Bancada,
  validateSearch: (q: Record<string, unknown>) => ({
    /* ⚠️ `== null` e NÃO `=== undefined`: o router serializa e revalida, e na
       segunda passada chega `null`. Mesma armadilha de `preview-saude`. */
    tela: q.tela == null ? "feed" : String(q.tela),
    meu: q.meu == null ? false : !!q.meu,
    vazio: q.vazio == null ? false : !!q.vazio,
    /* ⚠️ `== null` e não `=== undefined`: na revalidação chega `null`, e
       `Number(null)` é 0. Mesma armadilha de `preview-saude`. */
    sugeridas: q.sugeridas == null ? 1 : Number(q.sugeridas),
    /* ⚠️ `== null` e NÃO `=== undefined` — mesma armadilha de sempre. */
    legendas: q.legendas == null ? 1 : Number(q.legendas),
    amigas: q.amigas == null ? 1 : Number(q.amigas),
    rascunho: q.rascunho == null ? 1 : Number(q.rascunho),
    retro: q.retro == null ? "" : String(q.retro),
    /* ⚠️ `== null` e nunca `=== undefined`. Mesma armadilha de sempre. */
    selo: q.selo == null ? 1 : Number(q.selo),
    trancado: q.trancado == null ? false : !!q.trancado,
    carimbo: q.carimbo == null ? false : !!q.carimbo,
    desafio: q.desafio == null ? "" : String(q.desafio),
    /* ⚠️ `== null` e nunca `=== undefined` — a mesma armadilha de sempre. O
       padrão é ABERTA: o estado que a tela existe para mostrar é o botão,
       não a ausência dele. `?caixinha=0` fecha. */
    caixinha: q.caixinha == null ? 1 : Number(q.caixinha),
    /* Quantas perguntas a caixa da dona tem, em `?tela=caixinha`. */
    perguntas: q.perguntas == null ? 3 : Number(q.perguntas),
    /* ⚠️ `== null`, nunca `=== undefined` — a armadilha de sempre. */
    remover: q.remover == null ? 1 : Number(q.remover),
  }),
});

/* Datas cravadas, nunca `Date.now()`: bancada que muda de texto conforme a
   hora é bancada que não dá para comparar entre duas visitas. */
const AGORA = new Date("2026-08-18T12:00:00Z").getTime();
const atras = (min: number) => new Date(AGORA - min * 60000).toISOString();

/** Uma foto de mentira, para a grade e para o post terem o que desenhar. */
function foto(a: string, b: string, emoji: string): string {
  return (
    "data:image/svg+xml;utf8," +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800">` +
        `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
        `<stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/>` +
        `</linearGradient></defs>` +
        `<rect width="600" height="800" fill="url(#g)"/>` +
        `<text x="300" y="440" font-size="120" text-anchor="middle">${emoji}</text></svg>`,
    )
  );
}

const CORES: [string, string, string][] = [
  ["#f7d9e3", "#cfe3f0", "🍼"],
  ["#e8f0d9", "#f7e9cf", "🌿"],
  ["#f0dcf7", "#d9e6f7", "🎀"],
  ["#f7e3d9", "#f0d9e8", "🧸"],
  ["#d9f0ea", "#e6e0f7", "🌸"],
  ["#f7f0d9", "#dcf0e3", "☁️"],
  ["#e3d9f7", "#f7d9dc", "💛"],
  ["#d9e3f7", "#f0f7d9", "🐣"],
  ["#f7d9f0", "#d9f7e6", "🌙"],
];

const POSTS: PostNaTela[] = CORES.map((c, i) => ({
  id: `p${i}`,
  autorId: i === 3 ? "eu" : i % 2 === 0 ? "marina" : "carol",
  autorNome: i === 3 ? "Você" : i % 2 === 0 ? "Marina Costa" : "Carol",
  autorAvatar: null,
  /* O post 5 é SÓ TEXTO: é ele que prova que a célula da grade mostra o texto
     em vez de um buraco cinza. */
  texto:
    i === 5
      ? "Hoje ela mexeu tanto que acordei rindo 🥹"
      : i === 0
        ? "Ultrassom de hoje — a mãozinha no rosto bem na hora da foto"
        : null,
  imagemUrl: i === 5 ? null : foto(c[0], c[1], c[2]),
  /* O post 2 é um CARROSSEL de três: é ele que prova os pontinhos e o
     deslizar. Com um só, não haveria o que conferir. */
  imagens:
    i === 5
      ? []
      : i === 2
        ? [
            foto(c[0], c[1], c[2]),
            foto(CORES[6][0], CORES[6][1], CORES[6][2]),
            foto(CORES[8][0], CORES[8][1], CORES[8][2]),
          ]
        : [foto(c[0], c[1], c[2])],
  visibilidade: i === 3 ? "amigas" : "publico",
  criadoEm: atras(30 + i * 240),
  reacoes: i === 0 ? { amei: 24, emocionei: 11, torcendo: 6 } : i % 3 === 0 ? { abraco: 4 } : {},
  minhaReacao: i === 0 ? "emocionei" : null,
  souAAutora: i === 3,
  /* O post 0 tem DUAS marcadas (mostra "com Marina e Carol"), e o 4 tem quatro
     (mostra a contagem). O 3 é MEU e me tem marcada — é ele que acende o
     "tirar minha marcação", que de outro jeito seria impossível de fotografar. */
  marcadas:
    i === 0
      ? [
          { id: "marina", nome: "Marina Costa" },
          { id: "carol", nome: "Carol" },
        ]
      : i === 4
        ? [
            { id: "a", nome: "Ana Paula" },
            { id: "b", nome: "Bruna" },
            { id: "c", nome: "Tia Zezé" },
            { id: "d", nome: "Marina Costa" },
          ]
        : i === 3
          ? [{ id: "eu", nome: "Você" }]
          : [],
  souMarcada: i === 3,
  /* O post 1 nasce GUARDADO: é ele que prova o marcador aceso ao lado do
     apagado dos outros. Com todos apagados não haveria contraste. */
  salvo: i === 1,
  /* ⚠️ O post 1 leva ENQUETE e o 6 leva AULA — separados de propósito: juntos,
     não daria para ver que cada um desenha sozinho, e é exatamente aí que a
     margem de um encosta no outro. O 1 já tem voto meu, o 7 ainda não: são os
     dois estados da enquete (antes e depois de votar).

     ⚠️ E o 1 está na primeira fatia (`slice(0, 4)`) de propósito: com a
     enquete votada no post 4, ela caía fora do feed da bancada e ninguém via o
     estado com resultado — a bancada mostrava só metade do recurso. */
  enquete:
    i === 1
      ? { opcoes: ["Menino", "Menina"], votos: [12, 9], meuVoto: 0 }
      : i === 7
        ? { opcoes: ["Sim", "Não", "Ainda não sei"], votos: [0, 0, 0], meuVoto: null }
        : null,
  aula: i === 6 ? { tema: "nutrição" as const } : null,
  /* ⚠️ O post 8 é a RESPOSTA de uma pergunta anônima — a única forma de
     fotografar o cabeçalho citado sem duas contas e uma caixinha aberta. */
  pergunta: i === 8 ? "Como você escolheu o nome da Helena? 💛" : null,
}));

/* A fileira de stories: os dois primeiros ACESOS, o resto apagado — é o
   contraste que prova que o anel muda de estado. */
const STORIES: Story[] = [
  { id: "s0", nome: "Seu story", avatarUrl: null, novo: false },
  { id: "s1", nome: "Marina", avatarUrl: null, novo: true },
  { id: "s2", nome: "Carol", avatarUrl: null, novo: true },
  { id: "s3", nome: "Ana Paula", avatarUrl: null, novo: false },
  { id: "s4", nome: "Tia Zezé", avatarUrl: null, novo: false },
  { id: "s5", nome: "Bruna", avatarUrl: null, novo: false },
];

/** Fabrica mais uma página, com ids próprios — a bancada da rolagem infinita. */
function maisUmaPagina(quantos: number, pagina: number): PostNaTela[] {
  return POSTS.slice(0, quantos).map((p) => ({ ...p, id: `${p.id}-pg${pagina}` }));
}

function Bancada() {
  const {
    tela,
    meu,
    vazio,
    sugeridas,
    legendas,
    amigas,
    rascunho,
    retro,
    selo,
    trancado,
    carimbo,
    desafio,
    caixinha,
    perguntas,
    remover,
  } = Route.useSearch();

  /* O desafio da semana. Sem a bancada, conferir o cartão exigiria uma criadora
     de verdade propondo um desafio e uma paciente com o código dela. */
  const oDesafio =
    desafio === ""
      ? null
      : {
          id: "d1",
          atividade: "meditation" as const,
          inicio: "2026-08-17",
          fim: "2026-08-23",
          diasAlvo: 3,
          deQuem: "Marina",
          souParticipante: desafio !== "fora",
          meusDias: desafio === "fim" ? 3 : desafio === "meio" ? 1 : 0,
          /* ⚠️ `null` abaixo de duas pessoas — é o estado que prova que a tela
             não fala do grupo quando o grupo é ela sozinha. */
          quantasFecharam: desafio === "fim" ? 7 : null,
        };
  const [persona, setPersona] = useState<Persona>("estranha");

  const perfil: PerfilNaTela = {
    id: meu ? "eu" : "marina",
    nome: meu ? "Marina Costa" : "Carol Andrade",
    /* ⚠️ A bio NÃO diz a semana, e isso não é detalhe da bancada: enquanto ela
       dizia "· 32 semanas", desligar o selo continuava mostrando a semana na
       tela e a bancada aprovava um recurso quebrado. Quem escreve a semana à
       mão na bio é a paciente de hoje — o selo existe justamente para ela parar
       de precisar. */
    bio: meu ? "Grávida da Helena 🎀 · Belo Horizonte" : "Mãe do Bento 🧸 · pós-parto",
    avatarUrl: null,
    publico: true,
    meuVinculo: meu ? null : "ativo",
    souEu: meu,
    meusSeguidores: meu ? 137 : null,
    euSigo: meu ? 64 : null,
    /* ⚠️ Os dois selos são independentes: `?selo=0` desliga os dois, `?selo=1`
       liga os dois, e `?selo=2` liga SÓ o do bebê — que é o caso que prova que
       uma chave sozinha não desenha a vírgula solta da outra. */
    /* ⚠️ A Carol é PÓS-PARTO na bio ("Mãe do Bento 🧸"), e `semanaPublica`
       recusa exatamente esse par: depois do parto a semana para. Sem este
       recorte a bancada desenhava um estado que o servidor nunca devolve — a
       terceira vez que ela mente nesta tela, e sempre do mesmo jeito. */
    seloSemana: selo === 1 && meu ? "32 semanas" : null,
    seloBebe: (selo === 1 || selo === 2) && meu ? "Helena" : "Bento",
    /* A pílula do código: só no perfil de OUTRA pessoa (`?meu=1` some). */
    codigoDeEmbaixadora: meu ? null : "MARINA10",
    possoAplicarOCodigo: !meu,
    mostrarSemana: selo === 1,
    mostrarBebe: selo === 1 || selo === 2,
    /* ⚠️ Ligada por padrão, e só no perfil de OUTRA pessoa a caixinha desenha
       — no meu, o que existe é a caixa cheia, que é tela própria. `?caixinha=0`
       fecha, que é o estado em que o botão some. */
    aceitaPerguntas: caixinha !== 0,
    /* A aba "Do bebê" segue a MESMA chave da semana — é o mesmo fato. */
    bebe:
      selo === 1
        ? {
            emoji: "🍆",
            fruta: "Berinjela",
            tamanho: "42,4 cm",
            peso: "1,7 kg",
            sobre: "Já reconhece a sua voz.",
          }
        : null,
  };

  const semSugestoes = sugeridas === 0;
  const semLegendas = legendas === 0;
  const semAmigasParaMarcar = amigas === 0;
  const comRascunho = rascunho !== 0;
  const [vendoQuemReagiu, setVendoQuemReagiu] = useState(false);
  const retroModo = retro;
  /* Qual reação a bancada guarda para cada post. `undefined` = a do fixture. */
  const [reacoes, setReacoes] = useState<Record<string, TipoDeReacao | null>>({});
  /* ⚠️ `useCallback` com lista VAZIA, e não um fecho na prop.
     A produção passa referências FIXAS (`acoes`, em `RedeNoApp`), porque o
     cartão é `memo`. Uma bancada que passasse fecho novo a cada pintura mediria
     um app que não existe — e foi exatamente o que aconteceu na primeira
     medição desta mudança: o `memo` errava em todos os cartões e o número não
     se mexia. `setReacoes` com função dispensa o valor anterior no fecho. */
  const acoesDaBancada = useMemo(
    () => ({
      reagir: (post: PostNaTela, tipo: TipoDeReacao | null) =>
        setReacoes((m) => ({ ...m, [post.id]: tipo })),
      abrirPerfil: (id: string) => alert(`abriria o perfil de ${id}`),
      salvar: (_p: PostNaTela, v: boolean) => alert(v ? "guardaria" : "tiraria dos salvos"),
      votar: (_p: PostNaTela, i: number) => alert(`votaria na opção ${i}`),
      apagar: (_p: PostNaTela) => alert("apagaria"),
      denunciar: (p: PostNaTela) => alert(`denunciaria o post ${p.id}`),
      tirarMarcacao: (p: PostNaTela) => alert(`tiraria minha marcação do post ${p.id}`),
      /* ⚠️ A folha abre com DADO fabricado: quem reagiu só existe numa conta com
         reações de verdade, e é justamente a folha que precisa ser olhada. */
      verQuemReagiu: () => setVendoQuemReagiu(true),
    }),
    [],
  );
  const comReacoes = (ps: PostNaTela[]) =>
    ps.map((p) => {
      if (!(p.id in reacoes)) return p;
      const nova = reacoes[p.id];
      const c = { ...p.reacoes };
      if (p.minhaReacao) c[p.minhaReacao] = Math.max(0, (c[p.minhaReacao] ?? 1) - 1);
      if (nova) c[nova] = (c[nova] ?? 0) + 1;
      return { ...p, reacoes: c, minhaReacao: nova };
    });

  const [extras, setExtras] = useState<PostNaTela[]>([]);
  const [paginas, setPaginas] = useState(0);

  const GENTE: PessoaNaLista[] = [
    {
      id: "g1",
      nome: "Ana Paula Ribeiro",
      bio: "Mãe do Théo 💙",
      avatarUrl: null,
      sigo: "ativo",
      souEu: false,
    },
    { id: "g2", nome: "Tia Zezé", bio: null, avatarUrl: null, sigo: null, souEu: false },
    { id: "g3", nome: "Bruna", bio: "34 semanas 🤍", avatarUrl: null, sigo: "ativo", souEu: false },
  ];

  if (tela === "editar") {
    return (
      <div className="mx-auto max-w-md py-2">
        <EditarPerfil perfil={perfil} aoSalvar={async () => true} aoFechar={() => history.back()} />
      </div>
    );
  }

  if (tela === "lista") {
    return (
      <div className="mx-auto max-w-md py-2">
        <ListaDeGente
          /* ⚠️ `?remover=0` tira o ⋯ — é o estado da lista "Seguindo", onde
             quem sai é ela e o botão não existe. */
          aoRemover={remover === 0 ? undefined : (id) => alert(`removeria ${id}`)}
          titulo="Seguidores"
          gente={vazio ? [] : GENTE}
          aoVoltar={() => history.back()}
          aoAbrirPerfil={(id) => alert(`abriria ${id}`)}
        />
      </div>
    );
  }

  if (tela === "atividade") {
    /* As quatro espécies, e as duas primeiras NÃO VISTAS — é o contraste que
       prova o fundo destacado da linha nova contra a já lida. */
    const itens: AtividadeNaTela[] = [
      {
        id: "a1",
        especie: "reagiu",
        quemId: "q1",
        quemNome: "Carol",
        quemAvatar: null,
        postId: "p0",
        postCapa: foto(CORES[0][0], CORES[0][1], CORES[0][2]),
        criadoEm: atras(12),
        visto: false,
        pendente: false,
      },
      {
        id: "a2",
        especie: "pediu_para_seguir",
        quemId: "q2",
        quemNome: "Ana Paula",
        quemAvatar: null,
        postId: null,
        postCapa: null,
        criadoEm: atras(90),
        visto: false,
        /* ⚠️ O pedido AINDA DE PÉ é o único que ganha os dois botões — é ele
           que prova a linha de aceitar/recusar. Os outros três provam o
           contrário: pedido já respondido não mostra botão nenhum. */
        pendente: true,
      },
      {
        id: "a3",
        especie: "seguiu",
        quemId: "q3",
        quemNome: "Tia Zezé",
        quemAvatar: null,
        postId: null,
        postCapa: null,
        criadoEm: atras(600),
        visto: true,
        pendente: false,
      },
      {
        id: "a4",
        especie: "aceitou",
        quemId: "q4",
        quemNome: "Bruna",
        quemAvatar: null,
        postId: null,
        postCapa: null,
        criadoEm: atras(2000),
        visto: true,
        pendente: false,
      },
    ];
    return (
      <div className="mx-auto max-w-md py-2">
        <TelaDeAtividade
          itens={vazio ? [] : itens}
          aoVoltar={() => history.back()}
          aoResponder={(id, aceitar) => alert(`${aceitar ? "aceitaria" : "recusaria"} ${id}`)}
        />
      </div>
    );
  }

  if (tela === "story") {
    /* Três stories do mesmo autor: é o que prova as TRÊS barrinhas no topo,
       a animação só na atual, e o avanço ao tocar na metade direita. Com um
       só, a barra ocuparia a largura inteira e não haveria o que conferir. */
    const b: BolhaDeStory = {
      autorId: "marina",
      autorNome: "Marina Costa",
      autorAvatar: null,
      novo: true,
      stories: CORES.slice(0, 3).map((c, n) => ({
        id: `st${n}`,
        autorId: "marina",
        autorNome: "Marina Costa",
        autorAvatar: null,
        imagemUrl: foto(c[0], c[1], c[2]),
        texto: n === 1 ? "31 semanas hoje 🤍" : null,
        criadoEm: atras(60 * (n + 1)),
        visto: false,
        /* Só o primeiro carimbado: é o contraste que prova que o carimbo é
           por STORY, e não uma propriedade da conta. */
        carimbo: carimbo && n === 0 ? "32 semanas" : null,
      })),
    };
    return (
      <VisorDeStory
        bolha={b}
        aoFechar={() => history.back()}
        /* ⚠️ O rodapé do "visto por" só existe no MEU story, e sem a bancada
           conferir isso exigiria publicar um story numa conta de verdade e
           conseguir que outra pessoa o visse dentro das 24 h. */
        souEu={meu}
        aoQuemViu={async () => GENTE}
        aoApagarStory={() => alert("apagaria o story")}
      />
    );
  }

  if (tela === "post") {
    return (
      <div className="mx-auto max-w-md py-2">
        <TelaDoPost
          post={POSTS[0]}
          aoReagir={() => {}}
          aoSalvar={(v) => alert(v ? "guardaria" : "tiraria dos salvos")}
          aoVoltar={() => history.back()}
        />
      </div>
    );
  }

  if (tela === "conferir") {
    return (
      <ConferirStory
        imagem={foto(CORES[4][0], CORES[4][1], CORES[4][2])}
        /* `?selo=0` mostra o caso sem DUM/pós-parto/luto, em que não há o que
           carimbar e o controle não existe. */
        semana={selo === 0 ? null : "32 semanas"}
        aoCancelar={() => history.back()}
        aoPublicar={({ carimbar }) => alert(carimbar ? "publicaria COM carimbo" : "publicaria sem")}
      />
    );
  }

  if (tela === "espelho") {
    return (
      <div className="mx-auto max-w-md py-2">
        <EspelhoDoPerfil
          persona={persona}
          aoTrocarPersona={setPersona}
          /* A bancada troca a persona LOCALMENTE; no app quem responde é o
             servidor, com `verPerfil({comoVisitante})`. O que se confere aqui é
             o desenho: a fita das três, o estado trancado e a tela inerte. */
          /* ⚠️ O espelho é sempre o MEU perfil, por definição — e o vínculo sai
             da persona, como o servidor faz (`null` para a estranha, "ativo"
             para as outras duas). A bancada desenhava outra pessoa, um
             pós-parto com selo de 32 semanas (o par exato que `semanaPublica`
             recusa) e "Seguir" nas três personas. É a mesma classe de defeito
             que a bio chumbada tinha: a bancada aprovando o que o servidor não
             produz. */
          perfil={{
            ...perfil,
            /* O espelho é sempre o MEU perfil, então o nome é o meu. */
            id: "eu",
            nome: "Marina Costa",
            souEu: false,
            meusSeguidores: null,
            meuVinculo: persona === "estranha" ? null : "ativo",
          }}
          posts={persona === "estranha" ? POSTS.slice(0, 2) : POSTS.slice(0, 5)}
          trancado={trancado && persona === "estranha"}
          carregando={false}
          aoVoltar={() => history.back()}
        />
      </div>
    );
  }

  if (tela === "novo") {
    return (
      <div className="mx-auto max-w-md py-2">
        <NovoPost
          /* A aula de hoje, para o anexo aparecer na bancada. */
          aulaDeHoje={{ tema: "nutrição" }}
          /* ⚠️ A BANCADA NÃO CHAMA A IA — ela fabrica a RESPOSTA. Chamar de
             verdade custaria crédito a cada abertura da bancada e exigiria
             sessão; e o que precisa ser conferido aqui é a TELA (o botão, a
             espera, as três opções, o estado vazio), não o modelo.
             `?legendas=0` mostra o caso em que nada volta — que é o estado
             mais fácil de esquecer de desenhar. */
          /* ⚠️ A bancada precisa de amigas para o seletor existir — e sem elas
             o botão nem aparece, que é o comportamento certo e também o
             impossível de fotografar. `?amigas=0` mostra a conta nova. */
          /* ⚠️ A BANCADA FABRICA O RASCUNHO. Sem isso a faixa "você tinha
             começado a escrever aqui" só apareceria depois de digitar, fechar e
             reabrir com sessão — e é justamente ela que precisa ser olhada.
             `?rascunho=0` mostra o compositor limpo, que é o caso comum. */
          rascunho={
            comRascunho
              ? {
                  texto: "Consulta de hoje foi boa demais, ainda estou sorrindo",
                  visibilidade: "amigas" as const,
                  enquete: null,
                  comAula: false,
                  marcadas: ["marina"],
                  em: new Date().toISOString(),
                }
              : null
          }
          aoMudarRascunho={() => {}}
          amigasParaMarcar={
            semAmigasParaMarcar
              ? []
              : [
                  { id: "marina", nome: "Marina Costa", avatar: null },
                  { id: "carol", nome: "Carol", avatar: null },
                  { id: "ana", nome: "Ana Paula", avatar: null },
                  { id: "bru", nome: "Bruna", avatar: null },
                  { id: "ze", nome: "Tia Zezé", avatar: null },
                  { id: "sof", nome: "Sofia", avatar: null },
                ]
          }
          aoSugerirLegenda={async () => {
            await new Promise((r) => setTimeout(r, 700));
            return semLegendas
              ? []
              : [
                  "Hoje ele resolveu dar cambalhota a tarde inteira.",
                  "Essa carinha aqui já é minha coisa favorita.",
                  "Mais um pedacinho da nossa história 💛",
                ];
          }}
          aoFechar={() => history.back()}
          aoPublicar={async (p) => {
            alert(
              `publicaria: ${p.fotos.length} foto(s), ${p.visibilidade}, ` +
                `enquete [${p.enquete.join(" | ")}], aula ${p.aula ? p.aula.tema : "—"}, ` +
                `marcadas [${p.marcadas.join(", ")}]\n${p.texto ?? ""}`,
            );
            return false; /* `false` mantém a tela aberta, para olhar de novo. */
          }}
        />
      </div>
    );
  }

  if (tela === "salvos") {
    return (
      <div className="mx-auto max-w-md py-2">
        <TelaDosSalvos
          posts={vazio ? [] : POSTS.slice(0, 5)}
          aoVoltar={() => history.back()}
          aoAbrirPost={(id) => alert(`abriria o post ${id}`)}
        />
      </div>
    );
  }

  if (tela === "caixinha") {
    /* ⚠️ A caixa da DONA. Ela é impossível de olhar numa conta de verdade sem
       uma segunda pessoa disposta a escrever — e é justamente por isso que uma
       tela dessas atravessa meses sem ninguém ver. `?perguntas=0` mostra o
       vazio, `?caixinha=0` mostra a caixa fechada. */
    const daCaixa: PerguntaNaTela[] = [
      {
        id: "q1",
        texto: "Como você escolheu o nome da Helena? 💛",
        criadoEm: atras(40),
        resposta: null,
        postId: null,
      },
      {
        id: "q2",
        texto: "Qual foi a parte mais difícil pra você até agora?",
        criadoEm: atras(60 * 5),
        resposta: null,
        postId: null,
      },
      {
        id: "q3",
        texto: "Vocês fizeram chá de bebê? Tô pensando em fazer",
        criadoEm: atras(60 * 26),
        resposta: "Fizemos sim! Foi pequenininho, só a família. Valeu muito a pena 🥹",
        postId: "p1",
      },
    ].slice(0, Math.max(0, perguntas));

    return (
      <div className="mx-auto max-w-md py-2">
        <TelaDaCaixinha
          perguntas={daCaixa}
          aceita={caixinha !== 0}
          aoVoltar={() => history.back()}
          aoAlternarCaixa={(v) => alert(v ? "abriria a caixa" : "fecharia a caixa")}
          /* ⚠️ A bancada devolve a RECUSA quando o texto pede conduta — é o
             único jeito de fotografar o recado do servidor sem escrever no
             banco, e é o estado que a tela existe para acertar. */
          aoResponder={async (_id, resposta) =>
            (await import("@/lib/pergunta-clinica")).triarTexto(resposta) === "publicavel"
              ? null
              : "Aqui a gente conta a própria experiência, sem dizer o que a outra deve fazer. Quem orienta é o médico dela."
          }
          aoArquivar={() => alert("tiraria da caixa")}
          aoDenunciar={(_id, b) => alert(b ? "denunciaria e bloquearia" : "denunciaria")}
          aoAbrirPost={(id) => alert(`abriria o post ${id}`)}
        />
      </div>
    );
  }

  if (tela === "busca") {
    return (
      <div className="mx-auto max-w-md py-2">
        <TelaDeBusca
          aoVoltar={() => history.back()}
          /* A busca de mentira responde a QUALQUER termo com três letras — o
             que a bancada existe para mostrar é a espera, o vazio explicado e
             a linha do resultado, não o `ilike` do servidor. */
          aoBuscar={async (termo) =>
            vazio ? [] : GENTE.slice(0, 3).map((g) => ({ ...g, nome: `${g.nome} (${termo})` }))
          }
          aoAbrirPerfil={(id) => alert(`abriria o perfil de ${id}`)}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md py-2">
      {tela === "perfil" ? (
        <TelaDePerfil
          perfil={perfil}
          posts={vazio ? [] : POSTS}
          aoVoltar={() => history.back()}
          aoSeguir={() => alert("seguir")}
          aoAbrirPost={(id) => alert(`abriria o post ${id}`)}
          aoAbrirLista={meu ? (t) => alert(`abriria ${t}`) : undefined}
          aoAbrirSalvos={meu ? () => alert("abriria os salvos") : undefined}
          aoAbrirEspelho={meu ? () => alert("abriria o espelho") : undefined}
          aoBloquear={meu ? undefined : () => alert("bloquearia")}
          /* ⚠️ Sem esta prop o botão "Usar este código" não desenha, e a
             bancada aprovaria a pílula sem o controle que é o ponto dela. */
          aoAplicarCodigo={(c) => alert(`aplicaria o código ${c}`)}
          /* ⚠️ A triagem é a MESMA função do servidor, e não um `alert`: o que
             a bancada precisa mostrar são os TRÊS desfechos, e inventá-los aqui
             faria a tela ensaiar um roteiro que a régua não produz. */
          /* ⚠️ `import()` DINÂMICO, e não estático: `pergunta-clinica.ts` tem
             `(?<!` nas fronteiras, e um import estático o traria para o chunk
             desta rota — que é como as regex clínicas foram parar no bundle da
             paciente e derrubaram o app em Safari antigo. */
          aoPerguntar={async (t) => (await import("@/lib/pergunta-clinica")).triarTexto(t)}
          aoAbrirSOS={() => alert("abriria a Central de Emergência")}
        />
      ) : (
        <TelaPrincipal
          posts={vazio ? [] : comReacoes([...POSTS.slice(0, 4), ...extras])}
          stories={vazio ? [] : STORIES}
          /* ⚠️ A zona de sugestões só abre quando o feed de quem ela segue
             acabou — por isso ela aparece na bancada quando `temMais` some, ou
             seja, depois de rolar até o fim. `?sugeridas=0` mostra o feed sem
             ela; `?vazio=1` mostra a conta nova, em que a fileira de pessoas é
             a única coisa na tela. */
          sugestoes={semSugestoes ? [] : comReacoes(POSTS.slice(5, 8))}
          pessoas={semSugestoes ? [] : GENTE}
          aoSeguirPessoa={(id) => console.log("seguiria", id)}
          /* ⚠️ A BANCADA GUARDA A REAÇÃO, e isso não é capricho: com
             `aoReagir={() => {}}` era impossível ver a mecânica INTEIRA — o
             emoji escolhido pousando na linha, o pulo, o resumo se
             reordenando, o toque duplo virando coração. A tela desenhava e
             nunca respondia, que é o estado em que uma tela passa meses sem
             ninguém perceber que ela não funciona. */
          aoReagir={acoesDaBancada.reagir}
          aoAbrirPerfil={acoesDaBancada.abrirPerfil}
          aoSalvar={acoesDaBancada.salvar}
          aoVotar={acoesDaBancada.votar}
          aoApagar={acoesDaBancada.apagar}
          /* ⚠️ A denúncia do FEED — a lacuna que fechava o círculo: a caixinha
             tinha denúncia e o canal com mais alcance não tinha. */
          aoDenunciar={acoesDaBancada.denunciar}
          aoTirarMarcacao={acoesDaBancada.tirarMarcacao}
          aoVerQuemReagiu={acoesDaBancada.verQuemReagiu}
          /* ⚠️ O cartão só existe aos DOMINGOS e com semana publicada — sem a
             bancada, olhá-lo exigiria esperar o domingo certo com uma conta que
             publicou naquela semana. `?retro=0` mostra o feed sem ele (o caso
             de seis dias em sete), `?retro=1foto` prova a grade de uma foto só
             e `?retro=vazia` o cartão sem foto, que é o da semana que só virou. */
          retro={
            retroModo === "0"
              ? null
              : {
                  fotos:
                    retroModo === "vazia"
                      ? []
                      : retroModo === "1foto"
                        ? [foto(CORES[0][0], CORES[0][1], CORES[0][2])]
                        : CORES.slice(0, 4).map((c) => foto(c[0], c[1], c[2])),
                  publicacoes: retroModo === "vazia" ? 0 : 3,
                  reacoes: retroModo === "vazia" ? 0 : 12,
                  semanaQueVirou: 29,
                }
          }
          aoFecharRetro={() => alert("dispensaria o resumo da semana")}
          /* ⚠️ A rolagem infinita só dá para conferir com MAIS de uma página, e
             uma conta de verdade levaria semanas para ter 21 publicações. Aqui
             a sentinela entrega três páginas e então diz que acabou. */
          desafio={oDesafio}
          aoEntrarNoDesafio={(e) => alert(e ? "entraria" : "sairia")}
          aoIrParaOJogo={() => alert("iria para o Caminho")}
          temMais={!vazio && paginas < 3}
          aoChegarNoFim={() => {
            setExtras((e) => [...e, ...maisUmaPagina(4, paginas + 1)]);
            setPaginas((n) => n + 1);
          }}
        />
      )}
      {vendoQuemReagiu && (
        <FolhaDeQuemReagiu
          gente={[
            { id: "marina", nome: "Marina Costa", avatarUrl: null, emoji: "❤️" },
            { id: "carol", nome: "Carol", avatarUrl: null, emoji: "🥹" },
            { id: "ana", nome: "Ana Paula", avatarUrl: null, emoji: "😂" },
            { id: "bru", nome: "Bruna", avatarUrl: null, emoji: "🙏" },
          ]}
          carregando={false}
          aoFechar={() => setVendoQuemReagiu(false)}
          aoAbrirPerfil={(id) => alert(`abriria o perfil de ${id}`)}
        />
      )}
    </div>
  );
}
