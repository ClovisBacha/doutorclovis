import { useEffect, useState } from "react";

/**
 * "ELA ESTÁ LOGADA?" — para o cabeçalho e a barra pública do SITE.
 *
 * Os dois componentes que o `__root` desenha em TODA página faziam a mesma
 * coisa, cada um com a sua cópia: um `useEffect` que lê a sessão e escuta a
 * troca de login, só para escolher entre "Entrar" e "Meu App".
 *
 * ⚠️ **O IMPORT DINÂMICO AQUI NÃO TIRA O SUPABASE DO PEDAÇO DE ENTRADA — foi
 * medido, e a hipótese estava errada (set/2026).** Trinta e seis arquivos o
 * importam de forma ESTÁTICA, e o Rollup iça o que é compartilhado por muitos
 * pedaços para o pedaço comum, que é justamente a entrada. Construído antes e
 * depois desta mudança, o número não se moveu:
 *
 *     antes  210.692 bytes comprimidos
 *     depois 210.718 bytes comprimidos
 *
 * O que esta função entrega, então, é UMA cópia do efeito no lugar de duas. O
 * import fica dinâmico porque não custa nada (o módulo já está carregado, e a
 * promessa resolve sem rede) e porque no dia em que os outros trinta e seis
 * saírem, o cabeçalho do site não segura o cliente sozinho.
 *
 * ⚠️ **Não muda um pixel**: o estado já nascia `false` e já se corrigia quando
 * a promessa da sessão respondia.
 *
 * ⚠️ **`vivo` guarda os dois lados.** A limpeza pode rodar ANTES de o
 * `import()` resolver: sem a bandeira, o componente desmontado assinaria o
 * `onAuthStateChange` que ninguém mais cancelaria, e um `setState` cairia numa
 * árvore que já saiu.
 *
 * ⚠️ **Falha ao carregar o cliente cai em VISITANTE**, que é o padrão do
 * estado. O erro possível aqui é o botão dizer "Entrar" para quem já está
 * logada, e o caminho continua inteiro; o oposto seria oferecer o app a quem
 * não tem conta.
 */
export function useSessaoDoSite(): boolean {
  const [logada, setLogada] = useState(false);

  useEffect(() => {
    let vivo = true;
    let desinscrever: (() => void) | null = null;

    void import("@/integrations/supabase/client")
      .then(({ supabase }) => {
        if (!vivo) return;
        void supabase.auth.getSession().then(({ data }) => {
          if (vivo) setLogada(!!data.session);
        });
        const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
          if (vivo) setLogada(!!s);
        });
        desinscrever = () => sub.subscription.unsubscribe();
      })
      .catch(() => {
        /* segue como visitante */
      });

    return () => {
      vivo = false;
      desinscrever?.();
    };
  }, []);

  return logada;
}
