import type {
  AtividadeNaTela,
  ComentarioNaTela,
  PerfilNaTela,
  PessoaNaLista,
  PostNaTela,
} from "~/servidor/rede";

/**
 * Os dados de exemplo da Comunidade para a BANCADA (web, `?bancada=1`).
 *
 * ⚠️ Têm a FORMA exata do que o servidor devolve (os tipos de
 * `~/servidor/rede`) e entram nos mesmos estados da tela de produção. As
 * imagens são arquivos do site, nunca URL externa: o endereço "bancada:<nome>"
 * é resolvido por `fonteDaImagem` (componentes/comunidade/imagem.tsx).
 */

const MIN = 60_000;
const H = 60 * MIN;
const D = 24 * H;
const ha = (ms: number) => new Date(Date.now() - ms).toISOString();

export const EU_NA_BANCADA = "00000000-0000-4000-8000-000000000001";

function post(p: Partial<PostNaTela> & Pick<PostNaTela, "id" | "autorId" | "autorNome">): PostNaTela {
  return {
    autorAvatar: null,
    autorOficial: false,
    autorPremium: false,
    texto: null,
    imagemUrl: null,
    miniaturaUrl: null,
    imagens: [],
    visibilidade: "publico",
    criadoEm: ha(2 * H),
    reacoes: {},
    minhaReacao: null,
    souAAutora: false,
    vistas: null,
    marcadas: [],
    souMarcada: false,
    editadoEm: null,
    fixadoEm: null,
    quemComenta: "todos",
    enquete: null,
    videoUrl: null,
    ehRepost: false,
    repost: null,
    salvo: false,
    ...p,
  };
}

export function postsDaBancada(): PostNaTela[] {
  return [
    post({
      id: "1",
      autorId: "u-juliana",
      autorNome: "Juliana Prado",
      autorAvatar: "bancada:hero",
      texto:
        "28 semanas hoje! A barriga resolveu crescer tudo de uma vez nesta semana. Fizemos as fotos no parque no fim da tarde 🌅",
      imagemUrl: "bancada:hero",
      imagens: ["bancada:hero", "bancada:bastidores", "bancada:nutricao"],
      altTexto: "Gestante de perfil, de vestido claro, com as mãos na barriga",
      criadoEm: ha(42 * MIN),
      reacoes: { amei: 14, emocionei: 5, torcendo: 3, festa: 1 },
    }),
    post({
      id: "2",
      autorId: EU_NA_BANCADA,
      autorNome: "Marina Costa",
      texto:
        "Alguém mais acorda às 4h da manhã com uma fome que não tem tamanho? Hoje foi pão com requeijão no escuro da cozinha 😅",
      visibilidade: "seguidores",
      criadoEm: ha(3 * H),
      reacoes: { rindo: 9, abraco: 4, amei: 2 },
      minhaReacao: null,
      souAAutora: true,
    }),
    post({
      id: "3",
      autorId: "u-carla",
      autorNome: "Carla Mendes",
      texto:
        "Passamos três dias internadas, mas já estamos em casa. Obrigada a quem mandou mensagem — cada uma fez diferença.",
      imagemUrl: "bancada:bebe",
      imagens: ["bancada:bebe"],
      sensivel: true,
      motivoSensivel: "internacao",
      criadoEm: ha(26 * H),
      reacoes: { abraco: 21, torcendo: 11, forca: 6 },
      minhaReacao: "torcendo",
      salvo: true,
    }),
  ];
}

export function sugestoesDaBancada(): { posts: PostNaTela[]; pessoas: PessoaNaLista[] } {
  return {
    posts: [
      post({
        id: "4",
        autorId: "u-renata",
        autorNome: "Renata Alves",
        texto: "Ultrassom de hoje! Ver tudo ali na tela é uma emoção que não cabe em palavras 💛",
        imagemUrl: "bancada:bastidores",
        imagens: ["bancada:bastidores"],
        criadoEm: ha(3 * D),
        reacoes: { carinho: 31, amei: 18, uau: 4 },
      }),
    ],
    pessoas: [
      { id: "u-renata", nome: "Renata Alves", bio: "Primeira gestação · BH", avatarUrl: null, sigo: null, souEu: false },
      { id: "u-paula", nome: "Paula Lima", bio: "Mãe do Theo e grávida de novo", avatarUrl: null, sigo: null, souEu: false },
      { id: "u-tati", nome: "Tati Rocha", bio: null, avatarUrl: null, sigo: "pendente", souEu: false },
    ],
  };
}

function comentario(
  c: Partial<ComentarioNaTela> & Pick<ComentarioNaTela, "id" | "autorNome" | "texto">,
): ComentarioNaTela {
  return {
    autorId: `u-${c.id}`,
    autorAvatar: null,
    criadoEm: ha(30 * MIN),
    possoApagar: false,
    respondeA: null,
    curtidas: 0,
    euCurti: false,
    ...c,
  };
}

export function comentariosDaBancada(): ComentarioNaTela[] {
  return [
    comentario({
      id: "c1",
      autorNome: "Bia Moreira",
      texto: "Que fotos lindas! Essa luz do fim de tarde ficou perfeita.",
      criadoEm: ha(40 * MIN),
      curtidas: 3,
    }),
    comentario({
      id: "c1a",
      autorNome: "Juliana Prado",
      autorId: "u-juliana",
      texto: "Obrigada, Bia! Foi o meu marido que fotografou 😄",
      respondeA: "c1",
      criadoEm: ha(38 * MIN),
      curtidas: 1,
      souOAutor: false,
    }),
    comentario({ id: "c1b", autorNome: "Renata Alves", texto: "Ficou demais!", respondeA: "c1", criadoEm: ha(36 * MIN) }),
    comentario({ id: "c1c", autorNome: "Paula Lima", texto: "Também quero fazer assim.", respondeA: "c1", criadoEm: ha(35 * MIN) }),
    comentario({ id: "c1d", autorNome: "Tati Rocha", texto: "Que parque é esse?", respondeA: "c1", criadoEm: ha(34 * MIN) }),
    comentario({ id: "c1e", autorNome: "Lu Andrade", texto: "Lindas demais 💛", respondeA: "c1", criadoEm: ha(33 * MIN) }),
    comentario({
      id: "c2",
      autorId: EU_NA_BANCADA,
      autorNome: "Marina Costa",
      texto: "28 semanas passou voando, né? Parece que foi ontem que você contou.",
      criadoEm: ha(20 * MIN),
      possoApagar: true,
      euCurti: false,
      curtidas: 2,
    }),
    comentario({
      id: "c3",
      autorNome: "Alguém",
      texto: "Texto que ela escolheu esconder.",
      criadoEm: ha(10 * MIN),
      recolhido: true,
    }),
  ];
}

export function perfilDaBancadaSocial(id: string): PerfilNaTela {
  const souEu = id === EU_NA_BANCADA;
  return souEu
    ? {
        id,
        nome: "Marina Costa",
        bio: "Primeira gestação. Aprendendo um dia de cada vez.",
        avatarUrl: null,
        publico: false,
        meuVinculo: null,
        souEu: true,
        seguidores: 42,
        seguindo: 57,
        handle: "marina.costa",
        seloSemana: "24 semanas",
        seloBebe: null,
        mostrarSemana: true,
        mostrarBebe: false,
      }
    : {
        id,
        nome: "Juliana Prado",
        bio: "Gestante de gêmeas · Contagem · contando os dias e tomando muita água",
        avatarUrl: "bancada:hero",
        publico: true,
        meuVinculo: null,
        souEu: false,
        seguidores: 1284,
        seguindo: 96,
        handle: "ju.prado",
        seloSemana: "28 semanas",
        seloBebe: null,
        mostrarSemana: true,
        mostrarBebe: false,
      };
}

export function postsDoPerfilDaBancada(id: string): PostNaTela[] {
  const capas = ["bancada:hero", "bancada:bastidores", "bancada:nutricao", "bancada:bebe", "bancada:nutricao"];
  return Array.from({ length: 7 }, (_, i) =>
    post({
      id: `p${i + 1}`,
      autorId: id,
      autorNome: "Juliana Prado",
      texto: i === 2 ? "Um dia de cada vez." : `Semana ${28 - i}`,
      imagemUrl: i === 2 ? null : capas[i % capas.length],
      imagens: i === 2 ? [] : [capas[i % capas.length]],
      criadoEm: ha((i + 1) * 3 * D),
      sensivel: i === 4,
      motivoSensivel: i === 4 ? "procedimento" : null,
    }),
  );
}

export function atividadeDaBancada(): { itens: AtividadeNaTela[]; novas: number } {
  const item = (a: Partial<AtividadeNaTela> & Pick<AtividadeNaTela, "id" | "especie" | "quemNome">): AtividadeNaTela => ({
    quemId: `u-${a.id}`,
    quemAvatar: null,
    postId: null,
    postCapa: null,
    criadoEm: ha(H),
    visto: false,
    pendente: false,
    ...a,
  });
  return {
    novas: 3,
    itens: [
      item({ id: "a1", especie: "pediu_para_seguir", quemNome: "Tati Rocha", pendente: true, criadoEm: ha(12 * MIN) }),
      item({ id: "a2", especie: "reagiu", quemNome: "Juliana Prado", quemAvatar: "bancada:hero", postId: "2", postCapa: null, criadoEm: ha(50 * MIN) }),
      item({ id: "a3", especie: "comentou", quemNome: "Bia Moreira", postId: "2", criadoEm: ha(2 * H) }),
      item({ id: "a4", especie: "seguiu", quemNome: "Paula Lima", quemAvatar: null, criadoEm: ha(D), visto: true }),
      item({ id: "a5", especie: "aceitou", quemNome: "Renata Alves", criadoEm: ha(3 * D), visto: true }),
    ],
  };
}

export function pedidosDaBancada(): { id: string; nome: string; avatarUrl: string | null }[] {
  return [
    { id: "u-tati", nome: "Tati Rocha", avatarUrl: null },
    { id: "u-lu", nome: "Lu Andrade", avatarUrl: null },
  ];
}

export function bloqueadosDaBancada(): PessoaNaLista[] {
  return [{ id: "u-x", nome: "Perfil bloqueado", bio: null, avatarUrl: null, sigo: null, souEu: false }];
}

export function buscaDaBancada(termo: string): PerfilNaTela[] {
  const todos = [perfilDaBancadaSocial("u-juliana"), { ...perfilDaBancadaSocial("u-juliana"), id: "u-ju2", nome: "Júlia Martins", handle: "juliamartins", avatarUrl: null, bio: "Mãe de primeira viagem", seloSemana: "19 semanas" }];
  const t = termo.toLowerCase();
  return todos.filter((p) => p.nome.toLowerCase().includes(t.slice(0, 2)) || (p.handle ?? "").includes(t));
}
