import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Modal, Platform, Pressable, Text, View } from "react-native";
import { conquistaPorChave } from "@/lib/conquistas";
import { NaoConsegueLer, toque } from "~/componentes/base";
import { Confete } from "~/componentes/jornada/pecas";
import type { LeituraDasConquistas } from "~/componentes/jornada/economia";
import { useMovimentoReduzido } from "~/componentes/movimento";
import { corRecompensas, quadroDaRaridade } from "~/componentes/recompensas/cores";
import { lerJson, gravarJson } from "~/lib/armazem";
import { montarGrade, resumo, secoes, type Cartao } from "~/lib/jornada/conquistas";
import { dataCompleta } from "~/lib/jornada/dia";
import { useSessao } from "~/lib/sessao";
import { RARIDADES } from "@/lib/conquistas";
import { ALVO_MINIMO, cor, espaco, fonte } from "~/tema";

/**
 * A ABA CONQUISTAS — o desenho de `conquistas-tab.tsx` do site.
 *
 * De cima para baixo: o cartão verde "Suas Sementinhas" (com o convite para o
 * Meu Cantinho), o cartão "Suas conquistas" (X de 39, a porcentagem, a barra e
 * a nota das quatro que esperam o nascimento), o aviso de conquista nova, e as
 * seções — Bebê, Saúde, Diário, Educação, Família — com os cartões na ordem do
 * catálogo. A conquista desbloqueada e ainda não resgatada vira BOTÃO: anel
 * verde, pulsando, "Resgatar +N 🌱".
 *
 * Do app ficam: a leitura que falhou diz que falhou (o site mostrava "0 de 39"),
 * e o resgate tem trava POR cartão, como o site, e nunca uma trava geral.
 */

export function AbaDasConquistas({
  leitura,
  saldo,
  cuidado,
  resgatar,
  recarregar,
  aoIrAoCantinho,
  avisar,
}: {
  leitura: LeituraDasConquistas | null | "carregando";
  saldo: number | null;
  cuidado: boolean;
  resgatar: (key: string) => Promise<{ granted: number; repetido: boolean } | null>;
  recarregar: () => void;
  aoIrAoCantinho: () => void;
  avisar: (texto: string) => void;
}) {
  const { sessao } = useSessao();
  const uid = sessao?.user.id ?? null;
  const grade = useMemo(
    () =>
      leitura && leitura !== "carregando"
        ? montarGrade(leitura.unlocked, leitura.resgatadas)
        : null,
    [leitura],
  );
  const [resgatando, setResgatando] = useState<Set<string>>(new Set());
  const [conquistada, setConquistada] = useState<{ emoji: string; titulo: string } | null>(null);
  const [festa, setFesta] = useState(0);
  const [novas, setNovas] = useState<string[]>([]);

  /* ── A comemoração ao abrir: o que desbloqueou desde a última visita ── */
  const comemorou = useRef(false);
  useEffect(() => {
    if (comemorou.current || !uid || !leitura || leitura === "carregando") return;
    comemorou.current = true;
    const chave = `dc-conquistas-comemoradas:${uid}`;
    void (async () => {
      const vistas = await lerJson<string[]>(chave, []);
      const todas = leitura.unlocked.map((u) => u.achievement_key);
      const agora = leitura.careMode ? [] : todas.filter((k) => !vistas.includes(k));
      if (agora.length) {
        setNovas(agora);
        setFesta((n) => n + 1);
        vibrar("sucesso");
      }
      void gravarJson(chave, Array.from(new Set([...vistas, ...todas])));
    })();
  }, [leitura, uid]);

  if (cuidado || (leitura && leitura !== "carregando" && leitura.careMode)) {
    return <SilencioDoCuidado />;
  }
  if (leitura === "carregando") return <Esqueleto />;
  if (!leitura || !grade) {
    return (
      <NaoConsegueLer
        sossego="As suas conquistas continuam guardadas — é só a leitura que não veio agora."
        aoTentar={recarregar}
      />
    );
  }

  const r = resumo(grade);
  const semSaberPagas = leitura.resgatadas === null;

  async function aoResgatar(c: Cartao) {
    const key = c.def.key;
    if (resgatando.has(key)) return;
    toque();
    setResgatando((s) => new Set(s).add(key));
    const res = await resgatar(key);
    setResgatando((s) => {
      const n = new Set(s);
      n.delete(key);
      return n;
    });
    if (!res) {
      avisar("Não consegui resgatar agora.");
      vibrar("erro");
      return;
    }
    if (res.granted > 0) {
      setFesta((n) => n + 1);
      vibrar("sucesso");
      avisar(`+${res.granted} 🌱`);
      const def = conquistaPorChave(key);
      setConquistada({ emoji: def?.emoji ?? "🏅", titulo: def?.title ?? "Conquista" });
    } else if (res.repetido) {
      avisar("Essas Sementinhas já são suas 💛");
    }
  }

  return (
    <View style={{ gap: 32 }}>
      {saldo != null ? (
        <LinearGradient
          colors={[corRecompensas.esmeralda50, corRecompensas.lima50]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            borderRadius: 28,
            borderWidth: 1,
            borderColor: corRecompensas.esmeralda200,
            padding: espaco.xl,
          }}
        >
          <View
            style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
          >
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontFamily: fonte.media,
                  fontSize: 15,
                  color: corRecompensas.esmeralda700,
                }}
              >
                Suas Sementinhas
              </Text>
              <View style={{ marginTop: 4, flexDirection: "row", alignItems: "baseline", gap: 6 }}>
                <Text
                  style={{
                    fontFamily: fonte.titulo,
                    fontSize: 30,
                    color: corRecompensas.esmeralda900,
                    fontVariant: ["tabular-nums"],
                  }}
                >
                  {saldo}
                </Text>
                <Text style={{ fontSize: 24 }}>🌱</Text>
              </View>
              <Text
                style={{
                  marginTop: 2,
                  fontFamily: fonte.normal,
                  fontSize: 13,
                  lineHeight: 17.5,
                  color: corRecompensas.esmeralda700_80,
                }}
              >
                Você ganha cuidando de você, aprendendo e avançando na jornada.
              </Text>
            </View>
            <Text style={{ fontSize: 36 }}>🌱</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityHint="Abre o Meu Cantinho"
            onPress={aoIrAoCantinho}
            style={{
              marginTop: espaco.md,
              borderRadius: 24,
              backgroundColor: corRecompensas.branco60,
              paddingHorizontal: espaco.md,
              paddingVertical: espaco.sm,
            }}
          >
            <Text
              style={{
                fontFamily: fonte.normal,
                fontSize: 13,
                lineHeight: 17.5,
                color: corRecompensas.esmeralda800_80,
              }}
            >
              Gaste no <Text style={{ fontFamily: fonte.forte }}>Meu Cantinho</Text>, aqui do lado —
              plantinhas, bichinhos e cenários pro seu Caminho. 💛
            </Text>
          </Pressable>
        </LinearGradient>
      ) : null}

      <CartaoMaterial estilo={{ padding: espaco.xl }}>
        <View
          style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
        >
          <View>
            <Text style={{ fontFamily: fonte.media, fontSize: 15, color: cor.primaria }}>
              Suas conquistas
            </Text>
            <Text
              style={{ marginTop: 4, fontFamily: fonte.titulo, fontSize: 24, color: cor.texto }}
            >
              {r.feitas} de {r.total}
            </Text>
            <Text style={{ fontFamily: fonte.normal, fontSize: 14, color: cor.textoApagado }}>
              badges desbloqueadas
            </Text>
          </View>
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              borderWidth: 4,
              borderColor: corRecompensas.primaria20,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ fontFamily: fonte.forte, fontSize: 16, color: cor.primaria }}>
              {r.pct}%
            </Text>
          </View>
        </View>
        <View
          style={{
            marginTop: espaco.lg,
            height: 8,
            borderRadius: 4,
            overflow: "hidden",
            backgroundColor: corRecompensas.secundaria,
          }}
        >
          <View
            style={{
              height: 8,
              width: `${r.pct}%`,
              borderRadius: 4,
              backgroundColor: cor.primaria,
            }}
          />
        </View>
        {r.mostrarNotaDoNascimento ? (
          <Text
            style={{
              marginTop: espaco.sm,
              fontFamily: fonte.normal,
              fontSize: 13,
              lineHeight: 21,
              color: cor.textoApagado,
            }}
          >
            {r.posPartoTotal} destas só acontecem depois que o bebê nascer — na gestação, o caminho
            completo são {r.total - r.posPartoTotal}.
          </Text>
        ) : null}
      </CartaoMaterial>

      {novas.length > 0 ? (
        <View
          style={{
            borderRadius: 28,
            borderWidth: 1,
            borderColor: corRecompensas.primaria25,
            backgroundColor: corRecompensas.primaria8,
            padding: 20,
            alignItems: "center",
          }}
        >
          <Text style={{ fontSize: 24, marginBottom: 4 }}>🎉</Text>
          <Text style={{ fontFamily: fonte.media, fontSize: 16, color: cor.texto }}>
            {novas.length === 1
              ? "Nova conquista desbloqueada!"
              : `${novas.length} novas conquistas!`}
          </Text>
        </View>
      ) : null}

      {secoes(grade).map((s) => (
        <View key={s.chave}>
          <Text
            accessibilityRole="header"
            style={{
              marginBottom: espaco.md,
              fontFamily: fonte.media,
              fontSize: 16,
              color: cor.texto,
            }}
          >
            {s.emoji} {s.rotulo}
          </Text>
          <View style={{ gap: espaco.md }}>
            {pares(s.cartoes).map((par, i) => (
              <View key={i} style={{ flexDirection: "row", gap: espaco.md, alignItems: "stretch" }}>
                {par.map((c) => (
                  <CartaoDaConquista
                    key={c.def.key}
                    cartao={c}
                    aResgatar={c.estado === "resgatar" && !semSaberPagas}
                    emVoo={resgatando.has(c.def.key)}
                    nova={novas.includes(c.def.key)}
                    aoResgatar={() => void aoResgatar(c)}
                  />
                ))}
                {par.length === 1 ? <View style={{ flex: 1 }} /> : null}
              </View>
            ))}
          </View>
        </View>
      ))}

      {festa > 0 ? <Confete key={festa} pecas={40} /> : null}

      <Modal
        visible={!!conquistada}
        transparent
        animationType="fade"
        onRequestClose={() => setConquistada(null)}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Fechar"
          onPress={() => setConquistada(null)}
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            padding: espaco.xl,
            backgroundColor: corRecompensas.veu,
          }}
        >
          <Pressable
            onPress={() => {}}
            style={{
              width: "100%",
              maxWidth: 320,
              borderRadius: 28,
              backgroundColor: cor.cartao,
              padding: espaco.xl,
              alignItems: "center",
            }}
          >
            <Text style={{ fontSize: 48 }}>{conquistada?.emoji}</Text>
            <Text
              style={{
                marginTop: espaco.sm,
                fontFamily: fonte.forte,
                fontSize: 13,
                letterSpacing: 0.8,
                textTransform: "uppercase",
                color: cor.primaria,
              }}
            >
              Conquista desbloqueada
            </Text>
            <Text
              style={{
                marginTop: 4,
                fontFamily: fonte.titulo,
                fontSize: 20,
                lineHeight: 24,
                textAlign: "center",
                color: cor.texto,
              }}
            >
              {conquistada?.titulo}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setConquistada(null)}
              style={({ pressed }) => ({
                marginTop: espaco.lg,
                alignSelf: "stretch",
                minHeight: ALVO_MINIMO,
                borderRadius: 999,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: cor.primaria,
                transform: [{ scale: pressed ? 0.97 : 1 }],
              })}
            >
              <Text style={{ fontFamily: fonte.media, fontSize: 14, color: cor.branco }}>
                Fechar
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

/** O desfecho no dedo — fora da web (lá não há motor, e o navegador reclama). */
function vibrar(tipo: "sucesso" | "erro") {
  if (Platform.OS === "web") return;
  void Haptics.notificationAsync(
    tipo === "sucesso"
      ? Haptics.NotificationFeedbackType.Success
      : Haptics.NotificationFeedbackType.Error,
  ).catch(() => {});
}

function pares<T>(lista: readonly T[]): T[][] {
  const fora: T[][] = [];
  for (let i = 0; i < lista.length; i += 2) fora.push(lista.slice(i, i + 2));
  return fora;
}

function CartaoDaConquista({
  cartao: c,
  aResgatar,
  emVoo,
  nova,
  aoResgatar,
}: {
  cartao: Cartao;
  aResgatar: boolean;
  emVoo: boolean;
  nova: boolean;
  aoResgatar: () => void;
}) {
  const desbloqueada = c.estado !== "bloqueada";
  const rar = RARIDADES[c.def.raridade];
  const q = quadroDaRaridade[c.def.raridade];
  const reduzido = useMovimentoReduzido();
  const pulso = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!aResgatar || reduzido) {
      pulso.setValue(1);
      return;
    }
    const laco = Animated.loop(
      Animated.sequence([
        Animated.timing(pulso, {
          toValue: 0.72,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulso, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    laco.start();
    return () => laco.stop();
  }, [aResgatar, reduzido, pulso]);

  const corpo = (
    <View
      style={{
        flex: 1,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: desbloqueada ? q.borda : cor.borda,
        backgroundColor: desbloqueada ? q.fundo : corRecompensas.secundaria20,
        padding: espaco.lg,
        alignItems: "center",
        opacity: desbloqueada ? 1 : 0.5,
        shadowColor: corRecompensas.sombra,
        shadowOpacity: desbloqueada ? (nova ? 0.16 : 0.08) : 0,
        shadowRadius: nova ? 10 : 8,
        shadowOffset: { width: 0, height: 2 },
      }}
    >
      {desbloqueada && q.halo ? (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: -2,
            right: -2,
            top: -2,
            bottom: -2,
            borderRadius: 26,
            borderWidth: 1,
            borderColor: q.halo,
          }}
        />
      ) : null}
      <Text style={{ fontSize: 30, lineHeight: 36, marginBottom: espaco.sm }}>{c.def.emoji}</Text>
      <Text
        style={{ fontFamily: fonte.media, fontSize: 13, textAlign: "center", color: cor.texto }}
      >
        {c.def.title}
      </Text>
      <Text
        style={{
          marginTop: 2,
          fontFamily: fonte.normal,
          fontSize: 13,
          lineHeight: 16,
          textAlign: "center",
          color: cor.textoApagado,
        }}
      >
        {c.def.description}
      </Text>
      <Text
        style={{
          marginTop: 6,
          fontFamily: fonte.forte,
          fontSize: 13,
          letterSpacing: 0.4,
          textTransform: "uppercase",
          textAlign: "center",
          color: desbloqueada ? q.texto : corRecompensas.apagado60,
        }}
      >
        {rar.label} · {rar.sementinhas} 🌱
      </Text>
      {aResgatar ? (
        <View
          style={{
            marginTop: 6,
            borderRadius: 999,
            backgroundColor: corRecompensas.esmeralda700,
            paddingHorizontal: espaco.sm,
            paddingVertical: 4,
          }}
        >
          <Text style={{ fontFamily: fonte.forte, fontSize: 13, color: cor.branco }}>
            {emVoo ? "Resgatando…" : `Resgatar +${rar.sementinhas} 🌱`}
          </Text>
        </View>
      ) : desbloqueada && c.quando ? (
        <Text style={{ marginTop: 4, fontFamily: fonte.normal, fontSize: 13, color: cor.primaria }}>
          {dataCompleta(c.quando)}
        </Text>
      ) : null}
      {!desbloqueada ? (
        <Text
          style={{ marginTop: 4, fontFamily: fonte.normal, fontSize: 13, color: cor.textoApagado }}
        >
          🔒 bloqueada
        </Text>
      ) : null}
    </View>
  );

  if (!aResgatar) return corpo;
  /* O único estado que pede uma ação: o cartão inteiro vira botão, com o anel
     verde afastado 2 px (o `ring-2 ring-offset-2` do site) e pulsando. */
  return (
    <Animated.View style={{ flex: 1, opacity: pulso }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Resgatar ${rar.sementinhas} Sementinhas de ${c.def.title}`}
        accessibilityState={{ busy: emVoo }}
        onPress={aoResgatar}
        style={({ pressed }) => ({
          flex: 1,
          borderRadius: 28,
          borderWidth: 2,
          borderColor: corRecompensas.esmeralda400,
          padding: 2,
          transform: [{ scale: pressed ? 0.96 : 1 }],
        })}
      >
        {corpo}
      </Pressable>
    </Animated.View>
  );
}

/** O `card-material` do site: cartão claro, borda fina, luz no alto e sombra macia. */
function CartaoMaterial({ children, estilo }: { children: React.ReactNode; estilo?: object }) {
  return (
    <View
      style={[
        {
          borderRadius: 28,
          backgroundColor: cor.cartao,
          borderWidth: 1,
          borderColor: cor.borda,
          shadowColor: corRecompensas.sombra,
          shadowOpacity: 0.08,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 2 },
        },
        estilo,
      ]}
    >
      {children}
    </View>
  );
}

function SilencioDoCuidado() {
  return (
    <CartaoMaterial estilo={{ padding: 32, alignItems: "center", gap: espaco.lg }}>
      <Text
        style={{
          fontFamily: fonte.normal,
          fontSize: 15,
          lineHeight: 22,
          textAlign: "center",
          color: cor.texto,
        }}
      >
        Esta parte do aplicativo está em pausa enquanto o Modo Cuidado estiver ligado.
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push("/perfil")}
        style={({ pressed }) => ({
          minHeight: ALVO_MINIMO,
          paddingHorizontal: espaco.xl,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: cor.borda,
          alignItems: "center",
          justifyContent: "center",
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <Text style={{ fontFamily: fonte.media, fontSize: 14, color: cor.texto }}>
          Ajustes do Modo Cuidado
        </Text>
      </Pressable>
    </CartaoMaterial>
  );
}

/** O esqueleto enquanto lê (o `TabSkeleton` do site): blocos claros no lugar do conteúdo. */
function Esqueleto() {
  const bloco = (h: number) => (
    <View style={{ height: h, borderRadius: 24, backgroundColor: cor.apagado }} />
  );
  return (
    <View style={{ gap: espaco.md }} accessibilityLabel="Carregando as conquistas">
      {bloco(120)}
      {bloco(96)}
      <View style={{ flexDirection: "row", gap: espaco.md }}>
        <View style={{ flex: 1 }}>{bloco(140)}</View>
        <View style={{ flex: 1 }}>{bloco(140)}</View>
      </View>
    </View>
  );
}
