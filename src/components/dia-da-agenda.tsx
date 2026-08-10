import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  CORES_DO_TIPO,
  diaLocal,
  faixaHoraria,
  horaDosMinutos,
  minutosDesdeMeiaNoite,
  resumoDoDia,
  validarNovaConsulta,
  type EventoDaAgenda,
  type NovaConsulta,
} from "@/lib/agenda-unificada";

/**
 * O DIA ABERTO — tela grande, com o que tem e com o que ele quer marcar.
 *
 * ─── O QUE ISTO SUBSTITUI ───────────────────────────────────────────────────
 *
 * O calendário mostrava o dia numa faixa embaixo da grade: três linhas de
 * leitura e nada mais. Para marcar uma consulta o médico saía do calendário,
 * ia para outra aba, e lá a consulta nascia de um pedido da paciente — o
 * caminho inverso, o de ele combinar por telefone e lançar na agenda, não
 * existia. Ele via o mês e não podia escrever nele.
 *
 * Pedido do dono (ago/2026): "quando eu clico num dia vai abrir uma opção pra
 * eu já acrescentar o que eu quero, e se possível ali dentro eu já consigo
 * enviar pra pessoa o link naquele determinado dia".
 *
 * ─── AS CINCO DECISÕES ──────────────────────────────────────────────────────
 *
 * **A paciente pode não ter conta.** O campo de e-mail é livre e a lista de
 * pacientes vinculadas é um atalho que o preenche. É o consultório fazendo a
 * intermediação — e `appointment_requests` sempre guardou `patient_email`,
 * então isso não força cadastro nenhum.
 *
 * **Teleconsulta é a exceção, e ela é dita.** A sala de vídeo pendura na conta
 * dela: é a conta que recebe o aviso, abre a sala e guarda o registro. Marcar
 * por e-mail avulso criaria uma sala sem dono do outro lado. A régua está em
 * `validarNovaConsulta`, testada.
 *
 * **O e-mail e o telefone vêm do CADASTRO**, assim que ele escolhe a paciente
 * — `aoBuscarContato`, ago/2026. Antes o campo ficava em branco com uma
 * promessa ("usaremos o e-mail do cadastro"); agora ele VÊ o contato e corrige
 * se estiver errado, em vez de confiar num resolvedor invisível.
 *
 * **"Das" e "Até", não um "Horário" solto.** Pedido do dono: "das 10h até as
 * 11h, tem que ter o intervalo da consulta" — a duração é o que faz o choque
 * de horário enxergar uma consulta que começa NO MEIO de outra.
 *
 * **Nada no passado.** Um dia inteiro atrás não tem o que marcar; hoje, só as
 * horas à frente de agora. `validarNovaConsulta` é o backstop; aqui é só a
 * conveniência de não oferecer o que já não serve.
 */

export type PacienteDoSelect = {
  id: string;
  nome: string;
  email: string | null;
};

/** O contato que vem do cadastro dela, ao escolher na lista. */
export type ContatoDaPaciente = { email: string | null; telefone: string | null };

/** O próximo múltiplo de 5 minutos, para o horário default não nascer "agora
    mesmo" e virar passado no instante em que ele termina de ler a tela. */
function proximoQuartoDeHora(d: Date): string {
  const min = d.getHours() * 60 + d.getMinutes();
  const arredondado = Math.ceil(min / 5) * 5;
  return horaDosMinutos(arredondado);
}

export function DiaDaAgenda({
  dia,
  eventos,
  pacientes,
  aoMarcar,
  aoEnviarLink,
  aoBuscarContato,
  onFechar,
}: {
  /** `YYYY-MM-DD`. */
  dia: string;
  /** Só os deste dia, já filtrados. */
  eventos: EventoDaAgenda[];
  pacientes: PacienteDoSelect[];
  aoMarcar: (v: NovaConsulta) => Promise<{ ok: boolean; erro?: string; avisou?: boolean }>;
  /** Abre a sala e manda o convite. `null` quando o evento não tem sala. */
  aoEnviarLink?: (evento: EventoDaAgenda) => Promise<{ ok: boolean; erro?: string }>;
  /** Busca e-mail e telefone do cadastro dela. Sem isto, os dois campos ficam
      em branco e editáveis, como sempre foram. */
  aoBuscarContato?: (pacienteId: string) => Promise<ContatoDaPaciente>;
  onFechar: () => void;
}) {
  /* "Agora" é lido uma vez, na abertura — não a cada render. Um relógio que
     anda sozinho reabriria a validação a cada minuto e moveria o chão debaixo
     do médico enquanto ele digita. */
  const [agora] = useState(() => new Date());
  const diaEhHoje = dia === diaLocal(agora);
  const diaJaPassou = dia < diaLocal(agora);

  const [abrindoForm, setAbrindoForm] = useState(false);
  const [tipo, setTipo] = useState<"presencial" | "teleconsulta">("presencial");
  const [pacienteId, setPacienteId] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [hora, setHora] = useState(() => (diaEhHoje ? proximoQuartoDeHora(agora) : "09:00"));
  const [duracaoMinutos, setDuracaoMinutos] = useState(30);
  const [salvando, setSalvando] = useState(false);
  const [enviandoLink, setEnviandoLink] = useState<string | null>(null);
  const [buscandoContato, setBuscandoContato] = useState(false);

  const titulo = useMemo(
    () =>
      new Date(`${dia}T12:00:00`).toLocaleDateString("pt-BR", {
        weekday: "long",
        day: "2-digit",
        month: "long",
      }),
    [dia],
  );

  /* "Até" é DERIVADO de hora + duração, não um terceiro estado independente.
     Mudar o "Das" preserva a duração que ele já escolheu — trocar o início de
     uma consulta de 45 min não devia resetar para 30. */
  const horaFim = horaDosMinutos(minutosDesdeMeiaNoite(hora) + duracaoMinutos);

  const nova: NovaConsulta = { dia, tipo, nome, email, telefone, hora, duracaoMinutos, pacienteId };
  /* O erro é calculado a cada tecla, mas só é MOSTRADO depois que ele tenta
     mandar: uma mensagem vermelha aparecendo enquanto ele digita a primeira
     letra do nome ensina a ignorar o vermelho. */
  const erro = validarNovaConsulta(nova, eventos, agora);
  const [tentou, setTentou] = useState(false);

  /* Contra a corrida: ele clica em Ana, o pedido de contato ainda está no ar,
     ele clica em Beatriz — a resposta de Ana chegando depois não pode
     sobrescrever os campos que agora são da Beatriz. */
  const pedidoAtual = useRef(0);

  function escolherPaciente(id: string) {
    const p = pacientes.find((x) => x.id === id);
    setPacienteId(id || null);
    if (!p) return;
    setNome(p.nome);
    setEmail(p.email ?? "");

    if (!aoBuscarContato) return;
    const meuPedido = ++pedidoAtual.current;
    setBuscandoContato(true);
    aoBuscarContato(id)
      .then((contato) => {
        if (pedidoAtual.current !== meuPedido) return; // outra paciente foi escolhida entretanto
        if (contato.email) setEmail(contato.email);
        if (contato.telefone) setTelefone(contato.telefone);
      })
      .catch(() => {
        /* Cadastro sem telefone, ou a busca falhou: os campos ficam como
           estavam, editáveis — igual a antes desta busca existir. */
      })
      .finally(() => {
        if (pedidoAtual.current === meuPedido) setBuscandoContato(false);
      });
  }

  async function marcar() {
    setTentou(true);
    if (erro) return;
    setSalvando(true);
    try {
      const r = await aoMarcar(nova);
      if (!r.ok) {
        toast.error(r.erro || "Não foi possível marcar.");
        return;
      }
      /* Diz o que DE FATO aconteceu: sem chave de e-mail configurada o envio é
         no-op silencioso, e "avisada ✓" seria mentira em cima de uma consulta
         que a pessoa não sabe que existe. */
      toast.success(
        r.avisou ? "Consulta marcada — ela foi avisada ✓" : "Consulta marcada. Avise-a você mesmo.",
      );
      setAbrindoForm(false);
      setNome("");
      setEmail("");
      setTelefone("");
      setPacienteId(null);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[65] flex items-end justify-center bg-black/55 p-0 sm:items-center sm:p-4"
      onClick={onFechar}
    >
      <div
        className="flex max-h-[92svh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl bg-card shadow-xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Cabeçalho: o dia e como ele está ── */}
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-5 py-3.5">
          <div className="min-w-0">
            <p className="truncate font-serif text-xl capitalize">{titulo}</p>
            <p className="mt-0.5 text-[13px] text-muted-foreground">{resumoDoDia(eventos)}</p>
          </div>
          <button
            onClick={onFechar}
            aria-label="Fechar"
            className="shrink-0 rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground"
          >
            ✕
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {/* ── O que já tem ── */}
          {eventos.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Nada marcado neste dia.
            </p>
          ) : (
            <ul className="space-y-2">
              {eventos.map((e) => (
                <li
                  key={e.id}
                  className="rounded-2xl border border-border bg-background px-3.5 py-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`h-2.5 w-2.5 shrink-0 rounded-full ${CORES_DO_TIPO[e.tipo].ponto}`}
                      aria-hidden
                    />
                    <span className="font-semibold tabular-nums">
                      {/* Faixa completa (10:00–10:30) quando há hora — é o
                          intervalo, não só o instante em que começa. */}
                      {faixaHoraria(e) ?? (e.firme ? "—" : "a combinar")}
                    </span>
                    <span className="font-medium">{e.titulo}</span>
                    <span className="text-xs text-muted-foreground">
                      {CORES_DO_TIPO[e.tipo].rotulo} · {e.situacao}
                    </span>
                    {e.pago !== null && (
                      <span
                        className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          e.pago ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {e.pago ? "Pago" : "A pagar"}
                      </span>
                    )}
                  </div>
                  {/* O link da sala, no dia — que é onde ele procura por ele.
                      Só para teleconsulta: presencial não tem sala, e um botão
                      "enviar link" ali mandaria a paciente para lugar nenhum. */}
                  {e.tipo === "teleconsulta" && aoEnviarLink && (
                    <button
                      onClick={async () => {
                        setEnviandoLink(e.id);
                        try {
                          const r = await aoEnviarLink(e);
                          toast[r.ok ? "success" : "error"](
                            r.ok ? "Sala aberta e convite enviado ✓" : r.erro || "Não consegui.",
                          );
                        } finally {
                          setEnviandoLink(null);
                        }
                      }}
                      disabled={enviandoLink === e.id}
                      className="press mt-2 rounded-full border border-border px-3 py-1 text-xs font-semibold hover:border-primary/50 disabled:opacity-50"
                    >
                      {enviandoLink === e.id ? "Enviando…" : "🔗 Abrir sala e enviar o link"}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          {/* ── Marcar ── */}
          {diaJaPassou ? (
            /* Dia inteiro no passado: não há o que oferecer para marcar. O
               resto da tela — o que já aconteceu — continua de leitura. */
            <p className="mt-4 rounded-2xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
              Este dia já passou — não dá para marcar consulta nele.
            </p>
          ) : !abrindoForm ? (
            <button
              onClick={() => setAbrindoForm(true)}
              className="press mt-4 w-full rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 py-3 text-sm font-semibold text-primary hover:border-primary"
            >
              + Marcar consulta neste dia
            </button>
          ) : (
            <div className="mt-4 rounded-2xl border border-border p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                Nova consulta
              </p>

              <div className="mt-2.5 flex gap-2">
                {(["presencial", "teleconsulta"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTipo(t)}
                    className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                      tipo === t
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground"
                    }`}
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${CORES_DO_TIPO[t].ponto}`}
                      aria-hidden
                    />
                    {CORES_DO_TIPO[t].rotulo}
                  </button>
                ))}
              </div>

              <label className="mt-3 block">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Paciente do app {tipo === "presencial" && "(opcional)"}
                </span>
                <select
                  value={pacienteId ?? ""}
                  onChange={(e) => escolherPaciente(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-border bg-background px-2.5 py-2 text-sm"
                >
                  <option value="">
                    {tipo === "teleconsulta" ? "Escolha uma paciente…" : "Não é paciente do app"}
                  </option>
                  {pacientes.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                    </option>
                  ))}
                </select>
              </label>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Nome
                  </span>
                  <input
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Quem vai ser atendida"
                    className="mt-1 w-full rounded-xl border border-border bg-background px-2.5 py-2 text-sm"
                  />
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Das
                    </span>
                    <input
                      type="time"
                      value={hora}
                      /* Só HOJE ganha piso — dias futuros não têm hora
                         "passada" nenhuma para recusar. O navegador é só
                         conveniência; quem barra de verdade é a validação. */
                      min={diaEhHoje ? proximoQuartoDeHora(agora) : undefined}
                      onChange={(e) => setHora(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-border bg-background px-2 py-2 text-sm tabular-nums"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Até
                    </span>
                    <input
                      type="time"
                      value={horaFim}
                      onChange={(e) => {
                        /* A duração é o que persiste; "até" é só a forma de
                           editá-la. Um "até" antes do "das" não pode virar
                           duração negativa — vira 5 min, o piso da faixa. */
                        const min = Math.max(
                          5,
                          minutosDesdeMeiaNoite(e.target.value) - minutosDesdeMeiaNoite(hora),
                        );
                        setDuracaoMinutos(min);
                      }}
                      className="mt-1 w-full rounded-xl border border-border bg-background px-2 py-2 text-sm tabular-nums"
                    />
                  </label>
                </div>
              </div>

              <label className="mt-3 block">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  E-mail {pacienteId ? "(opcional)" : "— é por ele que o aviso vai"}
                  {buscandoContato && " · buscando do cadastro…"}
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={
                    pacienteId ? "Usaremos o e-mail do cadastro dela" : "paciente@email.com"
                  }
                  className="mt-1 w-full rounded-xl border border-border bg-background px-2.5 py-2 text-sm"
                />
              </label>

              <label className="mt-3 block">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Telefone (opcional)
                </span>
                <input
                  type="tel"
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  placeholder={pacienteId ? "Do cadastro dela, se tiver" : "(00) 00000-0000"}
                  className="mt-1 w-full rounded-xl border border-border bg-background px-2.5 py-2 text-sm"
                />
              </label>

              {tentou && erro && (
                <p className="mt-3 rounded-xl border border-amber-300 bg-amber-50/70 px-3 py-2 text-[12px] leading-snug text-amber-900">
                  {erro}
                </p>
              )}

              <div className="mt-3 flex gap-2">
                <button
                  onClick={marcar}
                  disabled={salvando}
                  className="press flex-1 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                >
                  {salvando ? "Marcando…" : "Marcar e avisar"}
                </button>
                <button
                  onClick={() => setAbrindoForm(false)}
                  className="rounded-full border border-border px-4 py-2 text-sm text-muted-foreground"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
