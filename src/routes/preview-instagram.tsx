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
 *   /preview-instagram?vazio=1      → conta NOVA: a fileira de pessoas é tudo
 *   /preview-instagram?sugeridas=0  → o feed sem a zona de sugestões
 *
 * ⚠️ A zona de sugestões ("Você está em dia" + pessoas + publicações) só abre
 * quando o feed de quem ela segue ACABOU — aqui, depois de rolar até o fim.
 */
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  EditarPerfil,
  ListaDeGente,
  NovoPost,
  TelaDeBusca,
  TelaDosSalvos,
  TelaDePerfil,
  TelaDoPost,
  TelaDeAtividade,
  TelaPrincipal,
  VisorDeStory,
  type PessoaNaLista,
  type Story,
} from "@/components/rede-instagram";
import type {
  AtividadeNaTela,
  BolhaDeStory,
  PerfilNaTela,
  PostNaTela,
} from "@/lib/rede-social.functions";

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
  /* O post 1 nasce GUARDADO: é ele que prova o marcador aceso ao lado do
     apagado dos outros. Com todos apagados não haveria contraste. */
  salvo: i === 1,
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
  const { tela, meu, vazio, sugeridas } = Route.useSearch();

  const perfil: PerfilNaTela = {
    id: meu ? "eu" : "marina",
    nome: meu ? "Marina Costa" : "Carol Andrade",
    bio: meu ? "Grávida da Helena 🎀 · 32 semanas · Belo Horizonte" : "Mãe do Bento 🧸 · pós-parto",
    avatarUrl: null,
    publico: true,
    meuVinculo: meu ? null : "ativo",
    souEu: meu,
    meusSeguidores: meu ? 137 : null,
  };

  const semSugestoes = sugeridas === 0;
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

  if (tela === "novo") {
    return (
      <div className="mx-auto max-w-md py-2">
        <NovoPost
          aoFechar={() => history.back()}
          aoPublicar={async (p) => {
            alert(`publicaria: ${p.fotos.length} foto(s), ${p.visibilidade}\n${p.texto ?? ""}`);
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
          seguindo={64}
          aoVoltar={() => history.back()}
          aoSeguir={() => alert("seguir")}
          aoAbrirPost={(id) => alert(`abriria o post ${id}`)}
          aoAbrirLista={meu ? (t) => alert(`abriria ${t}`) : undefined}
          aoAbrirSalvos={meu ? () => alert("abriria os salvos") : undefined}
          aoBloquear={meu ? undefined : () => alert("bloquearia")}
        />
      ) : (
        <TelaPrincipal
          posts={vazio ? [] : [...POSTS.slice(0, 4), ...extras]}
          stories={vazio ? [] : STORIES}
          /* ⚠️ A zona de sugestões só abre quando o feed de quem ela segue
             acabou — por isso ela aparece na bancada quando `temMais` some, ou
             seja, depois de rolar até o fim. `?sugeridas=0` mostra o feed sem
             ela; `?vazio=1` mostra a conta nova, em que a fileira de pessoas é
             a única coisa na tela. */
          sugestoes={semSugestoes ? [] : POSTS.slice(5, 8)}
          pessoas={semSugestoes ? [] : GENTE}
          aoSeguirPessoa={(id) => console.log("seguiria", id)}
          aoReagir={() => {}}
          aoAbrirPerfil={(id) => alert(`abriria o perfil de ${id}`)}
          aoSalvar={(_, v) => alert(v ? "guardaria" : "tiraria dos salvos")}
          aoApagar={() => alert("apagaria")}
          /* ⚠️ A rolagem infinita só dá para conferir com MAIS de uma página, e
             uma conta de verdade levaria semanas para ter 21 publicações. Aqui
             a sentinela entrega três páginas e então diz que acabou. */
          temMais={!vazio && paginas < 3}
          aoChegarNoFim={() => {
            setExtras((e) => [...e, ...maisUmaPagina(4, paginas + 1)]);
            setPaginas((n) => n + 1);
          }}
        />
      )}
    </div>
  );
}
