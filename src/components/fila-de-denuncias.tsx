import { useEffect, useState } from "react";
import type { DenunciaNaFila } from "@/lib/caixinha.functions";
import { rotuloDoMotivo, type DenunciaDaRede, rotuloDoAlvo } from "@/lib/denuncias";

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
function FilaDaCaixinha() {
  const [fila, setFila] = useState<DenunciaNaFila[]>([]);
  const [falhou, setFalhou] = useState(false);
  const [indo, setIndo] = useState<string | null>(null);

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
    void carregar();
  }, []);

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
function FilaDaRede() {
  const [fila, setFila] = useState<DenunciaDaRede[]>([]);
  const [falhou, setFalhou] = useState(false);
  const [indo, setIndo] = useState<string | null>(null);

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
    void carregar();
  }, []);

  async function resolver(id: string) {
    setIndo(id);
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const s = await supabase.auth.getSession();
      const t = s.data.session?.access_token;
      if (!t) return;
      const { resolverDenunciaDaRede } = await import("@/lib/rede-social.functions");
      const r = await resolverDenunciaDaRede({ data: { accessToken: t, denunciaId: id } });
      if (r.ok) setFila((f) => f.filter((d) => d.id !== id));
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
 * As DUAS filas, uma abaixo da outra.
 *
 * ⚠️ **São duas de propósito, e não uma lista misturada.** A da caixinha é
 * anônima por contrato; a da rede mostra quem foi denunciada. Fundi-las
 * obrigaria a tela a esconder o nome de metade das linhas sem explicar por quê
 * — ou, pior, a revelar o de quem escreveu na caixinha.
 */
export function FilaDeDenuncias() {
  return (
    <>
      <FilaDaRede />
      <FilaDaCaixinha />
    </>
  );
}
