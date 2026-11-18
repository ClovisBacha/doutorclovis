import { router } from "expo-router";
import BellOff from "lucide-react-native/icons/bell-off";
import BellRing from "lucide-react-native/icons/bell-ring";
import CalendarDays from "lucide-react-native/icons/calendar-days";
import Clock from "lucide-react-native/icons/clock";
import Settings from "lucide-react-native/icons/settings";
import Sprout from "lucide-react-native/icons/sprout";
import Wind from "lucide-react-native/icons/wind";
import { useState } from "react";
import { Linking, Platform, Switch } from "react-native";
import { LinhaDeAjuste, RodapeDoGrupo, SecaoDeAjustes } from "~/componentes/ajustes";
import { Carregando, selecao } from "~/componentes/base";
import { TelaDaPilha } from "~/componentes/cabecalho";
import { rota } from "~/componentes/jornada/bancada";
import {
  contextoDoLembrete,
  FolhaDoHorario,
  usePreferenciaDosLembretes,
} from "~/componentes/jornada/lembretes";
import { useJornada } from "~/componentes/jornada/usarJornada";
import { ehBancada, parametroDaBancada } from "~/lib/bancada";
import { HORA_PADRAO_DA_JORNADA } from "~/lib/jornada/lembrete-da-jornada";
import { definirLembretesDaJornada } from "~/lib/lembretes-da-jornada";
import { cor } from "~/tema";

/**
 * LEMBRETES — os avisos do app num lugar só: o cuidado de hoje (com a hora),
 * a semana nova, e os que moram nas suas telas (a meditação, as consultas da
 * agenda). Todos são notificações do próprio iPhone: nada sai do aparelho.
 *
 * 18/11/2026 (a vistoria): a lista dos Ajustes, com as chaves de uma cor só (a
 * framboesa) e a explicação no rodapé de cada grupo, no lugar de um cartão por
 * aviso com chaves de duas cores.
 *
 * Bancada: /lembretes?bancada=1 [&lembrete-jornada=20:00] [&permissao=0] [&luto=1]
 */
export default function Lembretes() {
  const { dia, loja } = useJornada();
  const uid = dia.modo === "carregando" || dia.modo === "falhou" ? null : dia.uid;
  const [pref, setPref] = usePreferenciaDosLembretes(uid);
  const [escolhendo, setEscolhendo] = useState(false);
  const [semPermissao, setSemPermissao] = useState(
    () => ehBancada() && parametroDaBancada("permissao") === "0",
  );

  if (!uid || !pref) {
    return (
      <TelaDaPilha titulo="Lembretes" grande voltarPara="/perfil">
        <Carregando />
      </TelaDaPilha>
    );
  }
  const cuidado = "cuidado" in dia && dia.cuidado;
  const pos = dia.modo === "pos";

  async function mudar(m: { hora?: string | null; semanaNova?: boolean }) {
    if (!uid || !pref) return;
    const antes = pref;
    setPref({ ...pref, ...m });
    setSemPermissao(false);
    if (ehBancada()) return;
    const r = await definirLembretesDaJornada(uid, m, contextoDoLembrete(dia, loja.blob));
    if (r === "sem-permissao") {
      setPref(antes);
      setSemPermissao(true);
    }
  }

  const rodapeDoDia = cuidado
    ? "Um aviso curto por dia, só para lembrar de você. Sem placar."
    : "Um aviso por dia, no horário que você escolher. No dia em que você já cuidou, ele não toca.";
  const rodapeDaSemana = pos
    ? "Às 9h do dia em que o bebê completa mais uma semana, com o que muda nela."
    : "Às 9h do primeiro dia de cada semana, com o tamanho do bebê.";

  return (
    <TelaDaPilha titulo="Lembretes" grande voltarPara="/perfil">
      {semPermissao ? (
        <SecaoDeAjustes rodape="Sem a permissão, o iPhone não deixa o app avisar. Os seus horários ficam guardados.">
          <LinhaDeAjuste
            Icone={BellOff}
            tinta={cor.atencao}
            titulo="As notificações estão desligadas"
          />
          {Platform.OS !== "web" ? (
            <LinhaDeAjuste
              Icone={Settings}
              tinta={cor.textoApagado}
              titulo="Abrir os Ajustes do iPhone"
              aoTocar={() => void Linking.openSettings().catch(() => {})}
            />
          ) : null}
        </SecaoDeAjustes>
      ) : null}

      <SecaoDeAjustes rodape={rodapeDoDia}>
        <LinhaDeAjuste
          Icone={BellRing}
          tinta={cor.primaria}
          titulo={cuidado ? "Um minuto para você" : "O cuidado de hoje"}
          direita={
            <Switch
              accessibilityLabel={
                cuidado ? "Lembrete de um minuto para você" : "Lembrete do cuidado de hoje"
              }
              value={!!pref.hora}
              onValueChange={(on) => {
                selecao();
                void mudar({ hora: on ? HORA_PADRAO_DA_JORNADA : null });
              }}
              trackColor={{ true: cor.primaria }}
            />
          }
        />
        {pref.hora ? (
          <LinhaDeAjuste
            Icone={Clock}
            tinta={cor.agenda}
            titulo="Horário"
            valor={pref.hora}
            rotulo={`Horário, ${pref.hora}`}
            dica="Abre a lista de horários"
            aoTocar={() => setEscolhendo(true)}
          />
        ) : null}
      </SecaoDeAjustes>

      {cuidado ? null : (
        <SecaoDeAjustes rodape={rodapeDaSemana}>
          <LinhaDeAjuste
            Icone={Sprout}
            tinta={cor.sementinha}
            titulo={pos ? "Cada semana de vida" : "A semana nova"}
            direita={
              <Switch
                accessibilityLabel={pos ? "Aviso de cada semana de vida" : "Aviso da semana nova"}
                value={pref.semanaNova}
                onValueChange={(on) => {
                  selecao();
                  void mudar({ semanaNova: on });
                }}
                trackColor={{ true: cor.primaria }}
              />
            }
          />
        </SecaoDeAjustes>
      )}

      <SecaoDeAjustes
        titulo="Nas suas telas"
        rodape="A meditação tem o lembrete dela, na própria tela. As consultas avisam na véspera, às 19h, e duas horas antes."
      >
        <LinhaDeAjuste
          Icone={Wind}
          tinta={cor.jogo}
          titulo="Meditação"
          aoTocar={() => router.push(rota("/jornada/meditar") as never)}
        />
        <LinhaDeAjuste
          Icone={CalendarDays}
          tinta={cor.agenda}
          titulo="Consultas da agenda"
          aoTocar={() => router.push(rota("/agenda") as never)}
        />
      </SecaoDeAjustes>

      <RodapeDoGrupo>
        Os avisos são do próprio iPhone, e nada sai do aparelho. Se você passar duas semanas sem
        abrir o app, eles param sozinhos.
      </RodapeDoGrupo>

      <FolhaDoHorario
        aberta={escolhendo}
        hora={pref.hora}
        titulo="Lembrar às"
        aoFechar={() => setEscolhendo(false)}
        aoEscolher={(h) => {
          setEscolhendo(false);
          void mudar({ hora: h });
        }}
      />
    </TelaDaPilha>
  );
}
