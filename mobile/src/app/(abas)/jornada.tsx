import { router, useFocusEffect } from "expo-router";
import { Award, ChevronRight, Footprints, PenLine, Sparkles, Wind } from "lucide-react-native";
import { useCallback, useMemo, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { posChallenge } from "@/lib/daily-challenges";
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
import { Caminho } from "~/componentes/caminho/caminho";
import { useJornada, type DiaDaJornada } from "~/componentes/jornada/usarJornada";
import { ehBancada } from "~/lib/bancada";
import { montarGrade, paraResgatar, placar as placarDasConquistas } from "~/lib/jornada/conquistas";
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
  ATIVIDADES,
  CHAVE_FIGURINHAS,
  chaveDoPresente,
  listaDeNumeros,
  feito,
  flagsDoDia,
} from "~/lib/jornada/momentos";
import { chama as calcularChama } from "~/lib/jornada/trilha";
import { cor, espaco, fonte, raio, sombra } from "~/tema";

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
 * Ao abrir a aba no dia de hoje: o que o servidor já registrou (feito no site
 * ou noutro aparelho) acende aqui; e o que está aceso aqui mas o servidor não
 * registrou (rede caiu no fim da atividade) é pago agora. O servidor não paga
 * duas vezes a mesma atividade no mesmo dia, então tentar de novo é seguro.
 */
function useReconciliacao(D: number, pronta: boolean, aoMudarSaldo: () => void) {
  const emVoo = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!pronta || ehBancada() || emVoo.current) return;
      emVoo.current = true;
      void (async () => {
        try {
          const noServidor = await lerProgressoDoDia(D);
          if (!noServidor) return;
          let fechou = false;
          for (const a of noServidor) fechou = marcar(D, a).fechouAgora || fechou;
          const flags = flagsDoDia(estadoAtual().blob, D);
          let pagou = false;
          for (const a of ATIVIDADES) {
            if (feito(flags, a) && !noServidor.includes(a)) {
              const g = await pagarMomento(D, a);
              if (g && g > 0) pagou = true;
            }
          }
          if (fechou) {
            const b = await pagarDiaFechado(D);
            if (b && b > 0) pagou = true;
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

function JornadaDaGestacao({
  dia,
  loja,
}: {
  dia: Extract<DiaDaJornada, { modo: "gestacao" }>;
  loja: EstadoDaLoja;
}) {
  const { D, semana, perfil, hoje } = dia;
  const { carteira, recarregar } = useCarteira(true);
  /* As conquistas não aparecem no Caminho (moram nas Recompensas), mas a
     leitura delas é o que DESBLOQUEIA no servidor as que ela acabou de ganhar —
     por isso a aba continua conferindo ao ganhar foco. */
  useConquistas(true);
  useReconciliacao(D, loja.pronto, recarregar);
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

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: cor.fundo }}>
      <Caminho
        hojeD={D}
        semanaAtual={semana}
        fases={fases}
        blob={loja.blob}
        saldo={carteira.estado === "ok" ? carteira.dados.balance : null}
        trofeus={carteira.estado === "ok" ? carteira.dados.trofeus : null}
        carregandoCarteira={carteira.estado === "carregando"}
        chama={diasDeChama}
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
        aoAbrirLoja={() => ir("/jornada/recompensas")}
        aoAbrirAmigas={() => router.navigate("/comunidade" as never)}
        aoAbrirFolha={setFolha}
        aoContarNascimento={() => router.push("/ritual?editar=1")}
        decoracao={decoracao}
        possuidos={possuidos}
        cenario={cenario}
        pele={pele}
        podeSemear={loja.pronto && loja.nuvem === "ok"}
        aoGravarDecoracao={aoGravarDecoracao}
        topo={
          <>
            {carteira.estado === "falhou" ? (
              <NaoConsegueLer
                sossego="Os seus momentos de hoje continuam valendo e ficam guardados neste aparelho."
                aoTentar={() => void recarregar()}
              />
            ) : null}
            {presenteNovo ? (
              <AvisoDePresente
                quantidade={presenteNovo.quantidade}
                de={presenteNovo.de}
                nome={presenteNovo.nome}
                aoFechar={() => gravarChave(chaveDoPresente(presenteNovo.quando), true)}
              />
            ) : null}
          </>
        }
      />
      <FolhasDoPlacar
        aberta={folha}
        aoFechar={() => setFolha(null)}
        chama={diasDeChama}
        perdoes={perdoes}
        trofeus={carteira.estado === "ok" ? carteira.dados.trofeus : null}
      />
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
  const quem =
    nome?.trim() ||
    (de === "criadora"
      ? "a equipe da Obstétrica"
      : de === "amiga"
        ? "uma amiga"
        : "a equipe da Obstétrica");
  return (
    <Cartao fundo={corJornada.sementinhaFundo}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: espaco.md }}>
        {/* A bolha abre a caixa e brotam sementinhas. */}
        <BolhaViva humor="presente" tamanho={88} />
        <View style={{ flex: 1 }}>
          <T tipo="rotulo" cor={corJornada.sementinha}>
            Você ganhou {quantidade} sementinhas 🌱
          </T>
          <T tipo="apagado">Um presente de {quem}.</T>
        </View>
      </View>
      <Botao rotulo="Que bom!" tipo="secundario" aoTocar={aoFechar} />
      <SementesSubindo quantidade={quantidade} disparo={quantidade} />
    </Cartao>
  );
}
