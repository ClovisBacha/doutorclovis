import { useLocalSearchParams } from "expo-router";
import BellOff from "lucide-react-native/icons/bell-off";
import Settings from "lucide-react-native/icons/settings";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  LayoutAnimation,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import {
  CampoLivre,
  LinhaDeAjuste,
  LinhaDeCampo,
  RECUO_SEM_ICONE,
  SecaoDeAjustes,
} from "~/componentes/ajustes";
import { Botao, Carregando, selecao, T } from "~/componentes/base";
import { AcaoDoTopo, TelaDaPilha, voltarOu } from "~/componentes/cabecalho";
import { CalendarioDoMes, mesDe, type Mes } from "~/componentes/agenda/calendario";
import { ICONE_DO_TIPO } from "~/componentes/agenda/pecas";
import { RodaDaHora } from "~/componentes/agenda/passo";
import { apagarCompromisso, salvarCompromisso, useAgenda } from "~/componentes/agenda/usar-agenda";
import { rota } from "~/componentes/jornada/bancada";
import { Confirmacao } from "~/componentes/saude/pecas";
import {
  diaCurto,
  montarQuando,
  nomePadrao,
  novoId,
  paraData,
  quandoPorExtenso,
  TIPOS,
  ymdDe,
  type TipoDeCompromisso,
} from "~/lib/agenda/agenda";
import { ymdLocal } from "~/lib/gestacao";
import { useSessao } from "~/lib/sessao";
import { canto, cor, curva, escala, espaco, fonte, margem } from "~/tema";

/**
 * MARCAR (ou editar) UMA CONSULTA — o tipo, o dia, a hora, o lugar e as
 * anotações. Depois da consulta, a mesma tela guarda o que o médico disse.
 *
 * 18/11/2026 (a vistoria: "a tela mais cansativa do grupo"): a folha de criar
 * um evento do iPhone. "Cancelar" e "Adicionar" no alto; o tipo em fichas com
 * ícone; "Data" e "Hora" são linhas que se abrem ali mesmo, uma por vez (o
 * calendário e a roda da hora); apagar pergunta antes, em vermelho. A casca a
 * apresenta como folha (`modal`); empilhada, funciona igual.
 *
 * Rota: /agenda/marcar [?id=…] [?tipo=ultrassom] [?dia=AAAA-MM-DD] [?titulo=…]
 */
export default function MarcarConsulta() {
  const params = useLocalSearchParams<{
    id?: string;
    tipo?: string;
    dia?: string;
    titulo?: string;
  }>();
  const { lista, pronto } = useAgenda();
  const { cuidado } = useSessao();
  const existente = params.id ? (lista.find((c) => c.id === params.id) ?? null) : null;
  const editando = !!params.id;
  const agora = useMemo(() => new Date(), []);
  const hoje = ymdLocal(agora);

  const [tipo, setTipo] = useState<TipoDeCompromisso>(() =>
    TIPOS.some((t) => t.tipo === params.tipo) ? (params.tipo as TipoDeCompromisso) : "consulta",
  );
  /* `?titulo=` vem da dica da fase ("Consulta puerperal", "Vacinas de 2 meses"). */
  const [titulo, setTitulo] = useState(() => (params.titulo ?? "").slice(0, 60));
  const [dia, setDia] = useState(() =>
    params.dia && paraData(`${params.dia}T09:00`) ? params.dia : amanha(agora),
  );
  const [mes, setMes] = useState<Mes>(() => mesDe(dia));
  const [hora, setHora] = useState(9);
  const [minuto, setMinuto] = useState(0);
  const [onde, setOnde] = useState("");
  const [nota, setNota] = useState("");
  const [aberto, setAberto] = useState<"data" | "hora" | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [semPermissao, setSemPermissao] = useState(false);
  const [confirmarApagar, setConfirmarApagar] = useState(false);

  /* Editar: os campos recebem o compromisso uma vez, quando a loja o entrega. */
  const preenchido = useRef(false);
  useEffect(() => {
    if (!existente || preenchido.current) return;
    preenchido.current = true;
    const d = paraData(existente.quando);
    setTipo(existente.tipo);
    setTitulo(existente.titulo ?? "");
    setDia(ymdDe(existente.quando));
    setMes(mesDe(ymdDe(existente.quando)));
    if (d) {
      setHora(d.getHours());
      setMinuto(d.getMinutes());
    }
    setOnde(existente.onde ?? "");
    setNota(existente.nota ?? "");
  }, [existente]);

  const fechar = () => voltarOu(rota("/agenda") as never);
  const cancelar = <AcaoDoTopo rotulo="Cancelar" aoTocar={fechar} />;
  const tituloDaFolha = editando ? "Na agenda" : "Marcar na agenda";

  if (!pronto) {
    return (
      <TelaDaPilha titulo={tituloDaFolha} esquerda={cancelar}>
        <Carregando />
      </TelaDaPilha>
    );
  }
  if (editando && !existente) {
    return (
      <TelaDaPilha titulo={tituloDaFolha} esquerda={cancelar}>
        <T>Esse compromisso não está mais na agenda.</T>
        <Botao rotulo="Voltar para a agenda" aoTocar={fechar} />
      </TelaDaPilha>
    );
  }

  const quando = montarQuando(dia, hora, minuto);
  const jaPassou = (paraData(quando)?.getTime() ?? 0) < agora.getTime();

  async function salvar() {
    setSalvando(true);
    const r = await salvarCompromisso(
      {
        id: existente?.id ?? novoId(),
        tipo,
        quando,
        titulo: titulo.trim() || undefined,
        onde: onde.trim() || undefined,
        nota: nota.trim() || undefined,
      },
      { cuidado },
    );
    setSalvando(false);
    /* Sem permissão, a consulta fica guardada e a tela explica antes de sair. */
    if (r === "sem-permissao" && !jaPassou) setSemPermissao(true);
    else fechar();
  }

  function abrir(qual: "data" | "hora") {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setAberto((a) => (a === qual ? null : qual));
  }

  function apagar() {
    if (!existente) return;
    const ir = () => void apagarCompromisso(existente.id, { cuidado }).then(fechar);
    /* No iPhone, a pergunta do sistema; na web da bancada, a confirmação na tela. */
    if (Platform.OS === "web") return setConfirmarApagar(true);
    Alert.alert("Apagar da agenda?", "Os lembretes dela também saem.", [
      { text: "Cancelar", style: "cancel" },
      { text: "Apagar", style: "destructive", onPress: ir },
    ]);
  }

  if (semPermissao) {
    return (
      <TelaDaPilha titulo="Guardado na agenda" esquerda={<View />}>
        <SecaoDeAjustes rodape="As notificações do app estão desligadas no iPhone. Ligue nos Ajustes para eu te lembrar na véspera e duas horas antes.">
          <LinhaDeAjuste
            Icone={BellOff}
            tinta={cor.atencao}
            titulo="Está na agenda, sem lembrete"
          />
          {Platform.OS !== "web" ? (
            <LinhaDeAjuste
              Icone={Settings}
              tinta={cor.textoApagado}
              titulo="Abrir os Ajustes do iPhone"
              aoTocar={() => void Linking.openSettings().catch(() => {})}
            />
          ) : null}
        </SecaoDeAjustes>
        <Botao rotulo="Pronto" aoTocar={fechar} />
      </TelaDaPilha>
    );
  }

  return (
    <TelaDaPilha
      titulo={tituloDaFolha}
      esquerda={cancelar}
      direita={
        <AcaoDoTopo
          rotulo={editando ? "Salvar" : "Adicionar"}
          principal
          carregando={salvando}
          aoTocar={() => void salvar()}
        />
      }
    >
      {/* O que é: as fichas (roláveis) e o nome. */}
      <SecaoDeAjustes recuo={RECUO_SEM_ICONE}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            gap: espaco.sm,
            paddingHorizontal: margem.tela - 4,
            paddingVertical: espaco.md,
          }}
        >
          {TIPOS.map((t) => (
            <FichaDoTipo
              key={t.tipo}
              tipo={t.tipo}
              rotulo={t.rotulo}
              ativa={tipo === t.tipo}
              aoTocar={() => setTipo(t.tipo)}
            />
          ))}
        </ScrollView>
        <LinhaDeCampo
          rotulo="Nome"
          placeholder={nomePadrao(tipo, { cuidado })}
          value={titulo}
          onChangeText={setTitulo}
          maxLength={60}
        />
      </SecaoDeAjustes>

      {/* Quando: as linhas se abrem ali mesmo, uma por vez. */}
      <SecaoDeAjustes
        recuo={RECUO_SEM_ICONE}
        rodape={
          jaPassou
            ? "Essa data já passou. Dá para guardar o que foi dito na consulta."
            : "Eu te lembro na véspera, às 19h, e duas horas antes."
        }
      >
        <LinhaDeAjuste
          titulo="Data"
          valor={diaCurto(dia, agora)}
          tintaDoValor={aberto === "data" ? cor.agenda : undefined}
          seta={false}
          rotulo={`Data, ${quandoPorExtenso(quando, agora)}`}
          dica={aberto === "data" ? "Fecha o calendário" : "Abre o calendário"}
          aoTocar={() => abrir("data")}
        />
        {aberto === "data" ? (
          <CalendarioDoMes
            plano
            mes={mes}
            aoMudarMes={setMes}
            hoje={hoje}
            selecionado={dia}
            aoEscolher={setDia}
            tinta={cor.agenda}
          />
        ) : null}
        <LinhaDeAjuste
          titulo="Hora"
          valor={`${hora}:${String(minuto).padStart(2, "0")}`}
          tintaDoValor={aberto === "hora" ? cor.agenda : undefined}
          seta={false}
          dica={aberto === "hora" ? "Fecha a roda da hora" : "Abre a roda da hora"}
          aoTocar={() => abrir("hora")}
        />
        {aberto === "hora" ? (
          <RodaDaHora
            hora={hora}
            minuto={minuto}
            aoMudar={(h, m) => {
              setHora(h);
              setMinuto(m);
            }}
          />
        ) : null}
      </SecaoDeAjustes>

      <SecaoDeAjustes recuo={RECUO_SEM_ICONE}>
        <LinhaDeCampo
          rotulo="Onde"
          placeholder="Clínica, hospital"
          value={onde}
          onChangeText={setOnde}
          maxLength={80}
        />
      </SecaoDeAjustes>

      <SecaoDeAjustes titulo={jaPassou ? "O que foi dito" : "Anotações"}>
        <CampoLivre
          rotulo={jaPassou ? "O que foi dito" : "Anotações"}
          placeholder={
            jaPassou
              ? "Como foi, o que você quer lembrar"
              : "Perguntas para levar, o que pedir, o preparo"
          }
          value={nota}
          onChangeText={setNota}
          maxLength={1000}
        />
      </SecaoDeAjustes>

      {existente ? (
        confirmarApagar ? (
          <Confirmacao
            pergunta="Apagar da agenda? Os lembretes dela também saem."
            rotuloSim="Apagar"
            aoConfirmar={() => void apagarCompromisso(existente.id, { cuidado }).then(fechar)}
            aoCancelar={() => setConfirmarApagar(false)}
          />
        ) : (
          <SecaoDeAjustes>
            <LinhaDeAjuste titulo="Apagar da agenda" perigo centro aoTocar={apagar} />
          </SecaoDeAjustes>
        )
      ) : null}
    </TelaDaPilha>
  );
}

function amanha(agora: Date): string {
  const d = new Date(agora);
  d.setDate(d.getDate() + 1);
  return ymdLocal(d);
}

/** Uma ficha de tipo: o ícone e o nome; a escolhida em índigo, com o ícone branco. */
function FichaDoTipo({
  tipo,
  rotulo,
  ativa,
  aoTocar,
}: {
  tipo: TipoDeCompromisso;
  rotulo: string;
  ativa: boolean;
  aoTocar: () => void;
}) {
  const Icone = ICONE_DO_TIPO[tipo];
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={rotulo}
      accessibilityState={{ selected: ativa }}
      hitSlop={{ top: 4, bottom: 4 }}
      onPress={() => {
        selecao();
        aoTocar();
      }}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        minHeight: 40,
        paddingLeft: espaco.md,
        paddingRight: espaco.md + 2,
        borderRadius: canto.pilula,
        ...curva,
        backgroundColor: ativa ? cor.agenda : cor.apagado,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <Icone size={17} strokeWidth={2.2} color={ativa ? cor.branco : cor.agenda} />
      <Text style={{ ...fonte.forte, ...escala.legenda, color: ativa ? cor.branco : cor.texto }}>
        {rotulo}
      </Text>
    </Pressable>
  );
}
