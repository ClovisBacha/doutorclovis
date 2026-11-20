import * as AppleAuthentication from "expo-apple-authentication";
import { router } from "expo-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Platform, Text, View } from "react-native";
import { Botao } from "~/componentes/base";
import {
  CampoNoVeu,
  ErroNoVeu,
  FundoDaEntrada,
  LinkNoVeu,
  LinksDosDocumentos,
  marcarQueJaEntrou,
  MolduraDoPasso,
  TextoNoVeu,
  TopoDoPasso,
} from "~/componentes/entrada";
import { BarraDoPlano, OpcaoDoPlano, PerguntaDoPlano } from "~/componentes/plano/pecas";
import {
  VitrineDaDiferenca,
  VitrineDaMontagem,
  VitrineDaSemana,
  VitrineDasHoras,
  VitrineDoAcolhimento,
  VitrineDoPlanoPronto,
  VitrineDoPrazer,
  VitrineDoRitmo,
  ResumoDoPlano,
} from "~/componentes/plano/vitrines";
import { appleDisponivel, entrarComApple } from "~/lib/apple";
import { gravarJson, lerJson } from "~/lib/armazem";
import { ehBancada, parametroDaBancada } from "~/lib/bancada";
import {
  mascaraDeData,
  paraYmd,
  RECADO_DA_DATA,
  recusaDaDum,
  recusaDoUltrassom,
} from "~/lib/datas";
import { proximoApelido } from "~/lib/plano/apelidos";
import {
  aulasDoPlano,
  conteudoDoApp,
  diasDoPlano,
  linhaDoTempo,
  marcosDaCurva,
  minutosDoPlano,
  type LinhaDoTempo,
} from "~/lib/plano/numeros";
import {
  ehPasso,
  falaDoPasso,
  linhasDoAcolhimento,
  OPCOES_DA_AMIGA,
  OPCOES_DA_DATA,
  OPCOES_DA_FASE,
  OPCOES_DO_MOMENTO,
  OPCOES_DO_PILAR,
  OPCOES_DO_SENTIR,
  OPCOES_DO_TEMPO,
  opcoesDaPreocupacao,
  PASSOS,
  PASSOS_SEM_VOLTAR,
  passoPronto,
  progressoDoPasso,
  type Passo,
} from "~/lib/plano/passos";
import {
  alternar,
  alternarPreocupacao,
  CHAVE_DO_PLANO_SEM_CONTA,
  lerRespostas,
  RESPOSTAS_VAZIAS,
  type RespostasDoPlano,
} from "~/lib/plano/respostas";
import {
  itensDaMontagem,
  linhasDaDiferenca,
  numeroDoTempo,
  pecasDoPlano,
  resumoDoPlano,
} from "~/lib/plano/vitrine";
import { espaco, veu } from "~/tema";

/**
 * MONTAR O MEU PLANO — o funil antes da conta (20/11/2026).
 *
 * O dono mandou as telas de um app que converte muito bem na App Store: "um
 * processo [...] onde a pessoa fica preenchendo informações, muitas
 * informações. O aplicativo demonstra informações ali, validando que o
 * aplicativo é bom. Isso acaba criando um convencimento [...] até pelo
 * trabalho que ela já teve". Aqui, adaptado ao app de bem-estar materno: a
 * Bolha pergunta (o nome, a fase, a data, o bebê, como ela está, o que a
 * preocupa, o que quer cultivar, o tempo e o momento do dia), MOSTRA a cada
 * tanto (a semana em letras grandes, o "você não está sozinha", as horas de
 * cuidado somadas, a montagem, a diferença) e termina no plano pronto, com os
 * números dela. Salvar o plano é criar a conta.
 *
 * ⚠️ O que a referência fazia e o app NÃO faz: número inventado ("junte-se a
 * 58.364 mães", "4,8 · 1.148 avaliações", "economiza R$ 1.500"). Todo número
 * aqui se conta (`lib/plano/numeros.ts`, com catraca).
 *
 * As respostas ficam no aparelho (`CHAVE_DO_PLANO_SEM_CONTA`) a cada passo:
 * fechar o app no meio não perde nada. Depois do cadastro, a porta (`app/
 * index.tsx`) leva a `app/guardar-plano.tsx`, que grava o perfil.
 *
 * Bancada: /plano?bancada=1 · `&passo=<nome do passo>` abre num passo, já com
 * respostas de exemplo (Marina, 30/05/2026, Helena) · `&fase=nasceu` (com
 * `&data=dd/mm/aaaa`) o caminho de depois do parto.
 */
export default function MontarOPlano() {
  const [r, setR] = useState<RespostasDoPlano | null>(null);
  const [passo, setPasso] = useState<Passo>("nome");
  const [direcao, setDirecao] = useState<1 | -1>(1);
  const [erro, setErro] = useState<{ texto: string; vez: number; campo?: string } | null>(null);
  const [comApple, setComApple] = useState(Platform.OS === "ios");
  const vezes = useRef(0);

  useEffect(() => {
    void appleDisponivel().then((ok) => {
      if (!ok) setComApple(false);
    });
    let vivo = true;
    void lerJson<unknown>(CHAVE_DO_PLANO_SEM_CONTA, null).then((bruto) => {
      if (!vivo) return;
      const pedido = parametroDaBancada("passo");
      if (ehBancada() && pedido) {
        setR(respostasDaBancada());
        if (ehPasso(pedido)) setPasso(pedido);
      } else setR(lerRespostas(bruto));
    });
    return () => {
      vivo = false;
    };
  }, []);

  if (!r) return <FundoDaEntrada veu="inteiro">{null}</FundoDaEntrada>;

  const indice = PASSOS.indexOf(passo);
  const t = linhaDoTempo(r);
  const gravida = r.fase !== "nasceu";
  const nome = r.nome.trim().split(/\s+/)[0] ?? "";
  const conteudo = conteudoDoApp({ posParto: !gravida });
  const aulas = t ? aulasDoPlano(t) : 0;

  function mudar(m: Partial<RespostasDoPlano>) {
    setErro(null);
    setR((atual) => {
      const novo = { ...(atual ?? RESPOSTAS_VAZIAS), ...m };
      void gravarJson(CHAVE_DO_PLANO_SEM_CONTA, novo);
      return novo;
    });
  }

  function errar(texto: string, campo?: string) {
    vezes.current += 1;
    setErro({ texto, campo, vez: vezes.current });
  }

  function irPara(p: Passo | undefined, dir: 1 | -1) {
    if (!p) return;
    setErro(null);
    setDirecao(dir);
    setPasso(p);
  }

  /** A data com as mesmas recusas do ritual. Devolve a recusa (ou `null`, se pode seguir). */
  function recusaDaData(): { texto: string; campo: string } | null {
    if (!r) return { texto: RECADO_DA_DATA.formato, campo: "data" };
    const ymd = paraYmd(r.data);
    if (r.fase === "nasceu") {
      if (!ymd) return { texto: RECADO_DA_DATA.formato, campo: "data" };
      if (new Date(ymd + "T00:00:00").getTime() > Date.now())
        return { texto: RECADO_DA_DATA.futuro, campo: "data" };
      return null;
    }
    if (r.modo === "us") {
      const s = Number(r.semanasUs);
      if (!Number.isInteger(s) || s < 4 || s > 42)
        return {
          texto: "Quantas semanas o ultrassom mostrou? Um número de 4 a 42.",
          campo: "semanas",
        };
      const d = r.diasUs ? Number(r.diasUs) : 0;
      if (!Number.isInteger(d) || d < 0 || d > 6)
        return { texto: "Os dias vão de 0 a 6.", campo: "dias" };
      const recusa = recusaDoUltrassom(ymd, s);
      return recusa ? { texto: RECADO_DA_DATA[recusa], campo: "data" } : null;
    }
    const recusa = recusaDaDum(ymd);
    return recusa ? { texto: RECADO_DA_DATA[recusa], campo: "data" } : null;
  }

  function avancar() {
    if (!r) return;
    if (passo === "data") {
      const recusa =
        recusaDaData() ??
        (linhaDoTempo(r) ? null : { texto: RECADO_DA_DATA.formato, campo: "data" });
      if (recusa) return errar(recusa.texto, recusa.campo);
    }
    if (passo === "diferenca" || passo === "pronto")
      mudar({ completoEm: new Date().toISOString() });
    irPara(PASSOS[indice + 1], 1);
  }

  function voltar() {
    if (indice === 0) {
      if (router.canGoBack()) router.back();
      else router.replace("/entrar");
      return;
    }
    let i = indice - 1;
    while (i > 0 && PASSOS_SEM_VOLTAR.has(PASSOS[i]!)) i -= 1;
    irPara(PASSOS[i], -1);
  }

  async function apple() {
    setErro(null);
    const res = await entrarComApple();
    if (res.ok) {
      marcarQueJaEntrou();
      router.replace("/");
    } else if (!res.cancelado) errar(res.mensagem);
  }

  const erroEm = (campo: string) => (erro?.campo === campo ? erro : null);
  const campoComErro = (campo: string) => ({
    erro: erroEm(campo)?.texto,
    tremer: erroEm(campo)?.vez,
  });

  const fala = falaDoPasso(passo, r);
  const pronto = passoPronto(passo, r);

  /* ── O pé de cada passo ── */
  let pe: ReactNode;
  if (passo === "montando") pe = null;
  else if (passo === "conta")
    pe = (
      <>
        {erro && !erro.campo ? <ErroNoVeu>{erro.texto}</ErroNoVeu> : null}
        {comApple ? (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
            cornerRadius={28}
            style={{ height: 56 }}
            onPress={apple}
          />
        ) : null}
        <Botao
          rotulo={comApple ? "Criar conta com e-mail" : "Criar minha conta"}
          tamanho="grande"
          aoTocar={() => router.push("/cadastro")}
          estilo={{ minHeight: 56 }}
        />
        <LinkNoVeu rotulo="Já tenho conta" aoTocar={() => router.push("/email")} />
      </>
    );
  else
    pe = (
      <>
        {erro && !erro.campo ? <ErroNoVeu>{erro.texto}</ErroNoVeu> : null}
        <Botao
          rotulo={
            passo === "pronto"
              ? "Salvar o meu plano"
              : passo === "diferenca"
                ? "Ver o meu plano"
                : "Continuar"
          }
          tamanho="grande"
          desabilitado={!pronto}
          aoTocar={avancar}
          estilo={{ minHeight: 56 }}
        />
        {passo === "bebe" ? (
          <LinkNoVeu
            rotulo="Ainda não decidimos"
            apagado
            aoTocar={() => {
              mudar({ bebe: "" });
              irPara(PASSOS[indice + 1], 1);
            }}
          />
        ) : null}
      </>
    );

  return (
    <FundoDaEntrada veu="inteiro">
      <MolduraDoPasso
        chave={passo}
        direcao={direcao}
        centro={passo === "prazer" || passo === "montando"}
        topo={
          <TopoDoPasso aoVoltar={voltar} semVoltar={passo === "montando"}>
            <BarraDoPlano fracao={progressoDoPasso(passo)} />
          </TopoDoPasso>
        }
        pe={pe}
      >
        {fala.pergunta ? (
          <PerguntaDoPlano
            pose={fala.pose}
            reacao={fala.reacao}
            pergunta={fala.pergunta}
            apoio={fala.apoio}
          />
        ) : null}

        {passo === "nome" ? (
          <CampoNoVeu
            rotulo="Seu nome"
            value={r.nome}
            onChangeText={(nome) => mudar({ nome })}
            autoFocus={!r.nome}
            autoComplete="name"
            textContentType="givenName"
            autoCapitalize="words"
            returnKeyType="next"
            onSubmitEditing={() => pronto && avancar()}
            placeholder="Ex.: Marina"
            dica="É o nome que as suas amigas veem no app."
          />
        ) : null}

        {passo === "prazer" ? <VitrineDoPrazer nome={nome} /> : null}

        {passo === "fase" ? (
          <View style={{ gap: espaco.sm }}>
            {OPCOES_DA_FASE.map((o) => (
              <OpcaoDoPlano
                key={o.valor}
                rotulo={o.rotulo}
                icone={o.icone}
                marcada={r.fase === o.valor}
                aoTocar={() =>
                  mudar({
                    fase: o.valor,
                    modo: o.valor === "nasceu" ? "nasceu" : r.modo === "nasceu" ? "dum" : r.modo,
                    preocupacoes: [],
                  })
                }
              />
            ))}
          </View>
        ) : null}

        {passo === "data" ? (
          <>
            {gravida ? (
              <View style={{ gap: espaco.sm }}>
                {OPCOES_DA_DATA.map((o) => (
                  <OpcaoDoPlano
                    key={o.valor}
                    rotulo={o.rotulo}
                    icone={o.icone}
                    marcada={r.modo === o.valor}
                    aoTocar={() => mudar({ modo: o.valor })}
                  />
                ))}
              </View>
            ) : null}
            <CampoNoVeu
              rotulo={
                !gravida
                  ? "Data do nascimento"
                  : r.modo === "us"
                    ? "Data do ultrassom"
                    : "Primeiro dia da última menstruação"
              }
              value={r.data}
              onChangeText={(v) => mudar({ data: mascaraDeData(v) })}
              placeholder="dd/mm/aaaa"
              keyboardType="number-pad"
              maxLength={10}
              dica={r.modo === "us" && gravida ? undefined : "Dá para corrigir depois, no Perfil."}
              {...campoComErro("data")}
            />
            {gravida && r.modo === "us" ? (
              <>
                <View style={{ flexDirection: "row", gap: espaco.md }}>
                  <View style={{ flex: 1 }}>
                    <CampoNoVeu
                      rotulo="Semanas"
                      value={r.semanasUs}
                      onChangeText={(v) => mudar({ semanasUs: v.replace(/\D/g, "").slice(0, 2) })}
                      keyboardType="number-pad"
                      placeholder="12"
                      {...campoComErro("semanas")}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <CampoNoVeu
                      rotulo="Dias"
                      value={r.diasUs}
                      onChangeText={(v) => mudar({ diasUs: v.replace(/\D/g, "").slice(0, 1) })}
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

        {passo === "semana" && t ? <VitrineDaSemana t={t} nome={nome} /> : null}

        {passo === "bebe" ? (
          <>
            <CampoNoVeu
              rotulo="Nome do bebê"
              value={r.bebe}
              onChangeText={(bebe) => mudar({ bebe })}
              autoCapitalize="words"
              returnKeyType="next"
              onSubmitEditing={avancar}
              placeholder="Nome ou apelido"
            />
            <LinkNoVeu
              rotulo="Gerar um apelido"
              alinhar="esquerda"
              aoTocar={() => mudar({ bebe: proximoApelido(r.bebe, Math.random()) })}
            />
          </>
        ) : null}

        {passo === "primeira" ? (
          <View style={{ gap: espaco.sm }}>
            <OpcaoDoPlano
              rotulo={gravida ? "Sim, a primeira" : "Sim, o primeiro"}
              icone="sparkles"
              marcada={r.primeira === true}
              aoTocar={() => mudar({ primeira: true })}
            />
            <OpcaoDoPlano
              rotulo="Não, já sou mãe"
              icone="heart"
              marcada={r.primeira === false}
              aoTocar={() => mudar({ primeira: false })}
            />
          </View>
        ) : null}

        {passo === "sentir" ? (
          <View style={{ gap: espaco.sm }}>
            {OPCOES_DO_SENTIR.map((o) => (
              <OpcaoDoPlano
                key={o.valor}
                rotulo={o.rotulo}
                icone={o.icone}
                marcada={r.sentir === o.valor}
                aoTocar={() => mudar({ sentir: o.valor })}
              />
            ))}
          </View>
        ) : null}

        {passo === "preocupa" ? (
          <View style={{ gap: espaco.sm }}>
            {opcoesDaPreocupacao(r.fase).map((o) => (
              <OpcaoDoPlano
                key={o.valor}
                varias
                rotulo={o.rotulo}
                icone={o.icone}
                marcada={r.preocupacoes.includes(o.valor)}
                aoTocar={() =>
                  mudar({ preocupacoes: alternarPreocupacao(r.preocupacoes, o.valor) })
                }
              />
            ))}
          </View>
        ) : null}

        {passo === "acolhe" ? <VitrineDoAcolhimento linhas={linhasDoAcolhimento(r)} /> : null}

        {passo === "cultivar" ? (
          <View style={{ gap: espaco.sm }}>
            {OPCOES_DO_PILAR.map((o) => (
              <OpcaoDoPlano
                key={o.valor}
                varias
                rotulo={o.rotulo}
                icone={o.icone}
                marcada={r.pilares.includes(o.valor)}
                aoTocar={() => mudar({ pilares: alternar(r.pilares, o.valor) })}
              />
            ))}
          </View>
        ) : null}

        {passo === "tempo" ? (
          <View style={{ gap: espaco.sm }}>
            {OPCOES_DO_TEMPO.map((o) => (
              <OpcaoDoPlano
                key={o.valor}
                rotulo={o.rotulo}
                sub={o.sub}
                icone={o.icone}
                marcada={r.minutos === o.valor}
                aoTocar={() => mudar({ minutos: o.valor })}
              />
            ))}
          </View>
        ) : null}

        {passo === "momento" ? (
          <View style={{ gap: espaco.sm }}>
            {OPCOES_DO_MOMENTO.map((o) => (
              <OpcaoDoPlano
                key={o.valor}
                rotulo={o.rotulo}
                sub={o.sub}
                icone={o.icone}
                marcada={r.momento === o.valor}
                aoTocar={() => mudar({ momento: o.valor })}
              />
            ))}
          </View>
        ) : null}

        {passo === "horas" && t ? <Horas t={t} r={r} aulas={aulas} /> : null}

        {passo === "amiga" ? (
          <>
            <View style={{ gap: espaco.sm }}>
              {OPCOES_DA_AMIGA.map((o) => (
                <OpcaoDoPlano
                  key={o.valor}
                  rotulo={o.rotulo}
                  icone={o.icone}
                  marcada={r.amiga === o.valor}
                  aoTocar={() => mudar({ amiga: o.valor })}
                />
              ))}
            </View>
            {r.amiga === "codigo" ? (
              <CampoNoVeu
                rotulo="Código da amiga"
                value={r.codigo}
                onChangeText={(codigo) => mudar({ codigo })}
                autoCapitalize="characters"
                autoCorrect={false}
                placeholder="Ex.: JULI7K"
                dica="Quando você salvar o plano, eu ligo vocês duas."
              />
            ) : null}
          </>
        ) : null}

        {passo === "montando" && t ? (
          <VitrineDaMontagem
            nome={nome}
            itens={itensDaMontagem(r, t, aulas, conteudo)}
            aoTerminar={() => setTimeout(() => irPara("diferenca", 1), 900)}
          />
        ) : null}

        {passo === "diferenca" && t ? (
          <VitrineDaDiferenca linhas={linhasDaDiferenca(r, t)} />
        ) : null}

        {passo === "pronto" && t ? (
          <VitrineDoPlanoPronto
            titulo={
              nome ? (
                <>
                  {"O plano de "}
                  <Text style={{ fontStyle: "italic", color: veu.destaqueNoVeu }}>{nome}</Text>
                  {" está pronto"}
                </>
              ) : (
                "O seu plano está pronto"
              )
            }
            grandes={
              diasDoPlano(t) < 14
                ? [
                    { numero: `${r.minutos ?? 5} min`, rotulo: "por dia, só seus" },
                    { numero: String(conteudo.meditacoes), rotulo: "pausas guiadas" },
                  ]
                : [
                    {
                      numero: String(aulas),
                      rotulo: gravida ? "aulas até a data provável" : "desafios até as 12 semanas",
                    },
                    {
                      numero: numeroDoTempo(minutosDoPlano(t, r.minutos ?? 5)),
                      rotulo: "de cuidado com você",
                    },
                  ]
            }
            pecas={pecasDoPlano(r, t, aulas, conteudo)}
          />
        ) : null}

        {passo === "conta" && t ? (
          <View style={{ gap: espaco.md }}>
            <ResumoDoPlano linhas={resumoDoPlano(r, t, aulas)} />
            <TextoNoVeu nivel="legenda">
              Crie a sua conta para guardar o plano e a sua semana. O que você me contou sobre como
              se sente fica só no seu celular.
            </TextoNoVeu>
            <LinksDosDocumentos />
          </View>
        ) : null}
      </MolduraDoPasso>
    </FundoDaEntrada>
  );
}

function Horas({ t, r, aulas }: { t: LinhaDoTempo; r: RespostasDoPlano; aulas: number }) {
  const minutos = r.minutos ?? 5;
  /* No fim do plano (passou da data provável, ou o bebê passou das 12
     semanas), somar "5 minutos até a data provável" soaria pouco: aí a
     vitrine fala do ritmo de cada dia, sem gráfico. */
  if (diasDoPlano(t) < 14) return <VitrineDoRitmo minutos={minutos} momento={r.momento} />;
  return (
    <VitrineDasHoras
      minutos={minutos}
      total={minutosDoPlano(t, minutos)}
      fim={t.modo === "gravida" ? "a data provável" : "as 12 semanas"}
      marcos={marcosDaCurva(t, minutos)}
      aulas={aulas}
      gravida={t.modo === "gravida"}
    />
  );
}

/** As respostas de exemplo da bancada (as fotos de cada passo). */
function respostasDaBancada(): RespostasDoPlano {
  const nasceu = parametroDaBancada("fase") === "nasceu";
  return {
    ...RESPOSTAS_VAZIAS,
    nome: parametroDaBancada("nome") ?? "Marina",
    fase: nasceu ? "nasceu" : "gravida",
    modo: nasceu ? "nasceu" : "dum",
    data: parametroDaBancada("data") ?? (nasceu ? "06/11/2026" : "30/05/2026"),
    bebe: parametroDaBancada("bebe") ?? "Helena",
    primeira: true,
    sentir: "ansiosa",
    preocupacoes: nasceu ? ["sono", "tempo", "sozinha"] : ["semanas", "ansiedade", "sozinha"],
    pilares: ["aprender", "calma", "vinculo"],
    minutos: 5,
    momento: "noite",
    amiga: "depois",
    codigo: "",
    completoEm: null,
  };
}
