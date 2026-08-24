#!/usr/bin/env python3
"""
Gera os ícones do app nativo a partir da marca em `public/icon-512.png`.

─── Por que este script existe ───────────────────────────────────────────

O `cap add` gera os projetos nativos com os ícones de EXEMPLO do Capacitor — um
"X" azul sobre uma grade. Eles compilam, o app abre, e nada acusa o problema:
o app iria para a loja com a logo do Capacitor.

O caminho normal seria `@capacitor/assets`, que usa `sharp`. Este contêiner não
tem `sharp`, nem ImageMagick, nem PIL, e a rede derruba tarballs. Então o
redimensionamento é feito aqui, com `zlib` da biblioteca padrão — que é o único
requisito de verdade para ler e escrever PNG.

─── A parte que não é só redimensionar ───────────────────────────────────

A marca do site tem MARGEM BRANCA em volta de um quadrado arredondado rosa. Isso
é certo para um favicon e errado para um ícone de app:

  · O iOS aplica a máscara arredondada ELE MESMO. Um quadrado arredondado dentro
    de um quadrado branco vira, depois da máscara, um ícone rosa boiando num
    anel branco — o clássico "ícone dentro do ícone".
  · O ícone do iOS não pode ter transparência. Canto transparente vira preto.

Então o script recorta o conteúdo, joga fora a margem, e assenta tudo sobre a
própria cor de fundo da marca. O resultado é full-bleed: a máscara do sistema
corta a cor, não o desenho.

Uso:  python3 scripts/icones-nativos.py
"""

import struct
import zlib
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
FONTE = RAIZ / "public" / "icon-512.png"


# ── PNG: ler ──────────────────────────────────────────────────────────────


def ler_png(caminho):
    """Devolve (largura, altura, pixels RGBA como bytearray)."""
    dados = caminho.read_bytes()
    assert dados[:8] == b"\x89PNG\r\n\x1a\n", "não é PNG"

    idat = b""
    plte = None
    trns = None
    i = 8
    while i < len(dados):
        (tam,) = struct.unpack(">I", dados[i : i + 4])
        tipo = dados[i + 4 : i + 8]
        corpo = dados[i + 8 : i + 8 + tam]
        if tipo == b"IHDR":
            larg, alt, prof, cor, _, _, entrelace = struct.unpack(">IIBBBBB", corpo)
            assert prof == 8, f"só 8 bits por canal (veio {prof})"
            assert entrelace == 0, "PNG entrelaçado não é suportado"
        elif tipo == b"PLTE":
            plte = corpo
        elif tipo == b"tRNS":
            trns = corpo
        elif tipo == b"IDAT":
            idat += corpo
        elif tipo == b"IEND":
            break
        i += 12 + tam

    canais = {0: 1, 2: 3, 3: 1, 4: 2, 6: 4}[cor]
    linha_bruta = desfiltrar(zlib.decompress(idat), larg, alt, canais)

    # Tudo vira RGBA — o resto do script não precisa saber de paleta.
    px = bytearray(larg * alt * 4)
    for n in range(larg * alt):
        if cor == 3:
            idx = linha_bruta[n]
            r, g, b = plte[idx * 3 : idx * 3 + 3]
            a = trns[idx] if trns and idx < len(trns) else 255
        elif cor == 2:
            r, g, b = linha_bruta[n * 3 : n * 3 + 3]
            a = 255
        elif cor == 6:
            r, g, b, a = linha_bruta[n * 4 : n * 4 + 4]
        elif cor == 0:
            r = g = b = linha_bruta[n]
            a = 255
        else:  # 4 = cinza + alfa
            r = g = b = linha_bruta[n * 2]
            a = linha_bruta[n * 2 + 1]
        px[n * 4 : n * 4 + 4] = bytes((r, g, b, a))
    return larg, alt, px


def desfiltrar(cru, larg, alt, canais):
    """Desfaz os filtros por linha do PNG (RFC 2083, seção 6)."""
    bpp = canais
    passo = larg * canais
    saida = bytearray(passo * alt)
    anterior = bytearray(passo)
    pos = 0
    for y in range(alt):
        filtro = cru[pos]
        pos += 1
        linha = bytearray(cru[pos : pos + passo])
        pos += passo
        if filtro == 1:  # Sub
            for x in range(bpp, passo):
                linha[x] = (linha[x] + linha[x - bpp]) & 0xFF
        elif filtro == 2:  # Up
            for x in range(passo):
                linha[x] = (linha[x] + anterior[x]) & 0xFF
        elif filtro == 3:  # Average
            for x in range(passo):
                esq = linha[x - bpp] if x >= bpp else 0
                linha[x] = (linha[x] + ((esq + anterior[x]) >> 1)) & 0xFF
        elif filtro == 4:  # Paeth
            for x in range(passo):
                a = linha[x - bpp] if x >= bpp else 0
                b = anterior[x]
                c = anterior[x - bpp] if x >= bpp else 0
                p = a + b - c
                pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                pr = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
                linha[x] = (linha[x] + pr) & 0xFF
        saida[y * passo : (y + 1) * passo] = linha
        anterior = linha
    return saida


# ── PNG: escrever ─────────────────────────────────────────────────────────


def escrever_png(caminho, larg, alt, px):
    def chunk(tipo, corpo):
        return (
            struct.pack(">I", len(corpo))
            + tipo
            + corpo
            + struct.pack(">I", zlib.crc32(tipo + corpo) & 0xFFFFFFFF)
        )

    cru = bytearray()
    for y in range(alt):
        cru.append(0)  # filtro "None": o zlib faz o trabalho, e o arquivo é pequeno
        cru += px[y * larg * 4 : (y + 1) * larg * 4]
    dados = (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", larg, alt, 8, 6, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(bytes(cru), 9))
        + chunk(b"IEND", b"")
    )
    caminho.parent.mkdir(parents=True, exist_ok=True)
    caminho.write_bytes(dados)


# ── Operações de imagem ───────────────────────────────────────────────────


def redimensionar(larg, alt, px, novo):
    """
    Área média ao reduzir, bilinear ao ampliar.

    Reduzir por amostragem simples (pegar 1 pixel a cada N) serrilha as bordas
    da marca de um jeito que salta aos olhos nos ícones pequenos — que são
    justamente os mais vistos, na lista de apps. Média de área custa mais e
    resolve.
    """
    saida = bytearray(novo * novo * 4)
    escala_x = larg / novo
    escala_y = alt / novo
    reduz = escala_x >= 1
    for y in range(novo):
        for x in range(novo):
            if reduz:
                x0, x1 = int(x * escala_x), max(int((x + 1) * escala_x), int(x * escala_x) + 1)
                y0, y1 = int(y * escala_y), max(int((y + 1) * escala_y), int(y * escala_y) + 1)
                sr = sg = sb = sa = 0
                n = 0
                for yy in range(y0, min(y1, alt)):
                    base = yy * larg * 4
                    for xx in range(x0, min(x1, larg)):
                        p = base + xx * 4
                        sr += px[p]
                        sg += px[p + 1]
                        sb += px[p + 2]
                        sa += px[p + 3]
                        n += 1
                q = (sr // n, sg // n, sb // n, sa // n)
            else:
                sx = min(int(x * escala_x), larg - 1)
                sy = min(int(y * escala_y), alt - 1)
                p = (sy * larg + sx) * 4
                q = (px[p], px[p + 1], px[p + 2], px[p + 3])
            d = (y * novo + x) * 4
            saida[d : d + 4] = bytes(q)
    return saida


def caixa_do_conteudo(larg, alt, px, fundo, tolerancia=12):
    """Menor retângulo que contém tudo que NÃO é a cor de fundo/transparente."""
    x0, y0, x1, y1 = larg, alt, -1, -1
    for y in range(alt):
        base = y * larg * 4
        for x in range(larg):
            p = base + x * 4
            if px[p + 3] < 8:
                continue
            if (
                abs(px[p] - fundo[0]) <= tolerancia
                and abs(px[p + 1] - fundo[1]) <= tolerancia
                and abs(px[p + 2] - fundo[2]) <= tolerancia
            ):
                continue
            x0, y0 = min(x0, x), min(y0, y)
            x1, y1 = max(x1, x), max(y1, y)
    return x0, y0, x1, y1


def recortar(larg, alt, px, x0, y0, x1, y1):
    nl, na = x1 - x0 + 1, y1 - y0 + 1
    saida = bytearray(nl * na * 4)
    for y in range(na):
        o = ((y + y0) * larg + x0) * 4
        saida[y * nl * 4 : (y + 1) * nl * 4] = px[o : o + nl * 4]
    return nl, na, saida


def sobre_fundo(larg, alt, px, cor):
    """
    Achata o alfa contra uma cor sólida.

    Obrigatório para o iOS: ícone com canal alfa é rejeitado no upload, e o que
    era transparente aparece PRETO. Achatar aqui é o que evita descobrir isso no
    dia da submissão.
    """
    saida = bytearray(larg * alt * 4)
    for i in range(0, len(px), 4):
        a = px[i + 3]
        for c in range(3):
            saida[i + c] = (px[i + c] * a + cor[c] * (255 - a)) // 255
        saida[i + 3] = 255
    return saida


def quadrado(larg, alt, px, cor):
    """Centraliza num quadrado da maior dimensão, preenchendo com `cor`."""
    cor = rgba(cor)
    lado = max(larg, alt)
    saida = bytearray(bytes(cor) * (lado * lado))
    dx, dy = (lado - larg) // 2, (lado - alt) // 2
    for y in range(alt):
        o = y * larg * 4
        d = ((y + dy) * lado + dx) * 4
        saida[d : d + larg * 4] = px[o : o + larg * 4]
    return lado, saida


def rgba(cor):
    """
    Aceita (r,g,b) ou (r,g,b,a) e devolve sempre 4 canais.

    Existe porque não existir custou um `IndexError`: os buffers deste script
    são RGBA, e `bytes((r,g,b)) * n` produz uma tela com 3/4 do tamanho — o erro
    só aparece na hora de ler, longe de onde a cor foi passada.
    """
    return tuple(cor) if len(cor) == 4 else (*cor, 255)


def cor_da_borda(larg, alt, px):
    """
    A cor mais comum na borda da arte recortada.

    Amostrar UM pixel não serve: a marca tem brilho e degradê, e o ponto que eu
    havia escolhido caía justamente no reflexo — devolvia quase branco, e o
    ícone inteiro sairia branco. A moda da borda ignora o reflexo por definição,
    porque ele é minoria.
    """
    contagem = {}
    for y in range(alt):
        na_borda_y = y < alt // 25 or y > alt - alt // 25
        for x in range(larg):
            if not (na_borda_y or x < larg // 25 or x > larg - larg // 25):
                continue
            p = (y * larg + x) * 4
            if px[p + 3] < 200:
                continue
            # Agrupa em degraus de 4 para o degradê não virar mil cores únicas.
            k = (px[p] // 4, px[p + 1] // 4, px[p + 2] // 4)
            contagem[k] = contagem.get(k, 0) + 1
    k = max(contagem, key=contagem.get)
    return (k[0] * 4 + 2, k[1] * 4 + 2, k[2] * 4 + 2, 255)


def com_margem(lado, px, folga, cor):
    """
    Devolve a arte encolhida dentro de uma tela maior, com `folga` de respiro.

    É o que o ícone ADAPTATIVO do Android pede: o sistema corta a camada da
    frente em círculo, quadrado ou "squircle" conforme o aparelho, e o desenho
    precisa caber na área segura central (66% do lado). Sem essa folga, o
    círculo do launcher come a barriga do desenho.
    """
    interno = int(lado * (1 - folga * 2))
    arte = redimensionar(lado, lado, px, interno)
    saida = bytearray(bytes(rgba(cor)) * (lado * lado))
    off = (lado - interno) // 2
    for y in range(interno):
        o = y * interno * 4
        d = ((y + off) * lado + off) * 4
        saida[d : d + interno * 4] = arte[o : o + interno * 4]
    return saida


# ── Programa ──────────────────────────────────────────────────────────────

# Densidades do Android. `ic_launcher` é o ícone legado (Android 7 e anteriores);
# `ic_launcher_foreground` é a camada da frente do adaptativo (Android 8+), e é
# essa que a maioria dos aparelhos usa hoje.
DENSIDADES = {
    "mdpi": 48,
    "hdpi": 72,
    "xhdpi": 96,
    "xxhdpi": 144,
    "xxxhdpi": 192,
}
# O adaptativo desenha numa tela 108dp da qual só os 72dp centrais aparecem.
ADAPTATIVO = {k: round(v * 108 / 48) for k, v in DENSIDADES.items()}


def main():
    larg, alt, px = ler_png(FONTE)
    print(f"fonte: {larg}x{alt}")

    # A cor de fundo vem do canto — é a margem que queremos jogar fora.
    canto = (px[0], px[1], px[2], px[3])
    fundo_margem = canto[:3] if canto[3] > 8 else (255, 255, 255)

    x0, y0, x1, y1 = caixa_do_conteudo(larg, alt, px, fundo_margem)
    print(f"conteúdo: ({x0},{y0})-({x1},{y1})")
    cl, ca, cpx = recortar(larg, alt, px, x0, y0, x1, y1)

    # A cor que preenche os cantos: a mais comum na borda do recorte, que é o
    # rosa claro do quadrado da marca.
    marca = cor_da_borda(cl, ca, cpx)
    print(f"cor da marca: rgb{marca[:3]}")

    lado, qpx = quadrado(cl, ca, cpx, marca)
    qpx = sobre_fundo(lado, lado, qpx, marca[:3])
    base = redimensionar(lado, lado, qpx, 1024)

    # iOS: um único 1024×1024, opaco. O Xcode moderno aceita "Single Size" e
    # gera as variações; é o que o Contents.json gerado pelo Capacitor já usa.
    ios = RAIZ / "ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png"
    escrever_png(ios, 1024, 1024, base)
    print(f"escrito {ios.relative_to(RAIZ)}")

    # Android legado + redondo: a arte cheia, por densidade.
    for dens, tam in DENSIDADES.items():
        arte = redimensionar(1024, 1024, base, tam)
        for nome in ("ic_launcher", "ic_launcher_round"):
            escrever_png(RAIZ / f"android/app/src/main/res/mipmap-{dens}/{nome}.png", tam, tam, arte)

    # Android adaptativo: a arte com folga, para o recorte do launcher não comer
    # o desenho. 18% de cada lado é o que sobra da área segura de 66%.
    frente_grande = com_margem(1024, base, 0.18, marca[:3])
    for dens, tam in ADAPTATIVO.items():
        arte = redimensionar(1024, 1024, frente_grande, tam)
        escrever_png(
            RAIZ / f"android/app/src/main/res/mipmap-{dens}/ic_launcher_foreground.png",
            tam,
            tam,
            arte,
        )
    print("escritos os ícones do Android")

    # A cor de fundo do adaptativo tem que ser a MESMA da arte, senão aparece uma
    # moldura de outra cor em volta do recorte.
    hexa = "#%02X%02X%02X" % marca[:3]
    cor_xml = RAIZ / "android/app/src/main/res/values/ic_launcher_background.xml"
    cor_xml.write_text(
        '<?xml version="1.0" encoding="utf-8"?>\n'
        "<resources>\n"
        f'    <color name="ic_launcher_background">{hexa}</color>\n'
        "</resources>\n"
    )
    print(f"fundo do adaptativo: {hexa}")

    gerar_splash(base, marca)


# ── Tela de abertura ──────────────────────────────────────────────────────

# O Capacitor usa UMA imagem quadrada grande para as duas orientações: o sistema
# corta o que sobra. 2732 é o lado do maior iPad, então cabe em tudo.
SPLASH_ANDROID = {"mdpi": 480, "hdpi": 720, "xhdpi": 960, "xxhdpi": 1280, "xxxhdpi": 1920}


def montar_splash(lado, arte_lado, arte, cor):
    """Tela da cor da marca com o desenho centralizado, sem esticar."""
    tela = bytearray(bytes(rgba(cor)) * (lado * lado))
    off = (lado - arte_lado) // 2
    for y in range(arte_lado):
        o = y * arte_lado * 4
        d = ((y + off) * lado + off) * 4
        tela[d : d + arte_lado * 4] = arte[o : o + arte_lado * 4]
    return tela


def gerar_splash(base, marca):
    """
    Por que a marca NÃO é esticada até a borda: a fonte tem 1024px e as telas
    pedem até 2732. Ampliar 2,7x deixa a arte borrada — e a tela de abertura é
    a primeira coisa que a paciente vê do app. Melhor a marca nítida no tamanho
    dela, sobre a cor, do que grande e chapada.
    """
    for dens, lado in SPLASH_ANDROID.items():
        arte_lado = int(lado * 0.42)
        arte = redimensionar(1024, 1024, base, arte_lado)
        tela = montar_splash(lado, arte_lado, arte, marca)
        for orient in ("port", "land"):
            escrever_png(
                RAIZ / f"android/app/src/main/res/drawable-{orient}-{dens}/splash.png",
                lado,
                lado,
                tela,
            )
    # A cópia sem orientação, que o Android usa como padrão.
    arte = redimensionar(1024, 1024, base, 806)
    escrever_png(
        RAIZ / "android/app/src/main/res/drawable/splash.png",
        1920,
        1920,
        montar_splash(1920, 806, arte, marca),
    )

    # iOS: o Capacitor gera três arquivos (claro, escuro e "any") apontando para
    # a mesma arte. Manter os três com o mesmo conteúdo evita um tema do sistema
    # cair no arquivo antigo — e o antigo é a logo do Capacitor.
    lado = 2732
    arte = redimensionar(1024, 1024, base, 1148)
    tela = montar_splash(lado, 1148, arte, marca)
    for nome in ("splash-2732x2732", "splash-2732x2732-1", "splash-2732x2732-2"):
        escrever_png(
            RAIZ / f"ios/App/App/Assets.xcassets/Splash.imageset/{nome}.png", lado, lado, tela
        )
    print("escritas as telas de abertura")


if __name__ == "__main__":
    main()
