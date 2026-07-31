/**
 * A caixa de entrada de exames.
 *
 * O painel tem "Solicitação de Exames" e não tinha onde VER o que chega: a
 * paciente fotografa o laudo do TOTG, do Doppler, da urocultura, sobe no app, e
 * nenhuma tela do médico lia `exam_files`. O ciclo ficava aberto no meio — ele
 * pedia o exame e continuava pedindo que ela levasse impresso, com o sistema já
 * tendo o arquivo.
 *
 * A imagem só é buscada quando ele abre um exame. Na lista ela não vem: é
 * base64 de JPEG inteiro, e trinta laudos seriam dezenas de megabytes para
 * desenhar uma lista de nomes.
 */

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { quando } from "@/lib/quando";
import {
  devolutivaDoExame,
  examesRecebidos,
  imagemDoExame,
  type ExameRecebido,
} from "@/lib/clinical.functions";

export function ExamesRecebidos({ tokenFn }: { tokenFn: () => Promise<string> }) {
  const [exames, setExames] = useState<ExameRecebido[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [falhou, setFalhou] = useState(false);
  const [aberto, setAberto] = useState<ExameRecebido | null>(null);

  async function carregar() {
    try {
      const r = await examesRecebidos({ data: { accessToken: await tokenFn(), dias: 120 } });
      if (r.ok) {
        setExames(r.exames);
        setFalhou(false);
      } else setFalhou(true);
    } catch {
      setFalhou(true);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (carregando) return <div className="skeleton h-48 rounded-3xl" />;

  const naoVistos = exames.filter((e) => !e.visto_em);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="font-serif text-xl">Exames que elas enviaram</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Últimos 120 dias. Abrir um exame mostra o laudo e permite responder a ela.
          </p>
        </div>
        {naoVistos.length > 0 && (
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            {naoVistos.length} sem leitura
          </span>
        )}
      </div>

      {/* Falha de leitura não pode virar "nenhum exame": ela mandou o laudo e
          precisa ser lida, e uma caixa vazia por erro de rede é a pior notícia
          possível vestida de boa. */}
      {falhou && (
        <p className="rounded-2xl border border-amber-300 bg-amber-50/70 px-4 py-3 text-[12px] leading-snug text-amber-900">
          📡 Não consegui ler os exames agora. Atualize antes de concluir que não há nenhum.
        </p>
      )}

      {exames.length === 0 && !falhou ? (
        <div className="rounded-3xl border border-border bg-card p-8 text-center">
          <p className="text-3xl">🧾</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Nenhuma paciente enviou exame nos últimos 120 dias. Elas enviam pela aba Exames do app —
            vale lembrar disso na consulta.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {exames.map((e) => (
            <li
              key={e.id}
              className={`flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-2xl border p-3 ${
                e.visto_em ? "border-border bg-card" : "border-primary/30 bg-primary/5"
              }`}
            >
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                  {e.categoria} · {quando(e.created_at)}
                  {e.semana != null ? ` · ${e.semana}ª semana` : ""}
                </p>
                <p className="mt-0.5 truncate text-sm font-semibold text-foreground">
                  {e.paciente ?? "Paciente"} — {e.nome}
                </p>
                {e.notas && (
                  <p className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-muted-foreground">
                    {e.notas}
                  </p>
                )}
              </div>
              <button
                onClick={() => setAberto(e)}
                className="press shrink-0 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
              >
                {e.visto_em ? "Rever" : "Abrir"}
              </button>
            </li>
          ))}
        </ul>
      )}

      {aberto && (
        <VisorDoExame
          exame={aberto}
          tokenFn={tokenFn}
          onFechar={() => setAberto(null)}
          onRespondeu={() => {
            setAberto(null);
            carregar();
          }}
        />
      )}
    </div>
  );
}

function VisorDoExame({
  exame,
  tokenFn,
  onFechar,
  onRespondeu,
}: {
  exame: ExameRecebido;
  tokenFn: () => Promise<string>;
  onFechar: () => void;
  onRespondeu: () => void;
}) {
  const [imagem, setImagem] = useState<string | null>(null);
  /* O SERVIDOR JÁ DIZ POR QUÊ, E A TELA JOGAVA FORA.
     `imagemDoExame` devolve quatro `motivo` distintos — e existe um comentário
     no servidor explicando que eles foram criados justamente porque "falha de
     leitura", "não é sua paciente" e "a linha não tem imagem" colapsavam num
     `null` só. O cliente fazia `r.ok ? r.imagem : null` e recolapsava tudo: uma
     falha de rede continuava aparecendo como "ela não anexou laudo". */
  const [motivo, setMotivo] = useState<"ok" | "sem_imagem" | "nao_encontrado" | "falha" | "sessao">(
    "ok",
  );
  const [carregando, setCarregando] = useState(true);
  const [recado, setRecado] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await imagemDoExame({
          data: { accessToken: await tokenFn(), exameId: exame.id },
        });
        setImagem(r.ok ? r.imagem : null);
        setMotivo(r.motivo);
      } catch {
        setImagem(null);
        setMotivo("falha");
      } finally {
        setCarregando(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exame.id]);

  async function responder() {
    setEnviando(true);
    try {
      const r = await devolutivaDoExame({
        data: {
          accessToken: await tokenFn(),
          exameId: exame.id,
          pacienteId: exame.user_id,
          nomeDoExame: exame.nome,
          recado: recado.trim() || undefined,
        },
      });
      if (!r.ok) throw new Error("recusado");
      toast.success(
        "avisou" in r && r.avisou ? "Devolutiva enviada a ela ✓" : "Marcado como lido ✓",
      );
      onRespondeu();
    } catch {
      toast.error("Não consegui salvar. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onFechar}
    >
      <div
        className="flex max-h-[92svh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-card shadow-xl"
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-5 py-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
              {exame.categoria} · {quando(exame.created_at)}
            </p>
            <p className="truncate font-serif text-lg">
              {exame.paciente ?? "Paciente"} — {exame.nome}
            </p>
          </div>
          <button onClick={onFechar} className="shrink-0 text-sm text-muted-foreground">
            ✕
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {carregando ? (
            <div className="skeleton h-64 rounded-2xl" />
          ) : imagem ? (
            <img
              src={imagem}
              alt={`Exame: ${exame.nome}`}
              className="w-full rounded-2xl border border-border"
            />
          ) : motivo === "sem_imagem" ? (
            <p className="rounded-2xl border border-border bg-background p-4 text-center text-sm text-muted-foreground">
              Este registro não tem imagem anexada — só a anotação dela.
            </p>
          ) : motivo === "sessao" ? (
            /* Sessão vencida é o único dos cinco em que a ação do médico é
               diferente — recarregar não resolve, entrar de novo resolve. */
            <p className="rounded-2xl border border-amber-300 bg-amber-50/70 p-4 text-center text-sm leading-snug text-amber-900">
              <strong>Sua sessão expirou.</strong> Entre de novo para ver a imagem.
            </p>
          ) : (
            /* `falha` e `nao_encontrado` juntos, de propósito: o servidor
               responde igual nos dois para não confirmar, com um uuid qualquer,
               que existe um laudo de paciente de outro consultório. A tela não
               tem como separar — e o que o médico precisa saber é o mesmo nos
               dois casos: NÃO conclua que ela não anexou nada. */
            <p className="rounded-2xl border border-amber-300 bg-amber-50/70 p-4 text-center text-sm leading-snug text-amber-900">
              <strong>Não consegui carregar a imagem.</strong> Isto não quer dizer que ela não
              anexou o laudo — tente de novo em instantes.
            </p>
          )}
          {exame.notas && (
            <p className="mt-3 rounded-2xl bg-secondary/60 p-3 text-[13px] leading-snug">
              <span className="font-semibold">O que ela escreveu: </span>
              {exame.notas}
            </p>
          )}
        </div>

        <div className="shrink-0 border-t border-border px-5 py-3">
          <label className="block">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-primary">
              Responder a ela
            </span>
            <textarea
              rows={2}
              value={recado}
              onChange={(ev) => setRecado(ev.target.value)}
              placeholder="O que você viu no exame. Ela recebe no app."
              className="mt-0.5 w-full rounded-xl border border-primary/30 bg-primary/5 px-2.5 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            />
          </label>
          <button
            onClick={responder}
            disabled={enviando}
            className="press mt-2 w-full rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {enviando
              ? "Enviando…"
              : recado.trim()
                ? "Enviar devolutiva e marcar como lido"
                : "Marcar como lido, sem responder"}
          </button>
          {/* O texto do botão muda com o campo: marcar sem responder é uma
              escolha legítima (ele vai comentar na consulta), mas tem que ser
              uma escolha visível — e não o que acontece por omissão. */}
        </div>
      </div>
    </div>
  );
}
