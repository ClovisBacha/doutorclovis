-- ════════════════════════════════════════════════════════════════════════
-- Oferta de boas-vindas — o relógio dos 2h59
--
-- Uma coluna. Ela guarda o instante em que a paciente VIU a oferta pela
-- primeira vez, e é a partir dela que o servidor conta o tempo.
--
-- Por que no banco e não no aparelho: o Clóvis foi explícito de que a
-- promoção é de verdade — "depois que passar, passou". Contador guardado no
-- celular volta ao apagar os dados do app, ao reinstalar e ao trocar de
-- aparelho. Isso não é promoção, é um número piscando na tela, e tem nome no
-- Código de Defesa do Consumidor.
--
-- Sem esta coluna o app NÃO quebra: `getOfertaBoasVindas` cai no `created_at`
-- da conta, e a janela passa a ser as primeiras 2h59 de vida do cadastro.
-- Funciona, mas só alcança quem acabou de se cadastrar — quem criou a conta
-- ontem e abre a oferta hoje nunca a vê. Rodar isto é o que faz o relógio
-- começar quando ela realmente olha o preço.
--
-- Idempotente: pode rodar mais de uma vez.
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE public.patient_profiles
  ADD COLUMN IF NOT EXISTS promo_started_at timestamptz;

COMMENT ON COLUMN public.patient_profiles.promo_started_at IS
  'Instante em que a paciente viu a oferta de boas-vindas pela primeira vez. '
  'Escrito UMA vez, só pelo servidor (service_role). A janela de 2h59 conta a '
  'partir daqui e nunca reabre.';
