import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * O armazém local do app (AsyncStorage), sempre em JSON e sempre tolerante:
 * leitura que falha devolve o padrão, escrita que falha não derruba a tela.
 *
 * ⚠️ Chaves com dado da paciente levam o uid (aparelho compartilhado), e
 * TUDO que mora aqui com prefixo "dc-" é apagado no sair da conta
 * (limparRastrosLocais).
 */
export async function lerJson<T>(chave: string, padrao: T): Promise<T> {
  try {
    const bruto = await AsyncStorage.getItem(chave);
    if (bruto == null) return padrao;
    return JSON.parse(bruto) as T;
  } catch {
    return padrao;
  }
}

export async function gravarJson(chave: string, valor: unknown): Promise<boolean> {
  try {
    await AsyncStorage.setItem(chave, JSON.stringify(valor));
    return true;
  } catch {
    return false;
  }
}

export async function apagar(chave: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(chave);
  } catch {
    /* sem efeito: a próxima leitura devolve o padrão */
  }
}

/** Sair da conta não pode deixar a jornada, as filas e o kit do SOS no aparelho. */
export async function limparRastrosLocais(): Promise<void> {
  try {
    const chaves = await AsyncStorage.getAllKeys();
    const nossas = chaves.filter((c) => c.startsWith("dc-"));
    if (nossas.length) await AsyncStorage.multiRemove(nossas);
  } catch {
    /* melhor esforço */
  }
}
