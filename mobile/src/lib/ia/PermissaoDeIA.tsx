import { Check, ShieldCheck, Sparkles } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { Modal, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Botao, Cartao, T } from "~/componentes/base";
import { ehBancada } from "~/lib/bancada";
import {
  concederPermissaoDeIA,
  lerPermissaoDeIA,
  revogarPermissaoDeIA,
} from "~/lib/ia/permissao";
import { FOLHA_DA_PERMISSAO } from "~/lib/ia/regua-da-permissao";
import { useSessao } from "~/lib/sessao";
import { cor, espaco, raio } from "~/tema";

/**
 * A PERMISSÃO DE IA NA TELA — a folha, o gancho e o cartão de revogar.
 *
 * Qualquer tela que mande algo a uma IA usa `usePermissaoDeIA` e desenha
 * `FolhaDaPermissaoDeIA`; o Perfil pode usar `CartaoDaPermissaoDeIA` para ela
 * ver e retirar o "sim".
 */

export type EstadoDaPermissao = "carregando" | "pendente" | "permitida" | "negada";

/**
 * @param inicialDaBancada  na bancada, o estado entra pronto e NADA é gravado
 *                          (a bancada é para olhar, não para mudar o aparelho).
 */
export function usePermissaoDeIA(uid: string | null, inicialDaBancada?: EstadoDaPermissao) {
  const bancada = ehBancada();
  const [estado, setEstado] = useState<EstadoDaPermissao>(
    bancada ? (inicialDaBancada ?? "permitida") : "carregando",
  );
  const [desde, setDesde] = useState<string | null>(null);
  const [falhouGravar, setFalhouGravar] = useState(false);

  useEffect(() => {
    if (bancada) return;
    if (!uid) {
      setEstado("carregando");
      return;
    }
    let vivo = true;
    void lerPermissaoDeIA(uid).then((r) => {
      if (!vivo) return;
      setDesde(r?.em ?? null);
      setEstado(r ? "permitida" : "pendente");
    });
    return () => {
      vivo = false;
    };
  }, [uid, bancada]);

  const permitir = useCallback(async (): Promise<boolean> => {
    setFalhouGravar(false);
    if (bancada) {
      setEstado("permitida");
      return true;
    }
    if (!uid) return false;
    const ok = await concederPermissaoDeIA(uid);
    /* ⚠️ Escrita que falhou não vira "permitida": a próxima abertura
       perguntaria de novo, e a tela diria que já perguntou. */
    if (!ok) {
      setFalhouGravar(true);
      return false;
    }
    setDesde(new Date().toISOString());
    setEstado("permitida");
    return true;
  }, [uid, bancada]);

  const negar = useCallback(() => setEstado("negada"), []);
  const rever = useCallback(() => setEstado("pendente"), []);

  const revogar = useCallback(async () => {
    if (!bancada && uid) await revogarPermissaoDeIA(uid);
    setDesde(null);
    setEstado("negada");
  }, [uid, bancada]);

  return { estado, desde, falhouGravar, permitir, negar, rever, revogar };
}

/** A folha que pede licença. Aparece antes da PRIMEIRA mensagem ou foto. */
export function FolhaDaPermissaoDeIA({
  visivel,
  aoPermitir,
  aoRecusar,
  falhouGravar,
}: {
  visivel: boolean;
  aoPermitir: () => void;
  aoRecusar: () => void;
  falhouGravar?: boolean;
}) {
  const baixo = useSafeAreaInsets().bottom;
  const f = FOLHA_DA_PERMISSAO;
  return (
    <Modal
      visible={visivel}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={aoRecusar}
    >
      <View style={{ flex: 1, backgroundColor: cor.fundo }}>
        <ScrollView
          contentContainerStyle={{ padding: espaco.xl, gap: espaco.lg, paddingBottom: espaco.xl }}
        >
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: raio.pilula,
              backgroundColor: cor.nutricaoFundo,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Sparkles size={28} color={cor.nutricao} />
          </View>
          <T tipo="titulo" estilo={{ fontSize: 24 }}>
            {f.titulo}
          </T>
          <T>{f.intro}</T>

          <Cartao>
            <T tipo="rotulo">{f.vaiTitulo}</T>
            {f.vai.map((linha) => (
              <View key={linha} style={{ flexDirection: "row", gap: espaco.sm }}>
                <T estilo={{ color: cor.nutricao }}>•</T>
                <T estilo={{ flex: 1 }}>{linha}</T>
              </View>
            ))}
          </Cartao>

          <View style={{ gap: espaco.md }}>
            {f.garantias.map((linha) => (
              <View key={linha} style={{ flexDirection: "row", gap: espaco.sm }}>
                <Check size={20} color={cor.ok} style={{ marginTop: 2 }} />
                <T estilo={{ flex: 1 }}>{linha}</T>
              </View>
            ))}
          </View>
          <T tipo="apagado">{f.rodape}</T>
          {falhouGravar ? (
            <T tipo="apagado" cor={cor.atencao}>
              Não consegui guardar a sua resposta no aparelho. Tente tocar em Permitir de novo.
            </T>
          ) : null}
        </ScrollView>
        <View
          style={{
            paddingHorizontal: espaco.xl,
            paddingTop: espaco.md,
            paddingBottom: Math.max(baixo, espaco.lg),
            gap: espaco.sm,
            borderTopWidth: 1,
            borderTopColor: cor.borda,
            backgroundColor: cor.fundo,
          }}
        >
          <Botao rotulo={f.permitir} corFundo={cor.nutricao} aoTocar={aoPermitir} />
          <Botao rotulo={f.agoraNao} tipo="texto" aoTocar={aoRecusar} />
        </View>
      </View>
    </Modal>
  );
}

function dataCurta(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return null;
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

/**
 * O cartão de ver e retirar a permissão — para o Perfil (e para o alto da
 * Nutrição). Lê o estado sozinho a partir da sessão; `aoMudar` avisa quem
 * precisar redesenhar.
 */
export function CartaoDaPermissaoDeIA({
  permissao,
  aoMudar,
}: {
  /** Quando a tela já tem o gancho, passa-o; senão o cartão cria o seu. */
  permissao?: ReturnType<typeof usePermissaoDeIA>;
  aoMudar?: (estado: EstadoDaPermissao) => void;
}) {
  const { sessao } = useSessao();
  const proprio = usePermissaoDeIA(permissao ? null : (sessao?.user.id ?? null));
  const p = permissao ?? proprio;
  const [retirando, setRetirando] = useState(false);
  const permitida = p.estado === "permitida";
  const desde = dataCurta(p.desde);
  return (
    <Cartao>
      <View style={{ flexDirection: "row", alignItems: "center", gap: espaco.sm }}>
        <ShieldCheck size={22} color={permitida ? cor.nutricao : cor.textoApagado} />
        <T tipo="rotulo" estilo={{ flex: 1 }}>
          Nutricionista com IA
        </T>
      </View>
      <T tipo="apagado">
        {permitida
          ? `Permitida${desde ? ` desde ${desde}` : ""}. O que você escreve, a foto que você manda e algumas informações do seu perfil vão para o Gemini, a IA do Google, só para gerar a resposta.`
          : "Não permitida. Nada é enviado para a IA. Para usar, abra a Nutrição e toque em Permitir."}
      </T>
      {permitida ? (
        <Botao
          rotulo="Retirar a permissão"
          tipo="secundario"
          carregando={retirando}
          aoTocar={async () => {
            setRetirando(true);
            await p.revogar();
            setRetirando(false);
            aoMudar?.("negada");
          }}
        />
      ) : null}
    </Cartao>
  );
}
