import { FOTO_LADO_MAX } from "@/lib/foto-da-nutricao";

/**
 * A FOTO DO PRATO — a parte pura: o tamanho, os bytes e o corpo multipart.
 *
 * ─── POR QUE O MULTIPART É MONTADO À MÃO ────────────────────────────────────
 *
 * No iPhone o `fetch` global é o `expo/fetch`, e o FormData dele NÃO aceita o
 * `{ uri, name, type }` do React Native (está escrito em `convertFormData.ts`:
 * "`uri` is not supported"). Mandar assim estoura antes de sair do aparelho —
 * ou, pior, sai sem a foto e volta "sem_foto". Os bytes vêm prontos do
 * manipulador (base64), e um corpo `multipart/form-data` é texto e bytes
 * numa ordem conhecida: montado aqui, ele é igual em qualquer runtime e tem
 * teste.
 */

/** O lado maior vai a 1024 (o rótulo é letra miúda: a 512 a leitura falha). */
export function tamanhoReduzido(
  largura: number,
  altura: number,
  max: number = FOTO_LADO_MAX,
): { width: number | null; height: number | null } | null {
  if (!(largura > 0) || !(altura > 0)) return null;
  if (Math.max(largura, altura) <= max) return null;
  return largura >= altura ? { width: max, height: null } : { width: null, height: max };
}

const ALFABETO = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const VALOR = (() => {
  const t = new Int16Array(128).fill(-1);
  for (let i = 0; i < ALFABETO.length; i++) t[ALFABETO.charCodeAt(i)] = i;
  t["-".charCodeAt(0)] = 62; // base64url
  t["_".charCodeAt(0)] = 63;
  return t;
})();

/** Base64 (com ou sem o prefixo `data:...;base64,`) para bytes. */
export function base64ParaBytes(b64: string): Uint8Array {
  const limpo = b64.replace(/^data:[^,]*,/, "").replace(/[^A-Za-z0-9+/\-_]/g, "");
  const n = Math.floor((limpo.length * 3) / 4);
  const out = new Uint8Array(n);
  let buffer = 0;
  let bits = 0;
  let j = 0;
  for (let i = 0; i < limpo.length; i++) {
    const v = VALOR[limpo.charCodeAt(i)] ?? -1;
    if (v < 0) continue;
    buffer = (buffer << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[j++] = (buffer >> bits) & 0xff;
    }
  }
  return j === n ? out : out.slice(0, j);
}

function utf8(texto: string): Uint8Array {
  return new TextEncoder().encode(texto);
}

export function fronteiraAleatoria(aleatorio: () => number = Math.random): string {
  let s = "----ObstetricaFoto";
  for (let i = 0; i < 16; i++) s += ALFABETO[Math.floor(aleatorio() * 62)];
  return s;
}

/**
 * O corpo `multipart/form-data`: os campos de texto e um arquivo.
 * Devolve os bytes e o `Content-Type` (com a fronteira) para o cabeçalho.
 */
export function montarMultipart(
  campos: Record<string, string>,
  arquivo: { campo: string; nome: string; tipo: string; bytes: Uint8Array },
  fronteira: string = fronteiraAleatoria(),
): { corpo: Uint8Array; contentType: string } {
  const partes: Uint8Array[] = [];
  for (const [nome, valor] of Object.entries(campos)) {
    partes.push(
      utf8(`--${fronteira}\r\nContent-Disposition: form-data; name="${nome}"\r\n\r\n${valor}\r\n`),
    );
  }
  partes.push(
    utf8(
      `--${fronteira}\r\nContent-Disposition: form-data; name="${arquivo.campo}"; filename="${arquivo.nome}"\r\n` +
        `Content-Type: ${arquivo.tipo}\r\n\r\n`,
    ),
    arquivo.bytes,
    utf8(`\r\n--${fronteira}--\r\n`),
  );
  const total = partes.reduce((s, p) => s + p.length, 0);
  const corpo = new Uint8Array(total);
  let o = 0;
  for (const p of partes) {
    corpo.set(p, o);
    o += p.length;
  }
  return { corpo, contentType: `multipart/form-data; boundary=${fronteira}` };
}
