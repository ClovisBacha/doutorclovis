import { LIMITE_DO_TEXTO, VISIBILIDADES, type Visibilidade } from "@/lib/rede-social";
import { Image } from "expo-image";
import { useRef, useState, type ReactNode } from "react";
import Check from "lucide-react-native/icons/check";
import IconeDeCompartilhar from "lucide-react-native/icons/share";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Share,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Botao, selecao, toque } from "~/componentes/base";
import { fonteDaImagem } from "~/componentes/comunidade/imagem";
import { FolhaDasRegras } from "~/componentes/comunidade/regras";
import { Folha } from "~/componentes/jornada/pecas";
import { ehBancada } from "~/lib/bancada";
import { api } from "~/lib/comunidade/api";
import { prepararArquivo } from "~/lib/comunidade/fotos";
import { ehOfensivo, mensagemDoErro, recadoDaOfensa } from "~/lib/comunidade/regras";
import { marcarFeedSujo } from "~/lib/comunidade/sinal";
import { useRegrasDaComunidade } from "~/lib/comunidade/usar-regras";
import { useSessao } from "~/lib/sessao";
import { ALVO_MINIMO, canto, cor, curva, escala, espaco, fonte, sombra } from "~/tema";
import { COMUNIDADE_NO_APP } from "~/config";

type Modo = "previa" | "escrevendo" | "publicado";

/**
 * A PRÉVIA PARA COMPARTILHAR — o cartão aparece numa folha, ela vê como ficou e
 * decide. A imagem sai da própria vista (`react-native-view-shot`, carregado só
 * no toque) e vai pela folha de compartilhar do iPhone (Instagram, WhatsApp,
 * Fotos…). Serve aos cartões da conquista, do marco, da chama, da semana e da
 * chegada do bebê.
 *
 * E vai para a COMUNIDADE (fase 3, a rede social no centro): "Publicar na
 * Comunidade" captura o mesmo cartão, prepara como as fotos dos posts (lado ≤
 * 1080, JPEG) e abre, ali mesmo, a legenda que o cartão sugere e quem pode ver
 * — "Só as amigas" por padrão, como em Publicar. Tudo DENTRO da folha: ela
 * nasce da janela da comemoração (a festa, a conquista, a chama), e navegar
 * para outra tela deixaria essa janela aberta por cima.
 *
 * As regras da Comunidade valem igual (o "Concordo" no primeiro gesto), o
 * filtro de ofensa sai antes do aparelho, e a recusa do servidor mostra o
 * recado como chegou. No Modo Cuidado não há publicar (o servidor recusaria).
 *
 * Desenho (18/11/2026): a `Folha` do app (a alça, o título com o X, a área
 * segura), e não mais uma janela própria com o fundo roxo-escuro; os botões
 * são o `Botao` do tema, framboesa por padrão (antes, o violeta #7a3fd1).
 */
export function FolhaDeCompartilhar({
  aberta,
  aoFechar,
  largura,
  corDoBotao = cor.primaria,
  legenda,
  children,
}: {
  aberta: boolean;
  aoFechar: () => void;
  /** A largura do cartão (os botões acompanham). */
  largura: number;
  corDoBotao?: string;
  /** A legenda que o cartão sugere para a Comunidade. Sem ela, só "Compartilhar". */
  legenda?: string;
  /** O cartão — é ele que vira imagem. */
  children: ReactNode;
}) {
  const { cuidado } = useSessao();
  const [enviando, setEnviando] = useState(false);
  const [falhou, setFalhou] = useState(false);
  const [modo, setModo] = useState<Modo>("previa");
  const [foto, setFoto] = useState<string | null>(null);
  const [texto, setTexto] = useState("");
  const [visibilidade, setVisibilidade] = useState<Visibilidade>("amigas");
  const [recado, setRecado] = useState<string | null>(null);
  const [preparando, setPreparando] = useState(false);
  const [publicando, setPublicando] = useState(false);
  const regras = useRegrasDaComunidade();
  const alvo = useRef<View>(null);
  const { height: altura } = useWindowDimensions();
  const topo = useSafeAreaInsets().top;

  /* Na web só a bancada publica (com uma foto de exemplo no lugar do cartão). */
  /* Sem a Comunidade (`COMUNIDADE_NO_APP`), o cartão só se compartilha pela
     folha do iPhone. */
  const podePublicar =
    COMUNIDADE_NO_APP && !!legenda && !cuidado && (Platform.OS !== "web" || ehBancada());

  function fechar() {
    setModo("previa");
    setFoto(null);
    setRecado(null);
    setFalhou(false);
    aoFechar();
  }

  async function compartilhar() {
    setFalhou(false);
    if (Platform.OS === "web") return;
    setEnviando(true);
    try {
      const { captureRef } = await import("react-native-view-shot");
      const uri = await captureRef(alvo, { format: "png", quality: 1, result: "tmpfile" });
      await Share.share({ url: uri });
    } catch {
      setFalhou(true);
    } finally {
      setEnviando(false);
    }
  }

  async function prepararParaPublicar() {
    setFalhou(false);
    setRecado(null);
    if (Platform.OS === "web") {
      setFoto("bancada:hero");
      setTexto(legenda ?? "");
      setModo("escrevendo");
      return;
    }
    setPreparando(true);
    try {
      const { captureRef } = await import("react-native-view-shot");
      const uri = await captureRef(alvo, { format: "jpg", quality: 0.92, result: "tmpfile" });
      const pronta = await prepararArquivo(uri);
      if (!pronta) throw new Error("sem foto");
      setFoto(pronta);
      setTexto(legenda ?? "");
      setModo("escrevendo");
    } catch {
      setFalhou(true);
    } finally {
      setPreparando(false);
    }
  }

  async function publicar() {
    const t = texto.trim();
    if (!foto || publicando) return;
    /* O filtro de ofensa antes de sair do aparelho (Apple 1.2), como em Publicar. */
    if (ehOfensivo(t)) {
      setRecado(recadoDaOfensa("post"));
      return;
    }
    setPublicando(true);
    setRecado(null);
    const r = await api.publicarPost({
      texto: t || null,
      imagem: foto,
      extras: [],
      altTexto: legenda ? `Cartão: ${legenda}` : null,
      sensivel: false,
      motivoSensivel: null,
      visibilidade,
    });
    setPublicando(false);
    if (!r.ok) {
      setRecado(mensagemDoErro(r.motivo, r.recado, "post"));
      return;
    }
    toque(false);
    marcarFeedSujo();
    setModo("publicado");
  }

  const quemVe = VISIBILIDADES.find((v) => v.chave === visibilidade);
  /* A folha cabe na tela: o cartão tem 9:16, e num iPhone pequeno ele rola
     dentro dela (o título e o X ficam parados). */
  const alturaUtil = Math.max(320, altura - topo - 140);

  return (
    <Folha
      aberta={aberta}
      aoFechar={fechar}
      titulo={
        modo === "previa"
          ? "Seu cartão"
          : modo === "escrevendo"
            ? "Publicar na Comunidade"
            : "Publicado"
      }
    >
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          style={{ maxHeight: alturaUtil }}
          contentContainerStyle={{ alignItems: "center", gap: espaco.lg, paddingBottom: espaco.xs }}
        >
          {modo === "previa" ? (
            <>
              {/* A sombra fica na caixa de FORA: a imagem sai só do cartão. */}
              <View style={[{ width: largura, borderRadius: canto.cartao }, sombra]}>
                <View ref={alvo} collapsable={false}>
                  {children}
                </View>
              </View>
              <View style={{ alignSelf: "stretch", gap: espaco.sm }}>
                <Botao
                  rotulo={Platform.OS === "web" ? "Compartilhar (no iPhone)" : "Compartilhar"}
                  corFundo={corDoBotao}
                  tamanho="grande"
                  icone={<IconeDeCompartilhar size={20} color={cor.branco} strokeWidth={2.4} />}
                  carregando={enviando}
                  aoTocar={() => void compartilhar()}
                />
                {podePublicar ? (
                  <Botao
                    rotulo="Publicar na Comunidade"
                    tipo="secundario"
                    carregando={preparando}
                    aoTocar={() => void prepararParaPublicar()}
                  />
                ) : null}
                {falhou ? (
                  <Text
                    style={{
                      textAlign: "center",
                      ...fonte.media,
                      ...escala.nota,
                      color: cor.textoApagado,
                    }}
                  >
                    Não deu para montar a imagem agora. Tente de novo.
                  </Text>
                ) : null}
              </View>
            </>
          ) : modo === "escrevendo" ? (
            <View style={{ alignSelf: "stretch", gap: espaco.md }}>
              <View style={{ flexDirection: "row", gap: espaco.md }}>
                {foto ? (
                  <Image
                    source={fonteDaImagem(foto)}
                    style={{ width: 72, height: 128, borderRadius: canto.icone }}
                    contentFit="cover"
                    accessibilityLabel="O cartão que vai na publicação"
                  />
                ) : null}
                <TextInput
                  value={texto}
                  onChangeText={(t) => {
                    setTexto(t);
                    if (recado) setRecado(null);
                  }}
                  multiline
                  maxLength={LIMITE_DO_TEXTO}
                  accessibilityLabel="Legenda da publicação"
                  placeholder="Escreva uma legenda"
                  placeholderTextColor={cor.placeholder}
                  selectionColor={cor.primaria}
                  style={{
                    flex: 1,
                    minHeight: 128,
                    textAlignVertical: "top",
                    borderRadius: canto.campo,
                    ...curva,
                    backgroundColor: cor.apagado,
                    padding: espaco.md,
                    ...fonte.normal,
                    fontSize: 17,
                    color: cor.texto,
                  }}
                />
              </View>
              <View style={{ gap: espaco.xs }}>
                <Text style={{ ...fonte.forte, ...escala.nota, color: cor.textoApagado }}>
                  Quem pode ver
                </Text>
                <View accessibilityRole="radiogroup" style={{ flexDirection: "row", gap: 6 }}>
                  {[...VISIBILIDADES].reverse().map((v) => {
                    const ativa = v.chave === visibilidade;
                    return (
                      <Pressable
                        key={v.chave}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: ativa, checked: ativa }}
                        accessibilityLabel={`${v.rotulo}. ${v.sub}`}
                        onPress={() => {
                          selecao();
                          setVisibilidade(v.chave);
                        }}
                        style={{
                          flex: 1,
                          minHeight: ALVO_MINIMO,
                          alignItems: "center",
                          justifyContent: "center",
                          borderRadius: canto.pilula,
                          ...curva,
                          paddingHorizontal: 6,
                          backgroundColor: ativa ? cor.texto : cor.apagado,
                        }}
                      >
                        <Text
                          numberOfLines={2}
                          style={{
                            textAlign: "center",
                            ...fonte.forte,
                            ...escala.nota,
                            color: ativa ? cor.branco : cor.texto,
                          }}
                        >
                          {v.rotulo}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                {quemVe ? (
                  <Text style={{ ...fonte.normal, ...escala.nota, color: cor.textoApagado }}>
                    {quemVe.sub}
                  </Text>
                ) : null}
              </View>
              {recado ? (
                <View
                  style={{
                    borderRadius: canto.campo,
                    ...curva,
                    backgroundColor: cor.atencaoFundo,
                    padding: espaco.md,
                  }}
                >
                  <Text style={{ ...fonte.media, ...escala.legenda, color: cor.atencaoForte }}>
                    {recado}
                  </Text>
                </View>
              ) : null}
              <Botao
                rotulo="Publicar"
                corFundo={corDoBotao}
                carregando={publicando}
                aoTocar={() => regras.exigir(() => void publicar())}
              />
              <Botao rotulo="Voltar" tipo="texto" aoTocar={() => setModo("previa")} />
            </View>
          ) : (
            <View style={{ alignSelf: "stretch", alignItems: "center", gap: espaco.sm }}>
              <View
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: cor.sementinhaFundo,
                }}
              >
                <Check size={28} color={cor.sementinha} strokeWidth={2.6} />
              </View>
              <Text
                style={{
                  textAlign: "center",
                  ...fonte.normal,
                  ...escala.legenda,
                  color: cor.textoApagado,
                }}
              >
                {quemVe ? `${quemVe.rotulo}: ${quemVe.sub.toLowerCase()}.` : ""} Aparece no seu
                perfil e no feed de quem pode ver.
              </Text>
              <Botao
                rotulo="Fechar"
                tipo="secundario"
                estilo={{ alignSelf: "stretch" }}
                aoTocar={fechar}
              />
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
      <FolhaDasRegras {...regras.folha} />
    </Folha>
  );
}
