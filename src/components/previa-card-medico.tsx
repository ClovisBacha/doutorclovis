/**
 * O card exatamente como a paciente vai ver, ao lado do formulário.
 *
 * Preencher quinze campos sem ver o resultado é escrever carta sem saber o
 * envelope. A prévia responde sozinha as perguntas que o formulário gera —
 * "onde isso aparece", "cortou meu texto?", "ficou vazio?" — e é o único jeito
 * de o médico perceber que o card dele está pobre antes de a paciente perceber.
 *
 * Ela é uma RÉPLICA, não o componente real: o card da busca vive dentro de uma
 * lista com estado, ações e dados do servidor. Copiar a aparência e não a
 * mecânica é o que mantém isto simples. O risco conhecido é os dois divergirem
 * com o tempo — por isso a prévia mostra só o que o formulário controla, que é
 * a parte que de fato muda.
 */

import { formatarDinheiro } from "@/lib/dinheiro";

export function PreviaCardMedico({
  nome,
  titulo,
  especialidade,
  focos,
  cidade,
  uf,
  bio,
  formacoes,
  aceitaConvenio,
  aceitaParticular,
  convenios,
  precoCentavos,
  moeda,
  crm,
}: {
  nome: string;
  titulo: string;
  especialidade: string;
  focos: string[];
  cidade?: string;
  uf?: string;
  bio: string;
  formacoes: string;
  aceitaConvenio: boolean;
  aceitaParticular: boolean;
  convenios: string;
  precoCentavos: number | null;
  moeda: string;
  crm: string;
}) {
  const nomeVisivel = nome.trim() || "Seu nome aqui";
  const inicial = nomeVisivel
    .replace(/^(Dr|Dra)\.?\s*/i, "")
    .charAt(0)
    .toUpperCase();
  const linhasFormacao = formacoes
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  return (
    <div className="sticky top-4">
      <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Como a paciente te vê
      </p>
      <div className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
        <div className="flex items-start gap-3">
          {/* Sem foto ainda: a inicial. É honesto sobre o que o card mostra
              hoje, em vez de desenhar um rosto que não existe. */}
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/12 font-serif text-lg text-primary">
            {inicial || "?"}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-serif text-base text-foreground">{nomeVisivel}</p>
            {(titulo || especialidade) && (
              <p className="truncate text-xs text-muted-foreground">
                {[titulo, especialidade].filter(Boolean).join(" · ")}
              </p>
            )}
            {crm && <p className="text-[11px] text-muted-foreground">{crm}</p>}
          </div>
        </div>

        <div className="mt-2.5 flex flex-wrap gap-1.5 text-[11px]">
          {(cidade || uf) && (
            <span className="rounded-full bg-secondary px-2 py-0.5">
              📍 {[cidade, uf].filter(Boolean).join("/")}
            </span>
          )}
          {aceitaConvenio && (
            <span className="rounded-full bg-secondary px-2 py-0.5">💳 Convênio</span>
          )}
          {aceitaParticular && (
            <span className="rounded-full bg-secondary px-2 py-0.5">
              💰 Particular
              {precoCentavos ? ` · ${formatarDinheiro(precoCentavos, moeda)}` : ""}
            </span>
          )}
        </div>

        {/* Focos extras viram as palavras pelas quais ela te acha na busca. */}
        {focos.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11px]">
            {focos.map((f) => (
              <span key={f} className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">
                {f}
              </span>
            ))}
          </div>
        )}

        {bio.trim() ? (
          <p className="mt-2.5 line-clamp-3 text-[13px] leading-snug text-muted-foreground">
            {bio}
          </p>
        ) : (
          /* Vazio é informação: mostra o buraco em vez de esconder. */
          <p className="mt-2.5 rounded-lg border border-dashed border-border px-2 py-2 text-[12px] leading-snug text-muted-foreground/70">
            Aqui entra o “Sobre você”. Sem ele, o card fica só com dados — e é este parágrafo que
            faz ela sentir que já te conhece.
          </p>
        )}

        {convenios.trim() && aceitaConvenio && (
          <p className="mt-1.5 line-clamp-1 text-[11px] text-muted-foreground">💳 {convenios}</p>
        )}

        {linhasFormacao.length > 0 ? (
          <div className="mt-2 space-y-0.5">
            {linhasFormacao.slice(0, 3).map((l) => (
              <p key={l} className="line-clamp-1 text-[11px] text-muted-foreground">
                🎓 {l}
              </p>
            ))}
            {linhasFormacao.length > 3 && (
              <p className="text-[11px] text-muted-foreground/70">
                + {linhasFormacao.length - 3} no perfil completo
              </p>
            )}
          </div>
        ) : (
          <p className="mt-2 rounded-lg border border-dashed border-border px-2 py-2 text-[12px] leading-snug text-muted-foreground/70">
            Suas formações aparecem aqui. É o que decide entre você e outro nome que ela também não
            conhece.
          </p>
        )}

        <button
          type="button"
          disabled
          className="mt-3 w-full cursor-default rounded-full bg-primary/90 px-4 py-2 text-xs font-semibold text-primary-foreground"
        >
          Escolher este médico
        </button>
      </div>
      <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
        Atualiza enquanto você preenche. É este card que aparece na busca.
      </p>
    </div>
  );
}
