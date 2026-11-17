import { Platform } from "react-native";
import type { Perfil } from "~/lib/sessao";

/**
 * A BANCADA: abrir qualquer tela do app num navegador, sem conta, com dados
 * de exemplo — para fotografar e conferir o desenho sem um iPhone.
 *
 * Só existe na WEB e só com `?bancada=1` na URL. No iPhone `window.location`
 * não existe, então isto é sempre falso no app instalado.
 *
 * A exceção (16/11/2026) é o SIMULADOR em desenvolvimento, para ver o vidro e
 * o movimento de verdade sem uma conta: só num pacote de DEV (`__DEV__`, que
 * um build de loja nunca tem) servido por um Metro aberto com
 * `EXPO_PUBLIC_BANCADA=1`. As duas travas juntas: `vidro-e-luz.test.ts` cobra
 * que nenhum `.env` nem o `testflight.sh` ligam a variável.
 *
 * Regra herdada do site: a bancada injeta o DADO nos mesmos estados da tela
 * de produção, nunca um desenho à parte. Uma bancada que mostra o que o
 * servidor nunca produziria aprova qualquer coisa.
 */
export function ehBancada(): boolean {
  if (Platform.OS !== "web") return __DEV__ && process.env.EXPO_PUBLIC_BANCADA === "1";
  if (typeof window === "undefined") return false;
  try {
    return new URLSearchParams(window.location.search).get("bancada") === "1";
  } catch {
    return false;
  }
}

/**
 * Lê um parâmetro da bancada: na web, da URL; no simulador em desenvolvimento,
 * de `EXPO_PUBLIC_BANCADA_PARAMS` (ex.: `hora=8&semana=30`), posta junto com
 * `EXPO_PUBLIC_BANCADA=1` ao abrir o Metro.
 */
export function parametroDaBancada(nome: string): string | null {
  if (!ehBancada()) return null;
  try {
    if (Platform.OS === "web") return new URLSearchParams(window.location.search).get(nome);
    for (const par of (process.env.EXPO_PUBLIC_BANCADA_PARAMS ?? "").split("&")) {
      const [chave, valor = ""] = par.split("=");
      if (chave === nome) return decodeURIComponent(valor);
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Vai para outra tela da bancada RECARREGANDO a página: o perfil de exemplo
 * lê os parâmetros (`&pos=1`, `&idade=`) quando é montado, e uma troca de rota
 * dentro do app não o remonta. No app de verdade quem troca o modo é o perfil
 * relido do servidor — isto só existe para simular o mesmo na bancada.
 */
export function recarregarNaBancada(caminho: string) {
  if (!ehBancada() || Platform.OS !== "web") return;
  try {
    window.location.assign(caminho);
  } catch {
    /* sem efeito */
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
