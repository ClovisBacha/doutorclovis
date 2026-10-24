import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAviso } from "~/componentes/aviso";
import { toque } from "~/componentes/base";
import { CabecalhoDaPilha, voltarOu } from "~/componentes/cabecalho";
import { rota } from "~/componentes/jornada/bancada";
import {
  lerCarteiraDoDia,
  lerConquistas,
  resgatar as resgatarNoServidor,
  type LeituraDasConquistas,
} from "~/componentes/jornada/economia";
import { AbaDoCantinho } from "~/componentes/recompensas/cantinho";
import { AbaDasConquistas } from "~/componentes/recompensas/conquistas";
import { corRecompensas } from "~/componentes/recompensas/cores";
import { montarGrade, paraResgatar } from "~/lib/jornada/conquistas";
import { useSessao } from "~/lib/sessao";
import { cor, espaco, fonte } from "~/tema";

type Aba = "cantinho" | "conquistas";

/**
 * AS RECOMPENSAS — o `RecompensasHub` do site: duas abas, "Meu Cantinho" (a
 * lojinha de sementinhas: enfeites, peles das bolinhas e cenários para o
 * Caminho) e "Conquistas" (os badges, com o número dos que esperam o toque
 * dela ao lado do nome). Abre no Cantinho, como no site; `?aba=conquistas`
 * abre direto nas conquistas.
 *
 * ⚠️ O SALDO TEM UM DONO SÓ: esta tela. Resgatar uma conquista sobe o número
 * que o Cantinho mostra, e comprar no Cantinho desce o das Conquistas — duas
 * abas com dois saldos discordariam na frente dela.
 */
export default function Recompensas() {
  const { aba: pedida } = useLocalSearchParams<{ aba?: string }>();
  const [aba, setAba] = useState<Aba>(pedida === "conquistas" ? "conquistas" : "cantinho");
  const { cuidado } = useSessao();
  const { avisar, aviso } = useAviso();

  /* `null` = ainda não sei (ou não consegui ler): a tela mostra "—", nunca 0. */
  const [saldo, setSaldo] = useState<number | null>(null);
  const [conquistas, setConquistas] = useState<LeituraDasConquistas | null | "carregando">(
    "carregando",
  );
  const recarregar = useCallback(() => {
    setConquistas((c) => (c && c !== "carregando" ? c : "carregando"));
    /* A carteira credita o check-in do dia: é a leitura mais nova do saldo, e
       por isso ela vence a do Cantinho. */
    void lerCarteiraDoDia().then((c) => {
      if (c && !c.careMode) setSaldo(c.balance);
    });
    void lerConquistas().then(setConquistas);
  }, []);
  useFocusEffect(
    useCallback(() => {
      recarregar();
    }, [recarregar]),
  );
  /* A leitura do Cantinho só preenche o saldo que a carteira ainda não trouxe. */
  const aoLerSaldo = useCallback((n: number) => setSaldo((s) => s ?? n), []);

  const aResgatar = useMemo(() => {
    if (!conquistas || conquistas === "carregando" || conquistas.careMode || cuidado) return null;
    if (conquistas.resgatadas === null) return null;
    const n = paraResgatar(montarGrade(conquistas.unlocked, conquistas.resgatadas));
    return n > 0 ? n : null;
  }, [conquistas, cuidado]);

  async function resgatar(key: string) {
    const r = await resgatarNoServidor(key);
    if (r) {
      /* Sobre o estado MAIS NOVO, e não o do toque: duas conquistas
         resgatadas em seguida não podem desfazer a primeira. */
      setConquistas((c) =>
        c && c !== "carregando"
          ? { ...c, resgatadas: Array.from(new Set([...(c.resgatadas ?? []), key])) }
          : c,
      );
      if (r.granted > 0) setSaldo((s) => (s == null ? s : s + r.granted));
    }
    return r;
  }

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: cor.fundo }}>
      <View style={{ paddingHorizontal: espaco.lg, paddingTop: espaco.sm, gap: espaco.md }}>
        <CabecalhoDaPilha titulo="Recompensas" voltarPara="/jornada" />
        <View style={{ flexDirection: "row", gap: espaco.sm }} accessibilityRole="tablist">
          <Pilula
            rotulo="Meu Cantinho"
            ativa={aba === "cantinho"}
            aoTocar={() => setAba("cantinho")}
          />
          <Pilula
            rotulo="Conquistas"
            ativa={aba === "conquistas"}
            aoTocar={() => setAba("conquistas")}
            selo={aResgatar}
          />
        </View>
      </View>
      <ScrollView
        contentContainerStyle={{ padding: espaco.lg, paddingBottom: 64 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {aba === "cantinho" ? (
          <AbaDoCantinho
            saldo={saldo}
            cuidado={cuidado}
            aoLerSaldo={aoLerSaldo}
            aoMudarSaldo={setSaldo}
            aoVerCaminho={() => voltarOu(rota("/jornada") as never)}
            avisar={avisar}
          />
        ) : (
          <AbaDasConquistas
            leitura={conquistas}
            saldo={saldo}
            cuidado={cuidado}
            resgatar={resgatar}
            recarregar={recarregar}
            aoIrAoCantinho={() => setAba("cantinho")}
            avisar={avisar}
          />
        )}
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
