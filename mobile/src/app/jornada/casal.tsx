import { Image } from "expo-image";
import { useKeepAwake } from "expo-keep-awake";
import { StatusBar } from "expo-status-bar";
import Hand from "lucide-react-native/icons/hand";
import MessageCircle from "lucide-react-native/icons/message-circle";
import Pause from "lucide-react-native/icons/pause";
import Play from "lucide-react-native/icons/play";
import Wind from "lucide-react-native/icons/wind";
import { memo, useEffect, useRef, useState, type ReactNode } from "react";
import { Animated, Easing, Platform, Pressable, ScrollView, Text, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { ROTULO_DO_ALVO, SESSAO_DO_CASAL, type BlocoDoCasal } from "@/lib/sessao-do-casal";
import { VOZ_REGRAVADA } from "~/lib/audio/regravadas";
import { toque } from "~/componentes/base";
import {
  BolhaComBalao,
  BotaoRedondo,
  Brilho,
  CarregandoAtividade,
  fecharAtividade,
  Ficha,
  FundoDaNoite,
  TituloDaAtividade,
  TopoDaAtividade,
  TrocaDeEtapa,
} from "~/componentes/jornada/atividade";
import { corNoite } from "~/componentes/jornada/cores";
import { FiguraParada } from "~/componentes/jornada/figura-movimento";
import { useDiaDaJornada } from "~/componentes/jornada/usarJornada";
import { useMovimentoReduzido } from "~/componentes/movimento";
import { pararCanal, tocarVoz } from "~/lib/audio/voz";
import { VOZ_DA_NOITE } from "~/lib/audio/vozes";
import { blocosDoCasalNoApp, casalAberto, SEMANA_DO_CASAL } from "~/lib/jornada/casal";
import { escurecer } from "~/lib/cor";
import { desenhoDoCasal } from "~/lib/jornada/figura-casal";
import { coresDaFigura } from "~/lib/jornada/figura-cores";
import { FALA_DO_CASAL } from "~/lib/jornada/bolha-nos-cuidados";
import { ehBancada, parametroDaBancada } from "~/lib/bancada";
import { canto, curva, escala, espaco, fonte, margem } from "~/tema";
import { PortaoDoPlano } from "~/componentes/assinatura/portao";

/**
 * PARA VOCÊS DOIS — a sessão de dez minutos do app antigo (`SessaoDoCasal`):
 * ela e quem vai estar com ela no parto treinam as três coisas que mais
 * funcionam no trabalho de parto (a respiração de um seguindo a do outro, a
 * pressão da mão na base das costas, uma palavra combinada).
 *
 * O roteiro é o do site (`@/lib/sessao-do-casal`), com as 16 falas gravadas:
 * cada bloco toca a sua fala e espera o silêncio do roteiro (o mais longo, um
 * minuto, é uma contração inteira ensaiada). A tela fica acesa — os dois estão
 * olhando para ela, é o oposto da história para dormir.
 *
 * Mora no CÉU DA NOITE do app (18/11/2026), parado, com o véu por cima — era
 * um degradê chapado que parecia o modo escuro de outro produto. As duas
 * respirações que se seguem andam no motor nativo (eram 30 redesenhos por
 * segundo no JS).
 *
 * Fora do Modo Cuidado e do pós-parto, e só da 28ª semana em diante
 * (`casalAberto`, decisão do dono de 26/10/2026): é preparação para o parto, e
 * a voz gravada diz que o bebê "já reconhece a sua voz há semanas".
 *
 * A BOLHA GUIA (19/11/2026), num balão da noite: ela chama quem acompanha,
 * avisa a pausa e fecha a sessão. A voz gravada continua sendo a que conduz
 * os blocos (e o texto dela não muda); a Bolha só fala no que é tela.
 *
 * Bancada: /jornada/casal?bancada=1&semana=30 [&bloco=<n>] [&fim=1] [&pausado=1]
 * (sem `&semana`, a semana da bancada é antes da 28ª: a tela diz quando abre)
 */
/** Os blocos com as falas regravadas no lugar das do site (`docs/regravacao`). */
const BLOCOS_DO_CASAL = blocosDoCasalNoApp();

/** O coração na almofada, nas artes 3D do app: no lugar do 🤲 de 48 pt. */
const ARTE_DO_CASAL = require("../../../../src/assets/grades/apoio.webp");

/** Os três gestos que eles treinam. */
const GESTOS: readonly { icone: typeof Wind; texto: string }[] = [
  { icone: Wind, texto: "A respiração de um seguindo a do outro" },
  { icone: Hand, texto: "A pressão da mão na base das costas" },
  { icone: MessageCircle, texto: "Uma palavra combinada, que vale no dia" },
];

/** O portão do plano completo (com a chave da assinatura desligada, abre direto). */
export default function TelaDoCasal() {
  return (
    <PortaoDoPlano recurso="casal">
      <Casal />
    </PortaoDoPlano>
  );
}

function Casal() {
  const dia = useDiaDaJornada();
  const blocos = BLOCOS_DO_CASAL;
  const total = blocos.length;
  const [comecou, setComecou] = useState(false);
  const [i, setI] = useState(0);
  const [pausado, setPausado] = useState(false);
  const [aplicouBancada, setAplicouBancada] = useState(false);

  useEffect(() => {
    if (aplicouBancada || !ehBancada()) return;
    setAplicouBancada(true);
    const b = parametroDaBancada("bloco");
    if (b != null) {
      setComecou(true);
      setI(Math.min(total - 1, Math.max(0, Number(b) || 0)));
      setPausado(parametroDaBancada("pausado") === "1");
    }
    if (parametroDaBancada("fim") === "1") {
      setComecou(true);
      setI(total);
    }
  }, [aplicouBancada, total]);

  /* Cada bloco: a fala gravada e, quando ela acaba, o silêncio do roteiro. Sem
     gravação, um respiro curto — e o texto na tela continua valendo. Pausar
     cala; continuar lê o bloco de novo, do começo. */
  useEffect(() => {
    if (!comecou || pausado || i >= total) return;
    if (ehBancada()) return;
    const b = blocos[i]!;
    let espera: ReturnType<typeof setTimeout> | null = null;
    const seguir = () => {
      espera = setTimeout(() => setI((x) => x + 1), b.pausa * 1000);
    };
    const fonte = VOZ_REGRAVADA[b.id] ?? VOZ_DA_NOITE[b.id];
    if (!fonte || Platform.OS === "web") espera = setTimeout(seguir, 1500);
    else tocarVoz(fonte, { canal: "guia", aoAcabar: seguir });
    return () => {
      if (espera) clearTimeout(espera);
      pararCanal("guia");
    };
  }, [comecou, pausado, i, total, blocos]);

  useEffect(() => () => pararCanal("guia"), []);

  if (dia.modo === "carregando") return <CarregandoAtividade noite />;

  const sair = () => {
    pararCanal("guia");
    fecharAtividade();
  };

  /* Sem conseguir ler o perfil, a sessão abre: ela não depende de dado nenhum. */
  const aberta =
    dia.modo === "falhou" ||
    (dia.modo === "gestacao" &&
      casalAberto({ cuidado: dia.cuidado, posParto: false, semana: dia.semana }));
  if (!aberta) {
    const aindaVem = (dia.modo === "gestacao" || dia.modo === "sem-data") && !dia.cuidado;
    return (
      <FundoDaNoite>
        <StatusBar style="light" animated />
        <TopoDaAtividade escuro aoFechar={sair} />
        <View style={{ paddingHorizontal: margem.foco, paddingTop: espaco.xs }}>
          <BolhaComBalao
            lado
            escuro
            humor="feliz"
            fala={aindaVem ? FALA_DO_CASAL.aindaNao(SEMANA_DO_CASAL) : FALA_DO_CASAL.foraDaTrilha}
          />
          <BotaoClaro rotulo="Voltar" aoTocar={sair} />
        </View>
      </FundoDaNoite>
    );
  }

  const acabou = i >= total;
  const bloco = blocos[Math.min(i, total - 1)]!;
  const naSessao = comecou && !acabou;

  let miolo: ReactNode;
  if (!comecou) {
    miolo = (
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: margem.foco,
          paddingTop: espaco.xs,
          paddingBottom: espaco.xl,
        }}
      >
        <BolhaComBalao lado escuro humor="apaixonado" fala={FALA_DO_CASAL.abertura} />
        <TituloDaAtividade escuro>{SESSAO_DO_CASAL.titulo}</TituloDaAtividade>
        <Text
          style={{
            marginTop: espaco.sm,
            ...fonte.normal,
            ...escala.corpo,
            color: corNoite.textoCorpo,
          }}
        >
          Vocês treinam juntos três gestos de parceria, sem pressa, e podem repetir quando quiserem.
        </Text>
        <View style={{ marginTop: espaco.xl, gap: espaco.md }}>
          {GESTOS.map(({ icone: Icone, texto }) => (
            <View
              key={texto}
              style={{ flexDirection: "row", alignItems: "center", gap: espaco.md }}
            >
              <Ficha fundo="rgba(185,168,255,0.2)" tamanho={32}>
                <Icone size={16} color={corNoite.lilas} strokeWidth={2.2} />
              </Ficha>
              <Text
                style={{ flex: 1, ...fonte.media, ...escala.legenda, color: corNoite.textoForte }}
              >
                {texto}
              </Text>
            </View>
          ))}
        </View>
        <Text
          style={{
            marginTop: espaco.xl,
            ...fonte.normal,
            ...escala.nota,
            color: corNoite.textoApagado,
          }}
        >
          Dá para fazer sentada no chão, na cama ou numa cadeira.
        </Text>
        <BotaoClaro rotulo="Estamos os dois aqui" aoTocar={() => setComecou(true)} />
      </ScrollView>
    );
  } else if (acabou) {
    miolo = (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: margem.foco,
        }}
      >
        <ArteDoCasal />
        <TituloDaAtividade centro escuro>
          Vocês treinaram juntos
        </TituloDaAtividade>
        <View style={{ marginTop: espaco.xl, width: "100%", maxWidth: 360 }}>
          <BolhaComBalao lado escuro humor="apaixonado" tamanho={64} fala={FALA_DO_CASAL.fim} />
        </View>
        <View style={{ width: "100%", maxWidth: 340 }}>
          <BotaoClaro rotulo="Fechar" aoTocar={sair} />
        </View>
      </View>
    );
  } else {
    miolo = (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: margem.foco,
        }}
      >
        <View
          style={{
            borderRadius: canto.pilula,
            ...curva,
            borderWidth: 1,
            borderColor: corNoite[bloco.alvo].borda,
            backgroundColor: corNoite[bloco.alvo].fundo,
            paddingHorizontal: espaco.lg,
            paddingVertical: 6,
          }}
        >
          <Text
            style={{
              ...fonte.forte,
              ...escala.nota,
              letterSpacing: 0.6,
              textTransform: "uppercase",
              color: corNoite[bloco.alvo].texto,
            }}
          >
            {ROTULO_DO_ALVO[bloco.alvo]}
          </Text>
        </View>
        <View
          style={{ marginTop: 28, height: 112, alignItems: "center", justifyContent: "center" }}
        >
          <Figura tipo={bloco.figura} parado={pausado} />
        </View>
        <Text
          key={bloco.id}
          style={{
            marginTop: 28,
            maxWidth: 384,
            textAlign: "center",
            ...fonte.display,
            ...escala.titulo3,
            lineHeight: 29,
            fontWeight: "400",
            letterSpacing: -0.2,
            color: corNoite.textoForte,
          }}
        >
          {bloco.texto}
        </Text>
        {pausado ? (
          <View style={{ marginTop: espaco.xl, alignSelf: "stretch" }}>
            <BolhaComBalao lado escuro humor="feliz" tamanho={52} fala={FALA_DO_CASAL.pausa} />
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <FundoDaNoite>
      <StatusBar style="light" animated />
      {naSessao && Platform.OS !== "web" ? <MantemAcesa /> : null}
      <TopoDaAtividade
        escuro
        aoFechar={sair}
        meio={
          naSessao ? (
            /* A barra na largura toda (dividia a linha com um vão vazio). */
            <View
              accessible
              accessibilityLabel={`Parte ${i + 1} de ${total}`}
              style={{
                height: 4,
                borderRadius: 2,
                backgroundColor: corNoite.trilho,
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  width: `${((i + 1) / total) * 100}%`,
                  height: "100%",
                  borderRadius: 2,
                  backgroundColor: corNoite.textoForte,
                }}
              />
            </View>
          ) : null
        }
        direita={
          naSessao ? (
            <BotaoRedondo
              escuro
              rotulo={pausado ? "Continuar" : "Pausar"}
              aoTocar={() => setPausado((p) => !p)}
            >
              {pausado ? (
                <Play size={18} color={corNoite.texto} fill={corNoite.texto} />
              ) : (
                <Pause size={18} color={corNoite.texto} fill={corNoite.texto} />
              )}
            </BotaoRedondo>
          ) : undefined
        }
      />
      <TrocaDeEtapa chave={!comecou ? "abertura" : acabou ? "fim" : "sessao"}>{miolo}</TrocaDeEtapa>
    </FundoDaNoite>
  );
}

function MantemAcesa() {
  useKeepAwake("dc-casal");
  return null;
}

/** O coração na almofada, com a luz lilás da noite atrás. */
function ArteDoCasal() {
  return (
    <View style={{ width: 112, height: 112, alignItems: "center", justifyContent: "center" }}>
      <Brilho tamanho={190} tinta={corNoite.lilas} />
      <Image
        source={ARTE_DO_CASAL}
        style={{ width: 112, height: 112 }}
        contentFit="contain"
        accessible={false}
      />
    </View>
  );
}

/** O botão claro da noite: branco, com a letra na tinta da noite. */
function BotaoClaro({ rotulo, aoTocar }: { rotulo: string; aoTocar: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        toque();
        aoTocar();
      }}
      style={({ pressed }) => ({
        marginTop: espaco.xxl,
        minHeight: 54,
        borderRadius: canto.pilula,
        ...curva,
        backgroundColor: corNoite.texto,
        alignItems: "center",
        justifyContent: "center",
        transform: [{ scale: pressed ? 0.97 : 1 }],
      })}
    >
      <Text style={{ ...fonte.forte, fontSize: 17, lineHeight: 22, color: corNoite.tintaDoBotao }}>
        {rotulo}
      </Text>
    </Pressable>
  );
}

/* A figura: 149 × 112 na tela, desenhada em 120 × 90. */
const LARGURA = 149;
const ALTURA = 112;
const ESCALA_DO_DESENHO = Math.min(LARGURA / 120, ALTURA / 90);
const DY = (ALTURA - 90 * ESCALA_DO_DESENHO) / 2;

const TRACO = { stroke: "rgba(255,255,255,0.5)", strokeWidth: 1.6, fill: "none" } as const;

/**
 * A personagem na noite: a blusa é o lilás da noite como ele é (no dia, a cor
 * da atividade é aberta em pastel; aqui ela já é clara), e o resto é o do
 * Mexer — a legging lilás e o cabelo castanho aparecem bem no escuro.
 */
const CORES_DA_NOITE = {
  ...coresDaFigura(corNoite.lilas),
  roupa: corNoite.lilas,
  roupaSombra: escurecer(corNoite.lilas, 0.16),
  apoio: "rgba(255,255,255,0.24)",
  apoioSombra: "rgba(255,255,255,0.16)",
  alvo: corNoite.alvoDaFigura,
};

const DESENHOS_DO_CASAL = {
  "mao-no-sacro": desenhoDoCasal("mao-no-sacro"),
  "mao-na-barriga": desenhoDoCasal("mao-na-barriga"),
} as const;

/**
 * Uma das duas respirações (`dc-casal-respira`): 0,9 → 1,08 → 0,9 em 7 s, com
 * o `ease-in-out` do CSS, no motor nativo. A de trás segue a da frente com
 * 0,35 s. É a respiração guiada: o laço não para enquanto o bloco está na
 * tela (função, e não enfeite) — mas para na pausa e com "reduzir movimento".
 */
function Respiro({
  cx,
  cy,
  r,
  atraso,
  parado,
}: {
  cx: number;
  cy: number;
  r: number;
  atraso: number;
  parado: boolean;
}) {
  const reduzido = useMovimentoReduzido();
  const v = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (reduzido || parado) {
      v.setValue(1);
      return;
    }
    v.setValue(0.9);
    const curva = Easing.bezier(0.42, 0, 0.58, 1);
    const laco = Animated.sequence([
      Animated.delay(atraso),
      Animated.loop(
        Animated.sequence([
          Animated.timing(v, {
            toValue: 1.08,
            duration: 3150,
            easing: curva,
            useNativeDriver: true,
          }),
          Animated.timing(v, {
            toValue: 0.9,
            duration: 3850,
            easing: curva,
            useNativeDriver: true,
          }),
        ]),
      ),
    ]);
    laco.start();
    return () => laco.stop();
  }, [reduzido, parado, atraso, v]);
  /* A escala em volta do centro do círculo (a vista gira em volta do próprio centro). */
  const ox = cx * ESCALA_DO_DESENHO - LARGURA / 2;
  const oy = cy * ESCALA_DO_DESENHO + DY - ALTURA / 2;
  return (
    <Animated.View
      style={{
        position: "absolute",
        width: LARGURA,
        height: ALTURA,
        transform: [
          { translateX: ox },
          { translateY: oy },
          { scale: v },
          { translateX: -ox },
          { translateY: -oy },
        ],
      }}
    >
      <Svg width={LARGURA} height={ALTURA} viewBox="0 0 120 90">
        <Circle cx={cx} cy={cy} r={r} {...TRACO} />
      </Svg>
    </Animated.View>
  );
}

/** Os quatro desenhos do site: o ponto âmbar é exatamente onde a mão vai. */
const Figura = memo(function Figura({
  tipo,
  parado,
}: {
  tipo: BlocoDoCasal["figura"];
  parado: boolean;
}) {
  if (!tipo) return null;
  const alvo = corNoite.alvoDaFigura;
  /* As duas com gente são a personagem do Mexer, de lado no banquinho. */
  if (tipo === "mao-no-sacro" || tipo === "mao-na-barriga")
    return (
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <FiguraParada
          desenho={DESENHOS_DO_CASAL[tipo]}
          cores={CORES_DA_NOITE}
          largura={LARGURA}
          altura={ALTURA}
        />
      </View>
    );
  return (
    <View
      style={{ width: LARGURA, height: ALTURA }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {tipo === "respirar" ? (
        <>
          {/* Duas respirações que se encontram: a de trás segue a da frente. */}
          <Respiro cx={44} cy={45} r={20} atraso={0} parado={parado} />
          <Respiro cx={78} cy={45} r={14} atraso={350} parado={parado} />
        </>
      ) : null}
      <Svg
        width={LARGURA}
        height={ALTURA}
        viewBox="0 0 120 90"
        style={{ position: "absolute", left: 0, top: 0 }}
      >
        {tipo === "respirar" ? (
          <>
            <Circle cx={44} cy={45} r={3} fill={alvo} />
            <Circle cx={78} cy={45} r={3} fill="rgba(255,255,255,0.45)" />
          </>
        ) : null}
        {tipo === "palavra" ? (
          <>
            {/* Duas falas, uma palavra só no meio das duas. */}
            <Path
              d="M22 30h34a6 6 0 0 1 6 6v14a6 6 0 0 1-6 6H34l-8 8v-8h-4a6 6 0 0 1-6-6V36a6 6 0 0 1 6-6Z"
              {...TRACO}
            />
            <Path
              d="M98 30H72a6 6 0 0 0-6 6v14a6 6 0 0 0 6 6h20l8 8v-8a6 6 0 0 0 6-6V36a6 6 0 0 0-6-6Z"
              {...TRACO}
            />
            <Circle cx={60} cy={43} r={4} fill={alvo} />
          </>
        ) : null}
      </Svg>
    </View>
  );
});
