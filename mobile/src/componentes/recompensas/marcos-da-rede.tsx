import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { lerAmigas } from "~/componentes/amigas/economia";
import { useDiaDaJornada } from "~/componentes/jornada/usarJornada";
import { corRecompensas } from "~/componentes/recompensas/cores";
import { lerAIndicacao } from "~/componentes/recompensas/economia-do-cantinho";
import { gravarJson, lerJson } from "~/lib/armazem";
import { ehBancada } from "~/lib/bancada";
import { api } from "~/lib/comunidade/api";
import { marcosFeitosAgora, marcosNaTela, type MarcoNaTela } from "~/lib/jornada/marcos-da-rede";
import { useSessao } from "~/lib/sessao";
import { cor, espaco, fonte } from "~/tema";

/**
 * OS MARCOS DA SUA REDE — os atos sociais na aba das Conquistas (fase 3).
 *
 * O catálogo de conquistas é do site e só o servidor as paga; nenhuma é por
 * ato social. Os marcos são do app: saem do que o servidor já devolve (as
 * amigas e o recorde da dupla, os convites aceitos, as publicações), e a tela
 * diz sem rodeio que não valem sementinhas.
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
        api.verPerfil(uid),
        ehBancada() ? Promise.resolve([] as string[]) : lerJson<string[]>(chave, []),
      ]);
      const agora = marcosFeitosAgora({
        amigas: amigas ? amigas.amigas.length : null,
        recordeDaDupla: amigas ? (amigas.dupla?.recorde ?? 0) : null,
        convites: indicacao ? indicacao.amigas : null,
        publicacoes: perfil.ok ? perfil.posts.length : null,
      });
      if (!vivo) return;
      setMarcos(marcosNaTela({ agora, guardados, pos }));
      if (!ehBancada()) void gravarJson(chave, Array.from(new Set([...guardados, ...agora])));
    })();
    return () => {
      vivo = false;
    };
  }, [uid, pos]);

  if (!marcos) return null;
  const ganhos = marcos.filter((m) => m.ganho).length;
  const linhas: MarcoNaTela[][] = [];
  for (let i = 0; i < marcos.length; i += 2) linhas.push(marcos.slice(i, i + 2));

  return (
    <View>
      <Text
        accessibilityRole="header"
        style={{ marginBottom: 4, fontFamily: fonte.media, fontSize: 16, color: cor.texto }}
      >
        👭 Marcos da sua rede · {ganhos} de {marcos.length}
      </Text>
      <Text
        style={{
          marginBottom: espaco.md,
          fontFamily: fonte.normal,
          fontSize: 13,
          lineHeight: 18,
          color: cor.textoApagado,
        }}
      >
        Estes não valem sementinhas: são a rede que você está formando.
      </Text>
      <View style={{ gap: espaco.md }}>
        {linhas.map((par, i) => (
          <View key={i} style={{ flexDirection: "row", gap: espaco.md, alignItems: "stretch" }}>
            {par.map((m) => (
              <CartaoDoMarco key={m.chave} m={m} />
            ))}
            {par.length === 1 ? <View style={{ flex: 1 }} /> : null}
          </View>
        ))}
      </View>
    </View>
  );
}

function CartaoDoMarco({ m }: { m: MarcoNaTela }) {
  return (
    <View
      accessible
      accessibilityLabel={`${m.titulo}. ${m.texto} ${m.ganho ? "Feito" : "Ainda não"}${m.novo ? ", novo" : ""}.`}
      style={{
        flex: 1,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: m.ganho ? "#f3c6d8" : cor.borda,
        backgroundColor: m.ganho ? "#fdf0f5" : corRecompensas.secundaria20,
        padding: espaco.lg,
        alignItems: "center",
        opacity: m.ganho ? 1 : 0.55,
      }}
    >
      <Text style={{ fontSize: 30, lineHeight: 36, marginBottom: espaco.sm }}>{m.emoji}</Text>
      <Text
        style={{ fontFamily: fonte.media, fontSize: 13, textAlign: "center", color: cor.texto }}
      >
        {m.titulo}
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
        {m.texto}
      </Text>
      <Text
        style={{
          marginTop: 6,
          fontFamily: fonte.forte,
          fontSize: 13,
          letterSpacing: 0.4,
          textTransform: "uppercase",
          color: m.ganho ? "#b0306a" : corRecompensas.apagado60,
        }}
      >
        {m.novo ? "Novo 💛" : m.ganho ? "Feito ✓" : "Ainda não"}
      </Text>
    </View>
  );
}
