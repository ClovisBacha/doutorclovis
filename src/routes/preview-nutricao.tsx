import { createFileRoute } from "@tanstack/react-router";

import { NutricaoTab } from "@/components/nutricao-tab";
import type { ChatMsg } from "@/routes/_authenticated/minha-conta";

/**
 * BANCADA DA NUTRICIONISTA VIRTUAL.
 *
 * ⚠️ É a única tela da grade da Saúde que é CONVERSA, e a que tinha menos
 * chance de ser olhada: a saudação depende do trimestre, os chips mudam com
 * ele, o 👎 tem TRÊS desfechos, e os dois estados que mais importam — a bolha
 * vazia do "…" e a mensagem de erro do fluxo — só nascem de uma cota estourada
 * ou de uma falha de rede no instante certo.
 *
 * Os estados:
 *   `?estado=saudacao`   — como ela abre (o padrão): nutrientes e chips
 *   `?estado=conversa`   — pergunta, resposta e o 👍👎 ainda por votar
 *   `?estado=votou`      — os TRÊS desfechos do voto, um por resposta:
 *                            👍 · 👎 que o servidor NÃO confirmou · 👎 na fila
 *   `?estado=carregando` — ⚠️ a bolha vazia: ela renderiza "…" e é
 *                            indistinguível de um "…" que nunca termina
 *   `?estado=erro`       — o aviso do servidor virando bolha
 *   `?estado=foto`       — ⚠️ a resposta da FOTO na conversa: ela nasce de um
 *                            seletor de arquivo e de uma chamada de visão, ou
 *                            seja, é impossível de fotografar sem tirar uma
 *                            foto de um prato de verdade
 *
 * `?bloqueio=sem_premium` mostra a porta do Premium (com o botão) e
 * `?bloqueio=teto_diario` a do teto de hoje — as duas só nascem de um 402 do
 * servidor. `?amostra=2` põe o aviso de quantas perguntas grátis sobram, que
 * chega num cabeçalho de resposta e por isso não se fabrica sem conversar.
 *
 * E `?w=` muda o trimestre (chips e nutrientes), `?luto=1` liga o Modo Cuidado
 * — onde o cartão de nutrientes, os chips e a semana somem —, `?agua=5` põe
 * cinco copos no contador e `?ferramenta=comer|prato|alivio|casa` abre o painel
 * daquela ferramenta (os dois dependem de `localStorage` e de um toque).
 *
 * ⚠️ `?receita=` é a PRESCRIÇÃO (o campo livre de `medications`), e não a lista
 * pronta: é ela que `itensDaPrescricao` tem de saber recortar, e cravar a lista
 * aprovaria um recorte que a produção nunca faz. `?painel=1` abre a conversa em
 * TELA CHEIA (a forma do celular — a 393px de largura; no computador é a caixa). `?tomados=` marca o que já foi
 * tomado hoje (vive no `localStorage`), e `?hora=` crava o relógio DELA — sem
 * ele, o convite do momento muda de texto conforme a hora em que se fotografa,
 * e duas fotos deixam de ser comparáveis.
 */
export const Route = createFileRoute("/preview-nutricao")({
  validateSearch: (q: Record<string, unknown>) => ({
    /* ⚠️ `== null` e nunca `=== undefined`: o router serializa e revalida, e na
       segunda passada chega `null` — `Number(null)` é 0. */
    /* ⚠️ `?w=` VAZIO é um estado de verdade: é a gestante sem DUM, e a frase
       da semana NÃO pode aparecer para ela — uma frase genérica com cara de
       personalizada ensina que o "para a sua semana" não quer dizer nada.
       Sem este parâmetro o estado seria impossível de fotografar. */
    /* ⚠️ **O ESTADO "SEM DUM" PEDE UM SENTINELA, e não um parâmetro vazio.**
       Medido: o router DESCARTA `?w=` antes de `validateSearch` ver, e a URL
       volta normalizada com o padrão — ou seja, o estado que mais importa aqui
       (a gestante sem semana, para quem a régua não pode calar) era impossível
       de fotografar, e a bancada mostrava um estado que ela não estava
       provando. `?w=sem` é explícito e sobrevive à revalidação. */
    w: q.w == null || q.w === "" ? 24 : Number(q.w),
    /* ⚠️ **O ESTADO "SEM DUM" PRECISOU DE UM PARÂMETRO PRÓPRIO.**
       Medido: o router DESCARTA `?w=` antes de `validateSearch` ver, e a URL
       volta normalizada com o padrão; `?w=sem` também não sobrevive à
       revalidação. Ou seja, o estado que mais importa aqui — a gestante sem
       semana, para quem a régua NÃO pode calar — era impossível de fotografar,
       e a bancada mostrava um estado que ela não estava provando. Booleano
       sobrevive: é o mesmo caminho do `?luto=`. */
    semdum: q.semdum == null ? false : Boolean(q.semdum),
    estado: q.estado == null ? "saudacao" : String(q.estado),
    luto: q.luto == null ? false : Boolean(q.luto),
    agua: q.agua == null || q.agua === "" ? 0 : Number(q.agua),
    ferramenta: q.ferramenta == null ? "" : String(q.ferramenta),
    receita: q.receita == null ? "" : String(q.receita),
    tomados: q.tomados == null ? "" : String(q.tomados),
    /* ⚠️ `-1` e não `0`: zero é meia-noite, uma hora legítima. */
    hora: q.hora == null || q.hora === "" ? -1 : Number(q.hora),
    /* O painel da conversa em TELA CHEIA. Só existe no celular e só nasce de
       um toque (mandar a primeira pergunta) — sem isto a forma que a paciente
       de fato usa seria impossível de fotografar. */
    painel: q.painel == null ? false : Boolean(q.painel),
    /* ⚠️ A PORTA FECHADA só nasce de um 402 do servidor — fotografá-la numa
       conta real exigiria gastar o teto de dez perguntas do dia, ou não
       assinar e queimar a amostra da semana. `sem_premium` é o cartão com o
       botão; `teto_diario` é o que a assinante vê. */
    bloqueio: q.bloqueio == null ? "" : String(q.bloqueio),
    /* Quantas sobram da amostra: o número chega num CABEÇALHO de resposta, ou
       seja só existe depois de uma conversa de verdade contra o banco. `-1` é
       "não sei", que é o estado em que a linha não aparece. */
    amostra: q.amostra == null || q.amostra === "" ? -1 : Number(q.amostra),
    /* ⚠️ O PÓS-PARTO: `?pos=N` são os dias de vida do bebê. A tela deriva a
       idade de `birth_date` contra HOJE, e cravar só a data faria a frase
       mudar a cada semana (a armadilha da bancada das contrações) — então as
       DUAS pontas são cravadas: nascimento fixo, e `hoje` = nascimento + N.
       `-1` é "não pariu". */
    pos: q.pos == null || q.pos === "" ? -1 : Number(q.pos),
  }),
  head: () => ({
    meta: [{ title: "Bancada da nutrição" }, { name: "robots", content: "noindex" }],
  }),
  component: Pagina,
});

const PERGUNTA = "Quanta proteína preciso por dia?";
const RESPOSTA =
  "No segundo trimestre a recomendação fica em torno de 1,1 g por quilo de peso " +
  "por dia — para 68 kg, algo perto de 75 g. Ovo, frango, feijão com arroz, " +
  "iogurte e queijo branco cobrem isso sem esforço. Se você está enjoada, " +
  "prefira porções menores ao longo do dia.";

/* ⚠️ A SAUDAÇÃO NÃO ENTRA AQUI — o componente a deriva do perfil e do Modo
   Cuidado, e é justamente essa derivação que a bancada precisa exercitar. */
const CONVERSA: ChatMsg[] = [
  { role: "user", content: PERGUNTA },
  { role: "assistant", content: RESPOSTA },
];

/* ⚠️ O que entra no histórico é o TÍTULO da foto, nunca a imagem: é o que
   mantém `/api/nutrition` recebendo só texto. */
const FOTO: ChatMsg[] = [
  { role: "user", content: "📷 Foto do meu prato" },
  {
    role: "assistant",
    content:
      "Vejo arroz, feijão, um bife grelhado e duas rodelas de tomate.\n\n" +
      "**O que já está bom:** o feijão com arroz junto é uma dupla que aproveita " +
      "muito melhor o ferro do que os dois separados, e a carne ajuda no mesmo " +
      "caminho.\n\n" +
      "Para a próxima, duas ideias:\n" +
      "• Uma verdura de folha escura ao lado (couve refogada, agrião) — elas " +
      "trazem folato e cabem no mesmo prato.\n" +
      "• Um pedaço de laranja ou meio limão espremido no feijão: a vitamina C " +
      "faz o ferro do feijão render mais.",
  },
];

/* A miniatura da bancada: um SVG inline com cara de prato — a de verdade
   nasce de um seletor de arquivo, e um data URL de SVG desenha num <img>
   exatamente como o WebP que a tela gera. */
const MINIATURA =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 240">' +
      '<rect width="320" height="240" fill="#e7d9c6"/>' +
      '<circle cx="160" cy="120" r="96" fill="#fbf7ef" stroke="#d6c7b0" stroke-width="6"/>' +
      '<ellipse cx="128" cy="112" rx="42" ry="30" fill="#f2e6c7"/>' +
      '<ellipse cx="196" cy="128" rx="38" ry="26" fill="#6b4a2f"/>' +
      '<circle cx="164" cy="92" r="14" fill="#d94a3d"/>' +
      "</svg>",
  );

/* Três respostas para caber os três desfechos do voto na mesma foto. */
const TRES: ChatMsg[] = [
  { role: "user", content: PERGUNTA },
  { role: "assistant", content: RESPOSTA },
  { role: "user", content: "Posso comer salmão?" },
  {
    role: "assistant",
    content: "Pode, até duas porções por semana, sempre bem cozido.",
  },
  { role: "user", content: "E atum enlatado?" },
  {
    role: "assistant",
    content: "Melhor evitar o atum de olhos grandes pelo mercúrio; o skipjack é mais seguro.",
  },
];

function Pagina() {
  const {
    w: wBruto,
    semdum,
    estado,
    luto,
    agua,
    ferramenta,
    receita,
    tomados,
    hora,
    painel,
    bloqueio,
    amostra,
    pos,
  } = Route.useSearch();
  const w = semdum ? null : wBruto;
  /* Nascimento fixo; o "hoje" anda com `pos`. Os dois em UTC para a soma de
     dias não atravessar horário de verão. */
  const NASCIMENTO = "2026-08-01";
  const hojeDoPos =
    pos >= 0 ? new Date(Date.UTC(2026, 7, 1 + pos)).toISOString().slice(0, 10) : undefined;

  const bancada =
    estado === "foto"
      ? { mensagens: FOTO, fotos: { 1: MINIATURA } }
      : estado === "conversa"
        ? { mensagens: CONVERSA }
        : estado === "votou"
          ? { mensagens: TRES, votos: { 2: true, 4: false, 6: "fila" as const } }
          : estado === "carregando"
            ? {
                mensagens: [CONVERSA[0], { role: "assistant" as const, content: "" }],
                carregando: true,
              }
            : estado === "erro"
              ? {
                  mensagens: [
                    CONVERSA[0],
                    {
                      role: "assistant" as const,
                      content: "Você atingiu o limite de mensagens de hoje. Tente de novo amanhã.",
                    },
                  ],
                }
              : undefined;
  const extras = {
    agua,
    ferramenta: (["comer", "prato", "alivio", "casa"].includes(ferramenta)
      ? ferramenta
      : undefined) as "comer" | "prato" | "alivio" | "casa" | undefined,
    suplementos: tomados ? tomados.split(",").filter(Boolean) : undefined,
    hora: hora >= 0 && hora <= 23 ? hora : undefined,
    aberta: painel,
    bloqueio: (["sem_premium", "teto_diario"].includes(bloqueio) ? bloqueio : undefined) as
      | "sem_premium"
      | "teto_diario"
      | undefined,
    amostra: amostra >= 0 ? amostra : undefined,
    hoje: hojeDoPos,
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <p className="mb-4 text-xs text-muted-foreground">
        Bancada · estado <strong>{estado}</strong> · semana <strong>{w ?? "—"}</strong>
        {luto ? " · Modo Cuidado" : ""}
        {hora >= 0 ? ` · ${String(hora).padStart(2, "0")}h` : ""}
        {receita ? " · com prescrição" : ""}
        {pos >= 0 ? ` · bebê com ${pos} dias` : ""}
      </p>
      <NutricaoTab
        /* ⚠️ `gest` NULO quando a semana falta — é assim que a produção chega
           aqui quando não há DUM, e é o estado que a frase da semana precisa
           calar. */
        gest={w == null ? null : ({ weeks: w, days: 0, totalDays: w * 7 } as never)}
        profile={
          {
            id: "b",
            display_name: "Ana Souza",
            baby_name: "Helena",
            medications: receita || null,
            birth_date: pos >= 0 ? NASCIMENTO : null,
            lmp_date: null,
            due_date: null,
            reference_date: null,
            reference_weeks: null,
            reference_days: null,
          } as never
        }
        careMode={luto}
        /* ⚠️ SEM ISTO O BOTÃO DO PREMIUM NÃO É DESENHADO — ele só existe quando
           há para onde ir, e a bancada aprovaria um cartão sem saída. O toque
           cai na régua de canal de verdade (hoje: "a compra ainda não está
           aberta"), que é o que a produção faz. */
        aoAssinar={() => {}}
        bancada={{ ...(bancada ?? {}), ...extras }}
      />
    </div>
  );
}
