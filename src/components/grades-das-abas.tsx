/**
 * AS QUATRO GRADES DE SUB-TELAS — Bem-estar, Meu dia a dia, Bebê e Consultas.
 *
 * ⚠️ **ESTE ARQUIVO NASCEU DE UM MOVE, e nada do corpo foi tocado.** As quatro
 * tabelas eram `export const` dentro de `minha-conta.tsx`, um arquivo de ROTA —
 * e export não-rota num arquivo de rota sai do pedaço daquela rota e entra no
 * pedaço da ÁRVORE DE ROTAS, que toda página do site carrega antes de qualquer
 * coisa aparecer. Medido no bundle antes do corte: `preview-grades` importava
 * as quatro de `index-*.js`, o pedaço de ENTRADA. Com elas aqui, saem junto do
 * grafo estático da rota **vinte e duas artes `.webp` e dezoito ícones**.
 *
 * ⚠️ **`ARTE_GRADE` E `ARTE_BEBE` VIERAM JUNTO, E A ORDEM É OBRIGATÓRIA.**
 * `const` de módulo NÃO é içado: declarado depois da primeira grade que o lê, o
 * módulo inteiro estoura na avaliação ("antes de inicializar") e TODA página do
 * app responde 500 — medido, e é por isso que o comentário original do
 * `ARTE_GRADE` já dizia "mora antes da primeira grade que o lê". Cada mapa
 * continua antes das tabelas que o consomem.
 *
 * ⚠️ **A régua do LUTO não mora aqui.** Quem recorta a grade do Bebê é
 * `src/lib/subtabs-do-bebe.ts`, que RECEBE a lista por parâmetro — e o
 * comentário dela explica por quê: importá-la de um arquivo de rota faria um
 * teste morrer na primeira linha. Estas tabelas são DADO, e nada mais.
 */

import {
  AudioLines,
  Baby,
  CalendarCheck,
  ClipboardList,
  Flower2,
  Footprints,
  HeartHandshake,
  History,
  Images,
  ListChecks,
  Mail,
  MessageCircleQuestion,
  NotebookPen,
  PersonStanding,
  Scroll,
  ShoppingBag,
  Smile,
  Sparkles,
  Timer,
  Video,
  Wallet,
} from "lucide-react";
import icChutes from "@/assets/saude/chutes.webp";
import icContracoes from "@/assets/saude/contracoes.webp";
import arteGrade_agenda from "@/assets/grades/agenda.webp";
import arteGrade_preparo from "@/assets/grades/preparo.webp";
import arteGrade_perguntas from "@/assets/grades/perguntas.webp";
import arteGrade_checklist from "@/assets/grades/checklist.webp";
import arteGrade_parto from "@/assets/grades/parto.webp";
import arteGrade_tele from "@/assets/grades/tele.webp";
import arteGrade_particular from "@/assets/grades/particular.webp";
import arteGrade_meditacoes from "@/assets/grades/meditacoes.webp";
import arteGrade_sons from "@/assets/grades/sons.webp";
import arteGrade_exercicios from "@/assets/grades/exercicios.webp";
import arteGrade_humor from "@/assets/grades/humor.webp";
import arteGrade_apoio from "@/assets/grades/apoio.webp";
import arteGrade_diario from "@/assets/grades/diario.webp";
import arteGrade_timeline from "@/assets/grades/timeline.webp";
import arteBebe_semana from "@/assets/bebe/semana.webp";
import arteBebe_contagem from "@/assets/bebe/contagem.webp";
import arteBebe_album from "@/assets/bebe/album.webp";
import arteBebe_nome from "@/assets/bebe/nome.webp";
import arteBebe_carta from "@/assets/bebe/carta.webp";
import arteBebe_quartinho from "@/assets/bebe/quartinho.webp";

/**
 * A peça 3D de cada quadrado das três grades — `GradeHub` a desenha no lugar
 * do traço no círculo. Chutes e Contrações REUSAM a arte da Saúde: são o mesmo
 * destino (o hub da Saúde abre `Registros` já na sub-tela certa), e duas artes
 * para a mesma coisa ensinariam que são coisas diferentes.
 *
 * ⚠️ MORA ANTES DA PRIMEIRA GRADE que o lê. `const` de módulo não é içado:
 * declarado depois de `BEMESTAR_SUBTABS`, o módulo inteiro estourava no SSR
 * ("antes de inicializar") e TODA página do app respondia 500 — medido.
 */
const ARTE_GRADE = {
  agenda: arteGrade_agenda,
  preparo: arteGrade_preparo,
  perguntas: arteGrade_perguntas,
  checklist: arteGrade_checklist,
  parto: arteGrade_parto,
  tele: arteGrade_tele,
  particular: arteGrade_particular,
  meditacoes: arteGrade_meditacoes,
  sons: arteGrade_sons,
  exercicios: arteGrade_exercicios,
  humor: arteGrade_humor,
  apoio: arteGrade_apoio,
  diario: arteGrade_diario,
  timeline: arteGrade_timeline,
  chutes: icChutes,
  contracoes: icContracoes,
} as const;

/**
 * Hub "Bem-estar": autocuidado numa tela só (sub-abas) — Meditações, Sons,
 * Exercícios, Humor e Apoio Emocional. Antes eram 5 abas.
 */
export const BEMESTAR_SUBTABS = [
  {
    key: "meditacoes",
    label: "Meditações",
    sub: "Meditar com voz e som",
    Icon: Flower2,
    imagem: ARTE_GRADE.meditacoes,
    caixa: "border-violet-200/70 from-violet-50 to-fuchsia-50/60",
    tinta: "text-violet-600",
  },
  /*
    ⚠️ **ESTE LADRILHO ENTREGAVA OUTRO RECURSO — e um que faz o CONTRÁRIO do
    que ele promete.**

    Ele dizia "Sons · Relaxar e dormir" e abria `SonsBebêTab`, que são cinco
    sons feitos em **Web Audio** — e o iOS SUSPENDE o `AudioContext` quando o
    aparelho bloqueia. Ou seja: o ladrilho de dormir abria um tocador que para
    no segundo em que ela apoia o celular na mesa de cabeceira. É literalmente
    o defeito que `sons-para-dormir.tsx` foi escrito para evitar, e o
    comentário de lá diz isso com todas as letras.

    E o `mapa-do-app` promete, para `tab: "Bem-estar", sub: "sons"`, "Chuva,
    mar, ventre e mais trinta — **tocam com a tela apagada**". O tocador que
    cumpre isso (WAV + `<audio loop>`, sobrevive à tela apagada, com card na
    tela de bloqueio) existia e só era alcançável DENTRO da aba Jogo.

    Agora são dois ladrilhos, cada um dizendo o que entrega.
  */
  {
    key: "sons",
    label: "Sons para dormir",
    sub: "Chuva, mar e mais 30 — com a tela apagada",
    Icon: AudioLines,
    imagem: ARTE_GRADE.sons,
    caixa: "border-sky-200/70 from-sky-50 to-blue-50/60",
    tinta: "text-sky-600",
  },
  {
    key: "sons-bebe",
    label: "Sons para o bebê",
    sub: "O que ele escuta daí de dentro",
    Icon: Baby,
    imagem: ARTE_GRADE.sons,
    caixa: "border-indigo-200/70 from-indigo-50 to-violet-50/60",
    tinta: "text-indigo-600",
  },
  {
    key: "exercicios",
    label: "Exercícios",
    sub: "Movimentos leves",
    Icon: PersonStanding,
    imagem: ARTE_GRADE.exercicios,
    caixa: "border-emerald-200/70 from-emerald-50 to-teal-50/60",
    tinta: "text-emerald-600",
  },
  {
    key: "humor",
    label: "Humor",
    sub: "Como você está hoje",
    Icon: Smile,
    imagem: ARTE_GRADE.humor,
    caixa: "border-amber-200/70 from-amber-50 to-yellow-50/60",
    tinta: "text-amber-600",
  },
  {
    key: "apoio",
    label: "Apoio emocional",
    sub: "Quando o peso é grande",
    Icon: HeartHandshake,
    imagem: ARTE_GRADE.apoio,
    caixa: "border-rose-200/70 from-rose-50 to-pink-50/60",
    tinta: "text-rose-600",
  },
] as const;

/**
 * Hub "Registros": tudo que a paciente registra numa tela só (sub-abas) —
 * Diário, Chutes, Contrações e Linha do Tempo. Antes eram 4 abas.
 */
export const REGISTROS_SUBTABS = [
  {
    key: "diario",
    label: "Diário",
    sub: "Escrever sobre o dia",
    Icon: NotebookPen,
    imagem: ARTE_GRADE.diario,
    caixa: "border-amber-200/70 from-amber-50 to-orange-50/60",
    tinta: "text-amber-600",
  },
  {
    /* ⚠️ Chutes e Contrações têm a MESMA família (cor e arte) que no hub da
       Saúde: são o mesmo destino por duas portas, e quem toca no bloco azul
       de Chutes na Saúde tem de chegar numa tela azul — não numa rosa. */
    key: "chutes",
    label: "Chutes",
    sub: "Contar os movimentos",
    Icon: Footprints,
    imagem: ARTE_GRADE.chutes,
    caixa: "border-sky-200/70 from-sky-50 to-cyan-50/60",
    tinta: "text-sky-600",
  },
  {
    key: "contracoes",
    label: "Contrações",
    sub: "Cronometrar e ver o padrão",
    Icon: Timer,
    imagem: ARTE_GRADE.contracoes,
    caixa: "border-orange-200/70 from-orange-50 to-amber-50/60",
    tinta: "text-orange-600",
  },
  {
    key: "timeline",
    label: "Linha do tempo",
    sub: "Tudo que já aconteceu",
    Icon: History,
    imagem: ARTE_GRADE.timeline,
    caixa: "border-sky-200/70 from-sky-50 to-cyan-50/60",
    tinta: "text-sky-600",
  },
] as const;

/** A peça 3D de cada quadrado da aba Bebê — `GradeHub` a desenha no lugar do Lucide. */
const ARTE_BEBE = {
  semana: arteBebe_semana,
  contagem: arteBebe_contagem,
  album: arteBebe_album,
  nome: arteBebe_nome,
  carta: arteBebe_carta,
  quartinho: arteBebe_quartinho,
} as const;

export const BEBE_SUBTABS = [
  {
    key: "semana",
    label: "Semana",
    sub: "O que mudou agora",
    Icon: Baby,
    imagem: ARTE_BEBE.semana,
    caixa: "border-pink-200/70 from-pink-50 to-rose-50/60",
    tinta: "text-pink-600",
  },
  {
    key: "contagem",
    label: "Contagem",
    sub: "Quanto falta",
    Icon: Timer,
    imagem: ARTE_BEBE.contagem,
    caixa: "border-violet-200/70 from-violet-50 to-fuchsia-50/60",
    tinta: "text-violet-600",
  },
  {
    key: "album",
    label: "Álbum",
    sub: "As fotos da barriga",
    Icon: Images,
    imagem: ARTE_BEBE.album,
    caixa: "border-sky-200/70 from-sky-50 to-blue-50/60",
    tinta: "text-sky-600",
  },
  {
    key: "nome",
    label: "Nomes",
    sub: "Escolher e votar",
    Icon: Sparkles,
    imagem: ARTE_BEBE.nome,
    caixa: "border-amber-200/70 from-amber-50 to-yellow-50/60",
    tinta: "text-amber-600",
  },
  {
    key: "carta",
    label: "Carta",
    sub: "Escrever para o bebê",
    Icon: Mail,
    imagem: ARTE_BEBE.carta,
    caixa: "border-rose-200/70 from-rose-50 to-orange-50/60",
    tinta: "text-rose-600",
  },
  {
    key: "quartinho",
    label: "Enxoval",
    sub: "A lista do quartinho",
    Icon: ShoppingBag,
    imagem: ARTE_BEBE.quartinho,
    caixa: "border-emerald-200/70 from-emerald-50 to-teal-50/60",
    tinta: "text-emerald-600",
  },
] as const;

export const CONSULTAS_SUBTABS = [
  {
    key: "agenda",
    label: "Agenda",
    sub: "Marcar e remarcar",
    Icon: CalendarCheck,
    imagem: ARTE_GRADE.agenda,
    caixa: "border-sky-200/70 from-sky-50 to-blue-50/60",
    tinta: "text-sky-600",
  },
  {
    key: "preparo",
    label: "Preparar",
    sub: "O que levar e contar",
    Icon: ClipboardList,
    imagem: ARTE_GRADE.preparo,
    caixa: "border-violet-200/70 from-violet-50 to-fuchsia-50/60",
    tinta: "text-violet-600",
  },
  {
    key: "perguntas",
    label: "Perguntas",
    sub: "Anote para a consulta",
    Icon: MessageCircleQuestion,
    imagem: ARTE_GRADE.perguntas,
    caixa: "border-amber-200/70 from-amber-50 to-yellow-50/60",
    tinta: "text-amber-600",
  },
  {
    key: "checklist",
    label: "Checklist",
    sub: "A mala da maternidade",
    Icon: ListChecks,
    imagem: ARTE_GRADE.checklist,
    caixa: "border-emerald-200/70 from-emerald-50 to-teal-50/60",
    tinta: "text-emerald-600",
  },
  {
    key: "parto",
    label: "Plano de parto",
    sub: "Suas preferências",
    Icon: Scroll,
    imagem: ARTE_GRADE.parto,
    caixa: "border-pink-200/70 from-pink-50 to-rose-50/60",
    tinta: "text-pink-600",
  },
  {
    key: "tele",
    label: "Teleconsulta",
    sub: "Consulta por vídeo",
    Icon: Video,
    imagem: ARTE_GRADE.tele,
    caixa: "border-indigo-200/70 from-indigo-50 to-violet-50/60",
    tinta: "text-indigo-600",
  },
  {
    key: "particular",
    label: "Particular",
    sub: "Particular e pagamento",
    Icon: Wallet,
    imagem: ARTE_GRADE.particular,
    caixa: "border-teal-200/70 from-teal-50 to-emerald-50/60",
    tinta: "text-teal-600",
  },
] as const;
