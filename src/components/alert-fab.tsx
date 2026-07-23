import { useState } from "react";
import { RED_SYMPTOMS } from "@/lib/triage";
import { DOCTOR } from "@/lib/doctor.config";
import { hapticTap } from "@/lib/haptics";

/**
 * Botão de "Sinais de alerta" sempre à mão — acesso rápido, de qualquer tela,
 * aos sinais de perigo da gestação e ao contato do médico/emergência.
 *
 * NÃO é IA nem conduta clínica gerada: é uma lista fixa de red flags obstétricos
 * (a mesma da triagem) que orienta a paciente a PROCURAR o médico — exatamente
 * a conduta segura. Fica escondido no Modo Cuidado (quem chama decide).
 */
export function AlertFab() {
  const [open, setOpen] = useState(false);
  const doctorShort = DOCTOR.name.split(" ").slice(0, 2).join(" ");

  return (
    <>
      <button
        onClick={() => {
          hapticTap();
          setOpen(true);
        }}
        aria-label="Sinais de alerta na gestação"
        className="press fixed bottom-24 right-4 z-40 flex items-center gap-1.5 rounded-full border border-amber-300/70 bg-card/90 px-3.5 py-2 text-xs font-semibold text-amber-700 shadow-lg backdrop-blur md:bottom-6 dark:text-amber-300"
      >
        <span aria-hidden>⚠️</span> Sinais de alerta
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[120] flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center sm:p-5"
          onClick={() => setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-border bg-card p-6 shadow-xl sm:rounded-3xl"
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border sm:hidden" />
            <p className="font-serif text-xl text-foreground">Quando procurar o médico</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Na dúvida, é sempre melhor ligar. Procure atendimento <strong>agora</strong> se
              sentir:
            </p>

            <ul className="mt-4 space-y-2">
              {RED_SYMPTOMS.map((s) => (
                <li
                  key={s.id}
                  className="flex items-start gap-2 rounded-2xl bg-rose-500/8 px-3 py-2.5 text-sm text-foreground"
                >
                  <span className="mt-0.5 text-rose-500" aria-hidden>
                    ●
                  </span>
                  {s.label}
                </li>
              ))}
            </ul>

            <div className="mt-5 grid gap-2">
              <a
                href={DOCTOR.whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full bg-primary px-5 py-3 text-center text-sm font-semibold text-primary-foreground shadow-[var(--shadow-soft)]"
              >
                Falar com {doctorShort}
              </a>
              <a
                href="tel:192"
                className="rounded-full border border-rose-300 px-5 py-3 text-center text-sm font-semibold text-rose-600 dark:text-rose-300"
              >
                Emergência — ligar 192 (SAMU)
              </a>
            </div>

            <button
              onClick={() => setOpen(false)}
              className="mt-3 w-full py-2 text-center text-xs text-muted-foreground hover:text-foreground"
            >
              Fechar
            </button>
            <p className="mt-1 text-center text-[11px] text-muted-foreground">
              Orientação geral — não substitui a avaliação do seu médico.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
