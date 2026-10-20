import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Modal, Pressable, Text, View, type LayoutChangeEvent } from "react-native";
import { useAviso } from "~/componentes/aviso";
import { toque } from "~/componentes/base";
import { corCaminho } from "~/componentes/caminho/cores";
import {
  AnelDeTarefas,
  Boiar,
  ChamaDaSequencia,
  Emoji,
  IconeCadeado,
  Moeda3D,
  Pulsar,
} from "~/componentes/caminho/pecas";
import { BotaoDaAtividade } from "~/componentes/jornada/atividade";
import { parametroDaBancada } from "~/lib/bancada";
import {
  comBranco,
  montarCaminho,
  tomFuturo,
  tomPerdido,
  TOM_TRAVADO,
  type Bloco,
  type Fase,
} from "~/lib/jornada/caminho";
import { flagsDoDia, type Blob } from "~/lib/jornada/momentos";
import {
  corDaFaixaDoPos,
  coresDaSemanaDoPos,
  diasDoPosFechados,
  estadoDoNoDoPos,
  FASES_DO_POS,
  figurinhaDoPos,
  figurinhasDoPos,
  orientacaoDoPos,
  TAREFAS_DO_POS,
} from "~/lib/jornada/pos-parto";
import { ALVO_MINIMO, cor, espaco, fonte } from "~/tema";

/**
 * A TRILHA DO 4º TRIMESTRE — as 12 semanas de vida em três fases ("Chegando
 * em casa", "Criando ritmo", "Descobertas"), uma barra por semana com a
 * figurinha dela e um nó por dia, em zigue-zague: o `PosPartoJourney` do site
 * com as peças da trilha da gestação (a moeda 3D, o anel, o balão).
 *
 * Mais simples que o Caminho da gestação, de propósito: sem enfeites nem loja
 * (o site também não os punha aqui). Hoje leva de volta à tela Hoje, onde as
 * três tarefas moram; um dia que passou abre o que foi feito e a orientação
 * da semana; um dia que vem diz quando abre.
 */
export function TrilhaDoPosParto({
  hojeD,
  blob,
  chama,
  figurinhas,
  formou,
  aoAbrirHoje,
}: {
  /** O D de hoje na trilha (7–90). */
  hojeD: number;
  blob: Blob;
  chama: number;
  /** Todas as figurinhas: as da gestação e as do 4º trimestre. */
  figurinhas: number;
  formou: boolean;
  aoAbrirHoje: () => void;
}) {
  const blocos = useMemo(() => montarCaminho(FASES_DO_POS, hojeD), [hojeD]);
  const deslocamentos = useMemo(() => {
    const d: number[] = [];
    let soma = 0;
    for (const b of blocos) {
      d.push(soma);
      soma += b.altura;
    }
    return d;
  }, [blocos]);
  const indiceDeHoje = blocos.findIndex((b) => b.tipo === "semana" && b.dias.some((d) => d.hoje));
  const yDeHoje =
    indiceDeHoje >= 0
      ? (() => {
          const b = blocos[indiceDeHoje];
          return (
            deslocamentos[indiceDeHoje] + (b.tipo === "semana" ? b.dias.find((d) => d.hoje)!.y : 0)
          );
        })()
      : 0;
  const comFigurinha = useMemo(() => figurinhasDoPos(blob), [blob]);
  const semanaDeHoje = Math.max(1, Math.min(12, Math.floor(hojeD / 7)));
  const { avisar, aviso } = useAviso();
  const [diaAberto, setDiaAberto] = useState<number | null>(null);

  /* Abre centrada em hoje (na bancada, `&topo=1` deixa no alto). */
  const lista = useRef<FlatList<Bloco>>(null);
  const [alturaDaLista, setAlturaDaLista] = useState<number | null>(null);
  const [alturaDoTopo, setAlturaDoTopo] = useState<number | null>(null);
  const rolou = useRef(parametroDaBancada("topo") === "1");
  useEffect(() => {
    if (rolou.current || alturaDoTopo == null || alturaDaLista == null || indiceDeHoje < 0) return;
    rolou.current = true;
    const alvo = Math.max(0, alturaDoTopo + yDeHoje - alturaDaLista / 2);
    const t = setTimeout(
      () => lista.current?.scrollToOffset({ offset: alvo, animated: false }),
      60,
    );
    return () => clearTimeout(t);
  }, [alturaDoTopo, alturaDaLista, indiceDeHoje, yDeHoje]);

  const renderItem = useCallback(
    ({ item }: { item: Bloco }) =>
      item.tipo === "fase" ? (
        <FaixaDaFaseDoPos fase={item.fase} travada={item.travada} altura={item.altura} />
      ) : (
        <SemanaDoPos
          bloco={item}
          hojeD={hojeD}
          blob={blob}
          comFigurinha={comFigurinha.includes(item.semana)}
          formou={formou}
          aoAbrirDia={(D) => (D === hojeD ? aoAbrirHoje() : setDiaAberto(D))}
          avisar={avisar}
        />
      ),
    [hojeD, blob, comFigurinha, formou, aoAbrirHoje, avisar],
  );

  return (
    <View style={{ flex: 1, backgroundColor: cor.fundo }}>
      <FaixaDoTopoDoPos chama={chama} semana={semanaDeHoje} figurinhas={figurinhas} />
      <FlatList
        ref={lista}
        data={blocos}
        keyExtractor={(b) => (b.tipo === "fase" ? `f${b.fase.n}` : `s${b.semana}`)}
        renderItem={renderItem}
        getItemLayout={(_, i) => ({
          length: blocos[i].altura,
          offset: (alturaDoTopo ?? 0) + deslocamentos[i],
          index: i,
        })}
        initialNumToRender={4}
        windowSize={7}
        extraData={alturaDoTopo}
        onLayout={(e: LayoutChangeEvent) => setAlturaDaLista(e.nativeEvent.layout.height)}
        onScrollToIndexFailed={() => {}}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View
            onLayout={(e) => setAlturaDoTopo(e.nativeEvent.layout.height)}
            style={{ paddingHorizontal: 20, paddingTop: espaco.lg, paddingBottom: espaco.sm }}
          >
            <Text style={{ fontFamily: fonte.media, fontSize: 14, color: cor.textoApagado }}>
              {formou
                ? "As 12 semanas estão completas. O caminho fica guardado aqui para sempre 💝"
                : "Cada dia com as três tarefas ganha o ✓, e cada semana, a sua figurinha."}
            </Text>
          </View>
        }
        ListFooterComponent={<View style={{ height: 60 }} />}
      />
      {aviso}
      <FolhaDoDiaDoPos D={diaAberto} blob={blob} aoFechar={() => setDiaAberto(null)} />
    </View>
  );
}

function FaixaDoTopoDoPos({
  chama,
  semana,
  figurinhas,
}: {
  chama: number;
  semana: number;
  figurinhas: number;
}) {
  const acesa = chama > 0;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-around",
        paddingHorizontal: espaco.xl,
        paddingVertical: espaco.md,
        borderBottomWidth: 1,
        borderBottomColor: cor.borda,
        backgroundColor: corCaminho.faixaFundo,
      }}
    >
      <View
        accessible
        accessibilityLabel={`${chama} ${chama === 1 ? "dia seguido" : "dias seguidos"}`}
        style={{ flexDirection: "row", alignItems: "center", gap: 6, minHeight: ALVO_MINIMO }}
      >
        <ChamaDaSequencia acesa={acesa} />
        <Text
          style={[
            estilo.numero,
            { color: acesa ? corCaminho.chamaAcesa : corCaminho.numeroApagado },
          ]}
        >
          {chama}
        </Text>
        <Text style={estilo.rotulo}>{chama === 1 ? "dia" : "dias"}</Text>
      </View>
      <View style={{ width: 1, height: 24, backgroundColor: corCaminho.divisor }} />
      <View
        accessible
        accessibilityLabel={`Semana ${semana} de vida`}
        style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
      >
        <Emoji tamanho={20}>👶</Emoji>
        <Text style={[estilo.numero, { color: "#0ea5e9" }]}>S{semana}</Text>
        <Text style={estilo.rotulo}>de vida</Text>
      </View>
      <View style={{ width: 1, height: 24, backgroundColor: corCaminho.divisor }} />
      <View
        accessible
        accessibilityLabel={`${figurinhas} figurinhas no álbum`}
        style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
      >
        <Emoji tamanho={20}>🏅</Emoji>
        <Text style={[estilo.numero, { color: corCaminho.trofeus }]}>{figurinhas}</Text>
      </View>
    </View>
  );
}

function FaixaDaFaseDoPos({
  fase,
  travada,
  altura,
}: {
  fase: Fase;
  travada: boolean;
  altura: number;
}) {
  const fundo = travada ? corCaminho.faixaTravada : corDaFaixaDoPos(fase.from);
  const labio = travada ? corCaminho.faixaTravadaLabio : coresDaSemanaDoPos(fase.from).lip;
  return (
    <View style={{ height: altura, paddingHorizontal: espaco.lg, paddingTop: 8 }}>
      <View>
        <View
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 4,
            bottom: -4,
            borderRadius: 24,
            backgroundColor: labio,
          }}
        />
        <View
          accessibilityRole="header"
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            borderRadius: 24,
            backgroundColor: fundo,
            paddingHorizontal: 20,
            paddingVertical: espaco.lg,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontFamily: fonte.forte,
                fontSize: 13,
                letterSpacing: 0.8,
                textTransform: "uppercase",
                color: corCaminho.textoClaro80,
              }}
            >
              Fase {fase.n} · Semanas {fase.from}–{fase.to} de vida
            </Text>
            <Text
              style={{ marginTop: 2, fontFamily: fonte.titulo, fontSize: 20, color: cor.branco }}
            >
              {fase.name}
            </Text>
          </View>
          {travada ? (
            <View style={{ opacity: 0.5 }}>
              <IconeCadeado cor={corCaminho.cadeado} />
            </View>
          ) : (
            <Emoji tamanho={36}>{fase.emoji}</Emoji>
          )}
        </View>
      </View>
    </View>
  );
}

function SemanaDoPos({
  bloco,
  hojeD,
  blob,
  comFigurinha,
  formou,
  aoAbrirDia,
  avisar,
}: {
  bloco: Extract<Bloco, { tipo: "semana" }>;
  hojeD: number;
  blob: Blob;
  comFigurinha: boolean;
  formou: boolean;
  aoAbrirDia: (D: number) => void;
  avisar: (texto: string) => void;
}) {
  const inicio = bloco.semana * 7;
  const porVir = inicio > hojeD;
  const atual = hojeD >= inicio && hojeD <= inicio + 6;
  const tom = porVir ? TOM_TRAVADO : coresDaSemanaDoPos(bloco.semana);
  const dias = bloco.dias.map((d) => {
    const e = estadoDoNoDoPos(blob, d.D, hojeD);
    return { feito: e.tipo !== "futuro" && e.fechado, hoje: d.D === hojeD, futuro: d.D > hojeD };
  });
  const nFeitos = dias.filter((d) => d.feito).length;
  return (
    <View style={{ height: bloco.altura }}>
      <View style={{ position: "absolute", left: 12, right: 12, top: 8 }}>
        <LinearGradient
          colors={["transparent", comBranco(tom, 0.55), "transparent"]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={{ height: 1 }}
        />
        <View style={{ marginTop: 6 }}>
          {atual ? null : (
            <View
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: 3,
                bottom: -3,
                borderRadius: 24,
                backgroundColor: comBranco(tom, 0.22, "lip"),
              }}
            />
          )}
          <LinearGradient
            colors={[comBranco(tom, 0.18), comBranco(tom, 0.07)]}
            start={{ x: 0, y: 0.3 }}
            end={{ x: 1, y: 0.7 }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: espaco.md,
              borderRadius: 24,
              paddingHorizontal: espaco.md,
              paddingVertical: 10,
              borderWidth: 1,
              borderColor: comBranco(tom, 0.3),
            }}
          >
            <View
              accessible
              accessibilityLabel={
                comFigurinha
                  ? `Figurinha da semana ${bloco.semana} de vida conquistada`
                  : `Figurinha da semana ${bloco.semana} de vida ainda não conquistada`
              }
            >
              <Moeda3D tamanho={44} tom={tom} labio={4} claro={0.45} escuro={0.8} meio={0.62}>
                <View style={{ opacity: comFigurinha ? 1 : 0.35 }}>
                  <Emoji tamanho={22}>{figurinhaDoPos(bloco.semana)}</Emoji>
                </View>
              </Moeda3D>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text
                  numberOfLines={1}
                  style={{ fontFamily: fonte.titulo, fontSize: 15, color: corCaminho.textoForte }}
                >
                  Semana {bloco.semana} de vida
                </Text>
                {atual && !formou ? (
                  <View
                    style={{
                      borderRadius: 999,
                      paddingHorizontal: 6,
                      paddingVertical: 1,
                      backgroundColor: tom.main,
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: fonte.titulo,
                        fontSize: 9,
                        letterSpacing: 0.6,
                        textTransform: "uppercase",
                        color: cor.branco,
                      }}
                    >
                      agora
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text
                numberOfLines={1}
                style={{ fontFamily: fonte.media, fontSize: 13, color: corCaminho.textoMedio }}
              >
                {nFeitos} de 7 dias
              </Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }} accessible={false}>
              {dias.map((d, i) => (
                <View key={i} style={{ width: 6, height: 6 }}>
                  <View
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: d.feito
                        ? tom.main
                        : d.futuro
                          ? corCaminho.pontoFuturo
                          : comBranco(tom, 0.26),
                    }}
                  />
                  {d.hoje ? (
                    <View
                      style={{
                        position: "absolute",
                        left: -3.5,
                        top: -3.5,
                        width: 13,
                        height: 13,
                        borderRadius: 6.5,
                        borderWidth: 2,
                        borderColor: tom.main,
                      }}
                    />
                  ) : null}
                </View>
              ))}
            </View>
          </LinearGradient>
        </View>
      </View>
      {bloco.dias.map((d) => (
        <NoDoDiaDoPos
          key={d.D}
          D={d.D}
          x={d.x}
          y={d.y}
          semana={bloco.semana}
          hojeD={hojeD}
          blob={blob}
          formou={formou}
          aoAbrir={() => aoAbrirDia(d.D)}
          avisar={avisar}
        />
      ))}
    </View>
  );
}

function NoDoDiaDoPos({
  D,
  x,
  y,
  semana,
  hojeD,
  blob,
  formou,
  aoAbrir,
  avisar,
}: {
  D: number;
  x: number;
  y: number;
  semana: number;
  hojeD: number;
  blob: Blob;
  formou: boolean;
  aoAbrir: () => void;
  avisar: (texto: string) => void;
}) {
  const e = estadoDoNoDoPos(blob, D, hojeD);
  const hoje = e.tipo === "hoje" && !formou;
  const fechado = e.tipo !== "futuro" && e.fechado;
  const tarefas = e.tipo === "futuro" ? 0 : e.tarefas;
  const cheia = coresDaSemanaDoPos(semana);
  const tom = fechado || hoje ? cheia : e.tipo === "futuro" ? tomFuturo(cheia) : tomPerdido(cheia);
  const tamanho = hoje ? 84 : 64;
  const emDias = D - hojeD;
  const rotulo =
    `Dia ${(D % 7) + 1} da semana ${semana} de vida` +
    (hoje
      ? `, hoje — ${tarefas} de ${TAREFAS_DO_POS.length} tarefas`
      : fechado
        ? ", completo"
        : e.tipo === "futuro"
          ? `, abre em ${emDias} ${emDias === 1 ? "dia" : "dias"}`
          : "");
  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        left: `${x}%`,
        top: y - tamanho / 2,
        width: 0,
        alignItems: "center",
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={rotulo}
        accessibilityState={{ disabled: e.tipo === "futuro", selected: hoje }}
        onPress={() => {
          if (e.tipo === "futuro") {
            avisar(
              `🔒 Esse dia abre ${emDias === 1 ? "amanhã" : `em ${emDias} dias`} — um passo de cada vez 💛`,
            );
            return;
          }
          toque();
          aoAbrir();
        }}
        style={{ width: tamanho + 24, alignItems: "center" }}
      >
        {hoje ? (
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: -44,
              width: 280,
              left: (tamanho + 24 - 280) / 2,
              zIndex: 2,
              alignItems: "center",
            }}
          >
            <Boiar>
              <View
                style={{
                  borderRadius: 20,
                  backgroundColor: cor.branco,
                  paddingHorizontal: espaco.md,
                  paddingVertical: 4,
                  shadowColor: corCaminho.sombra,
                  shadowOpacity: 0.12,
                  shadowRadius: 10,
                  shadowOffset: { width: 0, height: 3 },
                }}
              >
                <Text
                  numberOfLines={1}
                  style={{
                    fontFamily: fonte.titulo,
                    fontSize: 13,
                    letterSpacing: 0.4,
                    textTransform: "uppercase",
                    color: "#0ea5e9",
                  }}
                >
                  {fechado ? "Dia completo ✓" : "Desafio de hoje 🎁"}
                </Text>
              </View>
            </Boiar>
          </View>
        ) : null}
        <View style={{ width: tamanho, height: tamanho }}>
          {hoje ? (
            <AnelDeTarefas
              tamanho={tamanho}
              feitos={tarefas}
              total={TAREFAS_DO_POS.length}
              cor={cheia.main}
            />
          ) : null}
          <Pulsar ativo={hoje && !fechado}>
            <Moeda3D tamanho={tamanho} tom={tom}>
              {hoje && !fechado ? (
                <Emoji tamanho={30}>🎁</Emoji>
              ) : fechado ? (
                <Text
                  style={{ fontFamily: fonte.titulo, fontSize: hoje ? 30 : 24, color: cor.branco }}
                >
                  ✓
                </Text>
              ) : null}
            </Moeda3D>
          </Pulsar>
        </View>
      </Pressable>
    </View>
  );
}

/** Um dia que passou: o que foi feito e a orientação da semana. */
function FolhaDoDiaDoPos({
  D,
  blob,
  aoFechar,
}: {
  D: number | null;
  blob: Blob;
  aoFechar: () => void;
}) {
  if (D == null) return <Modal visible={false} transparent />;
  const semana = Math.max(1, Math.min(12, Math.floor(D / 7)));
  const flags = flagsDoDia(blob, D, true);
  const linhas: { chave: string; texto: string }[] = [
    { chave: "humor", texto: "Como você estava" },
    { chave: "desafio", texto: "O desafio do dia" },
    { chave: "leitura", texto: "A orientação da semana" },
  ];
  const fechado = diasDoPosFechados(blob).includes(D);
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
        <View
          style={{
            alignSelf: "center",
            width: 48,
            height: 5,
            borderRadius: 3,
            backgroundColor: "#e5dde2",
          }}
        />
        <Text
          style={{
            fontFamily: fonte.titulo,
            fontSize: 12,
            letterSpacing: 1.2,
            textTransform: "uppercase",
            color: "#0369a1",
          }}
        >
          Semana {semana} de vida · dia {(D % 7) + 1}
        </Text>
        <Text
          accessibilityRole="header"
          style={{ fontFamily: fonte.titulo, fontSize: 22, color: cor.texto }}
        >
          {fechado ? `Dia completo ${figurinhaDoPos(semana)}` : "Esse dia ficou pela metade"}
        </Text>
        <View style={{ gap: espaco.sm }}>
          {linhas.map((l) => (
            <Text
              key={l.chave}
              style={{
                fontFamily: fonte.media,
                fontSize: 15,
                color: flags[l.chave] || fechado ? "#047857" : cor.textoApagado,
              }}
            >
              {flags[l.chave] || fechado ? "✓" : "○"} {l.texto}
            </Text>
          ))}
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

const estilo = {
  numero: { fontFamily: fonte.titulo, fontSize: 18, lineHeight: 24 },
  rotulo: { fontFamily: fonte.normal, fontSize: 13, color: cor.textoApagado },
} as const;
