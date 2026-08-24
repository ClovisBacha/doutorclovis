import { useEffect, useState } from "react";
import { livresPorDia, type HorarioLivre } from "@/lib/disponibilidade";
import { horariosLivresDoMedico } from "@/lib/disponibilidade.functions";

/**
 * A PACIENTE ESCOLHE ENTRE HORÁRIOS QUE EXISTEM.
 *
 * ─── O QUE ELA FAZIA ANTES ──────────────────────────────────────────────────
 *
 * Escolhia uma data qualquer num calendário e uma hora numa lista fixa de oito
 * opções, iguais para todo médico e para todo dia da semana. Metade dos pedidos
 * caía em dia que ele não atende ou em horário já ocupado — e cada um desses
 * virava uma recusa, uma contraproposta e mais um dia de espera para marcar.
 *
 * ─── QUANDO ESTA TELA APARECE ───────────────────────────────────────────────
 *
 * Só para quem está logada E vinculada a um médico: é o único caso em que dá
 * para saber de QUEM é a agenda. Visitante do site continua vendo os campos
 * livres — e isso não é meia-boca, é a diferença entre "pedir um horário" e
 * "marcar um horário". Sem saber o médico, só existe a primeira.
 *
 * ─── O QUE NÃO CHEGA AQUI ───────────────────────────────────────────────────
 *
 * A lista vem do servidor já pronta: `{dia, hora}[]`. Ela não recebe a agenda
 * do médico nem os buracos com explicação — os buracos são consultas de outras
 * pacientes, e qualquer detalhe a mais seria vazamento.
 */
export function EscolherHorario({
  doctorId,
  accessToken,
  dias = 45,
  tipo = null,
  valor,
  aoEscolher,
}: {
  doctorId: string;
  accessToken: string;
  /** Quantos dias à frente oferecer. */
  dias?: number;
  tipo?: "presencial" | "teleconsulta" | null;
  valor: HorarioLivre | null;
  aoEscolher: (h: HorarioLivre | null) => void;
}) {
  const [livres, setLivres] = useState<HorarioLivre[] | null>(null);
  const [motivo, setMotivo] = useState<"sem_tabela" | "sem_vinculo" | "falhou" | null>(null);
  const [diaAberto, setDiaAberto] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const hoje = new Date();
      const ate = new Date(hoje.getTime() + dias * 86400_000);
      const ymd = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
          d.getDate(),
        ).padStart(2, "0")}`;
      try {
        const r = await horariosLivresDoMedico({
          data: { accessToken, doctorId, de: ymd(hoje), ate: ymd(ate), tipo },
        });
        if (!vivo) return;
        if (r.ok) {
          setLivres(r.livres);
          setMotivo(null);
        } else {
          /* Lista VAZIA e FALHA são coisas diferentes, e a tela precisa dizer
             qual é: "ele não abriu horário" manda a paciente esperar; "não
             consegui carregar" manda tentar de novo. Um vazio para os dois faz
             ela desistir de marcar por causa de uma falha de rede. */
          setLivres([]);
          setMotivo(r.motivo === "sem_permissao" ? "falhou" : r.motivo);
        }
      } catch {
        if (vivo) {
          setLivres([]);
          setMotivo("falhou");
        }
      }
    })();
    return () => {
      vivo = false;
    };
  }, [doctorId, accessToken, dias, tipo]);

  if (livres === null) return <div className="skeleton h-28 rounded-2xl" />;

  if (motivo === "falhou") {
    return (
      <p className="rounded-2xl border border-amber-300 bg-amber-50/70 px-4 py-3 text-[13px] leading-snug text-amber-900">
        Não consegui carregar os horários agora. Isto <strong>não</strong> quer dizer que não haja
        vaga — atualize a página, ou escreva o horário que você prefere no campo de observações.
      </p>
    );
  }

  const dias_ = livresPorDia(livres);

  if (dias_.length === 0) {
    return (
      <p className="rounded-2xl border border-border bg-secondary/40 px-4 py-3 text-[13px] leading-snug text-muted-foreground">
        {motivo === "sem_tabela"
          ? "A agenda online do seu médico ainda não está ligada. Peça o horário pelo campo de observações que ele responde por aqui."
          : "Nenhum horário livre nos próximos dias. Você pode entrar na fila de espera — assim que abrir uma vaga, você é a primeira a saber."}
      </p>
    );
  }

  const aberto = diaAberto ?? dias_[0].dia;
  const horasDoDia = dias_.find((d) => d.dia === aberto)?.horas ?? [];

  return (
    <div>
      {/* ── Os dias que têm vaga ── */}
      <div className="flex snap-x gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {dias_.map((d) => {
          const data = new Date(`${d.dia}T12:00:00`);
          const ativo = d.dia === aberto;
          return (
            <button
              key={d.dia}
              type="button"
              onClick={() => {
                setDiaAberto(d.dia);
                /* Trocar de dia limpa a escolha: manter "14:00" selecionado ao
                   pular para outro dia deixaria marcado um horário que ela não
                   escolheu naquele dia. */
                aoEscolher(null);
              }}
              className={`flex shrink-0 snap-start flex-col items-center rounded-2xl border px-3 py-2 transition-colors ${
                ativo ? "border-primary bg-primary/10 text-primary" : "border-border"
              }`}
            >
              <span className="text-[10px] uppercase tracking-wide">
                {data.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "")}
              </span>
              <span className="text-lg font-semibold leading-tight tabular-nums">
                {data.getDate()}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {data.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}
              </span>
              <span className="mt-0.5 text-[10px] text-muted-foreground">
                {d.horas.length} {d.horas.length === 1 ? "vaga" : "vagas"}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── As horas do dia escolhido ── */}
      <div className="mt-3 flex flex-wrap gap-2">
        {horasDoDia.map((h) => {
          const escolhido = valor?.dia === aberto && valor?.hora === h;
          return (
            <button
              key={h}
              type="button"
              onClick={() => aoEscolher(escolhido ? null : { dia: aberto, hora: h })}
              aria-pressed={escolhido}
              className={`rounded-full border px-4 py-2 text-sm font-medium tabular-nums transition-colors ${
                escolhido
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border hover:border-primary/50"
              }`}
            >
              {h}
            </button>
          );
        })}
      </div>
    </div>
  );
}
