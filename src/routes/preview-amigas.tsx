import { createFileRoute } from "@tanstack/react-router";
import { AmigasTab } from "@/components/amigas";
import type { EstadoDaDupla, PerfilDeAmiga } from "@/lib/amigas";
import type { DuplaNaTela } from "@/lib/amigas.functions";

/**
 * Bancada da ABA DAS AMIGAS.
 *
 * A aba só existe para quem está logada, e o que ela mostra depende de coisas
 * que não se fabricam numa conta de teste: uma amiga que entrou pelo convite
 * DELA, uma dupla aceita dos dois lados, e o bolso do Premium. Conferir o
 * layout contra a referência do dono exigiria duas contas reais, um convite
 * aceito e uma assinatura — e é assim que uma tela passa meses sem ninguém
 * nunca ter olhado para ela.
 *
 * ⚠️ A bancada fabrica o DADO, nunca o desenho. A lista, a dupla e o bolso
 * entram pelos mesmos `useState` da produção; daí para baixo é o componente de
 * verdade, com os mesmos textos, as mesmas cores e a mesma régua. A lição é do
 * `?streak=41` da folha da chama, que cravava o NÚMERO e deixava o saldo vir de
 * uma jornada vazia — a bancada mostrava um estado que o app nunca produz.
 *
 * Parâmetros:
 *   `?n=4`             quantas amigas na lista (0 mostra o vazio que ensina)
 *   `?dupla=ativa`     ativa · convite-recebido · convite-enviado · sem
 *   `?dias=12`         dias de chama da dupla
 *   `?premium=1`       liga o botão 🎁 na linha da amiga
 *   `?luto=1`          Modo Cuidado — a aba inteira se cala
 *   `?semcodigo=1`     sem código de indicação (o "Convidar" explica e não manda)
 */
export const Route = createFileRoute("/preview-amigas")({
  validateSearch: (q: Record<string, unknown>) => ({
    /* ⚠️ `== null` e não `=== undefined`: o router serializa e revalida, e na
       segunda passada chega `null` — `Number(null)` é 0, e a lista abria
       vazia sozinha na segunda passada. Sexta vez que isto aparece no repo. */
    n: q.n == null ? 4 : Number(q.n),
    dupla: q.dupla == null ? "ativa" : String(q.dupla),
    dias: q.dias == null ? 12 : Number(q.dias),
    premium: q.premium == null ? false : Boolean(q.premium),
    /* O código de indicação. Sem ele o "Convidar" explica em vez de mandar —
       `?semcodigo=1` é a única forma de fotografar esse estado. */
    codigo: q.semcodigo ? null : "ABC2345",
    luto: q.luto == null ? false : Boolean(q.luto),
  }),
  head: () => ({
    meta: [{ title: "Bancada das Amigas" }, { name: "robots", content: "noindex" }],
  }),
  component: PreviewAmigas,
});

/* Nomes e números fixos: a tela é renderizada no servidor, e sortear daria
   hidratação diferente dos dois lados. É o mesmo motivo dos CORACOES. */
const NOMES = ["Marina Costa", "Juliana Alves", "Camila Souza", "Beatriz Lima", "Renata Dias"];

function PreviewAmigas() {
  const { n, dupla, dias, premium, luto, codigo } = Route.useSearch();

  const amigas: PerfilDeAmiga[] = NOMES.slice(0, Math.max(0, Math.min(NOMES.length, n))).map(
    (nome, i) => ({
      id: `amiga-${i}`,
      nome,
      bebe: i % 2 === 0 ? "Helena" : null,
      sequencia: 3 + i * 2,
      trofeus: 12 - i * 3,
      itens: 8 + i,
      diasNoApp: [43, 12, 1, 0, 143][i] ?? 30,
      /* ⚠️ A TERCEIRA não pode ser presenteada, e a SEGUNDA já foi. São os dois
         estados que o 🎁 tem além do normal, e nenhum deles aparece numa conta
         de teste sem um convite aceito e um presente já enviado. Ver
         `possoPresentear` e `jaPresenteada`. */
      possoPresentear: i !== 2,
      jaPresenteada: i === 1,
    }),
  );

  const naTela: DuplaNaTela | null =
    dupla === "sem"
      ? null
      : {
          estado: dupla as EstadoDaDupla,
          amigaId: amigas[0]?.id ?? null,
          nome: amigas[0]?.nome ?? "Marina Costa",
          sequencia: dias,
        };

  return (
    <div className="mx-auto max-w-md p-4">
      <AmigasTab careMode={luto} bancada={{ amigas, dupla: naTela, assinante: premium, codigo }} />
    </div>
  );
}
