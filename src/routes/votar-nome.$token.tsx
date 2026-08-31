import { createFileRoute } from "@tanstack/react-router";
import { ConviteDoApp } from "@/components/convite-do-app";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  getPublicNameSession,
  addPublicNameEntry,
  voteForName,
  type NameEntry,
  type NameSession,
} from "@/lib/family.functions";

export const Route = createFileRoute("/votar-nome/$token")({
  head: () => ({
    meta: [
      { title: "Votação de Nomes — Obstétrica" },
      { name: "description", content: "Sugira e vote no nome do bebê!" },
    ],
  }),
  component: VotarNomePage,
});

function getVoterToken(): string {
  if (typeof window === "undefined") return "";
  const KEY = "voter_token";
  let t = localStorage.getItem(KEY);
  if (!t) {
    t = crypto.randomUUID();
    localStorage.setItem(KEY, t);
  }
  return t;
}

function VotarNomePage() {
  const { token: shareToken } = Route.useParams();
  const [session, setSession] = useState<NameSession | null>(null);
  /** O código dela, para o rodapé de convite. `null` em Modo Cuidado. */
  const [codigoDeConvite, setCodigoDeConvite] = useState<string | null>(null);
  const [entries, setEntries] = useState<NameEntry[]>([]);
  const [motherName, setMotherName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [voterName, setVoterName] = useState("");
  const [newName, setNewName] = useState("");
  const [votedEntryId, setVotedEntryId] = useState<string | null>(null);

  // Hydrate from localStorage only on the client
  useEffect(() => {
    if (typeof window === "undefined") return;
    setVoterName(localStorage.getItem("voter_name") ?? "");
    setVotedEntryId(localStorage.getItem(`voted_${shareToken}`) ?? null);
  }, [shareToken]);
  const [submittingVote, setSubmittingVote] = useState<string | null>(null);
  const [submittingName, setSubmittingName] = useState(false);
  const [addedName, setAddedName] = useState(false);

  useEffect(() => {
    load();
  }, [shareToken]);

  async function load() {
    setLoading(true);
    try {
      const res = await getPublicNameSession({ data: { shareToken } });
      if (!res.ok) {
        setError(res.error ?? "Erro desconhecido.");
        return;
      }
      setSession(res.session);
      setCodigoDeConvite(res.codigoDeConvite ?? null);
      setEntries(res.entries);
      setMotherName(res.motherName ?? null);
    } catch {
      // Falha de rede: sem isso a tela ficava em "Carregando..." p/ sempre.
      setError("Não foi possível carregar a votação. Verifique a conexão e recarregue.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVote(entryId: string) {
    if (!voterName.trim()) return;
    setSubmittingVote(entryId);
    try {
      localStorage.setItem("voter_name", voterName);
      const voterToken = getVoterToken();
      const r = await voteForName({
        data: { shareToken, entryId, voterName: voterName.trim(), voterToken },
      });
      /* ⚠️ `{ ok: false }` CHEGA NUMA RESPOSTA 200 NORMAL — o `catch` abaixo
         não pega. A votação pode ter sido encerrada, ou o INSERT recusado, e a
         tela gravava "já votou" no `localStorage` mesmo assim: o voto da avó
         nunca entrava na contagem E ela ficava impedida de tentar de novo. O
         nome do bebê saía de uma apuração silenciosamente incompleta.
         ⚠️ E a régua certa mora QUINZE LINHAS ABAIXO, em `handleAddName`:
         `const res = await addPublicNameEntry(...); if (res.ok) { … }`. Mesmo
         arquivo, mesma forma de retorno, uma função lia e a outra não. */
      if (!r.ok) {
        toast.error(r.error ?? "Não foi possível registrar o voto — tente novamente.");
        return;
      }
      localStorage.setItem(`voted_${shareToken}`, entryId);
      setVotedEntryId(entryId);
      await load();
    } catch {
      toast.error("Não foi possível registrar o voto — tente novamente.");
    } finally {
      setSubmittingVote(null);
    }
  }

  async function handleAddName() {
    if (!newName.trim() || !voterName.trim()) return;
    setSubmittingName(true);
    try {
      localStorage.setItem("voter_name", voterName);
      const res = await addPublicNameEntry({
        data: { shareToken, name: newName.trim(), suggestedBy: voterName.trim() },
      });
      if (res.ok) {
        setNewName("");
        setAddedName(true);
        setTimeout(() => setAddedName(false), 3000);
        await load();
      } else {
        toast.error("Não foi possível sugerir o nome — tente novamente.");
      }
    } catch {
      toast.error("Falha de conexão — tente novamente.");
    } finally {
      setSubmittingName(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">
        Carregando...
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="rounded-3xl border border-border bg-card p-10 text-center max-w-sm">
          <p className="text-4xl mb-4">🔒</p>
          <h1 className="font-serif text-xl font-semibold mb-2">Votação indisponível</h1>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  if (!session) return null;

  const sortedEntries = session.reveal_winner
    ? [...entries].sort((a, b) => (b.vote_count ?? 0) - (a.vote_count ?? 0))
    : entries;

  const maxVotes = Math.max(...entries.map((e) => e.vote_count ?? 0), 0);
  const winner = session.reveal_winner && sortedEntries[0]?.vote_count ? sortedEntries[0] : null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50/60 to-background px-4 py-12">
      <div className="mx-auto max-w-xl space-y-8">
        <div className="text-center">
          <p className="text-4xl mb-2">👶</p>
          <h1 className="font-serif text-3xl font-semibold">Nome do bebê</h1>
          {motherName && (
            <p className="mt-2 text-sm text-muted-foreground">
              Ajude a escolher o nome do bebê de <strong>{motherName}</strong>
            </p>
          )}
          {!session.is_active && (
            <div className="mt-3 inline-block rounded-full bg-secondary px-4 py-1.5 text-xs font-medium text-muted-foreground">
              Votação encerrada
            </div>
          )}
        </div>

        {winner && (
          <div className="rounded-3xl border-2 border-amber-400 bg-amber-50 p-6 text-center shadow-sm">
            <p className="text-2xl mb-2">👑</p>
            <p className="text-xs font-semibold uppercase tracking-widest text-amber-600 mb-1">
              Nome escolhido
            </p>
            <p className="font-serif text-3xl font-bold text-amber-800">{winner.name}</p>
            <p className="mt-1 text-sm text-amber-700">
              {winner.vote_count} {winner.vote_count === 1 ? "voto" : "votos"}
            </p>
          </div>
        )}

        {/* Voter name */}
        <div className="rounded-3xl border border-border bg-card p-6">
          <label className="block text-sm font-medium mb-2">Seu nome</label>
          <input
            value={voterName}
            onChange={(e) => setVoterName(e.target.value)}
            placeholder="Como você se chama?"
            className="w-full rounded-xl border border-border bg-background px-4 py-2 text-sm"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Usado para identificar seu voto e sugestão.
          </p>
        </div>

        {/* Suggest a name */}
        {session.is_active && (
          <div className="rounded-3xl border border-border bg-card p-6">
            <h2 className="font-semibold mb-3">Sugerir um nome</h2>
            <div className="flex gap-2">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddName()}
                placeholder="Nome do bebê..."
                className="flex-1 rounded-xl border border-border bg-background px-4 py-2 text-sm"
              />
              <button
                onClick={handleAddName}
                disabled={submittingName || !newName.trim() || !voterName.trim()}
                className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-white disabled:opacity-40"
              >
                {submittingName ? "..." : "Sugerir"}
              </button>
            </div>
            {addedName && (
              <p className="mt-2 text-sm text-green-600 font-medium">✓ Nome sugerido!</p>
            )}
            {!voterName.trim() && (
              <p className="mt-1 text-xs text-amber-600">Preencha seu nome acima para sugerir.</p>
            )}
          </div>
        )}

        {/* Name list with voting */}
        <div>
          <h2 className="font-semibold mb-4">
            {entries.length} {entries.length === 1 ? "nome" : "nomes"} na corrida
          </h2>
          {entries.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border p-12 text-center text-muted-foreground">
              <p className="text-3xl mb-2">✨</p>
              <p>Nenhum nome sugerido ainda. Seja o primeiro!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sortedEntries.map((entry, i) => {
                const votes = entry.vote_count ?? 0;
                const pct = maxVotes > 0 ? (votes / maxVotes) * 100 : 0;
                const isMyVote = votedEntryId === entry.id;
                const hasVoted = votedEntryId !== null;
                const isFirst = session.reveal_winner && i === 0 && votes > 0;

                return (
                  <div
                    key={entry.id}
                    className={`rounded-2xl border p-4 transition-all ${
                      isFirst
                        ? "border-amber-300 bg-amber-50"
                        : isMyVote
                          ? "border-primary/40 bg-primary/5"
                          : "border-border bg-card"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {session.reveal_winner && (
                        <span className="w-6 text-center text-sm font-bold text-muted-foreground shrink-0">
                          {isFirst ? "👑" : `${i + 1}°`}
                        </span>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">{entry.name}</p>
                        <p className="text-xs text-muted-foreground">por {entry.suggested_by}</p>
                        {session.reveal_winner && (
                          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                            <div
                              className="h-full rounded-full bg-primary transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        )}
                      </div>
                      {session.reveal_winner && (
                        <div className="text-right shrink-0">
                          <p className="text-sm font-semibold text-primary">{votes}</p>
                          <p className="text-xs text-muted-foreground">
                            {votes === 1 ? "voto" : "votos"}
                          </p>
                        </div>
                      )}
                      {session.is_active && (
                        <button
                          onClick={() => !hasVoted && handleVote(entry.id)}
                          disabled={hasVoted || submittingVote === entry.id || !voterName.trim()}
                          className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                            isMyVote
                              ? "bg-primary text-white"
                              : hasVoted
                                ? "bg-secondary text-muted-foreground cursor-not-allowed"
                                : "bg-primary/10 text-primary hover:bg-primary hover:text-white disabled:opacity-40"
                          }`}
                        >
                          {submittingVote === entry.id ? "..." : isMyVote ? "✓ Votei" : "Votar"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {votedEntryId && session.is_active && (
            <p className="mt-3 text-xs text-center text-muted-foreground">
              Você já votou nesta sessão. Cada dispositivo pode votar uma vez por nome.
            </p>
          )}
          {!voterName.trim() && session.is_active && entries.length > 0 && (
            <p className="mt-3 text-xs text-center text-amber-600">Preencha seu nome para votar.</p>
          )}

          {/* ⚠️ A QUARTA página pública, e a que faltava. O link da votação vai
              para o grupo da família inteiro — as outras três já convidavam e
              esta terminava sem dizer o que é o app. Ver `convite-do-app.ts`. */}
          <ConviteDoApp onde="nome" codigo={codigoDeConvite} />
        </div>
      </div>
    </div>
  );
}
