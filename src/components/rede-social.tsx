/**
 * A REDE SOCIAL — as CONFIGURAÇÕES do perfil.
 *
 * ⚠️ **Este arquivo já foi o feed inteiro, e não é mais.** O feed, o cartão do
 * post e o compositor moravam aqui; o dono pediu o modelo do Instagram
 * ("as dimensões, tudo tem que estar igual"), e eles renasceram em
 * `rede-instagram.tsx`, que é o que a aba Comunidade abre.
 *
 * Os daqui ficaram para trás sem ninguém notar: exportados, importados só pela
 * bancada, e alcançáveis por NINGUÉM dentro do app. Foi assim que `publicarPost`
 * passou semanas com um compositor que funcionava e que a paciente não tinha
 * como abrir. Duas telas de publicar divergem no primeiro conserto — então
 * sobrou uma, e o que ficou aqui é só o que a outra não faz: a chave do perfil
 * público, a bio e a fila de pedidos.
 *
 * As réguas moram em `src/lib/rede-social.ts` (testadas) e as travas em
 * `rede-social.functions.ts` (testadas por mutação).
 *
 * ⚠️ **Não existe caixa de comentário em lugar nenhum desta tela**, e é
 * decisão de produto: de 1.098 respostas com conselho em fóruns de gestação,
 * 20,9% estavam erradas e 5,5% eram potencialmente danosas. Reação dá quase
 * toda a sensação de comunidade com uma fração do risco.
 *
 * ⚠️ **E não existe contador de seguidores na tela de ninguém além da dona.**
 * Placar de audiência num app de gestação de alto risco mede popularidade num
 * momento em que ela já está sendo medida clinicamente.
 */
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  HANDLE_MAX,
  JANELA_DE_TROCA_DIAS,
  QUEM_MENCIONA_PADRAO,
  RESERVA_DO_ANTIGO_DIAS,
  TROCAS_POR_JANELA,
  normalizarHandle,
  recusaDoHandle,
  type QuemMenciona,
} from "@/lib/mencoes";
import { PALAVRA_OCULTA_MAX } from "@/lib/comentarios";
import { TEXTO_PERFIL_PUBLICO } from "@/lib/chaves-do-perfil";
import { linkDaVitrine } from "@/lib/perfil-publico";
import { LIMITE_DA_BIO } from "@/lib/rede-social";
import type { PerfilNaTela } from "@/lib/rede-social.functions";

function Avatar({
  url,
  nome,
  tamanho = 40,
}: {
  url: string | null;
  nome: string;
  tamanho?: number;
}) {
  if (url) {
    return (
      <img
        src={url}
        alt=""
        className="shrink-0 rounded-full object-cover"
        style={{ width: tamanho, height: tamanho }}
      />
    );
  }
  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-full bg-primary/15 font-semibold text-primary"
      style={{ width: tamanho, height: tamanho, fontSize: tamanho * 0.4 }}
    >
      {nome.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}

/**
 * O que a bancada injeta no lugar do servidor.
 *
 * ⚠️ Só o perfil e os pedidos: o FEED desta tela não existe mais. O feed, o
 * cartão do post e o compositor viveram aqui até ago/2026 e foram apagados —
 * ver o cabeçalho do arquivo.
 */
export type BancadaDaRede = {
  perfil?: PerfilNaTela;
  pedidos?: { id: string; nome: string; avatarUrl: string | null }[];
};

/* ══════════════════════════════════════════════════════════════════════════
   AS CONFIGURAÇÕES DO PERFIL
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Uma chave do perfil.
 *
 * O switch é o MESMO da chave de perfil público (`role="switch"`, 44px de
 * alvo) — três cópias do mesmo interruptor divergiriam no primeiro ajuste de
 * acessibilidade.
 */
function ChaveDoPerfil({
  titulo,
  descricao,
  ligada,
  desabilitada,
  aoTrocar,
}: {
  titulo: string;
  descricao: string;
  ligada: boolean;
  desabilitada?: boolean;
  aoTrocar: () => void;
}) {
  return (
    <div className="mt-3 flex items-start justify-between gap-3 border-t border-border pt-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">{titulo}</p>
        <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{descricao}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={ligada}
        aria-label={titulo}
        disabled={desabilitada}
        onClick={aoTrocar}
        className={`press mt-0.5 h-7 w-12 shrink-0 rounded-full transition-colors ${
          ligada ? "bg-primary" : "bg-muted"
        }`}
      >
        <span
          className={`block h-6 w-6 rounded-full bg-white shadow transition-transform ${
            ligada ? "translate-x-[22px]" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}

/**
 * O `@` DA PACIENTE, E QUEM PODE MENCIONÁ-LA.
 *
 * ⚠️ **A REGRA DA TROCA É A DO INSTAGRAM, por decisão do dono** ("faça
 * exatamente como o Instagram faz hoje"): duas trocas por 14 dias, e o apelido
 * antigo fica RESERVADO por mais 14 — ninguém o toma no dia seguinte e passa a
 * responder pelas menções antigas dela. A régua e os números moram em
 * `mencoes.ts`; quem os aplica é `escolherHandle`.
 *
 * ⚠️ **A DISPONIBILIDADE NÃO É CONFERIDA AQUI.** Entre uma leitura de "está
 * livre" e a gravação cabe outra paciente pedindo o mesmo `@` — quem decide é
 * o índice único do banco, e a tela mostra o veredito dele. Uma segunda régua
 * no cliente diria "livre" sobre um apelido que o servidor recusaria.
 */
function ArrobaDoPerfil({
  handle,
  quemPodeMencionar,
  aoTrocar,
  bancada,
}: {
  handle: string | null;
  quemPodeMencionar: QuemMenciona;
  aoTrocar: (h: string | null, q: QuemMenciona) => void;
  bancada: boolean;
}) {
  const [editando, setEditando] = useState(false);
  const [campo, setCampo] = useState(handle ?? "");
  const [ocupado, setOcupado] = useState(false);

  /* A recusa é calculada no CAMPO, e serve só para desabilitar o botão e
     explicar — o veredito continua sendo o do servidor. */
  const recusa = campo.trim() ? recusaDoHandle(campo) : null;

  async function salvarHandle() {
    if (ocupado || recusa) return;
    if (bancada) {
      aoTrocar(normalizarHandle(campo), quemPodeMencionar);
      setEditando(false);
      return;
    }
    setOcupado(true);
    try {
      const s = await supabase.auth.getSession();
      const token = s.data.session?.access_token;
      if (!token) return;
      const { escolherHandle } = await import("@/lib/mencoes.functions");
      const r = await escolherHandle({ data: { accessToken: token, handle: campo } });
      if (r.ok) {
        aoTrocar(r.handle ?? null, quemPodeMencionar);
        setEditando(false);
        toast.success("Pronto 💛");
        return;
      }
      /* ⚠️ Cada recusa diz O QUE FAZER. "Não deu" num campo de apelido faz ela
         tentar o mesmo texto de novo, indefinidamente. */
      toast.error(
        r.motivo === "ocupado"
          ? "Esse @ já é de outra pessoa. Tente uma variação."
          : r.motivo === "reservado"
            ? "Esse @ está guardado. Escolha outro."
            : r.motivo === "muitas_trocas"
              ? `Você já trocou ${TROCAS_POR_JANELA} vezes nos últimos ${JANELA_DE_TROCA_DIAS} dias.`
              : r.motivo === "sessao" || r.motivo === "banco"
                ? "Não deu para salvar."
                : `Use letras, números, ponto e _ (até ${HANDLE_MAX}).`,
      );
    } catch {
      toast.error("Não deu para salvar.");
    } finally {
      setOcupado(false);
    }
  }

  async function salvarQuem(q: QuemMenciona) {
    aoTrocar(handle, q);
    if (bancada) return;
    try {
      const s = await supabase.auth.getSession();
      const token = s.data.session?.access_token;
      if (!token) return;
      const { salvarQuemMenciona } = await import("@/lib/mencoes.functions");
      await salvarQuemMenciona({ data: { accessToken: token, valor: q } });
    } catch {
      toast.error("Não deu para salvar.");
    }
  }

  return (
    <section className="rounded-3xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
      <h3 className="font-semibold">Seu @</h3>

      {!editando ? (
        <div className="mt-1 flex items-center justify-between gap-3">
          <p className="min-w-0 truncate text-sm">
            {handle ? (
              <span className="font-semibold text-primary">@{handle}</span>
            ) : (
              <span className="text-muted-foreground">
                Você ainda não escolheu — sem @, ninguém consegue te marcar.
              </span>
            )}
          </p>
          <button
            type="button"
            onClick={() => {
              setCampo(handle ?? "");
              setEditando(true);
            }}
            className="press min-h-[44px] shrink-0 rounded-full border border-border px-4 text-[13px] font-semibold"
          >
            {handle ? "Trocar" : "Escolher"}
          </button>
        </div>
      ) : (
        <div className="mt-2">
          <div className="flex items-center gap-2 rounded-2xl border border-border px-3">
            <span className="text-sm text-muted-foreground">@</span>
            <input
              value={campo}
              onChange={(e) => setCampo(e.target.value)}
              maxLength={HANDLE_MAX}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="seunome"
              aria-label="Escolher o seu @"
              className="min-h-[44px] w-full bg-transparent text-sm outline-none"
            />
          </div>
          {recusa && (
            <p className="mt-1.5 text-[12px] leading-snug text-destructive">
              {recusa === "curto"
                ? "Muito curto."
                : recusa === "longo"
                  ? `No máximo ${HANDLE_MAX} caracteres.`
                  : recusa === "reservado"
                    ? "Esse @ é reservado ao consultório."
                    : recusa === "so_pontos"
                      ? "Precisa ter ao menos uma letra ou número."
                      : "Use letras, números, ponto e _ ."}
            </p>
          )}
          <p className="mt-1.5 text-[12px] leading-snug text-muted-foreground">
            Dá para trocar {TROCAS_POR_JANELA} vezes a cada {JANELA_DE_TROCA_DIAS} dias. O @ antigo
            fica guardado por {RESERVA_DO_ANTIGO_DIAS} dias — ninguém assume o seu lugar.
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={ocupado || !!recusa || !campo.trim()}
              onClick={() => void salvarHandle()}
              className="press min-h-[44px] flex-1 rounded-full bg-primary px-4 text-[14px] font-semibold text-primary-foreground disabled:opacity-50"
            >
              {ocupado ? "Salvando…" : "Salvar"}
            </button>
            <button
              type="button"
              onClick={() => setEditando(false)}
              className="press min-h-[44px] rounded-full border border-border px-4 text-[14px] font-semibold"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* ⚠️ **As três opções são as do Instagram**, por decisão do dono:
          todo mundo (padrão), só quem eu sigo, ninguém. */}
      <div className="mt-4 border-t border-border pt-3">
        <p className="text-[13px] font-semibold">Quem pode te marcar</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {(
            [
              ["todos", "Todo mundo"],
              ["sigo", "Só quem eu sigo"],
              ["ninguem", "Ninguém"],
            ] as [QuemMenciona, string][]
          ).map(([v, rotulo]) => (
            <button
              key={v}
              type="button"
              aria-pressed={quemPodeMencionar === v}
              onClick={() => void salvarQuem(v)}
              className={`press min-h-[44px] rounded-full border px-4 text-[13px] font-semibold ${
                quemPodeMencionar === v
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border"
              }`}
            >
              {rotulo}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

export function ConfiguracoesDoPerfil({
  careMode = false,
  bancada,
}: {
  careMode?: boolean;
  bancada?: BancadaDaRede;
}) {
  const [perfil, setPerfil] = useState<PerfilNaTela | null>(bancada?.perfil ?? null);
  const [pedidos, setPedidos] = useState(bancada?.pedidos ?? []);
  const [bio, setBio] = useState(bancada?.perfil?.bio ?? "");
  const [salvando, setSalvando] = useState(false);

  /**
   * ⚠️ **EU PREVI ESTE DEFEITO NO COMENTÁRIO E O ESCREVI ASSIM MESMO.**
   *
   * A versão anterior lia `window.location.origin` DENTRO do render, com um
   * `typeof window === "undefined"` achando que isso bastava. Não basta: o
   * servidor renderiza `SITE` e o cliente renderiza `127.0.0.1:8080` na
   * PRIMEIRA passada — textos diferentes, e o React descarta a árvore inteira
   * ("Hydration failed because the server rendered text didn't match").
   *
   * O guarda de `typeof window` evita o CRASH no servidor; ele não evita a
   * divergência, porque as duas execuções são exatamente as que precisam
   * concordar. Quem resolve é o estado: nasce `undefined` (igual ao servidor) e
   * vira a origem real depois da montagem.
   *
   * Achado abrindo `/preview-rede` num navegador e lendo o console — que é a
   * lição que o laço da barra de baixo já custou uma vez.
   */
  const [origem, setOrigem] = useState<string | undefined>(undefined);
  useEffect(() => setOrigem(window.location.origin), []);
  const enderecoDaVitrine = linkDaVitrine(perfil?.codigoDaVitrine, origem);

  async function carregar() {
    if (bancada) return;
    try {
      const s = await supabase.auth.getSession();
      const token = s.data.session?.access_token;
      if (!token) return;
      const { meuPerfilSocial } = await import("@/lib/rede-social.functions");
      const r = await meuPerfilSocial({ data: { accessToken: token } });
      if (r.ok) {
        setPerfil(r.perfil);
        setBio(r.perfil.bio ?? "");
        setPedidos(r.pedidos as typeof pedidos);
      }
    } catch {
      /* Sem perfil a seção some. */
    }
  }

  useEffect(() => {
    if (careMode) return;
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [careMode]);

  const totalPedidos = useMemo(() => pedidos.length, [pedidos]);

  if (careMode || !perfil) return null;

  async function salvar(mudanca: {
    publico?: boolean;
    bio?: string | null;
    mostrarSemana?: boolean;
    mostrarBebe?: boolean;
    vitrine?: boolean;
    feedSoSeguindo?: boolean;
  }) {
    setSalvando(true);
    try {
      const s = await supabase.auth.getSession();
      const token = s.data.session?.access_token;
      if (!token) return;
      const { salvarPerfilSocial } = await import("@/lib/rede-social.functions");
      const r = await salvarPerfilSocial({ data: { accessToken: token, ...mudanca } });
      if (!r.ok) {
        /* ⚠️ **O RECADO DA RÉGUA VENCE O GENÉRICO.** "Não deu para salvar"
           sobre uma bio recusada por conteúdo clínico faria ela tentar de novo
           com o mesmo texto, indefinidamente — e concluir que o app quebrou. */
        toast.error(("recado" in r && r.recado) || "Não deu para salvar.");
        return;
      }
      /* ⚠️ **`parcial` existe e ninguém lia.** Quando o banco ainda não tem a
         coluna nova, o recuo do servidor grava o que dá e devolve
         `parcial: true` — e a tela dizia "Salvo 💛" e acendia a chave sobre
         nada. Ela reabria a aba e o interruptor estava desligado; pior, no
         caso da caixinha a tela afirmava que a caixa estava aberta enquanto o
         servidor recusava toda pergunta. Um botão que volta ao estado anterior
         é ruim; um que diz "salvo" e não salvou é pior. */
      if ("parcial" in r && r.parcial) {
        toast.error("Salvei o que deu — os interruptores ainda não estão prontos no servidor.");
        return;
      }
      setPerfil((p) => (p ? { ...p, ...mudanca, bio: mudanca.bio ?? p.bio } : p));
      toast.success("Salvo 💛");
    } catch {
      toast.error("Não deu para salvar.");
    } finally {
      setSalvando(false);
    }
  }

  async function responder(seguidorId: string, aceitar: boolean) {
    setPedidos((ps) => ps.filter((p) => p.id !== seguidorId));
    try {
      const s = await supabase.auth.getSession();
      const token = s.data.session?.access_token;
      if (!token) return;
      const { responderPedido } = await import("@/lib/rede-social.functions");
      await responderPedido({ data: { accessToken: token, seguidorId, aceitar } });
    } catch {
      void carregar();
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-3xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
        <div className="flex items-center gap-3">
          <Avatar url={perfil.avatarUrl} nome={perfil.nome} tamanho={52} />
          <div className="min-w-0">
            <p className="truncate font-semibold">{perfil.nome}</p>
            {/* ⚠️ O número de seguidores aparece SÓ aqui, na tela dela. Nunca no
                perfil que os outros veem — placar público de audiência mede
                popularidade num momento em que ela já está sendo medida
                clinicamente. */}
            <p className="text-xs text-muted-foreground">
              {perfil.seguidores === 1
                ? "1 pessoa te acompanha"
                : `${perfil.seguidores ?? 0} pessoas te acompanham`}
            </p>
          </div>
        </div>

        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value.slice(0, LIMITE_DA_BIO))}
          onBlur={() => bio !== (perfil.bio ?? "") && salvar({ bio: bio || null })}
          rows={2}
          placeholder="Uma linha sobre você"
          className="mt-3 w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm"
        />
      </section>

      <section className="rounded-3xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-semibold">Perfil público</h3>
            <p className="mt-1 text-xs leading-snug text-muted-foreground">
              {/* ⚠️ O texto mora em `chaves-do-perfil.ts`, e não aqui: ele é o
                  CONSENTIMENTO, e o ritual de boas-vindas passou a mostrar o
                  mesmo interruptor. Duas cópias divergem no primeiro ajuste, e
                  a divergência seria duas telas prometendo coisas diferentes
                  sobre a mesma chave. */}
              {perfil.publico ? TEXTO_PERFIL_PUBLICO.ligado : TEXTO_PERFIL_PUBLICO.desligado}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={perfil.publico}
            disabled={salvando}
            onClick={() => salvar({ publico: !perfil.publico })}
            className={`press mt-0.5 h-7 w-12 shrink-0 rounded-full transition-colors ${
              perfil.publico ? "bg-primary" : "bg-muted"
            }`}
          >
            <span
              className={`block h-6 w-6 rounded-full bg-white shadow transition-transform ${
                perfil.publico ? "translate-x-[22px]" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>
      </section>

      {/* ─── O @ E QUEM PODE MENCIONAR ──────────────────────────────────
          ⚠️ **AS DUAS COISAS NO MESMO CARTÃO, e não em dois.** O `@` é o
          endereço; a chave decide quem pode usá-lo. Separá-los faria a
          paciente escolher um apelido sem nunca ver que existe controle sobre
          quem a chama por ele. */}
      <ArrobaDoPerfil
        handle={perfil.handle ?? null}
        quemPodeMencionar={perfil.quemPodeMencionar ?? QUEM_MENCIONA_PADRAO}
        aoTrocar={(h, q) =>
          setPerfil((pf) => (pf ? { ...pf, handle: h, quemPodeMencionar: q } : pf))
        }
        bancada={!!bancada}
      />

      {/* ⚠️ **O FILTRO MORA NAS CONFIGURAÇÕES, e não na tela de comentários.**
          É uma decisão que vale para o app inteiro e que ela toma UMA vez —
          embaixo de um comentário, ela a tomaria com raiva, sobre a palavra
          daquele momento, e a lista viraria um histórico de brigas. */}
      <FiltroDePalavras />

      {/* ─── O FEED: misturado ou fechado ──────────────────────────────────
          ⚠️ **O PADRÃO É O MISTURADO, e o interruptor existe para FECHAR.**
          Uma rede social que só mostra quem ela já segue não tem como crescer,
          e conta nova abre vazia — não há motivo nenhum para voltar no dia
          seguinte. Quem prefere o círculo fechado liga aqui.

          ⚠️ E o rótulo "Sugerido para você" continua em toda publicação de
          fora, ligada ou desligada esta chave: misturar sem avisar é a única
          versão disto que não se faz num app de gestação de alto risco. */}
      <section className="rounded-3xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-semibold">Só quem eu sigo</h3>
            <p className="mt-1 text-xs leading-snug text-muted-foreground">
              {perfil.feedSoSeguindo
                ? "Seu feed mostra apenas quem você segue."
                : "Seu feed mistura quem você segue com pessoas novas — sempre marcadas como sugestão."}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={perfil.feedSoSeguindo}
            aria-label="Mostrar só quem eu sigo"
            disabled={salvando}
            onClick={() => salvar({ feedSoSeguindo: !perfil.feedSoSeguindo })}
            className={`press mt-0.5 h-7 w-12 shrink-0 rounded-full transition-colors ${
              perfil.feedSoSeguindo ? "bg-primary" : "bg-muted"
            }`}
          >
            <span
              className={`block h-6 w-6 rounded-full bg-white shadow transition-transform ${
                perfil.feedSoSeguindo ? "translate-x-[22px]" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>
      </section>

      {/* ─── A VITRINE NA INTERNET ABERTA ────────────────────────────────
          ⚠️ **CHAVE PRÓPRIA, e ela nasceu de uma auditoria.** O interruptor de
          cima promete "qualquer pessoa NO APP"; `/p/<codigo>` abre FORA do app,
          sem conta nenhuma, e mostra bio, selo, nome do bebê e doze
          publicações. Autorizar isso com a chave de cima seria alargar, pela
          porta dos fundos, um consentimento dado para outra coisa — o oposto
          exato de "não podemos expor a paciente sem ela saber".

          ⚠️ E o ENDEREÇO fica à vista, ligado ou não. Ele era a única coisa que
          o app não contava a ninguém: a página existia e nenhuma tela dizia
          onde. Uma vitrine que a dona não sabe achar não é vitrine. */}
      {perfil.publico && (
        <section className="rounded-3xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="font-semibold">Uma página na internet</h3>
              <p className="mt-1 text-xs leading-snug text-muted-foreground">
                {perfil.vitrine
                  ? "Qualquer pessoa com o seu link abre o seu perfil pelo navegador, sem ter conta no app. É o link para pôr na bio do Instagram."
                  : "Desligada. O seu perfil só existe dentro do app."}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={!!perfil.vitrine}
              aria-label="Página na internet"
              disabled={salvando}
              onClick={() => salvar({ vitrine: !perfil.vitrine })}
              className={`press mt-0.5 h-7 w-12 shrink-0 rounded-full transition-colors ${
                perfil.vitrine ? "bg-primary" : "bg-muted"
              }`}
            >
              <span
                className={`block h-6 w-6 rounded-full bg-white shadow transition-transform ${
                  perfil.vitrine ? "translate-x-[22px]" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>

          {enderecoDaVitrine && (
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(enderecoDaVitrine);
                toast.success("Link copiado 💛");
              }}
              className="press mt-3 flex w-full items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-left"
            >
              <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">
                {enderecoDaVitrine.replace(/^https?:\/\//, "")}
              </span>
              <span className="shrink-0 text-xs font-medium text-primary">Copiar</span>
            </button>
          )}
        </section>
      )}

      {/* ─── O QUE O SEU PERFIL CONTA ────────────────────────────────────
          ⚠️ DUAS chaves, e nunca uma. Uma só obrigaria quem quer publicar o
          NOME do bebê a publicar junto a SEMANA, que é o dado clínico — são
          duas decisões, por razões diferentes. As duas nascem desligadas, pela
          mesma razão escrita em `perfil_publico`.

          ⚠️ E o texto de cada uma diz o que aparece e para quem. A explicação é
          a defesa: "não podemos expor a paciente sem ela saber" só é verdade se
          ela puder ler, ali, o que ligar aquilo significa. */}
      <section className="rounded-3xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
        <h3 className="font-semibold">O que o seu perfil conta</h3>
        <p className="mt-1 text-xs leading-snug text-muted-foreground">
          Hoje quem abre o seu perfil vê o seu nome, a sua foto, a sua descrição e o que você
          publicou. Nada do seu acompanhamento — peso, pressão, exames, consultas — aparece para
          ninguém, nunca.
        </p>

        <ChaveDoPerfil
          titulo="Mostrar a semana da gestação"
          /* ⚠️ Chaveia pelo RESULTADO, e não pela chave — como o irmão do nome
             do bebê, dois centímetros abaixo, sempre fez. Com a chave, toda
             paciente que ligou o selo chegava ao parto e passava a ler
             `Aparece "a sua semana" no seu perfil`: um marcador de posição
             entre aspas, prometendo um selo que já não existe, numa tela cujo
             pedido é justamente "não podemos expor a paciente sem ela saber". */
          descricao={
            perfil.seloSemana
              ? `Aparece "${perfil.seloSemana}" no seu perfil, e ela se atualiza sozinha toda semana.`
              : perfil.mostrarSemana
                ? "Ligado — mas hoje não há semana para mostrar (depois do parto, ou sem a data da última menstruação). Nada aparece no seu perfil."
                : "Um selo com a sua semana, que se atualiza sozinho. Fica visível para quem abre o seu perfil."
          }
          ligada={!!perfil.mostrarSemana}
          desabilitada={salvando}
          aoTrocar={() => salvar({ mostrarSemana: !perfil.mostrarSemana })}
        />

        <ChaveDoPerfil
          titulo="Mostrar o nome do bebê"
          descricao={
            perfil.seloBebe
              ? `Aparece "${perfil.seloBebe}" no seu perfil.`
              : "O nome que você cadastrou no perfil do bebê. Sem nome cadastrado, nada aparece."
          }
          ligada={!!perfil.mostrarBebe}
          desabilitada={salvando}
          aoTrocar={() => salvar({ mostrarBebe: !perfil.mostrarBebe })}
        />
      </section>

      {totalPedidos > 0 && (
        <section className="rounded-3xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
          <h3 className="font-semibold">
            {totalPedidos === 1 ? "1 pedido" : `${totalPedidos} pedidos`}
          </h3>
          <ul className="mt-2 space-y-2">
            {pedidos.map((p) => (
              <li key={p.id} className="flex items-center gap-2.5">
                <Avatar url={p.avatarUrl} nome={p.nome} tamanho={36} />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{p.nome}</span>
                <button
                  type="button"
                  onClick={() => responder(p.id, false)}
                  className="press shrink-0 rounded-xl border border-border px-3 py-1.5 text-xs"
                >
                  Agora não
                </button>
                <button
                  type="button"
                  onClick={() => responder(p.id, true)}
                  className="press shrink-0 rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                >
                  Aceitar
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/**
 * O FILTRO DE PALAVRAS — as expressões que ela não quer ler.
 *
 * ⚠️ **A LISTA É DELA, e o app NÃO sugere palavras.** Numa gestação de alto
 * risco não existe lista universal: para uma é "perdi", para outra é o nome de
 * um hospital, para outra é "aborto". Sugerir seria o app escrevendo na tela
 * dela justamente as palavras que ela está tentando não ler — e o custo de
 * errar aqui é alto demais para um palpite.
 *
 * ⚠️ **ESCONDE, NUNCA APAGA.** O comentário continua existindo para quem
 * escreveu e para todo mundo; o que muda é a tela DELA. Apagar seria moderação
 * feita por uma lista de palavras — e é assim que um filtro começa a censurar
 * a conversa das outras.
 */
export function FiltroDePalavras({ bancada }: { bancada?: string[] }) {
  const [palavras, setPalavras] = useState<string[]>(bancada ?? []);
  const [campo, setCampo] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [aberto, setAberto] = useState(!!bancada);

  useEffect(() => {
    if (bancada || !aberto) return;
    let vivo = true;
    void (async () => {
      try {
        const s = await supabase.auth.getSession();
        const t = s.data.session?.access_token;
        if (!t) return;
        const { minhasPalavrasOcultas } = await import("@/lib/comentarios.functions");
        const r = await minhasPalavrasOcultas({ data: { accessToken: t } });
        if (vivo && r.ok) setPalavras(r.palavras);
      } catch {
        /* Sem a lista, o cartão abre vazio — o estado de quem nunca o usou. */
      }
    })();
    return () => {
      vivo = false;
    };
  }, [bancada, aberto]);

  async function guardar(nova: string[]) {
    const antes = palavras;
    setPalavras(nova);
    setSalvando(true);
    try {
      if (bancada) return;
      const s = await supabase.auth.getSession();
      const t = s.data.session?.access_token;
      if (!t) return;
      const { salvarPalavrasOcultas } = await import("@/lib/comentarios.functions");
      const r = await salvarPalavrasOcultas({ data: { accessToken: t, palavras: nova } });
      /* ⚠️ **A LISTA QUE VOLTA É A DO SERVIDOR, e não a que eu mandei.** É lá
         que a limpeza roda (repetida, vazia, teto) — pintar a minha deixaria a
         tela mostrando uma entrada que o banco não guardou. */
      if (r.ok) setPalavras(r.palavras);
      else {
        setPalavras(antes);
        toast.error(
          r.motivo === "sem_suporte"
            ? "O filtro ainda não está pronto no servidor."
            : "Não deu para salvar.",
        );
      }
    } catch {
      setPalavras(antes);
      toast.error("Não deu para salvar.");
    } finally {
      setSalvando(false);
    }
  }

  function acrescentar() {
    /* ⚠️ Aceita vírgula e quebra de linha: ela cola uma lista de uma vez, e
       exigir uma por vez faria o recurso custar dez toques. */
    const novas = campo
      .split(/[,\n]/)
      .map((x) => x.trim())
      .filter(Boolean);
    if (!novas.length) return;
    setCampo("");
    void guardar([...palavras, ...novas]);
  }

  return (
    <section className="rounded-3xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold">Palavras que você não quer ler</h3>
          <p className="mt-1 text-xs leading-snug text-muted-foreground">
            Comentários com essas palavras ficam escondidos <strong>de você</strong>. Ninguém é
            avisado, e nada é apagado.
          </p>
        </div>
        {!aberto && (
          <button
            type="button"
            onClick={() => setAberto(true)}
            className="press min-h-[44px] shrink-0 rounded-full border border-border px-4 text-[13px] font-semibold"
          >
            Abrir
          </button>
        )}
      </div>

      {aberto && (
        <>
          <div className="mt-3 flex items-end gap-2">
            <input
              value={campo}
              onChange={(e) => setCampo(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  acrescentar();
                }
              }}
              placeholder="uma palavra ou frase"
              aria-label="Palavra a esconder"
              maxLength={PALAVRA_OCULTA_MAX}
              className="min-h-[44px] flex-1 rounded-2xl border border-border bg-background px-3 text-sm"
            />
            <button
              type="button"
              disabled={!campo.trim() || salvando}
              onClick={acrescentar}
              className="press min-h-[44px] shrink-0 rounded-full bg-primary px-4 text-[14px] font-semibold text-primary-foreground disabled:opacity-50"
            >
              Somar
            </button>
          </div>

          {palavras.length === 0 ? (
            <p className="mt-3 text-[12px] text-muted-foreground">
              Sua lista está vazia. Nada está sendo escondido.
            </p>
          ) : (
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {palavras.map((p) => (
                <li key={p}>
                  <button
                    type="button"
                    disabled={salvando}
                    onClick={() => void guardar(palavras.filter((x) => x !== p))}
                    aria-label={`Tirar "${p}" da lista`}
                    className="press flex min-h-[36px] items-center gap-1.5 rounded-full bg-muted px-3 text-[13px] disabled:opacity-50"
                  >
                    <span className="max-w-[180px] truncate">{p}</span>
                    <span aria-hidden className="text-muted-foreground">
                      ×
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* ⚠️ **DIZ QUE CASA PALAVRA INTEIRA.** Sem esta linha, ela esconde
              "mal" e estranha que "mala" continue aparecendo — ou o contrário,
              espera que "parto" esconda "departamento". A régua é
              `temPalavraOculta`, e a tela a explica em uma frase. */}
          <p className="mt-3 text-[11px] leading-snug text-muted-foreground">
            Casa a palavra inteira: “parto” não esconde “departamento”. Você pode escrever uma
            frase, e ela é escondida como frase.
          </p>
        </>
      )}
    </section>
  );
}
