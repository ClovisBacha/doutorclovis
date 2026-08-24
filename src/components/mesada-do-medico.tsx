import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CLASSES_DE_PRESENTE, type ClasseDePresente } from "@/lib/economia-sementinhas";
import { filtrarPacientes } from "@/lib/buscar-paciente";
import type { EstadoDaMesada } from "@/lib/mesada.functions";
import type { PatientEngagement } from "@/lib/admin.functions";

/**
 * A MESADA DE SEMENTINHAS — o cartão que faltava.
 *
 * ─── O QUE ELE SUBSTITUI ────────────────────────────────────────────────────
 *
 * O cartão de CONVITES PREMIUM. O médico gerava um código que dava a assinatura
 * inteira a uma paciente — a receita que a plataforma vive de vender —, e aquilo
 * não funcionava nos apps: desconto de assinatura no iOS e no Android é a loja
 * quem dá, não nós.
 *
 * ─── E POR QUE ELE PRECISAVA EXISTIR ────────────────────────────────────────
 *
 * `getMesada` e `presentearPaciente` estavam escritas, testadas e sem NENHUM
 * chamador de tela. É o padrão que esta base já consertou várias vezes com
 * outro nome: a função existe, o teste passa, e o recurso não existe para
 * ninguém. Mesada sem botão é coluna gravada e nunca lida.
 *
 * ─── AS TRÊS CLASSES ────────────────────────────────────────────────────────
 *
 * Vêm de `economia-sementinhas.ts`, junto com a razão de cada valor. Um campo
 * livre obrigaria o médico a inventar um número contra uma loja que ele nunca
 * viu.
 */
export function MesadaDoMedico({
  tokenFn,
  pacientes,
}: {
  tokenFn: () => Promise<string>;
  /** As pacientes vinculadas — o servidor confere o vínculo de novo. */
  pacientes: PatientEngagement[];
}) {
  const [mesada, setMesada] = useState<EstadoDaMesada | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [classe, setClasse] = useState<ClasseDePresente>(CLASSES_DE_PRESENTE[0]);
  const [enviando, setEnviando] = useState<string | null>(null);
  /* A BUSCA. Sem limite de presentes por paciente, a lista deixou de ser um
     lugar por onde se passa uma vez por mês e virou a ferramenta de todo dia —
     e uma lista inteira de pacientes rolando é onde se erra o nome. Mesma
     escolha do formulário de marcar consulta: escolher a paciente, não caçá-la. */
  const [busca, setBusca] = useState("");
  /* Quanto cada paciente já recebeu NESTE ciclo, vindo do servidor.
     Não bloqueia mais ninguém (o limite de um por mês caiu): é informação, para
     ele dosar a mesada entre as pacientes sem que o app decida por ele. */
  const [recebido, setRecebido] = useState<Record<string, number>>({});
  const [explicandoCuidado, setExplicandoCuidado] = useState(false);

  /* Uma função só para as duas portas de entrada (a leitura inicial e cada
     resposta de envio): mesada e valores recebidos viajam juntos, e atualizar
     um sem o outro é como os dois passaram a discordar antes. */
  function aplicar(m: EstadoDaMesada) {
    setMesada(m);
    setRecebido(m.recebido ?? {});
  }

  useEffect(() => {
    (async () => {
      try {
        const { getMesada } = await import("@/lib/mesada.functions");
        const res = await getMesada({ data: { accessToken: await tokenFn() } });
        if (res.ok) aplicar(res.mesada);
      } catch {
        /* Sem mesada, o cartão simplesmente não aparece. */
      } finally {
        setCarregando(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* O cartão some para quem não tem bolso — médico no Free não tem o que dar, e
     mostrar "0 de 0" só ensina que existe algo que ele não pode usar. */
  if (carregando || !mesada || mesada.total <= 0) return null;

  const pct = Math.min(100, Math.round((mesada.usado / mesada.total) * 100));
  const cabe = mesada.restante >= classe.quantidade;

  /* A lista mostrada: filtrada pela busca e cortada em `TETO_DA_LISTA`.
     O corte não some com ninguém — quem ficou de fora é contado logo abaixo,
     porque uma lista truncada em silêncio faz o médico concluir que a paciente
     que ele procura não está vinculada a ele. */
  const filtradas = filtrarPacientes(pacientes, busca);
  const visiveis = filtradas.slice(0, TETO_DA_LISTA);
  const ocultas = filtradas.length - visiveis.length;

  async function presentear(p: PatientEngagement) {
    if (!cabe) {
      toast("A mesada deste mês não cobre esse presente.", { duration: 5000 });
      return;
    }
    setEnviando(p.id);
    try {
      const { presentearPaciente } = await import("@/lib/mesada.functions");
      const res = await presentearPaciente({
        data: {
          accessToken: await tokenFn(),
          patientId: p.id,
          quantidade: classe.quantidade,
          /* O token do CLIQUE. É ele que faz um toque duplo (ou uma retentativa
             da rede) gravar UMA vez, agora que a chave não carrega mais o mês.
             Um token novo por chamada, e não por paciente: dois envios
             deliberados à mesma pessoa são dois presentes, que é o pedido. */
          token: crypto.randomUUID(),
        },
      });
      if (res.ok) {
        aplicar(res.mesada);
        /* `repetido` é o mesmo clique voltando. Some com o segundo "enviado!",
           que faria ele achar que saíram dois. */
        if (!res.repetido) {
          toast.success(
            `${classe.emoji} ${classe.quantidade} Sementinhas para ${nomeCurto(p)} — ela recebe um aviso com o seu nome.`,
          );
        }
        return;
      }
      /* Cada recusa tem uma frase própria: "não foi possível" faz o médico
         tentar de novo contra uma parede que não vai ceder. */
      const mensagem =
        res.error === "mesada_esgotada"
          ? "A mesada deste mês acabou. Ela volta na virada do mês."
          : res.error === "modo_cuidado"
            ? `${nomeCurto(p)} está em Modo Cuidado — o app não envia gamificação para ela.`
            : res.error === "sem_vinculo"
              ? `${nomeCurto(p)} não está mais vinculada a você.`
              : "Não foi possível enviar o presente.";
      if ("mesada" in res && res.mesada) aplicar(res.mesada);
      toast(mensagem, { duration: 6000 });
    } catch {
      toast.error("Não foi possível enviar o presente.");
    } finally {
      setEnviando(null);
    }
  }

  return (
    <div className="rounded-3xl border border-border bg-card p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-serif text-lg">Sementinhas para presentear</p>
          <p className="mt-1 max-w-prose text-sm text-muted-foreground">
            Todo mês você ganha um bolso de Sementinhas — a moeda do app da paciente — do tamanho do
            seu plano. Elas compram itens do Cantinho dela. Não custa nada a você.
          </p>
        </div>
        <p className="shrink-0 text-right">
          <span className="font-serif text-3xl tabular-nums">
            {mesada.restante.toLocaleString("pt-BR")}
          </span>
          <span className="block text-xs text-muted-foreground">
            de {mesada.total.toLocaleString("pt-BR")} 🌱 neste mês
          </span>
        </p>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-primary/10">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* ── A classe do presente ─────────────────────────────────────────── */}
      <div className="mt-5 grid gap-2 sm:grid-cols-3">
        {CLASSES_DE_PRESENTE.map((c) => {
          const ativa = c.chave === classe.chave;
          const excede = mesada.restante < c.quantidade;
          return (
            <button
              key={c.chave}
              type="button"
              onClick={() => setClasse(c)}
              disabled={excede}
              aria-pressed={ativa}
              className={`rounded-2xl border p-3 text-left transition-colors disabled:opacity-45 ${
                ativa ? "border-primary bg-primary/10 ring-1 ring-primary/40" : "border-border"
              }`}
            >
              {/* A ilustração no lugar do emoji: as três classes são um
                  crescendo (broto → buquê → jardim), e é o desenho que faz o
                  tamanho do presente ser LIDO antes do número. O emoji sozinho
                  dava três quadradinhos parecidos. `alt=""` porque o nome vem
                  logo abaixo, em texto. */}
              <img
                src={c.imagem}
                alt=""
                className="h-14 w-14 rounded-xl object-contain"
                loading="lazy"
              />
              <p className="mt-1.5 text-sm font-semibold">
                {c.nome} · {c.quantidade} 🌱
              </p>
              <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{c.efeito}</p>
              {excede && (
                <p className="mt-1 text-[11px] font-semibold text-amber-700">
                  não cabe na mesada deste mês
                </p>
              )}
            </button>
          );
        })}
      </div>

      {/* ── A quem dar ───────────────────────────────────────────────────── */}
      {pacientes.length === 0 ? (
        <p className="mt-5 rounded-2xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
          Quando as suas pacientes se vincularem, elas aparecem aqui para presentear.
        </p>
      ) : (
        <div className="mt-5">
          {/* A BUSCA. Só aparece quando há gente o bastante para se perder —
              com quatro pacientes um campo de busca é mobília. */}
          {pacientes.length > LIMITE_SEM_BUSCA && (
            <label className="block">
              <span className="sr-only">Procurar paciente</span>
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Escreva o nome da paciente…"
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </label>
          )}

          {visiveis.length === 0 ? (
            <p className="mt-3 rounded-2xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
              Nenhuma paciente com esse nome.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-border overflow-hidden rounded-2xl border border-border">
              {visiveis.map((p) => {
                const ja = recebido[p.id] ?? 0;
                return (
                  <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <span className="min-w-0">
                      <span className="block truncate text-sm">{nomeCurto(p)}</span>
                      {/* Informação, não bloqueio: o botão continua valendo.
                          É o que ele precisa para dosar a mesada entre as
                          pacientes sem que o app escolha por ele. */}
                      {ja > 0 && (
                        <span className="block text-[11px] text-muted-foreground">
                          já recebeu {ja} 🌱 este mês
                        </span>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => presentear(p)}
                      disabled={!cabe || enviando === p.id}
                      className="press shrink-0 rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                    >
                      {enviando === p.id ? "Enviando…" : `Dar ${classe.quantidade} ${classe.emoji}`}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {/* Quantas ficaram de fora do corte. Sem esta linha, a lista cortada
              é indistinguível de uma lista completa — e ele concluiria que a
              paciente que procura não está vinculada. */}
          {ocultas > 0 && (
            <p className="mt-2 text-center text-[11px] text-muted-foreground">
              +{ocultas} {ocultas === 1 ? "paciente" : "pacientes"} — escreva o nome para encontrar
            </p>
          )}
        </div>
      )}

      {/* O que ela vê. Sem esta linha o médico não tinha como saber se o
          presente chega até ela ou se some no saldo — e foi exatamente essa
          dúvida que revelou que, até aqui, ele SUMIA mesmo. */}
      <p className="mt-3 text-xs text-muted-foreground">
        Ela recebe uma notificação com o seu nome e, ao abrir o Caminho, um aviso de que o presente
        veio de você. Pode presentear a mesma paciente quantas vezes quiser — o limite é a sua
        mesada. Quem está em{" "}
        {/* O link azul: "Modo Cuidado" é vocabulário NOSSO, e o cartão o usava
            como se todo médico já soubesse. Um termo que decide se a paciente
            recebe ou não precisa estar a um toque da explicação. */}
        <button
          type="button"
          onClick={() => setExplicandoCuidado(true)}
          className="font-semibold text-sky-600 underline decoration-sky-300 underline-offset-2 hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300"
        >
          Modo Cuidado 🤍
        </button>{" "}
        não recebe.
      </p>

      {explicandoCuidado && <ExplicaModoCuidado aoFechar={() => setExplicandoCuidado(false)} />}
    </div>
  );
}

function nomeCurto(p: PatientEngagement): string {
  const nome = (p.display_name ?? "").trim();
  return nome || "Paciente";
}

/** Abaixo disto, buscar é mais trabalho que olhar — o campo nem aparece. */
const LIMITE_SEM_BUSCA = 6;
/** Quantas linhas a lista mostra de uma vez. O resto sai pela busca. */
const TETO_DA_LISTA = 8;

/**
 * O QUE É MODO CUIDADO — para o médico que nunca ouviu o termo.
 *
 * Ele decide se a paciente recebe ou não o presente, e estava escrito no
 * rodapé do cartão como se fosse vocabulário conhecido. É vocabulário NOSSO:
 * quem chegou ontem na plataforma lê "Modo Cuidado" e não sabe se é uma
 * assinatura, um plano ou um estado clínico.
 *
 * O texto responde três perguntas nessa ordem — o que é, quem liga, e o que
 * muda para ele — porque a terceira é a única que muda o que ele faz agora.
 */
function ExplicaModoCuidado({ aoFechar }: { aoFechar: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="O que é o Modo Cuidado"
      onClick={aoFechar}
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-5"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85svh] w-full max-w-md overflow-y-auto rounded-3xl border border-border bg-card p-6 shadow-2xl"
      >
        <p className="font-serif text-xl">Modo Cuidado 🤍</p>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          É uma pausa na parte lúdica do app, para quem perdeu a gestação ou está passando por um
          momento em que festa não cabe.
        </p>

        <dl className="mt-4 space-y-3 text-sm">
          <div>
            <dt className="font-semibold">Quem liga é a paciente</dt>
            <dd className="mt-0.5 leading-snug text-muted-foreground">
              Ela ativa e desativa quando quiser, nas configurações dela. Você não liga nem desliga
              por ela — e não é avisado, porque o motivo é dela.
            </dd>
          </div>
          <div>
            <dt className="font-semibold">O que fica pausado</dt>
            <dd className="mt-0.5 leading-snug text-muted-foreground">
              Sementinhas, confete, comemorações de semana, desafios do dia e a contagem de
              progresso. Nada é apagado: o saldo e a jornada dela ficam guardados e voltam
              exatamente como estavam quando ela desligar o modo.
            </dd>
          </div>
          <div>
            <dt className="font-semibold">O que NÃO muda</dt>
            <dd className="mt-0.5 leading-snug text-muted-foreground">
              Tudo que é cuidado continua de pé: o SOS, a conversa com você, os registros de
              pressão, glicemia e sintomas, os lembretes de consulta. O Modo Cuidado cala a
              gamificação, nunca a medicina.
            </dd>
          </div>
          <div>
            <dt className="font-semibold">Por que o presente não chega</dt>
            <dd className="mt-0.5 leading-snug text-muted-foreground">
              Sementinhas são moeda de decoração. Mandar moedinhas e confete para quem acabou de
              perder o bebê é o oposto do que você quis dizer — então o app segura o envio, e a sua
              mesada não é gasta.
            </dd>
          </div>
        </dl>

        <button
          type="button"
          onClick={aoFechar}
          className="press mt-6 w-full rounded-full bg-primary py-2.5 text-sm font-semibold text-primary-foreground"
        >
          Entendi
        </button>
      </div>
    </div>
  );
}
