#!/usr/bin/env node
/**
 * O SEGREDO DO "ENTRAR COM A APPLE" — o JWT que o Supabase pede.
 *
 * A Apple é o único provedor que não entrega um "client secret" fixo: ela dá
 * uma CHAVE PRIVADA (.p8) e espera que você assine um JWT ES256 com ela. É esse
 * JWT que vai no campo do Supabase.
 *
 * ⚠️ **ELE VENCE.** A Apple aceita no máximo SEIS MESES de validade, e no dia
 * em que vencer o "Entrar com a Apple" para de funcionar sem nenhum aviso — o
 * botão simplesmente devolve erro. Rode este script de novo e cole o novo valor.
 * A data de vencimento é impressa no fim, para você marcar na agenda.
 *
 * Uso:
 *   node scripts/segredo-apple.mjs \
 *     --p8 ~/Downloads/AuthKey_ABC1234XYZ.p8 \
 *     --team TEAMID1234 \
 *     --key ABC1234XYZ \
 *     --servico br.com.obstetrica.web
 *
 * Nada é enviado a lugar nenhum: a assinatura acontece aqui, com `node:crypto`.
 */
import { createSign } from "node:crypto";
import { readFileSync } from "node:fs";

const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) {
  args.set(process.argv[i].replace(/^--/, ""), process.argv[i + 1]);
}

const p8 = args.get("p8");
const team = args.get("team");
const key = args.get("key");
const servico = args.get("servico");

const faltando = [
  !p8 && "--p8 (o arquivo AuthKey_XXXXXXXXXX.p8 baixado da Apple)",
  !team && "--team (Team ID, 10 caracteres — canto superior direito do portal)",
  !key && "--key (Key ID, 10 caracteres — o XXXXXXXXXX do nome do .p8)",
  !servico && "--servico (o Services ID, ex.: br.com.obstetrica.web)",
].filter(Boolean);

if (faltando.length) {
  console.error("Faltou:\n  " + faltando.join("\n  "));
  process.exit(1);
}

/* ⚠️ Confere o formato ANTES de assinar. Team ID e Key ID têm 10 caracteres, e
   trocar um pelo outro é o erro mais comum aqui — a Apple responde
   `invalid_client`, que não diz qual dos dois está errado. */
for (const [rotulo, valor] of [
  ["Team ID", team],
  ["Key ID", key],
]) {
  if (!/^[A-Z0-9]{10}$/.test(valor)) {
    console.error(
      `${rotulo} inválido: "${valor}" — são 10 caracteres (letras maiúsculas e números).`,
    );
    process.exit(1);
  }
}
if (!servico.includes(".")) {
  console.error(
    `Services ID inválido: "${servico}" — é o identificador em pontos, ex.: br.com.obstetrica.web.`,
  );
  process.exit(1);
}

let chave;
try {
  chave = readFileSync(p8, "utf8");
} catch {
  console.error(`Não consegui ler o arquivo: ${p8}`);
  process.exit(1);
}
if (!chave.includes("BEGIN PRIVATE KEY")) {
  console.error("Esse arquivo não parece um .p8 da Apple (falta o cabeçalho PRIVATE KEY).");
  process.exit(1);
}

const b64u = (o) =>
  Buffer.from(typeof o === "string" ? o : JSON.stringify(o)).toString("base64url");

const agora = Math.floor(Date.now() / 1000);
/* Seis meses menos um dia: a Apple RECUSA exatamente 15777000 s (6 meses) por
   arredondamento, e um segundo a mais devolve `invalid_client`. */
const vence = agora + 15777000 - 86400;

const cabecalho = b64u({ alg: "ES256", kid: key });
const corpo = b64u({
  iss: team,
  iat: agora,
  exp: vence,
  aud: "https://appleid.apple.com",
  sub: servico,
});

const assinador = createSign("SHA256");
assinador.update(`${cabecalho}.${corpo}`);
/* `dsaEncoding: "ieee-p1363"` é obrigatório: o padrão do Node é DER, e um JWT
   ES256 com assinatura DER é recusado sem explicação. */
const assinatura = assinador.sign({ key: chave, dsaEncoding: "ieee-p1363" }).toString("base64url");

console.log("\n─── COLE ISTO NO SUPABASE (Authentication → Providers → Apple → Secret Key) ───\n");
console.log(`${cabecalho}.${corpo}.${assinatura}`);
console.log(`\n─── E NO CAMPO "Client IDs", COLE: ${servico}`);
console.log(
  `\n⚠️  VENCE EM ${new Date(vence * 1000).toLocaleDateString("pt-BR")} — marque na agenda e rode este script de novo antes disso.\n`,
);
