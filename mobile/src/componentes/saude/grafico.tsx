import type { Gravidade } from "@/lib/sinais-clinicos";
import { useState } from "react";
import { View } from "react-native";
import Svg, { Circle, Line, Polyline, Text as SvgText } from "react-native-svg";
import { cor, fonte } from "~/tema";

export type Ponto = { rotulo: string; valor: number; valor2?: number; gravidade: Gravidade };

const COR_DO_PONTO: Record<Gravidade, string> = {
  grave: cor.urgente,
  atencao: cor.atencao,
  normal: "",
};

/**
 * Um gráfico simples: UMA série, linha + pontos pintados pela gravidade que a
 * régua devolveu. Com `valor2` (pressão), cada medida vira um traço vertical
 * da diastólica à sistólica e a linha passa pelas sistólicas.
 *
 * ⚠️ Nenhuma faixa de referência é desenhada: desenhar o 140 aqui seria
 * escrever um limite clínico fora de sinais-clinicos.
 */
export function GraficoDeLinha({
  pontos,
  corDaSerie,
  formatar = (n) => String(Math.round(n)),
  altura = 150,
  rotuloAcessivel,
}: {
  pontos: Ponto[];
  corDaSerie: string;
  formatar?: (n: number) => string;
  altura?: number;
  rotuloAcessivel: string;
}) {
  const [largura, setLargura] = useState(0);
  const margemEsq = 40;
  const margemDir = 12;
  const margemTopo = 12;
  const margemBaixo = 24;
  const valores = pontos.flatMap((p) => (p.valor2 != null ? [p.valor, p.valor2] : [p.valor]));
  let min = Math.min(...valores);
  let max = Math.max(...valores);
  if (!Number.isFinite(min)) {
    min = 0;
    max = 1;
  }
  if (max - min < 4) {
    min -= 2;
    max += 2;
  }
  const folga = (max - min) * 0.12;
  min -= folga;
  max += folga;
  const w = Math.max(0, largura - margemEsq - margemDir);
  const h = altura - margemTopo - margemBaixo;
  const x = (i: number) =>
    margemEsq + (pontos.length <= 1 ? w / 2 : (i * w) / (pontos.length - 1));
  const y = (v: number) => margemTopo + h - ((v - min) / (max - min)) * h;
  const corPonto = (g: Gravidade) => COR_DO_PONTO[g] || corDaSerie;
  const topo = max - folga;
  const base = min + folga;

  return (
    <View
      accessible
      accessibilityLabel={rotuloAcessivel}
      onLayout={(e) => setLargura(e.nativeEvent.layout.width)}
      style={{ height: altura, width: "100%" }}
    >
      {largura > 0 ? (
        <Svg width={largura} height={altura}>
          {[topo, base].map((v, i) => (
            <Line
              key={i}
              x1={margemEsq}
              x2={largura - margemDir}
              y1={y(v)}
              y2={y(v)}
              stroke={cor.borda}
              strokeWidth={1}
            />
          ))}
          {[topo, base].map((v, i) => (
            <SvgText
              key={`r${i}`}
              x={margemEsq - 6}
              y={y(v) + 4}
              fontSize={12}
              fontFamily={fonte.media}
              fill={cor.textoApagado}
              textAnchor="end"
            >
              {formatar(v)}
            </SvgText>
          ))}
          {pontos.map((p, i) =>
            p.valor2 != null ? (
              <Line
                key={`b${i}`}
                x1={x(i)}
                x2={x(i)}
                y1={y(p.valor)}
                y2={y(p.valor2)}
                stroke={corPonto(p.gravidade)}
                strokeOpacity={0.45}
                strokeWidth={4}
                strokeLinecap="round"
              />
            ) : null,
          )}
          {pontos.length > 1 ? (
            <Polyline
              points={pontos.map((p, i) => `${x(i)},${y(p.valor)}`).join(" ")}
              fill="none"
              stroke={corDaSerie}
              strokeWidth={2}
              strokeLinejoin="round"
            />
          ) : null}
          {pontos.map((p, i) => (
            <Circle
              key={`p${i}`}
              cx={x(i)}
              cy={y(p.valor)}
              r={p.gravidade === "normal" ? 4 : 6}
              fill={corPonto(p.gravidade)}
              stroke={cor.cartao}
              strokeWidth={1.5}
            />
          ))}
          {pontos.map((p, i) =>
            p.valor2 != null ? (
              <Circle
                key={`q${i}`}
                cx={x(i)}
                cy={y(p.valor2)}
                r={3.5}
                fill={corPonto(p.gravidade)}
                stroke={cor.cartao}
                strokeWidth={1.5}
              />
            ) : null,
          )}
          {pontos.length ? (
            <>
              <SvgText
                x={x(0)}
                y={altura - 6}
                fontSize={12}
                fontFamily={fonte.media}
                fill={cor.textoApagado}
                textAnchor={pontos.length > 1 ? "start" : "middle"}
              >
                {pontos[0].rotulo}
              </SvgText>
              {pontos.length > 1 ? (
                <SvgText
                  x={x(pontos.length - 1)}
                  y={altura - 6}
                  fontSize={12}
                  fontFamily={fonte.media}
                  fill={cor.textoApagado}
                  textAnchor="end"
                >
                  {pontos[pontos.length - 1].rotulo}
                </SvgText>
              ) : null}
            </>
          ) : null}
        </Svg>
      ) : null}
    </View>
  );
}
