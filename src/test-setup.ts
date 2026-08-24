/**
 * Carregado antes de qualquer teste (`[test] preload` no `bunfig.toml`).
 *
 * O FUSO DO TESTE É O FUSO DO CONSULTÓRIO. A régua de idade gestacional ancora
 * em MEIA-NOITE LOCAL, e o defeito que ela corrige só aparece num fuso a oeste
 * de Greenwich: em UTC-3, das 21h à meia-noite, a data local e a UTC discordam,
 * e a ficha do médico ficava um dia à frente do app da paciente. O runner do CI
 * roda em UTC — sem isto, os testes que travam essa regra passariam sempre,
 * inclusive com o defeito de volta.
 *
 * `process.env.TZ` antes do primeiro `new Date()` porque é aí que o runtime lê
 * o fuso; depois disso já foi.
 */
process.env.TZ = "America/Sao_Paulo";
