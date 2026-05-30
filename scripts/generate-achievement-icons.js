const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "..", "public", "icons", "achievements");

const TIERS = {
  bronze: { rim: "#b87333", fill: "#4a3520", accent: "#d4a574" },
  silver: { rim: "#a8a8b0", fill: "#353540", accent: "#e0e0e8" },
  gold: { rim: "#d4af37", fill: "#4a4018", accent: "#ffe066" },
  platinum: { rim: "#8ec4e8", fill: "#283848", accent: "#d8f0ff" },
  green: { rim: "#6b9e6b", fill: "#2d4a2d", accent: "#e8a838" },
  amber: { rim: "#c9922e", fill: "#4a3a18", accent: "#f0c060" },
  parchment: { rim: "#a89060", fill: "#3d3528", accent: "#dcc8a0" },
  teal: { rim: "#4a9e8e", fill: "#1e3d36", accent: "#7ed4c4" },
  ember: { rim: "#c45a30", fill: "#4a2818", accent: "#ff9050" },
  dev: { rim: "#c03030", fill: "#3a1515", accent: "#ff6060" },
};

/** Центр иконки на медали — чуть ниже геометрического центра круга */
const ICON_CY = 27.5;

function starPoints(outerR = 9, innerR = 3.8, points = 5) {
  const coords = [];
  for (let i = 0; i < points * 2; i++) {
    const angle = -Math.PI / 2 + (i * Math.PI) / points;
    const r = i % 2 === 0 ? outerR : innerR;
    coords.push(`${(r * Math.cos(angle)).toFixed(2)},${(r * Math.sin(angle)).toFixed(2)}`);
  }
  return coords.join(" ");
}

function innerSvg(kind, accent) {
  const icons = {
    star: `<polygon points="${starPoints()}" fill="${accent}" opacity="0.9"/>`,
    shield: `<path d="M0,-10 L8,-6 V2 C8,7 0,10 0,10 C0,10 -8,7 -8,2 V-6 Z" fill="#1a1f18" stroke="${accent}" stroke-width="1.3"/>`,
    link: `<circle cx="-6" cy="0" r="4" fill="none" stroke="${accent}" stroke-width="1.5"/><circle cx="6" cy="0" r="4" fill="none" stroke="${accent}" stroke-width="1.5"/><line x1="-2" y1="0" x2="2" y2="0" stroke="${accent}" stroke-width="1.5"/>`,
    nodes: `<circle cx="-7" cy="-2" r="2.5" fill="${accent}"/><circle cx="7" cy="-2" r="2.5" fill="${accent}"/><circle cx="0" cy="6" r="2.5" fill="${accent}"/><line x1="-5" y1="0" x2="-1" y2="4" stroke="${accent}" stroke-width="1"/><line x1="5" y1="0" x2="1" y2="4" stroke="${accent}" stroke-width="1"/>`,
    book: `<rect x="-5" y="-8" width="10" height="14" rx="1" fill="#1a1f18" stroke="${accent}" stroke-width="1.2"/><line x1="-2" y1="-3" x2="2" y2="-3" stroke="${accent}" stroke-width="0.9"/>`,
    books: `<rect x="-9" y="-6" width="6" height="12" rx="1" fill="#1a1f18" stroke="${accent}" stroke-width="1"/><rect x="-2" y="-8" width="6" height="14" rx="1" fill="#1a1f18" stroke="${accent}" stroke-width="1"/><rect x="5" y="-4" width="6" height="10" rx="1" fill="#1a1f18" stroke="${accent}" stroke-width="1"/>`,
    door: `<rect x="-6" y="-8" width="12" height="16" rx="1" fill="#1a1f18" stroke="${accent}" stroke-width="1.2"/><circle cx="3" cy="0" r="1.2" fill="${accent}"/>`,
    face: `<circle cx="0" cy="-2" r="6" fill="#1a1f18" stroke="${accent}" stroke-width="1.2"/><path d="M-8 8 Q0 13 8 8" fill="none" stroke="${accent}" stroke-width="1.2"/>`,
    scroll: `<rect x="-8" y="-8" width="16" height="16" rx="1" fill="#1a1f18" stroke="${accent}" stroke-width="1.2"/><line x1="-5" y1="-2" x2="5" y2="-2" stroke="${accent}" stroke-width="1"/><line x1="-5" y1="2" x2="3" y2="2" stroke="${accent}" stroke-width="1"/>`,
    burst: `<path d="M0,-10 L2,0 L10,0 L4,4 L6,12 L0,8 L-6,12 L-4,4 L-10,0 L-2,0 Z" fill="${accent}" opacity="0.85"/>`,
    crown3: `<g transform="translate(0,-3)"><path d="M-10 6 L-8 -4 L-3 0 L0 -6 L3 0 L8 -4 L10 6 Z" fill="${accent}" opacity="0.95"/><rect x="-10" y="6" width="20" height="4" rx="1" fill="${accent}"/></g>`,
    code: `<text x="0" y="4" text-anchor="middle" font-size="13" font-family="monospace" fill="${accent}">&lt;/&gt;</text>`,
  };
  const body = icons[kind] || icons.star;
  return `<g transform="translate(32, ${ICON_CY})">${body}</g>`;
}

function medalSvg(tier, inner) {
  const { rim, fill, accent } = TIERS[tier];
  const gid = `g${tier}${inner}`;
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

const MEDALS = [
  { file: "register.svg", tier: "green", inner: "door" },
  { file: "first-game.svg", tier: "bronze", inner: "star" },
  { file: "first-survival.svg", tier: "bronze", inner: "shield" },
  { file: "avatar-upload.svg", tier: "amber", inner: "face" },
  { file: "bio-filled.svg", tier: "parchment", inner: "scroll" },
  { file: "first-friend.svg", tier: "bronze", inner: "nodes" },
  { file: "scenario-published.svg", tier: "bronze", inner: "books" },
  { file: "premium-member.svg", tier: "gold", inner: "crown3" },
  { file: "bunker-dev.svg", tier: "dev", inner: "code" },
  { file: "games-10.svg", tier: "silver", inner: "star" },
  { file: "games-50.svg", tier: "gold", inner: "star" },
  { file: "games-100.svg", tier: "platinum", inner: "star" },
  { file: "survivals-5.svg", tier: "silver", inner: "shield" },
  { file: "survivals-20.svg", tier: "gold", inner: "shield" },
  { file: "survivals-50.svg", tier: "platinum", inner: "shield" },
  { file: "friends-5.svg", tier: "silver", inner: "nodes" },
  { file: "friends-15.svg", tier: "gold", inner: "nodes" },
  { file: "friends-30.svg", tier: "platinum", inner: "nodes" },
  { file: "scenarios-3.svg", tier: "silver", inner: "books" },
  { file: "scenarios-8.svg", tier: "gold", inner: "books" },
  { file: "scenarios-20.svg", tier: "platinum", inner: "books" },
];

fs.mkdirSync(OUT, { recursive: true });
const written = new Set();
for (const m of MEDALS) {
  fs.writeFileSync(path.join(OUT, m.file), medalSvg(m.tier, m.inner));
  written.add(m.file);
}
for (const name of fs.readdirSync(OUT)) {
  if (name.endsWith(".svg") && !written.has(name)) {
    fs.unlinkSync(path.join(OUT, name));
  }
}
console.log(`Generated ${MEDALS.length} achievement icons in ${OUT}`);
