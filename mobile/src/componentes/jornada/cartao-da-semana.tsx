import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import Flame from "lucide-react-native/icons/flame";
import Hourglass from "lucide-react-native/icons/hourglass";
import IconeDeCompartilhar from "lucide-react-native/icons/share";
import Star from "lucide-react-native/icons/star";
import { memo, useState, type ReactNode } from "react";
import { Text, View } from "react-native";
import { BOLHA } from "~/componentes/artes";
import { Botao } from "~/componentes/base";
import { CEUS } from "~/componentes/ceu-vivo";
import { LinhaDoAtalho } from "~/componentes/jornada/atalhos";
import { FolhaDeCompartilhar } from "~/componentes/jornada/compartilhar";
import { parametroDaBancada } from "~/lib/bancada";
import { bebeDaSemana } from "~/lib/bebe-da-semana";
import { comAlfa } from "~/lib/cor";
import { legendaDaSemana } from "~/lib/jornada/cartoes";
import { canto, cor, curva, escala, fonte, fonteDoNumero, sombra, veu } from "~/tema";

/**
 * O CARTÃO DA SEMANA — o que ela posta nos Stories ("24 semanas!", que toda
 * grávida já posta), pronto e bonito, feito da jornada dela. É a cara do app
 * no Instagram: cada cartão postado mostra o app às amigas grávidas dela.
 *
 * Ela VÊ o cartão antes (a prévia abre numa folha) e decide compartilhar. A
 * imagem sai da própria vista (`react-native-view-shot`) em 9:16, e vai pela
 * folha de compartilhar do iPhone (Instagram, WhatsApp, Fotos…). Nada do que é
 * íntimo entra: nem gratidão, nem humor, nem sintoma.
 *
 * 19/11/2026, decisão do dono ("nosso principal personagem agora será o bebê
 * bolha. Eu quero tirar as imagens dos bebês [...] o número 24 ali estava
 * muito bacana"): o bebê ilustrado saiu. O cartão é a cena do céu do app, a
 * da tela de bloqueio do iPhone: o NÚMERO da semana, gigante, atrás, e a
 * BOLHA na frente dele (a arte parada: a imagem sai de uma vista sem
 * animação no meio). Embaixo, "semanas" na serifada, o tamanho, os dias de
 * cuidado e a chama, e a assinatura do app com o @ dele. Nada atrás da Bolha.
 */

/** O céu do cartão: o pôr do sol, sempre (é a marca, e não a hora). */
const CEU = CEUS.tarde;

export type DadosDoCartao = {
  semana: number;
  nomeDoBebe: string | null;
  diasCheios: number;
  chama: number;
  faltam: number | null;
};

const LARGURA = 300;
const ALTURA = Math.round((LARGURA * 16) / 9);

/** O lado da Bolha no cartão, e onde ela pousa (sobre a parte de baixo do número). */
const LADO_DA_BOLHA = 172;
const ALTO_DO_NUMERO = 34;
const ALTO_DA_BOLHA = 118;
/** O alto do texto, e quanto "semanas" sobe para dentro da sobra transparente da arte. */
const ALTO_DO_TEXTO = 24;
const LINHA_DE_CIMA = 18;
const ENCAIXE = 24;

/** A miniatura da linha: o cartão inteiro, a 15%. */
const MINIATURA = 0.15;

export function CartaoDaSemana({ d }: { d: DadosDoCartao }) {
  const bebe = bebeDaSemana(d.semana);
  const nome = d.nomeDoBebe?.trim() || null;
  const tamanhoDoNumero = d.semana >= 10 ? 200 : 220;
  return (
    <View
      style={{
        width: LARGURA,
        height: ALTURA,
        borderRadius: canto.cartao,
        ...curva,
        overflow: "hidden",
        backgroundColor: CEU.chao,
      }}
    >
      <Image
        source={CEU.arte}
        style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}
        contentFit="cover"
      />
      <LinearGradient
        colors={[veu.tinta(0), veu.tinta(0.5)]}
        style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: ALTURA * 0.5 }}
      />

      {/* O número da semana, gigante, atrás da Bolha. */}
      <Text
        allowFontScaling={false}
        style={{
          position: "absolute",
          top: ALTO_DO_NUMERO,
          left: 0,
          right: 0,
          textAlign: "center",
          ...fonteDoNumero,
          fontSize: tamanhoDoNumero,
          lineHeight: Math.round(tamanhoDoNumero * 1.04),
          letterSpacing: -tamanhoDoNumero * 0.05,
          fontVariant: ["tabular-nums"],
          color: comAlfa(cor.branco, 0.52),
          textShadowColor: comAlfa(cor.texto, 0.18),
          textShadowOffset: { width: 0, height: 8 },
          textShadowRadius: 22,
        }}
      >
        {d.semana}
      </Text>

      {/* A Bolha, na frente do número. */}
      <Image
        source={BOLHA.feliz}
        style={{
          position: "absolute",
          top: ALTO_DA_BOLHA,
          left: (LARGURA - LADO_DA_BOLHA) / 2,
          width: LADO_DA_BOLHA,
          height: LADO_DA_BOLHA,
        }}
        contentFit="contain"
      />

      <View
        style={{ flex: 1, alignItems: "center", paddingTop: ALTO_DO_TEXTO, paddingHorizontal: 22 }}
      >
        <Text
          numberOfLines={1}
          style={{
            ...fonte.forte,
            ...escala.nota,
            letterSpacing: 1.6,
            textTransform: "uppercase",
            color: comAlfa(cor.branco, 0.9),
          }}
        >
          {nome ? `${nome} está a caminho` : "Um bebê a caminho"}
        </Text>
        <Text
          style={{
            marginTop: ALTO_DA_BOLHA + LADO_DA_BOLHA - ALTO_DO_TEXTO - LINHA_DE_CIMA - ENCAIXE,
            ...fonte.display,
            ...escala.grande,
            letterSpacing: -0.2,
            color: cor.branco,
            textShadowColor: comAlfa(cor.texto, 0.28),
            textShadowOffset: { width: 0, height: 1 },
            textShadowRadius: 8,
          }}
        >
          {d.semana === 1 ? "semana" : "semanas"}
        </Text>
        <Text
          style={{
            marginTop: 2,
            textAlign: "center",
            ...fonte.forte,
            ...escala.legenda,
            color: comAlfa(cor.branco, 0.94),
          }}
        >
          Tamanho de {bebe.fruit.toLowerCase()} · {bebe.size.replace(" ", "\u00a0")}
        </Text>
        <View style={{ marginTop: 12, width: "100%", gap: 6 }}>
          {d.diasCheios > 0 ? (
            <Linha
              icone={<Star size={15} color={cor.branco} fill={cor.branco} strokeWidth={2} />}
              texto={`${d.diasCheios} ${d.diasCheios === 1 ? "dia" : "dias"} com todos os cuidados`}
            />
          ) : null}
          {d.chama > 1 ? (
            <Linha
              icone={<Flame size={15} color={cor.branco} fill={cor.branco} strokeWidth={2} />}
              texto={`${d.chama} dias seguidos de cuidado`}
            />
          ) : null}
          {d.faltam != null && d.faltam > 0 ? (
            <Linha
              icone={<Hourglass size={15} color={cor.branco} strokeWidth={2.2} />}
              texto={`faltam ${d.faltam} ${d.faltam === 1 ? "dia" : "dias"}`}
            />
          ) : null}
        </View>
        <View style={{ flex: 1 }} />
        {/* A assinatura: o nome do app e onde achá-lo (a mesma do cartão da conquista). */}
        <View style={{ marginBottom: 18, alignItems: "center", gap: 1 }}>
          <Text
            style={{
              ...fonte.display,
              ...escala.manchete,
              letterSpacing: -0.2,
              color: cor.branco,
            }}
          >
            Mãe Esperta
          </Text>
          <Text style={{ ...fonte.forte, ...escala.nota, color: veu.textoNoVeu }}>
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
        gap: 9,
        borderRadius: canto.campo,
        ...curva,
        backgroundColor: comAlfa(cor.branco, 0.18),
        paddingHorizontal: 13,
        paddingVertical: 6,
      }}
    >
      {icone}
      <Text
        numberOfLines={1}
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

/**
 * A linha do grupo de atalhos que abre a prévia, e a prévia com o compartilhar.
 * Na bancada, `&cartao=1` abre a prévia direto (para fotografar o cartão).
 */
export function CompartilharASemana({ d }: { d: DadosDoCartao }) {
  const [aberta, setAberta] = useState(() => parametroDaBancada("cartao") === "1");

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

/**
 * O "Compartilhar" da festa da semana nova (`marco.tsx`): o MESMO cartão dos
 * Stories (a Bolha e o número), e não um segundo desenho da semana. A festa
 * não sabe os dias de cuidado nem a chama: o cartão sai sem essas linhas.
 * Vai DENTRO da janela da festa: no iPhone, a folha precisa nascer dela.
 */
export function CompartilharNaFesta({
  semana,
  nomeDoBebe,
}: {
  semana: number;
  nomeDoBebe: string | null;
}) {
  const [aberta, setAberta] = useState(false);
  const d: DadosDoCartao = { semana, nomeDoBebe, diasCheios: 0, chama: 0, faltam: null };
  return (
    <>
      <Botao
        rotulo="Compartilhar"
        tipo="suave"
        tamanho="medio"
        icone={<IconeDeCompartilhar size={18} color={cor.textoDestaque} strokeWidth={2.4} />}
        aoTocar={() => setAberta(true)}
      />
      <FolhaDeCompartilhar
        aberta={aberta}
        aoFechar={() => setAberta(false)}
        largura={LARGURA}
        corDoBotao={cor.primaria}
        legenda={legendaDaSemana(semana)}
      >
        <CartaoDaSemana d={d} />
      </FolhaDeCompartilhar>
    </>
  );
}
