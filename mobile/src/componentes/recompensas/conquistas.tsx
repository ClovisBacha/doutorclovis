import { Sparkles } from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Modal, Pressable, Text, View, useWindowDimensions } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { RARIDADES, type ConquistaDef } from "@/lib/conquistas";
import {
  Botao,
  Cartao,
  NaoConsegueLer,
  Sobrelinha,
  TituloDaSecao,
  Tocavel,
} from "~/componentes/base";
import { Brilho } from "~/componentes/jornada/atividade";
import { CompartilharConquista } from "~/componentes/jornada/cartao-de-conquista";
import type { LeituraDasConquistas } from "~/componentes/jornada/economia";
import { Confete, Folha } from "~/componentes/jornada/pecas";
import { useMovimentoReduzido } from "~/componentes/movimento";
import { MarcosDaRede } from "~/componentes/recompensas/marcos-da-rede";
import {
  Broto,
  Contagem,
  Esqueleto,
  Medalha,
  PilulaDeAcao,
  RotuloDaRaridade,
  SecaoComArte,
  SeloDeContagem,
  SilencioDoCuidado,
  vibrar,
} from "~/componentes/recompensas/pecas";
import { gravarJson, lerJson } from "~/lib/armazem";
import { comAlfa } from "~/lib/cor";
import { cartaoDaConquista } from "~/lib/jornada/cartoes";
import {
  conquistaNoApp,
  descricaoNoApp,
  montarGrade,
  resumo,
  secoes,
  type Cartao as CartaoDaGrade,
} from "~/lib/jornada/conquistas";
import { dataCompleta } from "~/lib/jornada/dia";
import { useSessao } from "~/lib/sessao";
import { canto, cor, curva, escala, espaco, fonte, fonteDoNumero, margem, ouro } from "~/tema";

/**
 * A ABA CONQUISTAS — a sala de troféus (18/11/2026, a vistoria): medalhas
 * redondas em três colunas, como os Prêmios do Fitness, e o detalhe ao tocar.
 * Antes eram 29 cartões de 210 pt em duas colunas, a maioria cinza, numa
 * rolagem de 3.000 pt: uma tabela, e não uma coleção.
 *
 * De cima para baixo: o resumo (o anel de verdade, que anda com o número), a
 * seção "Para resgatar" (o mesmo N do selo da aba, com as que pedem o toque
 * dela — antes espalhadas na ordem do catálogo), e as seções Bebê, Bem-estar,
 * Diário, Educação e Família. Por fim, os marcos da rede.
 *
 * A conquista desbloqueada e ainda não resgatada tem um anel verde PARADO
 * (antes piscava a opacidade num laço, e parecia desabilitada) e entra uma
 * vez com mola. A festa do resgate acontece DENTRO da janela, na frente dela.
 *
 * Do app ficam: a leitura que falhou diz que falhou (o site mostrava "0 de 39"),
 * e o resgate tem trava POR conquista, como o site, e nunca uma trava geral.
 */

export function AbaDasConquistas({
  leitura,
  cuidado,
  ativa,
  resgatar,
  recarregar,
  aoFesta,
  avisar,
}: {
  leitura: LeituraDasConquistas | null | "carregando";
  cuidado: boolean;
  /** A aba está à vista: a comemoração do que é novo espera ela chegar aqui. */
  ativa: boolean;
  resgatar: (key: string) => Promise<{ granted: number; repetido: boolean } | null>;
  recarregar: () => void;
  /** O confete da tela (fora da rolagem), para a comemoração ao abrir. */
  aoFesta: () => void;
  avisar: (texto: string) => void;
}) {
  const { sessao } = useSessao();
  const uid = sessao?.user.id ?? null;
  const { width: largura } = useWindowDimensions();
  const grade = useMemo(
    () =>
      leitura && leitura !== "carregando"
        ? montarGrade(leitura.unlocked, leitura.resgatadas)
        : null,
    [leitura],
  );
  const [resgatando, setResgatando] = useState<Set<string>>(new Set());
  const [festa, setFesta] = useState<{ def: ConquistaDef; ganhou: number } | null>(null);
  const [aberta, setAberta] = useState<CartaoDaGrade | null>(null);
  const [novas, setNovas] = useState<string[]>([]);

  /* ── A comemoração ao chegar: o que desbloqueou desde a última visita ── */
  const comemorou = useRef(false);
  useEffect(() => {
    if (!ativa || comemorou.current || !uid || !leitura || leitura === "carregando") return;
    comemorou.current = true;
    const chave = `dc-conquistas-comemoradas:${uid}`;
    void (async () => {
      const vistas = await lerJson<string[]>(chave, []);
      const todas = leitura.unlocked.map((u) => u.achievement_key);
      const agora = leitura.careMode ? [] : todas.filter((k) => !vistas.includes(k));
      if (agora.length) {
        setNovas(agora);
        aoFesta();
        vibrar("sucesso");
      }
      void gravarJson(chave, Array.from(new Set([...vistas, ...todas])));
    })();
  }, [ativa, leitura, uid, aoFesta]);

  if (cuidado || (leitura && leitura !== "carregando" && leitura.careMode)) {
    return <SilencioDoCuidado />;
  }
  if (leitura === "carregando") return <Esqueleto rotulo="Carregando as conquistas" />;
  if (!leitura || !grade) {
    return (
      <NaoConsegueLer sossego="As suas conquistas continuam guardadas." aoTentar={recarregar} />
    );
  }

  const r = resumo(grade);
  const semSaberPagas = leitura.resgatadas === null;
  const aResgatar = semSaberPagas ? [] : grade.filter((c) => c.estado === "resgatar");
  const chavesAResgatar = new Set(aResgatar.map((c) => c.def.key));
  /* As que esperam o toque ficam SÓ em "Para resgatar"; resgatadas, voltam
     para a seção delas. */
  const nasSecoes = secoes(grade.filter((c) => !chavesAResgatar.has(c.def.key)));
  const largDaCelula = Math.floor((largura - margem.tela * 2 - espaco.md * 2) / 3);

  async function aoResgatar(c: CartaoDaGrade) {
    const key = c.def.key;
    if (resgatando.has(key)) return;
    setResgatando((s) => new Set(s).add(key));
    const res = await resgatar(key);
    setResgatando((s) => {
      const n = new Set(s);
      n.delete(key);
      return n;
    });
    if (!res) {
      avisar("Não deu para resgatar agora. Tente de novo.");
      vibrar("erro");
      return;
    }
    if (res.granted > 0) {
      vibrar("sucesso");
      setFesta({ def: conquistaNoApp(key) ?? c.def, ganhou: res.granted });
    } else if (res.repetido) {
      avisar("Essas sementinhas já estão com você.");
    }
  }

  return (
    <View style={{ gap: espaco.xxl }}>
      <Resumo
        feitas={r.feitas}
        total={r.total}
        pct={r.pct}
        ativa={ativa}
        notaDoNascimento={
          r.mostrarNotaDoNascimento
            ? `${r.posPartoTotal} delas só chegam depois do nascimento. Na gestação, dá para chegar a ${r.total - r.posPartoTotal}.`
            : null
        }
      />

      {aResgatar.length > 0 ? (
        <View style={{ gap: espaco.md }}>
          <TituloDaSecao direita={<SeloDeContagem n={aResgatar.length} />}>
            Para resgatar
          </TituloDaSecao>
          {novas.length > 0 ? <LinhaDasNovas n={novas.length} /> : null}
          <Cartao estilo={{ padding: 0, gap: 0 }}>
            {aResgatar.map((c, i) => (
              <LinhaParaResgatar
                key={c.def.key}
                cartao={c}
                primeira={i === 0}
                emVoo={resgatando.has(c.def.key)}
                aoResgatar={() => void aoResgatar(c)}
                aoAbrir={() => setAberta(c)}
              />
            ))}
          </Cartao>
        </View>
      ) : novas.length > 0 ? (
        <LinhaDasNovas n={novas.length} />
      ) : null}

      {nasSecoes.map((s) => (
        <View key={s.chave} style={{ gap: espaco.lg }}>
          <SecaoComArte
            arte={s.emoji}
            titulo={s.rotulo}
            direita={
              <Contagem
                texto={`${s.cartoes.filter((c) => c.estado !== "bloqueada").length} de ${s.cartoes.length}`}
              />
            }
          />
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              columnGap: espaco.md,
              rowGap: espaco.xl,
            }}
          >
            {s.cartoes.map((c) => (
              <MedalhaNaGrade
                key={c.def.key}
                cartao={c}
                largura={largDaCelula}
                nova={novas.includes(c.def.key)}
                aoAbrir={() => setAberta(c)}
              />
            ))}
          </View>
        </View>
      ))}

      {/* Os atos sociais: marcos do app, sem sementinhas (fase 3). */}
      <MarcosDaRede />

      <FolhaDaMedalha
        cartao={aberta}
        podeResgatar={!!aberta && chavesAResgatar.has(aberta.def.key)}
        emVoo={!!aberta && resgatando.has(aberta.def.key)}
        aoResgatar={(c) => {
          setAberta(null);
          void aoResgatar(c);
        }}
        aoFechar={() => setAberta(null)}
      />

      <FestaDoResgate festa={festa} aoFechar={() => setFesta(null)} />
    </View>
  );
}

/* ── O resumo: o anel de verdade ───────────────────────────────────────── */

const AnelAnimado = Animated.createAnimatedComponent(Circle);
const RAIO_DO_ANEL = 28;
const TRACO_DO_ANEL = 6;
const VOLTA = 2 * Math.PI * RAIO_DO_ANEL;

function Resumo({
  feitas,
  total,
  pct,
  ativa,
  notaDoNascimento,
}: {
  feitas: number;
  total: number;
  pct: number;
  ativa: boolean;
  notaDoNascimento: string | null;
}) {
  const reduzido = useMovimentoReduzido();
  const v = useRef(new Animated.Value(0)).current;
  /* Anda UMA vez, quando a aba aparece (e de novo só se o número mudar). */
  useEffect(() => {
    if (!ativa) return;
    if (reduzido) {
      v.setValue(pct / 100);
      return;
    }
    const a = Animated.timing(v, {
      toValue: pct / 100,
      duration: 900,
      delay: 150,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    a.start();
    return () => a.stop();
  }, [ativa, pct, reduzido, v]);
  const lado = (RAIO_DO_ANEL + TRACO_DO_ANEL / 2) * 2;
  return (
    <Cartao estilo={{ flexDirection: "row", alignItems: "center", gap: espaco.lg }}>
      <View
        accessible
        accessibilityLabel={`${pct}% das conquistas`}
        style={{ width: lado, height: lado, alignItems: "center", justifyContent: "center" }}
      >
        <Svg
          width={lado}
          height={lado}
          style={{ position: "absolute", transform: [{ rotate: "-90deg" }] }}
        >
          <Circle
            cx={lado / 2}
            cy={lado / 2}
            r={RAIO_DO_ANEL}
            stroke={cor.trilho}
            strokeWidth={TRACO_DO_ANEL}
            fill="none"
          />
          <AnelAnimado
            cx={lado / 2}
            cy={lado / 2}
            r={RAIO_DO_ANEL}
            stroke={cor.primaria}
            strokeWidth={TRACO_DO_ANEL}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${VOLTA} ${VOLTA}`}
            strokeDashoffset={v.interpolate({ inputRange: [0, 1], outputRange: [VOLTA, 0] })}
          />
        </Svg>
        <Text style={{ ...fonte.titulo, ...escala.nota, color: cor.texto }}>{pct}%</Text>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text
          style={{
            ...fonteDoNumero,
            ...escala.titulo1,
            color: cor.texto,
            fontVariant: ["tabular-nums"],
          }}
        >
          {feitas} de {total}
        </Text>
        <Text style={{ ...fonte.normal, ...escala.legenda, color: cor.textoApagado }}>
          conquistas desbloqueadas
        </Text>
        {notaDoNascimento ? (
          <Text
            style={{
              marginTop: espaco.xs,
              ...fonte.normal,
              ...escala.nota,
              color: cor.textoApagado,
            }}
          >
            {notaDoNascimento}
          </Text>
        ) : null}
      </View>
    </Cartao>
  );
}

/** "2 conquistas novas desde a sua última visita": uma linha calma, sem caixa. */
function LinhaDasNovas({ n }: { n: number }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: espaco.sm }}>
      <Sparkles size={16} color={cor.primaria} strokeWidth={2.2} />
      <Text style={{ flex: 1, ...fonte.media, ...escala.legenda, color: cor.textoCorpo }}>
        {n === 1
          ? "Uma conquista nova desde a sua última visita."
          : `${n} conquistas novas desde a sua última visita.`}
      </Text>
    </View>
  );
}

/* ── Para resgatar ─────────────────────────────────────────────────────── */

/**
 * Uma conquista que espera o toque: a medalha com o anel verde PARADO e um
 * halo, uma única mola de entrada (0,96 → 1) e a pílula "Resgatar +15" numa
 * linha só. Sem laço: o que pisca a cada seis segundos parece desabilitado
 * e custa quadro.
 */
function LinhaParaResgatar({
  cartao: c,
  primeira,
  emVoo,
  aoResgatar,
  aoAbrir,
}: {
  cartao: CartaoDaGrade;
  primeira: boolean;
  emVoo: boolean;
  aoResgatar: () => void;
  aoAbrir: () => void;
}) {
  const rar = RARIDADES[c.def.raridade];
  const reduzido = useMovimentoReduzido();
  const entrada = useRef(new Animated.Value(reduzido ? 1 : 0.96)).current;
  useEffect(() => {
    if (reduzido) {
      entrada.setValue(1);
      return;
    }
    const a = Animated.spring(entrada, {
      toValue: 1,
      useNativeDriver: true,
      speed: 12,
      bounciness: 10,
    });
    a.start();
    return () => a.stop();
  }, [entrada, reduzido]);
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: espaco.md,
        paddingLeft: espaco.lg,
        paddingRight: espaco.md,
        paddingVertical: espaco.md,
        borderTopWidth: primeira ? 0 : 1,
        borderTopColor: cor.divisor,
      }}
    >
      <Tocavel aoTocar={aoAbrir} rotulo={`${c.def.title}. Ver a conquista`} estilo={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: espaco.md }}>
          <Animated.View
            style={{
              padding: 2,
              borderRadius: 999,
              borderWidth: 2,
              borderColor: cor.sementinha,
              boxShadow: `0px 0px 0px 4px ${comAlfa(cor.sementinha, 0.15)}`,
              transform: [{ scale: entrada }],
            }}
          >
            <Medalha emoji={c.def.emoji} raridade={c.def.raridade} tamanho={52} anel={2} />
          </Animated.View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text numberOfLines={2} style={{ ...fonte.forte, ...escala.legenda, color: cor.texto }}>
              {c.def.title}
            </Text>
            <Text style={{ ...fonte.normal, ...escala.nota, color: cor.textoApagado }}>
              {rar.label}
            </Text>
          </View>
        </View>
      </Tocavel>
      <PilulaDeAcao
        tom="cheia"
        texto={`Resgatar +${rar.sementinhas}`}
        icone={<Broto tamanho={14} tinta={cor.branco} />}
        acessivel={`Resgatar ${rar.sementinhas} sementinhas de ${c.def.title}`}
        carregando={emVoo}
        aoTocar={aoResgatar}
      />
    </View>
  );
}

/* ── A grade de medalhas ───────────────────────────────────────────────── */

function MedalhaNaGrade({
  cartao: c,
  largura,
  nova,
  aoAbrir,
}: {
  cartao: CartaoDaGrade;
  largura: number;
  nova: boolean;
  aoAbrir: () => void;
}) {
  const bloqueada = c.estado === "bloqueada";
  return (
    <Tocavel
      aoTocar={aoAbrir}
      rotulo={`${c.def.title}. ${bloqueada ? "Bloqueada" : "Desbloqueada"}${nova ? ", nova" : ""}. ${RARIDADES[c.def.raridade].label}`}
      estilo={{ width: largura }}
      profundidade={0.95}
    >
      <View style={{ alignItems: "center", gap: espaco.sm }}>
        <Medalha emoji={c.def.emoji} raridade={c.def.raridade} bloqueada={bloqueada} />
        <Text
          numberOfLines={2}
          style={{
            ...fonte.forte,
            ...escala.nota,
            textAlign: "center",
            color: bloqueada ? cor.textoApagado : cor.texto,
          }}
        >
          {c.def.title}
        </Text>
        {nova ? (
          <View
            style={{
              marginTop: -4,
              borderRadius: canto.pilula,
              ...curva,
              backgroundColor: cor.destaque,
              paddingHorizontal: espaco.sm,
              paddingVertical: 1,
            }}
          >
            <Text style={{ ...fonte.forte, ...escala.nota, color: cor.textoDestaque }}>Nova</Text>
          </View>
        ) : null}
      </View>
    </Tocavel>
  );
}

/* ── A folha da medalha ────────────────────────────────────────────────── */

/**
 * O detalhe ao tocar: a medalha grande, a raridade com as sementinhas, a
 * descrição, quando chegou — e Resgatar (se ela espera o toque) ou
 * Compartilhar (se já é dela).
 */
function FolhaDaMedalha({
  cartao: c,
  podeResgatar,
  emVoo,
  aoResgatar,
  aoFechar,
}: {
  cartao: CartaoDaGrade | null;
  podeResgatar: boolean;
  emVoo: boolean;
  aoResgatar: (c: CartaoDaGrade) => void;
  aoFechar: () => void;
}) {
  /* A folha fecha deslizando: o conteúdo de antes fica até ela sumir. */
  const ultima = useRef<CartaoDaGrade | null>(null);
  if (c) ultima.current = c;
  const m = c ?? ultima.current;
  if (!m) return null;
  const rar = RARIDADES[m.def.raridade];
  const bloqueada = m.estado === "bloqueada";
  const quando = dataCompleta(m.quando);
  return (
    <Folha aberta={!!c} aoFechar={aoFechar} titulo={m.def.title}>
      <View style={{ alignItems: "center", gap: espaco.md, paddingBottom: espaco.sm }}>
        <Medalha
          emoji={m.def.emoji}
          raridade={m.def.raridade}
          tamanho={112}
          anel={4}
          bloqueada={bloqueada}
        />
        <RotuloDaRaridade
          raridade={m.def.raridade}
          nome={rar.label}
          sementinhas={rar.sementinhas}
        />
        <Text
          style={{
            ...fonte.normal,
            ...escala.corpo,
            textAlign: "center",
            color: cor.textoCorpo,
          }}
        >
          {descricaoNoApp(m.def)}
        </Text>
        <Text style={{ ...fonte.media, ...escala.nota, color: cor.textoApagado }}>
          {bloqueada ? "Ainda bloqueada" : quando ? `Desbloqueada em ${quando}` : "Desbloqueada"}
        </Text>
      </View>
      {podeResgatar ? (
        <Botao
          rotulo={`Resgatar +${rar.sementinhas}`}
          icone={<Broto tamanho={18} tinta={cor.branco} />}
          corFundo={cor.sementinha}
          carregando={emVoo}
          aoTocar={() => aoResgatar(m)}
        />
      ) : null}
      {!bloqueada ? (
        <CompartilharConquista
          d={cartaoDaConquista(m.def)}
          tinta={cor.primaria}
          fundoDoBotao={cor.destaque}
        />
      ) : null}
    </Folha>
  );
}

/* ── A festa do resgate ────────────────────────────────────────────────── */

/**
 * A janela da conquista resgatada: o véu ameixa, a medalha que chega com
 * mola (uma vez) sobre um brilho, "+15" grande, Continuar (o botão cheio) e
 * Compartilhar (o segundo). O confete cai DENTRO da janela, na frente do véu
 * — antes ficava atrás dele, ou no topo da lista, longe de quem rolou.
 */
function FestaDoResgate({
  festa,
  aoFechar,
}: {
  festa: { def: ConquistaDef; ganhou: number } | null;
  aoFechar: () => void;
}) {
  const { height: altura } = useWindowDimensions();
  const reduzido = useMovimentoReduzido();
  const chegada = useRef(new Animated.Value(0.6)).current;
  const ultima = useRef(festa);
  if (festa) ultima.current = festa;
  const f = festa ?? ultima.current;
  useEffect(() => {
    if (!festa) return;
    if (reduzido) {
      chegada.setValue(1);
      return;
    }
    chegada.setValue(0.6);
    const a = Animated.spring(chegada, {
      toValue: 1,
      friction: 6,
      tension: 80,
      useNativeDriver: true,
    });
    a.start();
    return () => a.stop();
  }, [festa, reduzido, chegada]);
  if (!f) return null;
  return (
    <Modal visible={!!festa} transparent animationType="fade" onRequestClose={aoFechar}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Fechar"
        onPress={aoFechar}
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          padding: espaco.xl,
          backgroundColor: comAlfa(cor.texto, 0.5),
        }}
      >
        <Pressable
          onPress={() => {}}
          style={{
            width: "100%",
            maxWidth: 340,
            borderRadius: canto.painel,
            ...curva,
            backgroundColor: cor.cartao,
            paddingHorizontal: espaco.xl,
            paddingTop: espaco.xxl,
            paddingBottom: espaco.xl,
            alignItems: "center",
            gap: espaco.sm,
          }}
        >
          <Animated.View
            style={{
              width: 112,
              height: 112,
              alignItems: "center",
              justifyContent: "center",
              transform: [{ scale: chegada }],
            }}
          >
            <Brilho tamanho={220} tinta={ouro.claro} />
            <Medalha emoji={f.def.emoji} raridade={f.def.raridade} tamanho={112} anel={4} />
          </Animated.View>
          <View style={{ marginTop: espaco.md }}>
            <Sobrelinha tinta={cor.primaria}>Conquista desbloqueada</Sobrelinha>
          </View>
          <Text
            accessibilityRole="header"
            style={{
              ...fonte.display,
              ...escala.titulo2,
              letterSpacing: -0.2,
              textAlign: "center",
              color: cor.texto,
            }}
          >
            {f.def.title}
          </Text>
          <View
            accessible
            accessibilityLabel={`Mais ${f.ganhou} sementinhas`}
            style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: espaco.xs }}
          >
            <Broto tamanho={24} />
            <Text
              style={{
                ...fonteDoNumero,
                ...escala.titulo1,
                color: cor.sementinha,
                fontVariant: ["tabular-nums"],
              }}
            >
              +{f.ganhou}
            </Text>
          </View>
          <View style={{ alignSelf: "stretch", gap: espaco.sm, marginTop: espaco.lg }}>
            <Botao rotulo="Continuar" aoTocar={aoFechar} />
            <CompartilharConquista
              d={cartaoDaConquista(f.def)}
              tinta={cor.primaria}
              fundoDoBotao={cor.destaque}
            />
          </View>
        </Pressable>
        {festa ? <Confete key={f.def.key} pecas={40} altura={altura} /> : null}
      </Pressable>
    </Modal>
  );
}
