/**
 * ISTO É UM PEDAÇO DO APP QUE NÃO EXISTE MAIS NO SERVIDOR?
 *
 * ─── ⚠️ O DEFEITO CLÁSSICO DE PWA COM DEPLOY FREQUENTE ─────────────────────
 *
 * A paciente está com o app aberto num `index-*.js` de uma versão; sobe um
 * deploy; ela toca em "Abrir meu app"; o router tenta o `import()` do pedaço
 * `/minha-conta-<hash>.js` daquela versão — e o arquivo já não está no CDN. O
 * `import()` REJEITA, e o que ela vê é "Algo deu errado", com o app
 * perfeitamente funcional a um F5 de distância.
 *
 * Foi o que o dono viu, na noite em que subiram catorze deploys.
 *
 * ⚠️ **A régua mora aqui, e não dentro de `__root.tsx`.** Ela é a única parte
 * com julgamento do conserto — o texto do erro muda em cada navegador, e é
 * justamente no aparelho onde o defeito acontece (o iPhone) que eu não consigo
 * olhar. Dentro do componente, só daria para testá-la lendo o fonte; aqui é
 * comportamento.
 *
 * ⚠️ **A lista é GENEROSA de propósito.** Errar para o lado de recarregar é
 * inofensivo (a recarga é uma por sessão); errar para o outro deixa a paciente
 * presa numa tela de erro com o app inteiro funcionando.
 */
export function ehPedacoQueSumiu(e: { name?: string; message?: string } | null): boolean {
  const t = `${e?.name ?? ""} ${e?.message ?? ""}`.toLowerCase();
  if (!t.trim()) return false;
  return (
    /* Chrome, Edge, Android */
    t.includes("failed to fetch dynamically imported module") ||
    t.includes("error loading dynamically imported module") ||
    /* Safari / iOS — o texto é outro, e é o aparelho que mais sofre com isto,
       porque é onde o app fica instalado. */
    t.includes("importing a module script failed") ||
    t.includes("module script failed") ||
    /* Firefox */
    t.includes("error loading a module") ||
    /* Empacotadores que nomeiam o próprio erro */
    t.includes("chunkloaderror") ||
    /* Rede caindo no meio do carregamento de um pedaço */
    (t.includes("dynamically imported module") && t.includes("fetch"))
  );
}
