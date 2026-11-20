import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import Check from "lucide-react-native/icons/check";
import Flame from "lucide-react-native/icons/flame";
import Gift from "lucide-react-native/icons/gift";
import Heart from "lucide-react-native/icons/heart";
import Sprout from "lucide-react-native/icons/sprout";
import Star from "lucide-react-native/icons/star";
import Timer from "lucide-react-native/icons/timer";
import { useEffect, useState, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { BalaoQueFala } from "~/componentes/bolha/na-entrada";
import { corCaminho } from "~/componentes/caminho/cores";
import { Moeda3D } from "~/componentes/caminho/pecas";
import { corDaAtividade } from "~/componentes/jornada/cores";
import { ArteDaBolha, BolhaViva, Flutuar } from "~/componentes/movimento";
import { ARTE_DO_SOM } from "~/lib/audio/sons-de-fundo";
import { FALA_NA_ENTRADA } from "~/lib/boas-vindas";
import { comAlfa, misturar } from "~/lib/cor";
import { coresDaSemana } from "~/lib/jornada/caminho";
import { ROTULO_DO_SOM_NO_APP } from "~/lib/jornada/sons";
import {
  canto,
  cor,
  curva,
  escala,
  espaco,
  fonte,
  fonteDoNumero,
  luz,
  ouro,
  sombraFlutuante,
} from "~/tema";

/**
 * AS VITRINES DOS SLIDES DE BOAS-VINDAS (17/11/2026): o produto antes de
 * pedir qualquer coisa, como no Marca Ponto. Cada vitrine é um pedaço do app
 * desenhado de verdade, e não uma ilustração genérica.
 *
 * 19/11/2026, o dono: "um aplicativo de bem-estar materno [...] o bebê bolha
 * será esse guia neste caminho". A primeira vitrine é a Bolha se apresentando
 * num balão; as do meio são os cuidados do app, cada um com a Bolha na pose
 * dele (a aula com a estudiosa, respirar com a que dorme, mexer o corpo com a
 * de faixa na testa, a trilha com a apaixonada); a última, ela comemorando.
 *
 * ⚠️ Nada aqui fala do bebê nem mostra o bebê: a entrada não sabe se quem
 * abre está no Modo Cuidado (luto). A Bolha, os cuidados e as amigas, sim.
 * ⚠️ E nenhuma pergunta de verdade das aulas: a pergunta de mostra é sobre o
 * próprio jogo (o que vale um acerto), para não virar conteúdo sem catraca.
 */

/**
 * Uma etiqueta solta sobre a arte. Material claro, e não vidro: o vidro claro
 * sobre o céu da noite fica lilás, e a letra laranja some nele (visto no
 * simulador em 17/11/2026).
 */
function Etiqueta({ icone, texto, tinta }: { icone: ReactNode; texto: string; tinta: string }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 9,
        borderRadius: canto.pilula,
        ...curva,
        backgroundColor: "rgba(255,255,255,0.94)",
        boxShadow: "0px 10px 24px -10px rgba(10,6,40,0.55)",
      }}
    >
      {icone}
      <Text style={{ ...fonteDoNumero, ...escala.chamada, color: tinta }}>{texto}</Text>
    </View>
  );
}

/* O cartão sobre o céu escuro: quase opaco (o `luz.cartao` vira cinza no escuro). */
const CARTAO_NA_NOITE = "rgba(255,255,255,0.97)";

/** O lado da Bolha grande de uma vitrine: cabe no iPhone pequeno e no grande. */
const ladoDaBolha = (largura: number, altura: number) =>
  Math.round(Math.min(200, largura * 0.5, altura * 0.23));

/* ── 0. A Bolha se apresenta ──────────────────────────────────────────── */

/**
 * A Bolha e a fala dela, num balão com a ponta para baixo. Ela "escreve" À
 * VISTA: a fala chega quando o slide chega, e a chave remonta a Bolha para
 * ela se mexer na hora.
 */
function BolhaQueFala({
  largura,
  altura,
  fala,
  humor,
  ativa,
}: {
  largura: number;
  altura: number;
  fala: string;
  humor: "feliz" | "comemorando";
  ativa: boolean;
}) {
  /* Ela escreve UMA vez, quando o slide chega; antes disso, os pontinhos. */
  const [chegou, setChegou] = useState(ativa);
  useEffect(() => {
    if (ativa) setChegou(true);
  }, [ativa]);
  return (
    <View
      style={{
        width: largura,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: espaco.xl,
        gap: espaco.lg,
      }}
    >
      <BalaoQueFala
        key={chegou ? "balao-chegou" : "balao-antes"}
        texto={fala}
        ponta="baixo"
        centro
        escrever={chegou}
        esperando={!chegou}
        estilo={{ maxWidth: 340 }}
      />
      <BolhaViva
        key={ativa ? "bolha-chegou" : "bolha-longe"}
        humor={humor}
        tamanho={ladoDaBolha(largura, altura)}
      />
    </View>
  );
}

export function VitrineDaBolha({
  largura,
  altura,
  ativa,
}: {
  largura: number;
  altura: number;
  ativa: boolean;
}) {
  return (
    <BolhaQueFala
      largura={largura}
      altura={altura}
      fala={FALA_NA_ENTRADA.ola}
      humor="feliz"
      ativa={ativa}
    />
  );
}

/* ── 1. A aula do dia ─────────────────────────────────────────────────── */

const OPCOES = [
  { texto: "Sementinhas", emoji: "🌱", certa: true },
  { texto: "Lição de casa", emoji: "📚", certa: false },
  { texto: "Uma bronca", emoji: "🙃", certa: false },
] as const;

export function VitrineDaAula({ largura }: { largura: number }) {
  const cartao = Math.min(330, largura - 64);
  return (
    <View style={{ width: largura, alignItems: "center", justifyContent: "center" }}>
      <View style={{ width: cartao }}>
        <View
          style={{
            borderRadius: 30,
            ...curva,
            backgroundColor: CARTAO_NA_NOITE,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: "rgba(255,255,255,0.95)",
            padding: espaco.lg,
            gap: espaco.md,
            ...sombraFlutuante,
          }}
        >
          {/* O alto da aula: o passo e a barra que enche. */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: espaco.sm }}>
            <Text style={{ ...fonte.forte, ...escala.nota, color: cor.textoApagado }}>
              Pergunta 2 de 5
            </Text>
            <View
              style={{
                flex: 1,
                height: 8,
                borderRadius: 4,
                backgroundColor: cor.apagado,
                overflow: "hidden",
              }}
            >
              <LinearGradient
                colors={[cor.primariaSuave, cor.primaria]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={{ width: "40%", height: "100%", borderRadius: 4 }}
              />
            </View>
          </View>
          <Text
            style={{
              ...fonte.forte,
              ...escala.titulo3,
              color: cor.texto,
              paddingRight: 64,
            }}
          >
            O que cada acerto te dá na trilha?
          </Text>
          {OPCOES.map((o) => (
            <View
              key={o.texto}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: espaco.md,
                minHeight: 50,
                paddingHorizontal: espaco.md,
                borderRadius: canto.campo,
                ...curva,
                borderWidth: o.certa ? 2 : 1,
                borderColor: o.certa ? cor.sementinha : cor.borda,
                backgroundColor: o.certa ? cor.acertoFundo : cor.branco,
              }}
            >
              <Text style={{ fontSize: escala.titulo3.fontSize }}>{o.emoji}</Text>
              <Text
                style={{
                  ...fonte.forte,
                  ...escala.chamada,
                  flex: 1,
                  color: o.certa ? cor.sementinha : cor.texto,
                }}
              >
                {o.texto}
              </Text>
              {o.certa ? (
                <View
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 13,
                    backgroundColor: cor.sementinha,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Check size={16} color={cor.branco} strokeWidth={3} />
                </View>
              ) : null}
            </View>
          ))}
        </View>
        {/* A bolha estudiosa espiando por cima do cartão. */}
        <View style={{ position: "absolute", right: -18, top: -58 }}>
          <ArteDaBolha humor="estudiosa" tamanho={112} />
        </View>
        <View style={{ position: "absolute", left: -10, bottom: -22 }}>
          <Etiqueta
            icone={<Sprout size={17} color={corCaminho.lojaIcone} />}
            texto="+3"
            tinta={corCaminho.lojaSaldo}
          />
        </View>
      </View>
    </View>
  );
}

/* ── 2. Respirar: a meditação de verdade, com a Bolha dormindo ─────────── */

const MEDITAR = corDaAtividade.meditar;
/* O círculo da meditação (o mesmo de `app/jornada/meditar.tsx`). */
const CIRCULO = {
  claro: "rgba(255,255,255,0.95)",
  escuro: comAlfa(misturar(MEDITAR.luz, MEDITAR.acao, 0.28), 0.85),
  aro: comAlfa(MEDITAR.acao, 0.22),
} as const;

/** Um som da noite numa etiqueta: a arte dele e o nome que o app usa. */
function EtiquetaDoSom({ som }: { som: "chuva" | "mar" }) {
  const arte = ARTE_DO_SOM[som];
  return (
    <Etiqueta
      icone={
        arte ? <Image source={arte} style={{ width: 22, height: 22 }} contentFit="contain" /> : null
      }
      texto={ROTULO_DO_SOM_NO_APP[som].label}
      tinta={MEDITAR.acao}
    />
  );
}

export function VitrineDaPausa({ largura }: { largura: number }) {
  const cartao = Math.min(300, largura - 80);
  const disco = Math.round(cartao * 0.56);
  return (
    <View style={{ width: largura, alignItems: "center", justifyContent: "center" }}>
      <View style={{ width: cartao }}>
        <View
          style={{
            alignItems: "center",
            gap: espaco.md,
            padding: espaco.lg,
            paddingBottom: espaco.xl,
            borderRadius: 30,
            ...curva,
            backgroundColor: CARTAO_NA_NOITE,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: "rgba(255,255,255,0.95)",
            ...sombraFlutuante,
          }}
        >
          {/* O alto da sessão: o tempo que anda e o que falta. */}
          <View
            style={{
              alignSelf: "stretch",
              flexDirection: "row",
              alignItems: "center",
              gap: espaco.sm,
            }}
          >
            <View
              style={{
                flex: 1,
                height: 6,
                borderRadius: 3,
                backgroundColor: cor.apagado,
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  width: "34%",
                  height: "100%",
                  borderRadius: 3,
                  backgroundColor: MEDITAR.acao,
                }}
              />
            </View>
            <Text style={{ ...fonte.forte, ...escala.nota, color: cor.textoApagado }}>3 min</Text>
          </View>
          <View
            style={{
              width: disco,
              height: disco,
              borderRadius: disco / 2,
              borderWidth: 2,
              borderColor: CIRCULO.aro,
              overflow: "hidden",
              alignItems: "center",
              justifyContent: "center",
              marginTop: espaco.sm,
            }}
          >
            <LinearGradient
              colors={[CIRCULO.claro, CIRCULO.escuro]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <ArteDaBolha humor="dormindo" tamanho={Math.round(disco * 0.52)} />
            <Text
              style={{
                marginTop: 2,
                ...fonte.forte,
                ...escala.nota,
                letterSpacing: 1.6,
                textTransform: "uppercase",
                color: MEDITAR.acao,
              }}
            >
              Inspire
            </Text>
          </View>
          <Text
            style={{
              ...fonte.display,
              ...escala.titulo3,
              letterSpacing: -0.2,
              color: cor.textoApagado,
            }}
          >
            Só respire.
          </Text>
        </View>
        <View style={{ position: "absolute", right: -18, top: "38%" }}>
          <Flutuar amplitude={4} periodo={4200}>
            <EtiquetaDoSom som="mar" />
          </Flutuar>
        </View>
        <View style={{ position: "absolute", left: -14, bottom: -22 }}>
          <Flutuar amplitude={4} periodo={3800}>
            <EtiquetaDoSom som="chuva" />
          </Flutuar>
        </View>
      </View>
    </View>
  );
}

/* ── 3. Mexer o corpo: o anel do tempo, com a Bolha de faixa na testa ──── */

const MEXER = corDaAtividade.mexer;

export function VitrineDoMexer({ largura }: { largura: number }) {
  const cartao = Math.min(300, largura - 80);
  const anel = Math.round(cartao * 0.58);
  const grossura = 10;
  const centro = anel / 2;
  const raio = centro - grossura / 2 - 2;
  const volta = 2 * Math.PI * raio;
  return (
    <View style={{ width: largura, alignItems: "center", justifyContent: "center" }}>
      <View style={{ width: cartao }}>
        <View
          style={{
            alignItems: "center",
            gap: espaco.xs,
            padding: espaco.lg,
            paddingTop: espaco.xl,
            paddingBottom: espaco.xl,
            borderRadius: 30,
            ...curva,
            backgroundColor: CARTAO_NA_NOITE,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: "rgba(255,255,255,0.95)",
            ...sombraFlutuante,
          }}
        >
          {/* O anel que conta o tempo do movimento (o de `app/jornada/mexer.tsx`). */}
          <View
            style={{
              width: anel,
              height: anel,
              alignItems: "center",
              justifyContent: "center",
              marginBottom: espaco.md,
            }}
          >
            <Svg width={anel} height={anel} style={{ position: "absolute" }}>
              <Circle
                cx={centro}
                cy={centro}
                r={raio}
                stroke={MEXER.luz}
                strokeWidth={grossura}
                fill="none"
              />
              <Circle
                cx={centro}
                cy={centro}
                r={raio}
                stroke={MEXER.acao}
                strokeWidth={grossura}
                strokeLinecap="round"
                strokeDasharray={`${volta * 0.72} ${volta}`}
                rotation={-90}
                origin={`${centro}, ${centro}`}
                fill="none"
              />
            </Svg>
            <ArteDaBolha humor="exercicio" tamanho={Math.round(anel * 0.64)} />
            <View
              style={{
                position: "absolute",
                top: -14,
                paddingHorizontal: 14,
                paddingVertical: 3,
                borderRadius: canto.pilula,
                ...curva,
                backgroundColor: MEXER.acao,
              }}
            >
              <Text style={{ ...fonteDoNumero, ...escala.chamada, color: cor.branco }}>29s</Text>
            </View>
          </View>
          <Text
            style={{
              ...fonte.forte,
              ...escala.nota,
              letterSpacing: 0.6,
              textTransform: "uppercase",
              color: MEXER.acao,
            }}
          >
            Movimento 1 de 5
          </Text>
          <Text
            style={{ ...fonte.display, ...escala.titulo2, letterSpacing: -0.2, color: cor.texto }}
          >
            Rolar os ombros
          </Text>
        </View>
        <View style={{ position: "absolute", right: -14, bottom: -22 }}>
          <Flutuar amplitude={4} periodo={4000}>
            <Etiqueta
              icone={<Timer size={17} color={MEXER.acao} strokeWidth={2.4} />}
              texto="5 min"
              tinta={MEXER.acao}
            />
          </Flutuar>
        </View>
      </View>
    </View>
  );
}

/* ── 4. A trilha, com uma amiga ─────────────────────────────────────── */

/* Os nós da trilha são as moedas de verdade dela, na cor de uma semana. */
const TOM_DA_VITRINE = coresDaSemana(28);

function Estrelas({ quantas }: { quantas: number }) {
  return (
    <View style={{ flexDirection: "row", gap: 2, marginTop: 4 }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <Star
          key={i}
          size={15}
          color={i < quantas ? corCaminho.ouroEscuro : cor.chevron}
          fill={i < quantas ? corCaminho.ouro : cor.trilho}
        />
      ))}
    </View>
  );
}

export function VitrineDaTrilha({ largura }: { largura: number }) {
  const no = 74;
  return (
    <View style={{ width: largura, alignItems: "center", justifyContent: "center", gap: 6 }}>
      <EtiquetaDaDupla />
      <View style={{ width: 250, height: 330 }}>
        <View style={{ position: "absolute", left: 20, top: 18, alignItems: "center" }}>
          <Moeda3D tamanho={no} tom={TOM_DA_VITRINE}>
            <Check size={34} color={cor.branco} strokeWidth={3.4} />
          </Moeda3D>
          <View style={{ height: 8 }} />
          <Estrelas quantas={5} />
        </View>
        <View style={{ position: "absolute", right: 14, top: 106, alignItems: "center" }}>
          <Moeda3D tamanho={no} tom={TOM_DA_VITRINE}>
            <Check size={34} color={cor.branco} strokeWidth={3.4} />
          </Moeda3D>
          <View style={{ height: 8 }} />
          <Estrelas quantas={4} />
        </View>
        {/* Hoje: maior, com o anel e o balão. */}
        <View style={{ position: "absolute", left: 52, top: 202, alignItems: "center" }}>
          <View
            style={{ position: "absolute", top: -42, left: -35, width: 180, alignItems: "center" }}
          >
            <View
              style={{
                alignSelf: "center",
                backgroundColor: cor.branco,
                borderRadius: 16,
                paddingHorizontal: 12,
                paddingVertical: 5,
                boxShadow: "0px 4px 12px -4px rgba(35,25,66,0.35)",
              }}
            >
              <Text
                numberOfLines={1}
                style={{
                  ...fonte.titulo,
                  ...escala.nota,
                  letterSpacing: 0.4,
                  color: corCaminho.balaoTexto,
                }}
              >
                AULA DE HOJE
              </Text>
            </View>
          </View>
          <View
            style={{
              padding: 6,
              borderRadius: 60,
              borderWidth: 5,
              borderColor: "rgba(255,255,255,0.75)",
            }}
          >
            <Moeda3D tamanho={no + 14} tom={TOM_DA_VITRINE}>
              <Gift size={36} color={cor.branco} strokeWidth={2.2} />
            </Moeda3D>
            <View style={{ height: 7 }} />
          </View>
        </View>
        <View style={{ position: "absolute", right: -18, bottom: -6 }}>
          <ArteDaBolha humor="apaixonado" tamanho={96} />
        </View>
      </View>
    </View>
  );
}

/* A dupla no alto da trilha: as duas, o coração e a chama. */

function Rosto({ letra, fundo, tinta }: { letra: string; fundo: string; tinta: string }) {
  return (
    <View
      style={{
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: fundo,
        borderWidth: 2,
        borderColor: cor.branco,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ ...fonte.titulo, ...escala.nota, color: tinta }}>{letra}</Text>
    </View>
  );
}

/** "Você + Ana · 6 dias juntas": os dois rostos e a chama da dupla. */
function EtiquetaDaDupla() {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: espaco.sm,
        paddingLeft: 6,
        paddingRight: 14,
        paddingVertical: 6,
        borderRadius: canto.pilula,
        ...curva,
        backgroundColor: "rgba(255,255,255,0.94)",
        boxShadow: "0px 10px 24px -10px rgba(10,6,40,0.55)",
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Rosto letra="V" fundo={luz.rose} tinta={cor.primariaEscura} />
        <View
          style={{
            width: 20,
            height: 20,
            borderRadius: 10,
            marginHorizontal: -6,
            zIndex: 2,
            backgroundColor: cor.primaria,
            borderWidth: 2,
            borderColor: cor.branco,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Heart size={10} color={cor.branco} fill={cor.branco} />
        </View>
        <Rosto letra="A" fundo={luz.lilas} tinta={cor.agenda} />
      </View>
      <Flame size={16} color={corCaminho.chamaAcesa} fill={ouro.medio} />
      <Text style={{ ...fonte.forte, ...escala.legenda, color: cor.atencaoTexto }}>
        6 dias juntas
      </Text>
    </View>
  );
}

/* ── 5. A conta: a Bolha comemorando ──────────────────────────────────── */

export function VitrineDoFim({
  largura,
  altura,
  ativa,
  voltou,
}: {
  largura: number;
  altura: number;
  ativa: boolean;
  voltou: boolean;
}) {
  return (
    <BolhaQueFala
      largura={largura}
      altura={altura}
      fala={voltou ? FALA_NA_ENTRADA.voltou : FALA_NA_ENTRADA.conta}
      humor="comemorando"
      ativa={ativa}
    />
  );
}
