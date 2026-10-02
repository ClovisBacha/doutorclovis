import { passoDaDigitacao, avisoQuePodeAparecer } from "@/lib/chat-stream";
import { tituloDaFoto, type AssuntoDaFoto } from "@/lib/foto-da-nutricao";
import { recadoDaAmostra, recadoDoBloqueio, type MotivoDoBloqueio } from "@/lib/nutricao-premium";
import { pedeSocorro } from "@/lib/socorro-na-nutricao";
import * as ImagePicker from "expo-image-picker";
import { Redirect, router } from "expo-router";
import { ArrowUp, Camera, ChevronLeft, Phone, ScanText, ShieldCheck, X } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AccessibilityInfo,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Botao, Cartao, T, toque } from "~/componentes/base";
import { Bolha, BolhaChegando } from "~/componentes/nutricao/Bolha";
import { CartaoDoSocorro } from "~/componentes/nutricao/CartaoDoSocorro";
import { FolhaDaFoto } from "~/componentes/nutricao/FolhaDaFoto";
import { SAMU } from "~/config";
import { ehBancada, parametroDaBancada } from "~/lib/bancada";
import {
  CartaoDaPermissaoDeIA,
  FolhaDaPermissaoDeIA,
  usePermissaoDeIA,
  type EstadoDaPermissao,
} from "~/lib/ia/PermissaoDeIA";
import {
  conversaDeExemplo,
  RESPOSTA_DA_BANCADA,
  socorroDeExemplo,
} from "~/lib/nutricao/exemplo-da-bancada";
import { fraseDoTopo } from "~/lib/nutricao/frase-do-topo";
import { historicoParaEnviar, type Turno } from "~/lib/nutricao/historico";
import { perguntasProntas } from "~/lib/nutricao/perguntas-prontas";
import {
  gravarTroca,
  lerMemoria,
  mandarFoto,
  perguntarANutricionista,
  prepararFoto,
} from "~/lib/nutricao/rede";
import { RECADO_DO_AVISO, recadoDaFoto, type Aviso } from "~/lib/nutricao/respostas";
import { RESPOSTA_DO_SOCORRO_NO_APP } from "~/lib/nutricao/socorro";
import { useSessao } from "~/lib/sessao";
import { ALVO_MINIMO, cor, espaco, fonte, raio } from "~/tema";

/**
 * A NUTRIÇÃO — a nutricionista com IA: conversa e foto do prato/rótulo.
 *
 * A ordem de cada envio é a régua do produto:
 *   1. SOCORRO (`pedeSocorro`) — antes de tudo, no aparelho, sem rede, sem
 *      permissão, sem Premium, também no Modo Cuidado. A mensagem não sai.
 *   2. PERMISSÃO DE IA — nada vai ao Google antes do "Permitir" (5.1.2(i)).
 *   3. a rede — e cada resposta do servidor com o seu recado
 *      (`respostas.ts`): 401 sessão, 402 porta, 429 espera.
 */

let sequencia = 0;
const novoId = (p: string) => `${p}-${Date.now().toString(36)}-${(sequencia++).toString(36)}`;

type EstadoDaBancada =
  | "permissao"
  | "negou"
  | "bloqueado"
  | "socorro"
  | "amostra"
  | "vazia"
  | "foto"
  | "ver-permissao"
  | null;

function inicialDaBancada(): {
  estado: EstadoDaBancada;
  permissao: EstadoDaPermissao;
  turnos: Turno[];
  bloqueio: MotivoDoBloqueio | null;
  campo: string;
  amostra: number | null;
} {
  const vazio = { estado: null, permissao: "permitida" as const, turnos: [], bloqueio: null, campo: "", amostra: null };
  if (!ehBancada()) return vazio;
  const estado = parametroDaBancada("estado") as EstadoDaBancada;
  /* No Modo Cuidado a memória não é lida, e a conversa de exemplo fala do
     bebê: a bancada abre VAZIA, como a produção abriria. `&estado=vazia` é a
     primeira visita (frase da fase e perguntas prontas). */
  const conversa =
    parametroDaBancada("luto") === "1" || estado === "vazia" ? [] : conversaDeExemplo();
  switch (estado) {
    case "permissao":
      return { ...vazio, estado, permissao: "pendente" };
    case "negou":
      return { ...vazio, estado, permissao: "negada" };
    case "bloqueado":
      return {
        ...vazio,
        estado,
        turnos: conversa,
        bloqueio: parametroDaBancada("motivo") === "teto_diario" ? "teto_diario" : "sem_premium",
        campo: "E de sobremesa, o que posso comer?",
      };
    case "socorro":
      return { ...vazio, estado, turnos: [...conversa.slice(0, 2), ...socorroDeExemplo()] };
    case "amostra":
      return { ...vazio, estado, turnos: conversa, amostra: 2 };
    case "foto":
    case "ver-permissao":
      return { ...vazio, estado, turnos: conversa };
    default:
      return { ...vazio, estado: null, turnos: conversa };
  }
}

export function TelaDaNutricao() {
  const { sessao, carregandoSessao, perfil, cuidado } = useSessao();
  const bancada = ehBancada();
  const uid = sessao?.user.id ?? null;
  const inicio = useMemo(inicialDaBancada, []);
  const permissao = usePermissaoDeIA(uid, inicio.permissao);

  const [turnos, setTurnos] = useState<Turno[]>(inicio.turnos);
  const [campo, setCampo] = useState(inicio.campo);
  const [enviando, setEnviando] = useState(false);
  const [chegando, setChegando] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ tipo: Aviso; texto: string } | null>(null);
  const [bloqueio, setBloqueio] = useState<MotivoDoBloqueio | null>(inicio.bloqueio);
  const [amostra, setAmostra] = useState<number | null>(inicio.amostra);
  const [memoriaFalhou, setMemoriaFalhou] = useState(false);
  const [assuntoDaFoto, setAssuntoDaFoto] = useState<AssuntoDaFoto | null>(
    inicio.estado === "foto" ? "prato" : null,
  );
  const [verPermissao, setVerPermissao] = useState(inicio.estado === "ver-permissao");
  const [semAnimacao, setSemAnimacao] = useState(false);

  /* O que ela tentou fazer antes de permitir: feito logo depois do "sim". */
  const pendente = useRef<{ tipo: "texto"; texto: string } | { tipo: "foto"; assunto: AssuntoDaFoto } | null>(null);
  const rolagem = useRef<ScrollView>(null);
  /* Sair da tela cancela o que estiver no ar. Criado no efeito (e não no
     useRef) para que um efeito rodado duas vezes não deixe o sinal já
     abortado para sempre. */
  const saindo = useRef(new AbortController());
  useEffect(() => {
    const c = new AbortController();
    saindo.current = c;
    return () => c.abort();
  }, []);
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled()
      .then(setSemAnimacao)
      .catch(() => {});
  }, []);

  const frase = fraseDoTopo(perfil, cuidado);
  const prontas = perguntasProntas(cuidado);

  /* ─── A MEMÓRIA CURTA ─────────────────────────────────────────────────
     Os últimos turnos voltam na abertura. NADA no Modo Cuidado (uma conversa
     de antes da perda pode falar do bebê) e nada na bancada. */
  const memoriaLida = useRef(false);
  useEffect(() => {
    if (bancada || cuidado || !uid || permissao.estado !== "permitida" || memoriaLida.current) return;
    memoriaLida.current = true;
    void lerMemoria(uid).then((r) => {
      if (r.tipo === "falhou") setMemoriaFalhou(true);
      if (r.tipo !== "ok" || !r.turnos.length) return;
      /* Só se ela ainda não começou nesta visita. */
      setTurnos((atual) => (atual.length ? atual : r.turnos));
    });
  }, [bancada, cuidado, uid, permissao.estado]);

  /* ─── A DIGITAÇÃO ─────────────────────────────────────────────────────
     A mesma cadência do site (`passoDaDigitacao`): o texto aparece em ritmo
     de leitura enquanto chega, e acaba depressa quando já chegou tudo. */
  const alvo = useRef("");
  const mostrado = useRef(0);
  const aberto = useRef(false);
  const quadro = useRef<number | null>(null);
  const desenhar = useCallback(() => {
    const passo = passoDaDigitacao(alvo.current.length - mostrado.current, aberto.current);
    if (passo > 0) {
      mostrado.current = Math.min(alvo.current.length, mostrado.current + passo);
      setChegando(alvo.current.slice(0, mostrado.current));
    }
    quadro.current =
      aberto.current || mostrado.current < alvo.current.length ? requestAnimationFrame(desenhar) : null;
  }, []);
  const comecarDigitacao = () => {
    alvo.current = "";
    mostrado.current = 0;
    aberto.current = true;
    setChegando("");
    if (!semAnimacao) quadro.current = requestAnimationFrame(desenhar);
  };
  const pararDigitacao = () => {
    aberto.current = false;
    if (quadro.current !== null) cancelAnimationFrame(quadro.current);
    quadro.current = null;
    setChegando(null);
  };
  const esperarDigitacao = () =>
    new Promise<void>((pronto) => {
      const conferir = () =>
        semAnimacao || mostrado.current >= alvo.current.length ? pronto() : setTimeout(conferir, 50);
      conferir();
    });
  useEffect(() => () => {
    if (quadro.current !== null) cancelAnimationFrame(quadro.current);
  }, []);

  /* ─── O ENVIO ────────────────────────────────────────────────────────── */
  async function enviar(bruto?: string) {
    const msg = (bruto ?? campo).trim();
    if (!msg || enviando) return;

    /* 1 · SOCORRO — antes de tudo, e a mensagem NÃO sai do aparelho. */
    if (pedeSocorro(msg)) {
      setTurnos((t) => [
        ...t,
        { id: novoId("socorro"), role: "user", texto: msg, especie: "socorro" },
        { id: novoId("socorro"), role: "assistant", texto: RESPOSTA_DO_SOCORRO_NO_APP, especie: "socorro" },
      ]);
      setCampo("");
      return;
    }

    /* 2 · PERMISSÃO — nada vai à IA antes do "Permitir". */
    if (permissao.estado !== "permitida") {
      pendente.current = { tipo: "texto", texto: msg };
      setCampo(msg);
      permissao.rever();
      return;
    }

    /* 3 · A REDE. */
    setAviso(null);
    setBloqueio(null);
    const pergunta: Turno = { id: novoId("ela"), role: "user", texto: msg, especie: "conversa" };
    const mensagens = historicoParaEnviar(turnos, msg);
    setTurnos((t) => [...t, pergunta]);
    setCampo("");
    setEnviando(true);
    const tirarPergunta = () => setTurnos((t) => t.filter((x) => x.id !== pergunta.id));

    if (bancada) {
      /* Na bancada nada vai à rede: a resposta é um recado do próprio app. */
      setChegando("");
      setTimeout(() => {
        setChegando(null);
        setTurnos((t) => [
          ...t,
          { id: novoId("bancada"), role: "assistant", texto: RESPOSTA_DA_BANCADA, especie: "recado" },
        ]);
        setEnviando(false);
      }, 500);
      return;
    }

    comecarDigitacao();
    try {
      const r = await perguntarANutricionista({
        mensagens,
        sinal: saindo.current.signal,
        aoChegar: (e) => {
          alvo.current = e.texto;
          if (semAnimacao) setChegando(e.texto);
        },
        aoSaberAmostra: setAmostra,
      });
      if (saindo.current.signal.aborted) return;
      aberto.current = false;
      if (r.tipo === "ok") {
        await esperarDigitacao();
        pararDigitacao();
        setTurnos((t) => [
          ...t,
          {
            id: novoId("ia"),
            role: "assistant",
            texto: r.texto,
            especie: "conversa",
            ...(r.assinatura ? { assinatura: r.assinatura } : {}),
          },
        ]);
        if (!cuidado && uid) {
          void gravarTroca(uid, msg, { content: r.texto, ...(r.assinatura ? { assinatura: r.assinatura } : {}) });
        }
        return;
      }
      pararDigitacao();
      if (r.tipo === "bloqueio") {
        /* ⚠️ 402 é a porta, não um erro — e o texto dela VOLTA ao campo. */
        tirarPergunta();
        setCampo(msg);
        setBloqueio(r.motivo);
        return;
      }
      if (r.tipo === "aviso") {
        tirarPergunta();
        setCampo(msg);
        setAviso({ tipo: r.aviso, texto: RECADO_DO_AVISO[r.aviso] });
        return;
      }
      /* Quebrou no meio. O que chegou fica como recado (sem assinatura, não
         volta ao modelo); sem nada, a pergunta volta ao campo. */
      const doServidor = r.erro ? avisoQuePodeAparecer(r.erro) : null;
      if (r.parcial.trim()) {
        setTurnos((t) => [
          ...t,
          { id: novoId("parcial"), role: "assistant", texto: r.parcial, especie: "recado" },
        ]);
        setAviso({ tipo: "falha", texto: doServidor ?? "A resposta foi interrompida no meio. Pode perguntar de novo." });
      } else {
        tirarPergunta();
        setCampo(msg);
        setAviso({ tipo: "falha", texto: doServidor ?? RECADO_DO_AVISO.falha });
      }
    } catch {
      /* Qualquer coisa inesperada: nunca a bolha "escrevendo…" para sempre. */
      if (saindo.current.signal.aborted) return;
      pararDigitacao();
      tirarPergunta();
      setCampo(msg);
      setAviso({ tipo: "falha", texto: RECADO_DO_AVISO.falha });
    } finally {
      if (!saindo.current.signal.aborted) setEnviando(false);
    }
  }

  /* ─── A FOTO ─────────────────────────────────────────────────────────── */
  function pedirFoto(assunto: AssuntoDaFoto) {
    if (enviando) return;
    if (permissao.estado !== "permitida") {
      pendente.current = { tipo: "foto", assunto };
      permissao.rever();
      return;
    }
    setAssuntoDaFoto(assunto);
  }

  async function escolherFoto(origem: "camera" | "galeria") {
    const assunto = assuntoDaFoto;
    setAssuntoDaFoto(null);
    if (!assunto) return;
    if (bancada) {
      setAviso({ tipo: "falha", texto: "Na bancada a câmera não abre: nada vai à rede." });
      return;
    }
    /* ⚠️ O iOS não apresenta a câmera enquanto a folha ainda está saindo da
       tela: sem esta espera o toque em "Tirar foto" às vezes não faz nada. */
    await new Promise((r) => setTimeout(r, 450));
    let resultado: ImagePicker.ImagePickerResult;
    try {
      if (origem === "camera") {
        const p = await ImagePicker.requestCameraPermissionsAsync();
        if (!p.granted) {
          setAviso({
            tipo: "falha",
            texto: "O app não tem acesso à câmera. Dá para liberar nos Ajustes do iPhone — ou escolher uma foto da galeria.",
          });
          return;
        }
        resultado = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 1 });
      } else {
        resultado = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1 });
      }
    } catch {
      setAviso({ tipo: "falha", texto: recadoDaFoto("preparo") });
      return;
    }
    const foto = resultado.canceled ? null : resultado.assets?.[0];
    if (!foto) return;

    setAviso(null);
    setBloqueio(null);
    const titulo = tituloDaFoto(assunto);
    const pergunta: Turno = { id: novoId("foto"), role: "user", texto: titulo, especie: "conversa", foto: foto.uri };
    const recado = (texto: string) =>
      setTurnos((t) => [...t, { id: novoId("recado"), role: "assistant", texto, especie: "recado" }]);
    setTurnos((t) => [...t, pergunta]);
    setEnviando(true);
    setChegando("");
    try {
      const pronta = await prepararFoto(foto.uri, foto.width, foto.height);
      if ("erro" in pronta) {
        recado(recadoDaFoto(pronta.erro));
        return;
      }
      const d = await mandarFoto({ bytes: pronta.bytes, assunto, sinal: saindo.current.signal });
      if (saindo.current.signal.aborted) return;
      if (d.tipo === "ok") {
        setAmostra(d.amostra);
        setTurnos((t) => [
          ...t,
          {
            id: novoId("ia"),
            role: "assistant",
            texto: d.texto,
            especie: "conversa",
            ...(d.assinatura ? { assinatura: d.assinatura } : {}),
          },
        ]);
        if (!cuidado && uid) {
          void gravarTroca(uid, titulo, { content: d.texto, ...(d.assinatura ? { assinatura: d.assinatura } : {}) });
        }
      } else if (d.tipo === "bloqueio") {
        setTurnos((t) => t.filter((x) => x.id !== pergunta.id));
        setBloqueio(d.motivo);
      } else if (d.tipo === "sessao") {
        setTurnos((t) => t.filter((x) => x.id !== pergunta.id));
        setAviso({ tipo: "sessao", texto: RECADO_DO_AVISO.sessao });
      } else {
        recado(d.texto);
      }
    } finally {
      if (!saindo.current.signal.aborted) {
        setChegando(null);
        setEnviando(false);
      }
    }
  }

  /* ─── A PERMISSÃO ───────────────────────────────────────────────────── */
  async function aoPermitir() {
    const ok = await permissao.permitir();
    if (!ok) return;
    const p = pendente.current;
    pendente.current = null;
    /* O envio pendente roda no efeito abaixo, quando "permitida" já valeu
       para `enviar` (chamá-lo daqui usaria o estado de antes do "sim"). */
    if (p?.tipo === "texto") fila.current = p.texto;
    /* A folha da foto espera a da permissão terminar de sair (o iOS não
       apresenta um modal por cima de outro que ainda está fechando). */
    if (p?.tipo === "foto") setTimeout(() => setAssuntoDaFoto(p.assunto), 450);
  }
  const fila = useRef<string | null>(null);
  useEffect(() => {
    if (permissao.estado === "permitida" && fila.current) {
      const t = fila.current;
      fila.current = null;
      void enviar(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permissao.estado]);

  const voltar = () => (router.canGoBack() ? router.back() : router.replace("/saude"));

  if (!bancada && !carregandoSessao && !sessao) return <Redirect href="/entrar" />;

  const podeConversar = permissao.estado === "permitida";
  const vazia = turnos.length === 0 && chegando === null;

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: cor.fundo }}>
      <Cabecalho
        aoVoltar={voltar}
        mostrarPermissao={permissao.estado === "permitida"}
        aoVerPermissao={() => setVerPermissao(true)}
      />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          ref={rolagem}
          contentContainerStyle={{ padding: espaco.lg, gap: espaco.md, paddingBottom: espaco.xl }}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => {
            if (!vazia) rolagem.current?.scrollToEnd({ animated: true });
          }}
        >
          {frase ? (
            <Cartao fundo={cor.nutricaoFundo} estilo={{ shadowOpacity: 0, elevation: 0 }}>
              <T tipo="rotulo" cor={cor.nutricao} estilo={{ fontSize: 13, letterSpacing: 0.4 }}>
                PARA A SUA FASE
              </T>
              <T tipo="subtitulo">{frase.titulo}</T>
              <T>{frase.texto}</T>
            </Cartao>
          ) : null}

          {permissao.estado === "carregando" ? null : podeConversar ? (
            <>
              {vazia ? (
                <View style={{ gap: espaco.md }}>
                  <T tipo="apagado">
                    Pergunte sobre comida: o que pode, o que evitar, o que fazer com o que tem em casa. Ou
                    mande a foto do prato ou de um rótulo.
                  </T>
                  <View style={{ gap: espaco.sm }}>
                    {prontas.map((p) => (
                      <PerguntaPronta key={p} texto={p} aoTocar={() => void enviar(p)} />
                    ))}
                  </View>
                </View>
              ) : null}
              {memoriaFalhou ? (
                <T tipo="apagado">
                  Não consegui trazer a conversa anterior agora — isso é a conexão. Você pode perguntar
                  normalmente.
                </T>
              ) : null}
              {turnos.map((t) =>
                t.especie === "socorro" && t.role === "assistant" ? (
                  <CartaoDoSocorro key={t.id} texto={t.texto} />
                ) : (
                  <Bolha key={t.id} turno={t} />
                ),
              )}
              {chegando !== null ? <BolhaChegando texto={chegando} /> : null}
              <T tipo="apagado" estilo={{ fontSize: 13, textAlign: "center", marginTop: espaco.sm }}>
                Respostas geradas pela IA do Google. Podem errar e não substituem a sua consulta.
              </T>
            </>
          ) : (
            <SemPermissao aoRever={permissao.rever} turnos={turnos} />
          )}
        </ScrollView>

        {podeConversar ? (
          <Compositor
            campo={campo}
            setCampo={setCampo}
            enviando={enviando}
            aoEnviar={() => void enviar()}
            aoFoto={pedirFoto}
            aviso={aviso}
            aoFecharAviso={() => setAviso(null)}
            bloqueio={bloqueio}
            aoFecharBloqueio={() => setBloqueio(null)}
            amostra={amostra}
          />
        ) : null}
      </KeyboardAvoidingView>

      <FolhaDaPermissaoDeIA
        visivel={permissao.estado === "pendente"}
        falhouGravar={permissao.falhouGravar}
        aoPermitir={() => void aoPermitir()}
        aoRecusar={() => {
          pendente.current = null;
          fila.current = null;
          permissao.negar();
        }}
      />
      <FolhaDaFoto
        assunto={assuntoDaFoto}
        aoEscolher={(o) => void escolherFoto(o)}
        aoFechar={() => setAssuntoDaFoto(null)}
      />
      <Modal
        visible={verPermissao}
        transparent
        animationType="fade"
        onRequestClose={() => setVerPermissao(false)}
      >
        <Pressable
          onPress={() => setVerPermissao(false)}
          style={{ flex: 1, backgroundColor: "rgba(41,20,19,0.35)", justifyContent: "center", padding: espaco.lg }}
        >
          <Pressable onPress={() => {}} style={{ gap: espaco.sm }}>
            <CartaoDaPermissaoDeIA permissao={permissao} aoMudar={() => setVerPermissao(false)} />
            <Botao rotulo="Fechar" tipo="secundario" aoTocar={() => setVerPermissao(false)} />
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

/* ─── PEDAÇOS ──────────────────────────────────────────────────────────── */

function Cabecalho({
  aoVoltar,
  mostrarPermissao,
  aoVerPermissao,
}: {
  aoVoltar: () => void;
  mostrarPermissao: boolean;
  aoVerPermissao: () => void;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: espaco.sm,
        paddingVertical: espaco.xs,
        borderBottomWidth: 1,
        borderBottomColor: cor.borda,
        gap: espaco.xs,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Voltar"
        onPress={() => {
          toque();
          aoVoltar();
        }}
        style={{ width: ALVO_MINIMO, height: ALVO_MINIMO, alignItems: "center", justifyContent: "center" }}
      >
        <ChevronLeft size={28} color={cor.texto} />
      </Pressable>
      <View style={{ flex: 1 }}>
        <T tipo="subtitulo">Nutrição</T>
        <T tipo="apagado" estilo={{ fontSize: 13, lineHeight: 17 }}>
          Nutricionista com IA
        </T>
      </View>
      {mostrarPermissao ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Permissão de IA"
          onPress={() => {
            toque();
            aoVerPermissao();
          }}
          style={({ pressed }) => ({
            minHeight: ALVO_MINIMO,
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            paddingHorizontal: espaco.sm,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <ShieldCheck size={18} color={cor.nutricao} />
          <Text style={{ fontFamily: fonte.forte, fontSize: 13, color: cor.nutricao }}>Permissão de IA</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function PerguntaPronta({ texto, aoTocar }: { texto: string; aoTocar: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Perguntar: ${texto}`}
      onPress={() => {
        toque();
        aoTocar();
      }}
      style={({ pressed }) => ({
        minHeight: ALVO_MINIMO,
        alignSelf: "flex-start",
        justifyContent: "center",
        paddingHorizontal: espaco.lg,
        paddingVertical: espaco.sm,
        borderRadius: raio.pilula,
        borderWidth: 1,
        borderColor: "#bef264",
        backgroundColor: pressed ? cor.nutricaoFundo : cor.cartao,
      })}
    >
      <Text style={{ fontFamily: fonte.media, fontSize: 15, color: cor.nutricao }}>{texto}</Text>
    </Pressable>
  );
}

/**
 * "Agora não": a tela fica, sem campo de conversa, com o caminho para rever.
 * ⚠️ O socorro continua aqui — ele nunca dependeu da permissão de IA.
 */
function SemPermissao({ aoRever, turnos }: { aoRever: () => void; turnos: Turno[] }) {
  return (
    <View style={{ gap: espaco.md }}>
      <Cartao>
        <T tipo="rotulo">A nutricionista com IA está desligada</T>
        <T tipo="apagado">
          Nada do que você escreve ou fotografa sai do aparelho para a IA sem a sua permissão. Se mudar de
          ideia, é só rever.
        </T>
        <Botao rotulo="Rever a decisão" corFundo={cor.nutricao} aoTocar={aoRever} />
      </Cartao>
      {turnos
        .filter((t) => t.especie === "socorro" && t.role === "assistant")
        .map((t) => (
          <CartaoDoSocorro key={t.id} texto={t.texto} />
        ))}
      <Cartao fundo={cor.urgenteFundo} estilo={{ shadowOpacity: 0, elevation: 0 }}>
        <T tipo="rotulo" cor={cor.urgente}>
          Passando mal?
        </T>
        <T tipo="apagado">Sangramento, dor forte, visão turva, falta de ar ou febre: não espere.</T>
        <Botao
          rotulo={`Ligar ${SAMU}`}
          tipo="perigo"
          icone={<Phone size={20} color={cor.branco} />}
          aoTocar={() => void Linking.openURL(`tel:${SAMU}`).catch(() => {})}
        />
      </Cartao>
    </View>
  );
}

function Compositor({
  campo,
  setCampo,
  enviando,
  aoEnviar,
  aoFoto,
  aviso,
  aoFecharAviso,
  bloqueio,
  aoFecharBloqueio,
  amostra,
}: {
  campo: string;
  setCampo: (t: string) => void;
  enviando: boolean;
  aoEnviar: () => void;
  aoFoto: (a: AssuntoDaFoto) => void;
  aviso: { tipo: Aviso; texto: string } | null;
  aoFecharAviso: () => void;
  bloqueio: MotivoDoBloqueio | null;
  aoFecharBloqueio: () => void;
  amostra: number | null;
}) {
  const baixo = useSafeAreaInsets().bottom;
  const linhaDaAmostra = recadoDaAmostra(amostra);
  const porta = bloqueio ? recadoDoBloqueio(bloqueio) : null;
  const vazio = !campo.trim();
  return (
    <View
      style={{
        borderTopWidth: 1,
        borderTopColor: cor.borda,
        backgroundColor: cor.fundo,
        paddingHorizontal: espaco.lg,
        paddingTop: espaco.sm,
        paddingBottom: Math.max(baixo, espaco.sm),
        gap: espaco.sm,
      }}
    >
      {porta ? (
        <Faixa fundo={cor.nutricaoFundo} titulo={porta.titulo} texto={porta.texto} aoFechar={aoFecharBloqueio} />
      ) : null}
      {aviso ? (
        <Faixa fundo={cor.atencaoFundo} texto={aviso.texto} aoFechar={aoFecharAviso}>
          {aviso.tipo === "sessao" ? (
            <Botao rotulo="Entrar de novo" tipo="secundario" aoTocar={() => router.replace("/entrar")} />
          ) : null}
        </Faixa>
      ) : null}
      {linhaDaAmostra ? (
        <T tipo="apagado" estilo={{ fontSize: 13, textAlign: "center" }}>
          {linhaDaAmostra}
        </T>
      ) : null}
      <View style={{ flexDirection: "row", gap: espaco.sm }}>
        <BotaoDeFoto rotulo="Foto do prato" icone="prato" desabilitado={enviando} aoTocar={() => aoFoto("prato")} />
        <BotaoDeFoto rotulo="Rótulo" icone="rotulo" desabilitado={enviando} aoTocar={() => aoFoto("rotulo")} />
      </View>
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: espaco.sm }}>
        <TextInput
          value={campo}
          onChangeText={setCampo}
          editable={!enviando}
          placeholder="Pergunte à nutricionista…"
          placeholderTextColor={cor.textoApagado}
          accessibilityLabel="Sua pergunta para a nutricionista"
          multiline
          maxLength={4000}
          style={{
            flex: 1,
            minHeight: ALVO_MINIMO + 4,
            maxHeight: 120,
            borderRadius: raio.lg,
            borderWidth: 1,
            borderColor: cor.borda,
            backgroundColor: cor.cartao,
            paddingHorizontal: espaco.lg,
            paddingTop: 13,
            paddingBottom: 13,
            fontFamily: fonte.normal,
            fontSize: 16,
            color: cor.texto,
          }}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Enviar"
          accessibilityState={{ disabled: vazio || enviando, busy: enviando }}
          disabled={vazio || enviando}
          onPress={() => {
            toque();
            aoEnviar();
          }}
          style={({ pressed }) => ({
            width: ALVO_MINIMO + 4,
            height: ALVO_MINIMO + 4,
            borderRadius: raio.pilula,
            backgroundColor: vazio || enviando ? cor.borda : cor.nutricao,
            alignItems: "center",
            justifyContent: "center",
            opacity: pressed ? 0.8 : 1,
          })}
        >
          <ArrowUp size={24} color={cor.branco} />
        </Pressable>
      </View>
    </View>
  );
}

function BotaoDeFoto({
  rotulo,
  icone,
  desabilitado,
  aoTocar,
}: {
  rotulo: string;
  icone: "prato" | "rotulo";
  desabilitado: boolean;
  aoTocar: () => void;
}) {
  const Icone = icone === "prato" ? Camera : ScanText;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${rotulo}. A foto não fica guardada.`}
      accessibilityState={{ disabled: desabilitado }}
      disabled={desabilitado}
      onPress={() => {
        toque();
        aoTocar();
      }}
      style={({ pressed }) => ({
        flex: 1,
        minHeight: ALVO_MINIMO,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        borderRadius: raio.pilula,
        backgroundColor: cor.nutricaoFundo,
        opacity: desabilitado ? 0.5 : pressed ? 0.75 : 1,
      })}
    >
      <Icone size={18} color={cor.nutricao} />
      <Text style={{ fontFamily: fonte.forte, fontSize: 14, color: cor.nutricao }}>{rotulo}</Text>
    </Pressable>
  );
}

function Faixa({
  fundo,
  titulo,
  texto,
  aoFechar,
  children,
}: {
  fundo: string;
  titulo?: string;
  texto: string;
  aoFechar: () => void;
  children?: ReactNode;
}) {
  return (
    <View style={{ backgroundColor: fundo, borderRadius: raio.md, padding: espaco.md, gap: espaco.sm }}>
      <View style={{ flexDirection: "row", gap: espaco.sm }}>
        <View style={{ flex: 1, gap: 4 }}>
          {titulo ? <T tipo="rotulo">{titulo}</T> : null}
          <T tipo="apagado" cor={cor.texto}>
            {texto}
          </T>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Fechar aviso"
          onPress={aoFechar}
          style={{ width: ALVO_MINIMO, height: ALVO_MINIMO, alignItems: "center", justifyContent: "center", marginTop: -10, marginRight: -10 }}
        >
          <X size={18} color={cor.textoApagado} />
        </Pressable>
      </View>
      {children}
    </View>
  );
}
