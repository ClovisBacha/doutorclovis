import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MENSAGENS_ESCOLHIDAS } from "@/lib/planos-medico";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { registerDoctor, getMyDoctor } from "@/lib/doctors.functions";
import { juntarCrm, separarCrm, UFS } from "@/lib/crm";
import { pendenciasDoMedico } from "@/lib/doctor-required";
import { CampoComOutro } from "@/components/campo-com-outro";
import { PerfilProgresso, itensDoPerfil } from "@/components/perfil-progresso";
import { apagarRascunho, lerRascunho, quandoRascunho, salvarRascunho } from "@/lib/rascunho";

/** Chave do rascunho deste formulário. */
const RASCUNHO_CADASTRO = "obst_rascunho_cadastro_medico";
import { CampoFormacoes } from "@/components/campo-formacoes";
import { CampoFocos } from "@/components/campo-focos";
import { PreviaCardMedico } from "@/components/previa-card-medico";
import {
  TITULOS_MEDICO,
  ESPECIALIDADES_MEDICO,
  montarFormacoes,
  separarFormacoes,
} from "@/lib/medico-opcoes";
import {
  MOEDAS,
  centavosDe,
  digitandoDinheiro,
  formatarDinheiro,
  unidadesInteirasDe,
  type MoedaChave,
} from "@/lib/dinheiro";
import { INTENCAO_MEDICO } from "@/lib/intencao-medico";
import { GoogleButton, OrDivider } from "@/components/google-button";

export const Route = createFileRoute("/medicos_/cadastro")({
  head: () => ({
    meta: [
      { title: "Criar conta de médico — Plataforma Obstétrica" },
      {
        name: "description",
        content:
          "Crie sua conta de médico: painel completo, Segundo Cérebro de IA e app para suas pacientes.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CadastroMedicoPage,
});

type Step = "auth" | "perfil" | "confirm-email" | "pronto";

function CadastroMedicoPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("auth");
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  // Sessão pré-existente (ex.: conta de paciente): confirmar a intenção antes
  // de criar um perfil de médico por cima da mesma conta.
  const [existingSession, setExistingSession] = useState<string | null>(null);

  const [profile, setProfile] = useState({
    display_name: "",
    title: "Ginecologista e Obstetra",
    specialty: "",
    crm: "",
    whatsapp: "",
    pix_key: "",
    /* Obrigatórios que o formulário não coletava: o médico terminava o
       cadastro, ia para a busca da paciente e o card dele não respondia
       "aceita meu convênio", "quanto custa" nem "formado onde". */
    accepts_insurance: false,
    accepts_private: true,
    insurances: "",
    consultation_price_brl: null as number | null,
    consultation_currency: "BRL" as MoedaChave,
    consultation_price_cents: null as number | null,
    focos: [] as string[],
    education: "",
    /* Texto corrido do perfil. Separado das formações de propósito: é o que
       aparece no card abaixo do nome, e misturar os dois faria a lista de
       títulos virar parágrafo. */
    bio: "",
  });

  /* Formações por categoria. O estado é por CHAVE e vira uma coluna de texto só
     na hora de enviar — as categorias existem para guiar a digitação, não para
     virar esquema de banco. */
  const [formacoes, setFormacoes] = useState<Record<string, string>>({});
  /* Moeda e valor digitado. O valor vive como TEXTO formatado enquanto ele
     digita e só vira centavos no envio: guardar número aqui faria o campo
     reescrever "450," para "450" no meio da digitação. */
  const [moeda, setMoeda] = useState<MoedaChave>("BRL");
  const [valorTexto, setValorTexto] = useState("");
  /* Quando o rascunho salvo foi gravado — some depois que ele muda algo. */
  const [rascunhoDe, setRascunhoDe] = useState("");
  /* No celular a prévia nasce fechada: meia tela ocupada por um card ainda
     vazio atrapalharia justamente quem tem menos espaço. */
  const [previaAberta, setPreviaAberta] = useState(false);

  /* As duas metades do CRM têm ESTADO PRÓPRIO, e isso é o conserto de um bug meu.
  
     Antes o seletor lia `separarCrm(profile.crm).uf` e escrevia
     `juntarCrm(uf, numero)`. Como `juntarCrm` devolve string vazia quando falta
     uma das partes — e faltava, porque o número ainda não tinha sido digitado —
     escolher "MG" gravava `""`, o `separarCrm("")` devolvia UF vazia e o seletor
     pulava de volta para "UF". A escolha não tinha onde existir. O mesmo valia
     ao contrário: digitar o número antes de escolher o estado era descartado.
  
     A causa foi usar o formato de ARMAZENAMENTO como estado de tela. O canônico
     `CRM-MG 12345` é ótimo para o banco e não sabe representar "escolhi o estado
     e ainda não digitei o número", que é metade do tempo em que o formulário
     existe. Agora a tela guarda as duas metades e junta só na hora de enviar. */
  const [crmUf, setCrmUf] = useState("");
  const [crmNumero, setCrmNumero] = useState("");
  const crmCompleto = juntarCrm(crmUf, crmNumero);

  /* RASCUNHO. Quinze campos, preenchidos uma vez na vida, quase sempre no
     celular entre uma coisa e outra: uma ligação ou o navegador reciclando a aba
     levava tudo. Fica no aparelho — rascunho é de quem digita, não da
     plataforma — e some ao concluir ou depois de uma semana. */
  useEffect(() => {
    const r = lerRascunho<{
      profile: typeof profile;
      formacoes: Record<string, string>;
      crmUf: string;
      crmNumero: string;
      moeda: MoedaChave;
      valorTexto: string;
    }>(RASCUNHO_CADASTRO);
    if (!r) return;
    if (r.profile) setProfile((p) => ({ ...p, ...r.profile }));
    if (r.formacoes) setFormacoes(r.formacoes);
    if (r.crmUf) setCrmUf(r.crmUf);
    if (r.crmNumero) setCrmNumero(r.crmNumero);
    if (r.moeda) setMoeda(r.moeda);
    if (r.valorTexto) setValorTexto(r.valorTexto);
    setRascunhoDe(quandoRascunho(RASCUNHO_CADASTRO));
  }, []);

  useEffect(() => {
    // Só depois que houver algo a salvar: gravar o formulário vazio no primeiro
    // render criaria um "rascunho" que não é rascunho de nada.
    if (!profile.display_name && !crmUf && !crmNumero && !profile.whatsapp) return;
    salvarRascunho(RASCUNHO_CADASTRO, {
      profile,
      formacoes,
      crmUf,
      crmNumero,
      moeda,
      valorTexto,
    });
  }, [profile, formacoes, crmUf, crmNumero, moeda, valorTexto]);

  /* Guarda a INTENÇÃO de ser médico no aparelho.
  
     Marcar `role=doctor` no Auth é forte demais para uma intenção (bloqueia o
     app da gestante) e frágil demais como pista (só é gravado na criação da
     conta). Esta chave é o meio: dura entre recarregamentos, sobrevive à volta
     do Google e ao link de confirmação, e não tira acesso de ninguém — só diz
     "esta pessoa estava tentando se cadastrar como médico", para as outras telas
     pararem de mandá-la para o app da gestante. */
  useEffect(() => {
    try {
      localStorage.setItem(INTENCAO_MEDICO, String(Date.now()));
    } catch {
      /* sem storage: os outros caminhos ainda funcionam */
    }
  }, []);

  /* ─── A QUANTIDADE ESCOLHIDA NO SITE ATRAVESSA O CADASTRO ────────────────
     O seletor da `/medicos` manda `?mensagens=1500`. Sem esta linha o número
     morria aqui: ela escolhia o degrau, criava a conta, e o painel abria no
     padrão — a escolha some entre a vitrine e a compra, que é o defeito
     clássico de funil (e um parâmetro de URL que ninguém lê é exatamente a
     promessa morta que este projeto passou a noite removendo).

     `localStorage` e não estado de rota porque entre a escolha e o painel há
     um cadastro, um e-mail de confirmação e, às vezes, um desvio pelo Google. */
  useEffect(() => {
    try {
      const bruto = new URLSearchParams(window.location.search).get("mensagens");
      const n = Number(bruto);
      if (Number.isFinite(n) && n > 0) localStorage.setItem(MENSAGENS_ESCOLHIDAS, String(n));
    } catch {
      /* sem storage: o painel abre no padrão, e ela ajusta lá */
    }
  }, []);

  /**
   * Traz para a tela o perfil que já está no banco.
   *
   * Só preenche o que está VAZIO. O rascunho do aparelho é carregado antes
   * desta chamada (ele é síncrono, esta é de rede), e o que o médico digitou
   * agora vale mais que a versão salva — sobrescrever seria trocar o recente
   * pelo antigo justamente enquanto ele edita.
   */
  function preencherDoServidor(d: Record<string, any>) {
    const texto = (v: unknown) => (typeof v === "string" ? v : "");
    setProfile((p) => {
      const n = { ...p };
      for (const k of [
        "display_name",
        "title",
        "specialty",
        "whatsapp",
        "pix_key",
        "bio",
        "insurances",
      ] as const) {
        if (!texto((n as any)[k]).trim() && texto(d[k]).trim()) (n as any)[k] = d[k];
      }
      if (typeof d.accepts_insurance === "boolean") n.accepts_insurance = d.accepts_insurance;
      if (typeof d.accepts_private === "boolean") n.accepts_private = d.accepts_private;
      if (!n.focos.length && Array.isArray(d.focos)) n.focos = d.focos.filter(Boolean);
      return n;
    });
    /* CRM vive partido na tela (UF + número) e junto no banco. */
    if (!crmUf && !crmNumero && texto(d.crm).trim()) {
      const { uf, numero } = separarCrm(d.crm);
      if (uf) setCrmUf(uf);
      if (numero) setCrmNumero(numero);
    }
    /* Formação: sem este caminho de volta, reenviar o formulário APAGA o que
       estava salvo — `education` é SEMPRE remontado a partir das categorias no
       envio, então categoria vazia na tela vira coluna vazia no banco.
       `separarFormacoes` já existia no repositório, escrita para exatamente
       isto e nunca chamada por ninguém. */
    const { valores, livre } = separarFormacoes(texto(d.education));
    setFormacoes((f) => (Object.keys(f).some((k) => (f[k] ?? "").trim()) ? f : valores));
    /* O que não casou com categoria nenhuma (perfil antigo, escrito à mão) vai
       para o texto corrido, que é onde a tela sabe mostrá-lo. Só se estiver
       vazio: nunca por cima do que ele escreveu. */
    if (livre.trim()) {
      setProfile((p) => (p.bio.trim() ? p : { ...p, bio: livre }));
    }
    if (!valorTexto) {
      const cents =
        typeof d.consultation_price_cents === "number"
          ? d.consultation_price_cents
          : typeof d.consultation_price_brl === "number"
            ? d.consultation_price_brl * 100
            : null;
      if (cents && cents > 0) setValorTexto(formatarDinheiro(cents));
      const m = texto(d.consultation_currency);
      if (m && m in MOEDAS) setMoeda(m as MoedaChave);
    }
  }

  // Já logado? Médico ativo vai direto ao painel (ex.: login com Google);
  // senão mostra o perfil profissional, avisando qual conta está em uso e
  // oferecendo trocar — evita paciente virando "médico" sem perceber.
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) return;
      try {
        const me = await getMyDoctor({ data: { accessToken: data.session.access_token } });
        if (me.ok && me.doctor?.active) {
          navigate({ to: "/painel" });
          return;
        }
        /* Perfil existe mas não está ativo: o formulário abre PREENCHIDO com o
           que já está no banco.

           Antes ele só sabia recuperar o rascunho do `localStorage` — que é do
           aparelho e do navegador. Numa aba anônima, num outro celular ou
           depois de limpar o histórico, o rascunho não existe, e quem já tinha
           preenchido quinze campos os digitava de novo. Foi exatamente o que
           aconteceu: cadastro repetido numa janela privada.

           E não era só o trabalho perdido. Na volta, o `upsert` grava o que veio
           da tela — então um campo esquecido na segunda passada apagava o valor
           bom que estava salvo. O prejuízo era maior que o incômodo. */
        if (me.ok && me.doctor) preencherDoServidor(me.doctor);
      } catch {
        /* sem rede/perfil: segue para a etapa de perfil */
      }
      /* Marca o papel SÓ quando a sessão acabou de nascer.

         Isto é o conserto de um estrago meu, e do conserto do conserto.

         Primeiro eu marcava `role=doctor` só por a URL trazer `?papel=medico`,
         sem olhar se a sessão tinha acabado de vir do Google. Bastava uma
         paciente já logada tocar em "Sou médico(a)" por curiosidade — ou
         receber esse link — para perder o app da gestante inteiro.

         Depois eu tirei a marcação por completo, e aí quebrei o caminho do
         Google: o Supabase cria o usuário com a metadata do Google, sem `role`,
         então o gatilho do banco cria perfil de gestante para o obstetra e, se
         ele abandonar o formulário, o app pede o nome do bebê a ele. Era
         exatamente o bug relatado, de volta.

         A pista que faltava é a IDADE da conta: no retorno do OAuth de cadastro
         a conta tem segundos de vida; a paciente curiosa tem dias. Duas
         condições juntas — `?papel=medico` e conta recém-criada — cobrem o
         médico do Google sem alcançar ninguém que já usava o app. */
      try {
        /* A pista agora vem do APARELHO, não da URL.
        
           O `?papel=medico` que existia aqui tinha um problema fora do nosso
           controle: a allowlist de Redirect URLs do Supabase compara a URL
           inteira, e a entrada cadastrada é `.../medicos/cadastro`, sem curinga.
           Com a query string o `redirectTo` era recusado em silêncio e a pessoa
           era devolvida na Site URL do projeto — a home. O médico entrava com o
           Google e reaparecia no app da gestante, sem erro nenhum na tela.
        
           A chave no `localStorage` é gravada antes de sair para o Google e
           sobrevive à volta, inclusive quando o Supabase ignora o destino. */
        const { querSerMedico } = await import("@/lib/intencao-medico");
        const veioComoMedico =
          querSerMedico() || new URLSearchParams(window.location.search).get("papel") === "medico";
        const nascidaAgora = Date.now() - Date.parse(data.session.user.created_at || "") < 120_000;
        if (veioComoMedico && nascidaAgora && data.session.user.user_metadata?.role !== "doctor") {
          await supabase.auth.updateUser({ data: { role: "doctor" } });
        }
      } catch {
        /* sem a marca, a linha em `doctors` ainda decide — e o cadastro segue */
      }
      /* Nota sobre o que NÃO fazemos aqui.
         
         A versão anterior marcava `role=doctor` só por a URL trazer
         `?papel=medico`, sem checar se a sessão tinha acabado de nascer do
         Google. Bastava uma paciente já logada tocar em "Sou médico(a)" na tela
         de entrada por curiosidade — ou receber esse link de alguém — para
         perder o app da gestante inteiro (bebê, jogo, diário, loja), sem
         nenhuma saída dentro do app se ela ainda não tivesse data de gestação.
         Um clique de curiosidade não pode custar a conta.

         Nada de marcar por ter apenas ABERTO esta página com uma sessão
         antiga: a marca bloqueia o app da gestante, e um clique de curiosidade
         não pode custar a conta. Para o cadastro por e-mail a marca vem do
         próprio `signUp` (é o que faz o gatilho do banco não criar perfil de
         gestante), e em qualquer caminho ela é regravada quando o
         `registerDoctor` dá certo — aí o papel é fato, não intenção. */
      setExistingSession(data.session.user.email ?? "sua conta atual");
      // Pré-preenche o nome com o do Google, se veio no cadastro social.
      const gName =
        (data.session.user.user_metadata?.full_name as string | undefined) ??
        (data.session.user.user_metadata?.name as string | undefined) ??
        "";
      if (gName) setProfile((p) => (p.display_name ? p : { ...p, display_name: gName }));
      setStep("perfil");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function switchAccount() {
    await supabase.auth.signOut();
    setExistingSession(null);
    setStep("auth");
  }

  async function submitAuth(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || password.length < 6) {
      toast.error("Informe e-mail e uma senha com pelo menos 6 caracteres.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        /* `role: "doctor"` no metadata do Auth, no PRIMEIRO passo.
           
           É o que corrige o bug de quem começa este cadastro e não termina:
           sem linha em `doctors`, o app não tinha como saber que aquela conta é
           de médico e abria o app da gestante — pedindo nome do bebê a um
           obstetra. A marca existe antes de qualquer perfil.
           
           Ela só RESTRINGE: tira o acesso ao app da gestante e não dá nenhum
           acesso ao painel. Quem manda no painel continua sendo a linha em
           `public.doctors` com `active = true`, escrita só pelo servidor —
           então um metadata forjado no cliente não vira privilégio. */
        const { data: su, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { role: "doctor" },
            /* Sem isto, o link do e-mail de confirmação volta para a Site URL do
               projeto Supabase — que é o app da gestante. O médico confirmava o
               e-mail e caía na tela "configure sua data de gestação", com o
               cadastro profissional pela metade e nenhuma pista de como voltar.
               O `?papel=medico` sobrevive à ida e volta e traz ele para cá. */
            /* Sem query string, pelo mesmo motivo do OAuth: a allowlist do
               Supabase compara a URL inteira e a entrada cadastrada não tem
               curinga. A intenção de ser médico vem do aparelho. */
            emailRedirectTo: `${window.location.origin}/medicos/cadastro`,
          },
        });
        // Anti-enumeração do Supabase: e-mail já cadastrado retorna "sucesso"
        // sem sessão e com identities vazio — orienta a entrar em vez de
        // prometer um e-mail de confirmação que nunca chega.
        if (!error && su.user && su.user.identities?.length === 0) {
          toast.error("Este e-mail já tem conta — use o modo Entrar.");
          setMode("login");
          return;
        }
        if (error) {
          // Conta já existe → tenta entrar
          const { error: loginErr } = await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
          });
          if (loginErr) {
            toast.error(
              error.message.includes("already")
                ? "E-mail já cadastrado — confira a senha."
                : error.message,
            );
            return;
          }
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) {
          toast.error("E-mail ou senha incorretos.");
          return;
        }
      }
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        // Confirmação de e-mail ativa: um toast some — a tela precisa ficar.
        setStep("confirm-email");
        return;
      }
      /* NÃO marca o papel aqui.
         
         Marcar em qualquer login por esta página era um estrago: uma paciente
         que clicasse em "sou médico" por curiosidade e entrasse com o e-mail e
         a senha dela ficava marcada como médica — perdia o app da gestação e
         não entrava no painel, sem nenhum caminho de volta. Três cliques para
         trancar alguém fora da própria conta.
         
         A marca acontece em dois momentos em que a intenção é inequívoca: ao
         CRIAR a conta por aqui, e ao SALVAR o perfil profissional (quando a
         linha em `doctors` passa a existir de fato). */
      setStep("perfil");
    } catch {
      /* O `catch` também desmarca. Antes só o retorno `ok:false` desmarcava, e
         tudo que LANÇA passava por aqui: rede caindo, 500, e — alcançável pela
         tela — um preço de consulta com centavos, que o Zod recusa como
         `z.number().int()`. O médico via "falha de conexão" e ficava marcado sem
         perfil, ou seja, sem app nenhum. */
      const { data: s2 } = await supabase.auth.getSession();
      if (s2.session) await desmarcarSePreciso(s2.session.access_token);
      toast.error("Falha de conexão — tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  /**
   * Tira a marca de médico quando ela ficou sem lastro.
   *
   * Só desmarca se NÃO existir linha em `doctors` — é o que o comentário da
   * válvula sempre disse e o código não conferia. Um médico de verdade (mesmo
   * inativo) tentando salvar de novo e batendo num erro perdia a marca, e com
   * ela a única proteção que sobrevive a uma falha de rede.
   */
  async function desmarcarSePreciso(accessToken: string) {
    try {
      const { data: s } = await supabase.auth.getSession();
      if (s.session?.user.user_metadata?.role !== "doctor") return;
      const me = await getMyDoctor({ data: { accessToken } });
      // Só mexe quando a resposta é confiável E diz que não há perfil.
      if (me.ok && !me.doctor) await supabase.auth.updateUser({ data: { role: null } });
    } catch {
      /* a tela de bloqueio tem saída própria — ver "Não sou médico(a)" */
    }
  }

  async function submitPerfil(e: React.FormEvent) {
    e.preventDefault();
    /* Uma regra só, compartilhada com o servidor e com o painel
       (`doctor-required.ts`). Duplicar a lista aqui era como o formulário e o
       servidor discordavam: a tela exigia três campos, o servidor aceitava
       vazio, e o médico saía do cadastro achando que estava pronto.

       O endereço não é cobrado nesta etapa (`temEndereco: true`): ele vive em
       outra tabela e o cadastro é justamente o momento em que ainda não há
       endereço nenhum. O painel cobra depois, com o card de endereços à mão. */
    /* O CRM é montado AQUI, a partir das duas metades — é o único ponto em que
       o formato canônico precisa existir. Validar e enviar usam o mesmo objeto,
       então não há como a tela aprovar uma coisa e o servidor receber outra. */
    const cents = centavosDe(valorTexto);
    const paraEnviar = {
      ...profile,
      crm: crmCompleto,
      education: montarFormacoes(formacoes),
      consultation_currency: moeda,
      consultation_price_cents: cents,
      /* Espelho arredondado na coluna antiga: telas e cálculo de receita ainda a
         leem. As duas convivem até a última leitura migrar. */
      consultation_price_brl: unidadesInteirasDe(cents),
      // Sem duplicata e sem vazio: o principal já está lá dentro.
      focos: Array.from(new Set(profile.focos.filter(Boolean))),
    };
    const faltas = pendenciasDoMedico(paraEnviar, { temEndereco: true });
    if (faltas.length) {
      toast.error(`${faltas[0].rotulo}: ${faltas[0].porque}`);
      return;
    }
    setBusy(true);
    try {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session) {
        toast.error("Sessão expirada — entre novamente.");
        setStep("auth");
        return;
      }
      // Indicação: ?ref=<doctorId> na URL vira o médico que indicou.
      const ref =
        typeof window !== "undefined"
          ? (new URLSearchParams(window.location.search).get("ref") ?? undefined)
          : undefined;
      // Convite de PACIENTE (obst_doc_invite): +15% no checkout p/ o médico
      // e Premium para ela quando ele assinar — validado no servidor.
      let patientInvite: string | undefined;
      try {
        const raw = localStorage.getItem("obst_doc_invite");
        if (raw) {
          const parsed = JSON.parse(raw) as { code?: string; at?: number };
          if (parsed?.code && Date.now() - (parsed.at ?? 0) < 90 * 86400000)
            patientInvite = parsed.code;
        }
      } catch {
        /* sem storage, sem convite */
      }
      const res = await registerDoctor({
        data: {
          accessToken: s.session.access_token,
          profile: paraEnviar,
          ref: ref || undefined,
          ...(patientInvite ? { patientInvite } : {}),
        },
      });
      if (!res.ok) {
        toast.error(
          "error" in res && res.error
            ? `Não foi possível criar seu perfil: ${res.error}`
            : "Não foi possível criar seu perfil. Tente novamente.",
        );
        await desmarcarSePreciso(s.session.access_token);
        return;
      }
      /* Perfil criado: agora o papel é fato, não intenção. Marcar aqui fecha o
         caso de quem chegou por um caminho sem pista nenhuma (link direto,
         e-mail de confirmação, outra aba) — a partir deste ponto o app da
         gestante não abre mais para esta conta, e não deve. */
      try {
        await supabase.auth.updateUser({ data: { role: "doctor" } });
      } catch {
        /* a linha em `doctors` já basta para o app decidir */
      }
      /* Virou médico de fato: a intenção cumpriu o papel e sai de cena. */
      try {
        localStorage.removeItem(INTENCAO_MEDICO);
      } catch {
        /* sem storage, sem problema */
      }
      apagarRascunho(RASCUNHO_CADASTRO);
      setStep("pronto");
    } catch {
      toast.error("Falha de conexão — tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  const input =
    "mt-1 w-full rounded-xl border border-input bg-card px-4 py-2.5 text-sm outline-none focus:border-primary";
  const label = "text-xs font-medium uppercase tracking-wide text-muted-foreground";

  return (
    <main className="min-h-[70vh] bg-[var(--gradient-warm)] px-5 py-16">
      <div className="mx-auto max-w-md">
        <p className="text-center text-xs font-semibold uppercase tracking-[0.3em] text-primary">
          Para médicos
        </p>
        <h1 className="mt-2 text-center font-serif text-3xl">
          {step === "auth" ? "Crie sua conta" : "Seu perfil profissional"}
        </h1>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          {step === "auth"
            ? "Leva 2 minutos · cancele quando quiser"
            : "É com esses dados que suas pacientes vão te encontrar."}
        </p>

        {/* Etapas (só nos passos de formulário) */}
        {(step === "auth" || step === "perfil") && (
          <div className="mt-6 flex items-center justify-center gap-2 text-xs font-semibold">
            <span
              className={`rounded-full px-3 py-1 ${step === "auth" ? "bg-primary text-primary-foreground" : "bg-primary/15 text-primary"}`}
            >
              1. Conta
            </span>
            <span className="h-px w-6 bg-border" />
            <span
              className={`rounded-full px-3 py-1 ${step === "perfil" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}
            >
              2. Perfil médico
            </span>
          </div>
        )}

        {step === "confirm-email" && (
          <div className="mt-8 rounded-3xl border border-border bg-card p-8 text-center shadow-[var(--shadow-card)]">
            <p className="text-4xl">📬</p>
            <h2 className="mt-3 font-serif text-xl">Confirme seu e-mail</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Enviamos um link de confirmação para <strong>{email}</strong>. Clique nele e volte a
              esta página para continuar o cadastro do seu consultório.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="press mt-5 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground"
            >
              Já confirmei — continuar
            </button>
            <p className="mt-3 text-xs text-muted-foreground">
              Não chegou? Olhe o spam ou{" "}
              <button
                type="button"
                onClick={() => setStep("auth")}
                className="font-semibold text-primary hover:underline"
              >
                tente outro e-mail
              </button>
              .
            </p>
          </div>
        )}

        {step === "pronto" && (
          <div className="mt-8 rounded-3xl border border-border bg-card p-8 text-center shadow-[var(--shadow-card)]">
            <p className="text-4xl">🎉</p>
            <h2 className="mt-3 font-serif text-xl">Seu painel já está ativo!</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Seu perfil já está no ar e as pacientes conseguem te encontrar. Entre no painel para
              abrir a agenda, convidar suas pacientes e escolher seu plano.
            </p>
            <div className="mt-5 space-y-2 rounded-2xl bg-secondary/50 p-4 text-left text-xs text-muted-foreground">
              <p>✅ Conta e perfil profissional criados</p>
              <p>✅ Painel liberado — agenda e pacientes</p>
              <p>👉 Agora: escolha seu plano para ligar o Segundo Cérebro</p>
            </div>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={() => navigate({ to: "/painel" })}
                className="press glow-cta rounded-full bg-primary px-7 py-3 text-sm font-semibold text-primary-foreground"
              >
                Abrir meu painel →
              </button>
              <button
                type="button"
                onClick={() => navigate({ to: "/" })}
                className="press rounded-full border border-border px-5 py-2.5 text-sm font-medium hover:border-primary hover:text-primary"
              >
                Conhecer o app da paciente
              </button>
            </div>
          </div>
        )}

        {step === "perfil" && existingSession && (
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-center text-xs text-amber-800">
            Você está conectado como <strong>{existingSession}</strong>. O perfil de médico será
            criado nesta conta.{" "}
            <button
              type="button"
              onClick={switchAccount}
              className="font-semibold text-amber-900 underline"
            >
              Usar outra conta
            </button>
          </div>
        )}

        {step === "auth" ? (
          <form
            onSubmit={submitAuth}
            className="mt-8 space-y-4 rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]"
          >
            <GoogleButton role="medico" />
            <p className="-mt-1 text-[11px] text-muted-foreground">
              Com o Google seu e-mail já fica conectado — as teleconsultas caem na sua Agenda Google
              automaticamente.
            </p>
            <OrDivider />
            <div>
              <label className={label}>E-mail profissional</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@clinica.com.br"
                className={input}
                autoComplete="email"
              />
            </div>
            <div>
              <label className={label}>Senha</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className={input}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="press glow-cta w-full rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {busy ? "Aguarde…" : mode === "signup" ? "Criar conta grátis" : "Entrar"}
            </button>
            <p className="text-center text-xs text-muted-foreground">
              {mode === "signup" ? "Já tem conta?" : "Ainda não tem conta?"}{" "}
              <button
                type="button"
                onClick={() => setMode(mode === "signup" ? "login" : "signup")}
                className="font-semibold text-primary hover:underline"
              >
                {mode === "signup" ? "Entrar" : "Criar conta"}
              </button>
            </p>
          </form>
        ) : step === "perfil" ? (
          /* Duas colunas a partir de `lg`: formulário à esquerda, prévia grudada
             à direita. No celular a prévia vira um bloco recolhível no topo —
             ocupar meia tela de um aparelho estreito com um card que ele ainda
             não preencheu seria atrapalhar em vez de ajudar. */
          <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
            <form
              onSubmit={submitPerfil}
              className="space-y-4 rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]"
            >
              {/* Rascunho recuperado: dizer, senão ele estranha campos preenchidos
                que não lembra de ter digitado agora. */}
              {rascunhoDe && (
                <div className="rounded-2xl border border-primary/30 bg-primary/5 p-3">
                  <p className="text-[12px] leading-snug text-foreground">
                    Recuperamos o que você tinha escrito {rascunhoDe}. Continue de onde parou.
                  </p>
                </div>
              )}

              {/* Barra de progresso no TOPO, em modo compacto: um passo por vez.
                A lista inteira de pendências antes de terminar o formulário
                desanima em vez de guiar. */}
              <PerfilProgresso
                compacto
                itens={itensDoPerfil({
                  display_name: profile.display_name,
                  crm: crmCompleto,
                  whatsapp: profile.whatsapp,
                  education: montarFormacoes(formacoes),
                  bio: profile.bio,
                  specialty: profile.specialty,
                  accepts_insurance: profile.accepts_insurance,
                  accepts_private: profile.accepts_private,
                  insurances: profile.insurances,
                  precoCentavos: centavosDe(valorTexto),
                  /* Endereço e foto entram no painel, depois do cadastro — cobrar
                   aqui seria pedir algo que esta tela não oferece. */
                  temEndereco: true,
                  temFoto: true,
                })}
              />

              <div>
                <label className={label}>Nome completo *</label>
                <input
                  value={profile.display_name}
                  onChange={(e) => setProfile((p) => ({ ...p, display_name: e.target.value }))}
                  placeholder="Dra. Ana Souza"
                  className={input}
                />
              </div>
              {/* CRM e WhatsApp em LINHAS PRÓPRIAS, cada um com a largura toda.

                Antes os dois dividiam um `grid-cols-2` que valia em qualquer
                largura. Num celular de 390px cada coluna ficava com ~170px, e
                dentro da coluna do CRM ainda havia um select de 86px mais o
                campo do número — não cabe. Pior: o rótulo "WhatsApp para
                pacientes" quebra em duas linhas e "CRM" não, então os campos
                desalinhavam na vertical e se encavalavam.

                Dois campos obrigatórios lado a lado num celular é economia de
                espaço que custa legibilidade. Cada um numa linha resolve os dois
                problemas e não precisa de exceção por breakpoint. */}
              <div>
                {/* UF primeiro, número depois — o registro é estadual, e
                  "CRM 12345" sozinho não identifica ninguém. Em dois controles
                  o formato sai sempre igual e dá para conferir no portal do
                  conselho. */}
                <label className={label}>CRM *</label>
                <div className="mt-1 grid grid-cols-[96px_1fr] gap-2">
                  <select
                    value={crmUf}
                    onChange={(e) => setCrmUf(e.target.value)}
                    /* `mt-0` porque a linha já tem o respiro: o `input` traz um
                     `mt-1` embutido e aqui ele viraria margem dupla. */
                    className={`${input} mt-0`}
                    aria-label="Estado do CRM"
                  >
                    <option value="">UF</option>
                    {UFS.map((uf) => (
                      <option key={uf} value={uf}>
                        {uf}
                      </option>
                    ))}
                  </select>
                  <input
                    value={crmNumero}
                    onChange={(e) => setCrmNumero(e.target.value.replace(/\D/g, ""))}
                    placeholder="Número — ex.: 12345"
                    inputMode="numeric"
                    className={`${input} mt-0`}
                    aria-label="Número do CRM"
                  />
                </div>
                {/* Mostra como vai ficar. Duas caixas separadas deixam a dúvida
                  "e o formato final, sai certo?" — aqui ele aparece. */}
                {crmCompleto ? (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Vai aparecer como <strong className="text-foreground">{crmCompleto}</strong>
                  </p>
                ) : (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Escolha o estado e digite o número — o registro é estadual.
                  </p>
                )}
              </div>
              {/* OBRIGATÓRIO, e com o nome do que ele é.
                
                Este é o número que aparece no botão SOS das pacientes e na
                carteirinha de emergência que elas mostram no hospital. Estava
                rotulado só "WhatsApp" e era opcional: dava para terminar o
                cadastro sem ele, e aí as pacientes daquele médico abriam a
                emergência e não tinham para onde ligar. */}
              <div>
                <label className={label}>WhatsApp para pacientes *</label>
                <input
                  value={profile.whatsapp}
                  onChange={(e) => setProfile((p) => ({ ...p, whatsapp: e.target.value }))}
                  placeholder="(31) 99999-9999"
                  inputMode="tel"
                  className={input}
                />
                <p className="mt-1 text-[11px] leading-snug text-amber-700">
                  É o número que aparece no <strong>botão SOS</strong> das suas pacientes e na
                  carteirinha que elas mostram no hospital. Cadastre o número em que você quer ser
                  encontrado numa emergência.
                </p>
              </div>
              {/* Lista + "Outro" no lugar de campo livre. Em campo livre o mesmo
                profissional escreve "Gineco e Obstetra", "GO" e
                "Ginecologista/Obstetra" — a busca por "obstetra" acha um e perde
                os outros, e dois médicos iguais parecem diferentes no card. */}
              <CampoComOutro
                label="Título"
                opcoes={TITULOS_MEDICO}
                valor={profile.title}
                onChange={(v) => setProfile((p) => ({ ...p, title: v }))}
                placeholderOutro="Ex.: Especialista em Endometriose"
                ajuda="Aparece embaixo do seu nome, no card e na carteirinha."
                classeInput={input}
                classeLabel={label}
              />
              <CampoComOutro
                label="Especialidade / foco principal"
                opcoes={ESPECIALIDADES_MEDICO}
                valor={profile.specialty}
                onChange={(v) =>
                  setProfile((p) => ({
                    ...p,
                    specialty: v,
                    // O principal entra nos focos sozinho: ele já disse que atende
                    // isso, e pedir para marcar de novo é trabalho repetido.
                    focos: v && !p.focos.includes(v) ? [...p.focos, v] : p.focos,
                  }))
                }
                placeholderOutro="Ex.: Gestação gemelar"
                ajuda="É o que aparece embaixo do seu nome no card."
                classeInput={input}
                classeLabel={label}
              />
              <CampoFocos
                valor={profile.focos}
                onChange={(v) => setProfile((p) => ({ ...p, focos: v }))}
                principal={profile.specialty}
                classeInput={input}
                classeLabel={label}
              />
              {/* Como ele atende — a primeira pergunta que a paciente faz. Dois
                checkboxes e não um seletor porque há quem faça os dois. */}
              <div>
                <label className={label}>Como você atende? *</label>
                <div className="mt-2 flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={profile.accepts_insurance}
                      onChange={(e) =>
                        setProfile((p) => ({ ...p, accepts_insurance: e.target.checked }))
                      }
                      className="size-4 accent-primary"
                    />
                    Convênio
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={profile.accepts_private}
                      onChange={(e) =>
                        setProfile((p) => ({ ...p, accepts_private: e.target.checked }))
                      }
                      className="size-4 accent-primary"
                    />
                    Particular
                  </label>
                </div>
                {profile.accepts_insurance && (
                  <input
                    value={profile.insurances}
                    onChange={(e) => setProfile((p) => ({ ...p, insurances: e.target.value }))}
                    placeholder="Quais convênios? Unimed, Bradesco Saúde…"
                    className={`${input} mt-2`}
                  />
                )}
                {profile.accepts_private && (
                  <div className="mt-2">
                    {/* Moeda ANTES do valor, e o valor formatado enquanto digita.
                      A moeda decide a pontuação: real e euro usam vírgula
                      decimal, dólar usa ponto — formatar tudo como real daria
                      "US$ 1.250,00", que não existe. */}
                    <div className="grid grid-cols-[132px_1fr] gap-2">
                      <select
                        value={moeda}
                        onChange={(e) => {
                          const nova = e.target.value as MoedaChave;
                          setMoeda(nova);
                          // Reformata o que já está digitado na pontuação da nova.
                          setValorTexto((t) => digitandoDinheiro(t, nova));
                        }}
                        className={`${input} mt-0`}
                        aria-label="Moeda da consulta"
                      >
                        {MOEDAS.map((m) => (
                          <option key={m.chave} value={m.chave}>
                            {m.rotulo}
                          </option>
                        ))}
                      </select>
                      <input
                        value={valorTexto}
                        onChange={(e) => setValorTexto(digitandoDinheiro(e.target.value, moeda))}
                        placeholder="450,00"
                        inputMode="numeric"
                        className={`${input} mt-0`}
                        aria-label="Valor da consulta"
                      />
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {centavosDe(valorTexto)
                        ? `A paciente vê ${formatarDinheiro(centavosDe(valorTexto), moeda)} antes de pedir consulta.`
                        : "A paciente vê esse valor antes de pedir consulta. Dá para mudar quando quiser."}
                    </p>
                  </div>
                )}
              </div>
              {/* Formações por CATEGORIA. O textarea "uma linha por item" ou fica
                vazio (é trabalho em branco, sem pista do que entra) ou vem tudo
                numa linha só, que a paciente lê como borrão e a busca não acha.
                As categorias são andaime de digitação: o banco continua com uma
                coluna de texto, uma linha por item. */}
              <CampoFormacoes
                valores={formacoes}
                onChange={(chave, v) => setFormacoes((f) => ({ ...f, [chave]: v }))}
                livre={profile.bio}
                onChangeLivre={(v) => setProfile((p) => ({ ...p, bio: v }))}
                classeInput={input}
                classeLabel={label}
              />
              <div>
                <label className={label}>Chave PIX (cobranças)</label>
                <input
                  value={profile.pix_key}
                  onChange={(e) => setProfile((p) => ({ ...p, pix_key: e.target.value }))}
                  placeholder="Opcional — dá para configurar depois"
                  className={input}
                />
              </div>
              <button
                type="submit"
                disabled={busy}
                className="press glow-cta w-full rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                {busy ? "Criando seu consultório…" : "Abrir meu consultório digital 🚀"}
              </button>
              <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
                Ao continuar você concorda com os termos de uso. Seus dados e os das suas pacientes
                ficam protegidos por Row Level Security e LGPD.
              </p>
            </form>

            {/* A prévia é o mesmo componente nas duas larguras; o que muda é onde
              ela mora. `order-first` no celular a leva para cima do formulário,
              onde ele a vê ao abrir; no desktop ela volta para a direita. */}
            <aside className="order-first lg:order-none">
              <button
                type="button"
                onClick={() => setPreviaAberta((v) => !v)}
                className="mb-2 w-full rounded-2xl border border-border bg-card px-4 py-2.5 text-left text-sm font-medium text-foreground lg:hidden"
              >
                {previaAberta ? "▾" : "▸"} Ver como a paciente te vê
              </button>
              <div className={previaAberta ? "" : "hidden lg:block"}>
                <PreviaCardMedico
                  nome={profile.display_name}
                  titulo={profile.title}
                  especialidade={profile.specialty}
                  focos={profile.focos.filter((f) => f !== profile.specialty)}
                  bio={profile.bio}
                  formacoes={montarFormacoes(formacoes)}
                  aceitaConvenio={profile.accepts_insurance}
                  aceitaParticular={profile.accepts_private}
                  convenios={profile.insurances}
                  precoCentavos={centavosDe(valorTexto)}
                  moeda={moeda}
                  crm={crmCompleto}
                />
              </div>
            </aside>
          </div>
        ) : null}
      </div>
    </main>
  );
}
