import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { esconderSplash } from "@/lib/nativo";

/* A tela de abertura do app nativo sai aqui, e não num `useEffect` do
   `__root.tsx`, de propósito: este módulo é o começo do lado cliente e roda
   ANTES de qualquer componente montar. Se a splash dependesse de uma árvore
   React renderizar, um erro de hidratação a deixaria na tela.
   No servidor e no navegador é no-op — a função checa se há ponte nativa. */
esconderSplash();

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
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
