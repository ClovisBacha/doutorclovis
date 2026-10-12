import { MOTIVOS_SENSIVEIS } from "@/lib/conteudo-sensivel";
import { LIMITE_DO_TEXTO, VISIBILIDADES, type Visibilidade } from "@/lib/rede-social";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Camera, Check, ChevronDown, ChevronUp, Globe, ImagePlus, Lock, Users, X } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Botao, Campo, Linha, T, toque } from "~/componentes/base";
import { Cabecalho, voltar } from "~/componentes/comunidade/cabecalho";
import { FolhaDeOpcoes, useAviso } from "~/componentes/comunidade/folha";
import { fonteDaImagem } from "~/componentes/comunidade/imagem";
import { FolhaDasRegras } from "~/componentes/comunidade/regras";
import { ehBancada, parametroDaBancada } from "~/lib/bancada";
import { api } from "~/lib/comunidade/api";
import { escolherDaGaleria, tirarFoto, type ResultadoDaEscolha } from "~/lib/comunidade/fotos";
import { FOTOS_POR_POST, fotosParaPublicar, mensagemDoErro } from "~/lib/comunidade/regras";
import { marcarFeedSujo } from "~/lib/comunidade/sinal";
import { useRegrasDaComunidade } from "~/lib/comunidade/usar-regras";
import { useSessao } from "~/lib/sessao";
import { ALVO_MINIMO, cor, espaco, fonte, raio } from "~/tema";

const ICONE = { publico: Globe, seguidores: Users, amigas: Lock } as const;

/**
 * PUBLICAR.
 *
 * ⚠️ A visibilidade é escolhida À VISTA, e o padrão é a mais fechada ("só as
 * amigas"): colapso de contexto é o motivo número um de as pessoas não
 * publicarem, e publicar para o mundo por descuido não tem volta.
 * ⚠️ Recusa do servidor mostra o `recado` como chegou (é a triagem clínica),
 * e o texto fica para ela reescrever.
 */
export default function NovoPost() {
  const { cuidado } = useSessao();
  const [texto, setTexto] = useState("");
  const [fotos, setFotos] = useState<string[]>([]);
  const [visibilidade, setVisibilidade] = useState<Visibilidade>("amigas");
  const [descricaoAberta, setDescricaoAberta] = useState(false);
  const [alt, setAlt] = useState("");
  const [sensivel, setSensivel] = useState(false);
  const [motivo, setMotivo] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [preparando, setPreparando] = useState(false);
  const [recusa, setRecusa] = useState<string | null>(null);
  const [escolhendoFonte, setEscolhendoFonte] = useState(false);
  const aviso = useAviso();
  const regras = useRegrasDaComunidade();
  const rolagem = useRef<ScrollView>(null);

  /* Bancada: um rascunho de exemplo nos MESMOS estados; `&recusa=1` envia
     sozinho para mostrar a recusa do servidor com o recado. */
  useEffect(() => {
    if (!ehBancada()) return;
    setTexto("Primeiro passeio no parque com essa barriga de 24 semanas. O fim de tarde estava lindo 🌅");
    setFotos(["bancada:hero", "bancada:bastidores"]);
    if (parametroDaBancada("recusa") === "1") {
      const exemplo = "Tomei chá de canela e passou a cólica, façam também!";
      setTexto(exemplo);
      void enviar(exemplo);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const recebeu = (r: ResultadoDaEscolha) => {
    setPreparando(false);
    if (r.ok) {
      setFotos((f) => [...f, ...r.fotos].slice(0, FOTOS_POR_POST));
      return;
    }
    if (r.motivo === "permissao") {
      aviso.mostrar("Sem acesso à câmera. Dá para liberar nos Ajustes do iPhone.", true);
    } else if (r.motivo === "falhou") {
      aviso.mostrar("Não conseguimos preparar essa foto. Tente outra.", true);
    }
  };

  const enviar = async (textoForcado?: string) => {
    const t = (textoForcado ?? texto).trim();
    if (enviando) return;
    if (!t && fotos.length === 0) {
      setRecusa(mensagemDoErro("vazio"));
      return;
    }
    setEnviando(true);
    setRecusa(null);
    const { imagem, extras } = fotosParaPublicar(fotos);
    const r = await api.publicarPost({
      texto: t || null,
      imagem,
      extras,
      altTexto: imagem && alt.trim() ? alt.trim() : null,
      sensivel,
      motivoSensivel: sensivel ? motivo : null,
      visibilidade,
    });
    setEnviando(false);
    if (!r.ok) {
      setRecusa(mensagemDoErro(r.motivo, r.recado, "post"));
      setTimeout(() => rolagem.current?.scrollToEnd({ animated: true }), 50);
      return;
    }
    toque(false);
    marcarFeedSujo();
    if (ehBancada()) {
      aviso.mostrar("Publicado.");
      return;
    }
    router.back();
  };

  const publicar = () => regras.exigir(() => void enviar());
  const podePublicar = !enviando && !preparando && (texto.trim().length > 0 || fotos.length > 0);

  if (cuidado && !ehBancada()) {
    return (
      <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: cor.fundo }}>
        <Cabecalho titulo="Publicar" />
        <View style={{ padding: espaco.lg }}>
          <T tipo="apagado">Publicar não está disponível agora.</T>
          <Botao rotulo="Voltar" tipo="secundario" aoTocar={voltar} estilo={{ marginTop: espaco.md }} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1, backgroundColor: cor.fundo }}>
      <Cabecalho
        titulo="Nova publicação"
        direita={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Publicar"
            accessibilityState={{ disabled: !podePublicar }}
            disabled={!podePublicar}
            onPress={publicar}
            style={{ minHeight: ALVO_MINIMO, justifyContent: "center", paddingHorizontal: espaco.md }}
          >
            <Text style={{ fontFamily: fonte.titulo, fontSize: 16, color: podePublicar ? cor.primaria : cor.primariaSuave }}>
              Publicar
            </Text>
          </Pressable>
        }
      />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView ref={rolagem} contentContainerStyle={{ padding: espaco.lg, gap: espaco.lg, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
          <View style={{ gap: 6 }}>
            <TextInput
              value={texto}
              onChangeText={(t) => {
                setTexto(t);
                if (recusa) setRecusa(null);
              }}
              placeholder="Conte como você está hoje…"
              placeholderTextColor={cor.textoApagado}
              accessibilityLabel="Texto da publicação"
              multiline
              maxLength={LIMITE_DO_TEXTO}
              style={{
                minHeight: 120,
                textAlignVertical: "top",
                borderRadius: raio.md,
                borderWidth: 1,
                borderColor: cor.borda,
                backgroundColor: cor.cartao,
                padding: espaco.lg,
                fontFamily: fonte.normal,
                fontSize: 17,
                lineHeight: 24,
                color: cor.texto,
              }}
            />
            <Text style={{ alignSelf: "flex-end", fontFamily: fonte.normal, fontSize: 13, color: texto.length > LIMITE_DO_TEXTO - 40 ? cor.atencao : cor.textoApagado }}>
              {texto.length}/{LIMITE_DO_TEXTO}
            </Text>
          </View>

          {/* Fotos */}
          <View style={{ gap: espaco.sm }}>
            <T tipo="rotulo">Fotos ({fotos.length}/{FOTOS_POR_POST})</T>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: espaco.sm }}>
              {fotos.map((f, i) => (
                <View key={`${i}-${f.slice(-16)}`} style={{ width: 104, height: 130, borderRadius: raio.md, overflow: "hidden", backgroundColor: cor.apagado }}>
                  <Image source={fonteDaImagem(f)} style={{ width: 104, height: 130 }} contentFit="cover" />
                  {i === 0 && fotos.length > 1 ? (
                    <View style={{ position: "absolute", left: 6, bottom: 6, backgroundColor: "rgba(41,20,19,0.65)", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
                      <Text style={{ fontFamily: fonte.forte, fontSize: 13, color: cor.branco }}>Capa</Text>
                    </View>
                  ) : null}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Tirar a foto ${i + 1}`}
                    onPress={() => setFotos((x) => x.filter((_, k) => k !== i))}
                    style={{ position: "absolute", top: 0, right: 0, width: ALVO_MINIMO, height: ALVO_MINIMO, alignItems: "center", justifyContent: "center" }}
                  >
                    <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: "rgba(41,20,19,0.7)", alignItems: "center", justifyContent: "center" }}>
                      <X size={16} color={cor.branco} />
                    </View>
                  </Pressable>
                </View>
              ))}
              {fotos.length < FOTOS_POR_POST ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Adicionar foto"
                  disabled={preparando}
                  onPress={() => {
                    toque();
                    setEscolhendoFonte(true);
                  }}
                  style={{
                    width: 104,
                    height: 130,
                    borderRadius: raio.md,
                    borderWidth: 1.5,
                    borderStyle: "dashed",
                    borderColor: cor.primariaSuave,
                    backgroundColor: cor.cartao,
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                  }}
                >
                  <ImagePlus size={26} color={cor.primaria} />
                  <Text style={{ fontFamily: fonte.forte, fontSize: 13, color: cor.primariaEscura }}>
                    {preparando ? "Preparando…" : "Adicionar"}
                  </Text>
                </Pressable>
              ) : null}
            </ScrollView>
          </View>

          {fotos.length > 0 ? (
            <View style={{ gap: espaco.sm }}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: descricaoAberta }}
                onPress={() => setDescricaoAberta((v) => !v)}
                style={{ minHeight: ALVO_MINIMO, flexDirection: "row", alignItems: "center", gap: espaco.sm }}
              >
                <Text style={{ flex: 1, fontFamily: fonte.forte, fontSize: 15, color: cor.texto }}>
                  Descrever a foto{alt.trim() ? " ✓" : ""}
                </Text>
                {descricaoAberta ? <ChevronUp size={20} color={cor.textoApagado} /> : <ChevronDown size={20} color={cor.textoApagado} />}
              </Pressable>
              {descricaoAberta ? (
                <Campo
                  rotulo="Descrição da foto"
                  dica="Quem usa leitor de tela ouve esta frase no lugar da foto."
                  value={alt}
                  onChangeText={setAlt}
                  maxLength={300}
                  placeholder="Ex.: eu de perfil, no parque, com as mãos na barriga"
                />
              ) : null}
            </View>
          ) : null}

          {/* Quem vê */}
          <View style={{ gap: espaco.sm }}>
            <T tipo="rotulo">Quem pode ver</T>
            <View accessibilityRole="radiogroup" style={{ gap: espaco.sm }}>
              {VISIBILIDADES.map((v) => {
                const ativa = v.chave === visibilidade;
                const Icone = ICONE[v.chave];
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
                      minHeight: ALVO_MINIMO + 12,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: espaco.md,
                      paddingHorizontal: espaco.md,
                      borderRadius: raio.md,
                      borderWidth: ativa ? 2 : 1,
                      borderColor: ativa ? cor.primaria : cor.borda,
                      backgroundColor: ativa ? cor.destaque : cor.cartao,
                    }}
                  >
                    <Icone size={20} color={ativa ? cor.primariaEscura : cor.textoApagado} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: fonte.forte, fontSize: 15, color: cor.texto }}>{v.rotulo}</Text>
                      <Text style={{ fontFamily: fonte.normal, fontSize: 13, color: cor.textoApagado }}>{v.sub}</Text>
                    </View>
                    {ativa ? <Check size={20} color={cor.primaria} /> : null}
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Sensível */}
          <View style={{ gap: espaco.sm, backgroundColor: cor.cartao, borderRadius: raio.md, padding: espaco.md }}>
            <Linha>
              <View style={{ flex: 1 }}>
                <T tipo="rotulo">Marcar como sensível</T>
                <T tipo="apagado">Quem vê recebe um aviso antes e decide se quer abrir.</T>
              </View>
              <Switch
                value={sensivel}
                onValueChange={(v) => {
                  setSensivel(v);
                  if (!v) setMotivo(null);
                }}
                trackColor={{ true: cor.primaria, false: cor.borda }}
                accessibilityLabel="Marcar como sensível"
              />
            </Linha>
            {sensivel ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: espaco.sm }}>
                {MOTIVOS_SENSIVEIS.map((m) => {
                  const ativo = motivo === m.id;
                  return (
                    <Pressable
                      key={m.id}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: ativo, checked: ativo }}
                      onPress={() => setMotivo(ativo ? null : m.id)}
                      style={{
                        minHeight: ALVO_MINIMO,
                        paddingHorizontal: espaco.md,
                        borderRadius: raio.pilula,
                        borderWidth: 1,
                        borderColor: ativo ? cor.primaria : cor.borda,
                        backgroundColor: ativo ? cor.destaque : cor.fundo,
                        justifyContent: "center",
                      }}
                    >
                      <Text style={{ fontFamily: fonte.forte, fontSize: 14, color: ativo ? cor.textoDestaque : cor.texto }}>{m.rotulo}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
          </View>

          {recusa ? (
            <View accessibilityLiveRegion="polite" style={{ backgroundColor: cor.atencaoFundo, borderRadius: raio.md, padding: espaco.lg, gap: 4 }}>
              <T tipo="rotulo" cor={cor.atencao}>
                Não foi publicado
              </T>
              <T tipo="corpo" estilo={{ fontSize: 15, lineHeight: 22 }}>
                {recusa}
              </T>
            </View>
          ) : null}

          <Botao rotulo="Publicar" aoTocar={publicar} carregando={enviando} desabilitado={!podePublicar} />
        </ScrollView>
      </KeyboardAvoidingView>

      <FolhaDeOpcoes
        aberta={escolhendoFonte}
        aoFechar={() => setEscolhendoFonte(false)}
        titulo="Adicionar foto"
        opcoes={[
          {
            rotulo: "Escolher da galeria",
            sub: `Até ${FOTOS_POR_POST - fotos.length} de uma vez`,
            icone: <ImagePlus size={22} color={cor.texto} />,
            aoTocar: () => {
              /* ⚠️ O iOS não apresenta o seletor enquanto a folha ainda está
                 saindo da tela — espera a animação terminar. */
              setPreparando(true);
              const limite = FOTOS_POR_POST - fotos.length;
              setTimeout(() => void escolherDaGaleria(limite).then(recebeu), 500);
            },
          },
          {
            rotulo: "Tirar uma foto",
            icone: <Camera size={22} color={cor.texto} />,
            aoTocar: () => {
              setPreparando(true);
              setTimeout(() => void tirarFoto().then(recebeu), 500);
            },
          },
        ]}
      />
      <FolhaDasRegras {...regras.folha} />
      {aviso.elemento}
    </SafeAreaView>
  );
}
