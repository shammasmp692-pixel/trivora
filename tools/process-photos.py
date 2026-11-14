"""Turn supplied product photos into catalogue images.
Usage: python tools/process-photos.py <folder-with-photos>
Name each photo after the product id (e.g. glassware.jpg, cutlery.png) - ids are in script.js.
Output: assets/images/products/<id>.jpg, 1080x840 (9:7), white background, product fitted
with padding (never stretched, never cropped), only DOWN-scaled from the source.
Sources smaller than 900px wide are rejected so low-res images are never enlarged."""
import sys, os
from PIL import Image, ImageOps
W, H, PAD, MIN_SRC = 1080, 840, 0.06, 900
src = sys.argv[1]; out = os.path.join(os.path.dirname(__file__), '..', 'assets', 'images', 'products')
for f in sorted(os.listdir(src)):
    name, ext = os.path.splitext(f)
    if ext.lower() not in ('.jpg', '.jpeg', '.png', '.webp'): continue
    im = ImageOps.exif_transpose(Image.open(os.path.join(src, f)))
    if im.width < MIN_SRC and im.height < MIN_SRC:
        print('SKIP (too small, would be enlarged):', f, im.size); continue
    if im.mode in ('RGBA', 'LA', 'P'):
        im = im.convert('RGBA'); bg = Image.new('RGB', im.size, 'white'); bg.paste(im, mask=im.split()[3]); im = bg
    im = im.convert('RGB')
    box = (int(W * (1 - 2 * PAD)), int(H * (1 - 2 * PAD)))
    im.thumbnail(box, Image.LANCZOS)
    canvas = Image.new('RGB', (W, H), 'white')
    canvas.paste(im, ((W - im.width) // 2, (H - im.height) // 2))
    canvas.save(os.path.join(out, name + '.jpg'), 'JPEG', quality=85, optimize=True, progressive=True)
    print('ok', name)
