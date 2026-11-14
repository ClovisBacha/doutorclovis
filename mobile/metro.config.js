// O app nativo mora em mobile/, mas as regras clínicas, o conteúdo da jornada
// e as artes moram no site (../src). Elas são UMA régua só para os dois — uma
// cópia aqui divergiria no primeiro ajuste, e a divergência apareceria como o
// app e o site dizendo coisas diferentes sobre a mesma pressão arterial.
// Por isso o Metro enxerga ../src (watchFolders) e o tsconfig mapeia "@/*"
// para lá; o código do próprio app usa "~/*".
const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
const site = path.resolve(__dirname, "../src");

config.watchFolders = [...(config.watchFolders ?? []), site];
// Um arquivo de ../src que importe pacote resolveria a partir da RAIZ do
// repositório, cujo node_modules não existe no build da EAS. A catraca
// `src/compartilhado.test.ts` proíbe isso; esta linha faz o resto dos pacotes
// resolverem sempre a partir de mobile/.
config.resolver.nodeModulesPaths = [path.resolve(__dirname, "node_modules")];
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
