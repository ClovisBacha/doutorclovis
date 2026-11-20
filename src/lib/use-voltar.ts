/**
 * O jeito React de assinar o "voltar" — ver `src/lib/voltar.ts` para o porquê.
 *
 * Fica num arquivo separado porque `voltar.ts` não importa React de propósito:
 * assim ele roda no teste sem árvore nenhuma montada, que é o que torna a pilha
 * verificável sem aparelho.
 */
import { useEffect, useRef } from "react";
import { registrarVoltar, registrarVoltarDeFundo } from "@/lib/voltar";

/**
 * Enquanto `ativo` for verdade, o botão de voltar do Android (e a tecla Escape)
 * chamam `aoVoltar` em vez de fechar o app.
 *
 * A função é guardada numa ref e o efeito depende SÓ de `ativo`. Sem isso,
 * qualquer componente que passe uma arrow inline — que é o normal —
 * desregistraria e registraria de novo a cada render, e a ordem da pilha (que é
 * o que faz a folha de cima fechar antes da de baixo) viraria a ordem dos
 * renders, não a ordem em que as telas abriram.
 *
 * ⚠️ **Devolver `false` é RECUSAR a vez**, e é o que faz a Comunidade e a
 * subida de nível conviverem: dentro de uma sub-tela da Comunidade quem assume
 * é ela; no feed ela recusa, e o voltar cai em quem está embaixo — a subida de
 * aba. Sem a recusa, a de cima engoliria o evento para sempre e a paciente
 * ficaria presa na aba.
 *
 * Devolver `void` continua querendo dizer "assumi": é o que as folhas fazem, e
 * é por isso que a assinatura aceita os dois — nenhuma delas precisou mudar.
 */
export function useVoltar(ativo: boolean, aoVoltar: () => boolean | void): void {
  const guardada = useRef(aoVoltar);
  guardada.current = aoVoltar;

  useEffect(() => {
    if (!ativo) return;
    return registrarVoltar(() => guardada.current() !== false);
  }, [ativo]);
}

/**
 * A rede de segurança da tela inteira — consultada por ÚLTIMO, sempre.
 *
 * ⚠️ Ela NÃO é `useVoltar` com outro nome. O efeito do FILHO roda antes do do
 * PAI: registrada pelo caminho normal, a subida de aba de `minha-conta`
 * entraria ACIMA da Comunidade na pilha e engoliria o voltar antes de a aba
 * ter a vez — de um perfil aberto, o voltar sairia da Comunidade inteira em
 * vez de devolver o feed. Ver `registrarVoltarDeFundo`.
 */
export function useVoltarDeFundo(ativo: boolean, aoVoltar: () => boolean | void): void {
  const guardada = useRef(aoVoltar);
  guardada.current = aoVoltar;

  useEffect(() => {
    if (!ativo) return;
    return registrarVoltarDeFundo(() => guardada.current() !== false);
  }, [ativo]);
}
