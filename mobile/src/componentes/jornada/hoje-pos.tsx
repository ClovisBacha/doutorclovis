import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useState, type ReactNode } from "react";
import { Animated, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { toque } from "~/componentes/base";
import { BotaoDaAtividade, Brilho, sombraDe } from "~/componentes/jornada/atividade";
import {
  AnelDoDia,
  ARTE,
  CEUS,
  ceuDaHora,
  Entrar,
  FICHA,
  FUNDO,
  Selo,
  useMomentoDoDia,
} from "~/componentes/jornada/hoje";
import { rota } from "~/componentes/jornada/bancada";
import { RECEM_NASCIDO } from "~/componentes/jornada/nascimento";
import { Confete } from "~/componentes/jornada/pecas";
import { ArteDaBolha, Flutuar, type HumorDaArte } from "~/componentes/movimento";
import { CVV } from "~/config";
import { ligar } from "~/lib/links";
import {
  faseDoPos,
  figurinhaDoPos,
  HUMORES_DO_POS,
  humorPedeApoio,
  nestaSemanaDoPos,
  TAREFAS_DO_POS,
  tarefasFeitas,
} from "~/lib/jornada/pos-parto";
import type { FlagsDoDia } from "~/lib/jornada/momentos";
import { cor, espaco, fonte } from "~/tema";

/**
 * HOJE, NO 4º TRIMESTRE — a mesma tela do cuidado diário, agora com o bebê no
 * colo: o céu da hora, o recém-nascido enrolado na manta (e não mais o feto da
 * semana), e o dia do `PosPartoJourney` do site — TRÊS tarefas que fecham o
 * dia (como você está, o desafio, a leitura da semana) e ganham a
 * figurinha da semana de vida. Respirar, o momento com o bebê e a gratidão
 * ficam "para quando sobrar um minuto": acendem a chama e não cobram nada.
 *
 * "Triste" no check-in abre o apoio: o CVV (188) e o SOS. Sem "fale com o seu
 * médico": o app não encaminha (decisão do dono, 21/10/2026) — o que preocupa
 * mora no SOS.
 */

export type AtividadeDoPos = "meditation" | "bonding" | "gratitude";

/**
 * Respirar, o bebê e a gratidão. O "Mexer devagar" saiu: no site ele vinha "só
 * se o médico já liberou", e o app não tem médico para liberar exercício no
 * pós-parto (decisão do dono, 21/10/2026).
 */
const ATIVIDADES_DO_POS: readonly AtividadeDoPos[] = ["meditation", "bonding", "gratitude"];

const TEXTO_DA_ATIVIDADE: Record<
  AtividadeDoPos,
  (quem: string) => { titulo: string; sub: string }
> = {
  meditation: () => ({ titulo: "Respirar devagar", sub: "3 min · a mente desacelera" }),
  bonding: (quem) => ({
    titulo: `Um momento com ${quem}`,
    sub: "Cantar, conversar, olhar nos olhos",
  }),
  gratitude: () => ({
    titulo: "Guardar uma coisa boa",
    sub: "1 min · vira lembrança destes dias",
  }),
};

export function TelaDoQuartoTrimestre({
  D,
  pronto,
  idadeDias,
  semana,
  formou,
  saudacao,
  data,
  hora,
  nomeDoBebe,
  flags,
  humorDeHoje,
  desafio,
  recado,
  chama,
  figurinhas,
  avisos,
  amigas,
  agenda,
  extra,
  aoMarcarHumor,
  aoFazerDesafio,
  aoLerASemana,
  aoAbrir,
  aoVerTrilha,
  aoVerAlbum,
  direita,
}: {
  D: number;
  /** A jornada já foi lida do aparelho (`loja.pronto`). */
  pronto: boolean;
  idadeDias: number;
  /** A semana de vida (1–12). */
  semana: number;
  /** Passou das 12 semanas: a jornada do 4º trimestre terminou. */
  formou: boolean;
  saudacao: string;
  data: string;
  hora: number;
  nomeDoBebe: string | null;
  /** As flags do dia de hoje (`dc-path-pos-day-<D>`). */
  flags: FlagsDoDia;
  /** O humor marcado hoje, se já foi. */
  humorDeHoje: string | null;
  desafio: { emoji: string; label: string } | null;
  recado: string;
  chama: number;
  /** Todas as figurinhas: as da gestação e as do 4º trimestre. */
  figurinhas: number;
  avisos?: ReactNode;
  /** As amigas (sem a dupla, que não existe no pós-parto), logo depois das tarefas. */
  amigas?: ReactNode;
  agenda?: ReactNode;
  /** O que vem depois do álbum (as conquistas). */
  extra?: ReactNode;
  aoMarcarHumor: (humor: string) => void;
  aoFazerDesafio: () => void;
  aoLerASemana: () => void;
  aoAbrir: (a: AtividadeDoPos) => void;
  aoVerTrilha: () => void;
  aoVerAlbum: () => void;
  /** O canto direito do topo: a foto dela, que abre o Perfil. */
  direita?: ReactNode;
}) {
  const topo = useSafeAreaInsets().top;
  const ceu = CEUS[ceuDaHora(hora)];
  const quem = nomeDoBebe ?? "o bebê";
  const feitos = tarefasFeitas(flags);
  const total = TAREFAS_DO_POS.length;
  const { pulso, brilho, festa } = useMomentoDoDia(D, feitos, total, "pos", pronto);
  const [semanaAberta, setSemanaAberta] = useState(false);
  const fase = faseDoPos(semana);
  const humorDaBolha: HumorDaArte =
    feitos >= total ? "orgulhosa" : humorPedeApoio(humorDeHoje) ? "apaixonado" : "feliz";

  return (
    <View style={{ flex: 1, backgroundColor: FUNDO }}>
      <ScrollView
        style={{ flex: 1, backgroundColor: FUNDO }}
        contentContainerStyle={{ paddingBottom: espaco.xxl }}
        showsVerticalScrollIndicator={false}
      >
        {/* O céu da hora, com o recém-nascido — o herói da tela. */}
        <View style={{ height: 430 + topo, overflow: "hidden" }}>
          <Image
            source={ceu.arte}
            style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}
            contentFit="cover"
            accessibilityIgnoresInvertColors
          />
          <LinearGradient
            colors={["rgba(255,248,245,0)", FUNDO]}
            style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 120 }}
          />
          <Animated.View
            pointerEvents="none"
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: 0,
              bottom: 0,
              backgroundColor: "#fff7e0",
              opacity: brilho,
            }}
          />
          <View
            style={{
              paddingTop: topo + espaco.lg,
              paddingHorizontal: 20,
              flexDirection: "row",
              alignItems: "flex-start",
              justifyContent: "space-between",
            }}
          >
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontFamily: fonte.titulo,
                  fontSize: 12,
                  letterSpacing: 1.4,
                  textTransform: "uppercase",
                  color: ceu.sec,
                }}
              >
                {data}
              </Text>
              <Text
                accessibilityRole="header"
                style={{
                  marginTop: 2,
                  fontFamily: fonte.titulo,
                  fontSize: 31,
                  lineHeight: 37,
                  letterSpacing: -0.5,
                  color: ceu.tinta,
                }}
              >
                {saudacao}
              </Text>
            </View>
            {direita}
          </View>
          <View style={{ alignItems: "center", marginTop: 2 }}>
            <View style={{ alignItems: "center", justifyContent: "center" }}>
              <Brilho tamanho={240} />
              <Flutuar>
                <Image
                  source={RECEM_NASCIDO}
                  style={{ width: 186, height: 186 }}
                  contentFit="contain"
                  accessibilityLabel={`${quem} numa manta quentinha, nos primeiros dias`}
                />
              </Flutuar>
            </View>
            {nomeDoBebe ? (
              <Text style={{ fontFamily: fonte.titulo, fontSize: 22, color: "#2e2348" }}>
                {nomeDoBebe}
              </Text>
            ) : null}
            <Text
              style={{
                marginTop: 2,
                paddingHorizontal: espaco.lg,
                textAlign: "center",
                fontFamily: fonte.forte,
                fontSize: 14,
                color: "#5d4d84",
              }}
            >
              {formou
                ? "12 semanas completas 🎓"
                : `${idadeDias + 1}º dia de vida · semana ${semana} de vida`}
            </Text>
            <View style={{ flexDirection: "row", gap: espaco.sm, marginTop: 10 }}>
              <Selo>
                🍼{" "}
                {idadeDias === 0
                  ? "nasceu hoje"
                  : `${idadeDias} ${idadeDias === 1 ? "dia" : "dias"} de vocês`}
              </Selo>
              <Selo>
                {fase.emoji} {fase.name}
              </Selo>
            </View>
          </View>
        </View>

        {/* A folha que sobe sobre o céu. */}
        <View
          style={{
            marginTop: -34,
            borderTopLeftRadius: 32,
            borderTopRightRadius: 32,
            backgroundColor: FUNDO,
            paddingHorizontal: 18,
            paddingTop: 22,
            gap: espaco.md,
          }}
        >
          {avisos}

          {formou ? (
            <Formatura quem={quem} />
          ) : (
            <>
              <View style={{ flexDirection: "row", alignItems: "center", gap: espaco.md }}>
                <View style={{ flex: 1 }}>
                  <Text
                    accessibilityRole="header"
                    style={{
                      fontFamily: fonte.titulo,
                      fontSize: 24,
                      letterSpacing: -0.3,
                      color: "#3a2230",
                    }}
                  >
                    O cuidado de hoje
                  </Text>
                  <Text
                    style={{
                      marginTop: 2,
                      fontFamily: fonte.media,
                      fontSize: 14,
                      color: "#9a7486",
                    }}
                  >
                    Três gestos, no seu ritmo
                  </Text>
                </View>
                <Animated.View style={{ transform: [{ scale: pulso }] }}>
                  <AnelDoDia feitos={feitos} total={total} cor="#0ea5e9" vazio="#d6eefb" />
                </Animated.View>
              </View>

              {/* A bolha, pequena: a personagem que acompanha. */}
              <View style={{ flexDirection: "row", alignItems: "center", gap: espaco.sm }}>
                <ArteDaBolha humor={humorDaBolha} tamanho={58} />
                <View
                  style={{
                    flex: 1,
                    borderRadius: 18,
                    borderTopLeftRadius: 6,
                    backgroundColor: cor.branco,
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    ...sombraDe("#b0708d", 0.6),
                  }}
                >
                  <Text
                    style={{
                      fontFamily: fonte.media,
                      fontSize: 14,
                      lineHeight: 20,
                      color: "#5b3a4a",
                    }}
                  >
                    {recado}
                  </Text>
                </View>
              </View>

              {feitos >= total ? (
                <Entrar>
                  <DiaCheioDoPos semana={semana} />
                </Entrar>
              ) : null}

              <ComoVoceEsta humorDeHoje={humorDeHoje} aoMarcar={aoMarcarHumor} />
              {humorPedeApoio(humorDeHoje) ? <Apoio /> : null}

              {desafio ? (
                <TarefaDoDia
                  emoji={desafio.emoji}
                  eyebrow="O desafio de hoje"
                  titulo={desafio.label}
                  feito={!!flags.desafio}
                  rotulo="Fiz ✓"
                  aoTocar={aoFazerDesafio}
                />
              ) : null}
              <TarefaDoDia
                emoji="📖"
                eyebrow={`Semana ${semana} de vida`}
                titulo="O que esperar com o bebê"
                feito={!!flags.leitura}
                rotulo="Ler"
                aoTocar={() => setSemanaAberta(true)}
              />
            </>
          )}

          {amigas}

          <Text
            accessibilityRole="header"
            style={{
              marginTop: espaco.sm,
              fontFamily: fonte.titulo,
              fontSize: 18,
              color: "#3a2230",
            }}
          >
            Quando sobrar um minuto
          </Text>
          <View style={{ gap: 10 }}>
            {ATIVIDADES_DO_POS.map((a) => {
              const t = TEXTO_DA_ATIVIDADE[a](quem);
              return (
                <LinhaDaAtividade
                  key={a}
                  chave={a}
                  titulo={t.titulo}
                  sub={t.sub}
                  feito={!!flags[`w_${a}`]}
                  aoAbrir={() => aoAbrir(a)}
                />
              );
            })}
          </View>

          {agenda}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Abrir o álbum de vocês"
            onPress={() => {
              toque();
              aoVerAlbum();
            }}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: espaco.md,
              borderRadius: 20,
              backgroundColor: cor.branco,
              padding: 12,
              opacity: pressed ? 0.85 : 1,
              ...sombraDe("#b0708d", 0.6),
            })}
          >
            <Image
              source={require("../../../../src/assets/bebe/album.webp")}
              style={{ width: 52, height: 52 }}
              contentFit="contain"
            />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonte.titulo, fontSize: 15, color: "#3a2230" }}>
                O álbum de vocês
              </Text>
              <Text style={{ fontFamily: fonte.media, fontSize: 13, color: "#9a7486" }}>
                {figurinhas} {figurinhas === 1 ? "figurinha" : "figurinhas"} · a gestação inteira e
                o 4º trimestre
              </Text>
            </View>
            <Text style={{ fontFamily: fonte.titulo, fontSize: 14, color: "#b0306a" }}>Ver ›</Text>
          </Pressable>

          {extra}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${chama} dias seguidos. Ver a trilha do 4º trimestre`}
            onPress={() => {
              toque();
              aoVerTrilha();
            }}
            style={({ pressed }) => ({
              marginTop: espaco.xs,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              borderRadius: 18,
              backgroundColor: "#e7f5fd",
              paddingHorizontal: 14,
              paddingVertical: 13,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <Text style={{ fontFamily: fonte.forte, fontSize: 14, color: "#075985" }}>
              {chama > 0 ? (
                <>
                  <Text style={{ fontFamily: fonte.titulo, color: "#c2571a" }}>
                    🔥 {chama} {chama === 1 ? "dia" : "dias"}
                  </Text>{" "}
                  cuidando de vocês
                </>
              ) : (
                "🍼 Um dia de cada vez"
              )}
            </Text>
            <Text style={{ fontFamily: fonte.titulo, fontSize: 14, color: "#0369a1" }}>
              Ver a trilha ›
            </Text>
          </Pressable>
        </View>
      </ScrollView>
      {festa ? <Confete pecas={60} /> : null}
      <FolhaDaSemana
        aberta={semanaAberta}
        semana={semana}
        lida={!!flags.leitura}
        aoFechar={() => setSemanaAberta(false)}
        aoLer={() => {
          aoLerASemana();
          setSemanaAberta(false);
        }}
      />
    </View>
  );
}

/** O check-in de humor: a primeira das três tarefas. Marcado, vira uma linha. */
function ComoVoceEsta({
  humorDeHoje,
  aoMarcar,
}: {
  humorDeHoje: string | null;
  aoMarcar: (humor: string) => void;
}) {
  if (humorDeHoje) {
    const h = HUMORES_DO_POS.find((x) => x.label === humorDeHoje);
    return (
      <LinhaFeita
        emoji={h?.emoji ?? "🙂"}
        titulo="Como você está hoje"
        sub={`Você disse: ${humorDeHoje.toLowerCase()}`}
      />
    );
  }
  return (
    <View
      style={{
        borderRadius: 24,
        backgroundColor: cor.branco,
        padding: espaco.lg,
        gap: 10,
        ...sombraDe("#b0708d", 0.6),
      }}
    >
      <View>
        <Text style={{ fontFamily: fonte.titulo, fontSize: 16, color: "#3a2230" }}>
          Como você está hoje, mamãe?
        </Text>
        <Text style={{ fontFamily: fonte.media, fontSize: 13, color: "#9a7486" }}>
          Seu bem-estar importa tanto quanto o do bebê 💜
        </Text>
      </View>
      <View style={{ flexDirection: "row", gap: 4 }}>
        {HUMORES_DO_POS.map((h) => (
          <Pressable
            key={h.label}
            accessibilityRole="button"
            accessibilityLabel={`Estou ${h.label.toLowerCase()}`}
            onPress={() => {
              toque();
              aoMarcar(h.label);
            }}
            style={({ pressed }) => ({
              flex: 1,
              minHeight: 64,
              alignItems: "center",
              justifyContent: "center",
              gap: 2,
              borderRadius: 18,
              backgroundColor: "#f3f8fc",
              transform: [{ scale: pressed ? 0.96 : 1 }],
            })}
          >
            <Text style={{ fontSize: 24 }}>{h.emoji}</Text>
            <Text style={{ fontFamily: fonte.media, fontSize: 13, color: "#6d5855" }}>
              {h.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/** O apoio: aparece quando ela diz que está triste. Sem alarme, com caminho. */
function Apoio() {
  return (
    <View
      style={{
        borderRadius: 22,
        backgroundColor: "#f5f0ff",
        padding: espaco.lg,
        gap: espaco.sm,
        borderWidth: 1,
        borderColor: "#e4d8ff",
      }}
    >
      <Text style={{ fontFamily: fonte.titulo, fontSize: 16, color: "#4c1d95" }}>
        Você não está sozinha 💜
      </Text>
      <Text style={{ fontFamily: fonte.media, fontSize: 14, lineHeight: 20, color: "#4b3a63" }}>
        Dias assim acontecem, e você não precisa atravessá-los sozinha. A qualquer hora, o CVV
        escuta de graça — e o SOS do app fica a um toque.
      </Text>
      <View style={{ flexDirection: "row", gap: espaco.sm }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Ligar ${CVV}, CVV, apoio emocional`}
          onPress={() => {
            toque();
            ligar(CVV);
          }}
          style={({ pressed }) => ({
            flex: 1,
            minHeight: 46,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 999,
            backgroundColor: "#6d28d9",
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Text style={{ fontFamily: fonte.titulo, fontSize: 14, color: cor.branco }}>
            Ligar {CVV} · CVV
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            toque();
            router.push(rota("/sos") as never);
          }}
          style={({ pressed }) => ({
            flex: 1,
            minHeight: 46,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 999,
            backgroundColor: cor.branco,
            borderWidth: 1,
            borderColor: "#d9c8ff",
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Text style={{ fontFamily: fonte.titulo, fontSize: 14, color: "#6d28d9" }}>
            Abrir o SOS
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

/** Uma das três tarefas (o desafio, a leitura da semana). */
function TarefaDoDia({
  emoji,
  eyebrow,
  titulo,
  feito,
  rotulo,
  aoTocar,
}: {
  emoji: string;
  eyebrow: string;
  titulo: string;
  feito: boolean;
  rotulo: string;
  aoTocar: () => void;
}) {
  if (feito) return <LinhaFeita emoji={emoji} titulo={titulo} sub={`${eyebrow} · feito 💛`} />;
  return (
    <LinearGradient
      colors={["#effaff", "#dff2fd"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        borderRadius: 24,
        padding: 16,
        borderBottomWidth: 4,
        borderBottomColor: "#bfe4f8",
      }}
    >
      <View
        style={{
          width: 58,
          height: 58,
          borderRadius: 18,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: cor.branco,
        }}
      >
        <Text style={{ fontSize: 30 }}>{emoji}</Text>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text
          style={{
            fontFamily: fonte.titulo,
            fontSize: 11,
            letterSpacing: 1.2,
            textTransform: "uppercase",
            color: "#0369a1",
          }}
        >
          {eyebrow}
        </Text>
        <Text style={{ fontFamily: fonte.titulo, fontSize: 16, lineHeight: 21, color: "#0c3a5a" }}>
          {titulo}
        </Text>
        <View style={{ marginTop: 6, alignSelf: "flex-start" }}>
          <BotaoDaAtividade cor="#0284c7" rotulo={rotulo} aoTocar={aoTocar} />
        </View>
      </View>
    </LinearGradient>
  );
}

function LinhaFeita({ emoji, titulo, sub }: { emoji: string; titulo: string; sub: string }) {
  return (
    <View
      accessible
      accessibilityLabel={`${titulo}. ${sub}`}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 13,
        borderRadius: 20,
        backgroundColor: cor.branco,
        paddingVertical: 11,
        paddingLeft: 11,
        paddingRight: 14,
        ...sombraDe("#b0708d", 0.5),
      }}
    >
      <View
        style={{
          width: 48,
          height: 48,
          borderRadius: 15,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#ecf8ff",
        }}
      >
        <Text style={{ fontSize: 24 }}>{emoji}</Text>
        <View
          style={{
            position: "absolute",
            right: -5,
            bottom: -5,
            width: 20,
            height: 20,
            borderRadius: 10,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#16a36f",
            borderWidth: 2,
            borderColor: cor.branco,
          }}
        >
          <Text style={{ fontFamily: fonte.titulo, fontSize: 11, color: cor.branco }}>✓</Text>
        </View>
      </View>
      <View style={{ flex: 1 }}>
        <Text
          numberOfLines={2}
          style={{ fontFamily: fonte.titulo, fontSize: 15, lineHeight: 20, color: "#8a7280" }}
        >
          {titulo}
        </Text>
        <Text style={{ fontFamily: fonte.media, fontSize: 13, color: "#9a7486" }}>{sub}</Text>
      </View>
    </View>
  );
}

function LinhaDaAtividade({
  chave,
  titulo,
  sub,
  feito,
  aoAbrir,
}: {
  chave: AtividadeDoPos;
  titulo: string;
  sub: string;
  feito: boolean;
  aoAbrir: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${titulo}. ${feito ? "Feito hoje" : sub}`}
      onPress={() => {
        toque();
        aoAbrir();
      }}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 13,
        borderRadius: 20,
        backgroundColor: cor.branco,
        paddingVertical: 11,
        paddingLeft: 11,
        paddingRight: 14,
        opacity: pressed ? 0.85 : 1,
        ...sombraDe("#b0708d", 0.6),
      })}
    >
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: 17,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: FICHA[chave],
        }}
      >
        <Image source={ARTE[chave]} style={{ width: 44, height: 44 }} contentFit="contain" />
        {feito ? (
          <View
            style={{
              position: "absolute",
              right: -5,
              bottom: -5,
              width: 22,
              height: 22,
              borderRadius: 11,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "#16a36f",
              borderWidth: 2,
              borderColor: cor.branco,
            }}
          >
            <Text style={{ fontFamily: fonte.titulo, fontSize: 12, color: cor.branco }}>✓</Text>
          </View>
        ) : null}
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontFamily: fonte.titulo,
            fontSize: 15.5,
            lineHeight: 20,
            color: feito ? "#8a7280" : "#3a2230",
          }}
        >
          {titulo}
        </Text>
        <Text
          style={{
            marginTop: 1,
            fontFamily: fonte.media,
            fontSize: 13,
            lineHeight: 18,
            color: "#9a7486",
          }}
        >
          {feito ? "Feito hoje 💛" : sub}
        </Text>
      </View>
      {feito ? null : (
        <Text style={{ fontFamily: fonte.titulo, fontSize: 24, color: "#d3b5c4" }}>›</Text>
      )}
    </Pressable>
  );
}

function DiaCheioDoPos({ semana }: { semana: number }) {
  return (
    <LinearGradient
      colors={["#effaff", "#dcf1fd"]}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        borderRadius: 26,
        padding: 16,
        borderBottomWidth: 5,
        borderBottomColor: "#bfe4f8",
      }}
    >
      <Text style={{ fontSize: 56 }}>{figurinhaDoPos(semana)}</Text>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontFamily: fonte.titulo, fontSize: 19, color: "#0c3a5a" }}>
          Dia completo 💛
        </Text>
        <Text style={{ fontFamily: fonte.media, fontSize: 14, lineHeight: 20, color: "#1e4f72" }}>
          A figurinha da semana {semana} de vida é sua. Agora descanse quando der.
        </Text>
      </View>
    </LinearGradient>
  );
}

function Formatura({ quem }: { quem: string }) {
  return (
    <View
      style={{
        alignItems: "center",
        gap: espaco.sm,
        borderRadius: 26,
        backgroundColor: "#ecfdf5",
        borderWidth: 1,
        borderColor: "#a7f3d0",
        padding: espaco.xl,
      }}
    >
      <Text style={{ fontSize: 44 }}>🎓</Text>
      <Text
        style={{ textAlign: "center", fontFamily: fonte.titulo, fontSize: 19, color: "#065f46" }}
      >
        Jornada do 4º trimestre completa!
      </Text>
      <Text
        style={{
          textAlign: "center",
          fontFamily: fonte.media,
          fontSize: 14,
          lineHeight: 20,
          color: "#047857",
        }}
      >
        Parabéns! Você e {quem} atravessaram, lado a lado, as 12 primeiras semanas. O caminho e os
        álbuns ficam guardados aqui para sempre 💝
      </Text>
    </View>
  );
}

/** O texto da semana — a terceira tarefa. "Li" é o que a marca. */
function FolhaDaSemana({
  aberta,
  semana,
  lida,
  aoFechar,
  aoLer,
}: {
  aberta: boolean;
  semana: number;
  lida: boolean;
  aoFechar: () => void;
  aoLer: () => void;
}) {
  return (
    <Modal visible={aberta} transparent animationType="slide" onRequestClose={aoFechar}>
      <Pressable
        accessibilityLabel="Fechar"
        onPress={aoFechar}
        style={{ flex: 1, backgroundColor: "rgba(20,10,30,0.35)" }}
      />
      <View
        style={{
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          backgroundColor: cor.branco,
          padding: espaco.xl,
          paddingBottom: espaco.xxl,
          gap: espaco.md,
        }}
      >
        <View
          style={{
            alignSelf: "center",
            width: 48,
            height: 5,
            borderRadius: 3,
            backgroundColor: "#e5dde2",
          }}
        />
        <Text
          style={{
            fontFamily: fonte.titulo,
            fontSize: 12,
            letterSpacing: 1.2,
            textTransform: "uppercase",
            color: "#0369a1",
          }}
        >
          Semana {semana} de vida · {figurinhaDoPos(semana)}
        </Text>
        <Text
          accessibilityRole="header"
          style={{ fontFamily: fonte.titulo, fontSize: 22, color: "#3a2230" }}
        >
          O que esperar com o bebê
        </Text>
        <Text style={{ fontFamily: fonte.media, fontSize: 16, lineHeight: 24, color: "#3a2230" }}>
          {nestaSemanaDoPos(semana)}
        </Text>
        <BotaoDaAtividade
          cor="#0284c7"
          rotulo={lida ? "Fechar" : "Li ✓"}
          aoTocar={lida ? aoFechar : aoLer}
        />
      </View>
    </Modal>
  );
}
