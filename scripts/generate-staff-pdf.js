/**
 * Reihen — Staff System Documentation PDF
 * Run: node scripts/generate-staff-pdf.js
 */
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

const OUTPUT = path.join(__dirname, "..", "Reihen-Staff-System.pdf");
const LM = 55;
const RM = 540;
const CW = RM - LM;

const doc = new PDFDocument({
  size: "A4",
  margins: { top: 60, bottom: 60, left: LM, right: 55 },
  info: {
    Title: "Reihen - Ажилтны систем",
    Author: "Reihen Team",
    Subject: "Staff system documentation",
    CreationDate: new Date(),
  },
});

const stream = fs.createWriteStream(OUTPUT);
doc.pipe(stream);

// Register fonts
const FONTS_DIR = "C:/Windows/Fonts";
doc.registerFont("Sans", path.join(FONTS_DIR, "arial.ttf"));
doc.registerFont("SansBold", path.join(FONTS_DIR, "arialbd.ttf"));
doc.registerFont("Mono", path.join(FONTS_DIR, "cour.ttf"));
doc.registerFont("MonoBold", path.join(FONTS_DIR, "courbd.ttf"));

// Helper functions
function title(text) {
  doc.font("SansBold").fontSize(28).text(text, LM, doc.y, { width: CW });
  doc.moveDown(0.5);
}

function heading(text) {
  doc.moveDown(0.8);
  doc.font("SansBold").fontSize(16).text(text, LM, doc.y, { width: CW });
  doc.moveDown(0.3);
  doc.moveTo(LM, doc.y).lineTo(RM, doc.y).lineWidth(0.5).stroke("#cccccc");
  doc.moveDown(0.4);
}

function subheading(text) {
  doc.moveDown(0.4);
  doc.font("SansBold").fontSize(12).text(text, LM, doc.y, { width: CW });
  doc.moveDown(0.2);
}

function para(text) {
  doc.font("Sans").fontSize(10).text(text, LM, doc.y, { width: CW, lineGap: 3 });
  doc.moveDown(0.3);
}

function bullet(text) {
  doc.font("Sans").fontSize(10).text(`•  ${text}`, LM + 10, doc.y, { width: CW - 10, lineGap: 2 });
  doc.moveDown(0.15);
}

function numberedItem(num, text) {
  doc.font("SansBold").fontSize(10).text(`${num}.`, LM + 5, doc.y, { continued: true, width: 20 });
  doc.font("Sans").fontSize(10).text(` ${text}`, { width: CW - 25, lineGap: 2 });
  doc.moveDown(0.15);
}

function code(text) {
  doc.font("Mono").fontSize(9).fillColor("#333333").text(text, LM + 15, doc.y, { width: CW - 30 });
  doc.fillColor("#000000");
  doc.moveDown(0.2);
}

function tableRow(cols, widths, bold) {
  const y = doc.y;
  let x = LM;
  cols.forEach((col, i) => {
    doc.font(bold ? "SansBold" : "Sans").fontSize(9).text(col, x + 4, y, { width: widths[i] - 8 });
    x += widths[i];
  });
  doc.y = y + 18;
  doc.moveTo(LM, doc.y).lineTo(RM, doc.y).lineWidth(0.3).stroke("#e0e0e0");
  doc.moveDown(0.1);
}

function checkPage() {
  if (doc.y > 720) doc.addPage();
}

// ─── COVER ───────────────────────────────────────────────
doc.font("SansBold").fontSize(42).text("REIHEN", LM, 180, { width: CW });
doc.moveDown(0.3);
doc.font("SansBold").fontSize(22).fillColor("#555555").text("Ажилтны систем", LM, doc.y, { width: CW });
doc.fillColor("#000000");
doc.moveDown(1);
doc.font("Sans").fontSize(11).fillColor("#888888").text("Staff Management System Documentation", LM, doc.y, { width: CW });
doc.moveDown(0.5);
doc.font("Sans").fontSize(11).text(`Огноо: ${new Date().toLocaleDateString("mn-MN")}`, LM, doc.y, { width: CW });
doc.fillColor("#000000");

// ─── PAGE 2: OVERVIEW ────────────────────────────────────
doc.addPage();
title("Тойм");
para("Reihen платформ дээр PC Gaming Center-ийн эзэмшигч (Owner) нь өөрийн ажилтнуудыг системд бүртгэж, хязгаарлагдмал эрхтэйгээр удирдах боломжтой.");
doc.moveDown(0.3);

subheading("Үндсэн ойлголт");
bullet("STAFF — PLAYER болон OWNER хооронд байрлах шинэ роль");
bullet("Нэг ажилтан олон төвд хуваарилагдаж болно");
bullet("Эрх тус бүрээр тохируулагдана (check-in, seat status, view bookings)");
bullet("Push notification-ээр шинэ захиалга дамжуулна");

doc.moveDown(0.5);
subheading("Роль шатлал");
para("PLAYER → STAFF → OWNER → ADMIN");
doc.moveDown(0.2);
bullet("PLAYER: Захиалга хийх, профайл удирдах");
bullet("STAFF: Тодорхой төвд хуваарилагдсан эрхүүд");
bullet("OWNER: Бүх төвийн удирдлага, ажилтан нэмэх/хасах");
bullet("ADMIN: Бүх системийн бүрэн эрх");

// ─── OWNER ACTIONS ───────────────────────────────────────
doc.addPage();
title("Эзэмшигчийн үйлдлүүд");

heading("1. Бүртгэлтэй хэрэглэгчийг нэмэх");
numberedItem(1, "Owner → /owner/staff → Утасны дугаар оруулах + Төв сонгох → \"УРИХ\"");
numberedItem(2, "API хэрэглэгчийг утсаар хайна → CenterStaff бичлэг үүсгэнэ");
numberedItem(3, "Хэрэглэгч PLAYER байсан бол → STAFF болж дэвшинэ");
numberedItem(4, "Push notification илгээнэ: \"Ажилтан болсон!\"");
doc.moveDown(0.3);
para("Энэ тохиолдолд урилгын токен шаардлагагүй — шууд нэмэгдэнэ.");

checkPage();
heading("2. Шинэ хүнийг урих (бүртгэлгүй)");
numberedItem(1, "Owner → Утасны дугаар оруулах → \"УРИХ\"");
numberedItem(2, "StaffInvite үүснэ: санамсаргүй токен, 7 хоногийн хүчинтэй хугацаа");
numberedItem(3, "\"Хүлээгдэж байгаа урилга\" хэсэгт харагдана");
numberedItem(4, "Owner тухайн хүнд бүртгүүлэхийг хэлнэ (амаар/SMS)");
numberedItem(5, "Хүн тэр утсаар бүртгүүлэхэд автоматаар STAFF болно");

checkPage();
heading("3. Ажилтан хасах");
numberedItem(1, "Owner → Ажилтны хажууд \"ХАСАХ\" дарна");
numberedItem(2, "CenterStaff бичлэг устна");
numberedItem(3, "Бусад төвд хуваарилагдаагүй бол → PLAYER руу буцна");

checkPage();
heading("4. Эрх тохируулах");
para("Ажилтан бүрт 3 эрх байна:");
bullet("CHECK-IN — Захиалга дээр \"Arrived\" дарах");
bullet("SEAT STATUS — Суудлын төлөв солих (OPEN/CLOSED/REPAIR...)");
bullet("VIEW BOOKINGS — Өнөөдрийн захиалгуудыг харах");
doc.moveDown(0.2);
para("Товчлуур дарж асааж/унтрааж болно. Шууд хүчин төгөлдөр болно.");

// ─── STAFF LOGIN ─────────────────────────────────────────
doc.addPage();
title("Ажилтны нэвтрэлт");

heading("Хувилбар 1: Бүртгэлтэй хэрэглэгч");
numberedItem(1, "Owner утасны дугаараар нэмсэн → роль STAFF болсон");
numberedItem(2, "Хэвийн /login хуудсаар нэвтэрнэ (email + password)");
numberedItem(3, "NavBar дээр \"Staff\" линк гарна → /staff dashboard");

checkPage();
heading("Хувилбар 2: Шинэ хүн бүртгүүлэх");
numberedItem(1, "/register хуудас → нэр, email, нууц үг, утас бөглөх");
numberedItem(2, "API тэр утсанд хүлээгдэж буй StaffInvite байгааг шалгана");
numberedItem(3, "Байвал → STAFF ролиор бүртгэнэ (PLAYER/OWNER сонголтыг үгүйсгэнэ)");
numberedItem(4, "CenterStaff бичлэг автомат үүснэ, урилга \"used\" болно");
numberedItem(5, "Нэвтэрсэн — шууд /staff dashboard руу орж болно");

checkPage();
heading("Хувилбар 3: Урилга хугацаа дууссан");
numberedItem(1, "7 хоног өнгөрсний дараа бүртгүүлбэл");
numberedItem(2, "Хэвийн PLAYER бүртгэл болно");
numberedItem(3, "Owner дахин урих ёстой");

// ─── STAFF DASHBOARD ─────────────────────────────────────
doc.addPage();
title("Ажилтны Dashboard");
para("URL: /staff");
doc.moveDown(0.3);

heading("Статистик мөр");
bullet("Сул суудал / Нийт суудал");
bullet("Өнөөдрийн захиалга тоо");
bullet("Хүлээгдэж буй (arrived бус) захиалга тоо");

checkPage();
heading("Захиалга харах (canViewBookings)");
bullet("Өнөөдрийн PENDING + CONFIRMED захиалгууд");
bullet("Захиалга бүр дээр: код, хэрэглэгч нэр, суудлууд, цаг");
bullet("Шүүлт: тухайн төвийн захиалгууд л харагдана");

checkPage();
heading("Check-in (canCheckin)");
numberedItem(1, "\"ARRIVED\" товч дарна");
numberedItem(2, "API: суудлуудыг OCCUPIED болгоно, freeAt тохируулна");
numberedItem(3, "Хэрэглэгчид push: \"Тоглолт эхэллээ\"");
numberedItem(4, "Захиалга дээр ногоон \"PLAYING\" indicator гарна");
numberedItem(5, "Суудлын grid шууд шинэчлэгдэнэ (real-time)");

checkPage();
heading("Суудлын төлөв солих (canSeatStatus)");
numberedItem(1, "Суудал дээр дарж олноор сонгоно");
numberedItem(2, "SET STATUS панел гарна (дээд талд)");
numberedItem(3, "OPEN / CLOSED / REPAIR / WAITING / OCCUPIED сонгоно");
numberedItem(4, "Бүх сонгосон суудлууд нэг дор шинэчлэгдэнэ");
numberedItem(5, "Socket.IO-ээр бусад холбогдсон хүмүүст дамжина");

// ─── PUSH NOTIFICATIONS ─────────────────────────────────
doc.addPage();
title("Push Notification");

heading("Ажилтанд ирэх мэдэгдлүүд");
doc.moveDown(0.2);

subheading("Шинэ захиалга ирэхэд");
bullet("Хэнд: canViewBookings эрхтэй бүх ажилтан");
bullet("Гарчиг: \"Шинэ захиалга\"");
bullet("Агуулга: Захиалгын код + суудлууд + цаг");
bullet("URL: /staff");

doc.moveDown(0.3);
subheading("Ажилтнаар нэмэгдэхэд");
bullet("Хэнд: Нэмэгдсэн хэрэглэгч");
bullet("Гарчиг: \"Ажилтан болсон!\"");
bullet("Агуулга: [Төвийн нэр] танд ажилтны эрх олголоо");
bullet("URL: /staff");

// ─── ACCESS CONTROL TABLE ────────────────────────────────
doc.addPage();
title("Эрхийн хүснэгт");
doc.moveDown(0.5);

const colW = [160, 65, 65, 65, 65];
tableRow(["Үйлдэл", "PLAYER", "STAFF", "OWNER", "ADMIN"], colW, true);
doc.moveDown(0.1);
tableRow(["Суудал захиалах", "✓", "✓", "✓", "✓"], colW, false);
tableRow(["/staff dashboard харах", "✗", "✓", "✓", "✓"], colW, false);
tableRow(["Check-in хийх", "✗", "Эрхээр", "✓", "✓"], colW, false);
tableRow(["Суудал төлөв солих", "✗", "Эрхээр", "✓", "✓"], colW, false);
tableRow(["Захиалга харах (staff)", "✗", "Эрхээр", "✓", "✓"], colW, false);
tableRow(["Төв засварлах / floor / seat", "✗", "✗", "✓", "✓"], colW, false);
tableRow(["Ажилтан удирдах", "✗", "✗", "✓", "✓"], colW, false);
tableRow(["Тэмцээн үүсгэх", "✗", "✗", "✓", "✓"], colW, false);
tableRow(["Бүх систем удирдах", "✗", "✗", "✗", "✓"], colW, false);

doc.moveDown(1);
para("\"Эрхээр\" = Тухайн төвд хуваарилагдсан тусгай эрхээс хамаарна (canCheckin, canSeatStatus, canViewBookings).");

// ─── MULTI-CENTER ────────────────────────────────────────
checkPage();
heading("Олон төвийн ажилтан");
bullet("Нэг хүн олон төвд STAFF байж болно");
bullet("Төв бүрт бие даасан эрх тохируулагдана");
bullet("Staff dashboard дээр төв сонгох tab-ууд гарна");
bullet("Бүх төвөөс хасагдвал → PLAYER руу буцна");

// ─── TECHNICAL ───────────────────────────────────────────
doc.addPage();
title("Техникийн тэмдэглэл");

heading("Database моделиуд");
subheading("CenterStaff");
code("model CenterStaff {");
code("  id, userId, centerId");
code("  canCheckin, canSeatStatus, canViewBookings");
code("  @@unique([userId, centerId])");
code("}");
doc.moveDown(0.3);

subheading("StaffInvite");
code("model StaffInvite {");
code("  id, centerId, phone, token (unique)");
code("  expiresAt, usedAt");
code("}");

checkPage();
heading("API Endpoints");
doc.moveDown(0.2);
code("GET    /api/owner/staff          — Ажилтнуудын жагсаалт");
code("POST   /api/owner/staff          — Урих (phone + centerId)");
code("PATCH  /api/owner/staff/:id      — Эрх шинэчлэх");
code("DELETE /api/owner/staff/:id      — Хасах");
code("");
code("GET    /api/staff/dashboard      — Staff dashboard data");
code("POST   /api/auth/staff-invite    — Токеноор урилга хүлээн авах");
code("");
code("PATCH  /api/owner/seats/:id/status  — STAFF+OWNER эрхтэй");
code("PATCH  /api/owner/bookings/:id/checkin — STAFF+OWNER эрхтэй");
code("PATCH  /api/owner/bookings/:id/noshow  — STAFF+OWNER эрхтэй");

checkPage();
heading("Аюулгүй байдал");
bullet("assertCenterAccess() — Owner эсвэл тухайн төвд хуваарилагдсан STAFF-д зөвшөөрнө");
bullet("Эрх бүрийг тусад нь шалгана (canCheckin, canSeatStatus, canViewBookings)");
bullet("StaffInvite токен: crypto.randomBytes(24) — 48 hex тэмдэгт");
bullet("7 хоногийн дараа автомат хүчингүй болно");
bullet("Нэг удаа ашиглагдана (usedAt тэмдэглэнэ)");

// ─── END ─────────────────────────────────────────────────
doc.moveDown(2);
doc.font("Sans").fontSize(9).fillColor("#888888")
  .text("Generated by Reihen · " + new Date().toISOString().slice(0, 10), LM, doc.y, { width: CW, align: "center" });

doc.end();
stream.on("finish", () => {
  console.log(`PDF saved: ${OUTPUT} (${(fs.statSync(OUTPUT).size / 1024).toFixed(0)} KB)`);
});
