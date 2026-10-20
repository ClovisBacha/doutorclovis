import { ChevronLeft, ChevronRight } from "lucide-react-native";
import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { toque } from "~/componentes/base";
import { nomeDoMes, semanasDoMes } from "~/lib/agenda/agenda";
import { ALVO_MINIMO, cor, espaco, fonte, raio, sombra } from "~/tema";

/**
 * O CALENDÁRIO DO MÊS — o da agenda e o de escolher a data de uma consulta.
 * Ponto embaixo do dia = há consulta; o dia de hoje tem aro; a data provável
 * do parto ganha o 👶. Tudo em JavaScript (sem seletor nativo): funciona na
 * bancada e não pede módulo nativo novo.
 */

const INICIAIS = ["D", "S", "T", "Q", "Q", "S", "S"];

export type Mes = { ano: number; mes: number };

export function mesDe(ymd: string): Mes {
  return { ano: Number(ymd.slice(0, 4)), mes: Number(ymd.slice(5, 7)) - 1 };
}

export function somarMes(m: Mes, n: number): Mes {
  const d = new Date(m.ano, m.mes + n, 1);
  return { ano: d.getFullYear(), mes: d.getMonth() };
}

export function CalendarioDoMes({
  mes,
  aoMudarMes,
  hoje,
  selecionado,
  aoEscolher,
  contagem,
  dpp,
}: {
  mes: Mes;
  aoMudarMes: (m: Mes) => void;
  hoje: string;
  selecionado?: string | null;
  aoEscolher: (ymd: string) => void;
  contagem?: Map<string, number>;
  dpp?: string | null;
}) {
  const semanas = semanasDoMes(mes.ano, mes.mes);
  const titulo = `${nomeDoMes(mes.mes)[0]!.toUpperCase()}${nomeDoMes(mes.mes).slice(1)} ${mes.ano}`;
  return (
    <View
      style={[
        { backgroundColor: cor.cartao, borderRadius: raio.lg, padding: espaco.md, gap: 6 },
        sombra,
      ]}
    >
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <SetaDoMes rotulo="Mês anterior" aoTocar={() => aoMudarMes(somarMes(mes, -1))}>
          <ChevronLeft size={22} color={cor.agenda} />
        </SetaDoMes>
        <Text
          accessibilityRole="header"
          style={{
            flex: 1,
            textAlign: "center",
            fontFamily: fonte.titulo,
            fontSize: 17,
            color: cor.texto,
          }}
        >
          {titulo}
        </Text>
        <SetaDoMes rotulo="Próximo mês" aoTocar={() => aoMudarMes(somarMes(mes, 1))}>
          <ChevronRight size={22} color={cor.agenda} />
        </SetaDoMes>
      </View>
      <View style={{ flexDirection: "row" }}>
        {INICIAIS.map((l, i) => (
          <Text
            key={i}
            style={{
              flex: 1,
              textAlign: "center",
              fontFamily: fonte.forte,
              fontSize: 13,
              color: cor.textoApagado,
            }}
          >
            {l}
          </Text>
        ))}
      </View>
      {semanas.map((semana, i) => (
        <View key={i} style={{ flexDirection: "row" }}>
          {semana.map((ymd, j) =>
            ymd ? (
              <Dia
                key={ymd}
                ymd={ymd}
                ehHoje={ymd === hoje}
                escolhido={ymd === selecionado}
                consultas={contagem?.get(ymd) ?? 0}
                ehDpp={ymd === dpp}
                aoTocar={() => aoEscolher(ymd)}
              />
            ) : (
              <View key={`v${j}`} style={{ flex: 1, height: ALVO_MINIMO + 4 }} />
            ),
          )}
        </View>
      ))}
    </View>
  );
}

function SetaDoMes({
  rotulo,
  aoTocar,
  children,
}: {
  rotulo: string;
  aoTocar: () => void;
  children: ReactNode;
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
        width: ALVO_MINIMO,
        height: ALVO_MINIMO,
        borderRadius: ALVO_MINIMO / 2,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: pressed ? cor.agendaFundo : "transparent",
      })}
    >
      {children}
    </Pressable>
  );
}

function Dia({
  ymd,
  ehHoje,
  escolhido,
  consultas,
  ehDpp,
  aoTocar,
}: {
  ymd: string;
  ehHoje: boolean;
  escolhido: boolean;
  consultas: number;
  ehDpp: boolean;
  aoTocar: () => void;
}) {
  const n = Number(ymd.slice(8, 10));
  const partes = [
    `Dia ${n}`,
    ehHoje ? "hoje" : null,
    consultas ? `${consultas} ${consultas === 1 ? "compromisso" : "compromissos"}` : null,
    ehDpp ? "data provável do parto" : null,
  ].filter(Boolean);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={partes.join(", ")}
      accessibilityState={{ selected: escolhido }}
      onPress={() => {
        toque();
        aoTocar();
      }}
      style={{ flex: 1, height: ALVO_MINIMO + 4, alignItems: "center", justifyContent: "center" }}
    >
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: 19,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: escolhido ? cor.agenda : "transparent",
          borderWidth: ehHoje && !escolhido ? 2 : 0,
          borderColor: cor.agenda,
        }}
      >
        {ehDpp && !escolhido ? (
          <Text style={{ fontSize: 18 }}>👶</Text>
        ) : (
          <Text
            style={{
              fontFamily: ehHoje || escolhido ? fonte.titulo : fonte.media,
              fontSize: 16,
              color: escolhido ? cor.branco : cor.texto,
              fontVariant: ["tabular-nums"],
            }}
          >
            {n}
          </Text>
        )}
      </View>
      <View
        style={{
          position: "absolute",
          bottom: 3,
          flexDirection: "row",
          gap: 3,
        }}
      >
        {Array.from({ length: Math.min(consultas, 3) }, (_, k) => (
          <View
            key={k}
            style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: cor.agenda }}
          />
        ))}
      </View>
    </Pressable>
  );
}
