# Remove o canal alfa de um PNG RGBA 8 bits (compõe sobre a cor de fundo) — a
# App Store recusa ícone com alfa (ITMS-90717). Sem PIL no contêiner.
import sys, zlib, struct
src, dst, bg = sys.argv[1], sys.argv[2], sys.argv[3]
br, bgc, bb = int(bg[0:2],16), int(bg[2:4],16), int(bg[4:6],16)
d = open(src,'rb').read(); assert d[:8]==b'\x89PNG\r\n\x1a\n'
i=8; idat=b''; w=h=0
while i < len(d):
    n=struct.unpack('>I',d[i:i+4])[0]; t=d[i+4:i+8]; c=d[i+8:i+8+n]; i+=12+n
    if t==b'IHDR':
        w,h,bd,ct,_,_,il=struct.unpack('>IIBBBBB',c); assert bd==8 and ct==6 and il==0, (bd,ct,il)
    elif t==b'IDAT': idat+=c
raw=zlib.decompress(idat); bpp=4; stride=w*bpp; out=bytearray(); prev=bytearray(stride); p=0
def paeth(a,b,c):
    pa=abs(b-c); pb=abs(a-c); pc=abs(a+b-2*c)
    return a if pa<=pb and pa<=pc else (b if pb<=pc else c)
rows=[]
for y in range(h):
    f=raw[p]; p+=1; line=bytearray(raw[p:p+stride]); p+=stride
    for x in range(stride):
        a=line[x-bpp] if x>=bpp else 0; b=prev[x]; c=prev[x-bpp] if x>=bpp else 0
        if f==1: line[x]=(line[x]+a)&255
        elif f==2: line[x]=(line[x]+b)&255
        elif f==3: line[x]=(line[x]+((a+b)>>1))&255
        elif f==4: line[x]=(line[x]+paeth(a,b,c))&255
    rows.append(line); prev=line
res=bytearray()
for line in rows:
    res.append(0)
    for x in range(0,stride,4):
        r,g,b,al=line[x:x+4]
        res+=bytes((round((r*al+br*(255-al))/255),round((g*al+bgc*(255-al))/255),round((b*al+bb*(255-al))/255)))
def chunk(t,c): return struct.pack('>I',len(c))+t+c+struct.pack('>I',zlib.crc32(t+c)&0xffffffff)
png=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',w,h,8,2,0,0,0))+chunk(b'IDAT',zlib.compress(bytes(res),9))+chunk(b'IEND',b'')
open(dst,'wb').write(png); print('ok',w,h)
