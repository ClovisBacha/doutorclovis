import { File, Paths } from "expo-file-system";
import { Share } from "react-native";
import { ehCopiaDosDados, nomeDaCopia } from "~/lib/juridico/copia-dos-dados";

/**
 * O arquivo da cópia dos dados no aparelho (a regra está em
 * `copia-dos-dados.ts`). Ele só existe enquanto a folha de compartilhar está
 * aberta: tem dado de saúde, e o cache do app não é lugar para ele ficar.
 */
export async function compartilharCopia(conteudo: string): Promise<"enviou" | "fechou"> {
  const f = new File(Paths.cache, nomeDaCopia(new Date()));
  f.create({ overwrite: true });
  f.write(conteudo);
  try {
    const r = await Share.share({ url: f.uri });
    return r.action === Share.sharedAction ? "enviou" : "fechou";
  } finally {
    apagar(f);
  }
}

/** Ao sair da conta: nenhuma cópia que tenha sobrado fica para trás. */
export function apagarCopiasDoAparelho(): void {
  try {
    for (const item of Paths.cache.list()) {
      if (item instanceof File && ehCopiaDosDados(item.name)) apagar(item);
    }
  } catch {
    /* melhor esforço */
  }
}

function apagar(f: File) {
  try {
    if (f.exists) f.delete();
  } catch {
    /* melhor esforço */
  }
}
