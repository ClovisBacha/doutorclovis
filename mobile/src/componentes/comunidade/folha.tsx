import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Animated, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { T, toque } from "~/componentes/base";
import { ALVO_MINIMO, cor, espaco, fonte, raio } from "~/tema";

/**
 * A FOLHA que sobe de baixo — menus ⋯, denúncia, Regras, escolhas. Toque fora
 * fecha (menos quando `presa`, que é o caso das Regras: elas só saem pelo
 * "Concordo" ou pelo "Agora não").
 */
export function Folha({
  aberta,
  aoFechar,
  titulo,
  children,
  presa,
}: {
  aberta: boolean;
  aoFechar: () => void;
  titulo?: string;
  children: ReactNode;
  presa?: boolean;
}) {
  const baixo = useSafeAreaInsets().bottom;
  return (
    <Modal visible={aberta} transparent animationType="slide" onRequestClose={aoFechar}>
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Fechar"
          onPress={presa ? undefined : aoFechar}
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(41,20,19,0.45)" }}
        />
        <View
          accessibilityViewIsModal
          style={{
            backgroundColor: cor.fundo,
            borderTopLeftRadius: raio.lg,
            borderTopRightRadius: raio.lg,
            paddingTop: espaco.sm,
            paddingHorizontal: espaco.lg,
            paddingBottom: Math.max(baixo, espaco.lg),
            maxHeight: "88%",
          }}
        >
          <View
            style={{
              alignSelf: "center",
              width: 40,
              height: 5,
              borderRadius: 3,
              backgroundColor: cor.borda,
              marginBottom: espaco.md,
            }}
          />
          {titulo ? (
            <T tipo="subtitulo" estilo={{ marginBottom: espaco.sm }}>
              {titulo}
            </T>
          ) : null}
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: espaco.sm }}>
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export type Opcao = {
  rotulo: string;
  sub?: string;
  icone?: ReactNode;
  perigo?: boolean;
  aoTocar: () => void;
};

/** Uma linha de menu de folha, com 52 pt de alvo. */
export function LinhaDeOpcao({ opcao, aoEscolher }: { opcao: Opcao; aoEscolher?: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={opcao.rotulo}
      accessibilityHint={opcao.sub}
      onPress={() => {
        toque();
        aoEscolher?.();
        opcao.aoTocar();
      }}
      style={({ pressed }) => ({
        minHeight: ALVO_MINIMO + 8,
        flexDirection: "row",
        alignItems: "center",
        gap: espaco.md,
        paddingHorizontal: espaco.md,
        paddingVertical: espaco.sm,
        borderRadius: raio.md,
        backgroundColor: pressed ? cor.apagado : cor.cartao,
      })}
    >
      {opcao.icone}
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontFamily: fonte.forte,
            fontSize: 16,
            color: opcao.perigo ? cor.urgente : cor.texto,
          }}
        >
          {opcao.rotulo}
        </Text>
        {opcao.sub ? (
          <Text style={{ fontFamily: fonte.normal, fontSize: 13, color: cor.textoApagado, marginTop: 2 }}>
            {opcao.sub}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

export function FolhaDeOpcoes({
  aberta,
  aoFechar,
  titulo,
  opcoes,
}: {
  aberta: boolean;
  aoFechar: () => void;
  titulo?: string;
  opcoes: Opcao[];
}) {
  return (
    <Folha aberta={aberta} aoFechar={aoFechar} titulo={titulo}>
      {opcoes.map((o) => (
        <LinhaDeOpcao key={o.rotulo} opcao={o} aoEscolher={aoFechar} />
      ))}
      <LinhaDeOpcao opcao={{ rotulo: "Cancelar", aoTocar: () => {} }} aoEscolher={aoFechar} />
    </Folha>
  );
}

/**
 * O AVISO curto que aparece por cima e some sozinho ("Denúncia enviada",
 * "Não deu certo agora"). Um por vez.
 */
export function useAviso() {
  const [texto, setTexto] = useState<{ t: string; erro: boolean } | null>(null);
  const opacidade = useRef(new Animated.Value(0)).current;
  const relogio = useRef<ReturnType<typeof setTimeout> | null>(null);

  const mostrar = useCallback(
    (t: string, erro = false) => {
      if (relogio.current) clearTimeout(relogio.current);
      setTexto({ t, erro });
      Animated.timing(opacidade, { toValue: 1, duration: 160, useNativeDriver: true }).start();
      relogio.current = setTimeout(
        () => {
          Animated.timing(opacidade, { toValue: 0, duration: 220, useNativeDriver: true }).start(
            () => setTexto(null),
          );
        },
        erro ? 5000 : 2600,
      );
    },
    [opacidade],
  );

  useEffect(
    () => () => {
      if (relogio.current) clearTimeout(relogio.current);
    },
    [],
  );

  const elemento = texto ? (
    <Animated.View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      style={{
        position: "absolute",
        left: espaco.lg,
        right: espaco.lg,
        bottom: 96,
        opacity: opacidade,
        backgroundColor: texto.erro ? cor.textoDestaque : cor.texto,
        borderRadius: raio.md,
        paddingHorizontal: espaco.lg,
        paddingVertical: espaco.md,
      }}
    >
      <Text style={{ fontFamily: fonte.media, fontSize: 15, lineHeight: 21, color: cor.branco }}>
        {texto.t}
      </Text>
    </Animated.View>
  ) : null;

  return { mostrar, elemento };
}
