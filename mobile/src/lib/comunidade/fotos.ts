import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import {
  COMPRESSAO_DA_FOTO,
  dataUrlJpeg,
  LADO_DO_AVATAR,
  LADO_MAXIMO_DA_FOTO,
  recorteQuadrado,
  tamanhoReduzido,
} from "~/lib/comunidade/regras";

/**
 * Escolher e preparar fotos para a Comunidade.
 *
 * As fotos viajam como data URL DENTRO da chamada do servidor (é o contrato de
 * `publicarPost`), então o tamanho importa: lado maior ≤ 1080, JPEG 0,72. Uma
 * foto de 12 MP crua em base64 estouraria o corpo da requisição no 4G.
 */

export type ResultadoDaEscolha =
  | { ok: true; fotos: string[] }
  | { ok: false; motivo: "cancelou" | "permissao" | "falhou" };

/** Reduz para lado ≤ `maximo` e devolve `data:image/jpeg;base64,…`. */
async function prepararFoto(uri: string, maximo = LADO_MAXIMO_DA_FOTO): Promise<string> {
  const ctx = ImageManipulator.manipulate(uri);
  const original = await ctx.renderAsync();
  const novo = tamanhoReduzido(original.width, original.height, maximo);
  const final = novo ? await ctx.resize(novo).renderAsync() : original;
  const salvo = await final.saveAsync({ compress: COMPRESSAO_DA_FOTO, format: SaveFormat.JPEG, base64: true });
  if (!salvo.base64) throw new Error("sem base64");
  return dataUrlJpeg(salvo.base64);
}

async function prepararVarias(assets: ImagePicker.ImagePickerAsset[]): Promise<ResultadoDaEscolha> {
  try {
    const fotos: string[] = [];
    for (const a of assets) fotos.push(await prepararFoto(a.uri));
    return { ok: true, fotos };
  } catch {
    return { ok: false, motivo: "falhou" };
  }
}

/** Da galeria, até `limite` fotos de uma vez. */
export async function escolherDaGaleria(limite: number): Promise<ResultadoDaEscolha> {
  if (limite <= 0) return { ok: false, motivo: "cancelou" };
  try {
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: limite > 1,
      selectionLimit: limite,
      orderedSelection: true,
      quality: 1,
    });
    if (r.canceled || !r.assets?.length) return { ok: false, motivo: "cancelou" };
    return prepararVarias(r.assets.slice(0, limite));
  } catch {
    return { ok: false, motivo: "falhou" };
  }
}

/** Da câmera, uma foto. */
export async function tirarFoto(): Promise<ResultadoDaEscolha> {
  try {
    const p = await ImagePicker.requestCameraPermissionsAsync();
    if (!p.granted) return { ok: false, motivo: "permissao" };
    const r = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 1 });
    if (r.canceled || !r.assets?.length) return { ok: false, motivo: "cancelou" };
    return prepararVarias(r.assets.slice(0, 1));
  } catch {
    return { ok: false, motivo: "falhou" };
  }
}

/** A foto de perfil: quadrada (recorte central), 512 × 512. */
export async function escolherAvatar(): Promise<{ ok: true; foto: string } | { ok: false; motivo: "cancelou" | "falhou" }> {
  try {
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });
    if (r.canceled || !r.assets?.length) return { ok: false, motivo: "cancelou" };
    const ctx = ImageManipulator.manipulate(r.assets[0].uri);
    const original = await ctx.renderAsync();
    const recorte = recorteQuadrado(original.width, original.height);
    if (recorte) ctx.crop(recorte);
    ctx.resize({ width: LADO_DO_AVATAR, height: LADO_DO_AVATAR });
    const final = await ctx.renderAsync();
    const salvo = await final.saveAsync({ compress: COMPRESSAO_DA_FOTO, format: SaveFormat.JPEG, base64: true });
    if (!salvo.base64) return { ok: false, motivo: "falhou" };
    return { ok: true, foto: dataUrlJpeg(salvo.base64) };
  } catch {
    return { ok: false, motivo: "falhou" };
  }
}
