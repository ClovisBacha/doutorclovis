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
    const agora = Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }).then(
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
