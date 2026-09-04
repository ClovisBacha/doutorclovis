import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { FaixaDeConvite } from "@/components/faixa-de-convite";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getMyDoctor } from "@/lib/doctors.functions";
import { checkIsAdmin } from "@/lib/admin.functions";
import { AppleButton, GoogleButton, OrDivider } from "@/components/google-button";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — Obstétrica" },
      {
        name: "description",
        content: "Acesse sua conta para acompanhar semana a semana o desenvolvimento do seu bebê.",
      },
    ],
  }),
  component: AuthPage,
});

function translateAuthError(msg: string): string {
  if (msg.includes("Invalid login credentials"))
    return "E-mail ou senha incorretos. Tente novamente.";
  if (msg.includes("Email not confirmed"))
    return "Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada.";
  if (msg.includes("User already registered"))
    return "Já existe uma conta com este e-mail. Faça login.";
  if (msg.includes("Password should be at least"))
    return "A senha precisa ter pelo menos 6 caracteres.";
  if (msg.includes("Unable to validate email"))
    return "E-mail inválido. Verifique o endereço digitado.";
  if (msg.includes("rate limit") || msg.includes("too many"))
    return "Muitas tentativas. Aguarde alguns minutos e tente novamente.";
  if (msg.includes("network") || msg.includes("fetch"))
    return "Erro de conexão. Verifique sua internet e tente novamente.";
  return "Ocorreu um erro. Tente novamente ou entre em contato pelo WhatsApp.";
}

function AuthPage() {
  const navigate = useNavigate();
  // Veio do link de redefinição de senha? (Supabase põe type=recovery no hash.)
  // Precisa ser detectado ANTES de qualquer redirect, senão a sessão de
  // recovery joga a usuária para dentro do app sem deixar trocar a senha.
  const isRecoveryLink =
    typeof window !== "undefined" && window.location.hash.includes("type=recovery");
  const [mode, setMode] = useState<"login" | "signup" | "forgot" | "reset">(
    isRecoveryLink ? "reset" : "login",
  );
  // Papel escolhido: define o destino pós-login e o fluxo de cadastro.
  /**
   * ⚠️ "acompanhante" NÃO É UM PAPEL DE LOGIN — e é por isso que ele está aqui.
   *
   * Paciente e médico criam CONTA. O acompanhante, no modelo que o app já tem,
   * não cria: a gestante gera um convite (`companion_invites`) e manda o link;
   * ele abre `/acompanhar/<token>` e vê o painel dela, sem senha e sem cadastro.
   *
   * Ele entra no seletor mesmo assim porque a pergunta que a pessoa faz ao
   * abrir esta tela é "qual é o meu lugar aqui?", e antes disso ela só tinha
   * duas respostas — o pai ou a companheira que chegasse aqui ficava sem
   * caminho nenhum, ou criava uma conta de gestante por engano.
   *
   * ⚠️ DECISÃO TOMADA NA AUSÊNCIA DO DONO: ele perguntou se o acompanhante teria
   * conta própria e saiu antes de responder. Escolhi o mecanismo que JÁ EXISTE,
   * porque inventar login de acompanhante significa tabela nova, RLS nova e uma
   * decisão de privacidade (o que ele passa a ver, e por quanto tempo) que é
   * dele e não minha. Se a resposta for "sim, conta própria", esta tela é o
   * lugar certo para crescer — o botão já está aqui.
   */
  const [role, setRole] = useState<"paciente" | "medico" | "acompanhante">("paciente");
  /** O link ou código que a gestante mandou. */
  const [convite, setConvite] = useState("");
  /* Se esta pessoa já começou um cadastro de médico neste aparelho, o seletor
     nasce em "médico".

     Sem isto, o botão "Continuar com Google" — que usa este estado — mandava o
     médico para `/minha-conta`, porque o padrão é paciente e o seletor fica
     ACIMA do botão: dá para tocar no Google sem nunca notar que havia uma
     escolha. É a porta mais provável do relato de cair no app da gestante
     entrando com o Google. */
  useEffect(() => {
    void import("@/lib/intencao-medico").then((m) => {
      if (m.querSerMedico()) setRole("medico");
    });
  }, []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [showResend, setShowResend] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);

  useEffect(() => {
    // Nunca redireciona durante o fluxo de redefinição de senha.
    if (isRecoveryLink) return;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) return;
      /* ADMIN PRIMEIRO, antes de qualquer outra pergunta.

         O dono da plataforma caía no app da GESTANTE — 18 mil linhas de jornada
         de gravidez — e o console dele, com faturamento, médicos e cupons, só
         era alcançável digitando /admin na barra de endereço. Nenhum link
         levava lá.

         A ordem importa e não é detalhe: o e-mail do dono também está em
         ADMIN_EMAILS como "equipe do consultório", então a pergunta "é médico?"
         respondia sim e o mandava para o painel do consultório. Perguntar
         "é dono?" primeiro é o que separa as duas identidades. */
      try {
        const adm = await checkIsAdmin({ data: { accessToken: data.session.access_token } });
        if (adm.isAdmin) {
          navigate({ to: "/admin" });
          return;
        }
      } catch {
        /* sem rede: segue o fluxo normal */
      }

      // Conta com perfil de médico ATIVO vai para o painel;
      // as demais, para o app da paciente.
      try {
        const me = await getMyDoctor({ data: { accessToken: data.session.access_token } });
        /* Basta TER perfil de médico — ativo ou não.
           
           Com `?.active` aqui, um médico com a conta inativa era mandado para o
           app da gestante, batia no bloqueio "esta área é da gestante", clicava
           em "ir para o meu painel" e recebia "área restrita": um ciclo fechado
           sem nenhuma tela utilizável. Agora ele chega ao painel, que mostra o
           perfil e a assinatura — que é justamente o que ele precisa mexer. */
        if (me.ok && me.doctor) {
          navigate({ to: "/painel" });
          return;
        }
      } catch {
        /* sem rede/perfil: segue como paciente */
      }
      /* Antes de despachar para o app da gestante: esta pessoa estava tentando
         se cadastrar como médico?

         Este redirecionamento era a porta pela qual o médico caía no app da
         paciente. Ele roda no MOUNT, com a sessão que já existe — então acontece
         antes de a pessoa poder tocar em "Sou médico(a)", e o botão de papel
         (que o handler de login respeita) nunca entrava em jogo. Resultado: quem
         voltava do link de confirmação de e-mail, ou reabria o site com sessão
         viva, ia para "configure sua data de gestação" com o cadastro
         profissional pela metade. */
      const { querSerMedico } = await import("@/lib/intencao-medico");
      if (querSerMedico()) {
        navigate({ to: "/medicos/cadastro" });
        return;
      }
      navigate({ to: "/minha-conta" });
    });
  }, [navigate, isRecoveryLink]);

  // Catch PASSWORD_RECOVERY event from the magic link in the reset email
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setMode("reset");
        setMsg(null);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    setShowResend(false);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/minha-conta`,
            data: { display_name: name },
          },
        });
        if (error) throw error;
        setMsg({
          text: "Conta criada! Verifique seu e-mail para confirmar o cadastro e depois faça login.",
          type: "success",
        });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        /* Mesma regra do mount, e pelo mesmo motivo: o dono entra e vai para o
           console, sem passar pelo app da gestante nem pelo painel do
           consultório. O seletor "sou médico(a)" nem entra em jogo. */
        try {
          const { data: s } = await supabase.auth.getSession();
          if (s.session) {
            const adm = await checkIsAdmin({ data: { accessToken: s.session.access_token } });
            if (adm.isAdmin) {
              navigate({ to: "/admin" });
              return;
            }
          }
        } catch {
          /* sem rede: segue o fluxo normal */
        }

        if (role === "medico") {
          // Médico: painel se o perfil profissional existe e está ativo;
          // senão, completar o cadastro (o fluxo reconhece a sessão).
          const { data: s } = await supabase.auth.getSession();
          const me = s.session
            ? await getMyDoctor({ data: { accessToken: s.session.access_token } })
            : null;
          navigate({ to: me?.ok && me.doctor?.active ? "/painel" : "/medicos/cadastro" });
          return;
        }
        navigate({ to: "/minha-conta" });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "";
      setMsg({ text: translateAuthError(message), type: "error" });
      setShowResend(message.includes("Email not confirmed"));
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (!email) return;
    setResendLoading(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo: `${window.location.origin}/minha-conta` },
      });
      if (error) throw error;
      setMsg({
        text: "E-mail de confirmação reenviado! Verifique sua caixa de entrada.",
        type: "success",
      });
      setShowResend(false);
    } catch {
      setMsg({
        text: "Não foi possível reenviar. Tente novamente em alguns minutos.",
        type: "error",
      });
    } finally {
      setResendLoading(false);
    }
  }

  async function submitForgot(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth`,
      });
      if (error) throw error;
      setMsg({
        text: "Link de redefinição enviado! Verifique sua caixa de entrada (e a pasta de spam).",
        type: "success",
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "";
      setMsg({ text: translateAuthError(message), type: "error" });
    } finally {
      setLoading(false);
    }
  }

  async function submitReset(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setMsg({ text: "Senha atualizada com sucesso! Redirecionando…", type: "success" });
      setTimeout(() => navigate({ to: "/minha-conta" }), 1800);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "";
      setMsg({ text: translateAuthError(message), type: "error" });
    } finally {
      setLoading(false);
    }
  }

  function switchMode() {
    setMode(mode === "login" ? "signup" : "login");
    setMsg(null);
  }

  /**
   * O TOKEN, de um link inteiro OU de um código solto.
   *
   * ⚠️ FORA DO COMPONENTE seria melhor, mas ela é usada por dois pontos daqui e
   * não sai do arquivo — extraí-la para `lib/` só para poder testá-la separaria
   * a régua da única tela que a usa. O que ela faz é pequeno e explícito:
   * pega o último pedaço não vazio depois de `/acompanhar/`, ou o texto todo
   * quando não há barra nenhuma.
   *
   * ⚠️ TIRA QUERY E FRAGMENTO. Link do WhatsApp costuma vir com `?` grudado, e
   * um token com `?utm_source=...` no fim não bate com nenhuma linha da tabela.
   */
  function tokenDoConvite(cru: string): string {
    const limpo = cru.trim().split(/[?#]/)[0].replace(/\/+$/, "");
    if (!limpo) return "";
    const partes = limpo.split("/").filter(Boolean);
    return (partes[partes.length - 1] ?? "").replace(/[^A-Za-z0-9_-]/g, "");
  }

  function abrirConvite() {
    const t = tokenDoConvite(convite);
    if (t.length < 6) return;
    /* Navegação DURA e não `navigate`: `/acompanhar/$token` é uma rota pública
       fora da árvore autenticada, e ir por ela com a sessão meia-carregada
       desta tela já produziu redirecionamento de volta para o login. */
    window.location.href = `/acompanhar/${t}`;
  }

  const title =
    mode === "login"
      ? "Acessar minha conta"
      : mode === "signup"
        ? "Criar minha conta"
        : mode === "forgot"
          ? "Redefinir senha"
          : "Nova senha";

  return (
    <section
      className="mx-auto flex max-w-md flex-col px-5 py-16"
      style={{
        background:
          "radial-gradient(ellipse 80% 60% at 50% 0%, oklch(0.92 0.03 52 / 0.6) 0%, transparent 70%)",
      }}
    >
      {/* ⚠️ **ACIMA DO TÍTULO, e esta é a tela que converte.** A landing
          apresenta o app; aqui ela já decidiu olhar, e o nome de quem a chamou
          é o que empurra o último passo. A faixa só existe quando há código na
          visita — em login normal esta linha não pinta nada.

          ⚠️ E ela NÃO aparece para o médico nem para o acompanhante: um
          convite de amiga sobre o formulário do consultório é ruído, e o
          acompanhante nem cria conta. */}
      {role === "paciente" && (
        <div className="mb-5 empty:hidden">
          <FaixaDeConvite />
        </div>
      )}
      <p className="font-serif text-[15px] font-semibold text-primary">Minha conta</p>
      <h1 className="mt-3 font-serif text-3xl">{title}</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        {mode === "forgot"
          ? "Digite seu e-mail e enviaremos um link para redefinir a senha."
          : mode === "reset"
            ? "Escolha uma nova senha para sua conta."
            : role === "medico"
              ? "Acesse o painel do seu consultório: pacientes, agenda e o seu Segundo Cérebro."
              : /* ⚠️ O acompanhante tinha o texto da PACIENTE ("salve seu diário
                   gestacional"), que promete a ele um app que não é dele. */
                role === "acompanhante"
                ? "Acompanhe a gestação de quem você ama pelo convite que ela te mandou — sem criar conta."
                : "Acompanhe semana a semana o desenvolvimento do seu bebê, salve seu diário gestacional e muito mais."}
      </p>

      {/* ── Papel: paciente, médico ou acompanhante ──────────────────────────
          Os dois primeiros criam conta e definem destino; o terceiro abre o
          convite (ver o bloco do acompanhante abaixo).

          ⚠️ TRÊS COLUNAS, e o rótulo encolhe junto (`text-[13px]`): com o
          tamanho anterior "Acompanhante" quebrava em duas linhas numa tela de
          320px e desalinhava os três botões.

          ⚠️ E ESTE COMENTÁRIO FICA FORA DO `{cond && (…)}`. Dentro, ele é um
          SEGUNDO filho da expressão, onde só cabe um elemento — custou um
          `TS1005: ')' expected` que aponta para a linha do `<div>`, não para o
          comentário que o causou. */}
      {(mode === "login" || mode === "signup") && (
        <div className="mt-5 grid grid-cols-3 gap-2">
          {(
            [
              { key: "paciente", emoji: "🤰", label: "Sou paciente" },
              { key: "medico", emoji: "🩺", label: "Sou médico(a)" },
              { key: "acompanhante", emoji: "🫶", label: "Acompanhante" },
            ] as const
          ).map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => {
                setRole(r.key);
                /* Escolher acompanhante não guarda intenção nenhuma: ele não
                   cria conta, então não há cadastro para o `INTENCAO_MEDICO`
                   sobreviver até. */
                /* Escolher "médico" aqui é o único sinal explícito que temos
                   antes de a conta existir. Guardado, ele sobrevive ao OAuth e
                   ao link de confirmação. Escolher "paciente" apaga. */
                void import("@/lib/intencao-medico").then((m) => {
                  if (r.key === "medico")
                    localStorage.setItem(m.INTENCAO_MEDICO, String(Date.now()));
                  else m.esquecerIntencaoMedico();
                });
              }}
              aria-pressed={role === r.key}
              /* ⚠️ COLUNA, e não emoji + texto na mesma linha. Medido em 393px:
                 "🫶 Acompanhante" numa linha só ultrapassa a borda do terceiro
                 botão — os outros dois quebram sozinhos ("Sou / paciente") e o
                 terceiro não tinha onde quebrar. Empilhado, os três ficam da
                 mesma altura e nenhum transborda, inclusive em 320px. */
              className={`flex flex-col items-center gap-1 rounded-2xl border px-1.5 py-2.5 text-center text-xs font-semibold leading-tight transition-all ${
                role === r.key
                  ? "border-primary bg-primary/10 text-primary shadow-[var(--shadow-soft)]"
                  : "card-material text-muted-foreground hover:border-primary/40"
              }`}
            >
              <span aria-hidden className="text-lg leading-none">
                {r.emoji}
              </span>
              {/* ⚠️ `hyphens-auto` + `break-words` + `lang`. Medido: a 320px a
                  caixa tem 88px e "Acompanhante" pede 106 — é uma palavra só,
                  sem espaço onde quebrar, então ela transbordava a borda.
                  Encolher a fonte até caber exigiria ~10px, pequeno demais para
                  um controle. Com hifenização o navegador quebra em
                  "Acom-panhante" e nada sai do botão.

                  ⚠️ O `lang` é obrigatório: sem ele o navegador não sabe as
                  regras de hifenização e `hyphens-auto` não faz nada. */}
              {/* ⚠️ `w-full` É O QUE FAZ A QUEBRA FUNCIONAR, e não o
                  `break-words` sozinho. `overflow-wrap: break-word` permite
                  quebrar DURANTE o layout, mas não reduz a largura mínima do
                  elemento — num pai `items-center` (shrink-to-fit) o span
                  continuava medindo a palavra inteira e transbordava. Com
                  `w-full` ele passa a ter a largura do botão, e aí a quebra
                  acontece dentro dela. Medido a 320px. */}
              <span lang="pt-BR" className="block w-full hyphens-auto break-words">
                {r.label}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* ─── O CAMINHO DO ACOMPANHANTE ────────────────────────────────────
          Sem senha, sem cadastro: ele cola o link que a gestante mandou.

          ⚠️ ACEITA O LINK INTEIRO OU SÓ O CÓDIGO. Quem recebe um link no
          WhatsApp copia o link — pedir que ele "extraia o código do final da
          URL" é pedir um trabalho que o app sabe fazer sozinho, e é o tipo de
          atrito que faz o pai desistir e devolver o celular.

          ⚠️ E NÃO HÁ VALIDAÇÃO AQUI. Quem confere o token é `getCompanionView`,
          no servidor, que já distingue "inválido" de "expirado". Uma segunda
          checagem no cliente só poderia divergir dela — e diria "código
          inválido" para um convite que o servidor aceitaria. */}
      {(mode === "login" || mode === "signup") && role === "acompanhante" && (
        <div className="mt-8 card-material rounded-3xl p-6">
          <p className="text-4xl">🫶</p>
          <h2 className="mt-3 font-serif text-xl">Você foi convidado a acompanhar</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            O acompanhante não precisa criar conta. A gestante gera um convite no app dela, em{" "}
            <strong className="font-semibold">Acompanhante</strong>, e manda o link para você — é
            ele que abre o seu painel.
          </p>

          <label htmlFor="convite" className="mt-5 block text-xs font-semibold text-foreground">
            Cole o link ou o código do convite
          </label>
          <input
            id="convite"
            value={convite}
            onChange={(e) => setConvite(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") abrirConvite();
            }}
            placeholder="obstetrica.com.br/acompanhar/…"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="mt-1.5 min-h-11 w-full rounded-full border border-border bg-background px-4 text-sm"
          />
          <button
            onClick={abrirConvite}
            disabled={tokenDoConvite(convite).length < 6}
            className="press mt-3 min-h-11 w-full rounded-full bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-40"
          >
            Abrir o painel
          </button>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            Ainda não tem o link? Peça para ela abrir o app, ir em{" "}
            <strong className="font-semibold">Acompanhante</strong> e tocar em convidar.
          </p>
        </div>
      )}

      {/* ── Cadastro de médico tem fluxo próprio (CRM, perfil profissional) ── */}
      {mode === "signup" && role === "medico" && (
        <div className="mt-8 card-material rounded-3xl p-6 text-center">
          <p className="text-4xl">🩺</p>
          <h2 className="mt-3 font-serif text-xl">Criar conta de médico</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            O cadastro de médico tem uma etapa própria: conta profissional + perfil com CRM e
            especialidade — é com ele que suas pacientes encontram você.
          </p>
          <div className="mt-5">
            <GoogleButton role="medico" label="Continuar com Google" />
            {/* ⚠️ Requisito de loja, não escolha de layout — ver `AppleButton`. */}
            <div className="mt-2">
              <AppleButton role="medico" label="Continuar com a Apple" />
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Usar o Google já conecta seu e-mail — as teleconsultas caem na sua Agenda Google.
            </p>
          </div>
          <div className="my-4">
            <OrDivider />
          </div>
          <Link
            to="/medicos/cadastro"
            className="press inline-block rounded-full bg-primary px-7 py-3 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-soft)]"
          >
            Continuar com e-mail e senha →
          </Link>
          <p className="mt-3 text-xs text-muted-foreground">
            Leva 2 minutos · cancele quando quiser
          </p>
        </div>
      )}

      {/* ── Forgot password form ── */}
      {mode === "forgot" && (
        <form
          onSubmit={submitForgot}
          className="mt-8 space-y-4 card-material rounded-3xl p-6"
          noValidate
        >
          <div>
            <label
              htmlFor="auth-email"
              className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
            >
              E-mail
            </label>
            <input
              id="auth-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          {msg && (
            <p
              role="alert"
              className={`rounded-lg px-3 py-2 text-sm ${
                msg.type === "success"
                  ? "bg-primary/10 text-primary"
                  : "bg-destructive/10 text-destructive"
              }`}
            >
              {msg.text}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity disabled:opacity-60 hover:opacity-90"
          >
            {loading ? "Enviando…" : "Enviar link de redefinição"}
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("login");
              setMsg(null);
            }}
            className="w-full text-center text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            ← Voltar ao login
          </button>
        </form>
      )}

      {/* ── Reset password form (after clicking email link) ── */}
      {mode === "reset" && (
        <form
          onSubmit={submitReset}
          className="mt-8 space-y-4 card-material rounded-3xl p-6"
          noValidate
        >
          <div>
            <label
              htmlFor="auth-new-password"
              className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
            >
              Nova senha
            </label>
            <input
              id="auth-new-password"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <p className="mt-1 text-xs text-muted-foreground">Mínimo de 6 caracteres.</p>
          </div>

          {msg && (
            <p
              role="alert"
              className={`rounded-lg px-3 py-2 text-sm ${
                msg.type === "success"
                  ? "bg-primary/10 text-primary"
                  : "bg-destructive/10 text-destructive"
              }`}
            >
              {msg.text}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity disabled:opacity-60 hover:opacity-90"
          >
            {loading ? "Salvando…" : "Salvar nova senha"}
          </button>
        </form>
      )}

      {/* ── Login / Signup form ──────────────────────────────────────────────
          A regra tem DUAS partes, e elas são diferentes de propósito:

          · `role !== "acompanhante"` — ele não tem conta, então nunca vê
            formulário de senha. Sem esta parte ele via o bloco do convite E um
            campo de e-mail logo abaixo, para uma conta que não existe.

          · `(login || (signup && role !== "medico"))` — o médico LOGA por aqui,
            como sempre; só o CADASTRO dele tem fluxo próprio (CRM, perfil).
            ⚠️ Eu quase colapsei isto num `role !== "medico"` solto, o que
            teria tirado o formulário de login do médico e deixado o painel
            inalcançável para ele. */}
      {role !== "acompanhante" &&
        (mode === "login" || (mode === "signup" && role !== "medico")) && (
          <form
            onSubmit={submit}
            className="mt-8 space-y-4 card-material rounded-3xl p-6"
            noValidate
          >
            <GoogleButton role={role} />
            <div className="mt-2">
              <AppleButton role={role} />
            </div>
            <OrDivider />
            {mode === "signup" && (
              <div>
                <label
                  htmlFor="auth-name"
                  className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                >
                  Seu nome
                </label>
                <input
                  id="auth-name"
                  type="text"
                  required
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
            )}
            <div>
              <label
                htmlFor="auth-email"
                className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
              >
                E-mail
              </label>
              <input
                id="auth-email"
                type="email"
                required
                autoComplete={mode === "signup" ? "email" : "username"}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label
                  htmlFor="auth-password"
                  className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                >
                  Senha
                </label>
                {mode === "login" && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode("forgot");
                      setMsg(null);
                    }}
                    className="text-xs text-primary hover:underline"
                  >
                    Esqueci minha senha
                  </button>
                )}
              </div>
              <input
                id="auth-password"
                type="password"
                required
                minLength={6}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              {mode === "signup" && (
                <p className="mt-1 text-xs text-muted-foreground">Mínimo de 6 caracteres.</p>
              )}
            </div>

            {msg && (
              <p
                role="alert"
                className={`rounded-lg px-3 py-2 text-sm ${
                  msg.type === "success"
                    ? "bg-primary/10 text-primary"
                    : "bg-destructive/10 text-destructive"
                }`}
              >
                {msg.text}
              </p>
            )}

            {showResend && (
              <button
                type="button"
                onClick={handleResend}
                disabled={resendLoading}
                className="w-full rounded-full border border-primary px-5 py-2 text-sm font-medium text-primary transition-opacity disabled:opacity-60 hover:bg-primary/5"
              >
                {resendLoading ? "Enviando…" : "Reenviar e-mail de confirmação"}
              </button>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity disabled:opacity-60 hover:opacity-90"
            >
              {loading ? "Aguarde…" : mode === "login" ? "Entrar" : "Criar conta"}
            </button>
            <button
              type="button"
              onClick={switchMode}
              className="w-full text-center text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              {mode === "login"
                ? "Não tem conta? Cadastre-se gratuitamente"
                : "Já tem conta? Fazer login"}
            </button>
          </form>
        )}

      <Link
        to="/"
        className="mt-6 text-center text-xs text-muted-foreground hover:text-primary transition-colors"
      >
        ← Voltar ao início
      </Link>
    </section>
  );
}
