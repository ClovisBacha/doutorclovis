import { Image } from "expo-image";
import { router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, Text, View } from "react-native";
import { Botao, Campo, Carregando, T, Tela } from "~/componentes/base";
import { CabecalhoDaPilha } from "~/componentes/cabecalho";
import { CalendarioDoMes, mesDe, type Mes } from "~/componentes/agenda/calendario";
import { rota } from "~/componentes/jornada/bancada";
import { RECEM_NASCIDO } from "~/componentes/jornada/nascimento";
import { useJornada } from "~/componentes/jornada/usarJornada";
import { ehBancada, recarregarNaBancada } from "~/lib/bancada";
import { ymdLocal } from "~/lib/gestacao";
import { gravarPerfil } from "~/lib/gravar-perfil";
import { abrirLoja, gravarChave } from "~/lib/jornada/loja";
import { CHAVE_NASCIMENTO } from "~/lib/jornada/nascimento";
import {
  CHAVE_NASCIMENTO_FESTEJADO,
  lerComprimentoDigitado,
  lerHoraDigitada,
  lerNascimento,
  lerPesoDigitado,
  mascaraDeHora,
  nascimentoPorExtenso,
  recusaDoNascimento,
  type DadosDoNascimento,
} from "~/lib/jornada/pos-parto";
import { useSessao } from "~/lib/sessao";
import { cor, espaco, fonte, raio } from "~/tema";

/**
 * CONTAR O NASCIMENTO — o dia (no calendário, nunca no futuro), e, se ela
 * quiser, a hora, o peso e o comprimento: é com eles que o cartão da chegada
 * fica bonito de postar. Dois passos, como no site: escolher e confirmar — o
 * app inteiro muda para o pós-parto (e dá para desfazer na festa).
 *
 * Grava `birth_date` no perfil e `dc-path-birth` no blob (o site lê só a data),
 * e zera `dc-path-birth-celebrated`: a festa abre na tela Hoje.
 * Depois do parto, a mesma tela corrige os dados (sem festa nova).
 *
 * Bancada: /jornada/nascimento?bancada=1 [&semana=39] [&pos=1]
 */
export default function ContarONascimento() {
  const { dia, loja } = useJornada();
  const { recarregarPerfil } = useSessao();
  const agora = useMemo(() => new Date(), []);
  const hoje = ymdLocal(agora);

  const jaNasceu = dia.modo === "pos";
  const perfil = "perfil" in dia ? dia.perfil : null;
  const salvo = lerNascimento(loja.blob[CHAVE_NASCIMENTO]);

  const [data, setData] = useState(hoje);
  const [mes, setMes] = useState<Mes>(() => mesDe(hoje));
  const [hora, setHora] = useState("");
  const [peso, setPeso] = useState("");
  const [comprimento, setComprimento] = useState("");
  const [nome, setNome] = useState("");
  const [confirmando, setConfirmando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  /* Os campos recebem o que já existe uma vez, quando o perfil e a loja chegam. */
  const preenchido = useRef(false);
  useEffect(() => {
    if (preenchido.current || !perfil || !loja.pronto) return;
    preenchido.current = true;
    setNome((perfil.baby_name ?? "").trim());
    const d = perfil.birth_date ?? null;
    if (d) {
      setData(d);
      setMes(mesDe(d));
    }
    if (salvo && (!d || salvo.date === d)) {
      if (salvo.hora) setHora(salvo.hora.padStart(5, "0"));
      if (salvo.pesoG) setPeso(String(salvo.pesoG));
      if (salvo.cm) setComprimento(String(salvo.cm).replace(".", ","));
    }
  }, [perfil, loja.pronto, salvo]);

  if (dia.modo === "carregando" || dia.modo === "falhou" || !perfil) {
    return (
      <Tela>
        <CabecalhoDaPilha titulo="O nascimento" voltarPara="/jornada" />
        <Carregando />
      </Tela>
    );
  }
  if (dia.cuidado) {
    return (
      <Tela>
        <CabecalhoDaPilha titulo="O nascimento" voltarPara="/jornada" />
        <T>Os dados da gestação se corrigem em Seus dados, no Perfil, quando você quiser.</T>
        <Botao rotulo="Abrir os seus dados" aoTocar={() => router.replace("/perfil/dados")} />
      </Tela>
    );
  }

  const quem = nome.trim() || "o bebê";

  /** O que vai ser gravado, ou a frase que diz o que corrigir. */
  function montar(): { dados: DadosDoNascimento } | { erro: string } {
    const recusa = recusaDoNascimento(data, agora);
    if (recusa === "futuro") return { erro: "A data do nascimento não pode ser no futuro." };
    if (recusa === "antiga") return { erro: "Data muito antiga — confira o dia do nascimento." };
    const dados: DadosDoNascimento = { date: data };
    if (hora.trim()) {
      const h = lerHoraDigitada(hora);
      if (!h) return { erro: "Confira a hora (por exemplo, 06:42)." };
      dados.hora = h;
    }
    if (peso.trim()) {
      const g = lerPesoDigitado(peso);
      if (g == null) return { erro: "Confira o peso (por exemplo, 3250 g ou 3,25 kg)." };
      dados.pesoG = g;
    }
    if (comprimento.trim()) {
      const cm = lerComprimentoDigitado(comprimento);
      if (cm == null) return { erro: "Confira o comprimento (por exemplo, 48,5 cm)." };
      dados.cm = cm;
    }
    return { dados };
  }

  function pedirConfirmacao() {
    const r = montar();
    if ("erro" in r) {
      setErro(r.erro);
      return;
    }
    setErro(null);
    if (jaNasceu) void gravar(r.dados);
    else setConfirmando(true);
  }

  async function gravar(dados: DadosDoNascimento) {
    if (!perfil || !("uid" in dia)) return;
    setSalvando(true);
    setErro(null);
    /* Na bancada nada é gravado: ela vai para a tela Hoje do pós-parto com a festa. */
    if (ehBancada()) {
      recarregarNaBancada(rota("/jornada?pos=1&idade=0&festa=1"));
      return;
    }
    const campos: Record<string, unknown> = { birth_date: dados.date };
    const novoNome = nome.trim();
    if (novoNome !== (perfil.baby_name ?? "").trim()) campos.baby_name = novoNome || null;
    const r = await gravarPerfil(dia.uid, campos);
    if (!r.ok) {
      setSalvando(false);
      setErro("Não conseguimos salvar agora. Confira a internet e tente de novo.");
      return;
    }
    await abrirLoja(dia.uid);
    gravarChave(CHAVE_NASCIMENTO, dados);
    if (!jaNasceu) gravarChave(CHAVE_NASCIMENTO_FESTEJADO, false);
    await recarregarPerfil();
    setSalvando(false);
    router.replace("/jornada");
  }

  const previa = montar();

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Tela>
        <CabecalhoDaPilha
          titulo={jaNasceu ? "O nascimento" : "Contar o nascimento"}
          voltarPara="/jornada"
        />
        <View style={{ alignItems: "center", gap: espaco.sm }}>
          <Image source={RECEM_NASCIDO} style={{ width: 120, height: 120 }} contentFit="contain" />
          <Text
            accessibilityRole="header"
            style={{
              textAlign: "center",
              fontFamily: fonte.titulo,
              fontSize: 24,
              lineHeight: 30,
              color: cor.texto,
            }}
          >
            {jaNasceu ? "Os dados da chegada" : `Que dia ${quem} chegou?`}
          </Text>
          <T tipo="apagado" centro>
            {jaNasceu
              ? "Corrija o que precisar. A trilha do 4º trimestre acompanha a data."
              : "Escolha o dia no calendário. A hora, o peso e o comprimento são só se você quiser — eles vão no cartão da chegada."}
          </T>
        </View>

        <CalendarioDoMes
          mes={mes}
          aoMudarMes={setMes}
          hoje={hoje}
          selecionado={data}
          aoEscolher={(ymd) => {
            setData(ymd);
            setConfirmando(false);
          }}
          bloqueado={(ymd) => recusaDoNascimento(ymd, agora) != null}
        />

        <View style={{ flexDirection: "row", gap: espaco.sm }}>
          <View style={{ flex: 1 }}>
            <Campo
              rotulo="Hora"
              placeholder="06:42"
              value={hora}
              onChangeText={(t) => setHora(mascaraDeHora(t))}
              keyboardType="number-pad"
              maxLength={5}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Campo
              rotulo="Peso"
              placeholder="3250 g"
              value={peso}
              onChangeText={setPeso}
              keyboardType="decimal-pad"
              maxLength={8}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Campo
              rotulo="Altura"
              placeholder="48,5 cm"
              value={comprimento}
              onChangeText={setComprimento}
              keyboardType="decimal-pad"
              maxLength={6}
            />
          </View>
        </View>
        <Campo
          rotulo="Nome do bebê"
          placeholder="Se já tiver"
          value={nome}
          onChangeText={setNome}
          maxLength={40}
        />

        {erro ? (
          <View
            style={{ backgroundColor: cor.atencaoFundo, borderRadius: raio.md, padding: espaco.md }}
          >
            <Text style={{ fontFamily: fonte.forte, fontSize: 14, color: cor.atencaoForte }}>
              {erro}
            </Text>
          </View>
        ) : null}

        {confirmando && "dados" in previa ? (
          <View
            style={{
              gap: espaco.sm,
              borderRadius: raio.lg,
              backgroundColor: "#fdf2f8",
              padding: espaco.lg,
            }}
          >
            <Text style={{ fontFamily: fonte.titulo, fontSize: 16, color: "#7d1d45" }}>
              Confirmar o nascimento em {nascimentoPorExtenso(previa.dados)}?
            </Text>
            <T tipo="apagado">
              O app passa para o pós-parto: a trilha vira o 4º trimestre e a gestação fica guardada
              no álbum. Dá para desfazer logo em seguida.
            </T>
            <Botao
              rotulo="Sim, nasceu! 🎉"
              corFundo="#b0306a"
              carregando={salvando}
              aoTocar={() => void gravar(previa.dados)}
            />
            <Pressable
              accessibilityRole="button"
              onPress={() => setConfirmando(false)}
              style={{ minHeight: 44, alignItems: "center", justifyContent: "center" }}
            >
              <Text style={{ fontFamily: fonte.forte, fontSize: 15, color: "#9a7486" }}>
                Ainda não
              </Text>
            </Pressable>
          </View>
        ) : (
          <Botao
            rotulo={jaNasceu ? "Salvar" : "Contar o nascimento 🎉"}
            corFundo="#b0306a"
            carregando={salvando}
            aoTocar={pedirConfirmacao}
          />
        )}
      </Tela>
    </KeyboardAvoidingView>
  );
}
