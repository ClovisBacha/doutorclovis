import { Image } from "expo-image";
import { useRef, useState } from "react";
import {
  Animated,
  FlatList,
  Pressable,
  Text,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { fonteDaImagem } from "~/componentes/comunidade/imagem";
import { cor, fonte } from "~/tema";

/** Proporção das fotos do feed (4:5, retrato). */
export const PROPORCAO_DA_FOTO = 5 / 4;
const JANELA_DO_TOQUE_DUPLO = 300;

/**
 * O CARROSSEL DE FOTOS: FlatList horizontal paginada, pontinhos embaixo,
 * contador "2/3" no canto, e o TOQUE DUPLO que dá ❤️ com o coração estourando.
 *
 * ⚠️ O toque duplo SÓ DÁ, nunca tira (quem decide é `reacaoDoToqueDuplo`); o
 * coração estoura sempre, porque o gesto foi entendido mesmo quando já era ❤️.
 */
export function Carrossel({
  urls,
  altTexto,
  autorNome,
  aoToqueDuplo,
}: {
  urls: string[];
  altTexto?: string | null;
  autorNome: string;
  aoToqueDuplo: () => void;
}) {
  const [largura, setLargura] = useState(0);
  const [indice, setIndice] = useState(0);
  const ultimoToque = useRef(0);
  const escala = useRef(new Animated.Value(0)).current;
  const opacidade = useRef(new Animated.Value(0)).current;

  const estourar = () => {
    escala.setValue(0.3);
    opacidade.setValue(1);
    Animated.sequence([
      Animated.spring(escala, { toValue: 1.15, friction: 4, tension: 160, useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(escala, { toValue: 1.4, duration: 260, delay: 200, useNativeDriver: true }),
        Animated.timing(opacidade, { toValue: 0, duration: 260, delay: 200, useNativeDriver: true }),
      ]),
    ]).start();
  };

  const aoTocar = () => {
    const agora = Date.now();
    if (agora - ultimoToque.current < JANELA_DO_TOQUE_DUPLO) {
      ultimoToque.current = 0;
      estourar();
      aoToqueDuplo();
    } else {
      ultimoToque.current = agora;
    }
  };

  const aoRolar = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!largura) return;
    const i = Math.round(e.nativeEvent.contentOffset.x / largura);
    if (i !== indice) setIndice(Math.max(0, Math.min(urls.length - 1, i)));
  };

  const altura = largura * PROPORCAO_DA_FOTO;
  const descricao = altTexto?.trim() || `Foto de ${autorNome}`;

  return (
    <View onLayout={(e: LayoutChangeEvent) => setLargura(e.nativeEvent.layout.width)}>
      <View style={{ width: "100%", height: altura || undefined, aspectRatio: altura ? undefined : 4 / 5, backgroundColor: cor.apagado }}>
        {largura > 0 ? (
          <FlatList
            data={urls}
            keyExtractor={(u, i) => `${i}-${u.slice(-24)}`}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={aoRolar}
            scrollEventThrottle={16}
            scrollEnabled={urls.length > 1}
            renderItem={({ item, index }) => (
              <Pressable
                onPress={aoTocar}
                accessibilityRole="image"
                accessibilityLabel={
                  urls.length > 1 ? `${descricao}. Foto ${index + 1} de ${urls.length}` : descricao
                }
                accessibilityHint="Toque duas vezes para dar amei"
              >
                <Image
                  source={fonteDaImagem(item)}
                  style={{ width: largura, height: altura }}
                  contentFit="cover"
                  transition={200}
                  recyclingKey={item}
                />
              </Pressable>
            )}
          />
        ) : null}
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            alignItems: "center",
            justifyContent: "center",
            opacity: opacidade,
            transform: [{ scale: escala }],
          }}
        >
          <Text style={{ fontSize: 96, textShadowColor: "rgba(0,0,0,0.25)", textShadowRadius: 12 }}>
            ❤️
          </Text>
        </Animated.View>
        {urls.length > 1 ? (
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: 12,
              right: 12,
              backgroundColor: "rgba(41,20,19,0.62)",
              borderRadius: 999,
              paddingHorizontal: 10,
              paddingVertical: 3,
            }}
          >
            <Text style={{ fontFamily: fonte.forte, fontSize: 13, color: cor.branco }}>
              {indice + 1}/{urls.length}
            </Text>
          </View>
        ) : null}
      </View>
      {urls.length > 1 ? (
        <View
          accessible={false}
          style={{ flexDirection: "row", justifyContent: "center", gap: 5, paddingTop: 10 }}
        >
          {urls.map((u, i) => (
            <View
              key={`${i}-${u.slice(-12)}`}
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: i === indice ? cor.primaria : cor.borda,
              }}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}
