/**
 * Tipos do `bun:test`, declarados aqui em vez de via `@types/bun`.
 *
 * O pacote completo resolveria isto — e foi o que tentei primeiro. Só que ele
 * arrasta o lockfile junto, e o `bun install --frozen-lockfile` do CI recusa
 * qualquer `package.json` que peça algo que o lockfile não conhece: os dois
 * jobs quebravam no PRÓPRIO install, antes de rodar `tsc` ou `eslint`.
 *
 * Declarar o pouco que usamos custa vinte linhas, não muda o lockfile e faz o
 * ambiente local e o CI se comportarem igual — que é a propriedade que importa.
 * Se um dia a suíte precisar de mocks, spies ou temporizadores falsos, aí sim
 * vale trocar por `@types/bun` de verdade, com o lockfile atualizado.
 */

declare module "bun:test" {
  export function describe(nome: string, corpo: () => void): void;
  export function test(nome: string, corpo: () => void | Promise<void>): void;
  export function beforeEach(corpo: () => void | Promise<void>): void;
  export function afterEach(corpo: () => void | Promise<void>): void;

  type Matchers = {
    toBe(esperado: unknown): void;
    toEqual(esperado: unknown): void;
    toBeNull(): void;
    toBeUndefined(): void;
    toBeTruthy(): void;
    toBeFalsy(): void;
    toBeCloseTo(esperado: number, casas?: number): void;
    toBeGreaterThan(esperado: number): void;
    toBeGreaterThanOrEqual(esperado: number): void;
    toBeLessThan(esperado: number): void;
    toBeLessThanOrEqual(esperado: number): void;
    toContain(trecho: unknown): void;
    toHaveLength(n: number): void;
    toThrow(esperado?: unknown): void;
    /** `expect(x).not.toBe(y)` — a negação de tudo o que está acima. */
    not: Omit<Matchers, "not">;
  };

  export function expect(valor: unknown): Matchers;
}
