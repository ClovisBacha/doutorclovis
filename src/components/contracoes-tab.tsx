/**
 * O CRONÔMETRO DE CONTRAÇÕES — e a tela clínica que ninguém conseguia olhar.
 *
 * Saiu de `minha-conta.tsx` (set/2026) por uma razão só: ela **não tinha
 * bancada**. Enquanto morava dentro do arquivo de ROTA não dava nem para
 * importá-la — exportar de uma rota põe o código no pedaço da árvore de rotas,
 * que TODA página do site carrega (`rotas-sem-export-solto`).
 *
 * E é a tela do app em que não olhar custa mais caro: é o cronômetro que a
 * paciente abre em trabalho de parto, e o banner de análise é o ÚNICO lugar
 * dela com "Ligar 192 (SAMU)". Um defeito aqui não aparece em teste — aparece
 * na noite em que ela precisa.
 *
 * ⚠️ O CORPO NÃO FOI TOCADO no move: cada linha é byte a byte a que estava em
 * produção, conferida por SHA-256. Um move que também "melhora" é uma
 * reescrita, e aí a mudança de comportamento se esconde num diff de 470 linhas.
 *
 * Bancada: `/preview-contracoes` — os estados que não se fabricam numa conta de
 * teste (a leitura instável que já silenciou o 192, o padrão de trabalho de
 * parto, a contração em curso).
 */
import { useEffect, useRef, useState } from "react";
import { History } from "lucide-react";
import { toast } from "sonner";

import { FitaDeContracoes } from "@/components/fita-de-contracoes";
import { supabase } from "@/integrations/supabase/client";
import { hapticTap } from "@/lib/haptics";
import { hapticoDeAviso } from "@/lib/nativo";
import { analyzeContractions } from "@/lib/analise-de-contracoes";
import {
  INTENSIDADE_PADRAO,
  NIVEIS_DE_INTENSIDADE,
  nivelDeIntensidade,
} from "@/lib/intensidade-da-contracao";
import { intervaloCurto, rotuloDoInstante } from "@/lib/hora-do-registro";
import {
  comPacote,
  ehLocal,
  gravarFila,
  lerFila,
  mesclar,
  PREFIXO_LOCAL,
  prontasParaSubir,
  semPacote,
  type ContracaoPendente,
} from "@/lib/fila-de-contracoes";
import { relogioDeSessao } from "@/lib/relogio-de-sessao";
import { manterTelaAcesa } from "@/lib/tela-acesa";

import type { Tab } from "@/routes/_authenticated/minha-conta";
import { tocarSomDeUI } from "@/lib/tocar-som-de-ui";

/* ---------- Contrações ---------- */

type Contraction = {
  id: string;
  started_at: string;
  ended_at: string | null;
  intensity: number;
};

/* ⚠️ O RÓTULO SAIU DAQUI para `lib/intensidade-da-contracao.ts`: ele tinha
   DOIS leitores que não concordavam — a tela dela dizia "Forte" e o prontuário
   imprimia "intensidade 3". A COR fica: ela é identidade desta tela (a escala
   laranja), não vocabulário clínico, e o médico não a vê. */
const INTENSITY_COLOR = [
  "",
  /* ⚠️ A escala inteira mora na família LARANJA, e o "forte" deixou de ser
     rosa de propósito: nesta tela o rosa/vermelho passou a querer dizer UMA
     coisa só — emergência (o 192, as bandeiras vermelhas, o apagar). Uma
     contração forte é intensa, não é emergência, e as duas cores disputando o
     olho é o que fazia o alerta de verdade valer menos. */
  "bg-orange-50 text-orange-800",
  "bg-orange-100 text-orange-900",
  "bg-orange-200 text-orange-950",
];

/**
 * ⚠️ `weeks` NÃO É DECORATIVO — ele era descartado, e isso custava caro.
 *
 * A função só olhava intervalo e duração médios. Uma paciente de 28 semanas com
 * contrações a cada 12 minutos lia "Padrão normal"; a cada 8, "Atenção — monitore
 * de perto". E `triage.ts` lista "Contrações regulares antes de 37 semanas" como
 * sintoma VERMELHO: a mesma paciente, respondendo a triagem, receberia "procure
 * atendimento agora". Duas telas do mesmo app dizendo coisas opostas sobre o
 * mesmo quadro — e a que ela abre com o cronômetro na mão era a que
 * tranquilizava.
 *
 * A régua nova mora em `sinais-clinicos.ts`, com as outras, porque CLAUDE.md é
 * explícito: nunca duplique um limite clínico fora daquele arquivo.
 */
export function ContracoesTab({
  weeks,
  onNavigate,
  bancada,
}: {
  weeks: number | null;
  /**
   * ⚠️ O caminho do MÉDICO DELA, e ele vem antes do 192 em todo estado que não
   * é emergência: a régua toda manda LIGAR, e ligar para quem a acompanha é a
   * primeira ligação. É a mesma prop que o contador de chutes já recebe.
   */
  onNavigate?: (t: Tab) => void;
  /**
   * Só a `/preview-contracoes`. ⚠️ Injeta o DADO nos MESMOS `useState` da
   * produção, nunca um desenho à parte — é a lição que este repositório já
   * pagou duas vezes (a bancada que passava props num formato diferente mediu
   * um app que não existe; a que cravava só o número mostrava um estado que o
   * app nunca produz).
   *
   * Sem ela, a única coisa fotografável desta tela seria a lista vazia: sem
   * sessão a leitura falha, e os estados que importam — o padrão de trabalho
   * de parto, a contração em curso, a leitura instável que já silenciou o
   * botão do 192 — não se fabricam numa conta de teste.
   */
  bancada?: {
    contractions: Contraction[];
    instavel?: boolean;
    /**
     * ⚠️ O "agora" da bancada, CRAVADO — e ele conserta um defeito que a
     * bancada tinha por construção: a janela de análise é relativa ao relógio,
     * e a âncora dos dados era uma data fixa. No dia em que a bancada foi
     * escrita as duas coincidiam; três dias depois a janela ficou VAZIA e o
     * banner de análise — que é o único lugar desta tela com o 192, e a razão
     * inteira de a bancada existir — parou de ser desenhado, em silêncio.
     */
    agora?: number;
  };
}) {
  /* `weeks` é lido de verdade agora — ver `analyzeContractions`. */
  const [contractions, setContractions] = useState<Contraction[]>(bancada?.contractions ?? []);
  const [active, setActive] = useState<Contraction | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [intensity, setIntensity] = useState(INTENSIDADE_PADRAO);
  const startRef = useRef<number>(0);
  /* ⚠️ A LEITURA FALHANDO SUPRIMIA O BOTÃO DO 192.
     `data ?? []` transformava erro de rede em "ela não cronometrou nada", e o
     banner de análise — que é o que mostra "Ligar 192 (SAMU)" no caso urgente
     — vive atrás de `analysisWindow.length >= 2`. Com a lista vazia ele
     simplesmente não renderiza: o alerta de emergência era silenciado por uma
     falha de rede, em trabalho de parto.
     E a contração ABERTA não era retomada: o cronômetro voltava para "Iniciar"
     com uma contração em curso no banco. */
  const [instavel, setInstavel] = useState(bancada?.instavel ?? false);
  /**
   * ⚠️ **O UID É LIDO UMA VEZ, DO DISCO.** `getSession()` não vai à rede, e é
   * isso que faz o cronômetro funcionar em modo avião: sem o id da conta não
   * há como recortar a fila deste aparelho. Ele é resolvido na montagem, e não
   * no toque — depois do `await` o gesto já passou, e este é o toque de alguém
   * com dor.
   */
  const [uid, setUid] = useState<string | null>(null);
  /** O que ainda não subiu. Espelha o `localStorage` para a tela repintar. */
  const [pendentes, setPendentes] = useState<ContracaoPendente[]>([]);
  /* Booleano, e nunca o objeto: um literal remontado a cada render faria os
     efeitos re-rodarem em toda pintura. */
  const ehBancada = !!bancada;

  /**
   * Sobe o que está na fila. Chamada ao encerrar, ao carregar e quando a rede
   * volta.
   *
   * ⚠️ **ELA CONFERE ANTES DE INSERIR A PARTIR DA SEGUNDA TENTATIVA.**
   * `contraction_logs` não tem chave única, então um `insert` que deu certo com
   * a resposta perdida no caminho viraria uma segunda contração no mesmo
   * instante — e duas contrações no mesmo minuto deslocam o INTERVALO, que é o
   * número que decide ir à maternidade. A chave natural é o `started_at`:
   * ninguém começa duas contrações no mesmo milissegundo.
   */
  async function sincronizar(idDaConta: string | null) {
    if (ehBancada || !idDaConta) return;
    const agora = Date.now();
    let fila = lerFila(idDaConta, agora);
    const prontas = prontasParaSubir(fila);
    if (!prontas.length) return;

    for (const pacote of prontas) {
      if (pacote.tentativas > 0) {
        const { data: jaEsta, error: erroConfere } = await (supabase as any)
          .from("contraction_logs")
          .select("id")
          .eq("started_at", pacote.started_at)
          .limit(1);
        /* ⚠️ Falha ao CONFERIR não insere: o risco de duplicar uma contração é
           maior que o de adiar a subida dela por um ciclo. */
        if (erroConfere) continue;
        if (jaEsta?.length) {
          fila = semPacote(fila, pacote.id);
          gravarFila(idDaConta, fila);
          setPendentes(fila);
          continue;
        }
      }
      const { error } = await (supabase as any).from("contraction_logs").insert({
        user_id: idDaConta,
        started_at: pacote.started_at,
        ended_at: pacote.ended_at,
        intensity: pacote.intensity,
      });
      if (error) {
        /* Continua na fila, com a tentativa marcada. Nada é dito à paciente:
           ela já viu a contração na lista, e o app não vai interromper uma
           noite de trabalho de parto para falar de sincronização. */
        fila = comPacote(fila, { ...pacote, tentativas: pacote.tentativas + 1 }, agora);
        gravarFila(idDaConta, fila);
        setPendentes(fila);
        continue;
      }
      fila = semPacote(fila, pacote.id);
      gravarFila(idDaConta, fila);
      setPendentes(fila);
    }
  }

  async function load() {
    const { data: s } = await supabase.auth.getSession();
    const idDaConta = s.session?.user?.id ?? null;
    setUid(idDaConta);

    const agora = Date.now();
    const fila = idDaConta ? lerFila(idDaConta, agora) : [];
    setPendentes(fila);
    /* ⚠️ **A CONTRAÇÃO EM CURSO É RETOMADA DA FILA, e não do banco.** Ela nasce
       local; o `started_at` que vale é o do aparelho onde o dedo tocou. */
    const abertaLocal = fila.find((c) => c.ended_at == null);
    if (abertaLocal) {
      setActive(abertaLocal as Contraction);
      startRef.current = new Date(abertaLocal.started_at).getTime();
      const nl = nivelDeIntensidade(abertaLocal.intensity);
      if (nl) setIntensity(nl.valor);
    }

    await sincronizar(idDaConta);

    const { data, error } = await (supabase as any)
      .from("contraction_logs")
      /* Só o que a tela lê: `select("*")` trazia `user_id`, `created_at` e
         `notes`, que ninguém desenha. */
      .select("id, started_at, ended_at, intensity")
      .order("started_at", { ascending: false })
      .limit(30);
    if (error || !data) {
      /* ⚠️ **A FALHA DE LEITURA JÁ NÃO APAGA O QUE ELA CRONOMETROU.** Antes
         `data ?? []` transformava erro de rede em "ela não cronometrou nada", e
         o banner de análise — o único lugar desta tela com "Ligar 192 (SAMU)" —
         some com a lista vazia. Agora o que está no aparelho continua na tela,
         e a análise continua rodando sobre ele. */
      setInstavel(true);
      const soLocais = idDaConta ? lerFila(idDaConta, agora) : [];
      setContractions(mesclar([], soLocais) as Contraction[]);
      return;
    }
    setInstavel(false);
    const aindaPendentes = idDaConta ? lerFila(idDaConta, Date.now()) : [];
    setPendentes(aindaPendentes);
    setContractions(mesclar(data as Contraction[], aindaPendentes) as Contraction[]);

    /* A aberta que restou no BANCO (de uma versão anterior do app, que gravava
       no começo) continua sendo retomada — senão ela ficaria para sempre sem
       `ended_at`. */
    const open = (data as Contraction[]).find((c) => !c.ended_at);
    if (open && !abertaLocal) {
      setActive(open);
      startRef.current = new Date(open.started_at).getTime();
      /* ⚠️ **A INTENSIDADE VOLTA COM ELA.** O seletor agora grava no ENCERRAR;
         sem retomar o valor do banco, uma contração restaurada (troca de aba,
         app fechado no meio, recarga) seria encerrada com o padrão por cima do
         que ela já tinha marcado — o app apagando a medida dela em silêncio. */
      const n = nivelDeIntensidade(open.intensity);
      if (n) setIntensity(n.valor);
    }
  }

  useEffect(() => {
    if (ehBancada) return;
    load();
  }, [ehBancada]);

  /* A contração ABERTA da bancada precisa da mesma âncora que `load()` põe:
     sem ela o cronômetro contaria a partir do zero absoluto. */
  useEffect(() => {
    if (!ehBancada) return;
    const aberta = (bancada?.contractions ?? []).find((c) => !c.ended_at);
    if (aberta) {
      setActive(aberta);
      startRef.current = new Date(aberta.started_at).getTime();
      const n = nivelDeIntensidade(aberta.intensity);
      if (n) setIntensity(n.valor);
    }
  }, [ehBancada, bancada]);

  /**
   * ⚠️ **QUANDO A REDE VOLTA, O QUE FICOU SOBE SOZINHO.**
   *
   * Sem este efeito a fila só esvaziaria no próximo encerrar ou na próxima
   * abertura da aba — e o caso real é ela cronometrar a noite inteira no
   * elevador do hospital e nunca mais abrir esta tela. O `online` do navegador
   * é o único aviso que existe de que a rede voltou.
   */
  useEffect(() => {
    if (ehBancada || !uid) return;
    const aoVoltar = () => void sincronizar(uid);
    window.addEventListener("online", aoVoltar);
    return () => window.removeEventListener("online", aoVoltar);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [ehBancada, uid]);

  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setElapsed(Date.now() - startRef.current), 1000);
    return () => clearInterval(t);
  }, [active]);

  /* ⚠️ TELA ACESA DURANTE A CONTRAÇÃO, e aqui a falta dói mais que na tela
     irmã: a tela apaga justamente porque ela NÃO toca no aparelho enquanto a
     dor passa, e aí ela precisa desbloquear o celular a cada contração — com o
     cronômetro correndo. `manterTelaAcesa` já existia e já era usada pelo
     contador de movimentos. */
  useEffect(() => {
    if (!active) return;
    return manterTelaAcesa();
  }, [active]);

  function startContraction() {
    /* ⚠️ O INSTANTE É O DO DEDO, e isto era um defeito de MEDIDA CLÍNICA.
       `ended_at` sempre foi carimbado aqui (`new Date()` dentro do `update`),
       e `started_at` caía no `DEFAULT now()` do banco — ou seja, no relógio do
       SERVIDOR, depois de `getUser()` e do insert. As duas pontas mediam em
       lugares diferentes: toda contração era gravada mais CURTA do que foi, e
       o INTERVALO entre elas — que é o dado que decide ir para a maternidade —
       saía deslocado pela latência. Num 4G ruim de hospital isso é segundos.
       Carimbar aqui põe as duas pontas no mesmo relógio: o dela. */
    const agora = Date.now();

    /* ⚠️ E O DEDO RECEBE RESPOSTA ANTES DE QUALQUER `await`. Ela está
       cronometrando DOR, de olhos fechados — é o caso de mão ocupada que o
       tique do FIM já documenta três linhas abaixo. O começo não tinha
       nenhum. */
    hapticTap();

    /**
     * ⚠️ **NADA DE REDE AQUI — e essa é a mudança.** A função era `async`,
     * fazia `insert` e ESPERAVA a resposta para o cronômetro partir. Duas
     * consequências, as duas medidas no desenho: sem rede a contração se
     * perdia com um toast (o carro a caminho da maternidade), e COM rede o
     * relógio só começava uma latência depois do toque.
     *
     * Agora ela nasce no aparelho e sobe quando FECHA — um ponto de falha só,
     * e depois do fim da dor.
     */
    const pacote: ContracaoPendente = {
      id: `${PREFIXO_LOCAL}${agora}-${Math.round(Math.random() * 1e6)}`,
      started_at: new Date(agora).toISOString(),
      ended_at: null,
      intensity,
      tentativas: 0,
    };
    if (uid) {
      const fila = comPacote(lerFila(uid, agora), pacote, agora);
      gravarFila(uid, fila);
      setPendentes(fila);
    }
    setActive(pacote as Contraction);
    setContractions((cs) => [pacote as Contraction, ...cs]);
    startRef.current = agora;
    /* ⚠️ MILISSEGUNDOS, como o laço de 1 s logo acima — aqui estava dividido
       por mil, então o cronômetro nascia zerado e só se corrigia um segundo
       depois. */
    setElapsed(0);
  }

  async function stopContraction() {
    if (!active) return;
    /* ⚠️ O TIQUE VEM ANTES DO `await`, como no começo: depois dele o gesto já
       passou. E ele existe porque o retorno que havia aqui era SÓ SOM — e
       `NIVEL_PADRAO` é "desligado", então para toda paciente que nunca ligou o
       som o retorno era ZERO; no iPhone no silencioso o Web Audio não toca de
       jeito nenhum. O botão que INICIA vibrava; o que ENCERRA — o que define
       `ended_at`, ou seja, a duração que decide o padrão — era mudo. */
    hapticTap();
    const fim = new Date().toISOString();
    const idAtivo = active.id;

    setActive(null);
    setElapsed(0);
    setContractions((cs) =>
      cs.map((c) => (c.id === idAtivo ? { ...c, ended_at: fim, intensity } : c)),
    );
    /**
     * ⚠️ O TIQUE DO FIM DA CONTRAÇÃO, e ele é o caso de mão ocupada.
     *
     * Ela está cronometrando DOR: olhar a tela para confirmar que o toque
     * pegou é exatamente o que ela menos consegue fazer nesse minuto. Um tique
     * de cinquenta milissegundos diz "marquei" sem pedir os olhos.
     *
     * `emSessao` porque o cronômetro É uma sessão que ela abriu.
     *
     * ⚠️ Sem `careMode` aqui: este componente não o recebe, e o cronômetro de
     * contrações é justamente uma tela que continua valendo no Modo Cuidado —
     * quem perdeu a gestação pode estar em trabalho de parto. `podeSoar` já
     * barra o resto; este som é sobre o corpo dela, não sobre o bebê.
     */
    tocarSomDeUI("intervalo", { emSessao: true });

    if (ehLocal(idAtivo)) {
      /* ⚠️ **A INTENSIDADE VAI JUNTO, e é isto que a torna uma medida.** O
         começo grava um palpite (ela ainda não sentiu esta); o que vale é o
         que ela marcou enquanto a dor passava. */
      if (uid) {
        const agora = Date.now();
        const daFila = lerFila(uid, agora).find((c) => c.id === idAtivo);
        if (daFila) {
          const fila = comPacote(
            lerFila(uid, agora),
            { ...daFila, ended_at: fim, intensity },
            agora,
          );
          gravarFila(uid, fila);
          setPendentes(fila);
        }
      }
      await sincronizar(uid);
      load();
      return;
    }

    /* A contração que nasceu no BANCO (versão anterior do app) continua sendo
       encerrada por `update`. */
    const { error } = await (supabase as any)
      .from("contraction_logs")
      .update({ ended_at: fim, intensity })
      .eq("id", idAtivo);
    if (error) {
      hapticoDeAviso("erro");
      toast.error("Não foi possível salvar a contração. Tente novamente.");
      return;
    }
    load();
  }

  /* ⚠️ A confirmação vive na TELA — ver `ApagarConversas`, que carrega a razão
     inteira: no app instalado o `window.confirm` abre com o nome do domínio, e
     a decisão do dono é confirmação em mensagem separada. */
  const [confirmandoLimpar, setConfirmandoLimpar] = useState(false);
  /** Qual linha está aberta para correção. `null` = nenhuma. */
  const [corrigindo, setCorrigindo] = useState<string | null>(null);

  /**
   * ⚠️ **CORRIGIR A INTENSIDADE DEPOIS — o caminho que não existia.**
   *
   * A intensidade passou a ser marcada durante a contração, mas ela está com
   * dor: errar o chip é o caso NORMAL, não a exceção. E o número vai para o
   * prontuário — uma "Forte" registrada por engano vira, do lado do médico,
   * uma noite mais grave do que foi.
   */
  async function corrigirIntensidade(id: string, valor: number) {
    hapticTap();
    /* Pintura otimista: ela está numa lista de dez e precisa VER que pegou.
       O recuo abaixo desfaz se o servidor recusar. */
    const antes = contractions;
    setContractions((cs) => cs.map((c) => (c.id === id ? { ...c, intensity: valor } : c)));
    /* ⚠️ **A PENDENTE É CORRIGIDA NO APARELHO.** Ela ainda não existe no banco:
       um `update` por id local não casaria linha nenhuma, devolveria
       `error: null` (o PostgREST responde 204 a um update que não casa nada) e
       a tela diria "corrigido" sobre coisa nenhuma — e o que subiria depois
       seria o valor velho. */
    if (ehLocal(id)) {
      if (uid) {
        const agora = Date.now();
        const daFila = lerFila(uid, agora).find((c) => c.id === id);
        if (daFila) {
          const fila = comPacote(lerFila(uid, agora), { ...daFila, intensity: valor }, agora);
          gravarFila(uid, fila);
          setPendentes(fila);
        }
      }
      setCorrigindo(null);
      return;
    }
    const { error } = await (supabase as any)
      .from("contraction_logs")
      .update({ intensity: valor })
      .eq("id", id);
    if (error) {
      /* ⚠️ **DESFAZ, e nunca "salvo" sobre o que não salvou.** É a régua que os
         marcos do bebê pagaram: `{ ok: false }` chega numa resposta 200 normal,
         então um `try/catch` não pega — é preciso LER o valor. */
      setContractions(antes);
      hapticoDeAviso("erro");
      toast.error("Não consegui corrigir agora. Tente de novo.");
      return;
    }
    setCorrigindo(null);
  }

  /**
   * ⚠️ **APAGAR UMA SÓ.** Antes o único caminho era apagar o histórico INTEIRO
   * — ou seja, para desfazer um toque sem querer ela tinha de destruir o
   * registro de todas as noites. A aba Saúde já tinha o × por linha desde
   * ago/2026, com a razão escrita: valor errado que não se pode apagar vira
   * alarme falso no consultório.
   */
  async function apagarContracao(id: string) {
    hapticTap();
    /* A que ainda não subiu sai só da fila — não há linha no banco para
       apagar, e um `delete` por id local não casaria nada. */
    if (ehLocal(id)) {
      if (uid) {
        const fila = semPacote(lerFila(uid, Date.now()), id);
        gravarFila(uid, fila);
        setPendentes(fila);
      }
      setContractions((cs) => cs.filter((c) => c.id !== id));
      setCorrigindo(null);
      if (active?.id === id) {
        setActive(null);
        setElapsed(0);
      }
      return;
    }
    const { error } = await (supabase as any).from("contraction_logs").delete().eq("id", id);
    if (error) {
      hapticoDeAviso("erro");
      toast.error("Não consegui apagar esta contração. Tente de novo.");
      return;
    }
    setCorrigindo(null);
    /* ⚠️ Se era a contração EM CURSO, o cronômetro para junto: sem isto ele
       continuaria correndo sobre uma linha que já não existe, e o encerrar
       gravaria num id apagado. */
    if (active?.id === id) {
      setActive(null);
      setElapsed(0);
    }
    load();
  }

  async function clearSession() {
    /* ⚠️ A CONFIRMAÇÃO SÓ FECHA NO SUCESSO. Ela fechava na primeira linha, e o
       `return` de logo abaixo era mudo: a caixa sumia, nada era apagado, e a
       leitura óbvia é "apaguei". */
    const { data: sessao } = await supabase.auth.getSession();
    /* Nome próprio: `uid` é o estado do componente, e sombreá-lo aqui faria a
       próxima pessoa achar que esta função usa outro id. */
    const idDaConta = sessao.session?.user?.id;
    if (!idDaConta) {
      toast.error("Não consegui confirmar o seu login. Recarregue o app e tente de novo.");
      return;
    }
    const { error } = await (supabase as any)
      .from("contraction_logs")
      .delete()
      .eq("user_id", idDaConta);
    if (error) {
      toast.error("Não foi possível limpar o histórico. Tente novamente.");
      return;
    }
    /* ⚠️ **A FILA VAI JUNTO.** Sem isto, "apagar o histórico" deixaria as
       pendentes no aparelho — e elas SUBIRIAM na sincronização seguinte,
       ressuscitando no banco justamente o que ela mandou apagar. */
    gravarFila(idDaConta, []);
    setPendentes([]);
    setActive(null);
    setConfirmandoLimpar(false);
    load();
  }

  /* ⚠️ O relógio é o MESMO das duas telas de cronômetro (`lib/`), e não uma
     cópia: com `mm:ss` cravado, a contração que ela esqueceu de parar — e que
     `load()` RETOMA do banco, ancorada no `started_at` — saía como "3502:18".
     Medido na bancada. */
  const relogio = relogioDeSessao(elapsed);
  const recentContractions = contractions.slice(0, 10);
  /* Análise e banner olham as contrações das últimas 2 horas, para um alerta
     não ficar preso a dados antigos. ⚠️ Sem `.slice(0, 10)`: a régua conta
     quantas começaram na última HORA, e cortar em dez truncaria justamente a
     contagem que decide o alerta de prematuridade. */
  const agora = bancada?.agora ?? Date.now();
  const ANALYSIS_WINDOW_MS = 2 * 3600000;
  const analysisWindow = contractions.filter(
    (c) => agora - new Date(c.started_at).getTime() < ANALYSIS_WINDOW_MS,
  );
  const analysis = analyzeContractions(analysisWindow, weeks, agora);

  const statusStyle: Record<string, string> = {
    normal: "border-emerald-200 bg-emerald-50 text-emerald-800",
    atencao: "border-orange-300 bg-orange-50 text-orange-950",
    alerta: "border-rose-200 bg-rose-50 text-rose-800",
    urgente: "border-rose-400 bg-rose-100 text-rose-900",
  };

  return (
    <div className="space-y-6">
      {/* ⚠️ O AVISO QUE SUBSTITUI O SILÊNCIO.
          Sem ele, a falha de leitura apagava o banner de análise — inclusive o
          caso `urgente`, que é o único lugar desta tela com o botão do SAMU. O
          app não pode INVENTAR uma análise que não tem; o que ele pode, e
          deve, é dizer que não conseguiu ler E dar o caminho que a análise
          daria. Errar para o lado de mandar ligar é o único lado seguro aqui. */}
      {instavel && (
        <div className="rounded-2xl border border-rose-300 bg-rose-50 p-4 text-rose-900">
          <p className="font-semibold">Não consegui carregar suas contrações agora</p>
          <p className="mt-0.5 text-sm">
            Isso é a nossa conexão — o que você já cronometrou continua salvo.{" "}
            <strong>
              Se as contrações estão regulares e fortes, não espere o app: ligue para o seu médico
              ou para o 192.
            </strong>
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() => void load()}
              className="min-h-11 rounded-full border border-rose-300 px-5 py-2 text-sm font-medium"
            >
              Tentar de novo
            </button>
            <a
              href="tel:192"
              className="inline-flex min-h-11 items-center rounded-full bg-rose-600 px-5 py-2 text-sm font-medium text-white"
            >
              Ligar 192 (SAMU)
            </a>
          </div>
        </div>
      )}

      {/* ⚠️ **O CRONÔMETRO É O PRIMEIRO BLOCO, E ISSO FOI MEDIDO.**

          Ele era o quinto. A 393×852 o botão caía em **y=876, 864 e 868** em
          três dos quatro estados fotografados — ou seja, FORA da dobra —, e na
          produção há ainda o cabeçalho da grade (`VoltarDaGrade`) acima desta
          aba, que empurra mais. A paciente abre esta tela em trabalho de parto
          para TOCAR, e precisava rolar para achar o botão.

          O que vinha antes dele: um aviso de uso que repetia o 192 (foi para o
          rodapé), a análise e as quatro bandeiras. A análise vem logo ABAIXO
          agora, e continua dentro da dobra — ela é vermelha e alta, e quem
          abriu para cronometrar encontra as duas coisas sem rolar. */}
      {/* Main button */}
      <div className="rounded-3xl card-material p-8 text-center">
        <p className="font-serif text-[15px] font-semibold text-orange-800">
          Cronômetro de contrações
        </p>

        {/* ⚠️ **O SELETOR NÃO SOME MAIS DURANTE A CONTRAÇÃO — e essa era a
            diferença entre uma PREVISÃO e uma MEDIDA.**

            Ele vivia atrás de `{!active && …}`: ela escolhia a intensidade
            ANTES de a contração começar, o seletor sumia enquanto ela
            acontecia, e o encerrar gravava só `ended_at`. Ou seja, o app
            registrava o que ela ACHAVA que a contração ia ser — e ninguém sabe
            a intensidade de uma dor que ainda não veio. É o oposto do que a
            tela irmã faz: no contador de movimentos a força é marcada DURANTE
            a sessão e gravada no fim.

            Agora ele fica, e o valor final vai no `update` do encerrar. O
            rótulo muda com o estado porque a pergunta muda: parada, ela
            escolhe por onde começar; em curso, ela está MEDINDO. */}
        <div className="mt-4">
          <p className="text-xs text-muted-foreground">
            {active ? "Como está sendo esta?" : "Como costumam estar?"}
          </p>
          <div className="mt-2 flex justify-center gap-2">
            {NIVEIS_DE_INTENSIDADE.map((n) => (
              <button
                key={n.valor}
                onClick={() => {
                  /* ⚠️ O dedo recebe resposta aqui também: ela está com dor e
                     de olhos fechados, e este toque acontece no meio dela. */
                  hapticTap();
                  setIntensity(n.valor);
                }}
                className={`press min-h-11 rounded-full border px-4 text-sm font-medium transition-colors ${
                  intensity === n.valor
                    ? "border-orange-700 bg-orange-700 text-white"
                    : "border-border text-muted-foreground hover:border-orange-400"
                }`}
              >
                {n.rotulo}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6">
          {active ? (
            <div>
              <button
                onClick={stopContraction}
                className="liquid-pulse mx-auto flex h-44 w-44 items-center justify-center rounded-full text-white shadow-xl transition-transform duration-300 active:scale-95"
                style={{
                  /* ⚠️ Laranja FUNDO, e medido: branco sobre `#c2410c` dá
                     4,8:1 e sobre `#7c2d12`, 8,9:1 — os dois passam. A versão
                     rosa (`#fb7185`) media 2,3 no ponto claro do gradiente, e
                     o número do cronômetro era o texto menos legível da tela. */
                  background: "radial-gradient(circle at 30% 25%, #c2410c, #7c2d12 70%)",
                }}
              >
                <div>
                  <div className="font-serif text-4xl">{relogio}</div>
                  <div className="text-xs uppercase tracking-widest opacity-80 mt-1">
                    Toque p/ parar
                  </div>
                </div>
              </button>
              <p className="mt-3 text-sm font-medium text-orange-800 animate-pulse">
                Contração ativa…
              </p>
            </div>
          ) : (
            <button
              onClick={startContraction}
              className="liquid-pulse mx-auto flex h-44 w-44 items-center justify-center rounded-full text-white shadow-xl transition-transform duration-300 active:scale-95 hover:scale-[1.03]"
              style={{
                /* ⚠️ Mais claro que o de PARAR, e é assim que um olhar diz em
                   qual estado a tela está sem ler uma palavra. Os dois tons
                   passam com branco: `#ea580c` dá 4,6:1. */
                background: "radial-gradient(circle at 30% 25%, #ea580c, #9a3412 70%)",
              }}
            >
              <div>
                <div className="text-lg font-medium">Iniciar</div>
                <div className="text-xs uppercase tracking-widest opacity-80 mt-1">contração</div>
              </div>
            </button>
          )}
        </div>
      </div>

      {/* ⚠️ O BANNER NÃO ESPERA MAIS DUAS CONTRAÇÕES.
          Ele vivia atrás de `analysisWindow.length >= 2`, e antes do termo é
          justamente com ZERO contrações registradas que a tela precisa dizer a
          única coisa que a ACOG diz para essa faixa: não espere fechar um
          padrão, ligue. A régua devolve o texto certo para cada fase, inclusive
          com a lista vazia. */}
      {/* ⚠️ **A ANÁLISE CONTINUA ESCONDIDA QUANDO A LEITURA FALHA — e agora isso
          precisa ser dito, porque a lista deixou de sumir junto.**

          Com a fila local, o que ela cronometrou neste aparelho continua na
          tela mesmo sem rede. A tentação é rodar a régua sobre isso; seria
          errado: faltam as contrações que estão no SERVIDOR, e uma análise
          parcial pode devolver "ainda espaçadas" para quem tem doze na última
          hora. Falsa tranquilização é o único desfecho que esta tela não pode
          ter — por isso o que aparece no lugar é o aviso com o caminho de
          ligar. */}
      {!instavel && (
        <div className={`rounded-2xl border p-4 ${statusStyle[analysis.status]}`}>
          <p className="font-semibold">{analysis.label}</p>
          <p className="mt-0.5 text-sm">{analysis.detail}</p>
          {/* ⚠️ **O TERCEIRO EIXO DA ACOG, e ele era coletado e nunca lido.**
              A intensidade ia para o banco a cada contração e virava altura na
              fita; sete "Forte" numa hora produziam exatamente o mesmo texto
              que sete "Leve". `tendenciaDaIntensidade` é FATO, nunca limiar —
              ela não muda o status, e não existe a frase inversa. */}
          {analysis.notaDaIntensidade && (
            <p className="mt-1.5 text-sm font-medium">{analysis.notaDaIntensidade}</p>
          )}
          {/* ⚠️ **O CAMINHO DO MÉDICO APARECE SEMPRE QUE A ANÁLISE NÃO É
              "NORMAL" — e isto conserta um buraco medido.** Ele vivia atrás de
              `urgente || alerta`, e o ramo de PRÉ-TERMO devolve sempre
              `atencao`: a paciente lia "não espere fechar um padrão, ligue para
              o seu médico" e não havia, na tela inteira, um telefone tocável.

              ⚠️ E os dois botões NÃO são a mesma coisa: "falar com o meu
              médico" é o verbo da régua e vale em toda faixa; o **192 continua
              exclusivo do `urgente`**, porque um botão de emergência em toda
              pintura ensina a ignorá-lo. */}
          {analysis.status !== "normal" && (
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onNavigate?.("Consultas")}
                className="press inline-flex h-11 items-center rounded-full bg-orange-700 px-4 font-semibold text-white"
              >
                Falar com o meu médico
              </button>
              {analysis.status === "urgente" && (
                <a
                  href="tel:192"
                  className="press inline-flex h-11 items-center rounded-full border border-rose-300 bg-white px-4 font-semibold text-rose-800"
                >
                  Ligar 192 (SAMU)
                </a>
              )}
            </div>
          )}
        </div>
      )}

      {/* ⚠️ A FITA VEM DEPOIS DO BOTÃO E ANTES DA LISTA. Antes do botão ela
          empurraria o cronômetro para fora da dobra — e o cronômetro é o que
          ela abriu a tela para tocar; depois da lista, ninguém rola até ela. */}
      {!instavel && (
        <FitaDeContracoes
          contracoes={analysisWindow}
          agora={agora}
          sustentadoMin={analysis.sustentadoMin}
        />
      )}

      {/* ⚠️ AS QUATRO BANDEIRAS VERMELHAS FICAM À VISTA, SEMPRE.
          Elas são a régua de IR AO HOSPITAL da ACOG, e NENHUMA delas depende do
          cronômetro: "Your water has broken and you are not having
          contractions. You are bleeding heavily from the vagina. You have
          constant, severe pain with no relief between contractions. You notice
          the fetus is moving less often."

          Um cronômetro que só fala de intervalo ensina a paciente a esperar o
          padrão fechar enquanto sangra. Por isso elas não moram atrás de um
          link nem de um acordeão: moram na tela, acima do histórico, em todo
          estado — inclusive quando a análise diz que as contrações estão
          espaçadas. */}
      <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-4 text-rose-900">
        <p className="text-sm font-semibold">Procure a maternidade agora se:</p>
        <ul className="mt-1 space-y-0.5 text-sm">
          <li>· a bolsa rompeu, mesmo sem contração nenhuma;</li>
          <li>· houver sangramento vermelho-vivo;</li>
          <li>· a dor for constante e forte, sem alívio entre as contrações;</li>
          <li>· o bebê estiver se mexendo menos que o normal dele.</li>
        </ul>
        <p className="mt-2 text-sm">
          Nenhuma delas depende do cronômetro — não espere fechar um padrão.
        </p>
        {/* ⚠️ **O BLOCO QUE MANDA PROCURAR A MATERNIDADE PASSOU A TER O
            TELEFONE.** Ele era texto puro: ela lia "procure a maternidade
            agora se a bolsa rompeu" e não havia, nesta caixa, nada tocável. As
            quatro bandeiras NÃO dependem do cronômetro — então o caminho delas
            não pode depender do estado da análise, que é onde o 192 vivia
            (só no `urgente`).

            ⚠️ E aqui é o **192**, e não "falar com o meu médico": estas quatro
            são a régua de IR AO HOSPITAL da ACOG, e o consultório é a ligação
            do outro bloco. Dois botões com o mesmo rótulo e destinos
            diferentes é o defeito que o contador de movimentos já pagou. */}
        <a
          href="tel:192"
          className="press mt-3 inline-flex h-11 items-center rounded-full border border-rose-300 bg-white px-4 font-semibold text-rose-800"
        >
          Ligar 192 (SAMU)
        </a>
      </div>

      {/* History table */}
      {recentContractions.length > 0 && (
        <div className="rounded-3xl card-material p-6">
          <div className="flex items-center justify-between">
            <p className="font-serif text-[15px] font-semibold text-muted-foreground">
              Últimas contrações
            </p>
            {/* ⚠️ **O RÓTULO DIZIA "Limpar sessão" E A AÇÃO APAGAVA TUDO.**
                `clearSession` faz `delete().eq("user_id", …)`: não é a sessão
                de hoje, é o histórico INTEIRO — e ele é dado clínico, que o
                médico vê na linha do tempo dela. A confirmação já dizia a
                verdade; o botão que levava até ela, não, e quem lê "limpar
                sessão" toca sem esperar consequência. */}
            <button
              onClick={() => setConfirmandoLimpar(true)}
              className="press min-h-11 px-1 text-xs text-muted-foreground hover:text-destructive"
            >
              Apagar histórico
            </button>
          </div>
          {confirmandoLimpar && (
            <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50/60 p-3">
              <p className="text-[13px] leading-snug text-rose-900">
                Apagar todo o histórico de contrações? Isto não tem volta — e é ele que o seu médico
                vê.
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={clearSession}
                  className="press min-h-11 flex-1 rounded-full bg-rose-600 px-4 text-sm font-semibold text-white"
                >
                  Sim, apagar
                </button>
                <button
                  onClick={() => setConfirmandoLimpar(false)}
                  className="press min-h-11 flex-1 rounded-full border border-border px-4 text-sm font-medium"
                >
                  Não
                </button>
              </div>
            </div>
          )}
          <div className="mt-3 space-y-2">
            {recentContractions.map((c, idx) => {
              const dur = c.ended_at
                ? Math.round(
                    (new Date(c.ended_at).getTime() - new Date(c.started_at).getTime()) / 1000,
                  )
                : null;
              const interval =
                idx < recentContractions.length - 1
                  ? Math.round(
                      (new Date(c.started_at).getTime() -
                        new Date(recentContractions[idx + 1].started_at).getTime()) /
                        60000,
                    )
                  : null;
              const nivel = nivelDeIntensidade(c.intensity);
              const aberta = corrigindo === c.id;
              return (
                <div key={c.id} className="rounded-xl card-material">
                  {/* ⚠️ **A LINHA INTEIRA É O ALVO, e não um ✕ na ponta.**
                      Medido no chá de bebê: um ✕ de canto com `-my-2` encavala
                      a caixa do botão com a da linha de baixo, e o toque 10px
                      abaixo do centro apaga o item ERRADO. Numa lista que
                      apaga dado clínico isso é inaceitável. A linha toda tem
                      48px de altura e abre a correção daquela contração. */}
                  <button
                    type="button"
                    onClick={() => {
                      hapticTap();
                      setCorrigindo(aberta ? null : c.id);
                    }}
                    aria-expanded={aberta}
                    className="press flex min-h-12 w-full items-center gap-2 p-3 text-left text-sm"
                  >
                    {/* ⚠️ **TRÊS COLUNAS DE LARGURA FIXA, e não
                        `justify-between`.** Medido a 393px: com o layout
                        anterior a pastilha andava conforme a PALAVRA (Leve
                        x=126, Forte x=129, Moderada x=110) e a última linha —
                        a única sem intervalo — jogava a pastilha para x=180 e
                        o valor para a borda. Em dez linhas, nenhuma coluna
                        alinhava com a de cima. */}
                    <span className="w-[72px] shrink-0 tabular-nums text-muted-foreground">
                      {/* ⚠️ A hora sozinha numa lista de dez, que atravessa
                          episódios de dias diferentes, AFIRMA que foi hoje. */}
                      {rotuloDoInstante(c.started_at, agora)}
                    </span>
                    <span className="w-[84px] shrink-0">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs ${
                          INTENSITY_COLOR[c.intensity] ?? ""
                        }`}
                      >
                        {nivel?.chip ?? "—"}
                      </span>
                    </span>
                    <span className="flex-1 text-right tabular-nums text-muted-foreground">
                      {dur != null ? `${dur}s` : "ativa"}
                      {interval != null && ` · ${intervaloCurto(interval)}`}
                    </span>
                  </button>

                  {/* ⚠️ **CORRIGIR E APAGAR UMA SÓ — o caminho que não
                      existia.** O único jeito de desfazer um toque sem querer
                      era apagar o histórico inteiro, e não havia NENHUM de
                      corrigir a intensidade depois. Quem digitou errado no
                      contador de pressão já podia apagar a linha desde
                      ago/2026 (a razão está na aba Saúde: valor errado que não
                      se pode apagar vira alarme falso no consultório); aqui
                      não. */}
                  {aberta && (
                    <div className="border-t border-border/60 p-3">
                      <p className="text-xs text-muted-foreground">Como foi esta contração?</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {NIVEIS_DE_INTENSIDADE.map((n) => (
                          <button
                            key={n.valor}
                            onClick={() => void corrigirIntensidade(c.id, n.valor)}
                            className={`press min-h-11 rounded-full border px-4 text-sm font-medium ${
                              c.intensity === n.valor
                                ? "border-orange-700 bg-orange-700 text-white"
                                : "border-border text-muted-foreground"
                            }`}
                          >
                            {n.rotulo}
                          </button>
                        ))}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          onClick={() => void apagarContracao(c.id)}
                          className="press min-h-11 rounded-full border border-rose-300 px-4 text-sm font-medium text-rose-800"
                        >
                          Apagar esta
                        </button>
                        <button
                          onClick={() => setCorrigindo(null)}
                          className="press min-h-11 rounded-full border border-border px-4 text-sm font-medium"
                        >
                          Fechar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
      {/* ⚠️ **O AVISO DE USO DESCEU PARA O PÉ.** Ele era o PRIMEIRO bloco da
          tela e repetia duas coisas que já existem tocáveis mais acima — "em
          dúvida ligue para o consultório" (o botão da análise) e o 192 (o botão
          das bandeiras). Uma instrução de uso não disputa a dobra com o botão
          que ela veio apertar; quem chega aqui embaixo é quem está lendo, não
          quem está com dor. */}
      <p className="px-1 text-xs text-muted-foreground">
        Use este diário se sentir contrações regulares. Ele guarda o que você marcar e mostra ao seu
        médico.
      </p>
    </div>
  );
}
