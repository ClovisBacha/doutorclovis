import Check from "lucide-react-native/icons/check";
import Lock from "lucide-react-native/icons/lock";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { Cartao } from "~/componentes/base";
import { lerAmigas } from "~/componentes/amigas/economia";
import { useDiaDaJornada } from "~/componentes/jornada/usarJornada";
import { lerAIndicacao } from "~/componentes/recompensas/economia-do-cantinho";
import { Contagem, SecaoComArte } from "~/componentes/recompensas/pecas";
import { gravarJson, lerJson } from "~/lib/armazem";
import { ehBancada } from "~/lib/bancada";
import { api } from "~/lib/comunidade/api";
import { marcosFeitosAgora, marcosNaTela, type MarcoNaTela } from "~/lib/jornada/marcos-da-rede";
import { useSessao } from "~/lib/sessao";
import { canto, cor, curva, escala, espaco, fonte, sombra } from "~/tema";
import { COMUNIDADE_NO_APP } from "~/config";

/**
 * OS MARCOS DA SUA REDE — os atos sociais na aba das Conquistas (fase 3).
 *
 * O catálogo de conquistas é do site e só o servidor as paga; nenhuma é por
 * ato social. Os marcos são do app: saem do que o servidor já devolve (as
 * amigas e o recorde da dupla, os convites aceitos, as publicações), e a tela
 * diz sem rodeio que não valem sementinhas.
 *
 * Desenho (18/11/2026): uma lista agrupada, e não mais medalhas — não são
 * troféus, e a lista deixa ler o que cada um quer dizer. O que ainda não
 * aconteceu tem a arte apagada; o texto fica pleno.
 *
 * Marco ganho fica ganho: o que já foi feito é guardado no aparelho, por conta
 * (`dc-` — sai junto com a conta), e uma dupla desfeita não "desconquista"
 * nada. Na bancada nada é guardado.
 */
export function MarcosDaRede() {
  const { sessao } = useSessao();
  const uid = sessao?.user.id ?? null;
  const pos = useDiaDaJornada().modo === "pos";
  const [marcos, setMarcos] = useState<MarcoNaTela[] | null>(null);

  useEffect(() => {
    if (!uid) return;
    let vivo = true;
    const chave = `dc-marcos-da-rede:${uid}`;
    void (async () => {
      const [amigas, indicacao, perfil, guardados] = await Promise.all([
        lerAmigas(),
        lerAIndicacao(),
        COMUNIDADE_NO_APP ? api.verPerfil(uid) : Promise.resolve(null),
        ehBancada() ? Promise.resolve([] as string[]) : lerJson<string[]>(chave, []),
      ]);
      const agora = marcosFeitosAgora({
        amigas: amigas ? amigas.amigas.length : null,
        recordeDaDupla: amigas ? (amigas.dupla?.recorde ?? 0) : null,
        convites: indicacao ? indicacao.amigas : null,
        publicacoes: perfil?.ok ? perfil.posts.length : null,
      });
      if (!vivo) return;
      setMarcos(marcosNaTela({ agora, guardados, pos, comunidade: COMUNIDADE_NO_APP }));
      if (!ehBancada()) void gravarJson(chave, Array.from(new Set([...guardados, ...agora])));
    })();
    return () => {
      vivo = false;
    };
  }, [uid, pos]);

  if (!marcos) return null;
  const ganhos = marcos.filter((m) => m.ganho).length;

  return (
    <View style={{ gap: espaco.md }}>
      <SecaoComArte
        titulo="Marcos da sua rede"
        direita={<Contagem texto={`${ganhos} de ${marcos.length}`} />}
      />
      <Text style={{ ...fonte.normal, ...escala.legenda, color: cor.textoApagado }}>
        Estes não valem sementinhas. Mostram a rede que você está formando.
      </Text>
      <Cartao estilo={{ padding: 0, gap: 0 }}>
        {marcos.map((m, i) => (
          <LinhaDoMarco key={m.chave} m={m} primeira={i === 0} />
        ))}
      </Cartao>
    </View>
  );
}

function LinhaDoMarco({ m, primeira }: { m: MarcoNaTela; primeira: boolean }) {
  return (
    <View
      accessible
      accessibilityLabel={`${m.titulo}. ${m.texto} ${m.ganho ? "Feito" : "Ainda não"}${m.novo ? ", novo" : ""}.`}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: espaco.md,
        paddingHorizontal: espaco.lg,
        paddingVertical: espaco.md,
        borderTopWidth: primeira ? 0 : 1,
        borderTopColor: cor.divisor,
      }}
    >
      <View style={{ width: 48, height: 48 }}>
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: m.ganho ? cor.destaque : cor.apagado,
            borderWidth: 2,
            borderColor: m.ganho ? cor.primariaSuave : cor.trilho,
          }}
        >
          <Text
            allowFontScaling={false}
            style={{ fontSize: 22, lineHeight: 28, opacity: m.ganho ? 1 : 0.3 }}
          >
            {m.emoji}
          </Text>
        </View>
        {m.ganho ? null : (
          <View
            style={[
              {
                position: "absolute",
                right: -3,
                bottom: -3,
                width: 20,
                height: 20,
                borderRadius: 10,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: cor.cartao,
              },
              sombra,
            ]}
          >
            <Lock size={10} color={cor.textoApagado} strokeWidth={2.4} />
          </View>
        )}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ ...fonte.forte, ...escala.legenda, color: cor.texto }}>{m.titulo}</Text>
        <Text style={{ ...fonte.normal, ...escala.nota, color: cor.textoApagado }}>{m.texto}</Text>
      </View>
      {m.novo ? (
        <View
          style={{
            borderRadius: canto.pilula,
            ...curva,
            backgroundColor: cor.destaque,
            paddingHorizontal: espaco.sm,
            paddingVertical: 2,
          }}
        >
          <Text style={{ ...fonte.forte, ...escala.nota, color: cor.textoDestaque }}>Novo</Text>
        </View>
      ) : m.ganho ? (
        <Check size={18} color={cor.primaria} strokeWidth={2.6} />
      ) : null}
    </View>
  );
}
