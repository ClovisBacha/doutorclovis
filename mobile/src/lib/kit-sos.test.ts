import { describe, expect, test } from "bun:test";
import { kitDoPerfil, mensagemDeSocorro, telefoneInternacional } from "./kit-sos";

describe("o kit do SOS", () => {
  test("monta a ficha só com o que existe", () => {
    const k = kitDoPerfil(
      {
        display_name: " Marina ",
        emergency_contact: "Rafael",
        emergency_phone: "(31) 99999-0000",
        blood_type: "",
      },
      null,
    );
    expect(k.nome).toBe("Marina");
    expect(k.tipoSanguineo).toBeNull();
    expect(k.contatoTelefone).toBe("(31) 99999-0000");
  });
  test("o telefone ganha o 55 quando falta, e número curto não vira link", () => {
    expect(telefoneInternacional("(31) 99999-0000")).toBe("5531999990000");
    expect(telefoneInternacional("+55 31 99999-0000")).toBe("5531999990000");
    expect(telefoneInternacional("1234")).toBeNull();
  });
  test("a mensagem leva a localização quando existe e sempre manda ligar 192", () => {
    const k = kitDoPerfil({ display_name: "Marina" }, null);
    expect(mensagemDeSocorro(k, -19.9, -43.9)).toContain("maps.google.com/?q=-19.90000,-43.90000");
    expect(mensagemDeSocorro(null, null, null)).toContain("ligue 192");
    expect(mensagemDeSocorro(null, null, null)).not.toContain("maps");
  });
});

describe("o médico no kit", () => {
  test("o banco vence; sem as colunas, vale o guardado no aparelho", () => {
    const local = { nome: "Dra. Ana", celular: "31988887777", email: null };
    const doBanco = kitDoPerfil(
      { medico_nome: "Dr. Clóvis", medico_celular: "31999990000" },
      null,
      new Date(),
      local,
    );
    expect(doBanco.medicoNome).toBe("Dr. Clóvis");
    expect(doBanco.medicoCelular).toBe("31999990000");
    const semColunas = kitDoPerfil({ display_name: "Marina" }, null, new Date(), local);
    expect(semColunas.medicoNome).toBe("Dra. Ana");
    expect(semColunas.medicoCelular).toBe("31988887777");
    expect(kitDoPerfil({}, null).medicoNome).toBeNull();
  });
});
