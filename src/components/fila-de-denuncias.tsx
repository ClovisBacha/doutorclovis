import { useEffect, useState } from "react";
import { EscolherMotivo } from "@/components/escolher-motivo";
import type { DenunciaNaFila } from "@/lib/caixinha.functions";

/**
 * O DADO DE BANCADA.
 *
 * ⚠️ **A fila de moderação nunca teve bancada**, e é a tela de maior
 * consequência do painel: ela decide o que sai do ar e o que volta para quem
 * denunciou. Olhá-la exigia uma denúncia de verdade, feita por outra conta,
 * numa base com ADMIN_EMAILS configurado — ou seja, ninguém olhava.
 */
export type FichaDeModeracao = {
  nome: string;
  emCuidado: boolean;
  pausada: boolean;
  publica: boolean;
  desde: string | null;
  abertas: number;
  total: number;
  porDesfecho: { removido: number; avisado: number; sem_acao: number };
  suspensa: boolean;
  suspensaPor: string | null;
  historico: {
    alvo: string;
    motivo: string;
    trecho: string | null;
    quando: string;
    desfecho: string | null;
    resolvida: boolean;
  }[];
};

export type BancadaDaFila = {
  rede?: DenunciaDaRede[];
  caixinha?: DenunciaNaFila[];
  /** O estado que mais importa: "não consegui ler" NÃO é "está tudo limpo". */
  falhou?: boolean;
  /** ⚠️ A ficha vem do servidor: sem isto ela nunca desenha na bancada. */
  ficha?: FichaDeModeracao;
};
import {
  rotuloDoMotivo,
  type DenunciaDaRede,
  rotuloDoAlvo,
  PODE_REMOVER,
  type MotivoDaDenuncia,
} from "@/lib/denuncias";

/**
 * A FILA DE DENÚNCIAS DA CAIXINHA.
 *
 * ⚠️ **Ela existe porque a tela da paciente já prometia que existia.** A folha
 * de confirmação diz, com todas as letras: *"Ela sai da sua caixa e fica
 * registrada para a gente olhar."* — e uma varredura do `src/` inteiro não
 * achava nenhuma consulta lendo `denunciado_em`. Denúncia que não chega, somada
 * a um bloqueio cego (ela bloqueia um id que nunca vê), é o par mais perigoso
 * do recurso: a pessoa cria outra conta e volta amanhã.
 *
 * ⚠️ **SÓ APARECE QUANDO HÁ FILA.** Um cartão vazio permanente no Painel é
 * ruído numa tela que existe para mostrar o que precisa dele hoje — e a
 * ausência de denúncias é o estado normal.
 *
 * ⚠️ **E não mostra QUEM escreveu.** Nem para o administrador: o que ele precisa
 * para agir é o TEXTO e a REINCIDÊNCIA, e um id na tela vira um nome na
 * primeira vez que alguém o colar numa consulta. O servidor conta a
 * reincidência e o id morre lá.
 */
function FilaDaCaixinha({ bancada }: { bancada?: BancadaDaFila }) {
  const [fila, setFila] = useState<DenunciaNaFila[]>(bancada?.caixinha ?? []);
  const [falhou, setFalhou] = useState(!!bancada?.falhou);
  const [indo, setIndo] = useState<string | null>(null);

  const ehBancada = !!bancada;

  async function carregar() {
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const s = await supabase.auth.getSession();
      const t = s.data.session?.access_token;
      if (!t) return;
      const { denunciasAbertas } = await import("@/lib/caixinha.functions");
      const r = await denunciasAbertas({ data: { accessToken: t } });
      if (!r.ok) {
        /* ⚠️ "não consegui olhar" ≠ "não há nada": sem isto, um erro de banco
           diria ao administrador que está tudo limpo. Mesma régua de
           `listUnansweredQuestions`. */
        setFalhou(r.motivo === "banco");
        return;
      }
      setFila(r.fila);
      setFalhou(false);
    } catch {
      setFalhou(true);
    }
  }

  useEffect(() => {
    /* ⚠️ A bancada injeta o DADO nos mesmos `useState` da produção — nunca o
       desenho — e segura só a BUSCA, que exige sessão de administrador. É a
       régua do `?streak=41` da folha da chama. */
    if (ehBancada) return;
    void carregar();
  }, [ehBancada]);

  async function resolver(id: string) {
    setIndo(id);
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const s = await supabase.auth.getSession();
      const t = s.data.session?.access_token;
      if (!t) return;
      const { resolverDenuncia } = await import("@/lib/caixinha.functions");
      const r = await resolverDenuncia({ data: { accessToken: t, perguntaId: id } });
      if (r.ok) setFila((f) => f.filter((d) => d.id !== id));
    } finally {
      setIndo(null);
    }
  }

  if (falhou) {
    return (
      <div className="mt-6 rounded-2xl border border-destructive/40 bg-destructive/5 p-4">
        <p className="text-[13px] text-destructive">
          Não consegui carregar a fila de denúncias. Isso não quer dizer que ela está vazia.
        </p>
      </div>
    );
  }
  if (fila.length === 0) return null;

  return (
    <div className="mt-6 rounded-2xl border border-border bg-card p-4">
      <h3 className="text-[15px] font-semibold">
        Perguntas denunciadas{" "}
        <span className="ml-1 rounded-full bg-destructive px-2 py-0.5 text-[12px] font-semibold text-destructive-foreground">
          {fila.length}
        </span>
      </h3>
      <p className="mt-1 text-[12px] leading-snug text-muted-foreground">
        Escritas na caixinha de perguntas de alguma paciente. Quem escreveu não aparece aqui — o que
        aparece é o texto e quantas denúncias a mesma conta já tem.
      </p>
      <ul className="mt-3 flex flex-col gap-2">
        {fila.map((d) => (
          <li key={d.id} className="rounded-xl border border-border p-3">
            <p className="whitespace-pre-wrap text-[14px] leading-snug">{d.texto}</p>
            <div className="mt-2 flex items-center justify-between gap-3">
              <span className="text-[12px] text-muted-foreground">
                {d.reincidencias > 1
                  ? `${d.reincidencias} denúncias da mesma conta`
                  : "1ª denúncia desta conta"}
              </span>
              <button
                type="button"
                disabled={indo === d.id}
                onClick={() => void resolver(d.id)}
                className="press shrink-0 rounded-xl border border-border px-3 py-1.5 text-[12px] font-medium disabled:opacity-50"
              >
                {indo === d.id ? "…" : "Já olhei"}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * A FILA DA REDE SOCIAL — posts e perfis denunciados.
 *
 * ⚠️ **Aqui o NOME da denunciada APARECE, ao contrário da fila da caixinha.**
 * A diferença não é descuido: lá o que se julga é uma pergunta ANÔNIMA, e
 * revelar quem escreveu quebraria a promessa que faz a caixa existir. Aqui o
 * que se julga é uma CONTA — e agir sobre ela é impossível sem saber qual é.
 * É o que a diretriz 1.2 da App Store pede.
 *
 * ⚠️ **Quem DENUNCIOU continua invisível**, inclusive para você. Saber quem
 * apertou o botão só abriria caminho para retaliação, e num app onde as pessoas
 * se conhecem da vida real isso é concreto.
 */
function FilaDaRede({ bancada }: { bancada?: BancadaDaFila }) {
  const [fila, setFila] = useState<DenunciaDaRede[]>(bancada?.rede ?? []);
  const [falhou, setFalhou] = useState(!!bancada?.falhou);
  const [indo, setIndo] = useState<string | null>(null);
  const [recado, setRecado] = useState<string | null>(null);
  /**
   * A FICHA DE MODERAÇÃO DA CONTA ABERTA.
   *
   * ⚠️ **Decidir "avisar" ou "remover" sem histórico é decidir às cegas.** A
   * fila mostra UMA linha, e a mesma conta pode ter cinco resolvidas na semana
   * passada. A reincidência já vinha como número; a ficha diz o que aconteceu.
   */
  const [ficha, setFicha] = useState<FichaDeModeracao | null>(bancada?.ficha ?? null);
  const [abrindoFicha, setAbrindoFicha] = useState<string | null>(null);
  /**
   * De QUEM é a ficha aberta — o botão de suspender precisa do id.
   *
   * ⚠️ **A bancada precisa semeá-lo JUNTO com a ficha.** O painel só desenha
   * com os dois, e na bancada `verFicha` nunca roda (ela não tem sessão de
   * administrador): sem isto o painel simplesmente sumia, e a bancada
   * aprovaria uma fila sem o histórico e sem o botão de suspender.
   */
  const [fichaDe, setFichaDe] = useState<string | null>(
    bancada?.ficha ? (bancada.rede?.[0]?.denunciadaId ?? "bancada") : null,
  );

  async function verFicha(contaId: string) {
    setAbrindoFicha(contaId);
    setFichaDe(contaId);
    setFicha(null);
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const ses = await supabase.auth.getSession();
      const t = ses.data.session?.access_token;
      if (!t) return;
      const { fichaDeModeracao } = await import("@/lib/moderacao.functions");
      const r = await fichaDeModeracao({ data: { accessToken: t, contaId } });
      /* ⚠️ Falha vira recado, nunca uma ficha vazia: "esta conta nunca foi
         denunciada" sobre uma leitura que falhou muda a decisão do
         administrador para o lado errado. */
      if (r.ok) setFicha(r.ficha as FichaDeModeracao);
      else setRecado("Não deu para abrir a ficha desta conta agora.");
    } catch {
      setRecado("Não deu para abrir a ficha desta conta agora.");
    } finally {
      setAbrindoFicha(null);
    }
  }

  const ehBancada = !!bancada;

  async function carregar() {
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const s = await supabase.auth.getSession();
      const t = s.data.session?.access_token;
      if (!t) return;
      const { denunciasDaRede } = await import("@/lib/rede-social.functions");
      const r = await denunciasDaRede({ data: { accessToken: t } });
      if (!r.ok) {
        /* ⚠️ "não consegui olhar" ≠ "não há nada" — a frase mais perigosa que
           uma fila de denúncias pode dizer errado. */
        setFalhou(r.motivo === "banco");
        return;
      }
      setFila(r.fila as DenunciaDaRede[]);
      setFalhou(false);
    } catch {
      setFalhou(true);
    }
  }

  useEffect(() => {
    /* ⚠️ A bancada injeta o DADO nos mesmos `useState` da produção — nunca o
       desenho — e segura só a BUSCA, que exige sessão de administrador. É a
       régua do `?streak=41` da folha da chama. */
    if (ehBancada) return;
    void carregar();
  }, [ehBancada]);

  /**
   * ⚠️ **O DESFECHO ERA NUNCA MANDADO.** O servidor aceita
   * `removido | avisado | sem_acao` e a tela chamava sem nenhum — então toda
   * denúncia era resolvida como "sem ação", e a tela "Suas denúncias" da
   * paciente dizia "ainda não olhamos" para sempre. O ciclo que a plataforma
   * promete fechar não fechava.
   */
  async function resolver(id: string, desfecho: "removido" | "avisado" | "sem_acao") {
    setIndo(id);
    setRecado(null);
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const s = await supabase.auth.getSession();
      const t = s.data.session?.access_token;
      if (!t) return;
      const { resolverDenunciaDaRede } = await import("@/lib/rede-social.functions");
      const r = await resolverDenunciaDaRede({
        data: { accessToken: t, denunciaId: id, desfecho },
      });
      if (r.ok) {
        setFila((f) => f.filter((d) => d.id !== id));
        return;
      }
      /* ⚠️ **Um desfecho que não corresponde ao que aconteceu é pior que
         nenhum.** Se a baixa falhou, a linha FICA na fila e o administrador
         sabe — nada é marcado como resolvido. */
      setRecado(
        r.motivo === "nao_removivel"
          ? "Não há publicação a remover neste alvo — use “avisar” ou “sem ação”."
          : "Não deu para registrar agora. A denúncia continua na fila.",
      );
    } finally {
      setIndo(null);
    }
  }

  if (falhou) {
    return (
      <div className="mt-6 rounded-2xl border border-destructive/40 bg-destructive/5 p-4">
        <p className="text-[13px] text-destructive">
          Não consegui carregar as denúncias da Comunidade. Isso não quer dizer que não há nenhuma.
        </p>
      </div>
    );
  }
  if (fila.length === 0) return null;

  return (
    <div className="mt-6 rounded-2xl border border-border bg-card p-4">
      <h3 className="text-[15px] font-semibold">
        Denúncias na Comunidade{" "}
        <span className="ml-1 rounded-full bg-destructive px-2 py-0.5 text-[12px] font-semibold text-destructive-foreground">
          {fila.length}
        </span>
      </h3>
      <p className="mt-1 text-[12px] leading-snug text-muted-foreground">
        Quem foi denunciada, e por quê. Quem denunciou não aparece — nem para você.
      </p>
      <ul className="mt-3 flex flex-col gap-2">
        {fila.map((d) => (
          <li key={d.id} className="rounded-xl border border-border p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[14px] font-semibold">{d.denunciadaNome}</span>
              {/* ⚠️ O tipo do alvo importa: cada um pede uma decisão diferente,
                  e uma denúncia de MENSAGEM PRIVADA rotulada como "publicação"
                  manda o administrador procurar um post que não existe. */}
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                {rotuloDoAlvo(d.alvo)}
              </span>
              <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">
                {rotuloDoMotivo(d.motivo)}
              </span>
            </div>
            {d.trecho && (
              /* O texto congelado no instante da denúncia — se ela editar ou
                 arquivar depois, isto continua sendo o que foi denunciado. */
              <p className="mt-1.5 whitespace-pre-wrap rounded-lg bg-muted/50 p-2 text-[13px] leading-snug">
                {d.trecho}
              </p>
            )}
            <div className="mt-2 flex items-center justify-between gap-3">
              <span className="text-[12px] text-muted-foreground">
                {d.reincidencias > 1
                  ? `${d.reincidencias} pessoas diferentes já denunciaram esta conta`
                  : "1ª denúncia desta conta"}{" "}
                <button
                  type="button"
                  disabled={abrindoFicha === d.denunciadaId}
                  onClick={() => void verFicha(d.denunciadaId)}
                  className="press underline underline-offset-2 disabled:opacity-50"
                >
                  {abrindoFicha === d.denunciadaId ? "abrindo…" : "ver ficha"}
                </button>
              </span>
              {/* ⚠️ **TRÊS SAÍDAS, e não um "Já olhei".** O desfecho volta para
                  quem denunciou — era a metade do ciclo que a plataforma promete
                  e não entregava. E "Remover" só aparece onde HÁ publicação a
                  tirar do ar: num perfil, numa pergunta ou numa mensagem não há,
                  e um botão que promete o que não faz é pior que a ausência. */}
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                {PODE_REMOVER.includes(d.alvo) && (
                  <button
                    type="button"
                    disabled={indo === d.id}
                    onClick={() => void resolver(d.id, "removido")}
                    className="press min-h-[38px] rounded-xl bg-destructive px-3 py-1.5 text-[12px] font-semibold text-destructive-foreground disabled:opacity-50"
                  >
                    {indo === d.id ? "…" : "Remover"}
                  </button>
                )}
                <button
                  type="button"
                  disabled={indo === d.id}
                  onClick={() => void resolver(d.id, "avisado")}
                  className="press min-h-[38px] rounded-xl border border-border px-3 py-1.5 text-[12px] font-medium disabled:opacity-50"
                >
                  Avisar
                </button>
                <button
                  type="button"
                  disabled={indo === d.id}
                  onClick={() => void resolver(d.id, "sem_acao")}
                  className="press min-h-[38px] rounded-xl border border-border px-3 py-1.5 text-[12px] font-medium text-muted-foreground disabled:opacity-50"
                >
                  Sem ação
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
      {ficha && fichaDe && (
        <PainelDaFicha
          ficha={ficha}
          contaId={fichaDe}
          aoFechar={() => setFicha(null)}
          aoMudar={() => void verFicha(fichaDe)}
        />
      )}
      {recado && <p className="mt-2 text-[12px] text-destructive">{recado}</p>}
    </div>
  );
}

/**
 * As DUAS filas, uma abaixo da outra.
 *
 * ⚠️ **São duas de propósito, e não uma lista misturada.** A da caixinha é
 * anônima por contrato; a da rede mostra quem foi denunciada. Fundi-las
 * obrigaria a tela a esconder o nome de metade das linhas sem explicar por quê
 * — ou, pior, a revelar o de quem escreveu na caixinha.
 */
export function FilaDeDenuncias({ bancada }: { bancada?: BancadaDaFila } = {}) {
  return (
    <>
      <FilaDaRede bancada={bancada} />
      <FilaDaCaixinha bancada={bancada} />
    </>
  );
}

/**
 * A FICHA DE UMA CONTA — o histórico que a fila não mostra.
 *
 * ⚠️ **Ela NÃO lista o que a paciente publicou.** Só o que já foi denunciado (e
 * portanto já passou pela fila), mais o estado da conta e as contagens. A
 * Comunidade é onde ela escreve para o público que ELA escolheu; ler o que
 * ninguém denunciou seria transformar moderação em vigilância.
 */
function PainelDaFicha({
  ficha,
  contaId,
  aoFechar,
  aoMudar,
}: {
  ficha: FichaDeModeracao;
  contaId: string;
  aoFechar: () => void;
  aoMudar: () => void;
}) {
  const [indo, setIndo] = useState(false);
  const [recado, setRecado] = useState<string | null>(null);
  /* ⚠️ O motivo é CATÁLOGO FECHADO, como nas outras quatro portas de denúncia:
     ele é lido depois, na própria ficha, e campo livre aqui vira o texto que
     alguém escreve às pressas sobre uma paciente. */
  const [escolhendo, setEscolhendo] = useState(false);

  /**
   * ⚠️ **O DEGRAU ACIMA DE REMOVER UMA PEÇA.** Sem ele, uma conta que reincide
   * continua publicando enquanto o administrador remove peça por peça.
   *
   * ⚠️ **Falha vira recado, nunca silêncio** — e o caso "em Modo Cuidado" tem
   * texto próprio, porque é o único em que a recusa é uma DECISÃO do produto e
   * não uma avaria.
   */
  async function suspender(ligar: boolean, motivo?: MotivoDaDenuncia) {
    setIndo(true);
    setRecado(null);
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const s = await supabase.auth.getSession();
      const t = s.data.session?.access_token;
      if (!t) return;
      const { suspenderDaComunidade } = await import("@/lib/moderacao.functions");
      const r = await suspenderDaComunidade({
        data: { accessToken: t, contaId, suspender: ligar, motivo: motivo ?? "outro" },
      });
      if (r.ok) {
        aoMudar();
        return;
      }
      setRecado(
        r.motivo === "em_cuidado"
          ? "Esta conta está em Modo Cuidado — ela já está fora da rede, e suspender seria punir quem acabou de perder a gestação."
          : r.motivo === "sem_suporte"
            ? "O banco ainda não tem a coluna da suspensão (APLICAR_SUSPENDER_DA_REDE.sql)."
            : "Não deu para mudar agora.",
      );
    } finally {
      setIndo(false);
    }
  }
  const dia = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        })
      : "—";
  return (
    <div className="mt-3 rounded-2xl border border-border bg-muted/30 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[14px] font-semibold">{ficha.nome}</p>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            Na plataforma desde {dia(ficha.desde)} · {ficha.total} denúncia
            {ficha.total === 1 ? "" : "s"} no total, {ficha.abertas} em aberto
          </p>
        </div>
        <button
          type="button"
          onClick={aoFechar}
          aria-label="Fechar ficha"
          className="press -mr-1 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center text-lg leading-none text-muted-foreground"
        >
          ×
        </button>
      </div>

      {/* ⚠️ O ESTADO DA CONTA MUDA A DECISÃO. Uma conta em Modo Cuidado já está
          fora da rede — suspender seria punir quem acabou de perder a gestação;
          e uma conta pausada já não aparece para ninguém. */}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {ficha.emCuidado && (
          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400">
            Modo Cuidado — já está fora da rede
          </span>
        )}
        {ficha.pausada && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
            conta pausada por ela
          </span>
        )}
        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
          perfil {ficha.publica ? "público" : "privado"}
        </span>
        {/* ⚠️ Sem o motivo, "suspensa" não diz por quê — e rever a decisão, dias
            depois, vira adivinhação. */}
        {ficha.suspensa && (
          <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">
            suspensa{ficha.suspensaPor ? ` · ${rotuloDoMotivo(ficha.suspensaPor)}` : ""}
          </span>
        )}
      </div>

      <p className="mt-2 text-[12px] text-muted-foreground">
        Já resolvidas: {ficha.porDesfecho.removido} removida
        {ficha.porDesfecho.removido === 1 ? "" : "s"} · {ficha.porDesfecho.avisado} avisada
        {ficha.porDesfecho.avisado === 1 ? "" : "s"} · {ficha.porDesfecho.sem_acao} sem ação
      </p>

      {ficha.historico.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1.5">
          {ficha.historico.map((h, i) => (
            <li key={`${h.quando}-${i}`} className="rounded-lg bg-background/60 p-2">
              <p className="text-[11px] text-muted-foreground">
                {dia(h.quando)} · {rotuloDoAlvo(h.alvo)} · {rotuloDoMotivo(h.motivo)} ·{" "}
                {h.resolvida ? (h.desfecho ?? "resolvida") : "em aberto"}
              </p>
              {h.trecho && <p className="mt-0.5 text-[12px] leading-snug">{h.trecho}</p>}
            </li>
          ))}
        </ul>
      )}

      {/* ⚠️ **O DEGRAU ACIMA DE REMOVER UMA PEÇA.** Sem ele, uma conta que
          reincide continua publicando enquanto o administrador remove peça por
          peça — o que não é moderação, é enxugar gelo.

          ⚠️ E ele NÃO aparece para quem está em Modo Cuidado: ela já está fora
          da rede, e o servidor recusa de qualquer jeito. Oferecer um botão que
          o servidor vai recusar é pior que não oferecer. */}
      {!ficha.emCuidado && (
        <div className="mt-3 border-t border-border pt-2">
          <button
            type="button"
            disabled={indo}
            onClick={() => (ficha.suspensa ? void suspender(false) : setEscolhendo(true))}
            className={`press min-h-[38px] rounded-xl px-3 py-1.5 text-[12px] font-semibold disabled:opacity-50 ${
              ficha.suspensa ? "border border-border" : "bg-destructive text-destructive-foreground"
            }`}
          >
            {indo
              ? "…"
              : ficha.suspensa
                ? "Devolver a conta à Comunidade"
                : "Suspender da Comunidade"}
          </button>
          <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
            {ficha.suspensa
              ? "Ela volta a aparecer na Comunidade. Nada do que ela publicou foi apagado."
              : "Ela some da Comunidade — perfil, publicações, stories e busca — e É AVISADA de que a conta está indisponível. Nada é apagado, e dá para desfazer. O resto do app não muda: consultas, registros e a conversa com o médico continuam."}
          </p>
          {recado && <p className="mt-1 text-[11px] text-destructive">{recado}</p>}
          {escolhendo && (
            <div className="mt-2">
              <EscolherMotivo
                titulo={`Por que suspender ${ficha.nome} da Comunidade?`}
                aviso="Ela é avisada de que a conta está indisponível, sem o motivo — o motivo fica aqui, para quem revir a decisão."
                aoCancelar={() => setEscolhendo(false)}
                aoEnviar={(m) => {
                  setEscolhendo(false);
                  void suspender(true, m as MotivoDaDenuncia);
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* ⚠️ A frase existe para o administrador não procurar o que não está
          aqui — e para deixar registrado que a ausência é decisão, não falta. */}
      <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
        Esta ficha mostra só o que foi denunciado. O que ninguém denunciou não aparece aqui.
      </p>
    </div>
  );
}
