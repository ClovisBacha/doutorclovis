import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CLASSES_DE_PRESENTE, type ClasseDePresente } from "@/lib/economia-sementinhas";
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
  /* Quem já recebeu NESTE ciclo — o servidor deduplica, e a tela precisa contar
     a mesma história ou o médico clica de novo achando que falhou.

     Ele NASCE do servidor (`mesada.presenteadas`), e não vazio. Vazio era um
     defeito real: bastava recarregar o painel para o botão de uma paciente já
     presenteada voltar a dizer "Dar 30 🌱", o clique ser recusado, e o recurso
     parecer quebrado exatamente quando estava funcionando. */
  const [presenteadas, setPresenteadas] = useState<Set<string>>(new Set());

  /* Uma função só para as duas portas de entrada (a leitura inicial e cada
     resposta de envio): mesada e lista de presenteadas viajam juntas, e
     atualizar uma sem a outra é como as duas passaram a discordar antes. */
  function aplicar(m: EstadoDaMesada) {
    setMesada(m);
    setPresenteadas((s) => {
      const nova = new Set(s);
      for (const id of m.presenteadas ?? []) nova.add(id);
      return nova;
    });
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
        },
      });
      if (res.ok) {
        aplicar(res.mesada);
        setPresenteadas((s) => new Set(s).add(p.id));
        toast.success(
          `${classe.emoji} ${classe.quantidade} Sementinhas para ${nomeCurto(p)} — ela recebe um aviso com o seu nome.`,
        );
        return;
      }
      /* Cada recusa tem uma frase própria: "não foi possível" faz o médico
         tentar de novo contra uma parede que não vai ceder. */
      const mensagem =
        res.error === "ja_presenteada"
          ? `${nomeCurto(p)} já ganhou um presente seu neste mês.`
          : res.error === "mesada_esgotada"
            ? "A mesada deste mês acabou. Ela volta na virada do mês."
            : res.error === "modo_cuidado"
              ? `${nomeCurto(p)} está em Modo Cuidado — o app não envia gamificação para ela.`
              : res.error === "sem_vinculo"
                ? `${nomeCurto(p)} não está mais vinculada a você.`
                : "Não foi possível enviar o presente.";
      if ("mesada" in res && res.mesada) aplicar(res.mesada);
      if (res.error === "ja_presenteada") setPresenteadas((s) => new Set(s).add(p.id));
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
        <ul className="mt-5 divide-y divide-border overflow-hidden rounded-2xl border border-border">
          {pacientes.map((p) => {
            const jaFoi = presenteadas.has(p.id);
            return (
              <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="min-w-0 truncate text-sm">{nomeCurto(p)}</span>
                <button
                  type="button"
                  onClick={() => presentear(p)}
                  disabled={jaFoi || !cabe || enviando === p.id}
                  className="press shrink-0 rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                >
                  {jaFoi
                    ? "Enviado ✓"
                    : enviando === p.id
                      ? "Enviando…"
                      : `Dar ${classe.quantidade} ${classe.emoji}`}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* O que ela vê. Sem esta linha o médico não tinha como saber se o
          presente chega até ela ou se some no saldo — e foi exatamente essa
          dúvida que revelou que, até aqui, ele SUMIA mesmo. */}
      <p className="mt-3 text-xs text-muted-foreground">
        Ela recebe uma notificação com o seu nome e, ao abrir o Caminho, um aviso de que o presente
        veio de você. Uma paciente por mês, cada. Quem está em Modo Cuidado não recebe — o app
        desliga toda a gamificação para quem perdeu a gestação.
      </p>
    </div>
  );
}

function nomeCurto(p: PatientEngagement): string {
  const nome = (p.display_name ?? "").trim();
  return nome || "Paciente";
}
