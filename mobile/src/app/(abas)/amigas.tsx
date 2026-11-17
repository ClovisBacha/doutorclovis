import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, Share, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { linkDeIndicacao } from "@/lib/indicacao";
import { tempoNoApp } from "@/lib/amigas";
import { useAviso } from "~/componentes/aviso";
import { Carregando, NaoConsegueLer, toque, useFimDaRolagem } from "~/componentes/base";
import { BotaoDoPerfil } from "~/componentes/botao-do-perfil";
import { CEUS, sombraDoTexto, useCeuDasAbas, type Ceu } from "~/componentes/ceu-vivo";
import { BolhaViva } from "~/componentes/movimento";
import { Painel } from "~/componentes/painel";
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
import { fraseDoPedido, mensagemDeConviteDoApp } from "~/lib/jornada/amigas";
import { mudarSelos, seloDasAmigas } from "~/lib/selos";
import { ALVO_MINIMO, amanhecer, aperto, cor, curva, espaco, fonte, luz, sombra } from "~/tema";

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
 * O desenho (16/11/2026): a aba flutua sobre o céu das três abas, como a do
 * bebê — a bolha apaixonada solta no céu no lugar da faixa cor-de-rosa, e cada
 * seção num painel de vidro ("vamos tirar esse fundo rosa", o dono).
 *
 * Bancada: /amigas?bancada=1 [&amigas=0] [&dupla=sem|enviado|recebido|ativa|pausa]
 * [&pedidos=0] [&pos=1] [&luto=1]
 */

export default function Amigas() {
  const { dia } = useJornada();
  const pos = dia.modo === "pos";
  const [leitura, setLeitura] = useState<LeituraDasAmigas | null | "carregando">("carregando");
  const fim = useFimDaRolagem(60);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [codigo, setCodigo] = useState<string | null>(null);
  const [termo, setTermo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [resposta, setResposta] = useState<{ texto: string; ok: boolean } | null>(null);
  const { avisar, aviso } = useAviso();
  /* O céu das abas, atrás de tudo (fora das abas, o fundo antigo). */
  const dasAbas = useCeuDasAbas();
  const ceu = dasAbas ? CEUS[dasAbas.fase] : null;

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
    if (!link || !codigo) {
      avisar("Ainda estou preparando o seu link. Tente de novo em instantes.");
      return;
    }
    /* Com o código ESCRITO: quem baixa o app digita no cadastro ("Uma amiga
       te chamou?"); o link é do site, que o captura sozinho. */
    try {
      await Share.share({ message: mensagemDeConviteDoApp(codigo, link) });
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
    if (leitura === "carregando")
      return (
        <Painel>
          <Carregando texto="Chamando as suas amigas…" />
        </Painel>
      );
    if (!leitura)
      return (
        <NaoConsegueLer
          sossego="As suas amigas continuam aí — é só a leitura que não veio agora."
          aoTentar={() => void carregar()}
        />
      );
    if (leitura.careMode || ("cuidado" in dia && dia.cuidado))
      return (
        <Painel estilo={{ padding: espaco.xl }}>
          <Text
            style={{
              textAlign: "center",
              ...fonte.media,
              fontSize: 15,
              color: cor.textoApagado,
            }}
          >
            As Amigas voltam quando você quiser. Está tudo guardado.
          </Text>
        </Painel>
      );
    const { amigas, dupla } = leitura;
    return (
      <View style={{ gap: 14 }}>
        {pedidos.length > 0 ? (
          <Painel>
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
                    borderRadius: 22,
                    ...curva,
                    backgroundColor: luz.cartao,
                    padding: 12,
                    gap: 10,
                    ...sombra,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <Avatar nome={p.nome} id={p.id} url={null} tamanho={40} />
                    <View style={{ flex: 1 }}>
                      <Text
                        numberOfLines={1}
                        style={{ ...fonte.titulo, fontSize: 16, color: tinta.titulo }}
                      >
                        {p.nome}
                      </Text>
                      <Text style={{ ...fonte.media, fontSize: 13, color: tinta.sub }}>
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
          </Painel>
        ) : null}

        {pos ? null : (
          <Painel>
            <CabecalhoDaSecao titulo="Dupla de sequência" />
            <CartaoDaDupla
              dupla={dupla}
              amigas={amigas}
              aoMudar={() => void carregar()}
              avisar={avisar}
            />
          </Painel>
        )}

        <Painel>
          <CabecalhoDaSecao titulo="Suas amigas" />
          {amigas.length === 0 ? (
            <View
              style={{
                alignItems: "center",
                gap: 6,
                borderRadius: 22,
                ...curva,
                borderWidth: 1,
                borderStyle: "dashed",
                borderColor: "#d9c8f5",
                backgroundColor: "rgba(255,255,255,0.6)",
                padding: espaco.xl,
              }}
            >
              <Text style={{ fontSize: 30 }}>👭</Text>
              <Text style={{ ...fonte.titulo, fontSize: 16, color: tinta.titulo }}>
                Ainda não tem ninguém por aqui
              </Text>
              <Text
                style={{
                  textAlign: "center",
                  ...fonte.media,
                  fontSize: 14,
                  lineHeight: 20,
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
        </Painel>

        <Painel estilo={{ gap: espaco.sm, padding: espaco.lg }}>
          <Text
            accessibilityRole="header"
            style={{ ...fonte.titulo, fontSize: 18, color: tinta.titulo }}
          >
            Já tem uma amiga no app?
          </Text>
          <Text style={{ ...fonte.media, fontSize: 14, lineHeight: 20, color: tinta.sub }}>
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
                backgroundColor: cor.cartao,
                paddingHorizontal: espaco.lg,
                ...fonte.normal,
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
                backgroundColor: cor.primaria,
                opacity: enviando || termo.trim().length < 3 ? 0.45 : pressed ? 0.85 : 1,
              })}
            >
              <Text style={{ ...fonte.titulo, fontSize: 15, color: cor.branco }}>
                {enviando ? "…" : "Enviar"}
              </Text>
            </Pressable>
          </View>
          {resposta ? (
            <Text
              style={{
                ...fonte.media,
                fontSize: 13,
                lineHeight: 19,
                color: resposta.ok ? "#15803d" : cor.atencaoForte,
              }}
            >
              {resposta.texto}
            </Text>
          ) : null}
          {codigo ? (
            <Text style={{ ...fonte.normal, fontSize: 13, color: tinta.sub }}>
              O seu código é{" "}
              <Text style={{ ...fonte.titulo, letterSpacing: 1.2, color: tinta.titulo }}>
                {codigo}
              </Text>{" "}
              — mande para ela te achar também.
            </Text>
          ) : null}
        </Painel>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Convidar uma amiga pelo seu link"
          onPress={() => void convidar()}
          style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
        >
          <LinearGradient
            colors={["#fff4e2", "#ffeaf3", "#f1eaff"]}
            start={{ x: 0, y: 0.3 }}
            end={{ x: 1, y: 0.7 }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              borderRadius: 26,
              ...curva,
              padding: 14,
            }}
          >
            <LinearGradient
              colors={[amanhecer[1], amanhecer[2]]}
              style={{
                width: 46,
                height: 46,
                borderRadius: 23,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ fontSize: 20 }}>💌</Text>
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  ...fonte.titulo,
                  fontSize: 16,
                  lineHeight: 20,
                  color: tinta.titulo,
                }}
              >
                Convide uma amiga
              </Text>
              <Text style={{ ...fonte.media, fontSize: 13, lineHeight: 17, color: tinta.sub }}>
                Pelo seu link — ela entra já ligada a você
              </Text>
            </View>
            <View
              style={{
                borderRadius: 999,
                backgroundColor: cor.primaria,
                paddingHorizontal: 14,
                paddingVertical: 9,
              }}
            >
              <Text style={{ ...fonte.titulo, fontSize: 14, color: cor.branco }}>Convidar ›</Text>
            </View>
          </LinearGradient>
        </Pressable>
      </View>
    );
  })();

  return (
    <SafeAreaView
      edges={["top"]}
      style={{ flex: 1, backgroundColor: ceu ? "transparent" : "#fcf2f6" }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          minHeight: ALVO_MINIMO + 4,
          paddingHorizontal: 20,
          paddingTop: espaco.sm,
          paddingBottom: espaco.xs,
        }}
      >
        <Text
          accessibilityRole="header"
          style={{
            flex: 1,
            ...fonte.titulo,
            fontSize: 32,
            lineHeight: 38,
            letterSpacing: aperto.titulo,
            color: ceu?.tinta ?? cor.texto,
            ...(ceu ? sombraDoTexto(ceu) : null),
          }}
        >
          Amigas
        </Text>
        <BotaoDoPerfil />
      </View>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: fim, gap: 14 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <HeroiDasAmigas ceu={ceu} />
        {corpo}
      </ScrollView>
      {aviso}
    </SafeAreaView>
  );
}

/**
 * O topo da aba: a bolha apaixonada solta no céu, com a frase ao lado — o que
 * a faixa cor-de-rosa dizia numa imagem, agora em texto de verdade (o leitor
 * de tela lê, e a letra não fica borrada).
 */
function HeroiDasAmigas({ ceu }: { ceu: Ceu | null }) {
  const sombraDoCeu = ceu ? sombraDoTexto(ceu) : null;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      <BolhaViva humor="apaixonado" tamanho={132} />
      {/* A coluna do texto para antes da lua e do sol, que ficam à direita. */}
      <View style={{ flex: 1, paddingRight: 66 }}>
        <Text
          style={{
            ...fonte.titulo,
            fontSize: 24,
            lineHeight: 28,
            letterSpacing: aperto.subtitulo,
            color: ceu?.tinta ?? tinta.titulo,
            ...sombraDoCeu,
          }}
        >
          Amizade que faz bem
        </Text>
        <Text
          style={{
            marginTop: 4,
            ...fonte.media,
            fontSize: 14,
            lineHeight: 20,
            color: ceu?.sec ?? tinta.sub,
            ...sombraDoCeu,
          }}
        >
          Convide suas amigas, formem duplas e joguem juntas! Quanto mais conexão, mais recompensas!
        </Text>
      </View>
    </View>
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
      <Text style={{ ...fonte.titulo, fontSize: 14, color: cheio ? cor.branco : tinta.sub }}>
        {rotulo}
      </Text>
    </Pressable>
  );
}
