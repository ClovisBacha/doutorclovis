import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

/**
 * Chama `aoVoltar` quando o app volta ao primeiro plano e, enquanto houver
 * algo na fila (`pendente`), a cada 30 s — é assim que a fila sobe "no
 * retorno da rede" sem um pacote nativo a mais: sem rede a tentativa falha
 * calada e fica para a próxima.
 */
export function usarRetorno(aoVoltar: () => void, pendente: boolean) {
  const ref = useRef(aoVoltar);
  ref.current = aoVoltar;
  useEffect(() => {
    const sub = AppState.addEventListener("change", (e) => {
      if (e === "active") ref.current();
    });
    return () => sub.remove();
  }, []);
  useEffect(() => {
    if (!pendente) return;
    const t = setInterval(() => ref.current(), 30000);
    return () => clearInterval(t);
  }, [pendente]);
}

/**
 * Tela acesa enquanto `ligado` (contração em curso, contagem de movimentos):
 * quem espera sem tocar no aparelho é justamente quem vê a tela apagar.
 */
export function usarTelaAcesa(ligado: boolean, etiqueta: string) {
  useEffect(() => {
    if (!ligado) return;
    activateKeepAwakeAsync(etiqueta).catch(() => {});
    return () => {
      deactivateKeepAwake(etiqueta).catch(() => {});
    };
  }, [ligado, etiqueta]);
}

/** Um relógio que repinta a cada segundo enquanto `ligado`. */
export function usarRelogio(ligado: boolean): number {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    if (!ligado) return;
    setAgora(Date.now());
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [ligado, setAgora]);
  return agora;
}

