import js from "@eslint/js";
import eslintPluginPrettier from "eslint-plugin-prettier/recommended";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  /* ⚠️ `*-tmp.mjs` na RAIZ é medição descartável, nunca produto. Eles nascem de
     agente de auditoria e de bancada de medição rodando na árvore viva, e o
     portão reprovava por formatação de arquivo que ninguém vai commitar —
     portão que reprova por motivo alheio ao código é portão que se aprende a
     ignorar. O `.gitignore` impede o commit; esta linha impede o falso
     vermelho.

     ⚠️ `scratchpad/**` entrou pela MESMA razão, medida de novo em set/2026: a
     pasta das medições de cada leva (fotos, baterias de frases, pipelines de
     arte) reprovou o portão com 36 erros de formatação em arquivos que nunca
     serão commitados — e o que estava vermelho era `bun run verificar` sobre
     um código de produção inteiro e correto. */
  /* `mobile/**` é o app React Native (Expo): outro projeto, com tsconfig,
     dependências e regras de lint próprios (React Native não tem DOM, e as
     globais do navegador que este config declara não existem lá). Ele tem
     portão próprio (`mobile/scripts/verificar.sh`), e a CI roda os dois.
     `.claude/**` guarda as cópias isoladas (worktrees) dos agentes: cada uma é
     o repositório inteiro, e o `eslint .` as varria como se fossem código
     daqui — o portão ficava vermelho e lento por arquivo que não é deste
     checkout. */
  {
    ignores: [
      "dist",
      ".output",
      ".vinxi",
      ".vercel",
      "*-tmp.mjs",
      "scratchpad/**",
      "mobile/**",
      ".claude/**",
    ],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "server-only",
              message:
                "TanStack Start does not use the Next.js `server-only` package. Rename the module to `*.server.ts` or mark it with `@tanstack/react-start/server-only`.",
            },
          ],
        },
      ],
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "warn",
      "no-empty": "warn",
    },
  },
  eslintPluginPrettier,
);
