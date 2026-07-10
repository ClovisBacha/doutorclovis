import { createFileRoute } from "@tanstack/react-router";
import { DOCTOR } from "@/lib/doctor.config";

export const Route = createFileRoute("/mural")({
  head: () => ({
    meta: [
      { title: "Mural dos bebês — Obstétrica" },
      {
        name: "description",
        content:
          "Galeria de bebês nascidos sob nossos cuidados. Compartilhada com autorização das famílias.",
      },
    ],
  }),
  component: MuralPage,
});

function MuralPage() {
  return (
    <section className="mx-auto max-w-4xl px-5 py-16 md:py-24">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
        Histórias reais
      </p>
      <h1 className="mt-3 font-serif text-4xl md:text-5xl">Mural dos nossos bebês</h1>
      <p className="mt-4 max-w-2xl text-muted-foreground">
        Cada rostinho aqui é uma história de amor e cuidado. Publicado com a autorização das
        famílias.
      </p>

      {/* Empty state — waiting for real photos */}
      <div className="mt-16 flex flex-col items-center text-center">
        <div className="flex h-28 w-28 items-center justify-center rounded-full bg-primary/10">
          <svg viewBox="0 0 64 64" fill="none" className="h-14 w-14" aria-hidden="true">
            <ellipse
              cx="32"
              cy="38"
              rx="22"
              ry="14"
              fill="currentColor"
              className="text-primary/20"
            />
            <circle cx="24" cy="24" r="7" fill="currentColor" className="text-primary/40" />
            <circle cx="40" cy="24" r="7" fill="currentColor" className="text-primary/40" />
            <path
              d="M20 38c0-6.627 5.373-12 12-12s12 5.373 12 12"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              className="text-primary/60"
            />
          </svg>
        </div>

        <h2 className="mt-6 font-serif text-2xl text-foreground">
          Este espaço aguarda os nossos bebês
        </h2>
        <p className="mt-3 max-w-md text-muted-foreground">
          O mural ainda está vazio — cada foto aqui será uma história real de cuidado e confiança.
          Se você já foi paciente do Dr. Clóvis, adoraríamos ter seu bebê aqui!
        </p>

        <div className="mt-8 rounded-3xl border border-primary/20 bg-primary/5 p-6 text-left max-w-sm w-full">
          <p className="text-sm font-semibold text-foreground">Como aparecer no mural</p>
          <ol className="mt-3 space-y-2 text-sm text-muted-foreground list-none">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                1
              </span>
              Após o parto, tire uma foto com o bebê
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                2
              </span>
              Envie pelo WhatsApp com a mensagem "Quero no mural"
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                3
              </span>
              Você assina a autorização de uso de imagem
            </li>
          </ol>
          <a
            href={DOCTOR.whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-sm hover:shadow-[var(--shadow-soft)] transition-shadow"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
            Enviar pelo WhatsApp
          </a>
        </div>
      </div>
    </section>
  );
}
