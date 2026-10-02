import type { Gravidade } from "@/lib/sinais-clinicos";
import { Image } from "expo-image";
import { router } from "expo-router";
import { ChevronLeft, Phone } from "lucide-react-native";
import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { Botao, Cartao, Linha, T, toque } from "~/componentes/base";
import { ligar } from "~/lib/links";
import { ALVO_MINIMO, cor, espaco, fonte, raio } from "~/tema";

/** As peças 3D do site (mesmas artes, um lugar só). */
export const ARTES = {
  saude: require("../../../../src/assets/saude/saude.webp"),
  chutes: require("../../../../src/assets/saude/chutes.webp"),
  contracoes: require("../../../../src/assets/saude/contracoes.webp"),
  nutricao: require("../../../../src/assets/saude/nutricao.webp"),
} as const;

export function voltarParaSaude() {
  if (router.canGoBack()) router.back();
  else router.replace("/saude");
}

/** O topo das telas da Saúde: voltar, a peça da família e o título. */
export function Cabecalho({
  titulo,
  arte,
  fundo,
}: {
  titulo: string;
  arte?: keyof typeof ARTES;
  fundo?: string;
}) {
  return (
    <Linha estilo={{ gap: espaco.md, marginBottom: espaco.xs }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Voltar para Saúde"
        onPress={() => {
          toque();
          voltarParaSaude();
        }}
        hitSlop={8}
        style={({ pressed }) => ({
          width: ALVO_MINIMO,
          height: ALVO_MINIMO,
          borderRadius: raio.pilula,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: cor.cartao,
          borderWidth: 1,
          borderColor: cor.borda,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <ChevronLeft size={24} color={cor.texto} />
      </Pressable>
      {arte ? (
        <View
          style={{
            width: 52,
            height: 52,
            borderRadius: raio.md,
            backgroundColor: fundo ?? cor.apagado,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Image source={ARTES[arte]} style={{ width: 44, height: 44 }} contentFit="contain" />
        </View>
      ) : null}
      <T tipo="titulo" estilo={{ flex: 1, fontSize: 24 }} linhas={2}>
        {titulo}
      </T>
    </Linha>
  );
}

/** O botão do 192 — liga direto, funciona sem internet. */
export function BotaoLigar192({ grande, rotulo = "Ligar 192" }: { grande?: boolean; rotulo?: string }) {
  return (
    <Botao
      rotulo={rotulo}
      tipo="perigo"
      aoTocar={() => ligar("192")}
      icone={<Phone size={grande ? 22 : 18} color={cor.branco} />}
      estilo={grande ? { minHeight: 60 } : undefined}
    />
  );
}

/** O cartão vermelho: o fato, o que fazer, e o 192 a um toque. */
export function CartaoDeSocorro({
  titulo,
  texto,
  grande,
  children,
}: {
  titulo: string;
  texto?: string | null;
  grande?: boolean;
  children?: ReactNode;
}) {
  return (
    <Cartao
      fundo={cor.urgenteFundo}
      estilo={{ borderWidth: 1.5, borderColor: cor.urgente, gap: espaco.md }}
    >
      <T tipo="subtitulo" cor={cor.urgente}>
        {titulo}
      </T>
      {texto ? <T cor={cor.texto}>{texto}</T> : null}
      {children}
      <BotaoLigar192 grande={grande} />
    </Cartao>
  );
}

export function coresDaGravidade(g: Gravidade) {
  if (g === "grave") return { fundo: cor.urgenteFundo, texto: cor.urgente };
  if (g === "atencao") return { fundo: cor.atencaoFundo, texto: cor.atencao };
  /* ⚠️ "normal" é NEUTRO, nunca verde: a régua da glicemia não sabe se foi
     em jejum, e verde afirmaria um "está bom" que o app não sabe. */
  return { fundo: cor.apagado, texto: cor.textoApagado };
}

/** Escolha de uma entre poucas opções (pílulas de 44 pt). */
export function Escolha<V extends string | number>({
  opcoes,
  valor,
  aoEscolher,
  corAtiva = cor.primaria,
  rotuloAcessivel,
}: {
  opcoes: readonly { valor: V; rotulo: string }[];
  valor: V | null;
  aoEscolher: (v: V) => void;
  corAtiva?: string;
  rotuloAcessivel?: string;
}) {
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={rotuloAcessivel}
      style={{ flexDirection: "row", gap: espaco.sm, flexWrap: "wrap" }}
    >
      {opcoes.map((o) => {
        const ativo = o.valor === valor;
        return (
          <Pressable
            key={String(o.valor)}
            accessibilityRole="radio"
            accessibilityState={{ selected: ativo }}
            accessibilityLabel={o.rotulo}
            onPress={() => {
              toque();
              aoEscolher(o.valor);
            }}
            style={({ pressed }) => ({
              flexGrow: 1,
              minHeight: ALVO_MINIMO,
              paddingHorizontal: espaco.md,
              borderRadius: raio.pilula,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: ativo ? corAtiva : cor.cartao,
              borderWidth: 1.5,
              borderColor: ativo ? corAtiva : cor.borda,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <Text
              style={{
                fontFamily: ativo ? fonte.forte : fonte.media,
                fontSize: 15,
                color: ativo ? cor.branco : cor.texto,
              }}
            >
              {o.rotulo}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** A confirmação NA TELA (o Alert do sistema não existe na web da bancada). */
export function Confirmacao({
  pergunta,
  rotuloSim,
  aoConfirmar,
  aoCancelar,
  carregando,
  erro,
}: {
  pergunta: string;
  rotuloSim: string;
  aoConfirmar: () => void;
  aoCancelar: () => void;
  carregando?: boolean;
  erro?: string | null;
}) {
  return (
    <View
      style={{
        backgroundColor: cor.urgenteFundo,
        borderRadius: raio.md,
        padding: espaco.md,
        gap: espaco.sm,
      }}
    >
      <T tipo="rotulo">{pergunta}</T>
      {erro ? (
        <T tipo="apagado" cor={cor.urgente}>
          {erro}
        </T>
      ) : null}
      <Linha estilo={{ flexWrap: "wrap" }}>
        <Botao rotulo={rotuloSim} tipo="perigo" aoTocar={aoConfirmar} carregando={carregando} />
        <Botao rotulo="Cancelar" tipo="secundario" aoTocar={aoCancelar} desabilitado={carregando} />
      </Linha>
    </View>
  );
}

/** Pílula de gravidade com o texto da régua. */
export function SeloDeGravidade({ gravidade, texto }: { gravidade: Gravidade; texto: string }) {
  const c = coresDaGravidade(gravidade);
  return (
    <View
      style={{
        alignSelf: "flex-start",
        backgroundColor: c.fundo,
        borderRadius: raio.sm,
        paddingHorizontal: 10,
        paddingVertical: 4,
      }}
    >
      <Text style={{ fontFamily: fonte.forte, fontSize: 13, color: c.texto }}>{texto}</Text>
    </View>
  );
}
