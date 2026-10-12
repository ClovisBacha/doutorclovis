/**
 * O RODAPÉ DE CONVITE das páginas públicas.
 *
 * A régua — por que existe, o tom, e por que o botão não manda criar conta —
 * mora em `src/lib/convite-do-app.ts`.
 */
import { fraseDoRodape, ROTULO_DO_BOTAO, type OndeConvida } from "@/lib/convite-do-app";
import { linkDeIndicacao, SITE } from "@/lib/indicacao";

export function ConviteDoApp({
  onde,
  codigo,
  nome,
}: {
  onde: OndeConvida;
  codigo: string | null;
  /** Só a vitrine (`onde="perfil"`) usa — ver `fraseDoRodape`. */
  nome?: string | null;
}) {
  /**
   * ⚠️ **SEM CÓDIGO, NÃO APARECE.** Um link sem indicação é indistinguível de um
   * bom para quem manda e para quem recebe — só o vínculo não acontece, e a
   * descoberta vem semanas depois sem nada a que apontar. É a mesma decisão de
   * `linkDeIndicacao` devolver `null`, e a mesma do convite pelo WhatsApp.
   *
   * O servidor já devolve `null` em Modo Cuidado (`codigoParaConvite`), então
   * este mesmo `if` fecha as duas portas.
   */
  const link = linkDeIndicacao(codigo, SITE);
  if (!link) return null;

  const { titulo, sub } = fraseDoRodape(onde, nome);

  return (
    /* ⚠️ **UMA LINHA, NO PÉ, depois do conteúdo inteiro.** A página é DELA — a
       lista é a festa dela, o álbum é a família dela. Um cartão colorido no
       meio é o app se convidando para a festa. */
    <div className="mt-8 border-t border-border pt-5 text-center">
      <p className="text-[13px] font-semibold">{titulo}</p>
      <p className="mx-auto mt-0.5 max-w-[34ch] text-xs leading-snug text-muted-foreground">
        {sub}
      </p>
      <a
        href={link}
        className="press mt-3 inline-flex min-h-[44px] items-center justify-center rounded-full border border-primary/40 px-5 text-[13px] font-semibold text-primary"
      >
        {ROTULO_DO_BOTAO}
      </a>
    </div>
  );
}
