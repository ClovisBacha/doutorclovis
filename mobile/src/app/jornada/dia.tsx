import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import Check from "lucide-react-native/icons/check";
import ChevronLeft from "lucide-react-native/icons/chevron-left";
import ChevronRight from "lucide-react-native/icons/chevron-right";
import { useEffect, type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Botao, Carregando, toque, Tocavel } from "~/componentes/base";
import { CEUS, CeuVivo, sombraDoTexto, useFaseDoCeu, type FaseDoCeu } from "~/componentes/ceu-vivo";
import { EstrelaDoDia } from "~/componentes/caminho/pecas";
import { ARTE, FICHA } from "~/componentes/jornada/hoje";
import { Vidro } from "~/componentes/vidro";
import { rota } from "~/componentes/jornada/bancada";
import { voltarParaJornada } from "~/componentes/jornada/pecas";
import { useJornada } from "~/componentes/jornada/usarJornada";
import { ArteDaBolha, useParalaxe } from "~/componentes/movimento";
import { ehBancada, parametroDaBancada } from "~/lib/bancada";
import {
  ordemDaSugestao,
  sugestao,
  type ContextoDaBolha,
  type Destino,
  type Fala,
} from "~/lib/bolha/conversa";
import { primeiroNome } from "~/lib/gestacao";
import { tituloDaAulaDoApp } from "~/lib/jornada/aulas-do-app";
import { falaDoDiaQuePassou } from "~/lib/jornada/bolha-nos-cuidados";
import { CHAVE_CHECKIN, lerCheckin, marcouHumorHoje } from "~/lib/jornada/caminho";
import { cuidadosDoDia, type ChaveDoCuidado } from "~/lib/jornada/hoje";
import { contarMomentos, flagsDoDia, TOTAL_DO_DIA } from "~/lib/jornada/momentos";
import { chama as calcularChama } from "~/lib/jornada/trilha";
import { ALVO_MINIMO, canto, cor, curva, escala, espaco, fonte, luz, margem, sombra } from "~/tema";

/**
 * A FOLHA DO DIA — "O seu cuidado de hoje", a tela que abre ao tocar num nó
 * da trilha. A Bolha guia no alto, a lista dos cinco cuidados com os mesmos
 * nomes da aba do Bebê (`cuidadosDoDia`) e, fixo no pé, o botão que faz o dia
 * andar (como o COMEÇAR do Duolingo, 18/11/2026).
 *
 * A BOLHA GUIA (19/11/2026, o dono: "o bebê bolha será esse guia neste
 * caminho"): a fala dela é a do cérebro (`lib/bolha/conversa.ts`, `sugestao`),
 * que lê a hora, o humor marcado hoje e o que já foi feito — de manhã ela
 * puxa a aula, à noite respirar e ler para o bebê, num dia cansado o mais
 * leve. E o "Começar" do pé é EXATAMENTE o cuidado que ela sugeriu: a fala e o
 * botão nunca discordam. Com os cinco feitos, ela festeja; à noite, oferece
 * os sons. Num dia que passou, ela mostra o que foi feito, sem cobrar.
 *
 * Cada linha abre a atividade que o app já tem (aula, mexer, meditar, a carta
 * e a gratidão), feita ou não: feito não é desabilitado. ⚠️ Diferença
 * deliberada do site: lá um dia PASSADO também abre as atividades, só que sem
 * valer nada; aqui as telas de atividade marcam sempre o dia de HOJE, então o
 * dia passado mostra o que foi feito e não abre nada — abrir marcaria hoje em
 * nome de ontem.
 */

const ROTA: Record<ChaveDoCuidado, string> = {
  aula: "/jornada/aula",
  movement: "/jornada/mexer",
  meditation: "/jornada/meditar",
  bonding: "/jornada/bebe",
  gratitude: "/jornada/gratidao",
};

const ehCuidado = (d: Destino): d is ChaveDoCuidado => d !== "dormir" && d !== "trilha";

/** A hora que escolhe o céu e a fala (`&hora=` na bancada, como o céu). */
function horaDaFolha(): number {
  const h = Number(parametroDaBancada("hora"));
  return ehBancada() && parametroDaBancada("hora") != null && Number.isFinite(h) && h >= 0 && h < 24
    ? h
    : new Date().getHours();
}

/** "2 min · O sono" → "O sono": feito, o tempo que leva já não importa. */
const semOTempo = (sub: string) => sub.replace(/^\d+ min · /, "");

export default function FolhaDoDia() {
  const { dia, loja } = useJornada();
  const { D: pedido } = useLocalSearchParams<{ D?: string }>();
  const insets = useSafeAreaInsets();
  const fase = useFaseDoCeu();
  const hojeD = dia.modo === "gestacao" ? dia.D : null;
  const n = Number(pedido);
  const D =
    hojeD != null ? (Number.isFinite(n) && n >= 7 && n <= hojeD ? Math.floor(n) : hojeD) : null;

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
  /* Os mesmos nomes da aba do Bebê: a semana DESTE dia e o assunto da aula dele. */
  const cuidados = cuidadosDoDia({
    flags,
    semana: Math.floor(D / 7),
    nomeDoBebe,
    assuntoDaAula: tituloDaAulaDoApp(D),
  });

  /* A Bolha: hoje, o cérebro escolhe a fala e o próximo cuidado pelo momento. */
  const hora = horaDaFolha();
  const checkin = lerCheckin(loja.blob[CHAVE_CHECKIN]);
  const contexto: ContextoDaBolha = {
    hora,
    D,
    modo: "gestacao",
    nomeDela: primeiroNome(dia.perfil.display_name),
    nomeDoBebe,
    semana: Math.floor(D / 7),
    feitos: cuidados.filter((c) => c.feito).map((c) => c.chave),
    humor: marcouHumorHoje(checkin, new Date()) ? (checkin.mood ?? null) : null,
    chama: calcularChama(loja.blob, D).dias,
  };
  const fala: Pick<Fala, "texto" | "pose"> = ehHoje
    ? sugestao(contexto)
    : {
        texto: falaDoDiaQuePassou(feitos, TOTAL_DO_DIA),
        pose: feitos >= TOTAL_DO_DIA ? "orgulhosa" : "feliz",
      };
  const ordem = ehHoje ? ordemDaSugestao(contexto) : [];
  /* A ação principal é o cuidado que a Bolha acabou de sugerir. */
  const proxima = ordem.find(ehCuidado) ?? null;
  const cuidadoSugerido = cuidados.find((c) => c.chave === proxima) ?? null;
  const sonsDaNoite = !proxima && ordem.includes("dormir");
  const abrir = (c: ChaveDoCuidado) => router.push(rota(ROTA[c]) as never);

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
          <ArteDaBolha humor={fala.pose} tamanho={140} />
          {/* O balão: o rabinho aponta para CIMA, para a bolha — é o que faz o
              texto ser fala dela em vez de mais um cartão da tela. Branco
              opaco (o translúcido ficava encardido no céu da noite), e o
              rabinho por cima do corpo, sem emenda à vista. */}
          <View style={{ marginTop: -24, width: 320, maxWidth: "100%" }}>
            <View
              accessibilityLiveRegion="polite"
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
                {fala.texto}
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
            {ehHoje ? "O seu cuidado de hoje" : "O cuidado deste dia"}
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
              Os cuidados contam no dia de hoje.
            </Text>
          ) : null}
        </View>

        {/* Os cinco numa lista só, cada um com o seu objeto. */}
        <View
          style={{
            marginTop: espaco.md,
            borderRadius: canto.cartao,
            ...curva,
            paddingVertical: 4,
            ...MATERIAL,
          }}
        >
          {cuidados.map(({ chave: c, titulo, sub, feito: fez }, i) => (
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
                accessibilityLabel={`${titulo}. ${fez ? "Feito" : sub}`}
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
                  <Image source={ARTE[c]} style={{ width: 46, height: 46 }} contentFit="contain" />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    style={{
                      ...fonte.forte,
                      ...escala.chamada,
                      color: fez ? cor.textoApagado : cor.texto,
                    }}
                  >
                    {titulo}
                  </Text>
                  <Text
                    numberOfLines={2}
                    style={{
                      marginTop: 1,
                      ...fonte.normal,
                      ...escala.nota,
                      color: cor.textoApagado,
                    }}
                  >
                    {fez ? `Feito · ${semOTempo(sub)}` : sub}
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
          ))}
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

      {/* A AÇÃO PRINCIPAL, fixa no pé: começar o que a Bolha sugeriu; com os
          cinco feitos, os sons à noite ou a volta à trilha. Num dia que
          passou, nada a começar. */}
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
          {cuidadoSugerido ? (
            <Botao
              rotulo={`Começar: ${cuidadoSugerido.titulo}`}
              tamanho="grande"
              aoTocar={() => abrir(cuidadoSugerido.chave)}
            />
          ) : sonsDaNoite ? (
            <Botao
              rotulo="Sons para a noite"
              tamanho="grande"
              aoTocar={() => router.push(rota("/jornada/dormir") as never)}
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
