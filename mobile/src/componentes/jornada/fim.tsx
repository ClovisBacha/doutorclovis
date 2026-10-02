import * as Haptics from "expo-haptics";
import { useEffect, useRef, useState } from "react";
import { Platform, View } from "react-native";
import { Botao, Cartao, Carregando, T } from "~/componentes/base";
import { pagarAula, pagarDiaFechado, pagarMomento } from "~/componentes/jornada/economia";
import { corJornada } from "~/componentes/jornada/cores";
import { marcarLivre } from "~/componentes/jornada/livres";
import { Bolha, Confete, Estrelas, voltarParaJornada } from "~/componentes/jornada/pecas";
import { contarMomentos, flagsDoDia, type Momento } from "~/lib/jornada/momentos";
import { marcar, useLoja } from "~/lib/jornada/loja";
import { cor, espaco, raio } from "~/tema";

/**
 * O FIM DE UM MOMENTO — marca, paga, e celebra quando fecha o dia.
 *
 * A ordem importa:
 *  1. Marca no aparelho ANTES do servidor: ela fez, e rede caída não pode
 *     apagar o que ela fez (é o que o site faz com a estrela).
 *  2. Paga o momento.
 *  3. Se esta marca fechou os cinco, pede o bônus DEPOIS do pagamento: o
 *     servidor confere as quatro atividades no ledger, e pedir antes de a
 *     quarta chegar devolveria zero.
 *
 * No Modo Cuidado não há jornada, estrela nem placar (a régua do site): nada é
 * marcado nem pago. No pós-parto marca (a trilha do pós-parto é local) mas não
 * paga — o servidor não paga fora da gestação.
 */
export type Desfecho = {
  /** Sementinhas do momento; `null` = não conseguimos confirmar. */
  ganhou: number | null;
  fechou: boolean;
  bonus: number | null;
  semPagamento: boolean;
};

export async function concluirMomento(o: {
  uid: string;
  D: number | null;
  momento: Momento;
  cuidado: boolean;
  pos: boolean;
  acertos?: number;
}): Promise<Desfecho> {
  if (o.cuidado || o.D == null) {
    await marcarLivre(o.uid, o.momento);
    return { ganhou: null, fechou: false, bonus: null, semPagamento: true };
  }
  const { fechouAgora } = marcar(o.D, o.momento, o.pos);
  if (o.pos) return { ganhou: null, fechou: false, bonus: null, semPagamento: true };
  const ganhou =
    o.momento === "aula" ? await pagarAula(o.D, o.acertos ?? 0) : await pagarMomento(o.D, o.momento);
  const bonus = fechouAgora ? await pagarDiaFechado(o.D) : null;
  if (fechouAgora && Platform.OS !== "web") {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }
  return { ganhou, fechou: fechouAgora, bonus, semPagamento: false };
}

/** A frase das sementinhas — nunca afirma um crédito que não foi confirmado. */
function fraseDoGanho(d: Desfecho): { texto: string; ok: boolean } | null {
  if (d.semPagamento) return null;
  if (d.ganhou == null) {
    return {
      texto:
        "O seu momento ficou guardado. Não conseguimos confirmar as sementinhas agora — a jornada tenta de novo quando você voltar.",
      ok: false,
    };
  }
  if (d.ganhou > 0) return { texto: `+${d.ganhou} sementinhas 🌱`, ok: true };
  return { texto: "Este momento já estava contado hoje.", ok: true };
}

export function FimDoMomento({
  titulo,
  fala,
  desfecho,
  D,
  cuidado,
  pos,
  aoTentarPagar,
  extra,
}: {
  titulo: string;
  fala?: string;
  /** `null` enquanto o servidor responde. */
  desfecho: Desfecho | null;
  D: number | null;
  cuidado: boolean;
  pos: boolean;
  /** Só a aula oferece: as atividades são reconciliadas ao abrir a aba. */
  aoTentarPagar?: () => void;
  extra?: React.ReactNode;
}) {
  const loja = useLoja();
  const feitos = D != null && !pos ? contarMomentos(flagsDoDia(loja.blob, D)) : 0;
  const ganho = desfecho ? fraseDoGanho(desfecho) : null;
  const festa = !!desfecho?.fechou && !cuidado;
  const [mostrarConfete, setConfete] = useState(false);
  const jaFestejou = useRef(false);
  useEffect(() => {
    if (festa && !jaFestejou.current) {
      jaFestejou.current = true;
      setConfete(true);
    }
  }, [festa]);

  return (
    <View style={{ flex: 1 }}>
      <View style={{ alignItems: "center", gap: espaco.md, paddingTop: espaco.lg }}>
        <Bolha humor={cuidado ? "feliz" : "comemorando"} tamanho={festa ? 180 : 150} />
        <T tipo="titulo" centro>
          {festa ? "Cinco estrelas!" : titulo}
        </T>
        {festa ? (
          <T tipo="corpo" centro cor={cor.textoApagado}>
            Você fechou os cinco momentos de hoje. Isso é cuidado de verdade.
          </T>
        ) : fala ? (
          <T tipo="corpo" centro cor={cor.textoApagado}>
            {fala}
          </T>
        ) : null}
        {D != null && !pos && !cuidado ? <Estrelas feitos={festa ? 5 : feitos} tamanho={30} /> : null}
      </View>

      <View style={{ gap: espaco.md, marginTop: espaco.xl }}>
        {extra}
        {desfecho == null && !cuidado ? <Carregando texto="Somando as suas sementinhas…" /> : null}
        {ganho ? (
          <Cartao fundo={ganho.ok ? corJornada.sementinhaFundo : cor.atencaoFundo}>
            <T tipo="rotulo" cor={ganho.ok ? corJornada.sementinha : cor.atencao} centro>
              {ganho.texto}
            </T>
            {!ganho.ok && aoTentarPagar ? (
              <Botao rotulo="Tentar de novo" tipo="secundario" aoTocar={aoTentarPagar} />
            ) : null}
          </Cartao>
        ) : null}
        {festa && desfecho ? (
          <View
            style={{
              borderRadius: raio.lg,
              padding: espaco.lg,
              backgroundColor: corJornada.trofeuFundo,
              borderWidth: 1,
              borderColor: "#fcd34d",
              gap: 4,
            }}
          >
            <T tipo="rotulo" cor={corJornada.trofeu} centro>
              {desfecho.bonus && desfecho.bonus > 0
                ? `Bônus das cinco estrelas: +${desfecho.bonus} 🌱`
                : "Dia completo ⭐"}
            </T>
            <T tipo="apagado" centro>
              Cada dia de cinco estrelas vira um troféu 🏆
            </T>
          </View>
        ) : null}
        <Botao rotulo="Voltar para a jornada" aoTocar={voltarParaJornada} corFundo={corJornada.roxo} />
      </View>
      {mostrarConfete ? <Confete /> : null}
    </View>
  );
}
