import { dueDateFromLmp } from "@/lib/gestacao";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, View } from "react-native";
import { BolhaViva } from "~/componentes/movimento";
import { Botao, Campo, Cartao, Linha, T, Tela, toque } from "~/componentes/base";
import { ehBancada, parametroDaBancada } from "~/lib/bancada";
import { gravarPerfil } from "~/lib/gravar-perfil";
import { guardarMedicoLocal } from "~/lib/medico-local";
import { celularE164, emailValido } from "@/lib/medico-da-gestante";
import {
  deYmd,
  mascaraDeData,
  paraYmd,
  RECADO_DA_DATA,
  recusaDaDum,
  recusaDoUltrassom,
} from "~/lib/datas";
import { useSessao } from "~/lib/sessao";
import { ALVO_MINIMO, cor, espaco, raio } from "~/tema";

type Modo = "dum" | "us" | "nasceu";
const PASSOS = 5;

/**
 * O ritual de boas-vindas: o mínimo para o app acompanhar a gestação, em
 * quatro passos curtos. Só o passo da data é obrigatório — o resto pode ser
 * pulado e completado no Perfil.
 */
export default function Ritual() {
  const { sessao, perfil, recarregarPerfil } = useSessao();
  /* `?editar=1`: aberto do Perfil (ou da Jornada) para corrigir a data —
     começa no passo da data, já preenchido, e ao salvar volta de onde veio. */
  const editar = useLocalSearchParams<{ editar?: string }>().editar === "1";
  const inicial = editar ? 1 : Number(parametroDaBancada("passo") ?? 0);
  const [passo, setPasso] = useState(
    Number.isFinite(inicial) ? Math.min(Math.max(inicial, 0), PASSOS - 1) : 0,
  );
  const [nome, setNome] = useState(
    perfil?.display_name ?? (sessao?.user.user_metadata?.display_name as string | undefined) ?? "",
  );
  const modoInicial: Modo = perfil?.birth_date ? "nasceu" : perfil?.reference_date ? "us" : "dum";
  const [modo, setModo] = useState<Modo>(modoInicial);
  const [data, setData] = useState(
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
  const [bebe, setBebe] = useState(perfil?.baby_name ?? "");
  const [contato, setContato] = useState(perfil?.emergency_contact ?? "");
  const [telefone, setTelefone] = useState(perfil?.emergency_phone ?? "");
  const [medicoNome, setMedicoNome] = useState(perfil?.medico_nome ?? "");
  const [medicoCelular, setMedicoCelular] = useState(perfil?.medico_celular ?? "");
  const [medicoEmail, setMedicoEmail] = useState(perfil?.medico_email ?? "");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  function conferirData(): string | null {
    const ymd = paraYmd(data);
    if (modo === "dum") {
      const r = recusaDaDum(ymd);
      return r ? RECADO_DA_DATA[r] : null;
    }
    if (modo === "us") {
      const s = Number(semanasUs);
      if (!Number.isInteger(s) || s < 4 || s > 42)
        return "Quantas semanas o ultrassom mostrou? Um número de 4 a 42.";
      const d = diasUs ? Number(diasUs) : 0;
      if (!Number.isInteger(d) || d < 0 || d > 6) return "Os dias vão de 0 a 6.";
      const r = recusaDoUltrassom(ymd, s);
      return r ? RECADO_DA_DATA[r] : null;
    }
    if (!ymd) return RECADO_DA_DATA.formato;
    if (new Date(ymd + "T00:00:00").getTime() > Date.now()) return RECADO_DA_DATA.futuro;
    return null;
  }

  function avancar() {
    setErro(null);
    if (passo === 1) {
      const e = conferirData();
      if (e) return setErro(e);
    }
    if (passo === 4) {
      if (medicoCelular.trim() && !celularE164(medicoCelular))
        return setErro("Confira o celular: DDD e número.");
      if (medicoEmail.trim() && !emailValido(medicoEmail)) return setErro("Confira o e-mail.");
    }
    if (passo < PASSOS - 1) setPasso(passo + 1);
    else void salvar();
  }

  async function salvar() {
    if (ehBancada()) return router.replace("/inicio?bancada=1");
    const uid = sessao?.user.id;
    if (!uid) return router.replace("/entrar");
    setSalvando(true);
    const ymd = paraYmd(data);
    const payload: Record<string, unknown> = {};
    if (nome.trim()) payload.display_name = nome.trim();
    if (bebe.trim()) payload.baby_name = bebe.trim();
    if (contato.trim()) payload.emergency_contact = contato.trim();
    if (telefone.trim()) payload.emergency_phone = telefone.trim();
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
    setSalvando(false);
    if (!r.ok) {
      setErro(
        "Não conseguimos salvar agora. Confira a internet e tente de novo — nada foi perdido nesta tela.",
      );
      return;
    }
    await recarregarPerfil();
    if (editar && router.canGoBack()) router.back();
    else router.replace("/inicio");
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Tela bordas={["top", "bottom"]}>
        <Linha estilo={{ gap: 6 }}>
          {Array.from({ length: PASSOS }, (_, i) => (
            <View
              key={i}
              style={{
                flex: 1,
                height: 6,
                borderRadius: 3,
                backgroundColor: i <= passo ? cor.primaria : cor.borda,
              }}
            />
          ))}
        </Linha>
        <View style={{ alignItems: "center", marginTop: espaco.md }}>
          {/* A chave troca o vídeo quando o humor muda (o player é por humor). */}
          <BolhaViva
            key={passo === PASSOS - 1 ? "comemorando" : "feliz"}
            humor={passo === PASSOS - 1 ? "comemorando" : "feliz"}
            tamanho={116}
          />
        </View>

        {passo === 0 ? (
          <>
            <T tipo="titulo" centro>
              Que bom ter você aqui
            </T>
            <T tipo="apagado" centro>
              Vamos deixar o app com a sua cara. Leva um minuto.
            </T>
            <Campo
              rotulo="Como você gostaria de ser chamada?"
              value={nome}
              onChangeText={setNome}
              autoComplete="name"
            />
          </>
        ) : null}

        {passo === 1 ? (
          <>
            <T tipo="titulo" centro>
              Em que fase você está?
            </T>
            <View style={{ gap: espaco.sm }}>
              <Escolha
                rotulo="Sei a data da última menstruação"
                marcado={modo === "dum"}
                aoTocar={() => setModo("dum")}
              />
              <Escolha
                rotulo="Tenho a data de um ultrassom"
                marcado={modo === "us"}
                aoTocar={() => setModo("us")}
              />
              <Escolha
                rotulo="Meu bebê já nasceu"
                marcado={modo === "nasceu"}
                aoTocar={() => setModo("nasceu")}
              />
            </View>
            <Campo
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
            />
            {modo === "us" ? (
              <Linha>
                <View style={{ flex: 1 }}>
                  <Campo
                    rotulo="Semanas"
                    value={semanasUs}
                    onChangeText={(t) => setSemanasUs(t.replace(/\D/g, "").slice(0, 2))}
                    keyboardType="number-pad"
                    placeholder="12"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Campo
                    rotulo="Dias"
                    value={diasUs}
                    onChangeText={(t) => setDiasUs(t.replace(/\D/g, "").slice(0, 1))}
                    keyboardType="number-pad"
                    placeholder="0"
                  />
                </View>
              </Linha>
            ) : null}
            <T tipo="apagado" estilo={{ fontSize: 13 }}>
              {modo === "us"
                ? "Quando existe, o ultrassom é a referência mais precisa da idade gestacional."
                : "Você pode corrigir depois, no Perfil."}
            </T>
          </>
        ) : null}

        {passo === 2 ? (
          <>
            <T tipo="titulo" centro>
              {modo === "nasceu" ? "Como se chama o bebê?" : "O bebê já tem nome?"}
            </T>
            <T tipo="apagado" centro>
              Pode deixar em branco se ainda não decidiram.
            </T>
            <Campo
              rotulo="Nome do bebê"
              value={bebe}
              onChangeText={setBebe}
              autoCapitalize="words"
            />
          </>
        ) : null}

        {passo === 3 ? (
          <>
            <T tipo="titulo" centro>
              Quem avisar numa emergência?
            </T>
            <T tipo="apagado" centro>
              No SOS, o app liga para o 192 e manda a sua localização para esta pessoa — mesmo sem
              internet, por SMS.
            </T>
            <Campo
              rotulo="Nome do contato"
              value={contato}
              onChangeText={setContato}
              autoCapitalize="words"
              placeholder="Ex.: Rafael"
            />
            <Campo
              rotulo="Telefone com DDD"
              value={telefone}
              onChangeText={setTelefone}
              keyboardType="phone-pad"
              placeholder="(31) 99999-0000"
            />
            <Cartao fundo={cor.apagado}>
              <T tipo="apagado" estilo={{ fontSize: 14 }}>
                Avise essa pessoa de que ela é o seu contato de emergência no app.
              </T>
            </Cartao>
          </>
        ) : null}

        {passo === 4 ? (
          <>
            <T tipo="titulo" centro>
              Quem acompanha a sua gestação?
            </T>
            <T tipo="apagado" centro>
              No SOS, o app manda o e-mail de emergência para o seu médico ou médica e deixa a
              mensagem pronta no WhatsApp, com a sua localização.
            </T>
            <Campo
              rotulo="Nome do médico ou médica"
              value={medicoNome}
              onChangeText={setMedicoNome}
              autoCapitalize="words"
            />
            <Campo
              rotulo="Celular (WhatsApp)"
              value={medicoCelular}
              onChangeText={setMedicoCelular}
              keyboardType="phone-pad"
              placeholder="(31) 99999-0000"
            />
            <Campo
              rotulo="E-mail"
              value={medicoEmail}
              onChangeText={setMedicoEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </>
        ) : null}

        {erro ? (
          <T tipo="apagado" cor={cor.urgente}>
            {erro}
          </T>
        ) : null}
        <Botao
          rotulo={passo < PASSOS - 1 ? "Continuar" : "Começar"}
          aoTocar={avancar}
          carregando={salvando}
        />
        {passo >= 2 ? (
          <Botao
            rotulo="Pular por agora"
            tipo="texto"
            aoTocar={() => (passo < PASSOS - 1 ? setPasso(passo + 1) : void salvar())}
          />
        ) : null}
        {passo > 0 ? (
          <Botao rotulo="Voltar" tipo="texto" aoTocar={() => setPasso(passo - 1)} />
        ) : null}
      </Tela>
    </KeyboardAvoidingView>
  );
}

function Escolha({
  rotulo,
  marcado,
  aoTocar,
}: {
  rotulo: string;
  marcado: boolean;
  aoTocar: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: marcado }}
      onPress={() => {
        toque();
        aoTocar();
      }}
      style={{
        minHeight: ALVO_MINIMO + 8,
        borderRadius: raio.md,
        borderWidth: 2,
        borderColor: marcado ? cor.primaria : cor.borda,
        backgroundColor: marcado ? cor.destaque : cor.cartao,
        paddingHorizontal: espaco.lg,
        justifyContent: "center",
      }}
    >
      <T tipo="rotulo" cor={marcado ? cor.textoDestaque : cor.texto}>
        {rotulo}
      </T>
    </Pressable>
  );
}
