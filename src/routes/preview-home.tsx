import { createFileRoute } from "@tanstack/react-router";
import { AppBottomNav, AppHomeScreen } from "@/components/app-mobile-shell";

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
    notif: s.notif === true || String(s.notif ?? "") === "1",
  }),
  head: () => ({
    meta: [{ title: "Bancada da home" }, { name: "robots", content: "noindex" }],
  }),
  component: PreviewHome,
});

function PreviewHome() {
  const { w, notif } = Route.useSearch();
  return (
    <div className="fixed inset-0 z-[75] overflow-y-auto bg-background">
      <div className="mx-auto max-w-md px-5 pt-2">
        <AppHomeScreen
          firstName="Clovis"
          babyName="Clovis"
          gest={{ weeks: w, days: 6, totalDays: w * 7 + 6 }}
          onNavigate={() => {}}
          onOpenMenu={() => {}}
          nextAppointment={null}
          babyTone={0}
          careMode={false}
          skyTheme="v2"
          temNaoLidas={notif}
        />
      </div>
      <AppBottomNav activeSection="home" onSelect={() => {}} onEmergency={() => {}} />
    </div>
  );
}
