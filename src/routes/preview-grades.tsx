import { createFileRoute } from "@tanstack/react-router";
import { GradeHub, VoltarDaGrade } from "@/components/grade-hub";
import {
  BEBE_SUBTABS,
  BEMESTAR_SUBTABS,
  CONSULTAS_SUBTABS,
  REGISTROS_SUBTABS,
} from "@/routes/_authenticated/minha-conta";

/**
 * Bancada das GRADES de sub-abas — as quatro que substituíram as fileiras de
 * pílulas roláveis (Consultas, Bebê, Bem-estar, Registros).
 *
 * O que importa medir é o quadrado: rótulos como "Plano de parto", "Linha do
 * tempo" e "Apoio emocional" quebram em duas linhas, e num aparelho de 320px o
 * bloco de texto pode estourar a altura e desalinhar a grade inteira. Aqui o
 * Playwright confere largura = altura em todos, em qualquer tela. Não expõe
 * nada: as quatro listas são constantes de navegação.
 */
export const Route = createFileRoute("/preview-grades")({
  head: () => ({
    meta: [{ title: "Bancada das grades" }, { name: "robots", content: "noindex" }],
  }),
  /* `?cabecalhos=1`: em vez das grades, o cabeçalho de sub-tela de CADA item —
     é a peça que faz a tela de dentro abrir no desenho do bloco, e só existe
     depois de um toque que a bancada não dá. */
  validateSearch: (q: Record<string, unknown>) => ({
    cabecalhos: q.cabecalhos === "1" || q.cabecalhos === 1 || q.cabecalhos === true,
  }),
  component: PreviewGrades,
});

const GRUPOS = [
  { nome: "Consultas", itens: CONSULTAS_SUBTABS },
  { nome: "Bebê", itens: BEBE_SUBTABS },
  { nome: "Bem-estar", itens: BEMESTAR_SUBTABS },
  { nome: "Registros", itens: REGISTROS_SUBTABS },
];

function PreviewGrades() {
  const { cabecalhos } = Route.useSearch();
  return (
    <div className="fixed inset-0 z-[50] overflow-y-auto bg-background px-4 py-5">
      {GRUPOS.map((g) => (
        <section key={g.nome} className="mb-7">
          <p className="mb-2.5 font-serif text-xl">{g.nome}</p>
          {cabecalhos ? (
            <div className="space-y-3">
              {g.itens.map((i) => (
                <VoltarDaGrade key={i.key} rotulo={i.label} ladrilho={i} onVoltar={() => {}} />
              ))}
            </div>
          ) : (
            <GradeHub itens={g.itens} onAbrir={() => {}} />
          )}
        </section>
      ))}
    </div>
  );
}
