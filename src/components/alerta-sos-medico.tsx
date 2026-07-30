/**
 * O aviso de SOS na tela do médico.
 *
 * A ideia descartada foi "o médico clica em visto". Numa emergência ninguém
 * clica em nada: a pessoa LIGA. Então este componente é desenhado para uma
 * única ação — o telefone, grande, no primeiro toque — e tudo o mais existe
 * para ele decidir se liga para ela, para o hospital ou para o 192.
 *
 * É modal e cobre a tela porque um aviso de emergência que divide espaço com o
 * resto do painel é um aviso que se perde. Só some quando ele marca como
 * atendido, e essa marca é o que registra o desfecho — não a leitura.
 */

import { useEffect, useRef } from "react";
import { formataTelefone, linkTel, linkWhatsApp } from "@/lib/telefone";
import type { AcionamentoSos } from "@/lib/acionamentos.functions";

function quandoFoi(iso: string): string {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  return h < 24 ? `há ${h}h` : `há ${Math.floor(h / 24)} dia(s)`;
}

export function AlertaSosMedico({
  acionamento,
  onAtender,
  onFechar,
  atendendo,
  restantes,
}: {
  acionamento: AcionamentoSos;
  onAtender: () => void;
  /** Fechar SEM atender: ele volta a aparecer. Emergência não se dispensa. */
  onFechar: () => void;
  atendendo: boolean;
  /** Quantos outros aguardam atrás deste — o médico merece saber onde está. */
  restantes?: number;
}) {
  const caixa = useRef<HTMLDivElement>(null);
  /* O callback vive numa ref para que o efeito abaixo possa ter dependências
     VAZIAS. Com `[onFechar]` — e o call site passa uma arrow inline — o efeito
     refazia a cada render do painel, e o corpo dele começa com `.focus()`: o
     vigia de SOS troca o array a cada 60 s, então o foco do médico voltava
     sozinho para o topo do diálogo uma vez por minuto, no meio da ligação.
     Para leitor de tela, a leitura recomeçava do zero junto. */
  const fechar = useRef(onFechar);
  fechar.current = onFechar;

  useEffect(() => {
    const antes = document.activeElement as HTMLElement | null;
    caixa.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      /* `repeat` fora: segurar Esc dispara ~30 vezes por segundo, e cada
         disparo adiava um acionamento diferente — quatro emergências
         dispensadas num toque preso, no componente cujo princípio é que
         emergência não se dispensa. */
      if (e.key === "Escape" && !e.repeat) {
        fechar.current();
        return;
      }
      /* Tab preso na caixa. `aria-modal` resolve para o cursor virtual do
         leitor de tela, não para o Tab: sem isto o foco saía para as doze abas
         do painel atrás de um fundo preto, e o médico navegava às cegas. */
      if (e.key !== "Tab" || !caixa.current) return;
      const alvos = caixa.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (alvos.length === 0) return;
      const primeiro = alvos[0];
      const ultimo = alvos[alvos.length - 1];
      const atual = document.activeElement;
      if (e.shiftKey && (atual === primeiro || atual === caixa.current)) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && atual === ultimo) {
        e.preventDefault();
        primeiro.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      /* Devolve o foco a quem abriu — senão o próximo Tab recomeça do topo do
         documento, longe da fila de onde ele veio. */
      antes?.focus?.();
    };
  }, []);

  const f = (acionamento.ficha ?? {}) as Record<string, string | null>;
  const telPaciente = f.telefone ?? null;
  const mapa =
    acionamento.latitude != null && acionamento.longitude != null
      ? `https://maps.google.com/?q=${acionamento.latitude},${acionamento.longitude}`
      : null;

  const linhas: [string, string | null][] = [
    ["Semana", f.semana ?? null],
    ["DPP", f.dpp ?? null],
    ["Tipo sanguíneo", f.sangue ?? null],
    ["Alergias", f.alergias ?? null],
    ["Medicamentos", f.medicamentos ?? null],
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4">
      <div
        ref={caixa}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sos-titulo"
        className="flex max-h-[92svh] w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-card shadow-2xl outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
      >
        {/* Faixa vermelha: a tela inteira tem que dizer "emergência" antes de
            qualquer palavra ser lida. */}
        <div className="shrink-0 bg-rose-600 px-6 py-4 text-white">
          <p className="text-xs font-bold uppercase tracking-[0.2em]">Emergência</p>
          <h2 id="sos-titulo" className="mt-0.5 font-serif text-2xl">
            {acionamento.paciente || "Uma paciente sua"}
          </h2>
          <p className="mt-0.5 text-sm text-white/85">
            acionou o SOS {quandoFoi(acionamento.created_at)}
            {acionamento.motivo ? ` · ${acionamento.motivo}` : ""}
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {/* LIGAR primeiro, grande. É a única coisa que ele vai fazer nos
              próximos dez segundos. */}
          {telPaciente && linkTel(telPaciente) ? (
            <a
              href={linkTel(telPaciente)!}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-rose-600 px-4 py-4 text-base font-bold text-white"
            >
              📞 Ligar para {(acionamento.paciente ?? "ela").split(" ")[0]} —{" "}
              {formataTelefone(telPaciente)}
            </a>
          ) : (
            <p className="rounded-2xl border border-amber-300 bg-amber-50 p-3 text-[13px] leading-snug text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
              Ela não cadastrou telefone no perfil. Use o WhatsApp ou o contato de emergência
              abaixo.
            </p>
          )}

          <div className="mt-2 grid grid-cols-2 gap-2">
            {telPaciente && linkWhatsApp(telPaciente) && (
              <a
                href={linkWhatsApp(telPaciente)!}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-emerald-500/50 px-3 py-2.5 text-center text-sm font-semibold text-emerald-700 dark:text-emerald-300"
              >
                WhatsApp
              </a>
            )}
            {mapa && (
              <a
                href={mapa}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-border px-3 py-2.5 text-center text-sm font-semibold text-foreground"
              >
                📍 Onde ela está
              </a>
            )}
          </div>

          {acionamento.address && (
            <p className="mt-2 text-[12px] leading-snug text-muted-foreground">
              {acionamento.address}
            </p>
          )}

          {/* A ficha CONGELADA no momento do disparo — não o estado de hoje. */}
          <div className="mt-4 rounded-2xl border border-border bg-background/50 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Como ela estava no momento do acionamento
            </p>
            <div className="mt-2 space-y-1">
              {linhas
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <p key={k} className="text-[13px] leading-snug">
                    <span className="text-muted-foreground">{k}: </span>
                    <span className="font-medium text-foreground">{v}</span>
                  </p>
                ))}
              {linhas.every(([, v]) => !v) && (
                <p className="text-[12px] text-muted-foreground">
                  Sem ficha registrada neste acionamento.
                </p>
              )}
            </div>
          </div>

          {f.contato && (
            <p className="mt-2 text-[12px] leading-snug text-muted-foreground">
              Contato de emergência dela: <strong className="text-foreground">{f.contato}</strong>
              {f.contatoTel ? ` · ${f.contatoTel}` : ""}
            </p>
          )}
        </div>

        <div className="shrink-0 border-t border-border px-6 py-3">
          <button
            onClick={onAtender}
            disabled={atendendo}
            className="w-full rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {atendendo ? "Registrando…" : "Já atendi — registrar e fechar"}
          </button>
          {/* "Depois" e não "dispensar": sem marcar, ele volta. Uma emergência
              não deveria poder ser varrida para debaixo do tapete com um X. */}
          <button
            onClick={onFechar}
            className="mt-2 w-full text-center text-xs text-muted-foreground underline underline-offset-2"
          >
            Ver depois — o aviso continua aqui
          </button>
          {restantes != null && restantes > 0 && (
            /* Sem este contador, o médico que nunca clicou em "Já atendi" (e
               ninguém clica: numa emergência a pessoa LIGA) levava uma cascata
               de modais a cada carregamento do painel, sem saber quantos
               faltavam nem por que continuavam vindo. */
            <p className="mt-2 text-center text-[11px] text-muted-foreground">
              Mais {restantes} {restantes === 1 ? "acionamento" : "acionamentos"} sem desfecho
              registrado. Marque como atendidos para parar de vê-los.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
