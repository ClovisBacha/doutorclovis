import { useRef, useState, type ReactNode } from "react";
import { Modal, Platform, Pressable, Share, Text, View } from "react-native";
import { BotaoDaAtividade } from "~/componentes/jornada/atividade";
import { cor, espaco, fonte } from "~/tema";

/**
 * A PRÉVIA PARA COMPARTILHAR — o cartão aparece numa folha, ela vê como ficou e
 * decide. A imagem sai da própria vista (`react-native-view-shot`, carregado só
 * no toque) e vai pela folha de compartilhar do iPhone (Instagram, WhatsApp,
 * Fotos…). Serve ao cartão da semana e ao cartão da chegada do bebê.
 */
export function FolhaDeCompartilhar({
  aberta,
  aoFechar,
  largura,
  corDoBotao = "#7a3fd1",
  children,
}: {
  aberta: boolean;
  aoFechar: () => void;
  /** A largura do cartão (os botões acompanham). */
  largura: number;
  corDoBotao?: string;
  /** O cartão — é ele que vira imagem. */
  children: ReactNode;
}) {
  const [enviando, setEnviando] = useState(false);
  const [falhou, setFalhou] = useState(false);
  const alvo = useRef<View>(null);

  async function compartilhar() {
    setFalhou(false);
    if (Platform.OS === "web") return;
    setEnviando(true);
    try {
      const { captureRef } = await import("react-native-view-shot");
      const uri = await captureRef(alvo, { format: "png", quality: 1, result: "tmpfile" });
      await Share.share({ url: uri });
    } catch {
      setFalhou(true);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal visible={aberta} transparent animationType="slide" onRequestClose={aoFechar}>
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          gap: espaco.lg,
          backgroundColor: "rgba(20,10,30,0.7)",
          padding: espaco.xl,
        }}
      >
        <View ref={alvo} collapsable={false}>
          {children}
        </View>
        <View style={{ width: largura, gap: espaco.sm }}>
          <BotaoDaAtividade
            cor={corDoBotao}
            rotulo={Platform.OS === "web" ? "Compartilhar (no iPhone)" : "Compartilhar"}
            carregando={enviando}
            aoTocar={() => void compartilhar()}
          />
          {falhou ? (
            <Text
              style={{
                textAlign: "center",
                fontFamily: fonte.media,
                fontSize: 13,
                color: cor.branco,
              }}
            >
              Não consegui montar a imagem agora. Tente de novo.
            </Text>
          ) : null}
          <Pressable
            accessibilityRole="button"
            onPress={aoFechar}
            style={{ minHeight: 44, alignItems: "center", justifyContent: "center" }}
          >
            <Text
              style={{ fontFamily: fonte.forte, fontSize: 15, color: "rgba(255,255,255,0.85)" }}
            >
              Fechar
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
