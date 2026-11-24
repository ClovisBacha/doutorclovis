import { router, useFocusEffect } from "expo-router";
import ChevronRight from "lucide-react-native/icons/chevron-right";
import { useCallback, useRef, useState } from "react";
import { Animated, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAviso } from "~/componentes/aviso";
import { toque, useFimDaRolagem } from "~/componentes/base";
import { CabecalhoDaPilha } from "~/componentes/cabecalho";
import {
  lerCarteiraDoDia,
  lerConquistas,
  resgatar as resgatarNoServidor,
  type LeituraDasConquistas,
} from "~/componentes/jornada/economia";
import { Confete } from "~/componentes/jornada/pecas";
import { FundoDeLuz } from "~/componentes/luz";
import { ArteDaBolha, useMolaDeToque } from "~/componentes/movimento";
import { AbaDasConquistas } from "~/componentes/recompensas/conquistas";
import { GanheMais } from "~/componentes/recompensas/ganhe-mais";
import { Broto } from "~/componentes/recompensas/pecas";
import { useSessao } from "~/lib/sessao";
import {
  ALVO_MINIMO,
  canto,
  cor,
  curva,
  escala,
  espaco,
  fonte,
  fonteDoNumero,
  luz,
  margem,
  sombras,
} from "~/tema";

/**
 * AS RECOMPENSAS — as conquistas (as medalhas, com o toque que paga) e o
 * "Ganhe mais". O saldo fica numa pílula no alto, e a porta do quartinho logo
 * abaixo: é LÁ que ela gasta as sementinhas.
 *
 * 24/11/2026, o dono: "os itens de fato comprados têm que ser ali na aba do
 * quartinho [...] é o quartinho em si onde você vai usar e gastar". O "Meu
 * Cantinho" (a lojinha de enfeites, peles e cenários da trilha) saiu daqui: a
 * trilha não se enfeita mais, e a venda mora no quartinho (`app/quartinho.tsx`).
 * `?aba=conquistas` (os links antigos) abre esta mesma tela.
 */
export default function Recompensas() {
  const { cuidado } = useSessao();
  const { avisar, aviso } = useAviso();
  const { height: altura } = useWindowDimensions();
  const fim = useFimDaRolagem(64);

  /* `null` = ainda não sei (ou não consegui ler): a tela mostra "—", nunca 0. */
  const [saldo, setSaldo] = useState<number | null>(null);
  const [conquistas, setConquistas] = useState<LeituraDasConquistas | null | "carregando">(
    "carregando",
  );
  const [ganheAberto, setGanheAberto] = useState(false);
  const [festa, setFesta] = useState(0);
  const rolagem = useRef<ScrollView>(null);

  const recarregar = useCallback(() => {
    setConquistas((c) => (c && c !== "carregando" ? c : "carregando"));
    /* A carteira credita o check-in do dia: é a leitura mais nova do saldo. */
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
  const aoFesta = useCallback(() => setFesta((n) => n + 1), []);

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

  /* A pílula do saldo abre o "Ganhe mais" e rola até ele. */
  const abrirGanheMais = useCallback(() => {
    setGanheAberto(true);
    setTimeout(() => rolagem.current?.scrollToEnd({ animated: true }), 350);
  }, []);

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: luz.base }}>
      <FundoDeLuz />
      <View style={{ paddingHorizontal: margem.tela, paddingTop: espaco.sm }}>
        <CabecalhoDaPilha
          titulo="Recompensas"
          voltarPara="/jornada"
          direita={cuidado ? null : <PilulaDoSaldo saldo={saldo} aoTocar={abrirGanheMais} />}
        />
      </View>
      <ScrollView
        ref={rolagem}
        contentContainerStyle={{ padding: margem.tela, paddingBottom: fim, gap: espaco.lg }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {cuidado ? null : <PortaDoQuartinho />}
        <AbaDasConquistas
          leitura={conquistas}
          cuidado={cuidado}
          ativa
          resgatar={resgatar}
          recarregar={recarregar}
          aoFesta={aoFesta}
          avisar={avisar}
        />
        {cuidado ? null : (
          <GanheMais
            aberta={ganheAberto}
            aoAlternar={() => setGanheAberto((v) => !v)}
            aoGanhar={(n) => setSaldo((s) => (s == null ? s : s + n))}
            avisar={avisar}
          />
        )}
      </ScrollView>
      {/* A festa das conquistas: por cima de tudo, fora da rolagem. */}
      {festa > 0 ? <Confete key={festa} pecas={40} altura={altura} /> : null}
      {aviso}
    </SafeAreaView>
  );
}

/**
 * A PORTA DO QUARTINHO: onde as sementinhas viram coisas. Um cartão com a
 * Bolha, que leva ao quarto do bebê.
 */
function PortaDoQuartinho() {
  const mola = useMolaDeToque(0.97);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Gastar as sementinhas no quartinho do bebê"
      onPressIn={mola.aoPressionar}
      onPressOut={mola.aoSoltar}
      onPress={() => {
        toque();
        router.push("/quartinho");
      }}
    >
      <Animated.View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: espaco.md,
          padding: espaco.md,
          borderRadius: canto.cartao,
          ...curva,
          backgroundColor: luz.cartao,
          borderWidth: 1,
          borderColor: cor.branco,
          ...sombras.cartao,
          transform: [{ scale: mola.escala }],
        }}
      >
        <ArteDaBolha humor="apaixonado" tamanho={56} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ ...fonte.forte, ...escala.manchete, color: cor.texto }}>
            O quartinho do bebê
          </Text>
          <Text style={{ ...fonte.normal, ...escala.legenda, color: cor.textoCorpo }}>
            É lá que as suas sementinhas viram berço, luminária e muito mais.
          </Text>
        </View>
        <ChevronRight size={22} color={cor.textoApagado} strokeWidth={2.4} />
      </Animated.View>
    </Pressable>
  );
}

/**
 * O SALDO: uma pílula só, no alto (como o placar da trilha). O toque abre o
 * "Ganhe mais" — é onde ela toca querendo saber como se ganha.
 */
function PilulaDoSaldo({ saldo, aoTocar }: { saldo: number | null; aoTocar: () => void }) {
  const mola = useMolaDeToque(0.95);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        saldo == null ? "Ver como ganhar sementinhas" : `${saldo} sementinhas. Ver como ganhar mais`
      }
      onPressIn={mola.aoPressionar}
      onPressOut={mola.aoSoltar}
      onPress={() => {
        toque();
        aoTocar();
      }}
    >
      <Animated.View
        style={{
          minHeight: ALVO_MINIMO,
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          borderRadius: canto.pilula,
          ...curva,
          paddingHorizontal: espaco.md + 2,
          backgroundColor: cor.sementinhaFundo,
          transform: [{ scale: mola.escala }],
        }}
      >
        <Broto tamanho={18} />
        <Text
          style={{
            ...fonteDoNumero,
            ...escala.manchete,
            color: cor.sementinha,
            fontVariant: ["tabular-nums"],
          }}
        >
          {saldo ?? "—"}
        </Text>
      </Animated.View>
    </Pressable>
  );
}
