import { validaRegistro } from "@/lib/sinais-clinicos";
import type { RiskLevel } from "@/lib/triage";
import { Check } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Botao, Campo, Cartao, Linha, T, Tela, toque } from "~/componentes/base";
import { BotaoLigar192, Cabecalho } from "~/componentes/saude/pecas";
import { ehBancada, parametroDaBancada } from "~/lib/bancada";
import { gestacaoDoPerfil } from "~/lib/gestacao";
import { numeroDoCampo } from "~/lib/saude/registros";
import { orientacaoLocal, piorNivel, sintomasParaMarcar } from "~/lib/saude/triagem-local";
import { useSessao } from "~/lib/sessao";
import { avaliarSintomas, guardarTriagem } from "~/servidor/triagem";
import { ALVO_MINIMO, cor, espaco, fonte, raio } from "~/tema";

type Resultado = { level: RiskLevel; reasons: string[]; message: string };
type Gravacao = "guardando" | "guardou" | "nao-guardou" | null;

const EXEMPLOS: Record<string, string[]> = {
  vermelho: ["sangramento", "dor_abdominal"],
  amarelo: ["ardor_urinar", "dor_lombar"],
  verde: [],
};

/**
 * A TRIAGEM DE SINTOMAS. A orientação aparece SEMPRE: primeiro a local (a
 * régua do site, sem rede), depois a do servidor, que só pode SUBIR o nível.
 * Guardar no histórico é o último passo — se falhar, a tela diz que não ficou
 * salvo, e a orientação continua valendo.
 */
export default function Sintomas() {
  const { perfil, cuidado } = useSessao();
  const semanas = cuidado ? null : (gestacaoDoPerfil(perfil)?.weeks ?? null);
  const lista = sintomasParaMarcar(cuidado);
  const [marcados, setMarcados] = useState<string[]>([]);
  const [sis, setSis] = useState("");
  const [dia, setDia] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [gravacao, setGravacao] = useState<Gravacao>(null);

  useEffect(() => {
    if (!ehBancada()) return;
    const est = parametroDaBancada("estado");
    if (est && est in EXEMPLOS) {
      setMarcados(EXEMPLOS[est]);
      setResultado(orientacaoLocal(EXEMPLOS[est], { systolic: null, diastolic: null }, cuidado));
      setGravacao(est === "verde" ? "nao-guardou" : "guardou");
    }
  }, [cuidado]);

  function alternar(id: string) {
    toque();
    setResultado(null);
    setGravacao(null);
    setMarcados((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id]));
  }

  async function avaliar() {
    setErro(null);
    const e = validaRegistro({ systolic: sis, diastolic: dia });
    if (e) {
      setErro(e);
      return;
    }
    const s = numeroDoCampo(sis);
    const d = numeroDoCampo(dia);
    const systolic = s == null ? null : Math.round(s);
    const diastolic = d == null ? null : Math.round(d);
    /* 1. A orientação local, na hora — com ou sem rede. */
    const local = orientacaoLocal(marcados, { systolic, diastolic }, cuidado);
    setResultado(local);
    if (ehBancada()) {
      setGravacao("guardou");
      return;
    }
    setGravacao("guardando");
    /* 2. A do servidor (a IA reescreve a mensagem). No Modo Cuidado fica a
       local: a mensagem gerada fala com uma gestante. */
    let final = local;
    if (!cuidado) {
      try {
        const r = await avaliarSintomas({
          symptoms: marcados,
          systolic,
          diastolic,
          weeks: semanas,
        });
        if (r && typeof r.message === "string" && r.message.trim()) {
          const level = piorNivel(local.level, r.level);
          final = {
            level,
            reasons: local.reasons,
            message: level === r.level ? r.message.trim() : local.message,
          };
          setResultado(final);
        }
      } catch {
        /* sem rede ou servidor fora: a orientação local já está na tela */
      }
    }
    /* 3. Guardar no histórico dela. */
    try {
      const g = await guardarTriagem({
        level: final.level,
        symptoms: marcados,
        systolic,
        diastolic,
      });
      setGravacao(g?.ok === true ? "guardou" : "nao-guardou");
    } catch {
      setGravacao("nao-guardou");
    }
  }

  return (
    <Tela>
      <Cabecalho titulo="Estou com um sintoma" />
      <T>
        Marque o que você está sentindo agora. A orientação aparece na hora, mesmo sem internet.
      </T>

      <View style={{ gap: espaco.sm }}>
        {lista.map((s) => {
          const ativo = marcados.includes(s.id);
          return (
            <Pressable
              key={s.id}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: ativo }}
              accessibilityLabel={s.label}
              onPress={() => alternar(s.id)}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: espaco.md,
                minHeight: ALVO_MINIMO + 8,
                paddingHorizontal: espaco.md,
                paddingVertical: espaco.sm,
                borderRadius: raio.md,
                borderWidth: 1.5,
                borderColor: ativo ? cor.primaria : cor.borda,
                backgroundColor: ativo ? cor.destaque : cor.cartao,
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <View
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 7,
                  borderWidth: 2,
                  borderColor: ativo ? cor.primaria : cor.primariaSuave,
                  backgroundColor: ativo ? cor.primaria : cor.cartao,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {ativo ? <Check size={18} color={cor.branco} strokeWidth={3} /> : null}
              </View>
              <Text style={{ flex: 1, fontFamily: fonte.media, fontSize: 16, color: cor.texto }}>
                {s.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Cartao>
        <T tipo="rotulo">Mediu a pressão agora? (opcional)</T>
        <Linha estilo={{ alignItems: "flex-start" }}>
          <View style={{ flex: 1 }}>
            <Campo
              rotulo="A de cima"
              value={sis}
              onChangeText={(v) => {
                setSis(v);
                setResultado(null);
              }}
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
              value={dia}
              onChangeText={(v) => {
                setDia(v);
                setResultado(null);
              }}
              keyboardType="number-pad"
              placeholder="80"
            />
          </View>
        </Linha>
      </Cartao>

      {erro ? (
        <T cor={cor.urgente} estilo={{ fontFamily: fonte.forte }}>
          {erro}
        </T>
      ) : null}
      <Botao rotulo="Ver o que fazer" aoTocar={() => void avaliar()} />
      {resultado ? <CartaoDoResultado resultado={resultado} gravacao={gravacao} /> : null}
      <T tipo="apagado">
        Isto não substitui uma avaliação. Em dúvida, ou se piorar, ligue 192.
      </T>
    </Tela>
  );
}

const ESTILO: Record<RiskLevel, { fundo: string; tinta: string; titulo: string }> = {
  vermelho: { fundo: cor.urgenteFundo, tinta: cor.urgente, titulo: "Procure atendimento agora" },
  amarelo: { fundo: cor.atencaoFundo, tinta: cor.atencao, titulo: "Isto merece atenção hoje" },
  verde: { fundo: cor.apagado, tinta: cor.texto, titulo: "Nenhum sinal de alerta marcado" },
};

function CartaoDoResultado({ resultado, gravacao }: { resultado: Resultado; gravacao: Gravacao }) {
  const e = ESTILO[resultado.level];
  return (
    <Cartao
      fundo={e.fundo}
      estilo={resultado.level === "vermelho" ? { borderWidth: 1.5, borderColor: cor.urgente, gap: espaco.md } : { gap: espaco.md }}
    >
      <T tipo="subtitulo" cor={e.tinta}>
        {e.titulo}
      </T>
      {resultado.level === "vermelho" ? <BotaoLigar192 grande rotulo="Ligar 192 (SAMU)" /> : null}
      <T>{resultado.message}</T>
      {resultado.reasons.length ? (
        <View style={{ gap: 2 }}>
          <T tipo="rotulo">O que você marcou:</T>
          {resultado.reasons.map((r) => (
            <T key={r} tipo="apagado" cor={cor.texto}>
              • {r}
            </T>
          ))}
        </View>
      ) : null}
      {gravacao === "guardando" ? <T tipo="apagado">Guardando no seu histórico…</T> : null}
      {gravacao === "guardou" ? <T tipo="apagado">Guardado no seu histórico.</T> : null}
      {gravacao === "nao-guardou" ? (
        <T tipo="apagado" cor={cor.atencao}>
          Não conseguimos guardar no seu histórico agora. A orientação acima continua valendo.
        </T>
      ) : null}
    </Cartao>
  );
}
