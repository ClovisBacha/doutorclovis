import Check from "lucide-react-native/icons/check";
import ChevronRight from "lucide-react-native/icons/chevron-right";
import { type ComponentType, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { toque } from "~/componentes/base";
import { Estrelas } from "~/componentes/jornada/pecas";
import { canto, cor, curva, escala, espaco, fonte, luz, sombra } from "~/tema";

type Icone = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

export type ItemDoDia = {
  chave: string;
  titulo: string;
  sub: string;
  Icone: Icone;
  feito: boolean;
  aoTocar: () => void;
  /** O desafio é marcado por toque: o rótulo pede mais linhas. */
  linhasDoSub?: number;
  rotuloDoFeito?: string;
  /** Feito na vida real e marcado aqui com um toque (o desafio): mostra um
   *  círculo para marcar em vez da seta de "abrir". */
  marcaPorToque?: boolean;
};

const FIO = StyleSheet.hairlineWidth;

/**
 * O cartão do dia de quem ainda não tem a semana da gestação (o luto tem a
 * tela dele, `TelaDoCuidado`). Era um cabeçalho violeta de jogo, em degradê,
 * com a pílula "HOJE" e a data a 3,6:1 sobre o roxo: agora é o MATERIAL do app
 * (branco com a luz do fundo, o fio e a sombra), a data em sobrelinha e uma
 * lista só, com o ícone na névoa e o feito sem verde.
 */
export function CartaoDoDia({
  sobre,
  titulo,
  linha,
  feitos,
  total,
  itens,
  rodape,
  mostrarEstrelas = false,
}: {
  sobre: string;
  titulo: string;
  linha?: string | null;
  feitos: number;
  total: number;
  itens: ItemDoDia[];
  rodape?: ReactNode;
  mostrarEstrelas?: boolean;
}) {
  return (
    <View
      style={[
        {
          borderRadius: canto.cartao,
          ...curva,
          backgroundColor: luz.cartao,
          borderWidth: FIO,
          borderColor: "rgba(255,255,255,0.9)",
          overflow: "hidden",
        },
        sombra,
      ]}
    >
      <View style={{ paddingHorizontal: espaco.lg, paddingTop: espaco.lg, gap: 2 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: espaco.sm }}>
          <Text
            style={{
              flex: 1,
              ...fonte.forte,
              ...escala.nota,
              letterSpacing: 1,
              textTransform: "uppercase",
              color: cor.textoApagado,
            }}
          >
            {sobre}
          </Text>
          {mostrarEstrelas ? <Estrelas feitos={feitos} total={total} tamanho={17} /> : null}
        </View>
        <Text
          accessibilityRole="header"
          style={{ ...fonte.display, ...escala.titulo2, letterSpacing: -0.2, color: cor.texto }}
        >
          {titulo}
        </Text>
        {linha ? (
          <Text style={{ ...fonte.normal, ...escala.legenda, color: cor.textoApagado }}>
            {linha}
          </Text>
        ) : null}
      </View>
      <View style={{ paddingVertical: espaco.xs }}>
        {itens.map((it, i) => (
          <LinhaDoMomento key={it.chave} item={it} primeiro={i === 0} />
        ))}
      </View>
      {rodape ? (
        <View
          style={{
            borderTopWidth: FIO,
            borderTopColor: cor.borda,
            paddingHorizontal: espaco.lg,
            paddingVertical: espaco.md,
            backgroundColor: cor.apagado,
          }}
        >
          {rodape}
        </View>
      ) : null}
    </View>
  );
}

function LinhaDoMomento({ item, primeiro }: { item: ItemDoDia; primeiro: boolean }) {
  const { Icone } = item;
  return (
    <View>
      {primeiro ? null : (
        <View style={{ height: FIO, marginLeft: 72, backgroundColor: cor.borda }} />
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${item.titulo}. ${item.sub}`}
        accessibilityState={{ checked: item.feito }}
        accessibilityHint={
          item.feito ? "Já feito hoje" : item.marcaPorToque ? "Toque quando tiver feito" : undefined
        }
        onPress={() => {
          toque();
          item.aoTocar();
        }}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: espaco.md,
          paddingLeft: espaco.lg,
          paddingRight: 14,
          paddingVertical: 10,
          minHeight: 64,
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: cor.apagado,
          }}
        >
          <Icone size={22} color={cor.texto} strokeWidth={2} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ ...fonte.forte, ...escala.chamada, color: cor.texto }}>{item.titulo}</Text>
          <Text
            numberOfLines={item.linhasDoSub ?? 1}
            style={{ ...fonte.normal, ...escala.legenda, color: cor.textoApagado }}
          >
            {item.sub}
          </Text>
        </View>
        {item.feito ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Check size={16} color={cor.textoApagado} strokeWidth={2.6} />
            <Text style={{ ...fonte.forte, ...escala.nota, color: cor.textoApagado }}>
              {item.rotuloDoFeito ?? "Feito"}
            </Text>
          </View>
        ) : item.marcaPorToque ? (
          <View
            style={{
              width: 26,
              height: 26,
              borderRadius: 13,
              borderWidth: 2,
              borderColor: cor.chevron,
            }}
          />
        ) : (
          <ChevronRight size={20} color={cor.chevron} strokeWidth={2.4} />
        )}
      </Pressable>
    </View>
  );
}
