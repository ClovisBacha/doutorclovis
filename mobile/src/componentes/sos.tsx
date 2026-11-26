import QRCode from "qrcode";
import { useMemo } from "react";
import { View } from "react-native";
import Svg, { G, Path, Rect } from "react-native-svg";
import { cor } from "~/tema";

/**
 * As peças DESENHADAS do SOS, copiadas do site (src/components/emergency-sheet.tsx).
 *
 * Desenho e não emoji, pelo mesmo motivo do site: emoji tem cor e forma
 * próprias em cada sistema, e estes são os sinais que precisam ler igual em
 * qualquer aparelho — a sirene no círculo, o fone vermelho do 192 e o verde do
 * WhatsApp, o pino da localização. A ambulância e o caminhão continuam emoji,
 * por decisão do dono ("preferia a antiga").
 */

export function Sirene({ cor, largura = 44 }: { cor: string; largura?: number }) {
  return (
    <Svg viewBox="0 0 48 40" width={largura} height={(largura * 40) / 48}>
      <Path d="M24 12c5.2 0 9.4 4.2 9.4 9.4V27H14.6v-5.6C14.6 16.2 18.8 12 24 12z" fill={cor} />
      <Rect x={11.5} y={28.4} width={25} height={4.4} rx={2.2} fill={cor} />
      <G stroke={cor} strokeWidth={2.6} strokeLinecap="round">
        <Path d="M24 6.5V2.6" />
        <Path d="M34.6 10.4l2.8-2.8" />
        <Path d="M13.4 10.4l-2.8-2.8" />
        <Path d="M39.4 19.6h4" />
        <Path d="M8.6 19.6h-4" />
      </G>
    </Svg>
  );
}

export function Fone({ cor, tamanho = 28 }: { cor: string; tamanho?: number }) {
  return (
    <Svg viewBox="0 0 24 24" width={tamanho} height={tamanho}>
      <Path
        fill={cor}
        d="M6.6 3.5c.5 0 1 .3 1.2.8l1.3 3a1.3 1.3 0 0 1-.3 1.5l-1.3 1.1a12 12 0 0 0 5.6 5.6l1.1-1.3a1.3 1.3 0 0 1 1.5-.3l3 1.3c.5.2.8.7.8 1.2v2.7c0 .8-.6 1.4-1.4 1.4C10 20.5 3.5 14 3.5 5.9c0-.8.6-1.4 1.4-1.4h1.7z"
      />
    </Svg>
  );
}

export function Pino({ cor, tamanho = 24 }: { cor: string; tamanho?: number }) {
  return (
    <Svg viewBox="0 0 24 24" width={tamanho} height={tamanho}>
      <Path
        fill={cor}
        d="M12 2.2c-4 0-7.2 3.2-7.2 7.2 0 5.4 6.4 11.6 6.7 11.9.3.3.7.3 1 0 .3-.3 6.7-6.5 6.7-11.9 0-4-3.2-7.2-7.2-7.2zm0 9.9a2.7 2.7 0 1 1 0-5.4 2.7 2.7 0 0 1 0 5.4z"
      />
    </Svg>
  );
}

export function LogoWhatsApp({ cor, tamanho = 44 }: { cor: string; tamanho?: number }) {
  return (
    <Svg viewBox="0 0 32 32" width={tamanho} height={tamanho}>
      <Path
        fill={cor}
        d="M16 3C8.8 3 3 8.8 3 16c0 2.3.6 4.5 1.7 6.4L3 29l6.8-1.7c1.9 1 4 1.6 6.2 1.6 7.2 0 13-5.8 13-13S23.2 3 16 3zm0 23.6c-2 0-3.9-.5-5.6-1.5l-.4-.2-4 1 1.1-3.9-.3-.4A10.5 10.5 0 015.4 16C5.4 10.2 10.2 5.4 16 5.4S26.6 10.2 26.6 16 21.8 26.6 16 26.6z"
      />
      <Path
        fill={cor}
        d="M21.8 18.6c-.3-.2-1.9-.9-2.2-1s-.5-.2-.7.2c-.2.3-.8 1-1 1.2-.2.2-.4.2-.7.1-.3-.2-1.4-.5-2.6-1.6-1-.9-1.6-1.9-1.8-2.3-.2-.3 0-.5.1-.7l.5-.6c.2-.2.2-.3.3-.5.1-.2 0-.4 0-.6l-1-2.3c-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.9.4-.3.3-1.2 1.1-1.2 2.8s1.2 3.3 1.4 3.5c.2.2 2.4 3.7 5.9 5.1 2.9 1.2 3.5 1 4.1.9.6-.1 1.9-.8 2.2-1.5.3-.8.3-1.4.2-1.5-.1-.2-.3-.3-.6-.4z"
      />
    </Svg>
  );
}

/**
 * O QR da ficha, GERADO NO APARELHO — como no site: nenhum dado de saúde sai
 * do celular para desenhá-lo, e ele funciona sem internet. Refeito sempre que
 * o texto da ficha muda (o `useMemo` compara o conteúdo).
 */
export function QrDaFicha({ texto, tamanho = 112 }: { texto: string; tamanho?: number }) {
  const caminho = useMemo(() => {
    try {
      const { modules } = QRCode.create(texto, { errorCorrectionLevel: "M" });
      const n = modules.size;
      let d = "";
      for (let y = 0; y < n; y++)
        for (let x = 0; x < n; x++) if (modules.get(y, x)) d += `M${x + 1} ${y + 1}h1v1h-1z`;
      return { d, n: n + 2 };
    } catch {
      return null;
    }
  }, [texto]);
  if (!caminho) return <View style={{ width: tamanho, height: tamanho }} />;
  return (
    <Svg
      viewBox={`0 0 ${caminho.n} ${caminho.n}`}
      width={tamanho}
      height={tamanho}
      accessibilityLabel="QR com a sua ficha de emergência"
    >
      <Rect x={0} y={0} width={caminho.n} height={caminho.n} fill={cor.branco} />
      <Path d={caminho.d} fill={cor.preto} />
    </Svg>
  );
}
