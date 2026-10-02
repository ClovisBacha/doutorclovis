import type { AssuntoDaFoto } from "@/lib/foto-da-nutricao";
import { Camera, ImagePlus } from "lucide-react-native";
import { Modal, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Botao, T } from "~/componentes/base";
import { cor, espaco, raio } from "~/tema";

/** Câmera ou galeria — com o aviso de que a foto não fica guardada. */
export function FolhaDaFoto({
  assunto,
  aoEscolher,
  aoFechar,
}: {
  assunto: AssuntoDaFoto | null;
  aoEscolher: (origem: "camera" | "galeria") => void;
  aoFechar: () => void;
}) {
  const baixo = useSafeAreaInsets().bottom;
  return (
    <Modal visible={assunto !== null} transparent animationType="fade" onRequestClose={aoFechar}>
      <Pressable
        accessibilityLabel="Fechar"
        onPress={aoFechar}
        style={{ flex: 1, backgroundColor: "rgba(41,20,19,0.35)", justifyContent: "flex-end" }}
      >
        <Pressable
          onPress={() => {}}
          style={{
            backgroundColor: cor.fundo,
            borderTopLeftRadius: raio.lg,
            borderTopRightRadius: raio.lg,
            padding: espaco.xl,
            paddingBottom: Math.max(baixo, espaco.xl),
            gap: espaco.md,
          }}
        >
          <T tipo="subtitulo">{assunto === "rotulo" ? "Foto do rótulo" : "Foto do prato"}</T>
          <T tipo="apagado">
            {assunto === "rotulo"
              ? "Enquadre a tabela nutricional e a lista de ingredientes, com boa luz."
              : "Enquadre só a comida, de cima, com boa luz."}{" "}
            A foto vai para a leitura da IA e não fica guardada.
          </T>
          <View style={{ gap: espaco.sm }}>
            <Botao
              rotulo="Tirar foto agora"
              corFundo={cor.nutricao}
              icone={<Camera size={20} color={cor.branco} />}
              aoTocar={() => aoEscolher("camera")}
            />
            <Botao
              rotulo="Escolher da galeria"
              tipo="secundario"
              icone={<ImagePlus size={20} color={cor.primariaEscura} />}
              aoTocar={() => aoEscolher("galeria")}
            />
            <Botao rotulo="Cancelar" tipo="texto" aoTocar={aoFechar} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
