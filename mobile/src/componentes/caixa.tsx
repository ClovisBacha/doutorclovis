import { Pressable, View } from "react-native";
import { T, toque } from "~/componentes/base";
import { ALVO_MINIMO, cor, espaco, fonte, raio, veu } from "~/tema";

/**
 * A caixa de marcar dos aceites (o cadastro e a tela de aceite dos termos):
 * o alvo inteiro é a linha, com 44 pt, e o leitor de tela diz se está marcada.
 */
export function CaixaDeMarcar({
  marcada,
  aoTocar,
  rotulo,
  destaque = false,
  noVeu = false,
}: {
  marcada: boolean;
  aoTocar: () => void;
  rotulo: string;
  /** O consentimento do dado de saúde vai DESTACADO (LGPD, art. 11, I). */
  destaque?: boolean;
  /** Sobre o véu escuro da entrada (17/11/2026): letra branca, caixa de vidro. */
  noVeu?: boolean;
}) {
  const borda = noVeu ? "rgba(255,196,218,0.55)" : cor.primariaSuave;
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: marcada }}
      accessibilityLabel={rotulo}
      onPress={() => {
        toque();
        aoTocar();
      }}
      style={{
        flexDirection: "row",
        gap: espaco.md,
        alignItems: "flex-start",
        minHeight: ALVO_MINIMO,
        paddingVertical: destaque ? espaco.sm : 4,
        paddingHorizontal: destaque ? espaco.md : 0,
        borderRadius: destaque ? raio.md : 0,
        borderWidth: destaque ? 1 : 0,
        borderColor: destaque ? borda : "transparent",
        backgroundColor: destaque
          ? noVeu
            ? "rgba(255,255,255,0.1)"
            : cor.destaque
          : "transparent",
      }}
    >
      <View
        style={{
          width: 26,
          height: 26,
          borderRadius: raio.sm,
          borderWidth: 2,
          borderColor: marcada ? cor.primaria : noVeu ? "rgba(255,255,255,0.7)" : cor.primariaSuave,
          backgroundColor: marcada ? cor.primaria : noVeu ? "rgba(255,255,255,0.08)" : cor.cartao,
          alignItems: "center",
          justifyContent: "center",
          marginTop: 2,
        }}
      >
        {marcada ? (
          <T estilo={{ color: cor.branco, ...fonte.titulo, fontSize: 15, lineHeight: 18 }}>✓</T>
        ) : null}
      </View>
      <T
        estilo={{ flex: 1, fontSize: 15, lineHeight: 22 }}
        cor={noVeu ? veu.textoNoVeu : undefined}
      >
        {rotulo}
      </T>
    </Pressable>
  );
}
