import type { ReactNode } from "react";
import { loadFont as loadCinzel } from "@remotion/google-fonts/Cinzel";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { AbsoluteFill, Easing, Img, Series, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

const { fontFamily: inter } = loadInter("normal", { weights: ["400", "600", "800"], subsets: ["latin"] });
const { fontFamily: cinzel } = loadCinzel("normal", { weights: ["700"], subsets: ["latin"] });

// The app's own tokens (app/(aw)/_lib/theme.css).
const c = {
  page: "#f7f7f9",
  ink: "#14181f",
  inkSoft: "#6b7280",
  maroon: "#8b1a1a",
  maroonDeep: "#4a0d0f",
  maroonBright: "#c0392b",
  blush: "#f8e7e5",
  brass: "#c9a84c",
  navy: "#0a0d12",
};

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

// Scene lengths in frames at 30 fps. The total is the composition's duration.
export const SCENES = { hook: 105, home: 240, bisnis: 180, peluang: 180, acara: 150, staff: 180, close: 135 };
export const TOTAL = Object.values(SCENES).reduce((a, b) => a + b, 0);

// Bouncy entrance, as in the app: rises into place and overshoots a little.
const Rise = ({ delay = 0, children }: { delay?: number; children: ReactNode }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = spring({ frame: frame - delay, fps, config: { damping: 13, stiffness: 120 } });
  return <div style={{ opacity: interpolate(t, [0, 0.4], [0, 1], clamp), translate: `0px ${(1 - t) * 60}px` }}>{children}</div>;
};

// Fades a scene out over its last frames, so the next one cuts in on a clean screen.
const Scene = ({ length, background, children }: { length: number; background: string; children: ReactNode }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background, fontFamily: inter, opacity: interpolate(frame, [length - 10, length], [1, 0], clamp) }}>
      {children}
    </AbsoluteFill>
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

const Caption = ({ title, sub }: { title: string; sub: string }) => (
  <div style={{ width: 820 }}>
    <Rise delay={6}>
      <div style={{ fontSize: 92, fontWeight: 800, color: c.ink, letterSpacing: "-0.035em", lineHeight: 1.04 }}>{title}</div>
    </Rise>
    <Rise delay={14}>
      <div style={{ fontSize: 36, color: c.inkSoft, lineHeight: 1.45, marginTop: 32 }}>{sub}</div>
    </Rise>
  </div>
);

// A full-page phone screenshot (780 px wide) scrolled inside a phone frame.
const PHONE_W = 440;
const PHONE_H = 952;
const Phone = ({ src, scrollTo, length }: { src: string; scrollTo: number; length: number }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 12, stiffness: 90 } });
  return (
    <div
      style={{
        width: PHONE_W + 28,
        height: PHONE_H + 28,
        padding: 14,
        borderRadius: 64,
        background: c.ink,
        boxShadow: "0 4px 10px rgb(74 13 15 / 0.12), 0 60px 110px -30px rgb(74 13 15 / 0.45)",
        translate: `0px ${(1 - enter) * 500}px`,
        rotate: `${(1 - enter) * 6}deg`,
      }}
    >
      <div style={{ width: PHONE_W, height: PHONE_H, borderRadius: 50, overflow: "hidden", background: "#fff" }}>
        <Img
          src={staticFile(src)}
          style={{
            width: PHONE_W,
            translate: interpolate(frame, [30, length - 20], ["0px 0px", `0px ${-scrollTo}px`], { ...clamp, easing: Easing.inOut(Easing.cubic) }),
          }}
        />
      </div>
    </div>
  );
};

const PhoneScene = ({ length, src, scrollTo, title, sub, phoneLeft }: { length: number; src: string; scrollTo: number; title: string; sub: string; phoneLeft?: boolean }) => (
  <Scene length={length} background={LIGHT}>
    <AbsoluteFill style={{ flexDirection: phoneLeft ? "row-reverse" : "row", alignItems: "center", justifyContent: "space-between", padding: "0 170px" }}>
      <Caption title={title} sub={sub} />
      <Phone src={src} scrollTo={scrollTo} length={length} />
    </AbsoluteFill>
  </Scene>
);

const Hook = () => (
  <Scene length={SCENES.hook} background={DARK}>
    <Grain />
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <Rise>
        <Wordmark size={120} />
      </Rise>
      <Rise delay={16}>
        <div style={{ fontSize: 44, color: "#fff", opacity: 0.85, marginTop: 64 }}>Direktori bisnis lulusan AsiaWorks.</div>
      </Rise>
    </AbsoluteFill>
  </Scene>
);

const Staff = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame: frame - 10, fps, config: { damping: 14, stiffness: 90 } });
  return (
    <Scene length={SCENES.staff} background={LIGHT}>
      <AbsoluteFill style={{ alignItems: "center", paddingTop: 70 }}>
        <Rise>
          <div style={{ fontSize: 68, fontWeight: 800, color: c.ink, letterSpacing: "-0.035em" }}>Setiap lulusan diverifikasi staf.</div>
        </Rise>
        {/* The staff console at desktop size, in a plain browser frame. */}
        <div
          style={{
            marginTop: 48,
            width: 1340,
            borderRadius: 22,
            overflow: "hidden",
            background: "#fff",
            boxShadow: "0 4px 10px rgb(74 13 15 / 0.1), 0 60px 110px -30px rgb(74 13 15 / 0.4)",
            translate: `0px ${(1 - enter) * 400}px`,
            scale: interpolate(frame, [30, SCENES.staff], [1, 1.04], clamp),
            transformOrigin: "top center",
          }}
        >
          <div style={{ height: 44, background: "#eef0f4", display: "flex", alignItems: "center", gap: 9, paddingLeft: 20 }}>
            <div style={{ width: 13, height: 13, borderRadius: 13, background: "#d7dae1" }} />
            <div style={{ width: 13, height: 13, borderRadius: 13, background: "#d7dae1" }} />
            <div style={{ width: 13, height: 13, borderRadius: 13, background: "#d7dae1" }} />
          </div>
          <Img src={staticFile("staff.png")} style={{ width: 1340, display: "block" }} />
        </div>
      </AbsoluteFill>
    </Scene>
  );
};

const Close = () => (
  <Scene length={SCENES.close + 10} background={DARK}>
    <Grain />
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <Rise>
        <Wordmark size={96} />
      </Rise>
      <Rise delay={14}>
        <div style={{ fontSize: 76, fontWeight: 800, color: "#fff", letterSpacing: "-0.035em", marginTop: 72 }}>Bisnis lulusan, di satu tempat.</div>
      </Rise>
      <Rise delay={24}>
        <div style={{ fontSize: 34, color: c.brass, marginTop: 28 }}>Temukan, terhubung, berkolaborasi.</div>
      </Rise>
    </AbsoluteFill>
  </Scene>
);

export const Showcase = () => (
  <AbsoluteFill style={{ background: c.navy }}>
    <Series>
      <Series.Sequence durationInFrames={SCENES.hook}>
        <Hook />
      </Series.Sequence>
      <Series.Sequence durationInFrames={SCENES.home}>
        <PhoneScene length={SCENES.home} src="home.png" scrollTo={2300} title="Cari bisnis sesama lulusan." sub="Lewat pencarian, peta, industri, atau kota. Semua di satu halaman." />
      </Series.Sequence>
      <Series.Sequence durationInFrames={SCENES.bisnis}>
        <PhoneScene length={SCENES.bisnis} src="bisnis.png" scrollTo={1300} title="Kenali bisnisnya, kenali orangnya." sub="Setiap bisnis punya halaman sendiri, lengkap dengan pemilik dan angkatannya." phoneLeft />
      </Series.Sequence>
      <Series.Sequence durationInFrames={SCENES.peluang}>
        <PhoneScene length={SCENES.peluang} src="peluang.png" scrollTo={1300} title="Butuh mitra? Pasang Peluang." sub="Supplier, mitra, atau karyawan. Lulusan lain tinggal menekan Saya berminat." />
      </Series.Sequence>
      <Series.Sequence durationInFrames={SCENES.acara}>
        <PhoneScene length={SCENES.acara} src="acara.png" scrollTo={1100} title="Bertemu langsung di Acara." sub="Lihat acara mendatang dan daftar hadir dengan sekali ketuk." phoneLeft />
      </Series.Sequence>
      <Series.Sequence durationInFrames={SCENES.staff}>
        <Staff />
      </Series.Sequence>
      <Series.Sequence durationInFrames={SCENES.close}>
        <Close />
      </Series.Sequence>
    </Series>
  </AbsoluteFill>
);
