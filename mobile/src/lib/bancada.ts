import { Platform } from "react-native";
import type { Perfil } from "~/lib/sessao";

/**
 * A BANCADA: abrir qualquer tela do app num navegador, sem conta, com dados
 * de exemplo — para fotografar e conferir o desenho sem um iPhone.
 *
 * Só existe na WEB e só com `?bancada=1` na URL. No iPhone `window.location`
 * não existe, então isto é sempre falso no app instalado.
 *
 * Regra herdada do site: a bancada injeta o DADO nos mesmos estados da tela
 * de produção, nunca um desenho à parte. Uma bancada que mostra o que o
 * servidor nunca produziria aprova qualquer coisa.
 */
export function ehBancada(): boolean {
  if (Platform.OS !== "web" || typeof window === "undefined") return false;
  try {
    return new URLSearchParams(window.location.search).get("bancada") === "1";
  } catch {
    return false;
  }
}

/** Lê um parâmetro da URL da bancada (só na web). */
export function parametroDaBancada(nome: string): string | null {
  if (!ehBancada()) return null;
  try {
    return new URLSearchParams(window.location.search).get(nome);
  } catch {
    return null;
  }
}

/** A gestante de exemplo: 24 semanas e 3 dias pela DUM. `?semana=N` muda. */
export function perfilDaBancada(): Perfil {
  const semanas = Number(parametroDaBancada("semana") ?? 24);
  const dum = new Date();
  dum.setDate(dum.getDate() - (semanas * 7 + 3));
  const ymd = `${dum.getFullYear()}-${String(dum.getMonth() + 1).padStart(2, "0")}-${String(dum.getDate()).padStart(2, "0")}`;
  return {
    id: "00000000-0000-4000-8000-000000000001",
    display_name: "Marina Costa",
    full_name: "Marina Costa",
    baby_name: parametroDaBancada("bebe") ?? "Helena",
    lmp_date: ymd,
    care_mode: parametroDaBancada("luto") === "1",
    emergency_contact: "Rafael",
    emergency_phone: "(31) 99999-0000",
    medico_nome: "Dra. Ana Lima",
    medico_celular: "(31) 98888-1234",
    medico_email: "ana.lima@exemplo.com.br",
    blood_type: "O+",
    allergies: "Dipirona",
    medications: "Ácido fólico",
    quiz_premium: false,
  };
}
