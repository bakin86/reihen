/**
 * Generates clean diploma defense files:
 * - Reihen-Diplom-Defense-FINAL.pptx
 * - Reihen-Diplom-Defense-FINAL.pdf
 */
const fs = require("fs");
const path = require("path");
const PptxGenJS = require("pptxgenjs");
const PDFDocument = require("pdfkit");

const ROOT = path.join(__dirname, "..");
const PPTX_OUT = path.join(ROOT, "Reihen-Diplom-Defense-DESKTOP.pptx");
const PDF_OUT = path.join(ROOT, "Reihen-Diplom-Defense-DESKTOP.pdf");

const C = {
  black: "050505",
  paper: "F7F7F2",
  white: "FFFFFF",
  muted: "5F5F5A",
  line: "D8D8D0",
  green: "22C55E",
  yellow: "FACC15",
  red: "EF4444",
};

const meta = {
  title: "REIHEN",
  subtitle: "PC тоглоомын төвийн суудал захиалга, төлбөр, owner/staff удирдлага, tournament bracket систем",
  stack: "Next.js 14 · Prisma · Supabase PostgreSQL · Supabase Realtime · Clerk · Vercel",
  year: "2026",
};

const slides = [
  {
    type: "cover",
    title: "REIHEN",
    kicker: "Диплом хамгаалалтын танилцуулга",
    body: meta.subtitle,
    footer: meta.stack,
  },
  {
    title: "Асуудал",
    points: [
      "Монгол дахь PC center-үүдийн захиалга ихэнхдээ утас, чат эсвэл очиж цаг авах хэлбэртэй.",
      "Суудлын давхцал, төлбөр баталгаажаагүй захиалга, no-show бүртгэл алдагдах эрсдэлтэй.",
      "Owner болон staff нь суудал, захиалга, орлого, үйлдлийг нэг dashboard-оос real-time харах боломж муу.",
      "Tournament зохион байгуулах, баг бүртгэх, bracket хөтлөх workflow тусдаа явдаг.",
    ],
    stat: "Нэг платформоор booking + operation + tournament workflow-г нэгтгэнэ.",
  },
  {
    title: "Төслийн зорилго",
    points: [
      "Player: сул суудал харах, цаг сонгох, QPay/wallet balance-аар захиалах.",
      "Owner: center, суудлын map, staff, booking, review, subscription, tournament удирдах.",
      "Staff: check-in, no-show, суудлын төлөв өөрчлөх, тухайн center-ийн booking харах.",
      "Public: centers, events, tournaments, bracket болон team registration харах.",
    ],
    stat: "Role-based system: Player · Owner · Staff · Admin",
  },
  {
    title: "Гол боломжууд",
    cards: [
      ["Seat booking", "Суудал сонгох, цаг авах, төлбөр төлөх, давхцал шалгах."],
      ["Realtime seat status", "OPEN → WAITING → PLAYING төлөв owner/staff/player талд sync хийнэ."],
      ["Owner dashboard", "Орлого, booking, live seat map, customer risk, audit log."],
      ["Staff workflow", "Check-in, no-show, seat status, center assignment permission."],
      ["Wallet top-up", "QPay-р balance цэнэглээд booking-д ашиглах боломж."],
      ["Tournament bracket", "Team registration, payment, bracket editor, public bracket."],
    ],
  },
  {
    title: "Суудлын төлөвийн бизнес логик",
    points: [
      "OPEN: Захиалах боломжтой сул суудал.",
      "WAITING: Төлбөр төлөгдсөн, хэрэглэгч ирээгүй байгаа захиалга.",
      "PLAYING: Owner/staff check-in хийсний дараа тоглож байгаа төлөв.",
      "REPAIR/CLOSED: Owner/staff гараар хаасан эсвэл засвартай суудал.",
      "Owner/staff нь WAITING эсвэл PLAYING суудал дээр дарж booking detail modal харна.",
    ],
    stat: "Төлбөр төлөгдсөнөөр PLAYING болохгүй. Check-in хийсний дараа PLAYING болно.",
  },
  {
    title: "Realtime шийдэл",
    points: [
      "Supabase Realtime publication дээр Seat болон Booking table нэмсэн.",
      "Seat update event centerId filter-ээр сонсож UI-г refresh дарахгүй шинэчилнэ.",
      "Booking realtime event ирэхэд owner/staff dashboard шинэ booking-г татна.",
      "Browser notification sound: owner/staff SOUND ON болгосны дараа шинэ booking дээр beep тоглоно.",
      "Free tier дээр event delay гарвал 4 секундийн fallback polling sync хийнэ.",
    ],
    stat: "Realtime + fallback polling = диплом demo дээр тогтвортой харагдана.",
  },
  {
    title: "Payment ба wallet",
    points: [
      "Booking payment: QPay invoice эсвэл wallet balance.",
      "Wallet top-up: Profile дээр amount сонгоод QPay-р цэнэглэнэ.",
      "QPay callback төлбөрийг шалгаад WalletTopUp-г PAID болгож User.balance нэмнэ.",
      "Balance payment нь transaction + row lock ашиглаж double-spend эрсдэлээс хамгаална.",
      "Refund logic: booking cancel үед eligible бол balance/QPay refund abstraction ашиглана.",
    ],
    stat: "Demo mode mock QPay, production mode real QPay credential нэмэх боломжтой.",
  },
  {
    type: "sequence",
    title: "Business flow: суудал захиалга ба QPay",
    lanes: ["Хэрэглэгч", "Reihen систем", "QPay", "Банкны апп", "Owner / Staff"],
    steps: [
      [0, 1, "Суудал + цаг сонгох"],
      [1, 2, "invoice/create"],
      [2, 1, "QR / Deeplink буцаах"],
      [1, 0, "QR харуулах"],
      [0, 3, "QR уншуулах / deeplink нээх"],
      [3, 2, "Invoice мэдээлэл авах"],
      [3, 2, "Төлбөр хийх"],
      [2, 1, "Callback / payment result"],
      [1, 4, "Realtime booking + sound notif"],
      [4, 1, "Check-in → PLAYING"],
    ],
    stat: "Төлбөр төлөгдсөн үед seat WAITING, staff check-in хийсний дараа PLAYING болно.",
  },
  {
    type: "cost",
    title: "Server cost ба production төлөвлөгөө",
    tiers: [
      ["Demo / диплом", "0₮", "Vercel Free + Supabase Free + Clerk dev + mock QPay"],
      ["Small production", "~80k-180k₮/сар", "Vercel Pro эсвэл Render + Supabase Pro + domain"],
      ["Growth", "~250k-600k₮/сар", "Paid DB, backups, monitoring, persistent worker/socket"],
      ["Enterprise", "Custom", "VPS/Hetzner, dedicated DB, observability, SLA"],
    ],
    points: [
      "Free tier нь demo-д хангалттай боловч cold start болон realtime delay гарч болно.",
      "Production-д хамгийн түрүүнд Supabase Pro, Vercel/Render paid plan, domain, monitoring хэрэгтэй.",
      "Realtime critical бол Supabase Realtime + fallback polling, эсвэл тусдаа persistent socket worker ашиглана.",
      "Зардал нь хэрэглэгч/center/booking-ийн тооноос өснө. Эхний MVP-д server cost бага хэвээр байна.",
    ],
  },
  {
    title: "Architecture",
    cards: [
      ["Frontend", "Next.js App Router, React, Tailwind CSS, responsive owner/player UI."],
      ["API", "Route handlers, Zod validation, role guard, CSRF, rate limit."],
      ["Database", "Supabase PostgreSQL, Prisma ORM, relational schema."],
      ["Auth", "Clerk email auth + legacy seeded demo login support."],
      ["Realtime", "Supabase Realtime + fallback polling + optional socket server."],
      ["Deploy", "Vercel free tier + Supabase free tier demo environment."],
    ],
  },
  {
    title: "Database design",
    cards: [
      ["User", "Role, balance, no-show, restriction, auth profile."],
      ["PCCenter", "Owner, address, images, policy, subscription limits."],
      ["Seat/Floor/Type", "Status, price, map position, realtime update."],
      ["Booking", "Time range, payment status, booking seats relation."],
      ["WalletTopUp", "QPay invoice, paid status, balance increment history."],
      ["Tournament", "Teams, members, matches, score, winner progression."],
    ],
  },
  {
    title: "Owner ба Staff workflow",
    points: [
      "Owner center нэмнэ, seat map/layout тохируулна, staff бүртгэнэ.",
      "Player төлбөр төлөөд booking хиймэгц owner/staff дээр WAITING seat харагдана.",
      "WAITING seat дээр дарвал customer name, phone, booking code, time, paid amount гарна.",
      "Хэрэглэгч ирэхэд CHECK-IN дарж PLAYING болгоно.",
      "Ирээгүй бол NO-SHOW дарж seat release болон customer risk update хийнэ.",
    ],
    stat: "Бодит PC center-ийн өдөр тутмын operation flow-г дуурайсан.",
  },
  {
    title: "Tournament систем",
    points: [
      "Owner tournament үүсгэнэ: game, team size, max teams, entry fee, prize pool.",
      "Player/team public page дээр багийн нэр, тоглогчдын нэрээр бүртгүүлнэ.",
      "Payment paid бол team registration confirmed болно.",
      "Owner bracket generate хийж score, winner, match status засна.",
      "Winner сонгоход дараагийн round руу автоматаар дамжуулах logic байна.",
    ],
    stat: "Booking системээс гадна tournament feature нь төслийг илүү ялгаруулна.",
  },
  {
    title: "UI/UX polish",
    points: [
      "Owner pages дээр light/dark operational console style.",
      "Smooth animation, card hover, responsive layout, mobile visibility сайжруулсан.",
      "Subscription flow: SELECT → confirm payment → owner activation.",
      "Staff creation: center assignment, permission toggle, readable form state.",
      "Seat map дээр booking detail modal, sound notification, live status legend.",
    ],
    stat: "Demo дээр эхний сэтгэгдлийг UI/UX авч явна.",
  },
  {
    title: "Demo хийх дараалал",
    points: [
      "1. Home: center/event/tournament entry харуулна.",
      "2. Player: center detail дээр seat сонгож QPay/wallet payment хийж booking үүсгэнэ.",
      "3. Owner dashboard: realtime WAITING seat, sound notification, booking detail modal харуулна.",
      "4. Staff: check-in хийж seat PLAYING болж өөрчлөгдөхийг харуулна.",
      "5. Wallet: profile дээр QPay top-up хийж balance нэмэгдэхийг харуулна.",
      "6. Tournament: team registration болон bracket editor харуулна.",
    ],
    stat: "Working flow-оо түрүүлж харуулаад, дараа нь architecture тайлбарлана.",
  },
  {
    title: "Testing ба баталгаажуулалт",
    points: [
      "TypeScript check: npx tsc --noEmit амжилттай.",
      "Production build: npm run build амжилттай.",
      "Supabase DB schema sync: Prisma db push ашигласан.",
      "Core flows: auth, booking, payment, wallet, owner/staff, tournament ажиллаж байна.",
      "Free tier latency-г realtime + 4 секунд fallback polling-р demo-д тогтвортой болгосон.",
    ],
    stat: "Энэ нь зөвхөн mock UI биш, ажилладаг full-stack дипломын систем.",
  },
  {
    title: "Цаашдын хөгжүүлэлт",
    points: [
      "Real QPay production credential, webhook security, ebarimt бүрэн тохируулах.",
      "Playwright E2E tests: booking, payment, check-in, tournament.",
      "Admin report/export, detailed finance ledger, wallet transaction history.",
      "Monitoring, error tracking, DB backup policy.",
      "Paid Supabase/Vercel plan ашиглаж latency болон cold start бууруулах.",
    ],
    stat: "MVP demo-ready. Production-д hardening ба monitoring phase хэрэгтэй.",
  },
  {
    title: "Дүгнэлт",
    points: [
      "Reihen нь PC center-ийн бодит workflow-г digital болгох full-stack систем.",
      "Seat booking, payment, wallet, realtime operation, staff workflow, tournament bracket нэг дор ажиллана.",
      "Owner/staff/player role бүрт тусдаа хэрэгцээнд нь тохирсон interface бэлэн.",
      "Диплом хамгаалалтад core feature, architecture, demo flow хангалттай түвшинд бэлтгэгдсэн.",
    ],
    stat: "REIHEN · Book. Pay. Check-in. Play.",
  },
];

const deckSlides = slides.filter((slide) => slide.title !== "Demo Ñ…Ð¸Ð¹Ñ… Ð´Ð°Ñ€Ð°Ð°Ð»Ð°Ð»");

function safeText(text) {
  return String(text).replace(/\u00a0/g, " ");
}

function addBg(slide) {
  slide.background = { color: C.paper };
  slide.addShape("rect", { x: 0, y: 0, w: 13.33, h: 0.08, fill: { color: C.black }, line: { color: C.black } });
  for (let x = 0.45; x < 13.0; x += 0.48) {
    slide.addShape("line", { x, y: 0.08, w: 0, h: 7.25, line: { color: C.line, transparency: 70, width: 0.35 } });
  }
  for (let y = 0.55; y < 7.2; y += 0.38) {
    slide.addShape("line", { x: 0, y, w: 13.33, h: 0, line: { color: C.line, transparency: 78, width: 0.3 } });
  }
}

function addHeader(slide, idx) {
  slide.addShape("roundRect", { x: 0.5, y: 0.18, w: 12.35, h: 0.42, rectRadius: 0.07, fill: { color: C.white, transparency: 2 }, line: { color: C.black, width: 0.8 } });
  slide.addShape("ellipse", { x: 0.73, y: 0.31, w: 0.08, h: 0.08, fill: { color: C.red }, line: { color: C.red } });
  slide.addShape("ellipse", { x: 0.88, y: 0.31, w: 0.08, h: 0.08, fill: { color: C.yellow }, line: { color: C.yellow } });
  slide.addShape("ellipse", { x: 1.03, y: 0.31, w: 0.08, h: 0.08, fill: { color: C.green }, line: { color: C.green } });
  slide.addText("reihen.vercel.app / owner dashboard", { x: 1.35, y: 0.29, w: 4.2, h: 0.12, fontFace: "Arial", fontSize: 6.8, bold: true, color: C.muted, charSpacing: 1, fit: "shrink" });
  slide.addText("BOOK", { x: 8.2, y: 0.29, w: 0.55, h: 0.12, fontFace: "Arial", fontSize: 6.5, bold: true, color: C.black, charSpacing: 1, align: "center" });
  slide.addText("EVENTS", { x: 8.85, y: 0.29, w: 0.75, h: 0.12, fontFace: "Arial", fontSize: 6.5, bold: true, color: C.black, charSpacing: 1, align: "center" });
  slide.addText("DASHBOARD", { x: 9.7, y: 0.29, w: 1.05, h: 0.12, fontFace: "Arial", fontSize: 6.5, bold: true, color: C.black, charSpacing: 1, align: "center" });
  slide.addShape("roundRect", { x: 11.35, y: 0.24, w: 1.18, h: 0.28, rectRadius: 0.06, fill: { color: C.black }, line: { color: C.black } });
  slide.addText(String(idx + 1).padStart(2, "0"), { x: 11.55, y: 0.32, w: 0.78, h: 0.08, fontFace: "Arial", fontSize: 6.5, bold: true, color: C.white, align: "center" });
}

function addTitle(slide, title) {
  slide.addText(safeText(title), { x: 0.6, y: 0.75, w: 11.5, h: 0.55, fontFace: "Arial", fontSize: 26, bold: true, color: C.black, fit: "shrink" });
}

function addBullets(slide, points) {
  points.forEach((p, i) => {
    const y = 1.65 + i * 0.67;
    slide.addShape("rect", { x: 0.72, y: y + 0.12, w: 0.08, h: 0.08, fill: { color: C.green }, line: { color: C.green } });
    slide.addText(safeText(p), { x: 0.95, y, w: 7.7, h: 0.46, fontFace: "Arial", fontSize: 12.4, color: C.black, fit: "shrink" });
  });
}

function addStat(slide, text) {
  slide.addShape("roundRect", { x: 9.05, y: 1.85, w: 3.55, h: 3.0, rectRadius: 0.08, fill: { color: C.black }, line: { color: C.black } });
  slide.addText(safeText(text), { x: 9.35, y: 2.25, w: 2.95, h: 1.75, fontFace: "Arial", fontSize: 16, bold: true, color: C.white, align: "center", valign: "mid", fit: "shrink" });
  slide.addShape("rect", { x: 10.2, y: 4.32, w: 1.2, h: 0.04, fill: { color: C.green }, line: { color: C.green } });
}

function addCards(slide, cards) {
  cards.forEach(([title, body], i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = 0.65 + col * 4.1;
    const y = 1.75 + row * 2.05;
    slide.addShape("roundRect", { x, y, w: 3.72, h: 1.55, rectRadius: 0.08, fill: { color: C.white }, line: { color: C.line } });
    slide.addText(safeText(title), { x: x + 0.22, y: y + 0.2, w: 3.25, h: 0.28, fontFace: "Arial", fontSize: 12.5, bold: true, color: C.black, fit: "shrink" });
    slide.addShape("rect", { x: x + 0.22, y: y + 0.59, w: 0.75, h: 0.035, fill: { color: C.green }, line: { color: C.green } });
    slide.addText(safeText(body), { x: x + 0.22, y: y + 0.73, w: 3.2, h: 0.58, fontFace: "Arial", fontSize: 9.2, color: C.muted, fit: "shrink" });
  });
}

function addSequence(slide, data) {
  const laneX = [0.55, 3.0, 5.45, 7.9, 10.35];
  data.lanes.forEach((lane, i) => {
    slide.addText(safeText(lane), {
      x: laneX[i],
      y: 1.35,
      w: 2.0,
      h: 0.24,
      fontFace: "Arial",
      fontSize: 9.5,
      bold: true,
      color: C.black,
      align: "center",
      fit: "shrink",
    });
    slide.addShape("line", {
      x: laneX[i] + 1,
      y: 1.7,
      w: 0,
      h: 4.95,
      line: { color: C.line, transparency: 20, dash: "dash" },
    });
  });

  data.steps.forEach(([from, to, label], i) => {
    const y = 1.85 + i * 0.42;
    const fromX = laneX[from] + 1;
    const toX = laneX[to] + 1;
    const left = Math.min(fromX, toX);
    const width = Math.abs(toX - fromX);
    slide.addShape("line", {
      x: left,
      y,
      w: width,
      h: 0,
      line: { color: from < to ? C.black : C.green, width: 1.1, beginArrowType: from > to ? "triangle" : "none", endArrowType: from < to ? "triangle" : "none" },
    });
    slide.addText(safeText(label), {
      x: left + 0.08,
      y: y - 0.18,
      w: Math.max(width - 0.16, 1.3),
      h: 0.18,
      fontFace: "Arial",
      fontSize: 7.8,
      italic: true,
      color: C.black,
      align: "center",
      fit: "shrink",
    });
  });

  slide.addShape("roundRect", { x: 0.6, y: 6.58, w: 12.1, h: 0.44, rectRadius: 0.04, fill: { color: C.black }, line: { color: C.black } });
  slide.addText(safeText(data.stat), { x: 0.85, y: 6.68, w: 11.55, h: 0.18, fontFace: "Arial", fontSize: 8.4, bold: true, color: C.white, align: "center", fit: "shrink" });
}

function addCost(slide, data) {
  data.tiers.forEach(([tier, cost, desc], i) => {
    const y = 1.6 + i * 0.92;
    slide.addShape("roundRect", { x: 0.7, y, w: 5.05, h: 0.68, rectRadius: 0.05, fill: { color: i === 0 ? C.black : C.white }, line: { color: C.line } });
    slide.addText(safeText(tier), { x: 0.92, y: y + 0.12, w: 1.8, h: 0.18, fontFace: "Arial", fontSize: 10, bold: true, color: i === 0 ? C.white : C.black, fit: "shrink" });
    slide.addText(safeText(cost), { x: 2.75, y: y + 0.11, w: 1.45, h: 0.18, fontFace: "Arial", fontSize: 10, bold: true, color: i === 0 ? C.green : C.black, fit: "shrink" });
    slide.addText(safeText(desc), { x: 0.92, y: y + 0.36, w: 4.35, h: 0.18, fontFace: "Arial", fontSize: 7.7, color: i === 0 ? "D9D9D9" : C.muted, fit: "shrink" });
  });
  data.points.forEach((p, i) => {
    const y = 1.67 + i * 0.78;
    slide.addShape("rect", { x: 6.45, y: y + 0.11, w: 0.08, h: 0.08, fill: { color: C.green }, line: { color: C.green } });
    slide.addText(safeText(p), { x: 6.68, y, w: 5.75, h: 0.42, fontFace: "Arial", fontSize: 11, color: C.black, fit: "shrink" });
  });
  slide.addShape("roundRect", { x: 6.45, y: 5.15, w: 5.9, h: 1.0, rectRadius: 0.06, fill: { color: C.black }, line: { color: C.black } });
  slide.addText("MVP cost бага, production hardening үед зардал үе шаттай нэмэгдэнэ.", { x: 6.75, y: 5.48, w: 5.3, h: 0.24, fontFace: "Arial", fontSize: 12.5, bold: true, color: C.white, align: "center", fit: "shrink" });
}

async function generatePptx() {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "Reihen";
  pptx.company = "Reihen";
  pptx.subject = "Diploma defense";
  pptx.title = "Reihen Diplom Defense FINAL";
  pptx.lang = "mn-MN";
  pptx.theme = { headFontFace: "Arial", bodyFontFace: "Arial", lang: "mn-MN" };

  deckSlides.forEach((s, idx) => {
    const slide = pptx.addSlide();
    if (s.type === "cover") {
      slide.background = { color: C.black };
      slide.addShape("rect", { x: 0, y: 0, w: 13.33, h: 0.1, fill: { color: C.green }, line: { color: C.green } });
      slide.addShape("roundRect", { x: 2.35, y: 0.36, w: 8.65, h: 0.5, rectRadius: 0.07, fill: { color: C.white }, line: { color: C.white } });
      slide.addText("REIHEN", { x: 2.72, y: 0.53, w: 1.0, h: 0.08, fontFace: "Arial", fontSize: 7.2, bold: true, color: C.black, charSpacing: 1.5 });
      slide.addText("BOOK     EVENTS     LOGIN", { x: 6.15, y: 0.53, w: 2.45, h: 0.08, fontFace: "Arial", fontSize: 6.3, bold: true, color: C.black, charSpacing: 1.5, align: "center", fit: "shrink" });
      slide.addShape("roundRect", { x: 9.55, y: 0.45, w: 0.98, h: 0.28, rectRadius: 0.05, fill: { color: C.black }, line: { color: C.black } });
      slide.addText("REGISTER", { x: 9.66, y: 0.54, w: 0.76, h: 0.06, fontFace: "Arial", fontSize: 5.3, bold: true, color: C.white, charSpacing: 0.8, align: "center" });
      slide.addText(safeText(s.kicker), { x: 0.75, y: 0.72, w: 8, h: 0.3, fontFace: "Arial", fontSize: 10, color: "BDBDBD", charSpacing: 2 });
      slide.addText(s.title, { x: 0.75, y: 1.45, w: 10.6, h: 1.25, fontFace: "Arial", fontSize: 78, bold: true, color: C.white, charSpacing: -2 });
      slide.addText(safeText(s.body), { x: 0.85, y: 3.0, w: 9.6, h: 0.8, fontFace: "Arial", fontSize: 18, color: "E8E8E8", fit: "shrink" });
      slide.addShape("rect", { x: 0.85, y: 4.15, w: 2.4, h: 0.05, fill: { color: C.green }, line: { color: C.green } });
      slide.addText(safeText(s.footer), { x: 0.85, y: 6.78, w: 11.7, h: 0.35, fontFace: "Arial", fontSize: 9, color: "8A8A8A" });
      return;
    }

    addBg(slide);
    addHeader(slide, idx);
    addTitle(slide, s.title);
    if (s.type === "sequence") {
      addSequence(slide, s);
      return;
    }
    if (s.type === "cost") {
      addCost(slide, s);
      return;
    }
    if (s.points) {
      addBullets(slide, s.points);
      addStat(slide, s.stat);
    }
    if (s.cards) addCards(slide, s.cards);
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
      margin: 44,
      bufferPages: true,
      info: {
        Title: "Reihen Diplom Defense FINAL",
        Author: "Reihen",
        Subject: "PC Gaming Center booking and management system",
        CreationDate: new Date(),
      },
    });
    const out = fs.createWriteStream(PDF_OUT);
    out.on("finish", resolve);
    out.on("error", reject);
    doc.on("error", reject);
    doc.pipe(out);
    const font = registerFonts(doc);
    const W = doc.page.width;
    const H = doc.page.height;
    const LM = 48;
    const CW = W - LM * 2;

    function cover() {
      doc.rect(0, 0, W, H).fill(`#${C.black}`);
      doc.rect(0, 0, W, 8).fill(`#${C.green}`);
      doc.font(font.bold).fontSize(58).fillColor(`#${C.white}`).text("REIHEN", LM, 170, { width: CW });
      doc.font(font.regular).fontSize(13).fillColor("#DDDDDD").text(meta.subtitle, LM, 266, { width: CW, lineGap: 5 });
      doc.moveTo(LM, 342).lineTo(LM + 160, 342).strokeColor(`#${C.green}`).lineWidth(3).stroke();
      doc.font(font.regular).fontSize(9).fillColor("#999999").text(`Диплом хамгаалалт · ${meta.year}`, LM, 390);
      doc.text(meta.stack, LM, 412, { width: CW });
    }

    function newPage(title) {
      doc.addPage();
      doc.rect(0, 0, W, H).fill(`#${C.paper}`);
      doc.rect(0, 0, W, 6).fill(`#${C.black}`);
      doc.font(font.bold).fontSize(20).fillColor(`#${C.black}`).text(safeText(title), LM, 46, { width: CW });
      doc.moveTo(LM, 82).lineTo(W - LM, 82).strokeColor(`#${C.line}`).lineWidth(1).stroke();
      doc.y = 106;
    }

    function bullet(text) {
      if (doc.y > H - 90) doc.addPage();
      const y = doc.y;
      doc.circle(LM + 4, y + 6, 2.4).fill(`#${C.green}`);
      doc.font(font.regular).fontSize(10.4).fillColor(`#${C.black}`).text(safeText(text), LM + 18, y, { width: CW - 18, lineGap: 3 });
      doc.moveDown(0.45);
    }

    function stat(text) {
      if (doc.y > H - 110) doc.addPage();
      const y = doc.y + 8;
      doc.roundedRect(LM, y, CW, 54, 8).fill(`#${C.black}`);
      doc.font(font.bold).fontSize(12).fillColor(`#${C.white}`).text(safeText(text), LM + 16, y + 14, { width: CW - 32, align: "center" });
      doc.y = y + 72;
    }

    cover();
    deckSlides.slice(1).forEach((s) => {
      newPage(s.title);
      if (s.points) s.points.forEach(bullet);
      if (s.cards) {
        s.cards.forEach(([k, v]) => {
          if (doc.y > H - 72) doc.addPage();
          doc.font(font.bold).fontSize(11).fillColor(`#${C.black}`).text(safeText(k), LM, doc.y);
          doc.font(font.regular).fontSize(10).fillColor(`#${C.muted}`).text(safeText(v), LM + 12, doc.y + 4, { width: CW - 12, lineGap: 2 });
          doc.moveDown(0.7);
        });
      }
      if (s.type === "sequence") {
        doc.font(font.bold).fontSize(10.5).fillColor(`#${C.black}`).text("Sequence lanes:", LM, doc.y);
        doc.moveDown(0.3);
        s.steps.forEach(([from, to, label], idx) => {
          const line = `${idx + 1}. ${s.lanes[from]} → ${s.lanes[to]}: ${label}`;
          bullet(line);
        });
      }
      if (s.type === "cost") {
        s.tiers.forEach(([tier, cost, desc]) => {
          if (doc.y > H - 76) doc.addPage();
          doc.font(font.bold).fontSize(11).fillColor(`#${C.black}`).text(`${tier} · ${cost}`, LM, doc.y);
          doc.font(font.regular).fontSize(10).fillColor(`#${C.muted}`).text(safeText(desc), LM + 12, doc.y + 4, { width: CW - 12 });
          doc.moveDown(0.65);
        });
        doc.moveDown(0.3);
        s.points.forEach(bullet);
      }
      if (s.stat) stat(s.stat);
    });

    const range = doc.bufferedPageRange();
    for (let i = range.start + 1; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      doc.font(font.regular).fontSize(8).fillColor("#888888").text(`REIHEN · Diploma Defense · ${i}`, LM, H - 35, { width: CW, align: "center" });
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
