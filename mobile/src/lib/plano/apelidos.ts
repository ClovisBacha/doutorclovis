/**
 * O "GERAR UM APELIDO" do funil (20/11/2026): para quem ainda não escolheu o
 * nome, um apelido carinhoso que o app usa até ela trocar ("Helena nesta
 * semana" vira "Jabuticaba nesta semana"). Nomes de coisas pequenas e doces,
 * que não dão gênero ao bebê na frase do app.
 */
export const APELIDOS: readonly string[] = [
  "Jabuticaba",
  "Pitanga",
  "Amora",
  "Pipoca",
  "Docinho",
  "Bolinha",
  "Mirtilo",
  "Cereja",
  "Pingo",
  "Amendoim",
  "Grão de Bico",
  "Ervilha",
  "Florzinha",
  "Estrelinha",
  "Biscoito",
  "Paçoca",
];

/** O próximo apelido, nunca o mesmo da vez anterior. `sorteio` em [0, 1). */
export function proximoApelido(atual: string, sorteio: number): string {
  const opcoes = APELIDOS.filter((a) => a !== atual.trim());
  return opcoes[Math.min(opcoes.length - 1, Math.floor(sorteio * opcoes.length))]!;
}
