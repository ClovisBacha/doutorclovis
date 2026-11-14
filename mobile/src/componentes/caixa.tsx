import { Pressable, View } from "react-native";
import { T, toque } from "~/componentes/base";
import { ALVO_MINIMO, cor, espaco, fonte, raio } from "~/tema";

/**
 * A caixa de marcar dos aceites (o cadastro e a tela de aceite dos termos):
 * o alvo inteiro é a linha, com 44 pt, e o leitor de tela diz se está marcada.
 */
export function CaixaDeMarcar({
  marcada,
  aoTocar,
  rotulo,
  destaque = false,
}: {
  marcada: boolean;
  aoTocar: () => void;
  rotulo: string;
  /** O consentimento do dado de saúde vai DESTACADO (LGPD, art. 11, I). */
  destaque?: boolean;
}) {
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
        borderColor: destaque ? cor.primariaSuave : "transparent",
        backgroundColor: destaque ? cor.destaque : "transparent",
      }}
    >
      <View
        style={{
          width: 26,
          height: 26,
          borderRadius: raio.sm,
          borderWidth: 2,
          borderColor: marcada ? cor.primaria : cor.primariaSuave,
          backgroundColor: marcada ? cor.primaria : cor.cartao,
          alignItems: "center",
          justifyContent: "center",
          marginTop: 2,
        }}
      >
        {marcada ? (
          <T estilo={{ color: cor.branco, fontFamily: fonte.titulo, fontSize: 15, lineHeight: 18 }}>
            ✓
          </T>
        ) : null}
      </View>
      <T estilo={{ flex: 1, fontSize: 15, lineHeight: 22 }}>{rotulo}</T>
    </Pressable>
  );
}
