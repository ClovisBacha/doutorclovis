import { dueDateFromLmp } from "@/lib/gestacao";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform } from "react-native";
import { Botao, Campo, Carregando, Cartao, NaoConsegueLer, T, Tela } from "~/componentes/base";
import { ehBancada } from "~/lib/bancada";
import { deYmd, paraYmd, RECADO_DA_DATA, recusaDaDum } from "~/lib/datas";
import { gravarPerfil } from "~/lib/gravar-perfil";
import { guardarMedicoLocal, lerMedicoLocal } from "~/lib/medico-local";
import { celularE164, emailValido } from "@/lib/medico-da-gestante";
import { CabecalhoDaPilha } from "~/componentes/cabecalho";
import { useSessao } from "~/lib/sessao";
import { cor } from "~/tema";

const texto = (v: unknown) => (typeof v === "string" ? v : "");

/**
 * SEUS DADOS — o que abastece o bebê e o SOS: o nome do bebê e a data da
 * gestação, o contato de emergência, a ficha (tipo sanguíneo, alergias,
 * medicações) e quem acompanha a gestação.
 *
 * Era o corpo do antigo Perfil. Na fase 3 o Perfil virou um só: a cara dela na
 * rede fica no topo dele (e em "Editar perfil", com o nome — que só se grava
 * lá, pelas regras da Comunidade); o Modo Cuidado, os documentos, sair e
 * excluir a conta ficam na lista do Perfil.
 */
export default function SeusDados() {
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
  return <FormularioDosDados key={perfil?.id ?? "novo"} />;
}

function FormularioDosDados() {
  const { sessao, perfil, recarregarPerfil, cuidado: cuidadoDaSessao } = useSessao();
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

  async function salvar() {
    setRecado(null);
    const uid = sessao?.user.id;
    if (!uid || ehBancada()) return setRecado({ texto: "Na bancada nada é gravado.", erro: false });
    /* O nome dela NÃO se grava aqui: ele é o nome dela na Comunidade, e só
       "Editar perfil" o grava, pelas regras de lá (obrigatório, sem ofensa). */
    const campos: Record<string, unknown> = {
      ...(cuidadoDaSessao ? {} : { baby_name: bebe.trim() || null }),
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
    /* A altura e o peso de antes saíram do app (21/10/2026: dado de saúde só
       o que o SOS e o bebê usam). O app não os grava mais — e também não os
       apaga: o que já estava no banco fica como estava. */
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

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Tela bordas={["top", "bottom"]}>
        <CabecalhoDaPilha titulo="Seus dados" voltarPara="/perfil" />

        {/* No Modo Cuidado esta tela também para de falar do bebê. */}
        {!cuidadoDaSessao ? (
          <Cartao>
            <T tipo="subtitulo">O bebê</T>
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
          </Cartao>
        ) : null}

        <Cartao>
          <T tipo="subtitulo">Para o SOS</T>
          <T tipo="apagado" estilo={{ fontSize: 14 }}>
            Fica guardado na sua conta e também no celular, para aparecer na tela do SOS mesmo sem
            internet.
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
      </Tela>
    </KeyboardAvoidingView>
  );
}
