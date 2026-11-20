import { dueDateFromLmp } from "@/lib/gestacao";
import { router, useLocalSearchParams } from "expo-router";
import { useRef, useState } from "react";
import { View } from "react-native";
import { Botao, sucesso } from "~/componentes/base";
import { FalaDaBolha, RespostaDela } from "~/componentes/bolha/na-entrada";
import {
  CampoNoVeu,
  ErroNoVeu,
  EscolhaNoVeu,
  FundoDaEntrada,
  LinkNoVeu,
  MolduraDoPasso,
  SegmentosDoPasso,
  TextoNoVeu,
  TopoDoPasso,
} from "~/componentes/entrada";
import { RevelacaoDaSemana } from "~/componentes/revelacao-da-semana";
import { ehBancada, parametroDaBancada } from "~/lib/bancada";
import { gravarPerfil } from "~/lib/gravar-perfil";
import { abrirLoja, gravarChave } from "~/lib/jornada/loja";
import { CHAVE_NASCIMENTO } from "~/lib/jornada/nascimento";
import { guardarMedicoLocal } from "~/lib/medico-local";
import { nomeParaSugerir, precisaDeNome } from "~/lib/nome-do-cadastro";
import { celularE164, emailValido } from "@/lib/medico-da-gestante";
import {
  deYmd,
  mascaraDeData,
  paraYmd,
  RECADO_DA_DATA,
  recusaDaDum,
  recusaDoUltrassom,
} from "~/lib/datas";
import { ligarPeloCodigo } from "~/componentes/amigas/economia";
import { codigoLimpo, fraseDaIndicacao, type ResultadoDaIndicacao } from "~/lib/jornada/amigas";
import { RECOMPENSA_DA_INDICACAO } from "~/lib/jornada/recompensas";
import {
  falaDoRitual,
  ordemDoRitual,
  PASSO_DO_CONTATO,
  PASSO_DO_MEDICO,
  revelaASemana,
  semanaDaRevelacao,
  type FalaDoRitual,
  type ModoDaData,
} from "~/lib/ritual";
import { useSessao } from "~/lib/sessao";
import { espaco } from "~/tema";
import { COMUNIDADE_NO_APP, SOS_NO_APP } from "~/config";

type Modo = ModoDaData;
/** O nome, a data, o bebê, o contato, o médico e a rede (o último só no cadastro). */
const PASSOS = 6;
const PASSO_DA_REDE = 5;

type Campo = "nome" | "data" | "semanas" | "dias" | "celular" | "email" | "codigo";
type Erro = { texto: string; vez: number; campo?: Campo };

/**
 * O ritual de boas-vindas: o mínimo para o app acompanhar a gestação, em
 * passos curtos. Só o passo da data é obrigatório; o resto pode ser pulado e
 * completado no Perfil.
 *
 * O último é o da REDE (fase 3): "Uma amiga te chamou?" O código dela liga
 * as duas (`attributeReferral`: a amizade, o seguir mútuo e as sementinhas de
 * quem convidou). Antes, quem entrava pelo app nunca virava amiga de quem a
 * convidou: só o link do site levava o código. Corrigindo a data (`?editar=1`)
 * não há passo da rede.
 *
 * 18/11/2026 (a vistoria: "ninguém o tinha revisto"): o ritual sai da página
 * clara e fica no MESMO céu da entrada, com a moldura de passo dela (os
 * tracinhos, o voltar de vidro, o passo novo deslizando da direita e o botão
 * preso acima do teclado). Com o SOS desligado, o contato e o médico saem
 * (`ordemDoRitual`).
 *
 * 19/11/2026, o dono: "o bebê bolha vai ser aquele personagem que vai
 * conversar com a mãe". A BOLHA CONDUZ: cada pergunta chega como fala dela,
 * num balão (com os três pontinhos antes), e a resposta do passo anterior
 * aparece do lado direito, como na conversa da aba do Bebê. O que ela diz
 * mora em `falaDoRitual` (`lib/ritual.ts`, com catraca). No fim do primeiro
 * ritual, a REVELAÇÃO: a Bolha comemorando na frente do número da semana
 * (`revelaASemana`), e só então a primeira aba.
 *
 * Bancada: /ritual?bancada=1 · `&passo=N` abre num passo · `&revelar=24`
 * abre na revelação · `&nome=`, `&data=dd/mm/aaaa`, `&bebe=`, `&codigo=` e
 * `&indicacao=ligou|nao-encontrou|depois|falhou` preenchem as respostas (os
 * mesmos estados da tela).
 */
export default function Ritual() {
  const { sessao, perfil, recarregarPerfil } = useSessao();
  /* `?editar=1`: aberto do Perfil (ou da Jornada) para corrigir a data:
     começa no passo da data, já preenchido, e ao salvar volta de onde veio. */
  const editar = useLocalSearchParams<{ editar?: string }>().editar === "1";
  const total = editar ? PASSO_DA_REDE : PASSOS;
  const ordem = ordemDoRitual(total, SOS_NO_APP);
  const inicial = editar ? 1 : Number(parametroDaBancada("passo") ?? 0);
  const [passo, setPasso] = useState(() =>
    Number.isFinite(inicial) && ordem.includes(inicial) ? inicial : ordem[0]!,
  );
  const [direcao, setDirecao] = useState<1 | -1>(1);
  /* Nunca o começo do e-mail: é o nome que as amigas veem (nome-do-cadastro.ts). */
  const [nome, setNome] = useState(
    () =>
      parametroDaBancada("nome") ??
      nomeParaSugerir({
        doPerfil: perfil?.display_name,
        daConta: sessao?.user.user_metadata?.display_name as string | undefined,
        email: sessao?.user.email,
      }),
  );
  const modoInicial: Modo = perfil?.birth_date ? "nasceu" : perfil?.reference_date ? "us" : "dum";
  const [modo, setModo] = useState<Modo>(modoInicial);
  const [data, setData] = useState(
    () =>
      parametroDaBancada("data") ??
      deYmd(
        modoInicial === "nasceu"
          ? perfil?.birth_date
          : modoInicial === "us"
            ? perfil?.reference_date
            : perfil?.lmp_date,
      ),
  );
  const [semanasUs, setSemanasUs] = useState(
    perfil?.reference_weeks != null ? String(perfil.reference_weeks) : "",
  );
  const [diasUs, setDiasUs] = useState(
    perfil?.reference_days != null ? String(perfil.reference_days) : "",
  );
  const [bebe, setBebe] = useState(() => parametroDaBancada("bebe") ?? perfil?.baby_name ?? "");
  const [contato, setContato] = useState(perfil?.emergency_contact ?? "");
  const [telefone, setTelefone] = useState(perfil?.emergency_phone ?? "");
  const [medicoNome, setMedicoNome] = useState(perfil?.medico_nome ?? "");
  const [medicoCelular, setMedicoCelular] = useState(perfil?.medico_celular ?? "");
  const [medicoEmail, setMedicoEmail] = useState(perfil?.medico_email ?? "");
  const [codigo, setCodigo] = useState(() => parametroDaBancada("codigo") ?? "");
  const [indicacao, setIndicacao] = useState<ResultadoDaIndicacao | null>(() => {
    const r = parametroDaBancada("indicacao");
    return r === "ligou" || r === "nao-encontrou" || r === "depois" || r === "falhou" ? r : null;
  });
  const [ligando, setLigando] = useState(false);
  const [erro, setErro] = useState<Erro | null>(null);
  const [salvando, setSalvando] = useState(false);
  /* A semana que o fim do primeiro ritual revela (`null` enquanto não chega lá). */
  const [revelacao, setRevelacao] = useState<number | null>(() => {
    const r = Number(parametroDaBancada("revelar"));
    return Number.isInteger(r) && r > 0 ? r : null;
  });
  const vezes = useRef(0);

  const indice = Math.max(0, ordem.indexOf(passo));
  const ultimo = indice === ordem.length - 1;

  function errar(texto: string, campo?: Campo) {
    vezes.current += 1;
    setErro({ texto, campo, vez: vezes.current });
  }

  function irPara(p: number | undefined, dir: 1 | -1) {
    if (p === undefined) return;
    setErro(null);
    setDirecao(dir);
    setPasso(p);
  }

  function conferirData(): Erro["campo"] | null {
    const ymd = paraYmd(data);
    if (modo === "dum") {
      const r = recusaDaDum(ymd);
      if (r) errar(RECADO_DA_DATA[r], "data");
      return r ? "data" : null;
    }
    if (modo === "us") {
      const s = Number(semanasUs);
      if (!Number.isInteger(s) || s < 4 || s > 42) {
        errar("Quantas semanas o ultrassom mostrou? Um número de 4 a 42.", "semanas");
        return "semanas";
      }
      const d = diasUs ? Number(diasUs) : 0;
      if (!Number.isInteger(d) || d < 0 || d > 6) {
        errar("Os dias vão de 0 a 6.", "dias");
        return "dias";
      }
      const r = recusaDoUltrassom(ymd, s);
      if (r) errar(RECADO_DA_DATA[r], "data");
      return r ? "data" : null;
    }
    if (!ymd) {
      errar(RECADO_DA_DATA.formato, "data");
      return "data";
    }
    if (new Date(ymd + "T00:00:00").getTime() > Date.now()) {
      errar(RECADO_DA_DATA.futuro, "data");
      return "data";
    }
    return null;
  }

  /** Liga as duas pelo código. Devolve o resultado (e o mostra na tela). */
  async function ligar(): Promise<ResultadoDaIndicacao | null> {
    setErro(null);
    if (codigoLimpo(codigo).length < 3) {
      errar("Esse código parece curto. Confira as letras com ela.", "codigo");
      return null;
    }
    setLigando(true);
    const r = await ligarPeloCodigo(codigo);
    setLigando(false);
    setIndicacao(r);
    if (r === "ligou") sucesso();
    return r;
  }

  async function avancar() {
    setErro(null);
    if (
      passo === 0 &&
      !ehBancada() &&
      precisaDeNome({ digitado: nome, doPerfil: perfil?.display_name, email: sessao?.user.email })
    )
      return errar("Escreva como você quer ser chamada. É o nome que as amigas veem.", "nome");
    if (passo === 1 && conferirData()) return;
    if (passo === PASSO_DO_MEDICO) {
      if (medicoCelular.trim() && !celularE164(medicoCelular))
        return errar("Confira o celular: DDD e número.", "celular");
      if (medicoEmail.trim() && !emailValido(medicoEmail))
        return errar("Confira o e-mail.", "email");
    }
    /* Digitou o código e foi direto em "Começar": tenta ligar antes. Se não
       achou, fica para ela conferir (o segundo toque segue sem). */
    if (passo === PASSO_DA_REDE && codigo.trim() && indicacao === null) {
      const r = await ligar();
      if (r !== "ligou" && r !== "depois") return;
    }
    if (!ultimo) irPara(ordem[indice + 1], 1);
    else void salvar();
  }

  function abrirAsAbas() {
    router.replace(ehBancada() ? "/jornada?bancada=1" : "/jornada");
  }

  async function salvar() {
    const ymd = paraYmd(data);
    /* O primeiro ritual termina revelando a semana, com a Bolha (nunca
       corrigindo a data, nunca depois do parto, nunca no Modo Cuidado). */
    const semana = revelaASemana({ editar, modo, cuidado: perfil?.care_mode === true })
      ? semanaDaRevelacao({
          modo,
          ymd,
          semanasUs: Number(semanasUs),
          diasUs: diasUs ? Number(diasUs) : 0,
        })
      : null;
    if (ehBancada()) return semana != null ? setRevelacao(semana) : abrirAsAbas();
    const uid = sessao?.user.id;
    if (!uid) return router.replace("/entrar");
    setSalvando(true);
    const payload: Record<string, unknown> = {};
    if (nome.trim()) payload.display_name = nome.trim();
    if (bebe.trim()) payload.baby_name = bebe.trim();
    if (SOS_NO_APP && contato.trim()) payload.emergency_contact = contato.trim();
    if (SOS_NO_APP && telefone.trim()) payload.emergency_phone = telefone.trim();
    if (medicoNome.trim()) payload.medico_nome = medicoNome.trim();
    if (medicoCelular.trim()) payload.medico_celular = medicoCelular.trim();
    if (medicoEmail.trim()) payload.medico_email = medicoEmail.trim();
    /* O médico também vai para o aparelho: o SOS sem rede e o banco que
       ainda não tem as colunas (APLICAR_MEDICO_DA_GESTANTE.sql). */
    if (medicoCelular.trim() || medicoEmail.trim())
      await guardarMedicoLocal({
        nome: medicoNome.trim() || null,
        celular: medicoCelular.trim() || null,
        email: medicoEmail.trim() || null,
      });
    if (modo === "dum" && ymd) {
      payload.lmp_date = ymd;
      payload.due_date = dueDateFromLmp(ymd);
    } else if (modo === "us" && ymd) {
      payload.reference_date = ymd;
      payload.reference_weeks = Number(semanasUs);
      payload.reference_days = diasUs ? Number(diasUs) : 0;
    } else if (modo === "nasceu" && ymd) {
      payload.birth_date = ymd;
    }
    /* Corrigindo: a âncora antiga não pode continuar vencendo. Quem volta de
       "nasceu" para a gestação perde o birth_date; quem troca o ultrassom pela
       DUM perde a referência (o cálculo prefere o ultrassom). */
    if (editar && ymd) {
      if (modo !== "nasceu") payload.birth_date = null;
      if (modo === "dum") {
        payload.reference_date = null;
        payload.reference_weeks = null;
        payload.reference_days = null;
      }
    }
    const r = await gravarPerfil(uid, payload);
    if (!r.ok) {
      setSalvando(false);
      errar(
        "Não conseguimos salvar agora. Confira a internet e tente de novo. O que você escreveu continua aqui.",
      );
      return;
    }
    /* A jornada fica de acordo com o perfil ANTES de ele ser relido: o
       nascimento que o site guardou no blob (`dc-path-birth`) não pode voltar
       a valer depois que ela o corrigiu aqui, nem o site, enquanto existir,
       pode continuar achando que ela está grávida. */
    if (modo === "nasceu" && ymd) {
      await abrirLoja(uid);
      gravarChave(CHAVE_NASCIMENTO, { date: ymd });
    } else if (editar && ymd) {
      await abrirLoja(uid);
      gravarChave(CHAVE_NASCIMENTO, null);
    }
    /* A conta não estava pronta quando ela digitou o código: agora o perfil
       foi gravado, e o servidor consegue ligar as duas. */
    if (indicacao === "depois") await ligarPeloCodigo(codigo);
    setSalvando(false);
    await recarregarPerfil();
    if (editar && router.canGoBack()) router.back();
    else if (semana != null) setRevelacao(semana);
    else abrirAsAbas();
  }

  if (revelacao != null)
    return (
      <FundoDaEntrada veu="inteiro">
        <RevelacaoDaSemana semana={revelacao} nome={nome} aoTerminar={abrirAsAbas} />
      </FundoDaEntrada>
    );

  /* O que a Bolha diz neste passo, e a resposta do passo anterior do lado dela. */
  const fala = falaDoRitual({
    passo,
    editar,
    modo,
    nome,
    data,
    semanasUs,
    diasUs,
    bebe,
    anterior: indice > 0 ? (ordem[indice - 1] ?? null) : null,
  });
  const erroEm = (campo: Campo) => (erro?.campo === campo ? erro : null);
  const campoComErro = (campo: Campo) => ({
    erro: erroEm(campo)?.texto,
    tremer: erroEm(campo)?.vez,
  });
  /* No primeiro passo do primeiro ritual não há para onde voltar; corrigindo
     a data, o primeiro voltar fecha a tela. */
  const voltar =
    indice > 0
      ? () => irPara(ordem[indice - 1], -1)
      : editar && router.canGoBack()
        ? () => router.back()
        : undefined;

  return (
    <FundoDaEntrada veu="inteiro">
      <MolduraDoPasso
        chave={passo}
        direcao={direcao}
        topo={
          <TopoDoPasso aoVoltar={voltar} semVoltar={!voltar}>
            <SegmentosDoPasso total={ordem.length} atual={indice} />
          </TopoDoPasso>
        }
        pe={
          <>
            {erro && !erro.campo ? <ErroNoVeu>{erro.texto}</ErroNoVeu> : null}
            <Botao
              rotulo={ultimo ? (editar ? "Salvar" : "Começar") : "Continuar"}
              tamanho="grande"
              aoTocar={() => void avancar()}
              carregando={salvando || (passo === PASSO_DA_REDE && ligando)}
              estilo={{ minHeight: 56 }}
            />
            {passo >= 2 ? (
              <LinkNoVeu
                rotulo="Pular por agora"
                apagado
                aoTocar={() => (ultimo ? void salvar() : irPara(ordem[indice + 1], 1))}
              />
            ) : null}
          </>
        }
      >
        <Conversa fala={fala} />

        {passo === 0 ? (
          <CampoNoVeu
            rotulo="Seu nome"
            value={nome}
            onChangeText={setNome}
            autoFocus={!nome}
            autoComplete="name"
            textContentType="givenName"
            autoCapitalize="words"
            returnKeyType="next"
            onSubmitEditing={() => void avancar()}
            placeholder="Ex.: Marina"
            dica="É o nome que as suas amigas veem no app."
            {...campoComErro("nome")}
          />
        ) : null}

        {passo === 1 ? (
          <>
            <View style={{ gap: espaco.sm }}>
              <EscolhaNoVeu
                rotulo="Sei a data da última menstruação"
                marcada={modo === "dum"}
                aoTocar={() => setModo("dum")}
              />
              <EscolhaNoVeu
                rotulo="Tenho a data de um ultrassom"
                marcada={modo === "us"}
                aoTocar={() => setModo("us")}
              />
              <EscolhaNoVeu
                rotulo="Meu bebê já nasceu"
                marcada={modo === "nasceu"}
                aoTocar={() => setModo("nasceu")}
              />
            </View>
            <CampoNoVeu
              rotulo={
                modo === "dum"
                  ? "Primeiro dia da última menstruação"
                  : modo === "us"
                    ? "Data do ultrassom"
                    : "Data do nascimento"
              }
              value={data}
              onChangeText={(t) => setData(mascaraDeData(t))}
              placeholder="dd/mm/aaaa"
              keyboardType="number-pad"
              maxLength={10}
              dica={modo === "us" ? undefined : "Dá para corrigir depois, no Perfil."}
              {...campoComErro("data")}
            />
            {modo === "us" ? (
              <>
                <View style={{ flexDirection: "row", gap: espaco.md }}>
                  <View style={{ flex: 1 }}>
                    <CampoNoVeu
                      rotulo="Semanas"
                      value={semanasUs}
                      onChangeText={(t) => setSemanasUs(t.replace(/\D/g, "").slice(0, 2))}
                      keyboardType="number-pad"
                      placeholder="12"
                      {...campoComErro("semanas")}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <CampoNoVeu
                      rotulo="Dias"
                      value={diasUs}
                      onChangeText={(t) => setDiasUs(t.replace(/\D/g, "").slice(0, 1))}
                      keyboardType="number-pad"
                      placeholder="0"
                      {...campoComErro("dias")}
                    />
                  </View>
                </View>
                <TextoNoVeu nivel="legenda">
                  Use as semanas e os dias que estão no laudo.
                </TextoNoVeu>
              </>
            ) : null}
          </>
        ) : null}

        {passo === 2 ? (
          <CampoNoVeu
            rotulo="Nome do bebê"
            value={bebe}
            onChangeText={setBebe}
            autoFocus={!bebe}
            autoCapitalize="words"
            returnKeyType="next"
            onSubmitEditing={() => void avancar()}
          />
        ) : null}

        {passo === PASSO_DO_CONTATO && SOS_NO_APP ? (
          <>
            <CampoNoVeu
              rotulo="Nome do contato"
              value={contato}
              onChangeText={setContato}
              autoCapitalize="words"
              placeholder="Ex.: Rafael"
            />
            <CampoNoVeu
              rotulo="Telefone com DDD"
              value={telefone}
              onChangeText={setTelefone}
              keyboardType="phone-pad"
              placeholder="(31) 99999-0000"
            />
            <TextoNoVeu nivel="legenda">
              Avise essa pessoa de que ela é o seu contato de emergência no app.
            </TextoNoVeu>
          </>
        ) : null}

        {passo === PASSO_DO_MEDICO ? (
          <>
            <TextoNoVeu nivel="legenda">
              {SOS_NO_APP
                ? "No SOS, o app manda o e-mail de emergência para o seu médico ou médica e deixa a mensagem pronta no WhatsApp, com a sua localização."
                : "Fica guardado na sua conta, para você ter o contato sempre à mão."}
            </TextoNoVeu>
            <CampoNoVeu
              rotulo="Nome do médico ou médica"
              value={medicoNome}
              onChangeText={setMedicoNome}
              autoCapitalize="words"
            />
            <CampoNoVeu
              rotulo="Celular (WhatsApp)"
              value={medicoCelular}
              onChangeText={setMedicoCelular}
              keyboardType="phone-pad"
              placeholder="(31) 99999-0000"
              {...campoComErro("celular")}
            />
            <CampoNoVeu
              rotulo="E-mail"
              value={medicoEmail}
              onChangeText={setMedicoEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              {...campoComErro("email")}
            />
          </>
        ) : null}

        {passo === PASSO_DA_REDE ? (
          <>
            <CampoNoVeu
              rotulo="Código da amiga"
              value={codigo}
              onChangeText={(t) => {
                setCodigo(t);
                if (indicacao && indicacao !== "ligou") setIndicacao(null);
              }}
              autoCapitalize="characters"
              autoCorrect={false}
              placeholder="Ex.: JULI7K"
              dica={
                (modo === "nasceu"
                  ? "Com o código, vocês já entram como amigas."
                  : "Com o código, vocês já entram como amigas, prontas para formar uma dupla.") +
                ` Quem te chamou ganha ${RECOMPENSA_DA_INDICACAO} sementinhas.` +
                (COMUNIDADE_NO_APP ? " Vocês também se veem na Comunidade." : "")
              }
              {...campoComErro("codigo")}
            />
            {/* O botão aparece quando há um código para usar (o "Começar"
                também tenta ligar antes de seguir). */}
            {indicacao === "ligou" || codigoLimpo(codigo).length >= 3 ? (
              <Botao
                rotulo={indicacao === "ligou" ? "Vocês já são amigas" : "Usar o código"}
                tipo="secundario"
                carregando={ligando}
                desabilitado={indicacao === "ligou"}
                aoTocar={() => void ligar()}
              />
            ) : null}
            {/* O resultado do código é a Bolha respondendo (as frases são dela,
                na primeira pessoa: "Guardei o código", "eu ligo vocês"). */}
            {indicacao ? (
              <View style={{ gap: espaco.md }}>
                <RespostaDela texto={codigoLimpo(codigo)} />
                <FalaDaBolha
                  texto={fraseDaIndicacao(indicacao, RECOMPENSA_DA_INDICACAO)}
                  pose={
                    indicacao === "ligou"
                      ? "comemorando"
                      : indicacao === "depois"
                        ? "feliz"
                        : "surpresa"
                  }
                  tamanho={56}
                  nivel="corpo"
                  escrever
                />
              </View>
            ) : null}
            <TextoNoVeu nivel="nota">
              Sem código? Depois, na aba Amigas, você convida quem quiser.
            </TextoNoVeu>
          </>
        ) : null}
      </MolduraDoPasso>
    </FundoDaEntrada>
  );
}

/**
 * A conversa de um passo: a resposta que ela deu no passo anterior, do lado
 * direito, e a pergunta da Bolha, com os três pontinhos antes (cada passo
 * monta a sua, então a Bolha "escreve" a cada pergunta nova).
 */
function Conversa({ fala }: { fala: FalaDoRitual }) {
  return (
    <View style={{ gap: espaco.md }}>
      {fala.dela ? <RespostaDela texto={fala.dela} /> : null}
      <FalaDaBolha texto={fala.texto} pose={fala.pose} escrever pergunta />
    </View>
  );
}
