/**
 * O RELÓGIO DAS DUAS TELAS DE CRONÔMETRO, ESCRITO UMA VEZ.
 *
 * ⚠️ **`mm:ss` cravado vira "125:00" e "3502:18".** No contador de movimentos o
 * caso normal é a sessão de DUAS HORAS — é o próprio critério que a tela
 * anuncia —, e quem lê mm:ss lê "125:00" como cento e vinte e cinco minutos só
 * depois de pensar; a leitura imediata é de um relógio quebrado. No cronômetro
 * de contrações o caso é ela ESQUECER de parar (dor, sono, telefone no bolso):
 * a contração aberta é retomada do banco e ancorada no `started_at`, então na
 * abertura seguinte a tela mostra horas em minutos. Medido na bancada:
 * **3502:18**.
 *
 * ⚠️ E a régua mora aqui, e não copiada nas duas telas, porque este par é o
 * exemplo do repositório para o defeito de "cada conserto foi aplicado só de um
 * lado": o contador de movimentos já tinha o `h:mm:ss` — com a razão escrita e
 * o registro de que foi a FOTO que mostrou —, e o cronômetro de contrações
 * seguia com o formato antigo.
 */

/** `mm:ss` até a primeira hora; `h:mm:ss` depois dela. */
export function relogioDeSessao(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const segs = total % 60;
  const mins = Math.floor(total / 60);
  const horas = Math.floor(mins / 60);
  const dois = (n: number) => String(n).padStart(2, "0");
  return horas > 0 ? `${horas}:${dois(mins % 60)}:${dois(segs)}` : `${dois(mins)}:${dois(segs)}`;
}
