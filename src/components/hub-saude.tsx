/**
 * O HUB DA SAÚDE — a grade de quadrados que abre a seção no celular.
 *
 * ⚠️ **ESTE ARQUIVO NASCEU DE UM MOVE, e nada do corpo foi tocado.** Ele vivia
 * em `minha-conta.tsx`, um arquivo de ROTA, como `export function` — e export
 * não-rota num arquivo de rota sai do pedaço daquela rota e entra no pedaço da
 * ÁRVORE DE ROTAS, que toda página do site carrega antes de qualquer coisa
 * aparecer. Medido no bundle antes do corte: `preview-saude` importava
 * `HubSaude` de `index-*.js`, o pedaço de ENTRADA — enquanto a bancada irmã
 * (`preview-saude-registros`) importava `HealthTab` de um pedaço PRÓPRIO, que
 * é como deve ser. Com o hub aqui, ele passa a ter pedaço próprio, e os cinco
 * `.webp` das artes, os três ícones e os três módulos de fila saem do grafo
 * estático da rota junto.
 *
 * ⚠️ É a mesma razão que tirou `PainelDaEmbaixadora` de `influenciadora.tsx`
 * (11 kB do pedaço de entrada) e `ConquistasTab`, `ChatTab`, `OnboardingRitual`
 * e `CodigoDaEmbaixadora` deste mesmo arquivo. Quem guarda a dívida é
 * `rotas-sem-export-solto.test.ts`, e a lista de tolerância dele só ENCOLHE.
 *
 * ⚠️ **`Tab` continua vindo da rota por `import type`**, e isso não custa um
 * byte: o tipo é apagado na compilação. Mover `Tab` para `lib/` toca dezenas de
 * referências e deixaria de ser um move.
 */

import { useEffect, useState } from "react";
import { Footprints, HeartPulse, Ribbon, Salad, Timer, type LucideIcon } from "lucide-react";
import icSaude from "@/assets/saude/saude.webp";
import icChutes from "@/assets/saude/chutes.webp";
import icContracoes from "@/assets/saude/contracoes.webp";
import icNutricao from "@/assets/saude/nutricao.webp";
import icMulher from "@/assets/saude/mulher.webp";
import { GradeHub, VoltarDaGrade } from "@/components/grade-hub";
import { supabase } from "@/integrations/supabase/client";
import { lerFilaDeChutes } from "@/lib/fila-de-chutes";
import { lerFila as lerFilaDeContracoes } from "@/lib/fila-de-contracoes";
import { mesclar as mesclarRegistros } from "@/lib/fila-local";
import { diasEntre, inicioDeHojeISO, quandoFoi } from "@/lib/quando-foi";
import type { Tab } from "@/routes/_authenticated/minha-conta";

/* ══════════════════ Hub da Saúde (celular) ══════════════════
   A seção Saúde tem seis abas e elas moravam numa fileira de pílulas que
   rolava na horizontal. Numa tela de 390px cabiam quatro: "Alertas" e "Saúde
   da mulher" ficavam além da borda, sem nenhum sinal de que existiam — e as
   quatro visíveis eram alvos de 36px de altura espremidos entre o título e o
   conteúdo.

   Viraram seis quadrados grandes, dois por linha. É a mesma navegação, mas
   cada destino ganha nome, uma linha dizendo o que tem dentro, um ícone e um
   alvo do tamanho do polegar — e, principalmente, todos aparecem de uma vez.

   ─── O QUE ENTROU E O QUE SAIU DAQUI (ago/2026) ──────────────────────────
   A aba se chamava Saúde e as DUAS ferramentas de automonitoramento com mais
   peso clínico da gestação estavam fora dela: contar movimentos do bebê e
   cronometrar contrações moravam em Registros, dentro do grupo Gestação.

   Isso era pior que uma escolha de arrumação, porque a triagem de sintomas
   mora AQUI e cita as duas pelo nome: "redução dos movimentos do bebê" e
   "contrações regulares antes de 37 semanas" são dois dos nove sintomas
   VERMELHOS. Uma paciente que sente o bebê parado abria Saúde, encontrava a
   pergunta, e não tinha como contar dali.

   Entraram como ATALHOS, não como cópias: os dois ladrilhos abrem
   `Registros` já na sub-tela certa. Duas implementações de contagem de
   chutes divergiriam no primeiro conserto.

   E "Saúde da mulher" saiu da grade enquanto ela está grávida — ver
   `mostrarSaudeDaMulher`.

   `aspect-square` de propósito: é o que garante "dois quadrados grandes por
   linha" em qualquer largura, de um iPhone SE a um tablet em retrato. */
export type LadrilhoDaSaude = {
  key: string;
  label: string;
  sub: string;
  Icon: LucideIcon;
  /** Ícone 3D; quando presente, `GradeHub` desenha a imagem no lugar do Lucide. */
  imagem?: string;
  caixa: string;
  tinta: string;
  /** Aba de destino. Nem todo ladrilho é uma aba de mesmo nome. */
  destino: Tab;
  /** Sub-tela dentro do destino — é o que faz Chutes abrir em Chutes. */
  subDestino?: string;
};

/* ─── QUATRO LADRILHOS, E NÃO SEIS (ago/2026) ─────────────────────────────
   Pedido do dono: "nessa tela eu não quero que tenha as funções de alertas, e
   nem de bem-estar — tudo que é do bem-estar está dentro da aba do jogo".

   Ele está certo sobre o Jogo: o Caminho tem os quatro momentos do dia
   (`MovementBlock`, `MeditationBlock`, `BondingBlock`, `GratitudeBlock`), então
   Meditar e Mexer já vivem lá, com implementação própria.

   E os nove sintomas VERMELHOS que a triagem lista continuam no SOS, que é o
   primeiro botão da barra — `emergency-sheet` os mostra sob "Procure
   atendimento agora se sentir". A grade perdeu um atalho, não o conteúdo.

   A ordem que ficou é clínica: primeiro "estou bem?" (números), depois "e o
   bebê?" (chutes, contrações), e por fim o que se come. */
export const HUB_SAUDE: LadrilhoDaSaude[] = [
  {
    key: "Saúde",
    imagem: icSaude,
    label: "Saúde",
    sub: "Peso, pressão e glicemia",
    Icon: HeartPulse,
    caixa: "border-emerald-200/70 from-emerald-50 to-teal-50/60",
    tinta: "text-emerald-600",
    destino: "Saúde",
  },
  {
    key: "chutes",
    imagem: icChutes,
    label: "Chutes",
    sub: "Contar os movimentos",
    Icon: Footprints,
    caixa: "border-sky-200/70 from-sky-50 to-cyan-50/60",
    tinta: "text-sky-600",
    destino: "Meu dia a dia",
    subDestino: "chutes",
  },
  {
    key: "contracoes",
    imagem: icContracoes,
    label: "Contrações",
    sub: "Cronometrar e ver o padrão",
    Icon: Timer,
    caixa: "border-orange-200/70 from-orange-50 to-amber-50/60",
    tinta: "text-orange-600",
    destino: "Meu dia a dia",
    subDestino: "contracoes",
  },
  {
    key: "Nutrição",
    imagem: icNutricao,
    label: "Nutrição",
    sub: "O que comer hoje",
    Icon: Salad,
    caixa: "border-lime-200/70 from-lime-50 to-amber-50/60",
    tinta: "text-lime-600",
    destino: "Nutrição",
  },
  {
    key: "Saúde da mulher",
    imagem: icMulher,
    label: "Saúde da mulher",
    sub: "Ciclo, mamas e colo",
    Icon: Ribbon,
    caixa: "border-pink-200/70 from-pink-50 to-rose-50/60",
    tinta: "text-pink-600",
    destino: "Saúde da mulher",
  },
];

/**
 * A GRADE MOSTRA "SAÚDE DA MULHER"?
 *
 * Dois dos cinco quadrados da aba eram para uma mulher que NÃO está grávida:
 * "Ciclo menstrual" não tem o que mostrar por nove meses, e os preventivos que
 * ele lembra — Papanicolau, mamografia, perfil lipídico — em geral não se faz
 * durante a gestação. Não são recursos ruins; estavam na hora errada, ocupando
 * 40% da tela mais clínica do app.
 *
 * A régua é a mesma do Portal Pós-parto: aparece quando FAZ SENTIDO. Sem
 * gestação em andamento, é a aba certa; a partir da 36ª semana o pós-parto
 * entra no horizonte e ela volta.
 *
 * ⚠️ **Hoje ela decide só a LEGENDA do ladrilho, nunca a presença dele.** A
 * primeira versão tirava o ladrilho e afirmava que "a aba continua listada no
 * menu (`SECOES`)" — esse menu era o de computador (`hidden md:flex`), e no
 * celular a função sumia por nove meses. Uma garantia escrita que o aparelho
 * não cumpre é pior que nenhuma: quem lê acredita que preservou o acesso.
 */
export function mostrarSaudeDaMulher(weeks: number | null | undefined): boolean {
  return weeks == null || weeks >= 36;
}

/** O número dela num bloco da Saúde: o valor grande e a legenda pequena. */
type Dado = { valor: string; legenda?: string };

/**
 * O cabeçalho das três telas que o hub da Saúde abre como ABA (Saúde,
 * Nutrição, Saúde da mulher) — Chutes e Contrações já passam pelo cabeçalho de
 * `Registros`. Sem seta: a barra de cima é quem volta ao hub (`voltarDaBarra`).
 * Lê o MESMO `HUB_SAUDE` que desenha o bloco, então o coração verde de lá é o
 * coração verde daqui por construção.
 */
export function CabecalhoDaSaude({ chave }: { chave: string }) {
  const item = HUB_SAUDE.find((i) => i.key === chave);
  if (!item) return null;
  return <VoltarDaGrade rotulo={item.label} ladrilho={item} />;
}

export function HubSaude({
  onAbrir,
  weeks,
  careMode,
  bancada,
  cabecalhos,
}: {
  onAbrir: (t: Tab, sub?: string) => void;
  /** Semana gestacional — `null` quando não há gestação configurada. */
  weeks: number | null;
  /**
   * ⚠️ **NO MODO CUIDADO O LADRILHO DE CHUTES SAI DA GRADE.** Ele convida a
   * "contar os movimentos" — depois do batimento, é a tela mais dolorosa do
   * app para quem acabou de perder a gestação. O histórico dela NÃO é apagado
   * (é a memória dela, a mesma decisão que manteve `exam_files` e o Álbum de
   * pé); o que sai é o convite.
   *
   * ⚠️ E o CRONÔMETRO DE CONTRAÇÕES FICA, de propósito: quem perdeu a gestação
   * pode estar em trabalho de parto, e a decisão já está escrita no próprio
   * componente. O Modo Cuidado faz o app parar de FALAR DO BEBÊ, nunca de
   * socorrer.
   */
  careMode?: boolean;
  /**
   * Só a `/preview-saude`: os números prontos, sem sessão. Sem isto a bancada
   * mostraria sempre o bloco VAZIO — o único estado que ela não precisava provar.
   * Injeta o DADO no mesmo estado da produção, nunca um desenho à parte.
   */
  bancada?: Record<string, Dado | null>;
  /** Só a `/preview-saude`: em vez da grade, os cinco cabeçalhos de sub-tela, para fotografar. */
  cabecalhos?: boolean;
}) {
  /* Usa a MESMA grade das sub-abas (`GradeHub`). Antes esta tela tinha uma
     cópia do desenho; duas cópias do mesmo quadrado significam duas chances de
     elas divergirem no próximo ajuste. */
  /* ⚠️ OS NÚMEROS DELA DENTRO DOS BLOCOS. O dono pediu blocos que "preencham a
     tela inteira" e eles preenchiam com gradiente vazio; o que dá sentido ao
     tamanho é o dado. Três leituras em paralelo (uma onda, não três), e
     ⚠️ QUALQUER FALHA VIRA `null` — que não desenha nada. "Não consegui ler" e
     "ela nunca registrou" precisam cair no mesmo lugar, porque um "0" afirmaria
     um fato que a tela não sabe. Nutrição não tem número: fica sem, e isso
     também é informação (é conteúdo, não medição). */
  const [dados, setDados] = useState<Record<string, Dado | null>>(bancada ?? {});
  const ehBancada = !!bancada;
  useEffect(() => {
    if (ehBancada) return;
    let vivo = true;
    (async () => {
      /* ⚠️ O INSTANTE da meia-noite DELA, e não uma data solta: mandar
         `"2026-09-05T00:00:00"` sem fuso faz o Postgres ler em UTC, e em São
         Paulo isso arrasta as contrações das 21h de ONTEM para dentro do
         "hoje". Ver `src/lib/quando-foi.ts`. */
      const agora = new Date();
      const desdeMeiaNoite = inicioDeHojeISO(agora);
      /* ⚠️ **O NÚMERO DO BLOCO CONTAVA SÓ O SERVIDOR, e as duas abas irmãs
         guardam registro no APARELHO desde set/2026.** Uma contração
         cronometrada sem rede fica na fila local até subir — e o bloco dizia
         "3 contrações" sobre um dia em que ela cronometrou cinco. Não é
         omissão: é um NÚMERO MENOR afirmado num dia de trabalho de parto.

         Quem mescla é `mesclar`, a régua única das duas filas: ela deduplica
         pelo `started_at` (a chave natural, porque nenhuma das duas tabelas
         tem chave única) e faz a linha do SERVIDOR vencer — senão, no segundo
         entre o `insert` dar certo e o `load()` responder, o mesmo registro
         contaria duas vezes.

         `getSession` lê do DISCO e entra na MESMA onda das três consultas:
         `getUser` seria uma quarta ida à rede na frente de um número. */
      const [saude, chutes, contr, sessao] = await Promise.all([
        supabase
          .from("health_logs")
          .select("weight_kg, systolic, diastolic, log_date")
          .order("log_date", { ascending: false })
          .limit(1)
          .then((r) => (r.error ? null : (r.data?.[0] ?? null))),
        supabase
          .from("kick_sessions")
          .select("kick_count, started_at")
          .not("ended_at", "is", null)
          .order("started_at", { ascending: false })
          .limit(1)
          .then((r) => (r.error ? null : (r.data?.[0] ?? null))),
        supabase
          .from("contraction_logs")
          /* `id` entra porque `mesclar` casa e desempata por linha — a coluna
             não é desenhada em lugar nenhum deste bloco. */
          .select("id, started_at")
          .gte("started_at", desdeMeiaNoite)
          .order("started_at", { ascending: false })
          .limit(50)
          .then((r) => (r.error ? null : (r.data ?? null))),
        supabase.auth.getSession().then((r) => r.data.session),
      ]);
      if (!vivo) return;
      const uid = sessao?.user?.id ?? "";
      const emMs = agora.getTime();
      const pendentesDeChutes = uid ? lerFilaDeChutes(uid, emMs) : [];
      const pendentesDeContracoes = uid ? lerFilaDeContracoes(uid, emMs) : [];
      const d: Record<string, Dado | null> = {};
      if (saude) {
        const peso =
          saude.weight_kg != null ? `${String(saude.weight_kg).replace(".", ",")} kg` : null;
        const pa =
          saude.systolic != null && saude.diastolic != null
            ? `${saude.systolic}/${saude.diastolic}`
            : null;
        /* ⚠️ NADA DE "QUANDO" ESCRITO NO BLOCO — decisão do dono, com o print
           na mão ("quando que fez não preciso deixar escrito"). O que fica é o
           NÚMERO e o que ele é.
           ⚠️ Mas o dado VELHO continua não podendo se passar por atual: uma
           pressão de cinco meses atrás lida como o estado de hoje é a pior
           forma de dado velho. Sem poder escrever "há 3 meses", o que sobra é
           a régua dos blocos vizinhos — passado o prazo, o número SOME e o
           bloco volta ao rótulo, que sempre foi verdade. Sete dias, porque
           peso e pressão não se medem todo dia. */
        const velho = saude.log_date ? diasEntre(saude.log_date, agora) > 7 : false;
        /* O peso é o valor grande; a pressão vai na legenda. Sem peso, a
           pressão sobe para o valor — o bloco nunca fica com legenda solta. */
        d["Saúde"] = velho
          ? null
          : peso
            ? { valor: peso, legenda: pa ? `pressão ${pa}` : undefined }
            : pa
              ? { valor: pa, legenda: "pressão" }
              : null;
      }
      /* A última contagem é a mais recente das DUAS listas — ler só o
         servidor faria a contagem que ela acabou de encerrar sem rede (a mais
         nova que existe) não ser "a última". É o mesmo defeito que
         `ultimaContagem` fecha dentro da aba. */
      const ultimaDeChutes = mesclarRegistros(
        chutes ? [{ id: "s", started_at: chutes.started_at, kick_count: chutes.kick_count }] : [],
        pendentesDeChutes,
      )[0];
      if (ultimaDeChutes && ultimaDeChutes.kick_count != null) {
        /* ⚠️ NUNCA `String(started_at).slice(0, 10)`: a coluna é `timestamptz`
           e o PostgREST devolve em UTC. Medido em São Paulo — uma sessão às
           21h30 do dia 5 chega como dia 6, não casava com "hoje" nem com
           "ontem", e o contador SUMIA do bloco. Quem conta movimentos no
           horário que a tela recomenda era quem nunca via o número. */
        /* `quandoFoi` continua sendo o FILTRO (hoje ou ontem, senão o número
           some) — só não vai mais para o texto. */
        const quando = quandoFoi(ultimaDeChutes.started_at, agora);
        d["chutes"] = quando
          ? { valor: String(ultimaDeChutes.kick_count), legenda: "chutes" }
          : null;
      }
      /* ⚠️ As pendentes são recortadas pelo MESMO `desdeMeiaNoite` da consulta:
         a fila guarda até sete dias, e somá-la inteira poria as contrações de
         terça no contador de hoje. */
      const contracoesDeHoje = mesclarRegistros(
        contr ?? [],
        pendentesDeContracoes.filter((c) => c.started_at >= desdeMeiaNoite),
      );
      if (contracoesDeHoje.length > 0) {
        /* A consulta já recorta o dia (`desdeMeiaNoite`); o "hoje" e a hora da
           última saíram do TEXTO a pedido do dono. */
        d["contracoes"] = { valor: String(contracoesDeHoje.length), legenda: "contrações" };
      }
      setDados(d);
    })().catch(() => {
      /* silêncio: sem dado, o bloco volta ao rótulo, que sempre foi verdade */
    });
    return () => {
      vivo = false;
    };
  }, [ehBancada]);
  /* ⚠️ Os cinco ladrilhos aparecem SEMPRE. Antes "Saúde da mulher" saía da
     grade durante a gestação, com um comentário garantindo que "a aba
     continua listada no menu" — e esse menu é o de computador, escondido no
     celular. No aparelho a função sumia por nove meses (estudo de navegação,
     set/2026). O que muda com a fase é a LEGENDA, não a porta. */
  const itens = HUB_SAUDE.filter((i) => !(careMode && i.key === "chutes")).map((i) => ({
    ...i,
    sub:
      i.key === "Saúde da mulher" && !mostrarSaudeDaMulher(weeks)
        ? "O que fica para depois do parto"
        : i.sub,
    dado: dados[i.key] ?? null,
  }));
  if (cabecalhos) {
    return (
      <div className="space-y-3">
        {itens.map((i) => (
          <VoltarDaGrade key={i.key} rotulo={i.label} ladrilho={i} onVoltar={() => {}} />
        ))}
      </div>
    );
  }
  return (
    <GradeHub
      itens={itens}
      /* ⚠️ SEMPRE o bloco grande — e isto foi um RECURSO MORTO por um tempo.
         A condição aqui era `itens.length === 4`, escrita quando "Saúde da
         mulher" saía da grade durante a gestação. Quando os cinco ladrilhos
         passaram a aparecer SEMPRE (o estudo de navegação: no celular a função
         sumia por nove meses), a condição virou constante FALSA — e com ela
         morreram as duas coisas que o dono tinha pedido: os blocos que
         "preenchem a tela" e O NÚMERO DELA dentro deles, que só é desenhado
         atrás de `preencherTela`. As três consultas ao banco continuavam
         saindo a cada visita e o resultado era jogado fora.

         Nada mais no app usa `preencherTela` — ele existe para esta grade. */
      preencherTela
      onAbrir={(k) => {
        const item = itens.find((i) => i.key === k);
        if (item) onAbrir(item.destino, item.subDestino);
      }}
    />
  );
}
