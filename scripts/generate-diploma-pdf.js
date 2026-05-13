/**
 * Reihen — Diploma presentation PDF
 * Run: node scripts/generate-diploma-pdf.js
 */
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

const OUTPUT = path.join(__dirname, "..", "Reihen-Diploma-Presentation.pdf");
const LM = 55;
const RM = 540;
const CW = RM - LM;
const BOTTOM = 760;

const doc = new PDFDocument({
  size: "A4",
  bufferPages: true,
  margins: { top: 60, bottom: 60, left: LM, right: 55 },
  info: {
    Title: "Reihen - Дипломын төслийн танилцуулга",
    Author: "Reihen Team",
    Subject: "PC Gaming Center захиалга ба удирдлагын систем",
    CreationDate: new Date(),
  },
});

const stream = fs.createWriteStream(OUTPUT);
doc.pipe(stream);

const FONTS_DIR = "C:/Windows/Fonts";
doc.registerFont("Sans", path.join(FONTS_DIR, "arial.ttf"));
doc.registerFont("SansBold", path.join(FONTS_DIR, "arialbd.ttf"));
doc.registerFont("Mono", path.join(FONTS_DIR, "cour.ttf"));
doc.registerFont("MonoBold", path.join(FONTS_DIR, "courbd.ttf"));

const BLACK = "#080808";
const WHITE = "#F5F5F5";
const GRAY = "#626262";
const LIGHT = "#A0A0A0";
const LINE = "#D8D8D8";
const GREEN = "#15803D";
const BLUE = "#1D4ED8";
const ORANGE = "#C2410C";

function ensure(space = 50) {
  if (doc.y + space > BOTTOM) doc.addPage();
}

function h1(text) {
  ensure(90);
  doc.moveDown(1.2);
  doc.font("SansBold").fontSize(23).fillColor(BLACK).text(text, LM, doc.y, { width: CW });
  doc.moveDown(0.35);
  doc.moveTo(LM, doc.y).lineTo(RM, doc.y).strokeColor(BLACK).lineWidth(1.5).stroke();
  doc.moveDown(0.8);
}

function h2(text) {
  ensure(55);
  doc.moveDown(0.7);
  doc.font("SansBold").fontSize(14).fillColor(BLACK).text(text, LM, doc.y, { width: CW });
  doc.moveDown(0.25);
  doc.moveTo(LM, doc.y).lineTo(RM, doc.y).strokeColor(LINE).lineWidth(0.5).stroke();
  doc.moveDown(0.45);
}

function p(text) {
  ensure(35);
  doc.font("Sans").fontSize(10.2).fillColor(GRAY).text(text, LM, doc.y, {
    width: CW,
    lineGap: 3,
  });
  doc.moveDown(0.35);
}

function bullet(text) {
  ensure(24);
  doc.font("Sans").fontSize(10).fillColor(GRAY).text(`• ${text}`, LM + 10, doc.y, {
    width: CW - 10,
    lineGap: 2,
  });
  doc.moveDown(0.18);
}

function code(text) {
  ensure(22);
  doc.font("Mono").fontSize(8.8).fillColor("#333333").text(text, LM + 12, doc.y, {
    width: CW - 24,
    lineGap: 2,
  });
  doc.moveDown(0.2);
}

function kv(label, value) {
  ensure(24);
  const y = doc.y;
  doc.font("SansBold").fontSize(9.2).fillColor(BLACK).text(label, LM, y, { width: 155 });
  doc.font("Sans").fontSize(9.2).fillColor(GRAY).text(value, LM + 165, y, { width: CW - 165 });
  doc.y = Math.max(doc.y, y + 16);
}

function score(label, value, color) {
  ensure(28);
  const y = doc.y;
  doc.font("SansBold").fontSize(10).fillColor(BLACK).text(label, LM, y, { width: 160 });
  doc.rect(LM + 170, y + 2, 230, 8).fill("#ECECEC");
  doc.rect(LM + 170, y + 2, Math.round(230 * value), 8).fill(color);
  doc.font("MonoBold").fontSize(9).fillColor(BLACK).text(`${Math.round(value * 100)}%`, LM + 415, y - 1);
  doc.y = y + 22;
}

function table(headers, rows, widths) {
  ensure(45);
  let y = doc.y;
  let x = LM;
  doc.rect(LM, y - 3, CW, 20).fill("#111111");
  headers.forEach((h, i) => {
    doc.font("SansBold").fontSize(8.5).fillColor(WHITE).text(h, x + 5, y + 2, { width: widths[i] - 10 });
    x += widths[i];
  });
  doc.y = y + 23;
  rows.forEach((row, r) => {
    ensure(26);
    y = doc.y;
    x = LM;
    if (r % 2 === 0) doc.rect(LM, y - 2, CW, 22).fill("#F7F7F7");
    row.forEach((cell, i) => {
      doc.font("Sans").fontSize(8.5).fillColor(GRAY).text(String(cell), x + 5, y + 2, { width: widths[i] - 10 });
      x += widths[i];
    });
    doc.y = y + 24;
  });
  doc.moveDown(0.3);
}

function sectionLabel(text) {
  ensure(18);
  doc.font("SansBold").fontSize(8).fillColor(LIGHT).text(text.toUpperCase(), LM, doc.y, {
    characterSpacing: 1.4,
  });
  doc.moveDown(0.4);
}

// Cover
doc.rect(0, 0, 595.28, 841.89).fill(BLACK);
doc.font("SansBold").fontSize(64).fillColor(WHITE).text("REIHEN", LM, 230);
doc.font("Sans").fontSize(13).fillColor("#A3A3A3").text(
  "PC GAMING CENTER ЗАХИАЛГА БА УДИРДЛАГЫН СИСТЕМ",
  LM,
  doc.y + 8,
  { width: CW, characterSpacing: 1.5 }
);
doc.font("SansBold").fontSize(18).fillColor(WHITE).text("Дипломын төслийн танилцуулга", LM, 430, { width: CW });
doc.font("Sans").fontSize(10).fillColor("#9CA3AF").text(`Огноо: ${new Date().toLocaleDateString("mn-MN")}`, LM, 470);
doc.font("Sans").fontSize(10).fillColor("#9CA3AF").text("Төлөв: Demo-ready MVP+", LM, 490);
doc.font("Sans").fontSize(10).fillColor("#9CA3AF").text("Үндсэн зорилго: PC center-ийн суудлын захиалга, төлбөр, staff/owner удирдлага", LM, 510, { width: CW });
doc.moveTo(LM, 765).lineTo(RM, 765).strokeColor("#333333").lineWidth(1).stroke();
doc.font("Mono").fontSize(8).fillColor("#777777").text("Next.js 14 · Prisma · MariaDB · JWT · QPay mock/sandbox · Socket.io", LM, 778);

doc.addPage();
h1("1. Төслийн тойм");
p("Reihen нь Улаанбаатар хотын PC Gaming Center-үүдийн сул суудлыг нэг дор харж, цаг сонгон захиалах, төлбөр төлөх, owner болон staff түвшинд төвөө удирдах боломжтой веб платформ юм.");
p("Дипломын хувьд энэ төсөл нь бодит хэрэглээний асуудлыг шийдсэн, олон role-той, real-time seat status, payment flow, admin/owner/staff workflow агуулсан full-stack систем гэдгээрээ онцлог.");
h2("Шийдэх асуудал");
bullet("Тоглогч сул суудал хаана байгааг real-time мэдэхгүй.");
bullet("PC center захиалгыг гараар, чат/утсаар авах нь давхар захиалга үүсгэдэг.");
bullet("Owner өдөр тутмын орлого, seat occupancy, staff эрхийг нэг системээс харах боломж муу.");
bullet("Staff зөвхөн өөрт оноосон төвийн захиалга, check-in, seat status-ийг удирдах шаардлагатай.");
h2("Гол хэрэглэгчид");
table(
  ["Role", "Хэрэгцээ", "Системийн шийдэл"],
  [
    ["Player", "Суудал хайх, захиалах, төлбөр төлөх", "Booking page, profile, history, QPay/balance"],
    ["Owner", "Төв, суудал, staff, dashboard удирдах", "Owner dashboard, center CRUD, layout, staff permissions"],
    ["Staff", "Check-in, seat status, өнөөдрийн booking харах", "Staff dashboard, permission-based access"],
    ["Admin", "Системийн хяналт", "Role guard, admin endpoint суурь"],
  ],
  [75, 185, 225]
);

h1("2. Үндсэн боломжууд");
h2("Player тал");
bullet("Төвүүдийн жагсаалт, дүүрэг/үнэ/сул суудлаар харах.");
bullet("Төвийн дэлгэрэнгүй, seat map, floor-based суудлын бүтэц.");
bullet("Олон суудал нэг дор захиалах.");
bullet("Peak hour үнэ бодох logic.");
bullet("QPay mock/sandbox/live mode суурьтай төлбөр.");
bullet("Booking history, cancel, extend, review.");
h2("Owner тал");
bullet("Өөрийн төвүүдийн dashboard: орлого, booking count, open/total seats, occupancy.");
bullet("Center profile, images, seat types, floors, layout удирдах.");
bullet("Staff invite, staff permission удирдах.");
bullet("Tournament үүсгэх, бүртгэл харах, status өөрчлөх.");
h2("Staff тал");
bullet("Өөрт оноосон төвүүдийг харах.");
bullet("Өнөөдрийн booking, check-in, no-show workflow.");
bullet("Seat status update: OPEN, OCCUPIED, REPAIR, CLOSED, WAITING.");
bullet("Permission тус бүрээр хязгаарлагдсан access.");

h1("3. Технологийн стек");
table(
  ["Давхарга", "Технологи", "Үүрэг"],
  [
    ["Frontend", "Next.js 14 App Router, React 18, TailwindCSS", "UI, routing, client state"],
    ["Backend", "Next.js API Routes", "Auth, booking, payment, owner/staff APIs"],
    ["Database", "MariaDB + Prisma ORM", "Schema, relation, migration, query"],
    ["Auth", "JWT, httpOnly cookie, refresh token, CSRF", "Аюулгүй login/session"],
    ["Realtime", "Socket.io", "Seat status update broadcast"],
    ["Payment", "QPay mock/sandbox/live abstraction", "Invoice, callback, refund суурь"],
    ["Validation", "Zod, TypeScript strict", "Input validation, type safety"],
    ["Ops", "Standalone build, Docker, PM2 config", "Deployment бэлтгэл"],
  ],
  [95, 190, 200]
);
h2("Яагаад энэ стек вэ?");
bullet("Next.js нь frontend болон backend API-г нэг repo-д цэвэр зохион байгуулж өгнө.");
bullet("Prisma нь relation-heavy booking domain-д schema-г ойлгомжтой болгодог.");
bullet("JWT + cookie auth нь browser болон API/mobile fallback-д тохиромжтой.");
bullet("Socket.io нь seat status real-time update хийхэд шууд хэрэглэхэд хялбар.");

h1("4. Архитектур");
sectionLabel("High-level flow");
code("Browser / Mobile");
code("   -> Next.js App Router UI");
code("   -> API Routes: auth, centers, bookings, owner, staff, tournaments");
code("   -> Prisma ORM");
code("   -> MariaDB");
code("   -> Socket.io server for realtime seat:update");
code("   -> QPay callback / mock payment confirmation");
h2("Гол flow: Booking үүсгэх");
bullet("Player seatIds, startTime, hours, paymentMethod илгээнэ.");
bullet("API input validation хийнэ.");
bullet("Seat-үүд нэг center-ийнх эсэх, policy maxSeats шалгана.");
bullet("Peak hour price тооцно.");
bullet("Payment process хийнэ.");
bullet("Transaction дотор overlap booking дахин шалгаж booking үүсгэнэ.");
bullet("Immediate paid booking бол seat status OCCUPIED болгож realtime update илгээнэ.");
h2("Race condition хамгаалалт");
p("Захиалга үүсгэх үед overlap check болон booking create-г transaction дотор хийсэн. Ингэснээр хоёр хэрэглэгч ижил суудлыг ижил цагт зэрэг авах эрсдэлийг бууруулсан.");

h1("5. Өгөгдлийн сангийн загвар");
table(
  ["Model", "Тайлбар"],
  [
    ["User", "Player, Staff, Owner, Admin хэрэглэгчид"],
    ["PCCenter", "PC gaming center-ийн үндсэн мэдээлэл"],
    ["Floor", "Center-ийн давхар/бүс"],
    ["SeatType", "Үнэ, peak price, төрөл"],
    ["Seat", "Суудлын дугаар, status, layout position"],
    ["Booking", "Захиалга, төлбөр, хугацаа, статус"],
    ["BookingSeat", "Нэг booking олон seat-тэй холбогдох relation"],
    ["CenterStaff", "Staff assignment болон permission"],
    ["Tournament", "Center дээрх тэмцээн"],
    ["Review", "Completed booking дээр review"],
  ],
  [120, 365]
);
h2("Чухал relation");
bullet("User 1:N Booking");
bullet("PCCenter 1:N Seat, Floor, SeatType, Booking, Staff");
bullet("Booking N:M Seat via BookingSeat");
bullet("PCCenter 1:N Tournament");
bullet("User N:M Tournament via TournamentTeam/TournamentMember");

h1("6. API ба permission");
table(
  ["Endpoint", "Role", "Үүрэг"],
  [
    ["POST /api/auth/login", "Public", "Нэвтрэх"],
    ["GET /api/centers", "Public", "Төвүүдийн жагсаалт"],
    ["GET /api/centers/[id]/seats", "Public", "Seat availability"],
    ["POST /api/bookings", "Player", "Захиалга үүсгэх"],
    ["PATCH /api/bookings/[id]/cancel", "Player/Admin", "Захиалга цуцлах"],
    ["PATCH /api/bookings/[id]/extend", "Player/Admin", "Захиалга сунгах"],
    ["GET /api/owner/dashboard", "Owner", "Owner analytics"],
    ["GET /api/staff/dashboard", "Staff/Owner", "Staff workflow"],
    ["GET /api/qpay/callback", "QPay/Public", "Payment confirmation"],
  ],
  [210, 95, 180]
);
h2("Security суурь");
bullet("Password bcrypt hash.");
bullet("JWT access token богино настай, refresh token DB дээр hashed байдлаар хадгалагдана.");
bullet("CSRF token mutation request дээр шалгагдана.");
bullet("Role guard: Player, Staff, Owner, Admin.");
bullet("Middleware rate limit production орчинд ажиллана.");

h1("7. Demo сценарийн дараалал");
table(
  ["Алхам", "Юу үзүүлэх", "Оноо авах санаа"],
  [
    ["1", "Home page, center list", "Системийн үндсэн зорилго шууд ойлгогдоно"],
    ["2", "Center detail + seat map", "Суудлын real-time status, floor view"],
    ["3", "Player login", "Auth/session ажиллаж байна"],
    ["4", "Booking create", "Core business logic"],
    ["5", "Payment mock/QPay pending", "Payment integration abstraction"],
    ["6", "Booking cancel", "Policy + cleanup flow"],
    ["7", "Owner dashboard", "Business analytics"],
    ["8", "Staff dashboard", "Operational workflow"],
    ["9", "Smoke test command", "Backend scenario proof"],
  ],
  [55, 210, 220]
);
h2("Demo account");
kv("Admin", "admin@reihen.mn / admin123");
kv("Owner", "bold@reihen.mn / owner123");
kv("Staff", "tulgaa@reihen.mn / staff123");
kv("Player", "batbayar@gmail.com / player123");

h1("8. Одоогийн шалгалтын үр дүн");
p("Төслийг дипломын demo-д бэлдэхдээ build, lint, schema validation болон smoke scenario шалгалтуудыг хийсэн.");
table(
  ["Шалгалт", "Үр дүн"],
  [
    ["npm run lint", "PASS — ESLint warning/error байхгүй"],
    ["npm run build", "PASS — production build амжилттай"],
    ["npx prisma validate", "PASS — schema valid"],
    ["npm run start", "PASS — standalone server зөв асаана"],
    ["npm run smoke", "PASS — гол API scenario-ууд амжилттай"],
  ],
  [190, 295]
);
h2("Smoke test хамарсан зүйлс");
bullet("Health + DB connectivity.");
bullet("Centers list, center seats.");
bullet("Player login, booking list.");
bullet("Open seat availability.");
bullet("Booking create + cancel cleanup.");
bullet("Owner dashboard.");
bullet("Staff dashboard.");

h1("9. Бэлэн байдлын үнэлгээ");
score("Feature coverage", 0.75, BLUE);
score("Demo readiness", 0.80, GREEN);
score("Production readiness", 0.60, ORANGE);
score("Diploma readiness", 0.75, GREEN);
p("Дүгнэлт: Reihen нь дипломын demo-д 70%+ түвшинд хүрсэн. Core flow ажиллаж байгаа: center browsing, seat availability, booking, payment abstraction, owner/staff dashboard, auth, schema, build, smoke test.");
h2("Үлдсэн эрсдэл");
bullet("Production payment live credentials, webhook deployment URL бүрэн тохируулах шаардлагатай.");
bullet("Automated end-to-end browser test нэмвэл илүү сайн.");
bullet("Admin dashboard одоогоор суурь түвшинд байна.");
bullet("Monitoring/log aggregation production түвшинд бүрэн хийгдээгүй.");

h1("10. Ирээдүйн хөгжүүлэлт");
bullet("Admin panel: center verification, user moderation, payment audit.");
bullet("Redis-based rate limit/session coordination for multi-instance deployment.");
bullet("Playwright E2E tests: booking, payment, staff workflow.");
bullet("Mobile-first booking UX polish.");
bullet("Revenue reports, monthly analytics, export.");
bullet("Real QPay live deployment checklist.");
bullet("Audit log: owner/staff action бүрийг бүртгэх.");
bullet("Notification center: push/SMS/email unified log.");

h1("11. Дүгнэлт");
p("Reihen төсөл нь бодит хэрэглээний асуудал дээр тулгуурласан, full-stack architecture-тэй, олон role болон booking/payment workflow агуулсан систем юм. Дипломын хамгаалалтад core features болон technical architecture-ийг харуулахад хангалттай түвшинд бэлтгэгдсэн.");
p("Хамгийн чухал нь demo дээр backend smoke test ажиллуулж, гол flow-ууд бодитоор pass болж байгааг харуулах боломжтой болсон. Энэ нь зөвхөн UI mock биш, ажилладаг систем гэдгийг батална.");

const range = doc.bufferedPageRange();
for (let i = range.start; i < range.start + range.count; i++) {
  doc.switchToPage(i);
  if (i === 0) continue;
  doc.font("Mono").fontSize(8).fillColor(LIGHT).text(`REIHEN · Diploma Presentation · ${i + 1}`, LM, 805, {
    width: CW,
    align: "center",
  });
}

doc.end();

stream.on("finish", () => {
  console.log(`Generated ${OUTPUT}`);
});
