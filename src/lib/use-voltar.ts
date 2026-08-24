/**
 * O jeito React de assinar o "voltar" — ver `src/lib/voltar.ts` para o porquê.
 *
 * Fica num arquivo separado porque `voltar.ts` não importa React de propósito:
 * assim ele roda no teste sem árvore nenhuma montada, que é o que torna a pilha
 * verificável sem aparelho.
 */
import { useEffect, useRef } from "react";
import { registrarVoltar } from "@/lib/voltar";

/**
 * Enquanto `ativo` for verdade, o botão de voltar do Android (e a tecla Escape)
 * chamam `aoVoltar` em vez de fechar o app.
 *
 * A função é guardada numa ref e o efeito depende SÓ de `ativo`. Sem isso,
 * qualquer componente que passe uma arrow inline — que é o normal —
 * desregistraria e registraria de novo a cada render, e a ordem da pilha (que é
 * o que faz a folha de cima fechar antes da de baixo) viraria a ordem dos
 * renders, não a ordem em que as telas abriram.
 */
export function useVoltar(ativo: boolean, aoVoltar: () => void): void {
  const guardada = useRef(aoVoltar);
  guardada.current = aoVoltar;

  useEffect(() => {
    if (!ativo) return;
    return registrarVoltar(() => {
      guardada.current();
      return true;
    });
  }, [ativo]);
}
