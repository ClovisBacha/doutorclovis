/**
 * O painel do médico QUANDO ELE ESTÁ NO APP.
 *
 * ─── O que esta tela é, e o que ela não é ───────────────────────────────
 *
 * O painel tem catorze abas e foi desenhado para uma tela de computador:
 * receituário, painéis de exame, cérebro, cadastro da clínica, financeiro.
 * Nada disso encolhe bem para 390px, e forçar não ajudaria ninguém — um
 * receituário digitado no celular entre duas consultas é receita errada.
 *
 * Então no app ele entra com um RESUMO: o que precisa dele agora, em números
 * grandes e tocáveis, e um caminho direto para as três abas onde ele
 * efetivamente age pelo telefone (responder paciente, confirmar horário,
 * abrir teleconsulta). O resto continua alcançável — nada é escondido —, mas
 * a tela deixa claro onde o trabalho a fundo se faz.
 *
 * ─── As duas coisas que ficam ditas, sempre ─────────────────────────────
 *
 * 1. **O plano se contrata no site.** Isso não pode ser um toast que aparece
 *    quando ele tenta assinar e some em cinco segundos: é regra de loja, e um
 *    médico que não a conhece vai procurar o botão, não achar, e concluir que
 *    o app está quebrado. Fica escrito, parado, onde ele lê antes de procurar.
 *
 * 2. **É a mesma conta do computador.** O painel não guarda nada no aparelho
 *    — nenhum `localStorage`, tudo vem do servidor. Então o que ele fizer aqui
 *    já está lá, e vice-versa. Dizer isso poupa a dúvida de "será que preciso
 *    sincronizar alguma coisa?", que é a primeira pergunta de quem usa o mesmo
 *    sistema em dois lugares.
 */
import { podeComprarAqui } from "@/lib/canal-de-venda";

export type ResumoDoDia = {
  /** SOS acionado e ainda não atendido. Vem antes de tudo. */
  sosAbertos: number;
  perguntasPendentes: number;
  agendamentosPendentes: number;
  preConsultasNovas: number;
  /**
   * Exames enviados e ainda não vistos.
   *
   * `undefined` quando o painel não carregou essa lista — e aí o cartão NÃO
   * aparece, em vez de mostrar "0". Zero falso é pior que ausência: ele diz ao
   * médico que não há nada esperando, e é exatamente por acreditar nisso que
   * ele não vai olhar.
   */
  examesNovos?: number;
  salasAbertas: number;
  proxima: { dateLabel: string; patientName: string } | null;
};

/** Um número grande e tocável. Zero não vira alerta — vira silêncio. */
function Contador({
  n,
  rotulo,
  onClick,
  urgente = false,
}: {
  n: number;
  rotulo: string;
  onClick: () => void;
  urgente?: boolean;
}) {
  const vazio = n === 0;
  return (
    <button
      onClick={onClick}
      disabled={vazio}
      aria-label={`${n} ${rotulo}`}
      className={`flex flex-col items-start rounded-2xl border p-3.5 text-left transition ${
        vazio
          ? "border-border bg-card opacity-55"
          : urgente
            ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-500/10"
            : "press border-primary/25 bg-primary/6"
      }`}
    >
      <span
        className={`font-serif text-3xl leading-none tabular-nums ${
          vazio ? "text-muted-foreground" : urgente ? "text-emerald-700" : "text-primary"
        }`}
      >
        {n}
      </span>
      <span className="mt-1 text-[12px] leading-tight text-muted-foreground">{rotulo}</span>
    </button>
  );
}

export function PainelNoApp({
  resumo,
  onIr,
  nomeDoMedico,
}: {
  resumo: ResumoDoDia;
  /** Leva para uma aba do painel. */
  onIr: (aba: string) => void;
  nomeDoMedico?: string | null;
}) {
  /* A frase vem de `canal-de-venda.ts` — a mesma regra que recusa o checkout
     no servidor. Texto e regra no mesmo lugar, senão divergem. */
  const veredito = podeComprarAqui("plano_medico", true);

  const nada =
    resumo.sosAbertos === 0 &&
    resumo.perguntasPendentes === 0 &&
    resumo.agendamentosPendentes === 0 &&
    resumo.preConsultasNovas === 0 &&
    (resumo.examesNovos ?? 0) === 0 &&
    resumo.salasAbertas === 0;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-primary">Resumo</p>
        <h2 className="mt-0.5 font-serif text-xl text-foreground">
          {nomeDoMedico ? `Olá, ${nomeDoMedico}` : "Seu dia"}
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          {nada
            ? "Nada esperando por você agora."
            : "O que está esperando por você. Toque para abrir."}
        </p>
      </div>

      {/* O SOS vem antes de tudo, e sozinho. Ele é a única coisa nesta tela
          que pode ser uma emergência, e emergência não divide espaço com
          contador de pré-consulta. */}
      {resumo.sosAbertos > 0 && (
        <button
          onClick={() => onIr("Pacientes 👩‍🍼")}
          className="press flex w-full items-center gap-3 rounded-2xl border-2 border-red-400 bg-red-50 p-4 text-left dark:bg-red-500/10"
        >
          <span className="text-2xl">🆘</span>
          <span className="min-w-0">
            <span className="block text-sm font-bold text-red-700 dark:text-red-300">
              {resumo.sosAbertos === 1
                ? "Uma paciente acionou o SOS"
                : `${resumo.sosAbertos} pacientes acionaram o SOS`}
            </span>
            <span className="block text-[12px] text-red-900/80 dark:text-red-200/80">
              Ainda sem atendimento — abra agora
            </span>
          </span>
        </button>
      )}

      {/* Sala aberta em seguida: é a única outra coisa com hora marcada. */}
      {resumo.salasAbertas > 0 && (
        <button
          onClick={() => onIr("Teleconsultas")}
          className="press flex w-full items-center gap-3 rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-left dark:bg-emerald-500/10"
        >
          <span className="text-2xl">🎥</span>
          <span className="min-w-0">
            <span className="block text-sm font-bold text-emerald-800 dark:text-emerald-300">
              {resumo.salasAbertas === 1
                ? "Uma sala de teleconsulta aberta"
                : `${resumo.salasAbertas} salas de teleconsulta abertas`}
            </span>
            <span className="block text-[12px] text-emerald-900/80 dark:text-emerald-200/80">
              A paciente já está esperando
            </span>
          </span>
        </button>
      )}

      <div className="grid grid-cols-2 gap-2.5">
        <Contador
          n={resumo.perguntasPendentes}
          rotulo="perguntas sem resposta"
          onClick={() => onIr("Perguntas")}
        />
        <Contador
          n={resumo.agendamentosPendentes}
          rotulo="horários a confirmar"
          onClick={() => onIr("Agendamentos")}
        />
        <Contador
          n={resumo.preConsultasNovas}
          rotulo="pré-consultas novas"
          onClick={() => onIr("Pré-consultas")}
        />
        {resumo.examesNovos !== undefined && (
          <Contador
            n={resumo.examesNovos}
            rotulo="exames enviados"
            onClick={() => onIr("Exames")}
          />
        )}
      </div>

      {resumo.proxima && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            Próxima consulta
          </p>
          <p className="mt-1 text-sm font-semibold text-foreground">{resumo.proxima.patientName}</p>
          <p className="text-[13px] text-muted-foreground">{resumo.proxima.dateLabel}</p>
        </div>
      )}

      {/* ── As duas explicações, paradas na tela ────────────────────────── */}
      <div className="rounded-2xl border border-border bg-secondary/40 p-4">
        <p className="text-sm font-semibold text-foreground">O trabalho a fundo é no computador</p>
        <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
          Receituário, painéis de exame, o cérebro da sua IA e o cadastro da clínica ficam melhores
          numa tela grande — e continuam todos aqui, nas abas abaixo, se você precisar.{" "}
          <strong className="text-foreground">É a mesma conta:</strong> o que você faz no computador
          já está aqui, e o que fizer aqui já está lá.
        </p>
      </div>

      {!veredito.pode && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 dark:bg-amber-500/10">
          <p className="text-sm font-bold text-amber-800 dark:text-amber-300">
            O plano se contrata no site
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-amber-900/85 dark:text-amber-200/85">
            {veredito.texto}
          </p>
        </div>
      )}
    </div>
  );
}
