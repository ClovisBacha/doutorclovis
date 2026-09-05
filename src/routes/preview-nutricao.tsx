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
 *
 * E `?w=` muda o trimestre (chips e nutrientes), `?luto=1` liga o Modo Cuidado
 * — onde o cartão de nutrientes, os chips e a semana somem —, `?agua=5` põe
 * cinco copos no contador e `?ferramenta=comer|prato|alivio` abre o painel
 * daquela ferramenta (os dois dependem de `localStorage` e de um toque).
 */
export const Route = createFileRoute("/preview-nutricao")({
  validateSearch: (q: Record<string, unknown>) => ({
    /* ⚠️ `== null` e nunca `=== undefined`: o router serializa e revalida, e na
       segunda passada chega `null` — `Number(null)` é 0. */
    w: q.w == null || q.w === "" ? 24 : Number(q.w),
    estado: q.estado == null ? "saudacao" : String(q.estado),
    luto: q.luto == null ? false : Boolean(q.luto),
    agua: q.agua == null || q.agua === "" ? 0 : Number(q.agua),
    ferramenta: q.ferramenta == null ? "" : String(q.ferramenta),
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
  const { w, estado, luto, agua, ferramenta } = Route.useSearch();

  const bancada =
    estado === "conversa"
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
    ferramenta: (["comer", "prato", "alivio"].includes(ferramenta) ? ferramenta : undefined) as
      | "comer"
      | "prato"
      | "alivio"
      | undefined,
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <p className="mb-4 text-xs text-muted-foreground">
        Bancada · estado <strong>{estado}</strong> · semana <strong>{w}</strong>
        {luto ? " · Modo Cuidado" : ""}
      </p>
      <NutricaoTab
        gest={{ weeks: w, days: 0, totalDays: w * 7 } as never}
        profile={
          {
            id: "b",
            display_name: "Ana Souza",
            baby_name: "Helena",
            lmp_date: null,
            due_date: null,
            reference_date: null,
            reference_weeks: null,
            reference_days: null,
          } as never
        }
        careMode={luto}
        bancada={{ ...(bancada ?? {}), ...extras }}
      />
    </div>
  );
}
