import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import icFesta from "@/assets/avisos/festa.webp";
import { supabase } from "@/integrations/supabase/client";
import { dueDateFromLmp } from "@/lib/gestacao";
import { codificarFoto } from "@/lib/codificar-imagem";
import { creditarSementinhas } from "@/lib/evento-sementinhas";
import { BONUS_INFLUENCIADORA } from "@/lib/economia-sementinhas";
import {
  CONVITE_DA_COMUNIDADE,
  TEXTO_PERFIL_PUBLICO,
  ofereceAComunidade,
} from "@/lib/chaves-do-perfil";
import { storedAffiliateCode } from "@/routes/__root";
/**
 * ⚠️ **`import type`, e por isso NÃO há ciclo em tempo de execução.** O tipo é
 * apagado na compilação, então `minha-conta` importar este arquivo e este
 * arquivo importar o TIPO de lá não fecha ciclo nenhum no pacote. E o tipo é a
 * fonte única: duplicá-lo aqui seria a segunda régua que este projeto proíbe.
 *
 * (O lugar certo dele é `src/lib/`, junto das outras formas de linha de banco —
 * mas mover `Profile` toca dezenas de referências, e um primeiro corte que
 * também faz isso deixa de ser um MOVE.)
 */
import type { Profile } from "@/routes/_authenticated/minha-conta";

/**
 * ⚠️ O RITUAL DE BOAS-VINDAS E O CARTÃO DO CÓDIGO — o primeiro corte de
 * `minha-conta.tsx`.
 *
 * Os dois eram `export function` num arquivo de ROTA, e isso tem custo medido:
 * um export não-rota sai do pedaço daquela rota e entra no da ÁRVORE DE ROTAS,
 * que toda página do site carrega antes de qualquer coisa aparecer. Foi assim
 * que `PainelDaEmbaixadora` custou 11 kB à entrada, e é a dívida que
 * `rotas-sem-export-solto.test.ts` nomeia sem exigir um mutirão.
 *
 * ⚠️ **A MUDANÇA É UM MOVE, e nada mais.** Nenhuma linha do corpo dos dois
 * componentes foi tocada — nem um `const` renomeado, nem um `useState`
 * reordenado. Um move que também "melhora" é uma reescrita, e aí a mudança de
 * comportamento se esconde no meio do diff de 650 linhas. As melhorias, se
 * valerem, vêm depois, num commit que só faça isso.
 *
 * Eles vêm juntos porque `/preview-onboarding` os fotografa lado a lado: o
 * campo do código no ritual e o cartão de rede de segurança no Perfil são as
 * DUAS portas do mesmo dado, e separá-los em dois arquivos separaria a bancada
 * que existe para compará-las.
 */

/* ---------- Ritual de boas-vindas (primeiro acesso) ---------- */

const ONBOARD_STEPS = 5;
const ONBOARD_EASE = [0.16, 1, 0.3, 1] as const;

/**
 * Onboarding acolhedor de primeiro acesso. Coleta o essencial (como chamar a
 * paciente, a âncora da gestação, o nome do bebê e uma foto) escrevendo nos
 * MESMOS campos do Perfil (`patient_profiles`) — não cria coluna nova, então
 * funciona mesmo com as migrations pendentes em produção. Tudo é opcional e
 * pode ser pulado; ao terminar, o app já abre personalizado.
 */
export function OnboardingRitual({
  initialName,
  onClose,
  passoInicial = 0,
}: {
  initialName: string;
  onClose: (saved: Profile | null) => void;
  /**
   * ⚠️ SÓ PARA A BANCADA (`/preview-onboarding`).
   *
   * O ritual só aparece para uma paciente RECÉM-CRIADA e sem perfil — não há
   * como abri-lo de novo depois. Enquanto ele só tinha nome, DUM e foto isso
   * era um incômodo; no dia em que ganhou o campo do código da embaixadora,
   * virou um controle no primeiro minuto de toda paciente nova que ninguém
   * consegue olhar sem criar uma conta do zero.
   *
   * A bancada fabrica o PASSO, e nada mais: o corpo de cada tela, o salvamento
   * e as regras continuam sendo os da produção.
   */
  passoInicial?: number;
}) {
  const [step, setStep] = useState(passoInicial);
  const [name, setName] = useState(initialName);
  const [mode, setMode] = useState<"dum" | "us">("dum");
  const [lmp, setLmp] = useState("");
  const [usDate, setUsDate] = useState(new Date().toISOString().split("T")[0]);
  const [usWeeks, setUsWeeks] = useState("");
  const [usDays, setUsDays] = useState("");
  const [babyName, setBabyName] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  /* ─── A COMUNIDADE, NO ÚLTIMO PASSO ────────────────────────────────────────
     ⚠️ **Nasce DESLIGADA**, como a chave nasce no banco. O ritual OFERECE; um
     perfil que nascesse aberto exporia milhares de gestantes de alto risco por
     omissão, sem ninguém nunca ter pedido plateia.

     ⚠️ E ela liga só `perfil_publico` — NUNCA `vitrine_publica`, que é a página
     aberta na internet e merece um momento deliberado, não uma chavinha no meio
     das boas-vindas. */
  const [entrarNaComunidade, setEntrarNaComunidade] = useState(false);
  /* ─── O CÓDIGO DA INFLUENCIADORA ────────────────────────────────────────────
     Nasce PRÉ-PREENCHIDO quando ela veio por um link `?ref=` — é o "link
     inteligente" do desenho. Quem baixou pela busca da loja digita.

     ⚠️ `useState(() => …)` e não `useState(storedAffiliateCode())`: a segunda
     forma LÊ o localStorage a cada render, e no SSR não há localStorage. A
     função inicializadora roda uma vez, no cliente. */
  const [codigoRef, setCodigoRef] = useState<string>(() => {
    try {
      return storedAffiliateCode() ?? "";
    } catch {
      return "";
    }
  });
  /* Veio do link? Então o efeito da página já vai atribuir e creditar sozinho —
     aqui o campo só CONFIRMA, e não pede ação nenhuma. */
  const [veioDoLink] = useState<boolean>(() => {
    try {
      return !!storedAffiliateCode();
    } catch {
      return false;
    }
  });

  const next = () => setStep((s) => Math.min(ONBOARD_STEPS - 1, s + 1));
  const back = () => setStep((s) => Math.max(0, s - 1));
  const hasAnchor = mode === "dum" ? !!lmp : !!usWeeks;

  function handleAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const size = 256;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const min = Math.min(img.width, img.height);
        ctx.drawImage(
          img,
          (img.width - min) / 2,
          (img.height - min) / 2,
          min,
          min,
          0,
          0,
          size,
          size,
        );
        setAvatar(codificarFoto(canvas, 0.82));
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  }

  async function finish() {
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) {
        toast.error("Sua sessão expirou — entre novamente.");
        onClose(null);
        return;
      }
      const payload: any = { id: u.user.id, updated_at: new Date().toISOString() };
      if (name.trim()) payload.display_name = name.trim();
      if (babyName.trim()) payload.baby_name = babyName.trim();
      if (avatar) payload.avatar_url = avatar;
      /* ⚠️ Só quando ela LIGOU. Mandar `false` explícito também funcionaria
         hoje, e seria uma pegadinha no dia em que o padrão do banco mudar: o
         ritual passaria a DESLIGAR uma chave que ninguém tocou. */
      if (entrarNaComunidade) payload.perfil_publico = true;
      if (mode === "dum" && lmp) {
        payload.lmp_date = lmp;
        payload.due_date = dueDateFromLmp(lmp);
      } else if (mode === "us" && usWeeks) {
        payload.reference_date = usDate;
        payload.reference_weeks = Number(usWeeks);
        payload.reference_days = usDays ? Number(usDays) : 0;
      }
      let { data, error } = await (supabase as any)
        .from("patient_profiles")
        .upsert(payload)
        .select()
        .single();
      /* ⚠️ Recuo por coluna ausente, como no resto do app: `perfil_publico`
         nasce num `APLICAR_` que o dono roda à mão, e o deploy chega antes. Sem
         isto, um `42703` derrubaria o ritual INTEIRO — nome, DUM e foto — por
         causa de uma chavinha opcional. */
      if (error && String(error.message || "").includes("perfil_publico")) {
        delete payload.perfil_publico;
        ({ data, error } = await (supabase as any)
          .from("patient_profiles")
          .upsert(payload)
          .select()
          .single());
      }
      if (error && String(error.message || "").includes("avatar_url")) {
        delete payload.avatar_url;
        ({ data, error } = await (supabase as any)
          .from("patient_profiles")
          .upsert(payload)
          .select()
          .single());
      }
      if (error) {
        toast.error("Não consegui salvar agora. Você pode ajustar depois no Perfil.");
        onClose(null);
        return;
      }

      /* ─── O CÓDIGO DIGITADO À MÃO ─────────────────────────────────────────
         Só quando ela NÃO veio do link: nesse caso o efeito da página já
         atribuiu, e mandar de novo daqui seria uma segunda chamada para o
         mesmo fato.

         ⚠️ DEPOIS do perfil salvo, nunca antes: o servidor precisa da linha em
         `patient_profiles` para escrever `ref_code`, e sem ela devolve
         `repetir`. Invertido, o código válido dela seria descartado em
         silêncio no primeiro acesso — que é justamente quando ele vale. */
      const digitado = codigoRef.trim();
      if (!veioDoLink && digitado.length >= 3) {
        try {
          const { data: s } = await supabase.auth.getSession();
          if (s.session?.access_token) {
            const { atribuirInfluenciadora } = await import("@/lib/influenciadora.functions");
            const r = await atribuirInfluenciadora({
              data: { accessToken: s.session.access_token, codigo: digitado },
            });
            if (r.ok && "invalido" in r && r.invalido) {
              /* Dito em voz alta: ela digitou algo e nada aconteceu. Silêncio
                 aqui faz a paciente achar que ganhou o bônus e procurá-lo
                 depois. */
              toast("Não encontrei esse código. Você pode tentar de novo no Perfil.", {
                duration: 6000,
              });
            } else if (r.ok && "atribuido" in r && r.atribuido && r.bonus > 0) {
              toast.success(`Você começou com ${r.bonus} Sementinhas 🌱`);
              creditarSementinhas(r.bonus);
            }
          }
        } catch {
          /* o campo do Perfil continua aceitando depois */
        }
      }

      onClose(data as Profile);
    } finally {
      setSaving(false);
    }
  }

  const stepBody = (() => {
    switch (step) {
      case 0:
        return (
          <div className="text-center">
            <p className="text-6xl">🌸</p>
            <h2 className="mt-5 font-serif text-3xl leading-tight">Bem-vinda 💛</h2>
            <p className="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">
              Este é o seu espaço para viver a gestação com tranquilidade — acompanhando o bebê
              semana a semana, com o seu médico por perto. Vamos deixar tudo com a sua cara em 1
              minutinho.
            </p>
          </div>
        );
      case 1:
        return (
          <div>
            <p className="text-4xl">👋</p>
            <h2 className="mt-4 font-serif text-2xl">Como você gostaria de ser chamada?</h2>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Seu primeiro nome"
              onKeyDown={(e) => e.key === "Enter" && next()}
              className="mt-5 w-full rounded-2xl border border-border bg-background px-4 py-3 text-base"
            />
          </div>
        );
      case 2:
        return (
          <div>
            <p className="text-4xl">🤰</p>
            <h2 className="mt-4 font-serif text-2xl">Vamos calcular a idade do bebê</h2>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setMode("dum")}
                className={`flex-1 rounded-full px-3 py-1.5 text-sm font-semibold transition-colors ${
                  mode === "dum"
                    ? "bg-primary text-primary-foreground"
                    : "border border-border text-muted-foreground"
                }`}
              >
                Última menstruação
              </button>
              <button
                onClick={() => setMode("us")}
                className={`flex-1 rounded-full px-3 py-1.5 text-sm font-semibold transition-colors ${
                  mode === "us"
                    ? "bg-primary text-primary-foreground"
                    : "border border-border text-muted-foreground"
                }`}
              >
                Pelo ultrassom
              </button>
            </div>
            {mode === "dum" ? (
              <div className="mt-4">
                <label className="mb-1.5 block text-sm font-medium">
                  1º dia da última menstruação
                </label>
                <input
                  type="date"
                  value={lmp}
                  onChange={(e) => setLmp(e.target.value)}
                  className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-base"
                />
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Data do ultrassom</label>
                  <input
                    type="date"
                    value={usDate}
                    onChange={(e) => setUsDate(e.target.value)}
                    className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-base"
                  />
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="mb-1.5 block text-sm font-medium">Semanas</label>
                    <input
                      type="number"
                      min={0}
                      max={42}
                      value={usWeeks}
                      onChange={(e) => setUsWeeks(e.target.value)}
                      placeholder="12"
                      className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-base"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="mb-1.5 block text-sm font-medium">Dias</label>
                    <input
                      type="number"
                      min={0}
                      max={6}
                      value={usDays}
                      onChange={(e) => setUsDays(e.target.value)}
                      placeholder="3"
                      className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-base"
                    />
                  </div>
                </div>
              </div>
            )}
            <button
              onClick={next}
              className="mt-4 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              Ainda não sei a data — pular por agora
            </button>
          </div>
        );
      case 3:
        return (
          <div>
            <p className="text-4xl">👶</p>
            <h2 className="mt-4 font-serif text-2xl">Um toque pessoal (opcional)</h2>
            <label className="mt-5 block text-sm font-medium">Já escolheram um nome?</label>
            <input
              value={babyName}
              onChange={(e) => setBabyName(e.target.value)}
              placeholder="Nome do bebê"
              className="mt-1.5 w-full rounded-2xl border border-border bg-background px-4 py-3 text-base"
            />
            <div className="mt-5 flex items-center gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-secondary">
                {avatar ? (
                  <img src={avatar} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-2xl">📷</span>
                )}
              </div>
              <label className="cursor-pointer rounded-full border border-border px-4 py-2 text-sm font-medium hover:border-primary hover:text-primary">
                {avatar ? "Trocar foto" : "Adicionar sua foto"}
                <input type="file" accept="image/*" onChange={handleAvatar} className="hidden" />
              </label>
            </div>
          </div>
        );
      default:
        return (
          <div className="text-center">
            {/* A festa é uma peça da família do coração, não o emoji 🎉 — é a
                primeira tela cheia que a paciente vê, e o emoji tem desenho
                próprio em cada sistema. */}
            <img
              src={icFesta}
              alt=""
              aria-hidden
              className="mx-auto h-24 w-24 object-contain drop-shadow-[0_10px_16px_rgba(0,0,0,0.14)]"
            />
            <h2 className="mt-5 font-serif text-3xl leading-tight">
              Tudo pronto{name.trim() ? `, ${name.trim()}` : ""}! 💛
            </h2>
            <p className="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">
              {hasAnchor
                ? "Seu acompanhamento já está calculado. A partir de agora o app se ajusta à sua semana de gestação."
                : "Você pode informar a data da gestação quando quiser, lá no Perfil. Seu espaço está pronto."}
            </p>

            {/* ─── CÓDIGO DA MÉDICA OU EMBAIXADORA ───────────────────────────
                No ÚLTIMO passo, e não num passo próprio: é opcional, e um passo
                inteiro para um campo que a maioria vai pular alonga o ritual de
                boas-vindas de todo mundo por causa de uma minoria.

                ⚠️ Vindo do link, ele NÃO pede ação: o efeito da página já
                atribui e credita. Pedir que ela "confirme" um código que já
                valeu é inventar um passo que só pode dar errado. */}
            {veioDoLink ? (
              <p
                className="mx-auto mt-5 max-w-xs rounded-2xl px-3 py-2.5 text-[13px] font-semibold leading-snug"
                style={{ background: "#e7f6ec", color: "#166534" }}
              >
                <span aria-hidden>🌱</span> Código{" "}
                <strong className="font-mono tracking-wider">{codigoRef}</strong> aplicado —{" "}
                {BONUS_INFLUENCIADORA} Sementinhas de boas-vindas!
              </p>
            ) : (
              <div className="mx-auto mt-6 max-w-xs text-left">
                <label
                  htmlFor="codigo-ref"
                  className="block text-xs font-semibold text-muted-foreground"
                >
                  Código da sua médica ou embaixadora (opcional)
                </label>
                <input
                  id="codigo-ref"
                  value={codigoRef}
                  onChange={(e) => setCodigoRef(e.target.value)}
                  placeholder="Ex.: MARIA"
                  /* Os três desligados pela mesma razão do campo de convite das
                     Amigas: o código é maiúsculo e sem acento, e o teclado do
                     celular capitaliza e corrige sozinho. */
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  className="mt-1.5 min-h-11 w-full rounded-full border border-border bg-background px-4 text-[14px]"
                />
                <p className="mt-1.5 text-xs leading-snug text-muted-foreground">
                  Ganhe {BONUS_INFLUENCIADORA} Sementinhas 🌱 para começar. Dá para colocar depois,
                  no Perfil.
                </p>
                {/* Ver o mesmo aviso em `CodigoDaEmbaixadora`: o consentimento
                    tem de dizer o que acontece, e é a MESMA frase nas duas
                    portas. */}
                <p className="mt-1 text-xs leading-snug text-muted-foreground">
                  Se for de uma embaixadora, ela passa a ver o seu primeiro nome numa lista, para
                  poder te presentear.
                </p>
              </div>
            )}

            {/* ─── ENTRAR NA COMUNIDADE ───────────────────────────────────────
                O feed nasce vazio e o perfil nasce fechado — então a paciente
                nova abre a Comunidade, não é encontrável por ninguém, não tem
                ninguém para ver, e conclui que a aba não tem nada. Este é o
                único minuto em que ela está disposta a mexer nisso.

                ⚠️ **OFERECE, e nunca liga sozinho.** O padrão é desligado, como
                no banco: um perfil que nascesse aberto exporia milhares de
                gestantes de alto risco por omissão.

                ⚠️ **E não segue ninguém por ela.** Seguir é um gesto, e um app
                que segue coisas pela paciente ensina que a lista dela não é
                dela — a mesma razão pela qual nem a conta oficial é seguida
                automaticamente (ver `conta-oficial.ts`). O que ela ganha é ser
                ENCONTRÁVEL; quem ela segue continua sendo escolha dela.

                ⚠️ **O texto é o MESMO da tela de configurações**
                (`chaves-do-perfil.ts`): duas cópias divergem no primeiro
                ajuste, e aqui a divergência seria duas telas prometendo coisas
                diferentes sobre o mesmo interruptor. */}
            {ofereceAComunidade({ emCuidado: false }) && (
              <button
                type="button"
                role="switch"
                aria-checked={entrarNaComunidade}
                onClick={() => setEntrarNaComunidade((v) => !v)}
                className="press mx-auto mt-6 flex w-full max-w-xs items-start gap-3 rounded-2xl border border-border bg-background/70 p-3 text-left"
              >
                <span
                  aria-hidden
                  className={`mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors ${
                    entrarNaComunidade ? "bg-primary" : "bg-muted"
                  }`}
                >
                  <span
                    className={`block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                      entrarNaComunidade
                        ? "translate-x-[22px] translate-y-0.5"
                        : "translate-x-0.5 translate-y-0.5"
                    }`}
                  />
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold">
                    {CONVITE_DA_COMUNIDADE.titulo}
                  </span>
                  <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
                    {entrarNaComunidade ? TEXTO_PERFIL_PUBLICO.ligado : CONVITE_DA_COMUNIDADE.sub}
                  </span>
                </span>
              </button>
            )}
          </div>
        );
    }
  })();

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-[image:var(--gradient-warm)] p-5">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-rose-200/40 blur-3xl"
      />
      <div className="relative w-full max-w-md rounded-3xl card-material/90 p-7 backdrop-blur md:p-9">
        {/* Progresso */}
        <div className="mb-6 flex items-center justify-center gap-1.5">
          {Array.from({ length: ONBOARD_STEPS }).map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === step ? "w-6 bg-primary" : i < step ? "w-1.5 bg-primary/50" : "w-1.5 bg-border"
              }`}
            />
          ))}
        </div>

        <div className="min-h-[240px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.28, ease: ONBOARD_EASE }}
            >
              {stepBody}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Ações */}
        <div className="mt-7 flex items-center justify-between gap-3">
          {step > 0 && step < ONBOARD_STEPS - 1 ? (
            <button
              onClick={back}
              className="rounded-full px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Voltar
            </button>
          ) : (
            <span />
          )}

          {step < ONBOARD_STEPS - 1 ? (
            <button
              onClick={next}
              disabled={step === 2 && !hasAnchor}
              className="rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-soft)] transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {step === 0 ? "Começar" : "Continuar"}
            </button>
          ) : (
            <button
              onClick={finish}
              disabled={saving}
              className="rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-soft)] transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Salvando…" : "Entrar no meu espaço"}
            </button>
          )}
        </div>

        {step < ONBOARD_STEPS - 1 && (
          <button
            onClick={() => onClose(null)}
            className="mt-4 block w-full text-center text-xs text-muted-foreground/70 hover:text-foreground"
          >
            Pular por agora
          </button>
        )}
      </div>
    </div>
  );
}

export function CodigoDaEmbaixadora({ bancada = false }: { bancada?: boolean }) {
  const [codigo, setCodigo] = useState("");
  const [enviando, setEnviando] = useState(false);
  /* `null` = ainda não sei; `true`/`false` = já tem código ou não.
     ⚠️ Três estados, e não um booleano: com `false` inicial o cartão PISCA na
     tela de quem já tem código, no intervalo entre montar e a consulta voltar. */
  const [jaTem, setJaTem] = useState<boolean | null>(null);

  /* ⚠️ LÊ O PRÓPRIO `ref_code` em vez de receber o `profile` da página. Duas
     razões: a aba onde ele mora não carrega o perfil (seria prop atravessando
     três níveis), e o `profile` da página fica VELHO depois de o onboarding
     atribuir — o cartão continuaria oferecendo um código que ela já usou. */
  useEffect(() => {
    /* ⚠️ A BANCADA PULA A CONSULTA. Sem sessão, `getUser` devolve nulo e o
       cartão se esconde (`setJaTem(true)`) — que é o comportamento certo em
       produção e o que tornava este componente impossível de fotografar. */
    if (bancada) return setJaTem(false);
    (async () => {
      try {
        const { data: u } = await supabase.auth.getUser();
        if (!u.user) return setJaTem(true); // sem sessão: não oferece nada
        const { data } = await (supabase as any)
          .from("patient_profiles")
          .select("ref_code")
          .eq("id", u.user.id)
          .maybeSingle();
        setJaTem(Boolean(data?.ref_code));
      } catch {
        /* falha de leitura → NÃO oferece. Errar para o lado de não mostrar é
           chato; para o outro, ela digita um código que o servidor vai recusar
           e a tela promete um bônus que não vem. */
        setJaTem(true);
      }
    })();
  }, [bancada]);

  async function enviar() {
    const limpo = codigo.trim();
    if (limpo.length < 3) return;
    setEnviando(true);
    try {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session?.access_token) return;
      const { atribuirInfluenciadora } = await import("@/lib/influenciadora.functions");
      const r = await atribuirInfluenciadora({
        data: { accessToken: s.session.access_token, codigo: limpo },
      });
      if (r.ok && "atribuido" in r && r.atribuido) {
        setJaTem(true);
        if (r.bonus > 0) {
          toast.success(`${r.bonus} Sementinhas de boas-vindas 🌱`);
          creditarSementinhas(r.bonus);
        }
        return;
      }
      if (r.ok && "invalido" in r && r.invalido) {
        toast("Não encontrei esse código. Confira com quem te indicou.", { duration: 6000 });
        return;
      }
      if (r.ok && "jaTinha" in r && r.jaTinha) {
        setJaTem(true);
        return;
      }
      toast("Não foi possível agora. Tente de novo mais tarde.");
    } catch {
      toast("Não foi possível agora. Tente de novo mais tarde.");
    } finally {
      setEnviando(false);
    }
  }

  if (jaTem !== false) return null;

  return (
    <div className="rounded-3xl card-material p-4">
      <p className="text-sm font-bold">Veio pela indicação de alguém?</p>
      <p className="mt-1 text-xs leading-snug text-muted-foreground">
        Coloque o código da sua médica ou da embaixadora que te trouxe e ganhe{" "}
        <strong className="font-semibold">{BONUS_INFLUENCIADORA} Sementinhas 🌱</strong>.
      </p>
      {/* ⚠️ **O CONSENTIMENTO PRECISA DIZER O QUE ACONTECE.** O código faz o
          primeiro nome dela aparecer numa lista da embaixadora, e as duas telas
          que o pediam falavam só das Sementinhas. Isso é "expor a paciente sem
          ela saber" — e o que fica exposto não é um nome qualquer: é "esta
          pessoa é paciente de um app de gestação de alto risco", que é dado de
          saúde por inferência. */}
      <p className="mt-1 text-xs leading-snug text-muted-foreground">
        Se for de uma embaixadora, ela passa a ver o seu primeiro nome numa lista, para poder te
        presentear. Nada mais do seu acompanhamento aparece para ela.
      </p>
      <div className="mt-3 flex gap-2">
        <input
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void enviar();
          }}
          placeholder="Ex.: MARIA"
          aria-label="Código da médica ou embaixadora"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className="min-h-11 min-w-0 flex-1 rounded-full border border-border bg-background px-4 text-[14px]"
        />
        <button
          onClick={() => void enviar()}
          disabled={enviando || codigo.trim().length < 3}
          className="press min-h-11 shrink-0 rounded-full px-4 text-[14px] font-bold text-white disabled:opacity-40"
          style={{ background: "#c9316f" }}
        >
          {enviando ? "…" : "Aplicar"}
        </button>
      </div>
    </div>
  );
}
