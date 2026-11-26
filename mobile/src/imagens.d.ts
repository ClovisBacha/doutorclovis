/**
 * As artes `.webp`/`.png` importadas pelo SITE (src/lib/trilha-skins.ts,
 * src/components/arte-do-cantinho.tsx). No Vite elas viram uma URL (string);
 * no Metro, um número do registro de imagens. `any` porque o mesmo arquivo do
 * site declara `Record<string, string>` — e o app só as entrega ao `Image`,
 * que aceita as duas formas.
 */
declare module "*.webp" {
  const arte: any;
  export default arte;
}
declare module "*.png" {
  const arte: any;
  export default arte;
}
