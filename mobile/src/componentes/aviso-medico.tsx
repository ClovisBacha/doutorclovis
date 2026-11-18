import { ShieldCheck } from "lucide-react-native";
import { Text, View } from "react-native";
import { AVISO_MEDICO } from "~/lib/aviso-medico";
import { cor, escala, espaco, fonte } from "~/tema";

/**
 * O aviso médico, nas duas medidas: a NOTA do pé do Perfil (o título e o texto
 * completo, centrados, sem cartão: é aviso, e não um item da lista) e a LINHA
 * miúda no pé das telas de conteúdo (Bebê, Aula). O texto é o de
 * `~/lib/aviso-medico`, e não muda aqui.
 */
export function AvisoMedico({ curto = false }: { curto?: boolean }) {
  if (curto) {
    return (
      <Text
        style={{
          ...fonte.normal,
          ...escala.nota,
          color: cor.textoApagado,
          textAlign: "center",
          paddingHorizontal: espaco.sm,
        }}
      >
        {AVISO_MEDICO.curto}
      </Text>
    );
  }
  return (
    <View
      accessible
      accessibilityLabel={`${AVISO_MEDICO.titulo}. ${AVISO_MEDICO.completo}`}
      style={{ alignItems: "center", gap: espaco.xs, paddingHorizontal: espaco.lg }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <ShieldCheck size={15} strokeWidth={2.2} color={cor.textoApagado} />
        <Text style={{ ...fonte.forte, ...escala.nota, color: cor.textoApagado }}>
          {AVISO_MEDICO.titulo}
        </Text>
      </View>
      <Text style={{ ...fonte.normal, ...escala.nota, color: cor.textoApagado, textAlign: "center" }}>
        {AVISO_MEDICO.completo}
      </Text>
    </View>
  );
}
