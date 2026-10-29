import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ofertaveis, type SomKey } from "@/lib/som-receitas";
import { ROTULO_DO_SOM_NO_APP } from "~/lib/jornada/sons";
import { toque } from "~/componentes/base";
import { EscolhaComLegenda, type PaletaDaAtividade } from "~/componentes/jornada/atividade";
import { cor, espaco, fonte } from "~/tema";

export type SomEscolhido = SomKey | "silencio";

/**
 * A FOLHA DE SONS DENTRO DA ATIVIDADE — o mesmo sheet da Meditação e do
 * Momento com o bebê no site: troca o som NA HORA, sem sair do exercício, e
 * "desligar" fica no fim da lista, separado, para não parecer mais uma faixa.
 * A legenda de cada som não é enfeite: "Drone grave" e "Pad calmo" são a mesma
 * coisa para quem nunca ouviu os dois.
 */
export function FolhaDeSons({
  aberta,
  som,
  cuidado,
  paleta,
  veu,
  tinta,
  aoFechar,
  aoEscolher,
}: {
  aberta: boolean;
  som: SomEscolhido;
  cuidado: boolean;
  paleta: PaletaDaAtividade;
  /** O véu atrás da folha (`bg-*-900/30`). */
  veu: string;
  /** O título e o "Desligar som" (`text-*-500`/`*-600`). */
  tinta: string;
  aoFechar: () => void;
  aoEscolher: (k: SomEscolhido) => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={aberta} transparent animationType="slide" onRequestClose={aoFechar}>
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Fechar"
          onPress={aoFechar}
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            backgroundColor: veu,
          }}
        />
        <View
          accessibilityViewIsModal
          style={{
            maxHeight: "82%",
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            backgroundColor: cor.branco,
            paddingTop: 20,
          }}
        >
          <Text
            style={{
              textAlign: "center",
              fontFamily: fonte.forte,
              fontSize: 13,
              letterSpacing: 0.65,
              textTransform: "uppercase",
              color: tinta,
            }}
          >
            Som de fundo
          </Text>
          <ScrollView
            contentContainerStyle={{
              paddingHorizontal: espaco.xl,
              paddingTop: espaco.lg,
              paddingBottom: Math.max(insets.bottom, espaco.lg) + espaco.lg,
              gap: espaco.sm,
            }}
          >
            {ofertaveis(cuidado).map((k) => (
              <EscolhaComLegenda
                key={k}
                paleta={paleta}
                titulo={ROTULO_DO_SOM_NO_APP[k].label}
                legenda={ROTULO_DO_SOM_NO_APP[k].sub}
                ativa={som === k}
                aoTocar={() => aoEscolher(k)}
                antes={<Text style={{ fontSize: 20 }}>{ROTULO_DO_SOM_NO_APP[k].emoji}</Text>}
              />
            ))}
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                toque();
                aoEscolher("silencio");
              }}
              style={({ pressed }) => ({
                marginTop: espaco.sm,
                minHeight: 48,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: paleta.borda,
                backgroundColor: paleta.vidro,
                alignItems: "center",
                justifyContent: "center",
                opacity: pressed ? 0.75 : 1,
              })}
            >
              <Text style={{ fontFamily: fonte.forte, fontSize: 14, color: tinta }}>
                🔇 Desligar som
              </Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
