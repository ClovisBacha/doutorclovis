import { LinearGradient } from "expo-linear-gradient";
import Check from "lucide-react-native/icons/check";
import { useEffect, useRef } from "react";
import { Animated, Easing, Pressable, Text, View } from "react-native";
import { selecao } from "~/componentes/base";
import { useMolaDeToque, useMovimentoReduzido } from "~/componentes/movimento";
import { nomeDoPlano, porPeriodo, subDoCartao, type ProdutoDaLoja } from "~/lib/assinatura/precos";
import {
  brilhoDe,
  canto,
  cor,
  curva,
  escala,
  espaco,
  fonte,
  fonteDoNumero,
  ouro,
  veu,
} from "~/tema";

/**
 * O CARTÃO DE UM PLANO: material com luz e sombra, e não vidro. Apagado, é o
 * material escuro do véu (como as escolhas do ritual); escolhido, ele ACENDE
 * — branco, com o aro e o brilho na cor de agir, e um respiro de mola.
 *
 * O PREÇO COBRADO é o elemento mais forte do cartão (Apple 3.1.2): "R$ 99,90
 * por ano" à direita, grande; o "equivale a R$ 8,33 por mês" é a linha miúda.
 * Todo preço é o `displayPrice` do StoreKit.
 */

/** O branco do cartão aceso sobre o céu escuro (o `luz.cartao` fica cinza no escuro). */
const ACESO = "rgba(255,255,255,0.97)";

export function CartaoDoPlano({
  produto,
  marcado,
  faixa,
  aoEscolher,
}: {
  produto: ProdutoDaLoja;
  marcado: boolean;
  /** "ECONOMIZE 76%", só no anual e só com 10% ou mais. */
  faixa?: string | null;
  aoEscolher: () => void;
}) {
  const mola = useMolaDeToque(0.97);
  const reduzido = useMovimentoReduzido();
  const respiro = useRef(new Animated.Value(1)).current;
  const antes = useRef(marcado);
  useEffect(() => {
    const acendeu = marcado && !antes.current;
    antes.current = marcado;
    if (!acendeu || reduzido) return;
    respiro.setValue(0.97);
    Animated.spring(respiro, {
      toValue: 1,
      useNativeDriver: true,
      speed: 18,
      bounciness: 12,
    }).start();
  }, [marcado, reduzido, respiro]);

  const tinta = marcado ? cor.texto : cor.branco;
  const apoio = marcado ? cor.textoApagado : veu.textoNoVeu;
  const sub = subDoCartao(produto);
  const rotulo = [
    `Plano ${nomeDoPlano(produto.plano).toLowerCase()}`,
    `${produto.precoTexto} ${porPeriodo(produto.plano)}`,
    sub.replace("\n", ", "),
    faixa ? faixa.toLowerCase() : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={rotulo}
      accessibilityState={{ checked: marcado, selected: marcado }}
      onPressIn={mola.aoPressionar}
      onPressOut={mola.aoSoltar}
      onPress={() => {
        if (!marcado) selecao();
        aoEscolher();
      }}
      style={{ marginTop: faixa ? 14 : 0 }}
    >
      <Animated.View style={{ transform: [{ scale: Animated.multiply(mola.escala, respiro) }] }}>
        <View
          style={[
            {
              minHeight: 76,
              borderRadius: canto.cartao,
              ...curva,
              borderWidth: marcado ? 2 : 1,
              borderColor: marcado ? cor.primaria : veu.campoBorda,
              backgroundColor: marcado ? ACESO : veu.campo,
              flexDirection: "row",
              alignItems: "center",
              gap: espaco.md,
              paddingLeft: espaco.lg,
              paddingRight: espaco.lg,
              paddingTop: faixa ? espaco.lg + 2 : espaco.md + 2,
              paddingBottom: espaco.md + 2,
            },
            marcado
              ? {
                  boxShadow: `${brilhoDe(cor.primaria, 0.7).boxShadow}, 0px 20px 44px -20px rgba(10,6,40,0.6)`,
                }
              : null,
          ]}
        >
          <Radio marcado={marcado} />
          <View style={{ flex: 1, gap: 2 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: espaco.sm }}>
              <Text style={{ ...fonte.forte, ...escala.manchete, color: tinta, flex: 1 }}>
                {nomeDoPlano(produto.plano)}
              </Text>
              <Text
                style={{
                  ...fonteDoNumero,
                  ...escala.titulo3,
                  color: tinta,
                  fontVariant: ["tabular-nums"],
                }}
              >
                {produto.precoTexto}
              </Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: espaco.sm }}>
              <Text style={{ ...fonte.normal, ...escala.nota, color: apoio, flex: 1 }}>{sub}</Text>
              <Text style={{ ...fonte.media, ...escala.nota, color: apoio }}>
                {porPeriodo(produto.plano)}
              </Text>
            </View>
          </View>
        </View>
        {faixa ? <Faixa texto={faixa} /> : null}
      </Animated.View>
    </Pressable>
  );
}

/** O círculo da escolha: vazio no escuro; aceso, a framboesa com o visto. */
function Radio({ marcado }: { marcado: boolean }) {
  return (
    <View
      style={{
        width: 26,
        height: 26,
        borderRadius: canto.pilula,
        borderWidth: marcado ? 0 : 2,
        borderColor: "rgba(255,255,255,0.6)",
        backgroundColor: marcado ? cor.primaria : "transparent",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {marcado ? <Check size={15} color={cor.branco} strokeWidth={3} /> : null}
    </View>
  );
}

/** A faixa dourada que monta no alto do cartão do anual. */
function Faixa({ texto }: { texto: string }) {
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        top: -13,
        left: 0,
        right: 0,
        alignItems: "center",
      }}
    >
      <View
        style={{
          borderRadius: canto.pilula,
          ...curva,
          overflow: "hidden",
          paddingHorizontal: espaco.md + 2,
          paddingVertical: 5,
          boxShadow: "0px 6px 14px -6px rgba(140,90,0,0.7)",
        }}
      >
        <LinearGradient
          colors={[ouro.claro, ouro.medio]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        />
        <Text
          style={{
            ...fonteDoNumero,
            ...escala.nota,
            letterSpacing: 0.6,
            color: cor.texto,
          }}
        >
          {texto}
        </Text>
      </View>
    </View>
  );
}

/* ── O esqueleto ──────────────────────────────────────────────────────── */

/**
 * O ESQUELETO CALMO enquanto a App Store responde: três cartões apagados, com
 * as linhas no lugar do texto, respirando devagar (parados com "reduzir
 * movimento"). Nenhum número: o preço só aparece quando a Apple o diz.
 */
export function EsqueletoDosPlanos() {
  const reduzido = useMovimentoReduzido();
  const v = useRef(new Animated.Value(0.55)).current;
  useEffect(() => {
    if (reduzido) return;
    const laco = Animated.loop(
      Animated.sequence([
        Animated.timing(v, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(v, {
          toValue: 0.55,
          duration: 900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    laco.start();
    return () => laco.stop();
  }, [reduzido, v]);
  return (
    <Animated.View
      accessible
      accessibilityLabel="Carregando os planos"
      style={{ gap: espaco.md, opacity: v }}
    >
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          style={{
            minHeight: 76,
            borderRadius: canto.cartao,
            ...curva,
            borderWidth: 1,
            borderColor: veu.campoBorda,
            backgroundColor: veu.campo,
            flexDirection: "row",
            alignItems: "center",
            gap: espaco.md,
            paddingHorizontal: espaco.lg,
          }}
        >
          <View
            style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: veu.campoBorda }}
          />
          <View style={{ flex: 1, gap: 8 }}>
            <View
              style={{ width: "38%", height: 12, borderRadius: 6, backgroundColor: veu.campoBorda }}
            />
            <View
              style={{ width: "62%", height: 9, borderRadius: 5, backgroundColor: veu.campo }}
            />
          </View>
          <View
            style={{ width: 64, height: 14, borderRadius: 7, backgroundColor: veu.campoBorda }}
          />
        </View>
      ))}
    </Animated.View>
  );
}
