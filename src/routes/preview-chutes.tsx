import { createFileRoute } from "@tanstack/react-router";

import { KicksTab, type KickSession } from "@/components/kicks-tab";
import { PREFIXO_LOCAL, type SessaoPendente } from "@/lib/fila-de-chutes";

/**
 * BANCADA DO CONTADOR DE MOVIMENTOS.
 *
 * ⚠️ Esta tela MEDE um dos nove sintomas VERMELHOS de `triage.ts` — redução de
 * movimentos fetais — e era a única das cinco que o coração abre sem NENHUMA
 * bancada. O estado que mais importa, "duas horas com quatro movimentos", pedia
 * uma conta de verdade e um dedo tocando por duas horas; foi por isso que a tela
 * passou meses anunciando "o ideal é sentir 10 em até 2 horas" sem fazer nada
 * quando o prazo passava.
 *
 * Os estados que uma conta de teste não fabrica:
 *   `?estado=vazio`     — ela nunca contou (o padrão)
 *   `?estado=instavel`  — a leitura falhou; NÃO pode virar "nunca registrou"
 *   `?estado=instavel-historico` — a recarga falhou COM histórico em mãos
 *   `?estado=alerta`    — 2h05 com 4 movimentos: o caso vermelho, com o 192
 *   `?estado=contando`  — sessão em curso dentro do prazo, sem alarme
 *   `?estado=historico` — sessões anteriores, os três cartões
 *   `?estado=serie`     — doze contagens: o gráfico com a faixa do "seu normal"
 *   `?estado=longo`     — 14 noites: o corte da lista e o que ficou de fora
 *   `?estado=pendente`  — uma contagem salva no aparelho que ainda não subiu
 *   `?estado=luto`      — Modo Cuidado
 *
 * ⚠️ `?w=` é a semana. Antes da 26ª a tela não fala de contagem (SOGC 2023);
 * o PISO NUMÉRICO continua em 28. E `?w=` VAZIO é um estado de verdade: é a
 * gestante sem DUM, para quem a régua NÃO pode calar — era falha aberta no
 * eixo que mais importa, e é impossível de fotografar sem este parâmetro.
 */
export const Route = createFileRoute("/preview-chutes")({
  validateSearch: (q: Record<string, unknown>) => ({
    /* ⚠️ `== null` e nunca `=== undefined`: o router serializa e revalida, e na
       segunda passada chega `null` — `Number(null)` é 0, que aqui viraria uma
       gestante de zero semanas. É a armadilha que `preview-saude` documenta. */
    /* ⚠️ **O ESTADO "SEM DUM" PEDE UM SENTINELA, e não um parâmetro vazio.**
       Medido: o router DESCARTA `?w=` antes de `validateSearch` ver, e a URL
       volta normalizada com o padrão — ou seja, o estado que mais importa aqui
       (a gestante sem semana, para quem a régua não pode calar) era impossível
       de fotografar, e a bancada mostrava um estado que ela não estava
       provando. `?w=sem` é explícito e sobrevive à revalidação. */
    w: q.w == null || q.w === "" ? 32 : Number(q.w),
    /* ⚠️ **O ESTADO "SEM DUM" PRECISOU DE UM PARÂMETRO PRÓPRIO.**
       Medido: o router DESCARTA `?w=` antes de `validateSearch` ver, e a URL
       volta normalizada com o padrão; `?w=sem` também não sobrevive à
       revalidação. Ou seja, o estado que mais importa aqui — a gestante sem
       semana, para quem a régua NÃO pode calar — era impossível de fotografar,
       e a bancada mostrava um estado que ela não estava provando. Booleano
       sobrevive: é o mesmo caminho do `?luto=`. */
    semdum: q.semdum == null ? false : Boolean(q.semdum),
    estado: q.estado == null ? "vazio" : String(q.estado),
  }),
  head: () => ({
    meta: [{ title: "Bancada dos chutes" }, { name: "robots", content: "noindex" }],
  }),
  component: Pagina,
});

/* ⚠️ Instantes CRAVADOS a partir de uma âncora fixa, nunca `Date.now()` no
   render: servidor e cliente calculam instantes diferentes e o texto derivado
   diverge — o React descarta a árvore. Mesma regra da bancada das contrações. */
const ANCORA = new Date("2026-09-05T21:40:00-03:00").getTime();

/**
 * ⚠️ **`strength` ENTROU NO HELPER, e sem ela os chips de força nunca tinham
 * sido fotografados.** A coluna é lida pela lista (é o eixo com aOR 2,53), e a
 * bancada gravava `undefined` em todas as linhas — ou seja, ela desenhava o
 * único estado que não precisava provar: o de um banco anterior a set/2026.
 */
function sessao(hMin: number, chutes: number, duracaoMin: number, forca?: number): KickSession {
  const ini = ANCORA - hMin * 60000;
  return {
    id: `s${hMin}`,
    started_at: new Date(ini).toISOString(),
    ended_at: new Date(ini + duracaoMin * 60000).toISOString(),
    kick_count: chutes,
    strength: forca ?? null,
  };
}

/* Doze contagens de verdade: mediana em ~11 min, com uma noite de 34 que é o
   ponto que a faixa existe para deixar visível. */
const SERIE: KickSession[] = [
  [60 * 24 * 12, 10, 9],
  [60 * 24 * 11, 10, 12],
  [60 * 24 * 10, 10, 10],
  [60 * 24 * 9, 10, 13],
  [60 * 24 * 8, 10, 11],
  [60 * 24 * 7, 10, 8],
  [60 * 24 * 6, 10, 12],
  [60 * 24 * 5, 10, 10],
  [60 * 24 * 4, 10, 14],
  [60 * 24 * 3, 10, 11],
  [60 * 24 * 2, 10, 9],
  [60 * 24 * 1, 10, 34],
]
  .map(([h, c, d]) => sessao(h, c, d))
  /* ⚠️ **DECRESCENTE, porque é assim que a produção entrega.** `load()` pede
     `order("started_at", { ascending: false })` e o componente desenha a lista
     na ordem em que a recebe: com a lista crescente, a bancada mostrava o
     histórico de cabeça para baixo — um arranjo que o app nunca produz. A fita
     do alto não muda (a régua reordena por conta própria), e é justamente por
     isso que só a FOTO pegava. */
  .reverse();

/* ⚠️ **O CASO QUE A FITA EXISTE PARA NÃO ERRAR, e que nenhum outro estado
   desta bancada produzia.** Doze contagens normais e a de ONTEM com seis
   movimentos em duas horas — exatamente o que dispara o alerta vermelho. Antes
   da régua `ultimaContagem`, "A última" mostrava os 34 min de anteontem e a
   frase dizia "A última ficou dentro dele.". No `HISTORICO` a incompleta é a
   MAIS ANTIGA, então ela nunca provou nada disto. */
const ULTIMA_INCOMPLETA: KickSession[] = [sessao(60 * 20, 6, 120), ...SERIE];

const HISTORICO: KickSession[] = [
  sessao(60 * 20, 10, 24, 2),
  sessao(60 * 44, 10, 31, 1),
  sessao(60 * 68, 10, 18, 3),
  /* ⚠️ A noite do alarme: duas horas com sete movimentos. É ela que prova o
     chip âmbar — antes, esta linha saía com o mesmo azul-pálido de uma noite
     em que ela simplesmente encerrou cedo. */
  sessao(60 * 92, 7, 120),
];

/* ⚠️ **A CONTAGEM QUE AINDA NÃO SUBIU.** Ela é salva no aparelho no instante
   do encerramento e sobe quando a rede volta (ver `fila-de-chutes.ts`) — então
   só existe entre um `insert` que falhou e o próximo que der certo, o que é
   impossível de fabricar numa conta de teste sem derrubar a rede na mão. Sem
   este estado, a linha que diz "salva no seu celular" e o desfecho dela nunca
   seriam olhados: é como a fila funcionaria por dentro e mentiria por fora. */
const PENDENTE: SessaoPendente[] = [
  {
    id: `${PREFIXO_LOCAL}1`,
    started_at: new Date(ANCORA - 40 * 60000).toISOString(),
    ended_at: new Date(ANCORA - 18 * 60000).toISOString(),
    kick_count: 10,
    strength: 2,
    tentativas: 1,
  },
];

/* ⚠️ Catorze noites: o único estado que prova o corte da lista e a frase que
   diz o que ficou de fora. Com dez ou menos, o corte é invisível. */
const LONGO: KickSession[] = Array.from({ length: 14 }, (_, i) =>
  sessao(60 * 24 * (i + 1), 10, 9 + (i % 5), (i % 3) + 1),
);

function Pagina() {
  const { w: wBruto, semdum, estado } = Route.useSearch();
  const w = semdum ? null : wBruto;
  const luto = estado === "luto";

  const bancada =
    estado === "instavel"
      ? { history: [], instavel: true }
      : estado === "instavel-historico"
        ? /* ⚠️ A recarga que falha COM histórico em mãos: sem este estado, a
             faixa discreta que diz "a sua contagem foi salva" não teria como
             ser fotografada — e ela é o conserto de uma leitura que fazia a
             paciente gravar duas vezes. */
          { history: HISTORICO, instavel: true }
        : estado === "alerta"
          ? /* ⚠️ O estado que a tela existe para provar: passou das duas horas com
             menos de dez. O aviso e o 192 têm de estar na tela. */
            { history: HISTORICO, ativa: { count: 4, minutos: 125 } }
          : estado === "contando"
            ? { history: HISTORICO, ativa: { count: 3, minutos: 18 } }
            : estado === "historico"
              ? { history: HISTORICO }
              : estado === "serie"
                ? { history: SERIE }
                : estado === "longo"
                  ? { history: LONGO }
                  : estado === "ultima-incompleta"
                    ? { history: ULTIMA_INCOMPLETA }
                    : estado === "pendente"
                      ? { history: HISTORICO, pendentes: PENDENTE }
                      : { history: [] };

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <p className="mb-4 text-xs text-muted-foreground">
        Bancada · estado <strong>{estado}</strong> · semana <strong>{w}</strong>
      </p>
      <KicksTab
        weeks={w}
        babyName="Helena"
        careMode={luto}
        onNavigate={() => {}}
        bancada={bancada}
      />
    </div>
  );
}
