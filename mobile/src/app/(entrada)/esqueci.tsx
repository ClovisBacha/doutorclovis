import { router } from "expo-router";
import { useState } from "react";
import { Botao, Campo, Cartao, T, Tela } from "~/componentes/base";
import { CabecalhoDaMarca } from "~/componentes/marca";
import { SITE } from "~/config";
import { supabase } from "~/servidor/supabase";
import { cor } from "~/tema";

export default function Esqueci() {
  const [email, setEmail] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar() {
    setErro(null);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setErro("Digite o e-mail da sua conta.");
    setCarregando(true);
    /* O link abre a página do site, que já sabe trocar a senha. Depois ela
       volta ao app e entra com a senha nova. */
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${SITE}/auth`,
    });
    setCarregando(false);
    if (error) return setErro("Não foi possível enviar agora. Tente de novo em instantes.");
    setEnviado(true);
  }

  return (
    <Tela bordas={["top", "bottom"]}>
      <CabecalhoDaMarca subtitulo="Vamos criar uma senha nova." />
      {enviado ? (
        <Cartao>
          <T tipo="subtitulo">Confira seu e-mail</T>
          <T>
            Se houver conta com {email.trim()}, chega um link para definir a senha. Depois, volte
            aqui e entre.
          </T>
        </Cartao>
      ) : (
        <>
          <Campo
            rotulo="E-mail da conta"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />
          {erro ? (
            <T tipo="apagado" cor={cor.urgente}>
              {erro}
            </T>
          ) : null}
          <Botao rotulo="Enviar link" aoTocar={enviar} carregando={carregando} />
        </>
      )}
      <Botao rotulo="Voltar para entrar" tipo="texto" aoTocar={() => router.replace("/entrar")} />
    </Tela>
  );
}
