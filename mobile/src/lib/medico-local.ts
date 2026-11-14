import { gravarJson, lerJson } from "~/lib/armazem";
import type { MedicoLocal } from "~/lib/kit-sos";

/* O médico que ela cadastrou, guardado NO APARELHO: o SOS precisa dele sem
   rede, e enquanto APLICAR_MEDICO_DA_GESTANTE.sql não roda o banco descarta
   as colunas (gravarPerfil tira coluna ausente). Sem uid na chave, como o
   kit do SOS; o "sair da conta" apaga (prefixo dc-). */
const CHAVE = "dc-medico";

export function lerMedicoLocal(): Promise<MedicoLocal | null> {
  return lerJson<MedicoLocal | null>(CHAVE, null);
}

export function guardarMedicoLocal(m: MedicoLocal): Promise<boolean> {
  return gravarJson(CHAVE, m);
}
