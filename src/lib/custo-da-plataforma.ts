/**
 * O CUSTO DE VERDADE DA PLATAFORMA — tokens que aconteceram, não estimativa.
 *
 * ⚠️ **ISTO EXISTE PORQUE O PAINEL ESTAVA MOSTRANDO UM NÚMERO INVENTADO.**
 * `insights.functions.ts` calculava "Custo e margem de IA" como
 * `brain_hits × AI_COST_PER_HIT_CENTS`, com a constante fixada em **1 centavo**
 * e um rodapé admitindo "é uma estimativa". Dois problemas somados:
 *
 * 1. **Contava a coisa errada.** `brain_hits` é só o Segundo Cérebro. O chat da
 *    paciente, a triagem de sintomas, a transcrição do diário, a nota clínica e
 *    o advisor — todo o resto da IA — não apareciam. O item mais caro da conta
 *    estava fora dela.
 * 2. **O multiplicador era um chute.** Uma resposta de chat com contexto clínico
 *    e outra de uma linha custam ordens de grandeza diferentes, e as duas
 *    valiam um centavo.
 *
 * E `ai_usage` guarda `input_tokens`, `output_tokens`, `modelo`, `canal` e
 * `especie` desde que existe. **O dado do custo sempre esteve lá; faltava
 * alguém multiplicar.**
 *
 * ⚠️ **NÚMERO DE PAINEL FINANCEIRO NÃO PODE SER CHUTE.** É por ele que se
 * decide preço, plano e se a IA vale a pena — e um número errado aqui erra
 * todas as decisões a jusante de uma vez.
 */

/**
 * ⚠️ **PREÇO MUDA. Esta tabela tem DATA, e ela é mostrada na tela.**
 *
 * Sem a data, alguém lê "custo de agosto" seis meses depois com preço de
 * agosto e conclui que a margem melhorou. Quem confere é humano, no painel do
 * fornecedor — este arquivo só registra o que foi conferido e quando.
 *
 * Valores em **dólar por MILHÃO de tokens**, que é como os fornecedores
 * publicam. A conversão para centavos de real acontece em `custoEmCentavos`.
 */
export const CONFERIDO_EM = "2026-08";

export type PrecoDoModelo = {
  /** Dólares por milhão de tokens de ENTRADA. */
  entrada: number;
  /** Dólares por milhão de tokens de SAÍDA. */
  saida: number;
};

/**
 * ⚠️ **AS CHAVES SÃO PREFIXOS**, e não nomes exatos: `CHAT_MODEL` é uma
 * variável de ambiente que o dono pode trocar por uma variante com sufixo de
 * data (`gemini-2.5-flash-001`). Casar exato faria toda linha virar "modelo
 * desconhecido" no dia de uma troca trivial.
 */
export const PRECO_POR_MODELO: Record<string, PrecoDoModelo> = {
  "gemini-2.5-flash": { entrada: 0.3, saida: 2.5 },
  "gemini-2.5-pro": { entrada: 1.25, saida: 10 },
  "gemini-2.0-flash": { entrada: 0.1, saida: 0.4 },
  "gemini-flash": { entrada: 0.3, saida: 2.5 },
  "text-embedding": { entrada: 0.15, saida: 0 },
  "gemini-embedding": { entrada: 0.15, saida: 0 },
};

/**
 * ⚠️ **A COTAÇÃO É UMA PREMISSA, e a tela DIZ isso.** Fixá-la é deliberado:
 * buscar câmbio ao vivo faria o custo de um mês fechado MUDAR entre duas
 * aberturas do painel, e um número financeiro que se mexe sozinho é um número
 * em que ninguém confia.
 */
export const DOLAR_EM_REAIS = 5.5;

/**
 * O preço de um modelo, ou `null` quando ele não está na tabela.
 *
 * ⚠️ **`null` NUNCA vira zero.** Tratar modelo desconhecido como grátis
 * SUBESTIMA o custo em silêncio, que é a pior direção possível para errar num
 * painel de margem — a plataforma pareceria mais lucrativa exatamente quando
 * alguém trocou o modelo por um mais caro. Quem chama tem de contar essas
 * linhas à parte e a tela tem de dizer quantas são.
 */
export function precoDe(modelo: string | null | undefined): PrecoDoModelo | null {
  if (!modelo) return null;
  const m = modelo.toLowerCase().trim();
  /* Prefixo mais LONGO primeiro: sem isso `gemini-2.5-flash` casaria a chave
     curta `gemini-flash` só por ordem de iteração do objeto, e um modelo Pro
     poderia ser cobrado como Flash. */
  const chaves = Object.keys(PRECO_POR_MODELO).sort((a, b) => b.length - a.length);
  for (const chave of chaves) if (m.startsWith(chave)) return PRECO_POR_MODELO[chave];
  return null;
}

export type LinhaDeUso = {
  modelo: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
};

/**
 * O custo de UMA chamada, em centavos de real.
 *
 * Devolve `null` quando o modelo é desconhecido — ver `precoDe`.
 */
export function custoEmCentavos(linha: LinhaDeUso): number | null {
  const preco = precoDe(linha.modelo);
  if (!preco) return null;
  const entrada = Math.max(0, linha.input_tokens ?? 0);
  const saida = Math.max(0, linha.output_tokens ?? 0);
  const usd = (entrada / 1_000_000) * preco.entrada + (saida / 1_000_000) * preco.saida;
  /* Centavos com casas decimais: uma chamada de chat custa frações de centavo,
     e arredondar POR CHAMADA zeraria quase tudo. O arredondamento acontece só
     na hora de mostrar o total. */
  return usd * DOLAR_EM_REAIS * 100;
}

export type Recorte = { chave: string; centavos: number; chamadas: number; tokens: number };

export type ResumoDeCusto = {
  centavos: number;
  chamadas: number;
  tokensEntrada: number;
  tokensSaida: number;
  /** ⚠️ Linhas cujo modelo não está na tabela — o custo delas NÃO está no total. */
  semPreco: number;
  modelosSemPreco: string[];
  porCanal: Recorte[];
  porEspecie: Recorte[];
  porModelo: Recorte[];
};

type LinhaCompleta = LinhaDeUso & { canal?: string | null; especie?: string | null };

/**
 * SOMA UM PERÍODO — e conta à parte o que não soube precificar.
 *
 * ⚠️ **`semPreco` é obrigatório na tela.** Um total que ignora silenciosamente
 * 30% das chamadas é pior que nenhum total: ele parece completo.
 */
export function resumirCusto(linhas: LinhaCompleta[]): ResumoDeCusto {
  const canal = new Map<string, Recorte>();
  const especie = new Map<string, Recorte>();
  const modelo = new Map<string, Recorte>();
  const desconhecidos = new Set<string>();
  let centavos = 0;
  let tokensEntrada = 0;
  let tokensSaida = 0;
  let semPreco = 0;

  const somar = (m: Map<string, Recorte>, chave: string, c: number, tk: number) => {
    const atual = m.get(chave) ?? { chave, centavos: 0, chamadas: 0, tokens: 0 };
    atual.centavos += c;
    atual.chamadas += 1;
    atual.tokens += tk;
    m.set(chave, atual);
  };

  for (const l of linhas) {
    const tk = Math.max(0, l.input_tokens ?? 0) + Math.max(0, l.output_tokens ?? 0);
    tokensEntrada += Math.max(0, l.input_tokens ?? 0);
    tokensSaida += Math.max(0, l.output_tokens ?? 0);
    const c = custoEmCentavos(l);
    if (c === null) {
      semPreco += 1;
      if (l.modelo) desconhecidos.add(l.modelo);
      /* ⚠️ A linha ENTRA nos recortes com custo zero mesmo assim: sem isso ela
         sumiria da contagem de CHAMADAS também, e aí nem dava para ver que
         existe um canal inteiro sem preço. */
    }
    centavos += c ?? 0;
    somar(canal, l.canal || "(sem canal)", c ?? 0, tk);
    somar(especie, l.especie || "(sem espécie)", c ?? 0, tk);
    somar(modelo, l.modelo || "(sem modelo)", c ?? 0, tk);
  }

  const ordenado = (m: Map<string, Recorte>) =>
    [...m.values()].sort((a, b) => b.centavos - a.centavos || b.chamadas - a.chamadas);

  return {
    centavos,
    chamadas: linhas.length,
    tokensEntrada,
    tokensSaida,
    semPreco,
    modelosSemPreco: [...desconhecidos].sort(),
    porCanal: ordenado(canal),
    porEspecie: ordenado(especie),
    porModelo: ordenado(modelo),
  };
}

/**
 * PROJEÇÃO ATÉ O FIM DO MÊS — regra de três sobre os dias já corridos.
 *
 * ⚠️ **Não projeta com menos de dois dias corridos.** No dia 1 a regra de três
 * multiplica por trinta o que aconteceu em algumas horas, e o painel abriria o
 * mês anunciando um custo dez vezes maior que o real — o tipo de número que
 * faz alguém tomar uma decisão de preço no susto.
 */
export function projetarMes(
  centavosAteAgora: number,
  diaDoMes: number,
  diasNoMes: number,
): number | null {
  if (!Number.isFinite(centavosAteAgora) || centavosAteAgora < 0) return null;
  if (diaDoMes < 2 || diaDoMes > diasNoMes) return null;
  return (centavosAteAgora / diaDoMes) * diasNoMes;
}

/** Centavos → "R$ 12,34". Aceita fração e arredonda só aqui. */
export function emReais(centavos: number): string {
  const v = Math.round(centavos) / 100;
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
