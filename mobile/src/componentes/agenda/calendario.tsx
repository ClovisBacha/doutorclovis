import { ChevronLeft, ChevronRight } from "lucide-react-native";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { selecao } from "~/componentes/base";
import { nomeDoMes, semanasDoMes } from "~/lib/agenda/agenda";
import { comAlfa } from "~/lib/cor";
import { ALVO_MINIMO, canto, cor, curva, escala, espaco, fonte, luz, sombra } from "~/tema";

/**
 * O CALENDÁRIO DO MÊS — o da agenda, o de escolher a data de uma consulta e o
 * do nascimento. Ponto embaixo do dia = há consulta; o dia de hoje tem aro; a
 * data provável do parto ganha um selo 👶 no canto (o número continua lá: ela
 * precisa ver que dia é). Tudo em JavaScript (sem seletor nativo): funciona na
 * bancada e não pede módulo nativo novo.
 *
 * `tinta` é a cor do dia escolhido, do aro e dos pontos (a da agenda, por
 * padrão; o nascimento usa a framboesa). `plano` tira o cartão, para morar
 * dentro de um grupo.
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
  bloqueado,
  tinta = cor.agenda,
  plano = false,
}: {
  mes: Mes;
  aoMudarMes: (m: Mes) => void;
  hoje: string;
  selecionado?: string | null;
  aoEscolher: (ymd: string) => void;
  contagem?: Map<string, number>;
  dpp?: string | null;
  /** Dias que não se pode escolher (o futuro, na data do nascimento): ficam apagados. */
  bloqueado?: (ymd: string) => boolean;
  tinta?: string;
  plano?: boolean;
}) {
  const semanas = semanasDoMes(mes.ano, mes.mes);
  const titulo = `${nomeDoMes(mes.mes)[0]!.toUpperCase()}${nomeDoMes(mes.mes).slice(1)} ${mes.ano}`;
  return (
    <View
      style={[
        { gap: 6 },
        plano
          ? { paddingHorizontal: espaco.sm, paddingVertical: espaco.sm }
          : [
              {
                backgroundColor: luz.cartao,
                borderRadius: canto.cartao,
                ...curva,
                padding: espaco.md,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: comAlfa(cor.branco, 0.9),
              },
              sombra,
            ],
      ]}
    >
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <SetaDoMes rotulo="Mês anterior" tinta={tinta} aoTocar={() => aoMudarMes(somarMes(mes, -1))}>
          <ChevronLeft size={22} strokeWidth={2.4} color={tinta} />
        </SetaDoMes>
        <Text
          accessibilityRole="header"
          style={{
            flex: 1,
            textAlign: "center",
            ...fonte.forte,
            ...escala.manchete,
            color: cor.texto,
          }}
        >
          {titulo}
        </Text>
        <SetaDoMes rotulo="Próximo mês" tinta={tinta} aoTocar={() => aoMudarMes(somarMes(mes, 1))}>
          <ChevronRight size={22} strokeWidth={2.4} color={tinta} />
        </SetaDoMes>
      </View>
      <View style={{ flexDirection: "row" }}>
        {INICIAIS.map((l, i) => (
          <Text
            key={i}
            style={{
              flex: 1,
              textAlign: "center",
              ...fonte.forte,
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
                fechado={bloqueado?.(ymd) ?? false}
                tinta={tinta}
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
  tinta,
  children,
}: {
  rotulo: string;
  aoTocar: () => void;
  tinta: string;
  children: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      onPress={() => {
        selecao();
        aoTocar();
      }}
      style={({ pressed }) => ({
        width: ALVO_MINIMO,
        height: ALVO_MINIMO,
        borderRadius: ALVO_MINIMO / 2,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: pressed ? comAlfa(tinta, 0.12) : "transparent",
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
  fechado,
  tinta,
  aoTocar,
}: {
  ymd: string;
  ehHoje: boolean;
  escolhido: boolean;
  consultas: number;
  ehDpp: boolean;
  fechado: boolean;
  tinta: string;
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
      accessibilityState={{ selected: escolhido, disabled: fechado }}
      disabled={fechado}
      onPress={() => {
        selecao();
        aoTocar();
      }}
      style={{
        flex: 1,
        height: ALVO_MINIMO + 4,
        alignItems: "center",
        justifyContent: "center",
        opacity: fechado ? 0.3 : 1,
      }}
    >
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: 19,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: escolhido ? tinta : ehDpp ? cor.destaque : "transparent",
          borderWidth: ehHoje && !escolhido ? 2 : 0,
          borderColor: tinta,
        }}
      >
        <Text
          style={{
            ...(ehHoje || escolhido || ehDpp ? fonte.titulo : fonte.normal),
            fontSize: 17,
            color: escolhido ? cor.branco : ehDpp ? cor.textoDestaque : cor.texto,
            fontVariant: ["tabular-nums"],
          }}
        >
          {n}
        </Text>
      </View>
      {ehDpp ? (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: -1,
            right: 0,
            width: 20,
            height: 20,
            borderRadius: 10,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: cor.branco,
            ...sombra,
          }}
        >
          <Text style={{ fontSize: 12, lineHeight: 15 }}>👶</Text>
        </View>
      ) : null}
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
            style={{
              width: 5,
              height: 5,
              borderRadius: 3,
              backgroundColor: tinta,
            }}
          />
        ))}
      </View>
    </Pressable>
  );
}
