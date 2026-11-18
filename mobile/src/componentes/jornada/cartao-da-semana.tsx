import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import Flame from "lucide-react-native/icons/flame";
import Hourglass from "lucide-react-native/icons/hourglass";
import Star from "lucide-react-native/icons/star";
import { memo, useState, type ReactNode } from "react";
import { Text, View } from "react-native";
import { bebeDaSemana } from "~/lib/bebe-da-semana";
import { comAlfa } from "~/lib/cor";
import { Brilho } from "~/componentes/jornada/atividade";
import { LinhaDoAtalho } from "~/componentes/jornada/atalhos";
import { FolhaDeCompartilhar } from "~/componentes/jornada/compartilhar";
import { legendaDaSemana } from "~/lib/jornada/cartoes";
import { arteDoBebe } from "~/componentes/jornada/arte-do-bebe";
import { cor, escala, fonte, sombra, veu } from "~/tema";

/**
 * O CARTÃO DA SEMANA — o que ela posta nos Stories ("24 semanas!", que toda
 * grávida já posta), pronto e bonito, feito da jornada dela: o bebê da semana,
 * o tamanho, os dias de cinco estrelas e a chama. É a gamificação virando
 * orgulho, e cada cartão postado mostra o app às amigas grávidas dela.
 *
 * Ela VÊ o cartão antes (a prévia abre numa folha) e decide compartilhar. A
 * imagem sai da própria vista (`react-native-view-shot`) em 9:16, e vai pela
 * folha de compartilhar do iPhone (Instagram, WhatsApp, Fotos…). Nada do que é
 * íntimo entra: nem gratidão, nem humor, nem sintoma.
 *
 * 18/11/2026: a assinatura leva o @ do app no Instagram (quem vê o Stories
 * acha o app), sem emoji; as cores soltas passaram ao tema; e a linha da tela
 * do bebê mostra o PRÓPRIO cartão, em miniatura, no lugar de um retângulo.
 */

const CEU = require("../../../../src/assets/ceu/por-do-sol.webp");

export type DadosDoCartao = {
  semana: number;
  nomeDoBebe: string | null;
  diasCheios: number;
  chama: number;
  faltam: number | null;
};

const LARGURA = 300;
const ALTURA = Math.round((LARGURA * 16) / 9);

/** A miniatura da linha: o cartão inteiro, a 15%. */
const MINIATURA = 0.15;

export function CartaoDaSemana({ d }: { d: DadosDoCartao }) {
  const bebe = bebeDaSemana(d.semana);
  return (
    <View style={{ width: LARGURA, height: ALTURA, borderRadius: 28, overflow: "hidden" }}>
      <Image
        source={CEU}
        style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}
        contentFit="cover"
      />
      <LinearGradient
        colors={[veu.tinta(0), veu.tinta(0.55)]}
        style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: ALTURA * 0.55 }}
      />
      <View style={{ flex: 1, alignItems: "center", paddingTop: 34, paddingHorizontal: 22 }}>
        <Text
          style={{
            ...fonte.forte,
            ...escala.nota,
            letterSpacing: 1.6,
            textTransform: "uppercase",
            color: comAlfa(cor.branco, 0.88),
          }}
        >
          {d.nomeDoBebe ? `${d.nomeDoBebe} está chegando` : "Esperando você"}
        </Text>
        <Text
          style={{
            marginTop: 4,
            ...fonte.display,
            fontSize: 46,
            lineHeight: 52,
            letterSpacing: -0.4,
            color: cor.branco,
          }}
        >
          Semana {d.semana}
        </Text>
        <View style={{ marginTop: 8, alignItems: "center", justifyContent: "center" }}>
          <Brilho tamanho={230} />
          <Image
            source={arteDoBebe(d.semana)}
            style={{ width: 176, height: 176 }}
            contentFit="contain"
          />
        </View>
        <Text
          style={{
            marginTop: 6,
            textAlign: "center",
            ...fonte.forte,
            ...escala.manchete,
            color: cor.branco,
          }}
        >
          Tamanho de {bebe.fruit.toLowerCase()} · {bebe.size}
        </Text>
        <View style={{ marginTop: 18, width: "100%", gap: 8 }}>
          {d.diasCheios > 0 ? (
            <Linha
              icone={<Star size={17} color={cor.branco} fill={cor.branco} strokeWidth={2} />}
              texto={`${d.diasCheios} ${d.diasCheios === 1 ? "dia" : "dias"} de cuidado completo nesta semana`}
            />
          ) : null}
          {d.chama > 1 ? (
            <Linha
              icone={<Flame size={17} color={cor.branco} fill={cor.branco} strokeWidth={2} />}
              texto={`${d.chama} dias seguidos cuidando de nós`}
            />
          ) : null}
          {d.faltam != null ? (
            <Linha
              icone={<Hourglass size={17} color={cor.branco} strokeWidth={2.2} />}
              texto={`faltam ${d.faltam} ${d.faltam === 1 ? "dia" : "dias"}`}
            />
          ) : null}
        </View>
        <View style={{ flex: 1 }} />
        <View style={{ marginBottom: 22, alignItems: "center", gap: 1 }}>
          <Text style={{ ...fonte.forte, ...escala.nota, color: comAlfa(cor.branco, 0.9) }}>
            app Mãe Esperta
          </Text>
          <Text style={{ ...fonte.media, ...escala.nota, color: comAlfa(cor.branco, 0.78) }}>
            @maeesperta.app
          </Text>
        </View>
      </View>
    </View>
  );
}

function Linha({ icone, texto }: { icone: ReactNode; texto: string }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        borderRadius: 16,
        backgroundColor: comAlfa(cor.branco, 0.18),
        paddingHorizontal: 14,
        paddingVertical: 9,
      }}
    >
      {icone}
      <Text
        style={{
          flex: 1,
          ...fonte.forte,
          fontSize: 14,
          lineHeight: 19,
          color: cor.branco,
        }}
      >
        {texto}
      </Text>
    </View>
  );
}

/**
 * O cartão de verdade, pequeno: 45×80, recortado no canto do cartão. É a
 * prévia do que ela vai postar — e não um retângulo com o número.
 */
const Miniatura = memo(function Miniatura({ d }: { d: DadosDoCartao }) {
  const w = Math.round(LARGURA * MINIATURA);
  const h = Math.round(ALTURA * MINIATURA);
  return (
    <View style={[{ width: w, height: h, borderRadius: 7 }, sombra]}>
      <View
        pointerEvents="none"
        style={{ width: w, height: h, borderRadius: 7, overflow: "hidden" }}
      >
        <View
          style={{
            position: "absolute",
            left: (w - LARGURA) / 2,
            top: (h - ALTURA) / 2,
            transform: [{ scale: MINIATURA }],
          }}
        >
          <CartaoDaSemana d={d} />
        </View>
      </View>
    </View>
  );
});

/** A linha do grupo de atalhos que abre a prévia, e a prévia com o compartilhar. */
export function CompartilharASemana({ d }: { d: DadosDoCartao }) {
  const [aberta, setAberta] = useState(false);

  return (
    <>
      <LinhaDoAtalho
        ficha={<Miniatura d={d} />}
        titulo={`O cartão da semana ${d.semana}`}
        sub="Pronto para os Stories"
        rotulo={`Ver o cartão da semana ${d.semana} para compartilhar`}
        aoTocar={() => setAberta(true)}
      />

      <FolhaDeCompartilhar
        aberta={aberta}
        aoFechar={() => setAberta(false)}
        largura={LARGURA}
        corDoBotao={cor.primaria}
        legenda={legendaDaSemana(d.semana)}
      >
        <CartaoDaSemana d={d} />
      </FolhaDeCompartilhar>
    </>
  );
}
