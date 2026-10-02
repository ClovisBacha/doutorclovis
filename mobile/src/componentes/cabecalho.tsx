import { router, type Href } from "expo-router";
import { ChevronLeft, X } from "lucide-react-native";
import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { toque } from "~/componentes/base";
import { ALVO_MINIMO, cor, espaco, fonte, raio } from "~/tema";

/**
 * O TOPO DAS TELAS EMPILHADAS — um desenho só para o app inteiro.
 *
 * Antes havia seis: "‹ Voltar" em texto, seta redonda com borda, seta
 * redonda cheia, seta solta com título centrado, seta com título à esquerda e
 * um "✕" de texto. E nenhuma das 23 telas empilhadas (fora das abas) tinha o
 * SOS, embora o app prometa que ele "fica sempre aqui". Agora toda tela
 * empilhada tem a mesma seta e a mesma pílula do SOS, no mesmo lugar.
 */

/** Volta; aberta direto (sem histórico), cai na rota-mãe. */
export function voltarOu(rota: Href) {
  if (router.canGoBack()) router.back();
  else router.replace(rota);
}

export function BotaoVoltar({
  voltarPara = "/inicio",
  aoTocar,
  fechar = false,
}: {
  voltarPara?: Href;
  /** Ação própria (sair de uma atividade, por exemplo). */
  aoTocar?: () => void;
  /** Um X (sair da atividade) em vez da seta. */
  fechar?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={fechar ? "Sair" : "Voltar"}
      onPress={() => {
        toque();
        if (aoTocar) aoTocar();
        else voltarOu(voltarPara);
      }}
      hitSlop={6}
      style={({ pressed }) => ({
        width: ALVO_MINIMO,
        height: ALVO_MINIMO,
        borderRadius: raio.pilula,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: cor.cartao,
        borderWidth: 1,
        borderColor: cor.borda,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      {fechar ? <X size={22} color={cor.texto} /> : <ChevronLeft size={24} color={cor.texto} />}
    </Pressable>
  );
}

/** O SOS das telas sem a barra de baixo: pequeno, vermelho, sempre à direita. */
export function PilulaSos() {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="SOS — emergência"
      accessibilityHint="Abre a tela de emergência: ligar 192 e avisar quem você cadastrou"
      onPress={() => {
        toque(false);
        router.push("/sos");
      }}
      hitSlop={6}
      style={({ pressed }) => ({
        minHeight: ALVO_MINIMO,
        minWidth: ALVO_MINIMO + 8,
        paddingHorizontal: espaco.sm,
        borderRadius: raio.pilula,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: pressed ? cor.urgentePressionado : cor.urgente,
      })}
    >
      <Text
        style={{ fontFamily: fonte.titulo, fontSize: 14, color: cor.branco, letterSpacing: 0.5 }}
      >
        SOS
      </Text>
    </Pressable>
  );
}

/** A barra completa: voltar, título (e subtítulo), uma ação e o SOS. */
export function CabecalhoDaPilha({
  titulo,
  subtitulo,
  voltarPara,
  direita,
  sos = true,
}: {
  titulo: string;
  subtitulo?: string;
  voltarPara?: Href;
  direita?: ReactNode;
  /** Só a própria tela do SOS dispensa a pílula. */
  sos?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: espaco.sm,
        minHeight: ALVO_MINIMO + 4,
      }}
    >
      <BotaoVoltar voltarPara={voltarPara} />
      <View style={{ flex: 1 }}>
        <Text
          accessibilityRole="header"
          numberOfLines={1}
          style={{ fontFamily: fonte.titulo, fontSize: 18, color: cor.texto }}
        >
          {titulo}
        </Text>
        {subtitulo ? (
          <Text
            numberOfLines={1}
            style={{ fontFamily: fonte.media, fontSize: 13, color: cor.textoApagado }}
          >
            {subtitulo}
          </Text>
        ) : null}
      </View>
      {direita}
      {sos ? <PilulaSos /> : null}
    </View>
  );
}
