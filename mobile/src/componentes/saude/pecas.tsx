import { Image } from "expo-image";
import { Pressable, Text, View } from "react-native";
import { Botao, Linha, T, toque } from "~/componentes/base";
import { BotaoVoltar, PilulaSos } from "~/componentes/cabecalho";
import { ALVO_MINIMO, cor, espaco, fonte, raio } from "~/tema";

/** As peças 3D do site (mesmas artes, um lugar só). */
export const ARTES = {
  saude: require("../../../../src/assets/saude/saude.webp"),
  chutes: require("../../../../src/assets/saude/chutes.webp"),
  contracoes: require("../../../../src/assets/saude/contracoes.webp"),
  nutricao: require("../../../../src/assets/saude/nutricao.webp"),
} as const;

/**
 * O topo das telas da Saúde (os Movimentos do bebê, o cronômetro de
 * contrações): voltar, a peça da família e o título. A aba Saúde saiu da barra
 * na fase 3; sem pilha para voltar, os Movimentos caem no Bebê, onde moram.
 */
export function Cabecalho({
  titulo,
  arte,
  fundo,
  voltarPara = "/inicio",
}: {
  titulo: string;
  arte?: keyof typeof ARTES;
  fundo?: string;
  /** Sem pilha para voltar (abriu direto), vai para cá. */
  voltarPara?: "/inicio" | "/sos";
}) {
  return (
    <Linha estilo={{ gap: espaco.md, marginBottom: espaco.xs }}>
      <BotaoVoltar voltarPara={voltarPara} />
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
      <PilulaSos />
    </Linha>
  );
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
