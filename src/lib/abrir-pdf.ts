/**
 * Abrir um PDF que está em data URL.
 *
 * `<a href="data:application/pdf…" target="_blank">` NÃO FUNCIONA: Chrome e
 * Firefox bloqueiam navegação de nível superior para `data:` desde 2017 — o
 * clique simplesmente não faz nada, sem erro e sem aviso.
 *
 * E o link era exatamente o caminho de reserva para quem não renderiza
 * `<object>` PDF embutido — que é o Chrome no Android. Somando as duas coisas:
 * **o médico no celular não abria nenhum laudo em PDF**, e o botão "Abrir o
 * PDF" era decoração.
 *
 * `Blob` + `URL.createObjectURL` produz uma URL `blob:` de mesma origem, que
 * os navegadores abrem normalmente.
 */
export function abrirPdfDeDataUrl(dataUrl: string): void {
  try {
    const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
    const bin = atob(base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
    window.open(url, "_blank", "noopener");
    /* Liberar cedo demais fecha a aba recém-aberta em alguns navegadores; um
       minuto é folgado e evita segurar o arquivo na memória para sempre. */
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch {
    /* Data URL malformada: melhor não fazer nada que estourar na tela. */
  }
}
