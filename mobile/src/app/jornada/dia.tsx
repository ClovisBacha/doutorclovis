import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { Check, ChevronLeft, ChevronRight, Star } from "lucide-react-native";
import { useEffect, useState, type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { tituloCurtoDaAula } from "~/lib/jornada/aula";
import { temQuizNoDia, type DailyQuiz } from "@/lib/daily-quizzes";
import { carregarAulaDoDia } from "~/lib/jornada/aulas-do-app";
import { recadoDaBolhaNoApp } from "~/lib/recado-da-bolha";
import { Carregando, toque } from "~/componentes/base";
import { CEUS, CeuVivo, useFaseDoCeu } from "~/componentes/ceu-vivo";
import { META_DAS_ATIVIDADES } from "~/componentes/caminho/cores";
import { EstrelaDoDia } from "~/componentes/caminho/pecas";
import { ARTE, FICHA } from "~/componentes/jornada/hoje";
import { Painel } from "~/componentes/painel";
import { Vidro } from "~/componentes/vidro";
import { rota } from "~/componentes/jornada/bancada";
import { voltarParaJornada } from "~/componentes/jornada/pecas";
import { useJornada } from "~/componentes/jornada/usarJornada";
import { ArteDaBolha, useParalaxe, type HumorDaArte } from "~/componentes/movimento";
import {
  contarMomentos,
  feito,
  flagsDoDia,
  TOTAL_DO_DIA,
  type Momento,
} from "~/lib/jornada/momentos";
import { aperto, cor, curva, espaco, fonte, luz, sombra } from "~/tema";

/**
 * A FOLHA DO DIA — "Atividades de hoje", a tela que abre ao tocar num nó do
 * Caminho. A bolha com um balão de fala, as cinco atividades e o placar das
 * estrelas no pé — sobre o céu da hora, como as abas (16/11/2026: antes era
 * um degradê cor-de-rosa, com ícones chapados; agora as atividades levam os
 * objetos 3D da aba do bebê, numa lista só dentro de um painel de vidro).
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
    void carregarAulaDoDia(D).then((q) => {
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
  const recado = recadoDaBolhaNoApp({
    feitos,
    total: TOTAL_DO_DIA,
    dia: D,
    hora,
    bebe: nomeDoBebe ?? undefined,
    semana: Math.floor(D / 7),
    posParto: false,
    careMode: false,
  });
  const descDaAula = quiz && quiz !== "carregando" ? tituloCurtoDaAula(quiz.teach) : "Aula de hoje";

  const momentoDe = (c: Chave): Momento => (c === "aula" ? "aula" : c);

  return (
    <Fundo>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 14, paddingTop: topo + 12, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ alignItems: "center", marginTop: 4 }}>
          <ArteDaBolha humor={humorDoDia(feitos, hora)} tamanho={210} />
          {/* O balão: o rabinho aponta para CIMA, para a bolha — é o que faz o
              texto ser fala dela em vez de mais um cartão da tela. */}
          <View style={{ marginTop: -36, width: 280, maxWidth: "100%" }}>
            <View
              style={{
                position: "absolute",
                left: "50%",
                top: -7,
                marginLeft: -8,
                width: 16,
                height: 16,
                borderRadius: 3,
                backgroundColor: luz.cartao,
                transform: [{ rotate: "45deg" }],
              }}
            />
            <View
              style={{
                borderRadius: 24,
                ...curva,
                paddingHorizontal: 20,
                paddingVertical: 16,
                backgroundColor: luz.cartao,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: "rgba(255,255,255,0.95)",
                ...sombra,
              }}
            >
              <Text
                style={{
                  textAlign: "center",
                  ...fonte.media,
                  fontSize: 15,
                  lineHeight: 22,
                  color: TINTA.corpo,
                }}
              >
                {recado}
              </Text>
            </View>
          </View>
        </View>

        <Painel estilo={{ marginTop: 22 }}>
          <View style={{ paddingHorizontal: 4 }}>
            <Text
              accessibilityRole="header"
              style={{
                ...fonte.titulo,
                fontSize: 24,
                lineHeight: 29,
                letterSpacing: aperto.titulo,
                color: TINTA.titulo,
              }}
            >
              {ehHoje ? "Atividades de hoje" : "As atividades deste dia"}
            </Text>
            {!ehHoje ? (
              <Text style={{ marginTop: 2, ...fonte.media, fontSize: 14, color: TINTA.apagado }}>
                Esse dia já passou: as atividades valem no dia de hoje.
              </Text>
            ) : null}
          </View>

          {/* As cinco numa lista só, cada uma com o seu objeto. */}
          <View style={{ borderRadius: 26, ...curva, paddingVertical: 4, ...MATERIAL }}>
            {ORDEM.map((c, i) => {
              const meta = META_DAS_ATIVIDADES[c];
              const fez = feito(flags, momentoDe(c));
              return (
                <View key={c}>
                  {i > 0 ? (
                    <View
                      style={{
                        height: StyleSheet.hairlineWidth,
                        marginLeft: 82,
                        backgroundColor: cor.borda,
                      }}
                    />
                  ) : null}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${meta.titulo}${fez ? ", feita" : ""}`}
                    accessibilityState={{ disabled: !ehHoje }}
                    disabled={!ehHoje}
                    onPress={() => {
                      toque();
                      router.push(rota(ROTA[c]) as never);
                    }}
                    style={({ pressed }) => ({
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 14,
                      paddingVertical: 10,
                      paddingLeft: 12,
                      paddingRight: 14,
                      opacity: pressed ? 0.6 : 1,
                    })}
                  >
                    <View
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: 18,
                        ...curva,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: FICHA[c],
                      }}
                    >
                      <Image
                        source={ARTE[c]}
                        style={{ width: 46, height: 46 }}
                        contentFit="contain"
                      />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text
                        style={{
                          ...fonte.forte,
                          fontSize: 16,
                          lineHeight: 21,
                          color: fez ? TINTA.apagado : TINTA.titulo,
                        }}
                      >
                        {meta.titulo}
                      </Text>
                      <Text
                        numberOfLines={2}
                        style={{
                          marginTop: 1,
                          ...fonte.media,
                          fontSize: 13.5,
                          lineHeight: 18,
                          color: TINTA.apagado,
                        }}
                      >
                        {fez ? "Feito" : c === "aula" ? descDaAula : meta.desc}
                      </Text>
                    </View>
                    {fez ? (
                      <View
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: 13,
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: "#12a06c",
                        }}
                      >
                        <Check size={15} color={cor.branco} strokeWidth={3.2} />
                      </View>
                    ) : ehHoje ? (
                      <ChevronRight size={20} color="#c3bad6" strokeWidth={2.4} />
                    ) : null}
                  </Pressable>
                </View>
              );
            })}
          </View>
        </Painel>

        <Painel estilo={{ marginTop: 14, alignItems: "center", paddingVertical: 18 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Star size={18} color="#d97706" fill="#fbbf24" strokeWidth={2} />
            <Text style={{ ...fonte.forte, fontSize: 15, color: TINTA.titulo }}>
              {ehHoje ? "Estrelas de hoje" : "Estrelas deste dia"}
            </Text>
          </View>
          <View
            accessible
            accessibilityRole="image"
            accessibilityLabel={`${feitos} de ${TOTAL_DO_DIA} estrelas conquistadas`}
            style={{ flexDirection: "row", justifyContent: "center", gap: 14 }}
          >
            {Array.from({ length: TOTAL_DO_DIA }, (_, i) => (
              <EstrelaDoDia key={i} acesa={i < feitos} tamanho={40} />
            ))}
          </View>
          <Text
            style={{
              textAlign: "center",
              ...fonte.media,
              fontSize: 14,
              lineHeight: 20,
              color: TINTA.apagado,
            }}
          >
            <Text style={{ ...fonte.titulo, color: TINTA.titulo, fontVariant: ["tabular-nums"] }}>
              {feitos}/{TOTAL_DO_DIA}
            </Text>{" "}
            {ehHoje
              ? feitos >= TOTAL_DO_DIA
                ? "— o dia está completo."
                : feitos > 0
                  ? "— acenda as cinco e ganhe Sementinhas."
                  : "— comece por onde quiser."
              : "estrelas neste dia."}
          </Text>
        </Painel>
      </ScrollView>

      {/* A seta de voltar: um botão de vidro solto sobre o céu. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Voltar ao Caminho"
        onPress={() => {
          toque();
          voltarParaJornada();
        }}
        style={({ pressed }) => ({
          position: "absolute",
          left: 16,
          top: topo + 8,
          transform: [{ scale: pressed ? 0.96 : 1 }],
        })}
      >
        <Vidro
          interativo
          tinta="rgba(255,255,255,0.6)"
          estilo={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
        >
          <ChevronLeft size={22} color={TINTA.titulo} strokeWidth={2.4} />
        </Vidro>
      </Pressable>
    </Fundo>
  );
}

/** O fundo: o céu da hora, vivo, na tela inteira (o mesmo das abas). */
function Fundo({ children }: { children: ReactNode }) {
  const fase = useFaseDoCeu();
  const { x, y } = useParalaxe();
  return (
    <View style={{ flex: 1, backgroundColor: CEUS[fase].chao }}>
      <CeuVivo fase={fase} x={x} y={y} />
      {children}
    </View>
  );
}

const TINTA = { titulo: cor.texto, corpo: "#463d63", apagado: cor.textoApagado } as const;

/** O material da lista: branco, com o fio de luz e a sombra em camadas. */
const MATERIAL = {
  backgroundColor: luz.cartao,
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: "rgba(255,255,255,0.9)",
  ...sombra,
} as const;
