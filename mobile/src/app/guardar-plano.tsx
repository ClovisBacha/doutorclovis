import { dueDateFromLmp } from "@/lib/gestacao";
import Check from "lucide-react-native/icons/check";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Platform, Text, View } from "react-native";
import { Botao, sucesso } from "~/componentes/base";
import { PerguntaDoPlano, Superficie } from "~/componentes/plano/pecas";
import {
  ErroNoVeu,
  FundoDaEntrada,
  LinkNoVeu,
  MolduraDoPasso,
  TextoNoVeu,
} from "~/componentes/entrada";
import { BolhaViva, Entrada } from "~/componentes/movimento";
import { RevelacaoDaSemana } from "~/componentes/revelacao-da-semana";
import { ligarPeloCodigo } from "~/componentes/amigas/economia";
import { vendaLigada } from "~/lib/assinatura/bancada";
import { ehBancada, parametroDaBancada } from "~/lib/bancada";
import { paraYmd } from "~/lib/datas";
import { gravarPerfil } from "~/lib/gravar-perfil";
import { abrirLoja, gravarChave } from "~/lib/jornada/loja";
import { CHAVE_NASCIMENTO } from "~/lib/jornada/nascimento";
import { definirLembretesDaJornada } from "~/lib/lembretes-da-jornada";
import { lerPlanoDoAparelho, passarPlanoParaAConta } from "~/lib/plano/no-aparelho";
import { aulasDoPlano, linhaDoTempo } from "~/lib/plano/numeros";
import { MOMENTO_NA_FRASE } from "~/lib/plano/passos";
import { HORA_DO_MOMENTO, RESPOSTAS_VAZIAS, type RespostasDoPlano } from "~/lib/plano/respostas";
import { horaNaFrase, linhasDoQueMuda } from "~/lib/plano/vitrine";
import { revelaASemana } from "~/lib/ritual";
import { useSessao } from "~/lib/sessao";
import { cor, escala, espaco, fonte, veu } from "~/tema";

type Etapa = "guardando" | "falhou" | "lembrete" | "oque" | "revelar";

/**
 * GUARDAR O PLANO — depois do cadastro (20/11/2026).
 *
 * Quem montou o plano antes da conta (`app/(entrada)/plano.tsx`) chega aqui
 * pela porta (`app/index.tsx`), com a conta nova e sem a data no perfil:
 *
 *   1. guardando: o nome, a data e o bebê vão para o perfil (como no ritual);
 *      o código da amiga liga as duas; as respostas íntimas (como ela se sente,
 *      o que a preocupa) passam para a chave da conta, SÓ no aparelho;
 *   2. o lembrete: "Posso te lembrar às 21h, antes de dormir?" (o pedido da
 *      permissão no momento em que ela faz sentido);
 *   3. o que muda com o seu plano: o que ela escolheu, dito de volta;
 *   4. a assinatura (`app/assinatura.tsx`), quando a venda estiver ligada
 *      (`ASSINATURA_NO_APP`); fechar ou comprar volta para cá, na revelação;
 *   5. a revelação da semana, com a Bolha, e a aba do bebê.
 *
 * Se gravar falha, ela não perde nada: as respostas continuam no aparelho, e
 * "Tentar de novo" refaz o passo 1.
 *
 * Bancada: /guardar-plano?bancada=1&etapa=lembrete|oque|revelar
 */
export default function GuardarOPlano() {
  const { sessao, perfil, recarregarPerfil } = useSessao();
  const pedida = useLocalSearchParams<{ etapa?: string }>().etapa;
  const [r, setR] = useState<RespostasDoPlano | null>(null);
  const [etapa, setEtapa] = useState<Etapa>(() =>
    pedida === "revelar"
      ? "revelar"
      : ehBancada() && pedida === "oque"
        ? "oque"
        : ehBancada() && pedida === "lembrete"
          ? "lembrete"
          : "guardando",
  );
  const [lembrete, setLembrete] = useState<string | null>(null);
  const [pedindo, setPedindo] = useState(false);
  const [semPermissao, setSemPermissao] = useState(false);
  const comecou = useRef(false);
  const uid = sessao?.user.id ?? null;

  useEffect(() => {
    if (comecou.current) return;
    comecou.current = true;
    void (async () => {
      const lido = ehBancada() ? respostasDaBancada() : await lerPlanoDoAparelho(uid);
      setR(lido);
      if (etapa === "guardando") await guardar(lido);
    })();
    // Uma vez, ao abrir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function guardar(respostas: RespostasDoPlano) {
    setEtapa("guardando");
    if (ehBancada()) return setTimeout(() => setEtapa("lembrete"), 900);
    if (!uid) return router.replace("/entrar");
    const ymd = paraYmd(respostas.data);
    const payload: Record<string, unknown> = {};
    if (respostas.nome.trim()) payload.display_name = respostas.nome.trim();
    if (respostas.bebe.trim()) payload.baby_name = respostas.bebe.trim();
    if (respostas.fase === "nasceu" && ymd) payload.birth_date = ymd;
    else if (respostas.modo === "us" && ymd) {
      payload.reference_date = ymd;
      payload.reference_weeks = Number(respostas.semanasUs);
      payload.reference_days = respostas.diasUs ? Number(respostas.diasUs) : 0;
    } else if (ymd) {
      payload.lmp_date = ymd;
      payload.due_date = dueDateFromLmp(ymd);
    }
    const g = await gravarPerfil(uid, payload);
    if (!g.ok) return setEtapa("falhou");
    if (respostas.fase === "nasceu" && ymd) {
      await abrirLoja(uid);
      gravarChave(CHAVE_NASCIMENTO, { date: ymd });
    }
    /* O código da amiga, agora que o perfil existe (o servidor liga as duas). */
    if (respostas.amiga === "codigo" && respostas.codigo.trim())
      await ligarPeloCodigo(respostas.codigo).catch(() => null);
    await passarPlanoParaAConta(uid, respostas);
    await recarregarPerfil();
    sucesso();
    setEtapa(respostas.momento && Platform.OS !== "web" ? "lembrete" : "oque");
  }

  async function ligarLembrete() {
    if (!r?.momento) return setEtapa("oque");
    const hora = HORA_DO_MOMENTO[r.momento];
    if (ehBancada() || !uid) {
      setLembrete(hora);
      return setEtapa("oque");
    }
    setPedindo(true);
    const res = await definirLembretesDaJornada(uid, { hora, semanaNova: true }, null);
    setPedindo(false);
    if (res === "ok") {
      setLembrete(hora);
      setEtapa("oque");
    } else setSemPermissao(true);
  }

  function depoisDoQueMuda() {
    /* A venda no fim do funil (20/11/2026): com a assinatura ligada
       (`vendaLigada`, a chave `ASSINATURA_NO_APP`), o plano completo vem
       aqui, e fechar ou comprar volta para a revelação da semana. A tela de
       venda se cala sozinha no Modo Cuidado. */
    if (vendaLigada())
      return router.replace({
        pathname: "/assinatura",
        params: {
          depois: ehBancada()
            ? "/guardar-plano?bancada=1&etapa=revelar"
            : "/guardar-plano?etapa=revelar",
          origem: "plano",
        },
      });
    setEtapa("revelar");
  }

  function abrirAsAbas() {
    router.replace(ehBancada() ? "/jornada?bancada=1" : "/jornada");
  }

  const t = r ? linhaDoTempo(r) : null;

  if (etapa === "revelar") {
    const semana = t?.modo === "gravida" ? t.semana : null;
    const revela =
      semana != null &&
      revelaASemana({ editar: false, modo: r?.modo ?? "dum", cuidado: perfil?.care_mode === true });
    if (!r) return <FundoDaEntrada veu="inteiro">{null}</FundoDaEntrada>;
    if (!revela) return <Redirect href={ehBancada() ? "/jornada?bancada=1" : "/jornada"} />;
    return (
      <FundoDaEntrada veu="inteiro">
        <RevelacaoDaSemana semana={semana!} nome={r.nome} aoTerminar={abrirAsAbas} />
      </FundoDaEntrada>
    );
  }

  const nome = (r?.nome ?? "").trim().split(/\s+/)[0] ?? "";

  if (etapa === "guardando" || etapa === "falhou" || !r || !t)
    return (
      <FundoDaEntrada veu="inteiro">
        <MolduraDoPasso
          centro
          pe={
            etapa === "falhou" ? (
              <Botao
                rotulo="Tentar de novo"
                tamanho="grande"
                aoTocar={() => r && void guardar(r)}
                estilo={{ minHeight: 56 }}
              />
            ) : undefined
          }
        >
          <View style={{ alignItems: "center", gap: espaco.lg }}>
            <BolhaViva humor={etapa === "falhou" ? "feliz" : "estudiosa"} tamanho={160} />
            <Text
              accessibilityRole="header"
              style={{
                ...fonte.display,
                ...escala.titulo1,
                color: cor.branco,
                textAlign: "center",
              }}
            >
              {etapa === "falhou" ? "Não consegui guardar agora" : "Guardando o seu plano…"}
            </Text>
            {etapa === "falhou" ? (
              <ErroNoVeu>
                Confira a internet e tente de novo. As suas respostas continuam guardadas aqui.
              </ErroNoVeu>
            ) : null}
          </View>
        </MolduraDoPasso>
      </FundoDaEntrada>
    );

  if (etapa === "lembrete" && r.momento) {
    const hora = HORA_DO_MOMENTO[r.momento];
    return (
      <FundoDaEntrada veu="inteiro">
        <MolduraDoPasso
          centro
          pe={
            <>
              <Botao
                rotulo={semPermissao ? "Seguir sem lembrete" : "Sim, me lembre"}
                tamanho="grande"
                carregando={pedindo}
                aoTocar={() => (semPermissao ? setEtapa("oque") : void ligarLembrete())}
                estilo={{ minHeight: 56 }}
              />
              {!semPermissao ? (
                <LinkNoVeu rotulo="Agora não" apagado aoTocar={() => setEtapa("oque")} />
              ) : null}
            </>
          }
        >
          <PerguntaDoPlano
            pose="feliz"
            reacao="Um toque só, para o seu momento."
            pergunta={`Posso te lembrar todo dia às ${horaNaFrase(hora)}, ${MOMENTO_NA_FRASE[r.momento]}?`}
          />
          {semPermissao ? (
            <TextoNoVeu nivel="legenda">
              Os avisos estão desligados para o app. Dá para ligar depois, nos Ajustes do iPhone, em
              Notificações.
            </TextoNoVeu>
          ) : null}
        </MolduraDoPasso>
      </FundoDaEntrada>
    );
  }

  const aulas = aulasDoPlano(t);
  return (
    <FundoDaEntrada veu="inteiro">
      <MolduraDoPasso
        pe={
          <Botao
            rotulo="Continuar"
            tamanho="grande"
            aoTocar={depoisDoQueMuda}
            estilo={{ minHeight: 56 }}
          />
        }
      >
        <View style={{ alignItems: "center", paddingTop: espaco.md }}>
          <BolhaViva humor="comemorando" tamanho={112} />
        </View>
        <Text
          accessibilityRole="header"
          style={{
            ...fonte.display,
            ...escala.titulo1,
            letterSpacing: -0.3,
            color: cor.branco,
            textAlign: "center",
          }}
        >
          {"O que muda com o seu plano"}
          {nome ? (
            <>
              {", "}
              <Text style={{ color: veu.destaqueNoVeu }}>{nome}</Text>
            </>
          ) : null}
        </Text>
        <Superficie estilo={{ paddingHorizontal: espaco.lg }}>
          {linhasDoQueMuda(r, t, aulas, lembrete).map((l, i) => (
            <Entrada key={l.titulo} atraso={100 + i * 90}>
              <View
                style={{
                  flexDirection: "row",
                  gap: espaco.md,
                  alignItems: "flex-start",
                  paddingVertical: espaco.lg,
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: "rgba(255,255,255,0.1)",
                }}
              >
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    marginTop: 1,
                    backgroundColor: cor.primaria,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Check size={13} color={cor.branco} strokeWidth={3} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ ...fonte.forte, ...escala.chamada, color: cor.branco }}>
                    {l.titulo}
                  </Text>
                  <Text style={{ ...fonte.media, ...escala.legenda, color: veu.textoNoVeu }}>
                    {l.sub}
                  </Text>
                </View>
              </View>
            </Entrada>
          ))}
        </Superficie>
        <Text
          style={{ ...fonte.media, ...escala.nota, color: veu.textoNoVeu, textAlign: "center" }}
        >
          O app Mãe Esperta é bem-estar e aprendizado, e não dá orientação médica. Quem orienta é
          quem acompanha você. Em emergência, ligue 192.
        </Text>
      </MolduraDoPasso>
    </FundoDaEntrada>
  );
}

function respostasDaBancada(): RespostasDoPlano {
  return {
    ...RESPOSTAS_VAZIAS,
    nome: parametroDaBancada("nome") ?? "Marina",
    fase: "gravida",
    modo: "dum",
    data: parametroDaBancada("data") ?? "30/05/2026",
    bebe: parametroDaBancada("bebe") ?? "Helena",
    primeira: true,
    sentir: "ansiosa",
    preocupacoes: ["semanas", "ansiedade", "sozinha"],
    pilares: ["aprender", "calma", "vinculo"],
    minutos: 5,
    momento: "noite",
    amiga: "depois",
    completoEm: new Date().toISOString(),
  };
}
