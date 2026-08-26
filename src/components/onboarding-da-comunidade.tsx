import { useEffect, useState } from "react";
import {
  CARTOES_DA_COMUNIDADE,
  CHAVE_ONBOARDING_COMUNIDADE,
  chaveDoPassoDaComunidade,
  deveVerOnboarding,
  lerPassoDaComunidade,
  passoSeguinte,
} from "@/lib/onboarding-da-comunidade";

/**
 * O primeiro minuto na Comunidade — quatro cartões, uma vez só.
 *
 * A régua e os textos moram em `lib/onboarding-da-comunidade.ts`; aqui só o
 * desenho, o armazenamento e o portão de quando abrir.
 */
export function OnboardingDaComunidade({
  careMode,
  bancada,
  aoFechar,
}: {
  /** `undefined` enquanto o perfil não chegou — e nesse estado NÃO abre. */
  careMode: boolean | undefined;
  /** A bancada força a abertura sem tocar no armazenamento da jornada. */
  bancada?: boolean;
  aoFechar?: () => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [euId, setEuId] = useState<string | null>(null);
  /**
   * ⚠️ **O passo é LIDO do armazenamento, e não começa sempre em zero.** A barra
   * de baixo continua clicável durante os cartões: tocar num item troca a aba e
   * desmonta este componente. Sem isto, voltar à Comunidade recomeçava do
   * primeiro cartão — o defeito que o dono viu no tutorial do mascote.
   */
  const [passo, setPasso] = useState(0);

  function irPara(n: number) {
    setPasso(n);
    try {
      localStorage.setItem(chaveDoPassoDaComunidade(euId), String(n));
    } catch {
      /* Sem storage: a ida e volta recomeça, mas a tela funciona. */
    }
  }

  useEffect(() => {
    if (bancada) {
      setAberto(true);
      return;
    }
    let vivo = true;
    void (async () => {
      try {
        /**
         * ⚠️ **O PULL DA NUVEM VEM ANTES DE LER, e é obrigatório.**
         *
         * Duas razões, e a segunda é grave. A leve: sem ele, um aparelho novo
         * não conhece o "já vi" gravado no outro e refaria o tutorial. A grave:
         * `lsSet` de uma chave `dc-path-` agenda um PUSH do blob da jornada, e
         * `journey-sync` avisa em prosa que empurrar antes do pull sobrescreve
         * a jornada real por um blob incompleto. Esta tela vive numa aba irmã,
         * que pode ser a primeira coisa que a paciente abre no dia.
         */
        const { ensureInitialJourneyPull, lsGet } = await import("@/lib/journey-sync");
        await ensureInitialJourneyPull();
        if (!vivo) return;
        const jaViu = lsGet<boolean>(CHAVE_ONBOARDING_COMUNIDADE, false);
        if (!deveVerOnboarding({ jaViu, careMode })) return;
        const { supabase } = await import("@/integrations/supabase/client");
        const u = await supabase.auth.getUser();
        if (!vivo) return;
        const uid = u.data.user?.id ?? null;
        setEuId(uid);
        setPasso(lerPassoDaComunidade(uid));
        setAberto(true);
      } catch {
        /* Sem jornada, sem tutorial — melhor não abrir que abrir duas vezes. */
      }
    })();
    return () => {
      vivo = false;
    };
  }, [bancada, careMode]);

  async function encerrar() {
    setAberto(false);
    aoFechar?.();
    if (bancada) return;
    try {
      const { lsSet } = await import("@/lib/journey-sync");
      lsSet(CHAVE_ONBOARDING_COMUNIDADE, true);
      /* O passo é transitório: acabou o tutorial, some. */
      localStorage.removeItem(chaveDoPassoDaComunidade(euId));
    } catch {
      /* Gravação falhou: ela vê de novo, que é melhor que a tela travar. */
    }
  }

  if (!aberto) return null;
  const cartao = CARTOES_DA_COMUNIDADE[passo];
  if (!cartao) return null;
  const proximo = passoSeguinte(passo);

  return (
    <div
      /* ⚠️ **O VÉU PARA EM `z-38`, e a barra de baixo vive em `z-40`.** Não é
         número solto: é a mesma solução do tutorial do mascote, e aqui ela
         também conserta uma incoerência de TEXTO — o terceiro cartão diz "use o
         SOS na barra de baixo", e com o véu por cima ele apontava para uma
         barra apagada e coberta pelo próprio cartão. Assim ela lê a frase com o
         botão aceso à vista.

         E o `mb` reserva a altura da barra mais a área segura: sobreposto, o
         tutorial cobriria justamente o que está explicando. */
      className="fixed inset-0 z-[38] flex items-end justify-center bg-black/55 px-4 pb-[calc(var(--safe-bottom)+7.5rem)] pt-6"
      role="dialog"
      aria-modal="true"
      aria-label="Como funciona a Comunidade"
    >
      <div className="w-full max-w-[430px] rounded-3xl bg-background p-5 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          {/* ⚠️ Os pontinhos dizem QUANTO FALTA. Sem eles, quatro telas seguidas
              parecem não ter fim, e ela sai no primeiro toque. */}
          <div className="flex gap-1.5" aria-hidden>
            {CARTOES_DA_COMUNIDADE.map((c, i) => (
              <span
                key={c.id}
                className={`h-1.5 rounded-full transition-all ${
                  i === passo ? "w-5 bg-primary" : "w-1.5 bg-muted-foreground/30"
                }`}
              />
            ))}
          </div>
          {/* ⚠️ **"Pular" FICA VISÍVEL O TEMPO TODO.** Prender a paciente em
              quatro telas para poder usar uma aba que ela acabou de abrir é a
              definição de tutorial ruim — a mesma lição do tutorial do mascote,
              onde a barra continua clicável durante a aula. */}
          <button
            type="button"
            onClick={() => void encerrar()}
            className="press min-h-[44px] px-2 text-[13px] text-muted-foreground"
          >
            Pular
          </button>
        </div>

        <div className="mb-3 text-[34px] leading-none" aria-hidden>
          {cartao.emoji}
        </div>
        <h2 className="text-[19px] font-semibold leading-tight">{cartao.titulo}</h2>
        <p className="mt-2 text-[14px] leading-snug text-muted-foreground">{cartao.texto}</p>

        <button
          type="button"
          onClick={() => (proximo === null ? void encerrar() : irPara(proximo))}
          className="press mt-5 min-h-[48px] w-full rounded-full bg-primary text-[15px] font-semibold text-primary-foreground"
        >
          {proximo === null ? "Entendi" : "Continuar"}
        </button>
      </div>
    </div>
  );
}
