#!/usr/bin/env python3
"""
Wallpaper-driven color system generator with scheme scoring.

What it does:
  1. Generate candidate accents from ALL scheme types
  2. Score each candidate against the wallpaper's characteristics
  3. Pick the best scoring combination
  4. Build the full color system from the winner

Scoring criteria:
  - Contrast against background (readability)
  - Harmony with wallpaper hues (coherence)
  - Aesthetic variety (not always the same scheme)
  - Saturation appropriateness for the mood
  - Hue temperature balance (warm bg benefits from cool accent and vice versa)
  - Distance from existing palette colors (uniqueness — accent stands out)
"""

import sys, os, math, colorsys, random, subprocess

OUT = os.path.expanduser("~/.config/ags/colors.scss")

# ─────────────────────────────────────────────────────────────
# MATH
# ─────────────────────────────────────────────────────────────
def vdist(a, b): return math.sqrt(sum((x-y)**2 for x,y in zip(a,b)))

def rgb_to_hls(r,g,b): return colorsys.rgb_to_hls(r/255,g/255,b/255)
def hls_to_hex(h,l,s):
    r,g,b = colorsys.hls_to_rgb(h%1.0, max(0,min(1,l)), max(0,min(1,s)))
    return "#{:02x}{:02x}{:02x}".format(int(r*255+.5),int(g*255+.5),int(b*255+.5))
def hex_to_hls(c):
    c=c.lstrip("#"); r,g,b=int(c[0:2],16),int(c[2:4],16),int(c[4:6],16)
    return rgb_to_hls(r,g,b)
def hex_to_rgb(c):
    c=c.lstrip("#"); return int(c[0:2],16),int(c[2:4],16),int(c[4:6],16)
def shift(h,deg): return (h+deg/360)%1.0
def hue_dist(a,b):
    d=abs(a-b)%1.0; return min(d,1-d)*360

# ─────────────────────────────────────────────────────────────
# WCAG
# ─────────────────────────────────────────────────────────────
def _lin(c):
    c/=255; return c/12.92 if c<=0.04045 else ((c+0.055)/1.055)**2.4
def luminance(h):
    r,g,b=hex_to_rgb(h)
    return 0.2126*_lin(r)+0.7152*_lin(g)+0.0722*_lin(b)
def contrast(a,b):
    l1,l2=luminance(a),luminance(b); lo,hi=min(l1,l2),max(l1,l2)
    return (hi+0.05)/(lo+0.05)
def push_contrast(hexc, against, target=4.5):
    h,l,s=hex_to_hls(hexc)
    step=0.015 if luminance(against)<0.5 else -0.015
    for _ in range(60):
        if contrast(hexc,against)>=target: return hexc
        l=max(0,min(1,l+step)); hexc=hls_to_hex(h,l,s)
    return hexc

# ─────────────────────────────────────────────────────────────
# SAMPLING + CLUSTERING
# ─────────────────────────────────────────────────────────────
def sample_pixels(path, n=3000):
    try:
        res=subprocess.run(
            ["ffmpeg","-i",path,"-vf","scale=80:80","-frames:v","1",
             "-f","rawvideo","-pix_fmt","rgb24","-loglevel","quiet","-"],
            capture_output=True, timeout=20)
        if res.returncode!=0 or not res.stdout: return None
        raw=res.stdout
        step=max(3,(len(raw)//(n*3))*3)
        return [[raw[i],raw[i+1],raw[i+2]] for i in range(0,len(raw)-2,step)][:n]
    except Exception as e:
        print(f"  ffmpeg: {e}"); return None

def kmeans(pixels, k=12, iters=20):
    random.seed(42)
    centers=random.sample(pixels,k)
    for _ in range(iters):
        clusters=[[] for _ in range(k)]
        for p in pixels:
            clusters[min(range(k),key=lambda i:vdist(p,centers[i]))].append(p)
        centers=[
            [sum(p[j] for p in cl)/len(cl) for j in range(3)] if cl else centers[i]
            for i,cl in enumerate(clusters)]
    return centers,clusters

def build_palette(centers,clusters):
    out=[]
    for i,(r,g,b) in enumerate(centers):
        h,l,s=rgb_to_hls(r,g,b)
        out.append({
            "hex":"#{:02x}{:02x}{:02x}".format(int(r+.5),int(g+.5),int(b+.5)),
            "h":h,"l":l,"s":s,"hue_deg":h*360,"size":len(clusters[i]),
            "vivid":s>0.28 and 0.15<l<0.85,
            "dark":l<0.22,"mid":0.22<=l<=0.78,"light":l>0.78,
        })
    return sorted(out,key=lambda c:c["size"],reverse=True)

def circular_mean_hue(colors):
    if not colors: return None
    total=sum(c["size"] for c in colors)
    if not total: return None
    sin_s=sum(math.sin(math.radians(c["hue_deg"]))*c["size"] for c in colors)
    cos_s=sum(math.cos(math.radians(c["hue_deg"]))*c["size"] for c in colors)
    return math.degrees(math.atan2(sin_s/total,cos_s/total))%360

def palette_temperature(palette):
    vivid=[c for c in palette if c["vivid"]]
    if not vivid: return "neutral"
    warm=sum(c["size"] for c in vivid if c["hue_deg"]<60 or c["hue_deg"]>310)
    cool=sum(c["size"] for c in vivid if 150<c["hue_deg"]<300)
    total=sum(c["size"] for c in vivid)
    if total==0: return "neutral"
    if warm/total>0.55: return "warm"
    if cool/total>0.55: return "cool"
    return "neutral"

def palette_mood(palette):
    avg_l=sum(c["l"]*c["size"] for c in palette)/sum(c["size"] for c in palette)
    avg_s=sum(c["s"]*c["size"] for c in palette)/sum(c["size"] for c in palette)
    has_vivid=any(c["vivid"] for c in palette)
    if avg_l<0.25 and avg_s<0.20: return "dark_moody"
    if avg_l<0.30 and has_vivid:  return "dark_vibrant"
    if avg_l>0.60:                return "light_airy"
    if avg_s<0.20:                return "muted_earthy"
    return "high_contrast"

# ─────────────────────────────────────────────────────────────
# SCHEME CANDIDATE GENERATION
# All 7 classical color wheel schemes: each produces accent hue candidates
# ─────────────────────────────────────────────────────────────
def generate_candidates(dom_hue_deg, palette):
    """
    Generate accent hue candidates from all scheme types.
    Returns list of (hue_deg, scheme_name, description)
    """
    if dom_hue_deg is None:
        # No dominant hue: generate a spread of options
        return [
            (168, "monochromatic", "teal — universal dark bg accent"),
            (280, "monochromatic", "violet — sophisticated neutralizer"),
            (45,  "monochromatic", "amber — warm focal point"),
            (320, "monochromatic", "rose — soft but present"),
        ]

    h = dom_hue_deg
    candidates = []

    # ── Complementary (1 candidate) ───────────────────────────
    # Opposite on the wheel: maximum contrast, bold
    candidates.append(((h+180)%360, "complementary",
        f"{h:.0f}° dom → {(h+180)%360:.0f}° complement"))

    # ── Analogous (2 candidates) ──────────────────────────────
    # Neighbors on the wheel: harmonious, cohesive
    # Pick the neighbor that's further from warm/cool center
    candidates.append(((h+30)%360,  "analogous",  f"+30° neighbor"))
    candidates.append(((h-30)%360,  "analogous",  f"-30° neighbor"))

    # ── Split Complementary (2 candidates) ───────────────────
    # 150° and 210° from dominant — softer than full complement
    candidates.append(((h+150)%360, "split_complementary", f"+150° split"))
    candidates.append(((h+210)%360, "split_complementary", f"+210° split"))

    # ── Triadic (2 candidates) ────────────────────────────────
    # 120° apart — vibrant, balanced
    candidates.append(((h+120)%360, "triadic", f"+120° triadic"))
    candidates.append(((h+240)%360, "triadic", f"+240° triadic"))

    # ── Tetradic / Square (3 candidates) ─────────────────────
    # 90° apart — rich, complex
    candidates.append(((h+90)%360,  "tetradic", f"+90° tetradic"))
    candidates.append(((h+180)%360, "tetradic", f"+180° tetradic"))
    candidates.append(((h+270)%360, "tetradic", f"+270° tetradic"))

    # ── Primary relationships ─────────────────────────────────
    # Anchor points that often work universally
    for ph, name in [(0,"red"),(60,"yellow"),(120,"green"),
                     (180,"cyan"),(240,"blue"),(300,"magenta")]:
        dist = hue_dist(h/360, ph/360)
        if dist > 25:  # don't pick something too close to dominant
            candidates.append((ph, "primary", f"primary {name}"))

    # ── Monochromatic variant ─────────────────────────────────
    # Same hue family, different lightness/saturation
    candidates.append((h, "monochromatic",
        f"same hue {h:.0f}° — saturation contrast"))

    return candidates

# ─────────────────────────────────────────────────────────────
# SCORING ENGINE
# Evaluates each candidate against the wallpaper's characteristics
# Higher score = better fit
# ─────────────────────────────────────────────────────────────
def score_candidate(accent_hue_deg, scheme_name, palette, bg_hex,
                    dom_hue_deg, temperature, mood):
    score = 0.0
    notes = []
    ah = accent_hue_deg / 360.0

    # Build a test accent to evaluate
    # Use mood-appropriate lightness
    s_map = {"dark_moody":0.68,"dark_vibrant":0.75,"muted_earthy":0.60,
             "high_contrast":0.65,"light_airy":0.55}
    l_map = {"dark_moody":0.58,"dark_vibrant":0.60,"muted_earthy":0.62,
             "high_contrast":0.58,"light_airy":0.45}
    test_s = s_map.get(mood, 0.65)
    test_l = l_map.get(mood, 0.58)
    test_accent = hls_to_hex(ah, test_l, test_s)
    test_accent = push_contrast(test_accent, bg_hex, 4.5)
    actual_contrast = contrast(test_accent, bg_hex)

    # ── 1. Contrast score (0-25) ─────────────────────────────
    # WCAG AA = 4.5, AAA = 7.0, reward higher contrast
    if actual_contrast >= 7.0:
        score += 25; notes.append("AAA contrast")
    elif actual_contrast >= 4.5:
        score += 18; notes.append("AA contrast")
    elif actual_contrast >= 3.0:
        score += 8; notes.append("low contrast")
    else:
        score -= 20; notes.append("FAIL contrast")

    # ── 2. Temperature balance (0-20) ────────────────────────
    # Warm wallpaper benefits from cool accent and vice versa
    # Neutral wallpaper is flexible
    accent_h_deg = ah * 360
    accent_is_warm = accent_h_deg < 60 or accent_h_deg > 310
    accent_is_cool = 150 < accent_h_deg < 300

    if temperature == "warm" and accent_is_cool:
        score += 20; notes.append("cool accent on warm bg ✓")
    elif temperature == "cool" and accent_is_warm:
        score += 20; notes.append("warm accent on cool bg ✓")
    elif temperature == "neutral":
        score += 12; notes.append("neutral — flexible")
    elif temperature == "warm" and accent_is_warm:
        # Warm-on-warm: analogous — can be beautiful but risky
        score += 8; notes.append("analogous warm (risky)")
    elif temperature == "cool" and accent_is_cool:
        score += 8; notes.append("analogous cool (risky)")

    # ── 3. Distance from dominant hue (0-20) ─────────────────
    # Accent should stand OUT from the dominant wallpaper color
    # Too close = gets lost. Too far = can clash unless well-executed
    if dom_hue_deg is not None:
        dist = hue_dist(accent_hue_deg/360, dom_hue_deg/360)
        if 120 <= dist <= 180:
            score += 20; notes.append(f"great separation ({dist:.0f}°)")
        elif 80 <= dist < 120:
            score += 15; notes.append(f"good separation ({dist:.0f}°)")
        elif 40 <= dist < 80:
            score += 8;  notes.append(f"moderate separation ({dist:.0f}°)")
        elif dist < 20:
            score += 2;  notes.append(f"too close to dominant ({dist:.0f}°)")
        else:
            score += 12; notes.append(f"distant ({dist:.0f}°)")

    # ── 4. Uniqueness vs full palette (0-15) ─────────────────
    # Accent should be noticeably different from ALL palette colors
    # so it reads as intentional
    vivid = [c for c in palette if c["vivid"]]
    if vivid:
        min_dist_to_palette = min(
            hue_dist(accent_hue_deg/360, c["hue_deg"]/360)
            for c in vivid)
        if min_dist_to_palette > 60:
            score += 15; notes.append("unique — not in palette")
        elif min_dist_to_palette > 30:
            score += 10; notes.append("mostly unique")
        elif min_dist_to_palette > 15:
            score += 5;  notes.append("close to palette color")
        else:
            score += 2;  notes.append("very close to palette")
    else:
        # No vivid colors — any vivid accent is unique
        score += 15; notes.append("unique — monochrome palette")

    # ── 5. Mood appropriateness (0-15) ───────────────────────
    ah_s, ah_l = test_s, test_l
    if mood == "dark_moody":
        # Jewel tones work best: not neon, not pastel
        if 0.55 <= ah_s <= 0.75 and 0.45 <= ah_l <= 0.65:
            score += 15; notes.append("jewel tone fits dark mood")
        else:
            score += 5
    elif mood == "dark_vibrant":
        # Go vivid: the wallpaper can handle it
        if ah_s >= 0.70:
            score += 15; notes.append("vivid fits vibrant mood")
        else:
            score += 7
    elif mood == "muted_earthy":
        # Medium saturation: fits the earthy character
        if 0.45 <= ah_s <= 0.65:
            score += 15; notes.append("medium sat fits earthy mood")
        else:
            score += 6
    elif mood == "high_contrast":
        # Clean, clear accent
        if 0.60 <= ah_s <= 0.80:
            score += 15; notes.append("clean accent fits contrast")
        else:
            score += 7
    else:
        score += 10

    # ── 6. Scheme variety bonus (0-5) ────────────────────────
    # Slight bias to reward less-common but valid schemes
    variety = {"complementary":3,"triadic":5,"tetradic":5,
               "split_complementary":4,"primary":2,
               "analogous":3,"monochromatic":1}
    score += variety.get(scheme_name, 2)

    # ── 7. Avoid muddy hues penalty ──────────────────────────
    # Yellow-green (80-100°) is notoriously hard to use well
    if 80 <= accent_hue_deg <= 110:
        score -= 8; notes.append("yellow-green penalty")

    # Brown range from saturation collapse
    ah_h, ah_l2, ah_s2 = hex_to_hls(test_accent)
    if ah_s2 < 0.30 and 0.25 <= ah_l2 <= 0.55:
        score -= 10; notes.append("muddy/brown penalty")

    return score, test_accent, notes

# ─────────────────────────────────────────────────────────────
# FULL COLOR SYSTEM BUILDER
# ─────────────────────────────────────────────────────────────
def make_backgrounds(palette, dom_hue_deg):
    darks=[c for c in palette if c["dark"]]
    if not darks: darks=sorted(palette,key=lambda c:c["l"])[:3]
    src=min(darks,key=lambda c:c["l"])
    bh,bl,bs=src["h"],src["l"],src["s"]
    bl=min(bl,0.10); bs=min(bs,0.15)
    bg_base=hls_to_hex(bh,bl,bs)
    bg_deep=hls_to_hex(bh,max(0,bl-0.04),bs*0.7)
    bg_card=hls_to_hex(bh,bl+0.08,min(bs*1.4,0.22))
    return bg_base,bg_deep,bg_card

def make_text(bg_hex, accent_hex, temperature):
    ah,al,as_=hex_to_hls(accent_hex)
    if temperature=="warm":
        th=shift(ah,20); ts=0.07
    elif temperature=="cool":
        th=shift(ah,-20); ts=0.06
    else:
        th=ah; ts=0.04
    text=hls_to_hex(th,0.92,ts)
    return push_contrast(text,bg_hex,12.0)

def make_warn(accent_hex,bg_hex,temperature):
    wh=(42 if temperature=="warm" else 48 if temperature=="cool" else 45)/360.0
    warn=hls_to_hex(wh,0.58,0.78)
    return push_contrast(warn,bg_hex,3.5)

def make_danger(accent_hex,bg_hex,temperature):
    dh=(4 if temperature=="warm" else 355 if temperature=="cool" else 0)/360.0
    danger=hls_to_hex(dh,0.58,0.72)
    return push_contrast(danger,bg_hex,3.5)

# ─────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────
def generate(wallpaper_path):
    print(f"\n[1/5] Sampling: {os.path.basename(wallpaper_path)}")
    pixels=sample_pixels(wallpaper_path)
    if not pixels:
        print("      ffmpeg failed — using fallback")
        pixels=[[15,15,18]]*200

    print(f"[2/5] Clustering {len(pixels)} pixels (k=12)…")
    centers,clusters=kmeans(pixels,k=12,iters=20)
    palette=build_palette(centers,clusters)

    vivid=[c for c in palette if c["vivid"]]
    dom_hue=circular_mean_hue(vivid)
    temperature=palette_temperature(palette)
    mood=palette_mood(palette)

    print(f"[3/5] Palette analysis:")
    print(f"      Dominant hue:  {f'{dom_hue:.1f}°' if dom_hue else 'none (monochromatic)'}")
    print(f"      Temperature:   {temperature}")
    print(f"      Mood:          {mood}")

    bg_base,bg_deep,bg_card=make_backgrounds(palette,dom_hue)

    print(f"[4/5] Scoring scheme candidates…")
    candidates=generate_candidates(dom_hue,palette)

    scored=[]
    for (hue_deg, scheme, desc) in candidates:
        score,test_accent,notes=score_candidate(
            hue_deg,scheme,palette,bg_base,dom_hue,temperature,mood)
        scored.append((score,hue_deg,scheme,desc,test_accent,notes))

    scored.sort(key=lambda x:x[0],reverse=True)

    # Print top 5 for transparency
    print(f"      Top candidates:")
    for rank,(score,hue_deg,scheme,desc,_,notes) in enumerate(scored[:5]):
        print(f"        #{rank+1} [{score:5.1f}] {scheme:<22} {hue_deg:5.1f}°  {desc}")

    # Winner
    _,win_hue,win_scheme,win_desc,accent,win_notes=scored[0]
    print(f"\n      Winner: {win_scheme} at {win_hue:.1f}°")
    print(f"      Reason: {', '.join(win_notes[:3])}")

    # Build full system from winner
    ah,al,as_=hex_to_hls(accent)
    accent_subtle=hls_to_hex(ah,al*0.38,as_*0.40)

    text=make_text(bg_base,accent,temperature)
    th,tl,ts=hex_to_hls(text)
    text_dim=push_contrast(hls_to_hex(th,tl*0.75,ts*1.5),bg_base,4.5)
    text_faint=push_contrast(hls_to_hex(th,tl*0.55,ts*2.0),bg_base,3.0)

    warn=make_warn(accent,bg_base,temperature)
    danger=make_danger(accent,bg_base,temperature)

    colors={
        "$accent":        accent,
        "$accent-subtle": accent_subtle,
        "$text":          text,
        "$text-dim":      text_dim,
        "$text-faint":    text_faint,
        "$warn":          warn,
        "$danger":        danger,
        "$bg-base":       bg_base,
        "$bg-deep":       bg_deep,
        "$bg-card":       bg_card,
    }

    print(f"\n[5/5] Final color system:")
    for name,value in colors.items():
        if "bg" not in name:
            cr=contrast(value,bg_base)
            flag="✓" if cr>=4.5 else "△" if cr>=3.0 else "✗"
            print(f"      {name:<18} {value}  {cr:.2f}:1 {flag}")
        else:
            print(f"      {name:<18} {value}")

    lines=[f"{n}:{' '*max(1,16-len(n))}{v};" for n,v in colors.items()]
    with open(OUT,"w") as f: f.write("\n".join(lines)+"\n")
    print(f"\n      → {OUT}")

def get_wallpaper():
    try:
        out=subprocess.check_output(["swww","query"],text=True)
        for line in out.splitlines():
            if "image:" in line:
                p=line.split("image:")[-1].strip()
                if os.path.isfile(p): return p
    except: pass
    return None

if __name__=="__main__":
    wp=sys.argv[1] if len(sys.argv)>1 else get_wallpaper()
    if not wp: print("No wallpaper found."); sys.exit(1)
    generate(wp)
