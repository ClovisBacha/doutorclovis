/**
 * OS AVISOS DO APP — ligar, desligar, e dizer a verdade sobre o que chega.
 *
 * ⚠️ **ELE SAIU DE `minha-conta.tsx` PARA PODER SER OLHADO.** Enterrado num
 * arquivo de quinze mil linhas atrás de uma sessão, o bloco só aparecia numa
 * conta de verdade — e foi assim que ele passou a vida inteira do produto sem
 * um botão de DESLIGAR, com `unsubscribeFromPush` escrita e sem chamador. O
 * corpo não mudou no move: o que mudou é que agora existe `/preview-avisos`.
 *
 * ⚠️ **O título era "Dicas semanais", e o canal não é isso.** Esta é a tela do
 * CONSENTIMENTO, e ela descrevia um décimo do que o registro entrega — pelo
 * mesmo caminho chegam a confirmação da consulta, os lembretes de 24h e 4h, o
 * pedido de pré-consulta e os recados do consultório. Quem lia "dicas
 * semanais" concluía que era divulgação e não ligava; quem ligava achava que
 * tinha assinado só a dica.
 *
 * ⚠️ **E o pedido de socorro NÃO entra na lista** — conferido em
 * `emergencia.functions.ts`: o push do SOS vai para o MÉDICO, não para ela.
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
  ativarAvisos,
  avisosDesligadosNesteAparelho,
  desligarAvisos,
  renovarAvisosSeJaAutorizado,
} from "@/lib/avisos";
import { sendTestPushToMe } from "@/lib/push.functions";
import { supabase } from "@/integrations/supabase/client";

/**
 * ⚠️ A bancada injeta o DADO nos mesmos `useState` da produção, nunca o
 * desenho — é a lição do `?streak=41`. Sem ela, o estado "desligado" seria
 * impossível de fotografar: ele exige uma conta real, permissão concedida pelo
 * sistema e um toque no botão novo.
 */
export type BancadaDosAvisos = { permissao?: string; desligados?: boolean };

export function AvisosDoApp({ bancada }: { bancada?: BancadaDosAvisos }) {
  const [notifPermission, setNotifPermission] = useState<string>("default");
  /* ⚠️ LIDO NO EFEITO, nunca no render: `localStorage` não existe no servidor,
     e um valor que difere entre as duas passadas faz o React descartar a
     árvore. É a mesma régua de `podeGravar` e `useReduzDepoisDeMontar`. */
  const [avisosDesligados, setAvisosDesligados] = useState(false);
  const [mexendoNosAvisos, setMexendoNosAvisos] = useState(false);
  useEffect(() => {
    if (bancada) {
      setNotifPermission(bancada.permissao ?? "granted");
      setAvisosDesligados(Boolean(bancada.desligados));
      return;
    }
    if (typeof window !== "undefined" && "Notification" in window) {
      setNotifPermission(Notification.permission);
    }
    /* Já autorizou antes? Garante que o registro existe no banco — permissão
       concedida com banco vazio não entrega nada, e é um estado comum (trocar
       de aparelho, limpar dados, reinstalar o app).
       Passa por `renovarAvisosSeJaAutorizado` e não por `subscribeToPush` para
       cobrir também o app nativo, onde não existe `Notification.permission`
       nem chave VAPID: quem sabe da permissão ali é o sistema. */
    setAvisosDesligados(avisosDesligadosNesteAparelho());
    void renovarAvisosSeJaAutorizado();
  }, [bancada]);

  /* ⚠️ O handler de LIGAR era inline no botão, e agora ele tem DOIS pontos de
     uso (quem nunca ativou e quem desligou e quer de volta). Duas cópias do
     mesmo tratamento de `reason` divergiriam no primeiro ajuste — e a que
     divergisse seria a menos olhada. */
  async function ligarOsAvisos() {
    setMexendoNosAvisos(true);
    try {
      /* Sem o `Notification in window` como porteiro: dentro da casca nativa
         quem entrega é o sistema, e essa API pode nem existir. `ativarAvisos`
         escolhe o caminho. */
      const res = await ativarAvisos();
      if (res.ok) {
        setNotifPermission("granted");
        setAvisosDesligados(false);
        toast.success("Avisos ativados 🔔");
      } else if (res.reason === "denied") {
        setNotifPermission("denied");
      } else if (res.reason === "ios-not-installed") {
        toast(
          "No iPhone, adicione o app à Tela de Início primeiro (botão Compartilhar → Adicionar à Tela de Início) para receber avisos.",
        );
      } else if (res.reason === "no-key") {
        // Chaves de push ainda não configuradas no ambiente: mantém o
        // comportamento antigo (só pede permissão) para não regredir.
        const perm = await Notification.requestPermission();
        setNotifPermission(perm);
        if (perm === "granted" && "serviceWorker" in navigator) {
          navigator.serviceWorker.register("/sw.js").catch(() => {});
        }
      } else {
        toast("Não consegui ativar os avisos agora. Tente novamente.");
      }
    } finally {
      setMexendoNosAvisos(false);
    }
  }

  async function desligarOsAvisos() {
    setMexendoNosAvisos(true);
    try {
      const r = await desligarAvisos();
      if (r.ok) {
        setAvisosDesligados(true);
        toast.success("Avisos desligados neste aparelho");
      } else {
        /* ⚠️ O recado NÃO manda ir às Configurações do sistema. Seria empurrá-la
           justamente para o interruptor que este botão existe para evitar — o
           que silencia o app inteiro, levando junto o lembrete da consulta. */
        toast("Não consegui desligar agora. Tente de novo em instantes.");
      }
    } finally {
      setMexendoNosAvisos(false);
    }
  }

  return (
    <>
      {/* Feature 17: Push notifications */}
      <div className="rounded-3xl card-material p-6">
        {/* ⚠️ **O TÍTULO ERA "Dicas semanais", e o canal não é isso.** Esta é a
            tela do CONSENTIMENTO, e ela descrevia um décimo do que o registro
            entrega: pelo mesmo caminho chegam a confirmação da consulta, os
            lembretes de 24h e 4h, o pedido de pré-consulta e os recados do
            consultório. Quem lia "dicas semanais" concluía que era divulgação
            e não ligava — e quem ligava achava que tinha assinado só a dica.
            ⚠️ E o pedido de socorro NÃO entra na lista: o push do SOS vai para
            o MÉDICO, não para ela. */}
        <p className="font-serif text-lg">Avisos do app</p>
        <p className="mt-1 text-sm text-muted-foreground">
          É por aqui que chegam a confirmação e os lembretes da sua consulta, o pedido de
          pré-consulta, os recados do consultório e a dica da sua semana.
        </p>
        <div className="mt-4">
          {notifPermission === "granted" && avisosDesligados ? (
            /* ⚠️ ESTADO PRÓPRIO, e não o de "nunca ativou": o sistema continua
               autorizando, e quem desligou foi ELA. Mostrar o convite de
               ativação aqui apagaria a escolha dela da tela e faria parecer que
               o app esqueceu. */
            <div className="space-y-3">
              <div className="flex items-start gap-3 rounded-2xl bg-secondary p-4">
                <span className="text-2xl">🔕</span>
                <div>
                  <p className="text-sm font-medium">Avisos desligados neste aparelho</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Você não vai receber a confirmação nem os lembretes das suas consultas neste
                    aparelho. Se você usa o app em outro celular, lá eles continuam chegando.
                  </p>
                </div>
              </div>
              <button
                onClick={ligarOsAvisos}
                disabled={mexendoNosAvisos}
                className="min-h-11 rounded-full bg-primary px-5 text-sm font-medium text-white disabled:opacity-60"
              >
                🔔 Voltar a receber os avisos
              </button>
            </div>
          ) : notifPermission === "granted" ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-2xl bg-green-50 border border-green-200 p-4">
                <span className="text-2xl">🔔</span>
                <div>
                  <p className="text-sm font-medium text-green-700">Avisos ativos neste aparelho</p>
                  {/* ⚠️ `text-green-600` sobre `green-50` mede 3,08:1 — abaixo
                      do mínimo de 4,5. Era a classe de antes, e só apareceu
                      quando a tela entrou na varredura de acessibilidade: o
                      conserto é o mesmo dos botões da Loja, escurecer o TEXTO
                      em vez de clarear o fundo. */}
                  <p className="text-xs text-green-800">
                    Consultas, pré-consulta, recados do consultório e a dica da sua semana.
                  </p>
                </div>
              </div>
              <button
                onClick={async () => {
                  const { data: s } = await supabase.auth.getSession();
                  if (!s.session?.access_token) return;
                  const res = await sendTestPushToMe({
                    data: { accessToken: s.session.access_token },
                  });
                  if (res.ok) toast.success("Enviei uma notificação de teste 🔔");
                  else if (res.reason === "not-configured")
                    toast("As notificações ainda estão sendo configuradas. Já já ficam ativas 💛");
                  else if (res.reason === "no-subscription")
                    toast("Reative os lembretes neste aparelho para receber o teste.");
                  else toast("Não consegui enviar o teste agora.");
                }}
                className="min-h-11 rounded-full border border-border px-4 text-xs font-medium text-muted-foreground hover:border-primary hover:text-primary"
              >
                Enviar notificação de teste
              </button>
              {/* ⚠️ **DESLIGAR AQUI EXISTE PARA ELA NÃO DESLIGAR LÁ.** Sem este
                  botão, parar de receber só era possível pelas Configurações do
                  sistema — que silenciam o app INTEIRO e levam junto o lembrete
                  da consulta. A frase acima do botão diz o que ela perde ANTES
                  do toque: um botão de desligar sem isso é uma armadilha
                  educada. */}
              <div className="border-t border-border pt-3">
                <p className="text-xs text-muted-foreground">
                  Se estiver demais, dá para desligar aqui mesmo — assim você não precisa silenciar
                  o app inteiro no seu celular. Você deixa de receber também os lembretes das suas
                  consultas.
                </p>
                <button
                  onClick={desligarOsAvisos}
                  disabled={mexendoNosAvisos}
                  className="mt-2 min-h-11 rounded-full border border-border px-4 text-xs font-medium text-muted-foreground hover:border-primary hover:text-primary disabled:opacity-60"
                >
                  Desligar os avisos neste aparelho
                </button>
              </div>
            </div>
          ) : notifPermission === "denied" ? (
            <div className="rounded-2xl bg-secondary p-4 text-sm text-muted-foreground">
              Notificações bloqueadas neste navegador. Para ativar, vá nas configurações do
              navegador e permita notificações para este site.
            </div>
          ) : (
            <button
              onClick={ligarOsAvisos}
              disabled={mexendoNosAvisos}
              className="min-h-11 rounded-full bg-primary px-5 text-sm font-medium text-white disabled:opacity-60"
            >
              🔔 Ativar os avisos
            </button>
          )}
        </div>
      </div>
    </>
  );
}
