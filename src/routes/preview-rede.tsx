/**
 * BANCADA DA REDE SOCIAL — feed, reações e perfil sem conta e sem banco.
 *
 * ⚠️ Sem ela, conferir o desenho de um post com foto e cinco reações exigiria
 * duas contas de verdade, uma seguindo a outra, e alguém reagindo. É assim que
 * uma tela passa meses sem ninguém nunca ter olhado para ela.
 *
 * A bancada fabrica os DADOS; quem ordena o feed, calcula o resumo das reações
 * e decide o que aparece é a tela de verdade, com as mesmas funções puras.
 *
 * Endereços:
 *   /preview-rede                 → o feed com três posts
 *   /preview-rede?tela=perfil     → as configurações (perfil público, pedidos)
 *   /preview-rede?tela=perfil&pedidos=3
 *   /preview-rede?vazio=1         → o estado de quem chegou agora
 *   /preview-rede?luto=1          → Modo Cuidado
 */
import { createFileRoute } from "@tanstack/react-router";
import { ConfiguracoesDoPerfil, FeedDaRede } from "@/components/rede-social";
import type { PerfilNaTela, PostNaTela } from "@/lib/rede-social.functions";

export const Route = createFileRoute("/preview-rede")({
  component: Bancada,
  validateSearch: (q: Record<string, unknown>) => ({
    /* ⚠️ `== null` e NÃO `=== undefined`: o router serializa e revalida, e na
       segunda passada chega `null`. Mesma armadilha de `preview-saude`. */
    tela: q.tela == null ? "feed" : String(q.tela),
    pedidos: q.pedidos == null ? 0 : Number(q.pedidos) || 0,
    vazio: q.vazio == null ? false : !!q.vazio,
    luto: q.luto == null ? false : !!q.luto,
  }),
});

/* Datas cravadas, não `Date.now()`: uma bancada que muda de texto conforme a
   hora é uma bancada que não dá para comparar entre duas visitas. */
const AGORA = new Date("2026-08-18T12:00:00Z").getTime();
const atras = (min: number) => new Date(AGORA - min * 60000).toISOString();

const POSTS: PostNaTela[] = [
  {
    id: "p1",
    autorId: "marina",
    autorNome: "Marina Costa",
    autorAvatar: null,
    texto: "Ultrassom de hoje 🥹 ela colocou a mãozinha no rosto na hora exata da foto",
    imagemUrl: null,
    visibilidade: "publico",
    criadoEm: atras(35),
    /* Contagem alta e variada: é o que prova o resumo com teto de três e o
       total somado — o estado que uma conta nova nunca teria. */
    reacoes: { amei: 24, emocionei: 11, torcendo: 6, forca: 2 },
    minhaReacao: "emocionei",
    souAAutora: false,
  },
  {
    id: "p2",
    autorId: "eu",
    autorNome: "Você",
    autorAvatar: null,
    texto: "Noite difícil, mas passou. Obrigada quem mandou mensagem 💛",
    imagemUrl: null,
    /* O post DELA, na camada restrita: é o único caso em que a etiqueta da
       camada aparece na tela, e a bancada existe para mostrar isso. */
    visibilidade: "amigas",
    criadoEm: atras(190),
    reacoes: { abraco: 5, torcendo: 3 },
    minhaReacao: null,
    souAAutora: true,
  },
  {
    id: "p3",
    autorId: "carol",
    autorNome: "Carol",
    autorAvatar: null,
    /* ⚠️ Post SÓ COM FOTO, e ele existe na bancada por dois motivos.
       O primeiro é desenhar o cartão com imagem — a única parte que não dá
       para conferir sem um arquivo de verdade.
       O segundo é um defeito que a bancada criou e mostrou: a primeira versão
       deste post tinha `texto: null` E `imagemUrl: null`, e renderizou um
       cartão VAZIO. Em produção o CHECK `post_tem_conteudo` impede, mas a
       bancada não passa pelo banco — e um estado impossível desenhado na tela
       é exatamente o tipo de coisa que só aparece olhando. */
    texto: null,
    imagemUrl:
      "data:image/svg+xml;utf8," +
      encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="450">' +
          '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
          '<stop offset="0" stop-color="#f7d9e3"/><stop offset="1" stop-color="#cfe3f0"/>' +
          "</linearGradient></defs>" +
          '<rect width="600" height="450" fill="url(#g)"/>' +
          '<text x="300" y="240" font-size="64" text-anchor="middle">🍼</text></svg>',
      ),
    visibilidade: "seguidores",
    criadoEm: atras(1500),
    /* Sem reação nenhuma: prova que a linha de contagem some inteira em vez de
       mostrar um zero. */
    reacoes: {},
    minhaReacao: null,
    souAAutora: false,
  },
];

const PERFIL: PerfilNaTela = {
  id: "eu",
  nome: "Marina Costa",
  bio: "Grávida da Helena 🎀 · 32 semanas",
  avatarUrl: null,
  publico: true,
  meuVinculo: null,
  souEu: true,
  meusSeguidores: 137,
};

function Bancada() {
  const { tela, pedidos, vazio, luto } = Route.useSearch();

  const fila = Array.from({ length: Math.max(0, Math.min(pedidos, 8)) }, (_, i) => ({
    id: `q${i}`,
    nome: ["Ana Paula", "Tia Zezé", "Bruna", "Letícia", "Cris", "Duda", "Nina", "Sol"][i],
    avatarUrl: null,
  }));

  return (
    <div className="mx-auto max-w-md px-4 py-6">
      {tela === "perfil" ? (
        <ConfiguracoesDoPerfil
          careMode={luto}
          bancada={{ posts: [], perfil: PERFIL, pedidos: fila }}
        />
      ) : (
        <FeedDaRede
          careMode={luto}
          bancada={{ posts: vazio ? [] : POSTS }}
          aoAbrirPerfil={(id) => alert(`abriria o perfil de ${id}`)}
        />
      )}
    </div>
  );
}
