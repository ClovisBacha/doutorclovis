import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { InAppNotices } from "@/components/inapp-notices";

/**
 * O PORTÃO DO APP — e ele NÃO PODE PENDURAR.
 *
 * ─── ⚠️ O DEFEITO QUE ISTO CONSERTA ────────────────────────────────────────
 *
 * A versão anterior era `await supabase.auth.getUser()`, e `getUser()` é uma
 * IDA À REDE, sem prazo. Reproduzido no navegador: com a chamada travada, a
 * rota simplesmente NUNCA resolve — nada renderiza, nada redireciona, nenhum
 * erro aparece. A paciente abre o app e olha uma tela vazia por tempo
 * indeterminado, sem um botão sequer para sair dali. Foi o que o dono viu.
 *
 * Um portão que depende de rede sem prazo não é portão: é uma porta que às
 * vezes não abre.
 *
 * ─── A ORDEM NOVA ──────────────────────────────────────────────────────────
 *
 * 1. `getSession()` LÊ O ARMAZENAMENTO LOCAL — sem rede, instantâneo. É a
 *    resposta certa para 99% das aberturas, e funciona no metrô.
 * 2. Sem sessão local, vai para `/auth`. É a tela de entrada do app, e é para
 *    lá que ela precisava ir desde o começo.
 * 3. Qualquer falha ou demora acima de `PRAZO_MS` também manda para `/auth`.
 *
 * ⚠️ **Trocar `getUser()` por `getSession()` NÃO afrouxa segurança**, e vale
 * dizer por quê: `getUser()` valida o token no servidor, `getSession()` só o lê
 * do disco. Mas este portão nunca foi a segurança — ele é NAVEGAÇÃO. Quem
 * protege dado é o servidor: toda função passa por `pacienteDaSessao`, que
 * chama `supabaseAdmin.auth.getUser(accessToken)` e recusa token inválido. Um
 * token forjado no `localStorage` abriria uma tela vazia e nada mais.
 *
 * ⚠️ **E errar para o lado de `/auth` é seguro; para o lado da tela vazia, não.**
 * Se ela estiver logada e o prazo estourar, `/auth` a devolve ao app em um
 * toque. Se ficar pendurada, não há toque nenhum que resolva.
 */

/** Prazo do portão. Acima disto, a tela de login — nunca a espera infinita. */
const PRAZO_MS = 4000;

/**
 * A URL traz material de login que o cliente ainda vai processar?
 *
 * ⚠️ **SEM ISTO, ENTRAR COM GOOGLE OU APPLE VIRARIA UM LAÇO.** O provedor
 * devolve a pessoa em `/minha-conta#access_token=…` (ou `?code=…` no PKCE), e
 * quem transforma isso em sessão é o `detectSessionInUrl` do supabase-js —
 * ASSÍNCRONO, e ainda não terminou quando o portão pergunta. `getSession()`
 * responderia "não tem" e a mandaria para `/auth` no instante seguinte a ela
 * ter feito login. O `getUser()` antigo escondia a corrida por acidente: ele ia
 * à rede, e a demora dava tempo ao parse.
 */
function urlTrazLogin(): boolean {
  if (typeof window === "undefined") return false;
  const h = window.location.hash;
  const q = window.location.search;
  return (
    h.includes("access_token=") ||
    h.includes("refresh_token=") ||
    h.includes("error_description=") ||
    q.includes("code=")
  );
}

/** Espera a sessão nascer do que veio na URL — no máximo `PRAZO_MS`. */
function esperarSessaoDaUrl(): Promise<boolean> {
  return new Promise((resolve) => {
    let pronto = false;
    const responder = (v: boolean) => {
      if (pronto) return;
      pronto = true;
      try {
        sub?.subscription.unsubscribe();
      } catch {
        /* já desinscrito */
      }
      resolve(v);
    };
    const sub = supabase.auth.onAuthStateChange((_e, sessao) => {
      if (sessao) responder(true);
    }).data;
    /* O evento pode ter passado antes de eu me inscrever — pergunta uma vez. */
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) responder(true);
    });
    setTimeout(() => responder(false), PRAZO_MS);
  });
}

/**
 * Há um token guardado no aparelho, mesmo que a sessão ainda não tenha
 * respondido?
 *
 * ⚠️ **ISTO EXISTE PARA MATAR UM PINGUE-PONGUE QUE EU CRIEI.** `/auth` faz o
 * caminho inverso: se acha sessão, devolve a pessoa para `/minha-conta`. Então
 * um `getSession()` LENTO (token expirado, renovação em curso) produzia:
 * portão estoura o prazo → `/auth` → `/auth` espera sem prazo e acha a sessão →
 * `/minha-conta` → portão estoura de novo. A tela piscando entre login e app.
 *
 * O disco responde na hora e sem rede: se o token está lá, ela ESTÁ logada —
 * só não deu tempo de renovar. Deixá-la entrar é o certo, e não afrouxa nada:
 * a primeira chamada ao servidor com token velho é recusada por
 * `pacienteDaSessao`, e a tela trata isso como sessão expirada.
 */
function temTokenNoAparelho(): boolean {
  try {
    if (typeof window === "undefined") return false;
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i) ?? "";
      /* O supabase-js guarda em `sb-<ref>-auth-token`. */
      if (k.startsWith("sb-") && k.endsWith("-auth-token") && localStorage.getItem(k)) return true;
    }
    return false;
  } catch {
    /* Modo privado ou cota: não dá para saber, e o prazo já decidiu. */
    return false;
  }
}

async function temSessao(): Promise<boolean> {
  try {
    /* ⚠️ A corrida é obrigatória mesmo com `getSession()` sendo local: em iOS,
       o armazenamento pode estar bloqueado (modo privado, cota) e a promessa
       fica pendente sem rejeitar. O prazo é o que garante que SEMPRE há uma
       resposta. */
    const agora = await Promise.race([
      supabase.auth.getSession().then(({ data }) => !!data.session),
      new Promise<boolean>((r) => setTimeout(() => r(false), PRAZO_MS)),
    ]);
    if (agora) return true;
    /* Acabou de voltar do Google/Apple? Dá o prazo para a sessão nascer. */
    if (urlTrazLogin()) return await esperarSessaoDaUrl();
    /* O prazo estourou, mas o token está no disco: ela está logada e a
       renovação é que demorou. Entrar é melhor que piscar entre login e app —
       ver `temTokenNoAparelho`. */
    return temTokenNoAparelho();
  } catch {
    return false;
  }
}

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    if (!(await temSessao())) throw redirect({ to: "/auth" });
  },
  component: () => (
    <>
      <InAppNotices />
      <Outlet />
    </>
  ),
});
