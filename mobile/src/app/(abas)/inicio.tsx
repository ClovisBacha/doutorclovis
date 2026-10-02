import { semanaDaArte } from "@/lib/arte-do-bebe";
import {
  babyForWeek,
  consultaForWeek,
  fruitEmojiForWeek,
  retaFinalMensagem,
  trimesterForWeek,
} from "@/lib/gestacao";
import { diaLocalDe, fraseDoDia, periodoDaHora } from "@/lib/frases-do-mascote";
import { Image } from "expo-image";
import { router } from "expo-router";
import {
  Activity,
  Apple,
  ChevronRight,
  HeartHandshake,
  MessageCircleHeart,
  Phone,
  Sparkles,
  Timer,
  UserRound,
} from "lucide-react-native";
import type { ComponentType } from "react";
import { Pressable, View } from "react-native";
import { BEBE } from "~/componentes/artes";
import { Cartao, Linha, NaoConsegueLer, Pilula, T, Tela, toque } from "~/componentes/base";
import { CVV } from "~/config";
import { ferramentasDaGestacao, NOME_DOS_MOVIMENTOS } from "~/lib/ferramentas";
import { gestacaoDoPerfil, primeiroNome } from "~/lib/gestacao";
import {
  dataCurta,
  dataProvavel,
  diasAteADpp,
  fracaoDaGestacao,
  idadeDoBebe,
  rotuloDaIdade,
} from "~/lib/inicio";
import { ligar } from "~/lib/links";
import { semGeneroDoBebe } from "~/lib/nutricao/frase-do-topo";
import { BolhaViva, Entrada, Flutuar, Inclinacao3D } from "~/componentes/movimento";
import { useSessao } from "~/lib/sessao";
import { ALVO_MINIMO, cor, espaco, raio } from "~/tema";

function saudacao(h: number) {
  if (h < 5) return "Boa madrugada";
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

export default function Inicio() {
  const { perfil, cuidado, estadoDoPerfil, recarregarPerfil } = useSessao();
  const agora = new Date();
  const nome = primeiroNome(perfil?.display_name ?? perfil?.full_name);
  const gest = gestacaoDoPerfil(perfil, agora);
  const ferramentas = ferramentasDaGestacao({
    semanas: gest?.weeks ?? null,
    cuidado,
    nasceu: !!perfil?.birth_date,
  });
  const nascido = perfil?.birth_date ? idadeDoBebe(perfil.birth_date, agora) : null;
  const frase = fraseDoDia({
    dia: diaLocalDe(agora),
    periodo: periodoDaHora(agora.getHours()),
    nome,
    careMode: cuidado,
    hora: agora.getHours(),
    semanas: gest?.weeks ?? null,
  });

  if (estadoDoPerfil === "falhou")
    return (
      <Tela>
        <NaoConsegueLer
          sossego="O SOS funciona sem internet pelo botão vermelho."
          aoTentar={() => void recarregarPerfil()}
        />
      </Tela>
    );

  return (
    <Tela>
      <Linha estilo={{ justifyContent: "space-between" }}>
        <View style={{ flex: 1 }}>
          <T tipo="apagado">{saudacao(agora.getHours())}</T>
          <T tipo="titulo" linhas={1}>
            {nome ?? "Olá"}
          </T>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Meu perfil e conta"
          onPress={() => {
            toque();
            router.push("/perfil");
          }}
          style={{
            width: ALVO_MINIMO + 4,
            height: ALVO_MINIMO + 4,
            borderRadius: raio.pilula,
            backgroundColor: cor.destaque,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <UserRound color={cor.primariaEscura} size={24} />
        </Pressable>
      </Linha>

      {frase ? (
        <Linha estilo={{ alignItems: "flex-end", gap: espaco.md }}>
          <BolhaViva humor="feliz" tamanho={64} />
          <View
            style={{
              flex: 1,
              backgroundColor: cor.cartao,
              borderRadius: raio.lg,
              borderBottomLeftRadius: 4,
              padding: espaco.md,
              borderWidth: 1,
              borderColor: cor.borda,
            }}
          >
            <T estilo={{ fontSize: 15, lineHeight: 21 }}>{frase}</T>
          </View>
        </Linha>
      ) : null}

      <Entrada atraso={80}>
        {cuidado ? (
          <CartaoDeAcolhimento />
        ) : nascido ? (
          <Cartao fundo={cor.rosaMarca}>
            <T tipo="apagado">{perfil?.baby_name ? perfil.baby_name : "Seu bebê"} tem</T>
            <T tipo="titulo">{nascido}</T>
            <T>Cada dia conta uma história nova. Cuide de você também.</T>
          </Cartao>
        ) : gest ? (
          <CartaoDaSemana
            semanas={gest.weeks}
            dias={gest.days}
            totalDias={gest.totalDays}
            nomeDoBebe={perfil?.baby_name ?? null}
          />
        ) : (
          <Cartao>
            <T tipo="subtitulo">Falta a data da sua gestação</T>
            <T tipo="apagado">
              Com a data da última menstruação ou do ultrassom, o app acompanha a sua semana.
            </T>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                toque();
                router.push("/ritual");
              }}
              style={{ minHeight: ALVO_MINIMO, justifyContent: "center" }}
            >
              <T tipo="rotulo" cor={cor.primariaEscura}>
                Informar agora
              </T>
            </Pressable>
          </Cartao>
        )}
      </Entrada>

      <T tipo="subtitulo" estilo={{ marginTop: espaco.sm }}>
        Para hoje
      </T>
      <Atalho
        ordem={1}
        Icone={Sparkles}
        titulo="Sua jornada do dia"
        texto={
          cuidado
            ? "Respirar, mexer devagar e escrever — no seu tempo."
            : nascido
              ? "O desafio do dia, uma respiração e um momento de gratidão."
              : "A aula de hoje, cinco momentos e as suas sementinhas."
        }
        corIcone={cor.jogo}
        fundoIcone={cor.jogoFundo}
        aoTocar={() => router.push("/jornada")}
      />
      <Atalho
        ordem={2}
        Icone={Activity}
        titulo="Registrar pressão, peso ou glicemia"
        texto="O app avisa se algum número pedir atenção."
        corIcone={cor.saude}
        fundoIcone={cor.saudeFundo}
        aoTocar={() => router.push("/saude/registros")}
      />
      {ferramentas.movimentos && gest ? (
        <Atalho
          ordem={3}
          Icone={HeartHandshake}
          titulo={NOME_DOS_MOVIMENTOS}
          texto="Dez movimentos, no seu tempo."
          corIcone={cor.chutes}
          fundoIcone={cor.chutesFundo}
          aoTocar={() => router.push("/saude/chutes")}
        />
      ) : null}
      {ferramentas.contracoes && gest ? (
        <Atalho
          ordem={4}
          Icone={Timer}
          titulo="Cronometrar contrações"
          texto="Duração e intervalo, com os sinais para procurar atendimento."
          corIcone={cor.contracoes}
          fundoIcone={cor.contracoesFundo}
          aoTocar={() => router.push("/saude/contracoes")}
        />
      ) : null}
      <Atalho
        ordem={5}
        Icone={Apple}
        titulo="Perguntar à nutricionista"
        texto="Pode comer? O que fazer com o que tem em casa?"
        corIcone={cor.nutricao}
        fundoIcone={cor.nutricaoFundo}
        aoTocar={() => router.push("/nutricao")}
      />
      {!cuidado ? (
        <Atalho
          ordem={6}
          Icone={MessageCircleHeart}
          titulo="Comunidade"
          texto="Gestantes na mesma fase que você."
          corIcone={cor.primariaEscura}
          fundoIcone={cor.destaque}
          aoTocar={() => router.push("/comunidade")}
        />
      ) : null}

      {!cuidado && gest ? (
        <Cartao fundo={cor.apagado} estilo={{ marginTop: espaco.sm }}>
          <T tipo="rotulo">Nesta fase da gestação</T>
          <T tipo="apagado">{consultaForWeek(gest.weeks)}</T>
          <T tipo="apagado" estilo={{ fontSize: 13 }}>
            Informação geral. Quem decide os seus exames é a sua equipe de saúde.
          </T>
        </Cartao>
      ) : null}
    </Tela>
  );
}

function CartaoDaSemana({
  semanas,
  dias,
  totalDias,
  nomeDoBebe,
}: {
  semanas: number;
  dias: number;
  totalDias: number;
  nomeDoBebe: string | null;
}) {
  const bebe = babyForWeek(semanas);
  const tri = trimesterForWeek(semanas);
  const faltam = diasAteADpp(totalDias);
  const reta = retaFinalMensagem(semanas);
  const arte = BEBE[semanaDaArte(semanas)];
  return (
    <Inclinacao3D
      aoTocar={() => router.push("/bebe")}
      rotuloAcessivel="Ver o bebê semana a semana"
      raio={raio.lg}
    >
      <Cartao fundo={cor.rosaMarca} estilo={{ gap: espaco.md }}>
        <Linha estilo={{ justifyContent: "space-between", alignItems: "flex-start" }}>
          <View style={{ flex: 1, gap: 4 }}>
            <Pilula texto={`${tri}º trimestre`} fundo={cor.cartao} />
            <T tipo="titulo" estilo={{ fontSize: 28 }}>
              {rotuloDaIdade(semanas, dias)}
            </T>
            <T tipo="apagado">
              {nomeDoBebe ? `${nomeDoBebe} está crescendo` : "O bebê está crescendo"}
            </T>
          </View>
          <Flutuar>
            <Image
              source={arte}
              style={{ width: 120, height: 120 }}
              contentFit="contain"
              accessibilityLabel="Ilustração do bebê nesta fase"
            />
          </Flutuar>
        </Linha>
        <Linha estilo={{ gap: espaco.md }}>
          <Medida titulo="Tamanho" valor={bebe.size} />
          <Medida titulo="Peso" valor={bebe.weight} />
          <Medida titulo="Como" valor={`${fruitEmojiForWeek(semanas)} ${bebe.fruit}`} />
        </Linha>
        <T>{semGeneroDoBebe(bebe.desc)}</T>
        <View>
          <View
            style={{
              height: 10,
              backgroundColor: cor.cartao,
              borderRadius: raio.pilula,
              overflow: "hidden",
            }}
          >
            <View
              style={{
                width: `${Math.round(fracaoDaGestacao(totalDias) * 100)}%`,
                height: 10,
                backgroundColor: cor.primaria,
              }}
            />
          </View>
          <T tipo="apagado" estilo={{ marginTop: 6, fontSize: 13 }}>
            {faltam > 0
              ? `Data provável: ${dataCurta(dataProvavel(totalDias))} · faltam ${faltam} ${faltam === 1 ? "dia" : "dias"}`
              : `Data provável: ${dataCurta(dataProvavel(totalDias))}`}
          </T>
        </View>
        {reta ? (
          <View
            style={{
              backgroundColor: cor.cartao,
              borderRadius: raio.md,
              padding: espaco.md,
              gap: 4,
            }}
          >
            <T tipo="rotulo">{reta.titulo}</T>
            <T tipo="apagado">{reta.corpo}</T>
          </View>
        ) : null}
        <Linha estilo={{ justifyContent: "flex-end", gap: 2 }}>
          <T tipo="rotulo" cor={cor.primariaEscura} estilo={{ fontSize: 14 }}>
            Ver semana a semana
          </T>
          <ChevronRight size={18} color={cor.primariaEscura} />
        </Linha>
      </Cartao>
    </Inclinacao3D>
  );
}

function Medida({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: cor.cartao,
        borderRadius: raio.md,
        padding: espaco.sm,
        gap: 2,
      }}
    >
      <T tipo="apagado" estilo={{ fontSize: 13 }}>
        {titulo}
      </T>
      <T tipo="rotulo" linhas={2} estilo={{ fontSize: 14 }}>
        {valor}
      </T>
    </View>
  );
}

function CartaoDeAcolhimento() {
  return (
    <Cartao fundo={cor.destaque}>
      <T tipo="subtitulo">Estamos aqui com você</T>
      <T>
        Este é um espaço para cuidar de você, no seu tempo. Os seus registros e o SOS continuam
        aqui.
      </T>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Ligar para o CVV, 188"
        onPress={() => ligar(CVV)}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: espaco.sm,
          minHeight: ALVO_MINIMO,
        }}
      >
        <Phone size={20} color={cor.primariaEscura} />
        <T tipo="rotulo" cor={cor.primariaEscura}>
          CVV 188 — apoio emocional, 24 horas, gratuito
        </T>
      </Pressable>
    </Cartao>
  );
}

function Atalho({
  ordem = 0,
  Icone,
  titulo,
  texto,
  corIcone,
  fundoIcone,
  aoTocar,
}: {
  /** A posição na lista: os atalhos entram em cascata, 60 ms um do outro. */
  ordem?: number;
  Icone: ComponentType<{ size?: number; color?: string }>;
  titulo: string;
  texto: string;
  corIcone: string;
  fundoIcone: string;
  aoTocar: () => void;
}) {
  return (
    <Entrada atraso={200 + ordem * 60}>
      <Cartao
        aoTocar={aoTocar}
        rotuloAcessivel={titulo}
        estilo={{
          flexDirection: "row",
          alignItems: "center",
          gap: espaco.md,
          paddingVertical: espaco.md,
        }}
      >
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: raio.md,
            backgroundColor: fundoIcone,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icone size={22} color={corIcone} />
        </View>
        <View style={{ flex: 1 }}>
          <T tipo="rotulo">{titulo}</T>
          <T tipo="apagado" estilo={{ fontSize: 14 }}>
            {texto}
          </T>
        </View>
        <ChevronRight size={20} color={cor.textoApagado} />
      </Cartao>
    </Entrada>
  );
}
