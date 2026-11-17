import { View } from "react-native";
import { T } from "~/componentes/base";
import { sombraDoTexto } from "~/componentes/ceu-vivo";
import { useCeuDaEntrada } from "~/componentes/entrada";
import { BolhaViva } from "~/componentes/movimento";
import { espaco, fonte } from "~/tema";

/**
 * A marca no alto da entrada: a bolha viva solta no céu, grande, com a aura
 * que respira. `compacto` nas telas de formulário longo (cadastro, esqueci),
 * para o formulário caber sem rolar tanto.
 */
export function CabecalhoDaMarca({
  subtitulo,
  compacto = false,
}: {
  subtitulo?: string;
  compacto?: boolean;
}) {
  /* O céu da hora está atrás: o nome e a frase usam a tinta que se lê nele. */
  const ceu = useCeuDaEntrada();
  const bolha = compacto ? 104 : 168;
  return (
    <View
      style={{
        alignItems: "center",
        gap: espaco.sm,
        paddingTop: compacto ? espaco.sm : espaco.md,
      }}
    >
      {/* A bolha solta no céu, com a aura dela: sem aro nem disco atrás. */}
      <BolhaViva humor="feliz" tamanho={bolha} />
      <T
        tipo="titulo"
        centro
        cor={ceu.tinta}
        estilo={{
          fontSize: compacto ? 28 : 40,
          ...fonte.titulo,
          letterSpacing: -0.8,
          ...sombraDoTexto(ceu),
        }}
      >
        Mãe Esperta
      </T>
      {subtitulo ? (
        <T
          tipo="apagado"
          centro
          cor={ceu.sec}
          estilo={{ maxWidth: 330, fontSize: 16, lineHeight: 23, ...sombraDoTexto(ceu) }}
        >
          {subtitulo}
        </T>
      ) : null}
    </View>
  );
}
