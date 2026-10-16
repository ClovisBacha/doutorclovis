/**
 * A PESQUISA QUE O DONO NÃO TINHA COMO RECEBER.
 *
 * ⚠️ `shouldAskNps` e `submitNps` estavam escritas, testadas, com a trava
 * anti-repetição no servidor — e sem chamador nenhum no app. `getNpsReport`
 * tinha tela no admin, então o dono abria o relatório e via ZERO para sempre,
 * sem nada quebrado a que apontar.
 *
 * ⚠️ **Ela mora numa tela CALMA que a pessoa escolheu abrir** — nunca depois de
 * uma conquista. A tentação óbvia é perguntar logo após um momento bonito,
 * porque a nota sobe; e é exatamente por isso que não se faz. NPS é instrumento
 * de MEDIDA, e uma medida enviesada para cima é pior que medida nenhuma, porque
 * o dono decide com ela achando que é real.
 *
 * As decisões de QUANDO perguntar moram em `src/lib/nps.ts`, puras e testadas.
 */
import { useEffect, useState } from "react";

import { AGRADECIMENTO, PERGUNTA, podeMostrarNps } from "@/lib/nps";

/** A chave é comum, e não `dc-path-`: adiar uma pesquisa não precisa viajar
 *  para a nuvem dentro do blob da jornada. */
const CHAVE_DISPENSA = "dc-nps-dispensado";

type Fase = "quieto" | "perguntando" | "enviando" | "obrigada";

export function PesquisaNps({
  tokenFn,
  careMode,
  bancada,
}: {
  tokenFn: () => Promise<string>;
  /** ⚠️ `undefined` = ainda não sei, e "não sei" CALA. Ver `podeMostrarNps`. */
  careMode: boolean | undefined;
  bancada?: { fase: Fase; nota?: number };
}) {
  const ehBancada = !!bancada;
  const [fase, setFase] = useState<Fase>(bancada?.fase ?? "quieto");
  const [nota, setNota] = useState<number | null>(bancada?.nota ?? null);
  const [comentario, setComentario] = useState("");

  useEffect(() => {
    if (ehBancada) return;
    let vivo = true;
    (async () => {
      /* O portão do luto e o do adiamento são baratos e locais — rodam ANTES da
         ida ao servidor, senão toda abertura em Modo Cuidado gastaria uma
         consulta para descobrir que não pode perguntar. */
      let dispensadoEm: string | null = null;
      try {
        dispensadoEm = localStorage.getItem(CHAVE_DISPENSA);
      } catch {
        /* aba anônima, cota estourada: trata como "nunca dispensou" */
      }
      if (careMode !== false) return;
      if (!podeMostrarNps({ perguntar: true, careMode, dispensadoEm, agora: new Date() })) return;
      try {
        const accessToken = await tokenFn();
        if (!accessToken) return;
        const { shouldAskNps } = await import("@/lib/nps.functions");
        const r = await shouldAskNps({ data: { accessToken } });
        /* ⚠️ `ok: false` NÃO vira "pergunte": o padrão de uma pesquisa é o
           silêncio, e insistir com quem o servidor não conseguiu conferir é o
           tipo de coisa que faz alguém desinstalar. */
        if (vivo && r.ok && r.ask) setFase("perguntando");
      } catch {
        /* sem pesquisa hoje */
      }
    })();
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [careMode, ehBancada]);

  function adiar() {
    try {
      localStorage.setItem(CHAVE_DISPENSA, new Date().toISOString());
    } catch {
      /* sem memória do adiamento; ela verá de novo, e o botão continua ali */
    }
    setFase("quieto");
  }

  async function enviar(n: number) {
    setFase("enviando");
    try {
      const accessToken = await tokenFn();
      if (!accessToken) {
        setFase("perguntando");
        return;
      }
      const { submitNps } = await import("@/lib/nps.functions");
      const r = await submitNps({
        data: { accessToken, score: n, comment: comentario.trim() || null },
      });
      /* ⚠️ Mesmo recusado (`recente`, `migracao`, falha) a tela agradece e se
         fecha. Isto é uma pesquisa: mostrar um erro a quem acabou de fazer um
         favor ao produto é cobrar duas vezes por um gesto voluntário. O carimbo
         de adiamento entra do mesmo jeito, para ela não ser perguntada de novo
         amanhã. */
      void r;
    } catch {
      /* idem */
    }
    try {
      localStorage.setItem(CHAVE_DISPENSA, new Date().toISOString());
    } catch {
      /* sem memória */
    }
    setFase("obrigada");
  }

  if (fase === "quieto") return null;

  if (fase === "obrigada") {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 dark:bg-emerald-500/10">
        <p className="text-sm text-emerald-900 dark:text-emerald-100">{AGRADECIMENTO}</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl card-material p-4">
      <p className="text-sm font-medium text-foreground">{PERGUNTA}</p>
      {/* ⚠️ **DUAS FILEIRAS, e não uma.** Onze alvos de 44px somam 484px e a
          tela de um iPhone tem 393: numa linha só cada botão media 26px de
          largura — medido na bancada. Em `grid-cols-6` eles ficam com ~50px, e
          a escala continua legível como escala (0 à esquerda, 10 à direita). */}
      <div className="mt-3 grid grid-cols-6 gap-1.5">
        {Array.from({ length: 11 }, (_, n) => (
          <button
            key={n}
            type="button"
            disabled={fase === "enviando"}
            onClick={() => setNota(n)}
            aria-pressed={nota === n}
            className={`min-h-[44px] rounded-lg border text-[13px] font-semibold tabular-nums transition-colors disabled:opacity-40 ${
              nota === n
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-foreground"
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-xs text-muted-foreground">
        <span>não recomendaria</span>
        <span>recomendaria muito</span>
      </div>

      {nota !== null && (
        <>
          <textarea
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            rows={2}
            maxLength={1000}
            placeholder="Quer contar por quê? (opcional)"
            className="mt-3 w-full rounded-xl border border-input bg-background p-2 text-sm outline-none focus:border-primary"
          />
          <button
            type="button"
            disabled={fase === "enviando"}
            onClick={() => void enviar(nota)}
            className="press mt-2 min-h-[44px] w-full rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-40"
          >
            {fase === "enviando" ? "Enviando…" : "Enviar"}
          </button>
        </>
      )}

      <button
        type="button"
        onClick={adiar}
        className="mt-2 min-h-[44px] w-full text-[13px] text-muted-foreground"
      >
        Agora não
      </button>
    </div>
  );
}
