/**
 * A PILHA DE TELAS DE UMA ABA — o que o botão de voltar do Android desfaz.
 *
 * A Comunidade tem 25 destinos e 67 chamadas de `setOnde`, e nenhuma delas era
 * um passo que o voltar do aparelho soubesse desfazer: medido, de um perfil
 * aberto o voltar do Android MINIMIZAVA O APP.
 *
 * ⚠️ **A régua mora aqui, e não dentro do componente.** `RedeNoApp` não tem
 * bancada — `/preview-instagram` monta as telas INTERNAS (`TelaDePerfil`,
 * `TelaPrincipal`) direto, nunca ele. Enterrada lá, esta lógica não teria como
 * ser exercitada em lugar nenhum: nem no navegador, nem em teste. É a mesma
 * lição de `assinatura.ts` e de `buscar-paciente.ts` — régua pura em `lib/`,
 * componente só liga os fios.
 *
 * ⚠️ **A pilha é OBSERVADA, nunca escrita no ponto de uso.** Empilhar em cada
 * `setOnde` exigiria tocar nas 67 chamadas, e a 68ª — escrita amanhã —
 * nasceria sem. Quem chama `andou()` é um efeito que vê a tela mudar, então
 * ele pega todas, inclusive as que ainda não existem.
 */

export type PilhaDeTelas<T> = {
  /** Registra que a tela mudou de `anterior` para `nova`. */
  andou: (anterior: T, nova: T) => void;
  /** Para onde o voltar leva. `null` quando não há nada guardado. */
  voltar: () => T | null;
  /** Quantos passos dá para desfazer. Existe para o teste e para depurar. */
  tamanho: () => number;
};

export const TETO_DA_PILHA = 20;

export function criarPilhaDeTelas<T>(
  /** Quem é a raiz da aba — chegar nela zera o caminho. */
  ehRaiz: (tela: T) => boolean,
  teto: number = TETO_DA_PILHA,
): PilhaDeTelas<T> {
  let pilha: T[] = [];
  /* O passo que o PRÓPRIO voltar deu não volta para a pilha: senão o voltar
     seguinte reabriria exatamente a tela que este acabou de fechar, e a
     paciente ficaria presa indo e voltando entre duas telas. */
  let voltando = false;

  return {
    andou(anterior, nova) {
      if (Object.is(anterior, nova)) return;
      if (voltando) {
        voltando = false;
        return;
      }
      /* ⚠️ Chegar à RAIZ zera. O feed é o começo desta aba; guardar o caminho
         até ele faria o voltar seguinte reabrir uma tela já fechada. */
      if (ehRaiz(nova)) {
        pilha = [];
        return;
      }
      pilha.push(anterior);
      /* Um passeio longo (perfil → post → perfil → post…) cresceria sem fim
         numa aba que fica aberta por sessões inteiras. O passo mais VELHO é o
         que se perde — perder o mais novo tornaria o voltar imprevisível. */
      if (pilha.length > teto) pilha.shift();
    },

    voltar() {
      const alvo = pilha.pop();
      /* A marca vale mesmo quando a pilha está vazia: quem chamou vai mandar a
         tela para a raiz, e esse passo também não pode ser empilhado. */
      voltando = true;
      return alvo ?? null;
    },

    tamanho() {
      return pilha.length;
    },
  };
}
