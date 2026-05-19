const fs = require("fs");
const path = require("path");
const PptxGenJS = require("pptxgenjs");
const PDFDocument = require("pdfkit");

const ROOT = path.join(__dirname, "..");
const PPTX_OUT = path.join(ROOT, "Reihen-Diplom-Defense-UPDATED-2026-DIAGRAM.pptx");
const PDF_OUT = path.join(ROOT, "Reihen-Diplom-Defense-UPDATED-2026-A4.pdf");

const C = {
  black: "050505",
  ink: "111111",
  paper: "F7F7F2",
  white: "FFFFFF",
  muted: "666666",
  line: "D8D8D0",
  green: "22C55E",
  yellow: "FACC15",
  red: "EF4444",
  blue: "38BDF8",
};

const slides = [
  {
    kind: "cover",
    title: "REIHEN",
    subtitle: "PC Gaming Center суудал захиалга, төлбөр, realtime operation, tournament management систем",
    bullets: ["Диплом хамгаалалтын танилцуулга", "Next.js · Prisma · Supabase · Firebase RTDB · Vercel"],
  },
  {
    title: "Асуудал",
    bullets: [
      "PC center-ийн сул суудал, захиалга, төлбөрийн мэдээлэл ихэвчлэн чат/утас/гар ажиллагаагаар явдаг.",
      "Суудлын давхцал, төлбөр баталгаажаагүй захиалга, no-show бүртгэл алдагдах эрсдэлтэй.",
      "Owner болон staff нэг dashboard-оос realtime seat/booking state харах боломж сул.",
      "Tournament бүртгэл, bracket, score workflow тусдаа spreadsheet/чат дээр явдаг.",
    ],
    callout: "Гол зорилго: booking + operation + tournament workflow-г нэг системд нэгтгэх.",
  },
  {
    title: "Шийдэл",
    bullets: [
      "Player center сонгоод seat/time/payment тохируулж шууд booking үүсгэнэ.",
      "Owner center, seat map, staff, booking, reviews, tournaments удирдана.",
      "Staff check-in, no-show, seat status, booking detail-г center scope-той харна.",
      "Realtime update нь seat map, profile, owner/staff dashboard дээр refreshгүй харагдана.",
    ],
    callout: "Role-based system: Player · Owner · Staff · Admin",
  },
  {
    title: "Гол боломжууд",
    cards: [
      ["Seat booking", "Center detail дээр суудал сонгоод цаг, хугацаа, төлбөрийн аргаа тохируулна."],
      ["Realtime seat status", "Socket + Firebase mirror ашиглаж seat update-г хурдан харуулна."],
      ["Owner dashboard", "Revenue, booking, live seat map, customer risk, staff workflow."],
      ["Tournament", "Team registration, entry fee, bracket, score, winner progression."],
      ["Review", "Completed booking-ийн дараа commentгүй 1-5 star rating өгнө."],
      ["Profile", "Popup summary, active bookings, wallet balance, booking history."],
    ],
  },
  {
    title: "Architecture",
    cards: [
      ["Frontend", "Next.js App Router, React Query, Tailwind UI polish."],
      ["API layer", "Route handlers, Zod validation, auth/session guard."],
      ["Primary DB", "Supabase PostgreSQL + Prisma relational schema."],
      ["Realtime", "Socket event + Firebase Realtime Database optional mirror."],
      ["Deploy", "Vercel hosting, env-based configuration."],
      ["Security", "JWT/session, CSRF, rate limit, role-based access."],
    ],
  },
  {
    kind: "architectureDiagram",
    title: "System architecture",
    callout: "Primary DB\nSupabase PostgreSQL\nRealtime mirror\nFirebase RTDB",
  },
  {
    title: "Database design",
    bullets: [
      "User: role, balance, restriction/no-show state.",
      "PCCenter: owner, location, images, policy, rating.",
      "Seat/Floor/SeatType: status, price, layout position.",
      "Booking/BookingSeat: time range, payment status, selected seats.",
      "Tournament/Team/Match: team registration, bracket, score, winner.",
      "Review: bookingId unique, 1-5 star, optional comment field retained for future.",
    ],
    callout: "Relational model нь booking conflict, ownership, staff scope-г хамгаална.",
  },
  {
    title: "Booking flow",
    steps: [
      "1. User center page нээнэ.",
      "2. Seat section дээр OPEN seat сонгоно.",
      "3. Start time, hours, QPay эсвэл balance payment сонгоно.",
      "4. Booking үүсэхэд seat WAITING state болно.",
      "5. Owner/staff check-in хийвэл PLAYING болно.",
      "6. Booking дууссаны дараа user star rating өгч чадна.",
    ],
    callout: "Standalone /booking UI-г хассан. Booking одоо center detail дотор төвлөрсөн.",
  },
  {
    kind: "qpayDiagram",
    title: "QPay payment sequence",
    callout: "Invoice create → QR/deeplink → Bank payment → Callback/check → Booking confirmed",
  },
  {
    title: "Realtime шийдэл",
    bullets: [
      "Primary source of truth хэвээр Supabase/Postgres байна.",
      "Server тал seat/booking/tournament update гарахад Firebase RTDB mirror рүү publish хийнэ.",
      "Client тал Firebase env байвал reihen/centers/{centerId}/seats path-г сонсоно.",
      "Socket fallback хэвээр байгаа тул local/demo орчинд realtime flow тасрахгүй.",
      "UI дээр realtime update ирэхэд seat богино glow animation хийдэг.",
    ],
    callout: "Firebase бол primary DB биш, realtime accelerator.",
  },
  {
    title: "Security status",
    bullets: [
      "Role guard: owner/staff/admin route дээр permission шалгана.",
      "CSRF token болон credential include flow API request дээр ашиглагдана.",
      "Rate limit login/register/chat зэрэг abuse risk-тэй route-д ашиглагдана.",
      "Firebase Admin SDK service account зөвхөн server env дээр байна.",
      "Client Firebase write байхгүй; write зөвхөн server admin publish хийдэг.",
    ],
    callout: "Defense angle: production hardening шаардлагатай ч дипломын security baseline хангалттай.",
  },
  {
    title: "UI polish",
    bullets: [
      "Profile popup: active booking, balance, role badge, smooth animation.",
      "Tournament page: glassmorphism, clear register CTA, bracket layout.",
      "Center page: hero, gallery, seat map, sticky booking panel.",
      "Review flow: formгүй, шууд 1-5 star rating.",
      "Booking page duplication хасаж UX-г center detail дээр төвлөрүүлсэн.",
      "Buttons, disabled states, focus rings, mobile containment сайжруулсан.",
    ],
    callout: "UI нь demo дээр ойлгомжтой, хамгаалалт дээр тайлбарлахад шууд харагдана.",
  },
  {
    title: "Performance status",
    bullets: [
      "Build size хэвийн, production build амжилттай.",
      "Free tier Vercel/Supabase дээр cold start болон DB round-trip latency мэдрэгдэж болно.",
      "React Query staleTime, polling fallback, realtime mirror ашиглаж perceived speed сайжруулсан.",
      "Цаашид query batching, Redis cache expansion, availability snapshot table ашиглаж болно.",
      "Firebase RTDB нь live update latency-г бууруулах туршилтын layer.",
    ],
    callout: "Performance 'ok for diploma demo', production-д paid infra/cache хэрэгтэй.",
  },
  {
    title: "Demo дараалал",
    steps: [
      "1. Home дээр center list, events, nav flow харуулах.",
      "2. Center detail дээр seat сонгож booking үүсгэх.",
      "3. Owner/staff dashboard дээр realtime WAITING seat харах.",
      "4. Staff check-in хийж PLAYING state болгох.",
      "5. Firebase Console дээр realtime mirror data гарч байгааг харуулах.",
      "6. Booking дууссан хэрэглэгч center дээр star rating өгч байгааг харуулах.",
      "7. Tournament page дээр team registration/bracket flow тайлбарлах.",
    ],
    callout: "Working system гэдгийг flow-оор эхэлж харуул, дараа architecture тайлбарла.",
  },
  {
    title: "Testing",
    bullets: [
      "npm run build амжилттай.",
      "Prisma schema generate амжилттай.",
      "DB reset + seed data: centers, seats, bookings, reviews, tournaments.",
      "UI smoke: home, center, profile, events, tournament, owner/staff pages.",
      "Firebase env local болон Vercel дээр тохируулагдсан.",
    ],
    callout: "Defense дээр 'implemented and verified' гэж хэлэх үндэстэй.",
  },
  {
    title: "Хязгаарлалт",
    bullets: [
      "QPay production credential биш, mock/sandbox workflow.",
      "Firebase mirror нь primary database биш.",
      "Free tier latency production хэрэглээнд хангалтгүй байж болно.",
      "Full E2E Playwright test suite дараагийн шатанд хэрэгтэй.",
      "Monitoring, audit alert, backup policy-г production өмнө нэмнэ.",
    ],
    callout: "Өөрөө түрүүлж acknowledge хийвэл defense илүү итгэлтэй сонсогдоно.",
  },
  {
    title: "Дүгнэлт",
    bullets: [
      "Reihen нь PC center-ийн бодит operational workflow-г digital болгосон full-stack систем.",
      "Booking, payment, realtime seat status, staff workflow, review, tournament feature нэг дор ажиллана.",
      "Security baseline, deployment, seed data, UI polish, realtime architecture бэлэн.",
      "Диплом хамгаалалтад prototype бус ажилладаг систем гэж хамгаалах боломжтой.",
    ],
    callout: "Book. Pay. Check-in. Play.",
  },
];

function safe(text) {
  return String(text || "").replace(/\u00a0/g, " ");
}

function addBg(slide) {
  slide.background = { color: C.paper };
  slide.addShape("rect", { x: 0, y: 0, w: 13.33, h: 0.08, fill: { color: C.black }, line: { color: C.black } });
  for (let x = 0.45; x < 13; x += 0.55) {
    slide.addShape("line", { x, y: 0.08, w: 0, h: 7.35, line: { color: C.line, transparency: 72, width: 0.35 } });
  }
  for (let y = 0.65; y < 7.25; y += 0.42) {
    slide.addShape("line", { x: 0, y, w: 13.33, h: 0, line: { color: C.line, transparency: 80, width: 0.3 } });
  }
}

function addHeader(slide, idx) {
  slide.addShape("roundRect", { x: 0.55, y: 0.2, w: 12.25, h: 0.42, rectRadius: 0.07, fill: { color: C.white }, line: { color: C.line, width: 0.8 } });
  slide.addText("REIHEN DEFENSE", { x: 0.85, y: 0.32, w: 2.2, h: 0.12, fontFace: "Arial", fontSize: 7, bold: true, color: C.black, charSpacing: 1.2 });
  slide.addText("Next.js · Prisma · Supabase · Firebase", { x: 3.2, y: 0.32, w: 4.4, h: 0.12, fontFace: "Arial", fontSize: 7, color: C.muted, fit: "shrink" });
  slide.addShape("roundRect", { x: 11.45, y: 0.27, w: 0.95, h: 0.27, rectRadius: 0.05, fill: { color: C.black }, line: { color: C.black } });
  slide.addText(String(idx + 1).padStart(2, "0"), { x: 11.62, y: 0.35, w: 0.6, h: 0.08, fontFace: "Arial", fontSize: 6.5, bold: true, color: C.white, align: "center" });
}

function addTitle(slide, title) {
  slide.addText(safe(title), { x: 0.7, y: 0.85, w: 11.8, h: 0.5, fontFace: "Arial", fontSize: 26, bold: true, color: C.black, fit: "shrink" });
}

function addBullets(slide, bullets) {
  bullets.forEach((b, i) => {
    const y = 1.62 + i * 0.66;
    slide.addShape("rect", { x: 0.82, y: y + 0.13, w: 0.08, h: 0.08, fill: { color: C.green }, line: { color: C.green } });
    slide.addText(safe(b), { x: 1.05, y, w: 7.8, h: 0.48, fontFace: "Arial", fontSize: 12.2, color: C.black, fit: "shrink", breakLine: false });
  });
}

function addCallout(slide, text) {
  slide.addShape("roundRect", { x: 9.15, y: 1.88, w: 3.45, h: 3.05, rectRadius: 0.08, fill: { color: C.black }, line: { color: C.black } });
  slide.addText(safe(text), { x: 9.42, y: 2.16, w: 2.9, h: 2.05, fontFace: "Arial", fontSize: 11.4, bold: true, color: C.white, align: "center", valign: "mid", fit: "shrink", breakLine: false });
  slide.addShape("rect", { x: 10.25, y: 4.52, w: 1.25, h: 0.045, fill: { color: C.green }, line: { color: C.green } });
}

function addCards(slide, cards) {
  cards.forEach(([title, body], i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = 0.75 + col * 4.08;
    const y = 1.75 + row * 2.02;
    slide.addShape("roundRect", { x, y, w: 3.68, h: 1.52, rectRadius: 0.08, fill: { color: C.white }, line: { color: C.line } });
    slide.addText(safe(title), { x: x + 0.22, y: y + 0.2, w: 3.2, h: 0.25, fontFace: "Arial", fontSize: 12, bold: true, color: C.black, fit: "shrink" });
    slide.addShape("rect", { x: x + 0.22, y: y + 0.56, w: 0.72, h: 0.035, fill: { color: C.green }, line: { color: C.green } });
    slide.addText(safe(body), { x: x + 0.22, y: y + 0.7, w: 3.15, h: 0.58, fontFace: "Arial", fontSize: 8.8, color: C.muted, fit: "shrink" });
  });
}

function addSteps(slide, steps) {
  steps.forEach((step, i) => {
    const y = 1.6 + i * 0.68;
    slide.addShape("roundRect", { x: 0.8, y, w: 0.38, h: 0.38, rectRadius: 0.05, fill: { color: i % 2 ? C.white : C.black }, line: { color: C.black } });
    slide.addText(String(i + 1), { x: 0.92, y: y + 0.11, w: 0.14, h: 0.08, fontFace: "Arial", fontSize: 7, bold: true, color: i % 2 ? C.black : C.white, align: "center" });
    slide.addText(safe(step.replace(/^\d+\.\s*/, "")), { x: 1.35, y: y + 0.03, w: 7.5, h: 0.3, fontFace: "Arial", fontSize: 12, color: C.black, fit: "shrink" });
  });
}

function addDiagramNode(slide, label, x, y, w, h, opts = {}) {
  const fill = opts.fill || C.white;
  const line = opts.line || C.black;
  const color = opts.color || C.black;
  const fontSize = opts.fontSize || 10.5;
  slide.addShape(opts.shape || "roundRect", {
    x,
    y,
    w,
    h,
    rectRadius: opts.radius || 0.08,
    fill: { color: fill, transparency: opts.transparency || 0 },
    line: { color: line, width: opts.lineWidth || 1 },
  });
  slide.addText(label, {
    x: x + 0.08,
    y: y + h / 2 - 0.13,
    w: w - 0.16,
    h: 0.26,
    fontFace: "Arial",
    fontSize,
    bold: opts.bold !== false,
    color,
    align: "center",
    valign: "mid",
    fit: "shrink",
  });
}

function addDiagramArrow(slide, x1, y1, x2, y2, label, opts = {}) {
  slide.addShape("line", {
    x: x1,
    y: y1,
    w: x2 - x1,
    h: y2 - y1,
    line: {
      color: opts.color || C.ink,
      width: opts.width || 1.15,
      transparency: opts.transparency || 0,
      endArrowType: opts.noArrow ? undefined : "triangle",
      dash: opts.dash,
    },
  });
  if (label) {
    const lx = Math.min(x1, x2) + Math.abs(x2 - x1) / 2 - 0.78;
    const ly = Math.min(y1, y2) + Math.abs(y2 - y1) / 2 - 0.18;
    slide.addShape("roundRect", {
      x: lx,
      y: ly,
      w: 1.56,
      h: 0.27,
      rectRadius: 0.04,
      fill: { color: C.paper, transparency: 3 },
      line: { color: C.line, transparency: 45, width: 0.4 },
    });
    slide.addText(label, {
      x: lx + 0.05,
      y: ly + 0.06,
      w: 1.46,
      h: 0.08,
      fontFace: "Arial",
      fontSize: 6.8,
      italic: true,
      color: opts.labelColor || C.ink,
      align: "center",
      fit: "shrink",
    });
  }
}

function addArchitectureDiagram(slide) {
  slide.addShape("roundRect", { x: 0.75, y: 1.55, w: 8.0, h: 0.68, rectRadius: 0.08, fill: { color: C.black }, line: { color: C.black } });
  slide.addText("Interfaces: Web UI / API / Socket", { x: 1.0, y: 1.78, w: 7.5, h: 0.13, fontFace: "Arial", fontSize: 12, bold: true, color: C.white, align: "center" });
  slide.addShape("rect", { x: 0.75, y: 2.55, w: 8.0, h: 2.4, fill: { color: "FFFFFF", transparency: 18 }, line: { color: C.black, width: 0.8, dash: "dash" } });
  slide.addText("Vercel / Next.js runtime", { x: 1.0, y: 2.74, w: 2.0, h: 0.18, fontFace: "Arial", fontSize: 8.5, bold: true, color: C.muted });

  addDiagramNode(slide, "Next.js App", 4.0, 2.75, 1.65, 0.62, { fill: "EDEDED" });
  addDiagramNode(slide, "API Routes", 1.45, 3.7, 1.7, 0.62, { fill: "EDEDED" });
  addDiagramNode(slide, "Realtime\nPublisher", 6.55, 3.7, 1.7, 0.62, { fill: "EDEDED", fontSize: 9.2 });
  addDiagramNode(slide, "Auth / Role\nGuards", 1.15, 5.45, 1.65, 0.62, { fill: "DBEAFE", line: "BFDBFE", fontSize: 9.2 });
  addDiagramNode(slide, "Prisma ORM", 3.25, 5.45, 1.55, 0.62, { fill: "DBEAFE", line: "BFDBFE" });
  addDiagramNode(slide, "Supabase\nPostgreSQL", 5.08, 5.18, 1.7, 1.05, { fill: "CFFAFE", line: "A5F3FC", fontSize: 9.2 });
  addDiagramNode(slide, "Firebase RTDB", 7.1, 5.45, 1.55, 0.62, { fill: "FEF3C7", line: "FACC15" });

  addDiagramArrow(slide, 4.82, 2.23, 4.82, 2.75, "", { width: 1.0 });
  addDiagramArrow(slide, 4.0, 3.1, 3.15, 3.86, "requests");
  addDiagramArrow(slide, 5.65, 3.1, 6.55, 3.86, "events");
  addDiagramArrow(slide, 2.3, 4.32, 2.05, 5.45, "session");
  addDiagramArrow(slide, 3.15, 4.0, 4.0, 5.45, "query");
  addDiagramArrow(slide, 4.8, 5.76, 5.08, 5.76, "");
  addDiagramArrow(slide, 7.4, 4.32, 7.85, 5.45, "mirror");
  addDiagramArrow(slide, 6.78, 5.76, 7.1, 5.76, "");

  addDiagramNode(slide, "Owner / Staff / Player dashboards", 0.95, 6.42, 3.1, 0.46, { fill: C.white, line: C.line, fontSize: 9 });
  addDiagramNode(slide, "Seat status, booking, tournament updates", 4.35, 6.42, 3.65, 0.46, { fill: C.white, line: C.line, fontSize: 9 });
}

function addQpayDiagram(slide) {
  const x0 = 0.75;
  const laneW = 2.75;
  const lanes = [
    ["User", x0],
    ["Reihen App", x0 + laneW],
    ["QPay", x0 + laneW * 2],
    ["Bank App", x0 + laneW * 3],
  ];
  lanes.forEach(([label, x]) => {
    slide.addText(label, { x, y: 1.55, w: 2.25, h: 0.25, fontFace: "Arial", fontSize: 12, bold: true, color: C.black, align: "center" });
    slide.addShape("line", { x: x + 1.12, y: 1.9, w: 0, h: 4.7, line: { color: C.line, width: 1, dash: "dash" } });
  });

  slide.addShape("rect", { x: 0.62, y: 2.08, w: 11.25, h: 1.48, fill: { color: "FFFFFF", transparency: 25 }, line: { color: C.red, width: 0.7, dash: "dash" } });
  slide.addText("INVOICE CREATE", { x: 10.12, y: 2.18, w: 1.45, h: 0.16, fontFace: "Arial", fontSize: 8, bold: true, color: C.red, align: "right" });
  slide.addShape("rect", { x: 0.62, y: 4.55, w: 11.25, h: 1.68, fill: { color: "FFFFFF", transparency: 35 }, line: { color: C.red, width: 0.7, dash: "dash" } });
  slide.addText("PAYMENT CHECK", { x: 10.05, y: 4.66, w: 1.52, h: 0.16, fontFace: "Arial", fontSize: 8, bold: true, color: C.red, align: "right" });

  addDiagramArrow(slide, 3.0, 2.34, 5.68, 2.34, "/invoice/create", { color: "2563EB" });
  addDiagramArrow(slide, 5.68, 2.78, 3.0, 2.78, "QR or deeplink", { color: "2563EB" });
  addDiagramArrow(slide, 3.0, 3.24, 1.86, 3.24, "show QR", { color: "2563EB" });
  addDiagramArrow(slide, 1.86, 3.9, 9.98, 3.9, "scan QR or open deeplink", { color: "2563EB" });
  addDiagramArrow(slide, 10.05, 4.33, 7.88, 4.33, "decrypt / get invoice", { color: "2563EB" });
  addDiagramArrow(slide, 7.88, 4.82, 10.05, 4.82, "make payment", { color: "2563EB" });
  addDiagramArrow(slide, 10.05, 5.35, 5.68, 5.35, "callback payment result", { color: "2563EB" });
  addDiagramArrow(slide, 3.0, 5.72, 5.68, 5.72, "/payment/check", { color: "2563EB" });
  addDiagramArrow(slide, 5.68, 6.08, 3.0, 6.08, "confirmed / failed", { color: "2563EB" });
  addDiagramArrow(slide, 3.0, 6.42, 1.86, 6.42, "seat confirmed", { color: "2563EB" });

  addDiagramNode(slide, "booking = WAITING", 2.82, 2.16, 1.25, 0.32, { fill: "FEF3C7", line: "FACC15", fontSize: 7.5 });
  addDiagramNode(slide, "booking = CONFIRMED", 2.75, 6.22, 1.42, 0.32, { fill: "DCFCE7", line: "22C55E", fontSize: 7.5 });
}

async function generatePptx() {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "Reihen";
  pptx.subject = "Diploma defense";
  pptx.title = "Reihen Diplom Defense UPDATED 2026";
  pptx.lang = "mn-MN";
  pptx.theme = { headFontFace: "Arial", bodyFontFace: "Arial", lang: "mn-MN" };

  slides.forEach((s, idx) => {
    const slide = pptx.addSlide();
    if (s.kind === "cover") {
      slide.background = { color: C.black };
      slide.addShape("rect", { x: 0, y: 0, w: 13.33, h: 0.1, fill: { color: C.green }, line: { color: C.green } });
      slide.addText("Диплом хамгаалалт · UPDATED 2026", { x: 0.8, y: 0.75, w: 5.2, h: 0.2, fontFace: "Arial", fontSize: 10, color: "BDBDBD", charSpacing: 1.5 });
      slide.addText(s.title, { x: 0.75, y: 1.55, w: 10.6, h: 1.25, fontFace: "Arial", fontSize: 78, bold: true, color: C.white, charSpacing: -2 });
      slide.addText(safe(s.subtitle), { x: 0.85, y: 3.05, w: 9.8, h: 0.72, fontFace: "Arial", fontSize: 17, color: "EEEEEE", fit: "shrink" });
      slide.addShape("rect", { x: 0.85, y: 4.05, w: 2.45, h: 0.055, fill: { color: C.green }, line: { color: C.green } });
      s.bullets.forEach((b, i) => slide.addText(safe(b), { x: 0.85, y: 4.45 + i * 0.38, w: 8.8, h: 0.22, fontFace: "Arial", fontSize: 12, color: "D8D8D8", fit: "shrink" }));
      slide.addText("Book. Pay. Check-in. Play.", { x: 0.85, y: 6.65, w: 7, h: 0.25, fontFace: "Arial", fontSize: 12, bold: true, color: C.green });
      return;
    }

    addBg(slide);
    addHeader(slide, idx);
    addTitle(slide, s.title);
    if (s.kind === "architectureDiagram") {
      addArchitectureDiagram(slide);
      if (s.callout) addCallout(slide, s.callout);
      return;
    }
    if (s.kind === "qpayDiagram") {
      addQpayDiagram(slide);
      return;
    }
    if (s.cards) addCards(slide, s.cards);
    if (s.bullets) addBullets(slide, s.bullets);
    if (s.steps) addSteps(slide, s.steps);
    if (s.callout) addCallout(slide, s.callout);
  });

  await pptx.writeFile({ fileName: PPTX_OUT });
}

function registerFonts(doc) {
  const fontDir = "C:/Windows/Fonts";
  const regular = path.join(fontDir, "arial.ttf");
  const bold = path.join(fontDir, "arialbd.ttf");
  if (fs.existsSync(regular) && fs.existsSync(bold)) {
    doc.registerFont("Sans", regular);
    doc.registerFont("SansBold", bold);
    return { regular: "Sans", bold: "SansBold" };
  }
  return { regular: "Helvetica", bold: "Helvetica-Bold" };
}

function generatePdf() {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      layout: "landscape",
      margin: 0,
      bufferPages: true,
      info: {
        Title: "Reihen Diplom Defense UPDATED 2026",
        Author: "Reihen",
        Subject: "PC Gaming Center booking and operation system",
        CreationDate: new Date(),
      },
    });
    const out = fs.createWriteStream(PDF_OUT);
    out.on("finish", resolve);
    out.on("error", reject);
    doc.on("error", reject);
    doc.pipe(out);
    const font = registerFonts(doc);
    const PAGE_W = doc.page.width;
    const PAGE_H = doc.page.height;
    const W = 960;
    const H = 540;
    const SCALE = Math.min(PAGE_W / W, PAGE_H / H);
    const OFFSET_X = (PAGE_W - W * SCALE) / 2;
    const OFFSET_Y = (PAGE_H - H * SCALE) / 2;
    const LM = 52;
    const CW = W - LM * 2;

    function beginCanvas(bgColor) {
      doc.rect(0, 0, PAGE_W, PAGE_H).fill(bgColor);
      doc.save();
      doc.translate(OFFSET_X, OFFSET_Y);
      doc.scale(SCALE);
    }

    function endCanvas() {
      doc.restore();
    }

    function cover() {
      beginCanvas(`#${C.black}`);
      doc.rect(0, 0, W, H).fill(`#${C.black}`);
      doc.rect(0, 0, W, 9).fill(`#${C.green}`);
      doc.roundedRect(LM, 34, W - LM * 2, 38, 12).fill("#FFFFFF");
      doc.font(font.bold).fontSize(10).fillColor(`#${C.black}`).text("REIHEN", LM + 22, 48, { width: 120 });
      doc.font(font.regular).fontSize(9).fillColor(`#${C.muted}`).text("Diploma Defense · UPDATED 2026", W - LM - 240, 49, { width: 220, align: "right" });
      doc.font(font.bold).fontSize(82).fillColor(`#${C.white}`).text("REIHEN", LM, 145, { width: CW, lineGap: -10 });
      doc.font(font.regular).fontSize(21).fillColor("#E7E7E7").text(slides[0].subtitle, LM + 4, 250, { width: 690, lineGap: 6 });
      doc.moveTo(LM + 4, 340).lineTo(LM + 230, 340).strokeColor(`#${C.green}`).lineWidth(5).stroke();
      doc.font(font.bold).fontSize(14).fillColor(`#${C.green}`).text("Book. Pay. Check-in. Play.", LM + 4, 378);
      doc.font(font.regular).fontSize(11).fillColor("#AFAFAF").text("Next.js · Prisma · Supabase · Firebase RTDB · Vercel", LM + 4, 410);

      doc.roundedRect(690, 150, 190, 210, 18).fill("#101010");
      doc.font(font.bold).fontSize(13).fillColor(`#${C.white}`).text("Defense angle", 715, 178);
      ["Working system", "Realtime seats", "Role-based ops", "Tournament flow"].forEach((t, i) => {
        const y = 215 + i * 34;
        doc.circle(718, y + 6, 4).fill(`#${C.green}`);
        doc.font(font.regular).fontSize(11).fillColor("#D8D8D8").text(t, 734, y, { width: 120 });
      });
      endCanvas();
    }

    function page(title) {
      doc.addPage();
      beginCanvas(`#${C.paper}`);
      doc.rect(0, 0, W, H).fill(`#${C.paper}`);
      doc.rect(0, 0, W, 8).fill(`#${C.black}`);
      doc.roundedRect(LM, 26, W - LM * 2, 36, 10).fill("#FFFFFF").strokeColor(`#${C.line}`).lineWidth(1).stroke();
      doc.font(font.bold).fontSize(9).fillColor(`#${C.black}`).text("REIHEN DEFENSE", LM + 18, 40, { width: 150 });
      doc.font(font.regular).fontSize(8).fillColor(`#${C.muted}`).text("Next.js · Prisma · Supabase · Firebase", W - LM - 260, 41, { width: 240, align: "right" });
      doc.font(font.bold).fontSize(34).fillColor(`#${C.black}`).text(safe(title), LM, 88, { width: CW });
      doc.moveTo(LM, 137).lineTo(W - LM, 137).strokeColor(`#${C.line}`).lineWidth(1).stroke();
      doc.y = 164;
    }

    function bullet(text) {
      if (doc.y > H - 64) return;
      const y = doc.y;
      doc.roundedRect(LM, y - 3, 20, 20, 5).fill(`#${C.black}`);
      doc.circle(LM + 10, y + 7, 3).fill(`#${C.green}`);
      doc.font(font.regular).fontSize(15).fillColor(`#${C.black}`).text(safe(text), LM + 34, y - 2, { width: 575, lineGap: 3 });
      doc.moveDown(0.72);
    }

    function callout(text) {
      if (!text) return;
      doc.roundedRect(680, 166, 210, 230, 18).fill(`#${C.black}`);
      doc.font(font.bold).fontSize(13.5).fillColor(`#${C.white}`).text(safe(text), 704, 196, { width: 162, height: 130, align: "center", lineGap: 4, ellipsis: false });
      doc.rect(735, 360, 90, 5).fill(`#${C.green}`);
    }

    function pdfNode(label, x, y, w, h, fill = "#FFFFFF", stroke = `#${C.black}`, size = 10) {
      doc.roundedRect(x, y, w, h, 9).fill(fill).strokeColor(stroke).lineWidth(1).stroke();
      doc.font(font.bold).fontSize(size).fillColor(`#${C.black}`).text(label, x + 8, y + h / 2 - size / 2, { width: w - 16, align: "center" });
    }

    function pdfArrow(x1, y1, x2, y2, label = "", color = "#2563EB") {
      doc.moveTo(x1, y1).lineTo(x2, y2).strokeColor(color).lineWidth(1.3).stroke();
      const angle = Math.atan2(y2 - y1, x2 - x1);
      const len = 8;
      doc
        .moveTo(x2, y2)
        .lineTo(x2 - len * Math.cos(angle - Math.PI / 6), y2 - len * Math.sin(angle - Math.PI / 6))
        .lineTo(x2 - len * Math.cos(angle + Math.PI / 6), y2 - len * Math.sin(angle + Math.PI / 6))
        .closePath()
        .fill(color);
      if (label) {
        const lx = Math.min(x1, x2) + Math.abs(x2 - x1) / 2 - 62;
        const ly = Math.min(y1, y2) + Math.abs(y2 - y1) / 2 - 13;
        doc.roundedRect(lx, ly, 124, 22, 6).fill(`#${C.paper}`).strokeColor(`#${C.line}`).lineWidth(0.5).stroke();
        doc.font(font.regular).fontSize(8.5).fillColor(`#${C.black}`).text(label, lx + 5, ly + 6, { width: 114, align: "center" });
      }
    }

    function architecturePdf() {
      doc.roundedRect(56, 154, 570, 48, 10).fill(`#${C.black}`);
      doc.font(font.bold).fontSize(16).fillColor(`#${C.white}`).text("Interfaces: Web UI / API / Socket", 86, 170, { width: 510, align: "center" });
      doc.roundedRect(56, 234, 570, 160, 6).fillOpacity(0.72).fill("#FFFFFF").fillOpacity(1).dash(4, { space: 4 }).strokeColor(`#${C.black}`).stroke().undash();
      doc.font(font.bold).fontSize(10).fillColor(`#${C.muted}`).text("Vercel / Next.js runtime", 78, 252);

      pdfNode("Next.js App", 300, 252, 116, 42, "#EDEDED");
      pdfNode("API Routes", 104, 318, 124, 42, "#EDEDED");
      pdfNode("Realtime\nPublisher", 478, 318, 124, 42, "#EDEDED", `#${C.black}`, 9);
      pdfNode("Auth / Role\nGuards", 90, 420, 118, 42, "#DBEAFE", "#BFDBFE", 9);
      pdfNode("Prisma ORM", 246, 420, 112, 42, "#DBEAFE", "#BFDBFE", 10);
      pdfNode("Supabase\nPostgreSQL", 386, 400, 128, 78, "#CFFAFE", "#A5F3FC", 9);
      pdfNode("Firebase RTDB", 542, 420, 112, 42, "#FEF3C7", `#${C.yellow}`, 9);

      pdfArrow(358, 202, 358, 252, "");
      pdfArrow(300, 276, 228, 339, "requests");
      pdfArrow(416, 276, 478, 339, "events");
      pdfArrow(166, 360, 149, 420, "session");
      pdfArrow(228, 339, 246, 436, "query");
      pdfArrow(358, 441, 386, 441, "");
      pdfArrow(540, 360, 598, 420, "mirror");
      pdfArrow(514, 441, 542, 441, "");

      pdfNode("Owner / Staff / Player dashboards", 76, 488, 230, 32, "#FFFFFF", `#${C.line}`, 9);
      pdfNode("Seat status, booking, tournament updates", 340, 488, 270, 32, "#FFFFFF", `#${C.line}`, 9);
    }

    function qpayPdf() {
      const laneW = 210;
      const xs = [70, 70 + laneW, 70 + laneW * 2, 70 + laneW * 3];
      ["User", "Reihen App", "QPay", "Bank App"].forEach((label, i) => {
        doc.font(font.bold).fontSize(16).fillColor(`#${C.black}`).text(label, xs[i], 154, { width: 150, align: "center" });
        doc.moveTo(xs[i] + 75, 190).lineTo(xs[i] + 75, 500).dash(4, { space: 4 }).strokeColor(`#${C.line}`).lineWidth(1).stroke().undash();
      });

      doc.rect(52, 205, 850, 102).fillOpacity(0.55).fill("#FFFFFF").fillOpacity(1).dash(4, { space: 4 }).strokeColor(`#${C.red}`).lineWidth(0.8).stroke().undash();
      doc.font(font.bold).fontSize(10).fillColor(`#${C.red}`).text("INVOICE CREATE", 760, 216, { width: 120, align: "right" });
      doc.rect(52, 370, 850, 118).fillOpacity(0.5).fill("#FFFFFF").fillOpacity(1).dash(4, { space: 4 }).strokeColor(`#${C.red}`).lineWidth(0.8).stroke().undash();
      doc.font(font.bold).fontSize(10).fillColor(`#${C.red}`).text("PAYMENT CHECK", 760, 382, { width: 120, align: "right" });

      pdfArrow(280, 230, 492, 230, "/invoice/create");
      pdfArrow(492, 265, 280, 265, "QR or deeplink");
      pdfArrow(280, 296, 145, 296, "show QR");
      pdfArrow(145, 340, 775, 340, "scan QR or deeplink");
      pdfArrow(775, 382, 565, 382, "decrypt / get invoice");
      pdfArrow(565, 418, 775, 418, "make payment");
      pdfArrow(775, 454, 492, 454, "callback result");
      pdfArrow(280, 482, 492, 482, "/payment/check");
      pdfArrow(492, 512, 280, 512, "confirmed / failed");

      pdfNode("booking = WAITING", 276, 211, 124, 24, "#FEF3C7", `#${C.yellow}`, 8);
      pdfNode("booking = CONFIRMED", 266, 496, 144, 24, "#DCFCE7", `#${C.green}`, 8);
    }

    cover();
    slides.slice(1).forEach((s) => {
      page(s.title);
      if (s.kind === "architectureDiagram") {
        architecturePdf();
        callout(s.callout);
        endCanvas();
        return;
      }
      if (s.kind === "qpayDiagram") {
        qpayPdf();
        endCanvas();
        return;
      }
      if (s.bullets) s.bullets.forEach(bullet);
      if (s.steps) s.steps.forEach(bullet);
      if (s.cards) {
        s.cards.forEach(([title, body], i) => {
          const col = i % 3;
          const row = Math.floor(i / 3);
          const x = LM + col * 285;
          const y = 164 + row * 138;
          doc.roundedRect(x, y, 250, 104, 12).fill("#FFFFFF").strokeColor(`#${C.line}`).lineWidth(1).stroke();
          doc.font(font.bold).fontSize(15).fillColor(`#${C.black}`).text(safe(title), x + 16, y + 17, { width: 215 });
          doc.rect(x + 16, y + 43, 64, 4).fill(`#${C.green}`);
          doc.font(font.regular).fontSize(10.5).fillColor(`#${C.muted}`).text(safe(body), x + 16, y + 57, { width: 215, lineGap: 2 });
        });
      }
      callout(s.callout);
      endCanvas();
    });

    const range = doc.bufferedPageRange();
    for (let i = range.start + 1; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      doc.font(font.regular).fontSize(8).fillColor("#8A8A8A").text(`REIHEN · Diploma Defense · ${i}`, 0, PAGE_H - 18, { width: PAGE_W, align: "center" });
    }

    doc.end();
  });
}

async function main() {
  await generatePptx();
  await generatePdf();
  console.log(PPTX_OUT);
  console.log(PDF_OUT);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
