/**
 * O QUE FALTA PARA A CURVA DE GANHO DE PESO (IOM 2009) APARECER.
 *
 * ⚠️ **ESTA RÉGUA EXISTE PORQUE AS DUAS METADES DIVERGIRAM.** A curva era
 * desenhada com `bmi != null && prePregW != null && weightByWeek.length > 0`, e
 * o convite que explica como destravá-la era gateado só por `prePregW == null`.
 * Os dois campos são independentes e opcionais no Perfil, então havia um estado
 * REAL sem saída: quem preencheu o **peso pré-gestacional** e não a **altura**
 * (ou preencheu os dois e ainda não registrou peso nenhum) não via nem a curva
 * nem o convite — **nada era desenhado, e nada dizia por quê**. Ela preencheu
 * metade e o app calou.
 *
 * Por isso as duas perguntas passam por AQUI: `faltaParaACurva` devolve `null`
 * exatamente quando a curva pode ser desenhada, e qualquer outro valor é o que
 * falta. Assim não há como uma metade mudar sem a outra.
 *
 * ⚠️ E o texto nomeia o que falta, em vez de pedir sempre os dois: pedir altura
 * a quem já a preencheu é a mesma classe de defeito que tirou a frase
 * "Configure altura e peso pré-gestacional" da legenda da curva — tela
 * afirmando o que o código não faz.
 */

import { imcPreGestacional } from "@/lib/curva-de-ganho";

export type FaltaParaACurva =
  /** Nem altura nem peso pré-gestacional. */
  | "os-dois"
  | "altura"
  | "peso-pre"
  /** Os dois estão lá; falta ela registrar um peso para haver o que desenhar. */
  | "registro-de-peso"
  /**
   * ⚠️ Os dois campos estão preenchidos e o IMC não sai: a altura ou o peso
   * está fora da faixa que `imcPreGestacional` admite. Sem este caso a curva
   * sumia em SILÊNCIO — que é exatamente o estado sem saída que esta régua
   * nasceu para fechar, chegando por outro número.
   */
  | "medida-implausivel";

/**
 * `null` = a curva pode ser desenhada. Qualquer outro valor é o que falta.
 *
 * ⚠️ O Modo Cuidado NÃO entra aqui, de propósito: ele decide se a curva
 * GESTACIONAL deve existir na tela, que é outra pergunta — e misturar as duas
 * faria o convite aparecer no luto oferecendo destravar a curva de uma gestação
 * que acabou. Quem o aplica é o chamador, sobre as duas saídas.
 */
export function faltaParaACurva(o: {
  alturaCm?: number | null;
  pesoPreKg?: number | null;
  registrosDePeso: number;
}): FaltaParaACurva | null {
  const temAltura = o.alturaCm != null && Number.isFinite(o.alturaCm) && o.alturaCm > 0;
  const temPeso = o.pesoPreKg != null && Number.isFinite(o.pesoPreKg) && o.pesoPreKg > 0;
  if (!temAltura && !temPeso) return "os-dois";
  if (!temAltura) return "altura";
  if (!temPeso) return "peso-pre";
  /* ⚠️ **O IMC SAI DA RÉGUA ÚNICA, e é ela que tem as guardas.** A tela
     calculava `peso / (altura/100)²` à mão, sem faixa de plausibilidade: uma
     altura de 17 cm digitada por engano desenhava um corredor do IOM a partir
     de um IMC impossível. Aqui a curva não aparece e o convite DIZ por quê. */
  if (imcPreGestacional(o.pesoPreKg!, o.alturaCm!) == null) return "medida-implausivel";
  if (o.registrosDePeso <= 0) return "registro-de-peso";
  return null;
}

/**
 * O texto do convite. `acao` é `null` quando não há nada a fazer no Perfil — o
 * caso do peso ainda não registrado, que se resolve no formulário desta mesma
 * tela, logo abaixo. Mandá-la ao Perfil ali seria mandá-la ao lugar errado.
 */
export function conviteDaCurva(f: FaltaParaACurva): { texto: string; acao: string | null } {
  switch (f) {
    case "os-dois":
      return {
        texto:
          "Falta a sua altura e o seu peso antes da gestação para eu desenhar a curva de ganho recomendada pelo IOM.",
        acao: "Preencher no Perfil",
      };
    case "altura":
      return {
        texto:
          "Falta a sua altura para eu desenhar a curva de ganho recomendada pelo IOM — o peso antes da gestação você já preencheu.",
        acao: "Preencher no Perfil",
      };
    case "peso-pre":
      return {
        texto:
          "Falta o seu peso antes da gestação para eu desenhar a curva de ganho recomendada pelo IOM — a altura você já preencheu.",
        acao: "Preencher no Perfil",
      };
    case "medida-implausivel":
      return {
        texto:
          "A altura ou o peso antes da gestação que estão no seu Perfil não parecem certos — confira os dois para eu desenhar a curva.",
        acao: "Conferir no Perfil",
      };
    case "registro-de-peso":
      return {
        texto: "A curva de ganho aparece assim que você registrar o primeiro peso aqui embaixo.",
        acao: null,
      };
  }
}
