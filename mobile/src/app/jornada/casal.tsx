import { useKeepAwake } from "expo-keep-awake";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { X } from "lucide-react-native";
import { memo, useEffect, useState } from "react";
import { Platform, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle, G, Path } from "react-native-svg";
import { ROTULO_DO_ALVO, SESSAO_DO_CASAL, type BlocoDoCasal } from "@/lib/sessao-do-casal";
import { Botao, Carregando, T, Tela, toque } from "~/componentes/base";
import { corJornada, corNoite } from "~/componentes/jornada/cores";
import { BarraDoTopo, voltarParaJornada } from "~/componentes/jornada/pecas";
import { useDiaDaJornada } from "~/componentes/jornada/usarJornada";
import { useMovimentoReduzido } from "~/componentes/movimento";
import { pararCanal, tocarVoz } from "~/lib/audio/voz";
import { VOZ_DA_NOITE } from "~/lib/audio/vozes";
import { casalAberto, SEMANA_DO_CASAL } from "~/lib/jornada/casal";
import { ehBancada, parametroDaBancada } from "~/lib/bancada";
import { easeInOut } from "~/lib/jornada/figura";
import { ALVO_MINIMO, espaco, fonte } from "~/tema";

/**
 * PARA VOCÊS DOIS — a sessão de dez minutos do app antigo (`SessaoDoCasal`):
 * ela e quem vai estar com ela no parto treinam as três coisas que mais
 * funcionam no trabalho de parto (a respiração de um seguindo a do outro, a
 * pressão da mão na base das costas, uma palavra combinada).
 *
 * O roteiro é o do site (`@/lib/sessao-do-casal`), com as 16 falas gravadas:
 * cada bloco toca a sua fala e espera o silêncio do roteiro (o mais longo, um
 * minuto, é uma contração inteira ensaiada). A tela fica acesa — os dois estão
 * olhando para ela, é o oposto da história para dormir.
 *
 * Fora do Modo Cuidado e do pós-parto, e só da 28ª semana em diante
 * (`casalAberto`, decisão do dono de 26/10/2026): é preparação para o parto, e
 * a voz gravada diz que o bebê "já reconhece a sua voz há semanas".
 *
 * Bancada: /jornada/casal?bancada=1&semana=30 [&bloco=<n>] [&fim=1] [&pausado=1]
 * (sem `&semana`, a semana da bancada é antes da 28ª: a tela diz quando abre)
 */
export default function Casal() {
  const dia = useDiaDaJornada();
  const blocos = SESSAO_DO_CASAL.blocos;
  const total = blocos.length;
  const [comecou, setComecou] = useState(false);
  const [i, setI] = useState(0);
  const [pausado, setPausado] = useState(false);
  const [aplicouBancada, setAplicouBancada] = useState(false);

  useEffect(() => {
    if (aplicouBancada || !ehBancada()) return;
    setAplicouBancada(true);
    const b = parametroDaBancada("bloco");
    if (b != null) {
      setComecou(true);
      setI(Math.min(total - 1, Math.max(0, Number(b) || 0)));
      setPausado(parametroDaBancada("pausado") === "1");
    }
    if (parametroDaBancada("fim") === "1") {
      setComecou(true);
      setI(total);
    }
  }, [aplicouBancada, total]);

  /* Cada bloco: a fala gravada e, quando ela acaba, o silêncio do roteiro. Sem
     gravação, um respiro curto — e o texto na tela continua valendo. Pausar
     cala; continuar lê o bloco de novo, do começo. */
  useEffect(() => {
    if (!comecou || pausado || i >= total) return;
    if (ehBancada()) return;
    const b = blocos[i]!;
    let espera: ReturnType<typeof setTimeout> | null = null;
    const seguir = () => {
      espera = setTimeout(() => setI((x) => x + 1), b.pausa * 1000);
    };
    const fonte = VOZ_DA_NOITE[b.id];
    if (!fonte || Platform.OS === "web") espera = setTimeout(seguir, 1500);
    else tocarVoz(fonte, { canal: "guia", aoAcabar: seguir });
    return () => {
      if (espera) clearTimeout(espera);
      pararCanal("guia");
    };
  }, [comecou, pausado, i, total, blocos]);

  useEffect(() => () => pararCanal("guia"), []);

  if (dia.modo === "carregando") {
    return (
      <Tela bordas={["top", "bottom"]}>
        <Carregando />
      </Tela>
    );
  }

  /* Sem conseguir ler o perfil, a sessão abre: ela não depende de dado nenhum. */
  const aberta =
    dia.modo === "falhou" ||
    (dia.modo === "gestacao" &&
      casalAberto({ cuidado: dia.cuidado, posParto: false, semana: dia.semana }));
  if (!aberta) {
    const aindaVem = (dia.modo === "gestacao" || dia.modo === "sem-data") && !dia.cuidado;
    return (
      <Tela bordas={["top", "bottom"]}>
        <BarraDoTopo titulo="Jornada" />
        <T>
          {aindaVem
            ? `Esta sessão abre na ${SEMANA_DO_CASAL}ª semana, quando o parto já está mais perto.`
            : "Esta sessão não faz parte da sua jornada de hoje. Respirar e escrever continuam aqui."}
        </T>
        <Botao rotulo="Voltar" aoTocar={voltarParaJornada} corFundo={corJornada.roxo} />
      </Tela>
    );
  }

  const acabou = i >= total;
  const bloco = blocos[Math.min(i, total - 1)]!;
  const sair = () => {
    pararCanal("guia");
    if (router.canGoBack()) router.back();
    else voltarParaJornada();
  };

  return (
    <LinearGradient colors={[...corNoite.casal]} style={{ flex: 1 }}>
      <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1 }}>
        {comecou && !acabou && Platform.OS !== "web" ? <MantemAcesa /> : null}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: espaco.lg,
            paddingVertical: espaco.sm,
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fechar"
            onPress={sair}
            style={({ pressed }) => ({
              width: ALVO_MINIMO,
              height: ALVO_MINIMO,
              marginLeft: -espaco.sm,
              alignItems: "center",
              justifyContent: "center",
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <X size={24} color={corNoite.branco40} />
          </Pressable>
          {comecou && !acabou ? (
            <View
              accessibilityLabel={`Parte ${i + 1} de ${total}`}
              style={{
                flex: 1,
                height: 4,
                marginHorizontal: espaco.md,
                borderRadius: 2,
                backgroundColor: corNoite.branco10,
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  width: `${((i + 1) / total) * 100}%`,
                  height: "100%",
                  borderRadius: 2,
                  backgroundColor: corNoite.branco45,
                }}
              />
            </View>
          ) : null}
          {/* Como no site: a barra divide a linha com um espaço vazio do mesmo tamanho. */}
          <View style={{ flex: 1 }} />
          {comecou && !acabou ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={pausado ? "Continuar" : "Pausar"}
              hitSlop={4}
              onPress={() => {
                toque();
                setPausado((p) => !p);
              }}
              style={({ pressed }) => ({
                width: 36,
                height: 36,
                borderRadius: 18,
                borderWidth: 1,
                borderColor: corNoite.branco15,
                alignItems: "center",
                justifyContent: "center",
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Svg width={15} height={15} viewBox="0 0 24 24">
                <Path
                  d={
                    pausado
                      ? "M8 5.2v13.6L19 12z"
                      : "M6.6 4.8h3.7v14.4H6.6zM13.7 4.8h3.7v14.4h-3.7z"
                  }
                  fill={corNoite.branco70}
                />
              </Svg>
            </Pressable>
          ) : null}
        </View>

        {!comecou ? (
          <ScrollView
            contentContainerStyle={{
              flexGrow: 1,
              justifyContent: "center",
              paddingHorizontal: 28,
              paddingBottom: 40,
            }}
          >
            <Text style={{ fontSize: 48 }}>{SESSAO_DO_CASAL.emoji}</Text>
            <Text
              accessibilityRole="header"
              style={{
                marginTop: espaco.lg,
                fontFamily: fonte.media,
                fontSize: 27,
                lineHeight: 32,
                color: corNoite.branco,
              }}
            >
              {SESSAO_DO_CASAL.titulo}
            </Text>
            <Text
              style={{
                marginTop: espaco.sm,
                fontFamily: fonte.normal,
                fontSize: 14,
                lineHeight: 22,
                color: corNoite.branco70,
              }}
            >
              Dez minutos com quem vai estar com você no dia. Vocês treinam juntos três gestos de
              parceria, sem pressa — e dá para repetir quando quiserem.
            </Text>
            <View style={{ marginTop: 20, gap: espaco.sm }}>
              {[
                "a respiração de um seguindo a do outro",
                "a pressão da mão na base das costas",
                "uma palavra combinada, que vale depois",
              ].map((l) => (
                <Text
                  key={l}
                  style={{
                    fontFamily: fonte.normal,
                    fontSize: 13,
                    lineHeight: 18,
                    color: corNoite.branco60,
                  }}
                >
                  · {l}
                </Text>
              ))}
            </View>
            <Text
              style={{
                marginTop: espaco.xl,
                fontFamily: fonte.normal,
                fontSize: 13,
                lineHeight: 20,
                color: corNoite.branco40,
              }}
            >
              Chame quem vai te acompanhar antes de começar. Dá para fazer sentada no chão, na cama
              ou numa cadeira.
            </Text>
            <BotaoClaro rotulo="Estamos os dois aqui" aoTocar={() => setComecou(true)} />
          </ScrollView>
        ) : acabou ? (
          <View
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              paddingHorizontal: espaco.xxl,
            }}
          >
            <Text style={{ fontSize: 48 }}>🤲</Text>
            <Text
              accessibilityRole="header"
              style={{
                marginTop: espaco.lg,
                fontFamily: fonte.media,
                fontSize: 24,
                lineHeight: 30,
                color: corNoite.branco,
              }}
            >
              Vocês treinaram junto
            </Text>
            <Text
              style={{
                marginTop: espaco.sm,
                maxWidth: 320,
                textAlign: "center",
                fontFamily: fonte.normal,
                fontSize: 14,
                lineHeight: 22,
                color: corNoite.branco70,
              }}
            >
              Cinco minutos por semana bastam para isso virar automático. No dia, ninguém vai
              precisar lembrar de nada.
            </Text>
            <View style={{ width: "100%", maxWidth: 320 }}>
              <BotaoClaro rotulo="Fechar" aoTocar={sair} />
            </View>
          </View>
        ) : (
          <View
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              paddingHorizontal: 28,
            }}
          >
            <View
              style={{
                borderRadius: 999,
                borderWidth: 1,
                borderColor: corNoite[bloco.alvo].borda,
                backgroundColor: corNoite[bloco.alvo].fundo,
                paddingHorizontal: espaco.lg,
                paddingVertical: 6,
              }}
            >
              <Text
                style={{
                  fontFamily: fonte.titulo,
                  fontSize: 13,
                  letterSpacing: 1.8,
                  textTransform: "uppercase",
                  color: corNoite[bloco.alvo].texto,
                }}
              >
                {ROTULO_DO_ALVO[bloco.alvo]}
              </Text>
            </View>
            <View
              style={{ marginTop: 28, height: 112, alignItems: "center", justifyContent: "center" }}
            >
              <Figura tipo={bloco.figura} />
            </View>
            <Text
              key={bloco.id}
              style={{
                marginTop: 28,
                maxWidth: 384,
                textAlign: "center",
                fontFamily: fonte.titulo,
                fontSize: 19,
                lineHeight: 31,
                letterSpacing: -0.19,
                color: corNoite.branco90,
              }}
            >
              {bloco.texto}
            </Text>
            {pausado ? (
              <Text
                style={{
                  marginTop: espaco.xl,
                  fontFamily: fonte.normal,
                  fontSize: 13,
                  color: corNoite.branco45,
                }}
              >
                Pausado
              </Text>
            ) : null}
          </View>
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

function MantemAcesa() {
  useKeepAwake("dc-casal");
  return null;
}

function BotaoClaro({ rotulo, aoTocar }: { rotulo: string; aoTocar: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        toque();
        aoTocar();
      }}
      style={({ pressed }) => ({
        marginTop: espaco.xxl,
        minHeight: 50,
        borderRadius: 999,
        backgroundColor: corNoite.branco,
        alignItems: "center",
        justifyContent: "center",
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Text style={{ fontFamily: fonte.titulo, fontSize: 14, color: corNoite.tintaDoBotao }}>
        {rotulo}
      </Text>
    </Pressable>
  );
}

/* A respiração das duas figuras (`dc-casal-respira`): 0,9 → 1,08 → 0,9 em 7 s,
   com o `ease-in-out` do CSS; a de trás segue a da frente com 0,35 s. */
function escalaDoRespiro(t: number): number {
  if (t <= 0) return 1;
  const p = ((t % 7) / 7) * 100;
  if (p < 45) return 0.9 + (1.08 - 0.9) * easeInOut(p / 45);
  return 1.08 + (0.9 - 1.08) * easeInOut((p - 45) / 55);
}

/** Os segundos desde que a figura apareceu, a ~30 quadros por segundo. */
function useSegundos(ativo: boolean): number {
  const [t, setT] = useState(0);
  useEffect(() => {
    if (!ativo) return;
    const inicio = Date.now();
    let ultimo = 0;
    let id = requestAnimationFrame(function quadro() {
      const agora = Date.now();
      if (agora - ultimo >= 33) {
        ultimo = agora;
        setT((agora - inicio) / 1000);
      }
      id = requestAnimationFrame(quadro);
    });
    return () => cancelAnimationFrame(id);
  }, [ativo]);
  return t;
}

const TRACO = { stroke: "rgba(255,255,255,0.45)", strokeWidth: 1.6, fill: "none" } as const;

/** Os quatro desenhos do site: o ponto âmbar é exatamente onde a mão vai. */
const Figura = memo(function Figura({ tipo }: { tipo: BlocoDoCasal["figura"] }) {
  const reduzido = useMovimentoReduzido();
  const t = useSegundos(tipo === "respirar" && !reduzido);
  if (!tipo) return null;
  const alvo = corNoite.alvoDaFigura;
  const escala = (cx: number, cy: number, s: number) =>
    `translate(${cx} ${cy}) scale(${s}) translate(${-cx} ${-cy})`;
  return (
    <Svg
      width={149}
      height={112}
      viewBox="0 0 120 90"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {tipo === "respirar" ? (
        <>
          {/* Duas respirações que se encontram: a de trás segue a da frente. */}
          <G transform={escala(44, 45, reduzido ? 1 : escalaDoRespiro(t))}>
            <Circle cx={44} cy={45} r={20} {...TRACO} />
          </G>
          <G transform={escala(78, 45, reduzido ? 1 : escalaDoRespiro(t - 0.35))}>
            <Circle cx={78} cy={45} r={14} {...TRACO} />
          </G>
          <Circle cx={44} cy={45} r={3} fill={alvo} />
          <Circle cx={78} cy={45} r={3} fill="rgba(255,255,255,0.4)" />
        </>
      ) : null}
      {tipo === "mao-no-sacro" ? (
        <>
          {/* De costas: ela sentada à frente, a mão de quem acompanha na base da coluna. */}
          <Path d="M52 20a9 9 0 1 1 .1 0Z" {...TRACO} />
          <Path d="M44 34c0 14-3 26-3 38h24c0-12-3-24-3-38" {...TRACO} />
          <Path d="M41 72h26" {...TRACO} />
          <Circle cx={54} cy={62} r={7} fill={alvo} opacity={0.85} />
          <Path d="M82 58c-6 2-14 3-20 4" {...TRACO} />
          <Path d="M84 52a7 7 0 1 1 .1 0Z" {...TRACO} />
        </>
      ) : null}
      {tipo === "mao-na-barriga" ? (
        <>
          {/* De perfil: a barriga e as duas mãos apoiadas, uma de cada lado. */}
          <Path d="M46 18a9 9 0 1 1 .1 0Z" {...TRACO} />
          <Path d="M40 32c-2 12-2 20 0 30" {...TRACO} />
          <Path d="M40 40c14-2 22 6 22 14 0 8-8 14-22 12" {...TRACO} />
          <Circle cx={54} cy={48} r={5} fill={alvo} opacity={0.85} />
          <Circle cx={57} cy={62} r={5} fill={alvo} opacity={0.85} />
          <Path d="M74 44c-6 2-10 3-14 4M76 66c-6-2-10-3-14-4" {...TRACO} />
        </>
      ) : null}
      {tipo === "palavra" ? (
        <>
          {/* Duas falas, uma palavra só no meio das duas. */}
          <Path
            d="M22 30h34a6 6 0 0 1 6 6v14a6 6 0 0 1-6 6H34l-8 8v-8h-4a6 6 0 0 1-6-6V36a6 6 0 0 1 6-6Z"
            {...TRACO}
          />
          <Path
            d="M98 30H72a6 6 0 0 0-6 6v14a6 6 0 0 0 6 6h20l8 8v-8a6 6 0 0 0 6-6V36a6 6 0 0 0-6-6Z"
            {...TRACO}
          />
          <Circle cx={60} cy={43} r={4} fill={alvo} />
        </>
      ) : null}
    </Svg>
  );
});
