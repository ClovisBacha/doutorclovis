import { ShieldAlert } from "lucide-react-native";
import { View } from "react-native";
import { Cartao, T } from "~/componentes/base";
import { AVISO_MEDICO } from "~/lib/aviso-medico";
import { cor, espaco } from "~/tema";

/**
 * O aviso médico, nas duas medidas: o CARTÃO (Saúde, Perfil, Registros) e a
 * LINHA miúda no pé das telas de conteúdo (Início, Bebê, Aula). O texto é o de
 * `~/lib/aviso-medico`.
 */
export function AvisoMedico({ curto = false }: { curto?: boolean }) {
  if (curto) {
    return (
      <T
        tipo="apagado"
        centro
        estilo={{ fontSize: 13, lineHeight: 18, paddingHorizontal: espaco.sm }}
      >
        {AVISO_MEDICO.curto}
      </T>
    );
  }
  return (
    <Cartao fundo={cor.apagado} estilo={{ flexDirection: "row", gap: espaco.md }}>
      <ShieldAlert size={22} color={cor.textoApagado} />
      <View
        style={{ flex: 1, gap: 2 }}
        accessible
        accessibilityLabel={`${AVISO_MEDICO.titulo}. ${AVISO_MEDICO.completo}`}
      >
        <T tipo="rotulo">{AVISO_MEDICO.titulo}</T>
        <T tipo="apagado">{AVISO_MEDICO.completo}</T>
      </View>
    </Cartao>
  );
}
