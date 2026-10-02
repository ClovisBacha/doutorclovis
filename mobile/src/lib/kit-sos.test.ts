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
