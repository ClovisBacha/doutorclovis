import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as Linking from "expo-linking";
import * as SMS from "expo-sms";
import { router } from "expo-router";
import { ChevronRight, X } from "lucide-react-native";
import { useEffect, useState, type ReactNode } from "react";
import { Platform, Pressable, ScrollView, Text, useWindowDimensions, View } from "react-native";
import { toque } from "~/componentes/base";
import { Fone, LogoWhatsApp, Pino, QrDaFicha, Sirene } from "~/componentes/sos";
import { BOMBEIROS, CVV, SAMU } from "~/config";
import { ehBancada } from "~/lib/bancada";
import { gestacaoDoPerfil } from "~/lib/gestacao";
import {
  kitDoPerfil,
  mensagemDeSocorro,
  telefoneInternacional,
  type KitDoSos,
  type MedicoLocal,
} from "~/lib/kit-sos";
import { lerKitDoSos } from "~/lib/kit-sos-armazem";
import { tocarAlarmeDoSos } from "~/lib/alarme-do-sos";
import { abrir, ligar } from "~/lib/links";
import { localizacaoNegada, localizacaoParaSocorro, type Ponto } from "~/lib/localizacao";
import { lerMedicoLocal } from "~/lib/medico-local";
import { ferramentasDaGestacao } from "~/lib/ferramentas";
import { sinaisDeSocorro } from "~/lib/saude/triagem-local";
import { situacaoParaSocorro, useSessao } from "~/lib/sessao";
import { dispararEmergencia, type CanaisAviso } from "~/servidor/emergencia";
import { ALVO_MINIMO, cor, espaco, fonte, raio, sombra } from "~/tema";

// O coração da família Saúde, o mesmo do CVV no site.
const CORACAO = require("../../../src/assets/saude/saude.webp");

type Aviso =
  | { fase: "parado" }
  | { fase: "enviando" }
  | { fase: "feito"; canais: CanaisAviso; mensagem: string; zapAbriu: boolean }
  /* O servidor não respondeu (sem internet, sem conta, prazo estourado). O
     círculo volta a poder ser tocado e o SMS — que vai pela rede do celular —
     aparece como o caminho que sobra. */
  | { fase: "semRede" };

type EstadoDoLugar = "buscando" | "pronto" | "negado" | "semSinal";

/**
 * O SOS — o DESENHO APROVADO do site (src/components/emergency-sheet.tsx),
 * reescrito em peças nativas.
 *
 * A hierarquia é a do site, e é a decisão mais importante da tela: o círculo
 * vermelho vem primeiro porque é o único caminho que avisa médico e contato
 * de uma vez, com a localização, sem ela escrever nada. O 192 e o WhatsApp do
 * médico vêm depois, em "Outras opções", porque exigem que ela saiba o que
 * dizer a alguém.
 *
 * Do app ficam o que o site não tinha: funciona SEM INTERNET (a ficha mora no
 * aparelho; sem servidor, o aviso cai para SMS, que vai pela rede do
 * celular), e a resposta no dedo pelo motor de vibração.
 *
 * Nunca passa pelo Modo Cuidado — socorro não se esconde. No luto a ficha
 * não diz "gestante" nem a semana (situacaoParaSocorro).
 */
export default function Sos() {
  const { sessao, perfil } = useSessao();
  const { width } = useWindowDimensions();
  const [kitGuardado, setKitGuardado] = useState<KitDoSos | null>(null);
  const [medicoLocal, setMedicoLocal] = useState<MedicoLocal | null>(null);
  const [aviso, setAviso] = useState<Aviso>({ fase: "parado" });
  const [fichaAberta, setFichaAberta] = useState(false);
  /* A localização é buscada AO ABRIR, e não no toque: quando ela apertar, a
     coordenada já está na mão — e a tela diz ANTES da emergência se ela vai
     junto, que é a hora de descobrir isso. */
  const [ponto, setPonto] = useState<Ponto | null>(null);
  const [lugar, setLugar] = useState<EstadoDoLugar>("buscando");

  useEffect(() => {
    void lerKitDoSos().then(setKitGuardado);
    void lerMedicoLocal().then(setMedicoLocal);
    if (ehBancada()) {
      setPonto({ latitude: -19.92, longitude: -43.94 });
      setLugar("pronto");
      return;
    }
    let vivo = true;
    void localizacaoParaSocorro(10000).then(async (p) => {
      if (!vivo) return;
      if (p) {
        setPonto(p);
        setLugar("pronto");
        return;
      }
      const negado = await localizacaoNegada();
      if (vivo) setLugar(negado ? "negado" : "semSinal");
    });
    return () => {
      vivo = false;
    };
  }, []);

  // O perfil vivo vence o guardado; sem rede, o guardado é o que existe.
  const kit = perfil
    ? kitDoPerfil(perfil, situacaoParaSocorro(perfil), new Date(), medicoLocal)
    : kitGuardado;
  const g = perfil && !perfil.care_mode ? gestacaoDoPerfil(perfil) : null;
  /* O cronômetro de contrações mora aqui (21/10/2026): é ferramenta de
     socorro, e não conteúdo. Da 20ª semana em diante, fica no Modo Cuidado e
     sai depois do parto — a régua de `ferramentasDaGestacao`. */
  const ferramentas = ferramentasDaGestacao({
    semanas: perfil && !perfil.care_mode ? (gestacaoDoPerfil(perfil)?.weeks ?? null) : null,
    cuidado: perfil?.care_mode === true,
    nasceu: !!perfil?.birth_date,
  });
  const telContato = telefoneInternacional(kit?.contatoTelefone ?? null);
  const telMedico = telefoneInternacional(kit?.medicoCelular ?? null);
  const nomeMedico = (kit?.medicoNome ?? "").trim();
  const medicoCurto = nomeMedico ? nomeMedico.split(/\s+/).slice(0, 2).join(" ") : "";
  const contatoCurto = (kit?.contatoNome ?? "").trim().split(/\s+/)[0] ?? "";
  const quem = [medicoCurto || (telMedico ? "o seu médico" : null), contatoCurto || null]
    .filter(Boolean)
    .join(" e ");
  const mensagemLocal = mensagemDeSocorro(kit, ponto?.latitude ?? null, ponto?.longitude ?? null);

  const lado = Math.min(width * 0.66, 264);
  const destinos = aviso.fase === "feito" ? aviso.canais.destinos : [];
  const ninguem = aviso.fase === "feito" && destinos.length === 0;

  async function pedirSocorro() {
    if (aviso.fase === "enviando") return;
    /* O dedo recebe resposta AGORA, antes de qualquer espera: no silencioso
       nenhum som avisaria que o app entendeu. */
    toque(false);
    setAviso({ fase: "enviando" });
    const p = ponto ?? (await localizacaoParaSocorro(5000));
    if (!sessao) {
      setAviso({ fase: "semRede" });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      void tocarAlarmeDoSos("falhou");
      return;
    }
    try {
      /* Teto de 20 s: num wi-fi de hospital que engole a requisição, sem
         prazo o botão ficava em "Localizando e avisando…" para sempre. */
      const r = await Promise.race([
        dispararEmergencia({
          latitude: p?.latitude ?? null,
          longitude: p?.longitude ?? null,
          address: null,
        }),
        new Promise<never>((_, rejeitar) => setTimeout(() => rejeitar(new Error("prazo")), 20000)),
      ]);
      if (!r?.ok) throw new Error("falhou");
      /* Falha PARCIAL vibra como falha: se o médico recebeu e o contato não,
         confirmar "chegou" a quem não está olhando a tela seria mentir. */
      const chegouEmTodos = r.canais.destinos.length > 0 && !r.canais.faltou;
      void Haptics.notificationAsync(
        chegouEmTodos
          ? Haptics.NotificationFeedbackType.Success
          : Haptics.NotificationFeedbackType.Error,
      ).catch(() => {});
      setAviso({ fase: "feito", canais: r.canais, mensagem: r.mensagem, zapAbriu: false });
      /* O MESMO desfecho no ouvido, pela MESMA régua da vibração. E o
         WhatsApp só abre depois do som: aberto antes, ele levaria o app para
         segundo plano e cortaria o alarme. */
      await tocarAlarmeDoSos(chegouEmTodos ? "enviado" : "falhou");
      /* O WhatsApp do contato abre SOZINHO, e só DEPOIS do servidor: e-mail e
         SMS já saíram. A mensagem é a mesma que foi por e-mail, para quem
         receber pelos dois canais não ler duas versões do mesmo socorro. */
      if (telContato && r.mensagem && (await abrirWhatsApp(telContato, r.mensagem)))
        setAviso({ fase: "feito", canais: r.canais, mensagem: r.mensagem, zapAbriu: true });
    } catch {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      void tocarAlarmeDoSos("falhou");
      setAviso({ fase: "semRede" });
    }
  }

  async function mandarSms(numero: string) {
    const disponivel = Platform.OS !== "web" && (await SMS.isAvailableAsync().catch(() => false));
    if (disponivel) {
      await SMS.sendSMSAsync([`+${numero}`], mensagemLocal).catch(() => {});
      return;
    }
    const sep = Platform.OS === "ios" ? "&" : "?";
    abrir(`sms:+${numero}${sep}body=${encodeURIComponent(mensagemLocal)}`);
  }

  function fechar() {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  }

  return (
    <View style={{ flex: 1, backgroundColor: cor.cartao }}>
      <RolagemDoSos>
        {/* A alça da folha, como no site. */}
        <View
          style={{
            alignSelf: "center",
            width: 40,
            height: 4,
            borderRadius: 2,
            backgroundColor: cor.borda,
            marginBottom: espaco.lg,
          }}
        />
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: espaco.md }}>
          <Text
            accessibilityRole="header"
            style={{
              flex: 1,
              fontFamily: fonte.titulo,
              fontSize: 32,
              lineHeight: 34,
              letterSpacing: -0.6,
              color: cor.texto,
            }}
          >
            Emergência
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fechar"
            onPress={fechar}
            style={({ pressed }) => ({
              width: ALVO_MINIMO,
              height: ALVO_MINIMO,
              borderRadius: ALVO_MINIMO / 2,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: cor.cartao,
              borderWidth: 1,
              borderColor: cor.aro,
              ...sombra,
              shadowOpacity: 0.1,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <X size={22} color={cor.texto} />
          </Pressable>
        </View>

        {/* ── O CÍRCULO ─────────────────────────────────────────────────
            Redondo porque um alvo circular de ~250 pt acerta-se sem mirar.
            Anel branco por dentro e halo vermelho por fora: o par o sustenta
            sobre qualquer fundo, sem depender só da cor. */}
        <View style={{ alignItems: "center", marginTop: espaco.xl }}>
          <View
            style={{
              width: lado + 24,
              height: lado + 24,
              borderRadius: (lado + 24) / 2,
              backgroundColor: cor.sosHalo,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <View
              style={{
                width: lado + 16,
                height: lado + 16,
                borderRadius: (lado + 16) / 2,
                backgroundColor: cor.branco,
                alignItems: "center",
                justifyContent: "center",
                shadowColor: cor.sosBase,
                shadowOpacity: 0.45,
                shadowRadius: 22,
                shadowOffset: { width: 0, height: 14 },
                elevation: 8,
              }}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Pedir socorro agora"
                accessibilityHint={`Avisa ${quem || "quem você cadastrou"} com a sua localização`}
                accessibilityState={{ busy: aviso.fase === "enviando" }}
                onPress={() => void pedirSocorro()}
                style={({ pressed }) => ({
                  width: lado,
                  height: lado,
                  borderRadius: lado / 2,
                  overflow: "hidden",
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                })}
              >
                <LinearGradient
                  colors={
                    ninguem ? [cor.sosAmbarTopo, cor.sosAmbarBase] : [cor.sosTopo, cor.sosBase]
                  }
                  style={{
                    flex: 1,
                    alignItems: "center",
                    justifyContent: "center",
                    paddingHorizontal: espaco.xl,
                  }}
                >
                  {aviso.fase === "parado" || aviso.fase === "semRede" ? (
                    <>
                      <Sirene cor={cor.branco} />
                      <Text
                        style={{
                          fontFamily: fonte.titulo,
                          fontSize: lado * 0.28,
                          lineHeight: lado * 0.3,
                          letterSpacing: -1,
                          color: cor.branco,
                          marginTop: 4,
                        }}
                      >
                        SOS
                      </Text>
                      <Text
                        style={{
                          fontFamily: fonte.media,
                          fontSize: Math.max(17, lado * 0.078),
                          color: cor.branco,
                          textAlign: "center",
                        }}
                      >
                        Pedir socorro agora
                      </Text>
                    </>
                  ) : (
                    <Text
                      style={{
                        fontFamily: fonte.forte,
                        fontSize: Math.max(18, lado * 0.082),
                        lineHeight: Math.max(24, lado * 0.11),
                        color: cor.branco,
                        textAlign: "center",
                      }}
                    >
                      {aviso.fase === "enviando"
                        ? "Localizando e avisando…"
                        : ninguem
                          ? "Ninguém foi avisado — ligue 192"
                          : "✓ Aviso enviado"}
                    </Text>
                  )}
                </LinearGradient>
              </Pressable>
            </View>
          </View>
        </View>

        {aviso.fase === "parado" || aviso.fase === "enviando" ? (
          <>
            {/* O QUE O BOTÃO FAZ, antes de ela apertar. A frase que importa é
                a segunda: ela responde ao medo de quem não sabe o que dizer. */}
            <View
              style={{
                marginTop: espaco.xl,
                flexDirection: "row",
                alignItems: "center",
                gap: espaco.md,
                padding: espaco.md,
                borderRadius: raio.md,
                borderWidth: 1,
                borderColor: cor.aro,
                backgroundColor: cor.cartao,
              }}
            >
              <View
                style={{
                  width: ALVO_MINIMO,
                  height: ALVO_MINIMO,
                  borderRadius: ALVO_MINIMO / 2,
                  backgroundColor: cor.sosRosaFundo,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Pino cor={cor.sosRosa} />
              </View>
              <Text
                style={{
                  flex: 1,
                  fontFamily: fonte.normal,
                  fontSize: 13.5,
                  lineHeight: 19,
                  color: cor.texto,
                }}
              >
                Avisa {quem || "quem você cadastrou"}
                {ponto ? " com a sua localização" : ""},{" "}
                <Text style={{ fontFamily: fonte.forte, color: cor.sosRosa }}>
                  sem você precisar escrever nada.
                </Text>
              </Text>
            </View>

            <View style={{ alignItems: "center", marginTop: espaco.sm }}>
              <PilulaDoLugar estado={lugar} />
            </View>
          </>
        ) : null}

        {/* O que REALMENTE saiu: quem foi avisado aparece pelo nome, e quem
            não foi também. Nunca um "enviado" genérico. */}
        {aviso.fase === "feito" ? (
          <View
            style={{
              marginTop: espaco.lg,
              padding: espaco.md,
              borderRadius: raio.md,
              backgroundColor: ninguem ? cor.atencaoClaro : cor.okClaro,
              gap: 4,
            }}
          >
            {destinos.length ? (
              <>
                <Text style={{ fontFamily: fonte.forte, fontSize: 14, color: cor.ok }}>
                  SOS enviado para:
                </Text>
                {destinos.map((d) => (
                  <Text
                    key={d.nome + d.via}
                    style={{ fontFamily: fonte.normal, fontSize: 14, color: cor.texto }}
                  >
                    <Text style={{ fontFamily: fonte.forte }}>{d.nome}</Text> — {d.via}
                  </Text>
                ))}
                {aviso.canais.faltou ? (
                  <Text style={{ fontFamily: fonte.forte, fontSize: 14, color: cor.atencaoTexto }}>
                    Não chegou em {aviso.canais.faltou}. Mande pelo WhatsApp abaixo ou ligue.
                  </Text>
                ) : null}
              </>
            ) : (
              <Text style={{ fontFamily: fonte.forte, fontSize: 14, color: cor.atencaoForte }}>
                Ninguém foi avisado automaticamente. Ligue 192.
              </Text>
            )}
          </View>
        ) : null}

        {/* O WhatsApp fica MESMO quando abriu sozinho: ela pode ter fechado
            sem enviar, ou voltado para ligar 192 antes. */}
        {aviso.fase === "feito" && telContato && aviso.mensagem ? (
          <>
            <BotaoCheio
              rotulo={
                aviso.zapAbriu
                  ? "Abrir o WhatsApp de novo"
                  : `Mandar no WhatsApp${contatoCurto ? ` de ${contatoCurto}` : ""}`
              }
              fundo={cor.zapBase}
              aoTocar={() => void abrirWhatsApp(telContato, aviso.mensagem)}
              icone={<LogoWhatsApp cor={cor.branco} tamanho={22} />}
            />
            {aviso.zapAbriu ? (
              <>
                <Text
                  style={{
                    marginTop: 6,
                    textAlign: "center",
                    fontFamily: fonte.normal,
                    fontSize: 13,
                    color: cor.textoApagado,
                  }}
                >
                  A mensagem já está escrita no WhatsApp — é só apertar enviar.
                </Text>
                {/* O WhatsApp não deixa link nenhum ligar a localização em tempo
                    real — só a pessoa, de propósito. O que dá é dizer os toques. */}
                <View
                  style={{
                    marginTop: espaco.md,
                    padding: espaco.md,
                    borderRadius: raio.md,
                    backgroundColor: cor.okClaro,
                    borderWidth: 1,
                    borderColor: cor.okFundo,
                    gap: 4,
                  }}
                >
                  <Text style={{ fontFamily: fonte.forte, fontSize: 13, color: cor.ok }}>
                    Se você estiver a caminho do hospital, compartilhe onde você está
                  </Text>
                  <Text
                    style={{
                      fontFamily: fonte.normal,
                      fontSize: 13,
                      lineHeight: 19,
                      color: cor.texto,
                    }}
                  >
                    Dentro da conversa do WhatsApp: toque em{" "}
                    <Text style={{ fontFamily: fonte.forte }}>+</Text> →{" "}
                    <Text style={{ fontFamily: fonte.forte }}>Localização</Text> →{" "}
                    <Text style={{ fontFamily: fonte.forte }}>Localização em tempo real</Text> →{" "}
                    <Text style={{ fontFamily: fonte.forte }}>8 horas</Text>. Quem estiver te
                    procurando passa a ver você se movendo.
                  </Text>
                </View>
              </>
            ) : null}
          </>
        ) : null}

        {/* SEM REDE: o que o app não conseguiu fazer por ela, dito na hora, e
            o caminho que sobra — o SMS vai pela rede do celular. */}
        {aviso.fase === "semRede" ? (
          <View
            style={{
              marginTop: espaco.lg,
              padding: espaco.md,
              borderRadius: raio.md,
              backgroundColor: cor.atencaoClaro,
              gap: espaco.sm,
            }}
          >
            <Text
              style={{
                fontFamily: fonte.forte,
                fontSize: 14,
                lineHeight: 20,
                color: cor.atencaoForte,
              }}
            >
              {sessao
                ? "Não consegui avisar pela internet. Mande por SMS — ele vai pela rede do celular — ou ligue 192."
                : "Sem a sua conta conectada, o app não avisa sozinho. Mande por SMS ou ligue 192."}
            </Text>
            {telContato ? (
              <BotaoCheio
                rotulo={`SMS para ${contatoCurto || "o seu contato"}`}
                fundo={cor.sosRosa}
                aoTocar={() => void mandarSms(telContato)}
              />
            ) : null}
            {telMedico ? (
              <BotaoCheio
                rotulo={`SMS para ${medicoCurto || "o seu médico"}`}
                fundo={cor.sosRosa}
                aoTocar={() => void mandarSms(telMedico)}
              />
            ) : null}
          </View>
        ) : null}

        {/* ── OUTRAS OPÇÕES ─────────────────────────────────────────────── */}
        <View
          style={{
            marginTop: espaco.xl,
            flexDirection: "row",
            alignItems: "center",
            gap: espaco.md,
          }}
        >
          <View style={{ flex: 1, height: 1, backgroundColor: cor.borda }} />
          <Text style={{ fontFamily: fonte.forte, fontSize: 14, color: cor.texto }}>
            Outras opções
          </Text>
          <View style={{ flex: 1, height: 1, backgroundColor: cor.borda }} />
        </View>

        <View style={{ marginTop: espaco.md, flexDirection: "row", gap: espaco.md }}>
          <CartaoDeLigar
            emoji="🚑"
            linha1={`Ligar ${SAMU}`}
            linha2="(SAMU)"
            aoTocar={() => {
              toque(false);
              ligar(SAMU);
            }}
          />
          {telMedico ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`WhatsApp ${medicoCurto ? `de ${medicoCurto}` : "do médico"}`}
              onPress={() => {
                toque(false);
                void abrirWhatsApp(telMedico, mensagemLocal);
              }}
              style={({ pressed }) => ({
                flex: 1,
                borderRadius: raio.lg,
                overflow: "hidden",
                transform: [{ scale: pressed ? 0.97 : 1 }],
              })}
            >
              <LinearGradient
                colors={[cor.zapTopo, cor.zapBase]}
                style={{
                  flex: 1,
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: espaco.md,
                  paddingVertical: espaco.lg,
                  paddingHorizontal: espaco.md,
                }}
              >
                <LogoWhatsApp cor={cor.branco} />
                <Text
                  style={{
                    fontFamily: fonte.titulo,
                    fontSize: 17,
                    lineHeight: 21,
                    color: cor.branco,
                    textAlign: "center",
                  }}
                >
                  WhatsApp do médico
                </Text>
                <View
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 28,
                    backgroundColor: cor.branco,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Fone cor={cor.zapBase} />
                </View>
              </LinearGradient>
            </Pressable>
          ) : (
            /* Sem o celular do médico, o lugar não fica vazio: o 193 atende
               sempre, em qualquer estado. */
            <CartaoDeLigar
              emoji="🚒"
              linha1={`Ligar ${BOMBEIROS}`}
              linha2="(Bombeiros)"
              aoTocar={() => {
                toque(false);
                ligar(BOMBEIROS);
              }}
            />
          )}
        </View>

        {!telMedico ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => (sessao ? router.push("/perfil") : undefined)}
            style={{
              marginTop: espaco.sm,
              paddingVertical: espaco.sm,
              paddingHorizontal: espaco.md,
              borderRadius: raio.md,
              backgroundColor: cor.atencaoClaro,
            }}
          >
            {/* ⚠️ Diferença deliberada do site: lá o médico vinha do vínculo
                do consultório; no app (v1) é o que ELA cadastra no Perfil —
                então a frase leva até lá. */}
            <Text
              style={{
                textAlign: "center",
                fontFamily: fonte.normal,
                fontSize: 13,
                lineHeight: 18,
                color: cor.atencaoForte,
              }}
            >
              {sessao
                ? "Cadastre o celular do seu médico no Perfil para falar com ele daqui. O 192 e o 193 funcionam agora."
                : "O 192 e o 193 acima funcionam agora."}
            </Text>
          </Pressable>
        ) : null}

        {telMedico ? (
          <BotaoLinha
            aoTocar={() => ligar(`+${telMedico}`)}
            rotulo={`Ligar para ${medicoCurto || "o seu médico"}`}
          />
        ) : null}
        {/* ⚠️ Acréscimo ao desenho do site: ligar direto para o contato de
            emergência. No site ela só falava com ele pelo WhatsApp depois do
            aviso; numa emergência, a ligação para quem vai buscá-la é o
            caminho mais curto. Mesma forma da linha do médico. */}
        {telContato ? (
          <BotaoLinha
            aoTocar={() => ligar(`+${telContato}`)}
            rotulo={`Ligar para ${contatoCurto || "o seu contato"}`}
          />
        ) : null}

        {/* ── CVV ──────────────────────────────────────────────────────────
            Quase ninguém sabe o que é "CVV": a linha explica antes de
            oferecer, e a segunda nomeia o que ela está sentindo. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Ligar ${CVV}, CVV, apoio emocional`}
          onPress={() => ligar(CVV)}
          style={({ pressed }) => ({
            marginTop: espaco.md,
            flexDirection: "row",
            alignItems: "center",
            gap: espaco.md,
            padding: espaco.md,
            borderRadius: raio.md,
            borderWidth: 1,
            borderColor: cor.aro,
            backgroundColor: cor.cartao,
            opacity: pressed ? 0.75 : 1,
          })}
        >
          <Image source={CORACAO} style={{ width: 36, height: 36 }} contentFit="contain" />
          <View style={{ flex: 1 }}>
            <Text
              style={{ fontFamily: fonte.normal, fontSize: 13, lineHeight: 18, color: cor.texto }}
            >
              <Text style={{ fontFamily: fonte.forte }}>CVV:</Text> apoio emocional gratuito, 24h,
              sigiloso.
            </Text>
            <Text
              style={{
                fontFamily: fonte.normal,
                fontSize: 13,
                lineHeight: 18,
                color: cor.textoApagado,
              }}
            >
              Quando a angústia é o que está doendo.
            </Text>
          </View>
          <ChevronRight size={20} color={cor.textoApagado} />
        </Pressable>

        {/* 193 desce para cá quando o cartão do médico ocupa o lugar dele. */}
        {telMedico ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Ligar ${BOMBEIROS}, Bombeiros`}
            onPress={() => ligar(BOMBEIROS)}
            style={({ pressed }) => ({
              marginTop: espaco.sm,
              minHeight: ALVO_MINIMO,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: espaco.sm,
              borderRadius: raio.md,
              borderWidth: 1,
              borderColor: cor.aro,
              backgroundColor: cor.cartao,
              opacity: pressed ? 0.75 : 1,
            })}
          >
            <Text style={{ fontSize: 16 }}>🚒</Text>
            <Text style={{ fontFamily: fonte.forte, fontSize: 14, color: cor.texto }}>
              {BOMBEIROS}
            </Text>
            <Text style={{ fontFamily: fonte.normal, fontSize: 14, color: cor.textoApagado }}>
              Bombeiros
            </Text>
          </Pressable>
        ) : null}

        {/* ── A CARTEIRINHA ────────────────────────────────────────────────
            QR gerado no aparelho, para mostrar no hospital. */}
        <Carteirinha
          kit={kit}
          semana={g ? `${g.weeks}s ${g.days}d` : null}
          dpp={g ? dppDe(g.totalDays) : null}
          bebe={
            perfil && !perfil.care_mode && !perfil.birth_date ? (perfil.baby_name ?? null) : null
          }
          aberta={fichaAberta}
          aoAlternar={() => setFichaAberta((v) => !v)}
          aoCompletar={sessao ? () => router.push("/perfil") : undefined}
        />

        {/* ── SINAIS DE ALERTA ─────────────────────────────────────────── */}
        <View style={{ marginTop: espaco.xl, gap: 6 }}>
          <Text
            style={{ fontFamily: fonte.media, fontSize: 15, color: cor.texto, marginBottom: 2 }}
          >
            Procure atendimento agora se sentir:
          </Text>
          {sinaisDeSocorro({
            cuidado: perfil?.care_mode === true,
            nasceu: !!perfil?.birth_date,
          }).map((s) => (
            <View
              key={s.id}
              style={{
                flexDirection: "row",
                alignItems: "flex-start",
                gap: espaco.sm,
                paddingVertical: espaco.sm,
                paddingHorizontal: espaco.md,
                borderRadius: raio.sm,
                backgroundColor: cor.sosRosaLinha,
              }}
            >
              <View
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: 5,
                  marginTop: 6,
                  backgroundColor: cor.sosRosaPonto,
                }}
              />
              <Text
                style={{
                  flex: 1,
                  fontFamily: fonte.normal,
                  fontSize: 15,
                  lineHeight: 21,
                  color: cor.texto,
                }}
              >
                {s.label}
              </Text>
            </View>
          ))}
          {sessao && ferramentas.contracoes ? (
            <BotaoLinha
              aoTocar={() => router.push("/contracoes")}
              rotulo="⏱️ Cronometrar contrações"
              ligacao={false}
            />
          ) : null}
        </View>

        <Text
          style={{
            marginTop: espaco.lg,
            textAlign: "center",
            fontFamily: fonte.normal,
            fontSize: 12,
            color: cor.textoApagado,
          }}
        >
          Orientação geral — não substitui a avaliação do seu médico.
        </Text>
      </RolagemDoSos>
    </View>
  );
}

/* ── peças ─────────────────────────────────────────────────────────────── */

function RolagemDoSos({ children }: { children: ReactNode }) {
  return (
    <ScrollView
      contentContainerStyle={{ padding: espaco.xl, paddingTop: espaco.md, paddingBottom: 48 }}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

/** Abre o WhatsApp do número com a mensagem. Pelo aplicativo; sem ele, pela web. */
async function abrirWhatsApp(numero: string, texto: string): Promise<boolean> {
  const t = encodeURIComponent(texto);
  try {
    const app = `whatsapp://send?phone=${numero}&text=${t}`;
    if (Platform.OS !== "web" && (await Linking.canOpenURL(app))) {
      await Linking.openURL(app);
      return true;
    }
    await Linking.openURL(`https://wa.me/${numero}?text=${t}`);
    return true;
  } catch {
    return false;
  }
}

/** A DPP a partir dos dias de gestação de hoje (280 dias = 40 semanas). */
function dppDe(diasDeGestacao: number): string {
  const d = new Date();
  d.setDate(d.getDate() + (280 - diasDeGestacao));
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function PilulaDoLugar({ estado }: { estado: EstadoDoLugar }) {
  const base = {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: espaco.sm,
    paddingHorizontal: espaco.lg,
    paddingVertical: 6,
    borderRadius: raio.pilula,
  };
  if (estado === "pronto")
    return (
      <View style={[base, { backgroundColor: cor.okClaro }]}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: cor.okPonto }} />
        <Text style={{ fontFamily: fonte.forte, fontSize: 14, color: cor.ok }}>
          Localização pronta
        </Text>
      </View>
    );
  if (estado === "negado")
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityHint="Abre os Ajustes para liberar a localização"
        onPress={() => void Linking.openSettings().catch(() => {})}
        style={[base, { backgroundColor: cor.atencaoClaro, minHeight: ALVO_MINIMO }]}
      >
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: cor.atencao }} />
        <Text
          style={{
            fontFamily: fonte.forte,
            fontSize: 14,
            color: cor.atencaoTexto,
            textDecorationLine: "underline",
          }}
        >
          Sem localização — liberar nos Ajustes
        </Text>
      </Pressable>
    );
  if (estado === "semSinal")
    return (
      <View style={[base, { backgroundColor: cor.atencaoClaro }]}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: cor.atencao }} />
        <Text style={{ fontFamily: fonte.forte, fontSize: 14, color: cor.atencaoTexto }}>
          Sem sinal de localização — o aviso vai sem ela
        </Text>
      </View>
    );
  return (
    <View style={[base, { backgroundColor: cor.apagado }]}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: cor.textoApagado }} />
      <Text style={{ fontFamily: fonte.media, fontSize: 14, color: cor.textoApagado }}>
        Buscando sua localização…
      </Text>
    </View>
  );
}

function CartaoDeLigar({
  emoji,
  linha1,
  linha2,
  aoTocar,
}: {
  emoji: string;
  linha1: string;
  linha2: string;
  aoTocar: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${linha1} ${linha2}`}
      onPress={aoTocar}
      style={({ pressed }) => ({
        flex: 1,
        alignItems: "center",
        justifyContent: "space-between",
        gap: espaco.md,
        paddingVertical: espaco.lg,
        paddingHorizontal: espaco.md,
        borderRadius: raio.lg,
        borderWidth: 1,
        borderColor: cor.aro,
        backgroundColor: cor.cartao,
        transform: [{ scale: pressed ? 0.97 : 1 }],
      })}
    >
      <Text style={{ fontSize: 42, lineHeight: 46 }}>{emoji}</Text>
      <View style={{ alignItems: "center" }}>
        <Text style={{ fontFamily: fonte.titulo, fontSize: 17, lineHeight: 21, color: cor.texto }}>
          {linha1}
        </Text>
        <Text
          style={{ fontFamily: fonte.titulo, fontSize: 17, lineHeight: 21, color: cor.sosRosa }}
        >
          {linha2}
        </Text>
      </View>
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          borderWidth: 1,
          borderColor: cor.sosRosaAro,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Fone cor={cor.sosRosa} />
      </View>
    </Pressable>
  );
}

function BotaoLinha({
  rotulo,
  aoTocar,
  ligacao = true,
}: {
  rotulo: string;
  aoTocar: () => void;
  /** O fone só onde o toque É uma ligação. */
  ligacao?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        toque();
        aoTocar();
      }}
      style={({ pressed }) => ({
        marginTop: espaco.sm,
        minHeight: ALVO_MINIMO,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: espaco.sm,
        paddingHorizontal: espaco.lg,
        borderRadius: raio.pilula,
        borderWidth: 1,
        borderColor: cor.aro,
        backgroundColor: cor.cartao,
        opacity: pressed ? 0.75 : 1,
      })}
    >
      {ligacao ? <Fone cor={cor.texto} tamanho={18} /> : null}
      <Text style={{ fontFamily: fonte.media, fontSize: 14, color: cor.texto }}>{rotulo}</Text>
    </Pressable>
  );
}

function BotaoCheio({
  rotulo,
  fundo,
  aoTocar,
  icone,
}: {
  rotulo: string;
  fundo: string;
  aoTocar: () => void;
  icone?: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        toque();
        aoTocar();
      }}
      style={({ pressed }) => ({
        marginTop: espaco.sm,
        minHeight: ALVO_MINIMO + 4,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: espaco.sm,
        paddingHorizontal: espaco.lg,
        borderRadius: raio.pilula,
        backgroundColor: fundo,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      {icone}
      <Text style={{ fontFamily: fonte.forte, fontSize: 15, color: cor.branco }}>{rotulo}</Text>
    </Pressable>
  );
}

function Carteirinha({
  kit,
  semana,
  dpp,
  bebe,
  aberta,
  aoAlternar,
  aoCompletar,
}: {
  kit: KitDoSos | null;
  semana: string | null;
  dpp: string | null;
  bebe: string | null;
  aberta: boolean;
  aoAlternar: () => void;
  aoCompletar?: () => void;
}) {
  /* O texto do QR — o que o socorrista lê no celular dele. "Nenhuma" é uma
     afirmação: só aparece quando a ficha existe (kit não nulo). */
  const texto = kit
    ? [
        kit.situacao?.startsWith("Gestante")
          ? "FICHA DE EMERGENCIA - GESTANTE"
          : "FICHA DE EMERGENCIA",
        `Nome: ${kit.nome || "-"}`,
        bebe ? `Bebe: ${bebe}` : "",
        `Situacao: ${kit.situacao || "-"}`,
        dpp ? `DPP: ${dpp}` : "",
        `Tipo sanguineo: ${kit.tipoSanguineo || "-"}`,
        `Alergias: ${kit.alergias || "nenhuma informada"}`,
        `Medicamentos: ${kit.medicacoes || "nenhum"}`,
        `Contato emergencia: ${kit.contatoNome || "-"} ${kit.contatoTelefone || ""}`.trim(),
        kit.medicoNome ? `Medico: ${kit.medicoNome} ${kit.medicoCelular || ""}`.trim() : "",
      ]
        .filter(Boolean)
        .join("\n")
    : null;

  return (
    <View
      style={{
        marginTop: espaco.xl,
        padding: espaco.lg,
        borderRadius: raio.md,
        borderWidth: 1,
        borderColor: cor.borda,
        backgroundColor: cor.sosFicha,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: aberta }}
        onPress={aoAlternar}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: espaco.sm,
          minHeight: ALVO_MINIMO,
        }}
      >
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonte.media, fontSize: 15, color: cor.texto }}>
            Carteirinha de emergência
          </Text>
          <Text
            style={{
              fontFamily: fonte.normal,
              fontSize: 13,
              color: cor.textoApagado,
              marginTop: 2,
            }}
          >
            Mostre o QR no hospital · toque para ver tudo
          </Text>
        </View>
        <View style={{ transform: [{ rotate: aberta ? "90deg" : "0deg" }] }}>
          <ChevronRight size={20} color={cor.textoApagado} />
        </View>
      </Pressable>

      {kit ? (
        <>
          <View
            style={{
              marginTop: espaco.md,
              flexDirection: "row",
              alignItems: "center",
              gap: espaco.lg,
            }}
          >
            <View
              style={{ padding: espaco.sm, borderRadius: raio.sm, backgroundColor: cor.branco }}
            >
              <QrDaFicha texto={texto ?? ""} />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <LinhaDaFicha rotulo="Sangue" valor={kit.tipoSanguineo} />
              <LinhaDaFicha rotulo="Alergias" valor={kit.alergias || "nenhuma informada"} />
              {semana ? (
                <LinhaDaFicha rotulo="Semana" valor={semana} />
              ) : (
                <LinhaDaFicha rotulo="Situação" valor={kit.situacao} />
              )}
              <LinhaDaFicha rotulo="Contato" valor={kit.contatoNome} />
            </View>
          </View>
          {aberta ? (
            <View
              style={{
                marginTop: espaco.md,
                paddingTop: espaco.md,
                borderTopWidth: 1,
                borderTopColor: cor.borda,
                gap: 4,
              }}
            >
              {bebe ? <LinhaDaFicha rotulo="Bebê" valor={bebe} /> : null}
              {dpp ? <LinhaDaFicha rotulo="DPP" valor={dpp} /> : null}
              <LinhaDaFicha rotulo="Medicamentos" valor={kit.medicacoes || "nenhum"} />
              <LinhaDaFicha rotulo="Tel. emergência" valor={kit.contatoTelefone} />
              {kit.medicoNome ? <LinhaDaFicha rotulo="Médico" valor={kit.medicoNome} /> : null}
            </View>
          ) : null}
          {/* Só quando a ficha existe: antes dela chegar, isto acusaria de
              não ter preenchido o que pode estar preenchido há meses. */}
          {!kit.tipoSanguineo || !kit.contatoNome ? (
            <Pressable
              onPress={aoCompletar}
              disabled={!aoCompletar}
              style={{ marginTop: espaco.md }}
            >
              <Text
                style={{
                  fontFamily: fonte.media,
                  fontSize: 13,
                  lineHeight: 18,
                  color: cor.atencao,
                }}
              >
                Complete tipo sanguíneo e contato de emergência no seu Perfil para a ficha ficar
                completa.
              </Text>
            </Pressable>
          ) : null}
        </>
      ) : (
        <Text
          style={{
            marginTop: espaco.md,
            fontFamily: fonte.normal,
            fontSize: 13,
            lineHeight: 18,
            color: cor.textoApagado,
          }}
        >
          Entre na sua conta uma vez com internet para a ficha ficar guardada no celular.
        </Text>
      )}
    </View>
  );
}

function LinhaDaFicha({ rotulo, valor }: { rotulo: string; valor: string | null | undefined }) {
  return (
    <View style={{ flexDirection: "row", gap: 6 }}>
      <Text style={{ fontFamily: fonte.media, fontSize: 13, color: cor.textoApagado }}>
        {rotulo}:
      </Text>
      <Text
        numberOfLines={1}
        style={{ flex: 1, fontFamily: fonte.normal, fontSize: 13, color: cor.texto }}
      >
        {valor || "—"}
      </Text>
    </View>
  );
}
