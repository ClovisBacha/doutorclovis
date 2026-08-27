import { useEffect, useState } from "react";

/**
 * OS NÚMEROS DA COMUNIDADE, no painel.
 *
 * ⚠️ **A aba mais movimentada do app não tinha NENHUM número no painel.** O
 * dono não tinha como responder "ela está viva?" sem abrir o app de uma
 * paciente — e uma aba social que esfria esfria em silêncio.
 *
 * ⚠️ **São CONTAGENS, e nunca uma amostra do conteúdo.** Nenhum texto de
 * paciente viaja para virar um número aqui (`head: true` nas seis consultas).
 *
 * ⚠️ **"Não consegui contar" NÃO vira zero** — ele desenha "—". Um painel que
 * diga "0 publicações esta semana" sobre uma leitura que falhou faz o dono
 * concluir que a aba morreu, e a decisão que ele tomaria a partir disso é
 * grande.
 */
export type NumerosDaComunidade = {
  publicacoes: number | null;
  publicacoesNaSemana: number | null;
  storiesNaSemana: number | null;
  comentariosNaSemana: number | null;
  perfisPublicos: number | null;
  denunciasNaSemana: number | null;
};

export function NumerosDaComunidade({ bancada }: { bancada?: NumerosDaComunidade } = {}) {
  const [n, setN] = useState<NumerosDaComunidade | null>(bancada ?? null);
  const [falhou, setFalhou] = useState(false);
  const ehBancada = !!bancada;

  useEffect(() => {
    if (ehBancada) return;
    let vivo = true;
    void (async () => {
      try {
        const { supabase } = await import("@/integrations/supabase/client");
        const s = await supabase.auth.getSession();
        const t = s.data.session?.access_token;
        if (!t) return;
        const { numerosDaComunidade } = await import("@/lib/moderacao.functions");
        const r = await numerosDaComunidade({ data: { accessToken: t } });
        if (!vivo) return;
        if (r.ok) setN(r.numeros as NumerosDaComunidade);
        else setFalhou(true);
      } catch {
        if (vivo) setFalhou(true);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [ehBancada]);

  if (falhou) {
    return (
      <p className="mt-6 text-[12px] text-muted-foreground">
        Não consegui ler os números da Comunidade agora.
      </p>
    );
  }
  if (!n) return null;

  const v = (x: number | null) => (x === null ? "—" : x.toLocaleString("pt-BR"));

  return (
    <div className="mt-6">
      <h3 className="text-[14px] font-semibold">Comunidade</h3>
      <p className="mt-0.5 text-[12px] text-muted-foreground">
        Últimos 7 dias, exceto onde diz o contrário.
      </p>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Caixa rotulo="Publicações na semana" valor={v(n.publicacoesNaSemana)} />
        <Caixa rotulo="Stories na semana" valor={v(n.storiesNaSemana)} />
        <Caixa rotulo="Comentários na semana" valor={v(n.comentariosNaSemana)} />
        <Caixa rotulo="Publicações no total" valor={v(n.publicacoes)} />
        <Caixa rotulo="Perfis públicos" valor={v(n.perfisPublicos)} />
        <Caixa
          rotulo="Denúncias na semana"
          valor={v(n.denunciasNaSemana)}
          /* ⚠️ Este é o único que é ALERTA quando sobe: os outros cinco são bons
             quando crescem, e pintar todos igual ensinaria a não olhar. */
          alerta={(n.denunciasNaSemana ?? 0) > 0}
        />
      </div>
    </div>
  );
}

function Caixa({ rotulo, valor, alerta }: { rotulo: string; valor: string; alerta?: boolean }) {
  return (
    <div
      className={`rounded-xl border p-3 ${
        alerta ? "border-destructive/40 bg-destructive/5" : "border-border"
      }`}
    >
      <p className="text-[20px] font-semibold tabular-nums leading-none">{valor}</p>
      <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{rotulo}</p>
    </div>
  );
}
