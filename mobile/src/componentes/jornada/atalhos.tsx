import { ChevronRight } from "lucide-react-native";
import { Children, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { toque } from "~/componentes/base";
import { RAIO_DENTRO_DO_PAINEL } from "~/componentes/painel";
import { canto, cor, curva, escala, fonte, luz, sombra, vidro } from "~/tema";

/**
 * O GRUPO DE ATALHOS (18/11/2026, a vistoria: "rolando depois do cuidado de
 * hoje, o Amanhecer acaba — cinco cartões brancos soltos, cada um com o seu
 * sistema visual"). As portas da tela do bebê numa lista só, como os Ajustes
 * do iPhone: UM material (branco com um tico do céu, o fio de luz, a sombra
 * em camadas), linhas da mesma altura, a mesma ficha, a mesma seta, e uma
 * divisória fina recuada até o texto.
 *
 * Uma linha que não tem o que mostrar (as amigas antes de carregar) devolve
 * `null`, e a divisória dela não aparece: cada linha desenha a sua divisória
 * UM fio acima de si, e a primeira fica fora do recorte do grupo.
 */

const FIO = StyleSheet.hairlineWidth;

/** Do canto do grupo ao começo do texto de uma linha com ficha de 44. */
export const RECUO_DA_LINHA = 70;

export function GrupoDeAtalhos({
  children,
  recuo = RECUO_DA_LINHA,
  raio = RAIO_DENTRO_DO_PAINEL,
}: {
  children: ReactNode;
  recuo?: number;
  raio?: number;
}) {
  const linhas = Children.toArray(children);
  if (!linhas.length) return null;
  return (
    /* A sombra fica na casca de fora: o recorte da de dentro a cortaria. */
    <View style={{ borderRadius: raio, ...curva, ...sombra }}>
      <View
        style={{
          borderRadius: raio,
          ...curva,
          overflow: "hidden",
          backgroundColor: luz.cartao,
          borderWidth: FIO,
          borderColor: vidro.borda,
        }}
      >
        {linhas.map((linha, i) => (
          <View key={i}>
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                top: -FIO,
                left: recuo,
                right: 0,
                height: FIO,
                backgroundColor: cor.borda,
              }}
            />
            {linha}
          </View>
        ))}
      </View>
    </View>
  );
}

/** A ficha de uma linha: o ícone ou a arte num quadrado de canto contínuo. */
export function FichaDoAtalho({
  children,
  fundo,
  lado = 44,
}: {
  children: ReactNode;
  fundo: string;
  lado?: number;
}) {
  return (
    <View
      style={{
        width: lado,
        height: lado,
        borderRadius: lado >= 40 ? canto.campo : canto.icone,
        ...curva,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: fundo,
      }}
    >
      {children}
    </View>
  );
}

/**
 * Uma linha do grupo: a ficha, o título (16, firme), o sub (15, apagado) e a
 * seta. Ao pressionar, o fundo acende de leve, como uma linha dos Ajustes (a
 * mola, numa linha de largura inteira, encolheria a linha dentro do grupo).
 */
export function LinhaDoAtalho({
  ficha,
  titulo,
  sub,
  direita,
  rotulo,
  aoTocar,
  altura = 64,
}: {
  ficha: ReactNode;
  titulo: string;
  sub?: string | null;
  /** No lugar da seta (um contador, por exemplo). */
  direita?: ReactNode;
  rotulo?: string;
  aoTocar: () => void;
  altura?: number;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={rotulo ?? (sub ? `${titulo}. ${sub}` : titulo)}
      onPress={() => {
        toque();
        aoTocar();
      }}
      style={({ pressed }) => ({
        minHeight: altura,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingLeft: 14,
        paddingRight: 12,
        paddingVertical: 10,
        backgroundColor: pressed ? cor.apagado : "transparent",
      })}
    >
      {ficha}
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={{ ...fonte.forte, ...escala.chamada, color: cor.texto }}>
          {titulo}
        </Text>
        {sub ? (
          <Text
            numberOfLines={2}
            style={{ marginTop: 1, ...fonte.normal, ...escala.legenda, color: cor.textoApagado }}
          >
            {sub}
          </Text>
        ) : null}
      </View>
      {direita ?? <ChevronRight size={18} color={cor.chevron} strokeWidth={2.4} />}
    </Pressable>
  );
}
