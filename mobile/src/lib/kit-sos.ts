/**
 * O KIT DO SOS: o que o socorro precisa saber, guardado NO APARELHO para
 * funcionar sem internet — quem é o contato de emergência, o telefone dele,
 * tipo sanguíneo, alergias, medicações. Régua pura (o armazenamento mora em
 * kit-sos-armazem.ts).
 *
 * ⚠️ No Modo Cuidado a ficha não diz "gestante" nem a semana: um bebê que não
 * vai nascer é informação ERRADA para quem vai atendê-la.
 */
export type KitDoSos = {
  nome: string | null;
  contatoNome: string | null;
  contatoTelefone: string | null;
  tipoSanguineo: string | null;
  alergias: string | null;
  medicacoes: string | null;
  situacao: string | null;
  atualizadoEm: string;
};

type PerfilParaKit = {
  display_name?: string | null;
  full_name?: string | null;
  emergency_contact?: string | null;
  emergency_phone?: string | null;
  blood_type?: string | null;
  allergies?: string | null;
  medications?: string | null;
};

const limpo = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

export function kitDoPerfil(
  perfil: PerfilParaKit,
  situacao: string | null,
  agora = new Date(),
): KitDoSos {
  return {
    nome: limpo(perfil.display_name) ?? limpo(perfil.full_name),
    contatoNome: limpo(perfil.emergency_contact),
    contatoTelefone: limpo(perfil.emergency_phone),
    tipoSanguineo: limpo(perfil.blood_type),
    alergias: limpo(perfil.allergies),
    medicacoes: limpo(perfil.medications),
    situacao,
    atualizadoEm: agora.toISOString(),
  };
}

/** O telefone em dígitos, com DDI 55 quando faltar (para wa.me e sms:). */
export function telefoneInternacional(telefone: string | null): string | null {
  const d = (telefone ?? "").replace(/\D/g, "");
  if (d.length < 10) return null;
  return d.startsWith("55") && d.length >= 12 ? d : `55${d}`;
}

/** A mensagem que vai por SMS/WhatsApp quando o servidor não alcança ninguém. */
export function mensagemDeSocorro(
  kit: KitDoSos | null,
  lat: number | null,
  lon: number | null,
): string {
  const quem = kit?.nome ? `${kit.nome} precisa de ajuda agora` : "Preciso de ajuda agora";
  const onde =
    lat != null && lon != null
      ? ` Minha localização: https://maps.google.com/?q=${lat.toFixed(5)},${lon.toFixed(5)}`
      : "";
  return `${quem} (SOS do app Obstétrica).${onde} Se não conseguir falar comigo, ligue 192.`;
}
