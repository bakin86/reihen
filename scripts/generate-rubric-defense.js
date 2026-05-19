const fs = require("fs");
const path = require("path");
const PptxGenJS = require("pptxgenjs");
const PDFDocument = require("pdfkit");

const ROOT = path.join(__dirname, "..");
const PPTX_OUT = path.join(ROOT, "Reihen-Defense-Rubric-2026.pptx");
const PDF_OUT = path.join(ROOT, "Reihen-Defense-Rubric-2026.pdf");

const C = {
  ink: "101010",
  paper: "F7F7F2",
  white: "FFFFFF",
  soft: "E8E8E1",
  muted: "666660",
  green: "22C55E",
  blue: "4F83E8",
  orange: "F97316",
  red: "EF4444",
};

const codeFacts = {
  stack: [
    "Next.js 14 App Router, React 18, TypeScript, Tailwind CSS",
    "Prisma ORM, Supabase PostgreSQL, Supabase Realtime, Firebase fallback",
    "JWT/Clerk auth, role guard: Player, Owner, Staff, Admin",
    "QPay invoice, wallet top-up, balance payment, callback verification",
    "Leaflet map, owner draggable marker, seat type PC specs",
    "Tournament teams, bracket matches, owner score/winner workflow",
  ],
  modules: [
    "app/api/bookings, app/api/qpay/callback, app/api/wallet/topup",
    "app/api/owner/centers, owner seats/status/layout/staff/reviews",
    "components/LeafletCentersMap, LocationPickerMap, BlueprintSeatMap",
    "lib/useSeatSocket, lib/firebase-client/admin, lib/cron, lib/auth",
    "prisma/schema.prisma: User, PCCenter, Seat, Booking, WalletTopUp, Tournament",
  ],
};

const slides = [
  {
    kind: "cover",
    title: "REIHEN",
    subtitle: "PC Gaming Center Booking, Payment, Realtime Operation and Tournament Platform",
    footer: "Диплом хамгаалалт · 2026 · Next.js + Supabase + Firebase + Vercel",
  },
  {
    title: "1. Танилцуулга",
    score: "15 оноо",
    points: [
      "Зорилго: PC center-ийн суудал захиалга, төлбөр, check-in, owner/staff operation-ийг нэг системд нэгтгэх.",
      "Хамрах хүрээ: player booking, owner dashboard, staff check-in/no-show, wallet/QPay, review, tournament bracket.",
      "Бүтэц: асуудал, шийдэл, архитектур, хэрэгжилт, тестлэлт, эрсдэл, demo дарааллаар тайлбарлана.",
    ],
    callout: "Үндсэн санаа: Book → Pay → Check-in → Play workflow-ийг бодит цагт ажиллуулна.",
  },
  {
    title: "2. Асуудал ба шийдэл",
    score: "25 оноо",
    points: [
      "Асуудал: PC center-үүд суудлын төлөв, төлбөр, no-show, staff check-in-ийг ихэвчлэн чат/утсаар салангид удирддаг.",
      "Нотолгоо: гараар захиалга авах үед давхардал, төлбөр баталгаажаагүй booking, staff мэдээлэл хоцрох эрсдэлтэй.",
      "Шийдэл: real-time seat map, QPay/wallet payment, role-based dashboard, tournament bracket-ийг нэг platform-д холбосон.",
      "Өрсөлдөгчөөс ялгарах нь: зөвхөн booking биш, owner/staff operation болон tournament workflow багтсан.",
    ],
    callout: "Reihen нь хэрэглэгчийн UI + бизнес operation + төлбөрийн урсгалыг нэгтгэсэн full-stack MVP.",
  },
  {
    kind: "architecture",
    title: "3. Техникийн дэд бүтэц",
    score: "20 оноо",
  },
  {
    kind: "sequence",
    title: "QPay booking sequence",
    score: "Payment flow",
  },
  {
    title: "4. Кодын хэрэгжилт",
    score: "25 оноо",
    points: [
      "Codebase: Next.js app router, typed API route handlers, Prisma schema, reusable UI components.",
      "Гол функцүүд: center search/map, draggable owner location, seat booking, payment callback, wallet top-up, check-in, reviews, tournaments.",
      "Realtime: Supabase/Firebase/socket fallback ашиглан seat update, booking update, owner/staff notification-ийг sync хийдэг.",
      "Security: auth guard, owner/staff access guard, zod validation, bcrypt/JWT, rate limit, role-based API.",
      "Demo: npm run build амжилттай, Vercel + Supabase + Firebase deployment дээр ажилладаг.",
    ],
    callout: "Энэ нь static prototype биш, backend болон database-тэй ажилладаг production-style system.",
  },
  {
    title: "5. Database design",
    score: "Implementation evidence",
    points: [
      "User: role, balance, no-show count, restriction, auth profile.",
      "PCCenter: owner, address, district, images, lat/lng, rating, policy, staff.",
      "Seat/Floor/SeatType: layout position, status, price, PC spec description.",
      "Booking/BookingSeat: time range, multi-seat reservation, payment state.",
      "WalletTopUp/QPay: invoice id, paid status, balance increment history.",
      "Tournament/Team/Match: team registration, bracket round, score, winner propagation.",
    ],
    callout: "Schema нь booking system, operation system, payment ledger, tournament system-ийг салангид relation-оор барьсан.",
  },
  {
    kind: "risk",
    title: "6. Эрсдэлийн менежмент",
    score: "15 оноо",
  },
  {
    title: "Demo дараалал",
    score: "Live demo",
    points: [
      "1. /centers: Leaflet map дээр center сонгох, specs харах.",
      "2. Owner edit: marker чирж center location тохируулах, seat type дээр RTX/Hz spec оруулах.",
      "3. Player: суудал сонгох, QPay/wallet payment хийх.",
      "4. Owner/Staff: WAITING booking харах, check-in дарахад seat PLAYING болно.",
      "5. Profile: wallet top-up, booking history, favorite centers.",
      "6. Tournament: team registration, owner bracket management.",
    ],
    callout: "Demo нь rubric-ийн 'ажиллагаатай demo' болон 'гол шаардлага хэрэгжсэн' хэсгийг шууд нотолно.",
  },
  {
    title: "Үнэлгээний хүснэгтэд тааруулсан дүгнэлт",
    score: "100 онооны стратеги",
    points: [
      "Танилцуулга: зорилго, хамрах хүрээ, logical flow тодорхой.",
      "Асуудал/шийдэл: бодит workflow pain point + шууд холбоотой шийдэл.",
      "Техник: Next.js/Supabase/Firebase/QPay/Leaflet architecture үндэслэлтэй.",
      "Код: route handlers, Prisma schema, realtime hooks, role guard, UI components хэрэгжсэн.",
      "Эрсдэл: payment callback, concurrency, realtime delay, free-tier limitation-ийг тодорхойлж mitigation гаргасан.",
    ],
    callout: "Зорилго: зөвхөн гоё slide биш, rubric бүрт оноо авах нотолгоо гаргах.",
  },
];

function pptText(slide, text, x, y, w, h, opts = {}) {
  slide.addText(text, {
    x, y, w, h,
    margin: 0.05,
    fit: "shrink",
    fontFace: "Arial",
    color: C.ink,
    breakLine: false,
    ...opts,
  });
}

function bg(slide, idx) {
  slide.background = { color: C.paper };
  slide.addShape("rect", { x: 0, y: 0, w: 13.33, h: 0.05, fill: { color: C.ink }, line: { color: C.ink } });
  for (let x = 0; x <= 13.33; x += 0.5) slide.addShape("line", { x, y: 0, w: 0, h: 7.5, line: { color: C.soft, transparency: 20, width: 0.2 } });
  for (let y = 0; y <= 7.5; y += 0.38) slide.addShape("line", { x: 0, y, w: 13.33, h: 0, line: { color: C.soft, transparency: 20, width: 0.2 } });
  slide.addShape("roundRect", { x: 0.32, y: 0.24, w: 2.0, h: 0.27, rectRadius: 0.04, fill: { color: C.white, transparency: 5 }, line: { color: C.ink, width: 0.7 } });
  pptText(slide, `REIHEN / ${String(idx).padStart(2, "0")}`, 0.48, 0.32, 1.7, 0.08, { fontSize: 6.5, bold: true, charSpacing: 1.4 });
}

function addBullets(slide, points) {
  points.forEach((p, i) => {
    const y = 1.7 + i * 0.62;
    slide.addShape("ellipse", { x: 0.78, y: y + 0.1, w: 0.08, h: 0.08, fill: { color: C.green }, line: { color: C.green } });
    pptText(slide, p, 1.0, y, 7.7, 0.44, { fontSize: 12, color: C.ink });
  });
}

function addCallout(slide, text) {
  slide.addShape("roundRect", { x: 9.1, y: 1.72, w: 3.55, h: 3.05, rectRadius: 0.08, fill: { color: C.ink }, line: { color: C.ink } });
  pptText(slide, text, 9.38, 2.15, 3.0, 1.8, { fontSize: 15, bold: true, color: C.white, align: "center", valign: "mid" });
  slide.addShape("rect", { x: 10.15, y: 4.38, w: 1.3, h: 0.04, fill: { color: C.green }, line: { color: C.green } });
}

function makeArchitecture(slide) {
  const groups = [
    ["Interfaces\nUI / SDK / API", 3.8, 0.95, 5.7, 0.6, C.blue],
    ["Reihen App\nNext.js Pages · React · Leaflet", 0.65, 2.0, 3.25, 0.86, C.white],
    ["API Layer\nRoute handlers · Zod · Auth Guard", 5.0, 2.0, 3.25, 0.86, C.white],
    ["Event Services\nRealtime · Firebase · Socket fallback", 9.35, 2.0, 3.25, 0.86, C.white],
    ["External Services\nQPay · Clerk · Vercel", 0.95, 4.2, 2.55, 0.8, "D7EAFB"],
    ["Database\nSupabase PostgreSQL · Prisma", 5.25, 4.05, 2.75, 0.95, "D7EAFB"],
    ["Blob Storage\nImages · Uploads", 9.85, 4.2, 2.55, 0.8, "D7EAFB"],
  ];
  groups.forEach(([text, x, y, w, h, color]) => {
    slide.addShape("rect", { x, y, w, h, fill: { color }, line: { color: color === C.white ? "BDBDBD" : color } });
    pptText(slide, text, x + 0.1, y + 0.14, w - 0.2, h - 0.15, { fontSize: 11, bold: color === C.blue, color: color === C.blue ? C.white : C.ink, align: "center", valign: "mid" });
  });
  const arrows = [
    [6.65, 1.55, 0, 0.45], [3.9, 2.42, 1.1, 0], [8.25, 2.42, 1.1, 0],
    [2.3, 2.86, 0, 1.32], [6.62, 2.86, 0, 1.18], [10.65, 2.86, 0, 1.32],
    [3.5, 4.6, 1.75, 0], [8.0, 4.6, 1.85, 0],
  ];
  arrows.forEach(([x, y, w, h]) => slide.addShape("line", { x, y, w, h, line: { color: C.ink, width: 1, endArrowType: "triangle" } }));
  pptText(slide, "Scanned code evidence:\n" + codeFacts.modules.join("\n"), 0.7, 5.65, 11.7, 0.82, { fontSize: 8.8, color: C.muted });
}

function makeSequence(slide) {
  const lanes = ["Хэрэглэгч", "Reihen", "QPay", "Банкны апп", "Owner/Staff"];
  const xs = [0.8, 3.25, 5.7, 8.15, 10.6];
  lanes.forEach((lane, i) => {
    pptText(slide, lane, xs[i], 1.05, 1.65, 0.2, { fontSize: 10, align: "center" });
    slide.addShape("line", { x: xs[i] + 0.82, y: 1.45, w: 0, h: 5.05, line: { color: "A6A6A6", dash: "dash" } });
  });
  const steps = [
    [0, 1, "seat + time"],
    [1, 2, "invoice/create"],
    [2, 1, "QR / deeplink"],
    [1, 0, "show QR"],
    [0, 3, "scan / open"],
    [3, 2, "make payment"],
    [2, 1, "callback result"],
    [1, 4, "booking realtime"],
    [4, 1, "check-in"],
  ];
  steps.forEach(([a, b, label], i) => {
    const y = 1.72 + i * 0.48;
    const x1 = xs[a] + 0.82;
    const x2 = xs[b] + 0.82;
    const left = Math.min(x1, x2);
    slide.addShape("line", { x: left, y, w: Math.abs(x2 - x1), h: 0, line: { color: C.blue, width: 1, endArrowType: a < b ? "triangle" : "none", beginArrowType: a > b ? "triangle" : "none" } });
    pptText(slide, label, left + 0.08, y - 0.18, Math.max(Math.abs(x2 - x1) - 0.16, 1), 0.16, { fontSize: 8, italic: true, align: "center" });
  });
  slide.addShape("roundRect", { x: 0.8, y: 6.58, w: 11.7, h: 0.42, rectRadius: 0.04, fill: { color: C.ink }, line: { color: C.ink } });
  pptText(slide, "Payment paid → seat WAITING. Staff check-in → seat PLAYING. Callback/fallback check prevents unpaid booking.", 1.0, 6.7, 11.3, 0.12, { fontSize: 8.5, bold: true, color: C.white, align: "center" });
}

function makeRisk(slide) {
  const risks = [
    ["Payment callback spoofing", "Webhook/result check, invoice id tracking, paid status update only after verification", "High"],
    ["Double booking", "Booking transaction, overlap check, seat status sync", "High"],
    ["Realtime delay", "Supabase/Firebase/socket + polling fallback", "Medium"],
    ["Free-tier cold start", "Warmup script, Vercel/Supabase paid plan path", "Medium"],
    ["Bad owner data", "Zod validation, editable map marker, required seat type fields", "Low"],
  ];
  pptText(slide, "Эрсдэл", 0.7, 1.45, 2.2, 0.25, { fontSize: 10, bold: true, color: C.muted });
  pptText(slide, "Арга хэмжээ", 3.55, 1.45, 5.2, 0.25, { fontSize: 10, bold: true, color: C.muted });
  pptText(slide, "Priority", 10.9, 1.45, 1.2, 0.25, { fontSize: 10, bold: true, color: C.muted, align: "center" });
  risks.forEach(([risk, mitigation, priority], i) => {
    const y = 1.85 + i * 0.78;
    slide.addShape("roundRect", { x: 0.65, y, w: 11.9, h: 0.6, rectRadius: 0.04, fill: { color: C.white }, line: { color: C.soft } });
    pptText(slide, risk, 0.85, y + 0.17, 2.4, 0.14, { fontSize: 10.5, bold: true });
    pptText(slide, mitigation, 3.55, y + 0.15, 5.9, 0.18, { fontSize: 9.4, color: C.muted });
    const color = priority === "High" ? C.red : priority === "Medium" ? C.orange : C.green;
    slide.addShape("roundRect", { x: 10.95, y: y + 0.14, w: 1.0, h: 0.25, rectRadius: 0.04, fill: { color }, line: { color } });
    pptText(slide, priority, 11.0, y + 0.2, 0.9, 0.07, { fontSize: 7.4, bold: true, color: C.white, align: "center" });
  });
}

async function generatePptx() {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "Reihen";
  pptx.subject = "Diploma defense rubric";
  pptx.title = "Reihen Defense Rubric 2026";
  pptx.lang = "mn-MN";
  pptx.theme = { headFontFace: "Arial", bodyFontFace: "Arial" };

  slides.forEach((s, i) => {
    const slide = pptx.addSlide();
    if (s.kind === "cover") {
      slide.background = { color: C.ink };
      slide.addShape("rect", { x: 0, y: 0, w: 13.33, h: 0.07, fill: { color: C.green }, line: { color: C.green } });
      pptText(slide, s.title, 0.75, 1.45, 11.8, 1.0, { fontSize: 78, bold: true, color: C.white, align: "center" });
      pptText(slide, s.subtitle, 1.5, 3.05, 10.4, 0.55, { fontSize: 19, color: "DDDDDD", align: "center" });
      slide.addShape("rect", { x: 5.25, y: 4.0, w: 2.8, h: 0.04, fill: { color: C.green }, line: { color: C.green } });
      pptText(slide, s.footer, 1.2, 6.7, 10.9, 0.28, { fontSize: 10, color: "999999", align: "center" });
      return;
    }
    bg(slide, i);
    pptText(slide, s.title, 0.65, 0.78, 8.0, 0.45, { fontSize: 25, bold: true });
    pptText(slide, s.score || "", 10.65, 0.84, 1.7, 0.22, { fontSize: 10, bold: true, color: C.orange, align: "right" });
    if (s.kind === "architecture") makeArchitecture(slide);
    else if (s.kind === "sequence") makeSequence(slide);
    else if (s.kind === "risk") makeRisk(slide);
    else {
      addBullets(slide, s.points);
      addCallout(slide, s.callout);
    }
  });

  await pptx.writeFile({ fileName: PPTX_OUT });
}

function fontPaths(doc) {
  const regular = "C:/Windows/Fonts/arial.ttf";
  const bold = "C:/Windows/Fonts/arialbd.ttf";
  if (fs.existsSync(regular)) doc.registerFont("ArialLocal", regular);
  if (fs.existsSync(bold)) doc.registerFont("ArialBoldLocal", bold);
  return {
    regular: fs.existsSync(regular) ? "ArialLocal" : "Helvetica",
    bold: fs.existsSync(bold) ? "ArialBoldLocal" : "Helvetica-Bold",
  };
}

function generatePdf() {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 44, bufferPages: true });
    const out = fs.createWriteStream(PDF_OUT);
    out.on("finish", resolve);
    out.on("error", reject);
    doc.on("error", reject);
    doc.pipe(out);
    const F = fontPaths(doc);
    const W = doc.page.width;
    const H = doc.page.height;
    const margin = 48;
    const width = W - margin * 2;

    function page(title) {
      doc.addPage();
      doc.rect(0, 0, W, H).fill("#F7F7F2");
      doc.rect(0, 0, W, 7).fill("#101010");
      doc.font(F.bold).fontSize(20).fillColor("#101010").text(title, margin, 46, { width });
      doc.moveTo(margin, 82).lineTo(W - margin, 82).strokeColor("#D8D8D0").stroke();
      doc.y = 108;
    }
    function bullet(text) {
      if (doc.y > H - 95) page("Үргэлжлэл");
      const y = doc.y;
      doc.circle(margin + 4, y + 7, 2.5).fill("#22C55E");
      doc.font(F.regular).fontSize(10.6).fillColor("#101010").text(text, margin + 18, y, { width: width - 18, lineGap: 3 });
      doc.moveDown(0.55);
    }
    function callout(text) {
      if (doc.y > H - 100) page("Үргэлжлэл");
      const y = doc.y + 6;
      doc.roundedRect(margin, y, width, 52, 8).fill("#101010");
      doc.font(F.bold).fontSize(11.5).fillColor("#FFFFFF").text(text, margin + 18, y + 16, { width: width - 36, align: "center" });
      doc.y = y + 70;
    }

    doc.rect(0, 0, W, H).fill("#101010");
    doc.rect(0, 0, W, 8).fill("#22C55E");
    doc.font(F.bold).fontSize(62).fillColor("#FFFFFF").text("REIHEN", margin, 178, { width, align: "center" });
    doc.font(F.regular).fontSize(15).fillColor("#DDDDDD").text(slides[0].subtitle, margin, 270, { width, align: "center", lineGap: 4 });
    doc.moveTo(margin + 175, 350).lineTo(W - margin - 175, 350).strokeColor("#22C55E").lineWidth(3).stroke();
    doc.font(F.regular).fontSize(9).fillColor("#999999").text(slides[0].footer, margin, 382, { width, align: "center" });

    slides.slice(1).forEach((s) => {
      page(`${s.title} · ${s.score || ""}`);
      if (s.kind === "architecture") {
        codeFacts.stack.forEach(bullet);
        callout("Architecture slide дээр UI/API/Event/Database/External service layer-уудыг дүрсэлсэн.");
      } else if (s.kind === "sequence") {
        [
          "Хэрэглэгч seat/time сонгоно.",
          "Reihen invoice/create хүсэлт QPay руу илгээнэ.",
          "QPay QR/deeplink буцаана.",
          "Bank app payment хийсний дараа callback/payment check ирнэ.",
          "Booking PAID болж owner/staff realtime update авна.",
          "Staff check-in хийснээр seat PLAYING төлөвт орно.",
        ].forEach(bullet);
        callout("QPay flow нь payment баталгаажилт, service provisioning хоёр үеийг салгаж харуулна.");
      } else if (s.kind === "risk") {
        [
          "Payment callback spoofing → invoice/payment result verification.",
          "Double booking → overlap check + transaction + seat status sync.",
          "Realtime delay → Firebase/Supabase/socket fallback + polling.",
          "Free-tier cold start → warmup script + paid plan migration path.",
          "Owner bad location/spec data → validation + draggable map editor.",
        ].forEach(bullet);
        callout("Эрсдэл бүрт хэрэгжих боломжтой mitigation тодорхойлсон.");
      } else {
        s.points.forEach(bullet);
        callout(s.callout);
      }
    });

    const range = doc.bufferedPageRange();
    for (let i = range.start + 1; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      doc.font(F.regular).fontSize(8).fillColor("#777777").text(`REIHEN · Defense Rubric 2026 · ${i}`, margin, H - 34, { width, align: "center" });
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
