/**
 * Gera os sons do site que o app toca (mobile/assets/sons/*.wav) a partir do
 * MESMO desenho do site — `DESENHOS` de src/lib/som-da-interface.ts, na grade
 * A = 432. Uma afinação só: se o site mudar o alarme, rode isto de novo.
 *
 *   bun mobile/scripts/gerar-sons-do-sos.ts
 *
 * Reproduz o sintetizador do site (`desenhar`) amostra por amostra: senoide +
 * segunda harmônica a 0,125, ataque linear até 1, queda exponencial até
 * 0,0001 no fim do passo, passa-baixa Butterworth de 2ª ordem no corte, ganho
 * mestre. Mono, 44,1 kHz, 16 bits.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { DESENHOS, type EspecieDeSom } from "../../src/lib/som-da-interface";

const TAXA = 44100;

function sintetizar(especie: EspecieDeSom): Float64Array {
  const d = DESENHOS[especie];
  const fim = Math.max(...d.passos.map((p) => p.em + p.dur)) + 0.12;
  const n = Math.ceil(fim * TAXA);
  const bruto = new Float64Array(n);
  for (const p of d.passos) {
    const i0 = Math.floor(p.em * TAXA);
    const iN = Math.floor((p.em + p.dur) * TAXA);
    for (let i = i0; i < iN && i < n; i++) {
      const t = (i - i0) / TAXA;
      let env: number;
      if (t < d.ataque) env = 0.0001 + (1 - 0.0001) * (t / d.ataque);
      else env = Math.pow(0.0001, (t - d.ataque) / (p.dur - d.ataque));
      const s = Math.sin(2 * Math.PI * p.hz * t) + 0.125 * Math.sin(2 * Math.PI * 2 * p.hz * t);
      bruto[i] += env * s;
    }
  }
  // Passa-baixa biquad (RBJ), Q = 0,707.
  const w0 = (2 * Math.PI * d.corte) / TAXA;
  const alfa = Math.sin(w0) / (2 * 0.707);
  const cos = Math.cos(w0);
  const b0 = (1 - cos) / 2,
    b1 = 1 - cos,
    b2 = (1 - cos) / 2;
  const a0 = 1 + alfa,
    a1 = -2 * cos,
    a2 = 1 - alfa;
  const saida = new Float64Array(n);
  let x1 = 0,
    x2 = 0,
    y1 = 0,
    y2 = 0;
  for (let i = 0; i < n; i++) {
    const x = bruto[i];
    const y = (b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    saida[i] = y * d.ganho;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
  }
  return saida;
}

function wav(amostras: Float64Array): Buffer {
  /* O ganho do site é para Web Audio somado a outros sons; aqui o arquivo
     toca sozinho, então normaliza o pico em −3 dBFS. */
  const pico = Math.max(...Array.from(amostras, Math.abs)) || 1;
  const escala = 0.707 / pico;
  const dados = Buffer.alloc(amostras.length * 2);
  amostras.forEach((v, i) =>
    dados.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(v * escala * 32767))), i * 2),
  );
  const cab = Buffer.alloc(44);
  cab.write("RIFF", 0);
  cab.writeUInt32LE(36 + dados.length, 4);
  cab.write("WAVE", 8);
  cab.write("fmt ", 12);
  cab.writeUInt32LE(16, 16);
  cab.writeUInt16LE(1, 20);
  cab.writeUInt16LE(1, 22);
  cab.writeUInt32LE(TAXA, 24);
  cab.writeUInt32LE(TAXA * 2, 28);
  cab.writeUInt16LE(2, 32);
  cab.writeUInt16LE(16, 34);
  cab.write("data", 36);
  cab.writeUInt32LE(dados.length, 40);
  return Buffer.concat([cab, dados]);
}

const pasta = join(import.meta.dir, "..", "assets", "sons");
for (const [especie, arquivo] of [
  ["sos", "sos-enviado.wav"],
  ["sos-falhou", "sos-falhou.wav"],
  /* A comemoração da aula (quatro degraus subindo): no site ela toca para quem
     nunca escolheu silêncio — ver `tocarConquistaComPortoes`. */
  ["conquista", "conquista.wav"],
] as const) {
  const b = wav(sintetizar(especie));
  writeFileSync(join(pasta, arquivo), b);
  console.log(`${arquivo}: ${(b.length / 1024).toFixed(1)} KB`);
}
