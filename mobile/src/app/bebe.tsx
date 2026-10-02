import { semanaDaArte } from "@/lib/arte-do-bebe";
import {
  babyForWeek,
  consultaForWeek,
  fruitEmojiForWeek,
  trimesterForWeek,
  WEEK_MAX,
  WEEK_MIN,
} from "@/lib/gestacao";
import { nutricaoDaSemana } from "@/lib/nutricao-da-semana";
import { Image } from "expo-image";
import { router } from "expo-router";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { BEBE, BOLHA } from "~/componentes/artes";
import { Botao, Cartao, Linha, Pilula, T, Tela, toque } from "~/componentes/base";
import { parametroDaBancada } from "~/lib/bancada";
import { gestacaoDoPerfil } from "~/lib/gestacao";
import { semGeneroDoBebe } from "~/lib/nutricao/frase-do-topo";
import { Entrada, Flutuar, Inclinacao3D } from "~/componentes/movimento";
import { useSessao } from "~/lib/sessao";
import { ALVO_MINIMO, cor, espaco, fonte, raio } from "~/tema";

const SEMANAS = Array.from({ length: WEEK_MAX - WEEK_MIN + 1 }, (_, i) => WEEK_MIN + i);
const LARGURA_CHIP = 52;

/**
 * O bebê semana a semana: ela abre na semana de hoje e pode andar para trás
 * (o que já passou) e para frente (o que vem). No Modo Cuidado esta tela não
 * mostra o bebê — devolve para o início com acolhimento.
 */
export default function Bebe() {
  const { perfil, cuidado } = useSessao();
  const gest = gestacaoDoPerfil(perfil);
  const hoje = gest ? Math.min(Math.max(gest.weeks, WEEK_MIN), WEEK_MAX) : 20;
  const pedida = Number(parametroDaBancada("ver"));
  /* null = "a semana de hoje": o perfil pode chegar depois do primeiro
     desenho, e a tela tem de abrir na semana dela, não num padrão. */
  const [escolhida, setEscolhida] = useState<number | null>(
    Number.isFinite(pedida) && pedida >= WEEK_MIN ? pedida : null,
  );
  const semana = escolhida ?? hoje;
  const setSemana = (f: (s: number) => number) => setEscolhida(f(semana));
  const faixa = useRef<ScrollView>(null);
  const [larguraDaFaixa, setLarguraDaFaixa] = useState(0);

  useEffect(() => {
    if (!larguraDaFaixa) return;
    const x = (semana - WEEK_MIN) * (LARGURA_CHIP + 8) - (larguraDaFaixa - LARGURA_CHIP) / 2;
    faixa.current?.scrollTo({ x: Math.max(0, x), animated: true });
  }, [semana, larguraDaFaixa]);

  if (cuidado) {
    return (
      <Tela bordas={["top", "bottom"]}>
        <Image
          source={BOLHA.feliz}
          style={{ width: 96, height: 96, alignSelf: "center" }}
          contentFit="contain"
        />
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
          aoTocar={() => (router.canGoBack() ? router.back() : router.replace("/inicio"))}
        />
      </Tela>
    );
  }

  const bebe = babyForWeek(semana);
  const nutri = nutricaoDaSemana(semana);
  const rotulo =
    gest && semana === hoje
      ? "Esta semana"
      : gest && semana < hoje
        ? "Já passou"
        : gest
          ? "Vem aí"
          : null;
  const andar = (d: number) => {
    toque();
    setSemana((s) => Math.min(Math.max(s + d, WEEK_MIN), WEEK_MAX));
  };

  return (
    <Tela bordas={["top", "bottom"]}>
      <Linha estilo={{ justifyContent: "space-between" }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/inicio"))}
          style={{ minWidth: ALVO_MINIMO, minHeight: ALVO_MINIMO, justifyContent: "center" }}
        >
          <Text style={{ fontSize: 17, color: cor.primariaEscura, fontFamily: fonte.forte }}>
            ‹ Voltar
          </Text>
        </Pressable>
        <T tipo="subtitulo">
          {perfil?.baby_name ? `${perfil.baby_name}, semana a semana` : "Semana a semana"}
        </T>
        <View style={{ minWidth: ALVO_MINIMO }} />
      </Linha>

      <ScrollView
        ref={faixa}
        onLayout={(e) => setLarguraDaFaixa(e.nativeEvent.layout.width)}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
      >
        {SEMANAS.map((s) => {
          const ativa = s === semana;
          return (
            <Pressable
              key={s}
              accessibilityRole="button"
              accessibilityLabel={`Semana ${s}`}
              accessibilityState={{ selected: ativa }}
              onPress={() => {
                toque();
                setEscolhida(s);
              }}
              style={{
                width: LARGURA_CHIP,
                minHeight: ALVO_MINIMO + 8,
                borderRadius: raio.md,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: ativa
                  ? cor.primaria
                  : s === hoje && gest
                    ? cor.destaque
                    : cor.cartao,
                borderWidth: 1,
                borderColor: ativa ? cor.primaria : cor.borda,
              }}
            >
              <Text
                style={{
                  fontFamily: fonte.titulo,
                  fontSize: 18,
                  color: ativa ? cor.branco : cor.texto,
                }}
              >
                {s}
              </Text>
              <Text
                style={{
                  fontFamily: fonte.normal,
                  fontSize: 13,
                  color: ativa ? cor.branco : cor.textoApagado,
                }}
              >
                sem
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <Inclinacao3D raio={raio.lg}>
        <Cartao fundo={cor.rosaMarca} estilo={{ alignItems: "center", gap: espaco.md }}>
          <Linha estilo={{ gap: espaco.sm }}>
            <Pilula texto={`${trimesterForWeek(semana)}º trimestre`} fundo={cor.cartao} />
            {rotulo ? <Pilula texto={rotulo} fundo={cor.cartao} /> : null}
          </Linha>
          <Linha estilo={{ justifyContent: "space-between", alignSelf: "stretch" }}>
            <Seta direcao={-1} desabilitada={semana <= WEEK_MIN} aoTocar={() => andar(-1)} />
            {/* A chave reinicia a entrada a cada semana: a arte chega de novo. */}
            <Entrada key={semana} deslocamento={10}>
              <Flutuar>
                <Image
                  source={BEBE[semanaDaArte(semana)]}
                  style={{ width: 170, height: 170 }}
                  contentFit="contain"
                  accessibilityLabel={`Ilustração do bebê na semana ${semana}`}
                />
              </Flutuar>
            </Entrada>
            <Seta direcao={1} desabilitada={semana >= WEEK_MAX} aoTocar={() => andar(1)} />
          </Linha>
          <T tipo="titulo">Semana {semana}</T>
          <Linha estilo={{ gap: espaco.md, alignSelf: "stretch" }}>
            <Medida titulo="Tamanho" valor={bebe.size} />
            <Medida titulo="Peso" valor={bebe.weight} />
            <Medida titulo="Como" valor={`${fruitEmojiForWeek(semana)} ${bebe.fruit}`} />
          </Linha>
          <T estilo={{ alignSelf: "stretch" }}>{semGeneroDoBebe(bebe.desc)}</T>
        </Cartao>
      </Inclinacao3D>

      {nutri ? (
        <Cartao fundo={cor.nutricaoFundo}>
          <T tipo="rotulo" cor={cor.nutricao}>
            No prato: {semGeneroDoBebe(nutri.titulo)}
          </T>
          <T>{semGeneroDoBebe(nutri.texto)}</T>
        </Cartao>
      ) : null}

      <Cartao>
        <T tipo="rotulo">Nesta fase da gestação</T>
        <T tipo="apagado">{consultaForWeek(semana)}</T>
        <T tipo="apagado" estilo={{ fontSize: 13 }}>
          Informação geral. Quem decide os seus exames é a sua equipe de saúde.
        </T>
      </Cartao>
    </Tela>
  );
}

function Seta({
  direcao,
  desabilitada,
  aoTocar,
}: {
  direcao: 1 | -1;
  desabilitada: boolean;
  aoTocar: () => void;
}) {
  const Icone = direcao < 0 ? ChevronLeft : ChevronRight;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={direcao < 0 ? "Semana anterior" : "Próxima semana"}
      accessibilityState={{ disabled: desabilitada }}
      disabled={desabilitada}
      onPress={aoTocar}
      style={{
        width: ALVO_MINIMO,
        height: ALVO_MINIMO,
        borderRadius: ALVO_MINIMO / 2,
        backgroundColor: cor.cartao,
        alignItems: "center",
        justifyContent: "center",
        opacity: desabilitada ? 0.35 : 1,
      }}
    >
      <Icone size={24} color={cor.primariaEscura} />
    </Pressable>
  );
}

function Medida({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: cor.cartao,
        borderRadius: raio.md,
        padding: espaco.sm,
        gap: 2,
      }}
    >
      <T tipo="apagado" estilo={{ fontSize: 13 }}>
        {titulo}
      </T>
      <T tipo="rotulo" linhas={2} estilo={{ fontSize: 14 }}>
        {valor}
      </T>
    </View>
  );
}
