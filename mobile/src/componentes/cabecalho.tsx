import { router, type Href } from "expo-router";
import ChevronLeft from "lucide-react-native/icons/chevron-left";
import X from "lucide-react-native/icons/x";
import { useRef, type ReactNode, type Ref } from "react";
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ScrollView,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import type { Edge } from "react-native-safe-area-context";
import { Tela, Tocavel, toque, useFimDaRolagem } from "~/componentes/base";
import { TEM_VIDRO_DO_SISTEMA, Vidro } from "~/componentes/vidro";
import { comAlfa } from "~/lib/cor";
import { ALVO_MINIMO, cor, escala, espaco, fonte, margem, raio, sombra, veu } from "~/tema";
import { SOS_NO_APP } from "~/config";

/**
 * O TOPO DAS TELAS EMPILHADAS — um desenho só para o app inteiro.
 *
 * 18/11/2026 (a vistoria: "o cabeçalho rola junto com o conteúdo e é um disco
 * branco com título pequeno"): o voltar é uma gota de VIDRO de 44, sem borda;
 * o título fica CENTRADO, em 17, numa linha; e a barra fica PARADA no alto,
 * fora da rolagem (`TelaDaPilha`, que a põe no `topo` da `Tela`). Nas telas de
 * consulta (Perfil, Lembretes, Minha agenda) o título é grande, na primeira
 * linha do conteúdo, e o pequeno da barra só aparece quando ela rola.
 *
 * Antes havia seis desenhos de topo; o SOS fica no mesmo lugar em todos (com
 * ele desligado, `SOS_NO_APP`, a pílula some de todos de uma vez).
 */

/** Volta; aberta direto (sem histórico), cai na rota-mãe. */
export function voltarOu(rota: Href) {
  if (router.canGoBack()) router.back();
  else router.replace(rota);
}

/**
 * Vai para uma ABA da barra de qualquer lugar. De uma tela empilhada (a
 * trilha, o SOS), volta até a barra e troca de aba: empurrar a aba abriria
 * uma SEGUNDA barra por cima da primeira. De dentro das abas, só troca.
 */
export function irParaAba(rota: Href) {
  if (router.canDismiss()) router.dismissTo(rota);
  else router.navigate(rota);
}

type Tom = "claro" | "escuro";

/**
 * A GOTA DE VIDRO de 44 (o voltar, o "+" da agenda, o −1 dos movimentos). No
 * tom escuro (sobre um fundo noturno), o vidro escurece e o ícone fica branco.
 */
export function BotaoDeVidro({
  rotulo,
  aoTocar,
  children,
  tom = "claro",
  desabilitado,
}: {
  rotulo: string;
  aoTocar: () => void;
  children: ReactNode;
  tom?: Tom;
  desabilitado?: boolean;
}) {
  const forma: ViewStyle = {
    width: ALVO_MINIMO,
    height: ALVO_MINIMO,
    alignItems: "center",
    justifyContent: "center",
  };
  const gota =
    tom === "escuro" && !TEM_VIDRO_DO_SISTEMA ? (
      <View
        style={[
          forma,
          {
            borderRadius: raio.pilula,
            backgroundColor: veu.tinta(0.42),
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: comAlfa(cor.branco, 0.24),
          },
        ]}
      >
        {children}
      </View>
    ) : (
      <Vidro
        forma={ALVO_MINIMO / 2}
        interativo
        flutua={false}
        tinta={tom === "escuro" ? veu.tinta(0.45) : undefined}
        estilo={[forma, sombra]}
      >
        {children}
      </Vidro>
    );
  return (
    <Tocavel
      rotulo={rotulo}
      aoTocar={aoTocar}
      profundidade={0.9}
      desabilitado={desabilitado}
      estilo={desabilitado ? { opacity: 0.45 } : undefined}
    >
      {gota}
    </Tocavel>
  );
}

export function BotaoVoltar({
  voltarPara = "/inicio",
  aoTocar,
  fechar = false,
  tom = "claro",
}: {
  voltarPara?: Href;
  /** Ação própria (sair de uma atividade, por exemplo). */
  aoTocar?: () => void;
  /** Um X (fechar a folha, sair da atividade) em vez da seta. */
  fechar?: boolean;
  /** "escuro" sobre um fundo noturno: vidro escuro e ícone branco. */
  tom?: Tom;
}) {
  const tinta = tom === "escuro" ? comAlfa(cor.branco, 0.92) : cor.texto;
  return (
    <BotaoDeVidro
      rotulo={fechar ? "Fechar" : "Voltar"}
      tom={tom}
      aoTocar={() => {
        if (aoTocar) aoTocar();
        else voltarOu(voltarPara);
      }}
    >
      {fechar ? (
        <X size={20} strokeWidth={2.4} color={tinta} />
      ) : (
        <ChevronLeft size={22} strokeWidth={2.4} color={tinta} style={{ marginLeft: -2 }} />
      )}
    </BotaoDeVidro>
  );
}

/**
 * O SOS das telas sem a barra de baixo: pequeno, vermelho, sempre à direita.
 * Com o SOS desligado (`SOS_NO_APP`), some de todos os cabeçalhos de uma vez.
 */
export function PilulaSos() {
  if (!SOS_NO_APP) return null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="SOS, emergência"
      accessibilityHint="Abre a tela de emergência: ligar 192 e avisar quem você cadastrou"
      onPress={() => {
        toque(false);
        router.push("/sos");
      }}
      hitSlop={6}
      style={({ pressed }) => ({
        minHeight: ALVO_MINIMO,
        minWidth: ALVO_MINIMO + 8,
        paddingHorizontal: espaco.sm,
        borderRadius: raio.pilula,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: pressed ? cor.urgentePressionado : cor.urgente,
      })}
    >
      <Text style={{ ...fonte.forte, fontSize: 15, color: cor.branco, letterSpacing: 0.5 }}>
        SOS
      </Text>
    </Pressable>
  );
}

/**
 * Uma ação de TEXTO no topo de uma folha ("Cancelar", "Salvar", "Adicionar"),
 * como nos apps da Apple: framboesa, 17; a principal em negrito. Desligada,
 * fica cinza.
 */
export function AcaoDoTopo({
  rotulo,
  aoTocar,
  principal = false,
  desabilitado,
  carregando,
  tom = "claro",
}: {
  rotulo: string;
  aoTocar: () => void;
  principal?: boolean;
  desabilitado?: boolean;
  carregando?: boolean;
  tom?: Tom;
}) {
  const ativa = tom === "escuro" ? cor.branco : cor.primaria;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      accessibilityState={{ disabled: !!desabilitado, busy: !!carregando }}
      disabled={!!desabilitado || !!carregando}
      hitSlop={8}
      onPress={() => {
        toque();
        aoTocar();
      }}
      style={({ pressed }) => ({
        minHeight: ALVO_MINIMO,
        minWidth: ALVO_MINIMO,
        paddingHorizontal: espaco.xs,
        alignItems: "center",
        justifyContent: "center",
        opacity: pressed ? 0.5 : 1,
      })}
    >
      {carregando ? (
        <ActivityIndicator color={ativa} />
      ) : (
        <Text
          style={{
            ...(principal ? fonte.forte : fonte.normal),
            ...escala.manchete,
            color: desabilitado ? cor.placeholder : ativa,
          }}
        >
          {rotulo}
        </Text>
      )}
    </Pressable>
  );
}

/**
 * A barra completa: voltar, título (e subtítulo), uma ação e o SOS.
 *
 * Dentro do conteúdo (como as telas antigas a usam) ou PARADA no alto, com
 * `fixo` (a `TelaDaPilha` faz isso). Com `rolagem`, ganha o fio de baixo
 * quando a tela rola; com `tituloGrande`, o título pequeno só aparece depois
 * que o grande sai de vista.
 */
export function CabecalhoDaPilha({
  titulo,
  subtitulo,
  voltarPara,
  direita,
  sos = true,
  tom = "claro",
  fechar = false,
  aoVoltar,
  esquerda,
  fixo = false,
  rolagem,
  tituloGrande = false,
}: {
  titulo: string;
  subtitulo?: string;
  voltarPara?: Href;
  direita?: ReactNode;
  /** Só a própria tela do SOS dispensa a pílula. */
  sos?: boolean;
  /** "escuro" sobre um fundo noturno (Para vocês dois, Para dormir). */
  tom?: Tom;
  /** Um X no lugar da seta (folhas, atividades). */
  fechar?: boolean;
  /** Ação própria no voltar (no lugar de `voltarOu(voltarPara)`). */
  aoVoltar?: () => void;
  /** Toma o lugar do voltar ("Cancelar", numa folha de criar ou editar). */
  esquerda?: ReactNode;
  /** Parada no alto, fora da rolagem: ganha a margem da tela. */
  fixo?: boolean;
  /** A posição da rolagem (`contentOffset.y`), para o fio e o título que aparece. */
  rolagem?: Animated.Value;
  /** O título grande mora no conteúdo; o pequeno só aparece ao rolar. */
  tituloGrande?: boolean;
}) {
  const escuro = tom === "escuro";
  const tinta = escuro ? cor.branco : cor.texto;
  /* O título fica centrado na TELA, e não no vão entre os botões: os lados
     reservam o lugar do botão (ou de um texto, como "Cancelar"). */
  const recuo = esquerda || direita ? 92 : ALVO_MINIMO + espaco.md;
  const aparece =
    rolagem && tituloGrande
      ? rolagem.interpolate({ inputRange: [30, 54], outputRange: [0, 1], extrapolate: "clamp" })
      : 1;
  const fio = rolagem
    ? rolagem.interpolate({ inputRange: [0, 12], outputRange: [0, 1], extrapolate: "clamp" })
    : 0;
  return (
    <View
      style={
        fixo
          ? { paddingHorizontal: margem.tela, paddingTop: espaco.xs, paddingBottom: espaco.sm }
          : null
      }
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: espaco.sm,
          minHeight: ALVO_MINIMO + 4,
        }}
      >
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: recuo,
            right: recuo,
            top: 0,
            bottom: 0,
            alignItems: "center",
            justifyContent: "center",
            opacity: aparece,
          }}
        >
          <Text
            accessibilityRole="header"
            numberOfLines={1}
            style={{ ...fonte.forte, ...escala.manchete, color: tinta, textAlign: "center" }}
          >
            {titulo}
          </Text>
          {subtitulo ? (
            <Text
              numberOfLines={1}
              style={{
                ...fonte.normal,
                ...escala.nota,
                color: escuro ? comAlfa(cor.branco, 0.78) : cor.textoApagado,
                textAlign: "center",
              }}
            >
              {subtitulo}
            </Text>
          ) : null}
        </Animated.View>
        {esquerda ?? (
          <BotaoVoltar voltarPara={voltarPara} aoTocar={aoVoltar} fechar={fechar} tom={tom} />
        )}
        <View style={{ flexDirection: "row", alignItems: "center", gap: espaco.sm }}>
          {direita}
          {sos ? <PilulaSos /> : null}
        </View>
      </View>
      {fixo && rolagem ? (
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: StyleSheet.hairlineWidth,
            backgroundColor: comAlfa(cor.texto, 0.12),
            opacity: fio,
          }}
        />
      ) : null}
    </View>
  );
}

/** O título grande das telas de consulta: a serifada em 34, na primeira linha. */
export function TituloGrande({ titulo, subtitulo }: { titulo: string; subtitulo?: string }) {
  return (
    <View style={{ gap: 2, marginBottom: -espaco.sm }}>
      <Text
        accessibilityRole="header"
        style={{ ...fonte.display, ...escala.grande, letterSpacing: -0.2, color: cor.texto }}
      >
        {titulo}
      </Text>
      {subtitulo ? (
        <Text style={{ ...fonte.normal, ...escala.legenda, color: cor.textoApagado }}>
          {subtitulo}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * A TELA EMPILHADA inteira: a `Tela` com a barra parada no `topo` e a rolagem
 * por baixo dela, que conta a posição para a barra (o fio e o título que
 * aparece). `grande` põe o título grande na primeira linha do conteúdo.
 * `sobre` é o que flutua por cima da rolagem (o aviso que some sozinho).
 */
export function TelaDaPilha({
  titulo,
  subtitulo,
  grande = false,
  voltarPara,
  direita,
  esquerda,
  fechar,
  aoVoltar,
  sos,
  tom,
  bordas,
  estilo,
  refDaRolagem,
  sobre,
  children,
}: {
  titulo: string;
  subtitulo?: string;
  grande?: boolean;
  voltarPara?: Href;
  direita?: ReactNode;
  esquerda?: ReactNode;
  fechar?: boolean;
  aoVoltar?: () => void;
  sos?: boolean;
  tom?: Tom;
  bordas?: Edge[];
  estilo?: StyleProp<ViewStyle>;
  refDaRolagem?: Ref<ScrollView>;
  sobre?: ReactNode;
  children: ReactNode;
}) {
  const y = useRef(new Animated.Value(0)).current;
  const fim = useFimDaRolagem();
  return (
    <Tela
      rolar={false}
      bordas={bordas}
      estilo={{ padding: 0, gap: 0 }}
      topo={
        <CabecalhoDaPilha
          fixo
          rolagem={y}
          tituloGrande={grande}
          titulo={titulo}
          subtitulo={grande ? undefined : subtitulo}
          voltarPara={voltarPara}
          direita={direita}
          esquerda={esquerda}
          fechar={fechar}
          aoVoltar={aoVoltar}
          sos={sos}
          tom={tom}
        />
      }
    >
      <Animated.ScrollView
        ref={refDaRolagem as Ref<never>}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y } } }], {
          useNativeDriver: true,
        })}
        scrollEventThrottle={16}
        contentContainerStyle={[
          {
            paddingHorizontal: margem.tela,
            paddingTop: espaco.xs,
            paddingBottom: fim,
            gap: espaco.xl,
          },
          estilo,
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
      >
        {grande ? <TituloGrande titulo={titulo} subtitulo={subtitulo} /> : null}
        {children}
      </Animated.ScrollView>
      {sobre}
    </Tela>
  );
}
