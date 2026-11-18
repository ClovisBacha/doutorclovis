import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams } from "expo-router";
import Baby from "lucide-react-native/icons/baby";
import ChevronLeft from "lucide-react-native/icons/chevron-left";
import Ellipsis from "lucide-react-native/icons/ellipsis";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Animated, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { tempoNoApp } from "@/lib/amigas";
import { CANTINHO_BY_ID, fundoBgFor } from "@/lib/cantinho";
import { TRILHA_SKINS } from "@/lib/trilha-skins";
import { useAviso } from "~/componentes/aviso";
import { Cartao, NaoConsegueLer, Tocavel } from "~/componentes/base";
import { voltarOu } from "~/componentes/cabecalho";
import {
  amigaNaMemoria,
  lerPerfilDaAmiga,
  sairDaAmizade,
  type LeituraDoPerfil,
} from "~/componentes/amigas/economia";
import { useConfirmar } from "~/componentes/amigas/pecas";
import { EnfeiteNaTrilha } from "~/componentes/caminho/enfeites";
import { ChamaDaSequencia, TrofeuParado } from "~/componentes/caminho/pecas";
import { Avatar } from "~/componentes/comunidade/imagem";
import { rota } from "~/componentes/jornada/bancada";
import { FundoDeLuz } from "~/componentes/luz";
import { ArteDaBolha, useMovimentoReduzido } from "~/componentes/movimento";
import { Painel } from "~/componentes/painel";
import { Vidro } from "~/componentes/vidro";
import { comAlfa } from "~/lib/cor";
import { paradasDoDegrade } from "~/lib/jornada/enfeites";
import { primeiroNomeDaAmiga } from "~/lib/jornada/amigas";
import type { CantinhoDaAmiga, PerfilDeAmiga } from "~/servidor/amigas";
import {
  ALVO_MINIMO,
  cor,
  escala,
  espaco,
  fonte,
  fonteDoNumero,
  luz,
  margem,
  sombraFlutuante,
} from "~/tema";

/**
 * A TELA DA AMIGA — a do site (`PerfilDaAmigaTela`): o Cantinho que ela
 * comprou e ARRUMOU, com os enfeites onde ela pôs, e a Bolha; depois quem ela
 * é — o rosto, o nome, há quanto tempo está no app, a chama, os troféus e os
 * itens. Nada clínico: nem semana, nem DPP, nem medida. É o que permite esta
 * tela existir quando uma gestação termina mal.
 *
 * O desenho (18/11/2026, a vistoria): era a única tela fora do Amanhecer, um
 * rosa chapado sem o rosto dela. Agora o Cantinho é o herói da tela inteira,
 * começando atrás do relógio e se desfazendo na luz; o rosto entra pela borda
 * de baixo dele, e o nome e os números vêm logo depois, sem cartão em volta
 * do nome. A tela abre com o que a lista já sabia (o rosto, o nome e os
 * números aparecem na transição); só a cena espera o servidor.
 *
 * Fica de fora o "Presentear" do site: o bolso de presentear era do Premium, e
 * o app não vende nada fora da Apple. "Sair da amizade" mora no "•••" do
 * topo: quem procura acha; quem está passeando pelo Cantinho dela não tropeça.
 *
 * Bancada: /amigas/<id>?bancada=1 [&postos=0] [&perfil=fechado|falhou]
 */
export default function PerfilDaAmigaTela() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const guardada = useMemo(() => (id ? amigaNaMemoria(id) : null), [id]);
  const [leitura, setLeitura] = useState<LeituraDoPerfil | "carregando">("carregando");
  const [tentativa, setTentativa] = useState(0);
  const insets = useSafeAreaInsets();
  const { avisar, aviso } = useAviso({ baixo: insets.bottom + espaco.lg });
  const { confirmar, folha } = useConfirmar();

  useEffect(() => {
    if (!id) return;
    let vivo = true;
    void lerPerfilDaAmiga(id).then((r) => {
      if (vivo) setLeitura(r);
    });
    return () => {
      vivo = false;
    };
  }, [id, tentativa]);

  const lida = leitura !== "carregando" && leitura.ok ? leitura : null;
  const falhou = leitura !== "carregando" && !leitura.ok ? leitura : null;
  const perfil = lida?.perfil ?? guardada;
  const voltar = () => voltarOu(rota("/amigas") as never);

  function pedirSaida(a: PerfilDeAmiga) {
    const ela = primeiroNomeDaAmiga(a.nome);
    confirmar({
      titulo: `Sair da amizade com ${ela}?`,
      texto:
        "Ela não aparece mais aqui, e você some da lista dela. Se tinham uma dupla, ela acaba. Ninguém é avisado.",
      sim: "Sair da amizade",
      nao: "Ficar",
      aoConfirmar: () => void sair(a),
    });
  }

  async function sair(a: PerfilDeAmiga) {
    const r = await sairDaAmizade(a.id);
    if (!r.ok) return avisar("Não deu agora. Tente de novo em instantes.");
    avisar(`${primeiroNomeDaAmiga(a.nome)} não aparece mais aqui.`);
    setTimeout(voltar, 700);
  }

  return (
    <View style={{ flex: 1, backgroundColor: luz.base }}>
      <FundoDeLuz />
      {falhou ? (
        <View
          style={{
            paddingTop: insets.top + ALVO_MINIMO + espaco.xl,
            paddingHorizontal: margem.tela,
          }}
        >
          {falhou.indisponivel ? (
            <Painel estilo={{ padding: espaco.xl }}>
              <Text
                style={{
                  textAlign: "center",
                  ...fonte.normal,
                  ...escala.legenda,
                  color: cor.textoCorpo,
                }}
              >
                O Cantinho dela não está aberto para visitas agora.
              </Text>
            </Painel>
          ) : (
            <NaoConsegueLer
              sossego="A amizade de vocês continua igual."
              aoTentar={() => {
                setLeitura("carregando");
                setTentativa((t) => t + 1);
              }}
            />
          )}
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: insets.bottom + espaco.xxl + espaco.lg }}
          showsVerticalScrollIndicator={false}
        >
          <CenaDoCantinho cantinho={lida?.cantinho ?? null} topo={insets.top} />
          <QuemEla perfil={perfil} />
        </ScrollView>
      )}

      {/* O topo flutua sobre a cena: o voltar e o "•••", em vidro. */}
      <View
        pointerEvents="box-none"
        style={{
          position: "absolute",
          top: insets.top + espaco.sm,
          left: margem.tela,
          right: margem.tela,
          flexDirection: "row",
          justifyContent: "space-between",
        }}
      >
        <BotaoDeVidro rotulo="Voltar" aoTocar={voltar}>
          <ChevronLeft size={24} color={cor.texto} strokeWidth={2.4} />
        </BotaoDeVidro>
        {perfil && !falhou ? (
          <BotaoDeVidro
            rotulo={`Mais opções. Sair da amizade com ${primeiroNomeDaAmiga(perfil.nome)}`}
            aoTocar={() => pedirSaida(perfil)}
          >
            <Ellipsis size={22} color={cor.texto} strokeWidth={2.4} />
          </BotaoDeVidro>
        ) : null}
      </View>
      {folha}
      {aviso}
    </View>
  );
}

function BotaoDeVidro({
  rotulo,
  aoTocar,
  children,
}: {
  rotulo: string;
  aoTocar: () => void;
  children: ReactNode;
}) {
  return (
    <Tocavel rotulo={rotulo} aoTocar={aoTocar} profundidade={0.92}>
      <Vidro
        interativo
        estilo={{
          width: ALVO_MINIMO,
          height: ALVO_MINIMO,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {children}
      </Vidro>
    </Tocavel>
  );
}

/* ── Quem ela é ─────────────────────────────────────────────────────────── */

const TAMANHO_DO_ROSTO = 96;

/**
 * O rosto (entrando pela borda de baixo da cena), o nome, o bebê e o tempo no
 * app numa linha só, e os três números. Sem o perfil ainda (o link aberto
 * direto, sem passar pela lista), os mesmos lugares em esqueleto.
 */
function QuemEla({ perfil: a }: { perfil: PerfilDeAmiga | null }) {
  const linha = a
    ? [a.bebe, a.bebe ? tempoNoApp(a.diasNoApp) : primeiraMaiuscula(tempoNoApp(a.diasNoApp))]
        .filter(Boolean)
        .join(" · ")
    : null;
  return (
    <View
      style={{
        alignItems: "center",
        marginTop: -TAMANHO_DO_ROSTO / 2,
        paddingHorizontal: margem.tela,
      }}
    >
      <View
        style={{
          width: TAMANHO_DO_ROSTO,
          height: TAMANHO_DO_ROSTO,
          borderRadius: TAMANHO_DO_ROSTO / 2,
          backgroundColor: cor.branco,
          ...sombraFlutuante,
        }}
      >
        {a ? (
          <Avatar id={a.id} nome={a.nome} url={a.avatarUrl} tamanho={TAMANHO_DO_ROSTO} anel={4} />
        ) : (
          <View
            style={{
              flex: 1,
              borderRadius: TAMANHO_DO_ROSTO / 2,
              borderWidth: 4,
              borderColor: cor.branco,
              backgroundColor: cor.trilho,
            }}
          />
        )}
      </View>

      {a ? (
        <>
          <Text
            accessibilityRole="header"
            numberOfLines={2}
            style={{
              marginTop: espaco.md,
              textAlign: "center",
              ...fonte.display,
              ...escala.titulo1,
              letterSpacing: -0.2,
              color: cor.texto,
            }}
          >
            {a.nome}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
            {a.bebe ? (
              <Baby
                size={15}
                color={cor.textoApagado}
                strokeWidth={2.2}
                accessibilityLabel="Bebê"
              />
            ) : null}
            <Text style={{ ...fonte.normal, ...escala.legenda, color: cor.textoApagado }}>
              {linha}
            </Text>
          </View>
        </>
      ) : (
        <View style={{ alignItems: "center", gap: 10, marginTop: espaco.lg }}>
          <View style={{ width: 180, height: 22, borderRadius: 11, backgroundColor: cor.trilho }} />
          <View style={{ width: 130, height: 13, borderRadius: 7, backgroundColor: cor.trilho }} />
        </View>
      )}

      <Cartao
        estilo={{
          alignSelf: "stretch",
          flexDirection: "row",
          marginTop: espaco.xl,
          paddingVertical: espaco.lg,
          paddingHorizontal: 0,
          gap: 0,
        }}
      >
        <Numero
          icone={<ChamaDaSequencia acesa={!!a && a.sequencia > 0} tamanho={40} />}
          valor={a?.sequencia ?? null}
          rotulo={a?.sequencia === 1 ? "dia seguido" : "dias seguidos"}
        />
        <Divisoria />
        <Numero
          icone={<TrofeuParado largura={42} />}
          valor={a?.trofeus ?? null}
          rotulo={a?.trofeus === 1 ? "troféu" : "troféus"}
        />
        <Divisoria />
        <Numero
          icone={
            <Image
              source={ARTE_DOS_ITENS}
              style={{ width: 52, height: 52 }}
              contentFit="contain"
              accessible={false}
            />
          }
          valor={a?.itens ?? null}
          rotulo={a?.itens === 1 ? "item no Cantinho" : "itens no Cantinho"}
        />
      </Cartao>
    </View>
  );
}

/** O vaso do Cantinho (a arte da loja), no lugar do 🪴. */
const ARTE_DOS_ITENS = require("../../../../src/assets/cantinho/planta-vaso.webp");

function Divisoria() {
  return (
    <View
      style={{
        width: StyleSheet.hairlineWidth,
        alignSelf: "stretch",
        marginVertical: 6,
        backgroundColor: cor.borda,
      }}
    />
  );
}

function Numero({
  icone,
  valor,
  rotulo,
}: {
  icone: ReactNode;
  valor: number | null;
  rotulo: string;
}) {
  return (
    <View
      accessible
      accessibilityLabel={valor === null ? undefined : `${valor} ${rotulo}`}
      style={{ flex: 1, alignItems: "center", gap: 4, paddingHorizontal: 4 }}
    >
      <View style={{ height: 44, alignItems: "center", justifyContent: "center" }}>{icone}</View>
      <Text
        style={{
          ...fonteDoNumero,
          fontSize: 28,
          lineHeight: 32,
          color: valor === null ? cor.trilho : cor.texto,
          fontVariant: ["tabular-nums"],
        }}
      >
        {valor === null ? "–" : valor}
      </Text>
      <Text
        numberOfLines={2}
        style={{ textAlign: "center", ...fonte.normal, ...escala.nota, color: cor.textoApagado }}
      >
        {rotulo}
      </Text>
    </View>
  );
}

/* ── A cena do Cantinho ─────────────────────────────────────────────────── */

/** A altura da cena abaixo do relógio (a faixa do site tinha 208). */
const ALTURA_DA_CENA = 248;
/** Os últimos pontos da cena se desfazem na luz da tela. */
const DESFAZER = 48;
/**
 * O enfeite na casa dela, um pouco menor que na trilha (onde 1 ≈ 32 px): no
 * site era 22/32, e os enfeites viravam figurinhas soltas de 15 a 22 pt.
 */
const ESCALA_NA_CENA = 0.85;
/** Onde o centro de um enfeite pode cair: nem cortado em cima, nem atrás do rosto e da Bolha. */
const Y_MINIMO = 28;
const Y_MAXIMO = ALTURA_DA_CENA - 96;
/** O esqueleto da cena (e o fundo de quem não comprou cenário): a luz do amanhecer. */
const FUNDO_SEM_CENARIO = [luz.lilas, luz.pessego] as const;

/**
 * O cenário que ela comprou, com os enfeites nas posições que ela escolheu,
 * do alto da tela (atrás do relógio) até a borda em que o rosto dela entra.
 * O `y` dela é px ao longo de uma trilha longa; aqui vira fração da faixa (a
 * mesma dobra do site), presa entre `Y_MINIMO` e `Y_MAXIMO`. Enquanto o
 * servidor não responde, o degradê do amanhecer faz de esqueleto, e os
 * enfeites entram esmaecendo em 200 ms.
 */
function CenaDoCantinho({ cantinho, topo }: { cantinho: CantinhoDaAmiga | null; topo: number }) {
  const parado = useMovimentoReduzido();
  const { width: largura } = useWindowDimensions();
  const altura = topo + ALTURA_DA_CENA;
  const paradas = useMemo(() => {
    const css = cantinho ? fundoBgFor(cantinho.fundo) : null;
    const p = css ? paradasDoDegrade(css) : [];
    return p.length >= 2 ? p : FUNDO_SEM_CENARIO.map((c, i) => ({ cor: c, pos: i }));
  }, [cantinho]);
  /* O degradê dela ocupa a cena até os últimos 48 pt, que vão da última cor
     ao transparente: a cena se desfaz no fundo da tela, seja ele qual for. */
  const fimDoCenario = (altura - DESFAZER) / altura;
  const ultima = paradas[paradas.length - 1]!.cor;
  const cores = [...paradas.map((p) => p.cor), comAlfa(ultima, 0)];
  const locais = [...paradas.map((p) => p.pos * fimDoCenario), 1];

  const postos = (cantinho?.postos ?? []).filter((e) => CANTINHO_BY_ID[e.id]);
  const pele = cantinho?.skin ? (TRILHA_SKINS[cantinho.skin] ?? null) : null;
  const nomes = postos.map((e) => CANTINHO_BY_ID[e.id]!.name.toLowerCase());
  const rotulo = !cantinho
    ? "O Cantinho dela, abrindo"
    : nomes.length === 0
      ? "O Cantinho dela ainda está começando"
      : `O Cantinho dela, com ${nomes.length === 1 ? nomes[0] : `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`}`;

  const aparecer = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!cantinho) return;
    if (parado) {
      aparecer.setValue(1);
      return;
    }
    Animated.timing(aparecer, { toValue: 1, duration: 200, useNativeDriver: true }).start();
  }, [cantinho, parado, aparecer]);

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={rotulo}
      style={{ height: altura, width: largura }}
    >
      <LinearGradient
        colors={cores as unknown as [string, string, ...string[]]}
        locations={locais as unknown as [number, number, ...number[]]}
        style={StyleSheet.absoluteFill}
      />
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: aparecer }]}>
        {postos.map((e, i) => {
          const dobrado = ((((e.y % 900) + 900) % 900) / 900) * ALTURA_DA_CENA;
          const y = topo + Math.min(Y_MAXIMO, Math.max(Y_MINIMO, dobrado));
          return (
            <EnfeiteNaTrilha
              key={`${e.id}-${i}`}
              p={{ k: `${e.id}-${i}`, id: e.id, x: e.x, y: e.y, s: e.s * ESCALA_NA_CENA }}
              y={y}
              semana={null}
              parado={parado}
            />
          );
        })}
        {cantinho && postos.length === 0 ? (
          <View
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: topo + ALTURA_DA_CENA / 2 - 40,
              alignItems: "center",
            }}
          >
            <Vidro flutua={false} estilo={{ paddingHorizontal: 14, paddingVertical: 7 }}>
              <Text style={{ ...fonte.media, ...escala.nota, color: cor.textoCorpo }}>
                O Cantinho dela ainda está começando
              </Text>
            </Vidro>
          </View>
        ) : null}
      </Animated.View>
      {/* A Bolha mora ao lado do rosto, e não atrás dele. A pele das bolinhas
          que ela equipou entra AO LADO da Bolha, nunca vestindo a Bolha: a
          Bolha é a personagem do app, igual para todas. */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          right: margem.tela + 8,
          bottom: 10,
          flexDirection: "row",
          alignItems: "flex-end",
          gap: 4,
        }}
      >
        {pele ? (
          <Image
            source={pele.arte.feito as never}
            style={{ width: 26, height: 26, marginBottom: 6 }}
            contentFit="contain"
          />
        ) : null}
        <ArteDaBolha humor="feliz" tamanho={64} />
      </View>
    </View>
  );
}

function primeiraMaiuscula(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
