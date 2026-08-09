/**
 * Enviar uma receita, um pedido de exame ou uma orientação para UMA paciente.
 *
 * A aba Ferramentas tinha os modelos e fazia duas coisas: copiar e imprimir. A
 * receita existia só no papel que ela levava, e o sistema — que tem a caixa
 * onde o laudo volta — nunca soube que o exame tinha sido pedido. O ciclo tinha
 * começo e fim e faltava o meio.
 *
 * O texto vem editável de propósito: o modelo é um ponto de partida, não uma
 * prescrição pronta. Dose, via e duração mudam com a paciente, e um campo
 * bloqueado faria ele copiar para outro lugar, editar lá, e o registro voltaria
 * a não existir.
 */

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { emitirParaPaciente, type TipoDeEmissao } from "@/lib/clinical.functions";
import { listMyPatients, type LinkedPatient } from "@/lib/patientlink.functions";

const ROTULO: Record<TipoDeEmissao, string> = {
  prescricao: "Receita",
  exame: "Pedido de exame",
  orientacao: "Orientação",
};

/* `z-[70]`: esta tela agora nasce DENTRO da ficha da paciente, que já é um
   modal em `z-50`. Empatada com o pai, ela ficava atrás do conteúdo da ficha —
   o médico clicava em "receituário" e nada parecia acontecer. Fica acima de
   qualquer modal do painel, que é o certo para a última tela antes de mandar
   uma receita. */
export function EnviarParaPaciente({
  tipo,
  titulo,
  conteudoInicial,
  tokenFn,
  onFechar,
  paciente,
}: {
  tipo: TipoDeEmissao;
  titulo: string;
  conteudoInicial: string;
  tokenFn: () => Promise<string>;
  onFechar: () => void;
  /**
   * A paciente já escolhida — quando isto vem, não há seletor.
   *
   * É o caminho que nasce DENTRO da ficha dela: o médico abriu a paciente,
   * leu o prontuário e pediu o exame ali mesmo. Fazê-lo escolher de novo, numa
   * lista de duzentos nomes, no meio de um fluxo que já sabe de quem se trata,
   * é onde se erra a paciente — e o erro aqui é uma receita no celular de quem
   * não devia recebê-la.
   */
  paciente?: LinkedPatient;
}) {
  const [pacientes, setPacientes] = useState<LinkedPatient[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [alvo, setAlvo] = useState<string | null>(paciente?.id ?? null);
  const [confirmando, setConfirmando] = useState(false);
  const [falhouLista, setFalhouLista] = useState(false);
  const [conteudo, setConteudo] = useState(conteudoInicial);
  const [nota, setNota] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    (async () => {
      /* Com a paciente já escolhida não há lista para carregar — e buscá-la
         assim mesmo faria a ficha de UMA paciente puxar as duzentas só para
         não usar nenhuma. */
      if (paciente) {
        setCarregando(false);
        return;
      }
      try {
        const r = await listMyPatients({ data: { accessToken: await tokenFn() } });
        if (r.ok) setPacientes(r.patients);
        else setFalhouLista(true);
      } catch {
        /* "Você ainda não tem pacientes vinculadas" seria uma afirmação FALSA
           dita no meio da consulta — ele concluiria que perdeu o vínculo. */
        setFalhouLista(true);
      } finally {
        setCarregando(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Busca por nome. O painel não tem busca de paciente em lugar nenhum, e uma
     lista de cinquenta nomes num seletor é onde o médico escolhe a errada. */
  /* Paciente sem nome NÃO some ao digitar. Com o filtro só sobre
     `display_name`, `("").includes(termo)` é false e ela desaparecia — quem
     mais precisa ser encontrada com cuidado é justamente quem o painel não
     sabe nomear. */
  const filtradas = busca.trim()
    ? pacientes.filter(
        (p) =>
          (p.display_name ?? "").toLowerCase().includes(busca.trim().toLowerCase()) ||
          !(p.display_name ?? "").trim(),
      )
    : pacientes;
  const escolhida = paciente ?? pacientes.find((p) => p.id === alvo) ?? null;

  function pedirConfirmacao() {
    if (!alvo) {
      toast.error("Escolha para qual paciente.");
      return;
    }
    if (conteudo.trim().length < 2) {
      toast.error("O conteúdo está vazio.");
      return;
    }
    setConfirmando(true);
  }

  async function enviar() {
    if (!alvo) return;
    setEnviando(true);
    try {
      const r = await emitirParaPaciente({
        data: {
          accessToken: await tokenFn(),
          pacienteId: alvo,
          tipo,
          titulo,
          conteudo: conteudo.trim(),
          nota: nota.trim() || undefined,
        },
      });
      if (!r.ok) throw new Error("recusado");
      /* O toast diz o que de fato aconteceu. `sendPushToUser` devolve
         `{sent:0}` sem lançar quando o VAPID não está configurado ou quando ela
         não tem inscrição — e "enviada ✓" era dito do mesmo jeito. */
      if ("avisou" in r && r.avisou) toast.success(`${ROTULO[tipo]} enviada — ela foi avisada ✓`);
      else toast.success(`${ROTULO[tipo]} salva. Ela vê no app (avisos não estão ativos).`);
      onFechar();
    } catch {
      toast.error("Não consegui enviar. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  if (confirmando && escolhida) {
    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4">
        <div className="flex max-h-[92svh] w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-card shadow-xl">
          <div className="shrink-0 border-b border-border px-5 py-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-rose-700">
              Confirmar envio
            </p>
            <p className="mt-0.5 font-serif text-lg">
              {ROTULO[tipo]} para {escolhida.display_name?.trim() || "paciente sem nome"}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {escolhida.weeks != null ? `${escolhida.weeks} semanas` : "sem idade gestacional"}
              {escolhida.due_date
                ? ` · DPP ${new Date(`${escolhida.due_date}T00:00:00`).toLocaleDateString("pt-BR")}`
                : ""}
            </p>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {/* O TEXTO EXATO que ela vai ler. Os modelos são escritos para o
                MÉDICO — "Opção 1 / Opção 2", "repetir em 30 min se necessário",
                "pode aumentar até 3 g/dia". Lidos por uma gestante como
                instrução de casa, isso é auto-medicação e auto-titulação. */}
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Ela vai ler exatamente isto
            </p>
            <pre className="mt-1 whitespace-pre-wrap rounded-xl border border-border bg-background p-3 font-sans text-[13px] leading-snug">
              {conteudo.trim()}
            </pre>
            {nota.trim() && (
              <p className="mt-2 rounded-xl bg-primary/5 p-3 text-[13px] leading-snug">
                <span className="font-semibold">Recado: </span>
                {nota.trim()}
              </p>
            )}
            <p className="mt-3 rounded-xl border border-amber-300 bg-amber-50/70 p-3 text-[12px] leading-snug text-amber-900">
              Os modelos foram escritos para <strong>você</strong>, não para ela. Se o texto tiver
              &ldquo;Opção 1 / Opção 2&rdquo;, faixas de dose ou conduta hospitalar, volte e deixe
              só o que ela deve fazer em casa.
            </p>
          </div>

          <div className="shrink-0 border-t border-border px-5 py-3">
            <button
              onClick={enviar}
              disabled={enviando}
              className="press w-full rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {enviando ? "Enviando…" : "Confirmar e enviar"}
            </button>
            <button
              onClick={() => setConfirmando(false)}
              className="mt-2 w-full text-center text-xs text-muted-foreground underline underline-offset-2"
            >
              Voltar e revisar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4">
      {/* SEM fechar no clique de fundo: ele reescreve a posologia, mira o campo
          de recado, erra dez pixels — e some tudo. Fecha pelo ✕. */}
      <div className="flex max-h-[92svh] w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-card shadow-xl">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-5 py-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
              {ROTULO[tipo]}
            </p>
            <p className="truncate font-serif text-lg">{titulo}</p>
          </div>
          <button onClick={onFechar} className="shrink-0 text-sm text-muted-foreground">
            ✕
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="block">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Para quem
            </span>
            {paciente ? (
              /* Fixo, e ainda assim MOSTRADO: ele precisa ver para quem está
                 prescrevendo antes de confirmar, mesmo quando não escolheu
                 aqui. Semana e DPP junto, pelo mesmo motivo do seletor — duas
                 pacientes de mesmo nome eram linhas idênticas. */
              <p className="mt-1 rounded-xl border border-primary/40 bg-primary/5 px-3 py-2 text-sm font-semibold text-primary">
                {paciente.display_name?.trim() || "Paciente sem nome"}
                <span className="ml-2 text-[11px] font-normal text-muted-foreground">
                  {paciente.weeks != null ? `${paciente.weeks}s` : ""}
                  {paciente.due_date
                    ? ` · DPP ${new Date(`${paciente.due_date}T00:00:00`).toLocaleDateString("pt-BR")}`
                    : ""}
                </span>
              </p>
            ) : carregando ? (
              <div className="skeleton mt-1 h-9 rounded-xl" />
            ) : falhouLista ? (
              <p className="mt-1 rounded-xl border border-amber-300 bg-amber-50/70 p-3 text-[13px] leading-snug text-amber-900">
                📡 Não consegui carregar a sua lista de pacientes agora. Atualize a página — isto
                não quer dizer que você não tenha pacientes.
              </p>
            ) : pacientes.length === 0 ? (
              <p className="mt-1 rounded-xl border border-border bg-background p-3 text-[13px] text-muted-foreground">
                Você ainda não tem pacientes vinculadas.
              </p>
            ) : (
              <>
                <input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar pelo nome…"
                  className="mt-1 w-full rounded-xl border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                />
                <div className="mt-1 max-h-40 overflow-y-auto rounded-xl border border-border">
                  {filtradas.length === 0 ? (
                    <p className="p-3 text-[13px] text-muted-foreground">
                      Nenhuma paciente com esse nome.
                    </p>
                  ) : (
                    filtradas.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setAlvo(p.id)}
                        className={`block w-full px-3 py-2 text-left text-sm ${
                          alvo === p.id
                            ? "bg-primary/10 font-semibold text-primary"
                            : "hover:bg-secondary/60"
                        }`}
                      >
                        {p.display_name?.trim() || "Sem nome"}
                        {/* Semana e DPP porque duas pacientes de mesmo nome
                            eram linhas idênticas — e o erro aqui é uma receita
                            no celular de quem não devia recebê-la. */}
                        <span className="ml-2 text-[11px] font-normal text-muted-foreground">
                          {p.weeks != null ? `${p.weeks}s` : ""}
                          {p.due_date
                            ? ` · DPP ${new Date(`${p.due_date}T00:00:00`).toLocaleDateString("pt-BR")}`
                            : ""}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </>
            )}
          </div>

          <label className="mt-3 block">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Conteúdo — confira antes de enviar
            </span>
            <textarea
              rows={6}
              value={conteudo}
              onChange={(e) => setConteudo(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-background px-2.5 py-1.5 font-mono text-[13px] leading-snug outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            />
            <span className="mt-0.5 block text-[10px] leading-snug text-muted-foreground">
              O modelo é um ponto de partida. Dose, via e duração mudam com a paciente.
            </span>
          </label>

          <label className="mt-3 block">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-primary">
              Recado para ela (opcional)
            </span>
            <textarea
              rows={2}
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder="Ex.: comece hoje e me avise se sentir enjoo."
              className="mt-1 w-full rounded-xl border border-primary/30 bg-primary/5 px-2.5 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            />
          </label>
        </div>

        <div className="shrink-0 border-t border-border px-5 py-3">
          <button
            onClick={pedirConfirmacao}
            disabled={enviando || !alvo}
            className="press w-full rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {/* O NOME NO BOTÃO. A escolhida ficava só destacada dentro de uma
                caixa com rolagem, e digitar na busca fazia o destaque sumir
                enquanto `alvo` continuava apontando para a paciente anterior. */}
            {alvo && escolhida
              ? `Revisar e enviar para ${escolhida.display_name?.trim() || "esta paciente"}`
              : "Escolha a paciente"}
          </button>
          <p className="mt-1.5 text-center text-[10px] leading-snug text-muted-foreground">
            Ela recebe no app e fica registrado no prontuário dela.
          </p>
        </div>
      </div>
    </div>
  );
}
