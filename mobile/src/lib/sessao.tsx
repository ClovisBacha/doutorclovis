import type { Session } from "@supabase/supabase-js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppState } from "react-native";
import { apagar, gravarJson, lerJson } from "~/lib/armazem";
import { ehBancada, perfilDaBancada } from "~/lib/bancada";
import { gestacaoDoPerfil } from "~/lib/gestacao";
import { kitDoPerfil } from "~/lib/kit-sos";
import { guardarKitDoSos } from "~/lib/kit-sos-armazem";
import { lerMedicoLocal } from "~/lib/medico-local";
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
  medico_nome?: string | null;
  medico_celular?: string | null;
  medico_email?: string | null;
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

/**
 * O servidor já respondeu à primeira leitura do perfil desta sessão (deu
 * certo ou não). Mora FORA do `Valor`, de propósito: só a abertura do app
 * (a splash) quer saber disso, e mudar o `Valor` acorda as 35 telas que leem
 * a sessão.
 */
const PerfilConfirmado = createContext(false);
export const usePerfilConfirmado = () => useContext(PerfilConfirmado);

/**
 * O PERFIL NO APARELHO (18/11/2026, "o app está travado"): a última linha
 * lida do servidor fica em `dc-perfil:<uid>`. Na abertura ela é lida junto
 * com a sessão, e o app já começa `pronto` — as abas montam por trás da
 * splash enquanto o servidor responde, e sem rede o app abre no que ela viu
 * da última vez em vez de "Não consegui ler". A releitura vem logo depois e
 * VENCE (inclusive o Modo Cuidado ligado noutro aparelho). O prefixo `dc-` faz
 * o sair da conta apagá-la (`limparRastrosLocais`).
 */
const chaveDoPerfil = (uid: string) => `dc-perfil:${uid}`;

/** Mesma pessoa, mesmos dados: o token renovado não é motivo para acordar o app. */
function mesmaSessao(a: Session | null, b: Session | null): boolean {
  if (!a || !b || a.user.id !== b.user.id) return false;
  return JSON.stringify(a.user) === JSON.stringify(b.user);
}

export function ProvedorDeSessao({ children }: { children: ReactNode }) {
  const [sessao, setSessao] = useState<Session | null>(null);
  const [carregandoSessao, setCarregandoSessao] = useState(true);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [estadoDoPerfil, setEstado] = useState<EstadoDoPerfil>("carregando");
  const [confirmado, setConfirmado] = useState(false);
  /* O perfil que as telas têm, em texto: a releitura igual não troca o objeto
     (cada volta do segundo plano relia e acordava o app inteiro). */
  const perfilEmTexto = useRef<string | null>(null);
  /* O kit do SOS gravado, sem o carimbo de hora: só regrava o que mudou. */
  const kitEmTexto = useRef<string | null>(null);
  /* O servidor já respondeu por este uid: o perfil do aparelho chegou tarde e
     não pode passar por cima do que veio de lá. */
  const servidorJaLeu = useRef<string | null>(null);

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
    let vivo = true;
    void supabase.auth
      .getSession()
      .then(async ({ data }) => {
        const s = data.session;
        const guardado = s ? await lerJson<Perfil | null>(chaveDoPerfil(s.user.id), null) : null;
        if (!vivo) return;
        if (s && guardado && guardado.id === s.user.id && servidorJaLeu.current !== s.user.id) {
          perfilEmTexto.current = JSON.stringify(guardado);
          setPerfil(guardado);
          setEstado("pronto");
        }
        setSessao((atual) => (mesmaSessao(atual, s) ? atual : s));
        setCarregandoSessao(false);
      })
      /* O armazenamento da sessão que falhou não pode prender a porta em
         "Abrindo…": sem sessão, a entrada. */
      .catch(() => vivo && setCarregandoSessao(false));
    /* O token renovado (de hora em hora, e ao voltar do segundo plano) chega
       como uma sessão nova da MESMA pessoa: fica o objeto que as telas já têm.
       Nenhuma tela lê o token daqui (`tokenAtual()` lê do armazenamento). */
    const { data } = supabase.auth.onAuthStateChange((_evento, s) =>
      setSessao((atual) => (mesmaSessao(atual, s) ? atual : s)),
    );
    return () => {
      vivo = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const uid = sessao?.user.id ?? null;
  const lidoEm = useRef(0);

  const recarregarPerfil = useCallback(async () => {
    if (ehBancada()) {
      const p = perfilDaBancada();
      setPerfil(p);
      setEstado("pronto");
      setConfirmado(true);
      return;
    }
    if (!uid) {
      perfilEmTexto.current = null;
      setPerfil(null);
      setEstado("sem-perfil");
      return;
    }
    setEstado((e) => (e === "pronto" ? e : "carregando"));
    lidoEm.current = Date.now();
    const { data, error } = await supabase
      .from("patient_profiles")
      .select("*")
      .eq("id", uid)
      .maybeSingle();
    servidorJaLeu.current = uid;
    setConfirmado(true);
    if (error) {
      /* Já havia um perfil bom (lido agora há pouco, ou o do aparelho): a
         releitura que falhou (sem rede, ao voltar do segundo plano) fica com
         ele, em vez de derrubar as telas. */
      setEstado((e) => (e === "pronto" ? e : "falhou"));
      return;
    }
    const p = (data as Perfil | null) ?? null;
    const emTexto = p ? JSON.stringify(p) : null;
    if (emTexto !== perfilEmTexto.current) {
      perfilEmTexto.current = emTexto;
      setPerfil(p);
      if (p) void gravarJson(chaveDoPerfil(uid), p);
      else void apagar(chaveDoPerfil(uid));
    }
    setEstado(p ? "pronto" : "sem-perfil");
    /* O kit do SOS acompanha o perfil, para o socorro funcionar sem rede. A
       situação conta semanas: o kit muda com o dia, mesmo com o perfil igual. */
    if (p) {
      const medico = await lerMedicoLocal();
      const kit = kitDoPerfil(p, situacaoParaSocorro(p), new Date(), medico);
      const { atualizadoEm: _carimbo, ...conteudo } = kit;
      const kitNovo = JSON.stringify(conteudo);
      if (kitNovo !== kitEmTexto.current) {
        kitEmTexto.current = kitNovo;
        void guardarKitDoSos(kit);
      }
    }
  }, [uid]);

  useEffect(() => {
    void recarregarPerfil();
  }, [recarregarPerfil]);

  /* De volta ao primeiro plano, o perfil é relido: o Modo Cuidado ligado
     noutro aparelho depois de uma perda, o parto registrado lá, uma data nova
     de ultrassom. O iOS deixa o app suspenso por dias, e um perfil lido só na
     abertura seguia mostrando o bebê a quem já não o tinha (out/2026). Uma
     leitura que falhe aqui não derruba nada: `pronto` continua `pronto`. */
  useEffect(() => {
    if (ehBancada()) return;
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active" && uid && Date.now() - lidoEm.current > 20_000) {
        void recarregarPerfil();
      }
    });
    return () => sub.remove();
  }, [uid, recarregarPerfil]);

  /* Modo Cuidado ligado (aqui ou em outro aparelho): nenhum "Vamos respirar?"
     agendado continua chegando — o servidor do site também pula quem está no
     Modo Cuidado. */
  const emCuidado = estadoDoPerfil === "pronto" && perfil?.care_mode === true;
  useEffect(() => {
    if (!emCuidado) return;
    void import("~/lib/lembrete-da-meditacao")
      .then((m) => m.cancelarLembretesDaMeditacao())
      .catch(() => {});
  }, [emCuidado]);

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
  return (
    <Contexto.Provider value={valor}>
      <PerfilConfirmado.Provider value={confirmado}>{children}</PerfilConfirmado.Provider>
    </Contexto.Provider>
  );
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
