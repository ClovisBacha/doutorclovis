import { Image } from "expo-image";
import { router } from "expo-router";
import { useRef, useState, type ReactNode } from "react";
import { Text, View, useWindowDimensions } from "react-native";
import { fruitEmojiForWeek } from "@/lib/gestacao";
import {
  Botao,
  Carregando,
  Cartao,
  Sobrelinha,
  T,
  Tela,
  TituloDaSecao,
  Tocavel,
} from "~/componentes/base";
import { CabecalhoDaPilha } from "~/componentes/cabecalho";
import { rota } from "~/componentes/jornada/bancada";
import { Folha, voltarParaJornada } from "~/componentes/jornada/pecas";
import { useJornada } from "~/componentes/jornada/usarJornada";
import { Contagem } from "~/componentes/recompensas/pecas";
import { listaDeNumeros } from "~/lib/jornada/momentos";
import {
  diaNaTrilhaDoPos,
  diasDoPosFechados,
  figurinhaDoPos,
  figurinhasDoPos,
  nestaSemanaDoPos,
  SEMANAS_DO_POS,
  semanaDeVida,
} from "~/lib/jornada/pos-parto";
import { canto, cor, curva, escala, espaco, fonte, margem, sombra } from "~/tema";

/**
 * O ÁLBUM DE VOCÊS — as figurinhas do 4º trimestre (uma por semana de vida) e
 * o álbum da gestação, que o site guardava "para sempre" depois do parto
 * (`Álbum da gestação 💝`). Tocar numa semana da gestação abre a página dela
 * (o que acontecia com o bebê, o tamanho, o peso); numa semana de vida, o
 * texto daquela semana e os dias completos.
 *
 * Desenho (18/11/2026, a vistoria): um álbum vive do contraste entre o colado
 * e o vazio. A figurinha ganha é um cartão branco erguido, um tico torto; a
 * semana que passou sem ela é um vão tracejado; a que ainda vem é só o
 * número. Quatro por fileira, agrupadas por trimestre, com a capa dizendo
 * quantas semanas já têm a sua.
 *
 * Bancada: /jornada/album?bancada=1&pos=1 [&idade=40]
 */
export default function AlbumDeVoces() {
  const { dia, loja } = useJornada();
  const [semanaDeVidaAberta, setSemanaDeVidaAberta] = useState<number | null>(null);
  /* As células têm largura medida (e não `flexGrow`): a última fileira, com
     menos itens, não pode esticar as figurinhas. */
  const { width } = useWindowDimensions();
  const util = width - margem.tela * 2;
  const lado = Math.floor((util - espaco.md * 3) / 4);

  const topo = (titulo: string) => (
    <View style={{ paddingHorizontal: margem.tela, paddingTop: espaco.sm }}>
      <CabecalhoDaPilha titulo={titulo} voltarPara="/jornada" />
    </View>
  );

  if (dia.modo === "carregando" || !loja.pronto) {
    return (
      <Tela topo={topo("O álbum de vocês")}>
        <Carregando />
      </Tela>
    );
  }
  if (dia.modo === "falhou" || dia.cuidado) {
    return (
      <Tela topo={topo("O álbum")}>
        <T>Os seus momentos continuam guardados.</T>
        <Botao rotulo="Voltar" tipo="secundario" aoTocar={voltarParaJornada} />
      </Tela>
    );
  }

  const pos = dia.modo === "pos";
  const semanaAtualDaGestacao = dia.modo === "gestacao" ? dia.semana : null;
  const daGestacao = listaDeNumeros(loja.blob["dc-path-stickers"]);
  const doPos = figurinhasDoPos(loja.blob);
  const semanasDaGestacao = Math.max(40, ...daGestacao.filter((s) => s <= 42));
  const semanaDeVidaDeHoje = pos ? semanaDeVida(diaNaTrilhaDoPos(dia.idadeDias)) : null;
  const ganhas = daGestacao.length + doPos.length;
  /* "3 de 24 semanas": as semanas que JÁ chegaram, e não as 40 de uma vez. */
  const chegaram = Math.max(
    ganhas,
    pos
      ? semanasDaGestacao + Math.min(SEMANAS_DO_POS, semanaDeVidaDeHoje ?? 0)
      : Math.min(semanasDaGestacao, semanaAtualDaGestacao ?? 0),
  );
  const trimestres = [
    { nome: "1º trimestre", de: 1, ate: 13 },
    { nome: "2º trimestre", de: 14, ate: 27 },
    { nome: "3º trimestre", de: 28, ate: semanasDaGestacao },
  ];

  return (
    <Tela topo={topo("O álbum de vocês")} estilo={{ gap: espaco.xxl }}>
      <Capa ganhas={ganhas} chegaram={chegaram} pos={pos} />

      {pos ? (
        <Secao titulo="O 4º trimestre" contagem={`${doPos.length} de ${SEMANAS_DO_POS}`}>
          {Array.from({ length: SEMANAS_DO_POS }, (_, i) => i + 1).map((s) => {
            const tem = doPos.includes(s);
            const chegou = semanaDeVidaDeHoje != null && s <= semanaDeVidaDeHoje;
            return (
              <Figurinha
                key={s}
                numero={s}
                arte={figurinhaDoPos(s)}
                lado={lado}
                estado={tem ? "ganha" : chegou ? "vao" : "futura"}
                rotulo={`Semana ${s} de vida${tem ? ", figurinha guardada" : chegou ? ", sem figurinha" : ", ainda não chegou"}`}
                aoTocar={chegou || tem ? () => setSemanaDeVidaAberta(s) : undefined}
              />
            );
          })}
        </Secao>
      ) : null}

      {trimestres.map((t) => {
        const semanas = Array.from({ length: t.ate - t.de + 1 }, (_, i) => t.de + i);
        const nelas = semanas.filter((s) => daGestacao.includes(s)).length;
        return (
          <Secao key={t.nome} titulo={t.nome} contagem={`${nelas} de ${semanas.length}`}>
            {semanas.map((s) => {
              const tem = daGestacao.includes(s);
              const chegou = pos || (semanaAtualDaGestacao != null && s <= semanaAtualDaGestacao);
              return (
                <Figurinha
                  key={s}
                  numero={s}
                  arte={fruitEmojiForWeek(s)}
                  lado={lado}
                  estado={tem ? "ganha" : chegou ? "vao" : "futura"}
                  rotulo={`Semana ${s} da gestação${tem ? ", figurinha guardada" : chegou ? ", sem figurinha" : ", ainda não chegou"}`}
                  aoTocar={
                    chegou || tem
                      ? () => router.push(rota(`/jornada/semana?semana=${s}`) as never)
                      : undefined
                  }
                />
              );
            })}
          </Secao>
        );
      })}

      <FolhaDaSemanaDeVida
        semana={semanaDeVidaAberta}
        diasCompletos={
          semanaDeVidaAberta == null
            ? 0
            : diasDoPosFechados(loja.blob).filter((D) => Math.floor(D / 7) === semanaDeVidaAberta)
                .length
        }
        tem={semanaDeVidaAberta != null && doPos.includes(semanaDeVidaAberta)}
        aoFechar={() => setSemanaDeVidaAberta(null)}
      />
    </Tela>
  );
}

/** A capa: a arte do álbum, quantas semanas já têm a sua figurinha e uma barra fina. */
function Capa({ ganhas, chegaram, pos }: { ganhas: number; chegaram: number; pos: boolean }) {
  const fracao = chegaram > 0 ? Math.min(1, ganhas / chegaram) : 0;
  return (
    <Cartao estilo={{ flexDirection: "row", alignItems: "center", gap: espaco.lg }}>
      <Image
        source={require("../../../../src/assets/bebe/album.webp")}
        style={{ width: 76, height: 76 }}
        contentFit="contain"
        accessibilityIgnoresInvertColors
      />
      <View style={{ flex: 1, gap: espaco.xs }}>
        <Sobrelinha>Figurinhas</Sobrelinha>
        <Text
          accessibilityLabel={
            chegaram > 0
              ? `${ganhas} de ${chegaram} semanas com figurinha`
              : "Nenhuma figurinha ainda"
          }
          style={{
            ...fonte.titulo,
            ...escala.titulo2,
            color: cor.texto,
            fontVariant: ["tabular-nums"],
          }}
        >
          {chegaram > 0 ? `${ganhas} de ${chegaram} semanas` : "Nenhuma ainda"}
        </Text>
        <View
          style={{ height: 6, borderRadius: 3, overflow: "hidden", backgroundColor: cor.trilho }}
        >
          <View
            style={{
              width: `${Math.round(fracao * 100)}%`,
              height: 6,
              borderRadius: 3,
              backgroundColor: cor.primaria,
            }}
          />
        </View>
        <Text
          style={{
            marginTop: 2,
            ...fonte.normal,
            ...escala.nota,
            color: cor.textoApagado,
          }}
        >
          {pos
            ? "A gestação inteira e as 12 primeiras semanas de vida, num lugar só."
            : "Feche um dia da semana e a figurinha dela vem para cá."}
        </Text>
      </View>
    </Cartao>
  );
}

function Secao({
  titulo,
  contagem,
  children,
}: {
  titulo: string;
  contagem: string;
  children: ReactNode;
}) {
  return (
    <View style={{ gap: espaco.lg }}>
      <TituloDaSecao direita={<Contagem texto={contagem} />}>{titulo}</TituloDaSecao>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: espaco.md }}>{children}</View>
    </View>
  );
}

/**
 * Uma semana do álbum, em três estados que se distinguem de longe:
 * - ganha: a figurinha COLADA (cartão branco erguido, a borda de recorte e um
 *   tico torto, alternando o lado);
 * - vão: a semana que passou sem ela (o contorno tracejado, vazio);
 * - futura: só o número.
 */
function Figurinha({
  numero,
  arte,
  lado,
  estado,
  rotulo,
  aoTocar,
}: {
  numero: number;
  arte: string;
  lado: number;
  estado: "ganha" | "vao" | "futura";
  rotulo: string;
  aoTocar?: () => void;
}) {
  const desenho =
    estado === "ganha" ? (
      <View
        style={[
          {
            width: lado,
            height: lado,
            alignItems: "center",
            justifyContent: "center",
            gap: 2,
            borderRadius: canto.campo,
            ...curva,
            borderWidth: 2,
            borderColor: cor.branco,
            backgroundColor: cor.cartao,
            transform: [{ rotate: numero % 2 === 0 ? "2deg" : "-2deg" }],
          },
          sombra,
        ]}
      >
        <Text allowFontScaling={false} style={{ fontSize: 34, lineHeight: 40 }}>
          {arte}
        </Text>
        <Text
          style={{
            ...fonte.forte,
            ...escala.nota,
            color: cor.textoApagado,
            fontVariant: ["tabular-nums"],
          }}
        >
          {numero}
        </Text>
      </View>
    ) : (
      <View
        style={{
          width: lado,
          height: lado,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: canto.campo,
          ...curva,
          borderWidth: estado === "vao" ? 1.5 : 0,
          borderStyle: "dashed",
          borderColor: cor.chevron,
        }}
      >
        <Text
          style={{
            ...fonte.media,
            ...escala.nota,
            color: cor.textoApagado,
            fontVariant: ["tabular-nums"],
          }}
        >
          {numero}
        </Text>
      </View>
    );
  if (!aoTocar) {
    return (
      <View accessible accessibilityLabel={rotulo}>
        {desenho}
      </View>
    );
  }
  return (
    <Tocavel aoTocar={aoTocar} rotulo={rotulo} profundidade={0.94}>
      {desenho}
    </Tocavel>
  );
}

/** A semana de vida aberta: a figurinha, os dias completos e o texto da semana. */
function FolhaDaSemanaDeVida({
  semana,
  diasCompletos,
  tem,
  aoFechar,
}: {
  semana: number | null;
  diasCompletos: number;
  tem: boolean;
  aoFechar: () => void;
}) {
  /* A folha fecha deslizando: o conteúdo fica até ela sumir. */
  const ultima = useRef<number | null>(null);
  if (semana != null) ultima.current = semana;
  const s = semana ?? ultima.current;
  if (s == null) return null;
  return (
    <Folha aberta={semana != null} aoFechar={aoFechar} titulo={`Semana ${s} de vida`}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: espaco.lg }}>
        <View
          style={[
            {
              width: 76,
              height: 76,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: canto.campo,
              ...curva,
            },
            tem
              ? [
                  {
                    backgroundColor: cor.cartao,
                    borderWidth: 2,
                    borderColor: cor.branco,
                    transform: [{ rotate: "-2deg" }],
                  },
                  sombra,
                ]
              : { borderWidth: 1.5, borderStyle: "dashed", borderColor: cor.chevron },
          ]}
        >
          <Text
            allowFontScaling={false}
            style={{ fontSize: 40, lineHeight: 48, opacity: tem ? 1 : 0.35 }}
          >
            {figurinhaDoPos(s)}
          </Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ ...fonte.forte, ...escala.manchete, color: cor.texto }}>
            {tem ? "Figurinha guardada" : "Essa semana ficou sem figurinha"}
          </Text>
          <Text style={{ ...fonte.normal, ...escala.legenda, color: cor.textoApagado }}>
            {diasCompletos === 0
              ? "Nenhum dia completo"
              : diasCompletos === 1
                ? "1 dia completo"
                : `${diasCompletos} dias completos`}
          </Text>
        </View>
      </View>
      <View
        style={{
          gap: espaco.xs,
          borderRadius: canto.dentro,
          ...curva,
          backgroundColor: cor.cartao,
          padding: espaco.lg,
        }}
      >
        <Sobrelinha>Nessa semana</Sobrelinha>
        <Text style={{ ...fonte.normal, ...escala.corpo, color: cor.textoCorpo }}>
          {nestaSemanaDoPos(s)}
        </Text>
      </View>
      <Botao rotulo="Fechar" tipo="secundario" aoTocar={aoFechar} />
    </Folha>
  );
}
