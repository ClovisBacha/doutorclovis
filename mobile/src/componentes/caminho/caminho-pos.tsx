import Baby from "lucide-react-native/icons/baby";
import Check from "lucide-react-native/icons/check";
import Circle from "lucide-react-native/icons/circle";
import Sticker from "lucide-react-native/icons/sticker";
import { memo, useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { FlatList, Text, View } from "react-native";
import { useAviso } from "~/componentes/aviso";
import { Sobrelinha, toque, useFolgaDaBarra } from "~/componentes/base";
import {
  BarraDaSemana,
  FaixaDaFase,
  NoDaTrilha,
  tonsDaSemana,
  TracadoDoBloco,
} from "~/componentes/caminho/blocos";
import { corCaminho } from "~/componentes/caminho/cores";
import { ChamaDaSequencia, Emoji } from "~/componentes/caminho/pecas";
import {
  DegradeDoTopo,
  PilulaDeHoje,
  useAbrirEmHoje,
  useEstavel,
} from "~/componentes/caminho/rolagem";
import { CEUS, useCeuDasAbas } from "~/componentes/ceu-vivo";
import { Folha } from "~/componentes/jornada/pecas";
import { useMovimentoReduzido } from "~/componentes/movimento";
import { Vidro } from "~/componentes/vidro";
import {
  ligacoesDaTrilha,
  montarCaminho,
  TOM_TRAVADO,
  type Bloco,
  type PontoDaTrilha,
} from "~/lib/jornada/caminho";
import { falaDoNoDeHoje } from "~/lib/bolha/falas-do-jogo";
import { flagsDoDia, type Blob } from "~/lib/jornada/momentos";
import {
  diasDoPosFechados,
  estadoDoNoDoPos,
  FASES_DO_POS,
  figurinhaDoPos,
  figurinhasDoPos,
  nestaSemanaDoPos,
  TAREFAS_DO_POS,
  type EstadoDoNoDoPos,
} from "~/lib/jornada/pos-parto";
import { ALVO_MINIMO, canto, cor, curva, escala, espaco, folha, fonte, luz, margem } from "~/tema";

/**
 * A TRILHA DO 4º TRIMESTRE — as 12 semanas de vida em três fases ("Chegando
 * em casa", "Criando ritmo", "Descobertas"), uma barra por semana com a
 * figurinha dela e um nó por dia, em zigue-zague: o `PosPartoJourney` do site
 * com as MESMAS peças da trilha da gestação (18/11/2026: o mesmo acabamento —
 * o placar e o cabeçalho flutuando, o traço que liga os nós, o nó de hoje com
 * o anel e o halo, as barras e as fases do tema, a folha de baixo do app).
 *
 * Mais simples que o Caminho da gestação, de propósito: sem enfeites nem loja
 * (o site também não os punha aqui). Hoje leva de volta à tela do bebê, onde
 * as três tarefas moram; um dia que passou abre o que foi feito e o texto da
 * semana; um dia que vem diz quando abre.
 */
export function TrilhaDoPosParto({
  hojeD,
  blob,
  chama,
  figurinhas,
  formou,
  aoAbrirHoje,
  cabecalho,
}: {
  /** O D de hoje na trilha (7–90). */
  hojeD: number;
  blob: Blob;
  chama: number;
  /** Todas as figurinhas: as da gestação e as do 4º trimestre. */
  figurinhas: number;
  formou: boolean;
  aoAbrirHoje: () => void;
  /** O cabeçalho da aba (o título e o perfil): flutua junto com o placar. */
  cabecalho?: ReactNode;
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
          const b = blocos[indiceDeHoje]!;
          return (
            deslocamentos[indiceDeHoje]! + (b.tipo === "semana" ? b.dias.find((d) => d.hoje)!.y : 0)
          );
        })()
      : 0;
  const proximos = useMemo(() => ligacoesDaTrilha(blocos), [blocos]);

  /* O blob lido uma vez por semana; a que não mudou guarda o mesmo objeto. */
  const antes = useRef<Map<number, ResumoDoPos>>(new Map());
  const resumos = useMemo(() => {
    const comFigurinha = new Set(figurinhasDoPos(blob));
    const fora = new Map<number, ResumoDoPos>();
    for (const b of blocos) {
      if (b.tipo !== "semana") continue;
      const estados = b.dias.map((d) => estadoDoNoDoPos(blob, d.D, hojeD));
      const novo = { estados, figurinha: comFigurinha.has(b.semana) };
      const velho = antes.current.get(b.semana);
      fora.set(b.semana, velho && mesmoResumoDoPos(velho, novo) ? velho : novo);
    }
    antes.current = fora;
    return fora;
  }, [blob, blocos, hojeD]);

  const reduzido = useMovimentoReduzido();
  const folga = useFolgaDaBarra();
  const {
    lista,
    caixa,
    alturaDaCamada,
    espacador,
    pronto,
    aoMedirCaixa,
    aoMedirCamada,
    contentOffset,
    indiceInicial,
    aVista,
    aoMedirALista,
    longe,
    aoParar,
    irParaHoje,
  } = useAbrirEmHoje<Bloco>({ yDeHoje, indiceDeHoje, folga, reduzido });
  const largura = caixa?.largura ?? 0;

  const { avisar, aviso } = useAviso();
  const [diaAberto, setDiaAberto] = useState<number | null>(null);
  const abrirHoje = useEstavel(aoAbrirHoje);
  const tocarNoDia = useCallback(
    (D: number) => {
      if (D > hojeD) {
        const emDias = D - hojeD;
        avisar(emDias === 1 ? "Esse dia abre amanhã." : `Esse dia abre em ${emDias} dias.`);
        return;
      }
      toque();
      if (D === hojeD) abrirHoje();
      else setDiaAberto(D);
    },
    [hojeD, avisar, abrirHoje],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: Bloco; index: number }) =>
      item.tipo === "fase" ? (
        <FaixaDaFase
          nome={item.fase.name}
          sub={`Fase ${item.fase.n} · semanas ${item.fase.from}–${item.fase.to} de vida`}
          emoji={item.fase.emoji}
          corDaFase={corDaFaseDoPos(item.fase.from)}
          travada={item.travada}
          altura={item.altura}
        />
      ) : (
        <SemanaDoPos
          bloco={item}
          resumo={resumos.get(item.semana)!}
          proximo={proximos[index] ?? null}
          largura={largura}
          hojeD={hojeD}
          formou={formou}
          tocarNoDia={tocarNoDia}
          parado={reduzido}
        />
      ),
    [resumos, proximos, largura, hojeD, formou, tocarNoDia, reduzido],
  );
  const getItemLayout = useCallback(
    (_: unknown, i: number) => ({
      length: blocos[i]!.altura,
      offset: espacador + deslocamentos[i]!,
      index: i,
    }),
    [blocos, espacador, deslocamentos],
  );
  const cabecalhoDaLista = useMemo(() => <View style={{ height: espacador }} />, [espacador]);
  const peDaLista = useMemo(() => <View style={{ height: folga + espaco.xxl }} />, [folga]);

  const dasAbas = useCeuDasAbas();
  const corDoTopo = dasAbas ? CEUS[dasAbas.fase].topo : luz.base;
  const semanaDeHoje = Math.max(1, Math.min(12, Math.floor(hojeD / 7)));

  return (
    <View style={{ flex: 1 }} onLayout={aoMedirCaixa}>
      {pronto ? (
        <FlatList
          ref={lista}
          style={{ opacity: aVista ? 1 : 0 }}
          data={blocos}
          keyExtractor={chaveDoBloco}
          renderItem={renderItem}
          getItemLayout={getItemLayout}
          contentOffset={contentOffset}
          initialScrollIndex={indiceInicial}
          initialNumToRender={3}
          maxToRenderPerBatch={2}
          updateCellsBatchingPeriod={50}
          windowSize={5}
          onLayout={aoMedirALista}
          onScrollEndDrag={aoParar}
          onMomentumScrollEnd={aoParar}
          onScrollToIndexFailed={nada}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={cabecalhoDaLista}
          ListFooterComponent={peDaLista}
        />
      ) : null}
      {alturaDaCamada != null ? (
        <DegradeDoTopo cor={corDoTopo} altura={alturaDaCamada + 24} />
      ) : null}
      <View
        pointerEvents="box-none"
        onLayout={aoMedirCamada}
        style={{ position: "absolute", top: 0, left: 0, right: 0, paddingTop: 4 }}
      >
        {cabecalho ? (
          <View style={{ paddingHorizontal: margem.tela, paddingBottom: espaco.xs }}>
            {cabecalho}
          </View>
        ) : null}
        <View style={{ paddingHorizontal: margem.tela - 4 }}>
          <FaixaDoTopoDoPos
            chama={chama}
            semana={semanaDeHoje}
            figurinhas={figurinhas}
            parado={reduzido}
          />
        </View>
      </View>
      {formou && alturaDaCamada != null ? (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: alturaDaCamada + espaco.xs,
            left: margem.tela - 4,
            right: margem.tela - 4,
          }}
        >
          <Vidro
            tinta="rgba(255,255,255,0.72)"
            forma={canto.cartao}
            estilo={{ paddingHorizontal: espaco.lg, paddingVertical: espaco.md }}
          >
            <Text style={{ ...fonte.media, ...escala.legenda, color: cor.texto }}>
              As 12 semanas estão completas. A trilha fica guardada aqui.
            </Text>
          </Vidro>
        </View>
      ) : null}
      <PilulaDeHoje
        visivel={longe.visivel && aVista && !formou}
        acima={longe.acima}
        baixo={folga + espaco.md}
        aoTocar={irParaHoje}
      />
      {aviso}
      <FolhaDoDiaDoPos D={diaAberto} blob={blob} aoFechar={() => setDiaAberto(null)} />
    </View>
  );
}

type ResumoDoPos = { estados: readonly EstadoDoNoDoPos[]; figurinha: boolean };

function mesmoResumoDoPos(a: ResumoDoPos, b: ResumoDoPos): boolean {
  return (
    a.figurinha === b.figurinha &&
    a.estados.every((e, i) => {
      const o = b.estados[i]!;
      if (e.tipo !== o.tipo) return false;
      if (e.tipo === "futuro" || o.tipo === "futuro") return true;
      return e.tarefas === o.tarefas && e.fechado === o.fechado;
    })
  );
}

const chaveDoBloco = (b: Bloco) => (b.tipo === "fase" ? `f${b.fase.n}` : `s${b.semana}`);
const nada = () => {};

/** A cor da ficha de cada fase do 4º trimestre, no tema: céu, violeta e verde. */
function corDaFaseDoPos(semanaInicial: number): string {
  if (semanaInicial <= 4) return cor.chutes;
  if (semanaInicial <= 8) return cor.jogo;
  return cor.ok;
}

/* ══════════════════════════════════════════════════════════════════════════
   O placar do 4º trimestre
   ══════════════════════════════════════════════════════════════════════════ */

const FaixaDoTopoDoPos = memo(function FaixaDoTopoDoPos({
  chama,
  semana,
  figurinhas,
  parado,
}: {
  chama: number;
  semana: number;
  figurinhas: number;
  parado: boolean;
}) {
  const acesa = chama > 0;
  /* Uma cápsula de vidro, como o placar da trilha da gestação. */
  return (
    <Vidro
      tinta="rgba(255,255,255,0.72)"
      estilo={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-around",
        paddingHorizontal: espaco.sm,
        paddingVertical: 4,
      }}
    >
      <View
        accessible
        accessibilityLabel={`${chama} ${chama === 1 ? "dia seguido" : "dias seguidos"}`}
        style={estilo.item}
      >
        <ChamaDaSequencia acesa={acesa} parado={parado} />
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
      <Divisor />
      <View accessible accessibilityLabel={`Semana ${semana} de vida`} style={estilo.item}>
        <Baby size={21} color={cor.chutes} strokeWidth={2.2} />
        <Text style={[estilo.numero, { color: cor.chutes }]}>{semana}ª</Text>
        <Text style={estilo.rotulo}>semana</Text>
      </View>
      <Divisor />
      <View accessible accessibilityLabel={`${figurinhas} figurinhas no álbum`} style={estilo.item}>
        <Sticker size={21} color={corCaminho.trofeus} strokeWidth={2.2} />
        <Text style={[estilo.numero, { color: corCaminho.trofeus }]}>{figurinhas}</Text>
      </View>
    </Vidro>
  );
});

function Divisor() {
  return <View style={{ width: 1, height: 24, backgroundColor: corCaminho.divisor }} />;
}

/* ══════════════════════════════════════════════════════════════════════════
   Uma semana de vida: o traço, a barra e os sete dias
   ══════════════════════════════════════════════════════════════════════════ */

const SemanaDoPos = memo(function SemanaDoPos({
  bloco,
  resumo,
  proximo,
  largura,
  hojeD,
  formou,
  tocarNoDia,
  parado,
}: {
  bloco: Extract<Bloco, { tipo: "semana" }>;
  resumo: ResumoDoPos;
  proximo: PontoDaTrilha | null;
  largura: number;
  hojeD: number;
  formou: boolean;
  tocarNoDia: (D: number) => void;
  parado: boolean;
}) {
  const inicio = bloco.semana * 7;
  const porVir = inicio > hojeD;
  const atual = hojeD >= inicio && hojeD <= inicio + 6;
  const tons = tonsDaSemana(bloco.semana, true);
  const dias = resumo.estados.map((e, i) => ({
    feito: e.tipo !== "futuro" && e.fechado,
    hoje: bloco.dias[i]!.D === hojeD,
    futuro: e.tipo === "futuro",
  }));
  const nFeitos = dias.filter((d) => d.feito).length;
  const titulo = `Semana ${bloco.semana} de vida`;
  return (
    <View style={{ height: bloco.altura }}>
      <TracadoDoBloco
        nos={bloco.dias}
        proximo={proximo}
        hojeD={hojeD}
        largura={largura}
        altura={bloco.altura}
      />
      <View
        pointerEvents="box-none"
        style={{ position: "absolute", left: margem.tela, right: margem.tela, top: 8 }}
      >
        <BarraDaSemana
          titulo={titulo}
          sub={`${nFeitos} de 7 dias`}
          estado={atual ? "atual" : porVir ? "futura" : "passada"}
          agora={atual && !formou}
          tom={porVir ? TOM_TRAVADO : tons.cheia}
          dias={dias}
          figurinha={resumo.figurinha}
          rotulo={`${titulo}. ${nFeitos} de 7 dias. ${
            resumo.figurinha ? "Figurinha conquistada" : "Figurinha ainda não conquistada"
          }`}
          moeda={
            <View style={{ opacity: resumo.figurinha ? 1 : 0.35 }}>
              <Emoji tamanho={22}>{figurinhaDoPos(bloco.semana)}</Emoji>
            </View>
          }
        />
      </View>
      {bloco.dias.map((d, i) => {
        const e = resumo.estados[i]!;
        const hoje = e.tipo === "hoje" && !formou;
        const fechado = e.tipo !== "futuro" && e.fechado;
        const tarefas = e.tipo === "futuro" ? 0 : e.tarefas;
        const tom = fechado || hoje ? tons.cheia : e.tipo === "futuro" ? tons.futuro : tons.perdido;
        /* A Bolha fala em cima do nó de hoje também no 4º trimestre. */
        const fala = hoje
          ? falaDoNoDeHoje({ feitos: tarefas, total: TAREFAS_DO_POS.length, fechado })
          : null;
        return (
          <NoDaTrilha
            key={d.D}
            D={d.D}
            x={d.x}
            y={d.y}
            tamanho={hoje ? 84 : 64}
            tom={tom}
            hoje={hoje}
            fechado={fechado}
            futuro={e.tipo === "futuro"}
            anel={hoje ? ANEIS[tarefas] : null}
            balao={fala?.texto ?? null}
            poseDoBalao={fala?.pose}
            rotulo={
              `Dia ${(d.D % 7) + 1} da semana ${bloco.semana} de vida` +
              (hoje
                ? `, hoje: ${tarefas} de ${TAREFAS_DO_POS.length} tarefas`
                : fechado
                  ? ", dia completo"
                  : e.tipo === "futuro"
                    ? ", ainda não abriu"
                    : "")
            }
            aoTocar={tocarNoDia}
            parado={parado}
          />
        );
      })}
    </View>
  );
});

/* O anel de hoje com a mesma identidade para a mesma conta (o nó é `memo`). */
const ANEIS = [0, 1, 2, 3].map((feitos) => ({ feitos, total: TAREFAS_DO_POS.length }));

/* ══════════════════════════════════════════════════════════════════════════
   Um dia que passou
   ══════════════════════════════════════════════════════════════════════════ */

/** Um dia que passou: o que foi feito e o texto da semana, na folha de baixo do app. */
function FolhaDoDiaDoPos({
  D,
  blob,
  aoFechar,
}: {
  D: number | null;
  blob: Blob;
  aoFechar: () => void;
}) {
  /* A folha guarda o último dia aberto enquanto desce, para não se esvaziar no meio. */
  const [ultimo, setUltimo] = useState<number | null>(D);
  if (D != null && D !== ultimo) setUltimo(D);
  const dia = D ?? ultimo;
  const semana = dia == null ? 1 : Math.max(1, Math.min(12, Math.floor(dia / 7)));
  const flags = dia == null ? {} : flagsDoDia(blob, dia, true);
  const fechado = dia != null && diasDoPosFechados(blob).includes(dia);
  const linhas: { chave: string; texto: string }[] = [
    { chave: "humor", texto: "Como você estava" },
    { chave: "desafio", texto: "O desafio do dia" },
    { chave: "leitura", texto: "A leitura da semana" },
  ];
  return (
    <Folha
      aberta={D != null}
      aoFechar={aoFechar}
      titulo={fechado ? "Dia completo" : "Esse dia ficou pela metade"}
    >
      {dia != null ? (
        <>
          <View style={{ flexDirection: "row", alignItems: "center", gap: espaco.sm }}>
            <Emoji tamanho={22}>{figurinhaDoPos(semana)}</Emoji>
            <Sobrelinha tinta={cor.chutes}>
              Semana {semana} de vida · dia {(dia % 7) + 1}
            </Sobrelinha>
          </View>
          <View
            style={{
              borderRadius: canto.dentro,
              ...curva,
              backgroundColor: folha.superficie,
              paddingVertical: 4,
            }}
          >
            {linhas.map((l, i) => {
              const feito = !!flags[l.chave] || fechado;
              return (
                <View
                  key={l.chave}
                  accessible
                  accessibilityLabel={`${l.texto}: ${feito ? "feito" : "não feito"}`}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: espaco.md,
                    minHeight: ALVO_MINIMO,
                    paddingHorizontal: espaco.lg,
                    borderTopWidth: i === 0 ? 0 : 1,
                    borderTopColor: folha.superficieBorda,
                  }}
                >
                  {feito ? (
                    <View
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 11,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: cor.ok,
                      }}
                    >
                      <Check size={13} color={cor.branco} strokeWidth={3.4} />
                    </View>
                  ) : (
                    <Circle size={22} color={folha.alca} strokeWidth={2} />
                  )}
                  <Text
                    style={{
                      ...fonte.media,
                      ...escala.chamada,
                      color: feito ? folha.texto : folha.apagado,
                    }}
                  >
                    {l.texto}
                  </Text>
                </View>
              );
            })}
          </View>
          <View
            style={{
              borderRadius: canto.dentro,
              ...curva,
              backgroundColor: cor.chutesFundo,
              padding: espaco.lg,
              gap: 4,
            }}
          >
            <Sobrelinha tinta={cor.chutes}>Nessa semana</Sobrelinha>
            <Text style={{ ...fonte.normal, ...escala.chamada, color: folha.texto }}>
              {nestaSemanaDoPos(semana)}
            </Text>
          </View>
        </>
      ) : null}
    </Folha>
  );
}

const estilo = {
  item: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 5,
    minHeight: ALVO_MINIMO,
  },
  numero: { ...fonte.titulo, ...escala.manchete },
  rotulo: { ...fonte.normal, ...escala.nota, color: cor.textoApagado },
};
