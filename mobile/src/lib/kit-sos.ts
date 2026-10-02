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
  /** O médico que ela cadastrou (medico_* no perfil, ou o guardado no aparelho). */
  medicoNome?: string | null;
  medicoCelular?: string | null;
  medicoEmail?: string | null;
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
  medico_nome?: string | null;
  medico_celular?: string | null;
  medico_email?: string | null;
};

/** O médico guardado no aparelho — vale enquanto o banco não tem as colunas. */
export type MedicoLocal = { nome: string | null; celular: string | null; email: string | null };

const limpo = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

export function kitDoPerfil(
  perfil: PerfilParaKit,
  situacao: string | null,
  agora = new Date(),
  medicoLocal: MedicoLocal | null = null,
): KitDoSos {
  /* O banco vence quando tem; o aparelho cobre o banco que ainda não tem as
     colunas (APLICAR_MEDICO_DA_GESTANTE.sql chega depois do código). */
  const doBanco = !!(limpo(perfil.medico_celular) || limpo(perfil.medico_email));
  return {
    nome: limpo(perfil.display_name) ?? limpo(perfil.full_name),
    contatoNome: limpo(perfil.emergency_contact),
    contatoTelefone: limpo(perfil.emergency_phone),
    tipoSanguineo: limpo(perfil.blood_type),
    alergias: limpo(perfil.allergies),
    medicacoes: limpo(perfil.medications),
    situacao,
    medicoNome: doBanco ? limpo(perfil.medico_nome) : limpo(medicoLocal?.nome),
    medicoCelular: doBanco ? limpo(perfil.medico_celular) : limpo(medicoLocal?.celular),
    medicoEmail: doBanco ? limpo(perfil.medico_email) : limpo(medicoLocal?.email),
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
