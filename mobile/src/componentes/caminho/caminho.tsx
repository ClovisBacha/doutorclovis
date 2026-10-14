import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Animated,
  Easing,
  FlatList,
  Pressable,
  Text,
  View,
  type LayoutChangeEvent,
} from "react-native";
import { useAviso } from "~/componentes/aviso";
import { toque } from "~/componentes/base";
import { corCaminho } from "~/componentes/caminho/cores";
import {
  AnelDeTarefas,
  Boiar,
  ChamaDaSequencia,
  Emoji,
  EstrelasDoDia,
  IconeAmigas,
  IconeCadeado,
  IconeLoja,
  Moeda3D,
  Pulsar,
  TrofeuParado,
} from "~/componentes/caminho/pecas";
import { useMovimentoReduzido } from "~/componentes/movimento";
import { parametroDaBancada } from "~/lib/bancada";
import {
  comBranco,
  coresDaSemana,
  corDaFaixa,
  HUMORES,
  labioDaFaixa,
  MARCOS,
  montarCaminho,
  tomFuturo,
  tomPerdido,
  TOM_TRAVADO,
  type Bloco,
  type Fase,
} from "~/lib/jornada/caminho";
import type { Blob } from "~/lib/jornada/momentos";
import { listaDeNumeros } from "~/lib/jornada/momentos";
import { estadoDoNo } from "~/lib/jornada/trilha";
import { ALVO_MINIMO, cor, espaco, fonte } from "~/tema";

/**
 * O CAMINHO — a trilha da gestação inteira numa tela só, o desenho aprovado
 * do site (src/components/gestacao-path.tsx) em peças nativas.
 *
 * De cima para baixo: a faixa do topo (chama, amigas, troféus, sementinhas),
 * o "Como você está hoje?", e a trilha — uma faixa colorida por fase, uma
 * barra por semana e um nó por dia, em zigue-zague. Hoje é o nó maior, com o
 * anel das cinco tarefas, o balão "Desafio de hoje" e as estrelas embaixo. A
 * tela abre centrada em hoje.
 *
 * A trilha é uma lista VIRTUALIZADA de blocos (uma fase, ou uma semana com os
 * sete dias): são ~300 nós, e montar todos de uma vez travaria a abertura.
 * Cada bloco tem altura fixa (`montarCaminho`), então o deslocamento de hoje
 * sai de uma soma.
 *
 * Os enfeites comprados no Cantinho (e o lápis de arrumá-los) chegam com a
 * tela de Recompensas: o app ainda não tem a loja.
 */

export type PropsDoCaminho = {
  hojeD: number;
  semanaAtual: number;
  fases: readonly Fase[];
  blob: Blob;
  saldo: number | null;
  trofeus: number | null;
  carregandoCarteira: boolean;
  chama: number;
  amigas: number | null;
  nomeDoBebe: string | null;
  /** O humor já foi marcado hoje (o cartão some). */
  humorFeito: boolean;
  aoMarcarHumor: (humor: string) => void;
  aoAbrirDia: (D: number) => void;
  aoAbrirSemana: (semana: number) => void;
  aoAbrirLoja: () => void;
  aoAbrirAmigas: () => void;
  aoAbrirFolha: (qual: "chama" | "sementes" | "trofeus") => void;
  aoContarNascimento: () => void;
  /** O que vem antes do humor (o presente que chegou, a carteira que falhou). */
  topo?: ReactNode;
};

export function Caminho(p: PropsDoCaminho) {
  const blocos = useMemo(() => montarCaminho(p.fases, p.hojeD), [p.fases, p.hojeD]);
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

  const feitos = useMemo(() => listaDeNumeros(p.blob["dc-path-done-days"]), [p.blob]);
  const figurinhas = useMemo(() => listaDeNumeros(p.blob["dc-path-stickers"]), [p.blob]);

  /* ── Abrir centrado em HOJE ── */
  const lista = useRef<FlatList<Bloco>>(null);
  const [alturaDoTopo, setAlturaDoTopo] = useState<number | null>(null);
  const [alturaDaLista, setAlturaDaLista] = useState<number | null>(null);
  /* Na bancada, `&topo=1` deixa a lista no alto (para fotografar o humor e a
     primeira fase); fora dela, sempre abre em hoje. */
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

  /* ── O aviso do dia que ainda não abriu ── */
  const { avisar, aviso } = useAviso({ direita: 72 });

  const renderItem = useCallback(
    ({ item }: { item: Bloco }) =>
      item.tipo === "fase" ? (
        <FaixaDaFase fase={item.fase} travada={item.travada} altura={item.altura} />
      ) : (
        <BlocoDaSemana
          bloco={item}
          hojeD={p.hojeD}
          blob={p.blob}
          feitos={feitos}
          figurinhas={figurinhas}
          aoAbrirDia={p.aoAbrirDia}
          aoAbrirSemana={p.aoAbrirSemana}
          avisar={avisar}
        />
      ),
    [p.hojeD, p.blob, feitos, figurinhas, p.aoAbrirDia, p.aoAbrirSemana, avisar],
  );

  return (
    <View style={{ flex: 1, backgroundColor: cor.fundo }}>
      <FaixaDoTopo
        chama={p.chama}
        amigas={p.amigas}
        trofeus={p.trofeus}
        saldo={p.saldo}
        carregando={p.carregandoCarteira}
        aoAbrirFolha={p.aoAbrirFolha}
        aoAbrirAmigas={p.aoAbrirAmigas}
      />
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
        initialScrollIndex={indiceDeHoje > 0 && !rolou.current ? indiceDeHoje : undefined}
        initialNumToRender={3}
        windowSize={7}
        extraData={alturaDoTopo}
        onLayout={(e: LayoutChangeEvent) => setAlturaDaLista(e.nativeEvent.layout.height)}
        onScrollToIndexFailed={() => {}}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View
            onLayout={(e) => setAlturaDoTopo(e.nativeEvent.layout.height)}
            style={{
              paddingHorizontal: 20,
              paddingTop: espaco.lg,
              gap: espaco.lg,
              paddingBottom: espaco.lg,
            }}
          >
            {p.topo}
            {p.semanaAtual >= 37 ? (
              <CartaoDoNascimento nome={p.nomeDoBebe} aoTocar={p.aoContarNascimento} />
            ) : null}
            {p.humorFeito ? null : <CartaoDoHumor aoMarcar={p.aoMarcarHumor} />}
          </View>
        }
        ListFooterComponent={<View style={{ height: 40 + 64 }} />}
      />
      <BotaoDaLoja saldo={p.saldo} aoTocar={p.aoAbrirLoja} />
      {aviso}
    </View>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   A faixa do topo
   ══════════════════════════════════════════════════════════════════════════ */

function FaixaDoTopo({
  chama,
  amigas,
  trofeus,
  saldo,
  carregando,
  aoAbrirFolha,
  aoAbrirAmigas,
}: {
  chama: number;
  amigas: number | null;
  trofeus: number | null;
  saldo: number | null;
  carregando: boolean;
  aoAbrirFolha: PropsDoCaminho["aoAbrirFolha"];
  aoAbrirAmigas: () => void;
}) {
  const acesa = chama > 0;
  /* Desconhecido é "—", nunca 0: zero afirma; o traço admite que não sabemos. */
  const fmt = (n: number | null) => (carregando ? "…" : n == null ? "—" : String(n));
  const amigasTexto = amigas == null ? "—" : amigas > 99 ? "99+" : String(amigas);
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
      <ItemDaFaixa
        rotulo={`${chama} ${chama === 1 ? "dia seguido" : "dias seguidos"} — ver como funciona`}
        aoTocar={() => aoAbrirFolha("chama")}
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
        <Text style={estilo.rotuloDaFaixa}>{chama === 1 ? "dia" : "dias"}</Text>
      </ItemDaFaixa>
      <Divisor />
      <ItemDaFaixa rotulo="Abrir as amigas" aoTocar={aoAbrirAmigas}>
        <IconeAmigas cor={corCaminho.amigas} />
        <Text
          style={[estilo.numero, { color: corCaminho.amigas, minWidth: 26, textAlign: "center" }]}
        >
          {amigasTexto}
        </Text>
      </ItemDaFaixa>
      <Divisor />
      <ItemDaFaixa
        rotulo={`${fmt(trofeus)} troféus — ver o que eles abrem`}
        aoTocar={() => aoAbrirFolha("trofeus")}
      >
        <TrofeuParado />
        <Text style={[estilo.numero, { color: corCaminho.trofeus }]}>{fmt(trofeus)}</Text>
      </ItemDaFaixa>
      {/* Sem carteira (falhou), o broto sai da faixa como no site — um
          número que não conhecemos não ocupa o lugar de um que conhecemos. */}
      {carregando || saldo != null ? (
        <>
          <Divisor />
          <ItemDaFaixa
            rotulo={`${fmt(saldo)} Sementinhas — como ganhar`}
            aoTocar={() => aoAbrirFolha("sementes")}
          >
            <Text style={{ fontSize: 20, lineHeight: 24 }}>🌱</Text>
            <Text style={[estilo.numero, { color: corCaminho.sementinhas }]}>{fmt(saldo)}</Text>
          </ItemDaFaixa>
        </>
      ) : null}
    </View>
  );
}

function ItemDaFaixa({
  children,
  rotulo,
  aoTocar,
}: {
  children: ReactNode;
  rotulo: string;
  aoTocar: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      onPress={() => {
        toque();
        aoTocar();
      }}
      hitSlop={8}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        minHeight: ALVO_MINIMO,
        paddingHorizontal: 4,
        transform: [{ scale: pressed ? 0.96 : 1 }],
      })}
    >
      {children}
    </Pressable>
  );
}

function Divisor() {
  return <View style={{ width: 1, height: 24, backgroundColor: corCaminho.divisor }} />;
}

/* ══════════════════════════════════════════════════════════════════════════
   O humor do dia e o nascimento
   ══════════════════════════════════════════════════════════════════════════ */

function CartaoDoHumor({ aoMarcar }: { aoMarcar: (humor: string) => void }) {
  return (
    <View
      style={{
        borderRadius: 24,
        backgroundColor: corCaminho.humorFundo,
        padding: espaco.lg,
        shadowColor: corCaminho.sombra,
        shadowOpacity: 0.05,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 2 },
      }}
    >
      <Text style={{ fontFamily: fonte.forte, fontSize: 14, color: cor.texto }}>
        Como você está hoje?
      </Text>
      <Text style={{ fontFamily: fonte.normal, fontSize: 13, color: cor.textoApagado }}>
        1ª tarefa do desafio de hoje 🔥
      </Text>
      <View style={{ flexDirection: "row", gap: 4, marginTop: 10 }}>
        {HUMORES.map((h) => (
          <Pressable
            key={h.label}
            accessibilityRole="button"
            accessibilityLabel={`Estou ${h.label.toLowerCase()}`}
            onPress={() => {
              toque();
              aoMarcar(h.label);
            }}
            style={({ pressed }) => ({
              flex: 1,
              alignItems: "center",
              gap: 2,
              paddingVertical: espaco.sm,
              borderRadius: 20,
              backgroundColor: corCaminho.humorOpcao,
              transform: [{ scale: pressed ? 0.96 : 1 }],
            })}
          >
            <Emoji tamanho={24}>{h.emoji}</Emoji>
            <Text style={{ fontFamily: fonte.normal, fontSize: 13, color: cor.textoApagado }}>
              {h.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/** A partir da semana 37: contar que o bebê nasceu (vira o pós-parto). */
function CartaoDoNascimento({ nome, aoTocar }: { nome: string | null; aoTocar: () => void }) {
  return (
    <View
      style={{
        borderRadius: 24,
        backgroundColor: corCaminho.humorFundo,
        padding: espaco.lg,
        shadowColor: corCaminho.sombra,
        shadowOpacity: 0.05,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 2 },
      }}
    >
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          toque();
          aoTocar();
        }}
        style={({ pressed }) => ({
          borderRadius: 20,
          overflow: "hidden",
          transform: [{ scale: pressed ? 0.97 : 1 }],
        })}
      >
        <LinearGradient
          colors={[corCaminho.faixaRosa, corCaminho.faixaVioleta]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={{ paddingVertical: espaco.md, alignItems: "center" }}
        >
          <Text style={{ fontFamily: fonte.titulo, fontSize: 14, color: cor.branco }}>
            🎉 {nome || "O bebê"} nasceu!
          </Text>
        </LinearGradient>
      </Pressable>
    </View>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   A faixa da fase
   ══════════════════════════════════════════════════════════════════════════ */

function FaixaDaFase({ fase, travada, altura }: { fase: Fase; travada: boolean; altura: number }) {
  const fundo = travada ? corCaminho.faixaTravada : corDaFaixa(fase.from);
  const labio = travada ? corCaminho.faixaTravadaLabio : labioDaFaixa(fase.from);
  return (
    <View style={{ height: altura, paddingHorizontal: espaco.lg, paddingTop: 8 }}>
      <View>
        {/* O lábio: a faixa "pousada" 4 px acima de uma sombra sólida. */}
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
            shadowColor: corCaminho.sombra,
            shadowOpacity: 0.12,
            shadowRadius: 14,
            shadowOffset: { width: 0, height: 10 },
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
              Fase {fase.n} · Semanas {fase.from}–{fase.to}
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

/* ══════════════════════════════════════════════════════════════════════════
   A semana: a barra e os sete dias
   ══════════════════════════════════════════════════════════════════════════ */

function BlocoDaSemana({
  bloco,
  hojeD,
  blob,
  feitos,
  figurinhas,
  aoAbrirDia,
  aoAbrirSemana,
  avisar,
}: {
  bloco: Extract<Bloco, { tipo: "semana" }>;
  hojeD: number;
  blob: Blob;
  feitos: number[];
  figurinhas: number[];
  aoAbrirDia: (D: number) => void;
  aoAbrirSemana: (semana: number) => void;
  avisar: (texto: string) => void;
}) {
  const inicio = bloco.semana * 7;
  const porVir = inicio > hojeD;
  return (
    <View style={{ height: bloco.altura }}>
      <View style={{ position: "absolute", left: 12, right: 12, top: 8 }}>
        <BarraDaSemana
          semana={bloco.semana}
          porVir={porVir}
          atual={hojeD >= inicio && hojeD <= inicio + 6}
          dias={bloco.dias.map((d) => ({
            feito: feitos.includes(d.D) || fechadoNoBlob(blob, d.D, hojeD),
            hoje: d.D === hojeD,
            futuro: d.D > hojeD,
          }))}
          figurinha={figurinhas.includes(bloco.semana)}
          aoAbrir={porVir ? undefined : () => aoAbrirSemana(bloco.semana)}
        />
      </View>
      {bloco.dias.map((d) => (
        <NoDoDia
          key={d.D}
          D={d.D}
          x={d.x}
          y={d.y}
          semana={bloco.semana}
          hojeD={hojeD}
          blob={blob}
          aoAbrir={() => aoAbrirDia(d.D)}
          avisar={avisar}
        />
      ))}
    </View>
  );
}

function fechadoNoBlob(blob: Blob, D: number, hojeD: number): boolean {
  const e = estadoDoNo(blob, D, hojeD);
  return e.tipo !== "futuro" && e.fechado;
}

function BarraDaSemana({
  semana,
  porVir,
  atual,
  dias,
  figurinha,
  aoAbrir,
}: {
  semana: number;
  porVir: boolean;
  atual: boolean;
  dias: { feito: boolean; hoje: boolean; futuro: boolean }[];
  figurinha: boolean;
  aoAbrir?: () => void;
}) {
  const tom = porVir ? TOM_TRAVADO : coresDaSemana(semana);
  const feitos = dias.filter((d) => d.feito).length;
  const sub = MARCOS[semana]?.label ?? `${feitos} de 7 dias`;
  const titulo = `Semana ${semana}`;
  return (
    <View>
      {/* O fio que atravessa a trilha: é ele que faz a barra ler como divisória. */}
      <LinearGradient
        colors={["transparent", comBranco(tom, 0.55), "transparent"]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={{ height: 1 }}
      />
      <View style={{ marginTop: 6 }}>
        {/* O lábio da barra. Na semana ATUAL o site não desenha sombra nenhuma
            (o valor dele lá é inválido e o navegador o descarta) — aqui também não. */}
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
          <View>
            <Pressable
              accessibilityRole={aoAbrir ? "button" : undefined}
              accessibilityLabel={aoAbrir ? `Álbum: ${titulo}` : undefined}
              disabled={!aoAbrir}
              onPress={() => {
                toque();
                aoAbrir?.();
              }}
              hitSlop={6}
              style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.96 : 1 }] })}
            >
              <Moeda3D tamanho={44} tom={tom} labio={4} claro={0.45} escuro={0.8} meio={0.62} />
            </Pressable>
            {figurinha ? (
              <View
                accessibilityLabel="figurinha coletada"
                pointerEvents="none"
                style={{
                  position: "absolute",
                  right: -4,
                  top: -4,
                  borderRadius: 999,
                  backgroundColor: cor.branco,
                  paddingHorizontal: 4,
                  shadowColor: corCaminho.sombra,
                  shadowOpacity: 0.1,
                  shadowRadius: 2,
                  shadowOffset: { width: 0, height: 1 },
                }}
              >
                <Text
                  style={{ fontFamily: fonte.titulo, fontSize: 9, color: corCaminho.sementinhas }}
                >
                  ✓
                </Text>
              </View>
            ) : null}
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text
                numberOfLines={1}
                style={{ fontFamily: fonte.titulo, fontSize: 15, color: corCaminho.textoForte }}
              >
                {titulo}
              </Text>
              {atual ? (
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
              {sub}
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
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   O nó do dia
   ══════════════════════════════════════════════════════════════════════════ */

function NoDoDia({
  D,
  x,
  y,
  semana,
  hojeD,
  blob,
  aoAbrir,
  avisar,
}: {
  D: number;
  x: number;
  y: number;
  semana: number;
  hojeD: number;
  blob: Blob;
  aoAbrir: () => void;
  avisar: (texto: string) => void;
}) {
  const e = estadoDoNo(blob, D, hojeD);
  const hoje = e.tipo === "hoje";
  const fechado = e.tipo !== "futuro" && e.fechado;
  const momentos = e.tipo === "futuro" ? 0 : e.momentos;
  const cheia = coresDaSemana(semana);
  const tom = fechado || hoje ? cheia : e.tipo === "passado" ? tomPerdido(cheia) : tomFuturo(cheia);
  const tamanho = hoje ? 84 : 64;
  const comEstrelas = hoje || fechado;
  /* O botão é centrado no ponto do caminho COM a fileira de estrelas, como
     no site — por isso o nó que tem estrelas sobe um pouco. */
  const alturaDoBotao = tamanho + (comEstrelas ? 6 + 13 : 0);
  const diaDaSemana = (D % 7) + 1;
  const emDias = D - hojeD;
  const rotulo =
    `Dia ${diaDaSemana} da semana ${semana}` +
    (hoje
      ? `, hoje — ${momentos} de 5 atividades`
      : fechado
        ? ", concluído"
        : e.tipo === "futuro"
          ? `, abre em ${emDias} ${emDias === 1 ? "dia" : "dias"}`
          : ", não concluído");
  return (
    <View
      style={{
        position: "absolute",
        left: `${x}%`,
        top: y - alturaDoBotao / 2,
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
              /* Largo e centrado: o balão nunca quebra em duas linhas
                 (o `whitespace-nowrap` do site). */
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
                    color: corCaminho.balaoTexto,
                  }}
                >
                  {fechado ? "Desafio completo ✓" : "Desafio de hoje 🎁"}
                </Text>
                <View
                  style={{
                    position: "absolute",
                    bottom: -4,
                    left: "50%",
                    marginLeft: -5,
                    width: 10,
                    height: 10,
                    backgroundColor: cor.branco,
                    transform: [{ rotate: "45deg" }],
                  }}
                />
              </View>
            </Boiar>
          </View>
        ) : null}
        <View style={{ width: tamanho, height: tamanho }}>
          {hoje ? (
            <AnelDeTarefas tamanho={tamanho} feitos={fechado ? 5 : momentos} cor={cheia.main} />
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
        {comEstrelas ? (
          <View style={{ marginTop: 6 }}>
            <EstrelasDoDia feitos={fechado ? 5 : momentos} tamanho={13} />
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   O botão da loja e o aviso
   ══════════════════════════════════════════════════════════════════════════ */

function BotaoDaLoja({ saldo, aoTocar }: { saldo: number | null; aoTocar: () => void }) {
  const reduzido = useMovimentoReduzido();
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduzido) return;
    const laco = Animated.loop(
      Animated.sequence([
        Animated.timing(v, {
          toValue: 1,
          duration: 1100,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(v, {
          toValue: 0,
          duration: 1100,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    laco.start();
    return () => laco.stop();
  }, [reduzido, v]);
  return (
    <View style={{ position: "absolute", right: espaco.lg, bottom: espaco.lg }}>
      {/* O brilho que respira (`dc-shop-glow`): um aro verde-água por trás. */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: -4,
          top: -4,
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: corCaminho.lojaSaldoAro,
          opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0, 0.55] }),
        }}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Abrir as recompensas"
        onPress={() => {
          toque();
          aoTocar();
        }}
        style={({ pressed }) => ({
          width: 48,
          height: 48,
          borderRadius: 24,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: corCaminho.lojaFundo,
          borderWidth: 1,
          borderColor: corCaminho.lojaAro,
          shadowColor: corCaminho.lojaBrilho,
          shadowOpacity: 0.32,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 6 },
          transform: [{ scale: pressed ? 0.96 : 1 }],
        })}
      >
        <IconeLoja cor={corCaminho.lojaIcone} />
        {saldo != null ? (
          <View
            style={{
              position: "absolute",
              right: -6,
              top: -6,
              borderRadius: 999,
              backgroundColor: cor.branco,
              paddingHorizontal: 6,
              paddingVertical: 2,
              borderWidth: 1,
              borderColor: corCaminho.lojaSaldoAro,
            }}
          >
            <Text
              style={{
                fontFamily: fonte.titulo,
                fontSize: 13,
                lineHeight: 15,
                color: corCaminho.lojaSaldo,
              }}
            >
              {saldo}
            </Text>
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}

const estilo = {
  numero: { fontFamily: fonte.titulo, fontSize: 18, lineHeight: 24 },
  rotuloDaFaixa: { fontFamily: fonte.normal, fontSize: 13, color: cor.textoApagado },
} as const;
