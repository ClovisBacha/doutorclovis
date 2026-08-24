/**
 * BANCADA DA LISTA DE PRESENTES — a tela da amiga, sem banco e sem token.
 *
 * ⚠️ Sem ela, conferir o cartão de RN CHEIO exigiria montar um chá de verdade e
 * reservar seis pacotes com seis nomes diferentes. É assim que uma tela passa
 * meses sem ninguém nunca ter olhado para ela — foi o que aconteceu com a
 * entrega do presente do médico.
 *
 * A bancada fabrica os DADOS; quem ordena por carência, calcula a cota e
 * desenha a barra é a tela de verdade, com as mesmas funções puras.
 *
 * Endereços:
 *   /preview-presentes             → lista nova, nada reservado
 *   /preview-presentes?rn=cheio    → RN no teto (o cartão "completo" e a ordem)
 *   /preview-presentes?cota=11     → 11 de 12 cotas do carrinho
 *   /preview-presentes?vazio=1     → lista ainda sendo montada
 *   /preview-presentes?dona=1      → A TELA DA DONA (`ChaDeBebe`), com o
 *                                    formulário de acrescentar item e o de
 *                                    dividir em cotas.
 *
 * ⚠️ **A tela da DONA não tinha bancada nenhuma até aqui**, e foi por isso que
 * ninguém viu que as cotas não tinham como nascer: o servidor aceita
 * `tipo: "cota"`, a régua está testada e a página pública desenha a reserva —
 * mas o único lugar do `src/` que escrevia `tipo: "cota"` era esta bancada, do
 * lado PÚBLICO. A tela que a gestante usa mandava `tipo: "item"` cravado.
 */
import { createFileRoute } from "@tanstack/react-router";
import { ListaDePresentesPublica } from "@/components/lista-de-presentes-publica";
import { ChaDeBebe } from "@/components/cha-de-bebe";
import { faixaDe, metaDeFraldas, TAMANHOS } from "@/lib/fraldas";
import type { ItemDaLista } from "@/lib/presentes";
import type { ListaPublica } from "@/lib/presentes.functions";

export const Route = createFileRoute("/preview-presentes")({
  component: Bancada,
  validateSearch: (q: Record<string, unknown>) => ({
    /* ⚠️ `== null` e NÃO `=== undefined`: o router serializa e revalida, e na
       segunda passada chega `null`. Mesma armadilha de `preview-saude`. */
    rn: q.rn == null ? "" : String(q.rn),
    cota: q.cota == null ? 0 : Number(q.cota) || 0,
    vazio: q.vazio == null ? false : !!q.vazio,
    /* ⚠️ `== null`, como todos os outros — na revalidação chega `null`. */
    dona: q.dona == null ? false : !!q.dona,
  }),
});

function Bancada() {
  const { rn, cota, vazio, dona } = Route.useSearch();
  const meta = metaDeFraldas();

  const fraldas: ItemDaLista[] = TAMANHOS.map((t, n) => ({
    id: `f-${t}`,
    tipo: "fralda" as const,
    titulo: `Fraldas ${t}`,
    nota: null,
    ordem: n,
    tamanho: t,
    meta: meta[t],
    teto: faixaDe(t).tetoPacotes,
    centavosTotal: null,
    /* RN no TETO (6), não na meta (4): é o estado em que o cartão fecha e sai
       do topo da ordem, que é o recurso inteiro das fraldas. */
    reservado: t === "RN" && rn === "cheio" ? 6 : t === "M" ? 4 : 0,
  }));

  const outros: ItemDaLista[] = [
    {
      id: "c-carrinho",
      tipo: "cota",
      titulo: "Carrinho + bebê conforto",
      nota: "O que eu mais queria — dá pra entrar com uma parte só 💛",
      ordem: 10,
      tamanho: null,
      meta: 12,
      teto: null,
      centavosTotal: 120000,
      reservado: cota,
    },
    {
      id: "i-banheira",
      tipo: "item",
      titulo: "Banheira com suporte",
      nota: null,
      ordem: 11,
      tamanho: null,
      meta: 1,
      teto: null,
      centavosTotal: null,
      reservado: 0,
    },
    {
      id: "i-mamadeira",
      tipo: "item",
      titulo: "Kit mamadeiras",
      nota: null,
      ordem: 12,
      tamanho: null,
      meta: 1,
      teto: null,
      centavosTotal: null,
      /* Um item JÁ FECHADO, para a bancada mostrar que ele desce e não some. */
      reservado: 1,
    },
  ];

  const lista: ListaPublica = {
    titulo: "Chá da Helena 🎀",
    recado: "Quem puder vir dia 12, vai ser em casa. Quem não puder, fica o abraço 💛",
    donaNome: "Marina",
    bebeNome: "Helena",
    dataDoCha: "2026-09-12",
    aberta: true,
    itens: vazio ? [] : [...fraldas, ...outros],
  };

  if (dona) {
    /* ⚠️ **A bancada injeta o DADO no mesmo `useState` da produção** (a prop
       `bancada`), nunca o desenho — é a régua da casa. `salvarItens` vai ao
       servidor de verdade e falha sem sessão; o que se confere aqui é o
       FORMULÁRIO (a caixa de cotas, o campo de valor, as sugestões de divisão e
       o piso de R$ 25), que é o que não existia. */
    return (
      <ChaDeBebe bancada={{ lista: { ...lista, token: "bancada", reservas: [] }, guardados: 2 }} />
    );
  }

  return (
    <ListaDePresentesPublica
      token="bancada"
      lista={lista}
      /* A reserva não vai ao servidor: devolve sucesso e a tela soma sozinha,
         que é o que prova a barra andando e o cartão fechando. */
      aoReservar={async () => ({ ok: true })}
    />
  );
}
