import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { CANTINHO_BY_ID, fundoBgFor } from "@/lib/cantinho";
import { PRESENTE_ENTRE_AMIGAS } from "@/lib/economia-sementinhas";
import { tempoNoApp, type EnfeitePosto, type PerfilDeAmiga } from "@/lib/amigas";
import type { DuplaNaTela } from "@/lib/amigas.functions";
import { ChamaDaSequencia } from "@/components/chama-sequencia";
import { TrofeuIcone } from "@/components/trofeu";
import { Bolha } from "@/components/bolha";
import { TRILHA_SKINS } from "@/lib/trilha-skins";

/**
 * A ABA DAS AMIGAS.
 *
 * ─── O QUE ELA É, E O QUE ELA DELIBERADAMENTE NÃO É ─────────────────────────
 *
 * É o Cantinho das amigas, o presente entre elas e a dupla de sequência. NÃO é
 * um placar, não tem caixa de comentário e não mostra uma linha de dado
 * clínico — nem semana, nem DPP, nem medida.
 *
 * As três ausências são a mesma decisão: num app de idioma comparar é ganhar um
 * jogo; aqui é comparar cuidado com o próprio bebê, e uma das duas pode perder
 * a gestação. O que se mostra é o que ela CONSTRUIU.
 *
 * A lista de amigas é o grafo de indicação nos dois sentidos — sem busca e sem
 * pedido de estranho, não há o que moderar.
 */
export function AmigasTab({ careMode }: { careMode?: boolean }) {
  const [amigas, setAmigas] = useState<PerfilDeAmiga[]>([]);
  const [dupla, setDupla] = useState<DuplaNaTela | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [aberta, setAberta] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session?.access_token) return;
      const { minhasAmigas } = await import("@/lib/amigas.functions");
      const r = await minhasAmigas({ data: { accessToken: s.session.access_token } });
      if (r.ok) {
        setAmigas(r.amigas);
        setDupla(r.dupla);
      }
    } catch {
      /* sem rede: a aba mostra o estado vazio, que é honesto */
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  /* Modo Cuidado: a aba inteira se cala, como a loja e o saldo. O servidor já
     devolve vazio; isto evita até o esqueleto piscar. */
  if (careMode) {
    return (
      <div className="rounded-3xl border border-dashed border-border p-8 text-center">
        <p className="text-sm text-muted-foreground">
          As Amigas voltam quando você quiser. Está tudo guardado.
        </p>
      </div>
    );
  }

  if (carregando) return <div className="skeleton h-64 rounded-3xl" />;

  if (aberta) {
    return <PerfilDaAmigaTela amigaId={aberta} aoVoltar={() => setAberta(null)} />;
  }

  return (
    <div className="space-y-4">
      <DuplaCard dupla={dupla} amigas={amigas} aoMudar={carregar} />

      <div className="rounded-3xl border border-border bg-card p-5">
        <p className="font-serif text-lg">Suas amigas</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Quem você convidou para o app, e quem convidou você. Toque para visitar o Cantinho dela.
        </p>

        {amigas.length === 0 ? (
          /* Vazio que ENSINA o caminho. "Nenhuma amiga" só informaria a
             ausência, e a ausência ela já vê. */
          <div className="mt-4 rounded-2xl border border-dashed border-border p-6 text-center">
            <p className="text-4xl">👯</p>
            <p className="mt-2 text-sm font-semibold">Ainda não tem ninguém por aqui</p>
            <p className="mt-1 text-[13px] leading-snug text-muted-foreground">
              Convide uma amiga pelo seu link de indicação. Vocês duas ganham Sementinhas, e ela
              aparece aqui.
            </p>
          </div>
        ) : (
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {amigas.map((a) => (
              <li key={a.id}>
                <button
                  onClick={() => setAberta(a.id)}
                  className="press flex w-full items-center gap-3 rounded-2xl border border-border bg-background p-3 text-left"
                >
                  <Bolha tamanho={44} humor="feliz" flutua={false} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{a.nome}</span>
                    <span className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                      <ChamaDaSequencia acesa={a.sequencia > 0} tamanho={14} fonteAoLado={11} />
                      {a.sequencia} · <TrofeuIcone tamanho={18} fonteAoLado={11} /> {a.trofeus}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════ A DUPLA ══════════════════════════ */

/**
 * A CHAMA COMPARTILHADA.
 *
 * Quatro estados, quatro telas. "Convite que eu mandei" e "convite que me
 * mandaram" pedem coisas opostas — uma espera, a outra decide —, e tratá-los
 * como um "pendente" só é o que faz aparecer um botão "Aceitar" para quem
 * acabou de convidar.
 */
function DuplaCard({
  dupla,
  amigas,
  aoMudar,
}: {
  dupla: DuplaNaTela | null;
  amigas: PerfilDeAmiga[];
  aoMudar: () => void;
}) {
  const [ocupado, setOcupado] = useState(false);

  async function chamar(fn: "convidar" | "aceitar" | "recusar" | "desfazer", amigaId?: string) {
    setOcupado(true);
    try {
      const { data: s } = await supabase.auth.getSession();
      const token = s.session?.access_token;
      if (!token) return;
      const m = await import("@/lib/amigas.functions");
      const r =
        fn === "convidar"
          ? await m.convidarDupla({ data: { accessToken: token, amigaId: amigaId! } })
          : fn === "desfazer"
            ? await m.desfazerDupla({ data: { accessToken: token } })
            : await m.responderDupla({
                data: { accessToken: token, amigaId: amigaId!, aceitar: fn === "aceitar" },
              });
      if (!r.ok) {
        toast(
          "error" in r && r.error === "indisponivel"
            ? "Não é possível agora."
            : "error" in r && r.error === "sem_vinculo"
              ? "Vocês precisam estar conectadas pelo convite."
              : "Não foi possível. A dupla precisa do SQL aplicado no banco.",
          { duration: 6000 },
        );
        return;
      }
      if (fn === "convidar") toast.success("Convite enviado 🔥");
      if (fn === "aceitar") toast.success("Dupla formada! A chama começa hoje 🔥");
      aoMudar();
    } catch {
      toast("Não foi possível agora.");
    } finally {
      setOcupado(false);
    }
  }

  const estado = dupla?.estado ?? "sem";

  return (
    <div className="rounded-3xl border border-amber-200 bg-gradient-to-b from-amber-50 to-white p-5 dark:border-amber-500/25 dark:from-amber-500/10 dark:to-transparent">
      <div className="flex items-start gap-3">
        <ChamaDaSequencia acesa={estado === "ativa" && (dupla?.sequencia ?? 0) > 0} tamanho={34} />
        <div className="min-w-0 flex-1">
          <p className="font-serif text-lg">Dupla de sequência</p>
          <p className="mt-1 text-[13px] leading-snug text-muted-foreground">
            Vocês duas seguram a mesma chama: o dia conta quando as duas aparecem.{" "}
            {/* Dito em voz alta porque é o que separa isto de um placar — e é a
                primeira coisa que alguém teme ao ler "dupla". */}
            <strong className="font-semibold">Ninguém perde nada</strong> se a outra não vier.
          </p>
        </div>
      </div>

      {estado === "ativa" && dupla && (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-white/70 p-3 dark:bg-white/5">
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">com {dupla.nome}</span>
            <span className="text-[11px] text-muted-foreground">
              {dupla.sequencia === 0
                ? "a chama começa quando as duas aparecerem"
                : `${dupla.sequencia} ${dupla.sequencia === 1 ? "dia" : "dias"} juntas`}
            </span>
          </span>
          <button
            onClick={() => chamar("desfazer")}
            disabled={ocupado}
            className="shrink-0 rounded-full border border-border px-3 py-1.5 text-[11px] font-semibold text-muted-foreground"
          >
            Desfazer
          </button>
        </div>
      )}

      {estado === "convite-recebido" && dupla && (
        <div className="mt-4 rounded-2xl bg-white/70 p-3 dark:bg-white/5">
          <p className="text-sm">
            <strong>{dupla.nome}</strong> te chamou para uma dupla.
          </p>
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => chamar("aceitar", dupla.amigaId!)}
              disabled={ocupado}
              className="press rounded-full bg-amber-500 px-4 py-1.5 text-xs font-bold text-white"
            >
              Aceitar 🔥
            </button>
            <button
              onClick={() => chamar("recusar", dupla.amigaId!)}
              disabled={ocupado}
              className="rounded-full border border-border px-4 py-1.5 text-xs font-semibold text-muted-foreground"
            >
              Agora não
            </button>
          </div>
        </div>
      )}

      {estado === "convite-enviado" && dupla && (
        <p className="mt-4 rounded-2xl bg-white/70 p-3 text-sm text-muted-foreground dark:bg-white/5">
          Convite enviado para <strong>{dupla.nome}</strong>. Esperando ela aceitar.
        </p>
      )}

      {estado === "sem" &&
        (amigas.length === 0 ? (
          <p className="mt-4 text-[13px] text-muted-foreground">
            Quando uma amiga entrar pelo seu convite, ela aparece aqui para formar dupla.
          </p>
        ) : (
          <div className="mt-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Chamar para a dupla
            </p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {amigas.slice(0, 8).map((a) => (
                <li key={a.id}>
                  <button
                    onClick={() => chamar("convidar", a.id)}
                    disabled={ocupado}
                    className="press rounded-full border border-amber-300 px-3 py-1.5 text-xs font-semibold text-amber-800 disabled:opacity-50 dark:text-amber-200"
                  >
                    {a.nome}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
    </div>
  );
}

/* ══════════════════════════ O PERFIL + O CANTINHO ══════════════════════════ */

type Cantinho = {
  possui: string[];
  fundo: string | null;
  skin: string | null;
  postos: EnfeitePosto[];
};

function PerfilDaAmigaTela({ amigaId, aoVoltar }: { amigaId: string; aoVoltar: () => void }) {
  const [perfil, setPerfil] = useState<PerfilDeAmiga | null>(null);
  const [cantinho, setCantinho] = useState<Cantinho | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [presenteando, setPresenteando] = useState(false);
  const [presenteado, setPresenteado] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data: s } = await supabase.auth.getSession();
        if (!s.session?.access_token) return;
        const { perfilDaAmiga } = await import("@/lib/amigas.functions");
        const r = await perfilDaAmiga({
          data: { accessToken: s.session.access_token, amigaId },
        });
        if (r.ok) {
          setPerfil(r.perfil);
          setCantinho(r.cantinho as Cantinho);
        } else {
          /* "indisponivel" nunca diz o motivo — dizer contaria a perda dela. */
          setErro(
            r.error === "indisponivel"
              ? "O Cantinho dela não está aberto para visitas agora."
              : "Não foi possível abrir este perfil.",
          );
        }
      } catch {
        setErro("Não foi possível abrir este perfil.");
      }
    })();
  }, [amigaId]);

  async function presentear() {
    setPresenteando(true);
    try {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session?.access_token) return;
      const { presentearAmiga } = await import("@/lib/mesada-paciente.functions");
      const r = await presentearAmiga({
        data: { accessToken: s.session.access_token, amigaId },
      });
      if (r.ok) {
        setPresenteado(true);
        toast.success(`${PRESENTE_ENTRE_AMIGAS} Sementinhas para ${perfil?.nome ?? "ela"} 🌱`);
        return;
      }
      /* Cada recusa com frase própria: "não foi possível" faz tentar de novo
         contra uma parede que não vai ceder. */
      toast(
        r.error === "sem_premium"
          ? "O bolso de presentear é do Premium."
          : r.error === "mesada_esgotada"
            ? "Seu bolso deste mês acabou. Ele volta na virada."
            : r.error === "ja_presenteada"
              ? `${perfil?.nome ?? "Ela"} já ganhou um presente seu neste mês.`
              : r.error === "modo_cuidado"
                ? "Não é possível agora."
                : r.error === "nao_indicada"
                  ? "Vocês precisam estar conectadas pelo convite."
                  : "Não foi possível enviar.",
        { duration: 6000 },
      );
    } catch {
      toast("Não foi possível enviar.");
    } finally {
      setPresenteando(false);
    }
  }

  const voltar = (
    <button
      onClick={aoVoltar}
      className="press mb-3 rounded-full border border-border px-3 py-1.5 text-xs font-semibold"
    >
      ← Amigas
    </button>
  );

  if (erro) {
    return (
      <div>
        {voltar}
        <div className="rounded-3xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {erro}
        </div>
      </div>
    );
  }
  if (!perfil || !cantinho) return <div className="skeleton h-72 rounded-3xl" />;

  const fundo = fundoBgFor(cantinho.fundo) ?? "linear-gradient(180deg,#fff5f4,#ffdfd8)";
  /* A pele das bolinhas que ela equipou. Entra como uma bolinha ao lado do
     mascote, e não vestindo a Bolha: a Bolha é a personagem do app, igual para
     todo mundo, e trocar a pele DELA confundiria as duas coisas. */
  const pele = cantinho.skin ? TRILHA_SKINS[cantinho.skin] : null;

  return (
    <div>
      {voltar}

      {/* ── O CANTINHO DELA ──────────────────────────────────────────────
          O cenário que ela comprou e arrumou, com os enfeites nas posições
          que ela escolheu. É a peça que transforma a economia de Sementinhas
          em vitrine: comprar enfeite passa a ter público. */}
      <div
        className="relative h-52 overflow-hidden rounded-3xl border border-border"
        style={{ background: fundo }}
      >
        {cantinho.postos.map((e, i) => {
          const item = CANTINHO_BY_ID[e.id];
          if (!item) return null;
          return (
            <span
              key={`${e.id}-${i}`}
              aria-hidden
              className="dc-flutua absolute select-none leading-none"
              style={{
                left: `${e.x}%`,
                /* `y` dela é px ao longo de uma trilha longa; aqui vira % de
                   uma faixa curta. Sem a dobra, tudo cairia fora da moldura. */
                top: `${(e.y % 900) / 9}%`,
                fontSize: `${Math.round(22 * e.s)}px`,
                animationDelay: `${i * 0.7}s`,
              }}
            >
              {item.emoji}
            </span>
          );
        })}
        {cantinho.postos.length === 0 && (
          <span className="absolute inset-0 flex items-center justify-center text-sm text-white/80">
            O Cantinho dela ainda está começando
          </span>
        )}
        <span className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-end gap-2">
          <Bolha tamanho={72} humor="feliz" />
          {pele && (
            <img
              src={pele.arte.feito}
              alt=""
              title={`bolinha ${pele.nome}`}
              className="mb-2 h-7 w-7 object-contain drop-shadow-sm"
            />
          )}
        </span>
      </div>

      {/* ── QUEM ELA É — e o que NÃO está aqui ───────────────────────────
          Sem semana, sem DPP, sem medida. É o que permite esta tela existir
          quando uma gestação termina mal. */}
      <div className="mt-4 rounded-3xl border border-border bg-card p-5 text-center">
        <p className="font-serif text-2xl">{perfil.nome}</p>
        {perfil.bebe && (
          <p className="mt-0.5 text-sm text-muted-foreground">esperando {perfil.bebe} 💜</p>
        )}
        <p className="mt-1 text-xs text-muted-foreground">{tempoNoApp(perfil.diasNoApp)}</p>

        <div className="mt-4 flex items-center justify-center gap-6">
          <span className="flex items-center gap-1.5">
            <ChamaDaSequencia acesa={perfil.sequencia > 0} tamanho={26} />
            <span className="text-lg font-extrabold text-amber-500">{perfil.sequencia}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <TrofeuIcone />
            <span className="text-lg font-extrabold text-violet-500">{perfil.trofeus}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="text-xl leading-none">🪴</span>
            <span className="text-lg font-extrabold text-emerald-500">{perfil.itens}</span>
          </span>
        </div>

        <button
          onClick={presentear}
          disabled={presenteando || presenteado}
          className="press mt-5 w-full rounded-full bg-emerald-500 py-3 text-sm font-bold text-white disabled:opacity-50"
        >
          {presenteado
            ? "Enviado ✓"
            : presenteando
              ? "Enviando…"
              : `Presentear ${PRESENTE_ENTRE_AMIGAS} 🌱`}
        </button>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Ela recebe um aviso com o seu nome ao abrir o Caminho.
        </p>
      </div>
    </div>
  );
}
