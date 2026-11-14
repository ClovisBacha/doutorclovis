import { fruitEmojiForWeek, trimesterForWeek } from "@/lib/gestacao";
import { router } from "expo-router";
import { ChevronRight, HeartHandshake } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { toque } from "~/componentes/base";
import { sombraDe } from "~/componentes/jornada/atividade";
import { bebeDaSemana, retaFinalNoApp } from "~/lib/bebe-da-semana";
import { ferramentasDaGestacao, NOME_DOS_MOVIMENTOS } from "~/lib/ferramentas";
import { dataCurta, dataProvavel, diasAteADpp, fracaoDaGestacao } from "~/lib/inicio";
import { semGeneroDoBebe } from "~/lib/nutricao/frase-do-topo";
import { ALVO_MINIMO, cor, espaco, fonte } from "~/tema";

/* As tintas da tela do bebê (`hoje.tsx`): o rosa do anel e os textos vinho. */
const TINTA = "#e8578f";
const TRILHO = "#f6dbe6";
const TEXTO = "#3a2230";
const APAGADO = "#9a7486";
const LINK = "#b0306a";

/**
 * O BEBÊ NESTA SEMANA — o acompanhamento, na tela do bebê (a aba do meio, que
 * abre o app; decisão do dono, 13/11/2026: "o bebê é o centro [...] esse
 * acompanhamento que é a alma do aplicativo").
 *
 * O céu do topo já diz a semana, a fruta, o tamanho e quantos dias faltam;
 * aqui fica o resto do que a aba Bebê mostrava: o peso, a frase da semana, a
 * data provável com a barra da gestação, a reta final, o semana a semana e os
 * movimentos do bebê. No desenho da tela do bebê, e não no da aba antiga, para
 * a tela inteira conversar entre si.
 */
export function BebeNestaSemana({
  semana,
  totalDias,
  nomeDoBebe,
}: {
  semana: number;
  totalDias: number;
  nomeDoBebe: string | null;
}) {
  const bebe = bebeDaSemana(semana);
  const faltam = diasAteADpp(totalDias);
  const reta = retaFinalNoApp(semana);
  const { movimentos } = ferramentasDaGestacao({ semanas: semana, cuidado: false, nasceu: false });
  const dpp = dataCurta(dataProvavel(totalDias));
  const fracao = Math.min(1, Math.max(0, fracaoDaGestacao(totalDias)));

  return (
    <View
      style={{
        borderRadius: 20,
        backgroundColor: cor.branco,
        padding: 14,
        gap: espaco.md,
        ...sombraDe("#b0708d", 0.6),
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: espaco.sm }}>
        <Text
          accessibilityRole="header"
          numberOfLines={1}
          style={{ flex: 1, fontFamily: fonte.titulo, fontSize: 18, color: TEXTO }}
        >
          {nomeDoBebe ? `${nomeDoBebe} nesta semana` : "O bebê nesta semana"}
        </Text>
        <View
          style={{
            borderRadius: 999,
            backgroundColor: "#fdeef4",
            paddingHorizontal: 10,
            paddingVertical: 4,
          }}
        >
          <Text style={{ fontFamily: fonte.forte, fontSize: 12, color: LINK }}>
            {trimesterForWeek(semana)}º trimestre
          </Text>
        </View>
      </View>

      <View style={{ flexDirection: "row", gap: espaco.sm }}>
        <Medida titulo="Tamanho" valor={bebe.size} />
        <Medida titulo="Peso" valor={bebe.weight} />
        <Medida titulo="Como" valor={`${fruitEmojiForWeek(semana)} ${bebe.fruit}`} />
      </View>

      <Text style={{ fontFamily: fonte.media, fontSize: 15, lineHeight: 22, color: "#5b3a4a" }}>
        {semGeneroDoBebe(bebe.desc)}
      </Text>

      <View
        accessible
        accessibilityLabel={
          faltam > 0
            ? `Data provável ${dpp}. Faltam ${faltam} ${faltam === 1 ? "dia" : "dias"}.`
            : `Data provável ${dpp}.`
        }
      >
        <View style={{ height: 8, borderRadius: 999, backgroundColor: TRILHO, overflow: "hidden" }}>
          <View
            style={{
              width: `${Math.round(fracao * 100)}%`,
              height: 8,
              borderRadius: 999,
              backgroundColor: TINTA,
            }}
          />
        </View>
        <Text style={{ marginTop: 6, fontFamily: fonte.media, fontSize: 13, color: APAGADO }}>
          Data provável: {dpp}
          {faltam > 0 ? ` · faltam ${faltam} ${faltam === 1 ? "dia" : "dias"}` : ""}
        </Text>
      </View>

      {reta ? (
        <View style={{ borderRadius: 14, backgroundColor: "#fff1e6", padding: 12, gap: 2 }}>
          <Text style={{ fontFamily: fonte.forte, fontSize: 14, color: "#8a4d2a" }}>
            {reta.titulo}
          </Text>
          <Text style={{ fontFamily: fonte.media, fontSize: 13, lineHeight: 19, color: "#8a5a3c" }}>
            {reta.corpo}
          </Text>
        </View>
      ) : null}

      <View style={{ borderTopWidth: 1, borderTopColor: "#f6e6ee" }}>
        <Porta
          titulo="Ver semana a semana"
          rotulo={`Ver ${nomeDoBebe ?? "o bebê"} semana a semana`}
          aoTocar={() => router.push("/bebe")}
        />
        {movimentos ? (
          <Porta
            titulo={NOME_DOS_MOVIMENTOS}
            rotulo={`${NOME_DOS_MOVIMENTOS}: conte as mexidinhas, no seu tempo`}
            icone
            aoTocar={() => router.push("/saude/chutes")}
          />
        ) : null}
      </View>
    </View>
  );
}

function Medida({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <View style={{ flex: 1, borderRadius: 14, backgroundColor: "#fff5f9", padding: 10, gap: 2 }}>
      <Text style={{ fontFamily: fonte.media, fontSize: 13, color: APAGADO }}>{titulo}</Text>
      <Text numberOfLines={2} style={{ fontFamily: fonte.forte, fontSize: 14, color: TEXTO }}>
        {valor}
      </Text>
    </View>
  );
}

function Porta({
  titulo,
  rotulo,
  icone = false,
  aoTocar,
}: {
  titulo: string;
  rotulo: string;
  icone?: boolean;
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
      style={({ pressed }) => ({
        minHeight: ALVO_MINIMO,
        flexDirection: "row",
        alignItems: "center",
        gap: espaco.sm,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      {icone ? <HeartHandshake size={18} color={LINK} /> : null}
      <Text style={{ flex: 1, fontFamily: fonte.titulo, fontSize: 14, color: LINK }}>{titulo}</Text>
      <ChevronRight size={18} color={LINK} />
    </Pressable>
  );
}
