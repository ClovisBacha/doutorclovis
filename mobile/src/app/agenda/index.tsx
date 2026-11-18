import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import {
  Bell,
  BellOff,
  CalendarPlus,
  MapPin,
  NotebookPen,
  Plus,
  Settings,
} from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { Linking, Platform, Text, View } from "react-native";
import { LinhaDeAjuste, SecaoDeAjustes } from "~/componentes/ajustes";
import { Botao, Carregando, TituloDaSecao, Tocavel } from "~/componentes/base";
import { BotaoDeVidro, TelaDaPilha } from "~/componentes/cabecalho";
import { CalendarioDoMes, mesDe, type Mes } from "~/componentes/agenda/calendario";
import { LadrilhoDoTipo, ListaDeCompromissos } from "~/componentes/agenda/pecas";
import { useAgenda } from "~/componentes/agenda/usar-agenda";
import { rota } from "~/componentes/jornada/bancada";
import {
  contagemPorDia,
  faltaQuanto,
  nomeDo,
  quandoPorExtenso,
  separar,
  ymdDe,
  type Compromisso,
} from "~/lib/agenda/agenda";
import { lembretesLigados, reagendarAgenda } from "~/lib/agenda/lembretes";
import { ehBancada, parametroDaBancada } from "~/lib/bancada";
import { clarear, comAlfa } from "~/lib/cor";
import { gestacaoDoPerfil, ymdLocal } from "~/lib/gestacao";
import { brilhoDe, canto, cor, curva, escala, espaco, fonte } from "~/tema";

/**
 * MINHA AGENDA — a próxima consulta em destaque, o calendário do mês e as
 * listas do que vem e do que já foi (com a anotação do que o médico disse).
 *
 * 18/11/2026 (a vistoria: "dois blocos índigo fortes disputam o topo"): o
 * "+" de vidro no alto marca (o botão grande fica só quando a agenda está
 * vazia); cada lista é um grupo só, com o ícone do tipo no lugar do emoji; o
 * que já passou apaga só o texto. A cor de AGIR é a framboesa, como no app
 * inteiro; o índigo da agenda fica nos ícones, nos pontos e no destaque.
 *
 * Modo Cuidado: sem "pré-natal" e sem ultrassom no que o app escreve.
 *
 * Bancada: /agenda?bancada=1 [&agenda=vazia] [&lembretes=0] [&semana=20] [&luto=1]
 */
export default function Agenda() {
  const { dia, loja, lista, pronto } = useAgenda();
  const agora = useMemo(() => new Date(), []);
  const hoje = ymdLocal(agora);
  const [mes, setMes] = useState<Mes>(() => mesDe(hoje));
  const [diaEscolhido, setDiaEscolhido] = useState<string | null>(null);
  const ligados = useLembretesLigados(lista.length > 0);
  const cuidado = "cuidado" in dia && dia.cuidado;

  /* A agenda pode ter chegado de outro aparelho pelo pull: os lembretes
     acompanham a lista, e não só a gravação feita aqui. */
  const assinatura = JSON.stringify(lista);
  useEffect(() => {
    if (!pronto || loja.bancada) return;
    void reagendarAgenda(lista, false, { cuidado });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assinatura, pronto, loja.bancada, cuidado]);

  const marcar = () =>
    router.push(
      rota(diaEscolhido ? `/agenda/marcar?dia=${diaEscolhido}` : "/agenda/marcar") as never,
    );
  const subtitulo = cuidado ? "Suas consultas" : "Consultas, ultrassons e exames";
  const mais = (
    <BotaoDeVidro rotulo={diaEscolhido ? "Marcar neste dia" : "Marcar na agenda"} aoTocar={marcar}>
      <Plus size={22} strokeWidth={2.4} color={cor.primaria} />
    </BotaoDeVidro>
  );

  if (!pronto) {
    return (
      <TelaDaPilha titulo="Minha agenda" subtitulo={subtitulo} grande voltarPara="/jornada">
        <Carregando />
      </TelaDaPilha>
    );
  }

  const { proximos, passados } = separar(lista, agora);
  const [destaque, ...seguintes] = proximos;
  const contagem = contagemPorDia(lista);
  const doDia = diaEscolhido ? lista.filter((c) => ymdDe(c.quando) === diaEscolhido) : [];

  const gest = dia.modo === "gestacao" ? gestacaoDoPerfil(dia.perfil, agora) : null;
  const dpp = gest?.totalDays != null ? somarDias(hoje, 280 - gest.totalDays) : null;
  return (
    <TelaDaPilha
      titulo="Minha agenda"
      subtitulo={subtitulo}
      grande
      voltarPara="/jornada"
      direita={mais}
    >
      {destaque ? (
        <View style={{ gap: espaco.md }}>
          <Destaque c={destaque} agora={agora} cuidado={cuidado} />
          <AvisoDosLembretes ligados={ligados} />
        </View>
      ) : (
        <SemNada cuidado={cuidado} aoMarcar={marcar} />
      )}

      <CalendarioDoMes
        mes={mes}
        aoMudarMes={setMes}
        hoje={hoje}
        selecionado={diaEscolhido}
        aoEscolher={(ymd) => setDiaEscolhido((atual) => (atual === ymd ? null : ymd))}
        contagem={contagem}
        dpp={cuidado ? null : dpp}
      />

      {diaEscolhido ? (
        <View style={{ gap: espaco.sm }}>
          <TituloDaSecao>{tituloDoDia(diaEscolhido, agora)}</TituloDaSecao>
          {doDia.length ? (
            <ListaDeCompromissos
              lista={doDia}
              agora={agora}
              passados={(c) => !proximos.includes(c)}
              cuidado={cuidado}
            />
          ) : (
            <SecaoDeAjustes rodape={diaEscolhido === dpp ? "A data provável do parto." : undefined}>
              <LinhaDeAjuste
                Icone={CalendarPlus}
                tinta={cor.agenda}
                titulo="Marcar neste dia"
                aoTocar={marcar}
              />
            </SecaoDeAjustes>
          )}
        </View>
      ) : null}

      {seguintes.length ? (
        <View style={{ gap: espaco.sm }}>
          <TituloDaSecao>Depois</TituloDaSecao>
          <ListaDeCompromissos lista={seguintes} agora={agora} cuidado={cuidado} />
        </View>
      ) : null}

      {passados.length ? (
        <View style={{ gap: espaco.sm }}>
          <TituloDaSecao>Já foram</TituloDaSecao>
          <ListaDeCompromissos
            lista={passados}
            agora={agora}
            passados={() => true}
            cuidado={cuidado}
          />
        </View>
      ) : null}

      <Text
        style={{
          ...fonte.normal,
          ...escala.nota,
          color: cor.textoApagado,
          textAlign: "center",
          paddingHorizontal: espaco.lg,
        }}
      >
        A agenda fica guardada na sua conta e aparece em qualquer aparelho em que você entrar.
      </Text>
    </TelaDaPilha>
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

/* O destaque: o índigo da agenda, do claro ao cheio. O texto é branco
   (7,2:1 sobre a cor cheia); o claro do degradê fica só no canto de cima. */
const DEGRADE_DO_DESTAQUE = [clarear(cor.agenda, 0.16), cor.agenda] as const;
const BRANCO_SUAVE = comAlfa(cor.branco, 0.86);

function Destaque({ c, agora, cuidado }: { c: Compromisso; agora: Date; cuidado: boolean }) {
  const nome = nomeDo(c, { cuidado });
  return (
    <Tocavel
      rotulo={`A próxima: ${nome}, ${quandoPorExtenso(c.quando, agora)}. Abrir`}
      aoTocar={() => router.push(rota(`/agenda/marcar?id=${encodeURIComponent(c.id)}`) as never)}
      profundidade={0.98}
    >
      <LinearGradient
        colors={DEGRADE_DO_DESTAQUE}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          { borderRadius: canto.cartao, ...curva, padding: espaco.lg + 2, gap: espaco.md },
          brilhoDe(cor.agenda, 0.6),
        ]}
      >
        <View
          style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
        >
          <Text
            style={{
              ...fonte.forte,
              ...escala.nota,
              letterSpacing: 0.6,
              textTransform: "uppercase",
              color: BRANCO_SUAVE,
            }}
          >
            A próxima
          </Text>
          <View
            style={{
              backgroundColor: comAlfa(cor.branco, 0.2),
              borderRadius: canto.pilula,
              paddingHorizontal: 10,
              paddingVertical: 3,
            }}
          >
            <Text style={{ ...fonte.forte, ...escala.nota, color: cor.branco }}>
              {faltaQuanto(c.quando, agora)}
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: espaco.md }}>
          <LadrilhoDoTipo tipo={c.tipo} fundo={comAlfa(cor.branco, 0.18)} tinta={cor.branco} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text
              numberOfLines={2}
              style={{
                ...fonte.display,
                ...escala.titulo2,
                letterSpacing: -0.2,
                color: cor.branco,
              }}
            >
              {nome}
            </Text>
            <Text style={{ ...fonte.media, ...escala.chamada, color: cor.branco }}>
              {quandoPorExtenso(c.quando, agora)}
            </Text>
          </View>
        </View>
        {c.onde || c.nota ? (
          <View style={{ gap: 6 }}>
            {c.onde ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <MapPin size={15} strokeWidth={2.2} color={BRANCO_SUAVE} />
                <Text style={{ flex: 1, ...fonte.media, ...escala.legenda, color: BRANCO_SUAVE }}>
                  {c.onde}
                </Text>
              </View>
            ) : null}
            {c.nota ? (
              <View style={{ flexDirection: "row", gap: 6 }}>
                <NotebookPen
                  size={15}
                  strokeWidth={2.2}
                  color={BRANCO_SUAVE}
                  style={{ marginTop: 2 }}
                />
                <Text
                  numberOfLines={3}
                  style={{ flex: 1, ...fonte.normal, ...escala.legenda, color: BRANCO_SUAVE }}
                >
                  {c.nota}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </LinearGradient>
    </Tocavel>
  );
}

function SemNada({ cuidado, aoMarcar }: { cuidado: boolean; aoMarcar: () => void }) {
  return (
    <View style={{ alignItems: "center", gap: espaco.md, paddingVertical: espaco.sm }}>
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 20,
          ...curva,
          backgroundColor: cor.agendaFundo,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <CalendarPlus size={30} strokeWidth={2} color={cor.agenda} />
      </View>
      <View style={{ gap: espaco.xs, alignItems: "center" }}>
        <Text
          style={{
            ...fonte.display,
            ...escala.titulo2,
            letterSpacing: -0.2,
            color: cor.texto,
            textAlign: "center",
          }}
        >
          Nenhuma consulta marcada
        </Text>
        <Text
          style={{
            ...fonte.normal,
            ...escala.legenda,
            color: cor.textoCorpo,
            textAlign: "center",
            paddingHorizontal: espaco.lg,
          }}
        >
          {cuidado
            ? "Marque as suas consultas. Eu te lembro na véspera e duas horas antes."
            : "Marque as consultas, os ultrassons e os exames. Eu te lembro na véspera e duas horas antes."}
        </Text>
      </View>
      <Botao
        rotulo="Marcar uma consulta"
        icone={<Plus size={20} strokeWidth={2.4} color={cor.branco} />}
        aoTocar={aoMarcar}
      />
    </View>
  );
}

function AvisoDosLembretes({ ligados }: { ligados: boolean }) {
  if (ligados) {
    return (
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: espaco.sm,
          paddingHorizontal: espaco.lg,
        }}
      >
        <Bell size={15} strokeWidth={2.2} color={cor.agenda} />
        <Text style={{ flex: 1, ...fonte.normal, ...escala.nota, color: cor.textoApagado }}>
          Eu te lembro na véspera, às 19h, e duas horas antes.
        </Text>
      </View>
    );
  }
  return (
    <SecaoDeAjustes rodape="O iPhone não deixa o app avisar. Ligue as notificações nos Ajustes para receber o lembrete das consultas.">
      <LinhaDeAjuste Icone={BellOff} tinta={cor.atencao} titulo="Os lembretes estão desligados" />
      {Platform.OS !== "web" ? (
        <LinhaDeAjuste
          Icone={Settings}
          tinta={cor.textoApagado}
          titulo="Abrir os Ajustes do iPhone"
          aoTocar={() => void Linking.openSettings().catch(() => {})}
        />
      ) : null}
    </SecaoDeAjustes>
  );
}
