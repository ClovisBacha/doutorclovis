import { funcaoDoServidor } from "~/servidor/ponte";

/** src/lib/emergencia.functions.ts — o disparo do SOS pelo servidor. */
export type CanaisAviso = {
  medicoPush: number;
  medicoEmail: boolean;
  contatoEmail: boolean;
  sms: boolean;
  destinos: { nome: string; via: string }[];
  faltou: string | null;
};

export const dispararEmergencia = funcaoDoServidor<
  { latitude: number | null; longitude: number | null; address: string | null },
  { ok: boolean; canais: CanaisAviso; mensagem: string; erro?: string }
>("src/lib/emergencia.functions.ts", "dispararEmergencia");
