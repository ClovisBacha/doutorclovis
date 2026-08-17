/**
 * O BOLÃO DO NASCIMENTO — a tela.
 *
 * A régua inteira (faixas, pontuação, ranking, empate, Modo Cuidado) mora em
 * `src/lib/bolao.ts`, testada e sem JSX. Aqui fica o formulário, a lista e o
 * pódio.
 *
 * ─── DUAS DECISÕES DE TELA QUE VÊM DA RÉGUA ────────────────────────────────
 *
 * · **O palpite dos outros aparece ANTES do formulário.** Ver a tia ter
 *   apostado 4,2 kg é o que faz alguém querer palpitar — a lista é o convite,
 *   não o resultado. Um formulário no topo com a lista escondida embaixo
 *   inverteria a ordem em que a vontade nasce.
 *
 * · **Quem já palpitou vê o próprio palpite no formulário, preenchido.** O
 *   palpite é editável até o parto (ver `bolao.ts`), e um formulário vazio para
 *   quem já respondeu parece que o envio se perdeu.
 *
 * ⚠️ **A bancada fabrica os DADOS, nunca o desenho.** `/preview-comunidade`
 * monta palpites e resultado de mentira e deixa esta tela desenhar tudo o mais
 * — senão conferir o pódio exigiria uma gestação de verdade chegando ao fim.
 */
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  diaEmTexto,
  diferencaEmTexto,
  horaEmTexto,
  pesoEmTexto,
  PONTOS_MAXIMOS,
  ranking,
  validarPalpite,
  type NascimentoReal,
  type PalpiteDoBolao,
} from "@/lib/bolao";
import type { BolaoNaTela, PalpiteNaTela } from "@/lib/bolao.functions";

/** Dados de mentira para a bancada. Só os DADOS. */
export type BancadaDoBolao = {
  bolao: BolaoNaTela;
};

/** "3400" no campo → 3400. "3,4" e "3.4" → 3400. Aceita os três jeitos. */
function lerPeso(txt: string): number | null {
  const s = txt.trim().replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  /* Abaixo de 20 só pode ser quilo — ninguém digita "3" querendo três gramas.
     Acima disso é grama. É o mesmo palpite que uma balança de farmácia faz. */
  return Math.round(n < 20 ? n * 1000 : n);
}

/** "09:05" → 545. Vazio → null. */
function lerHora(txt: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(txt.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

const ERROS: Record<string, string> = {
  data: "Essa data não existe.",
  "data-fora-da-faixa": "Essa data está longe demais da data prevista.",
  peso: "Peso fora do que uma balança marcaria.",
  hora: "Essa hora não existe.",
  fechado: "O bebê já nasceu — o bolão fechou.",
  indisponivel: "O bolão não está disponível agora.",
  sessao: "Entre de novo para palpitar.",
  banco: "Não deu para salvar. Tente de novo.",
};

export function BolaoDoNascimento({
  donaId,
  careMode = false,
  bancada,
}: {
  donaId: string | null;
  careMode?: boolean;
  bancada?: BancadaDoBolao;
}) {
  const [bolao, setBolao] = useState<BolaoNaTela | null>(bancada?.bolao ?? null);
  const [carregando, setCarregando] = useState(!bancada);
  const [salvando, setSalvando] = useState(false);

  const [dia, setDia] = useState("");
  const [peso, setPeso] = useState("");
  const [hora, setHora] = useState("");

  useEffect(() => {
    if (bancada || !donaId || careMode) {
      setCarregando(false);
      return;
    }
    let vivo = true;
    (async () => {
      try {
        const s = await supabase.auth.getSession();
        const token = s.data.session?.access_token;
        if (!token) return;
        const { verBolao } = await import("@/lib/bolao.functions");
        const r = await verBolao({ data: { accessToken: token, donaId } });
        if (!vivo) return;
        setBolao(r.ok ? r.bolao : null);
      } catch {
        /* Sem bolão a seção some. Um erro aqui não é notícia para a paciente:
           ela não pediu o bolão, ele é que se ofereceu. */
      } finally {
        if (vivo) setCarregando(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [donaId, careMode, bancada]);

  /* O formulário nasce com o MEU palpite, se já existe. Ver o cabeçalho: um
     formulário vazio para quem já respondeu parece que o envio se perdeu. */
  const meu = useMemo(() => bolao?.palpites.find((p) => p.meu) ?? null, [bolao]);
  useEffect(() => {
    if (!meu) return;
    setDia(meu.dia);
    setPeso(String(meu.pesoGramas));
    setHora(horaEmTexto(meu.horaMinutos) === "—" ? "" : horaEmTexto(meu.horaMinutos));
  }, [meu?.dia, meu?.pesoGramas, meu?.horaMinutos]); // eslint-disable-line react-hooks/exhaustive-deps

  const fechado = !!bolao?.resultado;

  /* A classificação é recalculada aqui com a MESMA função pura do servidor.
     Não é duplicação de régua: é a mesma régua, e é o que deixa a bancada
     desenhar o pódio sem servidor nenhum. */
  const classificacao = useMemo(() => {
    if (!bolao?.resultado) return null;
    return ranking(bolao.palpites, bolao.resultado);
  }, [bolao]);

  if (careMode || carregando || !bolao) return null;

  async function enviar() {
    if (!donaId || salvando) return;
    const p: PalpiteDoBolao = {
      dia: dia.trim(),
      pesoGramas: lerPeso(peso) ?? 0,
      horaMinutos: hora.trim() ? lerHora(hora) : null,
    };
    if (hora.trim() && p.horaMinutos == null) {
      toast.error(ERROS.hora);
      return;
    }
    const erro = validarPalpite(p, bolao?.dpp ?? null);
    if (erro) {
      toast.error(ERROS[erro] ?? "Confira os campos.");
      return;
    }
    setSalvando(true);
    try {
      const s = await supabase.auth.getSession();
      const token = s.data.session?.access_token;
      if (!token) return;
      const { palpitar, verBolao } = await import("@/lib/bolao.functions");
      const r = await palpitar({ data: { accessToken: token, donaId, ...p } });
      if (!r.ok) {
        toast.error(ERROS[r.motivo] ?? "Não deu para salvar.");
        return;
      }
      toast.success(meu ? "Palpite corrigido 🍼" : "Palpite guardado 🍼");
      const novo = await verBolao({ data: { accessToken: token, donaId } });
      if (novo.ok) setBolao(novo.bolao);
    } catch {
      toast.error("Não deu para salvar. Tente de novo.");
    } finally {
      setSalvando(false);
    }
  }

  /* ⚠️ Sem artigo antes do nome. `o ${nome}` dava "Quando o Helena nasce?", e
     acertar o artigo exigiria saber o gênero do bebê pelo nome — que é
     exatamente o que não dá para fazer. Sem nome, o artigo volta porque "o
     bebê" é substantivo comum e o pede. */
  const quem = bolao.bebeNome || "o bebê";

  return (
    <section className="rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      <header className="mb-4">
        <h3 className="text-lg font-semibold">🍼 Bolão do nascimento</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {fechado
            ? `${bolao.donaNome} registrou o nascimento. Veja quem chegou mais perto.`
            : `Quando ${quem} nasce? Quanto pesa? Palpite — dá para corrigir até o dia.`}
        </p>
      </header>

      {/* ─── O PÓDIO, quando o bebê já nasceu ─────────────────────────────── */}
      {fechado && bolao.resultado && (
        <div className="mb-4 rounded-2xl bg-muted/50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            O que aconteceu
          </p>
          <p className="mt-1 text-sm">
            <strong>{diaEmTexto(bolao.resultado.dia)}</strong> ·{" "}
            {pesoEmTexto(bolao.resultado.pesoGramas)} · {horaEmTexto(bolao.resultado.horaMinutos)}
          </p>
        </div>
      )}

      {/* ─── A LISTA VEM ANTES DO FORMULÁRIO ──────────────────────────────
          Ver a tia ter apostado 4,2 kg é o que faz alguém querer palpitar. A
          lista é o convite, não o resultado. */}
      {bolao.palpites.length > 0 && (
        <ul className="mb-4 space-y-1.5">
          {(classificacao
            ? classificacao.map((l) => ({ p: l.palpite as PalpiteNaTela, l }))
            : bolao.palpites.map((p) => ({ p, l: null }))
          ).map(({ p, l }) => (
            /* ⚠️ DOIS ANDARES, e não uma linha só.
               Numa linha, o bloco de números é `shrink-0` e o nome é o único
               que pode encolher — medido na bancada num iPhone 15 Pro: "Vó
               Ana" e "Marina" saíam como "V…" e "M…" enquanto "10/09 · 3,400
               kg · 09:05" ficava inteiro. É o mesmo defeito que as linhas das
               Amigas já tiveram, e a lição é a mesma: quem tem de ceder
               largura é o dado, nunca o nome da pessoa. */
            <li
              key={p.autorId}
              className={`rounded-xl px-3 py-2 text-sm ${p.meu ? "bg-primary/10" : "bg-muted/40"}`}
            >
              <div className="flex items-baseline gap-2">
                {l && (
                  <span className="w-6 shrink-0 text-center text-base">
                    {l.posicao === 1 ? "🏆" : `${l.posicao}º`}
                  </span>
                )}
                <span className="min-w-0 flex-1 font-medium">{p.autorNome}</span>
                {l && (
                  <span className="shrink-0 tabular-nums text-xs font-semibold text-primary">
                    {l.nota.total}/{PONTOS_MAXIMOS}
                  </span>
                )}
              </div>
              <p className={`tabular-nums text-xs text-muted-foreground ${l ? "ml-8" : ""}`}>
                {diaEmTexto(p.dia)} · {pesoEmTexto(p.pesoGramas)}
                {p.horaMinutos != null && ` · ${horaEmTexto(p.horaMinutos)}`}
              </p>
            </li>
          ))}
        </ul>
      )}

      {/* Quem errou por pouco merece saber por quanto — é a graça de perder. */}
      {classificacao && classificacao.length > 0 && (
        <p className="mb-4 text-xs text-muted-foreground">
          {classificacao[0].palpite.autorNome} chutou{" "}
          {diferencaEmTexto(classificacao[0].nota.diasDeDiferenca)}.
        </p>
      )}

      {/* ─── O FORMULÁRIO ─────────────────────────────────────────────────── */}
      {!fechado && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs font-medium text-muted-foreground">
              Dia
              <input
                type="date"
                value={dia}
                onChange={(e) => setDia(e.target.value)}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
              />
            </label>
            <label className="text-xs font-medium text-muted-foreground">
              Peso (kg ou g)
              <input
                inputMode="decimal"
                placeholder="3,4"
                value={peso}
                onChange={(e) => setPeso(e.target.value)}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
              />
            </label>
          </div>
          <label className="block text-xs font-medium text-muted-foreground">
            Hora (opcional)
            <input
              inputMode="numeric"
              placeholder="09:05"
              value={hora}
              onChange={(e) => setHora(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
          </label>
          <button
            type="button"
            onClick={enviar}
            disabled={salvando}
            className="press w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {salvando ? "Guardando…" : meu ? "Corrigir meu palpite" : "Guardar meu palpite"}
          </button>
          {meu && (
            <p className="text-center text-xs text-muted-foreground">
              Dá para mudar quantas vezes quiser até {quem} nascer.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

/** Só para a bancada montar um resultado sem servidor. */
export type { NascimentoReal };
