/**
 * Rascunho do formulário, salvo no próprio aparelho.
 *
 * O cadastro do médico tem quinze campos e ele o preenche uma vez na vida,
 * quase sempre no celular, quase sempre entre uma coisa e outra. Uma ligação, o
 * navegador reciclando a aba, um toque no botão errado — e some tudo. Essa é a
 * forma mais boba de perder um cadastro, e a mais fácil de evitar.
 *
 * Fica no aparelho e não no servidor de propósito: rascunho é de quem está
 * digitando, não da plataforma. Nada aqui sai do navegador, e some sozinho
 * quando o cadastro termina ou depois de uma semana.
 */

const VALIDADE_MS = 7 * 86400_000;

type Envelope<T> = { em: number; dados: T };

/** Guarda o rascunho. Silencioso: em modo privado o storage pode recusar. */
export function salvarRascunho<T>(chave: string, dados: T): void {
  try {
    const env: Envelope<T> = { em: Date.now(), dados };
    localStorage.setItem(chave, JSON.stringify(env));
  } catch {
    /* sem storage: o formulário funciona, só não sobrevive a um fechamento */
  }
}

/**
 * Lê o rascunho, se ainda valer.
 *
 * Um rascunho de meses atrás não é ajuda, é confusão — o médico já não lembra do
 * que escreveu e não sabe se aquilo é o que está salvo no servidor. Vencido, é
 * apagado em vez de devolvido.
 */
export function lerRascunho<T>(chave: string): T | null {
  try {
    const bruto = localStorage.getItem(chave);
    if (!bruto) return null;
    const env = JSON.parse(bruto) as Envelope<T>;
    if (!env || typeof env.em !== "number" || Date.now() - env.em > VALIDADE_MS) {
      localStorage.removeItem(chave);
      return null;
    }
    return env.dados ?? null;
  } catch {
    return null;
  }
}

/** Terminou o cadastro (ou desistiu): o rascunho perdeu a função. */
export function apagarRascunho(chave: string): void {
  try {
    localStorage.removeItem(chave);
  } catch {
    /* nada a limpar */
  }
}

/** Quando o rascunho foi salvo, em texto curto: "agora", "há 3 min". */
export function quandoRascunho(chave: string): string {
  try {
    const bruto = localStorage.getItem(chave);
    if (!bruto) return "";
    const env = JSON.parse(bruto) as Envelope<unknown>;
    const min = Math.floor((Date.now() - env.em) / 60000);
    if (min < 1) return "agora";
    if (min < 60) return `há ${min} min`;
    const h = Math.floor(min / 60);
    return h < 24 ? `há ${h}h` : `há ${Math.floor(h / 24)} dia(s)`;
  } catch {
    return "";
  }
}
