"""Extract logo, product photos, client logos and leaf motif from source/company-profile.pdf."""
import pymupdf, io, os
from PIL import Image
S = 822.047 / 1368.0  # preview-pixel -> pdf points
Z = 4
d = pymupdf.open("source/company-profile.pdf")

def render(pno, box, inset=0):
    x0, y0, x1, y1 = [v * S for v in box]
    i = inset * S
    clip = pymupdf.Rect(x0 + i, y0 + i, x1 - i, y1 - i)
    pm = d[pno].get_pixmap(matrix=pymupdf.Matrix(Z, Z), clip=clip, alpha=False)
    return Image.open(io.BytesIO(pm.tobytes("png"))).convert("RGB")

def save_jpg(im, path, maxw):
    if im.width > maxw:
        im = im.resize((maxw, round(im.height * maxw / im.width)), Image.LANCZOS)
    im.save(path, "JPEG", quality=82, optimize=True, progressive=True)
    return im.size

# ---- logo (page 1): alpha from red channel (white text over green)
im = render(0, (500, 370, 868, 530))
r = im.split()[0]
a = r.point(lambda v: max(0, min(255, int((v - 45) * 255 / 170))))
white = Image.new("RGBA", im.size, (255, 255, 255, 0)); white.putalpha(a)
bbox = a.point(lambda v: 255 if v > 40 else 0).getbbox()
pad = 12
bbox = (max(0, bbox[0]-pad), max(0, bbox[1]-pad), min(im.width, bbox[2]+pad), min(im.height, bbox[3]+pad))
white = white.crop(bbox)
white.save("assets/logo-white.png", optimize=True)
green = Image.new("RGBA", white.size, (10, 122, 94, 0)); green.putalpha(white.split()[3])
green.save("assets/logo-green.png", optimize=True)
print("logo", white.size)

# ---- products
c4x = [(623, 846), (859, 1082), (1095, 1318)]; r4y = [(452, 630), (641, 818)]
c5x = [(606, 830), (842, 1066), (1078, 1302)]; r5y = [(72, 249), (260, 437), (447, 625), (636, 813)]
names4 = ["coffee-tray", "bath-amenities-slippers", "luggage-trolleys",
          "housekeeping-trolleys", "minibar-hairdryer", "dinnerware"]
names5 = ["glassware", "cutlery", "chafing-dish", "commercial-range", "banquet-chairs",
          "signage-stands", "wet-floor-signs", "no-parking-sign", "bins-ashtrays",
          "rope-stanchions", "belt-barriers", "buffet-risers"]
k = 0
for ys in r4y:
    for xs in c4x:
        im = render(3, (xs[0], ys[0], xs[1], ys[1]), inset=5)
        print(names4[k], save_jpg(im, f"assets/images/products/{names4[k]}.jpg", 720)); k += 1
k = 0
for ys in r5y:
    for xs in c5x:
        im = render(4, (xs[0], ys[0], xs[1], ys[1]), inset=5)
        print(names5[k], save_jpg(im, f"assets/images/products/{names5[k]}.jpg", 720)); k += 1

# ---- clients (page 8)
cx = [(601, 767), (782, 947), (963, 1128), (1144, 1309)]
cy = [(96, 261), (276, 440), (456, 620), (635, 800)]
cn = ["riu", "asiana-grand", "hilton", "ritz-carlton", "crowne-plaza", "sheraton", "radisson-blu",
      "millennium", "fairmont", "movenpick", "taj", "address-downtown", "rotana", "le-meridien",
      "jw-marriott", "grand-hyatt"]
k = 0
for ys in cy:
    for xs in cx:
        im = render(7, (xs[0], ys[0], xs[1], ys[1]), inset=4)
        print(cn[k], save_jpg(im, f"assets/clients/{cn[k]}.jpg", 400)); k += 1

# ---- leaf motif (page 2 vector outlines) -> SVG
p = d[1]
paths = []
for dr in p.get_drawings():
    r = dr["rect"]
    if r.x0 < 270 and r.y0 > 300:
        paths.append(dr)
print("leaf drawings", len(paths))
parts = []
for dr in paths:
    seg = ""
    for it in dr["items"]:
        if it[0] == "l":
            a_, b_ = it[1], it[2]
            seg += f"M{a_.x:.1f} {a_.y:.1f}L{b_.x:.1f} {b_.y:.1f}"
        elif it[0] == "c":
            p1, c1, c2, p2 = it[1:5]
            seg += f"M{p1.x:.1f} {p1.y:.1f}C{c1.x:.1f} {c1.y:.1f} {c2.x:.1f} {c2.y:.1f} {p2.x:.1f} {p2.y:.1f}"
    if seg: parts.append(seg)
if parts:
    allr = pymupdf.Rect(); 
    for dr in paths: allr |= dr["rect"]
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{allr.x0:.1f} {allr.y0:.1f} {allr.width:.1f} {allr.height:.1f}" '
           f'fill="none" stroke="#fff" stroke-width="0.8" stroke-linejoin="round"><path d="{" ".join(parts)}"/></svg>')
    open("assets/leaf.svg", "w").write(svg)
