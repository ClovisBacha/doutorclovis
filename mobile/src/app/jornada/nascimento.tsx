import { router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { LayoutAnimation, Text, View } from "react-native";
import {
  LinhaDeAjuste,
  LinhaDeCampo,
  RECUO_SEM_ICONE,
  SecaoDeAjustes,
} from "~/componentes/ajustes";
import { Botao, Carregando, T, Tocavel } from "~/componentes/base";
import { TelaDaPilha } from "~/componentes/cabecalho";
import { CalendarioDoMes, mesDe, type Mes } from "~/componentes/agenda/calendario";
import { rota } from "~/componentes/jornada/bancada";
import { Folha } from "~/componentes/jornada/pecas";
import { useJornada } from "~/componentes/jornada/usarJornada";
import { ArteDaBolha } from "~/componentes/movimento";
import { Escolha } from "~/componentes/saude/pecas";
import { diaCurto } from "~/lib/agenda/agenda";
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
  medidasPorExtenso,
  nascimentoPorExtenso,
  recusaDoNascimento,
  type DadosDoNascimento,
} from "~/lib/jornada/pos-parto";
import { useSessao } from "~/lib/sessao";
import { canto, cor, curva, escala, espaco, folha, fonte } from "~/tema";

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
 * 18/11/2026 (a vistoria: "o momento mais emocional do app, com cara de
 * formulário web"): o dia é uma linha com as fichas Hoje / Ontem / Outro dia
 * (o calendário só abre no "Outro dia"); a hora, o peso e o comprimento são
 * campos em linha, com a unidade fora do campo; a confirmação sobe numa folha
 * com o resumo.
 *
 * 19/11/2026: no lugar do recém-nascido ilustrado, a Bolha (apaixonada na
 * pergunta do dia, surpresa na confirmação, feliz quando é só corrigir os
 * dados). O dono: "tirar as imagens dos bebês [...] o bebê bolha será esse guia".
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
  const [outroDia, setOutroDia] = useState(false);
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
      if (d !== ymdLocal(agora) && d !== ontemDe(agora)) setOutroDia(true);
    }
    if (salvo && (!d || salvo.date === d)) {
      if (salvo.hora) setHora(salvo.hora.padStart(5, "0"));
      if (salvo.pesoG) setPeso(String(salvo.pesoG));
      if (salvo.cm) setComprimento(String(salvo.cm).replace(".", ","));
    }
  }, [perfil, loja.pronto, salvo, agora]);

  if (dia.modo === "carregando" || dia.modo === "falhou" || !perfil) {
    return (
      <TelaDaPilha titulo="O nascimento" voltarPara="/jornada">
        <Carregando />
      </TelaDaPilha>
    );
  }
  if (dia.cuidado) {
    return (
      <TelaDaPilha titulo="O nascimento" voltarPara="/jornada">
        <T>Os dados da gestação se corrigem em Seus dados, no Perfil, quando você quiser.</T>
        <Botao rotulo="Abrir os seus dados" aoTocar={() => router.replace("/perfil/dados")} />
      </TelaDaPilha>
    );
  }

  const quem = nome.trim() || "o bebê";

  /** O que vai ser gravado, ou a frase que diz o que corrigir. */
  function montar(): { dados: DadosDoNascimento } | { erro: string } {
    const recusa = recusaDoNascimento(data, agora);
    if (recusa === "futuro") return { erro: "A data do nascimento não pode ser no futuro." };
    if (recusa === "antiga") return { erro: "Data muito antiga. Confira o dia do nascimento." };
    const dados: DadosDoNascimento = { date: data };
    if (hora.trim()) {
      const h = lerHoraDigitada(hora);
      if (!h) return { erro: "Confira a hora. Por exemplo: 06:42." };
      dados.hora = h;
    }
    if (peso.trim()) {
      const g = lerPesoDigitado(peso);
      if (g == null) return { erro: "Confira o peso. Por exemplo: 3250 g ou 3,25 kg." };
      dados.pesoG = g;
    }
    if (comprimento.trim()) {
      const cm = lerComprimentoDigitado(comprimento);
      if (cm == null) return { erro: "Confira o comprimento. Por exemplo: 48,5 cm." };
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
  const ontem = ontemDe(agora);
  const ficha: "hoje" | "ontem" | "outro" = outroDia
    ? "outro"
    : data === hoje
      ? "hoje"
      : data === ontem
        ? "ontem"
        : "outro";

  function escolherFicha(f: "hoje" | "ontem" | "outro") {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setConfirmando(false);
    if (f === "outro") {
      setOutroDia(true);
      return;
    }
    setOutroDia(false);
    const ymd = f === "hoje" ? hoje : ontem;
    setData(ymd);
    setMes(mesDe(ymd));
  }

  return (
    <TelaDaPilha titulo={jaNasceu ? "O nascimento" : "Contar o nascimento"} voltarPara="/jornada">
      <View style={{ alignItems: "center", gap: espaco.sm }}>
        <ArteDaBolha humor={jaNasceu ? "feliz" : "apaixonado"} tamanho={128} />
        <Text
          accessibilityRole="header"
          style={{
            textAlign: "center",
            ...fonte.display,
            ...escala.titulo1,
            letterSpacing: -0.2,
            color: cor.texto,
          }}
        >
          {jaNasceu ? "Os dados da chegada" : `Que dia ${quem} chegou?`}
        </Text>
        <Text
          style={{
            textAlign: "center",
            ...fonte.normal,
            ...escala.legenda,
            color: cor.textoCorpo,
            paddingHorizontal: espaco.md,
          }}
        >
          {jaNasceu
            ? "Corrija o que precisar. A trilha do 4º trimestre acompanha a data."
            : "Se quiser, conte também a hora, o peso e o comprimento. Eles aparecem no cartão da chegada."}
        </Text>
      </View>

      {/* O dia: quase sempre hoje ou ontem; o calendário só no "Outro dia". */}
      <SecaoDeAjustes recuo={RECUO_SEM_ICONE}>
        <LinhaDeAjuste
          titulo="Dia"
          valor={diaCurto(data, agora)}
          rotulo={`Dia do nascimento, ${diaCurto(data, agora)}`}
        />
        <View style={{ paddingHorizontal: 12, paddingVertical: espaco.md }}>
          <Escolha
            opcoes={[
              { valor: "hoje", rotulo: "Hoje" },
              { valor: "ontem", rotulo: "Ontem" },
              { valor: "outro", rotulo: "Outro dia" },
            ]}
            valor={ficha}
            corAtiva={cor.primaria}
            rotuloAcessivel="Quando o bebê nasceu"
            aoEscolher={escolherFicha}
          />
        </View>
        {ficha === "outro" ? (
          <CalendarioDoMes
            plano
            tinta={cor.primaria}
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
        ) : null}
      </SecaoDeAjustes>

      <SecaoDeAjustes
        titulo="O bebê"
        rodape="Tudo aqui é opcional. O que você contar vai para o cartão da chegada."
        recuo={RECUO_SEM_ICONE}
      >
        <LinhaDeCampo
          rotulo="Nome"
          placeholder="Se já tiver"
          value={nome}
          onChangeText={setNome}
          maxLength={40}
          autoCapitalize="words"
        />
        <LinhaDeCampo
          rotulo="Hora"
          placeholder="Opcional"
          value={hora}
          onChangeText={(t) => setHora(mascaraDeHora(t))}
          keyboardType="number-pad"
          maxLength={5}
        />
        <LinhaDeCampo
          rotulo="Peso"
          placeholder="Opcional"
          sufixo="g"
          value={peso}
          onChangeText={setPeso}
          keyboardType="decimal-pad"
          maxLength={8}
        />
        <LinhaDeCampo
          rotulo="Comprimento"
          placeholder="Opcional"
          sufixo="cm"
          value={comprimento}
          onChangeText={setComprimento}
          keyboardType="decimal-pad"
          maxLength={6}
        />
      </SecaoDeAjustes>

      {erro ? (
        <View
          accessibilityLiveRegion="polite"
          style={{
            backgroundColor: cor.atencaoFundo,
            borderRadius: canto.campo,
            ...curva,
            padding: espaco.md,
          }}
        >
          <Text style={{ ...fonte.forte, ...escala.legenda, color: cor.atencaoForte }}>{erro}</Text>
        </View>
      ) : null}

      <Botao
        rotulo={jaNasceu ? "Salvar" : "Contar o nascimento"}
        tamanho="grande"
        carregando={salvando && !confirmando}
        aoTocar={pedirConfirmacao}
      />

      <Folha aberta={confirmando && "dados" in previa} aoFechar={() => setConfirmando(false)}>
        {"dados" in previa ? (
          <View style={{ alignItems: "center", gap: espaco.md }}>
            <ArteDaBolha humor="surpresa" tamanho={112} />
            <Text
              accessibilityRole="header"
              style={{
                textAlign: "center",
                ...fonte.display,
                ...escala.titulo2,
                letterSpacing: -0.2,
                color: folha.texto,
              }}
            >
              {nome.trim() ? `${nome.trim()} nasceu?` : "O bebê nasceu?"}
            </Text>
            <View
              style={{
                alignSelf: "stretch",
                alignItems: "center",
                gap: 2,
                paddingVertical: espaco.md,
                borderRadius: canto.dentro,
                ...curva,
                backgroundColor: folha.superficie,
              }}
            >
              <Text style={{ ...fonte.forte, ...escala.manchete, color: folha.texto }}>
                {nascimentoPorExtenso(previa.dados)}
              </Text>
              {medidasPorExtenso(previa.dados) ? (
                <Text style={{ ...fonte.normal, ...escala.legenda, color: folha.apagado }}>
                  {medidasPorExtenso(previa.dados)}
                </Text>
              ) : null}
            </View>
            <Text
              style={{
                textAlign: "center",
                ...fonte.normal,
                ...escala.legenda,
                color: folha.apagado,
              }}
            >
              O app passa para o pós-parto: a trilha vira o 4º trimestre e a gestação fica guardada
              no álbum. Dá para desfazer logo em seguida.
            </Text>
            <Botao
              rotulo="Sim, nasceu"
              tamanho="grande"
              estilo={{ alignSelf: "stretch" }}
              carregando={salvando}
              aoTocar={() => void gravar(previa.dados)}
            />
            <Tocavel
              rotulo="Ainda não"
              desabilitado={salvando}
              aoTocar={() => setConfirmando(false)}
              estilo={{ minHeight: 44, justifyContent: "center", paddingHorizontal: espaco.lg }}
            >
              <Text style={{ ...fonte.forte, ...escala.manchete, color: folha.apagado }}>
                Ainda não
              </Text>
            </Tocavel>
          </View>
        ) : null}
      </Folha>
    </TelaDaPilha>
  );
}

function ontemDe(agora: Date): string {
  const d = new Date(agora);
  d.setDate(d.getDate() - 1);
  return ymdLocal(d);
}
