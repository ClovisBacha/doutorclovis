import { TITULO_DO_SOCORRO } from "@/lib/socorro-na-nutricao";
import { router } from "expo-router";
import { Phone, Siren } from "lucide-react-native";
import { Linking, View } from "react-native";
import { Botao, Cartao, T } from "~/componentes/base";
import { SAMU } from "~/config";
import { cor, espaco } from "~/tema";

/**
 * O cartão do socorro dentro da conversa. Aparece quando `pedeSocorro` acusa
 * — antes de qualquer rede, sem permissão de IA, sem Premium, também no Modo
 * Cuidado. A mensagem dela não saiu do aparelho.
 *
 * ⚠️ Não promete que alguém vai ler: dá o caminho (192 e o SOS do app, que
 * fala com o contato de emergência).
 */
export function CartaoDoSocorro({ texto }: { texto: string }) {
  return (
    <Cartao fundo={cor.urgenteFundo} estilo={{ borderWidth: 1, borderColor: "#fca5a5" }}>
      <T tipo="subtitulo" cor={cor.urgente}>
        {TITULO_DO_SOCORRO}
      </T>
      <T>{texto}</T>
      <View style={{ gap: espaco.sm, marginTop: espaco.xs }}>
        <Botao
          rotulo={`Ligar ${SAMU}`}
          tipo="perigo"
          icone={<Phone size={20} color={cor.branco} />}
          aoTocar={() => void Linking.openURL(`tel:${SAMU}`).catch(() => {})}
        />
        <Botao
          rotulo="Abrir o SOS do app"
          tipo="secundario"
          icone={<Siren size={20} color={cor.primariaEscura} />}
          aoTocar={() => router.push("/sos")}
        />
      </View>
    </Cartao>
  );
}
