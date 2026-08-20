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

  /* ⚠️ `window.location.origin` só no NAVEGADOR — lido no render, ele quebraria
     a hidratação (o servidor não tem `window`), que é o mesmo defeito que o
     cartão de convite do feed já pagou. Sem ele, `SITE`. */
  const enderecoDaVitrine = linkDaVitrine(
    perfil?.codigoDaVitrine,
    typeof window === "undefined" ? undefined : window.location.origin,
  );

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
  }) {
    setSalvando(true);
    try {
      const s = await supabase.auth.getSession();
      const token = s.data.session?.access_token;
      if (!token) return;
      const { salvarPerfilSocial } = await import("@/lib/rede-social.functions");
      const r = await salvarPerfilSocial({ data: { accessToken: token, ...mudanca } });
      if (!r.ok) {
        toast.error("Não deu para salvar.");
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
              {perfil.meusSeguidores === 1
                ? "1 pessoa te acompanha"
                : `${perfil.meusSeguidores ?? 0} pessoas te acompanham`}
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
              {perfil.publico
                ? "Qualquer pessoa no app pode te achar e te acompanhar. Cada publicação continua com a camada que você escolher."
                : "Só quem você aceitar te acompanha, e você não aparece na busca."}
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
