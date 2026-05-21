// src/pages/DashboardPage.jsx — Pastel Airy redesign + unified Activity feed
//
// Visual layer per design handoff (pastel, Plus Jakarta/Fraunces, canvas plate).
// Activity tab now shows a rich mixed feed (birthdays, anniversaries, tributes,
// new members, vault, calendar events) via useActivityFeed — matching the
// reference screenshot's colored event rows + black vault card.
//
// Data flow, queries and routes preserved. New: invites + letters added to the
// query so the activity feed can surface joins and the vault.
//
// Requires the fonts (add to index.html <head> if not already):
// <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Fraunces:ital,opsz,wght@0,9..144,300;1,9..144,300;1,9..144,400&display=swap" rel="stylesheet">

import { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { db } from '../lib/instant'
import { usePullToRefresh } from '../hooks'
import { useActivityFeed } from '../hooks/useActivityFeed'
import FamilyMessagesSection from '../components/shared/FamilyMessagesSection'
import { countryFlag } from '../lib/countries'
import { getRelationFilterCategory, normalizeRelation } from '../lib/relations'

// ════════════════════════════════════════════════════════════════════════════
// Scoped pastel styles (kept in-file so this is a single drop-in).
// You may move this into dashboard.css and import it instead.
// ════════════════════════════════════════════════════════════════════════════
const CSS = `
.dash{
  --bg-page:#ece5d8; --paper:#fbf9f3; --white:#fff;
  --ink:#14110d; --ink-2:#2a2620; --muted:#6e6a62; --muted-2:#9a9588;
  --mint:#c4eed4; --mint-2:#a9e6c3; --lavender:#d8cbf6; --lavender-2:#c4b3f0;
  --peach:#ffd7b3; --peach-2:#ffc28a; --butter:#ffe981; --butter-2:#f7d94a;
  --rose:#ffc7d0; --sage:#d3e3b9; --sky:#b7dff0; --sky-2:#5fb3d3; --alive:#56b56a;
  --line:rgba(20,17,13,.08); --line-2:rgba(20,17,13,.12);
  /* dark-card system */
  --card-bg:#1a1612; --card-bg-2:#221d17;
  --card-text:#f7f1e3; --card-text-2:rgba(247,241,227,.62); --card-text-3:rgba(247,241,227,.38);
  --card-line:rgba(247,241,227,.08); --card-line-2:rgba(247,241,227,.14);
  --shadow-card:0 14px 36px rgba(20,17,13,.22),0 1px 0 rgba(255,255,255,.04) inset;
  --shadow-card-2:0 22px 50px rgba(20,17,13,.32),0 1px 0 rgba(255,255,255,.06) inset;
  --sh-pill:0 1px 2px rgba(20,17,13,.05),0 6px 18px rgba(20,17,13,.05);
  --r-xl:28px; --r-lg:22px; --r-md:16px; --r-sm:12px;
  font-family:'Plus Jakarta Sans',system-ui,sans-serif;
  min-height:100vh; background:var(--bg-page); padding:18px;
}
.dash *{ box-sizing:border-box; }
.canvas{
  position:relative; border-radius:32px; overflow:hidden; padding:26px 26px 30px;
  background:
    radial-gradient(at 0% 0%,#c8efdb 0%,transparent 55%),
    radial-gradient(at 100% 0%,#d8cbf6 0%,transparent 60%),
    radial-gradient(at 100% 100%,#ffd7b3 0%,transparent 60%),
    radial-gradient(at 0% 100%,#ffe981 0%,transparent 55%),
    linear-gradient(135deg,#d5eedd 0%,#e2dcf7 50%,#ffe0c3 100%);
  box-shadow:0 30px 80px rgba(20,17,13,.08),inset 0 0 0 1px rgba(255,255,255,.4);
}
.canvas::before{ content:""; position:absolute; inset:0; pointer-events:none;
  background:radial-gradient(circle at 50% 30%,rgba(255,255,255,.35),transparent 60%);
  mix-blend-mode:soft-light; }
.cw{ position:relative; max-width:1040px; margin:0 auto; }

.eyebrow{ font-size:11px; font-weight:700; letter-spacing:.24em; text-transform:uppercase;
  color:var(--muted); display:flex; align-items:center; gap:7px; }
.eyebrow .s{ color:var(--butter-2); }
.hello{ font-size:clamp(34px,5vw,58px); font-weight:800; letter-spacing:-.035em;
  line-height:.98; color:var(--ink); margin:8px 0 6px; }
.hello .it{ font-family:'Fraunces',serif; font-style:italic; font-weight:300; color:var(--muted); }
.hello .sp{ color:var(--butter-2); }
.subtitle{ font-size:15px; font-weight:500; color:var(--muted); }
.subtitle b{ font-weight:700; color:var(--ink); }
.header{ display:flex; align-items:flex-start; justify-content:space-between; gap:20px; margin-bottom:22px; }
.btn-new{ display:flex; align-items:center; gap:12px; height:50px; padding:0 22px 0 8px;
  border:none; border-radius:999px; background:var(--ink); color:var(--white);
  font-family:inherit; font-size:14px; font-weight:700; cursor:pointer; flex-shrink:0;
  box-shadow:0 12px 28px rgba(20,17,13,.18); transition:transform .15s; text-decoration:none; }
.btn-new:hover{ transform:translateY(-2px); }
.btn-new .disc{ width:36px; height:36px; border-radius:50%; background:var(--butter);
  color:var(--ink); display:flex; align-items:center; justify-content:center; font-size:20px; font-weight:700; }

.stats{ display:grid; grid-template-columns:repeat(4,1fr); gap:14px; margin-bottom:22px; }
@media(max-width:880px){ .stats{ grid-template-columns:repeat(2,1fr); } }
.stat{
  position:relative; border-radius:var(--r-xl); padding:18px 20px 16px;
  background:var(--card-bg); border:1px solid var(--card-line);
  box-shadow:var(--shadow-card); transition:transform .15s,box-shadow .15s; cursor:default;
  overflow:hidden;
}
.stat::before{
  content:""; position:absolute; left:0; right:0; top:0; height:60%;
  background:linear-gradient(180deg,rgba(247,241,227,.04),transparent);
  pointer-events:none;
}
/* accent bar at bottom */
.stat::after{
  content:""; position:absolute; left:18px; right:18px; bottom:0; height:3px;
  border-radius:999px;
}
.stat.memorials::after{ background:var(--butter); }
.stat.tributes::after { background:var(--mint); }
.stat.views::after    { background:var(--lavender); }
.stat.photos::after   { background:var(--peach); }
.stat:hover{ transform:translateY(-2px); box-shadow:var(--shadow-card-2); }
.stat .top{ display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; }
.stat .ic{
  width:38px; height:38px; border-radius:12px;
  display:flex; align-items:center; justify-content:center; font-size:18px;
  color:var(--ink);
}
.stat.memorials .ic{ background:var(--butter); }
.stat.tributes .ic{ background:var(--mint); }
.stat.views .ic{ background:var(--lavender); }
.stat.photos .ic{ background:var(--peach); }
.stat .led{
  width:10px; height:10px; border-radius:50%;
  box-shadow:0 0 10px currentColor,0 0 22px currentColor;
}
.stat.memorials .led{ color:var(--butter-2); background:var(--butter-2); }
.stat.tributes .led{ color:var(--alive); background:var(--alive); }
.stat.views .led{ color:var(--lavender-2); background:var(--lavender-2); }
.stat.photos .led{ color:var(--peach-2); background:var(--peach-2); }
.stat .num{ font-size:44px; font-weight:800; letter-spacing:-.035em; color:var(--card-text); line-height:.95; }
.stat .num .k{ font-size:22px; font-weight:700; color:var(--card-text-2); }
.stat .lab{ font-size:13.5px; font-weight:700; color:var(--card-text); margin-top:4px; }
.stat .sub{ font-size:12px; font-weight:500; color:var(--card-text-2); margin-top:2px; }
.stat .arrow{
  position:absolute; top:14px; right:14px;
  width:26px; height:26px; border-radius:50%;
  background:rgba(247,241,227,.08); color:var(--card-text);
  display:flex; align-items:center; justify-content:center;
  opacity:0; transition:opacity .15s;
}
.stat:hover .arrow{ opacity:1; }

.tabs{ display:inline-flex; gap:5px; padding:5px; border-radius:18px;
  background:var(--card-bg); border:1px solid var(--card-line);
  box-shadow:var(--shadow-card); margin-bottom:20px; }
.tab{ position:relative; height:40px; padding:0 22px; border:none; background:none;
  font-family:inherit; font-size:13px; font-weight:700; color:var(--card-text-2);
  border-radius:14px; cursor:pointer; display:flex; align-items:center; gap:8px; z-index:1; }
.tab:hover{ color:var(--card-text); }
.tab.active{ color:var(--ink); }
.tab .pill{ position:absolute; inset:0; background:var(--butter); border-radius:14px;
  box-shadow:0 4px 14px rgba(255,233,129,.32); z-index:-1; }
.tab .badge{ font-size:11px; font-weight:700; padding:2px 7px; border-radius:999px;
  background:rgba(20,17,13,.18); color:inherit; }
.tab:not(.active) .badge{ background:rgba(247,241,227,.10); color:var(--card-text-2); }

.row{ display:block; text-decoration:none; border-radius:var(--r-xl); padding:16px 20px 14px;
  background:var(--card-bg); border:1px solid var(--card-line); box-shadow:var(--shadow-card);
  transition:transform .15s,box-shadow .15s; margin-bottom:12px; position:relative; overflow:hidden; }
.row::before{
  content:""; position:absolute; left:0; right:0; top:0; height:50%;
  background:linear-gradient(180deg,rgba(247,241,227,.03),transparent);
  pointer-events:none;
}
.row:hover{ transform:translateY(-2px); box-shadow:var(--shadow-card-2); }
.row .main{ display:flex; align-items:center; gap:16px; }
.row .avatar{ width:56px; height:56px; border-radius:18px; flex-shrink:0; overflow:hidden;
  display:flex; align-items:center; justify-content:center;
  font-family:'Fraunces',serif; font-style:italic; font-weight:400; font-size:30px; color:var(--ink); }
.row .avatar.alive{ background:var(--mint); } .row .avatar.gold{ background:var(--butter); }
.row .avatar.lav{ background:var(--lavender); } .row .avatar.peach{ background:var(--peach); }
.row .avatar.rose{ background:var(--rose); } .row .avatar.sky{ background:var(--sky); }
.row .avatar.sage{ background:var(--sage); }
.row .avatar img{ width:100%; height:100%; object-fit:cover; }
.row .info{ flex:1; min-width:0; }
.row .nm{ display:flex; align-items:center; gap:9px; margin-bottom:3px; }
.row .nm .led{ width:8px; height:8px; border-radius:50%; flex-shrink:0; }
.row .nm .led.alive{ background:var(--alive); box-shadow:0 0 6px rgba(86,181,106,.7); animation:pulse 2s infinite; }
.row .nm .led.archived{ background:var(--muted-2); }
.row .nm b{ font-size:17px; font-weight:700; letter-spacing:-.02em; color:var(--card-text);
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.row .rel{ font-size:11px; font-weight:600; color:var(--card-text);
  background:rgba(247,241,227,.10); padding:2px 9px; border-radius:999px; flex-shrink:0; }
.row .yr{ font-size:13px; font-weight:500; color:var(--card-text-2); }
.row .yr .dot{ margin:0 6px; color:var(--card-text-3); }
.row .mini{ display:flex; align-items:center; gap:18px; flex-shrink:0; }
@media(max-width:880px){ .row .mini{ display:none; } }
.row .mini .c{ text-align:center; }
.row .mini .c b{ font-size:22px; font-weight:800; letter-spacing:-.02em; display:block; }
.row .mini .c b.gold{ color:var(--butter); } .row .mini .c b.sky{ color:var(--sky); }
.row .mini .c b.lav{ color:var(--lavender); }
.row .mini .c span{ font-size:10px; font-weight:600; letter-spacing:.12em;
  text-transform:uppercase; color:var(--card-text-3); }
.row .menu{ width:30px; height:30px; border-radius:10px; border:none; cursor:pointer;
  background:rgba(247,241,227,.06); color:var(--card-text-2); font-size:16px; flex-shrink:0; }
.bar{ margin-top:12px; display:flex; height:6px; border-radius:999px;
  overflow:hidden; background:rgba(247,241,227,.06); }
.bar i{ display:block; } .bar i.gold{ background:var(--butter); }
.bar i.sky{ background:var(--sky); } .bar i.lav{ background:var(--lavender); }

.qa{ display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-top:18px; }
@media(max-width:880px){ .qa{ grid-template-columns:repeat(2,1fr); } }
.qa a{ position:relative; border-radius:var(--r-xl); padding:18px; text-decoration:none;
  background:var(--card-bg); border:1px solid var(--card-line); box-shadow:var(--shadow-card);
  transition:transform .15s,box-shadow .15s; overflow:hidden; }
.qa a::before{
  content:""; position:absolute; left:0; right:0; top:0; height:50%;
  background:linear-gradient(180deg,rgba(247,241,227,.03),transparent);
  pointer-events:none;
}
.qa a:hover{ transform:translateY(-3px); box-shadow:var(--shadow-card-2); }
.qa a.premium{
  background:linear-gradient(155deg,var(--lavender) 0%,var(--rose) 60%,var(--peach) 100%);
  border-color:rgba(20,17,13,.10);
}
.qa a.premium::before{ display:none; }
.qa a.premium .qt{ color:var(--ink); }
.qa a.premium .qs{ color:var(--ink-2); }
.qa a.premium .arr{ background:rgba(255,255,255,.55); color:var(--ink); }
.qa .qic{ width:44px; height:44px; border-radius:14px; display:flex; align-items:center;
  justify-content:center; font-size:20px; margin-bottom:14px; color:var(--ink); }
.qa .qic.butter{ background:var(--butter); } .qa .qic.rose{ background:var(--rose); }
.qa .qic.mint{ background:var(--mint); } .qa .qic.lav{ background:var(--lavender); }
.qa .qt{ font-size:16px; font-weight:700; letter-spacing:-.01em; color:var(--card-text); }
.qa .qs{ font-size:12.5px; color:var(--card-text-2); margin-top:2px; }
.qa .arr{ position:absolute; top:16px; right:16px; width:28px; height:28px; border-radius:50%;
  background:rgba(247,241,227,.08); display:flex; align-items:center; justify-content:center;
  font-size:13px; color:var(--card-text); }

/* ── ACTIVITY FEED (from reference screenshot) ─────────────────── */
.feedhead{ display:flex; align-items:baseline; justify-content:space-between; margin:4px 2px 16px; }
.feedhead h2{ font-size:30px; font-weight:800; letter-spacing:-.03em; color:var(--ink); margin:0; }
.feedhead .cnt{ font-size:15px; color:var(--muted); }
.feedhead .cnt b{ font-size:30px; font-weight:800; color:var(--ink); letter-spacing:-.03em; }

.evt{ position:relative; display:flex; align-items:center; gap:18px;
  border-radius:24px; padding:20px 24px; margin-bottom:14px; text-decoration:none;
  box-shadow:var(--sh-card); transition:transform .15s; }
.evt:hover{ transform:translateY(-2px); }
.evt.lavender{ background:var(--lavender); } .evt.butter{ background:var(--butter); }
.evt.mint{ background:var(--mint); } .evt.peach{ background:var(--peach); }
.evt.sage{ background:var(--sage); } .evt.sky{ background:var(--sky); }
.evt.rose{ background:var(--rose); }
.evt.ink{ background:var(--card-bg); border:1px solid var(--card-line); }
.evt .when{ display:flex; flex-direction:column; align-items:center; min-width:54px; flex-shrink:0; }
.evt .when .d{ font-size:14px; font-weight:800; color:var(--ink); letter-spacing:-.02em; }
.evt .when .t{ font-size:11px; font-weight:600; color:var(--ink-2); }
.evt.ink .when .d, .evt.ink .when .t{ color:rgba(255,255,255,.7); }
.evt .eic{ width:44px; height:44px; border-radius:14px; background:rgba(255,255,255,.6);
  display:flex; align-items:center; justify-content:center; flex-shrink:0; }
.evt.ink .eic{ background:rgba(247,241,227,.08); }
.evt .ebody{ flex:1; min-width:0; }
.evt .etitle{ font-size:18px; font-weight:700; letter-spacing:-.02em; color:var(--ink);
  margin-bottom:4px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.evt.ink .etitle{ color:var(--card-text); }
.evt .emeta{ display:flex; align-items:center; gap:8px; font-size:14px; color:var(--ink-2); }
.evt.ink .emeta{ color:var(--card-text-2); }
.evt .ava{ width:26px; height:26px; border-radius:50%; background:rgba(255,255,255,.7);
  display:flex; align-items:center; justify-content:center; font-size:10px; font-weight:700;
  color:var(--ink); flex-shrink:0; }
.evt .emeta b{ font-weight:700; color:var(--ink); }
.evt.ink .emeta b{ color:var(--card-text); }
.evt .equote{ font-family:'Fraunces',serif; font-style:italic; font-weight:300;
  font-size:14px; color:var(--ink-2); margin-top:6px; line-height:1.4; }
.evt .go{ position:absolute; top:14px; right:14px; width:34px; height:34px; border-radius:50%;
  background:var(--white); display:flex; align-items:center; justify-content:center;
  font-size:14px; color:var(--ink); box-shadow:0 4px 12px rgba(20,17,13,.12); }
.evt.ink .go{ background:var(--butter); }
.evt .when2{ font-size:12px; font-weight:700; color:var(--ink-2);
  background:rgba(255,255,255,.5); padding:6px 13px; border-radius:999px; flex-shrink:0; }
.evt.ink .when2{ background:rgba(247,241,227,.12); color:var(--butter); }

.feedfoot{ display:flex; align-items:center; justify-content:space-between;
  margin-top:18px; padding-top:18px; border-top:1px dashed var(--line-2); }
.feedfoot .sync{ font-size:13px; color:var(--muted); }
.feedfoot a{ font-size:14px; font-weight:700; color:var(--ink); text-decoration:none;
  display:flex; align-items:center; gap:6px; }

.empty{ border:1px dashed var(--card-line-2); border-radius:var(--r-xl);
  background:var(--card-bg); padding:48px 24px; text-align:center; }
.empty .eic{ width:64px; height:64px; border-radius:18px; background:var(--butter);
  display:flex; align-items:center; justify-content:center; font-size:28px; margin:0 auto 16px;
  color:var(--ink); }
.empty h4{ font-size:22px; font-weight:800; color:var(--card-text); margin:0 0 6px; }
.empty p{ font-size:14px; color:var(--card-text-2); margin:0 0 20px; }
.empty .cta{ display:inline-flex; align-items:center; gap:8px; height:46px; padding:0 22px;
  background:var(--ink); color:var(--white); border-radius:999px; font-weight:700;
  font-size:14px; text-decoration:none; }

@keyframes pulse{ 0%,100%{ opacity:1; transform:scale(1); } 50%{ opacity:.55; transform:scale(.8); } }
.spin{ width:20px; height:20px; border:2px solid rgba(247,217,74,.3);
  border-top-color:var(--butter-2); border-radius:50%; animation:rot .8s linear infinite; }
@keyframes rot{ to{ transform:rotate(360deg); } }

/* ── Vault picker modal ──────────────────────────────────────────── */
.vp-backdrop{ position:fixed; inset:0; background:rgba(14,11,8,.72);
  backdrop-filter:blur(6px); z-index:1000;
  display:flex; align-items:center; justify-content:center; padding:20px; }
.vp-sheet{ background:var(--card-bg); border:1px solid var(--card-line-2);
  border-radius:28px; padding:24px; width:100%; max-width:420px;
  box-shadow:0 32px 80px rgba(14,11,8,.5); }
.vp-title{ font-size:20px; font-weight:800; color:var(--card-text);
  letter-spacing:-.02em; margin:0 0 4px; }
.vp-sub{ font-size:13px; color:var(--card-text-2); margin:0 0 20px; }
.vp-item{ display:flex; align-items:center; gap:14px; padding:12px 14px;
  border-radius:16px; cursor:pointer; text-decoration:none;
  border:1px solid transparent; transition:background .15s,border-color .15s; }
.vp-item:hover{ background:rgba(247,241,227,.06); border-color:var(--card-line-2); }
.vp-av{ width:44px; height:44px; border-radius:12px; flex-shrink:0;
  display:flex; align-items:center; justify-content:center;
  font-family:'Fraunces',serif; font-style:italic; font-size:24px; color:var(--ink); }
.vp-av img{ width:100%; height:100%; object-fit:cover; border-radius:12px; }
.vp-av.alive{ background:var(--mint); }
.vp-av.gold{ background:var(--butter); }
.vp-name{ font-size:16px; font-weight:700; color:var(--card-text); letter-spacing:-.01em; }
.vp-hint{ font-size:12px; color:var(--card-text-2); margin-top:2px; }
.vp-badge{ margin-left:auto; font-size:11px; font-weight:700;
  background:var(--butter); color:var(--ink);
  padding:3px 9px; border-radius:999px; flex-shrink:0; }
.vp-cancel{ display:block; width:100%; margin-top:16px; padding:11px;
  background:rgba(247,241,227,.06); border:1px solid var(--card-line);
  border-radius:14px; color:var(--card-text-2); font-family:inherit;
  font-size:14px; font-weight:600; cursor:pointer; transition:background .15s; }
.vp-cancel:hover{ background:rgba(247,241,227,.10); }
`

// ── tiny inline icons (stroke, currentColor) ─────────────────────────────────
const I = {
  calendar:'M8 2v3M16 2v3M3.5 9h17M5 5h14a1.5 1.5 0 011.5 1.5V19A1.5 1.5 0 0119 20.5H5A1.5 1.5 0 013.5 19V6.5A1.5 1.5 0 015 5z',
  clock:'M12 7v5l3 2M12 21a9 9 0 100-18 9 9 0 000 18z',
  phone:'M6.5 3h3l2 5-2.5 1.5a11 11 0 005.5 5.5L18 12l5 2v3a2 2 0 01-2 2A16 16 0 014.5 5a2 2 0 012-2z',
  heart:'M12 20s-7-4.5-9-9a4.5 4.5 0 018-3 4.5 4.5 0 018 3c-2 4.5-9 9-9 9z',
  candle:'M12 3s2 2 2 4a2 2 0 11-4 0c0-2 2-4 2-4zM9 11h6v8a1 1 0 01-1 1h-4a1 1 0 01-1-1z',
  memory:'M12 21a9 9 0 100-18 9 9 0 000 18zM12 8v4l3 2',
  user:'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0',
  lock:'M7 11V8a5 5 0 0110 0v3M5 11h14v9H5z',
  mail:'M3 6h18v12H3zM3 6l9 7 9-7',
  arrow:'M7 17L17 7M17 7H9M17 7v8',
}
const Icon = ({ d, size = 19 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
)
const initials = n => (n || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
const fmtNum = v => v > 999 ? <>{(v/1000).toFixed(1)}<span className="k">k</span></> : v

// ════════════════════════════════════════════════════════════════════════════
function StatCard({ variant, value, label, sub, icon }) {
  return (
    <div className={`stat ${variant}`}>
      <div className="top"><span className="ic">{icon}</span><span className="led" /></div>
      <div className="num">{fmtNum(value)}</div>
      <div className="lab">{label}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  )
}

function MemorialRow({ memorial }) {
  const tributes = memorial.tributes || []
  const photos   = memorial.photos   || []
  const isAlive  = memorial.alive !== false
  const flag     = memorial.countryCode ? countryFlag(memorial.countryCode) : ''

  return (
    <Link to={`/memorial/${memorial.id}`} className="row">
      <div className="main">
        <div className={`avatar ${isAlive ? 'alive' : 'gold'}`}>
          {memorial.photo
            ? <img src={memorial.photo} alt="" />
            : (memorial.name?.charAt(0) || '?').toLowerCase()}
        </div>
        <div className="info">
          <div className="nm">
            <span className={`led ${isAlive ? 'alive' : 'archived'}`} />
            <b>{memorial.name}</b>
            {memorial.relation && <span className="rel">{memorial.relation}</span>}
            {flag && (
              <span style={{ fontSize:15, lineHeight:1, flexShrink:0 }} title={memorial.countryCode}>
                {flag}
              </span>
            )}
          </div>
          <div className="yr">
            {[memorial.years, memorial.location].filter(Boolean).join('  ·  ') || '—'}
          </div>
        </div>
        <div className="mini">
          <div className="c"><b className="gold">{tributes.length}</b><span>tributes</span></div>
          <div className="c"><b className="sky">{memorial.viewCount || 0}</b><span>views</span></div>
          <div className="c"><b className="lav">{photos.length}</b><span>photos</span></div>
        </div>
        <button className="menu" onClick={e => e.preventDefault()}>···</button>
      </div>
      {tributes.length > 0 && (
        <div className="bar">
          <i className="gold" style={{ width:'100%' }} />
        </div>
      )}
    </Link>
  )
}

// General memorial card (worldwide, no relation filter)
function GeneralCard({ memorial }) {
  const tributes = memorial.tributes || []
  const isAlive  = memorial.alive !== false
  const flag     = memorial.countryCode ? countryFlag(memorial.countryCode) : ''

  return (
    <Link to={`/memorial/${memorial.id}`} className="row">
      <div className="main">
        <div className={`avatar ${isAlive ? 'alive' : 'gold'}`}>
          {memorial.photo
            ? <img src={memorial.photo} alt="" />
            : (memorial.name?.charAt(0) || '?').toLowerCase()}
        </div>
        <div className="info">
          <div className="nm">
            <span className={`led ${isAlive ? 'alive' : 'archived'}`} />
            <b>{memorial.name}</b>
            {flag && (
              <span style={{ fontSize:15, lineHeight:1, flexShrink:0 }} title={memorial.countryCode}>
                {flag}
              </span>
            )}
          </div>
          <div className="yr">
            {[memorial.years, memorial.location].filter(Boolean).join('  ·  ') || '—'}
          </div>
        </div>
        <div className="mini">
          <div className="c"><b className="gold">{tributes.length}</b><span>tributes</span></div>
          <div className="c"><b className="sky">{memorial.viewCount || 0}</b><span>views</span></div>
        </div>
      </div>
    </Link>
  )
}

// One activity / upcoming card (matches the reference screenshot)
function EventCard({ ev, navigate }) {
  const go = () => {
    if (ev.route) navigate(ev.route)
    else if (ev.memorialId) navigate(`/memorial/${ev.memorialId}`)
  }
  const dateLabel = ev.date
    ? new Date(ev.date).toLocaleDateString('en-GB', { day:'numeric', month:'short' })
    : null
  const timeLabel = ev.date
    ? (new Date(ev.date).getHours() === 0
        ? 'all day'
        : new Date(ev.date).toLocaleTimeString('en-GB', { hour:'numeric', minute:'2-digit' }).toLowerCase())
    : ''

  return (
    <a className={`evt ${ev.tone}`} onClick={go} style={{ cursor:'pointer' }}>
      <div className="go"><Icon d={I.arrow} size={14} /></div>

      {ev.bucket === 'upcoming' && dateLabel && (
        <div className="when"><span className="d">{dateLabel}</span><span className="t">{timeLabel}</span></div>
      )}

      <div className="eic"><Icon d={I[ev.icon] || I.calendar} /></div>

      <div className="ebody">
        <div className="etitle">{ev.title}</div>
        {ev.kind === 'tribute' || ev.kind === 'member_joined' ? (
          <>
            <div className="emeta">
              <span className="ava">{initials(ev.actor)}</span>
              <span><b>{ev.actor}</b>{ev.context ? ` · ${ev.context}` : ''}</span>
            </div>
            {ev.quote && <div className="equote">"{ev.quote}"</div>}
          </>
        ) : ev.kind === 'vault' ? (
          <div className="emeta">{ev.context}</div>
        ) : (
          <div className="emeta">
            {ev.actor && <span className="ava">{initials(ev.actor)}</span>}
            <span>{ev.actor ? <b>{ev.actor}</b> : null}{ev.context ? `${ev.actor ? ' · ' : ''}${ev.context}` : ''}</span>
          </div>
        )}
      </div>

      {ev.bucket === 'upcoming' && !dateLabel && ev.when && (
        <span className="when2">{ev.when}</span>
      )}
      {ev.bucket === 'past' && ev.when && (
        <span className="when2">{ev.when}</span>
      )}
    </a>
  )
}

// ════════════════════════════════════════════════════════════════════════════
export default function DashboardPage() {
  const navigate = useNavigate()
  const { user, isLoading: authLoading } = db.useAuth()
  const [activeTab,       setActiveTab]       = useState('overview')
  const [showVaultPicker, setShowVaultPicker] = useState(false)
  // Relation filter for My Memorials
  const [relFilter,       setRelFilter]       = useState('all')

  // Redirect unauthenticated users to auth page
  useEffect(() => {
    if (!authLoading && !user) navigate('/auth', { replace: true })
  }, [user, authLoading, navigate])

  const { isLoading, data } = db.useQuery(
    user ? {
      // Use createdBy — set on every memorial since day one.
      // creatorId is also set but was introduced later; using createdBy ensures
      // older memorials are never missed.
      memorials:     { $: { where: { createdBy: user.id }, limit: 50 }, tributes: {}, photos: {} },
      profiles:      { $: { where: { userId: user.id } } },
      familyMembers: { $: { where: { ownerId: user.id } } },
      invites:       { $: { where: { familyOwnerId: user.id } } },
      letters:       { $: { where: { createdBy: user.id } } },
      // Approved connections where I am the family member (not the owner)
      familyConnections: { $: { where: { fromUserId: user.id, status: 'approved' } } },
    } : null
  )

  // ── Reactive family messages across all connected memorials ───────────────
  const memorialsRaw   = data?.memorials || []
  const ownIds         = memorialsRaw.map(m => m.id)
  const connectedIds   = (data?.familyConnections || []).map(c => c.toMemorialId)
  const allMemIds      = useMemo(() => [...new Set([...ownIds, ...connectedIds])], [ownIds.join(), connectedIds.join()])

  const msgsQ = db.useQuery(
    allMemIds.length ? {
      familyMessages: { $: { where: { memorialId: { $in: allMemIds } } } },
    } : null
  )

  const allFamilyMessages = msgsQ?.data?.familyMessages || []
  const unreadMsgCount    = allFamilyMessages.filter(m => {
    const readBy = Array.isArray(m.readBy) ? m.readBy : []
    return m.fromUserId !== user?.id && !readBy.includes(user?.id)
  }).length

  const { pullProgress, refreshing, onTouchStart, onTouchMove, onTouchEnd }
    = usePullToRefresh(async () => { await new Promise(r => setTimeout(r, 800)) })


  // Sort memorials newest-first so [0] is always the most recent
  const memorials     = memorialsRaw.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
  const profile       = data?.profiles?.[0]
  const familyMembers = data?.familyMembers || []
  const invites       = data?.invites       || []
  const letters       = data?.letters       || []
  const activities    = data?.activities    || []

  // ── Relation filter categories for My Memorials ───────────────────────────
  const REL_FILTERS = [
    { id: 'all',          label: 'All',          emoji: '◎' },
    { id: 'partner',      label: 'Partners',     emoji: '💍' },
    { id: 'children',     label: 'Children',     emoji: '🌱' },
    { id: 'siblings',     label: 'Siblings',     emoji: '🤝' },
    { id: 'parents',      label: 'Parents',      emoji: '✿' },
    { id: 'grandparents', label: 'Grandparents', emoji: '♡' },
    { id: 'friends',      label: 'Friends',      emoji: '☽' },
    { id: 'extended',     label: 'Extended',     emoji: '🌿' },
  ]

  // Filtered user memorials by selected relation category
  const filteredMemorials = useMemo(() => {
    if (relFilter === 'all') return memorials
    return memorials.filter(m => {
      if (!m.relation) return false
      const cat = getRelationFilterCategory(m.relation)
        || getRelationFilterCategory(normalizeRelation(m.relation)?.value || '')
      return cat === relFilter
    })
  }, [memorials, relFilter])

  const totalTributes = memorials.reduce((s, m) => s + (m.tributes?.length || 0), 0)
  const totalViews    = memorials.reduce((s, m) => s + (m.viewCount || 0), 0)
  const totalPhotos   = memorials.reduce((s, m) => s + (m.photos?.length || 0), 0)
  const publicCount   = memorials.filter(m => m.visibility === 'public').length
  const privateCount  = memorials.length - publicCount

  const feed = useActivityFeed({ memorials, familyMembers, invites, letters, activities, daysAhead: 45 })

  // Guard AFTER every hook (useQuery, usePullToRefresh, useActivityFeed) has
  // run. Placing any return above these caused "Rendered more hooks than
  // during the previous render" → the Something-went-wrong crash.
  if (authLoading || !user) {
    return (
      <div className="dash">
        <style>{CSS}</style>
        <div className="canvas"><div className="cw" style={{ display:'flex', justifyContent:'center', padding:'80px 0' }}>
          <div className="spin" />
        </div></div>
      </div>
    )
  }

  // Use first name for the personal greeting; fall back to full displayName
  // then email prefix then generic greeting
  const displayName = profile?.firstName
    || (profile?.displayName ? profile.displayName.split(' ')[0] : null)
    || user?.email?.split('@')[0]
    || 'there'

  // Vault button handler — direct if one memorial, picker if many, create if none
  function openVault(e) {
    e.preventDefault()
    if (memorials.length === 0) { navigate('/create'); return }
    if (memorials.length === 1) { navigate(`/memorial/${memorials[0].id}/letters`); return }
    setShowVaultPicker(true)
  }

  const TABS = [
    { id:'overview',  label:'Overview',  badge: memorials.length },
    { id:'activity',  label:'Activity',  badge: feed.counts.activity },
    { id:'upcoming',  label:'Upcoming',  badge: feed.counts.upcoming },
    { id:'messages',  label:'✦ Messages', badge: unreadMsgCount, urgent: unreadMsgCount > 0 },
  ]

  if (isLoading) {
    return (
      <div className="dash">
        <style>{CSS}</style>
        <div className="canvas"><div className="cw" style={{ display:'flex', justifyContent:'center', padding:'80px 0' }}>
          <div className="spin" />
        </div></div>
      </div>
    )
  }

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="dash" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      <style>{CSS}</style>

      {/* Pull-to-refresh indicator */}
      {refreshing && (
        <div style={{ textAlign:'center', padding:'12px 0 0', color:'var(--muted)', fontSize:'13px', fontWeight:600 }}>
          <div className="spin" style={{ margin:'0 auto 6px' }} />
          Refreshing…
        </div>
      )}

      <div className="canvas">
        <div className="cw">

          {/* ── Header ──────────────────────────────────────────────────── */}
          <div className="header">
            <div>
              <div className="eyebrow">
                <span className="s">✦</span> Dashboard
              </div>
              <h1 className="hello">
                Hey, <span className="it">{displayName}</span>
                <span className="sp">.</span>
              </h1>
              <p className="subtitle">
                You have <b>{memorials.length}</b> memorial{memorials.length !== 1 ? 'ies' : 'y'}
                {publicCount > 0 && ` (${publicCount} public, ${privateCount} private)`}.
              </p>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              {/* Notification bell — unread family messages */}
              {unreadMsgCount > 0 && (
                <button
                  onClick={() => setActiveTab('messages')}
                  style={{ position:'relative', width:44, height:44, borderRadius:'50%',
                    background:'var(--card-bg)', border:'1px solid var(--card-line)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    cursor:'pointer', fontSize:20, boxShadow:'var(--shadow-card)', flexShrink:0 }}>
                  🔔
                  <span style={{ position:'absolute', top:2, right:2, width:18, height:18,
                    borderRadius:'50%', background:'#dc3232', color:'#fff',
                    fontSize:10, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center',
                    border:'2px solid var(--card-bg)' }}>
                    {unreadMsgCount > 9 ? '9+' : unreadMsgCount}
                  </span>
                </button>
              )}
              <Link to="/create" className="btn-new">
                <span className="disc">+</span>
                New Memorial
              </Link>
            </div>
          </div>

          {/* ── Stats ────────────────────────────────────────────────────── */}
          <div className="stats">
            <StatCard variant="memorials" value={memorials.length} label="Memorials"
              sub={`${publicCount} public · ${privateCount} private`} icon="🪦" />
            <StatCard variant="tributes" value={totalTributes} label="Tributes"
              sub="Messages of love &amp; memory" icon="💐" />
            <StatCard variant="views" value={totalViews} label="Views"
              sub="Across all memorials" icon="👁️" />
            <StatCard variant="photos" value={totalPhotos} label="Photos"
              sub="Uploaded memories" icon="📸" />
          </div>

          {/* ── Tabs ─────────────────────────────────────────────────────── */}
          <div className="tabs">
            {TABS.map(t => (
              <button key={t.id}
                className={`tab ${activeTab === t.id ? 'active' : ''}`}
                onClick={() => setActiveTab(t.id)}>
                {activeTab === t.id && <motion.span layoutId="pill" className="pill" />}
                {t.label}
                {t.badge > 0 && (
                  <span className="badge" style={t.urgent ? {
                    background: 'rgba(220,50,50,.85)', color: '#fff',
                  } : {}}>
                    {t.badge}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* ── Tab Content ──────────────────────────────────────────────── */}
          <AnimatePresence mode="wait">
            {activeTab === 'overview' && (
              <motion.div key="overview"
                initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }}
                exit={{ opacity:0, y:-12 }} transition={{ duration:.25 }}>

                {/* ── Reels strip ────────────────────────────────────────── */}
                <div style={{
                  background: 'var(--card-bg)', border: '1px solid var(--card-line)',
                  borderRadius: 'var(--r-xl)', padding: '18px 20px 16px',
                  boxShadow: 'var(--shadow-card)', marginBottom: 20,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: 10,
                        background: 'var(--lavender)', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', fontSize: 16,
                      }}>▶</div>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--card-text)', letterSpacing: '-.01em' }}>Reels</div>
                        <div style={{ fontSize: 11, color: 'var(--card-text-2)', marginTop: 1 }}>
                          {memorials.length > 0 ? `${memorials.length} memorial reel${memorials.length !== 1 ? 's' : ''}` : 'Discover living memories'}
                        </div>
                      </div>
                    </div>
                    <Link to="/reels" style={{
                      fontSize: 12, fontWeight: 700, color: 'var(--butter-2)',
                      textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4,
                    }}>
                      Browse all <span>→</span>
                    </Link>
                  </div>

                  {memorials.length === 0 ? (
                    <Link to="/reels" style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '12px 16px', borderRadius: 'var(--r-md)',
                      background: 'rgba(247,241,227,.05)', border: '1px dashed rgba(247,241,227,.12)',
                      textDecoration: 'none',
                    }}>
                      <div style={{ fontSize: 28 }}>🎞️</div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--card-text)' }}>Discover memorial reels</div>
                        <div style={{ fontSize: 11, color: 'var(--card-text-2)', marginTop: 2 }}>Watch stories from around the world</div>
                      </div>
                      <div style={{ marginLeft: 'auto', fontSize: 18, color: 'var(--card-text-3)' }}>›</div>
                    </Link>
                  ) : (
                    <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
                      {memorials.map(m => (
                        <Link
                          key={m.id}
                          to={`/memorial/${m.id}`}
                          style={{ textDecoration: 'none', flexShrink: 0 }}
                          title={m.name}
                        >
                          <div style={{ position: 'relative', width: 80, height: 108, borderRadius: 14, overflow: 'hidden',
                            border: '1px solid rgba(247,241,227,.10)', background: 'rgba(247,241,227,.06)' }}>
                            {/* Thumbnail */}
                            {m.photo ? (
                              <img src={m.photo} alt={m.name}
                                style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }} />
                            ) : (
                              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center',
                                justifyContent: 'center', fontSize: 28, background: 'var(--card-bg-2)' }}>
                                {(m.name?.charAt(0) || '?').toLowerCase()}
                              </div>
                            )}
                            {/* Dark scrim */}
                            <div style={{ position: 'absolute', inset: 0,
                              background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.15) 50%, transparent 100%)' }} />
                            {/* Play button */}
                            <div style={{ position: 'absolute', top: '50%', left: '50%',
                              transform: 'translate(-50%, -60%)',
                              width: 28, height: 28, borderRadius: '50%',
                              background: 'rgba(255,255,255,0.88)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              boxShadow: '0 2px 8px rgba(0,0,0,0.35)' }}>
                              <span style={{ fontSize: 10, marginLeft: 2, color: '#14110d' }}>▶</span>
                            </div>
                            {/* Name */}
                            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0,
                              padding: '4px 6px 6px',
                              fontSize: 9.5, fontWeight: 700, color: '#fff',
                              letterSpacing: '.01em', textAlign: 'center',
                              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {m.name?.split(' ')[0]}
                            </div>
                          </div>
                        </Link>
                      ))}
                      {/* Discover more */}
                      <Link to="/reels" style={{ textDecoration: 'none', flexShrink: 0 }}>
                        <div style={{ width: 80, height: 108, borderRadius: 14, overflow: 'hidden',
                          border: '1px dashed rgba(247,241,227,.18)', background: 'rgba(247,241,227,.04)',
                          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                          <span style={{ fontSize: 20, opacity: 0.5 }}>🌍</span>
                          <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--card-text-3)',
                            textAlign: 'center', lineHeight: 1.3, padding: '0 6px' }}>
                            Explore<br/>more
                          </span>
                        </div>
                      </Link>
                    </div>
                  )}
                </div>

                {/* ── Relation filter chips ──────────────────────────────── */}
                {memorials.length > 0 && (
                      <div style={{
                        display:'flex', gap:8, overflowX:'auto', paddingBottom:4,
                        marginBottom:16, scrollbarWidth:'none',
                      }}>
                        {REL_FILTERS.map(f => (
                          <button
                            key={f.id}
                            onClick={() => setRelFilter(f.id)}
                            style={{
                              flexShrink:0, height:36, padding:'0 16px',
                              border: relFilter === f.id
                                ? '1.5px solid rgba(255,233,129,.6)'
                                : '1px solid var(--card-line)',
                              borderRadius:999, cursor:'pointer',
                              fontFamily:'inherit', fontSize:12.5, fontWeight:700,
                              display:'flex', alignItems:'center', gap:6,
                              background: relFilter === f.id
                                ? 'rgba(255,233,129,.14)'
                                : 'var(--card-bg)',
                              color: relFilter === f.id ? 'var(--butter)' : 'var(--card-text-2)',
                              transition:'all .15s',
                              boxShadow: relFilter === f.id
                                ? '0 2px 10px rgba(255,233,129,.15)'
                                : 'var(--shadow-card)',
                            }}
                          >
                            <span>{f.emoji}</span> {f.label}
                            {f.id !== 'all' && memorials.filter(m => {
                              const cat = getRelationFilterCategory(m.relation)
                                || getRelationFilterCategory(normalizeRelation(m.relation)?.value || '')
                              return cat === f.id
                            }).length > 0 && (
                              <span style={{
                                fontSize:10, fontWeight:800,
                                background:'rgba(255,233,129,.25)', color:'var(--butter)',
                                borderRadius:999, padding:'1px 6px',
                              }}>
                                {memorials.filter(m => {
                                  const cat = getRelationFilterCategory(m.relation)
                                    || getRelationFilterCategory(normalizeRelation(m.relation)?.value || '')
                                  return cat === f.id
                                }).length}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}

                    {filteredMemorials.length === 0 ? (
                      memorials.length === 0 ? (
                        <div className="empty">
                          <div className="eic">🪦</div>
                          <h4>No memorials yet</h4>
                          <p>Create your first memorial to start preserving a legacy.</p>
                          <Link to="/create" className="cta">+ Create Memorial</Link>
                        </div>
                      ) : (
                        <div className="empty">
                          <div className="eic" style={{ background:'var(--lavender)' }}>✦</div>
                          <h4>None in this category</h4>
                          <p>You haven't created any {REL_FILTERS.find(f=>f.id===relFilter)?.label.toLowerCase()} memorials yet.</p>
                          <button onClick={() => setRelFilter('all')} className="cta" style={{ border:'none', cursor:'pointer' }}>
                            Show all
                          </button>
                        </div>
                      )
                    ) : (
                      filteredMemorials.map(m => <MemorialRow key={m.id} memorial={m} />)
                    )}

                {/* Quick actions */}
                <div className="qa" style={{ marginTop: memorials.length === 0 ? 0 : 18 }}>
                  <a href="#" onClick={openVault}>
                    <div className="qic butter">🔒</div>
                    <div className="qt">Legacy Vault</div>
                    <div className="qs">{memorials.length > 1 ? `${memorials.length} vaults` : 'Secure letters, wills & docs'}</div>
                    <span className="arr">→</span>
                  </a>
                  <Link to="/family-tree">
                    <div className="qic rose">👨‍👩‍👧</div>
                    <div className="qt">Family Tree</div>
                    <div className="qs">Manage relatives & access</div>
                    <span className="arr">→</span>
                  </Link>
                  <Link to="/profile">
                    <div className="qic mint">⚙️</div>
                    <div className="qt">Profile</div>
                    <div className="qs">View & edit your profile</div>
                    <span className="arr">→</span>
                  </Link>
                  <Link to="/premium" className="premium">
                    <div className="qic lav">✦</div>
                    <div className="qt">Go Premium</div>
                    <div className="qs">Unlock voice memory & more</div>
                    <span className="arr">→</span>
                  </Link>
                </div>

              </motion.div>
            )}

            {activeTab === 'activity' && (
              <motion.div key="activity"
                initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }}
                exit={{ opacity:0, y:-12 }} transition={{ duration:.25 }}>

                <div className="feedhead">
                  <h2>Activity</h2>
                  <span className="cnt"><b>{feed.past.length}</b> events</span>
                </div>

                {feed.past.length === 0 ? (
                  <div className="empty">
                    <div className="eic">📭</div>
                    <h4>No activity yet</h4>
                    <p>Activity will appear here as tributes and memories are shared.</p>
                  </div>
                ) : (
                  feed.past.map((ev, i) => <EventCard key={i} ev={ev} navigate={navigate} />)
                )}

                <div className="feedfoot">
                  <span className="sync">Synced from your memorials</span>
                  <a href="#" onClick={e => { e.preventDefault(); window.location.reload() }}>
                    Refresh ↻
                  </a>
                </div>
              </motion.div>
            )}

            {activeTab === 'upcoming' && (
              <motion.div key="upcoming"
                initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }}
                exit={{ opacity:0, y:-12 }} transition={{ duration:.25 }}>

                <div className="feedhead">
                  <h2>Upcoming</h2>
                  <span className="cnt"><b>{feed.upcoming.length}</b> events</span>
                </div>

                {feed.upcoming.length === 0 ? (
                  <div className="empty">
                    <div className="eic">📅</div>
                    <h4>Nothing upcoming</h4>
                    <p>Birthdays and anniversaries from your memorials will appear here.</p>
                  </div>
                ) : (
                  feed.upcoming.map((ev, i) => <EventCard key={i} ev={ev} navigate={navigate} />)
                )}
              </motion.div>
            )}

            {activeTab === 'messages' && (
              <motion.div key="messages"
                initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }}
                exit={{ opacity:0, y:-12 }} transition={{ duration:.25 }}>

                <div className="feedhead" style={{ marginBottom:0 }}>
                  <h2>Family Messages</h2>
                  <span className="cnt">
                    {unreadMsgCount > 0
                      ? <b style={{ color:'#dc3232' }}>{unreadMsgCount} unread</b>
                      : <span style={{ fontSize:14 }}>all caught up</span>}
                  </span>
                </div>

                <p style={{ fontSize:13, color:'var(--muted)', margin:'6px 0 20px', lineHeight:1.5 }}>
                  Private messages shared within your approved family circles. Only connected family members can see these.
                </p>

                {allMemIds.length === 0 ? (
                  <div className="empty">
                    <div className="eic">✉️</div>
                    <h4>No family connections yet</h4>
                    <p>Family messages appear once you've connected with family members via invite codes.</p>
                    <Link to="/family-tree" className="cta">View family tree</Link>
                  </div>
                ) : (
                  /* Show messages grouped by memorial */
                  <div style={{
                    background:'var(--card-bg)', border:'1px solid var(--card-line)',
                    borderRadius:24, padding:24,
                    boxShadow:'var(--shadow-card)',
                    minHeight:480, display:'flex', flexDirection:'column',
                  }}>
                    <FamilyMessagesSection
                      memorialId={allMemIds.length === 1 ? allMemIds[0] : undefined}
                      user={user}
                      userProfile={data?.profiles?.[0]}
                    />
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

        </div>{/* .cw */}
      </div>{/* .canvas */}

      {/* ── Vault picker modal ────────────────────────────────────── */}
      <AnimatePresence>
        {showVaultPicker && (
          <motion.div
            className="vp-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowVaultPicker(false)}
          >
            <motion.div
              className="vp-sheet"
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              onClick={e => e.stopPropagation()}
            >
              <p className="vp-title">🔒 Legacy Vault</p>
              <p className="vp-sub">Choose which memorial vault to open</p>

              {memorials.map(m => {
                const isAlive = m.alive !== false
                return (
                  <a
                    key={m.id}
                    className="vp-item"
                    onClick={() => { setShowVaultPicker(false); navigate(`/memorial/${m.id}/letters`) }}
                  >
                    <div className={`vp-av ${isAlive ? 'alive' : 'gold'}`}>
                      {m.photo ? <img src={m.photo} alt="" /> : (m.name?.charAt(0) || '?').toLowerCase()}
                    </div>
                    <div>
                      <div className="vp-name">{m.name}</div>
                      <div className="vp-hint">{m.years || m.location || (isAlive ? 'Living' : 'Passed')}</div>
                    </div>
                    <span className="vp-badge">Open →</span>
                  </a>
                )
              })}

              <button className="vp-cancel" onClick={() => setShowVaultPicker(false)}>
                Cancel
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  )
}
