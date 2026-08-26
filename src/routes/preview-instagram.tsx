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
 *   /preview-instagram?tela=novo&comFoto=1
 *       → o compositor JÁ COM uma foto de hoje escolhida. É a única forma de
 *         ver o botão "Então e agora": ele exige as duas pontas (uma foto
 *         antiga E a de hoje), e a bancada só fabricava a antiga — então o
 *         controle, o seletor de foto e a legenda que ele oferece nunca tinham
 *         sido olhados por ninguém. Foi ao ligar isto que apareceram os dois
 *         defeitos da oferta (legenda em dobro por toque, e empilhando a cada
 *         liga/desliga).
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
 *   /preview-instagram?tela=story&videoStory=1 → o primeiro story é VÍDEO
 *   /preview-instagram?tela=story&sensivelStory=1 → o véu do aviso de conteúdo
 *   /preview-instagram?memoria=1 → o cartão "há um ano, você publicou isto"
 *   /preview-instagram?tela=espelho&trancado=1 → o estado da MAIORIA: perfil fechado
 *   /preview-instagram?tela=perfil&meu=1&selo=0 → o perfil sem os selos
 *   /preview-instagram?vazio=1      → conta NOVA: a fileira de pessoas é tudo
 *   /preview-instagram?sugeridas=0  → o feed sem a zona de sugestões
 *   /preview-instagram?semcodigo=1  → o convite NÃO aparece (sem indicação)
 *   /preview-instagram?oficial=0    → a fileira sem a conta oficial
 *   /preview-instagram?entao=1      → o lembrete do "então e agora"
 *   /preview-instagram?vazio=1      → o feed vazio, com o convite em destaque
 *   /preview-instagram?desafio=fora → o convite do desafio (ainda não entrou)
 *   /preview-instagram?desafio=meio → dentro, 1 de 3 dias
 *   /preview-instagram?desafio=fim  → fechou, com o contador do grupo
 *
 * ⚠️ A zona de sugestões ("Você está em dia" + pessoas + publicações) só abre
 * quando o feed de quem ela segue ACABOU — aqui, depois de rolar até o fim.
 */
import { useEffect, useMemo, useState } from "react";
import { OnboardingDaComunidade } from "@/components/onboarding-da-comunidade";
import { Comentarios } from "@/components/rede-comentarios";
import { chaveDoRascunhoDeComentario, serializarRascunho } from "@/lib/comentarios";
import { FiltroDePalavras } from "@/components/rede-social";
import { CaixaDeEntrada, Conversa, MandarPublicacao } from "@/components/rede-conversa";
import type { Filho } from "@/lib/filhos";
import type { Persona } from "@/lib/selo-do-perfil";
import { createFileRoute } from "@tanstack/react-router";
import {
  ConferirStory,
  EditarPerfil,
  EspelhoDoPerfil,
  ListaDeGente,
  NovoPost,
  TelaDeBusca,
  TelaDosArquivados,
  TelaDosSalvos,
  PerfilCarregando,
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
  TelaDaTag,
  ArquivoDeStories,
  ListaDeBloqueados,
} from "@/components/rede-instagram";
import type {
  AtividadeNaTela,
  BolhaDeStory,
  PerfilNaTela,
  PostNaTela,
} from "@/lib/rede-social.functions";
import type { TipoDeReacao } from "@/lib/rede-social";
import { recadoDoDesfecho } from "@/lib/caixinha-tela";

export const Route = createFileRoute("/preview-instagram")({
  component: Bancada,
  validateSearch: (q: Record<string, unknown>) => ({
    /* ⚠️ `== null` e NÃO `=== undefined`: o router serializa e revalida, e na
       segunda passada chega `null`. Mesma armadilha de `preview-saude`. */
    tela: q.tela == null ? "feed" : String(q.tela),
    /* ⚠️ `== null` e NÃO `=== undefined` — a armadilha de sempre. */
    tag: q.tag == null ? "28semanas" : String(q.tag),
    /* ⚠️ `== null` e NÃO `=== undefined` — a armadilha de sempre. */
    restrito: q.restrito == null ? 0 : Number(q.restrito),
    silenciado: q.silenciado == null ? 0 : Number(q.silenciado),
    /* ⚠️ `== null` e NÃO `=== undefined` — a armadilha de sempre. */
    favorita: q.favorita == null ? 0 : Number(q.favorita),
    /* ⚠️ `== null` e NÃO `=== undefined` — a armadilha de sempre. */
    notas: q.notas == null ? 0 : Number(q.notas),
    /* Uma mensagem recolhida pelo filtro de palavras DELA. */
    oculta: q.oculta == null ? 0 : Number(q.oculta),
    /* ⚠️ `rascunhoStory`, e não `rascunho`: este último já existe e é o do
       compositor de POST. Duas bancadas do mesmo nome mostrariam o estado de
       uma na tela da outra. */
    rascunhoStory: q.rascunhoStory == null ? 0 : Number(q.rascunhoStory),
    fixados: q.fixados == null ? 0 : Number(q.fixados),
    /* ⚠️ `== null` e NÃO `=== undefined` — a armadilha de sempre. A ordem por
       curtidas só se enxerga com um comentário muito curtido no meio da lista,
       que é exatamente o que não se fabrica numa conta de teste. */
    ordem: q.ordem == null ? "recentes" : String(q.ordem),
    /* ⚠️ `== null` e NÃO `=== undefined` — a armadilha de sempre. Os quatro
       cartões só abrem UMA vez na vida da conta, e o "já vi" viaja na nuvem:
       sem a bancada, conferir o desenho exigiria uma conta recém-criada, e
       depois de olhar uma vez ela nunca mais mostraria. */
    onboarding: q.onboarding == null ? 0 : Number(q.onboarding),
    /* ⚠️ `== null` e NÃO `=== undefined` — a armadilha de sempre. O véu do
       conteúdo sensível só existe num post que alguém marcou, e a legenda do
       vídeo exige um post com vídeo: os dois são impossíveis de fotografar sem
       a bancada. */
    sensivel: q.sensivel == null ? 0 : Number(q.sensivel),
    /* O rascunho guardado: sem isto ele exige fechar o app no meio de uma
       frase e reabrir — o estado que ninguém confere por acaso. */
    rascunhoComent: q.rascunhoComent == null ? 0 : Number(q.rascunhoComent),
    quadro: q.quadro == null ? 0 : Number(q.quadro),
    /* ⚠️ `== null` e NÃO `=== undefined` — a armadilha de sempre. */
    instavel: q.instavel == null ? 0 : Number(q.instavel),
    /* ⚠️ `== null` e NÃO `=== undefined` — a armadilha de sempre. */
    fechado: q.fechado == null ? 0 : Number(q.fechado),
    meu: q.meu == null ? false : !!q.meu,
    vazio: q.vazio == null ? false : !!q.vazio,
    /* ⚠️ `== null` e NÃO `=== undefined` — mesma armadilha de sempre. */
    semcodigo: q.semcodigo == null ? false : !!q.semcodigo,
    /* ⚠️ `== null` e NÃO `=== undefined` — mesma armadilha de sempre. */
    oficial: q.oficial == null ? 1 : Number(q.oficial),
    entao: q.entao == null ? false : !!q.entao,
    /* ⚠️ `== null` e NÃO `=== undefined` — a mesma armadilha de sempre: na
       revalidação chega `null`, e `!!null` seria `false` mesmo com o parâmetro
       na URL. Ver o comentário do topo. */
    filhos: q.filhos == null ? "" : String(q.filhos),
    /* ⚠️ `== null` e NÃO `=== undefined` — a armadilha de sempre. */
    conversa: q.conversa == null ? "" : String(q.conversa),
    /* ⚠️ `== null` e não `=== undefined`: na revalidação chega `null`, e
       `Number(null)` é 0. Mesma armadilha de `preview-saude`. */
    sugeridas: q.sugeridas == null ? 1 : Number(q.sugeridas),
    /* ⚠️ `== null` e NÃO `=== undefined` — mesma armadilha de sempre. */
    legendas: q.legendas == null ? 1 : Number(q.legendas),
    amigas: q.amigas == null ? 1 : Number(q.amigas),
    rascunho: q.rascunho == null ? 1 : Number(q.rascunho),
    /* ⚠️ `== null`, como todos os outros. `1` = o compositor já abre com uma
       foto de HOJE escolhida, que é a metade que faltava para o botão "Então e
       agora" existir na bancada. */
    comFoto: q.comFoto == null ? 0 : Number(q.comFoto),
    retro: q.retro == null ? "" : String(q.retro),
    /* ⚠️ `== null`, como todos os outros. `""` = a live marcada para daqui a
       pouco (o caso comum), `agora` = ao vivo, `nao` = sem live nenhuma. */
    live: q.live == null ? "" : String(q.live),
    /* ⚠️ `== null`, como todos. `""` = filtro desligado, `1` = ligado com
       gente, `vazio` = ligado e sem ninguém (o estado que precisa ter saída). */
    fase: q.fase == null ? "" : String(q.fase),
    voto: q.voto == null ? 0 : Number(q.voto),
    comparar: q.comparar == null ? 1 : Number(q.comparar),
    /* ⚠️ `== null` e nunca `=== undefined`. Mesma armadilha de sempre. */
    selo: q.selo == null ? 1 : Number(q.selo),
    trancado: q.trancado == null ? false : !!q.trancado,
    carimbo: q.carimbo == null ? false : !!q.carimbo,
    /* ⚠️ `== null` e NÃO `=== undefined` — a armadilha de sempre. */
    videoStory: q.videoStory == null ? 0 : Number(q.videoStory),
    /* O story marcado como sensível: o véu só nasce de uma marca de verdade. */
    sensivelStory: q.sensivelStory == null ? 0 : Number(q.sensivelStory),
    /* ⚠️ `== null` e NÃO `=== undefined` — a armadilha de sempre. */
    memoria: q.memoria == null ? 0 : Number(q.memoria),
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
  autorNome: i === 1 ? "Obstétrica" : i === 3 ? "Você" : i % 2 === 0 ? "Marina Costa" : "Carol",
  autorAvatar: null,
  /* ⚠️ UM post da CONTA OFICIAL na bancada. Sem ele, o selo do consultório
     continuaria sendo impossível de olhar — que é exatamente o motivo de ele
     ter passado uma leva inteira montado no servidor e desenhado em lugar
     nenhum. O 1 cai dentro do recorte que a bancada desenha (POSTS.slice(0, 5)), então o selo aparece ao lado do nome no
     cabeçalho do cartão, que é onde ele mora de verdade. */
  autorOficial: i === 1,
  /* ⚠️ Só o post 3 é DELA, e é o único com número — nos outros a contagem é
     `null`, que é o estado real: audiência de post alheio não existe nesta
     tela, e um `0` ali seria o contador público que este app não tem. */
  vistas: i === 3 ? 47 : null,
  /* O post 5 é SÓ TEXTO: é ele que prova que a célula da grade mostra o texto
     em vez de um buraco cinza. */
  texto:
    i === 5
      ? "Hoje ela mexeu tanto que acordei rindo 🥹 #trigemeas"
      : i === 0
        ? /* ⚠️ **A LEGENDA DE EXEMPLO CARREGA UM `@` E UMA `#`, e não é
             enfeite.** Elas só viram link dentro de `TextoComLinks`, e sem uma
             legenda que as contenha a bancada desenharia o caso que NUNCA
             falha — texto puro — enquanto o único caminho novo do recurso
             ficava sem ninguém nunca ter olhado. */
          "Ultrassom de hoje — a mãozinha no rosto 💛 obrigada @marina.costa #28semanas"
        : null,
  imagemUrl: i === 5 ? null : foto(c[0], c[1], c[2]),
  /* ⚠️ Metade COM miniatura e metade SEM, de propósito: o recuo é permanente
     (toda publicação anterior ao recurso cai na foto cheia), e uma bancada em
     que todas têm miniatura nunca mostraria o caminho que a maioria do acervo
     vai percorrer. */
  miniaturaUrl: i === 5 || i % 2 === 1 ? null : foto(c[0], c[1], c[2]),
  /* ⚠️ Nem todo mundo assina — uma bancada em que todas têm selo esconderia o
     caso normal, que é a maioria da base. */
  autorPremium: i === 0 || i === 4,
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
  /* O post 2 (o carrossel de três) vira a comparação: é ele que prova os dois
     carimbos sobre as duas primeiras fotos. */
  comparacao: i === 2 ? { antes: "18s", agora: "32s" } : null,
  /* O post 3 é um mesversário: é ele que prova o rótulo do marco no cartão. */
  marco: i === 3 ? { tipo: "mesversario", dias: 91 } : null,
  /* O post 1 vira vídeo — é ele que prova o player no cartão.

     ⚠️ **ARQUIVO DO PRÓPRIO SITE, nunca um host externo.** A primeira versão
     apontava para um vídeo de exemplo na internet: a bancada passava a depender
     de rede alheia, e a varredura da CI roda sem ela. Este `.webm` já é
     embarcado (é um dos sons de ambiente) e serve para provar o player. */
  videoUrl: i === 1 ? "/sons/riacho.webm" : null,
  /* O post 4 é uma republicação — prova o quadro da original no cartão. */
  /* ⚠️ O ÍNDICE 0, e não o último: o feed da bancada desenha só as primeiras
     publicações (`POSTS.slice`), então uma fixture no fim NUNCA aparece — foi
     assim que este quadro passou uma rodada inteira sem ser visto. */
  ehRepost: i === 0,
  repost:
    i === 0
      ? {
          id: "orig",
          autorId: "u9",
          autorNome: "Juliana",
          texto: "chegou o enxoval 💛",
          imagemUrl: null,
        }
      : null,
  /* O post 0 nasce EDITADO — é ele que prova o selo "editado" ao lado da hora. */
  editadoEm: i === 0 ? atras(20) : null,
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
  /* ⚠️ `?fixados=1` acende as duas primeiras — o pino na célula da grade e o
     botão aceso no cartão são impossíveis de fotografar sem uma conta com
     publicação fixada de verdade, e a fixação é justamente o que muda a ORDEM
     da grade. */
  fixadoEm: null,
  /* ⚠️ `?soAmigas=1` fecha o comentário do primeiro post — o estado em que a
     tela mostra "só as amigas dela podem comentar" em vez do campo. */
  quemComenta: "todos" as const,
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

/**
 * OS FILHOS DE MENTIRA — três arranjos que a produção leva meses para produzir.
 *
 * ⚠️ Sem isto, o editor de filhos e a tira de marcos eram IMPOSSÍVEIS de olhar:
 * os dois falam com o servidor, e sem sessão a tela mostra o erro — que é
 * justamente o estado que elas não precisam provar. É a lição do
 * `PerfilDaAmigaTela`, aplicada antes de custar uma rodada.
 */
const FILHOS_DE_MENTIRA: Record<string, Filho[]> = {
  /* Mãe de um bebê de 3 meses: o caso do mesversário e dos marcos. */
  bebe: [{ id: "f1", nome: "Helena", sexo: "f", nascidoEm: "2026-05-24", previstoPara: null }],
  /* Grávida de gêmeas: prova a concordância. */
  gemeas: [
    { id: "f1", nome: null, sexo: "f", nascidoEm: null, previstoPara: "2026-12-01" },
    { id: "f2", nome: null, sexo: "f", nascidoEm: null, previstoPara: "2026-12-01" },
  ],
  /* ⚠️ O caso que nenhum app de gestação representa: mãe E grávida. */
  ambos: [
    { id: "f1", nome: "Ana", sexo: "f", nascidoEm: "2023-04-10", previstoPara: null },
    { id: "f2", nome: null, sexo: "m", nascidoEm: null, previstoPara: "2026-12-01" },
  ],
};

function Bancada() {
  const {
    tela,
    meu,
    vazio,
    semcodigo,
    oficial: oficialParam,
    entao,
    sugeridas,
    legendas,
    amigas,
    rascunho,
    retro,
    live,
    fase,
    voto,
    comparar,
    comFoto,
    selo,
    trancado,
    carimbo,
    videoStory,
    sensivelStory,
    memoria,
    desafio,
    caixinha,
    perguntas,
    remover,
    filhos,
    conversa,
    tag,
    restrito,
    silenciado,
    favorita,
    notas,
    oculta,
    rascunhoStory,
    fixados,
    ordem,
    rascunhoComent,
    onboarding,
    sensivel,
    quadro,
    instavel,
    fechado,
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
    /* ⚠️ O `@` tem de estar aqui, e a primeira verificação no navegador achou
       a linha VAZIA: sem ele a bancada desenha o perfil de quem nunca
       escolheu — o único estado que já era certo — e o endereço novo ficava
       sem ninguém nunca ter olhado. */
    handle: meu ? "marina.costa" : "carol.andrade",
    /* ⚠️ `?silenciado=1` fotografa o botão no estado LIGADO — "Deixar de
       silenciar Fulana". Ele estava cravado em `false`, então metade do
       controle nunca tinha sido olhada: o estado que só existe DEPOIS de
       silenciar alguém de verdade. Mesma falta do `?restrito=1`, no controle
       ao lado. */
    silenciado: silenciado === 1,
    favorita: favorita === 1,
    /* ⚠️ `?restrito=1` fotografa o botão no estado LIGADO e o texto que ele
       mostra ali — impossível de ver sem uma restrição real, e é o texto que
       explica o recurso inteiro. */
    restrito: restrito === 1,
    seguidores: meu ? 137 : 412,
    seguindo: meu ? 208 : 190,
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
    linhaDosFilhos: "Mãe da Helena, 3 meses",
    feedSoSeguindo: false,
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
  const semCodigo = semcodigo;
  const semOficial = oficialParam === 0;
  const semLegendas = legendas === 0;
  const semAmigasParaMarcar = amigas === 0;
  const comRascunho = rascunho !== 0;
  const [vendoQuemReagiu, setVendoQuemReagiu] = useState(false);
  const retroModo = retro;
  const jaVotouNoStory = voto === 1;
  const semComparar = comparar === 0;
  /**
   * ⚠️ **A foto de HOJE, sem a qual o "Então e agora" não é fotografável.**
   *
   * O botão exige as DUAS pontas (`paraComparar.length > 0 && fotos.length >
   * 0`), e isso é o comportamento certo: um botão de comparação sem a foto de
   * hoje prometeria o que não pode entregar. Mas a bancada só fabricava a ponta
   * ANTIGA — então o controle, o seletor de foto e a legenda que ele oferece
   * nunca tinham sido vistos por ninguém, e só apareceriam numa conta real com
   * uma foto escolhida na mão.
   *
   * ⚠️ **Usa `momentoInicial`, que é prop de PRODUÇÃO**, e não um atalho novo:
   * ele semeia `fotos` no inicializador do `useState` (síncrono, canvas puro).
   * É a régua da casa — a bancada injeta o DADO nos mesmos estados da produção,
   * nunca o desenho. O cartão de momento faz as vezes da foto de hoje só para o
   * controle existir; o que se confere aqui é o CONTROLE, não a imagem.
   */
  const comFotoDeHoje = comFoto === 1;
  /**
   * ⚠️ **A foto de hoje só entra DEPOIS de montar, e isso é da bancada.**
   *
   * `momentoInicial` semeia `fotos` no inicializador do `useState`, lendo
   * `document` — que no SSR não existe. O servidor renderiza o compositor SEM
   * foto e o cliente COM, e o React acusa hydration mismatch e joga a árvore
   * fora. Em produção isso não acontece porque a paciente chega aqui navegando
   * (só cliente); é a bancada que renderiza no servidor.
   *
   * Segurar um render resolve sem tocar na produção — a mesma manobra da
   * bancada do ritual de boas-vindas, que escreve o `localStorage` antes de
   * montar e espera um render.
   */
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);
  /* Qual reação a bancada guarda para cada post. `undefined` = a do fixture. */
  const [reacoes, setReacoes] = useState<Record<string, TipoDeReacao | null>>({});
  /** As legendas editadas na bancada. */
  const [edicoes, setEdicoes] = useState<Record<string, string>>({});
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
      denunciar: (p: PostNaTela, m: string) => alert(`denunciaria o post ${p.id} por "${m}"`),
      tirarMarcacao: (p: PostNaTela) => alert(`tiraria minha marcação do post ${p.id}`),
      /* ⚠️ A bancada GRAVA a edição no estado, e não num alert: o que precisa
         ser olhado é o texto trocando e o selo "editado" nascendo — com um
         alert, a tela nunca mostraria nem um nem outro. */
      /* ⚠️ **A BANCADA PASSA `republicar`, senão o botão NUNCA aparece.** Ele
         só nasce quando a prop existe — e uma bancada sem ela mediria uma tela
         que a produção não tem, que é o defeito que `acoesDaBancada` já
         documenta para as outras ações. */
      republicar: (_p: PostNaTela) => alert("abriria o compositor republicando"),
      /* ⚠️ A bancada precisa da prop, senão o botão NUNCA aparece — a mesma
         lição de `republicar`. */
      compartilhar: (_p: PostNaTela) => alert("abriria a folha do sistema"),
      /* ⚠️ A bancada precisa da prop, senão o botão NUNCA aparece — a mesma
         lição de `republicar` e de `compartilhar`. Medido: a primeira
         verificação no navegador achou ZERO botões "Adicionar ao seu story"
         justamente por isto. */
      storyComPost: (p: PostNaTela) => alert(`levaria o post ${p.id} para o compositor de story`),
      /* ⚠️ Idem para o pino: sem a prop, o botão de fixar não existe na bancada
         e o estado aceso continuaria sem ninguém ter olhado. */
      fixar: (p: PostNaTela, v: boolean) => alert(v ? `fixaria ${p.id}` : `soltaria ${p.id}`),
      editar: async (p: PostNaTela, t: string) => {
        setEdicoes((m) => ({ ...m, [p.id]: t }));
        return true;
      },
      /* ⚠️ A folha abre com DADO fabricado: quem reagiu só existe numa conta com
         reações de verdade, e é justamente a folha que precisa ser olhada. */
      verQuemReagiu: () => setVendoQuemReagiu(true),
    }),
    [],
  );
  const comReacoes = (ps: PostNaTela[]) =>
    ps.map((p0) => {
      const p =
        p0.id in edicoes
          ? { ...p0, texto: edicoes[p0.id] || null, editadoEm: new Date(AGORA).toISOString() }
          : p0;
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
      /* ⚠️ A conta oficial do consultório, para o selo ser FOTOGRAFÁVEL: ele
         só existe numa conta marcada no banco, e sem isto seria construído às
         cegas — que é como uma tela passa meses sem ninguém nunca ter olhado.
         `?oficial=0` mostra a fileira sem ele. */
      id: "g0",
      nome: "Obstétrica",
      bio: "A conta do consultório",
      avatarUrl: null,
      sigo: null,
      souEu: false,
      oficial: !semOficial,
    },
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
        <EditarPerfil
          perfil={perfil}
          aoSalvar={async () => true}
          aoFechar={() => history.back()}
          filhosDeMentira={FILHOS_DE_MENTIRA[filhos] ?? FILHOS_DE_MENTIRA.bebe}
        />
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
        /* ⚠️ **O CARROSSEL DE STORY só se vê com mais de uma foto**, e o segundo
           story da bancada traz três: sem ele, os pontinhos e o deslizar não
           existiriam em nenhuma tela que dá para olhar. */
        imagens:
          n === 1
            ? CORES.slice(0, 3).map((cc) => foto(cc[0], cc[1], cc[2]))
            : [foto(c[0], c[1], c[2])],
        texto: n === 1 ? "31 semanas hoje 🤍" : null,
        criadoEm: atras(60 * (n + 1)),
        visto: false,
        /* Só o primeiro carimbado: é o contraste que prova que o carimbo é
           por STORY, e não uma propriedade da conta. */
        carimbo: carimbo && n === 0 ? "32 semanas" : null,
        /* ⚠️ O SEGUNDO tem ENQUETE e o TERCEIRO tem CAIXINHA — um de cada, e
           nunca os dois no mesmo story: eles ocupam o mesmo pedaço da tela, e
           empilhados sobrariam ~120px de foto. `?voto=1` mostra o resultado
           depois de votar, que é o estado que só aparece uma vez por pessoa. */
        enquete:
          n === 1
            ? {
                opcoes: ["Menino", "Menina"],
                votos: [12, 9],
                meuVoto: jaVotouNoStory ? 0 : null,
              }
            : null,
        minhaReacao: null,
        /* ⚠️ `?quadro=1` põe uma publicação compartilhada DENTRO do story — o
           cartão só existe quando alguém compartilha de verdade, e ele é
           resolvido no servidor para quem assiste, então sem a bancada ele
           nasceria sem ninguém nunca ter olhado. */
        postCompartilhado:
          quadro === 1 && n === 0
            ? {
                id: "p0",
                autorNome: "Marina Costa",
                imagemUrl: foto(CORES[0][0], CORES[0][1], CORES[0][2]),
                texto: "o ultrassom de hoje 🍼",
              }
            : null,
        perguntaAberta: n === 2,
        /* ⚠️ **O VÍDEO só no PRIMEIRO story**, e o contraste é o ponto: os
           outros dois continuam sendo foto, e é assim que dá para ver que o
           player entra no lugar certo e que a barrinha do tempo passa a durar o
           vídeo em vez dos cinco segundos cravados. */
        videoUrl: videoStory === 1 && n === 0 ? "/sons/riacho.webm" : null,
        /* ⚠️ Idem para o véu: marcado só no primeiro. Sem a bancada, conferir
           esta tela exigiria uma conta de verdade publicando um story marcado —
           e o véu some no primeiro toque, então ainda seria preciso acertar o
           instante. */
        sensivel: sensivelStory === 1 && n === 0,
        motivoSensivel: sensivelStory === 1 && n === 0 ? "Perda gestacional" : null,
      })),
    };
    return (
      <VisorDeStory
        aoVotarNoStory={(id, o) => alert(`votaria na opção ${o} do story ${id}`)}
        /* ⚠️ A bancada GUARDA a reação em vez de dar `alert`: o que precisa ser
           olhado é o emoji acendendo e a frase mudando para "Ela vai ver na
           caixa dela" — com um alert, nada disso apareceria. */
        aoReagirAoStory={() => {}}
        aoPerguntarNoStory={async (_dona, texto) =>
          /* ⚠️ A bancada chama a MESMA triagem do servidor, e não um `alert`:
             o que precisa ser conferido aqui são os TRÊS desfechos, e inventá-los
             faria a tela ensaiar um roteiro que a régua não produz. */
          (await import("@/lib/pergunta-clinica")).triarTexto(texto) === "publicavel"
            ? null
            : recadoDoDesfecho((await import("@/lib/pergunta-clinica")).triarTexto(texto))
        }
        bolha={b}
        aoFechar={() => history.back()}
        /* ⚠️ O rodapé do "visto por" só existe no MEU story, e sem a bancada
           conferir isso exigiria publicar um story numa conta de verdade e
           conseguir que outra pessoa o visse dentro das 24 h. */
        souEu={meu}
        aoQuemViu={async () => GENTE}
        aoApagarStory={() => alert("apagaria o story")}
        /* ⚠️ A bancada RECEBE a foto e a descreve, em vez de dar `alert`: o que
           precisa ser olhado é a prévia, o × que a tira e o relógio parando —
           e nada disso apareceria com um alert. */
        aoResponderStory={(_a, _sid, texto, foto) =>
          alert(`responderia: ${JSON.stringify(texto)}${foto ? ` + foto (${foto.name})` : ""}`)
        }
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
        aoPublicar={({ texto, carimbar }) =>
          alert(`publicaria ${carimbar ? "COM" : "sem"} carimbo · texto: ${texto || "(vazio)"}`)
        }
        /* ⚠️ `?rascunhoStory=1` fabrica o rascunho guardado — o único jeito de
           fotografar a faixa "Você tinha começado um story", que no app só
           existe depois de ela digitar, sair no meio e voltar. É a mesma razão
           de sempre: sem a bancada, o estado nasce sem ninguém nunca ter
           olhado. */
        rascunho={
          rascunhoStory === 1
            ? {
                texto: "hoje o ultrassom mostrou que ela está de ponta-cabeça 🙃",
                enquete: ["vai virar", "nasce sentada"],
                perguntaAberta: false,
                carimbarSemana: true,
                em: "2026-08-25T10:00:00.000Z",
              }
            : null
        }
        /* A bancada NÃO grava: ela desenha o estado, e gravar poluiria o
           `localStorage` de quem só veio olhar. */
        aoGuardarRascunho={undefined}
      />
    );
  }

  if (tela === "arquivo") {
    /**
     * ⚠️ O arquivo só existe numa conta com stories JÁ EXPIRADOS — ou seja,
     * publicados ontem. Sem a bancada, conferir esta tela exigiria esperar 24 h
     * com uma conta de verdade, que é como uma tela nasce sem ninguém nunca ter
     * olhado.
     *
     * `?vazio=1` é quem nunca publicou · `?instavel=1` é a falha de leitura, que
     * NUNCA pode ter a cara do vazio.
     */
    return (
      <ArquivoDeStories
        stories={
          instavel === 1
            ? null
            : vazio
              ? []
              : CORES.slice(0, 7).map((c, n) => ({
                  id: `st${n}`,
                  imagemUrl: foto(c[0], c[1], c[2]),
                  texto: n === 4 ? "primeira vez que ela mexeu 🤍" : null,
                  criadoEm: atras(60 * 24 * (n + 1)),
                  /* O primeiro ainda está no ar — é o que prova a pílula. */
                  noAr: n === 0,
                  destacado: n === 1 || n === 3,
                }))
        }
        instavel={instavel === 1}
        aoVoltar={() => history.back()}
        aoDestacar={(id, v) => alert(v ? `destacaria ${id}` : `soltaria ${id}`)}
        aoTentarDeNovo={() => alert("tentaria de novo")}
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
            seguidores: null,
            seguindo: null,
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

  const filhosDaBancada = FILHOS_DE_MENTIRA[filhos] ?? undefined;

  /**
   * ⚠️ A CAIXA DE ENTRADA E A CONVERSA SÃO IMPOSSÍVEIS DE OLHAR SEM ISTO.
   * As duas falam com o servidor e exigem sessão E uma segunda conta que tenha
   * escrito para você — coisa que uma conta de teste não produz. Os três
   * arranjos abaixo são os que importam: conversa normal, pedido recebido
   * (a caixa separada) e pedido enviado (o campo travado).
   */
  const CONVERSAS_DE_MENTIRA = [
    {
      id: "c1",
      comId: "u1",
      comNome: "Marina Costa",
      comAvatar: null,
      previa: "vou levar o exame na consulta",
      ultimaEm: "2026-08-24T10:00:00Z",
      naoLida: true,
      pedido: false,
      euIniciei: false,
    },
    {
      id: "c2",
      comId: "u2",
      comNome: "Carol",
      comAvatar: null,
      previa: "oi! vi seu post 💛",
      ultimaEm: "2026-08-23T18:00:00Z",
      naoLida: true,
      pedido: true,
      euIniciei: false,
    },
    {
      id: "c3",
      comId: "u3",
      comNome: "Juliana",
      comAvatar: null,
      previa: "oi, tudo bem?",
      ultimaEm: "2026-08-22T09:00:00Z",
      naoLida: false,
      pedido: true,
      euIniciei: true,
    },
  ];

  if (tela === "comentarios") {
    /**
     * ⚠️ SEM ISTO OS COMENTÁRIOS SÃO IMPOSSÍVEIS DE OLHAR: a lista vem do
     * servidor e exige sessão MAIS um post com comentários de outras contas.
     * `?conversa=fechados` mostra o estado que a dona liga — e nele "Responder"
     * NÃO existe em linha nenhuma, que é o estado que o botão tinha de ganhar.
     */
    /* ⚠️ **A CONVERSA, O CORAÇÃO E A MARCA DE OCULTO PRECISAM ESTAR AQUI.**
       Os três só existem numa conta de verdade — com três pessoas escrevendo,
       alguém curtindo e uma restrição ativa. Sem a bancada, o estado que a
       tela passaria meses sem ninguém olhar é justamente o novo.

       ⚠️ E as duas ocultas vêm com `recolhido: true`, que é o que o servidor
       manda: sem ele a bancada desenharia o texto à mostra com uma etiqueta
       embaixo — o estado ANTIGO, que o filtro foi consertado para não ter.
       Bancada que aprova o que o servidor não produz é pior que bancada
       nenhuma. */
    const meus = [
      {
        id: "k1",
        autorId: "u1",
        autorNome: "Marina Costa",
        autorAvatar: null,
        texto: "que linda! 💛",
        criadoEm: "2026-08-24T10:00:00Z",
        possoApagar: false,
        respondeA: null,
        curtidas: 3,
        euCurti: true,
        /* ⚠️ Duas raízes com "Fixar" — é o que a produção entrega (o servidor
           dá `possoFixar` a toda raiz não-oculta), e é a única forma de ver se
           a linha de ações ainda cabe a 393px com o quarto rótulo. */
        possoFixar: true,
      },
      {
        id: "k1r1",
        autorId: "u9",
        autorNome: "Você",
        autorAvatar: null,
        texto: "obrigada, Marina 🥹",
        criadoEm: "2026-08-24T10:02:00Z",
        possoApagar: true,
        respondeA: "k1",
        curtidas: 1,
        euCurti: false,
      },
      {
        id: "k1r2",
        autorId: "u3",
        autorNome: "Ana Paula",
        autorAvatar: null,
        texto: "concordo demais",
        criadoEm: "2026-08-24T10:03:00Z",
        possoApagar: false,
        respondeA: "k1",
        curtidas: 0,
        euCurti: false,
      },
      {
        id: "k1r3",
        autorId: "u4",
        autorNome: "Bruna",
        autorAvatar: null,
        texto: "que fofa",
        criadoEm: "2026-08-24T10:04:00Z",
        possoApagar: false,
        respondeA: "k1",
        curtidas: 0,
        euCurti: false,
      },
      {
        id: "k1r4",
        autorId: "u5",
        autorNome: "Tia Zezé",
        autorAvatar: null,
        texto: "linda demais!",
        criadoEm: "2026-08-24T10:04:30Z",
        possoApagar: false,
        respondeA: "k1",
        curtidas: 0,
        euCurti: false,
      },
      {
        id: "k2",
        autorId: "u2",
        autorNome: "Carol",
        autorAvatar: null,
        texto: "também estou de 30 semanas, vamos juntas",
        criadoEm: "2026-08-24T10:05:00Z",
        possoApagar: true,
        respondeA: null,
        curtidas: 0,
        euCurti: false,
        /* ⚠️ **O SELO DE FIXADO e o "Fixar" só existem para a dona do post** —
           e a régua roda no servidor, então sem a bancada eles exigiriam uma
           publicação de verdade com um comentário de verdade fixado nela. */
        fixadoEm: "2026-08-24T11:00:00Z",
        possoFixar: true,
      },
      {
        /* ⚠️ **O NÚMERO SÓ VIRA BOTÃO PARA QUEM ESCREVEU.** Este é meu, com
           curtidas: é o único jeito de fotografar a folha "Quem curtiu". */
        id: "k5",
        autorId: "eu",
        autorNome: "Você",
        autorAvatar: null,
        texto: "obrigada, meninas 💛",
        criadoEm: "2026-08-24T10:08:00Z",
        possoApagar: true,
        respondeA: null,
        curtidas: 3,
        euCurti: false,
        souOAutor: true,
      },
      /* ⚠️ As DUAS marcas de oculto, que só a dona do post recebe — e que são
         impossíveis de fotografar sem uma restrição e um filtro ativos. */
      {
        id: "k3",
        autorId: "u6",
        autorNome: "Cunhada",
        autorAvatar: null,
        texto: "seu bebê parece pequeno pra essa idade",
        criadoEm: "2026-08-24T10:06:00Z",
        possoApagar: true,
        respondeA: null,
        curtidas: 0,
        euCurti: false,
        oculto: "restrito" as const,
        recolhido: true,
      },
      {
        id: "k4",
        autorId: "u7",
        autorNome: "Alguém",
        autorAvatar: null,
        texto: "minha prima teve isso e perdi o sono",
        criadoEm: "2026-08-24T10:07:00Z",
        possoApagar: true,
        respondeA: null,
        curtidas: 0,
        euCurti: false,
        oculto: "palavra" as const,
        recolhido: true,
      },
      /* ⚠️ **ESTE EXISTE PARA A ORDEM PODER MUDAR.** Sem um comentário TARDIO e
         MUITO curtido, as duas ordens desenham exatamente a mesma lista — os
         dados da bancada já vinham em curtidas decrescentes — e o seletor
         parecia inerte na foto. Bancada que não consegue provar o recurso é
         bancada que aprova qualquer coisa. */
      {
        id: "k5",
        autorId: "u9",
        autorNome: "Juliana",
        autorAvatar: null,
        texto: "@marina o meu passou depois da 32ª, aguenta firme 💛 #30semanas",
        criadoEm: "2026-08-24T10:30:00Z",
        possoApagar: false,
        respondeA: null,
        curtidas: 12,
        euCurti: false,
      },
    ];
    /* ⚠️ **ESCREVE O STORAGE ANTES DE MONTAR, e não num efeito.** O componente
       lê o rascunho na primeira renderização; gravado depois, a bancada
       mostraria sempre o campo vazio — que é o único estado que ela não
       precisava provar. Mesma lição da bancada do ritual de boas-vindas. */
    if (rascunhoComent) {
      try {
        localStorage.setItem(
          chaveDoRascunhoDeComentario("bancada", "00000000-0000-0000-0000-000000000001"),
          serializarRascunho("eu ia contar que comigo foi parec", new Date()),
        );
      } catch {
        /* Sem storage: a bancada abre sem o rascunho. */
      }
    }
    return (
      <div className="mx-auto max-w-[430px] pt-6">
        <Comentarios
          postId="00000000-0000-0000-0000-000000000001"
          /* ⚠️ Sem os dois, `TextoComLinks` desenha o `@` como TEXTO — e a
             bancada aprovaria uma menção que não vira link, que é justamente o
             que faltava. */
          aoAbrirArroba={(h) => alert(`abrir @${h}`)}
          aoAbrirTag={(t) => alert(`abrir #${t}`)}
          bancada={{
            comentarios: meus,
            abertos: conversa !== "fechados",
            souADona: true,
            /* ⚠️ A ordem vem por prop porque quem ordena é o SERVIDOR: sem
               sessão, trocar o seletor não recarregaria nada e a bancada
               mostraria um controle que não faz efeito. */
            ordem: ordem === "relevantes" ? ("relevantes" as const) : ("recentes" as const),
            euId: "bancada",
            curtidas: [
              { id: "u2", nome: "Carol", avatarUrl: null },
              { id: "u3", nome: "Bruna", avatarUrl: null },
              { id: "u4", nome: "Ana Paula", avatarUrl: null },
            ],
          }}
        />
      </div>
    );
  }

  if (tela === "filtro") {
    /* ⚠️ O cartão do filtro busca a lista do servidor e por isso abriria vazio
       sem sessão — e vazio é o único estado que ele NÃO precisava provar.
       `?vazio=1` mostra a lista sem nenhuma palavra. */
    return (
      <div className="mx-auto max-w-md py-4">
        <FiltroDePalavras bancada={vazio ? [] : ["perdi", "aborto", "parto normal"]} />
      </div>
    );
  }

  if (tela === "conversas") {
    /**
     * ⚠️ **A FILEIRA "MESMA FASE" É IMPOSSÍVEL DE OLHAR SEM ISTO.** Ela exige
     * DUAS contas reais na mesma fase, com perfil aberto, sem conversa entre si
     * e sem bloqueio — e a régua ainda esconde a fileira abaixo de duas
     * candidatas. `?sugeridas=0` mostra a caixa sem ela, que é o estado da
     * maioria; `?conversa=pedido` abre a caixa de pedidos, onde a fileira NÃO
     * pode aparecer.
     */
    const daFase =
      semSugestoes || conversa === "pedido"
        ? []
        : [
            {
              id: "s1",
              nome: "Marina Costa",
              avatarUrl: null,
              fase: "t2" as const,
              ultimaVez: null,
            },
            { id: "s2", nome: "Bruna", avatarUrl: null, fase: "t2" as const, ultimaVez: null },
            { id: "s3", nome: "Ana Paula", avatarUrl: null, fase: "t2" as const, ultimaVez: null },
          ];
    return (
      <div className="mx-auto max-w-[430px]">
        <CaixaDeEntrada
          aoVoltar={() => history.back()}
          aoAbrir={() => {}}
          aoFalarCom={(id, rascunho) => alert(`abriria conversa com ${id}\n\n"${rascunho}"`)}
          bancada={CONVERSAS_DE_MENTIRA}
          /* ⚠️ **AS NOTAS vivem 24 h e dependem do grafo.** Sem a bancada,
             fotografar a fileira exigiria duas contas reais e uma nota escrita
             na última hora. `?notas=1`. */
          notasDeBancada={
            notas === 1
              ? [
                  {
                    autor: { id: "eu", nome: "Você", avatarUrl: null },
                    texto: "hoje foi um dia bom 💛",
                    criadaEm: "2026-08-25T20:00:00Z",
                    souEu: true,
                  },
                  {
                    autor: { id: "u2", nome: "Carol", avatarUrl: null },
                    texto: "não consigo dormir 😅",
                    criadaEm: "2026-08-25T23:10:00Z",
                    souEu: false,
                  },
                  {
                    autor: { id: "u3", nome: "Bruna", avatarUrl: null },
                    texto: "enjoo voltou",
                    criadaEm: "2026-08-25T18:00:00Z",
                    souEu: false,
                  },
                ]
              : []
          }
          sugeridasDeBancada={daFase}
        />
      </div>
    );
  }

  if (tela === "mandar") {
    /* ⚠️ A folha só sabe desenhar com conversas que JÁ existem — e é essa a
       trava do recurso (nada de busca aqui, ou o botão de compartilhar viraria
       um segundo caminho para escrever a desconhecidas). `?vazio=1` mostra o
       estado de quem ainda não tem conversa, que é o que ensina a régua. */
    return (
      <div className="mx-auto max-w-[430px]">
        <MandarPublicacao
          /* ⚠️ `?alvo=story` mostra o título próprio do story — a mesma folha
             serve os dois, e o texto é a única coisa que muda. */
          alvo={{ tipo: quadro === 1 ? "story" : "post", id: "p1" }}
          aoFechar={() => history.back()}
          bancada={vazio ? [] : CONVERSAS_DE_MENTIRA}
        />
      </div>
    );
  }

  if (tela === "conversa") {
    /* `?conversa=pedido` mostra o campo travado de quem já mandou a sua. */
    const qual = conversa === "pedido" ? CONVERSAS_DE_MENTIRA[2] : CONVERSAS_DE_MENTIRA[0];
    return (
      <div className="mx-auto max-w-[430px]">
        <Conversa
          conversa={qual}
          aoVoltar={() => history.back()}
          bancada={{
            pedido: qual.pedido,
            euIniciei: qual.euIniciei,
            mensagens:
              conversa === "pedido"
                ? [
                    {
                      id: "m1",
                      souEu: true,
                      texto: "oi, tudo bem?",
                      criadaEm: "2026-08-22T09:00:00Z",
                      apagada: false,
                    },
                  ]
                : [
                    {
                      id: "m1",
                      souEu: false,
                      texto: "oi! como você está?",
                      criadaEm: "2026-08-24T09:00:00Z",
                      apagada: false,
                    },
                    {
                      id: "m2",
                      souEu: true,
                      texto: "melhor hoje, obrigada 💛",
                      criadaEm: "2026-08-24T09:30:00Z",
                      apagada: false,
                    },
                    {
                      id: "m3",
                      souEu: true,
                      texto: "",
                      criadaEm: "2026-08-24T09:40:00Z",
                      apagada: true,
                    },
                    {
                      id: "m4",
                      souEu: false,
                      texto: "vou levar o exame na consulta",
                      criadaEm: "2026-08-24T10:00:00Z",
                      apagada: false,
                    },
                    /* ⚠️ **O ÁUDIO precisa estar aqui, e é o que faltava.** A
                       voz no direct tinha servidor pronto e ZERO tela — nem
                       gravador, nem player — e passou despercebida justamente
                       porque a bancada não desenhava nenhuma mensagem de voz.
                       O `audioUrl` é um WAV mínimo em data URI: um endereço
                       assinado de verdade não existe sem conta. */
                    {
                      id: "m4a",
                      souEu: false,
                      texto: null,
                      audioUrl:
                        "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAgD4AAAB9AAACABAAZGF0YQAAAAA=",
                      duracaoSeg: 37,
                      criadaEm: "2026-08-24T10:05:00Z",
                      apagada: false,
                    },
                    /* ⚠️ **A FOTO, o ✓✓ e o ANEXO precisam estar aqui.** Os três
                       só existem em conversa de verdade, com upload feito e
                       carimbo de leitura — sem a bancada, o único jeito de
                       olhá-los seria duas contas reais trocando mensagem, que é
                       exatamente como uma tela passa meses sem revisão. */
                    {
                      id: "m5",
                      souEu: true,
                      texto: "olha o ultrassom de hoje 🥹",
                      criadaEm: "2026-08-24T10:20:00Z",
                      apagada: false,
                      /* ⚠️ Data URL, e nunca um endereço de fora: a bancada roda
                         na CI, que não tem rede aberta — e uma foto externa já
                         custou um mismatch de hidratação neste repo. */
                      imagemUrl: foto("#f7c8d8", "#c9e4f5", "🤍"),
                      lidaPelaOutra: true,
                    },
                    {
                      id: "m6",
                      souEu: true,
                      texto: "essa aqui me lembrou você",
                      criadaEm: "2026-08-24T10:30:00Z",
                      apagada: false,
                      refTipo: "post" as const,
                      refId: "p1",
                      lidaPelaOutra: false,
                    },
                    {
                      id: "m7",
                      souEu: false,
                      texto: "que linda 💛",
                      criadaEm: "2026-08-24T10:40:00Z",
                      apagada: false,
                      refTipo: "story" as const,
                      refId: "s1",
                    },
                    /* ⚠️ **A MENSAGEM RECOLHIDA pelo filtro de palavras DELA.**
                       Ela só nasce de uma lista de palavras escrita numa conta
                       de verdade e de uma mensagem que caia nela — sem a
                       bancada, o único jeito de olhar seria duas contas reais e
                       a palavra certa. `?oculta=1`. */
                    ...(oculta === 1
                      ? [
                          {
                            id: "m8",
                            souEu: false,
                            /* ⚠️ O texto NÃO viaja quando está recolhido — o
                               servidor manda `null`, e a bancada imita isso. */
                            texto: null,
                            criadaEm: "2026-08-24T10:50:00Z",
                            apagada: false,
                            recolhida: true,
                          },
                        ]
                      : []),
                  ],
          }}
        />
      </div>
    );
  }

  if (tela === "novo") {
    /* ⚠️ **Segura a MONTAGEM, e não a prop.** Trocar `momentoInicial` depois de
       montar não faz nada: `fotos` é semeada no INICIALIZADOR do `useState`,
       que roda uma vez só. Gatear a prop deixou o botão sumir de vez — o
       compositor montava sem foto e nunca mais relia. Quem espera é o render
       inteiro. */
    if (comFotoDeHoje && !montado) return null;
    return (
      <div className="mx-auto max-w-md py-2">
        <NovoPost
          /* A aula de hoje, para o anexo aparecer na bancada. */
          aulaDeHoje={{ tema: "nutrição" }}
          /* ⚠️ Sem um bebê NASCIDO a tira de marcos não existe — e ela é
             justamente o que precisa ser olhado. `?filhos=bebe` é o padrão
             aqui; `?filhos=gemeas` prova que a tira NÃO aparece na gestação. */
          filhosDeMentira={FILHOS_DE_MENTIRA[filhos] ?? FILHOS_DE_MENTIRA.bebe}
          momentoInicial={
            comFotoDeHoje
              ? {
                  especie: "chama",
                  numero: 12,
                  unidade: "dias seguidos",
                  chapeu: "SUA SEQUÊNCIA",
                  titulo: "12 dias seguidos 💛",
                  emoji: "🔥",
                  legenda: "",
                  textoDeShare: "",
                  arquivo: "chama",
                }
              : null
          }
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
          /* ⚠️ Sem a bancada, olhar o "então e agora" exigiria uma conta com uma
             publicação de mais de quatro semanas atrás COM foto — ou seja, um
             mês de espera. `?comparar=0` mostra o compositor sem a opção, que é
             o caso de toda conta nova. */
          paraComparar={
            semComparar
              ? []
              : CORES.slice(0, 4).map((c, i) => ({
                  id: `antigo${i}`,
                  imagemUrl: foto(c[0], c[1], c[2]),
                  criadoEm: atras(60 * 24 * (40 + i * 10)),
                }))
          }
          rascunho={
            comRascunho
              ? {
                  texto: "Consulta de hoje foi boa demais, ainda estou sorrindo",
                  visibilidade: "amigas" as const,
                  enquete: null,
                  comAula: false,
                  marcadas: ["marina"],
                  em: new Date(AGORA).toISOString(),
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
                `marcadas [${p.marcadas.join(", ")}], entao ${p.comparacaoCom ?? "—"}` +
                `\n${p.texto ?? ""}`,
            );
            return false; /* `false` mantém a tela aberta, para olhar de novo. */
          }}
        />
      </div>
    );
  }

  if (tela === "arquivados") {
    return (
      <div className="mx-auto max-w-md py-2">
        {/* ⚠️ Sem a bancada, olhar os arquivados exigiria publicar, arquivar e
            voltar numa conta de verdade. `?vazio=1` mostra a gaveta vazia, que
            é o estado da maioria. */}
        <TelaDosArquivados
          posts={vazio ? [] : POSTS.slice(0, 3)}
          aoVoltar={() => history.back()}
          aoDesarquivar={(p) => alert(`traria de volta o post ${p.id}`)}
        />
      </div>
    );
  }

  if (tela === "bloqueados") {
    /**
     * ⚠️ **A ÚNICA TELA DE SEGURANÇA DA ABA SEM BANCADA, até aqui.** Os três
     * estados que mais importam não se fabricam numa conta de teste: `?erro=1`
     * (a leitura falhou — e "você não bloqueou ninguém" sobre uma falha a faria
     * bloquear de novo), `?vazio=1` (ninguém) e o carregando.
     */
    const pessoas =
      instavel === 1
        ? ("erro" as const)
        : vazio
          ? []
          : [
              { id: "b1", nome: "Cunhada", avatarUrl: null, bio: null, sigo: null, souEu: false },
              { id: "b2", nome: "Alguém", avatarUrl: null, bio: null, sigo: null, souEu: false },
            ];
    return (
      <div className="mx-auto max-w-[430px] px-4 pt-2">
        <ListaDeBloqueados
          pessoas={pessoas}
          aoVoltar={() => history.back()}
          aoDesbloquear={(id) => alert(`desbloquearia ${id}`)}
          aoTentarDeNovo={() => alert("recarregaria a lista")}
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

  if (tela === "tag") {
    /* ⚠️ A página da `#` pede posts ao servidor e por isso mostraria "vazio"
       sem sessão — a bancada existe para o cabeçalho, a frase da régua e a
       grade poderem ser olhados sem duas contas e um post público real. */
    return (
      <div className="mx-auto max-w-md py-2">
        <TelaDaTag tag={tag} aoVoltar={() => history.back()} />
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
      {/* ⚠️ A TELA DE ESPERA, que era impossível de olhar. Ela só existe entre o
          toque no avatar e a resposta do servidor — meio segundo numa conta de
          verdade —, e era exatamente por isso que ela não existia: ninguém
          conseguia parar nela. `?tela=esboco` mostra o caso com prévia (nome e
          foto que vieram do cartão do feed) e `&vazio=1` o caso sem prévia
          nenhuma, que é o que acontece quando o perfil é aberto por um caminho
          que não passou por nenhuma lista. */}
      {tela === "esboco" ? (
        <PerfilCarregando
          esboco={vazio ? null : { id: "a", nome: "Marina Costa", avatarUrl: null, oficial: false }}
          aoVoltar={() => history.back()}
        />
      ) : tela === "perfil" ? (
        <TelaDePerfil
          perfil={perfil}
          /* ⚠️ Com `?fixados=1`, as duas PRIMEIRAS vêm fixadas — e é isso que
             prova a grade: o pino nas células e a ordem. As datas de fixação
             são cravadas (a mais recente primeiro), pela mesma razão de todas
             as datas desta bancada. */
          posts={
            vazio
              ? []
              : fixados === 1
                ? POSTS.map((p, i) =>
                    i < 2
                      ? { ...p, fixadoEm: i === 0 ? atras(30) : atras(600), souAAutora: true }
                      : p,
                  )
                : POSTS
          }
          aoVoltar={() => history.back()}
          aoSeguir={() => alert("seguir")}
          aoAbrirPost={(id) => alert(`abriria o post ${id}`)}
          aoAbrirLista={meu ? (t) => alert(`abriria ${t}`) : undefined}
          aoAbrirSalvos={meu ? () => alert("abriria os salvos") : undefined}
          aoAbrirEspelho={meu ? () => alert("abriria o espelho") : undefined}
          aoBloquear={meu ? undefined : () => alert("bloquearia")}
          /* ⚠️ Sem a bancada, olhar o seletor de motivo exigiria duas contas e
             uma denúncia de verdade — e é justamente a tela que precisa ser
             lida com calma antes de existir. */
          aoDenunciarPerfil={meu ? undefined : (m) => alert(`denunciaria o perfil por "${m}"`)}
          aoSilenciar={meu ? undefined : (v) => alert(v ? "silenciaria" : "voltaria a ouvir")}
          /* ⚠️ Sem esta prop o botão de restringir NÃO desenha, e a bancada
             aprovaria uma tela sem o controle novo — o defeito que o `@` já
             produziu uma vez aqui. */
          aoRestringir={
            meu ? undefined : (v) => alert(v ? "restringiria" : "deixaria de restringir")
          }
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
        <>
          {/* ⚠️ Na produção ele vive DENTRO de `RedeNoApp`, depois de todos os
              `if (onde.t === …) return` — ou seja, só sobre o feed. Aqui a
              bancada renderiza o MESMO componente com `bancada`, que força a
              abertura sem tocar no blob da jornada: gravar "já vi" a partir de
              uma bancada apagaria o tutorial da conta de verdade. */}
          {!!onboarding && <OnboardingDaComunidade careMode={false} bancada />}
          <TelaPrincipal
            posts={
              vazio
                ? []
                : comReacoes(
                    /* ⚠️ **O VÉU E A LEGENDA SÓ EXISTEM COM UM POST QUE OS TENHA.**
                     Sem isto a bancada desenharia o único estado que já era
                     certo — o post normal — e o recurso passaria por ela sem
                     nunca ter sido olhado. É a lição do áudio do direct, que
                     sobreviveu meses porque a bancada não desenhava nenhum. */
                    sensivel
                      ? [
                          {
                            ...POSTS[0]!,
                            id: "p-sens",
                            sensivel: true,
                            motivoSensivel: "perda",
                            texto: "hoje faz um mês. obrigada a quem ficou 💛",
                          },
                          {
                            ...POSTS[2]!,
                            id: "p-video",
                            imagemUrl: null,
                            videoUrl:
                              "data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDE=",
                            videoLegenda: "O bebê mexendo — dá para ver o pezinho na direita.",
                            texto: "olha ele hoje 🥹",
                          },
                          ...POSTS.slice(0, 3),
                        ]
                      : [...POSTS.slice(0, 4), ...extras],
                  )
            }
            stories={vazio ? [] : STORIES}
            /* ⚠️ A zona de sugestões só abre quando o feed de quem ela segue
             acabou — por isso ela aparece na bancada quando `temMais` some, ou
             seja, depois de rolar até o fim. `?sugeridas=0` mostra o feed sem
             ela; `?vazio=1` mostra a conta nova, em que a fileira de pessoas é
             a única coisa na tela. */
            sugestoes={semSugestoes ? [] : comReacoes(POSTS.slice(5, 8))}
            pessoas={semSugestoes || fase === "vazio" ? [] : GENTE}
            aoSeguirPessoa={(id) => console.log("seguiria", id)}
            /* ⚠️ **AS DUAS PRECISAM VIR DA BANCADA, e a falta delas foi medida.**
             `@` e `#` só viram link quando `TextoComLinks` recebe estes dois —
             sem eles a legenda desenha texto puro, que é exatamente o caso que
             nunca falha. A primeira verificação no navegador achou ZERO links
             na legenda com o recurso inteiro pronto: a bancada estava passando
             props num formato diferente do da produção, que é a mesma lição
             que o `memo` do cartão já custou uma medição falsa. */
            aoAbrirArroba={(h) => alert(`abriria o perfil de @${h}`)}
            aoAbrirTag={(t) => alert(`abriria a página de #${t}`)}
            /* ⚠️ **`?instavel=1` É A ÚNICA FORMA DE OLHAR A TELA DO "NÃO
             CARREGOU".** Ela só nasce de uma falha de leitura no servidor —
             bloqueio ou grafo de amizade caindo —, que não se fabrica numa
             conta de teste. Sem a bancada, o estado ficaria sem ninguém nunca
             ter olhado, que é como ele nasceu. */
            /* ⚠️ `?fechado=1` fotografa o modo "Só quem eu sigo" LIGADO — o
             estado em que a zona de sugeridas tem de sumir, e que a bancada
             nunca desenhou. Foi por essa falta que a condição invertida
             sobreviveu. */
            soSeguindo={fechado === 1}
            instavel={instavel === 1}
            aoTentarDeNovo={() => alert("recarregaria o feed")}
            /* ⚠️ O convite pelo WhatsApp depende do `referral_code` da conta, que
             nasce no servidor — sem a bancada, olhar este cartão exigiria uma
             conta de verdade. `?semcodigo=1` prova o estado em que ele NÃO
             aparece, que é o único jeito de conferir que um convite sem
             indicação nunca é oferecido. */
            convite={{ codigo: semCodigo ? null : "MARIA7X" }}
            /* ⚠️ **A MEMÓRIA só nasce de uma publicação de UM ANO ATRÁS, do
             mesmo ciclo, de quem já registrou o nascimento — e some para
             sempre depois de aparecer uma vez.** Sem a bancada, olhá-la exigiria
             uma conta com um ano de uso e acertar a janela de três dias. É o
             caso extremo do que as bancadas existem para resolver.
             ⚠️ E ela vence o lembrete e perde da retrospectiva (um cartão de
             cada vez): `?memoria=1` implica `?retro=0`. */
            memoria={
              memoria === 1
                ? {
                    post: {
                      ...POSTS[0],
                      /* ⚠️ `AGORA` cravado, nunca `Date.now()` — ver a nota do
                       lembrete logo abaixo. */
                      criadoEm: new Date(AGORA - 366 * 86_400_000).toISOString(),
                      texto: "primeira foto da barriga 🤍",
                    },
                    texto: "Há um ano, você publicou isto.",
                  }
                : null
            }
            aoVerMemoria={() => {}}
            /* ⚠️ O lembrete do "então e agora" só nasce de uma conta com uma foto
             de 28+ dias e a janela de sete dias vencida — sem a bancada,
             olhá-lo exigiria esperar um mês com uma conta de verdade.
             ⚠️ E ele NÃO aparece junto da retrospectiva (um cartão de cada
             vez), então `?entao=1` implica `?retro=0`. */
            lembreteEntao={
              entao
                ? {
                    id: "p-antigo",
                    imagemUrl: foto(CORES[2][0], CORES[2][1], CORES[2][2]),
                    /* ⚠️ **`AGORA` CRAVADO, e nunca `Date.now()`.** Esta linha
                     roda no RENDER: o servidor calcula um instante e o cliente
                     calcula outro, e o texto derivado ("há 34 dias") pode
                     divergir na virada do minuto — o React descarta a árvore e
                     redesenha. É a mesma família do mismatch que já derrubou o
                     app inteiro, e o próprio cabeçalho deste arquivo declara a
                     regra três seções acima. */
                    criadoEm: new Date(AGORA - 34 * 86_400_000).toISOString(),
                  }
                : null
            }
            aoCompararAgora={() => console.log("abriria o compositor comparando")}
            aoDispensarEntao={() => console.log("dispensou")}
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
            aoRepublicar={acoesDaBancada.republicar}
            aoCompartilhar={acoesDaBancada.compartilhar}
            aoStoryComPost={acoesDaBancada.storyComPost}
            aoFixar={acoesDaBancada.fixar}
            aoTirarMarcacao={acoesDaBancada.tirarMarcacao}
            aoEditar={acoesDaBancada.editar}
            aoVerQuemReagiu={acoesDaBancada.verQuemReagiu}
            /* ⚠️ O cartão só existe aos DOMINGOS e com semana publicada — sem a
             bancada, olhá-lo exigiria esperar o domingo certo com uma conta que
             publicou naquela semana. `?retro=0` mostra o feed sem ele (o caso
             de seis dias em sete), `?retro=1foto` prova a grade de uma foto só
             e `?retro=vazia` o cartão sem foto, que é o da semana que só virou. */
            retro={
              entao || memoria === 1 || retroModo === "0"
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
            /* ⚠️ A live vem do servidor (`listLivesPublic`), então sem a bancada
             o cartão do topo do feed seria impossível de olhar sem cadastrar
             uma live real com data no futuro — que é como um cartão passa
             meses sem ninguém nunca ter visto. `?live=agora` mostra o estado
             "ao vivo". */
            /* ⚠️ O recorte por fase é decidido no SERVIDOR (ele lê a DUM de cada
             candidata), então sem a bancada o interruptor e o vazio dele
             seriam impossíveis de olhar sem duas contas reais com DUMs
             diferentes. `?fase=1` liga; `?fase=vazio` mostra o estado em que
             ninguém corresponde — que é o que precisa continuar tendo saída. */
            mesmaFase={fase !== ""}
            aoTrocarFase={() => {}}
            live={
              live === "nao"
                ? null
                : {
                    id: "l1",
                    titulo: "Sinais de trabalho de parto: o que observar",
                    /* ⚠️ Idem — ver `AGORA`. */
                    quando: new Date(AGORA + (live === "agora" ? -5 : 5) * 60_000).toISOString(),
                    link: "https://exemplo.com/live",
                    aoVivo: live === "agora",
                  }
            }
            aoEntrarNoDesafio={(e) => alert(e ? "entraria" : "sairia")}
            aoIrParaOJogo={() => alert("iria para o Caminho")}
            /* ⚠️ Com `?fase=`, a bancada encerra a paginação: a fileira de
             sugeridas (e o interruptor do recorte) só aparece quando o feed
             acaba, e rolar três páginas para conferir um interruptor é como
             uma tela passa meses sem ninguém nunca ter olhado. */
            temMais={!vazio && paginas < 3 && fase === ""}
            aoChegarNoFim={() => {
              setExtras((e) => [...e, ...maisUmaPagina(4, paginas + 1)]);
              setPaginas((n) => n + 1);
            }}
          />
        </>
      )}
      {vendoQuemReagiu && (
        <FolhaDeQuemReagiu
          gente={[
            /* ⚠️ O selo do médico só existe numa conta vinculada a um obstetra que
               por acaso reagiu — sem a bancada, seria impossível olhar. */
            { id: "doc", nome: "Dr. Clóvis", avatarUrl: null, emoji: "❤️", ehMeuMedico: true },
            { id: "marina", nome: "Marina Costa", avatarUrl: null, emoji: "🤗" },
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
