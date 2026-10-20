import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { toque } from "~/componentes/base";
import { BotaoDaAtividade, Brilho, sombraDe } from "~/componentes/jornada/atividade";
import { FolhaDeCompartilhar } from "~/componentes/jornada/compartilhar";
import { Confete } from "~/componentes/jornada/pecas";
import { ArteDaBolha, Flutuar } from "~/componentes/movimento";
import {
  medidasPorExtenso,
  nascimentoPorExtenso,
  type DadosDoNascimento,
} from "~/lib/jornada/pos-parto";
import { cor, espaco, fonte } from "~/tema";

/**
 * A CHEGADA DO BEBÊ — a festa que abre uma vez depois de ela contar o
 * nascimento, o cartão para anunciar (o "nasceu!" que toda mãe posta) e a
 * porta que a gestação mostra a partir da semana 37.
 *
 * O site abria "{bebê} chegou!" com confete, o troféu da jornada da gestação e
 * o "Começar o 4º trimestre"; o app trocava de modo em silêncio. Nunca no Modo
 * Cuidado: a perda perinatal mora nesta fase (o portão é `abreFestaDoNascimento`).
 */

export const RECEM_NASCIDO = require("../../../../src/assets/bebe/semana.webp");
const CEU = require("../../../../src/assets/ceu/amanhecer.webp");

const LARGURA = 300;
const ALTURA = Math.round((LARGURA * 16) / 9);

/** O cartão da chegada, em 9:16 para os Stories. Nada íntimo: nome, data e medidas. */
export function CartaoDaChegada({
  nome,
  dados,
}: {
  nome: string | null;
  dados: DadosDoNascimento;
}) {
  const medidas = medidasPorExtenso(dados);
  return (
    <View style={{ width: LARGURA, height: ALTURA, borderRadius: 28, overflow: "hidden" }}>
      <Image
        source={CEU}
        style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}
        contentFit="cover"
      />
      <LinearGradient
        colors={["rgba(255,255,255,0)", "rgba(255,240,246,0.85)"]}
        style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: ALTURA * 0.5 }}
      />
      <View style={{ flex: 1, alignItems: "center", paddingTop: 40, paddingHorizontal: 22 }}>
        <Text
          style={{
            fontFamily: fonte.titulo,
            fontSize: 13,
            letterSpacing: 2.4,
            textTransform: "uppercase",
            color: "#5d4d84",
          }}
        >
          Chegou!
        </Text>
        <Text
          numberOfLines={2}
          style={{
            marginTop: 4,
            textAlign: "center",
            fontFamily: fonte.titulo,
            fontSize: nome && nome.length > 10 ? 38 : 46,
            lineHeight: 52,
            letterSpacing: -1,
            color: "#2e2348",
          }}
        >
          {nome ?? "Nosso bebê"}
        </Text>
        <View style={{ marginTop: 14, alignItems: "center", justifyContent: "center" }}>
          <Brilho tamanho={250} />
          <Image source={RECEM_NASCIDO} style={{ width: 200, height: 200 }} contentFit="contain" />
        </View>
        <View style={{ marginTop: 18, alignItems: "center", gap: 6 }}>
          <Text style={{ fontFamily: fonte.titulo, fontSize: 18, color: "#2e2348" }}>
            {nascimentoPorExtenso(dados)}
          </Text>
          {medidas ? (
            <View
              style={{
                borderRadius: 999,
                backgroundColor: "rgba(255,255,255,0.8)",
                paddingHorizontal: 14,
                paddingVertical: 6,
              }}
            >
              <Text style={{ fontFamily: fonte.titulo, fontSize: 15, color: "#7d1d45" }}>
                {medidas}
              </Text>
            </View>
          ) : null}
        </View>
        <View style={{ flex: 1 }} />
        <Text
          style={{
            marginBottom: 22,
            fontFamily: fonte.forte,
            fontSize: 12,
            letterSpacing: 0.5,
            color: "#7d5a72",
          }}
        >
          feito com carinho no app Obstétrica 💛
        </Text>
      </View>
    </View>
  );
}

/**
 * A FESTA — tela cheia, uma vez. "Começar o 4º trimestre" a fecha para sempre
 * (`dc-path-birth-celebrated`); "Declarei sem querer" desfaz o nascimento, com
 * confirmação (o app inteiro muda de modo).
 */
export function FestaDoNascimento({
  nome,
  dados,
  diasCompletos,
  figurinhas,
  sementinhas,
  aoComecar,
  aoDesfazer,
}: {
  nome: string | null;
  dados: DadosDoNascimento;
  diasCompletos: number;
  figurinhas: number;
  /** O "Bem-vindo ao mundo" que o servidor já pagou (do extrato), se chegou. */
  sementinhas: number | null;
  aoComecar: () => void;
  aoDesfazer: () => Promise<void>;
}) {
  const topo = useSafeAreaInsets().top;
  const [cartao, setCartao] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [desfazendo, setDesfazendo] = useState(false);
  const quem = nome ?? "O bebê";
  return (
    <Modal visible transparent={false} animationType="fade" onRequestClose={aoComecar}>
      <View style={{ flex: 1, backgroundColor: "#fff8f5" }}>
        <Image
          source={CEU}
          style={{ position: "absolute", left: 0, right: 0, top: 0, height: 520 }}
          contentFit="cover"
        />
        <LinearGradient
          colors={["rgba(255,248,245,0)", "#fff8f5"]}
          style={{ position: "absolute", left: 0, right: 0, top: 340, height: 180 }}
        />
        <ScrollView
          contentContainerStyle={{
            paddingTop: topo + espaco.xl,
            paddingHorizontal: espaco.xl,
            paddingBottom: espaco.xxl,
            alignItems: "center",
            gap: espaco.md,
          }}
        >
          <Text
            style={{
              fontFamily: fonte.titulo,
              fontSize: 13,
              letterSpacing: 2,
              textTransform: "uppercase",
              color: "#5d4d84",
            }}
          >
            {nascimentoPorExtenso(dados)}
          </Text>
          <Text
            accessibilityRole="header"
            style={{
              textAlign: "center",
              fontFamily: fonte.titulo,
              fontSize: 38,
              lineHeight: 44,
              letterSpacing: -0.8,
              color: "#2e2348",
            }}
          >
            {quem} chegou!
          </Text>
          <View style={{ alignItems: "center", justifyContent: "center", height: 230 }}>
            <Brilho tamanho={280} />
            <Flutuar>
              <Image
                source={RECEM_NASCIDO}
                style={{ width: 210, height: 210 }}
                contentFit="contain"
                accessibilityLabel={`${quem} recém-nascido, enrolado na manta`}
              />
            </Flutuar>
          </View>
          <Text
            style={{
              textAlign: "center",
              fontFamily: fonte.media,
              fontSize: 16,
              lineHeight: 23,
              color: "#5b3a4a",
            }}
          >
            Parabéns, mamãe. Vocês completaram a maior jornada que existe.
          </Text>

          <View
            style={{
              alignSelf: "stretch",
              flexDirection: "row",
              alignItems: "center",
              gap: espaco.md,
              borderRadius: 22,
              backgroundColor: "#fff4dc",
              padding: espaco.lg,
              ...sombraDe("#c27a00", 0.5),
            }}
          >
            <Text style={{ fontSize: 40 }}>🏆</Text>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontFamily: fonte.titulo, fontSize: 16, color: "#8a4b00" }}>
                Jornada da gestação completa
              </Text>
              <Text style={{ fontFamily: fonte.media, fontSize: 14, color: "#9a6a2a" }}>
                {diasCompletos} {diasCompletos === 1 ? "dia" : "dias"} de cuidado completo ·{" "}
                {figurinhas} {figurinhas === 1 ? "figurinha" : "figurinhas"}
              </Text>
              <Text style={{ fontFamily: fonte.normal, fontSize: 13, color: "#9a6a2a" }}>
                O álbum da gestação fica guardado para sempre 💝
              </Text>
            </View>
          </View>

          {sementinhas ? (
            <View
              style={{
                borderRadius: 999,
                backgroundColor: "#e7f8ee",
                paddingHorizontal: espaco.lg,
                paddingVertical: espaco.sm,
              }}
            >
              <Text style={{ fontFamily: fonte.titulo, fontSize: 16, color: "#15803d" }}>
                +{sementinhas} sementinhas de boas-vindas 🌱
              </Text>
            </View>
          ) : null}

          <View style={{ alignSelf: "stretch", gap: espaco.sm, marginTop: espaco.sm }}>
            <BotaoDaAtividade
              cor="#0284c7"
              rotulo="Começar o 4º trimestre 🍼"
              aoTocar={aoComecar}
            />
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                toque();
                setCartao(true);
              }}
              style={({ pressed }) => ({
                minHeight: 52,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: espaco.sm,
                borderRadius: 999,
                backgroundColor: cor.branco,
                borderWidth: 1,
                borderColor: "#f3d3e0",
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text style={{ fontFamily: fonte.titulo, fontSize: 16, color: "#b0306a" }}>
                Anunciar a chegada 💌
              </Text>
            </Pressable>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: espaco.sm }}>
            <ArteDaBolha humor="comemorando" tamanho={44} />
            <Text
              style={{
                flex: 1,
                fontFamily: fonte.media,
                fontSize: 13,
                lineHeight: 18,
                color: "#7d5a72",
              }}
            >
              A trilha agora acompanha as 12 primeiras semanas de vocês dois. Um dia de cada vez.
            </Text>
          </View>

          {confirmando ? (
            <View
              style={{
                alignSelf: "stretch",
                gap: espaco.sm,
                borderRadius: 18,
                backgroundColor: "#fdf2f8",
                padding: espaco.lg,
              }}
            >
              <Text style={{ fontFamily: fonte.forte, fontSize: 14, color: "#7d1d45" }}>
                Voltar para a gestação? O nascimento sai do perfil e a jornada da gestação volta
                como estava.
              </Text>
              <View style={{ flexDirection: "row", gap: espaco.sm }}>
                <Pressable
                  accessibilityRole="button"
                  disabled={desfazendo}
                  onPress={() => {
                    setDesfazendo(true);
                    void aoDesfazer().finally(() => setDesfazendo(false));
                  }}
                  style={{
                    flex: 1,
                    minHeight: 44,
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 999,
                    backgroundColor: "#b0306a",
                    opacity: desfazendo ? 0.6 : 1,
                  }}
                >
                  <Text style={{ fontFamily: fonte.titulo, fontSize: 14, color: cor.branco }}>
                    {desfazendo ? "Voltando…" : "Sim, voltar"}
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setConfirmando(false)}
                  style={{
                    flex: 1,
                    minHeight: 44,
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 999,
                    backgroundColor: cor.branco,
                  }}
                >
                  <Text style={{ fontFamily: fonte.titulo, fontSize: 14, color: "#7d5a72" }}>
                    Não, já nasceu
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable
              accessibilityRole="button"
              onPress={() => setConfirmando(true)}
              style={{ minHeight: 44, justifyContent: "center" }}
            >
              <Text
                style={{
                  fontFamily: fonte.media,
                  fontSize: 13,
                  color: "#9a7486",
                  textDecorationLine: "underline",
                }}
              >
                Declarei sem querer — voltar para a gestação
              </Text>
            </Pressable>
          )}
        </ScrollView>
        <Confete pecas={70} />
      </View>
      <FolhaDeCompartilhar
        aberta={cartao}
        aoFechar={() => setCartao(false)}
        largura={LARGURA}
        corDoBotao="#b0306a"
      >
        <CartaoDaChegada nome={nome} dados={dados} />
      </FolhaDeCompartilhar>
    </Modal>
  );
}

/**
 * A porta, na tela Hoje da gestação, a partir da semana 37 — o "🎉 {bebê}
 * nasceu!" do site. Leva ao fluxo de contar o nascimento.
 */
export function PortaDoNascimento({ nome, aoTocar }: { nome: string | null; aoTocar: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${nome ?? "O bebê"} nasceu? Contar o nascimento`}
      onPress={() => {
        toque();
        aoTocar();
      }}
      style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
    >
      <LinearGradient
        colors={["#ec4899", "#8b5cf6"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: espaco.md,
          borderRadius: 22,
          paddingHorizontal: espaco.lg,
          paddingVertical: espaco.md,
        }}
      >
        <Image source={RECEM_NASCIDO} style={{ width: 52, height: 52 }} contentFit="contain" />
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonte.titulo, fontSize: 17, color: cor.branco }}>
            🎉 {nome ?? "O bebê"} nasceu?
          </Text>
          <Text style={{ fontFamily: fonte.media, fontSize: 13, color: "rgba(255,255,255,0.9)" }}>
            Conte aqui e a jornada vira o 4º trimestre
          </Text>
        </View>
        <Text style={{ fontFamily: fonte.titulo, fontSize: 22, color: cor.branco }}>›</Text>
      </LinearGradient>
    </Pressable>
  );
}
