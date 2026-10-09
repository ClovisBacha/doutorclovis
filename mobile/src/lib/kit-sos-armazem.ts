import { gravarJson, lerJson } from "~/lib/armazem";
import type { KitDoSos } from "~/lib/kit-sos";

/* Guardado sem uid na chave, de propósito: o SOS precisa funcionar ANTES de
   a sessão carregar e sem rede. O "sair da conta" apaga (prefixo dc-). */
const CHAVE = "dc-kit-sos";

export function lerKitDoSos(): Promise<KitDoSos | null> {
  return lerJson<KitDoSos | null>(CHAVE, null);
}

export function guardarKitDoSos(kit: KitDoSos): Promise<boolean> {
  return gravarJson(CHAVE, kit);
}
