import { createFileRoute } from "@tanstack/react-router";
import { AmigasTab } from "@/components/amigas";
import type { EstadoDaDupla, PerfilDeAmiga } from "@/lib/amigas";
import type { DuplaNaTela } from "@/lib/amigas.functions";

/**
 * Bancada da ABA DAS AMIGAS.
 *
 * A aba só existe para quem está logada, e o que ela mostra depende de coisas
 * que não se fabricam numa conta de teste: uma amiga que entrou pelo convite
 * DELA, uma dupla aceita dos dois lados, e o bolso do Premium. Conferir o
 * layout contra a referência do dono exigiria duas contas reais, um convite
 * aceito e uma assinatura — e é assim que uma tela passa meses sem ninguém
 * nunca ter olhado para ela.
 *
 * ⚠️ A bancada fabrica o DADO, nunca o desenho. A lista, a dupla e o bolso
 * entram pelos mesmos `useState` da produção; daí para baixo é o componente de
 * verdade, com os mesmos textos, as mesmas cores e a mesma régua. A lição é do
 * `?streak=41` da folha da chama, que cravava o NÚMERO e deixava o saldo vir de
 * uma jornada vazia — a bancada mostrava um estado que o app nunca produz.
 *
 * Parâmetros:
 *   `?n=4`             quantas amigas na lista (0 mostra o vazio que ensina)
 *   `?dupla=ativa`     ativa · convite-recebido · convite-enviado · sem
 *   `?dias=12`         dias de chama da dupla
 *   `?recorde=40`      a MAIOR sequência que elas já tiveram (a memória)
 *   `?parada=9`        há quantos dias a outra não aparece (a pausa gentil)
 *   `?premium=1`       liga o botão 🎁 na linha da amiga
 *   `?luto=1`          Modo Cuidado — a aba inteira se cala
 *   `?semcodigo=1`     sem código de indicação (o "Convidar" explica e não manda)
 *   `?pedidos=2`       pedidos de amizade recebidos (a seção some com zero)
 *   `?foto=1`          amigas COM foto de perfil (o padrão é o avatar de inicial)
 */
export const Route = createFileRoute("/preview-amigas")({
  validateSearch: (q: Record<string, unknown>) => ({
    /* ⚠️ `== null` e não `=== undefined`: o router serializa e revalida, e na
       segunda passada chega `null` — `Number(null)` é 0, e a lista abria
       vazia sozinha na segunda passada. Sexta vez que isto aparece no repo. */
    n: q.n == null ? 4 : Number(q.n),
    dupla: q.dupla == null ? "ativa" : String(q.dupla),
    dias: q.dias == null ? 12 : Number(q.dias),
    /* A MAIOR sequência que a dupla já teve. Maior que `dias` mostra a
       memória de uma chama que já quebrou. */
    recorde: q.recorde == null ? 0 : Number(q.recorde),
    /* Há quantos dias a outra não aparece — é o que aciona a pausa gentil. */
    parada: q.parada == null ? 0 : Number(q.parada),
    /* Pedidos de amizade recebidos — a seção só existe quando há algum, e num
       ambiente de teste ninguém convida ninguém. */
    pedidos: q.pedidos == null ? 0 : Number(q.pedidos),
    premium: q.premium == null ? false : Boolean(q.premium),
    /* O código de indicação. Sem ele o "Convidar" explica em vez de mandar —
       `?semcodigo=1` é a única forma de fotografar esse estado. */
    codigo: q.semcodigo ? null : "ABC2345",
    luto: q.luto == null ? false : Boolean(q.luto),
    /* Liga o avatar com FOTO. Sem isto, o ramo do `<img>` do `Avatar` não é
       exercido por nenhuma foto da bancada. */
    foto: q.foto == null ? false : Boolean(q.foto),
  }),
  head: () => ({
    meta: [{ title: "Bancada das Amigas" }, { name: "robots", content: "noindex" }],
  }),
  component: PreviewAmigas,
});

/* Nomes e números fixos: a tela é renderizada no servidor, e sortear daria
   hidratação diferente dos dois lados. É o mesmo motivo dos CORACOES. */
const NOMES = ["Marina Costa", "Juliana Alves", "Camila Souza", "Beatriz Lima", "Renata Dias"];

/**
 * Um "retrato" para o `?foto=1` — um SVG `data:` de duas cores, não a foto de
 * ninguém.
 *
 * ⚠️ Nem arquivo no repositório, nem URL de serviço de fotos: o primeiro põe um
 * rosto de pessoa real num diretório de teste, e o segundo faz a bancada
 * depender da rede para desenhar (e vazar para fora quem a abriu). O que
 * importa olhar aqui é o RECORTE em círculo e o tamanho, e para isso duas
 * manchas de cor bastam.
 */
function retratoFalso(i: number): string {
  const cores = ["#c98fb0", "#8fa8d6", "#d9a86c", "#7fb894", "#a98fd0"];
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">` +
    `<rect width="64" height="64" fill="${cores[i % cores.length]}"/>` +
    `<circle cx="32" cy="24" r="12" fill="#ffffff" opacity="0.85"/>` +
    `<ellipse cx="32" cy="58" rx="20" ry="16" fill="#ffffff" opacity="0.85"/>` +
    `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/**
 * O Cantinho que a tela da amiga desenha na bancada.
 *
 * Enfeites que existem no catálogo de verdade (`CANTINHO_BY_ID` ignora id
 * desconhecido em silêncio, e a moldura sairia vazia sem dizer por quê).
 */
const CANTINHO_DE_EXEMPLO = {
  possui: ["ceu-lua", "ceu-sol"],
  fundo: null,
  skin: null,
  postos: [
    { id: "ceu-lua", x: 18, y: 120, s: 1 },
    { id: "ceu-sol", x: 62, y: 380, s: 1.2 },
  ],
};

function PreviewAmigas() {
  const { n, dupla, dias, premium, luto, codigo, recorde, parada, pedidos, foto } =
    Route.useSearch();

  const amigas: PerfilDeAmiga[] = NOMES.slice(0, Math.max(0, Math.min(NOMES.length, n))).map(
    (nome, i) => ({
      id: `amiga-${i}`,
      nome,
      bebe: i % 2 === 0 ? "Helena" : null,
      sequencia: 3 + i * 2,
      trofeus: 12 - i * 3,
      itens: 8 + i,
      diasNoApp: [43, 12, 1, 0, 143][i] ?? 30,
      /* ⚠️ A TERCEIRA não pode ser presenteada, e a SEGUNDA já foi. São os dois
         estados que o 🎁 tem além do normal, e nenhum deles aparece numa conta
         de teste sem um convite aceito e um presente já enviado. Ver
         `possoPresentear` e `jaPresenteada`. */
      possoPresentear: i !== 2,
      jaPresenteada: i === 1,
      /* ⚠️ SEM FOTO por padrão: é justamente o avatar de INICIAL que precisa
         ser olhado, porque é o que a maioria vai ver antes de subir uma — e
         era o caso que a primeira versão da tela tratava como se não
         existisse. `?foto=1` liga o outro caminho (o `<img>` recortado em
         círculo), que sem a bancada só dá para ver numa conta com upload
         feito. A imagem é gerada aqui mesmo, em SVG `data:` — nenhum pedido
         de rede, e nenhum rosto de pessoa real num arquivo de teste. */
      avatarUrl: foto ? retratoFalso(i) : null,
      /* Escalonado, para as faixas de `ultimaVez` caírem numa foto só:
         "agora mesmo", "há 3h", "ontem", "há 5 dias" e "há 1 mês". */
      vistaEm: new Date(
        Date.now() - [10 * 60e3, 3 * 3600e3, 26 * 3600e3, 5 * 86400e3, 40 * 86400e3][i],
      ).toISOString(),
    }),
  );

  const naTela: DuplaNaTela | null =
    dupla === "sem"
      ? null
      : {
          estado: dupla as EstadoDaDupla,
          amigaId: amigas[0]?.id ?? null,
          nome: amigas[0]?.nome ?? "Marina Costa",
          sequencia: dias,
          /* A memória e a pausa. `?recorde=` e `?parada=` fotografam os dois
             estados que só aparecem depois de semanas de uso real. */
          recorde: Math.max(dias, recorde),
          juntas: Math.max(dias, recorde) + 4,
          paradaHa: parada,
        };

  return (
    <div className="mx-auto max-w-md p-4">
      <AmigasTab
        careMode={luto}
        bancada={{
          amigas,
          dupla: naTela,
          assinante: premium,
          codigo,
          pedidos: NOMES.slice(0, Math.max(0, Math.min(3, pedidos))).map((nome, i) => ({
            id: `pedido-${i}`,
            nome,
            diasNoApp: [2, 30, 91][i] ?? 5,
          })),
          /* O Cantinho da amiga, para a TELA DELA abrir na bancada. Sem ele
             ela parava em "não foi possível abrir este perfil" — e é lá que
             mora o "Sair da amizade" desde que ele saiu da linha da lista. */
          cantinho: CANTINHO_DE_EXEMPLO,
        }}
      />
    </div>
  );
}
