import { router } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import { Botao, Cartao, Linha, T, Tela } from "~/componentes/base";
import { PilulaSos } from "~/componentes/cabecalho";
import { CaixaDeMarcar } from "~/componentes/caixa";
import { rota } from "~/componentes/jornada/bancada";
import { limparRastrosLocais } from "~/lib/armazem";
import { ehBancada } from "~/lib/bancada";
import { esquecerMeuPerfilSocial } from "~/lib/comunidade/meu-perfil";
import { metadadosDoAceite, VERSAO_DOS_TERMOS, versaoAceita } from "~/lib/juridico/aceite";
import { lembrarAceite } from "~/lib/juridico/aceite-da-sessao";
import { PONTOS_DO_ACEITE, TEXTO_DO_CONSENTIMENTO_DE_SAUDE } from "~/lib/juridico/textos-do-aceite";
import { zerarSelos } from "~/lib/selos";
import { useSessao } from "~/lib/sessao";
import { supabase } from "~/servidor/supabase";
import { cor, espaco, fonte } from "~/tema";

/**
 * O ACEITE DOS TERMOS DO APP — a porta do app (`index.tsx`) traz para cá quem
 * ainda não aceitou a versão em vigor: quem entrou pela Apple (esse caminho
 * nunca passou por aceite nem pelos 18 anos), quem aceitou os termos antigos
 * do site, e todas, de novo, quando a versão muda.
 *
 * O essencial vem em linguagem simples antes das caixas; os documentos
 * inteiros abrem em telas do app. O dado de saúde tem a sua caixa, destacada.
 * Não concordar não prende ninguém: dá para sair ou excluir a conta. O SOS
 * fica no topo, como em toda tela.
 *
 * Bancada: /aceite?bancada=1
 */
export default function Aceite() {
  const { sessao } = useSessao();
  const primeiraVez = versaoAceita(sessao?.user.user_metadata) === null;
  const [maior, setMaior] = useState(false);
  const [termos, setTermos] = useState(false);
  const [saude, setSaude] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function aceitar() {
    setErro(null);
    if (!maior) return setErro("O app é para maiores de 18 anos.");
    if (!termos) return setErro("Para continuar, confirme que leu e concorda com os Termos.");
    if (!saude)
      return setErro(
        "Sem guardar a datação da gestação e o cartão do SOS, o app não consegue acompanhar você. Para continuar, marque a última caixa.",
      );
    if (ehBancada()) return router.replace(rota("/jornada") as never);
    setEnviando(true);
    const { error } = await supabase.auth.updateUser({ data: metadadosDoAceite(new Date()) });
    setEnviando(false);
    if (error) {
      setErro("Não conseguimos registrar agora. Confira a internet e tente de novo.");
      return;
    }
    lembrarAceite(VERSAO_DOS_TERMOS);
    router.replace("/");
  }

  async function sair() {
    await limparRastrosLocais();
    esquecerMeuPerfilSocial();
    zerarSelos();
    await supabase.auth.signOut().catch(() => {});
    router.replace("/entrar");
  }

  return (
    <Tela bordas={["top", "bottom"]}>
      <Linha estilo={{ justifyContent: "flex-end" }}>
        <PilulaSos />
      </Linha>
      <T tipo="titulo">
        {primeiraVez ? "Antes de começar" : "Atualizamos os Termos e a Privacidade"}
      </T>
      <T tipo="apagado">
        {primeiraVez
          ? "Três confirmações rápidas, uma vez só."
          : "Os documentos foram reescritos para o app de hoje: o que ele é, o que guarda e o que você controla."}
      </T>

      <Cartao fundo={cor.destaque} estilo={{ gap: espaco.sm }}>
        {PONTOS_DO_ACEITE.map((p) => (
          <View key={p} style={{ flexDirection: "row", gap: espaco.sm }}>
            <Text style={{ fontFamily: fonte.forte, fontSize: 16, color: cor.primaria }}>•</Text>
            <T estilo={{ flex: 1, fontSize: 15, lineHeight: 22 }}>{p}</T>
          </View>
        ))}
      </Cartao>

      <Linha estilo={{ flexWrap: "wrap" }}>
        <Botao
          rotulo="Ler os Termos de uso"
          tipo="texto"
          aoTocar={() => router.push(rota("/termos") as never)}
        />
        <Botao
          rotulo="Ler a Política de privacidade"
          tipo="texto"
          aoTocar={() => router.push(rota("/privacidade") as never)}
        />
      </Linha>

      <CaixaDeMarcar
        marcada={maior}
        aoTocar={() => setMaior((v) => !v)}
        rotulo="Tenho 18 anos ou mais."
      />
      <CaixaDeMarcar
        marcada={termos}
        aoTocar={() => setTermos((v) => !v)}
        rotulo="Li e concordo com os Termos de uso, a Política de privacidade e as regras da Comunidade (tolerância zero com conteúdo ofensivo ou abusivo)."
      />
      <CaixaDeMarcar
        marcada={saude}
        aoTocar={() => setSaude((v) => !v)}
        rotulo={TEXTO_DO_CONSENTIMENTO_DE_SAUDE}
        destaque
      />

      {erro ? (
        <T tipo="apagado" cor={cor.urgente}>
          {erro}
        </T>
      ) : null}
      <Botao rotulo="Concordo e continuar" aoTocar={() => void aceitar()} carregando={enviando} />

      <Cartao estilo={{ gap: espaco.xs }}>
        <T tipo="rotulo">Prefere não concordar?</T>
        <T tipo="apagado" estilo={{ fontSize: 14 }}>
          Sem o aceite, o app não abre. Você pode sair da conta e voltar quando quiser, ou excluí-la
          — isso apaga os seus dados.
        </T>
        <Botao rotulo="Sair da conta" tipo="secundario" aoTocar={() => void sair()} />
        <Botao
          rotulo="Excluir a minha conta"
          tipo="texto"
          aoTocar={() => router.push(rota("/perfil") as never)}
        />
      </Cartao>
    </Tela>
  );
}
