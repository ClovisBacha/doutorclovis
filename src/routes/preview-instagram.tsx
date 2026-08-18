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
 */
import { createFileRoute } from "@tanstack/react-router";
import { TelaDePerfil, TelaPrincipal, type Story } from "@/components/rede-instagram";
import type { PerfilNaTela, PostNaTela } from "@/lib/rede-social.functions";

export const Route = createFileRoute("/preview-instagram")({
  component: Bancada,
  validateSearch: (q: Record<string, unknown>) => ({
    /* ⚠️ `== null` e NÃO `=== undefined`: o router serializa e revalida, e na
       segunda passada chega `null`. Mesma armadilha de `preview-saude`. */
    tela: q.tela == null ? "feed" : String(q.tela),
    meu: q.meu == null ? false : !!q.meu,
    vazio: q.vazio == null ? false : !!q.vazio,
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
  visibilidade: i === 3 ? "amigas" : "publico",
  criadoEm: atras(30 + i * 240),
  reacoes: i === 0 ? { amei: 24, emocionei: 11, torcendo: 6 } : i % 3 === 0 ? { abraco: 4 } : {},
  minhaReacao: i === 0 ? "emocionei" : null,
  souAAutora: i === 3,
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

function Bancada() {
  const { tela, meu, vazio } = Route.useSearch();

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
        />
      ) : (
        <TelaPrincipal
          posts={vazio ? [] : POSTS.slice(0, 4)}
          stories={vazio ? [] : STORIES}
          /* O terceiro post vem do algoritmo — é o que prova o rótulo
             "Sugerido para você", que é obrigatório quando o post não veio de
             quem ela segue. */
          sugeridos={["p2"]}
          aoReagir={() => {}}
          aoAbrirPerfil={(id) => alert(`abriria o perfil de ${id}`)}
          aoPublicar={() => alert("publicar")}
        />
      )}
    </div>
  );
}
