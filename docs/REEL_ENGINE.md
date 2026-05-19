# Life Reel — Engine Upgrade

---

## What was wrong with the previous version

| Issue | Previous | Now |
|-------|----------|-----|
| Ken Burns | 5 fixed CSS patterns, same every time | 8 GSAP patterns, randomised per slide |
| Transition | Flat Framer Motion opacity | Blur-dissolve (10px blur unsharpens as slide fades in) |
| Text entrance | Block opacity + translateY | Character-by-character stagger at 38ms per char |
| Film grain | None | 24fps canvas noise overlay, `mixBlendMode: overlay` |
| Cinematic bars | None | Toggle letterbox bars |
| Fullscreen | None | `requestFullscreen` API |
| Music | None | Web Audio API, loop with fade |
| Timeline | Basic dots | Scrubber with year range labels |
| Control | None | Grain/letterbox/fullscreen/music toggles |

---

## One package to install

```bash
npm install gsap
```

GSAP (GreenSock Animation Platform) is free for commercial use.
No additional license needed unless you use Club plugins (SplitText, MorphSVG etc.)
which we don't use here.

Three.js (`@react-three/fiber`, `three`) is **already installed** in your project
and available if you ever want WebGL shader transitions (lens distortion, film burn, etc.)

---

## Usage

### Basic (no music)
```jsx
<LifeReel photos={memorial.photos} memorial={memorial} />
```

### With ambient music
```jsx
<LifeReel
  photos={memorial.photos}
  memorial={memorial}
  musicUrl="https://your-cdn.com/ambient-memorial.mp3"
/>
```

The music toggle button only appears in the UI when `musicUrl` is provided.
Volume is set to 0.18 (quiet, background) and loops.

### Photo object shape
Each photo object can have:
```js
{
  url:     string,       // required — Cloudinary or any image URL
  takenAt: number,       // Unix seconds — from social media import (shows date badge)
  date:    string|Date,  // alternative date format
  caption: string,       // from social media caption (shown top-right)
  createdAt: number,     // fallback date (milliseconds)
}
```

---

## How the GSAP Ken Burns works

8 distinct movement recipes are defined in `KB_MOVES`. Each slide gets a recipe
based on its index (`moveIdx % 8`), so the movements cycle but never look the same
for photos close together in a memorial with 8+ photos.

Each recipe defines:
- `xs/ys` — starting X/Y position (`gsap.set` — applied instantly)
- `xe/ye` — ending X/Y position (animated over slide duration)
- `ss/se` — starting/ending scale

The total duration is `SLIDE_DURATION + FADE_DURATION` (7.4 seconds by default)
so the Ken Burns continues smoothly through the crossfade.

`force3D: true` tells GSAP to use `matrix3d` transforms which the browser compositor
handles on the GPU — no main thread involvement, no jank.

`willChange: 'transform'` on the img element pre-promotes it to its own compositor layer.

---

## How the blur dissolve works

The incoming slide has:
```jsx
initial={{ opacity: 0, filter: 'blur(10px)' }}
animate={{ opacity: 1, filter: 'blur(0px)'  }}
```

As the slide fades in, it simultaneously unblurs. The human eye interprets this
as a "focus pull" — the same effect used in cinema when changing focus depth.
Combined with the GSAP Ken Burns starting simultaneously, it creates the illusion
that the camera is moving INTO the new image.

CSS `filter: blur()` is GPU-accelerated on all modern browsers.

---

## How film grain works

A `<canvas>` is positioned `absolute inset-0` over the reel with `mixBlendMode: overlay`.
At 24fps, random pixel noise is drawn using `ctx.fillRect`. Only ~40% of pixels
are drawn on each frame (sparse grain) which gives the authentic look without
visual busyness.

The blend mode `overlay` means bright grain lightens the image, dark grain darkens it —
exactly how real film grain works. At `opacity: 0.045` it's subtle but clearly visible.

---

## Ambient music

The Web Audio API (native, no package) is used via a simple wrapper:
```js
const audio = new Audio(src)
audio.loop   = true
audio.volume = 0.18  // quiet background level
audio.play()
```

Good ambient audio sources for memorial reels:
- Royalty-free: Pixabay.com (search "memorial ambient")
- Free: YouTube Audio Library → filter by "Cinematic", "Peaceful"
- Premium: Musicbed, Artlist

The ideal track: piano or strings, slow tempo, no vocals, 2–3 minutes.

---

## Video export (roadmap — next phase)

To let families download the reel as an MP4:

### Option A: Remotion (recommended)
```bash
npm install remotion @remotion/player
```
Remotion is a React-based video renderer. You define the reel as a React component
and Remotion renders it frame-by-frame to video. The `@remotion/player` package
gives you an in-browser preview; actual export requires Remotion Lambda (AWS).

Estimated effort: 2–3 days
Output: 1080p MP4 with Ken Burns, transitions, text, and music

### Option B: Web canvas capture + WebM
Use `MediaRecorder` to capture the canvas at 30fps and produce a WebM file
directly in the browser. Lower quality but no server required.
Estimated effort: 1 day
Output: WebM, ~720p

### Option C: html2canvas + FFmpeg WASM
Capture DOM frames with `html2canvas` and encode with `@ffmpeg/ffmpeg`.
Most compatible but slowest.
Estimated effort: 3–4 days
Output: MP4

Remotion is the right answer for production quality.

---

## Performance notes

- All GSAP transforms are GPU-composited (no layout reflows)
- Film grain canvas is capped at 24fps with `setTimeout` guard
- Slides are `position: absolute` so only 2 DOM nodes are ever in the stack
- `will-change: transform` pre-promotes slide images to compositor layers
- `force3D: true` forces `matrix3d` even for 2D transforms (prevents layer promotion delay)

On a mid-range mobile phone (iPhone 12, Pixel 6), you should see a consistent 60fps.
