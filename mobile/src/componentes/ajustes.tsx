import { LinearGradient } from "expo-linear-gradient";
import ChevronRight from "lucide-react-native/icons/chevron-right";
import {
  Children,
  Fragment,
  isValidElement,
  useRef,
  type ComponentType,
  type ReactNode,
} from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import { toque } from "~/componentes/base";
import { clarear, comAlfa } from "~/lib/cor";
import { canto, cor, curva, escala, espaco, fonte, luz, margem, sombra } from "~/tema";

/**
 * AS LISTAS AGRUPADAS — o idioma dos Ajustes do iPhone (18/11/2026, a vistoria:
 * "cada linha vira um cartão solto, os rótulos ficam em cima de caixas com
 * borda"). Um GRUPO é um material só, com as linhas separadas por um fio
 * recuado; uma LINHA tem o ladrilho colorido, o título, o valor à direita e a
 * seta. As telas de conta e de utilidade (Perfil, Seus dados, Lembretes, a
 * agenda, os Termos) se montam com estas peças, e não com cartões soltos.
 */

export type IconeDaLinha = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

/** O recuo do fio entre linhas com ladrilho: a margem, o ladrilho e o vão. */
export const RECUO_COM_ICONE = margem.tela + 30 + espaco.md;
/** O recuo do fio entre linhas só de texto (campos). */
export const RECUO_SEM_ICONE = margem.tela;

/** A altura mínima de uma linha (a dos Ajustes). */
export const ALTURA_DA_LINHA = 52;

/** O fio entre duas linhas. */
export function Divisor({ recuo = RECUO_COM_ICONE }: { recuo?: number }) {
  return (
    <View
      style={{ height: StyleSheet.hairlineWidth, backgroundColor: cor.borda, marginLeft: recuo }}
    />
  );
}

/**
 * O GRUPO: um material (o do `Cartao`), com o fio entre as linhas. A sombra
 * fica na camada de fora e o recorte na de dentro, para o realce da linha
 * tocada não vazar pelo canto.
 */
export function Grupo({
  children,
  estilo,
  recuo = RECUO_COM_ICONE,
}: {
  children: ReactNode;
  estilo?: StyleProp<ViewStyle>;
  /** Onde o fio começa (58 com ladrilho; 16 numa lista de campos). */
  recuo?: number;
}) {
  const filhos = Children.toArray(children);
  return (
    <View style={[{ borderRadius: canto.cartao, ...curva }, sombra, estilo]}>
      <View
        style={{
          borderRadius: canto.cartao,
          ...curva,
          overflow: "hidden",
          backgroundColor: luz.cartao,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: comAlfa(cor.branco, 0.9),
        }}
      >
        {filhos.map((f, i) => (
          <Fragment key={isValidElement(f) && f.key != null ? f.key : i}>
            {i > 0 ? <Divisor recuo={recuo} /> : null}
            {f}
          </Fragment>
        ))}
      </View>
    </View>
  );
}

/** O ladrilho de 30 na cor da família, com o ícone branco (o dos Ajustes). */
export function Ladrilho({
  Icone,
  tinta,
  tamanho = 30,
}: {
  Icone: IconeDaLinha;
  tinta: string;
  tamanho?: number;
}) {
  const raio = Math.round(tamanho * 0.27);
  return (
    <View
      style={{
        width: tamanho,
        height: tamanho,
        borderRadius: raio,
        ...curva,
        overflow: "hidden",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: tinta,
      }}
    >
      <LinearGradient
        pointerEvents="none"
        colors={[clarear(tinta, 0.18), tinta]}
        style={StyleSheet.absoluteFill}
      />
      {/* Numa View: na web, o que é absoluto (o degradê) pinta por cima do que não é. */}
      <View>
        <Icone size={Math.round(tamanho * 0.6)} color={cor.branco} strokeWidth={2.2} />
      </View>
    </View>
  );
}

/** A seta das linhas que abrem outra tela. */
export function Seta() {
  return <ChevronRight size={16} strokeWidth={2.6} color={cor.chevron} />;
}

/**
 * UMA LINHA do grupo: 52 pt, o ladrilho (se houver), o título em 17, o valor
 * à direita em cinza e a seta. Com `direita` (uma chave), a linha não se toca:
 * quem se toca é a chave. `perigo` pinta o título de vermelho (sair, excluir);
 * `centro` o centraliza (os botões de ação no fim da lista).
 */
export function LinhaDeAjuste({
  Icone,
  esquerda,
  tinta = cor.primaria,
  titulo,
  sub,
  valor,
  tintaDoValor,
  aoTocar,
  direita,
  seta,
  perigo,
  centro,
  carregando,
  desabilitado,
  rotulo,
  dica,
}: {
  Icone?: IconeDaLinha;
  /** No lugar do ladrilho, outra coisa de 30 de largura (o número de uma seção). */
  esquerda?: ReactNode;
  tinta?: string;
  titulo: string;
  /** Uma linha miúda embaixo do título (use pouco: o lugar da explicação é o rodapé). */
  sub?: string;
  valor?: string | null;
  tintaDoValor?: string;
  aoTocar?: () => void;
  direita?: ReactNode;
  /** A seta aparece sozinha em quem se toca; `false` a esconde. */
  seta?: boolean;
  perigo?: boolean;
  centro?: boolean;
  carregando?: boolean;
  desabilitado?: boolean;
  rotulo?: string;
  dica?: string;
}) {
  const comSeta = (seta ?? (!!aoTocar && !direita && !centro)) && !carregando;
  const conteudo = (
    <>
      {Icone ? <Ladrilho Icone={Icone} tinta={tinta} /> : null}
      {!Icone && esquerda ? (
        <View style={{ width: 30, alignItems: "center" }}>{esquerda}</View>
      ) : null}
      <View style={{ flex: 1, gap: 1, paddingVertical: espaco.sm + 2 }}>
        <Text
          style={{
            ...fonte.normal,
            ...escala.manchete,
            color: perigo ? cor.urgente : desabilitado ? cor.textoApagado : cor.texto,
            textAlign: centro ? "center" : "left",
          }}
        >
          {titulo}
        </Text>
        {sub ? (
          <Text style={{ ...fonte.normal, ...escala.nota, color: cor.textoApagado }}>{sub}</Text>
        ) : null}
      </View>
      {valor ? (
        <Text
          numberOfLines={1}
          style={{
            ...fonte.normal,
            ...escala.manchete,
            maxWidth: "58%",
            color: tintaDoValor ?? cor.textoApagado,
            fontVariant: ["tabular-nums"],
          }}
        >
          {valor}
        </Text>
      ) : null}
      {carregando ? <ActivityIndicator color={cor.textoApagado} /> : null}
      {direita}
      {comSeta ? <Seta /> : null}
    </>
  );
  const base: ViewStyle = {
    flexDirection: "row",
    alignItems: "center",
    gap: espaco.md,
    minHeight: ALTURA_DA_LINHA,
    paddingHorizontal: margem.tela,
  };
  if (!aoTocar) {
    return (
      <View style={base} accessible={!direita} accessibilityLabel={rotulo}>
        {conteudo}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={rotulo ?? [titulo, valor].filter(Boolean).join(", ")}
      accessibilityHint={dica}
      accessibilityState={{ disabled: !!desabilitado, busy: !!carregando }}
      disabled={!!desabilitado || !!carregando}
      onPress={() => {
        toque();
        aoTocar();
      }}
      style={({ pressed }) => [base, pressed ? { backgroundColor: cor.apagado } : null]}
    >
      {conteudo}
    </Pressable>
  );
}

/**
 * UM CAMPO EM LINHA (o dos Contatos e do Saúde): o rótulo à esquerda, o valor
 * à direita, a unidade como sufixo fora do campo. Tocar no rótulo também
 * põe o cursor no campo.
 */
export function LinhaDeCampo({
  rotulo,
  sufixo,
  ...props
}: TextInputProps & { rotulo: string; sufixo?: string }) {
  const ref = useRef<TextInput>(null);
  return (
    <Pressable
      accessible={false}
      onPress={() => ref.current?.focus()}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: espaco.md,
        minHeight: ALTURA_DA_LINHA,
        paddingHorizontal: margem.tela,
      }}
    >
      <Text style={{ ...fonte.normal, ...escala.manchete, color: cor.texto }}>{rotulo}</Text>
      <TextInput
        ref={ref}
        accessibilityLabel={rotulo}
        placeholderTextColor={cor.placeholder}
        selectionColor={cor.primaria}
        cursorColor={cor.primaria}
        {...props}
        style={[
          {
            flex: 1,
            minWidth: 0,
            minHeight: ALTURA_DA_LINHA,
            paddingVertical: 0,
            textAlign: "right",
            ...fonte.normal,
            fontSize: 17,
            color: cor.texto,
          },
          props.style,
        ]}
      />
      {sufixo ? (
        <Text style={{ ...fonte.normal, ...escala.manchete, color: cor.textoApagado }}>
          {sufixo}
        </Text>
      ) : null}
    </Pressable>
  );
}

/** Um campo de texto livre dentro do grupo (anotações): várias linhas, sem caixa. */
export function CampoLivre(props: TextInputProps & { rotulo: string }) {
  return (
    <TextInput
      accessibilityLabel={props.rotulo}
      placeholderTextColor={cor.placeholder}
      selectionColor={cor.primaria}
      cursorColor={cor.primaria}
      multiline
      {...props}
      style={[
        {
          minHeight: 112,
          paddingHorizontal: margem.tela,
          paddingTop: 14,
          paddingBottom: 14,
          textAlignVertical: "top",
          ...fonte.normal,
          ...escala.corpo,
          color: cor.texto,
        },
        props.style,
      ]}
    />
  );
}

/** O título de um grupo: 13 pt, em maiúsculas, colado no grupo. */
export function TituloDoGrupo({ children }: { children: ReactNode }) {
  return (
    <Text
      accessibilityRole="header"
      style={{
        ...fonte.media,
        ...escala.nota,
        color: cor.textoApagado,
        textTransform: "uppercase",
        letterSpacing: 0.4,
        paddingHorizontal: margem.tela,
      }}
    >
      {children}
    </Text>
  );
}

/** A explicação embaixo de um grupo: 13/18, em cinza (o lugar do texto de apoio). */
export function RodapeDoGrupo({ children }: { children: ReactNode }) {
  return (
    <Text
      style={{
        ...fonte.normal,
        ...escala.nota,
        color: cor.textoApagado,
        paddingHorizontal: margem.tela,
      }}
    >
      {children}
    </Text>
  );
}

/** Título, grupo e rodapé juntos, no espaçamento dos Ajustes. */
export function SecaoDeAjustes({
  titulo,
  rodape,
  recuo,
  children,
  estilo,
}: {
  titulo?: string;
  rodape?: ReactNode;
  recuo?: number;
  children: ReactNode;
  estilo?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[{ gap: 7 }, estilo]}>
      {titulo ? <TituloDoGrupo>{titulo}</TituloDoGrupo> : null}
      <Grupo recuo={recuo}>{children}</Grupo>
      {rodape ? <RodapeDoGrupo>{rodape}</RodapeDoGrupo> : null}
    </View>
  );
}
