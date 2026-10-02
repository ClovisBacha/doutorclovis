import { ChevronLeft, ChevronRight, Lock } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { babyForWeek, fruitEmojiForWeek } from "@/lib/gestacao";
import { Botao, Cartao, Carregando, T, Tela } from "~/componentes/base";
import { corJornada } from "~/componentes/jornada/cores";
import { BarraDoTopo, BotaoRedondo, Estrelas, voltarParaJornada } from "~/componentes/jornada/pecas";
import { useJornada } from "~/componentes/jornada/usarJornada";
import {
  D_MINIMO,
  dataDoDia,
  diaCurto,
  diaNaSemana,
  diasDaSemana,
  quandoAbre,
  SEMANA_MINIMA,
  temaDoDia,
} from "~/lib/jornada/dia";
import { CHAVE_FIGURINHAS, listaDeNumeros } from "~/lib/jornada/momentos";
import { estadoDoNo } from "~/lib/jornada/trilha";
import { cor, espaco, fonte, raio } from "~/tema";

/**
 * A SEMANA — os sete dias com o tema de cada um e o que foi feito, e as
 * semanas anteriores para trás. Dia passado mostra só se foi feito (não reabre
 * nada); dia futuro mostra quando abre.
 *
 * Bancada: /jornada/semana?bancada=1 [&semana=38]
 */
export default function Semana() {
  const { dia, loja } = useJornada();
  const atual = dia.modo === "gestacao" ? dia.semana : null;
  const [semana, setSemana] = useState<number | null>(atual);
  useEffect(() => {
    if (semana == null && atual != null) setSemana(atual);
  }, [atual, semana]);

  if (dia.modo === "carregando") {
    return (
      <Tela bordas={["top", "bottom"]}>
        <Carregando />
      </Tela>
    );
  }
  if (dia.modo !== "gestacao" || dia.cuidado || semana == null || atual == null) {
    return (
      <Tela bordas={["top", "bottom"]}>
        <BarraDoTopo titulo="A semana" />
        <T>A trilha das semanas acompanha a gestação. Os seus momentos de hoje continuam na jornada.</T>
        <Botao rotulo="Voltar" aoTocar={voltarParaJornada} corFundo={corJornada.roxo} />
      </Tela>
    );
  }

  const { D: hojeD, hoje } = dia;
  const dias = diasDaSemana(semana).filter((D) => D >= D_MINIMO);
  const bebe = babyForWeek(semana);
  const fechadosNaSemana = dias.filter((D) => {
    const n = estadoDoNo(loja.blob, D, hojeD);
    return n.tipo !== "futuro" && n.fechado;
  }).length;
  const figurinha = listaDeNumeros(loja.blob[CHAVE_FIGURINHAS]).includes(semana);

  return (
    <Tela bordas={["top", "bottom"]}>
      <BarraDoTopo titulo="A semana" />
      <View style={{ flexDirection: "row", alignItems: "center", gap: espaco.sm }}>
        <BotaoRedondo
          rotulo="Semana anterior"
          aoTocar={() => setSemana((s) => Math.max(SEMANA_MINIMA, (s ?? atual) - 1))}
          fundo={semana > SEMANA_MINIMA ? corJornada.roxoFundo : cor.apagado}
        >
          <ChevronLeft size={22} color={semana > SEMANA_MINIMA ? corJornada.roxo : cor.borda} />
        </BotaoRedondo>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={{ fontFamily: fonte.titulo, fontSize: 24, color: cor.texto }}>
            {fruitEmojiForWeek(semana)} Semana {semana}
          </Text>
          <T tipo="apagado">
            {semana === atual ? "esta semana · " : ""}
            {bebe.fruit} · {bebe.size}
          </T>
        </View>
        <BotaoRedondo
          rotulo="Próxima semana"
          aoTocar={() => setSemana((s) => Math.min(atual, (s ?? atual) + 1))}
          fundo={semana < atual ? corJornada.roxoFundo : cor.apagado}
        >
          <ChevronRight size={22} color={semana < atual ? corJornada.roxo : cor.borda} />
        </BotaoRedondo>
      </View>

      <Cartao estilo={{ padding: 0, gap: 0, overflow: "hidden" }}>
        {dias.map((D, i) => {
          const no = estadoDoNo(loja.blob, D, hojeD);
          const tema = temaDoDia(D);
          const data = dataDoDia(D, hojeD, hoje);
          const ehHoje = no.tipo === "hoje";
          return (
            <View
              key={D}
              accessible
              accessibilityLabel={`Dia ${diaNaSemana(D)}, ${tema.rotulo}, ${
                no.tipo === "futuro" ? `abre ${quandoAbre(D, hojeD, hoje)}` : `${no.momentos} de 5 momentos`
              }`}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: espaco.md,
                paddingHorizontal: espaco.lg,
                paddingVertical: espaco.md,
                minHeight: 64,
                backgroundColor: ehHoje ? corJornada.roxoNevoa : "transparent",
                borderBottomWidth: i === dias.length - 1 ? 0 : 1,
                borderBottomColor: "#f3ece8",
              }}
            >
              <View style={{ width: 44, alignItems: "center" }}>
                <Text style={{ fontFamily: fonte.titulo, fontSize: 18, color: ehHoje ? corJornada.roxo : cor.texto }}>
                  {String(data.getDate()).padStart(2, "0")}
                </Text>
                <Text style={{ fontFamily: fonte.media, fontSize: 13, color: cor.textoApagado }}>
                  {ehHoje ? "hoje" : diaCurto(data)}
                </Text>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ fontFamily: fonte.forte, fontSize: 15, color: no.tipo === "futuro" ? cor.textoApagado : cor.texto }}>
                  {tema.emoji} {tema.rotulo}
                </Text>
                <Text style={{ fontFamily: fonte.normal, fontSize: 13, color: cor.textoApagado }}>
                  {no.tipo === "futuro"
                    ? `Abre ${quandoAbre(D, hojeD, hoje)}`
                    : no.fechado
                      ? "Cinco estrelas"
                      : no.momentos === 0
                        ? ehHoje
                          ? "Esperando por você"
                          : "Sem momentos neste dia"
                        : `${no.momentos} de 5 momentos`}
                </Text>
              </View>
              {no.tipo === "futuro" ? (
                <Lock size={18} color={cor.textoApagado} />
              ) : (
                <Estrelas feitos={no.momentos} tamanho={14} />
              )}
            </View>
          );
        })}
      </Cartao>

      <View
        style={{
          borderRadius: raio.lg,
          padding: espaco.lg,
          backgroundColor: figurinha ? corJornada.trofeuFundo : cor.apagado,
          flexDirection: "row",
          alignItems: "center",
          gap: espaco.md,
        }}
      >
        <Text style={{ fontSize: 36, opacity: figurinha ? 1 : 0.35 }}>{fruitEmojiForWeek(semana)}</Text>
        <View style={{ flex: 1 }}>
          <T tipo="rotulo">
            {figurinha ? "Figurinha da semana conquistada!" : "Figurinha da semana"}
          </T>
          <T tipo="apagado">
            {figurinha
              ? `${fechadosNaSemana} ${fechadosNaSemana === 1 ? "dia" : "dias"} de cinco estrelas nesta semana.`
              : "Ela vem no primeiro dia de cinco estrelas da semana."}
          </T>
        </View>
      </View>
    </Tela>
  );
}
