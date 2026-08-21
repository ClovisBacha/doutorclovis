import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { prepararNativo } from "@/lib/nativo";

/* O boot do lado nativo acontece aqui, e não num `useEffect` do `__root.tsx`,
   de propósito: este módulo é o começo do lado cliente e roda ANTES de qualquer
   componente montar. Os plugins vêm por `import()` dinâmico — quanto antes o
   pedido sair, antes a primeira vibração tem com o que tocar — e a tela de
   abertura sai assim que eles chegam. Se isso dependesse de uma árvore React
   renderizar, um erro de hidratação deixaria a marca na tela.
   No servidor e no navegador é no-op — a função checa se há ponte nativa antes
   de sequer buscar o pedaço de código nativo. */
prepararNativo();

export const getRouter = () => {
  const router = createRouter({
    routeTree,
    /* Restaurar a rolagem é o certo para o site: quem lia um texto longo,
       clicou num link e voltou, quer cair onde parou.
       Dentro do app (`/minha-conta`) é o contrário. Lá as telas não são rotas
       — são estado do React sobre uma URL só — então a posição guardada
       pertence a QUALQUER aba em que a paciente estava, e restaurá-la joga
       ela no meio de uma tela diferente. Voltar para o app tem que abrir no
       começo. Desligar por localização evita disputa: sem isso, o reset
       manual e a restauração brigariam pelo mesmo quadro. */
    scrollRestoration: ({ location }) => !location.pathname.startsWith("/minha-conta"),
    defaultPreloadStaleTime: 0,
    defaultViewTransition: true,
  });

  return router;
};
