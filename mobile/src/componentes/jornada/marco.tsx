import { Modal, Text, View } from "react-native";
import { babyForWeek, fruitEmojiForWeek } from "@/lib/gestacao";
import { BotaoDaAtividade, Brilho } from "~/componentes/jornada/atividade";
import { corJornada } from "~/componentes/jornada/cores";
import { CompartilharConquista } from "~/componentes/jornada/cartao-de-conquista";
import { Confete } from "~/componentes/jornada/pecas";
import { cartaoDoMarco } from "~/lib/jornada/cartoes";
import type { Festa } from "~/lib/jornada/marcos";
import { cor, espaco, fonte } from "~/tema";

/**
 * "CHEGOU UM NOVO MARCO" — a festa da semana nova, do fim de um trimestre, do
 * nascimento e de cada mês do bebê (`~/lib/jornada/marcos`). O servidor paga
 * esses marcos sozinho; o app passava o crédito em silêncio, e o site abria
 * esta tela com o bebê da semana. Só abre sobre um crédito que o extrato
 * mostra — a soma dita aqui é a que entrou.
 */
export function FestaDoMarco({
  festa,
  nomeDoBebe,
  aoFechar,
}: {
  festa: Festa | null;
  nomeDoBebe: string | null;
  aoFechar: () => void;
}) {
  if (!festa) return null;
  const m = festa.principal;
  const bebe = nomeDoBebe ?? "O bebê";
  const semana = m.tipo === "semana" ? babyForWeek(m.semana) : null;
  const arte =
    m.tipo === "semana"
      ? fruitEmojiForWeek(m.semana)
      : m.tipo === "trimestre"
        ? "🎊"
        : m.tipo === "nascimento"
          ? "🍼"
          : "🎉";
  const titulo =
    m.tipo === "semana"
      ? `Semana ${m.semana}`
      : m.tipo === "trimestre"
        ? `Fim do ${m.trimestre}º trimestre!`
        : m.tipo === "nascimento"
          ? "Bem-vindo ao mundo!"
          : `${bebe} com ${m.meses} ${m.meses === 1 ? "mês" : "meses"}!`;
  const texto =
    m.tipo === "semana"
      ? `${semana!.desc} Tamanho de ${semana!.fruit.toLowerCase()} · ${semana!.size}.`
      : m.tipo === "trimestre"
        ? "Uma fase inteira cuidada, um dia de cada vez. A próxima já começou."
        : m.tipo === "nascimento"
          ? `${bebe} chegou. A jornada continua, agora com vocês dois.`
          : "Mais um mês juntos. Cada dia conta.";
  return (
    <Modal transparent animationType="fade" visible onRequestClose={aoFechar}>
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          padding: espaco.xl,
          backgroundColor: "rgba(30,16,60,0.45)",
        }}
      >
        <View
          accessibilityViewIsModal
          style={{
            width: "100%",
            maxWidth: 360,
            alignItems: "center",
            gap: espaco.md,
            borderRadius: 28,
            backgroundColor: cor.branco,
            paddingHorizontal: espaco.xl,
            paddingTop: espaco.xl,
            paddingBottom: espaco.lg,
          }}
        >
          <Text
            style={{
              fontFamily: fonte.forte,
              fontSize: 13,
              letterSpacing: 1,
              textTransform: "uppercase",
              color: corJornada.roxo,
            }}
          >
            Chegou um novo marco
          </Text>
          <View style={{ alignItems: "center", justifyContent: "center", height: 120 }}>
            <Brilho tamanho={170} tinta="#f5e8ff" />
            <Text style={{ fontSize: 72, lineHeight: 86 }}>{arte}</Text>
          </View>
          <Text
            accessibilityRole="header"
            style={{
              textAlign: "center",
              fontFamily: fonte.titulo,
              fontSize: 28,
              lineHeight: 34,
              letterSpacing: -0.3,
              color: cor.texto,
            }}
          >
            {titulo}
          </Text>
          <Text
            style={{
              textAlign: "center",
              fontFamily: fonte.normal,
              fontSize: 15,
              lineHeight: 22,
              color: cor.textoApagado,
            }}
          >
            {texto}
          </Text>
          <View
            style={{
              borderRadius: 999,
              backgroundColor: corJornada.sementinhaFundo,
              paddingHorizontal: espaco.lg,
              paddingVertical: espaco.sm,
            }}
          >
            <Text style={{ fontFamily: fonte.titulo, fontSize: 16, color: corJornada.sementinha }}>
              +{festa.sementinhas} sementinhas 🌱
            </Text>
          </View>
          <View style={{ alignSelf: "stretch", marginTop: espaco.sm, gap: espaco.sm }}>
            <BotaoDaAtividade cor={corJornada.roxo} rotulo="Que bom!" aoTocar={aoFechar} />
            <CompartilharConquista
              d={cartaoDoMarco(m, nomeDoBebe)}
              tinta={corJornada.roxo}
              fundoDoBotao={corJornada.roxoFundo}
            />
          </View>
        </View>
        <Confete pecas={48} />
      </View>
    </Modal>
  );
}
