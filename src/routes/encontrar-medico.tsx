import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { searchDoctors, chooseDoctor, type DirectoryDoctor } from "@/lib/doctors.functions";
import { supabase } from "@/integrations/supabase/client";
import { DoctorBadge } from "@/components/doctor-badge";

export const Route = createFileRoute("/encontrar-medico")({
  head: () => ({
    meta: [
      { title: "Encontrar um obstetra — Obstétrica" },
      {
        name: "description",
        content:
          "Encontre um obstetra para acompanhar sua gestação: filtre por experiência, mestrado, doutorado e cidade.",
      },
    ],
  }),
  component: EncontrarMedicoPage,
});

const UFS = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
];

function EncontrarMedicoPage() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [uf, setUf] = useState("");
  const [city, setCity] = useState("");
  const [minExp, setMinExp] = useState(0);
  const [masters, setMasters] = useState(false);
  const [doctorate, setDoctorate] = useState(false);
  const [results, setResults] = useState<DirectoryDoctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [choosing, setChoosing] = useState<string | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setLoggedIn(!!data.session));
  }, []);

  async function run() {
    setLoading(true);
    try {
      const res = await searchDoctors({
        data: {
          q,
          state: uf,
          city,
          minExperience: minExp,
          hasMasters: masters,
          hasDoctorate: doctorate,
        },
      });
      setResults(res.ok ? res.doctors : []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  // Busca inicial + a cada mudança de filtro (com um pequeno debounce no texto).
  useEffect(() => {
    const t = setTimeout(run, q || city ? 350 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, uf, city, minExp, masters, doctorate]);

  async function pick(d: DirectoryDoctor) {
    const { data: s } = await supabase.auth.getSession();
    if (!s.session) {
      toast.error("Entre na sua conta para escolher um médico.");
      navigate({ to: "/auth" });
      return;
    }
    setChoosing(d.id);
    const res = await chooseDoctor({
      data: { accessToken: s.session.access_token, doctorId: d.id },
    });
    setChoosing(null);
    if (res.ok) {
      toast.success(`${d.display_name} agora é o seu médico 💛`);
      navigate({ to: "/minha-conta" });
    } else {
      toast.error("Não foi possível escolher este médico agora.");
    }
  }

  const chip = "rounded-full border border-border bg-card px-3 py-1.5 text-sm";

  return (
    <div className="min-h-screen bg-background">
      <section className="border-b border-border bg-secondary/30 px-5 py-10">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="font-serif text-3xl md:text-4xl">Encontre o seu obstetra</h1>
          <p className="mt-2 text-muted-foreground">
            Escolha por experiência, formação e cidade. O médico que você escolher passa a te
            acompanhar no app.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-5 py-6">
        {/* Filtros */}
        <div className="rounded-2xl border border-border bg-card p-4">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nome, especialidade ou palavra-chave…"
            className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <select value={uf} onChange={(e) => setUf(e.target.value)} className={chip}>
              <option value="">UF</option>
              {UFS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Cidade"
              className={`${chip} w-32`}
            />
            <select
              value={minExp}
              onChange={(e) => setMinExp(Number(e.target.value))}
              className={chip}
            >
              <option value={0}>Experiência</option>
              <option value={5}>5+ anos</option>
              <option value={10}>10+ anos</option>
              <option value={20}>20+ anos</option>
            </select>
            <button
              onClick={() => setMasters((v) => !v)}
              className={`${chip} ${masters ? "border-primary bg-primary/10 font-semibold text-primary" : ""}`}
            >
              🎓 Mestrado
            </button>
            <button
              onClick={() => setDoctorate((v) => !v)}
              className={`${chip} ${doctorate ? "border-primary bg-primary/10 font-semibold text-primary" : ""}`}
            >
              🎓 Doutorado
            </button>
          </div>
        </div>

        {/* Resultados */}
        <div className="mt-5 space-y-3">
          {loading ? (
            <div className="skeleton h-28 rounded-2xl" />
          ) : results.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Nenhum médico encontrado com esses filtros. Tente ampliar a busca.
            </p>
          ) : (
            results.map((d) => (
              <div key={d.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-serif text-lg">{d.display_name}</p>
                      <DoctorBadge plan={d.plan} />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {[d.title, d.specialty].filter(Boolean).join(" · ") || "Obstetra"}
                      {d.subspecialty ? ` · ${d.subspecialty}` : ""}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11px]">
                      {d.city || d.state ? (
                        <span className="rounded-full bg-secondary px-2 py-0.5">
                          📍 {[d.city, d.state].filter(Boolean).join("/")}
                        </span>
                      ) : null}
                      {d.years_experience ? (
                        <span className="rounded-full bg-secondary px-2 py-0.5">
                          {d.years_experience} anos de experiência
                        </span>
                      ) : null}
                      {d.has_doctorate ? (
                        <span className="rounded-full bg-secondary px-2 py-0.5">🎓 Doutorado</span>
                      ) : d.has_masters ? (
                        <span className="rounded-full bg-secondary px-2 py-0.5">🎓 Mestrado</span>
                      ) : null}
                    </div>
                    {d.bio ? (
                      <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{d.bio}</p>
                    ) : null}
                  </div>
                </div>
                <button
                  onClick={() => pick(d)}
                  disabled={choosing === d.id}
                  className="press mt-3 w-full rounded-full bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
                >
                  {choosing === d.id
                    ? "Escolhendo…"
                    : loggedIn
                      ? "Escolher este médico"
                      : "Entrar e escolher"}
                </button>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
