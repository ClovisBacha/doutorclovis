/**
 * A homepage.
 *
 * A versão anterior abria com um recurso — "A gestação inteira no seu bolso" —
 * e listava quatro categorias de produto para alguém que chegou com medo. Esta
 * abre com uma cena, e o botão só aparece depois que a visitante se reconheceu.
 *
 * Três coisas saíram de propósito, e vale saber por quê antes de recolocá-las:
 *
 *  · Os DEPOIMENTOS eram inventados, com fotos de `randomuser.me`. Existe um
 *    sistema de depoimentos reais e moderados (`listApprovedTestimonials`); ou
 *    a seção mostra os de verdade, ou não existe.
 *  · Os NÚMEROS (4.000 partos, 98% de satisfação) são de um médico, não da
 *    plataforma, e o de satisfação não tem fonte em lugar nenhum.
 *  · O RETRATO DO FUNDADOR contradiz o modelo: o Obstétrica deixou de ser o
 *    consultório de um médico e virou plataforma onde a paciente escolhe o
 *    dela. Uma home que mostra o rosto de um obstetra desfaz isso na primeira
 *    rolagem.
 *
 * Toda promessa aqui tem lastro num arquivo do repositório. Onde o lastro é
 * fraco — a arte semanal do bebê, o mural, a impressão 3D — a frase não existe,
 * por mais bonita que fosse.
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { FaixaDeConvite } from "@/components/faixa-de-convite";
import { useEffect, useState } from "react";
import { Reveal } from "@/components/reveal";
import { SkyCanvas, useWeatherSky } from "@/components/weather-sky";
import { PhoneFrame, AppChatMockupScreen } from "@/components/app-phone-mockup";
import { setHeroDark } from "@/components/hero-theme";
import bolhaFeliz from "@/assets/bolha/feliz.webp";
import arteVinculo from "@/assets/social/vinculo.webp";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Obstétrica — alguém acordado às três da manhã" },
      {
        name: "description",
        content:
          "A dúvida da gestação não aparece às três da tarde. O Obstétrica responde com as orientações que o seu obstetra validou, e diz quando a resposta é com ele. Gestação de alto risco, do positivo ao pós-parto.",
      },
      { property: "og:title", content: "Obstétrica — ninguém deveria atravessar isso sozinha" },
      {
        property: "og:description",
        content:
          "294 dias de conteúdo, contrações que dizem se é hora de ir, SOS que avisa o seu médico. Você escolhe o obstetra.",
      },
    ],
  }),
  component: Index,
});

/** O rodapé legal que se repete — a mesma frase em todo lugar, de propósito. */
const AVISO = "Conteúdo educativo — não substitui a consulta médica.";

/* ── Peças pequenas ────────────────────────────────────────────────────── */

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">{children}</p>
  );
}

function Secao({
  children,
  fundo,
  id,
}: {
  children: React.ReactNode;
  fundo?: "creme" | "secundario";
  id?: string;
}) {
  return (
    <section
      id={id}
      className={`px-5 py-16 md:py-24 ${fundo === "secundario" ? "border-y border-border/60 bg-secondary/40" : ""}`}
    >
      <div className="mx-auto max-w-5xl">{children}</div>
    </section>
  );
}

function Titulo({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-3 font-serif text-[28px] font-extrabold leading-[1.12] tracking-tight md:text-[42px]">
      {children}
    </h2>
  );
}

function Corpo({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-muted-foreground md:text-lg">
      {children}
    </p>
  );
}

function Botao({
  to,
  children,
  variante = "primario",
}: {
  to: string;
  children: React.ReactNode;
  variante?: "primario" | "secundario";
}) {
  const base =
    "press inline-flex items-center justify-center rounded-full px-6 py-3.5 text-[15px] font-extrabold transition-colors";
  return (
    <Link
      to={to}
      className={
        variante === "primario"
          ? `${base} bg-primary text-primary-foreground hover:bg-primary/90`
          : `${base} border-2 border-primary/25 text-primary hover:bg-primary/5`
      }
    >
      {children}
    </Link>
  );
}

/* ── A página ──────────────────────────────────────────────────────────── */

function Index() {
  /**
   * O céu do hero é FIXO em madrugada, e isso é escolha.
   *
   * A seção é uma cena — três da manhã, todo mundo dormindo — e um céu que
   * muda com a hora real destruiria a cena para quem abre de tarde. O céu ao
   * vivo continua no app e ganha demonstração própria mais abaixo, onde ele é
   * o assunto e não o cenário.
   */
  const sky = useWeatherSky("noite");
  const [demo, setDemo] = useState<"manha" | "dia" | "entardecer" | "noite">("dia");
  const ceuDemo = useWeatherSky(demo);

  useEffect(() => {
    setHeroDark(true);
    return () => setHeroDark(false);
  }, []);

  return (
    <>
      {/* ── 1 · A madrugada ─────────────────────────────────────────── */}
      <section
        className="relative overflow-hidden"
        style={{
          marginTop: "calc(-73px - var(--safe-top))",
          paddingTop: "calc(73px + var(--safe-top))",
        }}
      >
        <SkyCanvas sky={sky} />
        <div className="relative mx-auto grid max-w-6xl items-center gap-8 px-5 pt-6 pb-20 md:grid-cols-[1.1fr_1fr] md:gap-10 md:pt-20 md:pb-28">
          {/* O TEXTO vem primeiro no celular.
              A versão anterior punha o telefone em `order-first`, e a medição
              mostrou o estrago: no iPhone, 100% da primeira tela era mockup —
              o H1 começava 3px antes do fim do viewport, e ainda por baixo da
              barra fixa. Era preciso rolar 1,3 tela para ver o botão. No
              desktop a ordem se inverte, onde as duas colunas cabem juntas. */}
          <div className="liquid-glass rounded-[2rem] p-6 md:p-9">
            {/* ⚠️ **ACIMA DO H1, e não no rodapé.** O convite já fez o trabalho
                difícil — alguém em quem ela confia disse "entra aqui" — e a
                landing jogava isso fora mostrando a mesma tela para todo mundo.
                A faixa se desenha sozinha só quando há código na visita; sem
                ele, esta linha não pinta nada. Ver `quem-convidou.ts`. */}
            <div className="empty:hidden">
              <FaixaDeConvite escura />
            </div>
            <Reveal variant="blur">
              <p className="glass-chip mt-4 text-[11px] font-bold uppercase tracking-[0.22em] text-white">
                Boa madrugada
              </p>
            </Reveal>
            <Reveal variant="up" delay={120}>
              <h1 className="mt-4 font-serif text-[30px] font-extrabold leading-[1.06] tracking-tight text-white md:text-[56px]">
                A dúvida nunca aparece às três da tarde.
              </h1>
            </Reveal>
            <Reveal variant="up" delay={220}>
              <p className="mt-5 max-w-lg text-base leading-relaxed text-white/75 md:text-lg">
                Aparece às três da manhã, no escuro, com todo mundo dormindo. O Obstétrica é onde
                tem alguém acordado — respondendo com as orientações que o seu obstetra já validou,
                e dizendo com todas as letras quando a resposta é com ele.
              </p>
            </Reveal>
            <Reveal variant="up" delay={320}>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Botao to="/auth">Criar minha conta</Botao>
                <Link
                  to="/encontrar-medico"
                  className="press inline-flex items-center justify-center rounded-full border-2 border-white/25 px-6 py-3.5 text-[15px] font-extrabold text-white transition-colors hover:bg-white/10"
                >
                  Ver os obstetras do app
                </Link>
              </div>
              <p className="mt-5 text-xs leading-relaxed text-white/55">
                Criar conta é grátis. {AVISO} Em urgência, ligue 192 (SAMU).
              </p>
            </Reveal>
          </div>
          <div className="flex justify-center md:order-first">
            <PhoneFrame>
              <AppChatMockupScreen />
            </PhoneFrame>
          </div>
        </div>
      </section>

      {/* ── 2 · O que ela se recusa a responder ─────────────────────── */}
      <Secao>
        <Reveal variant="up">
          <Eyebrow>A resposta das 3h</Eyebrow>
          <Titulo>Ela não improvisa. E te diz quando não sabe.</Titulo>
          <Corpo>
            A maioria dos apps responde qualquer coisa. Aqui a resposta passa por um filtro: se a
            sua dúvida cai no que o seu obstetra já validou, ela responde no nome dele. Se não cai,
            ela não inventa conduta — registra a pergunta para ele responder e te devolve só o que é
            seguro dizer.
          </Corpo>
        </Reveal>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {[
            {
              classe: "glass-pink",
              titulo: "Coberto pelo seu médico",
              texto:
                "A orientação sai com a assinatura de quem a validou — “Dr(a). ___ orienta que…”.",
            },
            {
              classe: "glass-amber",
              titulo: "Fora do que ele validou",
              texto:
                "“Essa é uma dúvida que ele prefere responder pessoalmente. Registrei aqui para ele ver.”",
            },
            {
              classe: "glass-teal",
              titulo: "Dúvida do aplicativo",
              texto:
                "Onde fica uma aba, como registrar uma contração, como marcar consulta — isso ela resolve na hora.",
            },
          ].map((c, i) => (
            <Reveal key={c.titulo} variant="up" delay={i * 90}>
              <div className={`card-3d ${c.classe} h-full rounded-3xl p-6`}>
                <h3 className="font-serif text-lg font-extrabold">{c.titulo}</h3>
                <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">{c.texto}</p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal variant="up" delay={280}>
          <p className="mt-8 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Ela nunca dá diagnóstico, prescrição ou dose. Em sangramento, dor intensa, queda de
            movimentos do bebê ou pressão muito alta, ela manda você para o pronto-socorro ou para o
            192.
          </p>
        </Reveal>
      </Secao>

      {/* ── 3 · De quem é essa voz ──────────────────────────────────── */}
      <Secao fundo="secundario">
        <Reveal variant="up">
          <Eyebrow>O seu obstetra</Eyebrow>
          <Titulo>A voz é de um médico de verdade. Você escolhe qual.</Titulo>
          <Corpo>
            O Obstétrica não tem um médico dono. Tem um diretório: você filtra por cidade, anos de
            experiência, mestrado, doutorado, convênio ou particular, e lê a abordagem de cada um
            antes de decidir. O obstetra que você escolher passa a te acompanhar por aqui — e é a
            conduta dele, não a de um manual genérico, que a IA usa para te responder.
          </Corpo>
          <Corpo>
            Já tem obstetra e ele não está aqui? Você pode convidá-lo pelo seu link: ele ganha 15%
            de desconto em qualquer plano e, quando assinar, você ganha um ano de Premium.
          </Corpo>
          <div className="mt-7">
            <Botao to="/encontrar-medico">Ver os obstetras do app</Botao>
          </div>
        </Reveal>
      </Secao>

      {/* ── 4 · Quando o corpo dá sinal ─────────────────────────────── */}
      <Secao>
        <Reveal variant="up">
          <Eyebrow>Nos minutos que importam</Eyebrow>
          <Titulo>Duas telas para quando não dá para esperar amanhã.</Titulo>
        </Reveal>

        <div className="mt-10 grid gap-5 md:grid-cols-2">
          <Reveal variant="up">
            <div className="card-3d glass-rose h-full rounded-3xl p-7">
              <h3 className="font-serif text-xl font-extrabold">Contrações</h3>
              <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
                Você toca quando começa e quando passa. O app calcula o intervalo e a duração e diz
                em que ponto você está — sem tabela para interpretar às três da manhã.
              </p>
              <ul className="mt-5 space-y-2 text-sm font-semibold">
                {[
                  "Padrão normal",
                  "Atenção — padrão irregular",
                  "Trabalho de parto ativo",
                  "Vá para a maternidade agora",
                ].map((v) => (
                  <li key={v} className="flex items-center gap-2.5">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    {v}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>

          <Reveal variant="up" delay={110}>
            <div className="card-3d h-full rounded-3xl border-2 border-destructive/15 bg-card p-7">
              <h3 className="font-serif text-xl font-extrabold">SOS</h3>
              <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
                Um toque avisa o seu obstetra e o seu contato de emergência de uma vez, com a sua
                localização quando o aparelho permitir, e com a sua ficha junto: semana, tipo
                sanguíneo, alergias, medicamentos.
              </p>
              <p className="mt-4 text-[15px] leading-relaxed text-foreground">
                E então a tela mostra <strong>quais avisos saíram de fato</strong>, com o e-mail e o
                telefone de quem recebeu. Se alguém ficou de fora, ela diz quem — em vez de escrever
                “enviado” e deixar você achando que o seu marido já sabe.
              </p>
            </div>
          </Reveal>
        </div>
      </Secao>

      {/* ── 5 · Os trinta dias ──────────────────────────────────────── */}
      <Secao fundo="secundario">
        <div className="grid items-center gap-10 md:grid-cols-[1.1fr_0.9fr]">
          <Reveal variant="up">
            <Eyebrow>Todo dia</Eyebrow>
            <Titulo>Você vê o obstetra vinte minutos por mês. Sobram trinta dias.</Titulo>
            <Corpo>
              É neles que o app vive. Cada dia da sua gestação tem uma aula curta sobre o que está
              acontecendo com você e com o bebê <em>naquele dia</em>, e um desafio pequeno: beber
              água, anotar um sintoma, caminhar quinze minutos.
            </Corpo>
            <Corpo>
              Não é um blog por semana: é uma trilha, e você vê o caminho inteiro para trás e para a
              frente. A semana tem seu ritmo — bebê, corpo, nutrição, sinais, exames, vínculo — e
              domingo fecha com a revisão do que você aprendeu.
            </Corpo>
            <div className="mt-7 flex flex-wrap gap-x-8 gap-y-4">
              {[
                ["294", "dias de aula"],
                ["1.331", "perguntas"],
                ["378", "desafios"],
              ].map(([n, l]) => (
                <div key={l}>
                  <p className="font-serif text-3xl font-extrabold text-primary">{n}</p>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {l}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              Da semana 4 até a 42, e mais doze semanas depois do parto.
            </p>
          </Reveal>

          <Reveal variant="up" delay={140}>
            <div className="flex items-center justify-center gap-5">
              <div className="flex flex-col items-center gap-4">
                {[0, 1, 2, 3].map((i) => (
                  <span
                    key={i}
                    className="duo3d flex h-14 w-14 items-center justify-center rounded-full"
                    style={
                      {
                        background: i === 1 ? "var(--primary)" : "var(--accent)",
                        "--lip": i === 1 ? "oklch(0.44 0.1 22)" : "oklch(0.82 0.05 26)",
                        marginLeft: i % 2 ? "2.5rem" : 0,
                      } as React.CSSProperties
                    }
                  />
                ))}
              </div>
              <img
                src={bolhaFeliz}
                alt=""
                aria-hidden
                className="h-24 w-24 self-end"
                loading="lazy"
              />
            </div>
          </Reveal>
        </div>
      </Secao>

      {/* ── 6 · As noites em que não dá para dormir ─────────────────── */}
      <Secao>
        <Reveal variant="up">
          <Eyebrow>Quando o sono não vem</Eyebrow>
          <Titulo>Sete meditações com voz humana. E som que toca sem internet.</Titulo>
          <Corpo>
            As meditações foram gravadas em estúdio, com voz de gente — não a voz sintética do seu
            celular. São sete temas e nove movimentos narrados para o corpo que dói de carregar.
          </Corpo>
          <Corpo>
            Chuva, mar, batimento e um pad calmo são gerados dentro do próprio navegador. Tocam no
            primeiro segundo, funcionam com o avião ligado e não ocupam espaço nenhum no seu
            telefone.
          </Corpo>
        </Reveal>

        {/* O céu ao vivo é DEMONSTRADO aqui, e não escondido no desktop como
            antes: quem mais navega é justamente quem estava sem ele. */}
        <Reveal variant="up" delay={120}>
          <div className="mt-9 overflow-hidden rounded-3xl border border-border/60">
            <div className="relative h-52 md:h-72">
              <SkyCanvas sky={ceuDemo} />
              <div className="absolute inset-x-0 bottom-0 flex flex-wrap justify-center gap-2 p-4">
                {(
                  [
                    ["manha", "Manhã"],
                    ["dia", "Meio-dia"],
                    ["entardecer", "Entardecer"],
                    ["noite", "Madrugada"],
                  ] as const
                ).map(([k, rotulo]) => (
                  <button
                    key={k}
                    onClick={() => setDemo(k)}
                    className={`press rounded-full px-4 py-2 text-xs font-extrabold backdrop-blur-xl transition-colors ${
                      demo === k
                        ? "bg-white text-foreground"
                        : "bg-white/25 text-white hover:bg-white/40"
                    }`}
                  >
                    {rotulo}
                  </button>
                ))}
              </div>
            </div>
            <p className="bg-card px-5 py-3.5 text-sm text-muted-foreground">
              No app, o céu é o da <strong>sua cidade agora</strong> — a hora certa e o tempo que
              está fazendo lá fora.
            </p>
          </div>
        </Reveal>
      </Secao>

      {/* ── 7 · A parte chata também ────────────────────────────────── */}
      <Secao fundo="secundario">
        <div className="grid gap-10 md:grid-cols-2">
          <Reveal variant="up">
            <Eyebrow>Consulta</Eyebrow>
            <Titulo>Sem horário não significa esperar até o mês que vem.</Titulo>
            <Corpo>
              Você pede a consulta pelo app. Se o médico precisar de outro horário, ele propõe, e
              você aceita ou recusa — a conversa não vira quinze mensagens no WhatsApp.
            </Corpo>
            <Corpo>
              Se a semana estiver cheia, você entra na fila daquela semana. Quando alguém desmarca,
              a vaga é oferecida à primeira da fila, que tem quatro horas para responder. Sem
              resposta, ela passa para a próxima.
            </Corpo>
          </Reveal>

          <Reveal variant="up" delay={120}>
            <div className="card-3d rounded-3xl bg-card p-7">
              <h3 className="font-serif text-lg font-extrabold">Depois da consulta</h3>
              <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
                Você grava a conversa no seu celular e recebe por escrito o que foi dito. Ninguém
                mais sai do consultório lembrando metade.
              </p>
              <ul className="mt-5 space-y-2.5">
                {["As orientações", "Os medicamentos", "Os exames pedidos", "Quando voltar"].map(
                  (x) => (
                    <li key={x} className="flex items-center gap-2.5 text-sm font-semibold">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      {x}
                    </li>
                  ),
                )}
              </ul>
              <p className="mt-5 text-xs text-muted-foreground">
                A gravação é sua e fica na sua conta.
              </p>
            </div>
          </Reveal>
        </div>
      </Secao>

      {/* ── 8 · Não acaba no parto ──────────────────────────────────── */}
      <Secao>
        <div className="mx-auto max-w-2xl text-center">
          <Reveal variant="up">
            <img
              src={arteVinculo}
              alt=""
              aria-hidden
              className="mx-auto h-32 w-32"
              loading="lazy"
            />
            <div className="mt-2">
              <Eyebrow>Depois</Eyebrow>
            </div>
            <Titulo>O app não fecha quando o bebê nasce.</Titulo>
            <p className="mx-auto mt-4 text-[15px] leading-relaxed text-muted-foreground md:text-lg">
              São mais doze semanas de conteúdo diário, agora contadas pela idade dele: o sono que
              não existe, a mamada que dói, o corpo que ainda está voltando.
            </p>
            <p className="mx-auto mt-4 text-[15px] leading-relaxed text-muted-foreground md:text-lg">
              E tem o rastreio de depressão pós-parto — a Escala de Edinburgh, dez perguntas,
              resultado na hora. Quando o resultado pede atenção, o seu obstetra é avisado. Você não
              precisa ter coragem de contar sozinha.
            </p>
            <div className="mt-7 flex justify-center">
              <Botao to="/epds" variante="secundario">
                Fazer o teste — é gratuito e não precisa de conta
              </Botao>
            </div>
          </Reveal>
        </div>
      </Secao>

      {/* ── 9 · Quem estiver com você ───────────────────────────────── */}
      <Secao fundo="secundario">
        <Reveal variant="up">
          <Eyebrow>Acompanhante</Eyebrow>
          <Titulo>Ele acompanha por um link. Sem entrar na sua conta.</Titulo>
          <Corpo>
            Você manda um link para o seu parceiro, sua mãe, sua irmã. Ele abre no navegador, sem
            instalar nada, e vê a semana, a data prevista e o batimento que o médico registrou na
            última consulta — e um guia do que fazer naquele trimestre, escrito para ele.
          </Corpo>
        </Reveal>

        {/* O desenho mais persuasivo aqui é o da AUSÊNCIA: o que ele não vê. */}
        <Reveal variant="up" delay={120}>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <div className="rounded-3xl bg-card p-6">
              <p className="text-xs font-bold uppercase tracking-wider text-primary">Ele vê</p>
              <ul className="mt-3 space-y-2 text-sm font-semibold">
                {[
                  "A semana e a data prevista",
                  "O batimento da última consulta",
                  "O guia dele",
                ].map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-3xl bg-card p-6">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Ele não vê
              </p>
              <ul className="mt-3 space-y-2 text-sm font-semibold text-muted-foreground">
                {["O seu diário", "Os seus exames", "Nada que ele possa mexer"].map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </div>
          </div>
          <p className="mt-5 text-sm text-muted-foreground">
            Você tira o acesso quando quiser. Tem também o álbum da família e a votação do nome, que
            qualquer um da lista abre pelo link.
          </p>
        </Reveal>
      </Secao>

      {/* ── 10 · O que ele não faz ──────────────────────────────────── */}
      <Secao>
        <div className="mx-auto max-w-xl">
          <Reveal variant="up">
            <Titulo>O que ele não faz.</Titulo>
            <ul className="mt-6 space-y-4">
              {[
                "Não substitui a sua consulta. Ele existe para os trinta dias entre uma e outra.",
                "Não dá diagnóstico, prescrição nem dose de remédio.",
                "Não promete gestação tranquila. Ninguém pode prometer isso.",
                "Não inventa conduta que o seu médico não validou. Quando não sabe, encaminha.",
              ].map((x) => (
                <li
                  key={x}
                  className="border-l-2 border-border pl-4 text-[15px] leading-relaxed text-muted-foreground"
                >
                  {x}
                </li>
              ))}
            </ul>
            <p className="mt-7 text-sm text-muted-foreground">
              {AVISO} Em urgência, ligue 192 (SAMU) ou vá ao pronto-socorro.
            </p>
          </Reveal>
        </div>
      </Secao>

      {/* ── 11 · O convite ──────────────────────────────────────────── */}
      <section className="px-5 pb-20">
        <div
          className="relative mx-auto max-w-5xl overflow-hidden rounded-[2rem] px-7 py-14 text-primary-foreground md:px-14"
          style={{ background: "var(--gradient-primary)" }}
        >
          <div className="relative">
            <Reveal variant="up">
              <h2 className="font-serif text-[26px] font-extrabold leading-tight md:text-[38px]">
                Ninguém deveria atravessar isso sozinha.
              </h2>
              <p className="mt-4 max-w-lg text-[15px] leading-relaxed opacity-90 md:text-lg">
                Crie a sua conta e escolha o seu obstetra. Leva um minuto, e é grátis para começar.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Link
                  to="/auth"
                  className="press inline-flex items-center justify-center rounded-full bg-white px-6 py-3.5 text-[15px] font-extrabold text-primary"
                >
                  Criar minha conta
                </Link>
                <Link
                  to="/encontrar-medico"
                  className="press inline-flex items-center justify-center rounded-full border-2 border-white/35 px-6 py-3.5 text-[15px] font-extrabold"
                >
                  Ver os obstetras do app
                </Link>
              </div>
              <p className="mt-7 text-xs opacity-75">
                É médico?{" "}
                <Link to="/medicos" className="underline underline-offset-2">
                  Conheça o Obstétrica para consultórios.
                </Link>
              </p>
            </Reveal>
          </div>
        </div>
      </section>
    </>
  );
}
