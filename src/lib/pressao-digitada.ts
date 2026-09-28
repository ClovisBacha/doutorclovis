/**
 * COMO A PACIENTE ESCREVE A PRESSÃO — e por que o app precisava aprender isso.
 *
 * ⚠️ **"12 por 8" É COMO SE FALA PRESSÃO NO BRASIL.** Ninguém diz "cento e
 * vinte por oitenta"; diz doze por oito. A triagem tinha dois campos com
 * `placeholder="120"` e `"80"`, e o validador do servidor exige
 * `systolic >= 50` e `diastolic >= 30` — os pisos clínicos, que existem porque
 * uma sistólica de 12 mmHg é incompatível com a vida.
 *
 * O resultado: ela digitava 12 e 8, o `zod` recusava, o `parse` LANÇAVA, e o
 * `catch` de fora respondia **"Não foi possível avaliar os sintomas"**.
 *
 * ⚠️ E o custo não é o número perdido — é a TRIAGEM INTEIRA perdida. Ela podia
 * ter marcado "sangramento" e "dor de cabeça forte que não passa", que são dois
 * dos nove sintomas VERMELHOS, e receber uma tela de erro genérica em vez da
 * orientação. A pressão é OPCIONAL nessa tela; um campo opcional mal preenchido
 * não pode destruir o que não depende dele.
 *
 * ⚠️ **E A CONVERSÃO NUNCA É SILENCIOSA.** Multiplicar o número dela por dez
 * sem dizer seria o app reescrevendo um dado clínico por conta própria. Quem
 * chama recebe `interpretada: true` e MOSTRA o que entendeu — "entendi 120/80"
 * —, para ela poder corrigir se não era isso.
 */

/** A faixa em que "doze" só pode querer dizer "cento e vinte". */
const FALADA_SIS = { min: 6, max: 25 };
const FALADA_DIA = { min: 3, max: 16 };

/* Os pisos clínicos, os MESMOS de `sinais-clinicos.ts` e do validador da
   triagem. Estão aqui só para reconhecer o que JÁ é uma leitura em mmHg — esta
   régua não julga plausibilidade, quem julga é `sinalPressao`. */
const MMHG_SIS_MIN = 50;
const MMHG_DIA_MIN = 20;

export type PressaoLida = {
  systolic: number;
  diastolic: number;
  /** `true` = ela escreveu na escala falada e nós multiplicamos por dez. */
  interpretada: boolean;
};

/** `"12,5"`, `"12.5"`, `" 120 "` → número; qualquer outra coisa → `null`. */
function numero(bruto: string): number | null {
  const t = bruto.trim().replace(",", ".");
  if (!t) return null;
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/**
 * Lê o que ela digitou nos dois campos da triagem.
 *
 * ⚠️ O primeiro campo aceita **"12/8"** inteiro: numa caixa estreita ao lado de
 * uma barra, escrever a fração toda é o erro mais natural do mundo, e ele
 * produzia `Number("12/8") === NaN` — a mesma tela de erro.
 *
 * Devolve `null` quando não dá para entender. `null` NÃO é erro: é "siga a
 * triagem sem a pressão".
 */
export function lerPressaoDigitada(sysBruto: string, diaBruto: string): PressaoLida | null {
  let sTexto = sysBruto ?? "";
  let dTexto = diaBruto ?? "";

  /* "12/8" ou "12 por 8" no primeiro campo, com o segundo vazio. */
  const fracao = sTexto.match(/^\s*([\d.,]+)\s*(?:\/|x|por)\s*([\d.,]+)\s*$/i);
  if (fracao && !dTexto.trim()) {
    sTexto = fracao[1];
    dTexto = fracao[2];
  }

  const s = numero(sTexto);
  const d = numero(dTexto);
  /* Um sozinho não é pressão: `sinalPressao` precisa do PAR, e chamá-lo com
     uma diastólica inventada já custou "diferença implausível" nesta base.

     ⚠️ **E ESTE GUARDA É EXIGIDO PELO TIPO, não pelo comportamento — a mutação
     provou.** Trocar o `||` por `&&` aqui NÃO muda uma resposta sequer: `null`
     coage a `0` nas comparações abaixo, e todos os pisos (6, 3, 50, 20) são
     acima de zero, então um valor sozinho cai fora por elas de qualquer jeito.
     Ele fica porque sem ele o TypeScript recusa comparar `number | null` — e
     porque no dia em que um piso virar `0`, `null` passaria a valer uma
     leitura de zero. Está escrito para ninguém "limpar" isto achando que é
     redundante, e para ninguém achar que a catraca o cobre. */
  if (s == null || d == null) return null;

  const faladaS = s >= FALADA_SIS.min && s <= FALADA_SIS.max;
  const faladaD = d >= FALADA_DIA.min && d <= FALADA_DIA.max;
  /* ⚠️ OS DOIS JUNTOS, nunca um só. "120 por 8" é erro de digitação, e
     multiplicar só a diastólica inventaria uma leitura que ela não deu. */
  if (faladaS && faladaD) {
    return { systolic: Math.round(s * 10), diastolic: Math.round(d * 10), interpretada: true };
  }

  if (s >= MMHG_SIS_MIN && d >= MMHG_DIA_MIN) {
    return { systolic: Math.round(s), diastolic: Math.round(d), interpretada: false };
  }

  /* Nem uma coisa nem outra (um "12 por 90", um "300 por 5"): não inventamos
     nada, e a triagem segue pelos SINTOMAS. */
  return null;
}
