import { Image } from "expo-image";
import { router } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import { useState, type ReactNode } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { corDoAvatar, inicialDoNome, tempoNoApp, ultimaVez } from "@/lib/amigas";
import { toque } from "~/componentes/base";
import { ChamaDaSequencia } from "~/componentes/caminho/pecas";
import {
  BONUS_DA_DUPLA,
  corDaUltimaVez,
  emPausa,
  fraseDoErroDaDupla,
  linhaDaDupla,
  memoriaDaDupla,
} from "~/lib/jornada/amigas";
import type { DuplaNaTela, PerfilDeAmiga } from "~/servidor/amigas";
import {
  chamarParaDupla,
  desfazerADupla,
  responderConviteDaDupla,
} from "~/componentes/amigas/economia";
import { ALVO_MINIMO, cor, espaco, fonte } from "~/tema";

/**
 * As peças da aba das Amigas, no desenho do site (`src/components/amigas.tsx`):
 * o avatar (a foto, ou a inicial na cor do id), a linha da amiga, o cartão da
 * dupla com os quatro estados e a folha de sair.
 *
 * NÃO é placar: a lista mostra o que cada uma CONSTRUIU (troféus, a chama
 * dela), nunca lado a lado com a minha, e nada clínico.
 */

export const tinta = {
  titulo: "#2f2140",
  sub: "#6d5b85",
  apagado: "#b8a6c9",
  rosa: "#c9316f",
  violeta: "#7c3aed",
  ambar: "#a35a09",
  ambarFundo: "#fdf0d4",
} as const;

export function Avatar({
  nome,
  id,
  url,
  tamanho = 44,
}: {
  nome: string;
  id: string;
  url: string | null;
  tamanho?: number;
}) {
  if (url) {
    return (
      <Image
        source={{ uri: url }}
        style={{ width: tamanho, height: tamanho, borderRadius: tamanho / 2 }}
        contentFit="cover"
        accessibilityIgnoresInvertColors
      />
    );
  }
  return (
    <View
      style={{
        width: tamanho,
        height: tamanho,
        borderRadius: tamanho / 2,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: corDoAvatar(id),
      }}
    >
      <Text style={{ fontFamily: fonte.titulo, fontSize: tamanho * 0.42, color: cor.branco }}>
        {inicialDoNome(nome)}
      </Text>
    </View>
  );
}

export function CabecalhoDaSecao({ titulo, direita }: { titulo: string; direita?: ReactNode }) {
  return (
    <View
      style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 4, marginBottom: 8 }}
    >
      <Text
        accessibilityRole="header"
        style={{ flex: 1, fontFamily: fonte.titulo, fontSize: 18, color: tinta.titulo }}
      >
        {titulo}
      </Text>
      {direita}
    </View>
  );
}

function PilulaDeTrofeus({ quantos }: { quantos: number }) {
  return (
    <View
      accessible
      accessibilityLabel={`${quantos} ${quantos === 1 ? "troféu" : "troféus"}`}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        borderRadius: 999,
        backgroundColor: "#fdf3d9",
        paddingHorizontal: 10,
        paddingVertical: 4,
      }}
    >
      <Text style={{ fontSize: 13 }}>🏆</Text>
      <Text style={{ fontFamily: fonte.titulo, fontSize: 13, color: tinta.ambar }}>{quantos}</Text>
    </View>
  );
}

/** Uma amiga na lista: o rosto, o nome, "vista há 2h" (nunca "online") e os troféus. */
export function LinhaDaAmiga({ a, aoAbrir }: { a: PerfilDeAmiga; aoAbrir: () => void }) {
  const vista = ultimaVez(a.vistaEm);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${a.nome}. ${vista ? `Vista ${vista}` : tempoNoApp(a.diasNoApp)}. ${a.trofeus} troféus. Abrir`}
      onPress={() => {
        toque();
        aoAbrir();
      }}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        borderRadius: 20,
        backgroundColor: "rgba(255,255,255,0.9)",
        padding: 10,
        opacity: pressed ? 0.85 : 1,
        shadowColor: "#50286e",
        shadowOpacity: 0.06,
        shadowRadius: 5,
        shadowOffset: { width: 0, height: 1 },
      })}
    >
      <Avatar nome={a.nome} id={a.id} url={a.avatarUrl} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          numberOfLines={1}
          style={{ fontFamily: fonte.titulo, fontSize: 15, color: tinta.titulo }}
        >
          {a.nome}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 1 }}>
          {vista ? (
            <View
              style={{
                width: 7,
                height: 7,
                borderRadius: 4,
                backgroundColor: corDaUltimaVez(vista),
              }}
            />
          ) : null}
          <Text style={{ fontFamily: fonte.media, fontSize: 13, color: tinta.sub }}>
            {vista ? `vista ${vista}` : tempoNoApp(a.diasNoApp)}
          </Text>
        </View>
      </View>
      <PilulaDeTrofeus quantos={a.trofeus} />
      <ChevronRight size={18} color={tinta.apagado} />
    </Pressable>
  );
}

function BotaoPilula({
  rotulo,
  aoTocar,
  cheio,
  cor: c = tinta.rosa,
  desabilitado,
}: {
  rotulo: string;
  aoTocar: () => void;
  cheio?: boolean;
  cor?: string;
  desabilitado?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      accessibilityState={{ disabled: !!desabilitado }}
      disabled={desabilitado}
      onPress={() => {
        toque();
        aoTocar();
      }}
      style={({ pressed }) => ({
        flex: 1,
        minHeight: ALVO_MINIMO,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 999,
        paddingHorizontal: espaco.md,
        backgroundColor: cheio ? c : "rgba(255,255,255,0.9)",
        borderWidth: cheio ? 0 : 1,
        borderColor: "#ead9f2",
        opacity: desabilitado ? 0.5 : pressed ? 0.85 : 1,
      })}
    >
      <Text
        style={{ fontFamily: fonte.titulo, fontSize: 14, color: cheio ? cor.branco : tinta.sub }}
      >
        {rotulo}
      </Text>
    </Pressable>
  );
}

/**
 * A DUPLA DE SEQUÊNCIA — os quatro estados do site: sem dupla (chamar uma
 * amiga), convite enviado (cancelar), convite recebido (aceitar / agora não) e
 * ativa (a chama juntas, a memória, a pausa e desfazer). Uma dupla ativa por
 * pessoa: o banco garante, e é de propósito — duas viram placar.
 */
export function CartaoDaDupla({
  dupla,
  amigas,
  aoMudar,
  avisar,
}: {
  dupla: DuplaNaTela | null;
  amigas: PerfilDeAmiga[];
  aoMudar: () => void;
  avisar: (t: string) => void;
}) {
  const [ocupado, setOcupado] = useState(false);
  const [desfazendo, setDesfazendo] = useState(false);
  const estado = dupla?.estado ?? "sem";

  async function agir(
    acao: () => Promise<{ ok: true } | { ok: false; error?: string }>,
    sucesso: string | null,
  ) {
    setOcupado(true);
    const r = await acao();
    setOcupado(false);
    if (!r.ok) {
      avisar(fraseDoErroDaDupla(r.error));
      return;
    }
    if (sucesso) avisar(sucesso);
    aoMudar();
  }

  return (
    <View
      style={{
        borderRadius: 22,
        backgroundColor: "rgba(255,255,255,0.92)",
        padding: espaco.lg,
        gap: espaco.md,
        shadowColor: "#50286e",
        shadowOpacity: 0.07,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: espaco.md }}>
        <ChamaDaSequencia acesa={estado === "ativa" && (dupla?.sequencia ?? 0) > 0} tamanho={34} />
        <Text
          style={{
            flex: 1,
            fontFamily: fonte.media,
            fontSize: 14,
            lineHeight: 20,
            color: tinta.sub,
          }}
        >
          Vocês duas seguram a mesma chama: o dia conta quando as duas aparecem, e cada uma ganha{" "}
          <Text style={{ fontFamily: fonte.titulo, color: tinta.titulo }}>
            +{BONUS_DA_DUPLA} 🌱
          </Text>{" "}
          por dia juntas. Ninguém fica atrás de ninguém.
        </Text>
      </View>

      {estado === "ativa" && dupla ? (
        <View style={{ gap: espaco.sm }}>
          <View style={{ flexDirection: "row", alignItems: "center", alignSelf: "flex-start" }}>
            <View
              style={{
                zIndex: 1,
                width: 56,
                height: 56,
                borderRadius: 28,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "#e595bb",
                borderWidth: 2,
                borderColor: cor.branco,
              }}
            >
              <Text style={{ fontFamily: fonte.titulo, fontSize: 14, color: cor.branco }}>
                Você
              </Text>
            </View>
            <View style={{ marginLeft: -8 }}>
              <Avatar
                nome={dupla.nome ?? ""}
                id={dupla.amigaId ?? ""}
                url={amigas.find((a) => a.id === dupla.amigaId)?.avatarUrl ?? null}
                tamanho={56}
              />
            </View>
            {/* O coração mora na emenda das duas, e não solto ao lado. */}
            <View
              style={{
                position: "absolute",
                zIndex: 2,
                left: 38,
                bottom: -4,
                width: 28,
                height: 28,
                borderRadius: 14,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: cor.branco,
              }}
            >
              <Text style={{ fontSize: 15, lineHeight: 18, color: "#db2777" }}>♥</Text>
            </View>
          </View>
          <Text style={{ fontFamily: fonte.titulo, fontSize: 17, color: tinta.titulo }}>
            Você + {dupla.nome}
          </Text>
          {dupla.sequencia > 0 ? (
            <View
              style={{
                alignSelf: "flex-start",
                borderRadius: 999,
                backgroundColor: tinta.ambarFundo,
                paddingHorizontal: 12,
                paddingVertical: 5,
              }}
            >
              <Text style={{ fontFamily: fonte.titulo, fontSize: 14, color: tinta.ambar }}>
                {linhaDaDupla(dupla)}
              </Text>
            </View>
          ) : (
            <Text style={{ fontFamily: fonte.media, fontSize: 14, color: tinta.sub }}>
              {linhaDaDupla(dupla)}
            </Text>
          )}
          {memoriaDaDupla(dupla) ? (
            <Text style={{ fontFamily: fonte.media, fontSize: 13, color: tinta.sub }}>
              {memoriaDaDupla(dupla)}
            </Text>
          ) : null}
          {emPausa(dupla) ? (
            <Text
              style={{ fontFamily: fonte.normal, fontSize: 13, lineHeight: 19, color: tinta.sub }}
            >
              A chama de vocês está parada há uns dias — ela volta a contar no dia em que as duas
              aparecerem, e nada do que vocês já fizeram se perdeu.
            </Text>
          ) : null}
          <View style={{ flexDirection: "row" }}>
            <BotaoPilula
              rotulo="Desfazer a dupla"
              desabilitado={ocupado}
              aoTocar={() => setDesfazendo(true)}
            />
          </View>
          {/* A chama sai dos dias em que as DUAS apareceram, e não da linha da
              dupla: chamar de novo traz a mesma chama de volta. Por isso a folha
              não ameaça perda nenhuma — diz só o que para de fato. */}
          <FolhaDeConfirmar
            titulo={`Desfazer a dupla com ${(dupla.nome ?? "ela").split(/\s+/)[0]}?`}
            texto={`A dupla some da tela das duas e o bônus de +${BONUS_DA_DUPLA} 🌱 por dia juntas para. Ela não é avisada — e, se mudarem de ideia, é só chamar de novo.`}
            sim="Desfazer"
            nao="Manter"
            aberta={desfazendo}
            aoFechar={() => setDesfazendo(false)}
            aoConfirmar={() => {
              setDesfazendo(false);
              void agir(desfazerADupla, "A dupla foi desfeita.");
            }}
          />
        </View>
      ) : null}

      {estado === "convite-recebido" && dupla ? (
        <View style={{ gap: espaco.sm }}>
          <Text style={{ fontFamily: fonte.media, fontSize: 15, color: tinta.titulo }}>
            <Text style={{ fontFamily: fonte.titulo }}>{dupla.nome}</Text> te chamou para uma dupla.
          </Text>
          <View style={{ flexDirection: "row", gap: espaco.sm }}>
            <BotaoPilula
              rotulo="Aceitar 🔥"
              cheio
              cor="#b45309"
              desabilitado={ocupado}
              aoTocar={() =>
                void agir(
                  () => responderConviteDaDupla(dupla.amigaId!, true),
                  "Dupla formada! A chama começa hoje 🔥",
                )
              }
            />
            <BotaoPilula
              rotulo="Agora não"
              desabilitado={ocupado}
              aoTocar={() => void agir(() => responderConviteDaDupla(dupla.amigaId!, false), null)}
            />
          </View>
        </View>
      ) : null}

      {estado === "convite-enviado" && dupla ? (
        <View style={{ gap: espaco.sm }}>
          <Text style={{ fontFamily: fonte.media, fontSize: 15, color: tinta.titulo }}>
            Convite enviado para <Text style={{ fontFamily: fonte.titulo }}>{dupla.nome}</Text>.
            Esperando ela aceitar.
          </Text>
          <View style={{ flexDirection: "row" }}>
            <BotaoPilula
              rotulo="Cancelar o convite"
              desabilitado={ocupado}
              aoTocar={() => void agir(desfazerADupla, null)}
            />
          </View>
        </View>
      ) : null}

      {estado === "sem" ? (
        amigas.length === 0 ? (
          <Text style={{ fontFamily: fonte.media, fontSize: 14, color: tinta.sub }}>
            Quando uma amiga entrar pelo seu convite, ela aparece aqui para formar dupla.
          </Text>
        ) : (
          <View style={{ gap: espaco.sm }}>
            <Text style={{ fontFamily: fonte.titulo, fontSize: 14, color: tinta.titulo }}>
              Chamar para a dupla
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: espaco.sm }}>
              {amigas.slice(0, 8).map((a) => (
                <Pressable
                  key={a.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Chamar ${a.nome} para a dupla`}
                  disabled={ocupado}
                  onPress={() => {
                    toque();
                    void agir(() => chamarParaDupla(a.id), "Convite enviado 🔥");
                  }}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    minHeight: ALVO_MINIMO,
                    borderRadius: 999,
                    paddingLeft: 4,
                    paddingRight: 14,
                    backgroundColor: "#fff7ed",
                    borderWidth: 1,
                    borderColor: "#fde3c4",
                    opacity: ocupado ? 0.5 : pressed ? 0.85 : 1,
                  })}
                >
                  <Avatar nome={a.nome} id={a.id} url={a.avatarUrl} tamanho={34} />
                  <Text style={{ fontFamily: fonte.titulo, fontSize: 14, color: tinta.ambar }}>
                    {a.nome.split(/\s+/)[0]}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )
      ) : null}
    </View>
  );
}

/** Uma folha de confirmação: a pergunta, o que acontece de fato, e duas saídas. */
export function FolhaDeConfirmar({
  titulo,
  texto,
  sim,
  nao,
  aberta,
  aoFechar,
  aoConfirmar,
}: {
  titulo: string;
  texto: string;
  sim: string;
  nao: string;
  aberta: boolean;
  aoFechar: () => void;
  aoConfirmar: () => void;
}) {
  return (
    <Modal visible={aberta} transparent animationType="slide" onRequestClose={aoFechar}>
      <Pressable
        accessibilityLabel="Fechar"
        onPress={aoFechar}
        style={{ flex: 1, backgroundColor: "rgba(20,10,30,0.35)" }}
      />
      <View
        style={{
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          backgroundColor: cor.branco,
          padding: espaco.xl,
          paddingBottom: espaco.xxl,
          gap: espaco.md,
        }}
      >
        <Text
          accessibilityRole="header"
          style={{ fontFamily: fonte.titulo, fontSize: 20, color: tinta.titulo }}
        >
          {titulo}
        </Text>
        <Text style={{ fontFamily: fonte.media, fontSize: 15, lineHeight: 22, color: tinta.sub }}>
          {texto}
        </Text>
        <View style={{ flexDirection: "row", gap: espaco.sm }}>
          <BotaoPilula rotulo={sim} cheio cor="#9f1239" aoTocar={aoConfirmar} />
          <BotaoPilula rotulo={nao} aoTocar={aoFechar} />
        </View>
      </View>
    </Modal>
  );
}

/** A confirmação de sair da amizade — sem drama, e ninguém é avisado. */
export function FolhaDeSair({
  nome,
  aberta,
  aoFechar,
  aoConfirmar,
}: {
  nome: string;
  aberta: boolean;
  aoFechar: () => void;
  aoConfirmar: () => void;
}) {
  return (
    <FolhaDeConfirmar
      titulo={`Sair da amizade com ${nome.split(/\s+/)[0]}?`}
      texto="Ela não aparece mais aqui, e você some da lista dela. Se tinham uma dupla, ela acaba. Ninguém é avisado."
      sim="Sair da amizade"
      nao="Ficar"
      aberta={aberta}
      aoFechar={aoFechar}
      aoConfirmar={aoConfirmar}
    />
  );
}

/** A porta das Amigas onde a faixa da trilha não existe (a tela Hoje do pós-parto). */
export function PortaDasAmigas({ rota: destino }: { rota: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Abrir as Amigas"
      onPress={() => {
        toque();
        router.push(destino as never);
      }}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: espaco.md,
        borderRadius: 20,
        backgroundColor: cor.branco,
        padding: 12,
        opacity: pressed ? 0.85 : 1,
        shadowColor: "#50286e",
        shadowOpacity: 0.06,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
      })}
    >
      <View
        style={{
          width: 48,
          height: 48,
          borderRadius: 24,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#f6e9fb",
        }}
      >
        <Text style={{ fontSize: 24 }}>👭</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonte.titulo, fontSize: 15, color: tinta.titulo }}>Amigas</Text>
        <Text style={{ fontFamily: fonte.media, fontSize: 13, color: tinta.sub }}>
          Quem você convidou, o Cantinho delas e os pedidos
        </Text>
      </View>
      <ChevronRight size={20} color={tinta.apagado} />
    </Pressable>
  );
}
