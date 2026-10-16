import { sha256Hex } from "~/servidor/sha256";

/**
 * O id que o build do site dá a uma função de servidor:
 *   sha256("<arquivo relativo à raiz>--<variável>_createServerFn_handler")
 * (node_modules/@tanstack/start-plugin-core/dist/esm/start-compiler/compiler.js,
 * generateFunctionId; o site não configura gerador próprio).
 *
 * ⚠️ O id depende do CAMINHO e do NOME. Renomear ou mover a função no site
 * quebra o app instalado sem erro de compilação — por isso o portão do site
 * tem a catraca src/lib/ponte-do-app.test.ts, que confere toda função que o
 * app declara contra o fonte.
 */
export function idDaFuncao(arquivo: string, nome: string): string {
  return sha256Hex(`${arquivo}--${nome}_createServerFn_handler`);
}
