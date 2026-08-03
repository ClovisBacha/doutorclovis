/**
 * Quem responde por "voltar".
 *
 * ─── O problema, e ele é do Android ─────────────────────────────────────
 *
 * As telas do app não são rotas: a jornada, o jogo, as folhas de compra e o SOS
 * são ESTADO do React sobre uma URL só. Isso foi uma escolha boa — trocar de
 * aba não recarrega nada —, e ela tem um preço que só aparece no aparelho:
 *
 *   o botão de voltar do Android não tem para onde ir.
 *
 * Sem ninguém escutando, o Capacitor faz o padrão dele: FECHA O APP. De
 * qualquer tela, inclusive com uma folha de compra aberta por cima. A paciente
 * toca no botão que o Android inteiro usa para "cancelar isto aqui" e o app
 * some. É o tipo de coisa que acontece no primeiro minuto de uso e não gera
 * relato nenhum — quem fecha o app sem querer conclui que o app fechou.
 *
 * ─── O desenho: uma pilha, o último a abrir responde primeiro ───────────
 *
 * Cada tela ou folha que "pode ser fechada" se registra enquanto está aberta e
 * se desregistra ao sair. Voltar chama o TOPO da pilha. Isso dá de graça o
 * comportamento certo quando há duas coisas abertas — folha de sementinhas
 * sobre a tela do cantinho: voltar fecha a folha, e só o segundo voltar sai do
 * cantinho.
 *
 * O handler devolve `true` quando consumiu o evento. Devolver `false` é dizer
 * "não era comigo" e deixar passar para o de baixo — útil para quem se registra
 * de forma condicional sem ficar entrando e saindo da pilha.
 *
 * ─── Por que a tecla Escape entra aqui também ───────────────────────────
 *
 * É a mesma pergunta ("feche o que está por cima") feita por outro aparelho, e
 * hoje nenhuma folha deste app fecha com Escape — quem usa o painel no
 * computador precisa achar o × com o mouse. Ligar as duas na mesma pilha
 * conserta o teclado de graça, e — o que importa mais aqui — deixa o mecanismo
 * testável num navegador, sem aparelho nenhum.
 */

type Handler = () => boolean;

const pilha: Handler[] = [];
let ouvindoTeclado = false;

function aoTeclado(e: KeyboardEvent) {
  if (e.key !== "Escape" || pilha.length === 0) return;
  if (voltarAgora() === "consumido") e.preventDefault();
}

function ligarTeclado() {
  if (ouvindoTeclado || typeof window === "undefined") return;
  ouvindoTeclado = true;
  window.addEventListener("keydown", aoTeclado);
}

/**
 * Registra um handler enquanto a tela existe. Devolve o cancelador.
 *
 * Sempre usar o cancelador — um handler que fica na pilha depois de a tela
 * sumir engole o "voltar" de quem está embaixo, e o app parece que travou.
 */
export function registrarVoltar(fn: Handler): () => void {
  pilha.push(fn);
  ligarTeclado();
  return () => {
    const i = pilha.lastIndexOf(fn);
    if (i >= 0) pilha.splice(i, 1);
  };
}

/**
 * Executa o voltar. Do topo para a base, o primeiro que assumir vence.
 *
 * `"vazio"` significa que ninguém quis — e aí quem chamou decide o que fazer
 * (no Android: minimizar o app; ver `src/lib/nativo.ts`).
 */
export function voltarAgora(): "consumido" | "vazio" {
  for (let i = pilha.length - 1; i >= 0; i--) {
    let assumiu = false;
    try {
      assumiu = pilha[i]() === true;
    } catch {
      /* Um handler que explode não pode fechar o app. Ele perde a vez. */
      assumiu = false;
    }
    if (assumiu) return "consumido";
  }
  return "vazio";
}

/** Quantos estão na pilha. Existe para o teste — e para depurar em produção. */
export function quantosEsperandoVoltar(): number {
  return pilha.length;
}

/** Só para teste: esvazia a pilha entre casos. */
export function limparVoltar(): void {
  pilha.length = 0;
}
