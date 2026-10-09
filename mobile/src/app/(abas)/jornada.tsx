import { router, useFocusEffect } from "expo-router";
import {
  Award,
  BookOpen,
  CalendarDays,
  ChevronRight,
  Footprints,
  Heart,
  PenLine,
  Sparkles,
  Wind,
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { babyForWeek, fruitEmojiForWeek } from "@/lib/gestacao";
import { carregarQuizDoDia, temQuizNoDia, type DailyQuiz } from "@/lib/daily-quizzes";
import { gestChallenge, posChallenge } from "@/lib/daily-challenges";
import { Botao, Cartao, Carregando, NaoConsegueLer, T, Tela, toque } from "~/componentes/base";
import { rota } from "~/componentes/jornada/bancada";
import { SementesSubindo } from "~/componentes/jornada/efeitos";
import { BolhaViva } from "~/componentes/movimento";
import { corJornada } from "~/componentes/jornada/cores";
import { CartaoDoDia, TrilhaDaSemana, type ItemDoDia } from "~/componentes/jornada/dia-de-hoje";
import {
  lerCarteiraDoDia,
  lerConquistas,
  lerProgressoDoDia,
  pagarDiaFechado,
  pagarMomento,
  type CarteiraOk,
  type LeituraDasConquistas,
} from "~/componentes/jornada/economia";
import { useLivresDeHoje } from "~/componentes/jornada/livres";
import { Pulsando } from "~/componentes/jornada/pecas";
import { Placar } from "~/componentes/jornada/placar";
import { useJornada, type DiaDaJornada } from "~/componentes/jornada/usarJornada";
import { ehBancada } from "~/lib/bancada";
import { primeiroNome } from "~/lib/gestacao";
import { montarGrade, paraResgatar, placar as placarDasConquistas } from "~/lib/jornada/conquistas";
import { diaLongo, diaNaSemana, diasDaSemana, temaDoDia } from "~/lib/jornada/dia";
import { estadoAtual, gravarChave, marcar, type EstadoDaLoja } from "~/lib/jornada/loja";
import {
  ATIVIDADES,
  chaveDoPresente,
  contarMomentos,
  feito,
  flagsDoDia,
  TOTAL_DO_DIA,
} from "~/lib/jornada/momentos";
import { chama as calcularChama } from "~/lib/jornada/trilha";
import { ALVO_MINIMO, cor, espaco, fonte, raio, sombra } from "~/tema";

/**
 * A ABA JORNADA — o coração do app: um dia de cada vez, cinco momentos por dia.
 *
 * Quatro caras, pela situação dela:
 *   · gestação: placar, o cartão do dia com os cinco momentos, a trilha da
 *     semana e as conquistas;
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
  const conquistas = useConquistas(true);
  useReconciliacao(D, loja.pronto, recarregar);

  const [quiz, setQuiz] = useState<DailyQuiz | null | "carregando">("carregando");
  useEffect(() => {
    let vivo = true;
    if (!temQuizNoDia(D)) {
      setQuiz(null);
      return;
    }
    void carregarQuizDoDia(D).then((q) => {
      if (vivo) setQuiz(q);
    });
    return () => {
      vivo = false;
    };
  }, [D]);

  const flags = flagsDoDia(loja.blob, D);
  const feitos = contarMomentos(flags);
  const fechado = feitos >= TOTAL_DO_DIA;
  const { dias: diasDeChama, perdoes } = calcularChama(loja.blob, D);
  const tema = temaDoDia(D);
  const bebe = babyForWeek(semana);
  const nomeDoBebe = (perfil.baby_name ?? "").trim() || null;
  const nome = primeiroNome(perfil.display_name ?? perfil.full_name);

  const temAula = temQuizNoDia(D);
  const desafio = !temAula ? gestChallenge(D) : null;

  const itens: ItemDoDia[] = [];
  if (temAula) {
    itens.push({
      chave: "aula",
      titulo: "Aula de hoje",
      sub:
        quiz && quiz !== "carregando"
          ? `Uma lição curta e ${quiz.questions.length} perguntas`
          : "Uma lição curta e algumas perguntas",
      Icone: BookOpen,
      feito: feito(flags, "aula"),
      rotuloDoFeito: "Feita",
      aoTocar: () => ir("/jornada/aula"),
    });
  } else if (desafio) {
    itens.push({
      chave: "desafio",
      titulo: `Desafio do dia ${desafio.emoji}`,
      sub: desafio.label,
      linhasDoSub: 3,
      marcaPorToque: true,
      Icone: Sparkles,
      feito: feito(flags, "aula"),
      aoTocar: () => {
        if (!feito(flags, "aula")) marcar(D, "aula");
      },
    });
  }
  itens.push(
    {
      chave: "mexer",
      titulo: "Mexer",
      sub: "Três minutinhos de movimento",
      Icone: Footprints,
      feito: feito(flags, "movement"),
      aoTocar: () => ir("/jornada/mexer"),
    },
    {
      chave: "meditar",
      titulo: "Meditar",
      sub: "Respiração 4-4-8 guiada",
      Icone: Wind,
      feito: feito(flags, "meditation"),
      aoTocar: () => ir("/jornada/meditar"),
    },
    {
      chave: "bebe",
      titulo: nomeDoBebe ? `Carta para ${nomeDoBebe}` : "Carta para o bebê",
      sub: "Leia em voz alta, linha a linha",
      Icone: Heart,
      feito: feito(flags, "bonding"),
      aoTocar: () => ir("/jornada/bebe"),
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

  const presente = carteira.estado === "ok" ? carteira.dados.presente : null;
  const presenteNovo = presente && !loja.blob[chaveDoPresente(presente.quando)] ? presente : null;

  return (
    <Tela>
      <Saudacao
        titulo="Sua jornada"
        sub={nome ? `Que bom te ver, ${nome}.` : "Um dia de cada vez."}
      />
      <Placar
        saldo={carteira.estado === "ok" ? carteira.dados.balance : null}
        trofeus={carteira.estado === "ok" ? carteira.dados.trofeus : null}
        carregando={carteira.estado === "carregando"}
        chama={diasDeChama}
        perdoes={perdoes}
      />
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

      <CartaoDoDia
        sobre={`Semana ${semana} · dia ${diaNaSemana(D)}`}
        titulo={`${tema.emoji} ${tema.rotulo}`}
        linha={`${fruitEmojiForWeek(semana)} Do tamanho de ${bebe.fruit.toLowerCase()} · ${bebe.size}`}
        feitos={feitos}
        total={TOTAL_DO_DIA}
        itens={itens}
        rodape={
          fechado ? (
            <T tipo="rotulo" cor={corJornada.roxoEscuro}>
              ⭐ Cinco estrelas hoje! Amanhã abre o dia {diaNaSemana(D + 1)}
              {diaNaSemana(D + 1) === 1 ? " da semana " + (semana + 1) : ""}.
            </T>
          ) : (
            <T tipo="apagado">
              {feitos === 0
                ? "Comece por qualquer um. Cinco momentos fecham o dia com +20 🌱 de bônus."
                : `${feitos} de 5 — ${TOTAL_DO_DIA - feitos === 1 ? "falta 1" : `faltam ${TOTAL_DO_DIA - feitos}`} para as cinco estrelas (+20 🌱).`}
            </T>
          )
        }
      />

      <View style={{ flexDirection: "row", alignItems: "center", marginTop: espaco.sm }}>
        <T tipo="subtitulo" estilo={{ flex: 1 }}>
          Semana {semana}
        </T>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ver a semana inteira"
          onPress={() => {
            toque();
            ir("/jornada/semana");
          }}
          style={({ pressed }) => ({
            minHeight: ALVO_MINIMO,
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            paddingLeft: espaco.md,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <CalendarDays size={18} color={corJornada.roxo} />
          <Text style={{ fontFamily: fonte.forte, fontSize: 15, color: corJornada.roxo }}>
            Ver a semana
          </Text>
        </Pressable>
      </View>
      <Cartao estilo={{ paddingHorizontal: espaco.sm, paddingVertical: espaco.md }}>
        <TrilhaDaSemana blob={loja.blob} dias={diasDaSemana(semana)} hojeD={D} hoje={hoje} />
      </Cartao>

      <BotaoDeConquistas leitura={conquistas} posParto={false} />
    </Tela>
  );
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
        ir("/jornada/conquistas");
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
