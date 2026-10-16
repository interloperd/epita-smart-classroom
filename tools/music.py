# Musique originale pour le film EPITA Smart Classroom — synthèse procédurale (libre de droits)
import numpy as np, wave
SR = 44100; DUR = 72.0; N = int(SR * DUR); t = np.arange(N) / SR
BPM = 100; beat = 60 / BPM; bar = 4 * beat
DURS = [6.5, 7, 8.5, 7, 6.5, 8, 7.5, 7, 7, 7]; STARTS = np.cumsum([0] + DURS[:-1])
def midi(m): return 440 * 2 ** ((m - 69) / 12)
# Am – F – C – G (racines en midi, octave 3)
PROG = [(57, [57, 60, 64, 69]), (53, [53, 57, 60, 65]), (48, [52, 55, 60, 64]), (55, [55, 59, 62, 67])]
L = np.zeros(N); R = np.zeros(N)
def env_adsr(n, a, d, s, r, sr=SR):
    e = np.ones(n) * s; ai, di, ri = int(a * sr), int(d * sr), int(r * sr)
    e[:ai] = np.linspace(0, 1, ai) if ai else e[:ai]; e[ai:ai + di] = np.linspace(1, s, len(e[ai:ai + di]))
    if ri: e[-ri:] *= np.linspace(1, 0, ri)
    return e
def lowpass(x, a):  # filtre un pôle
    y = np.empty_like(x); acc = 0.0
    for i in range(len(x)): acc += a * (x[i] - acc); y[i] = acc
    return y
def add(buf, start, sig):
    i = int(start * SR); j = min(len(buf), i + len(sig))
    if i < len(buf): buf[i:j] += sig[: j - i]
nb = int(DUR / bar) + 1
for b in range(nb):
    root, chord = PROG[b % 4]; t0 = b * bar
    n = int(bar * SR) + int(0.8 * SR); tt = np.arange(n) / SR
    # nappe (pad) : dents de scie douces désaccordées
    pad = np.zeros(n)
    for m in chord:
        f = midi(m + 12)
        for det in (-0.12, 0.12):
            ph = 2 * np.pi * f * (1 + det / 100) * tt
            pad += sum(np.sin(k * ph) / k for k in range(1, 6))
    pad *= env_adsr(n, 0.6, 0.4, 0.8, 0.8) * 0.018
    add(L, t0, pad * 1.0); add(R, t0, pad * 0.92)
    # basse : racine, une note par temps
    for k in range(4):
        m = int(beat * SR); tk = np.arange(m) / SR
        bass = np.sin(2 * np.pi * midi(root - 12) * tk) * np.exp(-tk * 3.2) * 0.16
        add(L, t0 + k * beat, bass); add(R, t0 + k * beat, bass)
    # arpège (après l'accroche)
    if t0 >= 6.0:
        seq = [chord[0], chord[1], chord[2], chord[3], chord[2], chord[1], chord[2], chord[3]]
        for k, m in enumerate(seq):
            mm = int(0.5 * SR); tk = np.arange(mm) / SR
            f = midi(m + 12)
            pl = (np.sin(2 * np.pi * f * tk) + 0.35 * np.sin(4 * np.pi * f * tk)) * np.exp(-tk * 7) * 0.055
            pan = 0.65 if k % 2 else 0.35
            add(L, t0 + k * beat / 2, pl * (1 - pan) * 2); add(R, t0 + k * beat / 2, pl * pan * 2)
    # rythmique légère : kick + charleston (du scan jusqu'à la confiance)
    if 13.0 <= t0 < 63.5:
        for k in range(4):
            m = int(0.3 * SR); tk = np.arange(m) / SR
            f = 45 + 75 * np.exp(-tk * 30)
            kick = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tk * 9) * 0.32
            add(L, t0 + k * beat, kick); add(R, t0 + k * beat, kick)
            hm = int(0.06 * SR); noise = np.random.default_rng(b * 10 + k).standard_normal(hm)
            hat = np.diff(np.concatenate([[0], noise])) * np.exp(-np.arange(hm) / SR * 60) * 0.028
            add(L, t0 + k * beat + beat / 2, hat * 0.8); add(R, t0 + k * beat + beat / 2, hat)
# souffles de transition avant chaque chapitre
rng = np.random.default_rng(3)
for s0 in STARTS[1:]:
    m = int(0.9 * SR); tk = np.arange(m) / SR
    w = lowpass(rng.standard_normal(m), 0.08) * (tk / 0.9) ** 2 * 0.22
    add(L, s0 - 0.9, w); add(R, s0 - 0.9, w * 0.9)
# accord final tenu
m = int(5 * SR); tk = np.arange(m) / SR
fin = sum(np.sin(2 * np.pi * midi(x + 12) * tk) for x in [57, 60, 64, 69, 72]) * np.exp(-tk * 0.6) * 0.03
add(L, 66.5, fin); add(R, 66.5, fin)
# écho simple (espace)
for buf in (L, R):
    d = int(0.36 * SR); buf[d:] += 0.22 * buf[:-d]
# fondus, limiteur doux, normalisation
fade = np.ones(N); fi, fo = int(1.2 * SR), int(3.0 * SR)
fade[:fi] = np.linspace(0, 1, fi); fade[-fo:] = np.linspace(1, 0, fo)
L *= fade; R *= fade
pk = max(np.abs(L).max(), np.abs(R).max()); L, R = np.tanh(1.4 * L / pk) / np.tanh(1.4) * 0.89, np.tanh(1.4 * R / pk) / np.tanh(1.4) * 0.89
st = np.empty(2 * N, dtype=np.int16); st[0::2] = (L * 32767).astype(np.int16); st[1::2] = (R * 32767).astype(np.int16)
with wave.open('music.wav', 'wb') as f: f.setnchannels(2); f.setsampwidth(2); f.setframerate(SR); f.writeframes(st.tobytes())
print('ok', DUR, 's')
