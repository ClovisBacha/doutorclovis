/**
 * A AULA QUE ELA ACABOU DE FAZER, para o compositor da Comunidade oferecer.
 *
 * ─── POR QUE ISTO EXISTE, EM VEZ DE O COMPOSITOR PERGUNTAR ─────────────────
 *
 * Quem sabe qual é a aula do dia é o Caminho (`gestacao-path.tsx`), e ele
 * carrega o banco de 674 KB por `import()` dinâmico — de propósito, depois de
 * a abertura de Minha Conta ter caído 40% por causa disso. O compositor vive na
 * aba Comunidade, e fazê-lo perguntar ao banco de aulas traria os 674 KB de
 * volta para uma tela que não ensina nada.
 *
 * Então o Caminho DEIXA UM BILHETE quando ela termina a aula, e a Comunidade o
 * lê. Um bilhete pequeno, com uma palavra.
 *
 * ─── ⚠️ E O BILHETE NÃO CARREGA O DIA ──────────────────────────────────────
 *
 * O dia gestacional é a semana dela disfarçada (**D = semana × 7 + dia**).
 * Guardar `dia` aqui faria a conversão acontecer perto do servidor, e a
 * primeira pessoa a "otimizar" mandaria o número junto. Guardando só o TEMA, a
 * semana não tem por onde vazar — nem para o post, nem para o banco.
 */
import { temaDoDia, type AulaNoPost, type TemaDaAula } from "@/lib/rede-social";

/** Onde o bilhete mora. Prefixo `dc-` como o resto do armazém local. */
export const CHAVE_DA_AULA = "dc-aula-de-hoje";

type Bilhete = { tema: TemaDaAula; quando: number };

/**
 * O Caminho chama isto quando a aula termina.
 *
 * ⚠️ Recebe o DIA e guarda o TEMA — a conversão acontece aqui, no aparelho
 * dela, e é o que garante que o número nunca saia.
 */
export function guardarAulaDeHoje(dia: number, agora: number = Date.now()): void {
  try {
    const b: Bilhete = { tema: temaDoDia(dia), quando: agora };
    localStorage.setItem(CHAVE_DA_AULA, JSON.stringify(b));
  } catch {
    /* Modo privado, cota estourada: o anexo simplesmente não é oferecido. */
  }
}

/**
 * Quanto tempo o bilhete vale.
 *
 * ⚠️ Doze horas, e não "até o fim do dia": ela pode fazer a aula às 23h50 e
 * querer publicar às 00h10 — e um corte de calendário apagaria o bilhete no
 * meio do gesto. Doze horas também impedem o anexo de aparecer três dias
 * depois, oferecendo "a aula de hoje" sobre uma aula de terça.
 */
export const VALIDADE_HORAS = 12;

/** O que o compositor oferece — ou `null`, que é o normal. */
export function aulaDeHojeParaCompartilhar(agora: number = Date.now()): AulaNoPost | null {
  try {
    const cru = localStorage.getItem(CHAVE_DA_AULA);
    if (!cru) return null;
    const b = JSON.parse(cru) as Partial<Bilhete>;
    if (!b || typeof b.tema !== "string" || typeof b.quando !== "number") return null;
    if (agora - b.quando > VALIDADE_HORAS * 3600 * 1000) return null;
    /* Relógio que andou para trás não vale bilhete do futuro. */
    if (b.quando > agora + 60_000) return null;
    return { tema: b.tema as TemaDaAula };
  } catch {
    return null;
  }
}
