import { Flame, Sprout, Trophy } from "lucide-react-native";
import { useState, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { T, toque } from "~/componentes/base";
import { corJornada } from "~/componentes/jornada/cores";
import { Folha } from "~/componentes/jornada/pecas";
import { explicacaoDaChama } from "~/lib/jornada/trilha";
import { ALVO_MINIMO, cor, espaco, fonte, raio } from "~/tema";

/**
 * O PLACAR DO TOPO: sementinhas 🌱, chama 🔥 e troféus 🏆. Cada um abre uma
 * folha que explica de onde ele vem — número sem explicação é número que
 * ninguém persegue.
 *
 * `saldo`/`trofeus` null = a carteira não carregou: mostra "—", nunca 0
 * (zero afirma um saldo; o traço admite que não sabemos).
 */
export function Placar({
  saldo,
  trofeus,
  chama,
  perdoes,
  carregando,
  mostrarChama = true,
  pos = false,
}: {
  saldo: number | null;
  trofeus: number | null;
  chama: number;
  perdoes: number;
  carregando: boolean;
  mostrarChama?: boolean;
  /** Pós-parto: os momentos do dia não somam sementinhas (o servidor só paga na gestação). */
  pos?: boolean;
}) {
  const [aberta, setAberta] = useState<null | "sementes" | "chama" | "trofeus">(null);
  const fmt = (n: number | null) => (carregando ? "…" : n == null ? "—" : String(n));
  return (
    <>
      <View style={{ flexDirection: "row", gap: espaco.sm }}>
        <Pilar
          rotulo={`Sementinhas: ${fmt(saldo)}`}
          icone={<Sprout size={20} color={corJornada.sementinha} strokeWidth={2.4} />}
          valor={fmt(saldo)}
          fundo={corJornada.sementinhaFundo}
          corValor={corJornada.sementinha}
          aoTocar={() => setAberta("sementes")}
        />
        {mostrarChama ? (
          <Pilar
            rotulo={`Chama: ${chama} ${chama === 1 ? "dia seguido" : "dias seguidos"}`}
            icone={
              <Flame
                size={20}
                color={chama > 0 ? corJornada.chama : cor.textoApagado}
                fill={chama > 0 ? "#fdba74" : "transparent"}
                strokeWidth={2.4}
              />
            }
            valor={String(chama)}
            fundo={chama > 0 ? corJornada.chamaFundo : cor.apagado}
            corValor={chama > 0 ? corJornada.chama : cor.textoApagado}
            aoTocar={() => setAberta("chama")}
          />
        ) : null}
        <Pilar
          rotulo={`Troféus: ${fmt(trofeus)}`}
          icone={<Trophy size={20} color={corJornada.trofeu} strokeWidth={2.4} />}
          valor={fmt(trofeus)}
          fundo={corJornada.trofeuFundo}
          corValor={corJornada.trofeu}
          aoTocar={() => setAberta("trofeus")}
        />
      </View>

      <Folha aberta={aberta === "chama"} aoFechar={() => setAberta(null)} titulo="🔥 A sua chama">
        {explicacaoDaChama(chama, perdoes).map((l, i) => (
          <T key={i} tipo={i === 0 ? "rotulo" : "corpo"}>
            {l}
          </T>
        ))}
      </Folha>

      <Folha aberta={aberta === "sementes"} aoFechar={() => setAberta(null)} titulo="🌱 Sementinhas">
        {pos ? (
          <T>No pós-parto, os momentos do dia são só seus: eles acendem a chama, sem somar sementinhas. As conquistas continuam rendendo quando você as resgata.</T>
        ) : (
          <>
            <T>Você ganha sementinhas cuidando de você e aprendendo, todo dia:</T>
            <View style={{ gap: 6 }}>
              <LinhaDeGanho rotulo="Abrir a jornada no dia" valor="+5" />
              <LinhaDeGanho rotulo="A aula de hoje" valor="+5, e +3 por acerto" />
              <LinhaDeGanho rotulo="Mexer, meditar, a carta e a gratidão" valor="+5 cada" />
              <LinhaDeGanho rotulo="Fechar as cinco estrelas do dia" valor="+20" />
              <LinhaDeGanho rotulo="Resgatar uma conquista" valor="+15, +40 ou +120" />
            </View>
          </>
        )}
        {pos ? null : <T tipo="apagado">Os momentos valem no dia em que acontecem.</T>}
      </Folha>

      <Folha aberta={aberta === "trofeus"} aoFechar={() => setAberta(null)} titulo="🏆 Troféus">
        <T>Cada dia em que você fecha os cinco momentos — a aula e as quatro atividades — vira um troféu.</T>
        <T tipo="apagado">
          {trofeus == null
            ? "Não conseguimos carregar a sua contagem agora."
            : trofeus === 0
              ? "O primeiro vem no dia das cinco estrelas."
              : `Você já tem ${trofeus} ${trofeus === 1 ? "troféu" : "troféus"}.`}
        </T>
      </Folha>
    </>
  );
}

function Pilar({
  rotulo,
  icone,
  valor,
  fundo,
  corValor,
  aoTocar,
}: {
  rotulo: string;
  icone: ReactNode;
  valor: string;
  fundo: string;
  corValor: string;
  aoTocar: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      accessibilityHint="Explica de onde vem"
      onPress={() => {
        toque();
        aoTocar();
      }}
      style={({ pressed }) => ({
        flex: 1,
        minHeight: ALVO_MINIMO + 4,
        borderRadius: raio.pilula,
        backgroundColor: fundo,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        paddingHorizontal: espaco.sm,
        opacity: pressed ? 0.75 : 1,
      })}
    >
      {icone}
      <Text
        style={{ fontFamily: fonte.titulo, fontSize: 18, color: corValor, fontVariant: ["tabular-nums"] }}
      >
        {valor}
      </Text>
    </Pressable>
  );
}

function LinhaDeGanho({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: espaco.sm,
        paddingVertical: 8,
        paddingHorizontal: espaco.md,
        backgroundColor: cor.cartao,
        borderRadius: raio.sm,
      }}
    >
      <Text style={{ flex: 1, fontFamily: fonte.media, fontSize: 15, color: cor.texto }}>{rotulo}</Text>
      <Text style={{ fontFamily: fonte.forte, fontSize: 15, color: corJornada.sementinha }}>{valor}</Text>
    </View>
  );
}
