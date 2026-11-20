import { ASSINATURA_NO_APP } from "~/config";
import { ehBancada, parametroDaBancada } from "~/lib/bancada";
import { PRODUTOS } from "~/lib/assinatura/plano";
import type { ProdutoDaLoja } from "~/lib/assinatura/precos";

/**
 * A BANCADA DA ASSINATURA — os produtos de exemplo, FORA das telas (a catraca
 * da loja proíbe preço escrito à mão em `app/` e `componentes/`). Eles entram
 * nos MESMOS estados que o StoreKit preencheria; nada aqui chama a Apple.
 *
 *   /assinatura?bancada=1                 os três planos (R$ 99,90 · 34,90 · 249,90)
 *   /assinatura?bancada=1&gratis=1        o anual com 7 dias grátis
 *   /assinatura?bancada=1&semprodutos=1   a App Store não devolveu os planos
 *   /assinatura?bancada=1&carregando=1    o esqueleto, parado
 *   /assinatura?bancada=1&plano=1         quem já tem o plano completo
 *   /assinatura?bancada=1&bebe=Theo       outro nome (o perfil de exemplo)
 *   /jornada/meditar?bancada=1&portao=1   o portão de uma atividade
 *
 * A DECISÃO DA BANCADA: na tela `/assinatura`, a bancada conta a chave como
 * LIGADA (senão a tela seguiria direto para o destino e não haveria o que
 * fotografar). Nos PORTÕES, só com `&portao=1`: as outras bancadas (as
 * atividades, a varredura da CI) continuam abrindo como hoje.
 */

const ANUAL: ProdutoDaLoja = {
  plano: "anual",
  id: PRODUTOS.anual,
  precoTexto: "R$ 99,90",
  preco: 99.9,
  moeda: "BRL",
  oferta: null,
};

const MENSAL: ProdutoDaLoja = {
  plano: "mensal",
  id: PRODUTOS.mensal,
  precoTexto: "R$ 34,90",
  preco: 34.9,
  moeda: "BRL",
  oferta: null,
};

const VITALICIO: ProdutoDaLoja = {
  plano: "vitalicio",
  id: PRODUTOS.vitalicio,
  precoTexto: "R$ 249,90",
  preco: 249.9,
  moeda: "BRL",
  oferta: null,
};

/** Os produtos da bancada: `null` é "ainda carregando" (o esqueleto). */
export function produtosDaBancada(): ProdutoDaLoja[] | null {
  if (parametroDaBancada("carregando") === "1") return null;
  if (parametroDaBancada("semprodutos") === "1") return [];
  const anual: ProdutoDaLoja =
    parametroDaBancada("gratis") === "1"
      ? {
          ...ANUAL,
          oferta: {
            modo: "gratis",
            precoTexto: "",
            periodo: { unidade: "dia", quantidade: 7 },
            repeticoes: 1,
          },
        }
      : ANUAL;
  return [anual, MENSAL, VITALICIO];
}

/** Na bancada, ela já tem o plano? (`&plano=1`) */
export function temPlanoNaBancada(): boolean {
  return parametroDaBancada("plano") === "1";
}

/** A tela de venda aparece: a chave ligada, ou a bancada (que a conta como ligada). */
export function vendaLigada(): boolean {
  return ASSINATURA_NO_APP || ehBancada();
}

/** Os portões funcionam: a chave ligada, ou a bancada com `&portao=1`. */
export function portaoLigado(): boolean {
  return ASSINATURA_NO_APP || parametroDaBancada("portao") === "1";
}
