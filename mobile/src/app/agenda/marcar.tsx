import { useLocalSearchParams } from "expo-router";
import { Trash2 } from "lucide-react-native";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Linking, Platform, Pressable, Text, View } from "react-native";
import { Botao, Campo, Carregando, T, Tela, toque } from "~/componentes/base";
import { CabecalhoDaPilha, voltarOu } from "~/componentes/cabecalho";
import { CalendarioDoMes, mesDe, type Mes } from "~/componentes/agenda/calendario";
import { Passo } from "~/componentes/agenda/passo";
import { apagarCompromisso, salvarCompromisso, useAgenda } from "~/componentes/agenda/usar-agenda";
import { rota } from "~/componentes/jornada/bancada";
import {
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
import { ALVO_MINIMO, cor, espaco, fonte, raio } from "~/tema";

/**
 * MARCAR (ou editar) UMA CONSULTA — o tipo, o dia no calendário, a hora, o
 * lugar e as anotações. Depois da consulta, a mesma tela guarda o que o médico
 * disse.
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

  const titulo_ = editando ? "Na agenda" : "Marcar na agenda";
  if (!pronto) {
    return (
      <Tela>
        <CabecalhoDaPilha titulo={titulo_} voltarPara={rota("/agenda") as never} />
        <Carregando />
      </Tela>
    );
  }
  if (editando && !existente) {
    return (
      <Tela>
        <CabecalhoDaPilha titulo={titulo_} voltarPara={rota("/agenda") as never} />
        <T>Esse compromisso não está mais na agenda.</T>
        <Botao rotulo="Voltar para a agenda" aoTocar={() => voltarOu(rota("/agenda") as never)} />
      </Tela>
    );
  }

  const quando = montarQuando(dia, hora, minuto);
  const jaPassou = (paraData(quando)?.getTime() ?? 0) < agora.getTime();

  async function salvar() {
    setSalvando(true);
    const r = await salvarCompromisso({
      id: existente?.id ?? novoId(),
      tipo,
      quando,
      titulo: titulo.trim() || undefined,
      onde: onde.trim() || undefined,
      nota: nota.trim() || undefined,
    });
    setSalvando(false);
    /* Sem permissão, a consulta fica guardada e a tela explica antes de sair. */
    if (r === "sem-permissao" && !jaPassou) setSemPermissao(true);
    else voltarOu(rota("/agenda") as never);
  }

  if (semPermissao) {
    return (
      <Tela>
        <CabecalhoDaPilha titulo="Guardado na agenda" voltarPara={rota("/agenda") as never} />
        <View
          style={{
            backgroundColor: cor.atencaoFundo,
            borderRadius: raio.lg,
            padding: espaco.lg,
            gap: espaco.sm,
          }}
        >
          <T tipo="rotulo" cor={cor.atencaoForte}>
            A consulta está na agenda, mas o lembrete não vai tocar
          </T>
          <T tipo="apagado">
            As notificações do app estão desligadas no iPhone. Ligue nos Ajustes para eu te lembrar
            na véspera e duas horas antes.
          </T>
          {Platform.OS !== "web" ? (
            <Botao
              rotulo="Abrir os Ajustes"
              tipo="secundario"
              aoTocar={() => void Linking.openSettings().catch(() => {})}
            />
          ) : null}
        </View>
        <Botao
          rotulo="Pronto"
          corFundo={cor.agenda}
          aoTocar={() => voltarOu(rota("/agenda") as never)}
        />
      </Tela>
    );
  }

  return (
    <Tela>
      <CabecalhoDaPilha titulo={titulo_} voltarPara={rota("/agenda") as never} />

      <Secao rotulo="O que é">
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: espaco.sm }}>
          {TIPOS.map((t) => (
            <Escolha
              key={t.tipo}
              rotulo={`${t.emoji} ${t.rotulo}`}
              rotuloAcessivel={t.rotulo}
              ativa={tipo === t.tipo}
              aoTocar={() => setTipo(t.tipo)}
            />
          ))}
        </View>
        <Campo
          rotulo="Nome (se quiser)"
          placeholder={nomePadrao(tipo)}
          value={titulo}
          onChangeText={setTitulo}
          maxLength={60}
        />
      </Secao>

      <Secao rotulo="Que dia">
        <CalendarioDoMes
          mes={mes}
          aoMudarMes={setMes}
          hoje={hoje}
          selecionado={dia}
          aoEscolher={setDia}
        />
      </Secao>

      <Secao rotulo="Que horas">
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: espaco.md,
          }}
        >
          <Passo
            valor={String(hora)}
            rotulo="hora"
            aoMenos={() => setHora((h) => (h + 23) % 24)}
            aoMais={() => setHora((h) => (h + 1) % 24)}
          />
          <Text style={{ fontFamily: fonte.titulo, fontSize: 30, color: cor.texto }}>:</Text>
          <Passo
            valor={String(minuto).padStart(2, "0")}
            rotulo="minutos"
            aoMenos={() => setMinuto((m) => (m + 55) % 60)}
            aoMais={() => setMinuto((m) => (m + 5) % 60)}
          />
        </View>
        <Text
          style={{ textAlign: "center", fontFamily: fonte.forte, fontSize: 15, color: cor.agenda }}
        >
          {quandoPorExtenso(quando, agora)}
        </Text>
      </Secao>

      <Campo
        rotulo="Onde"
        placeholder="Clínica, hospital, laboratório…"
        value={onde}
        onChangeText={setOnde}
        maxLength={80}
      />
      <Campo
        rotulo={jaPassou ? "O que foi dito" : "Anotações"}
        placeholder={
          jaPassou
            ? "Como foi, o que você quer lembrar…"
            : "Perguntas para levar, o que pedir, o preparo…"
        }
        value={nota}
        onChangeText={setNota}
        multiline
        maxLength={1000}
      />

      <Botao
        rotulo={editando ? "Salvar" : "Pôr na agenda"}
        corFundo={cor.agenda}
        carregando={salvando}
        aoTocar={() => void salvar()}
      />
      {!jaPassou ? (
        <T tipo="apagado" centro>
          Eu te lembro na véspera, às 19h, e duas horas antes.
        </T>
      ) : null}

      {existente ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={confirmarApagar ? "Toque de novo para apagar" : "Apagar da agenda"}
          onPress={() => {
            toque(false);
            if (!confirmarApagar) {
              setConfirmarApagar(true);
              return;
            }
            void apagarCompromisso(existente.id).then(() => voltarOu(rota("/agenda") as never));
          }}
          style={{
            minHeight: ALVO_MINIMO,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: espaco.sm,
          }}
        >
          <Trash2 size={18} color={cor.urgente} />
          <Text style={{ fontFamily: fonte.forte, fontSize: 15, color: cor.urgente }}>
            {confirmarApagar ? "Toque de novo para apagar" : "Apagar da agenda"}
          </Text>
        </Pressable>
      ) : null}
    </Tela>
  );
}

function amanha(agora: Date): string {
  const d = new Date(agora);
  d.setDate(d.getDate() + 1);
  return ymdLocal(d);
}

function Secao({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <View style={{ gap: espaco.sm }}>
      <T tipo="rotulo">{rotulo}</T>
      {children}
    </View>
  );
}

function Escolha({
  rotulo,
  rotuloAcessivel,
  ativa,
  aoTocar,
}: {
  rotulo: string;
  rotuloAcessivel: string;
  ativa: boolean;
  aoTocar: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={rotuloAcessivel}
      accessibilityState={{ selected: ativa }}
      onPress={() => {
        toque();
        aoTocar();
      }}
      style={{
        minHeight: ALVO_MINIMO,
        justifyContent: "center",
        paddingHorizontal: espaco.lg,
        borderRadius: raio.pilula,
        backgroundColor: ativa ? cor.agenda : cor.cartao,
        borderWidth: 1,
        borderColor: ativa ? cor.agenda : cor.borda,
      }}
    >
      <Text
        style={{ fontFamily: fonte.forte, fontSize: 15, color: ativa ? cor.branco : cor.texto }}
      >
        {rotulo}
      </Text>
    </Pressable>
  );
}
