import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState, type ReactNode } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { gestChallenge } from "@/lib/daily-challenges";
import { carregarQuizDoDia, temQuizNoDia, type DailyQuiz } from "@/lib/daily-quizzes";
import { recadoDaBolha } from "@/lib/recado-da-bolha";
import { Carregando, toque } from "~/componentes/base";
import { corCaminho, META_DAS_ATIVIDADES } from "~/componentes/caminho/cores";
import { EstrelaDoDia, IconeDaAtividade } from "~/componentes/caminho/pecas";
import { rota } from "~/componentes/jornada/bancada";
import { voltarParaJornada } from "~/componentes/jornada/pecas";
import { useJornada } from "~/componentes/jornada/usarJornada";
import { ArteDaBolha, type HumorDaArte } from "~/componentes/movimento";
import {
  contarMomentos,
  feito,
  flagsDoDia,
  TOTAL_DO_DIA,
  type Momento,
} from "~/lib/jornada/momentos";
import { cor, espaco, fonte } from "~/tema";

/**
 * A FOLHA DO DIA — "Atividades de hoje", a tela que abre ao tocar num nó do
 * Caminho. É o `WellnessScreen` do site em peças nativas: a bolha grande com um
 * balão de fala, as cinco atividades em cartões de vidro (cada uma na sua cor),
 * e o placar "⭐ Estrelas de hoje" no pé.
 *
 * Cada linha abre a atividade que o app já tem (aula, mexer, meditar, a carta
 * e a gratidão). ⚠️ Diferença deliberada do site: lá um dia PASSADO também
 * abre as atividades, só que sem valer nada; aqui as telas de atividade
 * marcam sempre o dia de HOJE, então o dia passado mostra o que foi feito e
 * não abre nada — abrir marcaria hoje em nome de ontem.
 */

const ORDEM = ["aula", "movement", "meditation", "bonding", "gratitude"] as const;
type Chave = (typeof ORDEM)[number];

const ROTA: Record<Chave, string> = {
  aula: "/jornada/aula",
  movement: "/jornada/mexer",
  meditation: "/jornada/meditar",
  bonding: "/jornada/bebe",
  gratitude: "/jornada/gratidao",
};

/** O assunto da aula numa linha: a primeira frase da lição, cortada no espaço. */
function tituloDaAula(q: DailyQuiz): string {
  const frase = q.teach
    .split(/(?<=[.!?])\s/)[0]
    .replace(/[.!?]+$/, "")
    .trim();
  if (frase.length <= 46) return frase;
  const corte = frase.slice(0, 44);
  const espacoFinal = corte.lastIndexOf(" ");
  return `${(espacoFinal > 24 ? corte.slice(0, espacoFinal) : corte).trimEnd()}…`;
}

/** A cara da bolha (`humorDaJornada` do site, sem a festa: a festa é de instante). */
function humorDoDia(feitos: number, hora: number): HumorDaArte {
  if (feitos >= TOTAL_DO_DIA) return "orgulhosa";
  if (hora < 5 || feitos >= TOTAL_DO_DIA - 1) return "surpresa";
  return "feliz";
}

export default function FolhaDoDia() {
  const { dia, loja } = useJornada();
  const { D: pedido } = useLocalSearchParams<{ D?: string }>();
  const topo = useSafeAreaInsets().top;
  const hojeD = dia.modo === "gestacao" ? dia.D : null;
  const n = Number(pedido);
  const D =
    hojeD != null ? (Number.isFinite(n) && n >= 7 && n <= hojeD ? Math.floor(n) : hojeD) : null;

  const [quiz, setQuiz] = useState<DailyQuiz | null | "carregando">("carregando");
  useEffect(() => {
    if (D == null) return;
    let vivo = true;
    if (!temQuizNoDia(D)) {
      setQuiz(null);
      return;
    }
    void carregarQuizDoDia(D).then((q) => {
      if (vivo) setQuiz(q);
    });
    return () => {
      vivo = false;
    };
  }, [D]);

  /* Fora da gestação (ou no Modo Cuidado) a folha não tem dia para mostrar:
     volta para a jornada, que sabe o que oferecer. */
  const semDia = dia.modo !== "carregando" && (dia.modo !== "gestacao" || dia.cuidado);
  useEffect(() => {
    if (semDia) voltarParaJornada();
  }, [semDia]);

  if (dia.modo === "carregando" || D == null || hojeD == null) {
    return (
      <Fundo>
        <Carregando texto="Abrindo o seu dia…" />
      </Fundo>
    );
  }
  if (dia.modo !== "gestacao" || dia.cuidado) return null;

  const ehHoje = D === hojeD;
  const flags = flagsDoDia(loja.blob, D);
  const feitos = contarMomentos(flags);
  const nomeDoBebe = (dia.perfil.baby_name ?? "").trim() || null;
  const hora = new Date().getHours();
  const recado = recadoDaBolha({
    feitos,
    total: TOTAL_DO_DIA,
    dia: D,
    hora,
    bebe: nomeDoBebe ?? undefined,
    semana: Math.floor(D / 7),
    posParto: false,
    careMode: false,
  });
  const desafio = !temQuizNoDia(D) ? gestChallenge(D) : null;
  const descDaAula =
    quiz && quiz !== "carregando"
      ? tituloDaAula(quiz)
      : quiz === "carregando"
        ? "Aula de hoje"
        : desafio?.label || "O desafio de hoje";

  const momentoDe = (c: Chave): Momento => (c === "aula" ? "aula" : c);

  return (
    <Fundo>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 32, paddingTop: topo + 12, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ alignItems: "center", marginTop: 8 }}>
          <ArteDaBolha humor={humorDoDia(feitos, hora)} tamanho={298} />
          {/* O balão: o rabinho aponta para CIMA, para a bolha — é o que faz o
              texto ser fala dela em vez de mais um cartão da tela. */}
          <View style={{ marginTop: -74, width: 257, maxWidth: "100%" }}>
            <View
              style={{
                position: "absolute",
                left: "50%",
                top: -8,
                marginLeft: -8,
                width: 16,
                height: 16,
                borderRadius: 3,
                backgroundColor: corCaminho.vidroBase,
                borderTopWidth: 1,
                borderLeftWidth: 1,
                borderColor: corCaminho.vidroBorda,
                transform: [{ rotate: "45deg" }],
              }}
            />
            <Vidro raio={26} estilo={{ paddingHorizontal: 20, paddingVertical: 20 }}>
              <Text
                style={{
                  textAlign: "center",
                  fontFamily: fonte.normal,
                  fontSize: 15,
                  lineHeight: 22.5,
                  color: corCaminho.tinta,
                }}
              >
                {recado}
              </Text>
            </Vidro>
          </View>
        </View>

        <Text
          style={{ marginTop: 14, fontFamily: fonte.media, fontSize: 16, color: corCaminho.tinta }}
        >
          {ehHoje ? "Atividades de hoje" : "As atividades deste dia"}{" "}
          <Text style={{ opacity: 0.55 }}>✦</Text>
        </Text>
        {!ehHoje ? (
          <Text
            style={{
              marginTop: 4,
              fontFamily: fonte.normal,
              fontSize: 13,
              color: corCaminho.tintaSec,
            }}
          >
            Esse dia já passou: as atividades valem no dia de hoje.
          </Text>
        ) : null}

        <View style={{ marginTop: 10, gap: 8 }}>
          {ORDEM.map((c) => {
            const meta = META_DAS_ATIVIDADES[c];
            const fez = feito(flags, momentoDe(c));
            return (
              <Pressable
                key={c}
                accessibilityRole="button"
                accessibilityLabel={`${meta.titulo}${fez ? ", feita" : ""}`}
                accessibilityState={{ disabled: !ehHoje }}
                disabled={!ehHoje}
                onPress={() => {
                  toque();
                  router.push(rota(ROTA[c]) as never);
                }}
                style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.98 : 1 }] })}
              >
                <Vidro
                  raio={22}
                  estilo={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 12 }}
                >
                  <LinearGradient
                    colors={[meta.tile, meta.tileB]}
                    start={{ x: 0.2, y: 0 }}
                    end={{ x: 0.8, y: 1 }}
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 16,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <IconeDaAtividade chave={c} cor={meta.tinta} />
                  </LinearGradient>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      style={{
                        fontFamily: fonte.media,
                        fontSize: 14.5,
                        lineHeight: 18,
                        color: meta.tinta,
                      }}
                    >
                      {meta.titulo}
                    </Text>
                    <Text
                      style={{
                        marginTop: 2,
                        fontFamily: fonte.normal,
                        fontSize: 13,
                        lineHeight: 17.5,
                        color: corCaminho.tintaSec,
                      }}
                    >
                      {c === "aula" ? descDaAula : meta.desc}
                    </Text>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <View
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: 13,
                        alignItems: "center",
                        justifyContent: "center",
                        ...(fez
                          ? { backgroundColor: corCaminho.feitoVerde }
                          : {
                              borderWidth: 1.5,
                              borderStyle: "dashed",
                              borderColor: corCaminho.circuloVazio,
                            }),
                      }}
                    >
                      {fez ? (
                        <Text style={{ fontFamily: fonte.forte, fontSize: 13, color: cor.branco }}>
                          ✓
                        </Text>
                      ) : null}
                    </View>
                    <Text
                      style={{
                        fontFamily: fonte.normal,
                        fontSize: 13.5,
                        color: corCaminho.tintaSec,
                        fontVariant: ["tabular-nums"],
                      }}
                    >
                      {fez ? "1/1" : "0/1"}
                    </Text>
                    {ehHoje ? (
                      <View
                        style={{
                          width: 30,
                          height: 30,
                          borderRadius: 15,
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: corCaminho.setaFundo,
                          borderWidth: 1,
                          borderColor: corCaminho.vidroBorda,
                        }}
                      >
                        <Svg width={14} height={14} viewBox="0 0 24 24">
                          <Path
                            d="M9 5l7 7-7 7"
                            stroke={corCaminho.seta}
                            strokeWidth={2}
                            fill="none"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </Svg>
                      </View>
                    ) : null}
                  </View>
                </Vidro>
              </Pressable>
            );
          })}
        </View>

        <Vidro raio={22} estilo={{ marginTop: 12, paddingHorizontal: 16, paddingVertical: 16 }}>
          <Text
            style={{
              textAlign: "center",
              fontFamily: fonte.media,
              fontSize: 14.5,
              color: corCaminho.tinta,
            }}
          >
            ⭐ {ehHoje ? "Estrelas de hoje" : "Estrelas deste dia"}
          </Text>
          <View
            accessible
            accessibilityRole="image"
            accessibilityLabel={`${feitos} de ${TOTAL_DO_DIA} estrelas conquistadas`}
            style={{ marginTop: 12, flexDirection: "row", justifyContent: "center", gap: 14 }}
          >
            {Array.from({ length: TOTAL_DO_DIA }, (_, i) => (
              <EstrelaDoDia key={i} acesa={i < feitos} tamanho={38} />
            ))}
          </View>
          <Text
            style={{
              marginTop: 12,
              textAlign: "center",
              fontFamily: fonte.normal,
              fontSize: 13,
              color: corCaminho.tintaSec,
            }}
          >
            <Text
              style={{
                fontFamily: fonte.forte,
                fontSize: 16,
                color: corCaminho.tinta,
                fontVariant: ["tabular-nums"],
              }}
            >
              {feitos}/{TOTAL_DO_DIA}
            </Text>{" "}
            estrelas conquistadas
          </Text>
          {ehHoje ? (
            <Text
              style={{
                marginTop: 4,
                textAlign: "center",
                fontFamily: fonte.normal,
                fontSize: 13,
                color: corCaminho.tintaSec,
              }}
            >
              {feitos >= TOTAL_DO_DIA ? (
                "Dia completo! Você acendeu as cinco 🌟"
              ) : (
                <>
                  {feitos > 0
                    ? "Continue assim! Acenda as 5 e ganhe "
                    : "Comece por onde quiser — acenda as 5 e ganhe "}
                  <Text style={{ fontFamily: fonte.media, color: corCaminho.sementinhasTexto }}>
                    Sementinhas
                  </Text>{" "}
                  🌱
                </>
              )}
            </Text>
          ) : null}
        </Vidro>
      </ScrollView>

      {/* A seta de voltar, flutuando no canto: a bolha sobe para o lugar que o
          desenho lhe dá, e as duas dividem a mesma altura sem se tocar. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Voltar ao Caminho"
        onPress={() => {
          toque();
          voltarParaJornada();
        }}
        style={({ pressed }) => ({
          position: "absolute",
          left: 32,
          top: topo + 12,
          width: 44,
          height: 44,
          borderRadius: 22,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: corCaminho.voltarFundo,
          borderWidth: 1,
          borderColor: corCaminho.vidroBorda,
          shadowColor: corCaminho.vidroSombra,
          shadowOpacity: 0.25,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 6 },
          transform: [{ scale: pressed ? 0.96 : 1 }],
        })}
      >
        <Svg width={20} height={20} viewBox="0 0 24 24">
          <Path
            d="M15 5l-7 7 7 7"
            stroke={corCaminho.voltarSeta}
            strokeWidth={2.1}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </Pressable>
    </Fundo>
  );
}

function Fundo({ children }: { children: ReactNode }) {
  return (
    <LinearGradient
      colors={[
        corCaminho.diaFundo1,
        corCaminho.diaFundo2,
        corCaminho.diaFundo3,
        corCaminho.diaFundo4,
      ]}
      locations={[0, 0.34, 0.68, 1]}
      style={{ flex: 1 }}
    >
      {children}
    </LinearGradient>
  );
}

/** O cartão de vidro da folha: base quase branca, luz por cima, borda clara. */
function Vidro({ children, raio, estilo }: { children: ReactNode; raio: number; estilo?: object }) {
  return (
    <View
      style={{
        borderRadius: raio,
        backgroundColor: corCaminho.vidroBase,
        borderWidth: 1,
        borderColor: corCaminho.vidroBorda,
        shadowColor: corCaminho.vidroSombra,
        shadowOpacity: 0.22,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 10 },
      }}
    >
      <LinearGradient
        colors={[corCaminho.vidroLuzForte, corCaminho.vidroLuzFraca, corCaminho.vidroLuzFraca]}
        locations={[0, 0.52, 1]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={[{ borderRadius: raio }, estilo]}
      >
        {children}
      </LinearGradient>
    </View>
  );
}
