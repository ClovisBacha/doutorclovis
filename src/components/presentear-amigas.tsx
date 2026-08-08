import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PRESENTE_ENTRE_AMIGAS } from "@/lib/economia-sementinhas";
import type { EstadoDaMesadaAmiga } from "@/lib/mesada-paciente.functions";

/**
 * PRESENTEAR AS AMIGAS — o bolso mensal de quem assina.
 *
 * ─── O QUE ELE ACRESCENTA AO CARTÃO DE INDICAÇÃO ────────────────────────────
 *
 * O `ReferralCard` premia quem TRAZ: 100 🌱 quando a amiga cria a conta. Este
 * dá a ela algo para DAR — e é isso que faz voltar, porque presentear cria uma
 * expectativa de resposta que ganhar sozinha não cria.
 *
 * ─── POR QUE ELE SÓ APARECE PARA QUEM ASSINA ────────────────────────────────
 *
 * O bolso é benefício do Premium. E a tela some inteira quando não há bolso,
 * em vez de aparecer bloqueada: um cartão cinza com cadeado ensina que existe
 * algo que ela não pode ter, e a assinatura já tem vitrine própria — o
 * Cantinho, com os 57 itens que ela vê e não compra. Duas vitrines para a mesma
 * assinatura viram ruído.
 *
 * ─── MODO CUIDADO ───────────────────────────────────────────────────────────
 *
 * Quem perdeu a gestação não recebe gamificação, e isso vale para os dois lados
 * da troca: o servidor recusa presentear alguém em Modo Cuidado, e esta tela
 * não é montada para quem está nele (o pai já não a renderiza).
 */
export function PresentearAmigas() {
  const [mesada, setMesada] = useState<EstadoDaMesadaAmiga | null>(null);
  const [amigas, setAmigas] = useState<{ id: string; nome: string }[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState<string | null>(null);
  const [presenteadas, setPresenteadas] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      try {
        const { data: s } = await supabase.auth.getSession();
        if (!s.session?.access_token) return;
        const { getMesadaDaAmiga } = await import("@/lib/mesada-paciente.functions");
        const res = await getMesadaDaAmiga({ data: { accessToken: s.session.access_token } });
        if (res.ok) {
          setMesada(res.mesada);
          setAmigas(res.amigas);
        }
      } catch {
        /* Sem bolso, o cartão não aparece. */
      } finally {
        setCarregando(false);
      }
    })();
  }, []);

  if (carregando || !mesada?.assinante) return null;

  const pct = mesada.total > 0 ? Math.min(100, Math.round((mesada.usado / mesada.total) * 100)) : 0;
  const cabe = mesada.restante >= PRESENTE_ENTRE_AMIGAS;

  async function presentear(amiga: { id: string; nome: string }) {
    setEnviando(amiga.id);
    try {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session?.access_token) return;
      const { presentearAmiga } = await import("@/lib/mesada-paciente.functions");
      const res = await presentearAmiga({
        data: { accessToken: s.session.access_token, amigaId: amiga.id },
      });
      if (res.ok) {
        setMesada(res.mesada);
        setPresenteadas((s2) => new Set(s2).add(amiga.id));
        toast.success(`${PRESENTE_ENTRE_AMIGAS} Sementinhas para ${amiga.nome} 🌱💌`);
        return;
      }
      /* Cada recusa com a sua frase: três delas são estados normais, não erros,
         e "não foi possível" faria ela tentar de novo contra uma parede. */
      const texto =
        res.error === "ja_presenteada"
          ? `Você já presenteou ${amiga.nome} neste mês 💛`
          : res.error === "mesada_esgotada"
            ? "Suas Sementinhas de presente acabaram. Voltam na virada do mês 🌱"
            : res.error === "modo_cuidado"
              ? `${amiga.nome} está passando por um momento delicado — o app não envia presentes agora.`
              : res.error === "nao_indicada"
                ? `${amiga.nome} não entrou pelo seu link.`
                : "Não deu para enviar agora.";
      if ("mesada" in res && res.mesada) setMesada(res.mesada);
      if (res.error === "ja_presenteada") setPresenteadas((s2) => new Set(s2).add(amiga.id));
      toast(texto, { duration: 6000 });
    } catch {
      toast.error("Não deu para enviar agora.");
    } finally {
      setEnviando(null);
    }
  }

  return (
    <div className="rounded-3xl border border-violet-200 bg-gradient-to-br from-violet-50 via-white to-fuchsia-50 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-2xl">💝</span>
          <p className="text-sm font-extrabold text-violet-700">Presenteie suas amigas</p>
        </div>
        <span className="rounded-full bg-violet-100 px-3 py-1 text-[11px] font-bold text-violet-700 tabular-nums">
          {mesada.restante} de {mesada.total} 🌱
        </span>
      </div>

      <p className="mt-2 text-sm leading-relaxed text-foreground/80">
        Porque você assina, todo mês você ganha{" "}
        <span className="font-bold">{mesada.total} Sementinhas</span> para dar às amigas que trouxe.
        Não sai do seu saldo 💜
      </p>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-violet-100">
        <div
          className="h-full rounded-full bg-violet-500 transition-[width] duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>

      {amigas.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-dashed border-violet-200 p-4 text-center text-sm text-muted-foreground">
          Quando uma amiga entrar pelo seu link, ela aparece aqui para você presentear.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-violet-100 overflow-hidden rounded-2xl border border-violet-100 bg-white">
          {amigas.map((a) => {
            const jaFoi = presenteadas.has(a.id);
            return (
              <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="min-w-0 truncate text-sm">{a.nome}</span>
                <button
                  type="button"
                  onClick={() => presentear(a)}
                  disabled={jaFoi || !cabe || enviando === a.id}
                  className="press shrink-0 rounded-full bg-violet-500 px-4 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                >
                  {jaFoi
                    ? "Enviado ✓"
                    : enviando === a.id
                      ? "Enviando…"
                      : `Dar ${PRESENTE_ENTRE_AMIGAS} 🌱`}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-3 text-[11px] text-muted-foreground">
        Uma amiga por mês, cada. O que sobrar não acumula — volta cheio na virada do mês.
      </p>
    </div>
  );
}
