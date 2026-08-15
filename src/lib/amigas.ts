/**
 * AS AMIGAS — as réguas puras da aba social.
 *
 * ─── O QUE SEPARA ISTO DO DUOLINGO ──────────────────────────────────────────
 *
 * Num app de idioma, comparar é inofensivo: quem faz mais lições ganhou um
 * jogo. Aqui, comparar é comparar cuidado com o próprio bebê — e num público de
 * gestação de alto risco isso não motiva, culpa. Some-se a isso o caso que
 * nenhum app de idioma tem: **uma delas pode perder a gestação**.
 *
 * Daí as três decisões que atravessam este arquivo inteiro:
 *
 *  1. **Nada clínico sai daqui.** O perfil mostra o que ela CONSTRUIU (chama,
 *     troféus, Cantinho), nunca o estado do corpo: sem semanas, sem DPP, sem
 *     peso, sem pressão. Não é só privacidade — é o que permite a aba
 *     continuar de pé quando uma gestação termina mal.
 *  2. **Cooperativo, nunca competitivo.** Não existe placar. A dupla é uma
 *     chama que as duas seguram; ninguém fica atrás de ninguém, e a sequência
 *     de uma não é diminuída pela da outra.
 *  3. **Só quem já se conhece.** O grafo de amizade é o de INDICAÇÃO
 *     (`referred_by`), nos dois sentidos. Não há busca, não há pedido de
 *     estranho, não há o que moderar: para virar amiga de alguém foi preciso
 *     que uma tenha mandado o convite para a outra, fora do app.
 */

/** A data local em `YYYY-MM-DD`, que é como o ledger é fatiado por dia. */
export function diaLocal(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * OS DIAS DE CALENDÁRIO em que a pessoa fez alguma coisa.
 *
 * ─── POR QUE POR DATA, E NÃO PELO DIA GESTACIONAL ───────────────────────────
 *
 * A chama individual conta dias gestacionais (`wellness:<atividade>:<ciclo>:<dia>`),
 * e isso funciona porque é a régua de UMA pessoa. Para uma dupla não serve: às
 * segundas-feiras, uma pode estar no dia 65 e a outra no dia 190. Intersectar
 * números de dia juntaria terças com sábados.
 *
 * O que as duas compartilham é o CALENDÁRIO, então a interseção é por data — e
 * a data sai do `created_at` da linha, que o servidor carimba.
 */
export function diasDeAtividade(
  linhas: readonly { dedupe_key?: string | null; created_at?: string | null }[],
  prefixo = "wellness:",
): Set<string> {
  const dias = new Set<string>();
  for (const l of linhas) {
    if (!l.dedupe_key?.startsWith(prefixo)) continue;
    const t = l.created_at ? new Date(l.created_at) : null;
    if (!t || Number.isNaN(t.getTime())) continue;
    dias.add(diaLocal(t));
  }
  return dias;
}

/** Ontem, hoje — em `YYYY-MM-DD`, andando pelo calendário sem cair no fuso. */
function recuar(dia: string, quantos: number): string {
  const [a, m, d] = dia.split("-").map(Number);
  /* `Date.UTC` + leitura em UTC: montar a data em horário local e recuar por
     `setDate` atravessa horário de verão e pula (ou repete) um dia. */
  const t = new Date(Date.UTC(a, m - 1, d) - quantos * 86400000);
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(
    t.getUTCDate(),
  ).padStart(2, "0")}`;
}

/**
 * A CHAMA DA DUPLA — dias seguidos em que AS DUAS apareceram.
 *
 * Herda o perdão da meia-noite da chama individual: se HOJE ainda não fechou
 * dos dois lados, a contagem começa de ONTEM. Sem isso, a dupla que as duas
 * seguram há 30 dias mostraria zero toda manhã — e numa chama compartilhada
 * isso é pior que na individual, porque cada uma acharia que a outra deixou
 * cair.
 *
 * O teto (`limite`) existe porque a contagem anda para trás um dia por vez:
 * dois conjuntos grandes e coincidentes não podem virar um laço longo dentro
 * de uma requisição.
 */
export function sequenciaDaDupla(
  minhas: ReadonlySet<string>,
  dela: ReadonlySet<string>,
  hoje: string,
  limite = 400,
): number {
  const juntas = (dia: string) => minhas.has(dia) && dela.has(dia);
  let cursor = juntas(hoje) ? hoje : recuar(hoje, 1);
  let n = 0;
  while (juntas(cursor) && n < limite) {
    n++;
    cursor = recuar(cursor, 1);
  }
  return n;
}

/**
 * A MEMÓRIA DA DUPLA — o que elas já fizeram, e não só o que estão fazendo.
 *
 * ─── POR QUE ISTO EXISTE ────────────────────────────────────────────────────
 *
 * `sequenciaDaDupla` responde "quantos dias seguidos ATÉ HOJE", e é o número
 * que acende a chama. Mas ele zera quando a chama quebra — e aí uma dupla que
 * segurou sessenta dias juntas e parou numa semana de internação fica com
 * **zero**, como se nunca tivesse existido.
 *
 * Num app de idioma isso é justo: o streak é o jogo. Aqui o vínculo é o ponto,
 * e apagar o histórico dele no pior momento da vida de uma das duas é
 * exatamente o oposto do que a aba existe para fazer.
 *
 * ⚠️ **É RETROATIVO e não pede coluna nenhuma**: sai da interseção dos dias que
 * as duas já têm no ledger, que é o mesmo dado que a chama usa. Uma coluna
 * `maior_sequencia` teria de ser mantida atualizada, e começaria zerada para
 * todas as duplas que já existem.
 */

/** Quantos dias, no total, as duas apareceram no MESMO dia. */
export function diasJuntas(minhas: ReadonlySet<string>, dela: ReadonlySet<string>): number {
  let n = 0;
  /* Percorre o MENOR dos dois conjuntos: a interseção é simétrica, e um
     `for` sobre o maior custa o dobro sem mudar a resposta. */
  const [a, b] = minhas.size <= dela.size ? [minhas, dela] : [dela, minhas];
  for (const dia of a) if (b.has(dia)) n++;
  return n;
}

/**
 * A MAIOR sequência que a dupla já teve — inclusive uma que já quebrou.
 *
 * ⚠️ Ordena as datas em vez de andar dia a dia para trás: `sequenciaDaDupla`
 * anda para trás a partir de hoje e por isso tem um teto de 400 iterações, mas
 * aqui o começo é desconhecido. Ordenando, o custo é o do `sort` e a resposta
 * é exata para qualquer histórico.
 *
 * Datas em `YYYY-MM-DD` ordenam corretamente como texto — é a razão de o app
 * inteiro guardar o dia nesse formato.
 */
export function maiorSequenciaDaDupla(
  minhas: ReadonlySet<string>,
  dela: ReadonlySet<string>,
): number {
  const juntas: string[] = [];
  const [a, b] = minhas.size <= dela.size ? [minhas, dela] : [dela, minhas];
  for (const dia of a) if (b.has(dia)) juntas.push(dia);
  if (juntas.length === 0) return 0;
  juntas.sort();

  let melhor = 1;
  let atual = 1;
  for (let i = 1; i < juntas.length; i++) {
    atual = juntas[i] === recuar(juntas[i - 1], -1) ? atual + 1 : 1;
    if (atual > melhor) melhor = atual;
  }
  return melhor;
}

/**
 * Há quantos dias a OUTRA não aparece. `null` = ela nunca apareceu.
 *
 * ⚠️ Serve para a tela dizer que a chama está em PAUSA, e nunca para dizer por
 * quê. A régua é a mesma do Modo Cuidado: o app pode mostrar que algo mudou de
 * ritmo, jamais o motivo — "ela está internada" é informação clínica de outra
 * pessoa, e nem o app sabe disso.
 */
export function diasSemAparecer(
  dela: ReadonlySet<string>,
  hoje: string,
  limite = 400,
): number | null {
  if (dela.size === 0) return null;
  for (let i = 0; i <= limite; i++) if (dela.has(recuar(hoje, i))) return i;
  return limite;
}

/**
 * O par ORDENADO, como a tabela `duplas` guarda.
 *
 * (A,B) e (B,A) têm de virar a mesma linha, senão duas pacientes convidando
 * uma à outra ao mesmo tempo criam duas duplas entre as mesmas pessoas e cada
 * tela lê a sua.
 */
export function parOrdenado(a: string, b: string): { menor: string; maior: string } {
  return a < b ? { menor: a, maior: b } : { menor: b, maior: a };
}

/** Quem é a OUTRA, vista de dentro de uma linha de dupla. */
export function aOutra(linha: { menor: string; maior: string }, eu: string): string | null {
  if (linha.menor === eu) return linha.maior;
  if (linha.maior === eu) return linha.menor;
  return null;
}

/**
 * O ESTADO DA DUPLA, do ponto de vista de quem olha.
 *
 * Quatro estados e não dois: "convite que EU mandei" e "convite que ME
 * mandaram" pedem telas opostas — uma espera, a outra decide. Tratá-los como
 * um só ("pendente") foi o que fez, no primeiro rascunho, aparecer um botão
 * "Aceitar" para quem tinha acabado de convidar.
 */
export type EstadoDaDupla = "sem" | "convite-enviado" | "convite-recebido" | "ativa";

export function estadoDaDupla(
  linha: { menor: string; maior: string; quem_convidou: string; aceita: boolean } | null,
  eu: string,
): EstadoDaDupla {
  if (!linha || !aOutra(linha, eu)) return "sem";
  if (linha.aceita) return "ativa";
  return linha.quem_convidou === eu ? "convite-enviado" : "convite-recebido";
}

/**
 * O PERFIL DE JOGO — o que uma amiga pode ver.
 *
 * A lista é curta de propósito, e o que ela NÃO tem importa mais do que o que
 * tem: nenhuma semana, nenhuma DPP, nenhuma medida. Ver a régua no topo do
 * arquivo.
 */
export type PerfilDeAmiga = {
  id: string;
  nome: string;
  /** Nome do bebê, se ela deu um. É afeto, não dado clínico. */
  bebe: string | null;
  /** Dias seguidos dela. Aparece como conquista, nunca ao lado da minha. */
  sequencia: number;
  trofeus: number;
  /** Quantos itens do Cantinho ela tem — o tamanho da coleção. */
  itens: number;
  /** Há quanto tempo ela está no app, em dias. */
  diasNoApp: number;
  /**
   * ⚠️ EU POSSO PRESENTEAR ESTA AMIGA?
   *
   * A lista é o grafo de indicação nos DOIS sentidos (quem eu trouxe **e** quem
   * me trouxe), mas `presentearAmiga` só aceita quem EU indiquei
   * (`.eq("referred_by", uid)`). Sem este campo, a assinante que ENTROU pelo
   * convite de alguém via o 🎁 na linha de quem a trouxe, tocava, e recebia
   * "Vocês precisam estar conectadas pelo convite" — uma frase falsa, porque
   * estão, só que pelo lado oposto. Atinge toda paciente que chegou por
   * indicação, que é justamente o caminho que a aba inteira promove.
   */
  possoPresentear: boolean;
  /**
   * Já ganhou presente meu NESTE ciclo — o servidor recusaria um segundo.
   *
   * ⚠️ Vem do LEDGER, não da memória da tela. A primeira versão guardava isso
   * num `Set` do componente: bastava trocar de aba (que desmonta a aba) para os
   * 🎁 voltarem ao normal e o servidor responder `ja_presenteada`. É a mesma
   * lição já registrada para a mesada do médico — "o painel não esquece mais
   * quem já recebeu" —, que se resolve derivando dos `dedupe_key`.
   */
  jaPresenteada: boolean;
};

/**
 * O CONTADOR DA FITA — o número que substituiu a palavra "Amigas".
 *
 * Pedido do dono: o ícone mostra QUANTAS, e acima de cem vira `99+`. O teto
 * existe porque a fita tem quatro itens dividindo a largura de um celular: um
 * "137" empurra os vizinhos e faz a linha inteira dançar quando alguém entra.
 *
 * `99+` e não `100+`: o `+` já diz "e mais", e 99 é o último número que cabe em
 * dois dígitos — que é a largura que a fita foi desenhada para segurar.
 */
export const TETO_DO_CONTADOR = 99;

export function rotuloDeAmigas(n: number): string {
  /* Número torto vira zero, nunca `NaN` na fita: a contagem vem de uma consulta
     que pode falhar, e "NaN amigas" é o tipo de coisa que a paciente
     fotografa. */
  const v = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
  return v > TETO_DO_CONTADOR ? `${TETO_DO_CONTADOR}+` : String(v);
}

/** Um enfeite posto na trilha dela: posição em % da largura, y em px, escala. */
export type EnfeitePosto = { id: string; x: number; y: number; s: number };

/**
 * SANEIA O LAYOUT DO CANTINHO DELA.
 *
 * O `journey_state` é blob escrito pelo NAVEGADOR dela — chega como veio, e
 * pode chegar corrompido por uma versão antiga do app ou por uma sincronização
 * pela metade. Passar isso direto para a tela é confiar num dado que ninguém
 * validou para desenhar a tela de outra pessoa.
 *
 * Descarta o que não tem forma de enfeite, prende os números em faixas
 * plausíveis (um `s: 900` viraria um emoji cobrindo a tela inteira) e corta em
 * 60 — quem tem 200 enfeites não precisa mandar os 200 pela rede.
 */
export function saneiaEnfeites(cru: unknown): EnfeitePosto[] {
  if (!Array.isArray(cru)) return [];
  const fora: EnfeitePosto[] = [];
  for (const item of cru) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    if (typeof o.id !== "string" || !o.id) continue;
    const num = (v: unknown, min: number, max: number, padrao: number) =>
      typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : padrao;
    fora.push({
      id: o.id.slice(0, 60),
      x: num(o.x, 0, 100, 50),
      y: num(o.y, 0, 20000, 0),
      s: num(o.s, 0.3, 3, 1),
    });
    if (fora.length >= 60) break;
  }
  return fora;
}

/**
 * "no app há X" em texto curto.
 *
 * Dias vira meses depois de 60, porque "no app há 143 dias" é um número que
 * ninguém converte de cabeça — e o que a frase quer dizer é "faz tempo".
 */
export function tempoNoApp(dias: number): string {
  const d = Math.max(0, Math.floor(dias));
  if (d < 1) return "chegou hoje";
  if (d === 1) return "chegou ontem";
  if (d < 60) return `no app há ${d} dias`;
  const meses = Math.round(d / 30);
  return `no app há ${meses} meses`;
}
