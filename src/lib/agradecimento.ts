/**
 * O AGRADECIMENTO QUE SE ESCREVE SOZINHO.
 *
 * Depois do chá ela deve quarenta agradecimentos. Todo mundo odeia essa tarefa,
 * ninguém a resolveu, e o app é a única coisa no mundo que sabe **quem deu o
 * quê** — porque foi ele que anotou.
 *
 * ⚠️ **O TEXTO É RASCUNHO, E O APP NUNCA MANDA.** Ele abre o WhatsApp com a
 * mensagem escrita, ou copia para a área de transferência; quem aperta enviar é
 * ela. É a mesma decisão da transcrição do diário: o que volta cai num campo
 * para conferir. Um agradecimento automático que sai errado — nome trocado,
 * item que a pessoa não deu — é pior que agradecimento nenhum, porque a pessoa
 * lê e sabe que ninguém olhou.
 *
 * ⚠️ **E ele nunca inventa.** Só entra no texto o que está gravado na reserva.
 * "Obrigada pelo carrinho" para quem deu fralda é o defeito que destruiria o
 * recurso inteiro na primeira vez que acontecesse.
 */

import type { ReservaPublica } from "@/lib/presentes";

export type ParaAgradecer = {
  reservaIds: string[];
  nome: string;
  /** Os títulos do que essa pessoa deu — na ordem em que ela reservou. */
  itens: string[];
  /** Ela deixou recado de voz? Muda o texto, e é o que ele tem de melhor. */
  temAudio: boolean;
  /** Já foi agradecida? */
  agradecida: boolean;
};

/**
 * Junta as reservas por PESSOA.
 *
 * ⚠️ Uma pessoa costuma dar mais de uma coisa, e três mensagens seguidas para
 * a mesma tia é pior que nenhuma — lê como robô. O agrupamento é por nome
 * normalizado (sem acento, sem caixa): "Vó Ana" e "vó ana" são a mesma pessoa
 * enchendo a lista duas vezes porque digitou de dois celulares.
 *
 * ⚠️ Reservas CANCELADAS não chegam aqui — quem filtra é quem lê do banco. Se
 * chegassem, o texto agradeceria por um presente que voltou atrás.
 */
export function agrupaPorPessoa(
  reservas: ReservaPublica[],
  tituloDoItem: (itemId: string) => string,
): ParaAgradecer[] {
  const chave = (n: string) =>
    n
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .trim();

  const mapa = new Map<string, ParaAgradecer>();
  for (const r of reservas) {
    const nome = (r.quemNome ?? "").trim() || "Alguém";
    const k = chave(nome);
    const atual = mapa.get(k);
    if (atual) {
      atual.reservaIds.push(r.id);
      atual.itens.push(tituloDoItem(r.itemId));
      atual.temAudio = atual.temAudio || r.temAudio;
      /* ⚠️ `agradecida` só é verdadeira se TODAS as reservas dela foram
         agradecidas. Com um `||`, agradecer uma fralda tiraria da fila a
         pessoa que também deu o carrinho. */
      atual.agradecida = atual.agradecida && r.agradecidaEm != null;
    } else {
      mapa.set(k, {
        reservaIds: [r.id],
        nome,
        itens: [tituloDoItem(r.itemId)],
        temAudio: r.temAudio,
        agradecida: r.agradecidaEm != null,
      });
    }
  }
  return [...mapa.values()];
}

/** Quem ainda não foi agradecida. É a fila de trabalho da tela. */
export function quemFaltaAgradecer(pessoas: ParaAgradecer[]): ParaAgradecer[] {
  return pessoas.filter((p) => !p.agradecida);
}

/** "a banheira", "a banheira e o carrinho", "a banheira, o carrinho e 2 outros" */
function listaEmTexto(itens: string[]): string {
  const vistos = [...new Set(itens.filter((t) => t.trim()))];
  if (vistos.length === 0) return "o presente";
  if (vistos.length === 1) return vistos[0];
  if (vistos.length === 2) return `${vistos[0]} e ${vistos[1]}`;
  return `${vistos.slice(0, -1).join(", ")} e ${vistos[vistos.length - 1]}`;
}

/**
 * O rascunho.
 *
 * ⚠️ **Menciona o áudio quando existe, e essa frase é o ponto.** O áudio é a
 * coisa que a lista tem de mais valiosa — a voz da avó guardada junto com o
 * presente. Um agradecimento que ignora o recado que a pessoa gravou desperdiça
 * exatamente o gesto que ela teve o trabalho de fazer.
 *
 * ⚠️ **Sem nome de bebê, não inventa.** "Obrigada em nome do bebê" quando ela
 * ainda não escolheu o nome é o app falando por ela sobre a coisa mais íntima
 * que existe naquele momento.
 */
export function textoDeAgradecimento(p: ParaAgradecer, ctx?: { bebeNome?: string | null }): string {
  const primeiro = p.nome.split(/\s+/)[0] || p.nome;
  const oQue = listaEmTexto(p.itens);
  const bebe = (ctx?.bebeNome ?? "").trim();

  const abertura = `Oi, ${primeiro}! Muito obrigada por ${oQue} 💛`;
  const doAudio = p.temAudio ? " Ouvi seu áudio — foi a melhor parte." : "";
  /* ⚠️ SEM ARTIGO antes do nome — "A Helena" viraria "A Miguel". Acertar o
     artigo exigiria saber o gênero do bebê pelo nome, que é exatamente o que
     não dá para fazer. É a MESMA armadilha que o bolão já tinha ("Quando o
     Helena nasce?"), e ela reapareceu num arquivo diferente no mesmo dia: nome
     próprio em português vai sem artigo, e ponto. */
  const fecho = bebe
    ? ` ${bebe} vai crescer sabendo que você estava por perto.`
    : " Ter você por perto nessa fase significa muito pra mim.";

  return `${abertura}${doAudio}${fecho}`;
}

/**
 * O link de WhatsApp com a mensagem pronta.
 *
 * ⚠️ **Sem número.** `wa.me/?text=` abre o WhatsApp no seletor de contato, com
 * a mensagem escrita — e ela escolhe quem. O app não tem o telefone de quem
 * deu (nem deveria: é terceiro sem conta), e um link com número errado mandaria
 * o agradecimento da tia para o contato errado.
 */
export function linkDeWhatsApp(texto: string): string {
  return `https://wa.me/?text=${encodeURIComponent(texto)}`;
}
