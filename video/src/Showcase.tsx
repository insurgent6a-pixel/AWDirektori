import type { ReactNode } from "react";
import { loadFont as loadCinzel } from "@remotion/google-fonts/Cinzel";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { Audio } from "@remotion/media";
import { AbsoluteFill, Img, Sequence, Series, interpolate, random, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import taps from "./taps.json";

const { fontFamily: inter } = loadInter("normal", { weights: ["400", "600", "800"], subsets: ["latin"] });
const { fontFamily: cinzel } = loadCinzel("normal", { weights: ["700"], subsets: ["latin"] });

// The app's own tokens (app/(aw)/_lib/theme.css).
const c = {
  page: "#f7f7f9",
  ink: "#14181f",
  maroon: "#8b1a1a",
  maroonDeep: "#4a0d0f",
  maroonBright: "#c0392b",
  blush: "#f8e7e5",
  brass: "#c9a84c",
  green: "#2f6b4f",
  greenSoft: "#e7f1eb",
  navy: "#0a0d12",
};

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const BOUNCY = { damping: 9, stiffness: 160 }; // the app's Gojek-style overshoot, a little louder for a launch

// Scene lengths in frames at 30 fps. The music (make-audio.mjs) is 120 BPM, so 30 frames are two beats:
// the drop lands on the first feature (frame 180) and the last hit on the closing card (frame 1260).
export const SCENES = { hook: 90, fitur: 90, cari: 210, hubungkan: 270, partner: 120, peluang: 150, acara: 150, koneksi: 180, close: 150 };
export const TOTAL = Object.values(SCENES).reduce((a, b) => a + b, 0);

const Sfx = ({ src, at, volume = 0.5 }: { src: string; at: number; volume?: number }) => (
  <Sequence from={at} layout="none">
    <Audio src={staticFile(src)} volume={volume} />
  </Sequence>
);

// Rises into place and overshoots.
const Rise = ({ delay = 0, from = 60, children }: { delay?: number; from?: number; children: ReactNode }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = spring({ frame: frame - delay, fps, config: { damping: 12, stiffness: 140 } });
  return <div style={{ opacity: interpolate(t, [0, 0.4], [0, 1], clamp), translate: `0px ${(1 - t) * from}px` }}>{children}</div>;
};

// A headline that lands one word at a time, each word bouncing up from below.
const Words = ({ text, delay = 0, style }: { text: string; delay?: number; style: React.CSSProperties }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div style={style}>
      {text.split(" ").map((word, i) => {
        const t = spring({ frame: frame - delay - i * 3, fps, config: BOUNCY });
        return (
          <span key={i} style={{ display: "inline-block", marginRight: "0.24em", opacity: interpolate(t, [0, 0.3], [0, 1], clamp), translate: `0px ${(1 - t) * 0.6}em`, scale: interpolate(t, [0, 1], [0.6, 1]) }}>
            {word}
          </span>
        );
      })}
    </div>
  );
};

// Each scene comes in behind a maroon wipe and leaves under the next one, so cuts read as one motion.
const Scene = ({ length, background, first, children }: { length: number; background: string; first?: boolean; children: ReactNode }) => {
  const frame = useCurrentFrame();
  const out = interpolate(frame, [0, 10], [0, 105], { ...clamp, easing: (x) => 1 - (1 - x) ** 3 });
  const into = interpolate(frame, [length - 7, length], [-105, 0], { ...clamp, easing: (x) => x ** 2 });
  return (
    <AbsoluteFill style={{ background, fontFamily: inter, overflow: "hidden" }}>
      {children}
      {!first && <div style={{ position: "absolute", inset: -40, background: `linear-gradient(100deg, ${c.maroonDeep}, ${c.maroon} 60%, ${c.maroonBright})`, translate: `${out}% 0px`, transform: "skewX(-8deg)" }} />}
      <div style={{ position: "absolute", inset: -40, background: `linear-gradient(100deg, ${c.maroonDeep}, ${c.maroon} 60%, ${c.maroonBright})`, translate: `${into}% 0px`, transform: "skewX(-8deg)" }} />
      {!first && <Audio src={staticFile("whoosh.wav")} volume={0.35} />}
    </AbsoluteFill>
  );
};

const CONFETTI = [c.maroon, c.maroonBright, c.brass, c.green, "#ffffff", c.blush];
// A burst of confetti from one point, thrown up and falling back.
const Confetti = ({ at, x, y, count = 36, power = 1 }: { at: number; x: number; y: number; count?: number; power?: number }) => {
  const frame = useCurrentFrame();
  const t = (frame - at) / 30;
  if (t < 0 || t > 1.8) return null;
  return (
    <>
      {Array.from({ length: count }, (_, i) => {
        const angle = -Math.PI / 2 + (random(`a${at}${i}`) - 0.5) * 2.4;
        const speed = (700 + random(`s${at}${i}`) * 900) * power;
        const size = 12 + random(`z${at}${i}`) * 14;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x + Math.cos(angle) * speed * t,
              top: y + Math.sin(angle) * speed * t + 1400 * t * t,
              width: size,
              height: size * (i % 3 ? 0.45 : 1),
              borderRadius: i % 3 ? 2 : size,
              background: CONFETTI[i % CONFETTI.length],
              rotate: `${t * (300 + random(`r${at}${i}`) * 500)}deg`,
              opacity: interpolate(t, [1.1, 1.8], [1, 0], clamp),
            }}
          />
        );
      })}
    </>
  );
};

const Wordmark = ({ size }: { size: number }) => (
  <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "flex-end" }}>
    <div style={{ fontFamily: cinzel, fontSize: size, color: "#fff", letterSpacing: "0.12em", lineHeight: 1 }}>
      ASIA<span style={{ fontSize: size * 1.45, color: c.maroonBright, letterSpacing: 0 }}>W</span>ORKS
    </div>
    <div style={{ fontFamily: cinzel, fontSize: size * 0.3, color: c.brass, letterSpacing: "0.42em", marginTop: size * 0.12 }}>DIREKTORI</div>
  </div>
);

const DARK = `radial-gradient(900px 700px at 18% 20%, rgb(139 26 26 / 0.55), transparent 70%), radial-gradient(1100px 800px at 85% 90%, rgb(74 13 15 / 0.9), transparent 70%), ${c.navy}`;
const LIGHT = `radial-gradient(900px 700px at 100% 0%, ${c.blush}, transparent 70%), ${c.page}`;

const Grain = () => (
  <AbsoluteFill style={{ opacity: 0.12, mixBlendMode: "overlay" }}>
    <svg width="100%" height="100%">
      <filter id="grain">
        <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" stitchTiles="stitch" />
      </filter>
      <rect width="100%" height="100%" filter="url(#grain)" />
    </svg>
  </AbsoluteFill>
);

// ── The phone: real screens of the app, one after another, with a finger tapping what was really tapped ──

type Screen = { img: string; at: number; slide?: boolean }; // slide: comes in from below, like a scroll
type Tap = { on: keyof typeof taps; at: number }; // the spot comes from capture.mjs (src/taps.json)

const PHONE_W = 440;
const PHONE_H = 952;
const POINT = PHONE_W / 390; // the screens were captured 390 points wide

const Finger = ({ on, at }: Tap) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const arrive = spring({ frame: frame - (at - 16), fps, config: { damping: 16, stiffness: 140 } });
  const x = taps[on].x * POINT;
  const y = taps[on].y * POINT;
  return (
    <>
      <div
        style={{
          position: "absolute",
          left: x - 30,
          top: y - 30,
          width: 60,
          height: 60,
          borderRadius: 60,
          background: "rgb(20 24 31 / 0.28)",
          border: "3px solid rgb(255 255 255 / 0.9)",
          boxShadow: "0 6px 16px rgb(20 24 31 / 0.3)",
          opacity: interpolate(frame, [at - 16, at - 10, at + 4, at + 9], [0, 1, 1, 0], clamp),
          translate: `${(1 - arrive) * 70}px ${(1 - arrive) * 110}px`,
          scale: interpolate(frame, [at - 4, at, at + 5], [1, 0.72, 1], clamp),
        }}
      />
      <div
        style={{
          position: "absolute",
          left: x - 30,
          top: y - 30,
          width: 60,
          height: 60,
          borderRadius: 60,
          border: `4px solid ${c.maroon}`,
          opacity: interpolate(frame, [at, at + 14], [0.9, 0], clamp) * (frame >= at ? 1 : 0),
          scale: interpolate(frame, [at, at + 14], [0.7, 2.4], clamp),
        }}
      />
      <Sfx src="click.wav" at={at} volume={0.7} />
    </>
  );
};

const Phone = ({ screens, fingers, tilt }: { screens: Screen[]; fingers: Tap[]; tilt: number }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 10, stiffness: 80 } });
  // Every tap gives the phone a small push, as if pressed.
  const push = fingers.reduce((sum, f) => sum + interpolate(frame, [f.at - 2, f.at + 2, f.at + 14], [0, 1, 0], clamp), 0);
  return (
    <div style={{ perspective: 1800 }}>
      <div
        style={{
          width: PHONE_W + 28,
          height: PHONE_H + 28,
          padding: 14,
          borderRadius: 64,
          background: c.ink,
          boxShadow: "0 4px 10px rgb(74 13 15 / 0.12), 0 60px 110px -30px rgb(74 13 15 / 0.45)",
          translate: `0px ${(1 - enter) * 700 + Math.sin(frame / 22) * 6}px`,
          rotate: `${(1 - enter) * 12 * Math.sign(tilt)}deg`,
          scale: 1 - push * 0.025,
          transform: `rotateY(${tilt * (0.4 + 0.6 * (1 - enter)) + Math.sin(frame / 40) * 2}deg)`,
        }}
      >
        <div style={{ position: "relative", width: PHONE_W, height: PHONE_H, borderRadius: 50, overflow: "hidden", background: "#fff" }}>
          {screens.map((s) => (
            <Img
              key={s.img}
              src={staticFile(`${s.img}.png`)}
              style={{
                position: "absolute",
                inset: 0,
                width: PHONE_W,
                opacity: s.at === 0 ? 1 : interpolate(frame, [s.at, s.at + 5], [0, 1], clamp),
                translate: s.slide ? `0px ${interpolate(frame, [s.at, s.at + 10], [160, 0], clamp)}px` : undefined,
              }}
            />
          ))}
          {fingers.map((f) => (
            <Finger key={f.on} {...f} />
          ))}
        </div>
      </div>
    </div>
  );
};

// One point of a feature, ticked off at the moment the phone shows it.
const Point = ({ at, children }: { at: number; children: string }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tick = spring({ frame: frame - at - 4, fps, config: BOUNCY });
  return (
    <Rise delay={at} from={30}>
      <div style={{ display: "flex", alignItems: "center", gap: 22, marginTop: 26 }}>
        <div style={{ width: 46, height: 46, borderRadius: 46, background: c.greenSoft, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, scale: interpolate(tick, [0, 1], [0.3, 1]) }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c.green} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12.5l4.5 4.5L19 7.5" strokeDasharray="22" strokeDashoffset={interpolate(tick, [0, 1], [22, 0], clamp)} />
          </svg>
        </div>
        <div style={{ fontSize: 38, fontWeight: 600, color: c.ink }}>{children}</div>
      </div>
      <Sfx src="pop.wav" at={at} volume={0.35} />
    </Rise>
  );
};

// The moment something worked: a badge pops out beside the phone, with confetti and a ding.
type Win = { at: number; text: string };
const WinBadge = ({ at, text, phoneLeft }: Win & { phoneLeft?: boolean }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = spring({ frame: frame - at, fps, config: { damping: 8, stiffness: 170 } });
  const x = phoneLeft ? 520 : 1400;
  const y = 250;
  return (
    <>
      <Confetti at={at} x={x} y={y + 40} />
      <div
        style={{
          position: "absolute",
          left: x - 230,
          top: y,
          width: 460,
          display: "flex",
          justifyContent: "center",
          opacity: interpolate(t, [0, 0.2], [0, 1], clamp),
          scale: t,
          rotate: `${(phoneLeft ? -1 : 1) * interpolate(t, [0, 1], [20, 5])}deg`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "20px 32px", borderRadius: 60, background: c.green, color: "#fff", fontSize: 34, fontWeight: 800, boxShadow: "0 2px 6px rgb(47 107 79 / 0.3), 0 30px 50px -16px rgb(47 107 79 / 0.6)", whiteSpace: "nowrap" }}>
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
          {text}
        </div>
      </div>
      <Sfx src="ding.wav" at={at} volume={0.45} />
    </>
  );
};

const Feature = ({ length, name, title, points, screens, fingers, win, phoneLeft }: { length: number; name: string; title: string; points: [number, string][]; screens: Screen[]; fingers: Tap[]; win?: Win; phoneLeft?: boolean }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pill = spring({ frame: frame - 6, fps, config: BOUNCY });
  return (
    <Scene length={length} background={LIGHT}>
      {/* A soft disc behind the phone, growing slowly, so the scene never stands still. */}
      <div
        style={{
          position: "absolute",
          top: 90,
          [phoneLeft ? "left" : "right"]: 60,
          width: 900,
          height: 900,
          borderRadius: 900,
          background: `radial-gradient(closest-side, ${c.blush}, transparent)`,
          scale: interpolate(frame, [0, length], [0.9, 1.2]),
        }}
      />
      <AbsoluteFill style={{ flexDirection: phoneLeft ? "row-reverse" : "row", alignItems: "center", justifyContent: "space-between", padding: "0 180px" }}>
        <div style={{ width: 860 }}>
          <div style={{ display: "inline-block", padding: "12px 28px", borderRadius: 50, background: c.maroon, color: "#fff", fontSize: 30, fontWeight: 600, boxShadow: "0 1px 1px rgb(74 13 15 / 0.25), 0 10px 20px -8px rgb(139 26 26 / 0.5)", scale: pill, rotate: `${interpolate(pill, [0, 1], [-12, 0])}deg`, transformOrigin: "left center" }}>{name}</div>
          <Words text={title} delay={9} style={{ fontSize: 88, fontWeight: 800, color: c.ink, letterSpacing: "-0.035em", lineHeight: 1.05, margin: "30px 0 22px" }} />
          {points.map(([at, text]) => (
            <Point key={text} at={at}>
              {text}
            </Point>
          ))}
        </div>
        <Phone screens={screens} fingers={fingers} tilt={phoneLeft ? 10 : -10} />
      </AbsoluteFill>
      {win && <WinBadge {...win} phoneLeft={phoneLeft} />}
    </Scene>
  );
};

// ── Scenes ──

const Hook = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const mark = spring({ frame: frame - 4, fps, config: { damping: 11, stiffness: 90 } });
  return (
    <Scene length={SCENES.hook} background={DARK} first>
      <Grain />
      {/* Light sweeping slowly behind the logo: the suspense before the drop. */}
      <div style={{ position: "absolute", left: 460, top: 140, width: 1000, height: 800, borderRadius: 1000, background: "radial-gradient(closest-side, rgb(192 57 43 / 0.35), transparent)", scale: interpolate(frame, [0, SCENES.hook], [0.6, 1.4]), opacity: interpolate(frame, [0, 30], [0, 1], clamp) }} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={{ opacity: interpolate(mark, [0, 0.3], [0, 1], clamp), scale: interpolate(mark, [0, 1], [1.6, 1]), filter: `blur(${(1 - Math.min(1, mark)) * 16}px)` }}>
          <Wordmark size={120} />
        </div>
        <Words text="Direktori bisnis lulusan AsiaWorks." delay={30} style={{ fontSize: 46, color: "#fff", opacity: 0.88, marginTop: 64 }} />
      </AbsoluteFill>
    </Scene>
  );
};

const FITUR = ["Cari Bisnis", "Hubungkan", "Partner Kerja Sama", "Buka Peluang", "Cek Acara", "Koneksi"];
const Fitur = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <Scene length={SCENES.fitur} background={DARK}>
      <Grain />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <Words text="Satu tempat untuk semuanya." delay={6} style={{ fontSize: 88, fontWeight: 800, color: "#fff", letterSpacing: "-0.035em" }} />
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 22, width: 1300, marginTop: 60 }}>
          {FITUR.map((name, i) => {
            const at = 22 + i * 7;
            const t = spring({ frame: frame - at, fps, config: BOUNCY });
            return (
              <div key={name} style={{ padding: "20px 40px", borderRadius: 60, fontSize: 40, fontWeight: 600, color: "#fff", background: "rgb(255 255 255 / 0.09)", border: "2px solid rgb(255 255 255 / 0.22)", opacity: interpolate(t, [0, 0.2], [0, 1], clamp), scale: t, rotate: `${interpolate(t, [0, 1], [i % 2 ? 14 : -14, 0])}deg` }}>
                {name}
                <Sfx src="pop.wav" at={at} volume={0.4} />
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </Scene>
  );
};

const Close = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const url = spring({ frame: frame - 26, fps, config: { damping: 8, stiffness: 150 } });
  return (
    <Scene length={SCENES.close + 10} background={DARK}>
      <Grain />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", scale: interpolate(frame, [0, 6, 16], [1.08, 1.08, 1], clamp) }}>
        <Rise from={80}>
          <Wordmark size={96} />
        </Rise>
        <Words text="Temukan, terhubung, berkolaborasi." delay={12} style={{ fontSize: 72, fontWeight: 800, color: "#fff", letterSpacing: "-0.035em", marginTop: 64 }} />
        <div style={{ marginTop: 44, padding: "20px 48px", borderRadius: 60, background: "#fff", color: c.maroon, fontSize: 46, fontWeight: 800, boxShadow: "0 30px 60px -20px rgb(0 0 0 / 0.6)", scale: url, opacity: interpolate(url, [0, 0.2], [0, 1], clamp) }}>
          direktori.asiaworks.id
        </div>
      </AbsoluteFill>
      <Confetti at={26} x={960} y={760} count={70} power={1.25} />
      <Sfx src="ding.wav" at={26} volume={0.4} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "flex-end", paddingBottom: 60 }}>
        <Rise delay={50} from={20}>
          <div style={{ fontSize: 28, color: "#fff", opacity: 0.6 }}>made by omnisyncmedia</div>
        </Rise>
      </AbsoluteFill>
    </Scene>
  );
};

export const Showcase = () => (
  <AbsoluteFill style={{ background: c.navy }}>
    <Audio src={staticFile("music.wav")} volume={0.6} />
    <Series>
      <Series.Sequence durationInFrames={SCENES.hook}>
        <Hook />
      </Series.Sequence>
      <Series.Sequence durationInFrames={SCENES.fitur}>
        <Fitur />
      </Series.Sequence>
      <Series.Sequence durationInFrames={SCENES.cari}>
        <Feature
          length={SCENES.cari}
          name="Cari Bisnis"
          title="Cari bisnis sesama lulusan."
          points={[
            [14, "Nama, layanan, atau kota"],
            [90, "Saring wilayah dan kategori"],
            [168, "Lihat lokasinya di peta"],
          ]}
          screens={[
            { img: "cari-1-a", at: 0 },
            { img: "cari-2", at: 42 },
            { img: "cari-3-b", at: 86 },
            { img: "cari-4-a", at: 130, slide: true },
            { img: "cari-4-b", at: 164 },
          ]}
          fingers={[
            { on: "cari-1", at: 38 },
            { on: "cari-3", at: 82 },
            { on: "cari-4", at: 160 },
          ]}
        />
      </Series.Sequence>
      <Series.Sequence durationInFrames={SCENES.hubungkan}>
        <Feature
          phoneLeft
          length={SCENES.hubungkan}
          name="Hubungkan"
          title="Kenali orangnya, lalu sapa."
          points={[
            [40, "Halaman bisnis yang lengkap"],
            [100, "Profil lulusan terverifikasi"],
            [176, "Kirim pesan singkat"],
          ]}
          screens={[
            { img: "bisnis-1-a", at: 0 },
            { img: "bisnis-1-b", at: 36 },
            { img: "bisnis-2-a", at: 70, slide: true },
            { img: "bisnis-2-b", at: 98 },
            { img: "hub-1-a", at: 140 },
            { img: "hub-1-b", at: 164 },
            { img: "hub-2", at: 184 },
            { img: "hub-3-b", at: 220 },
          ]}
          fingers={[
            { on: "bisnis-1", at: 32 },
            { on: "bisnis-2", at: 94 },
            { on: "hub-1", at: 160 },
            { on: "hub-3", at: 216 },
          ]}
          win={{ at: 222, text: "Permintaan terkirim" }}
        />
      </Series.Sequence>
      <Series.Sequence durationInFrames={SCENES.partner}>
        <Feature
          length={SCENES.partner}
          name="Partner Kerja Sama"
          title="Ada yang cari mitra? Jawab."
          points={[
            [14, "Peluang dari sesama lulusan"],
            [56, "Satu ketuk: Saya berminat"],
          ]}
          screens={[
            { img: "peluang-1-a", at: 0 },
            { img: "peluang-1-b", at: 54 },
          ]}
          fingers={[{ on: "peluang-1", at: 50 }]}
        />
      </Series.Sequence>
      <Series.Sequence durationInFrames={SCENES.peluang}>
        <Feature
          phoneLeft
          length={SCENES.peluang}
          name="Buka Peluang"
          title="Butuh sesuatu? Pasang Peluang."
          points={[
            [14, "Supplier, mitra, atau karyawan"],
            [66, "Tulis kebutuhanmu"],
            [100, "Tayang setelah ditinjau staf"],
          ]}
          screens={[
            { img: "buka-1-a", at: 0 },
            { img: "buka-1-b", at: 40 },
            { img: "buka-2", at: 64 },
          ]}
          fingers={[{ on: "buka-1", at: 36 }]}
        />
      </Series.Sequence>
      <Series.Sequence durationInFrames={SCENES.acara}>
        <Feature
          length={SCENES.acara}
          name="Cek Acara"
          title="Bertemu langsung di Acara."
          points={[
            [14, "Meetup, workshop, gathering"],
            [64, "RSVP sekali ketuk"],
          ]}
          screens={[
            { img: "acara-1-a", at: 0 },
            { img: "acara-1-b", at: 62 },
          ]}
          fingers={[{ on: "acara-1", at: 58 }]}
          win={{ at: 70, text: "Kursimu aman" }}
        />
      </Series.Sequence>
      <Series.Sequence durationInFrames={SCENES.koneksi}>
        <Feature
          phoneLeft
          length={SCENES.koneksi}
          name="Koneksi"
          title="Semua koneksimu, satu tab."
          points={[
            [14, "Permintaan masuk dan terkirim"],
            [66, "Terima atau tolak"],
            [128, "Lanjut ngobrol di WhatsApp"],
          ]}
          screens={[
            { img: "koneksi-0", at: 0 },
            { img: "koneksi-1-a", at: 56, slide: true },
            { img: "koneksi-1-b", at: 100 },
          ]}
          fingers={[{ on: "koneksi-1", at: 96 }]}
          win={{ at: 104, text: "Kontak terbuka" }}
        />
      </Series.Sequence>
      <Series.Sequence durationInFrames={SCENES.close}>
        <Close />
      </Series.Sequence>
    </Series>
  </AbsoluteFill>
);
