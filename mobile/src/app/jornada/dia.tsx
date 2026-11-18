import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import Check from "lucide-react-native/icons/check";
import ChevronLeft from "lucide-react-native/icons/chevron-left";
import ChevronRight from "lucide-react-native/icons/chevron-right";
import { useEffect, useState, type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { tituloCurtoDaAula } from "~/lib/jornada/aula";
import { temQuizNoDia, type DailyQuiz } from "@/lib/daily-quizzes";
import { carregarAulaDoDia } from "~/lib/jornada/aulas-do-app";
import { recadoDaBolhaNoApp } from "~/lib/recado-da-bolha";
import { Botao, Carregando, toque, Tocavel } from "~/componentes/base";
import { CEUS, CeuVivo, sombraDoTexto, useFaseDoCeu, type FaseDoCeu } from "~/componentes/ceu-vivo";
import { META_DAS_ATIVIDADES } from "~/componentes/caminho/cores";
import { EstrelaDoDia } from "~/componentes/caminho/pecas";
import { ARTE, FICHA } from "~/componentes/jornada/hoje";
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
import { ALVO_MINIMO, canto, cor, curva, escala, espaco, fonte, luz, margem, sombra } from "~/tema";

/**
 * A FOLHA DO DIA — "Atividades de hoje", a tela que abre ao tocar num nó da
 * trilha. A bolha com um balão de fala, o título e as estrelas direto no céu,
 * a lista das cinco atividades e, fixo no pé, o botão que faz o dia andar:
 * "Começar" a primeira que falta (como o COMEÇAR do Duolingo, 18/11/2026 — a
 * folha não tinha ação principal, e ela precisava descobrir qual linha tocar).
 *
 * Cada linha abre a atividade que o app já tem (aula, mexer, meditar, a carta
 * e a gratidão), feita ou não: feito não é desabilitado. ⚠️ Diferença
 * deliberada do site: lá um dia PASSADO também abre as atividades, só que sem
 * valer nada; aqui as telas de atividade marcam sempre o dia de HOJE, então o
 * dia passado mostra o que foi feito e não abre nada — abrir marcaria hoje em
 * nome de ontem.
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

const momentoDe = (c: Chave): Momento => (c === "aula" ? "aula" : c);

export default function FolhaDoDia() {
  const { dia, loja } = useJornada();
  const { D: pedido } = useLocalSearchParams<{ D?: string }>();
  const insets = useSafeAreaInsets();
  const fase = useFaseDoCeu();
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
     volta para a trilha, que sabe o que oferecer. */
  const semDia = dia.modo !== "carregando" && (dia.modo !== "gestacao" || dia.cuidado);
  useEffect(() => {
    if (semDia) voltarParaJornada();
  }, [semDia]);

  if (dia.modo === "carregando" || D == null || hojeD == null) {
    return (
      <Fundo fase={fase}>
        <Carregando texto="Abrindo o seu dia…" />
      </Fundo>
    );
  }
  if (dia.modo !== "gestacao" || dia.cuidado) return null;

  const ceu = CEUS[fase];
  const sombraNoCeu = sombraDoTexto(ceu);
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
  /* A ação principal: a primeira atividade que falta, na ordem da lista. */
  const proxima = ORDEM.find((c) => !feito(flags, momentoDe(c))) ?? null;
  const abrir = (c: Chave) => router.push(rota(ROTA[c]) as never);

  return (
    <Fundo fase={fase}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: margem.tela,
          paddingTop: insets.top + 12,
          paddingBottom: insets.bottom + espaco.xxl + (ehHoje ? 54 + 26 : 0),
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ alignItems: "center", marginTop: 4 }}>
          <ArteDaBolha humor={humorDoDia(feitos, hora)} tamanho={140} />
          {/* O balão: o rabinho aponta para CIMA, para a bolha — é o que faz o
              texto ser fala dela em vez de mais um cartão da tela. Branco
              opaco (o translúcido ficava encardido no céu da noite), e o
              rabinho por cima do corpo, sem emenda à vista. */}
          <View style={{ marginTop: -24, width: 300, maxWidth: "100%" }}>
            <View
              style={{
                borderRadius: canto.cartao,
                ...curva,
                paddingHorizontal: 20,
                paddingVertical: 14,
                backgroundColor: cor.cartao,
                ...sombra,
              }}
            >
              <Text
                style={{
                  textAlign: "center",
                  ...fonte.media,
                  ...escala.legenda,
                  lineHeight: 21,
                  color: cor.textoCorpo,
                }}
              >
                {recado}
              </Text>
            </View>
            <View
              style={{
                position: "absolute",
                left: "50%",
                top: -7,
                marginLeft: -8,
                width: 16,
                height: 16,
                borderRadius: 3,
                backgroundColor: cor.cartao,
                transform: [{ rotate: "45deg" }],
              }}
            />
          </View>
        </View>

        {/* O título e as estrelas direto no céu, sem moldura. */}
        <View style={{ marginTop: espaco.xl, paddingHorizontal: 4, gap: 6 }}>
          <Text
            accessibilityRole="header"
            style={{
              ...fonte.display,
              ...escala.titulo1,
              letterSpacing: -0.2,
              color: ceu.tinta,
              ...sombraNoCeu,
            }}
          >
            {ehHoje ? "Atividades de hoje" : "As atividades deste dia"}
          </Text>
          <View
            accessible
            accessibilityRole="image"
            accessibilityLabel={`${feitos} de ${TOTAL_DO_DIA} estrelas`}
            style={{ flexDirection: "row", alignItems: "center", gap: espaco.sm }}
          >
            <View style={{ flexDirection: "row", gap: 3 }}>
              {Array.from({ length: TOTAL_DO_DIA }, (_, i) => (
                <EstrelaDoDia key={i} acesa={i < feitos} tamanho={18} />
              ))}
            </View>
            <Text
              style={{
                ...fonte.titulo,
                ...escala.nota,
                fontVariant: ["tabular-nums"],
                color: ceu.sec,
                ...sombraNoCeu,
              }}
            >
              {feitos}/{TOTAL_DO_DIA}
            </Text>
          </View>
          {!ehHoje ? (
            <Text style={{ ...fonte.media, ...escala.legenda, color: ceu.sec, ...sombraNoCeu }}>
              Esse dia já passou. As atividades valem no dia de hoje.
            </Text>
          ) : null}
        </View>

        {/* As cinco numa lista só, cada uma com o seu objeto. */}
        <View
          style={{
            marginTop: espaco.md,
            borderRadius: canto.cartao,
            ...curva,
            paddingVertical: 4,
            ...MATERIAL,
          }}
        >
          {ORDEM.map((c, i) => {
            const meta = META_DAS_ATIVIDADES[c];
            const fez = feito(flags, momentoDe(c));
            const desc = c === "aula" ? descDaAula : meta.desc;
            /* Num dia que passou, a aula não é "de hoje". */
            const titulo = c === "aula" && !ehHoje ? "Aula do dia" : meta.titulo;
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
                {/* A linha de lista do iOS: o toque acende (esmaece), não encolhe. */}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${titulo}${fez ? ", feita" : ""}`}
                  accessibilityState={{ disabled: !ehHoje }}
                  disabled={!ehHoje}
                  onPress={() => {
                    toque();
                    abrir(c);
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
                    <Text style={{ ...fonte.forte, ...escala.chamada, color: cor.texto }}>
                      {titulo}
                    </Text>
                    <Text
                      numberOfLines={3}
                      style={{
                        marginTop: 1,
                        ...fonte.normal,
                        ...escala.nota,
                        color: cor.textoApagado,
                      }}
                    >
                      {fez ? `Feito · ${desc}` : desc}
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
                        backgroundColor: cor.ok,
                      }}
                    >
                      <Check size={15} color={cor.branco} strokeWidth={3.2} />
                    </View>
                  ) : ehHoje ? (
                    <ChevronRight size={20} color={cor.chevron} strokeWidth={2.4} />
                  ) : null}
                </Pressable>
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* A seta de voltar: um botão de vidro solto sobre o céu. */}
      <View style={{ position: "absolute", left: margem.tela, top: insets.top + 8 }}>
        <Tocavel rotulo="Voltar à trilha" aoTocar={voltarParaJornada} profundidade={0.94}>
          <Vidro
            interativo
            tinta="rgba(255,255,255,0.6)"
            estilo={{
              width: ALVO_MINIMO,
              height: ALVO_MINIMO,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ChevronLeft size={22} color={cor.texto} strokeWidth={2.4} />
          </Vidro>
        </Tocavel>
      </View>

      {/* A AÇÃO PRINCIPAL, fixa no pé: começar o que falta; com as cinco
          feitas, voltar à trilha. Num dia que passou, nada a começar. */}
      {ehHoje ? (
        <View
          pointerEvents="box-none"
          style={{
            position: "absolute",
            left: margem.tela,
            right: margem.tela,
            bottom: insets.bottom + 12,
          }}
        >
          {proxima ? (
            <Botao
              rotulo={`Começar: ${META_DAS_ATIVIDADES[proxima].titulo}`}
              tamanho="grande"
              aoTocar={() => abrir(proxima)}
            />
          ) : (
            <Tocavel rotulo="Voltar à trilha" aoTocar={voltarParaJornada}>
              <Vidro
                interativo
                tinta="rgba(255,255,255,0.72)"
                estilo={{ minHeight: 54, alignItems: "center", justifyContent: "center" }}
              >
                <Text style={{ ...fonte.forte, ...escala.manchete, color: cor.texto }}>
                  Voltar à trilha
                </Text>
              </Vidro>
            </Tocavel>
          )}
        </View>
      ) : null}
    </Fundo>
  );
}

/** O fundo: o céu da hora, vivo, na tela inteira (o mesmo das abas). */
function Fundo({ fase, children }: { fase: FaseDoCeu; children: ReactNode }) {
  const { x, y } = useParalaxe();
  return (
    <View style={{ flex: 1, backgroundColor: CEUS[fase].chao }}>
      <CeuVivo fase={fase} x={x} y={y} />
      {children}
    </View>
  );
}

/** O material da lista: branco, com o fio de luz e a sombra em camadas. */
const MATERIAL = {
  backgroundColor: luz.cartao,
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: "rgba(255,255,255,0.9)",
  ...sombra,
} as const;
