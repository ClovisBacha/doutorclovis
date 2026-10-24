import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { tempoNoApp } from "@/lib/amigas";
import { CANTINHO_BY_ID, fundoBgFor } from "@/lib/cantinho";
import { TRILHA_SKINS } from "@/lib/trilha-skins";
import { useAviso } from "~/componentes/aviso";
import { Carregando, toque } from "~/componentes/base";
import { CabecalhoDaPilha, voltarOu } from "~/componentes/cabecalho";
import {
  lerPerfilDaAmiga,
  sairDaAmizade,
  type LeituraDoPerfil,
} from "~/componentes/amigas/economia";
import { FolhaDeSair, tinta } from "~/componentes/amigas/pecas";
import { EnfeiteNaTrilha } from "~/componentes/caminho/enfeites";
import { ChamaDaSequencia } from "~/componentes/caminho/pecas";
import { rota } from "~/componentes/jornada/bancada";
import { ArteDaBolha, useMovimentoReduzido } from "~/componentes/movimento";
import { paradasDoDegrade } from "~/lib/jornada/enfeites";
import type { CantinhoDaAmiga } from "~/servidor/amigas";
import { ALVO_MINIMO, cor, espaco, fonte } from "~/tema";

/**
 * A TELA DA AMIGA — a do site (`PerfilDaAmigaTela`): primeiro o Cantinho que
 * ela comprou e ARRUMOU, com os enfeites onde ela pôs, e a Bolha; depois quem
 * ela é — o nome, há quanto tempo está no app, a chama, os troféus e os itens.
 * Nada clínico: nem semana, nem DPP, nem medida. É o que permite esta tela
 * existir quando uma gestação termina mal.
 *
 * Fica de fora o "Presentear" do site: o bolso de presentear era do Premium, e
 * o app não vende nada fora da Apple. "Sair da amizade" mora no pé, cinza:
 * quem procura acha; quem está passeando pelo Cantinho dela não tropeça.
 */
export default function PerfilDaAmigaTela() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [leitura, setLeitura] = useState<LeituraDoPerfil | "carregando">("carregando");
  const [saindo, setSaindo] = useState(false);
  const { avisar, aviso } = useAviso();

  useEffect(() => {
    if (!id) return;
    let vivo = true;
    void lerPerfilDaAmiga(id).then((r) => {
      if (vivo) setLeitura(r);
    });
    return () => {
      vivo = false;
    };
  }, [id]);

  const cabecalho = (titulo: string) => (
    <View style={{ paddingHorizontal: espaco.lg, paddingBottom: espaco.sm }}>
      <CabecalhoDaPilha titulo={titulo} voltarPara={rota("/amigas") as never} />
    </View>
  );

  if (leitura === "carregando") {
    return (
      <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: "#fcf2f6" }}>
        {cabecalho("Amiga")}
        <Carregando />
      </SafeAreaView>
    );
  }
  if (!leitura.ok) {
    return (
      <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: "#fcf2f6" }}>
        {cabecalho("Amiga")}
        <View
          style={{
            margin: espaco.lg,
            borderRadius: 24,
            borderWidth: 1,
            borderStyle: "dashed",
            borderColor: "#e3d3ec",
            padding: espaco.xl,
          }}
        >
          <Text
            style={{ textAlign: "center", fontFamily: fonte.media, fontSize: 14, color: tinta.sub }}
          >
            {leitura.indisponivel
              ? "O Cantinho dela não está aberto para visitas agora."
              : "Não foi possível abrir este perfil."}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const { perfil: a, cantinho } = leitura;

  async function sair() {
    setSaindo(false);
    const r = await sairDaAmizade(a.id);
    if (!r.ok) return avisar("Não deu agora. Tente de novo em instantes.");
    avisar(`${a.nome.split(/\s+/)[0]} não aparece mais aqui.`);
    setTimeout(() => voltarOu(rota("/amigas") as never), 700);
  }

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: "#fcf2f6" }}>
      {cabecalho(a.nome.split(/\s+/)[0])}
      <ScrollView
        contentContainerStyle={{
          padding: espaco.lg,
          paddingTop: espaco.sm,
          paddingBottom: 60,
          gap: espaco.lg,
        }}
      >
        <CenaDoCantinho cantinho={cantinho} />

        <View
          style={{
            alignItems: "center",
            gap: 2,
            borderRadius: 24,
            backgroundColor: cor.branco,
            padding: espaco.xl,
            shadowColor: "#50286e",
            shadowOpacity: 0.07,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 2 },
          }}
        >
          <Text
            style={{
              textAlign: "center",
              fontFamily: fonte.titulo,
              fontSize: 24,
              color: tinta.titulo,
            }}
          >
            {a.nome}
          </Text>
          {a.bebe ? (
            <Text style={{ fontFamily: fonte.media, fontSize: 14, color: tinta.sub }}>
              💜 {a.bebe}
            </Text>
          ) : null}
          <Text style={{ fontFamily: fonte.media, fontSize: 13, color: tinta.sub }}>
            {tempoNoApp(a.diasNoApp)}
          </Text>

          <View style={{ flexDirection: "row", alignSelf: "stretch", marginTop: espaco.lg }}>
            <Numero
              icone={<ChamaDaSequencia acesa={a.sequencia > 0} tamanho={44} />}
              valor={a.sequencia}
              cor={tinta.ambar}
              rotulo={a.sequencia === 1 ? "dia seguido" : "dias seguidos"}
            />
            <Numero
              icone={<Text style={{ fontSize: 28, lineHeight: 36 }}>🏆</Text>}
              valor={a.trofeus}
              cor={tinta.violeta}
              rotulo={a.trofeus === 1 ? "troféu" : "troféus"}
            />
            <Numero
              icone={<Text style={{ fontSize: 28, lineHeight: 36 }}>🪴</Text>}
              valor={a.itens}
              cor="#047857"
              rotulo={a.itens === 1 ? "item" : "itens"}
            />
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Sair da amizade com ${a.nome}`}
          onPress={() => {
            toque();
            setSaindo(true);
          }}
          style={({ pressed }) => ({
            minHeight: ALVO_MINIMO,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 999,
            backgroundColor: "rgba(255,255,255,0.7)",
            borderWidth: 1,
            borderColor: "#eadff0",
            opacity: pressed ? 0.8 : 1,
          })}
        >
          <Text style={{ fontFamily: fonte.forte, fontSize: 13, color: tinta.sub }}>
            Sair da amizade com {a.nome}
          </Text>
        </Pressable>
      </ScrollView>
      <FolhaDeSair
        nome={a.nome}
        aberta={saindo}
        aoFechar={() => setSaindo(false)}
        aoConfirmar={() => void sair()}
      />
      {aviso}
    </SafeAreaView>
  );
}

/** Altura do cenário — a faixa do site (`h-52`). */
const ALTURA_DA_CENA = 208;
/** No site, o enfeite na casa dela tem 22 px por unidade de escala; na trilha, 32. */
const ESCALA_NA_CENA = 22 / 32;
const FUNDO_SEM_CENARIO = ["#fff5f4", "#ffdfd8"] as const;

/**
 * O cenário que ela comprou, com os enfeites nas posições que ela escolheu.
 * O `y` dela é px ao longo de uma trilha longa; aqui vira fração de uma faixa
 * curta (a mesma dobra do site) — sem ela, tudo cairia fora da moldura.
 */
function CenaDoCantinho({ cantinho }: { cantinho: CantinhoDaAmiga }) {
  const parado = useMovimentoReduzido();
  const paradas = useMemo(() => {
    const css = fundoBgFor(cantinho.fundo);
    const p = css ? paradasDoDegrade(css) : [];
    return p.length >= 2 ? p : null;
  }, [cantinho.fundo]);
  const postos = cantinho.postos.filter((e) => CANTINHO_BY_ID[e.id]);
  const pele = cantinho.skin ? (TRILHA_SKINS[cantinho.skin] ?? null) : null;
  const nomes = postos.map((e) => CANTINHO_BY_ID[e.id]!.name.toLowerCase());
  const rotulo =
    nomes.length === 0
      ? "O Cantinho dela ainda está começando"
      : `O Cantinho dela, com ${nomes.length === 1 ? nomes[0] : `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`}`;

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={rotulo}
      style={{
        height: ALTURA_DA_CENA,
        borderRadius: 24,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: "rgba(80,40,110,0.08)",
      }}
    >
      <LinearGradient
        colors={
          (paradas ? paradas.map((p) => p.cor) : FUNDO_SEM_CENARIO) as unknown as [
            string,
            string,
            ...string[],
          ]
        }
        locations={
          paradas
            ? (paradas.map((p) => p.pos) as unknown as [number, number, ...number[]])
            : undefined
        }
        style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}
      />
      {postos.map((e, i) => (
        <EnfeiteNaTrilha
          key={`${e.id}-${i}`}
          p={{ k: `${e.id}-${i}`, id: e.id, x: e.x, y: e.y, s: e.s * ESCALA_NA_CENA }}
          y={((((e.y % 900) + 900) % 900) / 900) * ALTURA_DA_CENA}
          semana={null}
          parado={parado}
        />
      ))}
      {postos.length === 0 ? (
        <View
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
            bottom: 90,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text
            style={{
              borderRadius: 999,
              overflow: "hidden",
              backgroundColor: "rgba(255,255,255,0.75)",
              paddingHorizontal: 14,
              paddingVertical: 6,
              fontFamily: fonte.media,
              fontSize: 13,
              color: tinta.sub,
            }}
          >
            O Cantinho dela ainda está começando
          </Text>
        </View>
      ) : null}
      {/* A pele das bolinhas que ela equipou entra AO LADO da Bolha, nunca
          vestindo a Bolha: a Bolha é a personagem do app, igual para todas. */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 10,
          flexDirection: "row",
          justifyContent: "center",
          alignItems: "flex-end",
          gap: 6,
        }}
      >
        <ArteDaBolha humor="feliz" tamanho={72} />
        {pele ? (
          <Image
            source={pele.arte.feito as never}
            style={{ width: 28, height: 28, marginBottom: 8 }}
            contentFit="contain"
          />
        ) : null}
      </View>
    </View>
  );
}

function Numero({
  icone,
  valor,
  cor: c,
  rotulo,
}: {
  icone: ReactNode;
  valor: number;
  cor: string;
  rotulo: string;
}) {
  return (
    <View
      accessible
      accessibilityLabel={`${valor} ${rotulo}`}
      style={{ flex: 1, alignItems: "center", gap: 2 }}
    >
      <View style={{ height: 44, alignItems: "center", justifyContent: "center" }}>{icone}</View>
      <Text style={{ fontFamily: fonte.titulo, fontSize: 20, color: c }}>{valor}</Text>
      <Text style={{ fontFamily: fonte.media, fontSize: 13, color: tinta.sub }}>{rotulo}</Text>
    </View>
  );
}
