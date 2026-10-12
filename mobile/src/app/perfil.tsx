import { dueDateFromLmp } from "@/lib/gestacao";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Switch, View } from "react-native";
import {
  Botao,
  Campo,
  Carregando,
  Cartao,
  Linha,
  NaoConsegueLer,
  T,
  Tela,
} from "~/componentes/base";
import { limparRastrosLocais } from "~/lib/armazem";
import { ehBancada } from "~/lib/bancada";
import { deYmd, paraYmd, RECADO_DA_DATA, recusaDaDum } from "~/lib/datas";
import { gravarPerfil } from "~/lib/gravar-perfil";
import { guardarMedicoLocal, lerMedicoLocal } from "~/lib/medico-local";
import { celularE164, emailValido } from "@/lib/medico-da-gestante";
import { CartaoDaPermissaoDeIA } from "~/lib/ia/PermissaoDeIA";
import { abrir, PRIVACIDADE, TERMOS } from "~/lib/links";
import { CabecalhoDaPilha } from "~/componentes/cabecalho";
import { useSessao } from "~/lib/sessao";
import { excluirMinhaConta, ligarModoCuidado, PALAVRA_DE_CONFIRMACAO } from "~/servidor/conta";
import { supabase } from "~/servidor/supabase";
import { cor } from "~/tema";

const texto = (v: unknown) => (typeof v === "string" ? v : "");

/**
 * O Perfil: os dados que abastecem a home e o SOS, o Modo Cuidado, os
 * documentos, sair e excluir a conta (exigência da Apple: excluir DENTRO do
 * app, sem passar por e-mail).
 */
export default function Perfil() {
  const { perfil, estadoDoPerfil, recarregarPerfil } = useSessao();
  if (estadoDoPerfil === "carregando") {
    return (
      <Tela>
        <Carregando />
      </Tela>
    );
  }
  if (estadoDoPerfil === "falhou") {
    return (
      <Tela>
        <NaoConsegueLer
          sossego="Seus dados estão guardados."
          aoTentar={() => void recarregarPerfil()}
        />
      </Tela>
    );
  }
  /* A chave remonta o formulário quando o perfil chega, para os campos
     nascerem preenchidos. */
  return <FormularioDoPerfil key={perfil?.id ?? "novo"} />;
}

function FormularioDoPerfil() {
  const { sessao, perfil, recarregarPerfil, cuidado: cuidadoDaSessao } = useSessao();
  const [nome, setNome] = useState(texto(perfil?.display_name));
  const [bebe, setBebe] = useState(texto(perfil?.baby_name));
  const [dum] = useState(perfil?.lmp_date ? deYmd(perfil.lmp_date) : "");
  const [contato, setContato] = useState(texto(perfil?.emergency_contact));
  const [telefone, setTelefone] = useState(texto(perfil?.emergency_phone));
  const [emailContato, setEmailContato] = useState(texto(perfil?.emergency_email));
  const [sangue, setSangue] = useState(texto(perfil?.blood_type));
  const [alergias, setAlergias] = useState(texto(perfil?.allergies));
  const [remedios, setRemedios] = useState(texto(perfil?.medications));
  const [medicoNome, setMedicoNome] = useState(texto(perfil?.medico_nome));
  const [medicoCelular, setMedicoCelular] = useState(texto(perfil?.medico_celular));
  const [medicoEmail, setMedicoEmail] = useState(texto(perfil?.medico_email));

  /* Enquanto o banco não tem as colunas do médico, o que vale é o guardado
     no aparelho: preenche os campos que vieram vazios do perfil. */
  useEffect(() => {
    void lerMedicoLocal().then((m) => {
      if (!m || perfil?.medico_celular || perfil?.medico_email) return;
      setMedicoNome((v) => v || (m.nome ?? ""));
      setMedicoCelular((v) => v || (m.celular ?? ""));
      setMedicoEmail((v) => v || (m.email ?? ""));
    });
  }, [perfil?.medico_celular, perfil?.medico_email]);
  const [recado, setRecado] = useState<{ texto: string; erro: boolean } | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [cuidado, setCuidado] = useState(perfil?.care_mode === true);
  const [trocandoCuidado, setTrocandoCuidado] = useState(false);
  const [excluindo, setExcluindo] = useState<"fechado" | "aberto" | "enviando">("fechado");
  const [palavra, setPalavra] = useState("");
  const [erroExcluir, setErroExcluir] = useState<string | null>(null);

  async function salvar() {
    setRecado(null);
    const uid = sessao?.user.id;
    if (!uid || ehBancada()) return setRecado({ texto: "Na bancada nada é gravado.", erro: false });
    const campos: Record<string, unknown> = {
      display_name: nome.trim() || null,
      baby_name: bebe.trim() || null,
      emergency_contact: contato.trim() || null,
      emergency_phone: telefone.trim() || null,
      emergency_email: emailContato.trim() || null,
      blood_type: sangue.trim() || null,
      allergies: alergias.trim() || null,
      medications: remedios.trim() || null,
      medico_nome: medicoNome.trim() || null,
      medico_celular: medicoCelular.trim() || null,
      medico_email: medicoEmail.trim() || null,
    };
    if (medicoCelular.trim() && !celularE164(medicoCelular)) {
      return setRecado({ texto: "Confira o celular do médico: DDD e número.", erro: true });
    }
    if (medicoEmail.trim() && !emailValido(medicoEmail)) {
      return setRecado({ texto: "Confira o e-mail do médico.", erro: true });
    }
    if (dum.trim() && !perfil?.birth_date) {
      const ymd = paraYmd(dum);
      const r = recusaDaDum(ymd);
      if (r || !ymd) return setRecado({ texto: RECADO_DA_DATA[r ?? "formato"], erro: true });
      if (ymd !== perfil?.lmp_date) {
        campos.lmp_date = ymd;
        campos.due_date = dueDateFromLmp(ymd);
      }
    }
    setSalvando(true);
    /* O médico vai também para o aparelho: o SOS precisa dele sem rede e
       antes de o banco aceitar as colunas. */
    await guardarMedicoLocal({
      nome: medicoNome.trim() || null,
      celular: medicoCelular.trim() || null,
      email: medicoEmail.trim() || null,
    });
    const r = await gravarPerfil(uid, campos);
    setSalvando(false);
    if (!r.ok)
      return setRecado({
        texto: "Não conseguimos salvar. Confira a internet e tente de novo.",
        erro: true,
      });
    await recarregarPerfil();
    setRecado({
      texto: r.ignoradas.some((c) => !c.startsWith("medico_"))
        ? "Salvo. Alguns campos ainda não são aceitos pelo servidor e ficaram de fora."
        : "Salvo.",
      erro: false,
    });
  }

  async function trocarCuidado(on: boolean) {
    if (ehBancada()) return setCuidado(on);
    setTrocandoCuidado(true);
    try {
      const r = await ligarModoCuidado({ on });
      if (r.ok) {
        setCuidado(r.careMode);
        await recarregarPerfil();
      } else {
        setRecado({
          texto: "Não conseguimos mudar o Modo Cuidado agora. Tente de novo.",
          erro: true,
        });
      }
    } catch {
      setRecado({ texto: "Sem conexão. O Modo Cuidado não foi alterado.", erro: true });
    } finally {
      setTrocandoCuidado(false);
    }
  }

  function pedirCuidado(on: boolean) {
    if (!on) return void trocarCuidado(false);
    const msg =
      "O app para de mostrar o bebê, a semana e as contagens. O SOS e o acolhimento continuam. Você pode desligar quando quiser.";
    if (Platform.OS === "web") return void trocarCuidado(true);
    Alert.alert("Ligar o Modo Cuidado?", msg, [
      { text: "Agora não", style: "cancel" },
      { text: "Ligar", onPress: () => void trocarCuidado(true) },
    ]);
  }

  async function sair() {
    await limparRastrosLocais();
    await supabase.auth.signOut().catch(() => {});
    router.replace("/entrar");
  }

  async function excluir() {
    setErroExcluir(null);
    if (palavra.trim().toUpperCase() !== PALAVRA_DE_CONFIRMACAO) {
      return setErroExcluir(`Digite ${PALAVRA_DE_CONFIRMACAO} para confirmar.`);
    }
    if (ehBancada()) return setErroExcluir("Na bancada nada é apagado.");
    setExcluindo("enviando");
    try {
      const r = await excluirMinhaConta({ confirmacao: PALAVRA_DE_CONFIRMACAO });
      if (r.ok) {
        await limparRastrosLocais();
        await supabase.auth.signOut().catch(() => {});
        router.replace("/entrar");
        return;
      }
      setErroExcluir(
        r.motivo === "sessao"
          ? "Sua sessão expirou. Entre de novo e repita."
          : r.motivo === "medico"
            ? "Esta é uma conta de médico — a exclusão passa pelo suporte."
            : "Não conseguimos excluir agora. Nada foi apagado; tente de novo.",
      );
    } catch {
      setErroExcluir("Sem conexão. Nada foi apagado; tente de novo com internet.");
    }
    setExcluindo("aberto");
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Tela bordas={["top", "bottom"]}>
        <CabecalhoDaPilha titulo="Perfil" voltarPara="/inicio" />

        <Cartao>
          <T tipo="subtitulo">{cuidadoDaSessao ? "Você" : "Você e o bebê"}</T>
          <Campo rotulo="Seu nome" value={nome} onChangeText={setNome} />
          {/* No Modo Cuidado o Perfil também para de falar do bebê. */}
          {!cuidadoDaSessao ? (
            <>
              <Campo rotulo="Nome do bebê" value={bebe} onChangeText={setBebe} />
              <T tipo="apagado" estilo={{ fontSize: 14 }}>
                {perfil?.birth_date
                  ? `Bebê nascido em ${deYmd(perfil.birth_date)}.`
                  : perfil?.reference_date
                    ? `Gestação contada pelo ultrassom de ${deYmd(perfil.reference_date)}.`
                    : perfil?.lmp_date
                      ? `Gestação contada pela última menstruação (${deYmd(perfil.lmp_date)}).`
                      : "Ainda sem a data da gestação."}
              </T>
              <Botao
                rotulo={
                  perfil?.birth_date
                    ? "Corrigir a data"
                    : "Corrigir a data ou contar que o bebê nasceu"
                }
                tipo="secundario"
                aoTocar={() => router.push("/ritual?editar=1")}
              />
            </>
          ) : null}
        </Cartao>

        <Cartao>
          <T tipo="subtitulo">Para o SOS</T>
          <T tipo="apagado" estilo={{ fontSize: 14 }}>
            Fica guardado no celular e aparece na tela do SOS, mesmo sem internet.
          </T>
          <Campo rotulo="Contato de emergência" value={contato} onChangeText={setContato} />
          <Campo
            rotulo="Telefone do contato"
            value={telefone}
            onChangeText={setTelefone}
            keyboardType="phone-pad"
          />
          <Campo
            rotulo="E-mail do contato (opcional)"
            value={emailContato}
            onChangeText={setEmailContato}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <Campo
            rotulo="Tipo sanguíneo"
            value={sangue}
            onChangeText={setSangue}
            placeholder="Ex.: O+"
            autoCapitalize="characters"
          />
          <Campo rotulo="Alergias" value={alergias} onChangeText={setAlergias} />
          <Campo rotulo="Medicações em uso" value={remedios} onChangeText={setRemedios} />
        </Cartao>

        <Cartao>
          <T tipo="subtitulo">Quem acompanha a sua gestação</T>
          <T tipo="apagado" estilo={{ fontSize: 14 }}>
            No SOS, o app manda para essa pessoa o e-mail de emergência e oferece a mensagem pronta
            no WhatsApp, com a sua localização e a sua ficha.
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
        </Cartao>

        {recado ? (
          <T tipo="corpo" cor={recado.erro ? cor.urgente : cor.ok}>
            {recado.texto}
          </T>
        ) : null}
        <Botao rotulo="Salvar" aoTocar={() => void salvar()} carregando={salvando} />

        <Cartao>
          <Linha estilo={{ justifyContent: "space-between" }}>
            <View style={{ flex: 1, gap: 2 }}>
              <T tipo="rotulo">Modo Cuidado</T>
              <T tipo="apagado" estilo={{ fontSize: 14 }}>
                Para quando a gestação não seguiu. O app para de falar do bebê; o SOS continua.
              </T>
            </View>
            <Switch
              accessibilityLabel="Modo Cuidado"
              value={cuidado}
              disabled={trocandoCuidado}
              onValueChange={pedirCuidado}
              trackColor={{ true: cor.primaria, false: cor.borda }}
            />
          </Linha>
        </Cartao>

        <CartaoDaPermissaoDeIA />

        <Cartao>
          <Botao rotulo="Termos de uso" tipo="texto" aoTocar={() => abrir(TERMOS)} />
          <Botao rotulo="Política de privacidade" tipo="texto" aoTocar={() => abrir(PRIVACIDADE)} />
          <Botao rotulo="Sair da conta" tipo="secundario" aoTocar={() => void sair()} />
        </Cartao>

        <Cartao>
          {excluindo === "fechado" ? (
            <Botao
              rotulo="Excluir minha conta"
              tipo="texto"
              aoTocar={() => setExcluindo("aberto")}
            />
          ) : (
            <>
              <T tipo="subtitulo" cor={cor.urgente}>
                Excluir a conta
              </T>
              <T tipo="corpo">
                Apaga para sempre o seu perfil, a jornada, os registros de saúde, as publicações e
                as conversas. Não dá para desfazer.
              </T>
              <Campo
                rotulo={`Digite ${PALAVRA_DE_CONFIRMACAO} para confirmar`}
                value={palavra}
                onChangeText={setPalavra}
                autoCapitalize="characters"
              />
              {erroExcluir ? (
                <T tipo="corpo" cor={cor.urgente}>
                  {erroExcluir}
                </T>
              ) : null}
              <Botao
                rotulo="Excluir para sempre"
                tipo="perigo"
                carregando={excluindo === "enviando"}
                aoTocar={() => void excluir()}
              />
              <Botao rotulo="Cancelar" tipo="texto" aoTocar={() => setExcluindo("fechado")} />
            </>
          )}
        </Cartao>
      </Tela>
    </KeyboardAvoidingView>
  );
}
