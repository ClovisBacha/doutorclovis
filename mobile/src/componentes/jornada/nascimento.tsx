import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import ChevronRight from "lucide-react-native/icons/chevron-right";
import Share from "lucide-react-native/icons/share";
import Sprout from "lucide-react-native/icons/sprout";
import Trophy from "lucide-react-native/icons/trophy";
import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BOLHA } from "~/componentes/artes";
import { Botao, Cartao, Tocavel, toque } from "~/componentes/base";
import { FolhaDeCompartilhar } from "~/componentes/jornada/compartilhar";
import { legendaDaChegada } from "~/lib/jornada/cartoes";
import { Confete } from "~/componentes/jornada/pecas";
import { BolhaViva } from "~/componentes/movimento";
import { comAlfa } from "~/lib/cor";
import {
  medidasPorExtenso,
  nascimentoPorExtenso,
  type DadosDoNascimento,
} from "~/lib/jornada/pos-parto";
import { canto, cor, curva, escala, espaco, fonte, luz, margem, ouro, sombra } from "~/tema";

/**
 * A CHEGADA DO BEBÊ — a festa que abre uma vez depois de ela contar o
 * nascimento, o cartão para anunciar (o "nasceu!" que toda mãe posta) e a
 * porta que a gestação mostra a partir da semana 37.
 *
 * O site abria "{bebê} chegou!" com confete, o troféu da jornada da gestação e
 * o "Começar o 4º trimestre"; o app trocava de modo em silêncio. Nunca no Modo
 * Cuidado: a perda perinatal mora nesta fase (o portão é `abreFestaDoNascimento`).
 *
 * 18/11/2026 (a vistoria: "o maior momento da jornada precisa ser o mais coeso
 * do app"): toda cor vem do tema (eram 16 soltas, com um botão azul-céu e o
 * degradê rosa-violeta de fábrica na porta); os dois botões são o `Botao` do
 * app, em pílulas de 48; o título é a serifada.
 *
 * 19/11/2026 (o dono: "tirar as imagens dos bebês [...] o bebê bolha será esse
 * guia"): o recém-nascido ilustrado saiu da festa, do cartão e da porta. No
 * lugar, a Bolha: comemorando na festa e no cartão, surpresa na porta ("nasceu?").
 * Nada atrás dela (o brilho que ficava atrás do bebê saiu junto).
 */

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
        colors={[comAlfa(cor.destaque, 0), comAlfa(cor.destaque, 0.85)]}
        style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: ALTURA * 0.5 }}
      />
      <View style={{ flex: 1, alignItems: "center", paddingTop: 40, paddingHorizontal: 22 }}>
        <Text
          style={{
            ...fonte.forte,
            ...escala.nota,
            letterSpacing: 2.4,
            textTransform: "uppercase",
            color: cor.textoCorpo,
          }}
        >
          Chegou
        </Text>
        <Text
          numberOfLines={2}
          style={{
            marginTop: 4,
            textAlign: "center",
            ...fonte.display,
            fontSize: nome && nome.length > 10 ? 38 : 46,
            lineHeight: 52,
            letterSpacing: -0.4,
            color: cor.texto,
          }}
        >
          {nome ?? "Nosso bebê"}
        </Text>
        <View style={{ marginTop: 14, alignItems: "center", justifyContent: "center" }}>
          <Image
            source={BOLHA.comemorando}
            allowDownscaling={false}
            style={{ width: 200, height: 200 }}
            contentFit="contain"
          />
        </View>
        <View style={{ marginTop: 18, alignItems: "center", gap: 6 }}>
          <Text style={{ ...fonte.forte, ...escala.manchete, color: cor.texto }}>
            {nascimentoPorExtenso(dados)}
          </Text>
          {medidas ? (
            <View
              style={{
                borderRadius: canto.pilula,
                backgroundColor: comAlfa(cor.branco, 0.8),
                paddingHorizontal: 14,
                paddingVertical: 6,
              }}
            >
              <Text style={{ ...fonte.forte, ...escala.legenda, color: cor.textoDestaque }}>
                {medidas}
              </Text>
            </View>
          ) : null}
        </View>
        <View style={{ flex: 1 }} />
        <Text
          style={{
            marginBottom: 22,
            ...fonte.forte,
            ...escala.nota,
            letterSpacing: 0.3,
            color: cor.textoApagado,
          }}
        >
          Mãe Esperta · @maeesperta.app
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
      <View style={{ flex: 1, backgroundColor: luz.base }}>
        <Image
          source={CEU}
          style={{ position: "absolute", left: 0, right: 0, top: 0, height: 520 }}
          contentFit="cover"
        />
        <LinearGradient
          colors={[comAlfa(luz.base, 0), luz.base]}
          style={{ position: "absolute", left: 0, right: 0, top: 340, height: 180 }}
        />
        <ScrollView
          contentContainerStyle={{
            paddingTop: topo + espaco.xl,
            paddingHorizontal: margem.foco,
            paddingBottom: espaco.xxl,
            alignItems: "center",
            gap: espaco.md,
          }}
        >
          <Text
            style={{
              ...fonte.forte,
              ...escala.nota,
              letterSpacing: 1.6,
              textTransform: "uppercase",
              color: cor.textoCorpo,
            }}
          >
            {nascimentoPorExtenso(dados)}
          </Text>
          <Text
            accessibilityRole="header"
            style={{
              textAlign: "center",
              ...fonte.display,
              fontSize: 40,
              lineHeight: 46,
              letterSpacing: -0.4,
              color: cor.texto,
            }}
          >
            {quem} chegou!
          </Text>
          <View style={{ alignItems: "center", justifyContent: "center", height: 230 }}>
            <BolhaViva humor="comemorando" tamanho={220} />
          </View>
          <Text
            style={{
              textAlign: "center",
              ...fonte.normal,
              ...escala.corpo,
              color: cor.textoCorpo,
            }}
          >
            Parabéns, mamãe. A espera acabou.
          </Text>

          <Cartao
            fundo={cor.atencaoFundo}
            estilo={{
              alignSelf: "stretch",
              flexDirection: "row",
              alignItems: "center",
              gap: espaco.md,
            }}
          >
            <LinearGradient
              colors={[ouro.claro, ouro.medio, ouro.escuro]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                width: 52,
                height: 52,
                borderRadius: 16,
                ...curva,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Trophy size={26} strokeWidth={2.2} color={cor.atencaoForte} />
            </LinearGradient>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ ...fonte.forte, ...escala.manchete, color: cor.atencaoForte }}>
                A gestação completa
              </Text>
              <Text style={{ ...fonte.media, ...escala.legenda, color: cor.atencaoTexto }}>
                {diasCompletos} {diasCompletos === 1 ? "dia" : "dias"} de cuidado · {figurinhas}{" "}
                {figurinhas === 1 ? "figurinha" : "figurinhas"}
              </Text>
              <Text style={{ ...fonte.normal, ...escala.nota, color: cor.atencaoTexto }}>
                O álbum da gestação fica guardado para sempre.
              </Text>
            </View>
          </Cartao>

          {sementinhas ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                borderRadius: canto.pilula,
                backgroundColor: cor.sementinhaFundo,
                paddingHorizontal: espaco.lg,
                paddingVertical: espaco.sm,
              }}
            >
              <Sprout size={16} strokeWidth={2.4} color={cor.sementinha} />
              <Text style={{ ...fonte.forte, ...escala.chamada, color: cor.sementinha }}>
                +{sementinhas} sementinhas de boas-vindas
              </Text>
            </View>
          ) : null}

          <View style={{ alignSelf: "stretch", gap: espaco.sm, marginTop: espaco.sm }}>
            <Botao rotulo="Começar o 4º trimestre" aoTocar={aoComecar} />
            <Botao
              rotulo="Anunciar a chegada"
              tipo="secundario"
              icone={<Share size={18} strokeWidth={2.2} color={cor.primariaEscura} />}
              aoTocar={() => setCartao(true)}
            />
          </View>

          <Text
            style={{
              textAlign: "center",
              paddingHorizontal: espaco.md,
              ...fonte.normal,
              ...escala.nota,
              color: cor.textoApagado,
            }}
          >
            A trilha agora acompanha as 12 primeiras semanas de vocês dois.
          </Text>

          {confirmando ? (
            <Cartao fundo={cor.destaque} estilo={{ alignSelf: "stretch", gap: espaco.md }}>
              <Text style={{ ...fonte.forte, ...escala.legenda, color: cor.textoDestaque }}>
                Voltar para a gestação? O nascimento sai do perfil e a jornada da gestação volta
                como estava.
              </Text>
              <View style={{ flexDirection: "row", gap: espaco.sm }}>
                <Botao
                  rotulo={desfazendo ? "Voltando…" : "Sim, voltar"}
                  tamanho="compacto"
                  estilo={{ flex: 1 }}
                  carregando={desfazendo}
                  aoTocar={() => {
                    setDesfazendo(true);
                    void aoDesfazer().finally(() => setDesfazendo(false));
                  }}
                />
                <Botao
                  rotulo="Não, já nasceu"
                  tipo="secundario"
                  tamanho="compacto"
                  estilo={{ flex: 1 }}
                  desabilitado={desfazendo}
                  aoTocar={() => setConfirmando(false)}
                />
              </View>
            </Cartao>
          ) : (
            <Tocavel
              rotulo="Marquei sem querer. Voltar para a gestação"
              aoTocar={() => setConfirmando(true)}
              estilo={{ minHeight: 44, justifyContent: "center", paddingHorizontal: espaco.md }}
            >
              <Text style={{ ...fonte.media, ...escala.nota, color: cor.textoApagado }}>
                Marquei sem querer. Voltar para a gestação
              </Text>
            </Tocavel>
          )}
        </ScrollView>
        <Confete pecas={70} />
      </View>
      <FolhaDeCompartilhar
        aberta={cartao}
        aoFechar={() => setCartao(false)}
        largura={LARGURA}
        corDoBotao={cor.primaria}
        legenda={legendaDaChegada(nome)}
      >
        <CartaoDaChegada nome={nome} dados={dados} />
      </FolhaDeCompartilhar>
    </Modal>
  );
}

/**
 * A PORTA, na tela do Bebê a partir da semana 37 — o "{bebê} nasceu?" do
 * site. Leva ao fluxo de contar o nascimento. É uma LINHA do grupo de atalhos
 * do Bebê (64 pt, a Bolha no lugar da ficha de 44, o fio recuado 70): o
 * material é o do grupo. `solta` lhe dá o material próprio, para quem a puser
 * fora dele.
 */
export function PortaDoNascimento({
  nome,
  aoTocar,
  solta = false,
}: {
  nome: string | null;
  aoTocar: () => void;
  solta?: boolean;
}) {
  const quem = nome ?? "O bebê";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${quem} nasceu? Contar o nascimento`}
      onPress={() => {
        toque();
        aoTocar();
      }}
      style={({ pressed }) => [
        {
          flexDirection: "row",
          alignItems: "center",
          gap: espaco.md,
          minHeight: 64,
          paddingVertical: 10,
          paddingHorizontal: 14,
        },
        !solta
          ? { backgroundColor: pressed ? cor.apagado : "transparent" }
          : [
              {
                backgroundColor: pressed ? cor.apagado : luz.cartao,
                borderRadius: canto.cartao,
                ...curva,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: comAlfa(cor.branco, 0.9),
              },
              sombra,
            ],
      ]}
    >
      {/* A Bolha, surpresa, solta (sem a ficha atrás): ela é quem pergunta. */}
      <View style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
        <Image
          source={BOLHA.surpresa}
          allowDownscaling={false}
          style={{ width: 52, height: 52 }}
          contentFit="contain"
          accessible={false}
        />
      </View>
      <View style={{ flex: 1, gap: 1 }}>
        <Text numberOfLines={1} style={{ ...fonte.forte, ...escala.chamada, color: cor.texto }}>
          {quem} nasceu?
        </Text>
        <Text
          numberOfLines={2}
          style={{ ...fonte.media, fontSize: 14, lineHeight: 19, color: cor.textoApagado }}
        >
          Conte aqui, e a trilha vira o 4º trimestre
        </Text>
      </View>
      <ChevronRight size={18} strokeWidth={2.4} color={cor.chevron} />
    </Pressable>
  );
}
