import { LinearGradient } from "expo-linear-gradient";
import { Check, Flame, Gift, Heart, Sprout, Star, Trophy } from "lucide-react-native";
import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { corCaminho } from "~/componentes/caminho/cores";
import { ArteDaBolha, BolhaViva, Flutuar } from "~/componentes/movimento";
import { cor, curva, espaco, fonte, fonteDoNumero, sombra, sombraFlutuante } from "~/tema";

/**
 * AS VITRINES DOS SLIDES DE BOAS-VINDAS (17/11/2026): o produto antes de
 * pedir qualquer coisa, como no Marca Ponto. Cada vitrine é um pedaço do app
 * desenhado de verdade (a aula, a trilha, a dupla), e não uma ilustração
 * genérica.
 *
 * ⚠️ Nada aqui fala do bebê nem mostra o bebê: a entrada não sabe se quem
 * abre está no Modo Cuidado (luto). A bolha, o jogo e as amigas, sim.
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
        borderRadius: 999,
        ...curva,
        backgroundColor: "rgba(255,255,255,0.94)",
        boxShadow: "0px 10px 24px -10px rgba(10,6,40,0.55)",
      }}
    >
      {icone}
      <Text style={{ ...fonteDoNumero, fontSize: 16, color: tinta }}>{texto}</Text>
    </View>
  );
}

/* O cartão sobre o céu escuro: quase opaco (o `luz.cartao` vira cinza no escuro). */
const CARTAO_NA_NOITE = "rgba(255,255,255,0.97)";

/* ── 0. A bolha: quem vai junto ───────────────────────────────────────── */

export function VitrineDaBolha({ largura }: { largura: number }) {
  const bolha = Math.min(220, largura * 0.54);
  const caixa = { w: Math.min(largura - 32, bolha + 150), h: bolha + 40 };
  return (
    <View style={{ width: largura, alignItems: "center", justifyContent: "center" }}>
      <View
        style={{ width: caixa.w, height: caixa.h, alignItems: "center", justifyContent: "center" }}
      >
        <BolhaViva humor="feliz" tamanho={bolha} />
        <View style={{ position: "absolute", left: 0, top: 6 }}>
          <Flutuar amplitude={4} periodo={3600}>
            <Etiqueta
              icone={<Flame size={17} color={corCaminho.chamaAcesa} fill="#ffb84d" />}
              texto="15 dias"
              tinta="#b45309"
            />
          </Flutuar>
        </View>
        <View style={{ position: "absolute", right: 0, top: caixa.h * 0.44 }}>
          <Flutuar amplitude={5} periodo={4200}>
            <Etiqueta
              icone={<Sprout size={17} color={corCaminho.lojaIcone} />}
              texto="245"
              tinta={corCaminho.lojaSaldo}
            />
          </Flutuar>
        </View>
        <View style={{ position: "absolute", left: 18, bottom: 0 }}>
          <Flutuar amplitude={4} periodo={3900}>
            <Etiqueta
              icone={<Star size={17} color={corCaminho.ouroEscuro} fill={corCaminho.ouro} />}
              texto="5 estrelas"
              tinta={cor.textoDestaque}
            />
          </Flutuar>
        </View>
      </View>
    </View>
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
            <Text style={{ ...fonte.forte, fontSize: 13, color: cor.textoApagado }}>
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
              ...fonte.titulo,
              fontSize: 21,
              lineHeight: 26,
              letterSpacing: -0.3,
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
                borderRadius: 18,
                ...curva,
                borderWidth: o.certa ? 2 : 1,
                borderColor: o.certa ? cor.sementinha : cor.borda,
                backgroundColor: o.certa ? "#ecfdf3" : cor.branco,
              }}
            >
              <Text style={{ fontSize: 20 }}>{o.emoji}</Text>
              <Text
                style={{
                  ...fonte.forte,
                  flex: 1,
                  fontSize: 16,
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

/* ── 2. A trilha ──────────────────────────────────────────────────────── */

/** Um nó da trilha em relevo: o disco, o lábio de baixo e o brilho no alto. */
function No({
  tamanho,
  verde,
  children,
}: {
  tamanho: number;
  verde: boolean;
  children?: ReactNode;
}) {
  const [claro, meio, labio] = verde
    ? ["#4ee0a8", "#14b884", "#0b8f66"]
    : ["#f3f7fb", "#dfe8f1", "#b9c7d6"];
  return (
    <View style={{ width: tamanho, height: tamanho + 8 }}>
      <View
        style={{
          position: "absolute",
          top: 8,
          width: tamanho,
          height: tamanho,
          borderRadius: tamanho / 2,
          backgroundColor: labio,
        }}
      />
      <LinearGradient
        colors={[claro, meio]}
        style={{
          width: tamanho,
          height: tamanho,
          borderRadius: tamanho / 2,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <View
          style={{
            position: "absolute",
            top: tamanho * 0.1,
            width: tamanho * 0.44,
            height: tamanho * 0.16,
            borderRadius: tamanho,
            backgroundColor: "rgba(255,255,255,0.45)",
          }}
        />
        {children}
      </LinearGradient>
    </View>
  );
}

function Estrelas({ quantas }: { quantas: number }) {
  return (
    <View style={{ flexDirection: "row", gap: 2, marginTop: 4 }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <Star
          key={i}
          size={15}
          color={i < quantas ? corCaminho.ouroEscuro : "rgba(255,255,255,0.7)"}
          fill={i < quantas ? corCaminho.ouro : "rgba(255,255,255,0.35)"}
        />
      ))}
    </View>
  );
}

export function VitrineDaTrilha({ largura }: { largura: number }) {
  const no = 74;
  return (
    <View style={{ width: largura, alignItems: "center", justifyContent: "center", gap: 6 }}>
      <Etiqueta
        icone={<Flame size={17} color={corCaminho.chamaAcesa} fill="#ffb84d" />}
        texto="15 dias seguidos"
        tinta="#b45309"
      />
      <View style={{ width: 250, height: 330 }}>
        <View style={{ position: "absolute", left: 20, top: 18, alignItems: "center" }}>
          <No tamanho={no} verde>
            <Check size={34} color={cor.branco} strokeWidth={3.4} />
          </No>
          <Estrelas quantas={5} />
        </View>
        <View style={{ position: "absolute", right: 14, top: 106, alignItems: "center" }}>
          <No tamanho={no} verde>
            <Check size={34} color={cor.branco} strokeWidth={3.4} />
          </No>
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
                  fontSize: 13,
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
            <No tamanho={no + 14} verde>
              <Gift size={36} color={cor.branco} strokeWidth={2.2} />
            </No>
          </View>
        </View>
        <View style={{ position: "absolute", right: 6, bottom: 8 }}>
          <Etiqueta
            icone={<Trophy size={17} color={corCaminho.trofeus} />}
            texto="9"
            tinta={corCaminho.trofeus}
          />
        </View>
      </View>
    </View>
  );
}

/* ── 3. As amigas ─────────────────────────────────────────────────────── */

function Rosto({ letra, fundo, tinta }: { letra: string; fundo: string; tinta: string }) {
  return (
    <View
      style={{
        width: 84,
        height: 84,
        borderRadius: 42,
        backgroundColor: fundo,
        borderWidth: 4,
        borderColor: cor.branco,
        alignItems: "center",
        justifyContent: "center",
        ...sombra,
      }}
    >
      <Text style={{ ...fonte.titulo, fontSize: 34, color: tinta }}>{letra}</Text>
    </View>
  );
}

export function VitrineDasAmigas({ largura }: { largura: number }) {
  const cartao = Math.min(310, largura - 72);
  return (
    <View style={{ width: largura, alignItems: "center", justifyContent: "center" }}>
      <View style={{ width: cartao, alignItems: "center" }}>
        <View
          style={{
            width: "100%",
            alignItems: "center",
            gap: espaco.md,
            paddingTop: 58,
            paddingBottom: espaco.lg,
            paddingHorizontal: espaco.lg,
            marginTop: 50,
            borderRadius: 30,
            ...curva,
            backgroundColor: CARTAO_NA_NOITE,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: "rgba(255,255,255,0.95)",
            ...sombraFlutuante,
          }}
        >
          <Text style={{ ...fonte.titulo, fontSize: 21, color: cor.texto }}>Você + Ana</Text>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              backgroundColor: "#fff3e0",
              borderRadius: 999,
              paddingHorizontal: 14,
              paddingVertical: 7,
            }}
          >
            <Flame size={16} color={corCaminho.chamaAcesa} fill="#ffb84d" />
            <Text style={{ ...fonte.forte, fontSize: 15, color: "#9a4a00" }}>6 dias juntas</Text>
          </View>
          <Text
            style={{
              ...fonte.normal,
              fontSize: 15,
              lineHeight: 21,
              color: cor.textoApagado,
              textAlign: "center",
            }}
          >
            +10 🌱 para cada uma, a cada dia juntas
          </Text>
        </View>
        {/* Os dois rostos por cima do cartão, com o coração no meio. */}
        <View
          style={{
            position: "absolute",
            top: 0,
            flexDirection: "row",
            alignItems: "center",
          }}
        >
          <Rosto letra="V" fundo="#ffd3e2" tinta={cor.primariaEscura} />
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              marginHorizontal: -10,
              zIndex: 2,
              backgroundColor: cor.primaria,
              borderWidth: 3,
              borderColor: cor.branco,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Heart size={16} color={cor.branco} fill={cor.branco} />
          </View>
          <Rosto letra="A" fundo="#dcd2fb" tinta="#4c2a9e" />
        </View>
        <View style={{ position: "absolute", right: -30, top: -6 }}>
          <ArteDaBolha humor="apaixonado" tamanho={86} />
        </View>
      </View>
    </View>
  );
}

/* ── 4. O fim: a bolha comemorando ────────────────────────────────────── */

export function VitrineDoFim({ largura, ativa }: { largura: number; ativa: boolean }) {
  const bolha = Math.min(210, largura * 0.52);
  return (
    <View style={{ width: largura, alignItems: "center", justifyContent: "center" }}>
      {/* A chave remonta a bolha quando o slide chega: ela comemora À VISTA. */}
      <BolhaViva key={ativa ? "chegou" : "longe"} humor="comemorando" tamanho={bolha} />
    </View>
  );
}
