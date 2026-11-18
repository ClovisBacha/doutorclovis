import { WEEK_MAX, WEEK_MIN } from "@/lib/gestacao";
import { router } from "expo-router";
import { useMemo, useRef, useState } from "react";
import { Animated, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AvisoMedico } from "~/componentes/aviso-medico";
import { Botao, Carregando, T, Tela } from "~/componentes/base";
import { BotaoVoltar, PilulaSos } from "~/componentes/cabecalho";
import { CEUS, CeuVivo, faseDeAgora, sombraDoTexto, type Ceu } from "~/componentes/ceu-vivo";
import { BebeNestaSemana } from "~/componentes/jornada/bebe-nesta-semana";
import { CeuDoBebe, CHAVE_REGUA_USADA, useAlturaDoCeu } from "~/componentes/jornada/ceu-do-bebe";
import { BolhaViva, useParalaxe } from "~/componentes/movimento";
import { Painel } from "~/componentes/painel";
import { parametroDaBancada } from "~/lib/bancada";
import { gestacaoDoPerfil } from "~/lib/gestacao";
import { useLoja } from "~/lib/jornada/loja";
import { useSessao } from "~/lib/sessao";
import { ALVO_MINIMO, escala, espaco, fonte, margem } from "~/tema";

/**
 * O bebê SEMANA A SEMANA: ela abre na semana de hoje (ou na pedida) e anda
 * para trás (o que já passou) e para frente (o que vem). No Modo Cuidado esta
 * tela não mostra o bebê — devolve para o início com acolhimento.
 *
 * 18/11/2026 (a vistoria: "uma segunda implementação, mais pobre, da mesma
 * viagem pelas semanas — e chega a mostrar outro bebê para a mesma semana").
 * Agora é a MESMA cena da aba do bebê: o céu vivo da hora, o número atrás, o
 * bebê da semana (`arteDoBebe`, a regra única) e a régua do tempo — um
 * controle só, no lugar da faixa de 37 fichas e das setas. Embaixo, o mesmo
 * painel da aba (`BebeNestaSemana`) acompanha a semana que a régua mostra; a
 * data provável só aparece na semana de hoje (é dela, e não da semana vista).
 */
export default function Bebe() {
  const { perfil, cuidado } = useSessao();
  const { top: topo, bottom: baixo } = useSafeAreaInsets();
  const altura = useAlturaDoCeu(topo, baixo);
  const loja = useLoja();
  /* O céu de quando a tela abriu (o mesmo das abas). */
  const [{ fase, ceu }] = useState(() => ({ fase: faseDeAgora(), ceu: CEUS[faseDeAgora()] }));
  const rolagem = useRef(new Animated.Value(0)).current;
  const { x, y } = useParalaxe();
  const aoRolar = useMemo(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { y: rolagem } } }], {
        useNativeDriver: true,
      }),
    [rolagem],
  );

  const gest = gestacaoDoPerfil(perfil);
  const hoje = gest ? Math.min(Math.max(gest.weeks, WEEK_MIN), WEEK_MAX) : 20;
  const pedida = Number(parametroDaBancada("ver"));
  const inicial = Number.isFinite(pedida) && pedida >= WEEK_MIN ? Math.min(pedida, WEEK_MAX) : hoje;
  const [vista, setVista] = useState(inicial);
  const nome = perfil?.baby_name?.trim() || null;

  const cabecalho = useMemo(
    () => (
      <TopoDaViagem
        topo={topo}
        ceu={ceu}
        titulo={nome ? `${nome}, semana a semana` : "Semana a semana"}
      />
    ),
    [topo, ceu, nome],
  );

  if (cuidado) {
    return (
      <Tela bordas={["top", "bottom"]}>
        <BolhaViva humor="feliz" tamanho={96} />
        <T tipo="subtitulo" centro>
          Este espaço está guardado
        </T>
        <T tipo="apagado" centro>
          Com o Modo Cuidado ligado, o app não mostra conteúdo sobre o bebê. Você pode desligar no
          Perfil quando quiser.
        </T>
        <Botao
          rotulo="Voltar"
          tipo="secundario"
          aoTocar={() => (router.canGoBack() ? router.back() : router.replace("/jornada"))}
        />
      </Tela>
    );
  }

  /* A régua abre na semana dela: espera o perfil, para não abrir num padrão. */
  if (!perfil) {
    return (
      <Tela>
        <Carregando />
      </Tela>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: ceu.chao }}>
      <CeuVivo fase={fase} rolagem={rolagem} x={x} y={y} />
      <Animated.ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: baixo + espaco.xl }}
        showsVerticalScrollIndicator={false}
        onScroll={aoRolar}
        scrollEventThrottle={16}
      >
        <CeuDoBebe
          topo={topo}
          altura={altura}
          ceu={ceu}
          semana={hoje}
          inicial={inicial}
          dias={gest?.days ?? 0}
          nomeDoBebe={nome}
          faltam={null}
          rolagem={rolagem}
          x={x}
          y={y}
          reguaUsada={loja.blob[CHAVE_REGUA_USADA] === true}
          cabecalho={cabecalho}
          modo="semanas"
          semData={!gest}
          aoVer={setVista}
        />
        <View style={{ paddingHorizontal: margem.tela, paddingTop: 6 }}>
          <Painel>
            <BebeNestaSemana
              semana={vista}
              totalDias={gest?.totalDays ?? null}
              nomeDoBebe={nome}
              titulo={null}
              mostrarDataProvavel={!!gest && vista === hoje}
              portas={false}
            />
            <AvisoMedico curto />
          </Painel>
        </View>
      </Animated.ScrollView>
    </View>
  );
}

/** O alto do céu no semana a semana: o voltar, o título na tinta do céu e o SOS. */
function TopoDaViagem({ topo, ceu, titulo }: { topo: number; ceu: Ceu; titulo: string }) {
  return (
    <View
      style={{
        paddingTop: topo + espaco.xs,
        paddingHorizontal: margem.tela,
        flexDirection: "row",
        alignItems: "center",
        gap: espaco.sm,
        minHeight: ALVO_MINIMO,
      }}
    >
      <BotaoVoltar voltarPara="/jornada" />
      <Text
        accessibilityRole="header"
        numberOfLines={1}
        style={{
          flex: 1,
          textAlign: "center",
          ...fonte.forte,
          ...escala.manchete,
          color: ceu.tinta,
          ...sombraDoTexto(ceu),
        }}
      >
        {titulo}
      </Text>
      <View style={{ minWidth: ALVO_MINIMO, alignItems: "flex-end" }}>
        <PilulaSos />
      </View>
    </View>
  );
}
