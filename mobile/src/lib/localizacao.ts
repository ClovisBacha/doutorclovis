import * as Location from "expo-location";

export type Ponto = { latitude: number; longitude: number };

/**
 * A localização para o SOS, com teto de tempo: o socorro nunca espera o GPS.
 * Sem permissão, sem sinal ou passado o prazo, devolve a última posição
 * conhecida — ou null, e o aviso sai sem localização.
 */
export async function localizacaoParaSocorro(prazoMs = 6000): Promise<Ponto | null> {
  try {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== "granted") return null;
    /* Balanced, e não High — a régua do site (emergency-sheet.tsx): alta
       precisão espera o GPS travar nos satélites, leva 10 s ou mais e FALHA
       dentro de casa, onde a maioria das emergências acontece. A posição pela
       rede chega em ~1 s com erro de dezenas de metros, e para a ambulância
       50 m é o mesmo que 5 m. */
    const agora = Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).then(
      (p) => ({ latitude: p.coords.latitude, longitude: p.coords.longitude }),
    );
    const prazo = new Promise<null>((r) => setTimeout(() => r(null), prazoMs));
    const ponto = await Promise.race([agora, prazo]).catch(() => null);
    if (ponto) return ponto;
    const ultima = await Location.getLastKnownPositionAsync().catch(() => null);
    return ultima ? { latitude: ultima.coords.latitude, longitude: ultima.coords.longitude } : null;
  } catch {
    return null;
  }
}

/**
 * Sem coordenada pode ser "ela disse não" ou problema técnico, e o SOS diz
 * coisas diferentes nos dois casos: negada, ela pode liberar nos Ajustes
 * AGORA, com calma — e não descobrir depois, no meio da emergência.
 */
export async function localizacaoNegada(): Promise<boolean> {
  try {
    const perm = await Location.getForegroundPermissionsAsync();
    return perm.status === "denied";
  } catch {
    return false;
  }
}
