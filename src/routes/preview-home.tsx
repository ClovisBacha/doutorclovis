import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { AppBottomNav, AppHomeScreen, useSkyNow } from "@/components/app-mobile-shell";
import { publicarAtalhos } from "@/lib/atalhos-da-aba";

/**
 * Bancada de design da HOME — renderiza o AppHomeScreen REAL com dados fixos
 * (semana 19 e 6 dias, os mesmos da referência aprovada; `?w=20` troca a
 * semana), sem exigir login.
 *
 * Existe porque a home de verdade vive atrás do Supabase Auth: sem esta rota,
 * cada conferência visual dependia de uma reprodução manual do layout, e as
 * diferenças entre a reprodução e o componente real viravam erro em produção.
 * Aqui o Playwright fotografa o próprio componente, período a período (a hora
 * vem do relógio do navegador — o harness a controla com clock emulation).
 *
 * Não expõe nenhum dado: tudo é constante de exemplo. O overlay `fixed` cobre
 * o shell público (header/rodapé) que o __root sempre desenha.
 */
export const Route = createFileRoute("/preview-home")({
  // `?w=20` troca a semana: o cartão de medidas muda de fruta, tamanho e peso a
  // cada semana, e conferir só a 19 deixaria os outros 39 casos sem prova.
  // `?notif=1` acende o ponto vermelho do ☰ — sem isso não havia como
  // fotografar o estado "tem notificação por abrir".
  // Aceita `1` E `true` de propósito: o router revalida a busca depois de
  // serializá-la, então `1` vira `true` na URL e chega aqui de volta. Uma
  // validação que só entendesse `1` apagaria o próprio parâmetro no segundo
  // passe — foi o que aconteceu.
  validateSearch: (s: Record<string, unknown>) => ({
    w: Number(s.w) || 19,
    /* `?notif=1` acende o mascote com um recado; `?notif=3` com três. O
       booleano decide SE ele fala e o número decide o que o emblema mostra —
       foi para poder fotografar o "9+" sem inventar nove notificações.

       ⚠️ `quantos` lê o PRÓPRIO campo antes de `notif`, e é obrigatório: o
       router serializa e revalida, então na segunda passada `s.notif` já é o
       booleano `true` — e `Number(true)` é **1**. Tirando `s.quantos` daqui,
       `?notif=3` virava três na primeira renderização e um na seguinte. Mesma
       armadilha que `preview-saude` documenta para `?w=`. */
    notif: s.notif === true || Number(s.notif) > 0 || String(s.notif ?? "") === "1",
    quantos: Math.max(0, Number(s.quantos ?? s.notif) || 0),
    // `?clima=1` liga a consulta real de clima (Belo Horizonte) — é a única
    // forma de fotografar o cartão de saudação, que só existe quando há
    // clima. Sem o parâmetro a bancada continua offline.
    clima: s.clima === true || String(s.clima ?? "") === "1",
    /* `?atalhos=1` publica atalhos de mentira na seção da home, para dar para
       fotografar a NUVEM DE BOLINHAS: ela só abre ao tocar de novo no ícone de
       uma aba que publicou atalhos, e no app quem publica é o feed — atrás do
       login. Sem isto, a nuvem seria mais uma tela que ninguém olhou. */
    atalhos: s.atalhos === true || String(s.atalhos ?? "") === "1",
  }),
  head: () => ({
    meta: [{ title: "Bancada da home" }, { name: "robots", content: "noindex" }],
  }),
  component: PreviewHome,
});

function PreviewHome() {
  const { w, notif, quantos, clima, atalhos } = Route.useSearch();
  const { slot } = useSkyNow(null);
  const escuro = slot.dark;

  useEffect(() => {
    if (!atalhos) return;
    return publicarAtalhos("home", [
      { id: "a", rotulo: "Buscar", icone: "buscar", aoTocar: () => {} },
      { id: "b", rotulo: "Atividade", icone: "coracao", emblema: 3, aoTocar: () => {} },
      { id: "c", rotulo: "Publicar", icone: "mais", aoTocar: () => {} },
      { id: "d", rotulo: "Meu perfil", icone: "pessoa", aoTocar: () => {} },
      { id: "e", rotulo: "Salvos", icone: "marcador", aoTocar: () => {} },
      { id: "f", rotulo: "Chá de bebê, álbum…", icone: "grade", aoTocar: () => {} },
    ]);
  }, [atalhos]);
  return (
    <div className="fixed inset-0 z-[75] overflow-y-auto bg-background">
      {/* Repete a folga de rodapé que a página real aplica (a barra
          flutuante fica por cima), para a bancada medir o mesmo espaço. */}
      {/* A MESMA geometria de `minha-conta`, não uma aproximação: `max-w-5xl`,
          `px-5` e a folga de topo em `1.5rem`. Com `pt-2` a bancada casava por
          acaso com um `-mt` errado do hero e ESCONDIA a faixa creme de 16px
          que aparecia em produção — a bancada era o único lugar do produto
          onde o defeito não existia. */}
      <div className="mx-auto max-w-5xl px-5 pb-[calc(7rem+var(--safe-bottom))] pt-[calc(1.5rem+var(--safe-top))]">
        <AppHomeScreen
          firstName="Clovis"
          babyName="Clovis"
          gest={{ weeks: w, days: 6, totalDays: w * 7 + 6 }}
          onNavigate={() => {}}
          onOpenMenu={() => {}}
          babyTone={0}
          careMode={false}
          skyTheme="v2"
          temNaoLidas={notif}
          naoLidas={quantos}
          homeCity={clima ? { nome: "Belo Horizonte", lat: -19.92, lon: -43.94 } : null}
        />
      </div>
      <AppBottomNav
        activeSection="home"
        onSelect={() => {}}
        onEmergency={() => {}}
        /* A bancada não tem o estado da página: aqui o escuro vem da mesma
           faixa de céu que a home usa, para a foto sair igual à do app. */
        escura={escuro}
      />
    </div>
  );
}
