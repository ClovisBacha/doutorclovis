import type { Session } from "@supabase/supabase-js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ehBancada, perfilDaBancada } from "~/lib/bancada";
import { gestacaoDoPerfil } from "~/lib/gestacao";
import { kitDoPerfil } from "~/lib/kit-sos";
import { guardarKitDoSos } from "~/lib/kit-sos-armazem";
import { supabase } from "~/servidor/supabase";

/**
 * A linha da paciente em patient_profiles. `select("*")` de propósito: o
 * app não pode quebrar por uma coluna que ainda não foi criada no banco
 * (os APLICAR_*.sql chegam depois do código). Campo ausente vale null.
 */
export type Perfil = {
  id: string;
  full_name?: string | null;
  baby_name?: string | null;
  lmp_date?: string | null;
  reference_date?: string | null;
  reference_weeks?: number | null;
  reference_days?: number | null;
  birth_date?: string | null;
  care_mode?: boolean | null;
  display_name?: string | null;
  emergency_contact?: string | null;
  emergency_phone?: string | null;
  emergency_email?: string | null;
  blood_type?: string | null;
  allergies?: string | null;
  medications?: string | null;
  phone?: string | null;
  avatar_url?: string | null;
  food_preferences?: string | null;
  quiz_premium?: boolean | null;
  [coluna: string]: unknown;
};

export type EstadoDoPerfil = "carregando" | "pronto" | "sem-perfil" | "falhou";

type Valor = {
  sessao: Session | null;
  carregandoSessao: boolean;
  perfil: Perfil | null;
  estadoDoPerfil: EstadoDoPerfil;
  recarregarPerfil: () => Promise<void>;
  /** O Modo Cuidado (luto). "Não sei" conta como LIGADO para o que fala do
   *  bebê: o pior caso é calar uma vez; o oposto é mostrar o bebê a quem
   *  acabou de perdê-lo. Nunca governa socorro. */
  cuidado: boolean;
};

const Contexto = createContext<Valor | null>(null);

export function ProvedorDeSessao({ children }: { children: ReactNode }) {
  const [sessao, setSessao] = useState<Session | null>(null);
  const [carregandoSessao, setCarregandoSessao] = useState(true);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [estadoDoPerfil, setEstado] = useState<EstadoDoPerfil>("carregando");

  useEffect(() => {
    if (ehBancada()) {
      /* Sessão de exemplo para a bancada (só web, só com ?bancada=1). */
      setSessao({
        user: { id: perfilDaBancada().id },
        access_token: "bancada",
      } as unknown as Session);
      setCarregandoSessao(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSessao(data.session);
      setCarregandoSessao(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_evento, s) => setSessao(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const uid = sessao?.user.id ?? null;

  const recarregarPerfil = useCallback(async () => {
    if (ehBancada()) {
      const p = perfilDaBancada();
      setPerfil(p);
      setEstado("pronto");
      return;
    }
    if (!uid) {
      setPerfil(null);
      setEstado("sem-perfil");
      return;
    }
    setEstado((e) => (e === "pronto" ? e : "carregando"));
    const { data, error } = await supabase
      .from("patient_profiles")
      .select("*")
      .eq("id", uid)
      .maybeSingle();
    if (error) {
      setEstado("falhou");
      return;
    }
    const p = (data as Perfil | null) ?? null;
    setPerfil(p);
    setEstado(p ? "pronto" : "sem-perfil");
    /* O kit do SOS acompanha o perfil, para o socorro funcionar sem rede. */
    if (p) void guardarKitDoSos(kitDoPerfil(p, situacaoParaSocorro(p)));
  }, [uid]);

  useEffect(() => {
    void recarregarPerfil();
  }, [recarregarPerfil]);

  const valor = useMemo<Valor>(
    () => ({
      sessao,
      carregandoSessao,
      perfil,
      estadoDoPerfil,
      recarregarPerfil,
      cuidado: estadoDoPerfil !== "pronto" ? true : perfil?.care_mode === true,
    }),
    [sessao, carregandoSessao, perfil, estadoDoPerfil, recarregarPerfil],
  );
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

/** A linha "situação" da ficha de emergência. No luto, nunca "gestante". */
export function situacaoParaSocorro(p: Perfil): string | null {
  if (p.care_mode) return "Paciente obstétrica";
  if (p.birth_date) return "Puérpera (teve bebê recentemente)";
  const g = gestacaoDoPerfil(p);
  return g ? `Gestante de ${g.weeks} semanas e ${g.days} dias` : "Gestante";
}

export function useSessao(): Valor {
  const v = useContext(Contexto);
  if (!v) throw new Error("useSessao fora do ProvedorDeSessao");
  return v;
}
