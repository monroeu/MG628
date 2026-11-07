#!/usr/bin/env python3
"""Build an MG628 week lab from a slide deck, a narration recording and a content file.

    python lab-engine/build_lab.py --content week10/content.json --deck deck.pptx --audio narration.wav --week "Week 10"

Writes into the content file's folder (for example week10/):
  frames/*.webp, narration.mp4, data.js, lab.sql, alignment_report.txt,
  and, if they don't exist yet, index.html and lab-config.js.

Requirements: Python 3.9+, pip install lxml numpy pillow; LibreOffice (soffice), ffmpeg, pdftoppm (poppler).
The deck must mark click animations by shape name: shapes named a1_..., a2_..., appear on click 1, 2, ...
(decks built for MG628 use this convention). See TEMPLATE.md.
"""
import argparse, json, os, re, shutil, subprocess, sys, tempfile, zipfile
import numpy as np
from lxml import etree
from PIL import Image

NS = {'p': 'http://schemas.openxmlformats.org/presentationml/2006/main'}
LEAD, TAIL = 0.35, 0.6          # seconds of silence added before and after each slide's narration
SILENCE_DB, MIN_PAUSE = -45, 0.15

def run(cmd, **kw):
    subprocess.run(cmd, check=True, **kw)

def slide_order(z):
    pres = z.read('ppt/presentation.xml').decode(); rels = z.read('ppt/_rels/presentation.xml.rels').decode()
    rid = dict(re.findall(r'Id="(rId\d+)"[^>]*Target="([^"]+)"', rels))
    return ['ppt/' + rid[r] for r in re.findall(r'<p:sldId [^>]*r:id="(rId\d+)"', pres)]

def click_counts(deck):
    z = zipfile.ZipFile(deck); out = []
    for path in slide_order(z):
        t = etree.fromstring(z.read(path)); mx = 0
        for c in t.xpath('//p:cNvPr', namespaces=NS):
            m = re.match(r'a(\d+)', c.get('name', ''))
            if m: mx = max(mx, int(m.group(1)))
        out.append(mx)
    return out

def soffice():
    for c in ('soffice', 'libreoffice', '/Applications/LibreOffice.app/Contents/MacOS/soffice', r'C:\Program Files\LibreOffice\program\soffice.exe'):
        if shutil.which(c) or os.path.exists(c): return shutil.which(c) or c
    sys.exit('LibreOffice not found. Install it or add soffice to PATH.')

def render_frames(deck, clicks, outdir, tmp):
    """For each build step k, render the deck with groups > k removed, then keep the pages each slide needs."""
    z = zipfile.ZipFile(deck); order = slide_order(z); maxk = max(clicks)
    os.makedirs(outdir, exist_ok=True)
    for f in os.listdir(outdir):
        if f.endswith('.webp'): os.remove(os.path.join(outdir, f))
    for k in range(maxk + 1):
        vp = os.path.join(tmp, f'v{k}.pptx')
        with zipfile.ZipFile(vp, 'w', zipfile.ZIP_DEFLATED) as zo:
            for n in z.namelist():
                if n.endswith('/'): continue
                b = z.read(n)
                if n in order:
                    t = etree.fromstring(b)
                    for el in t.xpath('//p:spTree/*[.//p:cNvPr]', namespaces=NS):
                        c = el.xpath('./*[1]/p:cNvPr', namespaces=NS)
                        m = re.match(r'a(\d+)', c[0].get('name', '')) if c else None
                        if m and int(m.group(1)) > k: el.getparent().remove(el)
                    for tm in t.xpath('//p:timing|//p:transition', namespaces=NS): tm.getparent().remove(tm)
                    b = etree.tostring(t, xml_declaration=True, encoding='UTF-8', standalone=True)
                zo.writestr(n, b)
        print(f'  rendering build step {k} of {maxk}…', flush=True)
        run([soffice(), '--headless', '--convert-to', 'pdf', '--outdir', tmp, vp], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for i, c in enumerate(clicks, 1):
        for k in range(c + 1):
            png = os.path.join(tmp, 'frame')
            run(['pdftoppm', '-png', '-scale-to-x', '960', '-scale-to-y', '540', '-f', str(i), '-l', str(i), '-singlefile', os.path.join(tmp, f'v{k}.pdf'), png])
            Image.open(png + '.png').convert('RGB').save(os.path.join(outdir, f's{i:02d}_{k}.webp'), 'WEBP', quality=62, method=6)
    return {str(i): c + 1 for i, c in enumerate(clicks, 1)}

def sentences(segments):
    out = []
    for n in sorted(segments, key=int):
        for k, seg in enumerate(segments[n]):
            for p in re.split(r'(?<=[.?!])["”]?\s+(?=["“]?[A-Z0-9])', seg):
                if p.strip(): out.append((int(n), k, p.strip()))
    return out

def weight(s):
    s2 = re.sub(r'\d', ' xxxx', s); s2 = re.sub(r'(?<=x)\.(?=\s?x)', ' point ', s2); return len(s2)

def align(wav, sents, tmp):
    """Match each script sentence to the recording, using pauses as candidate boundaries (dynamic programming)."""
    raw = os.path.join(tmp, 'a.raw')
    run(['ffmpeg', '-v', 'error', '-y', '-i', wav, '-ac', '1', '-ar', '16000', '-f', 's16le', raw])
    x = np.fromfile(raw, dtype=np.int16).astype(np.float32) / 32768
    hop = 160; n = len(x) // hop
    db = 20 * np.log10(np.sqrt((x[:n * hop].reshape(n, hop) ** 2).mean(1) + 1e-12))
    sil = db < SILENCE_DB; runs = []; i = 0
    while i < n:
        if sil[i]:
            j = i
            while j < n and sil[j]: j += 1
            runs.append((i / 100, (j - i) / 100)); i = j
        else: i += 1
    sp = np.where(~sil)[0]; t0, t1 = sp[0] / 100, sp[-1] / 100
    P = [(s, d) for s, d in runs if d >= MIN_PAUSE and s > t0 and s + d < t1]
    Ps = np.array([t0] + [s for s, d in P] + [t1]); Pe = np.array([t0] + [s + d for s, d in P] + [t1]); L = Pe - Ps
    W = np.array([weight(s[2]) for s in sents], float); J = len(Ps); M = len(W)
    if J - 2 < M - 1: sys.exit(f'Found only {J-2} pauses for {M} sentences; check that the recording matches the script.')
    rate = (t1 - t0 - np.sort(L[1:-1])[::-1][:M - 1].sum()) / W.sum()
    pen = np.maximum(L - 0.42, 0) * 12; pen[0] = pen[-1] = 0; cpen = np.concatenate([[0], np.cumsum(pen)])
    bonus = -np.minimum(L, 1.1) * 4; bonus[0] = bonus[-1] = 0
    INF = 1e18; cost = np.full(J, INF); cost[0] = 0; back = np.zeros((M, J), int); jj = np.arange(J)
    for k in range(M):
        new = np.full(J, INF); arg = np.zeros(J, int); exp = W[k] * rate
        for d in range(1, 80):
            jp = jj - d; ok = jp >= 0; jpc = np.where(ok, jp, 0)
            span = Ps - Pe[jpc]
            c = cost[jpc] + np.where(span > 0.2, 25 * np.log(np.maximum(span, 0.2) / exp) ** 2, INF) + np.where(ok, cpen[jj] - cpen[jpc + 1], 0)
            c = np.where(ok, c, INF); better = c < new; new = np.where(better, c, new); arg = np.where(better, jpc, arg)
        if k < M - 1: new = new + bonus
        else: new[:-1] = INF
        cost = new; back[k] = arg
    path = [J - 1]; j = J - 1
    for k in range(M - 1, -1, -1): j = back[k][j]; path.append(j)
    path = path[::-1]
    starts = [float(Pe[path[k]]) for k in range(M)]; ends = [float(Ps[path[k + 1]]) for k in range(M)]
    ratio = [(ends[k] - starts[k]) / (W[k] * rate) for k in range(M)]
    return starts, ends, ratio

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--content', required=True); ap.add_argument('--deck', required=True); ap.add_argument('--audio', required=True)
    ap.add_argument('--skip-frames', action='store_true', help='reuse frames already in the lab folder')
    ap.add_argument('--week', default='', help='label shown on the page, e.g. "Week 10"')
    a = ap.parse_args()
    C = json.load(open(a.content, encoding='utf-8')); lab = C['id']; out = os.path.dirname(os.path.abspath(a.content))
    seg = C['segments']; mods = C['modules']
    if not re.fullmatch(r'[a-z0-9-]+', lab): sys.exit('Lab id must use lowercase letters, digits and hyphens.')
    clicks = click_counts(a.deck); ns = len(clicks)
    print(f'Lab "{lab}": {ns} slides, {sum(clicks)} clicks, {len(mods)} modules')
    problems = []
    if sorted(int(k) for k in seg) != list(range(1, ns + 1)): problems.append('segments must have one entry for every slide, 1 to %d' % ns)
    for n, c in enumerate(clicks, 1):
        if str(n) in seg and len(seg[str(n)]) != c + 1: problems.append(f'slide {n}: deck has {c} clicks, so it needs {c+1} narration segments (has {len(seg[str(n)])})')
    covered = sorted(s for m in mods for s in m['slides'])
    if covered != list(range(1, ns + 1)): problems.append('every slide must belong to exactly one module')
    for m in mods:
        cp = m.get('checkpoint')
        if cp and cp['slide'] not in m['slides']: problems.append(f"{m['id']}: checkpoint slide {cp['slide']} is not in the module")
        if len(m.get('quiz', [])) + len(m.get('generators', [])) < 5: problems.append(f"{m['id']}: needs at least 5 graded questions (quiz + generators)")
    if problems: sys.exit('Fix these first:\n  - ' + '\n  - '.join(problems))

    with tempfile.TemporaryDirectory() as tmp:
        frames = os.path.join(out, 'frames')
        if a.skip_frames:
            FRN = {str(i): c + 1 for i, c in enumerate(clicks, 1)}
        else:
            print('Rendering slide-build frames…'); FRN = render_frames(a.deck, clicks, frames, tmp)

        print('Aligning narration to the script…')
        sents = sentences(seg); starts, ends, ratio = align(a.audio, sents, tmp)
        r = np.array(ratio)
        report = [f'Sentences: {len(sents)}', 'Speech-rate ratio percentiles (1, 5, 50, 95, 99): ' + ', '.join(f'{v:.2f}' for v in np.percentile(r, [1, 5, 50, 95, 99])),
                  'Ratios well outside 0.7–1.4 next to each other usually mean a boundary landed on the wrong pause:']
        for k in range(len(r) - 1):
            if (r[k] > 1.35 and r[k + 1] < 0.75) or (r[k] < 0.75 and r[k + 1] > 1.35):
                report.append(f'  slide {sents[k][0]}: "{sents[k][2][-40:]}" | "{sents[k+1][2][:40]}"')
        open(os.path.join(out, 'alignment_report.txt'), 'w').write('\n'.join(report) + '\n'); print('  ' + report[1])

        print('Cutting and encoding narration…')
        clips = []; TM = {}; off = 0.0
        for n in range(1, ns + 1):
            idx = [i for i, s in enumerate(sents) if s[0] == n]
            cut_a = starts[idx[0]] - 0.08; cut_b = ends[idx[-1]] + 0.12
            cues = {}
            for i in idx:
                k = sents[i][1]
                if k >= 1 and k not in cues: cues[k] = round(starts[i] - cut_a + LEAD - 0.12, 3)
            clip = os.path.join(tmp, f'c{n:02d}.m4a')
            run(['ffmpeg', '-v', 'error', '-y', '-ss', f'{cut_a:.3f}', '-to', f'{cut_b:.3f}', '-i', a.audio, '-af', f'adelay={int(LEAD*1000)},apad=pad_dur={TAIL}', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', clip])
            dur = float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', clip]).decode())
            TM[str(n)] = {'start': round(off, 3), 'dur': round(dur, 3), 'cues': [cues[k] for k in sorted(cues)]}; off += dur; clips.append(clip)
            if len(cues) != clicks[n - 1]: sys.exit(f'slide {n}: found {len(cues)} cue points for {clicks[n-1]} clicks; check the script for this slide.')
        lst = os.path.join(tmp, 'list.txt'); open(lst, 'w').write(''.join(f"file '{c}'\n" for c in clips))
        run(['ffmpeg', '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', lst, '-ac', '1', '-ar', '24000', '-c:a', 'aac', '-b:a', '40k', '-movflags', '+faststart', os.path.join(out, 'narration.mp4')])

    print('Writing data.js and lab.sql…')
    Cjs = [{k: m[k] for k in ('id', 'title', 'blurb', 'slides', 'concepts', 'cards', 'kc')} for m in mods]
    CP = {m['id']: m['checkpoint'] for m in mods if m.get('checkpoint')}
    with open(os.path.join(out, 'data.js'), 'w', encoding='utf-8') as f:
        f.write(f'// {C["title"]} lab. Generated by lab-engine/build_lab.py; edit content.json and rebuild instead of editing this file.\n')
        for name, val in (('C', Cjs), ('TM', TM), ('SEG', seg), ('CP', CP), ('FRN', FRN)):
            f.write(f'const {name}={json.dumps(val, ensure_ascii=False)};\n')
    q = lambda s: s.replace("'", "''")
    sql = [f'-- {C["title"]} lab: slides and graded questions. Generated by lab-engine/build_lab.py.', '-- Run after supabase/schema.sql. Safe to re-run: it replaces this lab\'s content.', '',
           f"delete from public.mg628_lab_slides where lab = '{lab}';", 'insert into public.mg628_lab_slides (lab, slide, module, dur) values']
    mod_of = {s: m['id'] for m in mods for s in m['slides']}
    sql.append(',\n'.join(f"  ('{lab}',{n},'{mod_of[n]}',{TM[str(n)]['dur']})" for n in range(1, ns + 1)) + ';')
    rows = []
    for m in mods:
        for qq in m.get('quiz', []):
            body = json.dumps({k: qq[k] for k in ('stem', 'opts', 'ans', 'why')}, ensure_ascii=False)
            rows.append(f"  ('{lab}','{q(qq['id'])}','{m['id']}','static',$q${body}$q$::jsonb)")
        for g in m.get('generators', []):
            rows.append(f"  ('{lab}','{q(g)}','{m['id']}','gen',$q${json.dumps({'gen': g})}$q$::jsonb)")
    sql += ['', f"delete from public.mg628_lab_questions where lab = '{lab}';", 'insert into public.mg628_lab_questions (lab, id, module, kind, body) values', ',\n'.join(rows) + ';']
    open(os.path.join(out, 'lab.sql'), 'w', encoding='utf-8').write('\n'.join(sql) + '\n')
    here = os.path.dirname(os.path.abspath(__file__)); folder = os.path.basename(out)
    if not os.path.exists(os.path.join(out, 'index.html')):
        tpl = open(os.path.join(here, 'week-template.html'), encoding='utf-8').read()
        open(os.path.join(out, 'index.html'), 'w', encoding='utf-8').write(tpl.replace('{{TITLE}}', (a.week + ': ' if a.week else '') + C['title']))
    if not os.path.exists(os.path.join(out, 'lab-config.js')):
        cfg = open(os.path.join(here, 'lab-config-template.js'), encoding='utf-8').read()
        open(os.path.join(out, 'lab-config.js'), 'w', encoding='utf-8').write(cfg.replace('{{ID}}', lab).replace('{{WEEK}}', a.week).replace('{{TITLE}}', C['title'].replace('"', '\\"')))
    print(f'Done. Narration {off/60:.1f} min. Next: run {folder}/lab.sql in Supabase, then commit {folder}/ to the MG628 repository.')

if __name__ == '__main__':
    main()
