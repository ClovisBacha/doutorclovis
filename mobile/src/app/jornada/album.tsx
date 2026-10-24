import { Image } from "expo-image";
import { router } from "expo-router";
import { useState } from "react";
import { Modal, Pressable, Text, useWindowDimensions, View } from "react-native";
import { fruitEmojiForWeek } from "@/lib/gestacao";
import { Botao, Carregando, T, Tela, toque } from "~/componentes/base";
import { BotaoDaAtividade } from "~/componentes/jornada/atividade";
import { rota } from "~/componentes/jornada/bancada";
import { BarraDoTopo, voltarParaJornada } from "~/componentes/jornada/pecas";
import { useJornada } from "~/componentes/jornada/usarJornada";
import { listaDeNumeros } from "~/lib/jornada/momentos";
import {
  coresDaSemanaDoPos,
  diaNaTrilhaDoPos,
  diasDoPosFechados,
  figurinhaDoPos,
  figurinhasDoPos,
  orientacaoDoPos,
  SEMANAS_DO_POS,
  semanaDeVida,
} from "~/lib/jornada/pos-parto";
import { cor, espaco, fonte, raio } from "~/tema";

/**
 * O ÁLBUM DE VOCÊS — as figurinhas do 4º trimestre (uma por semana de vida) e
 * o álbum da gestação, que o site guardava "para sempre" depois do parto
 * (`Álbum da gestação 💝`). Tocar numa semana da gestação abre a página dela
 * (o que acontecia com o bebê, o tamanho, o peso); numa semana de vida, a
 * orientação daquela semana e os dias completos.
 *
 * Bancada: /jornada/album?bancada=1&pos=1 [&idade=40]
 */
export default function AlbumDeVoces() {
  const { dia, loja } = useJornada();
  const [semanaDeVidaAberta, setSemanaDeVidaAberta] = useState<number | null>(null);
  /* As células têm largura medida (e não `flexGrow`): a última fileira, com
     menos itens, não pode esticar as figurinhas. */
  const { width } = useWindowDimensions();
  const util = width - espaco.lg * 2;
  const celulaDoPos = Math.floor((util - espaco.sm * 3) / 4);
  const celulaDaGestacao = Math.floor((util - 6 * 5) / 6);

  if (dia.modo === "carregando" || !loja.pronto) {
    return (
      <Tela>
        <BarraDoTopo titulo="O álbum de vocês" />
        <Carregando />
      </Tela>
    );
  }
  if (dia.modo === "falhou" || dia.cuidado) {
    return (
      <Tela>
        <BarraDoTopo titulo="O álbum" />
        <T>Os seus momentos continuam guardados na jornada.</T>
        <Botao rotulo="Voltar" aoTocar={voltarParaJornada} />
      </Tela>
    );
  }

  const pos = dia.modo === "pos";
  const semanaAtualDaGestacao = dia.modo === "gestacao" ? dia.semana : null;
  const daGestacao = listaDeNumeros(loja.blob["dc-path-stickers"]);
  const doPos = figurinhasDoPos(loja.blob);
  const semanasDaGestacao = Math.max(40, ...daGestacao.filter((s) => s <= 42));
  const semanaDeVidaDeHoje = pos ? semanaDeVida(diaNaTrilhaDoPos(dia.idadeDias)) : null;
  const total = daGestacao.length + doPos.length;

  return (
    <Tela>
      <BarraDoTopo titulo="O álbum de vocês" />
      <View style={{ flexDirection: "row", alignItems: "center", gap: espaco.md }}>
        <Image
          source={require("../../../../src/assets/bebe/album.webp")}
          style={{ width: 72, height: 72 }}
          contentFit="contain"
        />
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonte.titulo, fontSize: 22, color: cor.texto }}>
            {total} {total === 1 ? "figurinha" : "figurinhas"}
          </Text>
          <T tipo="apagado">
            {pos
              ? "A gestação inteira e as 12 primeiras semanas de vida, guardadas para sempre."
              : "Cada semana que chega deixa a sua figurinha aqui."}
          </T>
        </View>
      </View>

      {pos ? (
        <View style={{ gap: espaco.sm }}>
          <T tipo="subtitulo">
            O 4º trimestre · {doPos.length} de {SEMANAS_DO_POS}
          </T>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: espaco.sm }}>
            {Array.from({ length: SEMANAS_DO_POS }, (_, i) => i + 1).map((s) => {
              const tem = doPos.includes(s);
              const chegou = semanaDeVidaDeHoje != null && s <= semanaDeVidaDeHoje;
              const tom = coresDaSemanaDoPos(s);
              return (
                <Pressable
                  key={s}
                  accessibilityRole="button"
                  accessibilityLabel={`Semana ${s} de vida${tem ? ", figurinha conquistada" : chegou ? "" : ", ainda não chegou"}`}
                  disabled={!chegou}
                  onPress={() => {
                    toque();
                    setSemanaDeVidaAberta(s);
                  }}
                  style={({ pressed }) => ({
                    width: celulaDoPos,
                    height: celulaDoPos,
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 2,
                    borderRadius: raio.md,
                    backgroundColor: tem ? `${tom.main}22` : cor.apagado,
                    borderWidth: tem ? 2 : 0,
                    borderColor: tem ? tom.main : "transparent",
                    opacity: pressed ? 0.8 : chegou ? 1 : 0.45,
                  })}
                >
                  <Text style={{ fontSize: 30, opacity: tem ? 1 : 0.35 }}>{figurinhaDoPos(s)}</Text>
                  <Text style={{ fontFamily: fonte.forte, fontSize: 13, color: cor.textoApagado }}>
                    S{s}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      <View style={{ gap: espaco.sm }}>
        <T tipo="subtitulo">
          A gestação · {daGestacao.length} {daGestacao.length === 1 ? "figurinha" : "figurinhas"}
        </T>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {Array.from({ length: semanasDaGestacao }, (_, i) => i + 1).map((s) => {
            const tem = daGestacao.includes(s);
            const chegou = pos || (semanaAtualDaGestacao != null && s <= semanaAtualDaGestacao);
            return (
              <Pressable
                key={s}
                accessibilityRole="button"
                accessibilityLabel={`Semana ${s} da gestação${tem ? ", figurinha conquistada" : ""}`}
                disabled={!chegou}
                onPress={() => {
                  toque();
                  router.push(rota(`/jornada/semana?semana=${s}`) as never);
                }}
                style={({ pressed }) => ({
                  width: celulaDaGestacao,
                  height: celulaDaGestacao,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: raio.sm,
                  backgroundColor: tem ? "#fdf2f8" : cor.apagado,
                  opacity: pressed ? 0.8 : chegou ? 1 : 0.4,
                })}
              >
                <Text style={{ fontSize: 22, opacity: tem ? 1 : 0.3 }}>{fruitEmojiForWeek(s)}</Text>
                <Text style={{ fontFamily: fonte.media, fontSize: 11, color: cor.textoApagado }}>
                  {s}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

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
  if (semana == null) return null;
  return (
    <Modal visible transparent animationType="slide" onRequestClose={aoFechar}>
      <Pressable
        accessibilityLabel="Fechar"
        onPress={aoFechar}
        style={{ flex: 1, backgroundColor: "rgba(20,10,30,0.3)" }}
      />
      <View
        style={{
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          backgroundColor: cor.branco,
          padding: espaco.xl,
          paddingBottom: espaco.xxl,
          gap: espaco.md,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: espaco.md }}>
          <Text style={{ fontSize: 52, opacity: tem ? 1 : 0.4 }}>{figurinhaDoPos(semana)}</Text>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontFamily: fonte.titulo,
                fontSize: 12,
                letterSpacing: 1.2,
                textTransform: "uppercase",
                color: "#0369a1",
              }}
            >
              Semana {semana} de vida
            </Text>
            <Text style={{ fontFamily: fonte.titulo, fontSize: 20, color: cor.texto }}>
              {tem ? "Figurinha conquistada" : "Sem figurinha nessa semana"}
            </Text>
            <T tipo="apagado">
              {diasCompletos} {diasCompletos === 1 ? "dia completo" : "dias completos"}
            </T>
          </View>
        </View>
        <View style={{ borderRadius: 18, backgroundColor: "#effaff", padding: espaco.lg, gap: 4 }}>
          <Text style={{ fontFamily: fonte.titulo, fontSize: 13, color: "#0369a1" }}>
            O que valia nessa semana
          </Text>
          <Text style={{ fontFamily: fonte.media, fontSize: 15, lineHeight: 22, color: "#0c3a5a" }}>
            {orientacaoDoPos(semana)}
          </Text>
        </View>
        <BotaoDaAtividade cor="#0284c7" rotulo="Fechar" aoTocar={aoFechar} />
      </View>
    </Modal>
  );
}
