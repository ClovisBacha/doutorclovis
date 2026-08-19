/**
 * O QUE A TELA DA CAIXINHA PRECISA — e NADA que só o servidor precisa.
 *
 * ─── ⚠️ POR QUE ESTE ARQUIVO EXISTE ────────────────────────────────────────
 *
 * `rede-instagram.tsx` precisava de três coisas triviais para desenhar a
 * caixinha: um número (o limite do campo), uma função que devolve string (o
 * recado) e um tipo. Ele as importou de `pergunta-clinica.ts`, que é onde elas
 * moravam — e `minha-conta.tsx` importa `rede-instagram.tsx` ESTATICAMENTE.
 *
 * O efeito, medido no bundle de produção: as regex clínicas inteiras foram
 * parar em `rede-instagram-*.js`, **inclusive o `(?<!` de fronteira que respeita
 * acento**. Negative lookbehind só existe no Safari a partir do 16.4: num iPhone
 * mais antigo o módulo estoura com `SyntaxError` no instante em que é carregado,
 * a rota inteira cai, e a paciente vê "Algo deu errado" ao abrir o app.
 *
 * Um número não pode custar isso. As regex ficam do lado do servidor, onde
 * sempre deviam ter ficado, e `regua-clinica-nao-vai-ao-navegador.test.ts`
 * impede a próxima importação.
 */

export type DesfechoDaPergunta =
  /** Pode virar post: não pede conduta e não fala de corpo. */
  | "publicavel"
  /** Fala de corpo ou pede conduta — vai para o médico DE QUEM PERGUNTOU. */
  | "clinica"
  /** Bandeira vermelha — abre a Central de Emergência, agora. */
  | "emergencia";

/** Teto de caracteres. Uma caixinha é uma pergunta, não um desabafo. */
export const LIMITE_DA_PERGUNTA = 280;

/**
 * O que a tela diz a quem escreveu.
 *
 * ⚠️ **Nunca o motivo detalhado.** Devolver "sua pergunta tem a palavra X"
 * ensina quais palavras passam, e quem quiser burlar precisa de duas
 * tentativas. A mensagem diz PARA ONDE foi, que é o que ela precisa saber.
 */
export function recadoDoDesfecho(d: DesfechoDaPergunta): string {
  if (d === "emergencia") {
    return "Isso precisa de atendimento agora, não de uma resposta aqui.";
  }
  if (d === "clinica") {
    return "Mandei a sua pergunta para o seu médico — é com ele que isso se resolve.";
  }
  return "Pergunta enviada 💛";
}
