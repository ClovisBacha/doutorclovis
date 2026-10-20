import { router, useFocusEffect } from "expo-router";
import { Award, ChevronRight, Footprints, PenLine, Sparkles, Wind } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Linking, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Botao, Cartao, Carregando, NaoConsegueLer, T, Tela, toque } from "~/componentes/base";
import { rota } from "~/componentes/jornada/bancada";
import { SementesSubindo } from "~/componentes/jornada/efeitos";
import { BolhaViva } from "~/componentes/movimento";
import { corJornada } from "~/componentes/jornada/cores";
import { CartaoDoDia, type ItemDoDia } from "~/componentes/jornada/dia-de-hoje";
import {
  lerCarteiraDoDia,
  lerContagemDeAmigas,
  lerConquistas,
  lerProgressoDoDia,
  pagarDiaFechado,
  pagarMomento,
  type CarteiraOk,
  type LeituraDasConquistas,
} from "~/componentes/jornada/economia";
import { useLivresDeHoje } from "~/componentes/jornada/livres";
import { lerOCantinho, type CantinhoOk } from "~/componentes/recompensas/economia-do-cantinho";
import { fundoBgFor } from "@/lib/cantinho";
import { SKIN_KEY, TRILHA_SKINS } from "@/lib/trilha-skins";
import { CHAVE_DECOR, lerDecoracao, type Decoracao } from "~/lib/jornada/enfeites";
import { Pulsando } from "~/componentes/jornada/pecas";
import { FolhasDoPlacar, Placar, type FolhaDoPlacar } from "~/componentes/jornada/placar";
import { FestaDoMarco } from "~/componentes/jornada/marco";
import { CHAVE_MARCOS_VISTOS, festaDoExtrato, lerVistos, marcarVistos } from "~/lib/jornada/marcos";
import { Caminho } from "~/componentes/caminho/caminho";
import { useJornada, type DiaDaJornada } from "~/componentes/jornada/usarJornada";
import { ehBancada, parametroDaBancada } from "~/lib/bancada";
import { TelaDeHoje } from "~/componentes/jornada/hoje";
import {
  cuidadosDoDia,
  dataDeHoje,
  diasQueFaltam,
  saudacao,
  type ChaveDoCuidado,
} from "~/lib/jornada/hoje";
import { primeiroNome } from "~/lib/gestacao";
import { recadoDaBolha } from "@/lib/recado-da-bolha";
import { gestChallenge, posChallenge } from "@/lib/daily-challenges";
import { temQuizNoDia } from "@/lib/daily-quizzes";
import { BarraDoTopo } from "~/componentes/jornada/pecas";
import { useSessao } from "~/lib/sessao";
import { montarGrade, paraResgatar, placar as placarDasConquistas } from "~/lib/jornada/conquistas";
import { conquistaPorChave, type ConquistaDef } from "@/lib/conquistas";
import { diaLongo } from "~/lib/jornada/dia";
import {
  estadoAtual,
  gravarChave,
  marcar,
  marcarFlagDoDia,
  type EstadoDaLoja,
} from "~/lib/jornada/loja";
import {
  CHAVE_CHECKIN,
  fasesDaGestacao,
  lerCheckin,
  marcouHumorHoje,
  novoCheckin,
} from "~/lib/jornada/caminho";
import {
  CHAVE_FIGURINHAS,
  chaveDoPresente,
  diasFechados,
  feito,
  listaDeNumeros,
  flagsDoDia,
} from "~/lib/jornada/momentos";
import {
  atividadesSemRecibo,
  bonusResolvido,
  diasDaReconciliacao,
} from "~/lib/jornada/reconciliacao";
import type { Atividade } from "~/servidor/economia";
import { chama as calcularChama } from "~/lib/jornada/trilha";
import { ALVO_MINIMO, cor, espaco, fonte, raio, sombra } from "~/tema";

/**
 * A ABA JORNADA — o coração do app: um dia de cada vez, cinco momentos por dia.
 *
 * Quatro caras, pela situação dela:
 *   · gestação: o CAMINHO (componentes/caminho) — o desenho aprovado do site:
 *     a faixa do topo, o humor do dia, e a trilha inteira com fases, semanas
 *     e um nó por dia. Tocar num dia abre a folha do dia (/jornada/dia), com
 *     os cinco momentos; a cesta abre as Recompensas (Meu Cantinho e
 *     Conquistas);
 *   · pós-parto: o desafio do dia, a respiração e a gratidão (sem aula, sem
 *     pagamento — o servidor só paga na gestação);
 *   · Modo Cuidado: três cuidados com ela, sem placar, sem bebê, sem festa;
 *   · sem DUM nem ultrassom: a jornada explica o que falta e oferece o que
 *     não depende da semana.
 */
export default function AbaJornada() {
  const { dia, loja } = useJornada();

  if (dia.modo === "carregando") {
    return (
      <Tela>
        <Carregando texto="Abrindo a sua jornada…" />
      </Tela>
    );
  }
  if (dia.modo === "falhou") {
    return (
      <Tela>
        <T tipo="titulo">Sua jornada</T>
        <NaoConsegueLer
          sossego="Tudo o que você já fez na jornada continua guardado."
          aoTentar={dia.tentar}
        />
      </Tela>
    );
  }
  if (dia.cuidado) return <JornadaDoCuidado uid={dia.uid} />;
  if (dia.modo === "gestacao") return <JornadaDaGestacao dia={dia} loja={loja} />;
  if (dia.modo === "pos") return <JornadaDoPosParto dia={dia} loja={loja} />;
  return <JornadaSemData uid={dia.uid} />;
}

const ir = (caminho: string) => router.push(rota(caminho) as never);

const ROTA_DO_CUIDADO: Record<ChaveDoCuidado, string> = {
  aula: "/jornada/aula",
  movement: "/jornada/mexer",
  meditation: "/jornada/meditar",
  bonding: "/jornada/bebe",
  gratitude: "/jornada/gratidao",
};

/** A hora que escolhe o céu e a saudação (`&hora=` na bancada). */
function horaDaTela(): number {
  const h = Number(parametroDaBancada("hora"));
  return Number.isFinite(h) && h >= 0 && h < 24 && parametroDaBancada("hora") != null
    ? h
    : new Date().getHours();
}

/* ══════════════════════════════════════════════════════════════════════════
   Carteira, conquistas e reconciliação — o que a aba lê ao ganhar foco
   ══════════════════════════════════════════════════════════════════════════ */

type EstadoDaCarteira =
  | { estado: "carregando" }
  | { estado: "falhou" }
  | { estado: "ok"; dados: CarteiraOk };

function useCarteira(ativa: boolean) {
  const [carteira, setCarteira] = useState<EstadoDaCarteira>({ estado: "carregando" });
  const carregar = useCallback(async () => {
    setCarteira((c) => (c.estado === "ok" ? c : { estado: "carregando" }));
    const r = await lerCarteiraDoDia();
    setCarteira(r ? { estado: "ok", dados: r } : { estado: "falhou" });
  }, []);
  useFocusEffect(
    useCallback(() => {
      if (ativa) void carregar();
    }, [ativa, carregar]),
  );
  return { carteira, recarregar: carregar };
}

function useConquistas(ativa: boolean) {
  const [leitura, setLeitura] = useState<LeituraDasConquistas | null | "carregando">("carregando");
  useFocusEffect(
    useCallback(() => {
      if (!ativa) return;
      let vivo = true;
      void lerConquistas().then((r) => {
        if (vivo) setLeitura(r);
      });
      return () => {
        vivo = false;
      };
    }, [ativa]),
  );
  return leitura;
}

/**
 * A festa dos marcos (`~/lib/jornada/marcos`). A conferência das conquistas é
 * quando o servidor paga a semana nova e o trimestre: depois dela a carteira é
 * relida, e o marco novo do extrato vira festa uma vez (os vistos sobem com a
 * jornada, e a festa não se repete noutro aparelho).
 */
function useFestaDoMarco(o: {
  carteira: EstadoDaCarteira;
  recarregar: () => Promise<void>;
  conquistas: LeituraDasConquistas | null | "carregando";
  loja: EstadoDaLoja;
  cuidado: boolean;
}) {
  const { carteira, recarregar, conquistas, loja, cuidado } = o;
  useEffect(() => {
    if (conquistas && conquistas !== "carregando" && !conquistas.careMode) void recarregar();
  }, [conquistas, recarregar]);
  const vistos = lerVistos(loja.blob[CHAVE_MARCOS_VISTOS]);
  const pronta = loja.pronto && (loja.nuvem === "ok" || loja.bancada);
  const festa =
    !cuidado && pronta && carteira.estado === "ok" && !carteira.dados.careMode
      ? festaDoExtrato(carteira.dados.recent, vistos, new Date())
      : null;
  const fechar = () => {
    if (festa) gravarChave(CHAVE_MARCOS_VISTOS, marcarVistos(vistos, festa.chaves));
  };
  return { festa, fechar };
}

/** Os dias cujo bônus das cinco estrelas o servidor já resolveu, neste processo. */
const bonusResolvidos = new Set<number>();

/**
 * Ao abrir a aba (`~/lib/jornada/reconciliacao`), para hoje e ontem: o que o
 * servidor já registrou (feito no site ou noutro aparelho) acende aqui; o que
 * está aceso aqui mas o servidor não registrou (rede caiu no fim da
 * atividade) é pago agora; e o bônus das cinco estrelas é pedido de novo
 * SEMPRE que o dia está fechado aqui — e não só quando a reconciliação o
 * fecha. Antes, a resposta engolida no fim da quinta atividade era a única
 * tentativa: os 20 🌱 sumiam sem rastro (o site já tentava de novo; out/2026).
 * O servidor não paga duas vezes a mesma atividade nem o mesmo bônus, e
 * reconfere as quatro atividades antes de pagá-lo: repetir é seguro.
 */
function useReconciliacao(D: number, pronta: boolean, aoMudarSaldo: () => void) {
  const emVoo = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!pronta || ehBancada() || emVoo.current) return;
      emVoo.current = true;
      void (async () => {
        try {
          let pagou = false;
          for (const dia of diasDaReconciliacao(D)) {
            const noServidor = await lerProgressoDoDia(dia);
            if (!noServidor) continue;
            for (const a of noServidor) marcar(dia, a);
            const pagas: Atividade[] = [];
            for (const a of atividadesSemRecibo(flagsDoDia(estadoAtual().blob, dia), noServidor)) {
              const g = await pagarMomento(dia, a);
              if (g != null) pagas.push(a);
              if (g && g > 0) pagou = true;
            }
            if (bonusResolvidos.has(dia) || !diasFechados(estadoAtual().blob).includes(dia))
              continue;
            const b = await pagarDiaFechado(dia);
            if (b && b > 0) pagou = true;
            if (b != null && (b > 0 || bonusResolvido(noServidor, pagas))) bonusResolvidos.add(dia);
          }
          if (pagou) aoMudarSaldo();
        } finally {
          emVoo.current = false;
        }
      })();
    }, [D, pronta, aoMudarSaldo]),
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Gestação
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * A gestação em duas vistas: "hoje" (a aba — o cuidado do dia, com os avisos,
 * a festa dos marcos e a reconciliação) e "trilha" (a rota /jornada/trilha — o
 * Caminho inteiro, aberto por "Ver minha jornada"). Uma função só para as duas
 * lerem a mesma carteira e o mesmo Cantinho; o que é da abertura do dia roda
 * só na vista "hoje", para não festejar nem cobrar duas vezes.
 */
export function JornadaDaGestacao({
  dia,
  loja,
  vista = "hoje",
}: {
  dia: Extract<DiaDaJornada, { modo: "gestacao" }>;
  loja: EstadoDaLoja;
  vista?: "hoje" | "trilha";
}) {
  const ehHoje = vista === "hoje";
  const { D, semana, perfil, hoje } = dia;
  const { carteira, recarregar } = useCarteira(true);
  /* A festa dos marcos chama a conferência das conquistas lá embaixo; os
     hooks ficam todos antes do retorno das 42 semanas. */
  /* O servidor sabe do Modo Cuidado antes do aparelho (ligado noutro lugar):
     a carteira volta com `careMode`, e a trilha relê o perfil na hora em vez
     de seguir mostrando o bebê e as estrelas a quem acabou de perdê-lo. */
  const { recarregarPerfil } = useSessao();
  const servidorDizCuidado = carteira.estado === "ok" && carteira.dados.careMode === true;
  useEffect(() => {
    if (servidorDizCuidado) void recarregarPerfil();
  }, [servidorDizCuidado, recarregarPerfil]);
  /* As conquistas moram nas Recompensas, mas a leitura delas é o que
     DESBLOQUEIA no servidor as que ela acabou de ganhar — por isso a aba
     confere ao ganhar foco. E o que a conferência traz agora aparece aqui: o
     aviso da conquista nova e, na cestinha da loja, quantas esperam o toque
     que paga (antes ela ganhava e não sabia). */
  const conquistas = useConquistas(true);
  const marco = useFestaDoMarco({
    carteira,
    recarregar,
    conquistas,
    loja,
    cuidado: dia.cuidado || !ehHoje,
  });
  const aResgatar = useMemo(() => {
    if (!conquistas || conquistas === "carregando" || conquistas.careMode) return 0;
    if (conquistas.resgatadas === null) return 0;
    return paraResgatar(montarGrade(conquistas.unlocked, conquistas.resgatadas));
  }, [conquistas]);
  const [novasVistas, setNovasVistas] = useState<string | null>(null);
  const novas = useMemo(() => {
    if (!conquistas || conquistas === "carregando" || conquistas.careMode) return [];
    return conquistas.novas.map((k) => conquistaPorChave(k)).filter((d): d is ConquistaDef => !!d);
  }, [conquistas]);
  const chaveDasNovas = novas.map((d) => d.key).join(",");
  const mostrarNovas = novas.length > 0 && novasVistas !== chaveDasNovas;
  useReconciliacao(D, loja.pronto && ehHoje, recarregar);
  const amigas = useContagemDeAmigas();
  const [folha, setFolha] = useState<FolhaDoPlacar>(null);

  const { dias: diasDeChama, perdoes } = calcularChama(loja.blob, D);
  const nomeDoBebe = (perfil.baby_name ?? "").trim() || null;
  const checkin = lerCheckin(loja.blob[CHAVE_CHECKIN]);
  const fases = useMemo(() => fasesDaGestacao(D), [D]);

  const presente = carteira.estado === "ok" ? carteira.dados.presente : null;
  const presenteNovo = presente && !loja.blob[chaveDoPresente(presente.quando)] ? presente : null;

  /* ── O Cantinho na trilha: o que ela tem, o cenário e a pele ── */
  const cantinho = useCantinhoDaTrilha();
  const decorGravada = loja.blob[CHAVE_DECOR];
  const decoracao = useMemo(() => lerDecoracao(decorGravada), [decorGravada]);
  const possuidos = cantinho ? (cantinho.careMode ? [] : cantinho.owned) : null;
  const cenario =
    cantinho && !cantinho.careMode ? fundoBgFor(cantinho.equippedFundo, semana) : null;
  const skin = loja.blob[SKIN_KEY];
  const pele = typeof skin === "string" ? (TRILHA_SKINS[skin] ?? null) : null;
  const aoGravarDecoracao = useCallback((d: Decoracao) => gravarChave(CHAVE_DECOR, d), []);

  /* Passou de 42 semanas: a trilha (presa no dia 300) dá lugar ao alerta. */
  if (dia.passouDe42) return <AlertaDas42Semanas nomeDoBebe={nomeDoBebe} />;

  const avisos = (
    <>
      {carteira.estado === "falhou" ? (
        <NaoConsegueLer
          sossego="Os seus momentos de hoje continuam valendo e ficam guardados neste aparelho."
          aoTentar={() => void recarregar()}
        />
      ) : null}
      {ehHoje && mostrarNovas ? (
        <AvisoDeConquista
          conquistas={novas}
          aoPegar={() => {
            setNovasVistas(chaveDasNovas);
            ir("/jornada/recompensas?aba=conquistas");
          }}
          aoFechar={() => setNovasVistas(chaveDasNovas)}
        />
      ) : null}
      {ehHoje && presenteNovo ? (
        <AvisoDePresente
          quantidade={presenteNovo.quantidade}
          de={presenteNovo.de}
          nome={presenteNovo.nome}
          aoFechar={() => gravarChave(chaveDoPresente(presenteNovo.quando), true)}
        />
      ) : null}
    </>
  );

  if (ehHoje) {
    const hora = horaDaTela();
    const flags = flagsDoDia(loja.blob, D);
    const cuidados = cuidadosDoDia({
      flags,
      semana,
      nomeDoBebe,
      desafio: temQuizNoDia(D) ? null : (gestChallenge(D)?.label ?? null),
    });
    const feitos = cuidados.filter((c) => c.feito).length;
    return (
      <View style={{ flex: 1, backgroundColor: cor.fundo }}>
        <TelaDeHoje
          D={D}
          cartao={{
            semana,
            nomeDoBebe,
            diasCheios: diasFechados(loja.blob).filter((d) => Math.floor(d / 7) === semana).length,
            chama: diasDeChama,
            faltam: diasQueFaltam(D),
          }}
          saudacao={saudacao(hora, primeiroNome(perfil.display_name))}
          data={dataDeHoje(hoje)}
          nomeDoBebe={nomeDoBebe}
          semana={semana}
          dias={dia.diaNaSemana}
          faltam={diasQueFaltam(D)}
          hora={hora}
          cuidados={cuidados}
          recado={recadoDaBolha({
            feitos,
            total: 5,
            dia: D,
            hora,
            bebe: nomeDoBebe ?? undefined,
            semana,
            posParto: false,
            careMode: false,
          })}
          humor={feitos >= 5 ? "orgulhosa" : feitos >= 4 ? "surpresa" : "feliz"}
          chama={diasDeChama}
          avisos={avisos}
          aoAbrir={(c) => ir(ROTA_DO_CUIDADO[c])}
          aoVerJornada={() => ir("/jornada/trilha")}
          sos={null}
        />
        <FestaDoMarco festa={marco.festa} nomeDoBebe={nomeDoBebe} aoFechar={marco.fechar} />
      </View>
    );
  }

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: cor.fundo }}>
      <View style={{ paddingHorizontal: espaco.lg }}>
        <BarraDoTopo titulo="Minha jornada" />
      </View>
      <Caminho
        hojeD={D}
        semanaAtual={semana}
        fases={fases}
        blob={loja.blob}
        saldo={carteira.estado === "ok" ? carteira.dados.balance : null}
        trofeus={carteira.estado === "ok" ? carteira.dados.trofeus : null}
        carregandoCarteira={carteira.estado === "carregando"}
        chama={diasDeChama}
        perdoes={perdoes}
        amigas={amigas}
        nomeDoBebe={nomeDoBebe}
        humorFeito={marcouHumorHoje(checkin, hoje)}
        aoMarcarHumor={(humor) => {
          gravarChave(CHAVE_CHECKIN, novoCheckin(checkin, humor, hoje));
          marcarFlagDoDia(D, "humor");
        }}
        aoAbrirDia={(d) => ir(`/jornada/dia?D=${d}`)}
        aoAbrirSemana={(s) => {
          /* Abrir o álbum de uma semana que já chegou guarda a figurinha dela,
             como no site (`collectSticker`). */
          const figurinhas = listaDeNumeros(loja.blob[CHAVE_FIGURINHAS]);
          if (s <= semana && !figurinhas.includes(s))
            gravarChave(
              CHAVE_FIGURINHAS,
              [...figurinhas, s].sort((a, b) => a - b),
            );
          ir(`/jornada/semana?semana=${s}`);
        }}
        aResgatar={aResgatar}
        aoAbrirLoja={() =>
          ir(aResgatar > 0 ? "/jornada/recompensas?aba=conquistas" : "/jornada/recompensas")
        }
        aoAbrirAmigas={() => router.navigate("/comunidade" as never)}
        aoAbrirFolha={setFolha}
        aoContarNascimento={() => router.push("/ritual?editar=1")}
        decoracao={decoracao}
        possuidos={possuidos}
        cenario={cenario}
        pele={pele}
        podeSemear={loja.pronto && loja.nuvem === "ok"}
        aoGravarDecoracao={aoGravarDecoracao}
        topo={avisos}
      />
      <FolhasDoPlacar
        aberta={folha}
        aoFechar={() => setFolha(null)}
        chama={diasDeChama}
        perdoes={perdoes}
        trofeus={carteira.estado === "ok" ? carteira.dados.trofeus : null}
      />
      <FestaDoMarco festa={marco.festa} nomeDoBebe={nomeDoBebe} aoFechar={marco.fechar} />
    </SafeAreaView>
  );
}

/**
 * O Cantinho dela, relido a cada foco da aba: quem compra um enfeite nas
 * Recompensas e volta ao Caminho já o encontra espalhado. Falha de leitura
 * guarda a última leitura boa (e, sem nenhuma, `null`: a trilha mostra o
 * layout gravado, como o site enquanto a lista não chega).
 */
function useCantinhoDaTrilha(): CantinhoOk | null {
  const [c, setC] = useState<CantinhoOk | null>(null);
  useFocusEffect(
    useCallback(() => {
      let vivo = true;
      void lerOCantinho().then((r) => {
        if (vivo && r) setC(r);
      });
      return () => {
        vivo = false;
      };
    }, []),
  );
  return c;
}

/** O número de amigas da faixa do Caminho, relido a cada foco da aba. */
function useContagemDeAmigas(): number | null {
  const [n, setN] = useState<number | null>(null);
  useFocusEffect(
    useCallback(() => {
      let vivo = true;
      void lerContagemDeAmigas().then((r) => {
        if (vivo && r != null) setN(r);
      });
      return () => {
        vivo = false;
      };
    }, []),
  );
  return n;
}

/* ══════════════════════════════════════════════════════════════════════════
   Pós-parto
   ══════════════════════════════════════════════════════════════════════════ */

function JornadaDoPosParto({
  dia,
  loja,
}: {
  dia: Extract<DiaDaJornada, { modo: "pos" }>;
  loja: EstadoDaLoja;
}) {
  const { D, idadeDias, perfil } = dia;
  const { carteira, recarregar } = useCarteira(true);
  const conquistas = useConquistas(true);
  const marco = useFestaDoMarco({ carteira, recarregar, conquistas, loja, cuidado: dia.cuidado });
  const flags = flagsDoDia(loja.blob, D, true);
  const desafio = posChallenge(D);
  const { dias: diasDeChama, perdoes } = calcularChama(loja.blob, D, true);
  const nomeDoBebe = (perfil.baby_name ?? "").trim() || null;
  const quem = nomeDoBebe ?? "O bebê";

  const itens: ItemDoDia[] = [];
  if (desafio) {
    itens.push({
      chave: "desafio",
      titulo: `Desafio do dia ${desafio.emoji}`,
      sub: desafio.label,
      linhasDoSub: 3,
      marcaPorToque: true,
      Icone: Sparkles,
      feito: feito(flags, "aula"),
      aoTocar: () => {
        if (!feito(flags, "aula")) marcar(D, "aula", true);
      },
    });
  }
  itens.push(
    {
      chave: "meditar",
      titulo: "Respirar",
      sub: "Respiração 4-4-8 guiada",
      Icone: Wind,
      feito: feito(flags, "meditation"),
      aoTocar: () => ir("/jornada/meditar"),
    },
    {
      chave: "gratidao",
      titulo: "Gratidão",
      sub: "Uma coisa boa de hoje",
      Icone: PenLine,
      feito: feito(flags, "gratitude"),
      aoTocar: () => ir("/jornada/gratidao"),
    },
  );
  const feitos = itens.filter((i) => i.feito).length;

  return (
    <Tela>
      <Saudacao titulo="Sua jornada" sub="O quarto trimestre, um dia de cada vez." />
      <Placar
        saldo={carteira.estado === "ok" ? carteira.dados.balance : null}
        trofeus={carteira.estado === "ok" ? carteira.dados.trofeus : null}
        carregando={carteira.estado === "carregando"}
        chama={diasDeChama}
        perdoes={perdoes}
        pos
      />
      {carteira.estado === "falhou" ? (
        <NaoConsegueLer
          sossego="Os seus momentos de hoje continuam guardados."
          aoTentar={() => void recarregar()}
        />
      ) : null}
      <CartaoDoDia
        sobre={`Semana ${Math.floor(idadeDias / 7) + 1} de vida`}
        titulo={
          idadeDias === 0
            ? `🍼 ${quem} nasceu hoje`
            : `🍼 ${quem} com ${idadeDias} ${idadeDias === 1 ? "dia" : "dias"}`
        }
        linha={null}
        feitos={feitos}
        total={itens.length}
        itens={itens}
        mostrarEstrelas={false}
        rodape={
          <T tipo="apagado">
            {feitos === itens.length
              ? "Tudo feito hoje. Descanse quando der."
              : "Qualquer momento acende a chama de hoje."}
          </T>
        }
      />
      <BotaoDeConquistas leitura={conquistas} posParto />
      <FestaDoMarco festa={marco.festa} nomeDoBebe={nomeDoBebe} aoFechar={marco.fechar} />
    </Tela>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Modo Cuidado — sem placar, sem bebê, sem festa
   ══════════════════════════════════════════════════════════════════════════ */

function JornadaDoCuidado({ uid }: { uid: string }) {
  const feitos = useLivresDeHoje(uid);
  const itens: ItemDoDia[] = [
    {
      chave: "meditar",
      titulo: "Respirar",
      sub: "Um minuto de respiração lenta",
      Icone: Wind,
      feito: feitos.has("meditation"),
      rotuloDoFeito: "Feito hoje",
      aoTocar: () => ir("/jornada/meditar"),
    },
    {
      chave: "mexer",
      titulo: "Mexer devagar",
      sub: "Alongamentos leves, sem ir ao chão",
      Icone: Footprints,
      feito: feitos.has("movement"),
      rotuloDoFeito: "Feito hoje",
      aoTocar: () => ir("/jornada/mexer"),
    },
    {
      chave: "gratidao",
      titulo: "Escrever",
      sub: "Uma linha sobre o seu dia",
      Icone: PenLine,
      feito: feitos.has("gratitude"),
      rotuloDoFeito: "Feito hoje",
      aoTocar: () => ir("/jornada/gratidao"),
    },
  ];
  return (
    <Tela>
      <Saudacao
        titulo="Cuidar de você"
        sub="Um momento por dia, no seu ritmo. Sem placar e sem pressa."
      />
      <CartaoDoDia
        sobre={dataPorExtenso(new Date())}
        titulo="Três cuidados com você"
        feitos={0}
        total={3}
        itens={itens}
        mostrarEstrelas={false}
      />
      <T tipo="apagado">
        Se precisar de ajuda agora, o botão SOS fica sempre aqui embaixo, em qualquer tela.
      </T>
    </Tela>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Sem a semana da gestação
   ══════════════════════════════════════════════════════════════════════════ */

function JornadaSemData({ uid }: { uid: string }) {
  const feitos = useLivresDeHoje(uid);
  return (
    <Tela>
      <Saudacao titulo="Sua jornada" sub="Um dia de cada vez." />
      <Cartao fundo={corJornada.roxoNevoa}>
        <T tipo="rotulo" cor={corJornada.roxoEscuro}>
          Falta saber de quantas semanas você está
        </T>
        <T tipo="apagado">
          A aula de cada dia, os desafios e a trilha seguem a sua gestação. Assim que o seu perfil
          tiver a data da última menstruação ou a do ultrassom, a jornada se monta sozinha.
        </T>
        <Botao
          rotulo="Informar a data"
          tipo="secundario"
          aoTocar={() => router.push("/ritual?editar=1")}
        />
      </Cartao>
      <CartaoDoDia
        sobre={dataPorExtenso(new Date())}
        titulo="Enquanto isso"
        feitos={0}
        total={2}
        mostrarEstrelas={false}
        itens={[
          {
            chave: "meditar",
            titulo: "Meditar",
            sub: "Respiração 4-4-8 guiada",
            Icone: Wind,
            feito: feitos.has("meditation"),
            rotuloDoFeito: "Feito hoje",
            aoTocar: () => ir("/jornada/meditar"),
          },
          {
            chave: "gratidao",
            titulo: "Gratidão",
            sub: "Uma coisa boa de hoje",
            Icone: PenLine,
            feito: feitos.has("gratitude"),
            rotuloDoFeito: "Feito hoje",
            aoTocar: () => ir("/jornada/gratidao"),
          },
        ]}
      />
    </Tela>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Peças da aba
   ══════════════════════════════════════════════════════════════════════════ */

const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

function dataPorExtenso(d: Date): string {
  return `${diaLongo(d)}, ${d.getDate()} de ${MESES[d.getMonth()]}`;
}

function Saudacao({ titulo, sub }: { titulo: string; sub: string }) {
  return (
    <View style={{ gap: 2, marginBottom: espaco.xs }}>
      <T tipo="titulo">{titulo}</T>
      <T tipo="apagado">{sub}</T>
    </View>
  );
}

function BotaoDeConquistas({
  leitura,
  posParto,
}: {
  leitura: LeituraDasConquistas | null | "carregando";
  posParto: boolean;
}) {
  const resumo = useMemo(() => {
    if (!leitura || leitura === "carregando") return null;
    const g = montarGrade(leitura.unlocked, leitura.resgatadas);
    return { ...placarDasConquistas(g, posParto), resgatar: paraResgatar(g) };
  }, [leitura, posParto]);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        resumo
          ? `Conquistas: ${resumo.feitas} de ${resumo.total}${resumo.resgatar ? `, ${resumo.resgatar} para resgatar` : ""}`
          : "Conquistas"
      }
      onPress={() => {
        toque();
        ir("/jornada/recompensas?aba=conquistas");
      }}
      style={({ pressed }) => [
        {
          flexDirection: "row",
          alignItems: "center",
          gap: espaco.md,
          padding: espaco.lg,
          borderRadius: raio.lg,
          backgroundColor: cor.cartao,
          opacity: pressed ? 0.8 : 1,
          marginTop: espaco.sm,
        },
        sombra,
      ]}
    >
      <View
        style={{
          width: 48,
          height: 48,
          borderRadius: 24,
          backgroundColor: corJornada.trofeuFundo,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Award size={26} color={corJornada.trofeu} strokeWidth={2.2} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontFamily: fonte.forte, fontSize: 17, color: cor.texto }}>Conquistas</Text>
        <Text style={{ fontFamily: fonte.normal, fontSize: 14, color: cor.textoApagado }}>
          {leitura === "carregando"
            ? "Conferindo…"
            : resumo
              ? `${resumo.feitas} de ${resumo.total} desbloqueadas`
              : "Os emblemas da sua jornada"}
        </Text>
      </View>
      {resumo && resumo.resgatar > 0 ? (
        <Pulsando>
          <View
            style={{
              backgroundColor: corJornada.roxo,
              borderRadius: raio.pilula,
              paddingHorizontal: 10,
              paddingVertical: 5,
            }}
          >
            <Text style={{ fontFamily: fonte.forte, fontSize: 13, color: cor.branco }}>
              {resumo.resgatar} para resgatar
            </Text>
          </View>
        </Pulsando>
      ) : (
        <ChevronRight size={22} color={cor.textoApagado} />
      )}
    </Pressable>
  );
}

function AvisoDePresente({
  quantidade,
  de,
  nome,
  aoFechar,
}: {
  quantidade: number;
  de: "medico" | "amiga" | "criadora";
  nome: string | null;
  aoFechar: () => void;
}) {
  /* Sem nome, quem deu é dito pelo papel, como no site: um presente do médico
     dela não pode virar "da equipe da Obstétrica". */
  const deQuem = nome?.trim()
    ? `de ${nome.trim()}`
    : de === "medico"
      ? "do seu médico"
      : de === "amiga"
        ? "de uma amiga"
        : "de quem te trouxe para cá";
  return (
    <Cartao fundo={corJornada.sementinhaFundo}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: espaco.md }}>
        {/* A bolha abre a caixa e brotam sementinhas. */}
        <BolhaViva humor="presente" tamanho={88} />
        <View style={{ flex: 1 }}>
          <T tipo="rotulo" cor={corJornada.sementinha}>
            Você ganhou {quantidade} sementinhas 🌱
          </T>
          <T tipo="apagado">Um presente {deQuem}.</T>
        </View>
      </View>
      <Botao rotulo="Que bom!" tipo="secundario" aoTocar={aoFechar} />
      <SementesSubindo quantidade={quantidade} disparo={quantidade} />
    </Cartao>
  );
}

/**
 * A CONQUISTA NOVA — a conferência da aba acabou de desbloquear. A conquista
 * espera o toque que paga (a régua do Duolingo, decisão do dono), e sem este
 * aviso ela nem sabia que havia o que tocar.
 */
function AvisoDeConquista({
  conquistas,
  aoPegar,
  aoFechar,
}: {
  conquistas: readonly ConquistaDef[];
  aoPegar: () => void;
  aoFechar: () => void;
}) {
  const uma = conquistas.length === 1 ? conquistas[0]! : null;
  return (
    <Cartao fundo={corJornada.roxoFundo}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: espaco.md }}>
        <Text style={{ fontSize: 40, lineHeight: 48 }}>{uma ? uma.emoji : "🏅"}</Text>
        <View style={{ flex: 1 }}>
          <T tipo="rotulo" cor={corJornada.roxo}>
            {uma ? `Conquista nova: ${uma.title}` : `${conquistas.length} conquistas novas!`}
          </T>
          <T tipo="apagado">Toque nela em Conquistas para pegar as suas sementinhas 🌱</T>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Fechar o aviso"
          hitSlop={10}
          onPress={() => {
            toque();
            aoFechar();
          }}
          style={{ alignSelf: "flex-start", minWidth: 28, minHeight: 28, alignItems: "center" }}
        >
          <Text style={{ fontFamily: fonte.titulo, fontSize: 18, color: corJornada.roxo }}>×</Text>
        </Pressable>
      </View>
      <Botao rotulo="Ver as conquistas" corFundo={corJornada.roxo} aoTocar={aoPegar} />
    </Cartao>
  );
}

/**
 * PASSOU DE 42 SEMANAS — o alerta do site, no lugar do Caminho: avaliação do
 * bem-estar do bebê HOJE, e direto para a maternidade com qualquer sinal. A
 * única ação de jornada que sobra é contar o nascimento. (O site mandava falar
 * com o consultório pela agenda, que o app não tem; aqui o caminho é o SOS,
 * que traz o médico e os contatos dela.)
 */
function AlertaDas42Semanas({ nomeDoBebe }: { nomeDoBebe: string | null }) {
  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: cor.fundo }}>
      <ScrollView
        contentContainerStyle={{ padding: espaco.lg, gap: espaco.lg, paddingBottom: 120 }}
      >
        <View
          style={{
            borderRadius: 24,
            borderWidth: 2,
            borderColor: "#ffd230",
            backgroundColor: "#fffbeb",
            padding: espaco.xl,
            gap: espaco.sm,
          }}
        >
          <Text
            style={{
              fontFamily: fonte.media,
              fontSize: 13,
              letterSpacing: 0.6,
              textTransform: "uppercase",
              color: "#bb4d00",
            }}
          >
            Acompanhamento necessário
          </Text>
          <Text
            accessibilityRole="header"
            style={{ fontFamily: fonte.forte, fontSize: 18, lineHeight: 24, color: "#7b3306" }}
          >
            Sua gestação passou de 42 semanas
          </Text>
          <Text
            style={{ fontFamily: fonte.normal, fontSize: 14, lineHeight: 22, color: "#973c00" }}
          >
            Entre em contato com o consultório do seu médico{" "}
            <Text style={{ fontFamily: fonte.forte }}>hoje</Text> para avaliação do bem-estar do
            bebê e decisão sobre o parto. Se notar diminuição dos movimentos, perda de líquido ou
            sangramento, vá direto à maternidade.
          </Text>
          <View
            style={{ marginTop: espaco.sm, flexDirection: "row", flexWrap: "wrap", gap: espaco.sm }}
          >
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push("/sos")}
              style={({ pressed }) => ({
                minHeight: ALVO_MINIMO,
                paddingHorizontal: espaco.xl,
                borderRadius: 999,
                backgroundColor: "#e17100",
                justifyContent: "center",
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text style={{ fontFamily: fonte.forte, fontSize: 14, color: cor.branco }}>
                Abrir o SOS
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => void Linking.openURL("tel:192")}
              style={({ pressed }) => ({
                minHeight: ALVO_MINIMO,
                paddingHorizontal: espaco.xl,
                borderRadius: 999,
                borderWidth: 2,
                borderColor: "#e17100",
                justifyContent: "center",
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text style={{ fontFamily: fonte.forte, fontSize: 14, color: "#bb4d00" }}>
                Emergência: 192
              </Text>
            </Pressable>
          </View>
        </View>
        <View
          style={{
            borderRadius: 24,
            backgroundColor: cor.cartao,
            padding: 20,
            gap: 4,
            borderWidth: 1,
            borderColor: cor.borda,
          }}
        >
          <Text style={{ fontFamily: fonte.forte, fontSize: 14, color: cor.texto }}>
            {nomeDoBebe ?? "O bebê"} já nasceu? 🎉
          </Text>
          <Text
            style={{
              fontFamily: fonte.normal,
              fontSize: 13,
              lineHeight: 19,
              color: cor.textoApagado,
            }}
          >
            Informe a data para celebrar e começar a jornada do 4º trimestre. Seu caminho e as
            figurinhas continuam guardados. 💛
          </Text>
          <View style={{ marginTop: espaco.sm }}>
            <Botao
              rotulo="Contar o nascimento"
              corFundo={corJornada.roxo}
              aoTocar={() => router.push("/ritual?editar=1")}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
