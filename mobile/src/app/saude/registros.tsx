import { useCallback, useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { Botao, Campo, Carregando, Cartao, Linha, NaoConsegueLer, T, Tela, toque } from "~/componentes/base";
import { GraficoDeLinha } from "~/componentes/saude/grafico";
import {
  Cabecalho,
  CartaoDeSocorro,
  Confirmacao,
  coresDaGravidade,
  SeloDeGravidade,
} from "~/componentes/saude/pecas";
import { ehBancada, parametroDaBancada } from "~/lib/bancada";
import { ymdLocal } from "~/lib/gestacao";
import { registrosDeExemplo } from "~/lib/saude/bancada";
import { dataCurta, numeroBR } from "~/lib/saude/formato";
import {
  FORM_VAZIO,
  lerRegistro,
  linhaParaInserir,
  maisRecentesPrimeiro,
  mensagemDoErroDeGravacao,
  perguntaParaApagar,
  serieDePeso,
  serieDePressao,
  ultimaPressao,
  type FormDeRegistro,
  type RegistroDeSaude,
} from "~/lib/saude/registros";
import { useSessao } from "~/lib/sessao";
import { supabase } from "~/servidor/supabase";
import { cor, espaco, fonte, raio } from "~/tema";

type Estado = "carregando" | "pronto" | "falhou";

export default function Registros() {
  const { sessao } = useSessao();
  const uid = sessao?.user.id ?? null;
  const [estado, setEstado] = useState<Estado>("carregando");
  const [lista, setLista] = useState<RegistroDeSaude[]>([]);
  const [form, setForm] = useState<FormDeRegistro>(FORM_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState<RegistroDeSaude | null>(null);
  const [apagando, setApagando] = useState<string | null>(null);
  const [apagandoAgora, setApagandoAgora] = useState(false);
  const [erroApagar, setErroApagar] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (ehBancada()) {
      if (parametroDaBancada("estado") === "falhou") setEstado("falhou");
      else {
        setLista(registrosDeExemplo(Date.now()));
        setEstado("pronto");
      }
      return;
    }
    if (!uid) return;
    const { data, error } = await supabase
      .from("health_logs")
      .select("*")
      .order("log_date", { ascending: false })
      .limit(60);
    if (error || !data) {
      setEstado("falhou");
      return;
    }
    setLista(data as RegistroDeSaude[]);
    setEstado("pronto");
  }, [uid]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function salvar() {
    setErro(null);
    setSalvo(null);
    if (!uid) {
      setErro("Não conseguimos confirmar o seu login. Feche e abra o app.");
      return;
    }
    const r = linhaParaInserir(form, uid, ymdLocal());
    if (!r.ok) {
      setErro(r.erro);
      return;
    }
    if (ehBancada()) {
      const novo = {
        id: `exemplo-novo-${Date.now()}`,
        created_at: new Date().toISOString(),
        ...(r.linha as object),
      } as RegistroDeSaude;
      setSalvo({ ...FORM_NULO, ...novo });
      setLista((l) => [{ ...FORM_NULO, ...novo }, ...l]);
      setForm(FORM_VAZIO);
      return;
    }
    setSalvando(true);
    const { data, error } = await supabase.from("health_logs").insert(r.linha).select("*").single();
    setSalvando(false);
    if (error || !data) {
      setErro(mensagemDoErroDeGravacao(error));
      return;
    }
    setSalvo(data as RegistroDeSaude);
    setForm(FORM_VAZIO);
    void carregar();
  }

  async function apagar(id: string) {
    setErroApagar(null);
    if (ehBancada()) {
      setLista((l) => l.filter((r) => r.id !== id));
      setApagando(null);
      return;
    }
    setApagandoAgora(true);
    const { error } = await supabase.from("health_logs").delete().eq("id", id);
    setApagandoAgora(false);
    if (error) {
      setErroApagar("Não conseguimos apagar agora. O registro continua guardado — tente de novo.");
      return;
    }
    setLista((l) => l.filter((r) => r.id !== id));
    if (salvo?.id === id) setSalvo(null);
    setApagando(null);
  }

  const ordenada = maisRecentesPrimeiro(lista);
  const ultima = ultimaPressao(lista);
  const leituraUltima = ultima ? lerRegistro(ultima) : null;
  const pressaoGrave = leituraUltima?.pressao?.gravidade === "grave" ? leituraUltima.pressao : null;
  const sPressao = serieDePressao(lista);
  const sPeso = serieDePeso(lista);
  const campo = (k: keyof FormDeRegistro) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Tela>
      <Cabecalho titulo="Peso, pressão e glicemia" arte="saude" fundo={cor.saudeFundo} />

      {pressaoGrave && ultima && salvo?.id !== ultima.id ? (
        <CartaoDeSocorro
          titulo={`Pressão ${ultima.systolic}/${ultima.diastolic} — ${pressaoGrave.rotulo.toLowerCase()}`}
          texto={pressaoGrave.orientacao}
        />
      ) : null}

      <Cartao>
        <T tipo="subtitulo">Registro de hoje</T>
        <T tipo="apagado">Preencha só o que você mediu.</T>
        <Campo
          rotulo="Peso (kg)"
          value={form.weight_kg}
          onChangeText={campo("weight_kg")}
          keyboardType="decimal-pad"
          placeholder="Ex.: 68,4"
        />
        <View style={{ gap: 6 }}>
          <T tipo="rotulo">Pressão (mmHg)</T>
          <Linha estilo={{ alignItems: "flex-start" }}>
            <View style={{ flex: 1 }}>
              <Campo
                rotulo="A de cima"
                value={form.systolic}
                onChangeText={campo("systolic")}
                keyboardType="number-pad"
                placeholder="120"
              />
            </View>
            <T tipo="subtitulo" estilo={{ marginTop: 38 }} cor={cor.textoApagado}>
              /
            </T>
            <View style={{ flex: 1 }}>
              <Campo
                rotulo="A de baixo"
                value={form.diastolic}
                onChangeText={campo("diastolic")}
                keyboardType="number-pad"
                placeholder="80"
              />
            </View>
          </Linha>
        </View>
        <Campo
          rotulo="Glicemia (mg/dL)"
          value={form.glucose_mg_dl}
          onChangeText={campo("glucose_mg_dl")}
          keyboardType="number-pad"
          placeholder="Ex.: 92"
        />
        <Campo
          rotulo="Observação (opcional)"
          value={form.notes}
          onChangeText={campo("notes")}
          placeholder="Ex.: medi depois do almoço"
          multiline
        />
        {erro ? (
          <T tipo="apagado" cor={cor.urgente} estilo={{ fontFamily: fonte.forte }}>
            {erro}
          </T>
        ) : null}
        <Botao rotulo="Salvar registro" aoTocar={salvar} carregando={salvando} corFundo={cor.saude} />
      </Cartao>

      {salvo ? <ResultadoDoSalvo registro={salvo} /> : null}

      {estado === "carregando" ? <Carregando texto="Lendo seus registros…" /> : null}
      {estado === "falhou" ? (
        <NaoConsegueLer
          sossego="O que você já registrou continua guardado, e você pode registrar uma medida nova agora mesmo."
          aoTentar={() => {
            setEstado("carregando");
            void carregar();
          }}
        />
      ) : null}

      {estado === "pronto" && sPressao.length >= 2 ? (
        <Cartao>
          <T tipo="subtitulo">Pressão</T>
          <T tipo="apagado">Cada traço vai da de baixo à de cima. A cor marca o que pede atenção.</T>
          <GraficoDeLinha
            pontos={sPressao}
            corDaSerie={cor.saude}
            rotuloAcessivel={`Gráfico das últimas ${sPressao.length} pressões`}
          />
        </Cartao>
      ) : null}
      {estado === "pronto" && sPeso.length >= 2 ? (
        <Cartao>
          <T tipo="subtitulo">Peso</T>
          <GraficoDeLinha
            pontos={sPeso}
            corDaSerie={cor.saude}
            formatar={(n) => numeroBR(n)}
            rotuloAcessivel={`Gráfico dos últimos ${sPeso.length} pesos`}
          />
        </Cartao>
      ) : null}

      {estado === "pronto" ? (
        <View style={{ gap: espaco.sm }}>
          <T tipo="subtitulo">Seus registros</T>
          {ordenada.length === 0 ? (
            <T tipo="apagado">Você ainda não registrou nenhuma medida.</T>
          ) : (
            <T tipo="apagado">Toque num registro para apagá-lo.</T>
          )}
          {ordenada.map((r) =>
            apagando === r.id ? (
              <Confirmacao
                key={r.id}
                pergunta={perguntaParaApagar(r)}
                rotuloSim="Apagar"
                carregando={apagandoAgora}
                erro={erroApagar}
                aoConfirmar={() => void apagar(r.id)}
                aoCancelar={() => {
                  setApagando(null);
                  setErroApagar(null);
                }}
              />
            ) : (
              <LinhaDoRegistro
                key={r.id}
                registro={r}
                aoTocar={() => {
                  setErroApagar(null);
                  setApagando(r.id);
                }}
              />
            ),
          )}
        </View>
      ) : null}
    </Tela>
  );
}

const FORM_NULO = {
  weight_kg: null,
  systolic: null,
  diastolic: null,
  glucose_mg_dl: null,
  notes: null,
};

/** O que a régua diz do registro que acabou de entrar. */
function ResultadoDoSalvo({ registro }: { registro: RegistroDeSaude }) {
  const l = lerRegistro(registro);
  if (l.pressao?.gravidade === "grave") {
    return (
      <CartaoDeSocorro
        titulo={`Registro salvo. Pressão ${registro.systolic}/${registro.diastolic} — ${l.pressao.rotulo.toLowerCase()}`}
        texto={l.pressao.orientacao}
      />
    );
  }
  const falas = [
    l.pressao && l.pressao.gravidade !== "normal"
      ? { g: l.pressao.gravidade, rotulo: l.pressao.rotulo, orientacao: l.pressao.orientacao }
      : null,
    l.glicemia ? { g: l.glicemia.gravidade, rotulo: l.glicemia.rotulo, orientacao: l.glicemia.orientacao } : null,
  ].filter(Boolean) as { g: "normal" | "atencao" | "grave"; rotulo: string; orientacao: string | null }[];
  return (
    <Cartao fundo={cor.saudeFundo}>
      <T tipo="rotulo" cor={cor.saude}>
        Registro salvo.
      </T>
      {falas.map((f, i) => (
        <View key={i} style={{ gap: 4 }}>
          <T tipo="rotulo" cor={f.g === "normal" ? cor.texto : coresDaGravidade(f.g).texto}>
            {f.rotulo}
          </T>
          {f.orientacao ? <T tipo="apagado">{f.orientacao}</T> : null}
        </View>
      ))}
    </Cartao>
  );
}

function LinhaDoRegistro({ registro: r, aoTocar }: { registro: RegistroDeSaude; aoTocar: () => void }) {
  const l = lerRegistro(r);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Registro de ${dataCurta(r.log_date)}. Toque para apagar.`}
      onPress={() => {
        toque();
        aoTocar();
      }}
      style={({ pressed }) => ({
        backgroundColor: cor.cartao,
        borderRadius: raio.md,
        borderWidth: 1,
        borderColor: cor.borda,
        padding: espaco.md,
        gap: 6,
        minHeight: 44,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Linha estilo={{ justifyContent: "space-between" }}>
        <T tipo="rotulo">{dataCurta(r.log_date)}</T>
        {r.weight_kg != null ? <T tipo="apagado">{numeroBR(Number(r.weight_kg))} kg</T> : null}
      </Linha>
      {r.systolic != null && r.diastolic != null ? (
        <Linha estilo={{ flexWrap: "wrap" }}>
          <T>
            Pressão {r.systolic}/{r.diastolic}
          </T>
          {l.pressao && l.pressao.gravidade !== "normal" ? (
            <SeloDeGravidade gravidade={l.pressao.gravidade} texto={l.pressao.rotulo} />
          ) : null}
        </Linha>
      ) : null}
      {r.glucose_mg_dl != null ? (
        <View style={{ gap: 4 }}>
          <T>Glicemia {r.glucose_mg_dl} mg/dL</T>
          {l.glicemia ? <SeloDeGravidade gravidade={l.glicemia.gravidade} texto={l.glicemia.rotulo} /> : null}
          {l.glicemia?.orientacao ? <T tipo="apagado">{l.glicemia.orientacao}</T> : null}
        </View>
      ) : null}
      {r.notes ? (
        <T tipo="apagado" linhas={3}>
          {r.notes}
        </T>
      ) : null}
    </Pressable>
  );
}
