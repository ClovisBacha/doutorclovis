import { createFileRoute } from "@tanstack/react-router";

import { ContracoesTab } from "@/components/contracoes-tab";

/**
 * BANCADA DO CRONÔMETRO DE CONTRAÇÕES.
 *
 * ⚠️ Esta era a tela clínica mais consequente do app SEM NENHUMA bancada — e é
 * onde o CLAUDE.md registra o defeito que silenciava o botão do 192: a leitura
 * falhando virava "ela não cronometrou nada", e o banner de análise, que é o
 * único lugar da tela com "Ligar 192 (SAMU)", vive atrás de duas contrações na
 * janela. Sem foto, o conserto disso nunca foi OLHADO.
 *
 * Os estados que uma conta de teste não fabrica:
 *   `?estado=vazio`     — ela nunca cronometrou (o padrão)
 *   `?estado=instavel`  — a leitura falhou; o 192 tem de aparecer mesmo assim
 *   `?estado=parto`     — padrão de trabalho de parto (o caso vermelho)
 *   `?estado=cinco`     — 5-1-1 SUSTENTADO por uma hora (o "alerta")
 *   `?estado=seis`      — seis contrações numa hora, de 11 em 11 min
 *   `?estado=curso`     — uma contração ABERTA, retomada do banco
 *   `?estado=normal`    — contrações espaçadas, sem alarme
 *
 * ⚠️ `?w=` é a semana, e ela decide QUAL RÉGUA vale — não só o texto:
 *   `?w=16`  sem régua de trabalho de parto
 *   `?w=31`  pré-termo: nenhuma frase de sossego, em nenhum estado
 *   `?w=39`  termo: é a única faixa em que o 5-1-1 aparece
 *   `?w=41`  pós-termo: o cronômetro deixa de ser a resposta
 *   `?w=`    sem semana: cai na régua mais cuidadosa (a de pré-termo)
 *
 * ⚠️ **E A BANCADA PASSOU A CRAVAR O "AGORA".** Ela tinha um defeito por
 * construção: a janela de análise é relativa ao relógio, e a âncora dos dados
 * era uma data fixa. No dia em que ela foi escrita as duas coincidiam; três
 * dias depois a janela ficou VAZIA, e o banner de análise — que é o único
 * lugar desta tela com o botão do 192, e a razão inteira de ela existir —
 * parou de ser desenhado, em silêncio. Cravar as duas pontas é o que faz a
 * bancada continuar provando o recurso amanhã.
 */
export const Route = createFileRoute("/preview-contracoes")({
  validateSearch: (q: Record<string, unknown>) => ({
    /* ⚠️ `== null` e nunca `=== undefined`: o router serializa e revalida, e na
       segunda passada chega `null` — `Number(null)` é 0, que aqui viraria uma
       gestante de zero semanas. É a armadilha que `preview-saude` documenta.
       ⚠️ E `?w=` VAZIO é um estado de verdade nesta tela — é a gestante sem
       DUM, que cai na régua mais cuidadosa —, então ele vira `null` em vez de
       cair no padrão. */
    /* ⚠️ **O ESTADO "SEM DUM" PEDE UM SENTINELA, e não um parâmetro vazio.**
       Medido: o router DESCARTA `?w=` antes de `validateSearch` ver, e a URL
       volta normalizada com o padrão — ou seja, o estado que mais importa aqui
       (a gestante sem semana, para quem a régua não pode calar) era impossível
       de fotografar, e a bancada mostrava um estado que ela não estava
       provando. `?w=sem` é explícito e sobrevive à revalidação. */
    w: q.w == null || q.w === "" ? 34 : Number(q.w),
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
    meta: [{ title: "Bancada das contrações" }, { name: "robots", content: "noindex" }],
  }),
  component: Pagina,
});

/* ⚠️ Instantes CRAVADOS a partir de uma âncora fixa, nunca `Date.now()` no
   render: servidor e cliente calculam instantes diferentes e o texto derivado
   ("há 3 min") diverge — o React descarta a árvore. É o mismatch de hidratação
   que já derrubou este app inteiro uma vez. */
const ANCORA = new Date("2026-09-05T14:20:00-03:00").getTime();

function linha(minAtras: number, duracaoSeg: number | null, intensidade: number) {
  const inicio = new Date(ANCORA - minAtras * 60000);
  return {
    id: `c-${minAtras}`,
    started_at: inicio.toISOString(),
    ended_at:
      duracaoSeg == null ? null : new Date(inicio.getTime() + duracaoSeg * 1000).toISOString(),
    intensity: intensidade,
  };
}

function montar(estado: string) {
  const agora = ANCORA;
  if (estado === "instavel") return { contractions: [], instavel: true, agora };
  if (estado === "parto")
    /* De 3 em 3 minutos, 65 s cada — o caso urgente, e o único caminho que
       desenha os dois botões de ligar. */
    return {
      contractions: [0, 3, 6, 9, 12, 15, 18].map((m, i) => linha(m, 60 + (i % 3) * 5, 3)),
      agora,
    };
  if (estado === "cinco")
    /* ⚠️ TREZE contrações de cinco em cinco: sessenta e cinco minutos. É o que
       o "1" final do padrão combinado quer dizer, e é o estado que separa
       "perto do padrão" de "o padrão se manteve por uma hora" — a informação
       que quase nenhum app do gênero mostra. */
    return {
      contractions: Array.from({ length: 13 }, (_, i) => linha(i * 5, 50, 2)),
      agora,
    };
  if (estado === "seis")
    /* Seis em 55 minutos, de 11 em 11: o intervalo NÃO dispara (11 > 10) e a
       contagem da hora dispara. É o caso que separa as duas réguas do NICHD. */
    return { contractions: [0, 11, 22, 33, 44, 55].map((m) => linha(m, 40, 2)), agora };
  if (estado === "curso")
    return { contractions: [linha(0, null, 2), linha(9, 45, 2), linha(19, 40, 2)], agora };
  if (estado === "normal")
    return { contractions: [linha(5, 35, 1), linha(35, 30, 1), linha(70, 28, 2)], agora };
  if (estado === "episodios")
    /* ⚠️ **A LISTA MOSTRA AS DEZ ÚLTIMAS, E ELAS SÃO REGISTRADAS EM EPISÓDIOS.**
       Quem cronometrou uma noite de Braxton-Hicks anteontem e voltou a
       cronometrar hoje vê as duas misturadas — e a hora sozinha em cada linha
       AFIRMA que tudo foi hoje. Nenhum outro estado desta bancada atravessa
       dias, então este é o único que prova a data na linha e o intervalo em
       horas. A janela da análise continua sendo de duas horas, então a régua
       clínica não muda: o que este estado exercita é a LISTA. */
    return {
      contractions: [
        linha(6, 40, 2),
        linha(24, 38, 2),
        linha(41, 35, 1),
        ...[0, 9, 18, 27, 36, 45].map((m) => linha(60 * 38 + m, 32, 1)),
      ],
      agora,
    };
  return { contractions: [], agora };
}

function Pagina() {
  const { w: wBruto, semdum, estado } = Route.useSearch();
  const w = semdum ? null : wBruto;
  return (
    <div className="fixed inset-0 z-[50] overflow-y-auto bg-background px-4 py-5">
      <p className="mb-1 font-serif text-xl">Contrações</p>
      <p className="mb-4 text-xs text-muted-foreground">
        estado: {estado} · semana {w != null && Number.isFinite(w) ? w : "—"}
      </p>
      <ContracoesTab
        weeks={w != null && Number.isFinite(w) ? w : null}
        onNavigate={() => {}}
        bancada={montar(estado)}
      />
    </div>
  );
}
