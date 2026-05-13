// Reihen — Diploma Defense Presentation Generator
// Generates both PPTX and PDF versions

const PptxGenJS = require("pptxgenjs");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

// ─── Colors ───────────────────────────────────────────────
const C = {
  bg: "0A0A0A",
  white: "FFFFFF",
  dim: "666666",
  dimmer: "333333",
  border: "222222",
  accent: "FFFFFF",
  green: "22C55E",
  blue: "3B82F6",
  red: "EF4444",
  yellow: "EAB308",
};

// ─── Slide data ───────────────────────────────────────────
const slides = [
  // 0 — Title
  {
    type: "title",
    title: "REIHEN",
    subtitle: "PC Gaming Center\nBooking & Management Platform",
    meta: "Дипломын ажлын хамгаалалт · 2026",
    tag: "БААКАЛАВРЫН ДИПЛОМЫН АЖИЛ",
  },
  // 1 — Problem
  {
    type: "split",
    label: "01 · АСУУДАЛ",
    heading: "Монголын тоглоомын\nцентрүүдийн өнөөгийн байдал",
    points: [
      "Суудал захиалга утсаар эсвэл биечлэн хийгддэг",
      "Жижиглэн бичлэг, алдааны эрсдэл өндөр",
      "Эзэмшигч нарт бодит цагийн мэдээлэл байхгүй",
      "Тоглогчид хүлээлгийн мөрөнд цаг алддаг",
      "Турнирын удирдлага тусдаа, уялдаагүй",
    ],
    stat: { value: "500+", label: "PC gaming center\nМонголд" },
  },
  // 2 — Solution
  {
    type: "split",
    label: "02 · ШИЙДЭЛ",
    heading: "Reihen — нэгдсэн\nдижитал платформ",
    points: [
      "Бодит цагийн суудлын захиалга онлайнаар",
      "Эзэмшигчийн dashboard: орлого, статистик",
      "Тоглогчийн профайл: түүх, дуртай центрүүд",
      "Турнир зохион байгуулах систем",
      "Push notification, QPay төлбөр",
    ],
    stat: { value: "4", label: "эрх: Admin\nOwner · Staff · Player" },
  },
  // 3 — Tech stack
  {
    type: "tech",
    label: "03 · ТЕХНОЛОГИ",
    heading: "Technology Stack",
    stack: [
      { layer: "Frontend", tech: "Next.js 14 · React 18 · TypeScript · Tailwind CSS" },
      { layer: "Backend", tech: "Next.js API Routes · Node.js · JWT Auth" },
      { layer: "Database", tech: "PostgreSQL · Prisma ORM · Supabase" },
      { layer: "Real-time", tech: "Socket.io WebSocket Server" },
      { layer: "Payment", tech: "QPay Mongolia Integration" },
      { layer: "Push", tech: "Web Push API · VAPID" },
      { layer: "AI", tech: "Groq LLM Chatbot (llama-3)" },
      { layer: "Deploy", tech: "Vercel · Supabase · PM2" },
    ],
  },
  // 4 — Features
  {
    type: "features",
    label: "04 · ФУНКЦИОНАЛЬ",
    heading: "Үндсэн боломжууд",
    features: [
      { icon: "🖥", title: "Суудлын захиалга", desc: "Blueprint map, multi-seat, QPay" },
      { icon: "📊", title: "Owner Dashboard", desc: "Орлого, ачааллын статистик" },
      { icon: "🏆", title: "Турнир", desc: "Бүртгэл, багийн удирдлага" },
      { icon: "⭐", title: "Үнэлгээ", desc: "Review, owner reply систем" },
      { icon: "🔔", title: "Push мэдэгдэл", desc: "Суудал, турнирын мэдэгдэл" },
      { icon: "🤖", title: "AI Chatbot", desc: "Хэрэглэгчийн тусламж" },
    ],
  },
  // 5 — Architecture
  {
    type: "arch",
    label: "05 · АРХИТЕКТУР",
    heading: "Системийн бүтэц",
    layers: [
      { name: "CLIENT", items: ["Next.js Pages", "React Components", "Socket.io Client"] },
      { name: "API LAYER", items: ["REST API Routes", "JWT Middleware", "Rate Limiter"] },
      { name: "SERVICES", items: ["Cron Jobs", "WS Server", "Push Service", "QPay"] },
      { name: "DATA", items: ["PostgreSQL", "Prisma ORM", "Supabase"] },
    ],
  },
  // 6 — Stats
  {
    type: "stats",
    label: "06 · DEMO ӨГӨГДӨЛ",
    heading: "Demo систем",
    stats: [
      { value: "11", label: "Gaming center" },
      { value: "224", label: "Суудал" },
      { value: "40", label: "Захиалга" },
      { value: "12", label: "Үнэлгээ" },
      { value: "6", label: "Турнир" },
      { value: "4", label: "Эрхийн төрөл" },
    ],
    creds: [
      { role: "Admin", email: "admin@reihen.mn", pass: "admin123" },
      { role: "Owner", email: "oyunbaatar@reihen.mn", pass: "owner123" },
      { role: "Demo", email: "demo@reihen.mn", pass: "demo123" },
      { role: "Staff", email: "tulgaa@reihen.mn", pass: "staff123" },
    ],
  },
  // 7 — Database schema
  {
    type: "schema",
    label: "07 · ӨГӨГДЛИЙН БАЗ",
    heading: "Prisma Schema — үндсэн моделиуд",
    models: [
      { name: "User", fields: "id · name · email · phone · role · balance · totalPlayHours" },
      { name: "PCCenter", fields: "id · name · district · images · rating · ownerId" },
      { name: "Seat", fields: "id · number · status · posX · posY · centerId · floorId" },
      { name: "Booking", fields: "id · code · userId · startTime · endTime · totalPrice · status" },
      { name: "Tournament", fields: "id · name · game · maxTeams · teamSize · entryFee · status" },
      { name: "FavoriteCenter", fields: "userId · centerId (many-to-many join table)" },
    ],
  },
  // 8 — Conclusion
  {
    type: "conclusion",
    label: "08 · ДҮГНЭЛТ",
    heading: "Дипломын ажлын үр дүн",
    points: [
      "Full-stack веб платформ амжилттай хэрэгжсэн",
      "Бодит цагийн WebSocket холболт ажиллаж байна",
      "QPay төлбөрийн систем нэгтгэгдсэн",
      "Role-based хандалтын удирдлага хэрэгжсэн",
      "Vercel + Supabase дээр амжилттай deploy хийгдсэн",
    ],
    url: "reihen.vercel.app",
    github: "github.com/bakin86/reihen",
  },
];

// ═══════════════════════════════════════════════════════════
// PPTX GENERATION
// ═══════════════════════════════════════════════════════════

function generatePPTX() {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE"; // 13.33 x 7.5 inches

  // Master slide background
  pptx.defineSlideMaster({
    title: "REIHEN_MASTER",
    background: { color: C.bg },
  });

  slides.forEach((slide, i) => {
    const s = pptx.addSlide({ masterName: "REIHEN_MASTER" });

    // Subtle top border line
    s.addShape(pptx.ShapeType.rect, {
      x: 0, y: 0, w: "100%", h: 0.02,
      fill: { color: "222222" },
      line: { type: "none" },
    });

    // Bottom border
    s.addShape(pptx.ShapeType.rect, {
      x: 0, y: 7.48, w: "100%", h: 0.02,
      fill: { color: "222222" },
      line: { type: "none" },
    });

    // Slide number (except title)
    if (i > 0) {
      s.addText(`${String(i).padStart(2, "0")} / 0${slides.length - 1}`, {
        x: 11.5, y: 7.1, w: 1.5, h: 0.3,
        fontSize: 7, color: "444444",
        fontFace: "Courier New", align: "right",
      });
    }

    if (slide.type === "title") {
      // Large wordmark
      s.addText("REIHEN", {
        x: 1, y: 1.5, w: 11, h: 1.8,
        fontSize: 96, bold: true, color: C.white,
        fontFace: "Arial", align: "center",
        charSpacing: -3,
      });
      // Subtitle
      s.addText(slide.subtitle, {
        x: 1, y: 3.5, w: 11, h: 1,
        fontSize: 18, color: "888888",
        fontFace: "Arial", align: "center",
      });
      // Tag
      s.addText(slide.tag, {
        x: 1, y: 0.3, w: 11, h: 0.3,
        fontSize: 8, color: "444444",
        fontFace: "Courier New", align: "center", charSpacing: 4,
      });
      // Meta
      s.addText(slide.meta, {
        x: 1, y: 4.7, w: 11, h: 0.3,
        fontSize: 9, color: "444444",
        fontFace: "Courier New", align: "center",
      });
      // Decorative lines
      s.addShape(pptx.ShapeType.rect, {
        x: 5.5, y: 1.3, w: 2.33, h: 0.01,
        fill: { color: "333333" }, line: { type: "none" },
      });
      s.addShape(pptx.ShapeType.rect, {
        x: 5.5, y: 5.1, w: 2.33, h: 0.01,
        fill: { color: "333333" }, line: { type: "none" },
      });
    }

    else if (slide.type === "split") {
      // Label
      s.addText(slide.label, {
        x: 0.5, y: 0.4, w: 4, h: 0.25,
        fontSize: 8, color: "555555", fontFace: "Courier New", charSpacing: 3,
      });
      // Heading
      s.addText(slide.heading, {
        x: 0.5, y: 0.8, w: 6.5, h: 2,
        fontSize: 32, bold: true, color: C.white,
        fontFace: "Arial", lineSpacingMultiple: 1.1,
      });
      // Divider
      s.addShape(pptx.ShapeType.rect, {
        x: 0.5, y: 2.85, w: 0.3, h: 0.03,
        fill: { color: C.white }, line: { type: "none" },
      });
      // Points
      slide.points.forEach((p, pi) => {
        s.addText(`${String(pi + 1).padStart(2, "0")}  ${p}`, {
          x: 0.5, y: 3.1 + pi * 0.65, w: 7.5, h: 0.55,
          fontSize: 13, color: "AAAAAA", fontFace: "Arial",
        });
      });
      // Stat box (right side)
      s.addShape(pptx.ShapeType.rect, {
        x: 9.2, y: 1.5, w: 3.5, h: 3,
        fill: { color: "111111" },
        line: { color: "222222", pt: 1 },
      });
      s.addText(slide.stat.value, {
        x: 9.2, y: 2, w: 3.5, h: 1.2,
        fontSize: 64, bold: true, color: C.white,
        fontFace: "Arial", align: "center",
      });
      s.addText(slide.stat.label, {
        x: 9.2, y: 3.2, w: 3.5, h: 0.8,
        fontSize: 12, color: "666666",
        fontFace: "Arial", align: "center",
      });
    }

    else if (slide.type === "tech") {
      s.addText(slide.label, {
        x: 0.5, y: 0.4, w: 5, h: 0.25,
        fontSize: 8, color: "555555", fontFace: "Courier New", charSpacing: 3,
      });
      s.addText(slide.heading, {
        x: 0.5, y: 0.75, w: 6, h: 0.7,
        fontSize: 28, bold: true, color: C.white, fontFace: "Arial",
      });
      slide.stack.forEach((item, si) => {
        const col = si % 2;
        const row = Math.floor(si / 2);
        const x = 0.5 + col * 6.4;
        const y = 1.7 + row * 1.35;
        s.addShape(pptx.ShapeType.rect, {
          x, y, w: 6, h: 1.15,
          fill: { color: "111111" },
          line: { color: "222222", pt: 1 },
        });
        s.addText(item.layer, {
          x: x + 0.2, y: y + 0.12, w: 5.6, h: 0.3,
          fontSize: 7, color: "555555", fontFace: "Courier New", charSpacing: 3,
        });
        s.addText(item.tech, {
          x: x + 0.2, y: y + 0.42, w: 5.6, h: 0.55,
          fontSize: 13, color: "CCCCCC", fontFace: "Arial",
        });
      });
    }

    else if (slide.type === "features") {
      s.addText(slide.label, {
        x: 0.5, y: 0.4, w: 5, h: 0.25,
        fontSize: 8, color: "555555", fontFace: "Courier New", charSpacing: 3,
      });
      s.addText(slide.heading, {
        x: 0.5, y: 0.75, w: 9, h: 0.7,
        fontSize: 28, bold: true, color: C.white, fontFace: "Arial",
      });
      slide.features.forEach((f, fi) => {
        const col = fi % 3;
        const row = Math.floor(fi / 3);
        const x = 0.5 + col * 4.2;
        const y = 1.8 + row * 2.5;
        s.addShape(pptx.ShapeType.rect, {
          x, y, w: 4, h: 2.1,
          fill: { color: "0F0F0F" },
          line: { color: "222222", pt: 1 },
        });
        s.addText(f.icon, {
          x: x + 0.25, y: y + 0.25, w: 0.7, h: 0.6,
          fontSize: 22, align: "center",
        });
        s.addText(f.title, {
          x: x + 0.25, y: y + 0.85, w: 3.5, h: 0.45,
          fontSize: 14, bold: true, color: C.white, fontFace: "Arial",
        });
        s.addText(f.desc, {
          x: x + 0.25, y: y + 1.3, w: 3.5, h: 0.55,
          fontSize: 11, color: "777777", fontFace: "Arial",
        });
      });
    }

    else if (slide.type === "arch") {
      s.addText(slide.label, {
        x: 0.5, y: 0.4, w: 5, h: 0.25,
        fontSize: 8, color: "555555", fontFace: "Courier New", charSpacing: 3,
      });
      s.addText(slide.heading, {
        x: 0.5, y: 0.75, w: 9, h: 0.7,
        fontSize: 28, bold: true, color: C.white, fontFace: "Arial",
      });
      slide.layers.forEach((layer, li) => {
        const x = 0.5 + li * 3.1;
        s.addShape(pptx.ShapeType.rect, {
          x, y: 1.8, w: 2.9, h: 5,
          fill: { color: "0D0D0D" },
          line: { color: "222222", pt: 1 },
        });
        s.addText(layer.name, {
          x, y: 1.9, w: 2.9, h: 0.4,
          fontSize: 8, color: "555555", fontFace: "Courier New",
          charSpacing: 2, align: "center",
        });
        // Arrow between layers
        if (li < slide.layers.length - 1) {
          s.addText("→", {
            x: x + 2.9, y: 3.9, w: 0.2, h: 0.4,
            fontSize: 14, color: "333333", align: "center",
          });
        }
        layer.items.forEach((item, ii) => {
          s.addShape(pptx.ShapeType.rect, {
            x: x + 0.15, y: 2.5 + ii * 0.85, w: 2.6, h: 0.65,
            fill: { color: "161616" },
            line: { color: "2A2A2A", pt: 1 },
          });
          s.addText(item, {
            x: x + 0.15, y: 2.5 + ii * 0.85, w: 2.6, h: 0.65,
            fontSize: 11, color: "AAAAAA", fontFace: "Arial", align: "center",
          });
        });
      });
    }

    else if (slide.type === "stats") {
      s.addText(slide.label, {
        x: 0.5, y: 0.4, w: 5, h: 0.25,
        fontSize: 8, color: "555555", fontFace: "Courier New", charSpacing: 3,
      });
      s.addText(slide.heading, {
        x: 0.5, y: 0.75, w: 9, h: 0.7,
        fontSize: 28, bold: true, color: C.white, fontFace: "Arial",
      });
      // Stats grid
      slide.stats.forEach((st, si) => {
        const col = si % 3;
        const row = Math.floor(si / 3);
        const x = 0.5 + col * 2.5;
        const y = 1.8 + row * 1.6;
        s.addShape(pptx.ShapeType.rect, {
          x, y, w: 2.3, h: 1.35,
          fill: { color: "0F0F0F" },
          line: { color: "222222", pt: 1 },
        });
        s.addText(st.value, {
          x, y: y + 0.1, w: 2.3, h: 0.75,
          fontSize: 40, bold: true, color: C.white,
          fontFace: "Arial", align: "center",
        });
        s.addText(st.label, {
          x, y: y + 0.85, w: 2.3, h: 0.35,
          fontSize: 10, color: "666666", fontFace: "Arial", align: "center",
        });
      });
      // Credentials table
      s.addText("DEMO CREDENTIALS", {
        x: 8.2, y: 1.8, w: 4.8, h: 0.3,
        fontSize: 7, color: "444444", fontFace: "Courier New", charSpacing: 3,
      });
      slide.creds.forEach((c, ci) => {
        const y = 2.2 + ci * 1.1;
        s.addShape(pptx.ShapeType.rect, {
          x: 8.2, y, w: 4.8, h: 0.95,
          fill: { color: "0D0D0D" },
          line: { color: "1E1E1E", pt: 1 },
        });
        s.addText(c.role.toUpperCase(), {
          x: 8.4, y: y + 0.08, w: 1, h: 0.28,
          fontSize: 7, color: "555555", fontFace: "Courier New", charSpacing: 2,
        });
        s.addText(c.email, {
          x: 8.4, y: y + 0.36, w: 4.4, h: 0.28,
          fontSize: 11, color: "CCCCCC", fontFace: "Courier New",
        });
        s.addText(c.pass, {
          x: 8.4, y: y + 0.62, w: 4.4, h: 0.24,
          fontSize: 10, color: "555555", fontFace: "Courier New",
        });
      });
    }

    else if (slide.type === "schema") {
      s.addText(slide.label, {
        x: 0.5, y: 0.4, w: 5, h: 0.25,
        fontSize: 8, color: "555555", fontFace: "Courier New", charSpacing: 3,
      });
      s.addText(slide.heading, {
        x: 0.5, y: 0.75, w: 12, h: 0.7,
        fontSize: 24, bold: true, color: C.white, fontFace: "Arial",
      });
      slide.models.forEach((m, mi) => {
        const col = mi % 2;
        const row = Math.floor(mi / 2);
        const x = 0.5 + col * 6.4;
        const y = 1.7 + row * 1.7;
        s.addShape(pptx.ShapeType.rect, {
          x, y, w: 6.2, h: 1.5,
          fill: { color: "0D0D0D" },
          line: { color: "252525", pt: 1 },
        });
        s.addText(m.name, {
          x: x + 0.2, y: y + 0.12, w: 5.8, h: 0.35,
          fontSize: 13, bold: true, color: C.white, fontFace: "Courier New",
        });
        s.addShape(pptx.ShapeType.rect, {
          x: x + 0.2, y: y + 0.5, w: 5.8, h: 0.01,
          fill: { color: "222222" }, line: { type: "none" },
        });
        s.addText(m.fields, {
          x: x + 0.2, y: y + 0.6, w: 5.8, h: 0.75,
          fontSize: 10, color: "666666", fontFace: "Courier New",
        });
      });
    }

    else if (slide.type === "conclusion") {
      s.addText(slide.label, {
        x: 0.5, y: 0.4, w: 5, h: 0.25,
        fontSize: 8, color: "555555", fontFace: "Courier New", charSpacing: 3,
      });
      s.addText(slide.heading, {
        x: 0.5, y: 0.75, w: 9, h: 0.9,
        fontSize: 30, bold: true, color: C.white, fontFace: "Arial",
      });
      slide.points.forEach((p, pi) => {
        s.addShape(pptx.ShapeType.rect, {
          x: 0.5, y: 1.95 + pi * 0.85, w: 0.06, h: 0.35,
          fill: { color: C.white }, line: { type: "none" },
        });
        s.addText(p, {
          x: 0.8, y: 1.92 + pi * 0.85, w: 9, h: 0.45,
          fontSize: 14, color: "BBBBBB", fontFace: "Arial",
        });
      });
      // URL box
      s.addShape(pptx.ShapeType.rect, {
        x: 0.5, y: 6.2, w: 5.5, h: 0.9,
        fill: { color: "111111" },
        line: { color: "2A2A2A", pt: 1 },
      });
      s.addText("LIVE URL", {
        x: 0.7, y: 6.28, w: 2, h: 0.25,
        fontSize: 7, color: "444444", fontFace: "Courier New", charSpacing: 3,
      });
      s.addText(slide.url, {
        x: 0.7, y: 6.55, w: 5, h: 0.35,
        fontSize: 14, color: C.white, fontFace: "Courier New",
      });
      // GitHub box
      s.addShape(pptx.ShapeType.rect, {
        x: 6.3, y: 6.2, w: 6.5, h: 0.9,
        fill: { color: "111111" },
        line: { color: "2A2A2A", pt: 1 },
      });
      s.addText("GITHUB", {
        x: 6.5, y: 6.28, w: 2, h: 0.25,
        fontSize: 7, color: "444444", fontFace: "Courier New", charSpacing: 3,
      });
      s.addText(slide.github, {
        x: 6.5, y: 6.55, w: 6, h: 0.35,
        fontSize: 14, color: C.white, fontFace: "Courier New",
      });
    }
  });

  return pptx.writeFile({ fileName: "Reihen-Diploma-Presentation.pptx" });
}

// ═══════════════════════════════════════════════════════════
// PDF GENERATION
// ═══════════════════════════════════════════════════════════

function generatePDF() {
  const doc = new PDFDocument({ size: "A4", margin: 0 });
  const out = fs.createWriteStream("Reihen-Diploma-Presentation.pdf");
  doc.pipe(out);

  const W = 595.28;
  const H = 841.89;
  const M = 48;
  const BG = "#0A0A0A";
  const WHITE = "#FFFFFF";
  const DIM = "#666666";
  const BORDER = "#222222";
  const DIMMER = "#333333";

  // Font paths — Arial supports Mongolian Cyrillic
  const FONT_DIR = "C:/Windows/Fonts/";
  const F = {
    regular: FONT_DIR + "arial.ttf",
    bold:    FONT_DIR + "arialbd.ttf",
    mono:    FONT_DIR + "arial.ttf",  // fallback — Courier lacks Cyrillic
  };

  function newPage(labelText) {
    doc.addPage();
    doc.rect(0, 0, W, H).fill(BG);
    doc.rect(0, 0, W, 1).fill(BORDER);
    doc.rect(0, H - 1, W, 1).fill(BORDER);
    if (labelText) {
      doc.font(F.regular).fontSize(7).fillColor(DIM)
        .text(labelText, M, 22, { characterSpacing: 2 });
    }
  }

  function sectionHeading(text, y) {
    doc.font(F.bold).fontSize(28).fillColor(WHITE)
      .text(text, M, y, { width: W - M * 2, lineGap: 4 });
  }

  function bullet(text, y, indent = 0) {
    doc.rect(M + indent, y + 5, 3, 12).fill(DIMMER);
    doc.font(F.regular).fontSize(12).fillColor("#AAAAAA")
      .text(text, M + indent + 14, y, { width: W - M * 2 - indent - 14 });
  }

  function statBox(x, y, w, h, value, label) {
    doc.rect(x, y, w, h).fillAndStroke("#0F0F0F", BORDER);
    doc.font(F.bold).fontSize(36).fillColor(WHITE)
      .text(value, x, y + 12, { width: w, align: "center" });
    doc.font(F.regular).fontSize(9).fillColor(DIM)
      .text(label, x, y + 55, { width: w, align: "center" });
  }

  // ── Page 1: Title ────────────────────────────────────────
  doc.rect(0, 0, W, H).fill(BG);
  doc.rect(0, 0, W, 1).fill(BORDER);
  doc.rect(0, H - 1, W, 1).fill(BORDER);
  doc.rect(0, H / 2 - 0.5, W, 1).fill(BORDER);

  doc.font(F.bold).fontSize(80).fillColor(WHITE)
    .text("REIHEN", 0, H / 2 - 100, {
      width: W, align: "center",
    });

  doc.font(F.regular).fontSize(16).fillColor(DIM)
    .text("PC Gaming Center Booking & Management Platform", 0, H / 2 + 10, {
      width: W, align: "center",
    });

  doc.font(F.regular).fontSize(8).fillColor("#444444")
    .text("11 centers · 224 seats · Real-time WebSocket · QPay Integration", 0, H / 2 + 45, {
      width: W, align: "center",
    });

  doc.font(F.regular).fontSize(8).fillColor("#333333")
    .text("Vercel + Supabase + Next.js 14", 0, H - 40, {
      width: W, align: "center",
    });

  // ── Page 2: Problem & Solution ───────────────────────────
  newPage("01 · АСУУДАЛ БА ШИЙДЭЛ");
  sectionHeading("Асуудал", 50);

  const problems = [
    "Суудал захиалга утсаар эсвэл биечлэн хийгддэг",
    "Эзэмшигч нарт бодит цагийн мэдээлэл байхгүй",
    "Тоглогчид хүлээлгийн мөрөнд цаг алддаг",
    "Турнирын удирдлага тусдаа, уялдаагүй",
    "Жижиглэн бичлэг, алдааны эрсдэл өндөр",
  ];
  problems.forEach((p, i) => bullet(p, 130 + i * 35));

  doc.rect(M, 330, W - M * 2, 1).fill(BORDER);

  sectionHeading("Шийдэл — Reihen платформ", 350);
  const solutions = [
    "Бодит цагийн суудлын захиалга онлайнаар",
    "Эзэмшигчийн dashboard: орлого, суудлын ашиглалт",
    "Тоглогчийн профайл: захиалгын түүх, статистик",
    "Турнир зохион байгуулах бүрэн систем",
    "Push notification болон QPay төлбөрийн систем",
  ];
  solutions.forEach((s, i) => bullet(s, 430 + i * 35));

  doc.rect(M, 620, 120, 80).fillAndStroke("#0F0F0F", BORDER);
  doc.font(F.bold).fontSize(28).fillColor(WHITE)
    .text("500+", M, 635, { width: 120, align: "center" });
  doc.font(F.regular).fontSize(9).fillColor(DIM)
    .text("PC gaming center\nМонголд", M, 670, { width: 120, align: "center" });

  doc.rect(M + 140, 620, 120, 80).fillAndStroke("#0F0F0F", BORDER);
  doc.font(F.bold).fontSize(28).fillColor(WHITE)
    .text("4", M + 140, 635, { width: 120, align: "center" });
  doc.font(F.regular).fontSize(9).fillColor(DIM)
    .text("эрхийн төрөл\nAdmin·Owner·Staff·Player", M + 140, 670, { width: 120, align: "center" });

  // ── Page 3: Tech Stack ───────────────────────────────────
  newPage("02 · ТЕХНОЛОГИЙН СТЭК");
  sectionHeading("Technology Stack", 50);

  const techRows = [
    ["Frontend", "Next.js 14 · React 18 · TypeScript · Tailwind CSS"],
    ["Backend", "Next.js API Routes · Node.js · JWT Authentication"],
    ["Database", "PostgreSQL · Prisma ORM v5 · Supabase"],
    ["Real-time", "Socket.io WebSocket Server"],
    ["Payment", "QPay Mongolia Payment Integration"],
    ["Push", "Web Push API · VAPID Protocol"],
    ["AI", "Groq LLM API · llama-3.3-70b-versatile"],
    ["Deploy", "Vercel · Supabase · PM2 Process Manager"],
  ];

  techRows.forEach(([layer, tech], i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = M + col * (W / 2 - M);
    const y = 120 + row * 150;
    doc.rect(x, y, W / 2 - M - 8, 130).fillAndStroke("#0D0D0D", BORDER);
    doc.font(F.regular).fontSize(7).fillColor(DIM).fillOpacity(1)
      .text(layer.toUpperCase(), x + 14, y + 14, { characterSpacing: 3 });
    doc.font(F.regular).fontSize(12).fillColor("#CCCCCC")
      .text(tech, x + 14, y + 38, { width: W / 2 - M - 36 });
  });

  // ── Page 4: Features ─────────────────────────────────────
  newPage("03 · ҮНДСЭН БОЛОМЖУУД");
  sectionHeading("Функциональ боломжууд", 50);

  const feats = [
    ["Суудлын захиалга", "Blueprint map харагдац, multi-seat сонголт, QPay болон balance-аар төлбөр"],
    ["Owner Dashboard", "Бодит цагийн орлого, суудлын ачааллын статистик, ажилтны удирдлага"],
    ["Турнир систем", "Турнир үүсгэх, багийн бүртгэл, entryFee, prizePool удирдлага"],
    ["Профайл & Статистик", "6 сарын захиалгын график, нийт цаг, зарлагын дүн, дуртай центрүүд"],
    ["Үнэлгээ систем", "Тоглогчийн review, эзэмшигчийн хариулт, 1-5 оддын үнэлгээ"],
    ["Push мэдэгдэл", "Суудал чөлөөлөгдсөн, шинэ турнир үүссэн үед автомат мэдэгдэл"],
  ];

  feats.forEach(([title, desc], i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = M + col * (W / 2 - M);
    const y = 120 + row * 200;
    doc.rect(x, y, W / 2 - M - 8, 175).fillAndStroke("#0A0A0A", BORDER);
    doc.font(F.bold).fontSize(13).fillColor(WHITE)
      .text(title, x + 14, y + 20, { width: W / 2 - M - 36 });
    doc.rect(x + 14, y + 45, 20, 1).fill(DIMMER);
    doc.font(F.regular).fontSize(10.5).fillColor(DIM)
      .text(desc, x + 14, y + 58, { width: W / 2 - M - 36, lineGap: 3 });
  });

  // ── Page 5: Database Schema ──────────────────────────────
  newPage("04 · ӨГӨГДЛИЙН БАЗ");
  sectionHeading("Prisma Schema — Үндсэн моделиуд", 50);

  const models = [
    ["User", "id · name · email · phone · role · balance · totalPlayHours · noShowCount"],
    ["PCCenter", "id · name · district · address · images · rating · ownerId"],
    ["Seat", "id · number · status · posX · posY · centerId · floorId · typeId"],
    ["Booking", "id · code · userId · startTime · endTime · totalPrice · status · paymentMethod"],
    ["Tournament", "id · name · game · maxTeams · teamSize · entryFee · prizePool · status"],
    ["FavoriteCenter", "userId · centerId — many-to-many join table"],
    ["Review", "id · userId · centerId · bookingId · rating · comment · ownerReply"],
    ["Subscription", "id · userId · plan · status · maxCenters · maxSeats · expiresAt"],
  ];

  models.forEach(([name, fields], i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = M + col * (W / 2 - M);
    const y = 120 + row * 155;
    doc.rect(x, y, W / 2 - M - 8, 135).fillAndStroke("#0D0D0D", BORDER);
    doc.font(F.bold).fontSize(12).fillColor(WHITE)
      .text(name, x + 14, y + 14);
    doc.rect(x + 14, y + 36, W / 2 - M - 36, 0.5).fill(BORDER);
    doc.font(F.regular).fontSize(8.5).fillColor(DIM)
      .text(fields, x + 14, y + 46, { width: W / 2 - M - 36, lineGap: 2 });
  });

  // ── Page 6: Stats & Demo ─────────────────────────────────
  newPage("05 · DEMO СИСТЕМ");
  sectionHeading("Demo өгөгдөл & Credentials", 50);

  // Stats
  const statsData = [
    ["11", "Gaming center"],
    ["224", "Суудал"],
    ["40", "Захиалга"],
    ["12", "Үнэлгээ"],
    ["6", "Турнир"],
    ["4", "Эрх"],
  ];
  const bw = (W - M * 2) / 3 - 8;
  statsData.forEach(([val, lbl], i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    statBox(M + col * (bw + 12), 115 + row * 115, bw, 95, val, lbl);
  });

  // Credentials
  doc.rect(M, 365, W - M * 2, 1).fill(BORDER);
  doc.font(F.regular).fontSize(7).fillColor(DIM)
    .text("DEMO CREDENTIALS", M, 380, { characterSpacing: 3 });

  const creds = [
    ["Admin", "admin@reihen.mn", "admin123"],
    ["Owner (ENTERPRISE)", "oyunbaatar@reihen.mn", "owner123"],
    ["Owner (PRO)", "sarnai@reihen.mn", "owner123"],
    ["Demo Player", "demo@reihen.mn", "demo123"],
    ["Staff", "tulgaa@reihen.mn", "staff123"],
  ];

  creds.forEach(([role, email, pass], i) => {
    const y = 405 + i * 82;
    doc.rect(M, y, W - M * 2, 68).fillAndStroke("#0D0D0D", BORDER);
    doc.font(F.regular).fontSize(7).fillColor(DIM)
      .text(role.toUpperCase(), M + 14, y + 10, { characterSpacing: 2 });
    doc.font(F.regular).fontSize(12).fillColor("#DDDDDD")
      .text(email, M + 14, y + 26);
    doc.font(F.regular).fontSize(10).fillColor(DIM)
      .text(pass, M + 14, y + 46);
  });

  // ── Page 7: Conclusion ───────────────────────────────────
  newPage("06 · ДҮГНЭЛТ");
  sectionHeading("Дипломын ажлын үр дүн", 50);

  const conclusions = [
    "Full-stack веб платформ амжилттай бүрэн хэрэгжсэн",
    "Бодит цагийн WebSocket суудлын шинэчлэлт ажиллаж байна",
    "QPay Монгол төлбөрийн систем амжилттай нэгтгэгдсэн",
    "Role-based хандалтын удирдлага (Admin·Owner·Staff·Player)",
    "Vercel + Supabase дээр амжилттай production deploy хийгдсэн",
    "Push notification, AI chatbot, турнир систем хэрэгжсэн",
  ];

  conclusions.forEach((c, i) => bullet(c, 130 + i * 52, 0));

  doc.rect(M, 490, W - M * 2, 1).fill(BORDER);

  doc.font(F.regular).fontSize(7).fillColor(DIM)
    .text("LIVE URL", M, 510, { characterSpacing: 3 });
  doc.rect(M, 525, W - M * 2, 50).fillAndStroke("#0F0F0F", BORDER);
  doc.font(F.regular).fontSize(14).fillColor(WHITE)
    .text("reihen.vercel.app", M + 14, 541);

  doc.font(F.regular).fontSize(7).fillColor(DIM)
    .text("GITHUB REPOSITORY", M, 590, { characterSpacing: 3 });
  doc.rect(M, 605, W - M * 2, 50).fillAndStroke("#0F0F0F", BORDER);
  doc.font(F.regular).fontSize(14).fillColor(WHITE)
    .text("github.com/bakin86/reihen", M + 14, 621);

  doc.font(F.regular).fontSize(7).fillColor("#333333")
    .text("Reihen — PC Gaming Center Booking Platform · 2026", 0, H - 35, {
      width: W, align: "center",
    });

  doc.end();
  return new Promise((resolve) => out.on("finish", resolve));
}

// ── Main ──────────────────────────────────────────────────
async function main() {
  console.log("Generating PPTX...");
  await generatePPTX();
  console.log("✓ Reihen-Diploma-Presentation.pptx");

  console.log("Generating PDF...");
  await generatePDF();
  console.log("✓ Reihen-Diploma-Presentation.pdf");

  console.log("\nDone! Both files saved in project root.");
}

main().catch(console.error);
