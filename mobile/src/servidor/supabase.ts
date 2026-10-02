import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { AppState, Platform } from "react-native";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "~/config";

/**
 * O MESMO Supabase do site. A paciente que já tem conta entra com o mesmo
 * e-mail e encontra a jornada, os registros e a Comunidade dela.
 *
 * A sessão mora no AsyncStorage (e não no SecureStore, que tem teto de 2 KB e
 * um token do Supabase passa disso). O que protege o dado é a RLS do banco.
 */
export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: Platform.OS === "web" && typeof window === "undefined" ? undefined : AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

/* O iOS congela timers em segundo plano: sem isto a renovação do token
   não roda, e a primeira chamada depois de uma noite fechado volta vencida.
   É o par que a documentação do Supabase para React Native manda ligar. */
if (Platform.OS !== "web") {
  AppState.addEventListener("change", (estado) => {
    if (estado === "active") supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

/** O token da sessão atual, lido do disco (sem ida à rede). */
export async function tokenAtual(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function uidAtual(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}
