import { LinearGradient } from "expo-linear-gradient";
import { Check, ChevronRight } from "lucide-react-native";
import { type ComponentType, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { toque } from "~/componentes/base";
import { corJornada } from "~/componentes/jornada/cores";
import { Estrelas } from "~/componentes/jornada/pecas";
import { ALVO_MINIMO, cor, espaco, fonte, raio, sombra } from "~/tema";

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

/** O cartão do dia: cabeçalho roxo + os momentos tocáveis + o rodapé. */
export function CartaoDoDia({
  sobre,
  titulo,
  linha,
  feitos,
  total,
  itens,
  rodape,
  mostrarEstrelas = true,
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
      style={[{ borderRadius: raio.lg, backgroundColor: cor.cartao, overflow: "hidden" }, sombra]}
    >
      <LinearGradient
        colors={[corJornada.roxoEscuro, corJornada.roxo, corJornada.roxoMedio]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ padding: espaco.lg, gap: 6 }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: espaco.sm }}>
          <View
            style={{
              backgroundColor: "rgba(255,255,255,0.22)",
              borderRadius: raio.pilula,
              paddingHorizontal: 10,
              paddingVertical: 3,
            }}
          >
            <Text
              style={{
                fontFamily: fonte.titulo,
                fontSize: 13,
                color: cor.branco,
                letterSpacing: 0.6,
              }}
            >
              HOJE
            </Text>
          </View>
          <Text style={{ flex: 1, fontFamily: fonte.forte, fontSize: 15, color: cor.jogoFundo }}>
            {sobre}
          </Text>
          {mostrarEstrelas ? <Estrelas feitos={feitos} total={total} tamanho={17} /> : null}
        </View>
        <Text
          style={{ fontFamily: fonte.titulo, fontSize: 24, color: cor.branco, letterSpacing: -0.3 }}
        >
          {titulo}
        </Text>
        {linha ? (
          <Text style={{ fontFamily: fonte.media, fontSize: 14, color: "#ddd6fe" }}>{linha}</Text>
        ) : null}
      </LinearGradient>
      <View style={{ paddingVertical: espaco.xs }}>
        {itens.map((it, i) => (
          <LinhaDoMomento key={it.chave} item={it} ultimo={i === itens.length - 1} />
        ))}
      </View>
      {rodape ? (
        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: cor.borda,
            paddingHorizontal: espaco.lg,
            paddingVertical: espaco.md,
            backgroundColor: corJornada.roxoNevoa,
          }}
        >
          {rodape}
        </View>
      ) : null}
    </View>
  );
}

function LinhaDoMomento({ item, ultimo }: { item: ItemDoDia; ultimo: boolean }) {
  const { Icone } = item;
  return (
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
        paddingHorizontal: espaco.lg,
        paddingVertical: espaco.md,
        minHeight: ALVO_MINIMO + 16,
        backgroundColor: pressed ? corJornada.roxoNevoa : "transparent",
        borderBottomWidth: ultimo ? 0 : 1,
        borderBottomColor: cor.divisor,
      })}
    >
      <View
        style={{
          width: 46,
          height: 46,
          borderRadius: 23,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: item.feito ? corJornada.feito : corJornada.roxoFundo,
        }}
      >
        {item.feito ? (
          <Check size={24} color={cor.branco} strokeWidth={3} />
        ) : (
          <Icone size={22} color={corJornada.roxo} strokeWidth={2.2} />
        )}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontFamily: fonte.forte, fontSize: 16, color: cor.texto }}>
          {item.titulo}
        </Text>
        <Text
          numberOfLines={item.linhasDoSub ?? 1}
          style={{
            fontFamily: fonte.normal,
            fontSize: 14,
            lineHeight: 19,
            color: cor.textoApagado,
          }}
        >
          {item.sub}
        </Text>
      </View>
      {item.feito ? (
        <Text style={{ fontFamily: fonte.forte, fontSize: 13, color: corJornada.feito }}>
          {item.rotuloDoFeito ?? "Feito"}
        </Text>
      ) : item.marcaPorToque ? (
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            borderWidth: 2.5,
            borderColor: corJornada.roxoClaro,
          }}
        />
      ) : (
        <ChevronRight size={22} color={corJornada.roxoClaro} />
      )}
    </Pressable>
  );
}
