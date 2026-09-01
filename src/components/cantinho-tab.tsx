import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { TabSkeleton } from "@/components/tab-skeleton";
import { SilencioDoCuidado } from "@/components/silencio-do-cuidado";
import { CodigoDaEmbaixadora } from "@/components/onboarding-ritual";
import { OfertaPremium } from "@/components/oferta-premium";
import { LojaSementinhas } from "@/components/loja-sementinhas";
import { celebrateChime, fireConfetti } from "@/lib/celebrate";
import { tocarSomDeUI } from "@/lib/tocar-som-de-ui";
import { faltamTrofeus, trofeusExigidos } from "@/lib/trofeus";
import { CONJUNTO_POR_ID, conjuntosOrdenados } from "@/lib/conjuntos";
import {
  CANTINHO_CATEGORIES,
  CANTINHO_COMPLETIONIST_ID,
  CANTINHO_COMPLETION_MIN,
  CANTINHO_ITEMS,
  cantinhoCategoriasCompletas,
  isCantinhoCollectionComplete,
  type CantinhoType,
} from "@/lib/cantinho";
import {
  buyCantinhoItem,
  getCantinho,
  setCantinhoFundo,
  setSkyTheme,
} from "@/lib/cantinho.functions";
import { getInstagramShare, setInstagramHandle } from "@/lib/instagram.functions";
import { claimRatingReward, getRatingReward } from "@/lib/rating.functions";
import {
  getMyTestimonial,
  submitTestimonial,
  type TestimonialStatus,
} from "@/lib/testimonials.functions";
import { getReferral } from "@/lib/referral.functions";
import { linkDeIndicacao, mensagemDeConvite } from "@/lib/indicacao";
import { lsGet, lsSet } from "@/lib/journey-sync";
import { SKIN_KEY } from "@/lib/trilha-skins";
import { ordenar } from "@/lib/notificacoes";

/**
 * O CANTINHO — o quinto corte de `minha-conta.tsx`.
 *
 * ⚠️ **MOVE, byte a byte.** Os quatro cartões (Instagram, avaliação,
 * depoimento e indicação) vêm junto porque são exclusivos desta aba — duas
 * ocorrências cada no repositório, a declaração e o uso.
 *
 * ⚠️ **Não confundir `ReferralCard` com o do painel**: `painel.tsx` tem um
 * componente de MESMO NOME e assinatura diferente (`tokenFn`). São dois, e
 * sempre foram.
 */

function InstagramShareCard() {
  const [state, setState] = useState<{
    enabled: boolean;
    handle: string | null;
    reward: number;
    tag: string;
    rewardedThisWeek: boolean;
  } | null>(null);
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session?.access_token) return;
      const res = await getInstagramShare({ data: { accessToken: s.session.access_token } });
      if (res.ok) {
        setState({
          enabled: res.enabled,
          handle: res.handle,
          reward: res.reward,
          tag: res.tag,
          rewardedThisWeek: res.rewardedThisWeek,
        });
        setInput(res.handle ?? "");
      }
    })();
  }, []);

  async function save() {
    if (saving) return;
    setSaving(true);
    const { data: s } = await supabase.auth.getSession();
    if (!s.session?.access_token) {
      setSaving(false);
      return;
    }
    const res = await setInstagramHandle({
      data: { accessToken: s.session.access_token, handle: input },
    });
    if (res.ok) {
      setState((st) => (st ? { ...st, handle: res.handle } : st));
      toast(res.handle ? "Instagram salvo! 📸" : "Instagram removido");
    } else {
      toast(res.error ?? "Não foi possível salvar");
    }
    setSaving(false);
  }

  // Integração desligada (Meta ainda não configurada) → não mostra nada.
  if (!state || !state.enabled) return null;

  return (
    <div className="rounded-3xl border border-fuchsia-200 bg-gradient-to-br from-fuchsia-50 via-white to-rose-50 p-5">
      <div className="flex items-center gap-2">
        <span className="text-2xl">📸</span>
        <p className="text-sm font-extrabold text-fuchsia-700">
          Compartilhe e ganhe {state.reward} 🌱
        </p>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-foreground/80">
        Poste um Story marcando <span className="font-bold">@{state.tag}</span> mostrando seu
        progresso e ganhe <span className="font-bold">{state.reward} Sementinhas</span> —
        automático, até 1x por semana. 💜
      </p>

      {state.rewardedThisWeek && (
        <p className="mt-2 rounded-xl bg-emerald-100 px-3 py-2 text-xs font-bold text-emerald-700">
          Você já ganhou esta semana ✓ Obrigado por compartilhar!
        </p>
      )}

      <label className="mt-3 block text-xs font-semibold text-muted-foreground">
        Seu @ do Instagram (pra gente reconhecer você)
      </label>
      <div className="mt-1 flex gap-2">
        <div className="flex flex-1 items-center rounded-full border border-border bg-white px-3">
          <span className="text-sm text-muted-foreground">@</span>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value.replace(/^@+/, ""))}
            placeholder="seu.usuario"
            className="w-full bg-transparent px-1 py-2 text-sm outline-none"
            autoCapitalize="none"
            autoCorrect="off"
          />
        </div>
        <button
          onClick={save}
          disabled={saving || input.trim() === (state.handle ?? "")}
          className="press shrink-0 rounded-full bg-fuchsia-500 px-4 py-2 text-xs font-bold text-white disabled:opacity-40"
        >
          Salvar
        </button>
      </div>

      {state.handle && (
        <a
          href="https://instagram.com"
          target="_blank"
          rel="noopener noreferrer"
          className="press mt-3 flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-fuchsia-500 to-rose-500 py-2.5 text-sm font-extrabold text-white"
        >
          Abrir o Instagram e postar
        </a>
      )}
    </div>
  );
}

function RatingRewardCard({ onEarned }: { onEarned: (n: number) => void }) {
  const [state, setState] = useState<{
    enabled: boolean;
    reward: number;
    playUrl: string | null;
    appleUrl: string | null;
    claimed: boolean;
  } | null>(null);
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session?.access_token) return;
      const res = await getRatingReward({ data: { accessToken: s.session.access_token } });
      if (res.ok) {
        setState({
          enabled: res.enabled,
          reward: res.reward,
          playUrl: res.playUrl,
          appleUrl: res.appleUrl,
          claimed: res.claimed,
        });
      }
    })();
  }, []);

  async function claim() {
    if (claiming) return;
    setClaiming(true);
    const { data: s } = await supabase.auth.getSession();
    if (!s.session?.access_token) {
      setClaiming(false);
      return;
    }
    const res = await claimRatingReward({ data: { accessToken: s.session.access_token } });
    if (res.ok && res.granted > 0) {
      onEarned(res.granted);
      setState((st) => (st ? { ...st, claimed: true } : st));
      toast(`+${res.granted} 🌱 Obrigado por avaliar! ⭐`);
    } else if (res.ok) {
      setState((st) => (st ? { ...st, claimed: true } : st));
    } else {
      toast(res.error ?? "Não foi possível resgatar");
    }
    setClaiming(false);
  }

  if (!state || !state.enabled) return null;

  return (
    <div className="rounded-3xl border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-yellow-50 p-5">
      <div className="flex items-center gap-2">
        <span className="text-2xl">⭐</span>
        <p className="text-sm font-extrabold text-amber-700">
          Avalie o app e ganhe {state.reward} 🌱
        </p>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-foreground/80">
        Sua avaliação ajuda outras gestantes a encontrarem o app 💛 Avalie na loja e ganhe{" "}
        <span className="font-bold">{state.reward} Sementinhas</span>.
      </p>

      {state.claimed ? (
        <p className="mt-3 rounded-xl bg-emerald-100 px-3 py-2 text-xs font-bold text-emerald-700">
          Recompensa resgatada ✓ Obrigado! ⭐
        </p>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap gap-2">
            {state.appleUrl && (
              <a
                href={state.appleUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="press flex-1 rounded-full border border-amber-300 bg-white py-2 text-center text-xs font-bold text-amber-700"
              >
                App Store
              </a>
            )}
            {state.playUrl && (
              <a
                href={state.playUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="press flex-1 rounded-full border border-amber-300 bg-white py-2 text-center text-xs font-bold text-amber-700"
              >
                ▶ Play Store
              </a>
            )}
          </div>
          <button
            onClick={claim}
            disabled={claiming}
            className="press mt-2 w-full rounded-full bg-gradient-to-r from-amber-400 to-yellow-500 py-2.5 text-sm font-extrabold text-white disabled:opacity-40"
          >
            Já avaliei — resgatar {state.reward} 🌱
          </button>
        </>
      )}
    </div>
  );
}

function TestimonialCard() {
  const [status, setStatus] = useState<TestimonialStatus | null>(null);
  const [body, setBody] = useState("");
  const [name, setName] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session?.access_token) return;
      const res = await getMyTestimonial({ data: { accessToken: s.session.access_token } });
      if (res.ok) {
        if (res.testimonial) {
          setStatus(res.testimonial.status);
          setBody(res.testimonial.body);
          setName(res.testimonial.displayName ?? "");
        }
        setLoaded(true);
      }
    })();
  }, []);

  async function send() {
    if (saving || body.trim().length < 10) return;
    setSaving(true);
    const { data: s } = await supabase.auth.getSession();
    if (!s.session?.access_token) {
      setSaving(false);
      return;
    }
    const res = await submitTestimonial({
      data: { accessToken: s.session.access_token, body: body.trim(), displayName: name.trim() },
    });
    if (res.ok) {
      setStatus("pending");
      setEditing(false);
      toast("Depoimento enviado! O Dr. Clóvis vai revisar 💛");
    } else {
      toast(res.error ?? "Não foi possível enviar");
    }
    setSaving(false);
  }

  if (!loaded) return null;

  const statusBadge =
    status === "approved" ? (
      <span className="rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-bold text-emerald-700">
        Publicado ✓ +100 🌱
      </span>
    ) : status === "pending" ? (
      <span className="rounded-full bg-amber-100 px-3 py-1 text-[11px] font-bold text-amber-700">
        Em análise pelo médico ⏳
      </span>
    ) : status === "rejected" ? (
      <span className="rounded-full bg-rose-100 px-3 py-1 text-[11px] font-bold text-rose-600">
        Não publicado — pode reescrever
      </span>
    ) : null;

  // Já enviou e não está editando: mostra status + preview + botão editar.
  const showForm = editing || !status;

  return (
    <div className="rounded-3xl border border-violet-200 bg-gradient-to-br from-violet-50 via-white to-fuchsia-50 p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-2xl">💬</span>
          <p className="text-sm font-extrabold text-violet-700">Deixe seu depoimento</p>
        </div>
        {statusBadge}
      </div>

      {showForm ? (
        <>
          <p className="mt-2 text-sm leading-relaxed text-foreground/80">
            Conte como está sendo sua experiência 💜 Se o Dr. Clóvis aprovar, você ganha{" "}
            <span className="font-bold">100 Sementinhas</span> e seu depoimento pode aparecer no
            site.
          </p>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value.slice(0, 600))}
            rows={4}
            placeholder="Escreva aqui seu depoimento..."
            className="mt-3 w-full resize-none rounded-2xl border border-border bg-white p-3 text-sm outline-none focus:border-violet-400"
          />
          <input
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 60))}
            placeholder="Como quer aparecer (ex.: Mariana, mamãe da Alice)"
            className="mt-2 w-full rounded-full border border-border bg-white px-4 py-2 text-sm outline-none focus:border-violet-400"
          />
          <button
            onClick={send}
            disabled={saving || body.trim().length < 10}
            className="press mt-2 w-full rounded-full bg-violet-500 py-2.5 text-sm font-extrabold text-white disabled:opacity-40"
          >
            {status ? "Reenviar para análise" : "Enviar depoimento"}
          </button>
        </>
      ) : (
        <>
          <p className="mt-3 rounded-2xl bg-white/70 p-3 text-sm italic leading-relaxed text-foreground/80">
            “{body}”
          </p>
          <button
            onClick={() => setEditing(true)}
            className="press mt-2 text-xs font-bold text-violet-600"
          >
            Editar depoimento
          </button>
        </>
      )}
    </div>
  );
}

function ReferralCard() {
  const [code, setCode] = useState<string | null>(null);
  const [count, setCount] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session?.access_token) return;
      const res = await getReferral({ data: { accessToken: s.session.access_token } });
      if (res.ok) {
        setCode(res.code);
        setCount(res.count);
      }
      setLoaded(true);
    })();
  }, []);

  /* ⚠️ O MESMO construtor da aba das Amigas (`indicacao.ts`). As duas telas
     montavam este link à mão, e a mais nova divergiu: o botão "Convidar" das
     Amigas mandava `/auth` sem código nenhum, e a amiga que entrasse por ali
     nunca virava amiga de ninguém. Duas construções do mesmo link é sempre
     assim que acaba. */
  const link = linkDeIndicacao(
    code,
    typeof window !== "undefined" ? window.location.origin : undefined,
  );
  /* Sem link não há cartão: ele existe para ser compartilhado, e um botão de
     copiar que copia `null` é pior que a ausência do cartão. */
  if (!loaded || !code || !link) return null;
  const msg = mensagemDeConvite(link);

  async function copy() {
    try {
      /* O TEXTO INTEIRO, e não só a URL — é o mesmo que a aba das Amigas faz.
         Colado no WhatsApp, um "https://..." sozinho não diz de quem veio nem
         o que é, e é justamente aí que a amiga decide se abre. */
      await navigator.clipboard.writeText(msg);
      toast.success("Link copiado! Manda pra sua amiga 💌");
    } catch {
      toast("Copie o link: " + msg);
    }
  }

  return (
    <div className="rounded-3xl border border-pink-200 bg-gradient-to-br from-pink-50 via-white to-rose-50 p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-2xl">👭</span>
          <p className="text-sm font-extrabold text-pink-700">Indique uma amiga → 100 🌱</p>
        </div>
        {count > 0 && (
          <span className="rounded-full bg-pink-100 px-3 py-1 text-[11px] font-bold text-pink-700">
            {count} {count === 1 ? "amiga" : "amigas"} 💞
          </span>
        )}
      </div>
      <p className="mt-2 text-sm leading-relaxed text-foreground/80">
        Cada amiga que criar a conta pelo seu link te dá{" "}
        <span className="font-bold">100 Sementinhas</span>. Sem limite de amigas 💜
      </p>

      <div className="mt-3 flex items-center gap-2 rounded-full border border-border bg-white px-3 py-2">
        <span className="flex-1 truncate text-xs text-muted-foreground">{link}</span>
        <button onClick={copy} className="press shrink-0 text-xs font-bold text-pink-600">
          Copiar
        </button>
      </div>
      <a
        href={`https://wa.me/?text=${encodeURIComponent(msg)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="press mt-2 flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-pink-500 to-rose-500 py-2.5 text-sm font-extrabold text-white"
      >
        Convidar pelo WhatsApp
      </a>
    </div>
  );
}

export function CantinhoTab({
  careMode = false,
  onNavigate,
  skyTheme = "v2",
  onSkyChange,
  bancada,
}: {
  careMode?: boolean;
  onNavigate?: (t: string) => void;
  /** Céu da home hoje — o item "Céu Clássico" marca "Em uso" a partir daqui. */
  skyTheme?: "v2" | "v1";
  /** Avisa a página para a home repintar sem esperar um reload. */
  onSkyChange?: (t: "v2" | "v1") => void;
  /**
   * ⚠️ SÓ PARA A BANCADA (`/preview-cantinho`).
   *
   * A vitrine só desenha com uma sessão e um saldo do servidor, então esta aba
   * — que é a "aba dos itens do jogo" — **nunca tinha sido fotografada**. Era
   * a única forma de olhar para ela sem uma conta com Sementinhas gastas.
   *
   * ⚠️ Ela injeta o DADO nos MESMOS `useState` da produção, nunca o desenho: é
   * a lição do `?streak=41` da folha da chama, que cravava o número e deixava
   * o saldo vir de uma jornada vazia.
   */
  bancada?: { saldo: number; owned: string[]; premium: boolean; trofeus: number };
}) {
  const [loading, setLoading] = useState(true);
  const [saldo, setSaldo] = useState(0);
  const [owned, setOwned] = useState<string[]>([]);
  const [premium, setPremium] = useState(false);
  const [sky, setSky] = useState<"v2" | "v1">(skyTheme);
  const [equipped, setEquipped] = useState<string | null>(null);
  const [cat, setCat] = useState<CantinhoType | "all">("all");
  const [buying, setBuying] = useState<string | null>(null);
  /* Nome do item que ela tentou pegar; `null` = folha fechada. */
  const [oferta, setOferta] = useState<string | null>(null);
  const [lojaSementinhas, setLojaSementinhas] = useState(false);
  const [collection, setCollection] = useState({ owned: 0, total: 0, complete: false });
  /* Pele equipada das bolinhas do Caminho. Lida no cliente (localStorage
     dentro do blob da jornada), então começa nula e se corrige ao montar. */
  const [skinAtiva, setSkinAtiva] = useState<string | null>(null);
  /* Troféus (dias de cinco estrelas). Três itens só abrem com eles — ver
     `TROFEUS_PARA`. O número é só para a VITRINE desenhar o cadeado e dizer
     quantos faltam; quem decide a compra é o servidor, que reconta. */
  const [trofeus, setTrofeus] = useState(0);
  useEffect(() => {
    setSkinAtiva(lsGet<string | null>(SKIN_KEY, null));
  }, []);
  // As formas de ganhar Sementinhas ficam num bloco só, recolhido por padrão,
  // pra não empilhar 4 cards e poluir a tela (fica "Ganhe mais 🌱 ›").
  const [showEarn, setShowEarn] = useState(false);
  const ehBancada = !!bancada;
  const bancadaRef = useRef(bancada);
  bancadaRef.current = bancada;

  useEffect(() => {
    /* ⚠️ Guarda BOOLEANO, e não o objeto: um literal remontado a cada render
       faz o efeito re-rodar em toda pintura. É a lição da bancada das Amigas. */
    if (ehBancada) {
      setSaldo(bancadaRef.current!.saldo);
      setOwned(bancadaRef.current!.owned);
      setPremium(bancadaRef.current!.premium);
      setTrofeus(bancadaRef.current!.trofeus);
      setLoading(false);
      return;
    }
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session?.access_token) {
        setLoading(false);
        return;
      }
      const res = await getCantinho({ data: { accessToken: s.session.access_token } });
      if (res.ok) {
        setSaldo(res.balance);
        setOwned(res.owned);
        setPremium(res.premium);
        setEquipped(res.equippedFundo);
        setCollection({
          owned: res.collectionOwned ?? 0,
          total: res.collectionTotal ?? 0,
          complete: res.collectionComplete ?? false,
        });
        setTrofeus(res.trofeus ?? 0);
      }
      setLoading(false);
    })();
  }, [ehBancada]);

  async function equipSkyTheme(theme: "v2" | "v1") {
    const { data: s } = await supabase.auth.getSession();
    if (!s.session?.access_token) return;
    const prev = sky;
    setSky(theme); // otimista
    const res = await setSkyTheme({ data: { accessToken: s.session.access_token, theme } });
    if (!res.ok) {
      setSky(prev);
      toast(res.error ?? "Não foi possível trocar o céu");
    } else {
      toast(theme === "v1" ? "Céu Clássico aplicado 🌅" : "De volta ao céu novo ✨");
      onSkyChange?.(theme);
    }
  }

  /* A pele das bolinhas NÃO vai para o servidor.
     Ela mora no `journey_state` — o mesmo blob que já guarda o progresso da
     jornada e as posições dos enfeites, e que já sincroniza entre aparelhos.
     Uma coluna nova em `patient_profiles` daria o mesmo resultado ao custo de
     uma migração que precisa ser rodada à mão no Supabase, e este projeto já
     tem migrações pendentes esperando isso. */
  function equipSkin(id: string | null) {
    setSkinAtiva(id);
    lsSet(SKIN_KEY, id);
    /* Avisa o Caminho, que pode estar montado noutra aba ao mesmo tempo. */
    window.dispatchEvent(new CustomEvent("dc-skin-trocada", { detail: id }));
    toast(id ? "Bolinhas trocadas! 🌱" : "Bolinhas de volta ao normal");
  }

  async function equipFundo(id: string | null) {
    const { data: s } = await supabase.auth.getSession();
    if (!s.session?.access_token) return;
    const prev = equipped;
    setEquipped(id); // otimista
    const res = await setCantinhoFundo({
      data: { accessToken: s.session.access_token, fundoId: id },
    });
    if (!res.ok) {
      setEquipped(prev);
      toast(res.error ?? "Não foi possível trocar o cenário");
    } else {
      toast(id ? "Cenário aplicado! 🌄" : "Cenário removido");
    }
  }

  if (loading) return <TabSkeleton />;

  const ownedSet = new Set(owned);
  // A cena mostra só decorações que a paciente REALMENTE possui — cenários
  // (fundo) são papel de parede, não entram como emoji na cena.
  // Enfeites que ela posiciona no Cantinho. Fora: `fundo` (é o cenário) e
  // `tema` (veste a home do app, não entra na cena).
  const ownedItems = CANTINHO_ITEMS.filter(
    (i) => ownedSet.has(i.id) && i.type !== "fundo" && i.type !== "tema",
  );
  /**
   * A ordem da vitrine.
   *
   * Era a ordem do ARQUIVO: a paciente abria a loja e via, em sequência,
   * 280 · grátis · 150 · 30. Nada dizia o que ela alcança hoje, e o primeiro
   * tile — o mais caro da prateleira comum — era justamente o que ela não
   * pode comprar.
   *
   * Agora é preço crescente: o que ela alcança primeiro vem primeiro, e a
   * grade vira uma escada. Quem NÃO tem Premium leva os bloqueados para o
   * fim, também em ordem — eles continuam visíveis (é assim que ela descobre
   * que existem), mas param de atravessar a lista do que dá para comprar
   * hoje. Quem TEM Premium vê tudo numa escada só: para ela não há prateleira
   * separada, todos os itens são compráveis.
   *
   * A Coroa fica sempre por último: é troféu, não item.
   *
   * Sem `useMemo` de propósito — esta linha vem depois de um `return`
   * antecipado, e hook atrás de return quebra a ordem dos hooks entre
   * renders. São 111 itens; ordenar a cada render custa menos que o risco.
   */
  const shopItems = (() => {
    /* ⚠️ `CANTINHO_LOJA`, e não `CANTINHO_ITEMS`: quatro itens foram
       aposentados (emoji igual ao de outro item, ou nome que prometia
       comportamento inexistente) e saíram da VITRINE. Continuam no catálogo,
       desenhando no cantinho de quem já os comprou — ver `aposentado` em
       `cantinho.ts`. Quem tem um deles o vê em "Meus itens", logo acima. */
    const daCategoria = CANTINHO_ITEMS.filter(
      (i) => (cat === "all" || i.type === cat) && (!i.aposentado || owned.includes(i.id)),
    );
    const peso = (i: (typeof CANTINHO_ITEMS)[number]) =>
      i.id === CANTINHO_COMPLETIONIST_ID ? 2 : !premium && i.premium ? 1 : 0;
    return [...daCategoria].sort(
      (a, b) => peso(a) - peso(b) || a.price - b.price || a.name.localeCompare(b.name, "pt-BR"),
    );
  })();

  async function buy(itemId: string, price: number) {
    if (buying) return;
    if (saldo < price) {
      toast("Sementinhas insuficientes 🌱");
      return;
    }
    setBuying(itemId);
    try {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session?.access_token) {
        toast("Sua sessão expirou — entre novamente.");
        return;
      }
      const res = await buyCantinhoItem({
        data: { accessToken: s.session.access_token, itemId },
      });
      if (res.ok) {
        setSaldo(res.balance);
        /**
         * ⚠️ COMPRAR ERA MUDO — exceto no caso RARO.
         *
         * O único som da compra era o do conjunto completo, algumas linhas
         * abaixo. Ou seja: o caso comum (comprar um enfeite) acontecia em
         * silêncio e o caso excepcional fazia festa — o que faz o comum parecer
         * ter FALHADO.
         *
         * Comprar é a saída da moeda, e merece o mesmo selo de "pousou" que
         * guardar tem, não o arpejo de conquista. O conjunto completo continua
         * com a festa maior; a hierarquia é essa.
         */
        tocarSomDeUI("guardado", { careMode });
        setOwned((o) => {
          const next = o.includes(itemId) ? o : [...o, itemId];
          // Trofeu da coleção: se esta compra fechou a coleção, desbloqueia na hora.
          const nowComplete = isCantinhoCollectionComplete(next);
          /* Conta CATEGORIAS, igual ao servidor (`getCantinho`).
             Contava `CANTINHO_COMPLETION_REQUIRED.filter(...)` — a lista de
             ids REPRESENTATIVOS, um por categoria — então o selo caía de
             "5/8 categorias" para "1/8" na hora em que ela comprava algo, a
             menos que o item comprado fosse exatamente o representante. O
             servidor já tinha sido corrigido; o cliente, não. */
          setCollection((c) => ({
            owned: cantinhoCategoriasCompletas(next),
            total: c.total || CANTINHO_COMPLETION_MIN,
            complete: nowComplete,
          }));
          return nowComplete && !next.includes(CANTINHO_COMPLETIONIST_ID)
            ? [...next, CANTINHO_COMPLETIONIST_ID]
            : next;
        });
        /* ─── ⚠️ O CONJUNTO FECHADO PRECISA SER DITO ────────────────────
           `conjuntosFechados` existia com o comentário "a tela usa para saber
           que este item fechou um, e comemorar" — e NENHUM leitor no repo. A
           paciente fechava um conjunto, o servidor creditava 36–48 🌱, a
           prateleira virava "completo ✓" e o app não dizia uma palavra.

           `conjuntosNovos` são só os que fecharam NESTA compra (a lista
           antiga trazia todos os já fechados), e `bonusNovo` é o que de fato
           foi creditado agora. */
        if (res.conjuntosNovos?.length) {
          const nomes = res.conjuntosNovos
            .map((cid) => CONJUNTO_POR_ID[cid]?.nome)
            .filter(Boolean)
            .join(" · ");
          toast.success(`Conjunto completo: ${nomes}! +${res.bonusNovo} 🌱`, { duration: 7000 });
          /* A mesma festa da conquista, e pelo mesmo motivo: fechar um
             conjunto é a coisa mais rara que acontece no Cantinho. */
          fireConfetti(1);
          celebrateChime(1, careMode);
        } else {
          toast("Adicionado ao seu cantinho! 💛");
        }
      } else {
        toast(res.error ?? "Não foi possível comprar");
        if (typeof res.balance === "number") setSaldo(res.balance);
        // Já possuído (ex.: comprado em outro aparelho): reflete na hora.
        // Compara o CÓDIGO, não a frase — a frase tem emoji e nunca casava.
        if ("motivo" in res && res.motivo === "ja_possui")
          setOwned((o) => (o.includes(itemId) ? o : [...o, itemId]));
      }
    } catch (e) {
      // SEM try/catch, um erro aqui deixava `buying` travado pra sempre e todos
      // os cliques seguintes viravam no-op silencioso. Agora sempre libera.
      console.error("[cantinho buy] erro:", e);
      toast("Não consegui comprar agora — tente de novo em instantes.");
    } finally {
      setBuying(null);
    }
  }

  const pill = (active: boolean) =>
    `shrink-0 rounded-full px-4 py-1.5 text-[12px] font-semibold transition-colors ${
      active ? "bg-emerald-100 text-emerald-700" : "text-foreground/45 hover:text-foreground/70"
    }`;

  /* Modo Cuidado: a prateleira inteira se cala, não só o saldo.
     `getCantinho` já devolvia saldo 0 e nada possuído, mas a paciente
     continuava vendo o catálogo com "Berço (opcional) — 250 🌱" e o
     cabeçalho "Um cantinho que cresce com você". O conserto anterior tinha
     fechado metade da porta. */
  if (careMode) return <SilencioDoCuidado onNavigate={onNavigate} />;
  return (
    <div className="space-y-6">
      {/* Cabeçalho + saldo */}
      <div className="flex items-center justify-between rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-lime-50 p-5">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-emerald-700">Meu Cantinho</p>
          <p className="mt-0.5 text-sm text-emerald-800/80">Um cantinho que cresce com você.</p>
        </div>
        {/* O saldo era um <div> mudo. Virou botão: é o lugar óbvio onde a
            paciente vai tocar querendo saber como se ganha (e agora, como se
            compra) Sementinhas. */}
        <button
          onClick={() => setLojaSementinhas(true)}
          aria-label="Ver como ganhar e comprar Sementinhas"
          className="press flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1.5"
        >
          <span className="text-lg">🌱</span>
          <span className="tabular-nums font-extrabold text-emerald-600">{saldo}</span>
          <span aria-hidden className="text-[10px] font-bold text-emerald-500">
            +
          </span>
        </button>
      </div>

      {/* A VITRINE SAIU.
          Ela era um quadro de 300px que mostrava os enfeites espalhados e um
          botão "Arrumar na trilha". Mas arrumar já acontece no Caminho, na
          tela grande, com posição e tamanho — e é lá que os enfeites vivem.
          O quadro era, então, uma segunda cópia do Caminho: mais pobre (sem
          escala, sem arrastar) e desencontrada dele, porque as posições daqui
          nunca foram as de lá. Esta aba volta a ser o que ela é: saldo, como
          ganhar mais e a loja. O cantinho em si mora no Caminho. */}
      {ownedItems.length === 0 && (
        <div className="space-y-2 px-1">
          <p className="text-sm text-muted-foreground">
            Ganhe Sementinhas cuidando de você e traga vida pro seu Caminho — uma plantinha de cada
            vez. 💛
          </p>
          {/* A frase mandava ela "trazer vida pro Caminho" e não havia UM
              botão levando ao Caminho em toda a aba. O `onNavigate` já chegava
              aqui por prop e nunca era usado. */}
          <button
            onClick={() => onNavigate?.("Caminho")}
            className="press rounded-full bg-emerald-500 px-4 py-1.5 text-xs font-bold text-white"
          >
            Ver o meu Caminho →
          </button>
        </div>
      )}

      {/* Ganhe mais Sementinhas — um bloco só, recolhido, no lugar de 4 cards
          soltos empilhados (Instagram, avaliar, depoimento, indicar). */}
      {!careMode && (
        <div className="rounded-3xl border border-emerald-100 bg-emerald-50/40">
          <button
            onClick={() => setShowEarn((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-3 text-left"
          >
            <span className="flex items-center gap-2 text-sm font-bold text-emerald-800">
              🌱 Ganhe mais Sementinhas
            </span>
            <span
              className={`text-emerald-600 transition-transform duration-300 ${showEarn ? "rotate-90" : ""}`}
            >
              ›
            </span>
          </button>
          {showEarn && (
            <div className="space-y-2 px-3 pb-3">
              <InstagramShareCard />
              <RatingRewardCard onEarned={(n) => setSaldo((s) => s + n)} />
              <TestimonialCard />
              <ReferralCard />
              {/* A rede de segurança: quem pulou o campo do onboarding, ou
                  baixou pela busca da loja sem clicar no link, coloca o código
                  aqui. Ver `CodigoDaEmbaixadora`. */}
              <CodigoDaEmbaixadora />
              {/* ⚠️ O CARTÃO DE PRESENTEAR SAIU DAQUI (ago/2026).
                  Pedido do dono: "eu sei que tem outro lugar que você também
                  consegue dar sementinhas, mas a gente tem que tirar de onde
                  está esse outro lugar. Vai ser agora somente nas amizades."
                  Ele vivia aqui, dentro do Cantinho — a aba de COMPRAR enfeite
                  para si. Duas portas para a mesma ação faziam a paciente
                  descobrir a mecânica no lugar onde ela não pensa em amiga
                  nenhuma. O bolso não mudou: `presentearAmiga` continua igual,
                  e a porta é a linha da amiga na aba Amigas. */}
            </div>
          )}
        </div>
      )}

      {/* ── OS CONJUNTOS ────────────────────────────────────────────────────
          Pedido do dono: "veja se os itens se complementam — um emoji de
          golfinho e outro de um lago, dá pra juntar". Eles já se completavam;
          o que faltava era o app dizer isso.

          ⚠️ A PRATELEIRA VEM ANTES DA LOJA, mas mostra os COMPLETOS primeiro
          (`conjuntosOrdenados`). A ordem oposta — "quase lá" no topo — é o
          padrão de todo jogo comercial e é exatamente o que transforma a tela
          num lembrete do que falta. Numa gestante de alto risco isso vira
          cobrança com cara de enfeite.

          ⚠️ E a contagem é "3 de 4", que é ESTADO. Nunca "falta 1!", que é
          dívida. */}
      <div className="mb-5">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          Conjuntos
        </p>
        <div className="scrollbar-hide flex gap-2 overflow-x-auto pb-1">
          {conjuntosOrdenados(ownedSet).map((p) => (
            <div
              key={p.conjunto.id}
              className={`flex min-w-[9.5rem] shrink-0 flex-col rounded-2xl border px-3 py-2.5 ${
                p.completo ? "border-emerald-300 bg-emerald-50" : "border-border bg-secondary/20"
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span className="text-lg leading-none" aria-hidden>
                  {p.conjunto.emoji}
                </span>
                <span className="text-[12.5px] font-extrabold leading-tight">
                  {p.conjunto.nome}
                </span>
              </div>
              <span className="mt-0.5 text-[10.5px] leading-snug text-muted-foreground">
                {p.conjunto.descricao}
              </span>
              <span
                className={`mt-1.5 text-[11px] font-bold ${
                  p.completo ? "text-emerald-600" : "text-muted-foreground"
                }`}
              >
                {p.completo ? "completo ✓" : `${p.tem} de ${p.total}`}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Loja de itens */}
      <div>
        <div className="scrollbar-hide mb-3 flex gap-2 overflow-x-auto">
          <button onClick={() => setCat("all")} className={pill(cat === "all")}>
            Tudo
          </button>
          {CANTINHO_CATEGORIES.map((c) => (
            <button key={c.key} onClick={() => setCat(c.key)} className={pill(cat === c.key)}>
              {c.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {shopItems.map((i) => {
            const has = ownedSet.has(i.id);
            const isTrophy = i.id === CANTINHO_COMPLETIONIST_ID;
            /* ─── `has` ENTRA AQUI, E A FALTA DELE DIZIA DUAS COISAS OPOSTAS
                 O item já COMPRADO por ela aparecia cinza, com "🔒 Premium" no
                 canto, e o botão embaixo dizia "No cantinho ✓" — no mesmo tile.

                 Não é hipótese: vinte itens que eram grátis viraram Premium na
                 recalibração da loja, e quem já os tinha comprado passou a ver
                 exatamente isso. Comprar é DEFINITIVO; o cadeado é sobre o que
                 ela ainda pode comprar, nunca sobre o que já é dela. */
            const locked = i.premium && !premium && !has;
            const trophyLocked = isTrophy && !has; // troféu ainda não conquistado
            /* Cadeado de TROFÉU: três itens só abrem depois de N dias de cinco
               estrelas. Não substitui o preço — ela ainda paga em Sementinhas;
               o troféu diz QUANDO a prateleira aparece. */
            const faltamTrof = has ? 0 : faltamTrofeus(i.id, trofeus);
            const cant = !has && !locked && saldo < i.price;
            return (
              <div
                key={i.id}
                className={`relative flex flex-col items-center rounded-2xl border p-4 text-center ${
                  isTrophy
                    ? "border-amber-300 bg-gradient-to-b from-amber-50 to-white"
                    : i.premium
                      ? /* Fundo roxo no item premium. O único sinal era um selo
                           de 9px no canto, do mesmo amarelo do troféu da
                           Coleção — e numa grade de 74 tiles brancos iguais,
                           selo não separa nada. Roxo é a cor do Premium no
                           resto do app, então o tile diz a que prateleira
                           pertence antes de ela ler qualquer palavra. Só o
                           FUNDO muda: preço, botão e emoji seguem com o mesmo
                           peso dos outros, senão a grade vira propaganda. */
                        "border-violet-200 bg-gradient-to-b from-violet-100/70 via-violet-50/40 to-white"
                      : "border-border bg-card"
                }`}
              >
                {i.premium && (
                  <span className="absolute right-2 top-2 rounded-full bg-violet-200/80 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-violet-800">
                    {locked ? "🔒 Premium" : "Premium"}
                  </span>
                )}
                {isTrophy && (
                  <span className="absolute right-2 top-2 rounded-full bg-amber-200 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-800">
                    Coleção
                  </span>
                )}
                {/* O selo do troféu fica à ESQUERDA: o canto direito já é do
                    selo Premium, e dois desses itens são premium também. */}
                {trofeusExigidos(i.id) > 0 && !has && (
                  <span className="absolute left-2 top-2 rounded-full bg-amber-200/85 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-800">
                    {faltamTrof > 0 ? "🔒" : "✓"} {trofeusExigidos(i.id)} 🏆
                  </span>
                )}
                <span
                  className={`text-4xl ${
                    locked || trophyLocked || faltamTrof > 0 ? "opacity-40 grayscale" : ""
                  }`}
                >
                  {i.emoji}
                </span>
                <p className="mt-2 line-clamp-2 text-xs font-medium text-foreground">{i.name}</p>
                {has ? (
                  i.type === "trilha" ? (
                    <button
                      onClick={() => equipSkin(skinAtiva === i.id ? null : i.id)}
                      className={`press mt-2 rounded-full px-3 py-1 text-[11px] font-bold ${
                        skinAtiva === i.id
                          ? "bg-emerald-500 text-white"
                          : "border border-emerald-300 text-emerald-700"
                      }`}
                    >
                      {skinAtiva === i.id ? "Em uso ✓" : "Usar"}
                    </button>
                  ) : i.type === "tema" ? (
                    // Tema veste a HOME, não o cantinho: alterna V1 ⇄ V2.
                    <button
                      onClick={() => equipSkyTheme(sky === "v1" ? "v2" : "v1")}
                      className={`press mt-2 rounded-full px-3 py-1 text-[11px] font-bold ${
                        sky === "v1"
                          ? "bg-emerald-500 text-white"
                          : "border border-emerald-300 text-emerald-700"
                      }`}
                    >
                      {sky === "v1" ? "Em uso ✓" : "Usar"}
                    </button>
                  ) : i.type === "fundo" ? (
                    <button
                      onClick={() => equipFundo(equipped === i.id ? null : i.id)}
                      className={`press mt-2 rounded-full px-3 py-1 text-[11px] font-bold ${
                        equipped === i.id
                          ? "bg-emerald-500 text-white"
                          : "border border-emerald-300 text-emerald-700"
                      }`}
                    >
                      {equipped === i.id ? "Em uso ✓" : "Usar"}
                    </button>
                  ) : (
                    <span className="mt-2 rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-bold text-emerald-700">
                      {isTrophy ? "Conquistado! 👑" : "No cantinho ✓"}
                    </span>
                  )
                ) : trophyLocked ? (
                  <>
                    <span className="mt-2 rounded-full bg-amber-100 px-3 py-1 text-[11px] font-bold text-amber-700">
                      🔒 {collection.owned}/{collection.total} categorias
                    </span>
                    {/* Antes dizia "inclui os itens Premium", porque a Coroa
                        exigia o catálogo inteiro e era inalcançável sem
                        assinatura. Agora ela pede um item pago de 8 categorias
                        e todas as 8 mais baratas são alcançáveis sem Premium —
                        então o aviso saiu, e no lugar entrou o que fazer. */}
                    <span className="mt-1 text-[9px] font-medium text-amber-700/70">
                      Um enfeite de cada tipo
                    </span>
                  </>
                ) : faltamTrof > 0 ? (
                  /* Diz o que FALTA, e não "bloqueado": a segunda frase não dá
                     o que fazer a seguir, e é ela que faz a paciente achar que
                     o item é pago em dinheiro. */
                  <>
                    <span className="mt-2 rounded-full bg-amber-100 px-3 py-1 text-[11px] font-bold text-amber-700">
                      🔒 faltam {faltamTrof} 🏆
                    </span>
                    <span className="mt-1 text-[9px] font-medium text-amber-700/70">
                      1 troféu por dia de 5 estrelas
                    </span>
                  </>
                ) : locked ? (
                  /* Era um <span> sem onClick: 38 dos 72 itens pagos eram
                     premium, e tocar em qualquer um deles não fazia nada.
                     Nem erro, nem explicação, nem caminho para assinar —
                     metade da loja era parede muda. Agora abre a oferta. */
                  <button
                    onClick={() => setOferta(i.name)}
                    className="press mt-2 flex items-center gap-1 rounded-full bg-violet-500 px-3 py-1 text-[11px] font-bold text-white"
                  >
                    💎 Ver o Premium
                  </button>
                ) : (
                  <button
                    onClick={() => buy(i.id, i.price)}
                    disabled={cant || buying === i.id}
                    className={`press mt-2 flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-bold ${
                      cant ? "bg-slate-100 text-slate-400" : "bg-emerald-500 text-white"
                    }`}
                  >
                    🌱 {i.price}
                  </button>
                )}
                {/* Quantas faltam. O tile cinza dizia só o preço, e a paciente
                    tinha de fazer a subtração de cabeça para saber se estava
                    perto ou longe — a diferença entre "amanhã eu compro" e
                    "isso não é pra mim". */}
                {!has && !locked && cant && saldo !== null && (
                  <span className="mt-1 text-[9px] font-medium text-slate-400">
                    faltam {i.price - saldo} 🌱
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <OfertaPremium
        aberto={oferta !== null}
        onFechar={() => setOferta(null)}
        motivo="item"
        itemNome={oferta ?? undefined}
      />

      <LojaSementinhas
        aberto={lojaSementinhas}
        onFechar={() => setLojaSementinhas(false)}
        saldo={saldo}
        careMode={careMode}
      />
    </div>
  );
}
