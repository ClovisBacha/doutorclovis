import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, Share, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { linkDeIndicacao, mensagemDeConvite } from "@/lib/indicacao";
import { tempoNoApp } from "@/lib/amigas";
import { useAviso } from "~/componentes/aviso";
import { Carregando, NaoConsegueLer, toque } from "~/componentes/base";
import { BotaoDoPerfil } from "~/componentes/botao-do-perfil";
import {
  cobrarOBonus,
  lerAmigas,
  lerPedidos,
  pedirAmizade,
  responderPedido,
  type LeituraDasAmigas,
  type Pedido,
} from "~/componentes/amigas/economia";
import {
  Avatar,
  CabecalhoDaSecao,
  CartaoDaDupla,
  LinhaDaAmiga,
  tinta,
} from "~/componentes/amigas/pecas";
import { rota } from "~/componentes/jornada/bancada";
import { useJornada } from "~/componentes/jornada/usarJornada";
import { lerAIndicacao } from "~/componentes/recompensas/economia-do-cantinho";
import { fraseDoPedido } from "~/lib/jornada/amigas";
import { mudarSelos, seloDasAmigas } from "~/lib/selos";
import { ALVO_MINIMO, cor, espaco, fonte } from "~/tema";

/**
 * AS AMIGAS — a aba do site (`src/components/amigas.tsx`), e uma das quatro da
 * barra do app desde a fase 3 (a rede social no centro): os pedidos de
 * amizade, a DUPLA de sequência, a lista das amigas (o que cada uma
 * construiu, nunca placar e nada clínico), achar uma amiga pelo código e
 * convidar pelo link. O selo da aba conta os pedidos e o convite da dupla.
 *
 * O grafo é o do convite e dos pedidos entre contas: sem busca por nome e sem
 * estranhos, não há o que moderar. No Modo Cuidado a aba se cala (o servidor
 * já devolve vazio). No pós-parto a dupla some: ela conta os dias que o
 * servidor paga, e ele só paga atividade na gestação — uma chama que nunca
 * acende é pior que nenhuma (decisão do dono).
 *
 * Bancada: /amigas?bancada=1 [&amigas=0] [&dupla=sem|enviado|recebido|ativa|pausa]
 * [&pedidos=0] [&pos=1] [&luto=1]
 */

const HEROI = require("../../../../src/assets/amigas/heroi.webp");

export default function Amigas() {
  const { dia } = useJornada();
  const pos = dia.modo === "pos";
  const [leitura, setLeitura] = useState<LeituraDasAmigas | null | "carregando">("carregando");
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [codigo, setCodigo] = useState<string | null>(null);
  const [termo, setTermo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [resposta, setResposta] = useState<{ texto: string; ok: boolean } | null>(null);
  const { avisar, aviso } = useAviso();

  const carregar = useCallback(async () => {
    const [l, p] = await Promise.all([lerAmigas(), lerPedidos()]);
    setLeitura(l);
    setPedidos(p);
    /* A tela acabou de ler: o selo da barra passa a dizer o que ela mostra. */
    if (l) mudarSelos({ amigas: l.careMode ? 0 : seloDasAmigas(p.length, l.dupla, pos) });
  }, [pos]);

  useFocusEffect(
    useCallback(() => {
      void carregar();
    }, [carregar]),
  );

  useEffect(() => {
    void lerAIndicacao().then((i) => setCodigo(i?.codigo ?? null));
  }, []);

  /* O bônus da dupla: cada uma cobra o seu ao abrir a aba (o servidor confere
     que as DUAS fecharam o dia, e não paga duas vezes). Nunca no pós-parto. */
  useEffect(() => {
    if (pos || leitura === "carregando" || !leitura || leitura.dupla?.estado !== "ativa") return;
    void cobrarOBonus().then((ganho) => {
      if (ganho > 0)
        avisar(`+${ganho} 🌱 da ofensiva com ${leitura.dupla?.nome ?? "sua amiga"} 🔥`);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leitura, pos]);

  async function enviarPedido() {
    if (termo.trim().length < 3 || enviando) return;
    setEnviando(true);
    setResposta(null);
    const r = await pedirAmizade(termo.trim());
    setEnviando(false);
    setResposta(fraseDoPedido(r));
    if (r.ok) setTermo("");
  }

  async function convidar() {
    toque();
    const link = linkDeIndicacao(codigo);
    if (!link) {
      avisar("Ainda estou preparando o seu link. Tente de novo em instantes.");
      return;
    }
    try {
      await Share.share({ message: mensagemDeConvite(link) });
    } catch {
      avisar("Não consegui abrir o compartilhamento.");
    }
  }

  async function responder(p: Pedido, aceitar: boolean) {
    const r = await responderPedido(p.id, aceitar);
    if (!r.ok) {
      avisar("Não deu agora. Tente de novo em instantes.");
      return;
    }
    setPedidos((lista) => lista.filter((x) => x.id !== p.id));
    if (!aceitar) void carregar();
    if (aceitar) {
      avisar(`Agora vocês são amigas 💛`);
      void carregar();
    }
  }

  const corpo = (() => {
    if (leitura === "carregando") return <Carregando texto="Chamando as suas amigas…" />;
    if (!leitura)
      return (
        <NaoConsegueLer
          sossego="As suas amigas continuam aí — é só a leitura que não veio agora."
          aoTentar={() => void carregar()}
        />
      );
    if (leitura.careMode || ("cuidado" in dia && dia.cuidado))
      return (
        <View
          style={{
            borderRadius: 24,
            borderWidth: 1,
            borderStyle: "dashed",
            borderColor: cor.borda,
            padding: espaco.xl,
          }}
        >
          <Text
            style={{
              textAlign: "center",
              fontFamily: fonte.media,
              fontSize: 15,
              color: cor.textoApagado,
            }}
          >
            As Amigas voltam quando você quiser. Está tudo guardado.
          </Text>
        </View>
      );
    const { amigas, dupla } = leitura;
    return (
      <View style={{ gap: 20 }}>
        {pedidos.length > 0 ? (
          <View>
            <CabecalhoDaSecao
              titulo={
                pedidos.length === 1
                  ? "Um pedido de amizade"
                  : `${pedidos.length} pedidos de amizade`
              }
            />
            <View style={{ gap: espaco.sm }}>
              {pedidos.map((p) => (
                <View
                  key={p.id}
                  style={{
                    borderRadius: 20,
                    backgroundColor: cor.branco,
                    padding: 12,
                    gap: 10,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <Avatar nome={p.nome} id={p.id} url={null} tamanho={40} />
                    <View style={{ flex: 1 }}>
                      <Text
                        numberOfLines={1}
                        style={{ fontFamily: fonte.titulo, fontSize: 15, color: tinta.titulo }}
                      >
                        {p.nome}
                      </Text>
                      <Text style={{ fontFamily: fonte.media, fontSize: 13, color: tinta.sub }}>
                        {tempoNoApp(p.diasNoApp)}
                      </Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: "row", gap: espaco.sm }}>
                    <Pilula rotulo="Aceitar 💛" cheio aoTocar={() => void responder(p, true)} />
                    <Pilula rotulo="Agora não" aoTocar={() => void responder(p, false)} />
                  </View>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {pos ? null : (
          <View>
            <CabecalhoDaSecao titulo="Dupla de sequência" />
            <CartaoDaDupla
              dupla={dupla}
              amigas={amigas}
              aoMudar={() => void carregar()}
              avisar={avisar}
            />
          </View>
        )}

        <View>
          <CabecalhoDaSecao titulo="Suas amigas" />
          {amigas.length === 0 ? (
            <View
              style={{
                alignItems: "center",
                gap: 6,
                borderRadius: 20,
                borderWidth: 1,
                borderStyle: "dashed",
                borderColor: "#e9d5ff",
                backgroundColor: "rgba(255,255,255,0.6)",
                padding: espaco.xl,
              }}
            >
              <Text style={{ fontSize: 30 }}>👭</Text>
              <Text style={{ fontFamily: fonte.titulo, fontSize: 15, color: tinta.titulo }}>
                Ainda não tem ninguém por aqui
              </Text>
              <Text
                style={{
                  textAlign: "center",
                  fontFamily: fonte.media,
                  fontSize: 13,
                  lineHeight: 19,
                  color: tinta.sub,
                }}
              >
                Convide uma amiga pelo seu link. Vocês duas ganham Sementinhas, e ela aparece aqui.
              </Text>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              {amigas.map((a) => (
                <LinhaDaAmiga
                  key={a.id}
                  a={a}
                  aoAbrir={() => router.push(rota(`/amigas/${a.id}`) as never)}
                />
              ))}
            </View>
          )}
        </View>

        <View
          style={{
            borderRadius: 24,
            backgroundColor: cor.branco,
            padding: espaco.lg,
            gap: espaco.sm,
          }}
        >
          <Text style={{ fontFamily: fonte.titulo, fontSize: 17, color: tinta.titulo }}>
            Já tem uma amiga no app?
          </Text>
          <Text style={{ fontFamily: fonte.media, fontSize: 13, lineHeight: 19, color: tinta.sub }}>
            Peça o código dela (está no cartão de indicação, nas Recompensas) ou use o e-mail que
            ela cadastrou. Ela recebe um pedido e escolhe se aceita.
          </Text>
          <View style={{ flexDirection: "row", gap: espaco.sm }}>
            <TextInput
              value={termo}
              onChangeText={setTermo}
              onSubmitEditing={() => void enviarPedido()}
              placeholder="Código ou e-mail"
              placeholderTextColor={cor.textoApagado}
              accessibilityLabel="Código de indicação ou e-mail da amiga"
              autoCapitalize="none"
              autoCorrect={false}
              style={{
                flex: 1,
                minHeight: ALVO_MINIMO,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: cor.borda,
                backgroundColor: cor.fundo,
                paddingHorizontal: espaco.lg,
                fontFamily: fonte.normal,
                fontSize: 16,
                color: cor.texto,
              }}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Enviar pedido"
              disabled={enviando || termo.trim().length < 3}
              onPress={() => {
                toque();
                void enviarPedido();
              }}
              style={({ pressed }) => ({
                minHeight: ALVO_MINIMO,
                paddingHorizontal: espaco.lg,
                borderRadius: 999,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: tinta.rosa,
                opacity: enviando || termo.trim().length < 3 ? 0.45 : pressed ? 0.85 : 1,
              })}
            >
              <Text style={{ fontFamily: fonte.titulo, fontSize: 14, color: cor.branco }}>
                {enviando ? "…" : "Enviar"}
              </Text>
            </Pressable>
          </View>
          {resposta ? (
            <Text
              style={{
                fontFamily: fonte.media,
                fontSize: 13,
                lineHeight: 19,
                color: resposta.ok ? "#15803d" : cor.atencaoForte,
              }}
            >
              {resposta.texto}
            </Text>
          ) : null}
          {codigo ? (
            <Text style={{ fontFamily: fonte.normal, fontSize: 13, color: tinta.sub }}>
              O seu código é{" "}
              <Text style={{ fontFamily: fonte.titulo, letterSpacing: 1.2, color: tinta.titulo }}>
                {codigo}
              </Text>{" "}
              — mande para ela te achar também.
            </Text>
          ) : null}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Convidar uma amiga pelo seu link"
          onPress={() => void convidar()}
          style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
        >
          <LinearGradient
            colors={["#fdf3e0", "#fbeef4", "#f6ecfb"]}
            start={{ x: 0, y: 0.3 }}
            end={{ x: 1, y: 0.7 }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              borderRadius: 20,
              padding: 12,
            }}
          >
            <LinearGradient
              colors={["#a855f7", "#7c3aed"]}
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ fontSize: 20 }}>💌</Text>
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontFamily: fonte.titulo,
                  fontSize: 15,
                  lineHeight: 19,
                  color: tinta.titulo,
                }}
              >
                Convide uma amiga
              </Text>
              <Text
                style={{ fontFamily: fonte.media, fontSize: 12, lineHeight: 16, color: tinta.sub }}
              >
                Pelo seu link — ela entra já ligada a você
              </Text>
            </View>
            <View
              style={{
                borderRadius: 999,
                backgroundColor: tinta.rosa,
                paddingHorizontal: 14,
                paddingVertical: 9,
              }}
            >
              <Text style={{ fontFamily: fonte.titulo, fontSize: 13, color: cor.branco }}>
                Convidar ›
              </Text>
            </View>
          </LinearGradient>
        </Pressable>
      </View>
    );
  })();

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: "#fcf2f6" }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          minHeight: ALVO_MINIMO + 4,
          paddingHorizontal: espaco.lg,
          paddingTop: espaco.sm,
          paddingBottom: espaco.sm,
        }}
      >
        <Text
          accessibilityRole="header"
          style={{
            flex: 1,
            fontFamily: fonte.titulo,
            fontSize: 28,
            color: cor.texto,
            letterSpacing: -0.4,
          }}
        >
          Amigas
        </Text>
        <BotaoDoPerfil tamanho={34} />
      </View>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 10, paddingBottom: 60 }}
        keyboardShouldPersistTaps="handled"
      >
        <LinearGradient
          colors={["#feede6", "#fcecf0", "#f7e7f4", "#f1eaf7", "#f9edf8", "#fbf5f8"]}
          style={{ borderRadius: 28, overflow: "hidden", paddingBottom: 14, gap: 20 }}
        >
          <Image
            source={HEROI}
            style={{ width: "100%", aspectRatio: 852 / 388 }}
            contentFit="cover"
            accessibilityLabel="Amizade que faz bem — convide suas amigas, formem duplas e joguem juntas! Quanto mais conexão, mais recompensas!"
          />
          <View style={{ paddingHorizontal: 8 }}>{corpo}</View>
        </LinearGradient>
      </ScrollView>
      {aviso}
    </SafeAreaView>
  );
}

function Pilula({
  rotulo,
  aoTocar,
  cheio,
}: {
  rotulo: string;
  aoTocar: () => void;
  cheio?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      onPress={() => {
        toque();
        aoTocar();
      }}
      style={({ pressed }) => ({
        flex: 1,
        minHeight: ALVO_MINIMO,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 999,
        backgroundColor: cheio ? tinta.rosa : cor.fundo,
        borderWidth: cheio ? 0 : 1,
        borderColor: cor.borda,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Text
        style={{ fontFamily: fonte.titulo, fontSize: 14, color: cheio ? cor.branco : tinta.sub }}
      >
        {rotulo}
      </Text>
    </Pressable>
  );
}
