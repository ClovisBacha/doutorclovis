// O ÍCONE SEM A MOLDURA: o icon.png antigo traz um quadrado arredondado
// desenhado dentro dele (com aro e sombra) — o "ícone dentro do ícone". Este
// script recorta o miolo desse quadrado (dentro do aro), preenche os quatro
// cantos que ainda mostravam o aro com a cor do próprio miolo (cada pixel do
// canto copia o ponto do arco mais próximo, 6 px para dentro) e devolve um
// 1024×1024 sem alfa, como a App Store exige. O iOS recorta o canto dele.
//
// Rodou UMA vez (18/11/2026), sobre o ícone antigo, que está no histórico:
//   git show b6932cb6:mobile/assets/icon.png > /tmp/icone-antigo.png
//   swift mobile/scripts/recortar-icone.swift /tmp/icone-antigo.png mobile/assets/icon.png
// As medidas abaixo são as daquela arte; numa arte nova, não sirvem.
import Foundation
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers

let a = CommandLine.arguments
let src = CGImageSourceCreateWithURL(URL(fileURLWithPath: a[1]) as CFURL, nil)!
let img = CGImageSourceCreateImageAtIndex(src, 0, nil)!
let W = img.width, H = img.height
precondition(W == 1024 && H == 1024, "esperava o icon.png de 1024×1024")
let cs = CGColorSpace(name: CGColorSpace.sRGB)!
var px = [UInt8](repeating: 0, count: W * H * 4)
let ctx = CGContext(data: &px, width: W, height: H, bitsPerComponent: 8, bytesPerRow: W * 4,
                    space: cs, bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!
ctx.draw(img, in: CGRect(x: 0, y: 0, width: W, height: H))
// (no buffer, a linha 0 é o ALTO da imagem)

// O miolo do quadrado desenhado, medido pixel a pixel (por dentro do aro):
// esquerda 48, direita 978, alto 12, baixo 966. O quadrado não é quadrado
// (930 × 954): o recorte é o maior quadrado centrado nele.
let x0 = 48, lado = 931
let y0 = (12 + 966 + 1) / 2 - lado / 2 // 24

// Os cantos: fora de um arco de raio 230 (o aro desenhado tem ~200, e o
// raio maior garante que nada do aro sobra), o pixel copia o do arco.
let R = 230.0, dentro = 6.0
let esq = 50.0, alto = 14.0, dir = 974.0, baixo = 962.0
var saida = px
for y in y0..<(y0 + lado) {
  for x in x0..<(x0 + lado) {
    let fx = Double(x), fy = Double(y)
    var c: (Double, Double)? = nil
    if fx < esq + R && fy < alto + R { c = (esq + R, alto + R) }
    else if fx > dir - R && fy < alto + R { c = (dir - R, alto + R) }
    else if fx < esq + R && fy > baixo - R { c = (esq + R, baixo - R) }
    else if fx > dir - R && fy > baixo - R { c = (dir - R, baixo - R) }
    guard let (cx, cy) = c else { continue }
    let dx = fx - cx, dy = fy - cy, d = (dx * dx + dy * dy).squareRoot()
    if d <= R - 4 { continue }
    let sx = Int((cx + dx / d * (R - dentro)).rounded())
    let sy = Int((cy + dy / d * (R - dentro)).rounded())
    // A cor do arco é a MÉDIA de uma janela de 13×13 em volta do ponto: o
    // miolo tem um pontilhado fino, e copiar um pixel só riscava raios no canto.
    var soma = (0, 0, 0), n = 0
    for vy in (sy - 6)...(sy + 6) {
      for vx in (sx - 6)...(sx + 6) {
        let j = (vy * W + vx) * 4
        soma.0 += Int(px[j]); soma.1 += Int(px[j + 1]); soma.2 += Int(px[j + 2]); n += 1
      }
    }
    // Uma costura de 4 px entre o miolo e o preenchimento, sem degrau.
    let t = min(1, max(0, (d - (R - 4)) / 4))
    let i = (y * W + x) * 4
    saida[i] = UInt8((Double(px[i]) * (1 - t) + Double(soma.0) / Double(n) * t).rounded())
    saida[i + 1] = UInt8((Double(px[i + 1]) * (1 - t) + Double(soma.1) / Double(n) * t).rounded())
    saida[i + 2] = UInt8((Double(px[i + 2]) * (1 - t) + Double(soma.2) / Double(n) * t).rounded())
    saida[i + 3] = 255
  }
}

let provider = CGDataProvider(data: Data(saida) as CFData)!
let inteira = CGImage(width: W, height: H, bitsPerComponent: 8, bitsPerPixel: 32, bytesPerRow: W * 4,
                      space: cs, bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.noneSkipLast.rawValue),
                      provider: provider, decode: nil, shouldInterpolate: false, intent: .defaultIntent)!
// CGImage.cropping usa a linha 0 no alto, como o buffer.
let miolo = inteira.cropping(to: CGRect(x: x0, y: y0, width: lado, height: lado))!
let out = CGContext(data: nil, width: 1024, height: 1024, bitsPerComponent: 8, bytesPerRow: 0,
                    space: cs, bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!
out.interpolationQuality = .high
out.draw(miolo, in: CGRect(x: 0, y: 0, width: 1024, height: 1024))
let dest = CGImageDestinationCreateWithURL(URL(fileURLWithPath: a[2]) as CFURL,
                                           UTType.png.identifier as CFString, 1, nil)!
CGImageDestinationAddImage(dest, out.makeImage()!, nil)
precondition(CGImageDestinationFinalize(dest))
print("✓ \(a[2]): miolo \(lado)×\(lado) em (\(x0), \(y0)) → 1024×1024, sem alfa")
