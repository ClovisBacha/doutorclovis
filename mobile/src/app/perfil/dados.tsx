import { dueDateFromLmp } from "@/lib/gestacao";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  LinhaDeAjuste,
  LinhaDeCampo,
  RECUO_SEM_ICONE,
  SecaoDeAjustes,
} from "~/componentes/ajustes";
import { Carregando, NaoConsegueLer, sucesso } from "~/componentes/base";
import { AcaoDoTopo, TelaDaPilha } from "~/componentes/cabecalho";
import { useAviso } from "~/componentes/comunidade/folha";
import { ehBancada } from "~/lib/bancada";
import { deYmd, paraYmd, RECADO_DA_DATA, recusaDaDum } from "~/lib/datas";
import { gravarPerfil } from "~/lib/gravar-perfil";
import { guardarMedicoLocal, lerMedicoLocal } from "~/lib/medico-local";
import { celularE164, emailValido } from "@/lib/medico-da-gestante";
import { useSessao } from "~/lib/sessao";
import { SOS_NO_APP } from "~/config";

const texto = (v: unknown) => (typeof v === "string" ? v : "");

/**
 * SEUS DADOS — o que abastece o bebê (e, com ele no app, o SOS): o nome do
 * bebê e a data da gestação, o contato de emergência e a ficha, e quem
 * acompanha a gestação.
 *
 * 18/11/2026 (a vistoria: "o desenho de um formulário web"): campos EM LINHA,
 * como nos Contatos do iPhone (o rótulo à esquerda, o valor à direita), em
 * grupos com a explicação no rodapé. O "Salvar" mora no alto, à direita, e só
 * acende quando um campo muda; o "Salvo." é um aviso que some sozinho.
 *
 * O nome DELA não se grava aqui: só em "Editar perfil", pelas regras de lá.
 *
 * Bancada: /perfil/dados?bancada=1 [&luto=1]
 */
export default function SeusDados() {
  const { perfil, estadoDoPerfil, recarregarPerfil } = useSessao();
  if (estadoDoPerfil === "carregando") {
    return (
      <TelaDaPilha titulo="Seus dados" voltarPara="/perfil">
        <Carregando />
      </TelaDaPilha>
    );
  }
  if (estadoDoPerfil === "falhou") {
    return (
      <TelaDaPilha titulo="Seus dados" voltarPara="/perfil">
        <NaoConsegueLer
          sossego="Seus dados estão guardados."
          aoTentar={() => void recarregarPerfil()}
        />
      </TelaDaPilha>
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
  /* O médico guardado no aparelho (abaixo) também é "o que já estava": não
     acende o Salvar sozinho. */
  const [medicoDoAparelho, setMedicoDoAparelho] = useState<{
    nome: string;
    celular: string;
    email: string;
  } | null>(null);
  const [salvando, setSalvando] = useState(false);
  const aviso = useAviso();

  /* Enquanto o banco não tem as colunas do médico, o que vale é o guardado
     no aparelho: preenche os campos que vieram vazios do perfil. */
  useEffect(() => {
    void lerMedicoLocal().then((m) => {
      if (!m || perfil?.medico_celular || perfil?.medico_email) return;
      setMedicoNome((v) => v || (m.nome ?? ""));
      setMedicoCelular((v) => v || (m.celular ?? ""));
      setMedicoEmail((v) => v || (m.email ?? ""));
      setMedicoDoAparelho({ nome: m.nome ?? "", celular: m.celular ?? "", email: m.email ?? "" });
    });
  }, [perfil?.medico_celular, perfil?.medico_email]);

  const antes = (campo: string, doAparelho?: string) =>
    texto((perfil as Record<string, unknown> | null)?.[campo]) || doAparelho || "";
  const mudou =
    (!cuidadoDaSessao && bebe.trim() !== antes("baby_name").trim()) ||
    (SOS_NO_APP &&
      (contato !== antes("emergency_contact") ||
        telefone !== antes("emergency_phone") ||
        emailContato !== antes("emergency_email") ||
        sangue !== antes("blood_type") ||
        alergias !== antes("allergies") ||
        remedios !== antes("medications"))) ||
    medicoNome !== antes("medico_nome", medicoDoAparelho?.nome) ||
    medicoCelular !== antes("medico_celular", medicoDoAparelho?.celular) ||
    medicoEmail !== antes("medico_email", medicoDoAparelho?.email);

  async function salvar() {
    const uid = sessao?.user.id;
    if (!uid || ehBancada()) return aviso.mostrar("Na bancada nada é gravado.");
    /* O nome dela NÃO se grava aqui: ele é o nome dela na Comunidade, e só
       "Editar perfil" o grava, pelas regras de lá (obrigatório, sem ofensa). */
    const campos: Record<string, unknown> = {
      ...(cuidadoDaSessao ? {} : { baby_name: bebe.trim() || null }),
      /* O cartão do SOS só se grava com o SOS no app; desligado, o app não
         coleta — e não apaga o que já estava guardado. */
      ...(SOS_NO_APP
        ? {
            emergency_contact: contato.trim() || null,
            emergency_phone: telefone.trim() || null,
            emergency_email: emailContato.trim() || null,
            blood_type: sangue.trim() || null,
            allergies: alergias.trim() || null,
            medications: remedios.trim() || null,
          }
        : {}),
      medico_nome: medicoNome.trim() || null,
      medico_celular: medicoCelular.trim() || null,
      medico_email: medicoEmail.trim() || null,
    };
    /* A altura e o peso de antes saíram do app (21/10/2026: dado de saúde só
       o que o SOS e o bebê usam). O app não os grava mais — e também não os
       apaga: o que já estava no banco fica como estava. */
    if (medicoCelular.trim() && !celularE164(medicoCelular)) {
      return aviso.mostrar("Confira o celular: DDD e número.", true);
    }
    if (medicoEmail.trim() && !emailValido(medicoEmail)) {
      return aviso.mostrar("Confira o e-mail de quem acompanha você.", true);
    }
    if (dum.trim() && !perfil?.birth_date) {
      const ymd = paraYmd(dum);
      const r = recusaDaDum(ymd);
      if (r || !ymd) return aviso.mostrar(RECADO_DA_DATA[r ?? "formato"], true);
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
    if (!r.ok) return aviso.mostrar("Não conseguimos salvar. Confira a internet e tente de novo.", true);
    await recarregarPerfil();
    sucesso();
    aviso.mostrar(
      r.ignoradas.some((c) => !c.startsWith("medico_"))
        ? "Salvo. Alguns campos ainda não são aceitos pelo servidor e ficaram de fora."
        : "Salvo.",
    );
  }

  /* A data da gestação: de onde ela é contada, numa frase só. */
  const base = perfil?.reference_date ?? perfil?.lmp_date ?? null;
  const deOnde = perfil?.birth_date
    ? null
    : perfil?.reference_date
      ? `A gestação é contada pelo ultrassom de ${deYmd(perfil.reference_date)}.`
      : perfil?.lmp_date
        ? `A gestação é contada pela última menstruação, em ${deYmd(perfil.lmp_date)}.`
        : "Ainda sem a data da gestação. Toque em Data da gestação para contar.";

  return (
    <TelaDaPilha
      titulo="Seus dados"
      voltarPara="/perfil"
      sobre={aviso.elemento}
      direita={
        <AcaoDoTopo
          rotulo="Salvar"
          principal
          desabilitado={!mudou}
          carregando={salvando}
          aoTocar={() => void salvar()}
        />
      }
    >
      {/* No Modo Cuidado esta tela também para de falar do bebê. */}
      {!cuidadoDaSessao ? (
        <SecaoDeAjustes titulo="O bebê" rodape={deOnde} recuo={RECUO_SEM_ICONE}>
          <LinhaDeCampo
            rotulo="Nome"
            value={bebe}
            onChangeText={setBebe}
            placeholder="Se já tiver"
            autoCapitalize="words"
            maxLength={40}
          />
          {perfil?.birth_date ? (
            <LinhaDeAjuste
              titulo="Nascimento"
              valor={deYmd(perfil.birth_date)}
              aoTocar={() => router.push("/ritual?editar=1")}
            />
          ) : (
            <LinhaDeAjuste
              titulo="Data da gestação"
              valor={base ? deYmd(base) : null}
              aoTocar={() => router.push("/ritual?editar=1")}
            />
          )}
          {perfil?.birth_date ? null : (
            <LinhaDeAjuste titulo="O bebê nasceu" aoTocar={() => router.push("/ritual?editar=1")} />
          )}
        </SecaoDeAjustes>
      ) : null}

      {SOS_NO_APP ? (
        <SecaoDeAjustes
          titulo="Para o SOS"
          rodape="Fica guardado na sua conta e também no celular, para aparecer na tela do SOS mesmo sem internet."
          recuo={RECUO_SEM_ICONE}
        >
          <LinhaDeCampo rotulo="Contato" value={contato} onChangeText={setContato} />
          <LinhaDeCampo
            rotulo="Telefone"
            value={telefone}
            onChangeText={setTelefone}
            keyboardType="phone-pad"
          />
          <LinhaDeCampo
            rotulo="E-mail"
            value={emailContato}
            onChangeText={setEmailContato}
            placeholder="Opcional"
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <LinhaDeCampo
            rotulo="Tipo sanguíneo"
            value={sangue}
            onChangeText={setSangue}
            placeholder="O+"
            autoCapitalize="characters"
          />
          <LinhaDeCampo rotulo="Alergias" value={alergias} onChangeText={setAlergias} />
          <LinhaDeCampo rotulo="Medicações" value={remedios} onChangeText={setRemedios} />
        </SecaoDeAjustes>
      ) : null}

      <SecaoDeAjustes
        titulo={cuidadoDaSessao ? "Quem acompanha você" : "Quem acompanha a sua gestação"}
        rodape={
          SOS_NO_APP
            ? "No SOS, o app manda para essa pessoa o e-mail de emergência e oferece a mensagem pronta no WhatsApp, com a sua localização e a sua ficha."
            : "Fica guardado na sua conta, para você ter o contato sempre à mão."
        }
        recuo={RECUO_SEM_ICONE}
      >
        <LinhaDeCampo
          rotulo="Nome"
          value={medicoNome}
          onChangeText={setMedicoNome}
          placeholder="Médico ou médica"
          autoCapitalize="words"
        />
        <LinhaDeCampo
          rotulo="Celular"
          value={medicoCelular}
          onChangeText={setMedicoCelular}
          keyboardType="phone-pad"
          placeholder="(31) 99999-0000"
        />
        <LinhaDeCampo
          rotulo="E-mail"
          value={medicoEmail}
          onChangeText={setMedicoEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          placeholder="nome@exemplo.com"
        />
      </SecaoDeAjustes>
    </TelaDaPilha>
  );
}
