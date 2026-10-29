import { router } from "expo-router";
import { useEffect } from "react";
import { Pressable } from "react-native";
import { toque } from "~/componentes/base";
import { Avatar } from "~/componentes/comunidade/imagem";
import { rota } from "~/componentes/jornada/bancada";
import { lerMeuPerfilSocialSePreciso, useMeuPerfilSocial } from "~/lib/comunidade/meu-perfil";
import { useSessao } from "~/lib/sessao";
import { ALVO_MINIMO, cor } from "~/tema";

/**
 * O BOTÃO DO PERFIL — a foto dela no topo das abas (Hoje, Comunidade, Amigas,
 * Bebê), sempre levando ao MESMO lugar: o Perfil.
 *
 * Antes eram duas portas para dois "meu perfil" (o ícone de pessoa do Bebê
 * abria o Perfil; o avatar da Comunidade, o "Meu perfil" social), com o mesmo
 * nome gravado por regras diferentes. Agora é um perfil só (fase 3).
 *
 * Sem foto, a inicial do nome sobre a cor dela — a mesma da Comunidade.
 */
export function BotaoDoPerfil({ tamanho = 40 }: { tamanho?: number }) {
  const { sessao, perfil } = useSessao();
  const uid = sessao?.user.id ?? null;
  const meu = useMeuPerfilSocial(uid);
  useEffect(() => {
    if (uid) void lerMeuPerfilSocialSePreciso(uid);
  }, [uid]);
  const nome = meu?.nome ?? perfil?.display_name ?? perfil?.full_name ?? "Você";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Meu perfil e conta"
      onPress={() => {
        toque();
        router.push(rota("/perfil") as never);
      }}
      hitSlop={4}
      style={({ pressed }) => ({
        width: Math.max(ALVO_MINIMO, tamanho + 4),
        height: Math.max(ALVO_MINIMO, tamanho + 4),
        alignItems: "center",
        justifyContent: "center",
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <Avatar
        id={uid ?? "eu"}
        nome={nome}
        url={meu?.avatarUrl ?? null}
        tamanho={tamanho}
        estilo={{ borderWidth: 2, borderColor: cor.branco }}
      />
    </Pressable>
  );
}
