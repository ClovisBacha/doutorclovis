import { createFileRoute } from "@tanstack/react-router";

import { BabyTab } from "@/components/baby-tab";
import { DOCTOR } from "@/lib/doctor.config";
import type { Profile } from "@/routes/_authenticated/minha-conta";

/**
 * Bancada da ABA BEBÊ — a tela que o dono disse não estar "cem por cento".
 *
 * ⚠️ ELA NÃO EXISTIA, E ERA POR ISSO QUE A TELA NUNCA TINHA SIDO OLHADA.
 * `BabyTab` exige conta, perfil com DUM e médico vinculado; e enquanto ela
 * morava dentro de `minha-conta.tsx` nem dava para importá-la, porque exportar
 * de um arquivo de ROTA põe o código no pedaço da árvore de rotas que toda
 * página do site carrega (`rotas-sem-export-solto`). O corte veio primeiro
 * justamente para destravar esta bancada.
 *
 * ⚠️ A BANCADA INJETA O DADO NAS MESMAS PROPS DA PRODUÇÃO, nunca o desenho —
 * é a lição do `?streak=41` da folha da chama, que cravava o NÚMERO e deixava
 * o resto vir de uma jornada vazia.
 *
 * ⚠️ E A GESTAÇÃO É CRAVADA, NUNCA `new Date()`. O servidor e o cliente
 * calculariam instantes diferentes e o React descartaria a árvore — o defeito
 * de hidratação que já deixou este app SEM ABRIR. `?w=` decide a semana.
 */
export const Route = createFileRoute("/preview-bebe-tab")({
  /* ⚠️ `q.x == null` (dois iguais) e não `=== undefined`: o router serializa e
     revalida, então na segunda passada chega `null` — e `Number(null)` é 0.
     Mesma armadilha que `preview-saude` e `preview-jogo` documentam. */
  validateSearch: (q: Record<string, unknown>) => ({
    w: q.w == null || q.w === "" ? 20 : Number(q.w),
    d: q.d == null ? 3 : Number(q.d),
    luto: q.luto == null ? 0 : Number(q.luto),
    /* Sem médico vinculado o cartão de presença some — é o estado de quem
       ainda não usou o código do consultório, e ele nunca foi fotografado. */
    semmedico: q.semmedico == null ? 0 : Number(q.semmedico),
    /* Perfil magro: sem nome do bebê, sem batimento, sem histórico. É o que a
       paciente recém-cadastrada vê, e é onde os vazios aparecem. */
    magro: q.magro == null ? 0 : Number(q.magro),
    /* Médica que NÃO é o dono da instalação: o cartão mostra a inicial, e não
       o retrato. É o caso da maioria das pacientes num app multi-consultório. */
    outromedico: q.outromedico == null ? 0 : Number(q.outromedico),
  }),
  head: () => ({
    meta: [{ title: "Bancada da aba Bebê" }, { name: "robots", content: "noindex" }],
  }),
  component: PreviewBebeTab,
});

function PreviewBebeTab() {
  const { w, d, luto, semmedico, magro, outromedico } = Route.useSearch();
  const semanas = Number.isFinite(w) ? w : 20;
  const dias = Number.isFinite(d) ? Math.min(6, Math.max(0, d)) : 3;

  /* DUM derivada da semana pedida, com data FIXA de referência: assim o perfil
     é coerente com o `gest` cravado abaixo, sem ler o relógio. */
  const dum = new Date(Date.UTC(2026, 3, 20) - (semanas * 7 + dias) * 0);

  const perfil = {
    id: "bancada",
    display_name: "Ana Paula",
    baby_name: magro ? null : "Helena",
    baby_skin_tone: magro ? null : 3,
    lmp_date: "2026-04-13",
    due_date: "2027-01-18",
    fetal_bpm: magro ? null : 148,
    fetal_bpm_at: magro ? null : "2026-08-28",
    pregnancy_number: magro ? null : 2,
    prior_cesarean: magro ? false : true,
    prior_preterm: false,
    prior_bp_elevated: magro ? false : true,
    prior_bp_week: magro ? null : 34,
    prior_gestational_diabetes: false,
    prior_notes: magro ? null : "Internação de 2 dias por pressão na primeira gestação.",
    care_mode: !!luto,
  } as unknown as Profile;

  return (
    <div className="fixed inset-0 z-[50] overflow-y-auto bg-background px-4 py-5">
      <BabyTab
        profile={perfil}
        /* ⚠️ O NOME PRECISA SER EXATAMENTE `DOCTOR.name`. O cartão de presença
           só mostra o RETRATO quando o médico É o dono da instalação
           (`nomeMedico === DOCTOR.name`) — para os demais, a inicial, que é a
           decisão certa: a foto é dele, não de um profissional qualquer.
           A bancada passava "Clóvis Bacha" sem o "Dr.", a comparação falhava, e
           eu quase reportei a inicial como defeito de produto. Bancada que não
           usa a MESMA forma da produção mede um app que não existe.
           `?outromedico=1` mostra o outro caso, que também é real. */
        medico={
          semmedico
            ? null
            : outromedico
              ? { nome: "Dra. Marina Alves", specialty: "Ginecologia e Obstetrícia" }
              : { nome: DOCTOR.name, specialty: "Ginecologia e Obstetrícia" }
        }
        gest={{ weeks: semanas, days: dias, totalDays: semanas * 7 + dias }}
        onNavigate={() => {}}
        onBabyTap={() => {}}
        careMode={!!luto}
      />
      <p className="pointer-events-none fixed bottom-2 left-0 right-0 z-[60] text-center text-[10px] text-muted-foreground">
        bancada · {dum.getUTCFullYear()} · ?w=semana &middot; ?d=dia &middot; ?luto=1 &middot;
        ?semmedico=1 &middot; ?magro=1 &middot; ?outromedico=1
      </p>
    </div>
  );
}
