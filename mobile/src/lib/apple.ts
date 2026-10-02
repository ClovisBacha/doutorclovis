import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import { Platform } from "react-native";
import { supabase } from "~/servidor/supabase";

/**
 * "Entrar com a Apple" NATIVO. No app antigo (Capacitor) o botão mandava a
 * paciente para o Safari e a sessão nunca voltava — motivo de reprovação.
 * Aqui o iOS mostra a folha própria, devolve um identityToken, e o Supabase o
 * troca por sessão (signInWithIdToken).
 *
 * ⚠️ O NONCE: a Apple recebe o HASH (SHA-256) e o Supabase recebe o valor
 * CRU — é assim que o servidor confere que o token foi emitido para este
 * pedido. Inverter os dois faz todo login falhar com "nonce mismatch".
 *
 * ⚠️ Configuração do dono (fora do código): o bundle id br.com.obstetrica.app
 * precisa estar nos Client IDs do provedor Apple no painel do Supabase.
 */
export async function appleDisponivel(): Promise<boolean> {
  if (Platform.OS !== "ios") return false;
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
}

export async function entrarComApple(): Promise<
  { ok: true } | { ok: false; cancelado?: boolean; mensagem: string }
> {
  try {
    const cru = Crypto.randomUUID() + Crypto.randomUUID();
    const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, cru);
    const credencial = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hash,
    });
    if (!credencial.identityToken)
      return { ok: false, mensagem: "A Apple não devolveu a identificação. Tente de novo." };
    const { error } = await supabase.auth.signInWithIdToken({
      provider: "apple",
      token: credencial.identityToken,
      nonce: cru,
    });
    if (error)
      return {
        ok: false,
        mensagem: "Não foi possível entrar com a Apple agora. Tente com e-mail e senha.",
      };
    /* A Apple só manda o nome no PRIMEIRO login: guardá-lo agora, ou nunca. */
    const nome = [credencial.fullName?.givenName, credencial.fullName?.familyName]
      .filter(Boolean)
      .join(" ");
    if (nome) await supabase.auth.updateUser({ data: { display_name: nome } }).catch(() => {});
    return { ok: true };
  } catch (e: unknown) {
    const codigo = (e as { code?: string })?.code;
    if (codigo === "ERR_REQUEST_CANCELED") return { ok: false, cancelado: true, mensagem: "" };
    return { ok: false, mensagem: "Não foi possível entrar com a Apple agora." };
  }
}
