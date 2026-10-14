import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAviso } from "~/componentes/aviso";
import { toque } from "~/componentes/base";
import { CabecalhoDaPilha } from "~/componentes/cabecalho";
import {
  lerCarteiraDoDia,
  lerConquistas,
  resgatar as resgatarNoServidor,
  type CarteiraOk,
  type LeituraDasConquistas,
} from "~/componentes/jornada/economia";
import { AbaDasConquistas } from "~/componentes/recompensas/conquistas";
import { corRecompensas } from "~/componentes/recompensas/cores";
import { montarGrade, paraResgatar } from "~/lib/jornada/conquistas";
import { useSessao } from "~/lib/sessao";
import { cor, espaco, fonte } from "~/tema";

type Aba = "cantinho" | "conquistas";

/**
 * AS RECOMPENSAS — o `RecompensasHub` do site: duas abas, "Meu Cantinho" (a
 * lojinha de sementinhas: enfeites, peles das bolinhas, céus e cenários para o
 * Caminho) e "Conquistas" (os badges, com o número dos que esperam o toque
 * dela ao lado do nome). Abre no Cantinho, como no site; `?aba=conquistas`
 * abre direto nas conquistas.
 *
 * A tela é dona das duas leituras (carteira e conquistas) para as abas
 * concordarem: resgatar uma conquista sobe o saldo que o Cantinho mostra.
 */
export default function Recompensas() {
  const { aba: pedida } = useLocalSearchParams<{ aba?: string }>();
  /* ⚠️ Enquanto o Meu Cantinho não chega ao app, a tela abre (e fica) nas
     Conquistas — sem pílula para uma aba que ainda não existe. */
  const CANTINHO_PRONTO = false;
  const [aba, setAba] = useState<Aba>(
    CANTINHO_PRONTO && pedida !== "conquistas" ? "cantinho" : "conquistas",
  );
  const { cuidado } = useSessao();
  const { avisar, aviso } = useAviso();

  const [carteira, setCarteira] = useState<CarteiraOk | null | "carregando">("carregando");
  const [conquistas, setConquistas] = useState<LeituraDasConquistas | null | "carregando">(
    "carregando",
  );
  const recarregar = useCallback(() => {
    setConquistas((c) => (c && c !== "carregando" ? c : "carregando"));
    void lerCarteiraDoDia().then(setCarteira);
    void lerConquistas().then(setConquistas);
  }, []);
  useFocusEffect(
    useCallback(() => {
      recarregar();
    }, [recarregar]),
  );

  const saldo =
    carteira && carteira !== "carregando" && !carteira.careMode ? carteira.balance : null;
  const aResgatar = useMemo(() => {
    if (!conquistas || conquistas === "carregando" || conquistas.careMode || cuidado) return null;
    if (conquistas.resgatadas === null) return null;
    const n = paraResgatar(montarGrade(conquistas.unlocked, conquistas.resgatadas));
    return n > 0 ? n : null;
  }, [conquistas, cuidado]);

  async function resgatar(key: string) {
    const r = await resgatarNoServidor(key);
    if (r && conquistas && conquistas !== "carregando") {
      setConquistas({ ...conquistas, resgatadas: [...(conquistas.resgatadas ?? []), key] });
      if (r.granted > 0 && carteira && carteira !== "carregando")
        setCarteira({ ...carteira, balance: carteira.balance + r.granted });
    }
    return r;
  }

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: cor.fundo }}>
      <View style={{ paddingHorizontal: espaco.lg, paddingTop: espaco.sm, gap: espaco.md }}>
        <CabecalhoDaPilha titulo="Recompensas" voltarPara="/jornada" />
        <View style={{ flexDirection: "row", gap: espaco.sm }} accessibilityRole="tablist">
          {CANTINHO_PRONTO ? (
            <Pilula
              rotulo="Meu Cantinho"
              ativa={aba === "cantinho"}
              aoTocar={() => setAba("cantinho")}
            />
          ) : null}
          <Pilula
            rotulo="Conquistas"
            ativa={aba === "conquistas"}
            aoTocar={() => setAba("conquistas")}
            selo={aResgatar}
          />
        </View>
      </View>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 64 }}
        showsVerticalScrollIndicator={false}
      >
        <AbaDasConquistas
          leitura={conquistas}
          saldo={saldo}
          cuidado={cuidado}
          resgatar={resgatar}
          recarregar={recarregar}
          aoIrAoCantinho={() => (CANTINHO_PRONTO ? setAba("cantinho") : undefined)}
          avisar={avisar}
        />
      </ScrollView>
      {aviso}
    </SafeAreaView>
  );
}

function Pilula({
  rotulo,
  ativa,
  aoTocar,
  selo,
}: {
  rotulo: string;
  ativa: boolean;
  aoTocar: () => void;
  selo?: number | null;
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: ativa }}
      accessibilityLabel={selo ? `${rotulo}, ${selo} para resgatar` : rotulo}
      onPress={() => {
        toque();
        aoTocar();
      }}
      style={({ pressed }) => ({
        minHeight: 44,
        flexDirection: "row",
        alignItems: "center",
        borderRadius: 999,
        paddingHorizontal: espaco.lg,
        backgroundColor: ativa ? cor.primaria : "transparent",
        borderWidth: ativa ? 0 : 1,
        borderColor: cor.borda,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Text
        style={{
          fontFamily: fonte.media,
          fontSize: 14,
          color: ativa ? cor.branco : cor.textoApagado,
        }}
      >
        {rotulo}
      </Text>
      {selo ? (
        <View
          style={{
            marginLeft: 6,
            minWidth: 19,
            borderRadius: 999,
            paddingHorizontal: 4,
            paddingVertical: 2,
            alignItems: "center",
            backgroundColor: corRecompensas.esmeralda700,
          }}
        >
          <Text
            style={{ fontFamily: fonte.titulo, fontSize: 13, lineHeight: 15, color: cor.branco }}
          >
            {selo > 9 ? "9+" : selo}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}
