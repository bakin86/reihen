/**
 * Reihen diploma defense materials.
 * Generates:
 * - Reihen-Diplom-Defense-2026.pptx
 * - Reihen-Diplom-Defense-2026.pdf
 */
const fs = require("fs");
const path = require("path");
const PptxGenJS = require("pptxgenjs");
const PDFDocument = require("pdfkit");

const ROOT = path.join(__dirname, "..");
const PPTX_OUT = path.join(ROOT, "Reihen-Diplom-Defense-2026.pptx");
const PDF_OUT = path.join(ROOT, "Reihen-Diplom-Defense-2026.pdf");

const C = {
  ink: "0A0A0A",
  paper: "F7F7F4",
  white: "FFFFFF",
  muted: "666666",
  line: "D9D9D4",
  green: "22C55E",
  yellow: "FACC15",
  red: "EF4444",
  blue: "2563EB",
};

const meta = {
  title: "REIHEN",
  subtitle: "PC Gaming Center-ийн захиалга, суудал, ажилтан, төлбөр, тэмцээний удирдлагын систем",
  date: "2026",
  stack: "Next.js 14 · Prisma · Supabase PostgreSQL · Supabase Realtime · Vercel",
  github: "github.com/bakin86/reihen",
  url: "Vercel deploy / local demo",
};

const slides = [
  {
    kind: "cover",
    title: "REIHEN",
    kicker: "Диплом хамгаалалтын танилцуулга",
    subtitle: meta.subtitle,
    footer: meta.stack,
  },
  {
    title: "Судалгааны асуудал",
    points: [
      "Монгол дахь PC center-үүдийн захиалга ихэнхдээ утас, чат, эсвэл очиж авах хэлбэртэй.",
      "Суудлын давхцал, цаг буруу тэмдэглэх, no-show бүртгэл алдагдах эрсдэлтэй.",
      "Owner бодит цагийн суудал, орлого, захиалга, staff үйлдлийг нэг dashboard-оос харах боломж муу.",
      "Тэмцээн зохион байгуулах, баг бүртгэх, bracket хөтлөх workflow тусдаа явдаг.",
    ],
    stat: "Нэг системээр booking + operation + tournament workflow-г нэгтгэнэ.",
  },
  {
    title: "Төслийн зорилго",
    points: [
      "Player: сул суудал харж, цаг сонгон, онлайн захиалах.",
      "Owner: center, seat map, staff, booking, tournament, review, subscription удирдах.",
      "Staff: check-in/no-show, суудлын төлөв, тухайн center-ийн booking харах.",
      "Public: events/tournaments үзэх, баг бүртгүүлэх, bracket харах.",
    ],
    stat: "Role-based: Owner · Staff · Player · Admin",
  },
  {
    title: "Одоо ажиллаж байгаа гол функцууд",
    grid: [
      ["Seat booking", "Суудал сонгох, цаг авах, QPay mock/balance төлбөр"],
      ["Realtime seats", "Supabase Realtime ашиглан refresh хийхгүйгээр seat status шинэчлэгдэнэ"],
      ["Owner console", "Орлого, booking, center, layout, staff, review, subscription"],
      ["Staff dashboard", "Check-in, no-show, seat status update"],
      ["Tournament", "Баг бүртгэл, төлбөр, bracket editor, public bracket"],
      ["Polish", "Smooth animation, responsive owner UI, mobile dashboard visibility"],
    ],
  },
  {
    title: "Системийн архитектур",
    architecture: [
      ["Frontend", "Next.js App Router, React, Tailwind CSS"],
      ["API layer", "Next.js Route Handlers, Zod validation, role guard"],
      ["Data layer", "Prisma ORM, Supabase PostgreSQL"],
      ["Realtime", "Supabase Realtime table subscriptions"],
      ["Deploy", "Vercel + Supabase free tier demo setup"],
    ],
  },
  {
    title: "Database design",
    grid: [
      ["User", "role, auth, profile, balance, restriction/no-show"],
      ["PCCenter", "owner, address, images, policy, subscription limits"],
      ["Seat/Floor/Type", "status, price, layout position, realtime update"],
      ["Booking", "time range, payment, status, booking seats relation"],
      ["Staff", "center assignment, permission toggles"],
      ["Tournament", "teams, members, matches, scores, winners"],
    ],
  },
  {
    title: "Realtime шийдэл",
    points: [
      "Seat table update event-ийг centerId filter-тэй сонсоно.",
      "Booking/check-in/cancel/no-show үед суудлын төлөв өөрчлөгдөхөд UI шууд шинэчлэгдэнэ.",
      "TournamentMatch, TournamentTeam дээр realtime нэмэх боломжтой бүтэц бэлэн.",
      "Vercel cold start нь realtime socket-д биш API request-д илүү мэдрэгдэнэ.",
      "Free tier үед fallback refresh, optimistic UI хэрэглэхээр demo тогтвортой харагдана.",
    ],
    stat: "Refresh шаардахгүй seat map бол demo-ийн хамгийн хүчтэй хэсэг.",
  },
  {
    title: "Tournament & bracket editor",
    points: [
      "Owner тэмцээн үүсгэнэ: game, team size, max teams, entry fee, prize pool.",
      "Багууд public tournament page дээр нэр болон тоглогчдын нэрээр бүртгүүлнэ.",
      "Owner bracket generate хийж, team A/B slot, score, status, winner-ийг гараар засна.",
      "Winner сонгоход дараагийн round руу автоматаар дамжуулах backend logic ажиллана.",
      "Public page дээр bracket live board маягаар харагдана.",
    ],
    stat: "Диплом demo-д tournament feature нь ялгарах нэмэлт давуу тал.",
  },
  {
    title: "UI/UX сайжруулалт",
    points: [
      "Owner console light/dark theme нэг стандарттай болсон.",
      "Header, card, form field, button бүгд smooth transition-тэй болсон.",
      "Staff create flow дээр input visibility, create button, center assignment засагдсан.",
      "Layout editor дээр seat байрлуулах, 5v5/1v1 auto arrange, drag/select flow ажиллана.",
      "Mobile дээр dashboard/event/tournament navigation харагдах байдлыг сайжруулсан.",
    ],
    stat: "Defense demo дээр first impression-ийг owner pages авч явна.",
  },
  {
    title: "Demo өгөгдөл",
    grid: [
      ["Centers", "11 PC center"],
      ["Seats", "224 суудал"],
      ["Bookings", "40 demo booking"],
      ["Reviews", "12 review"],
      ["Tournaments", "5+ tournament"],
      ["Roles", "Owner, Staff, Player, Admin"],
    ],
  },
  {
    title: "Demo login accounts",
    table: [
      ["Role", "Email", "Password"],
      ["Owner", "oyunbaatar@reihen.mn", "owner123"],
      ["Owner", "sarnai@reihen.mn", "owner123"],
      ["Staff", "tulgaa@reihen.mn", "staff123"],
      ["Player", "demo@reihen.mn", "demo123"],
      ["Admin", "admin@reihen.mn", "admin123"],
    ],
  },
  {
    title: "Demo хийх дараалал",
    points: [
      "1. Home/centers: center list, event/tournament entry харуулах.",
      "2. Center detail: seat map, realtime status, booking flow харуулах.",
      "3. Owner dashboard: орлого, bookings, seat map, layout editor.",
      "4. Staff: check-in/no-show, seat status permission.",
      "5. Tournament: team registration, bracket editor, public bracket.",
      "6. Build/test: production build pass болсон гэдгийг хэлэх.",
    ],
    stat: "Хамгийн түрүүнд working flow харуул, дараа нь architecture тайлбарла.",
  },
  {
    title: "Free tier ба performance",
    points: [
      "Vercel free tier дээр cold start гарч болно. Энэ нь анхны API call дээр илүү мэдрэгдэнэ.",
      "Supabase free tier дээр realtime ажиллах боловч latency paid tier шиг тогтмол биш.",
      "Query-г багасгах, cache, lazy load, dynamic import, optimistic UI ашигласан.",
      "Production-д paid Supabase/Vercel, region alignment, monitoring нэмэх шаардлагатай.",
    ],
    stat: "Диплом demo-д free tier хангалттай, production-д scaling plan хэрэгтэй.",
  },
  {
    title: "Шалгалт ба баталгаажуулалт",
    points: [
      "TypeScript compile: npx tsc --noEmit амжилттай.",
      "Production build: npm run build амжилттай.",
      "Prisma schema болон seed data Supabase дээр push/seed хийсэн.",
      "Core flows: auth, booking, owner/staff, tournament, bracket build дээр унахгүй.",
    ],
    stat: "Энэ нь зөвхөн mock UI биш, ажилладаг full-stack system.",
  },
  {
    title: "Цаашдын хөгжүүлэлт",
    points: [
      "Real QPay production credential + webhook URL бүрэн тохируулах.",
      "Tournament bracket realtime subscription нэмж public bracket-ийг шууд шинэчлэх.",
      "Playwright E2E tests: booking, payment, staff, tournament.",
      "Admin moderation panel, audit log, report export.",
      "Production monitoring, error tracking, database backup policy.",
    ],
    stat: "MVP demo-ready, production-д hardening phase хэрэгтэй.",
  },
  {
    title: "Дүгнэлт",
    points: [
      "Reihen нь PC center-ийн бодит workflow-г digital болгох full-stack систем.",
      "Booking, realtime seat, owner/staff operation, tournament bracket нэг дор ажиллаж байна.",
      "Vercel + Supabase дээр deploy хийх боломжтой modern architecture ашигласан.",
      "Диплом хамгаалалтад core feature, architecture, demo flow хангалттай түвшинд бэлэн.",
    ],
    stat: "REIHEN · Book. Play. Win.",
  },
];

function addSlideHeader(pptx, slide, idx) {
  slide.background = { color: C.paper };
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 0.08, fill: { color: C.ink }, line: { color: C.ink } });
  slide.addText("REIHEN", { x: 0.45, y: 0.25, w: 1.2, h: 0.25, fontFace: "Arial", fontSize: 8, bold: true, color: C.ink, charSpacing: 2 });
  slide.addText(String(idx + 1).padStart(2, "0"), { x: 12.15, y: 0.25, w: 0.7, h: 0.25, fontFace: "Arial", fontSize: 8, bold: true, color: C.muted, align: "right" });
}

function addTitle(slide, title) {
  slide.addText(title, { x: 0.55, y: 0.75, w: 7.4, h: 0.7, fontFace: "Arial", fontSize: 25, bold: true, color: C.ink, breakLine: false, fit: "shrink" });
}

function addBullets(slide, points, x = 0.75, y = 1.75, w = 7.7) {
  points.forEach((point, i) => {
    const yy = y + i * 0.72;
    slide.addShape("rect", { x, y: yy + 0.11, w: 0.08, h: 0.08, fill: { color: C.green }, line: { color: C.green } });
    slide.addText(point, { x: x + 0.25, y: yy, w, h: 0.48, fontFace: "Arial", fontSize: 13, color: C.ink, fit: "shrink" });
  });
}

function addStat(slide, text) {
  slide.addShape("roundRect", { x: 8.8, y: 1.75, w: 3.85, h: 3.15, rectRadius: 0.08, fill: { color: C.ink }, line: { color: C.ink } });
  slide.addText(text, { x: 9.15, y: 2.25, w: 3.15, h: 1.95, fontFace: "Arial", fontSize: 17, bold: true, color: C.white, align: "center", valign: "mid", fit: "shrink" });
  slide.addShape("rect", { x: 9.95, y: 4.45, w: 1.5, h: 0.04, fill: { color: C.green }, line: { color: C.green } });
}

function generatePptx() {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "Reihen";
  pptx.subject = "Diploma defense presentation";
  pptx.title = "Reihen Diplom Defense 2026";
  pptx.company = "Reihen";
  pptx.lang = "mn-MN";
  pptx.theme = {
    headFontFace: "Arial",
    bodyFontFace: "Arial",
    lang: "mn-MN",
  };

  slides.forEach((data, idx) => {
    const slide = pptx.addSlide();
    if (data.kind === "cover") {
      slide.background = { color: C.ink };
      slide.addShape("rect", { x: 0, y: 0, w: 13.33, h: 0.1, fill: { color: C.green }, line: { color: C.green } });
      slide.addText(data.kicker, { x: 0.75, y: 0.65, w: 8, h: 0.3, fontFace: "Arial", fontSize: 10, color: "A3A3A3", charSpacing: 2 });
      slide.addText(data.title, { x: 0.75, y: 1.5, w: 10.8, h: 1.3, fontFace: "Arial", fontSize: 80, bold: true, color: C.white, charSpacing: -2 });
      slide.addText(data.subtitle, { x: 0.85, y: 3.05, w: 9.6, h: 0.9, fontFace: "Arial", fontSize: 18, color: "E5E5E5", fit: "shrink" });
      slide.addShape("rect", { x: 0.85, y: 4.25, w: 2.4, h: 0.05, fill: { color: C.green }, line: { color: C.green } });
      slide.addText(data.footer, { x: 0.85, y: 6.8, w: 11.6, h: 0.35, fontFace: "Arial", fontSize: 9, color: "8A8A8A" });
      return;
    }

    addSlideHeader(pptx, slide, idx);
    addTitle(slide, data.title);

    if (data.points) {
      addBullets(slide, data.points);
      addStat(slide, data.stat);
    }

    if (data.grid) {
      data.grid.forEach(([title, desc], i) => {
        const col = i % 3;
        const row = Math.floor(i / 3);
        const x = 0.65 + col * 4.15;
        const y = 1.85 + row * 2.05;
        slide.addShape("roundRect", { x, y, w: 3.75, h: 1.55, rectRadius: 0.08, fill: { color: C.white }, line: { color: C.line } });
        slide.addText(title, { x: x + 0.22, y: y + 0.22, w: 3.25, h: 0.3, fontFace: "Arial", fontSize: 13, bold: true, color: C.ink, fit: "shrink" });
        slide.addShape("rect", { x: x + 0.22, y: y + 0.62, w: 0.75, h: 0.035, fill: { color: C.green }, line: { color: C.green } });
        slide.addText(desc, { x: x + 0.22, y: y + 0.78, w: 3.25, h: 0.5, fontFace: "Arial", fontSize: 9.5, color: C.muted, fit: "shrink" });
      });
    }

    if (data.architecture) {
      data.architecture.forEach(([layer, desc], i) => {
        const x = 0.7 + i * 2.45;
        slide.addShape("roundRect", { x, y: 2.0, w: 2.05, h: 3.25, rectRadius: 0.08, fill: { color: i % 2 ? "FFFFFF" : "EFEFEB" }, line: { color: C.line } });
        slide.addText(layer, { x: x + 0.12, y: 2.22, w: 1.8, h: 0.34, fontFace: "Arial", fontSize: 12, bold: true, color: C.ink, align: "center", fit: "shrink" });
        slide.addText(desc, { x: x + 0.18, y: 3.0, w: 1.7, h: 1.05, fontFace: "Arial", fontSize: 9.5, color: C.muted, align: "center", valign: "mid", fit: "shrink" });
        if (i < data.architecture.length - 1) {
          slide.addText("→", { x: x + 2.07, y: 3.32, w: 0.4, h: 0.4, fontFace: "Arial", fontSize: 18, color: C.green, bold: true, align: "center" });
        }
      });
    }

    if (data.table) {
      const rows = data.table;
      const x = 0.8;
      let y = 1.85;
      rows.forEach((row, i) => {
        const isHead = i === 0;
        slide.addShape("rect", { x, y, w: 11.6, h: 0.52, fill: { color: isHead ? C.ink : C.white }, line: { color: C.line } });
        row.forEach((cell, ci) => {
          const colX = x + [0, 2.2, 7.2][ci];
          const colW = [2.1, 4.9, 3.0][ci];
          slide.addText(cell, { x: colX + 0.1, y: y + 0.12, w: colW, h: 0.22, fontFace: "Arial", fontSize: 10, bold: isHead, color: isHead ? C.white : C.ink, fit: "shrink" });
        });
        y += 0.62;
      });
    }
  });

  return pptx.writeFile({ fileName: PPTX_OUT });
}

function registerPdfFonts(doc) {
  const fontDir = "C:/Windows/Fonts";
  const arial = path.join(fontDir, "arial.ttf");
  const arialBold = path.join(fontDir, "arialbd.ttf");
  if (fs.existsSync(arial) && fs.existsSync(arialBold)) {
    doc.registerFont("Sans", arial);
    doc.registerFont("SansBold", arialBold);
    return { regular: "Sans", bold: "SansBold" };
  }
  return { regular: "Helvetica", bold: "Helvetica-Bold" };
}

function generatePdf() {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 42,
      bufferPages: true,
      info: {
        Title: "Reihen Diplom Defense 2026",
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
    const font = registerPdfFonts(doc);
    const W = doc.page.width;
    const H = doc.page.height;
    const LM = 48;
    const CW = W - LM * 2;

    function cover() {
      doc.rect(0, 0, W, H).fill(`#${C.ink}`);
      doc.rect(0, 0, W, 8).fill(`#${C.green}`);
      doc.font(font.bold).fontSize(62).fillColor(`#${C.white}`).text("REIHEN", LM, 190, { width: CW });
      doc.font(font.regular).fontSize(13).fillColor("#D0D0D0").text(meta.subtitle, LM, 285, { width: CW, lineGap: 5 });
      doc.moveTo(LM, 360).lineTo(LM + 160, 360).strokeColor(`#${C.green}`).lineWidth(3).stroke();
      doc.font(font.regular).fontSize(9).fillColor("#8A8A8A").text(`Диплом хамгаалалт · ${meta.date}`, LM, 410);
      doc.text(meta.stack, LM, 430, { width: CW });
      doc.text(meta.github, LM, H - 78, { width: CW });
    }

    function newPage(title) {
      doc.addPage();
      doc.rect(0, 0, W, H).fill(`#${C.paper}`);
      doc.rect(0, 0, W, 6).fill(`#${C.ink}`);
      doc.font(font.bold).fontSize(20).fillColor(`#${C.ink}`).text(title, LM, 46, { width: CW });
      doc.moveTo(LM, 82).lineTo(W - LM, 82).strokeColor(`#${C.line}`).lineWidth(1).stroke();
      doc.y = 104;
    }

    function bullet(text) {
      if (doc.y > H - 88) doc.addPage();
      const y = doc.y;
      doc.circle(LM + 4, y + 6, 2.5).fill(`#${C.green}`);
      doc.font(font.regular).fontSize(10.6).fillColor(`#${C.ink}`).text(text, LM + 18, y, { width: CW - 18, lineGap: 3 });
      doc.moveDown(0.45);
    }

    function stat(text) {
      if (doc.y > H - 120) doc.addPage();
      doc.moveDown(0.4);
      const y = doc.y;
      doc.roundedRect(LM, y, CW, 54, 8).fill(`#${C.ink}`);
      doc.font(font.bold).fontSize(12).fillColor(`#${C.white}`).text(text, LM + 16, y + 16, { width: CW - 32, align: "center" });
      doc.y = y + 72;
    }

    function smallTable(rows) {
      const colW = [115, 205, 165];
      rows.forEach((row, ri) => {
        if (doc.y > H - 90) doc.addPage();
        const y = doc.y;
        doc.rect(LM, y, CW, 26).fill(ri === 0 ? `#${C.ink}` : "#FFFFFF");
        let x = LM;
        row.forEach((cell, ci) => {
          doc.font(ri === 0 ? font.bold : font.regular).fontSize(8.8).fillColor(ri === 0 ? `#${C.white}` : `#${C.ink}`)
            .text(cell, x + 6, y + 8, { width: colW[ci] - 8 });
          x += colW[ci];
        });
        doc.y = y + 29;
      });
      doc.moveDown(0.5);
    }

    cover();
    slides.slice(1).forEach((s) => {
      newPage(s.title);
      if (s.points) s.points.forEach(bullet);
      if (s.stat) stat(s.stat);
      if (s.grid) {
        s.grid.forEach(([k, v]) => {
          if (doc.y > H - 80) doc.addPage();
          doc.font(font.bold).fontSize(11).fillColor(`#${C.ink}`).text(k, LM, doc.y, { continued: true });
          doc.font(font.regular).fontSize(10.2).fillColor(`#${C.muted}`).text(`  ${v}`, { width: CW });
          doc.moveDown(0.35);
        });
      }
      if (s.architecture) {
        s.architecture.forEach(([k, v]) => {
          bullet(`${k}: ${v}`);
        });
      }
      if (s.table) smallTable(s.table);
    });

    const range = doc.bufferedPageRange();
    for (let i = range.start + 1; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      doc.font(font.regular).fontSize(8).fillColor("#888888").text(`REIHEN · Diploma Defense · ${i}`, LM, H - 36, { width: CW, align: "center" });
    }

    doc.end();
  });
}

async function main() {
  console.log("Generating defense PPTX...");
  await generatePptx();
  console.log(`PPTX: ${PPTX_OUT}`);
  console.log("Generating defense PDF...");
  await generatePdf();
  console.log(`PDF: ${PDF_OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
