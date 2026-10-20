import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Bell, BellOff, CalendarPlus, MapPin } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { Linking, Platform, Pressable, Text, View } from "react-native";
import { Botao, Carregando, T, Tela, toque } from "~/componentes/base";
import { CabecalhoDaPilha } from "~/componentes/cabecalho";
import { CalendarioDoMes, mesDe, type Mes } from "~/componentes/agenda/calendario";
import { CartaoDoCompromisso } from "~/componentes/agenda/pecas";
import { useAgenda } from "~/componentes/agenda/usar-agenda";
import { rota } from "~/componentes/jornada/bancada";
import {
  contagemPorDia,
  emojiDo,
  faltaQuanto,
  nomeDo,
  quandoPorExtenso,
  separar,
  sugestaoDaFase,
  sugestaoDoPosParto,
  ymdDe,
  type Compromisso,
} from "~/lib/agenda/agenda";
import { lembretesLigados, reagendarAgenda } from "~/lib/agenda/lembretes";
import { ehBancada, parametroDaBancada } from "~/lib/bancada";
import { gestacaoDoPerfil, ymdLocal } from "~/lib/gestacao";
import { diaNaTrilhaDoPos, semanaDeVida } from "~/lib/jornada/pos-parto";
import { cor, espaco, fonte, raio, sombra } from "~/tema";

/**
 * MINHA AGENDA — a próxima consulta em destaque, o calendário do mês e as
 * listas do que vem e do que já foi (com a anotação do que o médico disse).
 *
 * Bancada: /agenda?bancada=1 [&agenda=vazia] [&lembretes=0] [&semana=20]
 */
export default function Agenda() {
  const { dia, loja, lista, pronto } = useAgenda();
  const agora = useMemo(() => new Date(), []);
  const hoje = ymdLocal(agora);
  const [mes, setMes] = useState<Mes>(() => mesDe(hoje));
  const [diaEscolhido, setDiaEscolhido] = useState<string | null>(null);
  const ligados = useLembretesLigados(lista.length > 0);

  /* A agenda pode ter chegado de outro aparelho pelo pull: os lembretes
     acompanham a lista, e não só a gravação feita aqui. */
  const assinatura = JSON.stringify(lista);
  useEffect(() => {
    if (!pronto || loja.bancada) return;
    void reagendarAgenda(lista);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assinatura, pronto, loja.bancada]);

  if (!pronto) {
    return (
      <Tela>
        <CabecalhoDaPilha titulo="Minha agenda" voltarPara="/saude" />
        <Carregando />
      </Tela>
    );
  }

  const { proximos, passados } = separar(lista, agora);
  const [destaque, ...seguintes] = proximos;
  const contagem = contagemPorDia(lista);
  const doDia = diaEscolhido ? lista.filter((c) => ymdDe(c.quando) === diaEscolhido) : [];

  const gest = dia.modo === "gestacao" ? gestacaoDoPerfil(dia.perfil, agora) : null;
  const dpp = gest?.totalDays != null ? somarDias(hoje, 280 - gest.totalDays) : null;
  /* A dica da fase fala do bebê: some no Modo Cuidado. No pós-parto ela é a
     orientação da semana de vida (revisão, consulta puerperal, vacinas). */
  const sugestao =
    "cuidado" in dia && dia.cuidado
      ? null
      : dia.modo === "gestacao"
        ? {
            ...sugestaoDaFase(dia.semana),
            titulo: null as string | null,
            rotulo: `Nesta fase · semana ${dia.semana}`,
          }
        : dia.modo === "pos"
          ? (() => {
              const semana = semanaDeVida(diaNaTrilhaDoPos(dia.idadeDias));
              return {
                ...sugestaoDoPosParto(semana),
                rotulo: `Nesta fase · semana ${semana} de vida`,
              };
            })()
          : null;
  const rotaDaSugestao =
    sugestao?.tipo != null
      ? `/agenda/marcar?tipo=${sugestao.tipo}${sugestao.titulo ? `&titulo=${encodeURIComponent(sugestao.titulo)}` : ""}`
      : null;

  return (
    <Tela>
      <CabecalhoDaPilha
        titulo="Minha agenda"
        subtitulo="Consultas, ultrassons e exames"
        voltarPara="/saude"
      />

      {destaque ? <Destaque c={destaque} agora={agora} /> : <SemNada />}

      <AvisoDosLembretes temFuturo={proximos.length > 0} ligados={ligados} />

      <Botao
        rotulo="Marcar consulta ou exame"
        corFundo={cor.agenda}
        icone={<CalendarPlus size={20} color={cor.branco} />}
        aoTocar={() =>
          router.push(
            rota(diaEscolhido ? `/agenda/marcar?dia=${diaEscolhido}` : "/agenda/marcar") as never,
          )
        }
      />

      <CalendarioDoMes
        mes={mes}
        aoMudarMes={setMes}
        hoje={hoje}
        selecionado={diaEscolhido}
        aoEscolher={(ymd) => setDiaEscolhido((atual) => (atual === ymd ? null : ymd))}
        contagem={contagem}
        dpp={"cuidado" in dia && dia.cuidado ? null : dpp}
      />

      {diaEscolhido ? (
        <View style={{ gap: espaco.sm }}>
          <T tipo="subtitulo">{tituloDoDia(diaEscolhido, agora)}</T>
          {doDia.length ? (
            doDia.map((c) => (
              <CartaoDoCompromisso key={c.id} c={c} agora={agora} passado={!proximos.includes(c)} />
            ))
          ) : (
            <T tipo="apagado">
              {diaEscolhido === dpp
                ? "A data provável do parto. Nada marcado neste dia."
                : "Nada marcado neste dia. O botão acima marca nele."}
            </T>
          )}
        </View>
      ) : null}

      {sugestao ? (
        <Pressable
          accessibilityRole={rotaDaSugestao ? "button" : undefined}
          accessibilityLabel={`${sugestao.rotulo}: ${sugestao.texto}${rotaDaSugestao ? ". Marcar na agenda" : ""}`}
          disabled={!rotaDaSugestao}
          onPress={() => {
            if (!rotaDaSugestao) return;
            toque();
            router.push(rota(rotaDaSugestao) as never);
          }}
          style={({ pressed }) => [
            {
              backgroundColor: cor.cartao,
              borderRadius: raio.lg,
              padding: espaco.lg,
              gap: 6,
              borderWidth: 1,
              borderColor: cor.agendaFundo,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Text
            style={{
              fontFamily: fonte.titulo,
              fontSize: 12,
              letterSpacing: 1.2,
              textTransform: "uppercase",
              color: cor.agenda,
            }}
          >
            {sugestao.rotulo}
          </Text>
          <Text style={{ fontFamily: fonte.media, fontSize: 15, lineHeight: 22, color: cor.texto }}>
            {sugestao.texto}
          </Text>
          {rotaDaSugestao ? (
            <Text style={{ fontFamily: fonte.titulo, fontSize: 14, color: cor.agenda }}>
              Já marcou? Pôr na agenda ›
            </Text>
          ) : null}
        </Pressable>
      ) : null}

      {seguintes.length ? (
        <View style={{ gap: espaco.sm }}>
          <T tipo="subtitulo">Depois</T>
          {seguintes.map((c) => (
            <CartaoDoCompromisso key={c.id} c={c} agora={agora} />
          ))}
        </View>
      ) : null}

      {passados.length ? (
        <View style={{ gap: espaco.sm }}>
          <T tipo="subtitulo">Já foram</T>
          {passados.map((c) => (
            <CartaoDoCompromisso key={c.id} c={c} agora={agora} passado />
          ))}
        </View>
      ) : null}

      <T tipo="apagado" centro>
        A agenda é sua: ela fica guardada na sua conta e aparece em qualquer aparelho em que você
        entrar.
      </T>
    </Tela>
  );
}

function somarDias(ymd: string, n: number): string {
  const d = new Date(`${ymd}T12:00:00`);
  d.setDate(d.getDate() + n);
  return ymdLocal(d);
}

function tituloDoDia(ymd: string, agora: Date): string {
  return quandoPorExtenso(`${ymd}T00:00`, agora).replace(/(, 0:00| · 0:00)$/, "");
}

/** Na bancada, `&lembretes=0` mostra o aviso de notificações desligadas. */
function useLembretesLigados(perguntar: boolean): boolean {
  const [ligados, setLigados] = useState(true);
  useEffect(() => {
    if (ehBancada()) {
      setLigados(parametroDaBancada("lembretes") !== "0");
      return;
    }
    if (!perguntar) return;
    void lembretesLigados().then(setLigados);
  }, [perguntar]);
  return ligados;
}

function Destaque({ c, agora }: { c: Compromisso; agora: Date }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Próxima: ${nomeDo(c)}, ${quandoPorExtenso(c.quando, agora)}. Abrir`}
      onPress={() => {
        toque();
        router.push(rota(`/agenda/marcar?id=${encodeURIComponent(c.id)}`) as never);
      }}
    >
      <LinearGradient
        colors={["#5b4fe0", cor.agenda]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[{ borderRadius: raio.lg, padding: espaco.lg, gap: 6 }, sombra]}
      >
        <View
          style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
        >
          <Text
            style={{
              fontFamily: fonte.titulo,
              fontSize: 12,
              letterSpacing: 1.4,
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.8)",
            }}
          >
            A próxima
          </Text>
          <View
            style={{
              backgroundColor: "rgba(255,255,255,0.2)",
              borderRadius: raio.pilula,
              paddingHorizontal: 10,
              paddingVertical: 3,
            }}
          >
            <Text style={{ fontFamily: fonte.titulo, fontSize: 13, color: cor.branco }}>
              {faltaQuanto(c.quando, agora)}
            </Text>
          </View>
        </View>
        <Text style={{ fontFamily: fonte.titulo, fontSize: 24, lineHeight: 30, color: cor.branco }}>
          {emojiDo(c.tipo)} {nomeDo(c)}
        </Text>
        <Text style={{ fontFamily: fonte.forte, fontSize: 16, color: cor.branco }}>
          {quandoPorExtenso(c.quando, agora)}
        </Text>
        {c.onde ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <MapPin size={15} color="rgba(255,255,255,0.85)" />
            <Text
              style={{
                flex: 1,
                fontFamily: fonte.media,
                fontSize: 14,
                color: "rgba(255,255,255,0.9)",
              }}
            >
              {c.onde}
            </Text>
          </View>
        ) : null}
        {c.nota ? (
          <Text
            numberOfLines={3}
            style={{
              marginTop: 4,
              fontFamily: fonte.normal,
              fontSize: 14,
              lineHeight: 20,
              color: "rgba(255,255,255,0.9)",
            }}
          >
            📝 {c.nota}
          </Text>
        ) : null}
      </LinearGradient>
    </Pressable>
  );
}

function SemNada() {
  return (
    <View
      style={[
        {
          backgroundColor: cor.agendaFundo,
          borderRadius: raio.lg,
          padding: espaco.xl,
          alignItems: "center",
          gap: espaco.sm,
        },
      ]}
    >
      <Text style={{ fontSize: 40 }}>🗓️</Text>
      <Text
        style={{ fontFamily: fonte.titulo, fontSize: 19, color: cor.agenda, textAlign: "center" }}
      >
        Nenhuma consulta marcada
      </Text>
      <Text
        style={{
          fontFamily: fonte.media,
          fontSize: 14,
          lineHeight: 20,
          color: cor.texto,
          textAlign: "center",
        }}
      >
        Marque o pré-natal, os ultrassons e os exames. Eu te lembro na véspera e duas horas antes.
      </Text>
    </View>
  );
}

function AvisoDosLembretes({ temFuturo, ligados }: { temFuturo: boolean; ligados: boolean }) {
  if (!temFuturo) return null;
  if (ligados) {
    return (
      <View style={{ flexDirection: "row", alignItems: "center", gap: espaco.sm }}>
        <Bell size={16} color={cor.agenda} />
        <Text style={{ flex: 1, fontFamily: fonte.media, fontSize: 13, color: cor.textoApagado }}>
          Eu te lembro na véspera, às 19h, e duas horas antes.
        </Text>
      </View>
    );
  }
  return (
    <View
      style={{
        backgroundColor: cor.atencaoFundo,
        borderRadius: raio.md,
        padding: espaco.md,
        gap: espaco.sm,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: espaco.sm }}>
        <BellOff size={18} color={cor.atencao} />
        <Text style={{ flex: 1, fontFamily: fonte.forte, fontSize: 14, color: cor.atencaoForte }}>
          Os lembretes estão desligados
        </Text>
      </View>
      <Text style={{ fontFamily: fonte.normal, fontSize: 14, lineHeight: 20, color: cor.texto }}>
        O iPhone não deixa o app avisar. Ligue as notificações nos Ajustes para receber o lembrete
        das consultas.
      </Text>
      {Platform.OS !== "web" ? (
        <Botao
          rotulo="Abrir os Ajustes"
          tipo="secundario"
          aoTocar={() => void Linking.openSettings().catch(() => {})}
        />
      ) : null}
    </View>
  );
}
