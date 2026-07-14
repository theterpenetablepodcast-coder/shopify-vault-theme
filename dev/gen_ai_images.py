"""
AI-quality image generation for The Cultivators Club
- Pollinations (Flux) generates dark botanical backgrounds
- Pillow composites clean text on top
"""
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance
import urllib.request, urllib.parse, io, os, time

FONTS = (
    "C:/Users/thete/AppData/Local/Packages/Claude_pzs8sxrjxfjjc"
    "/LocalCache/Roaming/Claude/local-agent-mode-sessions/skills-plugin"
    "/29c5658b-fc5d-41da-91f3-197b9bfa10be"
    "/40c7ea79-97ae-4948-93ff-c2cb93ce2548/skills/canvas-design/canvas-fonts"
)
OUT = "Z:/shopify-vault-theme/assets"

# Brand colours
CREAM  = (237, 232, 220)
AMBER  = (180, 140,  60)
TAUPE  = (148, 138, 116)
BG     = (  8,   8,   8)

HEADERS = {'User-Agent': 'Mozilla/5.0'}

# ── helpers ────────────────────────────────────────────────────────────────

def fetch_bg(prompt, width, height, seed=42):
    encoded = urllib.parse.quote(prompt)
    url = (f"https://image.pollinations.ai/prompt/{encoded}"
           f"?model=flux&width={width}&height={height}&nologo=true&seed={seed}&enhance=false")
    print(f"  Fetching {width}x{height} background...")
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=120) as r:
        return Image.open(io.BytesIO(r.read())).convert("RGB")

def fetch_bg_exact(prompt, width, height, seed=42):
    """Fetch background and force-resize to exact dimensions."""
    img = fetch_bg(prompt, width, height, seed)
    if img.size != (width, height):
        print(f"  Resizing from {img.size} to ({width},{height})")
        img = img.resize((width, height), Image.LANCZOS)
    return img

def darken_and_tint(img, darkness=0.55, warmth=0.08):
    """Darken the image and add a warm near-black tint to match CC palette."""
    img = ImageEnhance.Brightness(img).enhance(darkness)
    img = ImageEnhance.Color(img).enhance(0.45)       # desaturate toward B&W
    # Add warm amber tint layer
    warm = Image.new("RGB", img.size, (18, 12, 4))
    img  = Image.blend(img, warm, warmth)
    return img

def vignette(img, strength=0.72):
    """Strong edge vignette — focus attention to centre."""
    w, h = img.size
    vig  = Image.new("L", (w, h), 255)
    d    = ImageDraw.Draw(vig)
    steps = min(w, h) // 2
    for i in range(steps):
        t   = (i / steps) ** 1.6
        val = int(255 * (1 - strength * (1 - t)))
        d.ellipse([i, i * h // w, w - i, h - i * h // w], fill=val)
    vig  = vig.filter(ImageFilter.GaussianBlur(radius=min(w,h)//8))
    # Apply: dark corners
    black = Image.new("RGB", img.size, BG)
    img.paste(black, mask=ImageChops_invert(vig))
    return img

def ImageChops_invert(mask):
    from PIL import ImageChops
    return ImageChops.invert(mask)

def paste_text_centered(draw, canvas, y, text, font, fill, opacity=1.0):
    bb  = draw.textbbox((0, 0), text, font=font)
    w   = bb[2] - bb[0]
    x   = (canvas.width - w) // 2
    if opacity < 1.0:
        layer = Image.new("RGBA", canvas.size, (0,0,0,0))
        ld    = ImageDraw.Draw(layer)
        ld.text((x, y), text, font=font, fill=fill + (int(opacity * 255),))
        canvas.paste(layer, mask=layer.split()[3])
    else:
        draw.text((x, y), text, font=font, fill=fill)
    return bb[3]   # return bottom of bbox from y=0 (add to y for next line)

def amber_rule(img, y, width_frac=0.25, opacity=0.6):
    w  = img.width
    rw = int(w * width_frac)
    rx = (w - rw) // 2
    layer = Image.new("RGB", img.size, AMBER)
    mask  = Image.new("L",   img.size, 0)
    ImageDraw.Draw(mask).line([(rx, y), (rx + rw, y)], fill=int(opacity*255), width=2)
    img.paste(layer, mask=mask)

def top_bottom_rules(img, pad=55, opacity=40):
    w = img.width
    h = img.height
    layer = Image.new("RGB", img.size, TAUPE)
    mask  = Image.new("L",   img.size, 0)
    d     = ImageDraw.Draw(mask)
    rule_pad = int(w * 0.04)
    d.line([(rule_pad, pad),   (w-rule_pad, pad)],   fill=opacity, width=1)
    d.line([(rule_pad, pad+3), (w-rule_pad, pad+3)], fill=opacity//2, width=1)
    d.line([(rule_pad, h-pad),   (w-rule_pad, h-pad)],   fill=opacity, width=1)
    d.line([(rule_pad, h-pad-3), (w-rule_pad, h-pad-3)], fill=opacity//2, width=1)
    img.paste(layer, mask=mask)

def corner_marks(img, size=32, pad=36, opacity=50):
    layer = Image.new("RGB", img.size, AMBER)
    mask  = Image.new("L",   img.size, 0)
    d     = ImageDraw.Draw(mask)
    for x, y, sx, sy in [(pad, pad, 1, 1), (img.width-pad, pad, -1, 1),
                          (pad, img.height-pad, 1, -1), (img.width-pad, img.height-pad, -1, -1)]:
        d.line([(x, y), (x+sx*size, y)],       fill=opacity, width=1)
        d.line([(x, y), (x, y+sy*size)],        fill=opacity, width=1)
    img.paste(layer, mask=mask)

# ── HERO BANNER (3200 × 800) ───────────────────────────────────────────────

def hero_banner():
    print("Hero banner...")
    prompt = (
        "dark atmospheric night botanical garden, near-black background, "
        "dark leaves and stems emerging from shadows, ultra dark moody cinematic, "
        "luxury editorial high fashion backdrop, desaturated dark tones, "
        "minimal sparse botanicals, deep black background, no text, no people, "
        "professional photography, ambient dark lighting"
    )
    bg = fetch_bg_exact(prompt, 3200, 800, seed=17)
    bg = darken_and_tint(bg, darkness=0.45, warmth=0.10)
    bg = vignette(bg, strength=0.78)

    draw = ImageDraw.Draw(bg)

    # Fonts
    f_display = ImageFont.truetype(f"{FONTS}/Gloock-Regular.ttf", 300)
    f_mono    = ImageFont.truetype(f"{FONTS}/IBMPlexMono-Regular.ttf", 26)

    W, H = bg.size

    # Eyebrow
    eyebrow = "WILDROOT CULTIVARS  ·  MEMBERS ONLY"
    bb_ey = draw.textbbox((0,0), eyebrow, font=f_mono)
    draw.text(((W-(bb_ey[2]-bb_ey[0]))//2, 68), eyebrow, font=f_mono,
              fill=TAUPE, stroke_width=0)

    # Top/bottom rules
    top_bottom_rules(bg, pad=52)
    corner_marks(bg)

    # Main text — using bb[3] as effective placed height
    bb1 = draw.textbbox((0,0), "CULTIVATORS", font=f_display)
    bb2 = draw.textbbox((0,0), "CLUB",        font=f_display)

    gap     = 10
    h1      = bb1[3]   # effective height from draw-y
    h2      = bb2[3]
    total   = h1 + gap + h2
    top_y   = 105 + max(0, ((H - 105 - 65) - total) // 2)
    top_y   = min(top_y, H - 65 - total)
    club_y  = top_y + h1 + gap

    # Subtle glow behind text
    glow_layer = bg.copy().filter(ImageFilter.GaussianBlur(radius=40))
    glow_mask  = Image.new("L", bg.size, 0)
    gm_draw    = ImageDraw.Draw(glow_mask)
    gm_draw.rectangle([W//2 - 1700, top_y - 20, W//2 + 1700, club_y + h2 + 20], fill=60)
    glow_mask  = glow_mask.filter(ImageFilter.GaussianBlur(radius=60))
    bg.paste(glow_layer, mask=glow_mask)

    draw = ImageDraw.Draw(bg)

    # Draw text
    for text, y in [("CULTIVATORS", top_y), ("CLUB", club_y)]:
        bb   = draw.textbbox((0,0), text, font=f_display)
        tw   = bb[2] - bb[0]
        draw.text(((W-tw)//2, y), text, font=f_display, fill=CREAM)

    # Amber separator rule
    amber_rule(bg, top_y + h1 + gap//2, width_frac=0.16, opacity=0.55)

    bg.save(f"{OUT}/collection-the-cultivators-club.png", "PNG")
    print("  Saved hero banner.")

# ── SOCIAL POST helper ──────────────────────────────────────────────────────

def make_post(bg, elements):
    """
    elements = list of dicts:
      { type: 'text', text, font_path, size, fill, y, opacity=1.0 }
      { type: 'rule', y, width_frac, opacity }
      { type: 'box',  x0, y0, x1, y1, border_color, border_opacity }
      { type: 'mono', text, size, fill, y, opacity=1.0 }
    """
    W, H = bg.size
    draw = ImageDraw.Draw(bg)

    for el in elements:
        if el['type'] == 'text':
            font = ImageFont.truetype(el.get('font_path', f"{FONTS}/Gloock-Regular.ttf"), el['size'])
            bb   = draw.textbbox((0,0), el['text'], font=font)
            tw   = bb[2] - bb[0]
            x    = (W - tw) // 2
            alpha = int(el.get('opacity', 1.0) * 255)
            layer = Image.new("RGBA", bg.size, (0,0,0,0))
            ld    = ImageDraw.Draw(layer)
            ld.text((x, el['y']), el['text'], font=font, fill=el['fill']+(alpha,))
            bg.paste(Image.new("RGB", bg.size, el['fill']),
                     mask=layer.split()[3])

        elif el['type'] == 'rule':
            amber_rule(bg, el['y'], el.get('width_frac', 0.3), el.get('opacity', 0.55))

        elif el['type'] == 'box':
            blay = Image.new("RGB", bg.size, el['border_color'])
            bmsk = Image.new("L",   bg.size, 0)
            bd   = ImageDraw.Draw(bmsk)
            op   = int(el.get('border_opacity', 0.5) * 255)
            bd.rectangle([el['x0'], el['y0'], el['x1'], el['y1']], outline=op, width=1)
            bg.paste(blay, mask=bmsk)

        elif el['type'] == 'mono':
            font  = ImageFont.truetype(f"{FONTS}/IBMPlexMono-Regular.ttf", el['size'])
            bb    = draw.textbbox((0,0), el['text'], font=font)
            tw    = bb[2] - bb[0]
            x     = (W - tw) // 2
            alpha = int(el.get('opacity', 1.0) * 255)
            layer = Image.new("RGBA", bg.size, (0,0,0,0))
            ld    = ImageDraw.Draw(layer)
            ld.text((x, el['y']), el['text'], font=font, fill=el['fill']+(alpha,))
            bg.paste(Image.new("RGB", bg.size, el['fill']), mask=layer.split()[3])

    return bg

# ── POST 1: Archive Reveal ─────────────────────────────────────────────────

def post_1():
    print("Post 1 — Archive reveal...")
    prompt = (
        "dark classified document dossier aesthetic, near-black background, "
        "aged dark paper texture, faint botanical leaf ghost at low opacity, "
        "dramatic moody cinematic lighting, ultra dark luxury editorial, "
        "minimal dark tones, no text, no people, high fashion dark atmosphere"
    )
    bg = fetch_bg_exact(prompt, 1080, 1080, seed=7)
    bg = darken_and_tint(bg, darkness=0.40, warmth=0.12)
    bg = vignette(bg, strength=0.82)
    top_bottom_rules(bg, pad=48)
    corner_marks(bg, size=28, pad=34)

    W, H = 1080, 1080
    draw = ImageDraw.Draw(bg)

    f_disp  = ImageFont.truetype(f"{FONTS}/Gloock-Regular.ttf", 38)
    f_large = ImageFont.truetype(f"{FONTS}/Gloock-Regular.ttf", 128)
    f_mono  = ImageFont.truetype(f"{FONTS}/IBMPlexMono-Regular.ttf", 22)

    # Eyebrow
    ey = "THE CULTIVATORS CLUB"
    bb = draw.textbbox((0,0), ey, font=f_mono)
    draw.text(((W-(bb[2]-bb[0]))//2, 72), ey, font=f_mono, fill=TAUPE)

    # DROP 001
    d_text = "DROP 001"
    bb = draw.textbbox((0,0), d_text, font=f_large)
    draw.text(((W-(bb[2]-bb[0]))//2, 310), d_text, font=f_large, fill=CREAM)

    amber_rule(bg, 480, 0.22, 0.6)

    # THE ARCHIVE
    a_text = "THE ARCHIVE"
    bb = draw.textbbox((0,0), a_text, font=f_disp)
    draw.text(((W-(bb[2]-bb[0]))//2, 500), a_text, font=f_disp, fill=AMBER)

    # Body
    lines = ["Strictly limited. Now sealed.", "Once gone — permanently secured."]
    f_body = ImageFont.truetype(f"{FONTS}/IBMPlexMono-Regular.ttf", 24)
    y = 620
    for line in lines:
        bb = draw.textbbox((0,0), line, font=f_body)
        draw.text(((W-(bb[2]-bb[0]))//2, y), line, font=f_body, fill=TAUPE)
        y += 42

    # Archive stamp
    stamp = "VAULT SEALED"
    f_stamp = ImageFont.truetype(f"{FONTS}/IBMPlexMono-Regular.ttf", 19)
    bb = draw.textbbox((0,0), stamp, font=f_stamp)
    sw = bb[2]-bb[0]
    sx = (W-sw)//2
    # Draw border around stamp
    pad_s = 10
    stamp_layer = Image.new("RGB", bg.size, AMBER)
    stamp_mask  = Image.new("L",   bg.size, 0)
    sd = ImageDraw.Draw(stamp_mask)
    sd.rectangle([sx-pad_s, 870-pad_s, sx+sw+pad_s, 870+26+pad_s], outline=55, width=1)
    bg.paste(stamp_layer, mask=stamp_mask)
    draw = ImageDraw.Draw(bg)
    draw.text((sx, 870), stamp, font=f_stamp, fill=AMBER)

    amber_rule(bg, H-72, 0.20, 0.4)

    bg.save(f"{OUT}/cc-drop001-post-1.png", "PNG")
    print("  Saved post 1.")

# ── POST 2: SEALED / FOMO ──────────────────────────────────────────────────

def post_2():
    print("Post 2 — Sealed / FOMO...")
    prompt = (
        "dark luxury vault door texture close-up, near-black metallic surface, "
        "dramatic dramatic side lighting, ultra dark moody cinematic, "
        "dark steel and shadow, premium security aesthetic, no text, no people, "
        "abstract luxury dark background"
    )
    bg = fetch_bg_exact(prompt, 1080, 1080, seed=31)
    bg = darken_and_tint(bg, darkness=0.38, warmth=0.09)
    bg = vignette(bg, strength=0.85)
    top_bottom_rules(bg, pad=48)
    corner_marks(bg, size=28, pad=34)

    W, H = 1080, 1080
    draw = ImageDraw.Draw(bg)

    f_mono   = ImageFont.truetype(f"{FONTS}/IBMPlexMono-Regular.ttf", 22)
    f_huge   = ImageFont.truetype(f"{FONTS}/Gloock-Regular.ttf", 168)
    f_sub    = ImageFont.truetype(f"{FONTS}/Gloock-Regular.ttf", 52)
    f_italic = ImageFont.truetype(f"{FONTS}/CrimsonPro-Italic.ttf", 34)

    # Eyebrow
    ey = "DROP 001  ·  VAULT CLOSED"
    bb = draw.textbbox((0,0), ey, font=f_mono)
    draw.text(((W-(bb[2]-bb[0]))//2, 72), ey, font=f_mono, fill=TAUPE)

    # SECURED — monumental
    sec = "SECURED"
    bb  = draw.textbbox((0,0), sec, font=f_huge)
    draw.text(((W-(bb[2]-bb[0]))//2, 260), sec, font=f_huge, fill=CREAM)

    amber_rule(bg, 490, 0.28, 0.65)

    # BY THE FEW
    sub = "BY THE FEW"
    bb  = draw.textbbox((0,0), sub, font=f_sub)
    draw.text(((W-(bb[2]-bb[0]))//2, 508), sub, font=f_sub, fill=AMBER)

    # Body italic
    body = "Those who held clearance, know."
    bb   = draw.textbbox((0,0), body, font=f_italic)
    draw.text(((W-(bb[2]-bb[0]))//2, 680), body, font=f_italic, fill=TAUPE)

    # Concentric seal rings
    seal_layer = Image.new("RGB", bg.size, AMBER)
    seal_mask  = Image.new("L",   bg.size, 0)
    sd = ImageDraw.Draw(seal_mask)
    cx, cy = W//2, 830
    for r, op in [(55, 35), (44, 28), (33, 20)]:
        sd.ellipse([cx-r, cy-r, cx+r, cy+r], outline=op, width=1)
    bg.paste(seal_layer, mask=seal_mask)

    draw = ImageDraw.Draw(bg)
    f_seal = ImageFont.truetype(f"{FONTS}/IBMPlexMono-Regular.ttf", 16)
    seal_t = "D · 001"
    bb = draw.textbbox((0,0), seal_t, font=f_seal)
    draw.text(((W-(bb[2]-bb[0]))//2, 820), seal_t, font=f_seal, fill=AMBER)

    bg.save(f"{OUT}/cc-drop001-post-2.png", "PNG")
    print("  Saved post 2.")

# ── POST 3: Next Drop / Discord CTA ───────────────────────────────────────

def post_3():
    print("Post 3 — Next drop CTA...")
    prompt = (
        "emerging botanical bud unfurling from darkness, single plant emerging, "
        "near-black deep dark background, dramatic spotlight lighting on plant, "
        "luxury editorial botany photography, moody atmospheric dark, "
        "minimal composition, no text, no people, anticipation mystery"
    )
    bg = fetch_bg_exact(prompt, 1080, 1080, seed=53)
    bg = darken_and_tint(bg, darkness=0.42, warmth=0.10)
    bg = vignette(bg, strength=0.80)
    top_bottom_rules(bg, pad=48)
    corner_marks(bg, size=28, pad=34)

    W, H = 1080, 1080
    draw = ImageDraw.Draw(bg)

    f_mono  = ImageFont.truetype(f"{FONTS}/IBMPlexMono-Regular.ttf", 22)
    f_disp  = ImageFont.truetype(f"{FONTS}/Gloock-Regular.ttf", 82)
    f_disp2 = ImageFont.truetype(f"{FONTS}/Gloock-Regular.ttf", 118)
    f_body  = ImageFont.truetype(f"{FONTS}/IBMPlexMono-Regular.ttf", 24)

    # Eyebrow
    ey = "THE CULTIVATORS CLUB  ·  MEMBERS ONLY"
    bb = draw.textbbox((0,0), ey, font=f_mono)
    draw.text(((W-(bb[2]-bb[0]))//2, 72), ey, font=f_mono, fill=TAUPE)

    # THE NEXT DROP
    t1 = "THE NEXT DROP"
    bb = draw.textbbox((0,0), t1, font=f_disp)
    draw.text(((W-(bb[2]-bb[0]))//2, 290), t1, font=f_disp, fill=TAUPE)

    # IS COMING — large amber
    t2 = "IS COMING"
    bb = draw.textbbox((0,0), t2, font=f_disp2)
    draw.text(((W-(bb[2]-bb[0]))//2, 370), t2, font=f_disp2, fill=CREAM)

    amber_rule(bg, 520, 0.20, 0.6)

    # Discord CTA box
    cta_y0, cta_y1 = 560, 650
    cta_x0, cta_x1 = 160, W-160
    box_layer = Image.new("RGB", bg.size, AMBER)
    box_mask  = Image.new("L",   bg.size, 0)
    ImageDraw.Draw(box_mask).rectangle([cta_x0, cta_y0, cta_x1, cta_y1], outline=65, width=1)
    bg.paste(box_layer, mask=box_mask)

    draw = ImageDraw.Draw(bg)
    cta_text = "JOIN THE DISCORD"
    f_cta    = ImageFont.truetype(f"{FONTS}/IBMPlexMono-Regular.ttf", 30)
    bb       = draw.textbbox((0,0), cta_text, font=f_cta)
    draw.text(((W-(bb[2]-bb[0]))//2, cta_y0+(cta_y1-cta_y0-30)//2), cta_text, font=f_cta, fill=AMBER)

    # Discord URL
    url_text = "discord.gg/gRQnw6Twr3"
    bb = draw.textbbox((0,0), url_text, font=f_body)
    draw.text(((W-(bb[2]-bb[0]))//2, 675), url_text, font=f_body, fill=TAUPE)

    # Footer
    f_foot = ImageFont.truetype(f"{FONTS}/IBMPlexMono-Regular.ttf", 19)
    foot   = "ACCESS CODES DISTRIBUTED VIA DISCORD ONLY"
    bb     = draw.textbbox((0,0), foot, font=f_foot)
    draw.text(((W-(bb[2]-bb[0]))//2, H-80), foot, font=f_foot, fill=TAUPE)

    bg.save(f"{OUT}/cc-drop001-post-3.png", "PNG")
    print("  Saved post 3.")

# ── RUN ALL ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("Generating CC images with Pollinations + Pillow...")
    hero_banner()
    time.sleep(2)
    post_1()
    time.sleep(2)
    post_2()
    time.sleep(2)
    post_3()
    print("All done.")
