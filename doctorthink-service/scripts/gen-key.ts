/**
 * Cria uma API key. A chave crua é impressa UMA vez (guarde-a).
 * Uso: bun run scripts/gen-key.ts <tenantId> [doctorId]
 *   <tenantId>  ex.: obstetrica
 *   [doctorId]  opcional — tranca a chave a um profissional (recomendado p/ terceiros)
 */
import { db } from "../src/db";
import { generateApiKey, hashApiKey } from "../src/auth";

const tenantId = process.argv[2];
const doctorId = process.argv[3] ?? null;
if (!tenantId) {
  console.error("uso: bun run scripts/gen-key.ts <tenantId> [doctorId]");
  process.exit(1);
}

const raw = generateApiKey();
const { error } = await db
  .from("doctorthink_api_keys")
  .insert({ tenant_id: tenantId, doctor_id: doctorId, key_hash: hashApiKey(raw) });
if (error) {
  console.error(error);
  process.exit(1);
}

console.log("Chave criada (aparece só uma vez — guarde agora):");
console.log(raw);
