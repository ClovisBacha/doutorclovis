import { View } from "react-native";
import { T } from "~/componentes/base";
import { Halo } from "~/componentes/jornada/efeitos";
import { BolhaViva, Flutuar } from "~/componentes/movimento";
import { cor, espaco, fonte, sombra } from "~/tema";

/**
 * A marca no alto da entrada: a bolha viva num aro branco, com um halo que
 * respira atrás, flutuando devagar. `compacto` nas telas de formulário longo
 * (cadastro, esqueci), para o formulário caber sem rolar tanto.
 */
export function CabecalhoDaMarca({
  subtitulo,
  compacto = false,
}: {
  subtitulo?: string;
  compacto?: boolean;
}) {
  const bolha = compacto ? 92 : 132;
  const aro = bolha + 16;
  return (
    <View
      style={{
        alignItems: "center",
        gap: espaco.sm,
        paddingTop: compacto ? espaco.md : espaco.xl,
      }}
    >
      <Flutuar amplitude={4} periodo={4200}>
        <View
          style={{
            width: aro + 24,
            height: aro + 24,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Halo cor={cor.branco} tamanho={aro} />
          <View
            style={{
              width: aro,
              height: aro,
              borderRadius: aro / 2,
              backgroundColor: cor.branco,
              alignItems: "center",
              justifyContent: "center",
              ...sombra,
              shadowOpacity: 0.14,
              shadowRadius: 18,
              shadowOffset: { width: 0, height: 8 },
            }}
          >
            <BolhaViva humor="feliz" tamanho={bolha} />
          </View>
        </View>
      </Flutuar>
      <T
        tipo="titulo"
        centro
        estilo={{ fontSize: compacto ? 26 : 34, fontFamily: fonte.titulo, letterSpacing: -0.6 }}
      >
        Obstétrica
      </T>
      {subtitulo ? (
        <T tipo="apagado" centro estilo={{ maxWidth: 330, fontSize: 15, lineHeight: 22 }}>
          {subtitulo}
        </T>
      ) : null}
    </View>
  );
}
