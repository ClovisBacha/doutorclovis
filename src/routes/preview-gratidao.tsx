import { createFileRoute } from "@tanstack/react-router";
import { GratitudeBlock } from "@/components/gestacao-path";
import { PREFIXO_GRATIDAO } from "@/lib/gratidao";

/**
 * Bancada da GRATIDÃO.
 *
 * A tela vive atrás do login e quase tudo que mudou nela depende do DIÁRIO da
 * paciente: a releitura ("há um mês você agradeceu por…"), o contador, a lista
 * e a carta que sai dela. Conferir isso numa conta de verdade exigiria semanas
 * de uso — e foi por essa tela ser impossível de olhar que ela ficou tanto
 * tempo sendo um `textarea` com cinco fichinhas fixas.
 *
 * ⚠️ O microfone não aparece aqui a menos que o navegador realmente grave
 * (`podeGravar`), e o Chromium sem permissão de mídia não grava. Isso é de
 * propósito: é o mesmo caminho do aparelho dela.
 *
 * Parâmetros:
 *   `?w=20`      semana gestacional — muda o grupo de perguntas
 *   `?pos=1`     pós-parto
 *   `?dia=3`     gira a pergunta do dia (é `dia % n`)
 *   `?n=12`      quantas gratidões fingir (0 = paciente nova)
 *   `?dificil=1` o dia em que ela marcou humor baixo
 *   `?luto=1`    Modo Cuidado
 *   `?tela=done` a tela de guardado, com a RELEITURA · `?tela=lista` a coleção
 */
export const Route = createFileRoute("/preview-gratidao")({
  validateSearch: (q: Record<string, unknown>) => ({
    /* ⚠️ `== null` e não `=== undefined`: o router serializa e revalida, e na
       segunda passada chega `null` — `Number(null)` é 0, e a bancada abriria
       como uma gestante de zero semanas. Terceira vez que esta armadilha
       aparece no repo (ver `preview-saude` e `preview-jogo`). */
    w: q.w == null ? 20 : Number(q.w),
    dia: q.dia == null ? 3 : Number(q.dia),
    n: q.n == null ? 12 : Number(q.n),
    pos: q.pos === true || String(q.pos ?? "") === "1",
    dificil: q.dificil === true || String(q.dificil ?? "") === "1",
    luto: q.luto === true || String(q.luto ?? "") === "1",
    /* `?tela=done` é a que mais importa: a releitura só aparece depois de
       guardar, e guardar exige login. */
    tela: (["write", "lista", "done"] as const).includes(String(q.tela ?? "") as never)
      ? (String(q.tela) as "write" | "lista" | "done")
      : ("write" as const),
  }),
  head: () => ({
    meta: [{ title: "Bancada da gratidão" }, { name: "robots", content: "noindex" }],
  }),
  component: PreviewGratidao,
});

/** Frases plausíveis, com datas espalhadas para a releitura ter o que escolher. */
const EXEMPLOS = [
  "o café que meu marido fez sem eu pedir",
  "consegui dormir cinco horas seguidas",
  "minha mãe ligou só pra saber de mim",
  "a consulta foi boa e o coraçãozinho estava forte",
  "comi manga e não passei mal",
  "o sol da janela da cozinha de manhã",
  "minha amiga apareceu com sopa",
  "andei até a padaria sem cansar",
  "achei uma roupa que ainda serve",
  "o chuveiro quente depois de um dia longo",
  "ele mexeu bem na hora que eu deitei",
  "ninguém me deu conselho não pedido hoje",
];

function PreviewGratidao() {
  const { w, dia, n, pos, dificil, luto, tela } = Route.useSearch();
  const quantas = Math.max(0, Math.min(EXEMPLOS.length, n));
  const agora = Date.now();
  const gratidoes = Array.from({ length: quantas }, (_, i) => ({
    texto: EXEMPLOS[i % EXEMPLOS.length],
    /* Espalhadas de 6 em 6 dias: a mais nova tem seis dias, então a releitura
       (que recusa hoje e ontem) sempre tem o que mostrar. */
    quando: new Date(agora - (i + 1) * 6 * 86_400_000).toISOString(),
  }));

  return (
    <div className="fixed inset-0 z-[50] bg-background">
      <GratitudeBlock
        day={dia}
        semana={w}
        posParto={pos}
        careMode={luto}
        canEarn={false}
        alreadyDone={false}
        onEarn={() => {}}
        aoSair={() => history.back()}
        bancada={{ gratidoes, total: quantas, diaDificil: dificil, fase: tela }}
      />
      <p className="pointer-events-none fixed bottom-2 left-0 right-0 z-[60] text-center text-[10px] text-foreground/30">
        bancada · {PREFIXO_GRATIDAO.trim()} {quantas} guardadas
      </p>
    </div>
  );
}
