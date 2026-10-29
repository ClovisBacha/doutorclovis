import { router, useFocusEffect } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import { useCallback, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { tempoNoApp, ultimaVez } from "@/lib/amigas";
import { toque } from "~/componentes/base";
import { irParaAba } from "~/componentes/cabecalho";
import {
  cobrarOBonus,
  lerAmigas,
  lerPedidos,
  type LeituraDasAmigas,
} from "~/componentes/amigas/economia";
import { Avatar, tinta } from "~/componentes/amigas/pecas";
import { sombraDe } from "~/componentes/jornada/atividade";
import { rota } from "~/componentes/jornada/bancada";
import {
  corDaUltimaVez,
  linhaDaDuplaNoHoje,
  primeiroNomeDaAmiga,
  rostosDaFaixa,
} from "~/lib/jornada/amigas";
import { mudarSelos, seloDasAmigas } from "~/lib/selos";
import { ALVO_MINIMO, cor, espaco, fonte } from "~/tema";

const ROSTOS = 5;

/**
 * AS AMIGAS NO HOJE (fase 3, a rede social no centro) — antes, o Hoje da
 * gestação não tinha nada social, e as amigas só apareciam como um número na
 * faixa da trilha.
 *
 * Os rostos de quem apareceu por último (o pontinho de "vista há", nunca
 * "online"), a dupla (só na gestação: no pós-parto ela não acende — decisão do
 * dono), os pedidos que esperam, e o convite quando ainda não há ninguém. Tudo
 * leva à aba das Amigas, onde se responde; um rosto leva ao Cantinho dela.
 *
 * O bônus da dupla (+10 🌱 quando AS DUAS fecharam o dia) é cobrado aqui
 * também, ao voltar para o Hoje — antes, só ao abrir a aba das Amigas, e quem
 * não a abria não recebia. O servidor confere e não paga duas vezes.
 *
 * Leitura que falhou não desenha nada: é um extra do Hoje, e a aba das Amigas
 * diz "não consegui ler" no lugar certo.
 */
export function AmigasNoHoje({ pos }: { pos: boolean }) {
  const [leitura, setLeitura] = useState<LeituraDasAmigas | null>(null);
  const [pedidos, setPedidos] = useState(0);
  const [ganho, setGanho] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let vivo = true;
      void Promise.all([lerAmigas(), lerPedidos()]).then(([l, p]) => {
        if (!vivo) return;
        setLeitura(l);
        setPedidos(p.length);
        if (!l) return;
        mudarSelos({ amigas: l.careMode ? 0 : seloDasAmigas(p.length, l.dupla, pos) });
        if (!pos && !l.careMode && l.dupla?.estado === "ativa") {
          void cobrarOBonus().then((g) => {
            if (vivo && g > 0) setGanho((x) => x + g);
          });
        }
      });
      return () => {
        vivo = false;
      };
    }, [pos]),
  );

  if (!leitura || leitura.careMode) return null;
  const { amigas, dupla } = leitura;
  const { rostos, mais } = rostosDaFaixa(amigas, ROSTOS);
  const linhaDaDupla = linhaDaDuplaNoHoje(dupla, amigas.length > 0, pos);
  const abrirAmigas = () => {
    toque();
    irParaAba(rota("/amigas") as never);
  };

  return (
    <View
      style={{
        borderRadius: 20,
        backgroundColor: cor.branco,
        padding: 14,
        gap: 12,
        ...sombraDe("#b0708d", 0.6),
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Suas amigas. Abrir as Amigas"
        onPress={abrirAmigas}
        style={{ flexDirection: "row", alignItems: "center", minHeight: ALVO_MINIMO - 8 }}
      >
        <Text
          accessibilityRole="header"
          style={{ flex: 1, fontFamily: fonte.titulo, fontSize: 18, color: "#3a2230" }}
        >
          Suas amigas
        </Text>
        <Text style={{ fontFamily: fonte.titulo, fontSize: 14, color: "#b0306a" }}>
          {amigas.length ? "Ver todas" : "Abrir"}
        </Text>
        <ChevronRight size={18} color="#b0306a" />
      </Pressable>

      {rostos.length ? (
        <View style={{ flexDirection: "row", gap: 10 }}>
          {rostos.map((a) => {
            const vista = ultimaVez(a.vistaEm);
            return (
              <Pressable
                key={a.id}
                accessibilityRole="button"
                accessibilityLabel={`${a.nome}. ${vista ? `Vista ${vista}` : tempoNoApp(a.diasNoApp)}. Abrir o Cantinho dela`}
                onPress={() => {
                  toque();
                  router.push(rota(`/amigas/${a.id}`) as never);
                }}
                style={({ pressed }) => ({
                  width: 56,
                  alignItems: "center",
                  gap: 4,
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                <View>
                  <Avatar nome={a.nome} id={a.id} url={a.avatarUrl} tamanho={50} />
                  {vista ? (
                    <View
                      style={{
                        position: "absolute",
                        right: 0,
                        bottom: 1,
                        width: 14,
                        height: 14,
                        borderRadius: 7,
                        backgroundColor: corDaUltimaVez(vista),
                        borderWidth: 2,
                        borderColor: cor.branco,
                      }}
                    />
                  ) : null}
                </View>
                <Text
                  numberOfLines={1}
                  style={{ fontFamily: fonte.media, fontSize: 13, color: tinta.sub }}
                >
                  {primeiroNomeDaAmiga(a.nome)}
                </Text>
              </Pressable>
            );
          })}
          {mais > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Mais ${mais} amigas. Abrir as Amigas`}
              onPress={abrirAmigas}
              style={{ width: 56, alignItems: "center", gap: 4 }}
            >
              <View
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: 25,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "#f6e9fb",
                }}
              >
                <Text style={{ fontFamily: fonte.titulo, fontSize: 15, color: tinta.violeta }}>
                  +{mais}
                </Text>
              </View>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <Text style={{ fontFamily: fonte.media, fontSize: 14, lineHeight: 20, color: "#9a7486" }}>
          Convide uma amiga pelo seu link: vocês duas ganham sementinhas, e ela aparece aqui.
        </Text>
      )}

      {linhaDaDupla ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${linhaDaDupla}. Abrir a dupla`}
          onPress={abrirAmigas}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            gap: espaco.sm,
            minHeight: ALVO_MINIMO,
            borderRadius: 14,
            backgroundColor: tinta.ambarFundo,
            paddingHorizontal: 12,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Text style={{ flex: 1, fontFamily: fonte.titulo, fontSize: 14, color: tinta.ambar }}>
            {linhaDaDupla}
          </Text>
          {ganho > 0 ? (
            <Text style={{ fontFamily: fonte.titulo, fontSize: 13, color: "#15803d" }}>
              +{ganho} 🌱 hoje
            </Text>
          ) : null}
        </Pressable>
      ) : null}

      {pedidos > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${pedidos} ${pedidos === 1 ? "pedido" : "pedidos"} de amizade. Responder nas Amigas`}
          onPress={abrirAmigas}
          style={{ flexDirection: "row", alignItems: "center", minHeight: ALVO_MINIMO - 4 }}
        >
          <Text style={{ flex: 1, fontFamily: fonte.titulo, fontSize: 14, color: tinta.rosa }}>
            💛 {pedidos === 1 ? "Um pedido de amizade" : `${pedidos} pedidos de amizade`}
          </Text>
          <Text style={{ fontFamily: fonte.titulo, fontSize: 14, color: tinta.rosa }}>
            Responder ›
          </Text>
        </Pressable>
      ) : null}

      {!amigas.length ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Convidar uma amiga"
          onPress={abrirAmigas}
          style={({ pressed }) => ({
            alignSelf: "flex-start",
            minHeight: ALVO_MINIMO,
            justifyContent: "center",
            borderRadius: 999,
            backgroundColor: tinta.rosa,
            paddingHorizontal: espaco.lg,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Text style={{ fontFamily: fonte.titulo, fontSize: 14, color: cor.branco }}>
            Convidar uma amiga
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
