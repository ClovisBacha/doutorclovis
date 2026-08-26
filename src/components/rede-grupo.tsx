/**
 * O GRUPO DO DIRECT.
 *
 * ⚠️ **COMPONENTE PRÓPRIO, e ele NÃO busca nada sozinho quando a bancada
 * preenche.** É a lição das telas de segurança que passaram meses sem ninguém
 * olhar: os estados que mais importam (vazio, teto batido, encerrado) não se
 * fabricam numa conta de teste — exigiriam oito contas reais e um convite
 * aceito por cada uma.
 */

import { useCallback, useEffect, useState } from "react";
import {
  MEMBROS_DO_GRUPO_MAX,
  NOME_DO_GRUPO_MAX,
  type MembroDoGrupo,
} from "@/lib/grupo-da-conversa";
import type { GrupoNaTela } from "@/lib/grupo.functions";

async function token() {
  const { supabase } = await import("@/integrations/supabase/client");
  const s = await supabase.auth.getSession();
  return s.data.session?.access_token ?? null;
}

type MensagemDoGrupo = {
  id: string;
  souEu: boolean;
  texto: string | null;
  apagada: boolean;
  criadaEm: string;
  autorNome: string;
};

function Foto({ url, nome, lado = 40 }: { url: string | null; nome: string; lado?: number }) {
  if (url)
    return (
      <img
        src={url}
        alt=""
        style={{ width: lado, height: lado }}
        className="shrink-0 rounded-full object-cover"
      />
    );
  return (
    <span
      style={{ width: lado, height: lado }}
      className="flex shrink-0 items-center justify-center rounded-full bg-muted text-[13px] font-semibold"
    >
      {(nome.trim()[0] ?? "?").toUpperCase()}
    </span>
  );
}

/** A lista de grupos, dentro da caixa de entrada. */
export function MeusGrupos({
  aoAbrir,
  aoCriar,
  bancada,
}: {
  aoAbrir: (g: GrupoNaTela) => void;
  aoCriar: () => void;
  /** ⚠️ Só a bancada: a lista vem do servidor e exige sessão. */
  bancada?: GrupoNaTela[];
}) {
  const [grupos, setGrupos] = useState<GrupoNaTela[] | null>(bancada ?? null);

  useEffect(() => {
    if (bancada) return;
    void (async () => {
      try {
        const t = await token();
        if (!t) return;
        const { meusGrupos } = await import("@/lib/grupo.functions");
        const r = await meusGrupos({ data: { accessToken: t } });
        setGrupos(r.ok ? r.grupos : []);
      } catch {
        /* Sem grupos, a caixa de entrada continua inteira. */
        setGrupos([]);
      }
    })();
  }, [bancada]);

  return (
    <section className="border-b border-border px-4 pb-3 pt-1">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[13px] font-semibold">Grupos</h2>
        <button
          type="button"
          onClick={aoCriar}
          className="press min-h-[44px] text-[13px] font-medium text-primary"
        >
          Criar grupo
        </button>
      </div>
      {/* ⚠️ O vazio EXPLICA a régua, senão criar um grupo e não conseguir
          convidar ninguém lê como app quebrado. */}
      {(grupos ?? []).length === 0 ? (
        <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
          Você ainda não está em nenhum grupo. Dá para chamar até {MEMBROS_DO_GRUPO_MAX} pessoas que
          você já acompanha.
        </p>
      ) : (
        <ul className="mt-1">
          {(grupos ?? []).map((g) => (
            <li key={g.id}>
              <button
                type="button"
                onClick={() => aoAbrir(g)}
                className="press flex w-full items-center gap-3 py-2 text-left"
              >
                <Foto url={g.membros.find((m) => !m.souEu)?.avatarUrl ?? null} nome={g.nome} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold">{g.nome}</span>
                  <span className="block truncate text-[12px] text-muted-foreground">
                    {g.membros.length} {g.membros.length === 1 ? "pessoa" : "pessoas"}
                  </span>
                </span>
                {g.naoLida && !g.silenciado && (
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-primary" />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** A conversa do grupo. */
export function ConversaDoGrupo({
  grupo,
  aoVoltar,
  aoConvidar,
  bancada,
}: {
  grupo: GrupoNaTela;
  aoVoltar: () => void;
  /** Abre a folha de convidar. Só a criadora recebe. */
  aoConvidar?: () => void;
  bancada?: MensagemDoGrupo[];
}) {
  const [msgs, setMsgs] = useState<MensagemDoGrupo[] | null>(bancada ?? null);
  const [texto, setTexto] = useState("");
  const [recado, setRecado] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [saindo, setSaindo] = useState(false);

  const carregar = useCallback(async () => {
    if (bancada) return;
    try {
      const t = await token();
      if (!t) return;
      const { mensagensDoGrupo } = await import("@/lib/grupo.functions");
      const r = await mensagensDoGrupo({ data: { accessToken: t, grupoId: grupo.id } });
      setMsgs(r.ok ? (r.mensagens as MensagemDoGrupo[]) : []);
    } catch {
      setMsgs([]);
    }
  }, [bancada, grupo.id]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function enviar() {
    const t0 = texto.trim();
    if (!t0 || enviando) return;
    setEnviando(true);
    setRecado(null);
    try {
      const t = await token();
      if (!t) return;
      const { mandarNoGrupo } = await import("@/lib/grupo.functions");
      const r = await mandarNoGrupo({ data: { accessToken: t, grupoId: grupo.id, texto: t0 } });
      if (!r.ok) {
        /* ⚠️ **O TEXTO NÃO É APAGADO NA RECUSA** — ela acabou de escrever, e
            limpar o campo obriga a redigitar tudo para trocar uma frase. */
        setRecado(
          "motivo" in r && r.motivo === "emergencia"
            ? "Isso parece uma emergência. Use o SOS — o grupo não substitui atendimento."
            : "Não deu para mandar agora.",
        );
        return;
      }
      setTexto("");
      void carregar();
    } catch {
      setRecado("Não deu para mandar agora.");
    } finally {
      setEnviando(false);
    }
  }

  async function sair() {
    try {
      const t = await token();
      if (!t) return;
      const { sairDoGrupo } = await import("@/lib/grupo.functions");
      const r = await sairDoGrupo({ data: { accessToken: t, grupoId: grupo.id } });
      const { toast } = await import("sonner");
      if (!r.ok) {
        toast.error("Não deu para sair agora.");
        return;
      }
      toast.success(
        "encerrou" in r && r.encerrou ? "Grupo encerrado." : "Você saiu. Ninguém é avisado.",
      );
      aoVoltar();
    } catch {
      /* Sem rede, a folha continua aberta. */
    }
  }

  return (
    <div className="mx-auto flex h-[100dvh] max-w-[430px] flex-col">
      <header className="flex items-center gap-2 border-b border-border px-4 py-2">
        <button
          type="button"
          onClick={aoVoltar}
          aria-label="Voltar"
          className="press -ml-2 flex h-11 w-11 items-center justify-center text-[15px]"
        >
          ←
        </button>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold">{grupo.nome}</span>
          <span className="block truncate text-[11px] text-muted-foreground">
            {grupo.membros.map((m) => (m.souEu ? "Você" : m.nome)).join(", ")}
          </span>
        </span>
        {/* ⚠️ **SÓ A CRIADORA CONVIDA**, e o botão só existe para ela: um botão
            que o servidor recusa é um botão que promete e não cumpre. */}
        {grupo.souACriadora && aoConvidar && grupo.membros.length < MEMBROS_DO_GRUPO_MAX && (
          <button
            type="button"
            onClick={aoConvidar}
            className="press min-h-[44px] shrink-0 text-[13px] font-medium text-primary"
          >
            Chamar
          </button>
        )}
        <button
          type="button"
          onClick={() => setSaindo(true)}
          aria-label="Sair do grupo"
          className="press flex h-11 w-8 shrink-0 items-center justify-center text-[15px] text-muted-foreground"
        >
          ⋯
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {/* ⚠️ **A FRASE DO HISTÓRICO É OBRIGATÓRIA.** Quem entra num grupo com
            conversa antiga vê uma tela vazia e conclui que o app quebrou — e
            quem já estava precisa saber que o que ela escreveu antes NÃO foi
            entregue a quem chegou depois. */}
        <p className="mb-3 text-center text-[11px] leading-snug text-muted-foreground">
          Você vê as mensagens a partir de quando entrou.
        </p>
        {(msgs ?? []).map((m) => (
          <div
            key={m.id}
            className={`mb-1.5 flex flex-col ${m.souEu ? "items-end" : "items-start"}`}
          >
            {!m.souEu && (
              <span className="px-1 text-[11px] text-muted-foreground">{m.autorNome}</span>
            )}
            <span
              className={`max-w-[78%] rounded-2xl px-3 py-2 text-[14px] leading-snug ${
                m.apagada
                  ? "bg-muted/50 italic text-muted-foreground"
                  : m.souEu
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
              }`}
            >
              {m.apagada ? "Mensagem apagada" : m.texto}
            </span>
          </div>
        ))}
      </div>

      <div className="border-t border-border px-4 py-2 pb-[calc(0.5rem+var(--safe-area-inset-bottom,0px))]">
        {recado && (
          <p className="mb-2 rounded-xl bg-muted/60 px-3 py-2 text-[12px] leading-snug">{recado}</p>
        )}
        <div className="flex items-end gap-2">
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value.slice(0, 1000))}
            rows={1}
            placeholder="Escreva no grupo…"
            className="max-h-24 min-h-[36px] flex-1 resize-none rounded-2xl border border-border bg-background px-3 py-2 text-[14px]"
          />
          <button
            type="button"
            onClick={() => void enviar()}
            disabled={!texto.trim() || enviando}
            className="press h-11 shrink-0 rounded-full px-3 text-[13px] font-semibold text-primary disabled:opacity-40"
          >
            Enviar
          </button>
        </div>
      </div>

      {saindo && (
        <div className="absolute inset-x-0 bottom-0 z-20 rounded-t-3xl border-t border-border bg-card p-4">
          <p className="text-[14px] font-semibold">
            {grupo.souACriadora ? "Encerrar o grupo?" : "Sair do grupo?"}
          </p>
          {/* ⚠️ A criadora precisa saber que sair ENCERRA para todo mundo — sem
              a frase, ela sai achando que só ela sai. */}
          <p className="mt-1 text-[12px] leading-snug text-muted-foreground">
            {grupo.souACriadora
              ? "Você criou este grupo: saindo, ele acaba para todas. As mensagens não são apagadas."
              : "Ninguém é avisado. Você para de ver as mensagens novas."}
          </p>
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setSaindo(false)}
              className="press min-h-[44px] text-[13px] text-muted-foreground"
            >
              Ficar
            </button>
            <button
              type="button"
              onClick={() => void sair()}
              className="press min-h-[44px] rounded-full bg-destructive px-4 text-[13px] font-semibold text-destructive-foreground"
            >
              {grupo.souACriadora ? "Encerrar" : "Sair"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Criar o grupo e chamar as primeiras. */
export function CriarGrupo({
  candidatas,
  aoFechar,
  aoCriado,
}: {
  /** A MESMA lista de `amigasParaMarcar` — nunca uma busca. */
  candidatas: { id: string; nome: string; avatar: string | null }[];
  aoFechar: () => void;
  aoCriado: (grupoId: string) => void;
}) {
  const [nome, setNome] = useState("");
  const [escolhidas, setEscolhidas] = useState<string[]>([]);
  const [criando, setCriando] = useState(false);

  async function criar() {
    if (criando) return;
    setCriando(true);
    try {
      const t = await token();
      if (!t) return;
      const { criarGrupo, convidarParaGrupo } = await import("@/lib/grupo.functions");
      const r = await criarGrupo({ data: { accessToken: t, nome: nome.trim() || null } });
      const { toast } = await import("sonner");
      if (!r.ok) {
        toast.error("Não deu para criar o grupo agora.");
        return;
      }
      /* ⚠️ Convidar é um passo À PARTE, e a falha dele NÃO derruba o grupo: ele
         já existe, e ela pode chamar de dentro. */
      if (escolhidas.length > 0) {
        await convidarParaGrupo({
          data: { accessToken: t, grupoId: r.grupoId, alvos: escolhidas },
        });
      }
      aoCriado(r.grupoId);
    } catch {
      const { toast } = await import("sonner");
      toast.error("Não deu para criar o grupo agora.");
    } finally {
      setCriando(false);
    }
  }

  return (
    <div className="mx-auto max-w-[430px] px-4 pt-2">
      <header className="flex items-center gap-2 py-2">
        <button
          type="button"
          onClick={aoFechar}
          aria-label="Voltar"
          className="press -ml-2 flex h-11 w-11 items-center justify-center text-[15px]"
        >
          ←
        </button>
        <h1 className="min-w-0 flex-1 text-[16px] font-semibold">Novo grupo</h1>
      </header>

      <input
        value={nome}
        onChange={(e) => setNome(e.target.value.slice(0, NOME_DO_GRUPO_MAX))}
        placeholder="Nome do grupo (opcional)"
        className="w-full rounded-2xl border border-border bg-background px-3 py-2 text-[15px]"
      />

      {/* ⚠️ A régua é DITA: sem a frase, quem não acha a amiga na lista conclui
          que o app quebrou — quando na verdade ela só ainda não se acompanham. */}
      <p className="mt-3 text-[12px] leading-snug text-muted-foreground">
        Você chama quem já acompanha. Até {MEMBROS_DO_GRUPO_MAX} pessoas, contando você.
      </p>

      {candidatas.length === 0 ? (
        <p className="py-10 text-center text-[13px] text-muted-foreground">
          Você ainda não acompanha ninguém. Um grupo precisa de pelo menos mais uma pessoa.
        </p>
      ) : (
        <ul className="mt-2">
          {candidatas.map((c) => {
            const marcada = escolhidas.includes(c.id);
            const cheio = escolhidas.length >= MEMBROS_DO_GRUPO_MAX - 1 && !marcada;
            return (
              <li key={c.id}>
                <button
                  type="button"
                  disabled={cheio}
                  onClick={() =>
                    setEscolhidas((v) => (marcada ? v.filter((x) => x !== c.id) : [...v, c.id]))
                  }
                  className={`press flex min-h-[44px] w-full items-center gap-2.5 py-1.5 text-left ${
                    cheio ? "opacity-40" : ""
                  }`}
                >
                  <Foto url={c.avatar} nome={c.nome} />
                  <span className="min-w-0 flex-1 truncate text-[14px]">{c.nome}</span>
                  {marcada && <span aria-hidden>✓</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <button
        type="button"
        disabled={criando}
        onClick={() => void criar()}
        className="press mt-4 w-full rounded-2xl bg-primary py-3 text-[15px] font-semibold text-primary-foreground disabled:opacity-60"
      >
        {criando ? "Criando…" : "Criar grupo"}
      </button>
    </div>
  );
}

/** Chamar mais gente para um grupo que já existe. */
export function ChamarParaGrupo({
  grupo,
  candidatas,
  aoFechar,
  aoChamou,
}: {
  grupo: GrupoNaTela;
  candidatas: { id: string; nome: string; avatar: string | null }[];
  aoFechar: () => void;
  aoChamou: () => void;
}) {
  const [escolhidas, setEscolhidas] = useState<string[]>([]);
  const jaLa = new Set(grupo.membros.map((m: MembroDoGrupo) => m.id));
  const livres = candidatas.filter((c) => !jaLa.has(c.id));
  const vagas = MEMBROS_DO_GRUPO_MAX - grupo.membros.length;

  async function chamar() {
    try {
      const t = await token();
      if (!t || escolhidas.length === 0) return;
      const { convidarParaGrupo } = await import("@/lib/grupo.functions");
      const r = await convidarParaGrupo({
        data: { accessToken: t, grupoId: grupo.id, alvos: escolhidas },
      });
      const { toast } = await import("sonner");
      /* ⚠️ **O NÚMERO QUE ENTROU É DITO, e não "pronto".** O servidor recusa em
          silêncio quem foi bloqueada, quem entrou em luto e quem já saiu — e um
          "pronto" sobre zero pessoas faria ela achar que o grupo cresceu. */
      if (!r.ok) {
        toast.error("Não deu para chamar agora.");
        return;
      }
      toast.success(
        r.entraram === 0
          ? "Ninguém entrou. Elas podem ter saído ou não estar disponíveis."
          : `${r.entraram} ${r.entraram === 1 ? "entrou" : "entraram"} no grupo.`,
      );
      aoChamou();
    } catch {
      /* Sem rede, a folha continua aberta. */
    }
  }

  return (
    <div className="mx-auto max-w-[430px] px-4 pt-2">
      <header className="flex items-center gap-2 py-2">
        <button
          type="button"
          onClick={aoFechar}
          aria-label="Voltar"
          className="press -ml-2 flex h-11 w-11 items-center justify-center text-[15px]"
        >
          ←
        </button>
        <h1 className="min-w-0 flex-1 text-[16px] font-semibold">Chamar para o grupo</h1>
      </header>
      <p className="text-[12px] leading-snug text-muted-foreground">
        {vagas > 0 ? `Cabem mais ${vagas}.` : "O grupo está cheio."}
      </p>
      <ul className="mt-2">
        {livres.map((c) => {
          const marcada = escolhidas.includes(c.id);
          const cheio = escolhidas.length >= vagas && !marcada;
          return (
            <li key={c.id}>
              <button
                type="button"
                disabled={cheio}
                onClick={() =>
                  setEscolhidas((v) => (marcada ? v.filter((x) => x !== c.id) : [...v, c.id]))
                }
                className={`press flex min-h-[44px] w-full items-center gap-2.5 py-1.5 text-left ${
                  cheio ? "opacity-40" : ""
                }`}
              >
                <Foto url={c.avatar} nome={c.nome} />
                <span className="min-w-0 flex-1 truncate text-[14px]">{c.nome}</span>
                {marcada && <span aria-hidden>✓</span>}
              </button>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        disabled={escolhidas.length === 0}
        onClick={() => void chamar()}
        className="press mt-4 w-full rounded-2xl bg-primary py-3 text-[15px] font-semibold text-primary-foreground disabled:opacity-60"
      >
        Chamar
      </button>
    </div>
  );
}
