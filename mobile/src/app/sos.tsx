import { RED_SYMPTOMS } from "@/lib/triage";
import * as SMS from "expo-sms";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { Botao, Cartao, Linha, T, Tela, toque } from "~/componentes/base";
import { BOMBEIROS, CVV, SAMU } from "~/config";
import {
  kitDoPerfil,
  mensagemDeSocorro,
  telefoneInternacional,
  type KitDoSos,
} from "~/lib/kit-sos";
import { lerKitDoSos } from "~/lib/kit-sos-armazem";
import { abrir, ligar } from "~/lib/links";
import { localizacaoParaSocorro, type Ponto } from "~/lib/localizacao";
import { situacaoParaSocorro, useSessao } from "~/lib/sessao";
import { dispararEmergencia, type CanaisAviso } from "~/servidor/emergencia";
import { ALVO_MINIMO, cor, espaco, fonte, raio } from "~/tema";

type Aviso =
  | { fase: "parado" }
  | { fase: "enviando" }
  | { fase: "feito"; ponto: Ponto | null; canais: CanaisAviso | null; servidorFalhou: boolean };

/**
 * O SOS. Funciona SEM INTERNET: o 192 é uma ligação, a ficha mora no
 * aparelho (kit-sos-armazem) e o aviso ao contato cai para SMS/WhatsApp
 * quando o servidor não responde. Nunca passa pelo Modo Cuidado — socorro
 * não se esconde — e não promete médico: o app avisa quem ela cadastrou.
 */
export default function Sos() {
  const { sessao, perfil } = useSessao();
  const [kitGuardado, setKitGuardado] = useState<KitDoSos | null>(null);
  const [aviso, setAviso] = useState<Aviso>({ fase: "parado" });

  useEffect(() => {
    void lerKitDoSos().then(setKitGuardado);
  }, []);

  // O perfil vivo vence o guardado; sem rede, o guardado é o que existe.
  const kit = perfil ? kitDoPerfil(perfil, situacaoParaSocorro(perfil)) : kitGuardado;
  const telefoneContato = telefoneInternacional(kit?.contatoTelefone ?? null);
  const ponto = aviso.fase === "feito" ? aviso.ponto : null;
  const mensagem = mensagemDeSocorro(kit, ponto?.latitude ?? null, ponto?.longitude ?? null);

  async function avisarContato() {
    toque(false);
    setAviso({ fase: "enviando" });
    const p = await localizacaoParaSocorro();
    let canais: CanaisAviso | null = null;
    let servidorFalhou = !sessao;
    if (sessao) {
      try {
        const r = await dispararEmergencia({
          latitude: p?.latitude ?? null,
          longitude: p?.longitude ?? null,
          address: null,
        });
        if (r?.ok) canais = r.canais;
        else servidorFalhou = true;
      } catch {
        servidorFalhou = true;
      }
    }
    setAviso({ fase: "feito", ponto: p, canais, servidorFalhou });
  }

  async function mandarSms() {
    if (!telefoneContato) return;
    const disponivel = Platform.OS !== "web" && (await SMS.isAvailableAsync().catch(() => false));
    if (disponivel) {
      await SMS.sendSMSAsync([`+${telefoneContato}`], mensagem).catch(() => {});
      return;
    }
    const sep = Platform.OS === "ios" ? "&" : "?";
    abrir(`sms:+${telefoneContato}${sep}body=${encodeURIComponent(mensagem)}`);
  }

  const destinos = aviso.fase === "feito" ? (aviso.canais?.destinos ?? []) : [];

  return (
    <Tela bordas={["top", "bottom"]} fundo={cor.urgenteFundo}>
      <Linha estilo={{ justifyContent: "space-between" }}>
        <T tipo="titulo" cor={cor.urgente}>
          SOS
        </T>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Fechar o SOS"
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
          style={{
            minWidth: ALVO_MINIMO,
            minHeight: ALVO_MINIMO,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ fontSize: 26, color: cor.urgente, fontFamily: fonte.forte }}>✕</Text>
        </Pressable>
      </Linha>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Ligar ${SAMU}, SAMU`}
        onPress={() => {
          toque(false);
          ligar(SAMU);
        }}
        style={({ pressed }) => ({
          backgroundColor: cor.urgente,
          borderRadius: raio.lg,
          paddingVertical: espaco.xl,
          alignItems: "center",
          gap: 4,
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <Text style={{ color: cor.branco, fontFamily: fonte.titulo, fontSize: 40 }}>
          Ligar {SAMU}
        </Text>
        <Text style={{ color: cor.branco, fontFamily: fonte.media, fontSize: 16 }}>
          SAMU · ambulância · grátis, sem internet
        </Text>
      </Pressable>

      <Cartao>
        <T tipo="subtitulo">
          {kit?.contatoNome ? `Avisar ${kit.contatoNome}` : "Avisar o seu contato"}
        </T>
        {kit?.contatoTelefone || kit?.contatoNome ? (
          <>
            {aviso.fase === "parado" ? (
              <>
                <T tipo="apagado">Mandamos a sua localização para quem você cadastrou.</T>
                <Botao rotulo="Avisar agora" tipo="perigo" aoTocar={() => void avisarContato()} />
              </>
            ) : null}
            {aviso.fase === "enviando" ? (
              <Botao rotulo="Pegando a localização…" tipo="perigo" carregando aoTocar={() => {}} />
            ) : null}
            {aviso.fase === "feito" ? (
              <>
                {destinos.length > 0 ? (
                  <T tipo="corpo">
                    Avisamos {destinos.map((d) => `${d.nome} (${d.via})`).join(", ")}.
                  </T>
                ) : (
                  <T tipo="corpo">
                    {aviso.servidorFalhou
                      ? "Sem internet agora. Mande o aviso por SMS — ele vai pela rede do celular."
                      : "Não conseguimos avisar pelo app. Mande por SMS ou WhatsApp."}
                  </T>
                )}
                {aviso.canais?.faltou ? (
                  <T tipo="corpo" cor={cor.urgente}>
                    O aviso não chegou em {aviso.canais.faltou} pelo app. Mande por SMS ou WhatsApp.
                  </T>
                ) : null}
                {!aviso.ponto ? (
                  <T tipo="apagado">Sem a localização (permissão negada ou sem sinal de GPS).</T>
                ) : null}
              </>
            ) : null}
            {telefoneContato ? (
              <>
                <Linha>
                  <Botao
                    rotulo="SMS"
                    tipo="secundario"
                    estilo={{ flex: 1 }}
                    aoTocar={() => void mandarSms()}
                  />
                  <Botao
                    rotulo="WhatsApp"
                    tipo="secundario"
                    estilo={{ flex: 1 }}
                    aoTocar={() =>
                      abrir(`https://wa.me/${telefoneContato}?text=${encodeURIComponent(mensagem)}`)
                    }
                  />
                </Linha>
                <Botao
                  rotulo={`Ligar para ${kit?.contatoNome ?? "o contato"}`}
                  tipo="secundario"
                  aoTocar={() => ligar(`+${telefoneContato}`)}
                />
              </>
            ) : null}
          </>
        ) : (
          <>
            <T tipo="apagado">Você ainda não cadastrou um contato de emergência.</T>
            {sessao ? (
              <Botao
                rotulo="Cadastrar no Perfil"
                tipo="secundario"
                aoTocar={() => router.push("/perfil")}
              />
            ) : null}
          </>
        )}
      </Cartao>

      <Cartao>
        <T tipo="subtitulo">Mostre para quem for te atender</T>
        <Ficha rotulo="Nome" valor={kit?.nome} />
        <Ficha rotulo="Situação" valor={kit?.situacao} />
        <Ficha rotulo="Tipo sanguíneo" valor={kit?.tipoSanguineo} />
        <Ficha rotulo="Alergias" valor={kit?.alergias} />
        <Ficha rotulo="Medicações" valor={kit?.medicacoes} />
        {!kit ? (
          <T tipo="apagado">
            Entre na sua conta uma vez com internet para a ficha ficar guardada no celular.
          </T>
        ) : null}
      </Cartao>

      <Cartao>
        <T tipo="subtitulo">Ligue {SAMU} ou vá à maternidade se tiver</T>
        {RED_SYMPTOMS.map((s) => (
          <Linha key={s.id} estilo={{ alignItems: "flex-start" }}>
            <Text style={{ color: cor.urgente, fontFamily: fonte.forte, fontSize: 16 }}>•</Text>
            <T tipo="corpo" estilo={{ flex: 1 }}>
              {s.label}
            </T>
          </Linha>
        ))}
      </Cartao>

      <Linha>
        <Botao
          rotulo={`Bombeiros ${BOMBEIROS}`}
          tipo="secundario"
          estilo={{ flex: 1 }}
          aoTocar={() => ligar(BOMBEIROS)}
        />
        <Botao
          rotulo={`CVV ${CVV}`}
          tipo="secundario"
          estilo={{ flex: 1 }}
          aoTocar={() => ligar(CVV)}
        />
      </Linha>
      <T tipo="apagado" centro estilo={{ fontSize: 13 }}>
        O CVV (188) acolhe quem está em sofrimento emocional, 24 horas. Este app não substitui o
        atendimento de emergência.
      </T>
    </Tela>
  );
}

function Ficha({ rotulo, valor }: { rotulo: string; valor: string | null | undefined }) {
  return (
    <View
      style={{
        flexDirection: "row",
        gap: espaco.sm,
        paddingVertical: 4,
        borderBottomWidth: 1,
        borderBottomColor: cor.borda,
      }}
    >
      <T tipo="apagado" estilo={{ width: 120 }}>
        {rotulo}
      </T>
      <T tipo="rotulo" estilo={{ flex: 1 }}>
        {valor ?? "—"}
      </T>
    </View>
  );
}
