import { LIMITE_DO_TEXTO, VISIBILIDADES, type Visibilidade } from "@/lib/rede-social";
import { Image } from "expo-image";
import { useRef, useState, type ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  Text,
  TextInput,
  View,
} from "react-native";
import { toque } from "~/componentes/base";
import { fonteDaImagem } from "~/componentes/comunidade/imagem";
import { FolhaDasRegras } from "~/componentes/comunidade/regras";
import { BotaoDaAtividade } from "~/componentes/jornada/atividade";
import { ehBancada } from "~/lib/bancada";
import { api } from "~/lib/comunidade/api";
import { prepararArquivo } from "~/lib/comunidade/fotos";
import { ehOfensivo, mensagemDoErro, recadoDaOfensa } from "~/lib/comunidade/regras";
import { marcarFeedSujo } from "~/lib/comunidade/sinal";
import { useRegrasDaComunidade } from "~/lib/comunidade/usar-regras";
import { useSessao } from "~/lib/sessao";
import { ALVO_MINIMO, cor, espaco, fonte } from "~/tema";

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
 */
export function FolhaDeCompartilhar({
  aberta,
  aoFechar,
  largura,
  corDoBotao = "#7a3fd1",
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

  /* Na web só a bancada publica (com uma foto de exemplo no lugar do cartão). */
  const podePublicar = !!legenda && !cuidado && (Platform.OS !== "web" || ehBancada());

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

  return (
    <Modal visible={aberta} transparent animationType="slide" onRequestClose={fechar}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          style={{ flex: 1, backgroundColor: "rgba(20,10,30,0.7)" }}
          contentContainerStyle={{
            flexGrow: 1,
            alignItems: "center",
            justifyContent: "center",
            gap: espaco.lg,
            padding: espaco.xl,
          }}
        >
          {modo === "previa" ? (
            <>
              <View ref={alvo} collapsable={false}>
                {children}
              </View>
              <View style={{ width: largura, gap: espaco.sm }}>
                <BotaoDaAtividade
                  cor={corDoBotao}
                  rotulo={Platform.OS === "web" ? "Compartilhar (no iPhone)" : "Compartilhar"}
                  carregando={enviando}
                  aoTocar={() => void compartilhar()}
                />
                {podePublicar ? (
                  <BotaoClaro
                    rotulo={preparando ? "Preparando o cartão…" : "Publicar na Comunidade"}
                    aoTocar={() => void prepararParaPublicar()}
                  />
                ) : null}
                {falhou ? (
                  <Text
                    style={{
                      textAlign: "center",
                      fontFamily: fonte.media,
                      fontSize: 13,
                      color: cor.branco,
                    }}
                  >
                    Não consegui montar a imagem agora. Tente de novo.
                  </Text>
                ) : null}
                <BotaoDeTexto rotulo="Fechar" aoTocar={fechar} />
              </View>
            </>
          ) : modo === "escrevendo" ? (
            <View
              style={{
                width: largura,
                gap: espaco.md,
                borderRadius: 24,
                backgroundColor: cor.cartao,
                padding: espaco.lg,
              }}
            >
              <Text
                accessibilityRole="header"
                style={{ fontFamily: fonte.titulo, fontSize: 18, color: cor.texto }}
              >
                Publicar na Comunidade
              </Text>
              <View style={{ flexDirection: "row", gap: espaco.md }}>
                {foto ? (
                  <Image
                    source={fonteDaImagem(foto)}
                    style={{ width: 72, height: 128, borderRadius: 12 }}
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
                  placeholderTextColor={cor.textoApagado}
                  style={{
                    flex: 1,
                    minHeight: 128,
                    textAlignVertical: "top",
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: cor.borda,
                    backgroundColor: cor.fundo,
                    padding: espaco.sm,
                    fontFamily: fonte.normal,
                    fontSize: 15,
                    color: cor.texto,
                  }}
                />
              </View>
              <View style={{ gap: espaco.xs }}>
                <Text style={{ fontFamily: fonte.forte, fontSize: 14, color: cor.texto }}>
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
                          toque();
                          setVisibilidade(v.chave);
                        }}
                        style={{
                          flex: 1,
                          minHeight: ALVO_MINIMO,
                          alignItems: "center",
                          justifyContent: "center",
                          borderRadius: 999,
                          paddingHorizontal: 6,
                          borderWidth: ativa ? 2 : 1,
                          borderColor: ativa ? cor.primaria : cor.borda,
                          backgroundColor: ativa ? cor.destaque : cor.cartao,
                        }}
                      >
                        <Text
                          numberOfLines={2}
                          style={{
                            textAlign: "center",
                            fontFamily: fonte.forte,
                            fontSize: 13,
                            color: cor.texto,
                          }}
                        >
                          {v.rotulo}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                {quemVe ? (
                  <Text style={{ fontFamily: fonte.normal, fontSize: 13, color: cor.textoApagado }}>
                    {quemVe.sub}
                  </Text>
                ) : null}
              </View>
              {recado ? (
                <View
                  style={{
                    borderRadius: 12,
                    backgroundColor: cor.atencaoFundo,
                    padding: espaco.md,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: fonte.media,
                      fontSize: 14,
                      lineHeight: 20,
                      color: cor.texto,
                    }}
                  >
                    {recado}
                  </Text>
                </View>
              ) : null}
              <BotaoDaAtividade
                cor={corDoBotao}
                rotulo="Publicar"
                carregando={publicando}
                aoTocar={() => regras.exigir(() => void publicar())}
              />
              <BotaoDeTexto rotulo="Voltar" escuro aoTocar={() => setModo("previa")} />
            </View>
          ) : (
            <View
              style={{
                width: largura,
                alignItems: "center",
                gap: espaco.sm,
                borderRadius: 24,
                backgroundColor: cor.cartao,
                padding: espaco.xl,
              }}
            >
              <Text style={{ fontSize: 40 }} accessible={false}>
                💛
              </Text>
              <Text
                accessibilityRole="header"
                style={{ fontFamily: fonte.titulo, fontSize: 18, color: cor.texto }}
              >
                Publicado na Comunidade
              </Text>
              <Text
                style={{
                  textAlign: "center",
                  fontFamily: fonte.normal,
                  fontSize: 14,
                  lineHeight: 20,
                  color: cor.textoApagado,
                }}
              >
                {quemVe ? `${quemVe.rotulo}: ${quemVe.sub.toLowerCase()}.` : ""} Aparece no seu
                perfil e no feed de quem pode ver.
              </Text>
              <BotaoDeTexto rotulo="Fechar" escuro aoTocar={fechar} />
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
      <FolhaDasRegras {...regras.folha} />
    </Modal>
  );
}

function BotaoClaro({ rotulo, aoTocar }: { rotulo: string; aoTocar: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      onPress={() => {
        toque();
        aoTocar();
      }}
      style={({ pressed }) => ({
        minHeight: 52,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 999,
        borderWidth: 2,
        borderColor: "rgba(255,255,255,0.9)",
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <Text style={{ fontFamily: fonte.titulo, fontSize: 16, color: cor.branco }}>{rotulo}</Text>
    </Pressable>
  );
}

function BotaoDeTexto({
  rotulo,
  aoTocar,
  escuro,
}: {
  rotulo: string;
  aoTocar: () => void;
  escuro?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={aoTocar}
      style={{ minHeight: 44, alignItems: "center", justifyContent: "center" }}
    >
      <Text
        style={{
          fontFamily: fonte.forte,
          fontSize: 15,
          color: escuro ? cor.textoApagado : "rgba(255,255,255,0.85)",
        }}
      >
        {rotulo}
      </Text>
    </Pressable>
  );
}
