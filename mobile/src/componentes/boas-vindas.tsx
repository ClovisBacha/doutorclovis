import { LinearGradient } from "expo-linear-gradient";
import { Check, Flame, Gift, Heart, Sprout, Star, Trophy } from "lucide-react-native";
import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { corCaminho } from "~/componentes/caminho/cores";
import { Moeda3D } from "~/componentes/caminho/pecas";
import { ArteDaBolha, BolhaViva, Flutuar } from "~/componentes/movimento";
import { coresDaSemana } from "~/lib/jornada/caminho";
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
  sombra,
  sombraFlutuante,
} from "~/tema";

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
              icone={<Flame size={17} color={corCaminho.chamaAcesa} fill={ouro.medio} />}
              texto="15 dias"
              tinta={cor.atencao}
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

/* ── 2. A trilha ──────────────────────────────────────────────────────── */

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
      <Etiqueta
        icone={<Flame size={17} color={corCaminho.chamaAcesa} fill={ouro.medio} />}
        texto="15 dias seguidos"
        tinta={cor.atencao}
      />
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
      <Text style={{ ...fonte.titulo, fontSize: escala.grande.fontSize, color: tinta }}>
        {letra}
      </Text>
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
          <Text
            style={{ ...fonte.display, ...escala.titulo2, letterSpacing: -0.2, color: cor.texto }}
          >
            Você + Ana
          </Text>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              backgroundColor: cor.quaseFundo,
              borderRadius: canto.pilula,
              paddingHorizontal: 14,
              paddingVertical: 7,
            }}
          >
            <Flame size={16} color={corCaminho.chamaAcesa} fill={ouro.medio} />
            <Text style={{ ...fonte.forte, ...escala.legenda, color: cor.atencaoTexto }}>
              6 dias juntas
            </Text>
          </View>
          <Text
            style={{
              ...fonte.normal,
              ...escala.legenda,
              color: cor.textoApagado,
              textAlign: "center",
            }}
          >
            Cada uma ganha 10 sementinhas por dia juntas
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
          <Rosto letra="V" fundo={luz.rose} tinta={cor.primariaEscura} />
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
          <Rosto letra="A" fundo={luz.lilas} tinta={cor.agenda} />
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
