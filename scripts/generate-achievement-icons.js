const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "..", "public", "icons", "achievements");

const MEDALS = [
  { file: "register.svg", rim: "#6b9e6b", fill: "#2d4a2d", accent: "#e8a838", inner: "door" },
  { file: "first-game.svg", rim: "#b87333", fill: "#4a3520", accent: "#d4a574", inner: "dice" },
  { file: "first-survival.svg", rim: "#6a8fa8", fill: "#243540", accent: "#9ec4e8", inner: "shield" },
  { file: "avatar-upload.svg", rim: "#c9922e", fill: "#4a3a18", accent: "#f0c060", inner: "face" },
  { file: "bio-filled.svg", rim: "#a89060", fill: "#3d3528", accent: "#dcc8a0", inner: "scroll" },
  { file: "first-friend.svg", rim: "#4a9e8e", fill: "#1e3d36", accent: "#7ed4c4", inner: "link" },
  { file: "scenario-published.svg", rim: "#c45a30", fill: "#4a2818", accent: "#ff9050", inner: "burst" },
  { file: "premium-member.svg", rim: "#d4af37", fill: "#4a4018", accent: "#ffe066", inner: "crown" },
  { file: "bunker-dev.svg", rim: "#c03030", fill: "#3a1515", accent: "#ff6060", inner: "code" },
  { file: "games-10.svg", rim: "#b87333", fill: "#3d2a18", accent: "#d4a574", inner: "star1" },
  { file: "games-50.svg", rim: "#a8a8b0", fill: "#353540", accent: "#e0e0e8", inner: "star2" },
  { file: "games-100.svg", rim: "#d4af37", fill: "#4a4018", accent: "#ffe066", inner: "star3" },
  { file: "survivals-5.svg", rim: "#5a7a5a", fill: "#1e3020", accent: "#8ec48e", inner: "bunker" },
  { file: "survivals-25.svg", rim: "#4a6a8a", fill: "#182838", accent: "#7ab0e0", inner: "fortress" },
  { file: "friends-5.svg", rim: "#4a9e8e", fill: "#1e3d36", accent: "#7ed4c4", inner: "nodes" },
  { file: "scenarios-3.svg", rim: "#c45a30", fill: "#4a2818", accent: "#ff9050", inner: "books" },
];

function innerSvg(kind, accent) {
  const s = {
    door: `<rect x="26" y="18" width="12" height="18" rx="1" fill="#1a1f18" stroke="${accent}" stroke-width="1.2"/><circle cx="35" cy="28" r="1.2" fill="${accent}"/>`,
    dice: `<rect x="24" y="22" width="16" height="16" rx="2" fill="#1a1f18" stroke="${accent}" stroke-width="1.2"/><circle cx="28" cy="26" r="1.5" fill="${accent}"/><circle cx="36" cy="34" r="1.5" fill="${accent}"/>`,
    shield: `<path d="M32 18 L42 22 V30 C42 36 32 40 32 40 C32 40 22 36 22 30 V22 Z" fill="#1a1f18" stroke="${accent}" stroke-width="1.2"/>`,
    face: `<circle cx="32" cy="26" r="6" fill="#1a1f18" stroke="${accent}" stroke-width="1.2"/><path d="M24 36 Q32 42 40 36" fill="none" stroke="${accent}" stroke-width="1.2"/>`,
    scroll: `<rect x="24" y="20" width="16" height="20" rx="1" fill="#1a1f18" stroke="${accent}" stroke-width="1.2"/><line x1="27" y1="26" x2="37" y2="26" stroke="${accent}" stroke-width="1"/><line x1="27" y1="30" x2="35" y2="30" stroke="${accent}" stroke-width="1"/>`,
    link: `<circle cx="26" cy="28" r="4" fill="none" stroke="${accent}" stroke-width="1.5"/><circle cx="38" cy="28" r="4" fill="none" stroke="${accent}" stroke-width="1.5"/><line x1="30" y1="28" x2="34" y2="28" stroke="${accent}" stroke-width="1.5"/>`,
    burst: `<path d="M32 18 L34 26 L42 26 L36 31 L38 39 L32 34 L26 39 L28 31 L22 26 L30 26 Z" fill="${accent}" opacity="0.85"/>`,
    crown: `<path d="M24 34 L26 24 L32 28 L38 24 L40 34 Z" fill="${accent}" opacity="0.9"/><rect x="24" y="34" width="16" height="4" rx="1" fill="${accent}"/>`,
    code: `<text x="32" y="34" text-anchor="middle" font-size="14" font-family="monospace" fill="${accent}">&lt;/&gt;</text>`,
    star1: `<polygon points="32,20 34,27 41,27 35,31 37,38 32,34 27,38 29,31 23,27 30,27" fill="${accent}" opacity="0.85"/>`,
    star2: `<polygon points="32,19 34.5,27 43,27 36,32 38.5,40 32,35 25.5,40 28,32 21,27 29.5,27" fill="${accent}" opacity="0.9"/>`,
    star3: `<polygon points="32,18 35,27 44,27 37,32 39,41 32,35 25,41 27,32 20,27 29,27" fill="${accent}"/><circle cx="32" cy="29" r="3" fill="#1a1f18" opacity="0.5"/>`,
    bunker: `<rect x="24" y="24" width="16" height="14" fill="#1a1f18" stroke="${accent}" stroke-width="1.2"/><rect x="28" y="30" width="8" height="8" fill="${accent}" opacity="0.3"/>`,
    fortress: `<rect x="22" y="28" width="20" height="10" fill="#1a1f18" stroke="${accent}" stroke-width="1.2"/><rect x="26" y="22" width="4" height="6" fill="#1a1f18" stroke="${accent}" stroke-width="1"/><rect x="34" y="22" width="4" height="6" fill="#1a1f18" stroke="${accent}" stroke-width="1"/>`,
    nodes: `<circle cx="26" cy="26" r="3" fill="${accent}"/><circle cx="38" cy="26" r="3" fill="${accent}"/><circle cx="32" cy="36" r="3" fill="${accent}"/><line x1="28" y1="28" x2="30" y2="34" stroke="${accent}" stroke-width="1"/><line x1="36" y1="28" x2="34" y2="34" stroke="${accent}" stroke-width="1"/>`,
    books: `<rect x="22" y="22" width="7" height="16" rx="1" fill="#1a1f18" stroke="${accent}" stroke-width="1"/><rect x="29" y="20" width="7" height="18" rx="1" fill="#1a1f18" stroke="${accent}" stroke-width="1"/><rect x="36" y="24" width="7" height="14" rx="1" fill="#1a1f18" stroke="${accent}" stroke-width="1"/>`,
  };
  return s[kind] || s.star1;
}

function medalSvg({ rim, fill, accent, inner }) {
  const gid = `g${Math.random().toString(36).slice(2, 8)}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img">
  <defs>
    <linearGradient id="${gid}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${fill}"/>
      <stop offset="100%" stop-color="#0a0c0a"/>
    </linearGradient>
    <filter id="sh${gid}">
      <feDropShadow dx="0" dy="1" stdDeviation="1.5" flood-color="#000" flood-opacity="0.6"/>
    </filter>
  </defs>
  <path d="M16 50 L24 42 L40 42 L48 50 L40 58 L24 58 Z" fill="#5a1818" filter="url(#sh${gid})"/>
  <path d="M20 50 L32 44 L44 50 L32 55 Z" fill="${accent}" opacity="0.75"/>
  <circle cx="32" cy="28" r="23" fill="#1a1f18" stroke="${rim}" stroke-width="2.5"/>
  <circle cx="32" cy="28" r="18" fill="url(#${gid})" stroke="${rim}" stroke-width="1.5" opacity="0.95"/>
  <circle cx="32" cy="28" r="14" fill="none" stroke="${accent}" stroke-width="0.8" opacity="0.5"/>
  ${innerSvg(inner, accent)}
</svg>`;
}

fs.mkdirSync(OUT, { recursive: true });
for (const m of MEDALS) {
  fs.writeFileSync(path.join(OUT, m.file), medalSvg(m));
}
console.log(`Generated ${MEDALS.length} achievement icons in ${OUT}`);
