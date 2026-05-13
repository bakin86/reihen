/**
 * Reihen — Төслийн баримт бичиг PDF
 * Run: node scripts/generate-docs-pdf.js
 */
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

const OUTPUT = path.join(__dirname, "..", "Reihen-Documentation.pdf");
const LM = 55; // left margin
const RM = 540; // right edge
const CW = RM - LM; // content width

const doc = new PDFDocument({
  size: "A4",
  margins: { top: 60, bottom: 60, left: LM, right: 55 },
  info: {
    Title: "Reihen - Төслийн баримт бичиг",
    Author: "Reihen Team",
    Subject: "PC Gaming Center захиалга & удирдлагын платформ",
    CreationDate: new Date(),
  },
});

const stream = fs.createWriteStream(OUTPUT);
doc.pipe(stream);

// Register system fonts with Cyrillic support
const FONTS_DIR = "C:/Windows/Fonts";
doc.registerFont("Sans", path.join(FONTS_DIR, "arial.ttf"));
doc.registerFont("SansBold", path.join(FONTS_DIR, "arialbd.ttf"));
doc.registerFont("Mono", path.join(FONTS_DIR, "cour.ttf"));
doc.registerFont("MonoBold", path.join(FONTS_DIR, "courbd.ttf"));

const BLACK = "#000000";
const GRAY = "#666666";
const LIGHT = "#999999";
const ACCENT = "#222222";
const DIVIDER = "#DDDDDD";

function heading1(text) {
  doc.moveDown(1.5);
  doc.fontSize(24).font("SansBold").fillColor(BLACK).text(text, LM);
  doc.moveDown(0.3);
  doc.moveTo(LM, doc.y).lineTo(RM, doc.y).strokeColor(BLACK).lineWidth(2).stroke();
  doc.moveDown(0.8);
}

function heading2(text) {
  checkPageBreak(50);
  doc.moveDown(1);
  doc.fontSize(14).font("SansBold").fillColor(ACCENT).text(text, LM, doc.y, { width: CW });
  doc.moveDown(0.3);
  doc.moveTo(LM, doc.y).lineTo(RM, doc.y).strokeColor(DIVIDER).lineWidth(0.5).stroke();
  doc.moveDown(0.5);
}

function heading3(text) {
  checkPageBreak(30);
  doc.moveDown(0.6);
  doc.fontSize(12).font("SansBold").fillColor(BLACK).text(text, LM, doc.y, { width: CW });
  doc.moveDown(0.3);
}

function body(text) {
  doc.fontSize(10).font("Sans").fillColor(GRAY).text(text, LM, doc.y, { width: CW, lineGap: 3 });
}

function mono(text) {
  doc.fontSize(9).font("Mono").fillColor(ACCENT).text(text, LM, doc.y, { width: CW, lineGap: 2 });
}

function bullet(text) {
  doc.fontSize(10).font("Sans").fillColor(GRAY).text(`  •  ${text}`, LM, doc.y, { width: CW, lineGap: 3 });
}

function tableRow(label, value) {
  checkPageBreak(20);
  const y = doc.y;
  doc.fontSize(9).font("SansBold").fillColor(BLACK).text(label, LM, y, { width: 160 });
  doc.fontSize(9).font("Sans").fillColor(GRAY).text(value, LM + 170, y, { width: CW - 170 });
  doc.y = Math.max(doc.y, y + 14);
  doc.moveDown(0.2);
}

function apiRow(method, apiPath, desc, auth) {
  checkPageBreak(22);
  const y = doc.y;
  const mc = method === "GET" ? "#2563EB" : method === "POST" ? "#16A34A" : method === "PATCH" ? "#D97706" : "#DC2626";
  doc.fontSize(8).font("MonoBold").fillColor(mc).text(method, LM, y, { width: 45 });
  doc.fontSize(8).font("Mono").fillColor(BLACK).text(apiPath, LM + 48, y, { width: 220 });
  doc.fontSize(8).font("Sans").fillColor(GRAY).text(desc, LM + 275, y, { width: 155 });
  doc.fontSize(7).font("Sans").fillColor(LIGHT).text(auth || "", LM + 435, y, { width: 50 });
  doc.y = Math.max(doc.y, y + 13);
  doc.moveDown(0.2);
}

function checkPageBreak(needed) {
  if (doc.y + needed > 760) doc.addPage();
}

// ════════════════════════════════════════════════════════════
// НҮҮР ХУУДАС
// ════════════════════════════════════════════════════════════

doc.rect(0, 0, 595.28, 841.89).fill(BLACK);
doc.fontSize(72).font("SansBold").fillColor("#FFFFFF").text("REIHEN", LM, 250);
doc.fontSize(13).font("Sans").fillColor("#888888").text("PC GAMING CENTER ЗАХИАЛГА & УДИРДЛАГА", LM, doc.y + 8, { characterSpacing: 2 });

doc.fontSize(10).font("Sans").fillColor("#666666").text("ТӨСЛИЙН БАРИМТ БИЧИГ", LM, 500, { characterSpacing: 2 });
doc.fontSize(10).fillColor("#555555").text(`Огноо: ${new Date().toLocaleDateString("mn-MN")}`, LM, doc.y + 8);
doc.fontSize(10).fillColor("#555555").text("Хувилбар: 0.1.0", LM, doc.y + 6);
doc.fontSize(10).fillColor("#555555").text("Улаанбаатар, Монгол", LM, doc.y + 6);

doc.moveTo(LM, 780).lineTo(RM, 780).strokeColor("#333333").lineWidth(1).stroke();
doc.fontSize(8).fillColor("#444444").text("Нууцлалтай", LM, 790);

// ════════════════════════════════════════════════════════════
// АГУУЛГА
// ════════════════════════════════════════════════════════════

doc.addPage();
doc.fontSize(28).font("SansBold").fillColor(BLACK).text("Агуулга", LM, 60);
doc.moveDown(1.5);

const toc = [
  ["1", "Төслийн тойм"],
  ["2", "Технологийн стек"],
  ["3", "Архитектур"],
  ["4", "Өгөгдлийн сангийн схем"],
  ["5", "API лавлах"],
  ["6", "Хуудсууд & UI"],
  ["7", "Бодит цагийн боломжууд"],
  ["8", "Фон процессууд"],
  ["9", "Төлбөрийн интеграц"],
  ["10", "Аюулгүй байдал"],
  ["11", "Онцлох боломжууд"],
];
for (const [num, title] of toc) {
  doc.fontSize(12).font("Sans").fillColor(GRAY).text(`${num.padStart(2, " ")}    ${title}`, LM, doc.y, { lineGap: 10 });
}

// ════════════════════════════════════════════════════════════
// 1. ТӨСЛИЙН ТОЙМ
// ════════════════════════════════════════════════════════════

doc.addPage();
heading1("1. Төслийн тойм");

body(
  "Reihen нь Улаанбаатар хотын PC тоглоомын төвүүдийг нэгтгэсэн бүрэн стек веб платформ юм. " +
  "Тоглогчид суудлын бодит цагийн хүртээмжийг харж, шууд захиалга өгч, QPay болон " +
  "Balance-аар төлбөр төлөх боломжтой. Мөн тэмцээнд бүртгүүлэх, дуртай төвүүдээ хадгалах, " +
  "тоглолтын статистикаа хянах зэрэг олон боломжуудтай.\n\n" +
  "Платформ нь гурван хэрэглэгчийн үүрэгтэй: Тоглогч (суудал захиалах), " +
  "Эзэмшигч (төвөө удирдах, тэмцээн зохион байгуулах), Админ (системийг хянах)."
);

doc.moveDown(0.8);
heading3("Гол боломжууд");
bullet("Socket.IO-р бодит цагийн суудлын хүртээмж");
bullet("Олон суудал нэг захиалгаар, QPay болон Balance төлбөр");
bullet("Суудал чөлөөлөгдөх хүртэлх хугацааны тоолуур");
bullet("Тэмцээн зохион байгуулах, баг бүртгүүлэх, оролцох хураамж");
bullet("Дуртай төвүүд, суудал чөлөөлөгдөхөд push мэдэгдэл");
bullet("Тоглогчийн статистик: зарцуулалт, тоглосон цаг, давтамж");
bullet("Эзэмшигчийн хяналтын самбар: орлого, ачаалал, оргил цаг");
bullet("Drag-and-drop давхрын зураглал засварлагч");
bullet("Web Push мэдэгдлүүд (сануулга, шинэ тэмцээн, суудал)");
bullet("Үнэлгээ, сэтгэгдэл, эзэмшигчийн хариулт");
bullet("Захиалгын багцууд (Starter / Pro / Enterprise)");
bullet("AI чатбот туслах");
bullet("Е-баримт холболт");

// ════════════════════════════════════════════════════════════
// 2. ТЕХНОЛОГИЙН СТЕК
// ════════════════════════════════════════════════════════════

doc.addPage();
heading1("2. Технологийн стек");

heading3("Фронтэнд");
tableRow("Фреймворк", "Next.js 14+ (App Router)");
tableRow("Хэл", "TypeScript");
tableRow("Загвар", "Tailwind CSS");
tableRow("Төлөв удирдлага", "React hooks (useState, useEffect, useCallback, useMemo)");
tableRow("Бодит цаг", "Socket.IO Client");
tableRow("Зураг", "Next.js Image оптимизаци");

doc.moveDown(0.5);
heading3("Бэкэнд");
tableRow("Runtime", "Node.js");
tableRow("Фреймворк", "Next.js API Routes (Route Handlers)");
tableRow("ORM", "Prisma v5.22");
tableRow("Мэдээллийн сан", "MariaDB (MySQL протокол)");
tableRow("Нэвтрэлт", "JWT (jose) + bcrypt, httpOnly cookies + Bearer token");
tableRow("Валидаци", "Zod schema validation");
tableRow("Бодит цаг", "Socket.IO Server");
tableRow("Cron", "node-cron (фон процесс)");
tableRow("Мэдэгдэл", "Web Push API (web-push v3.6.7)");
tableRow("Төлбөр", "QPay gateway + Balance (апп дотоод түрийвч)");
tableRow("Файл байршуулах", "Upload endpoint");

doc.moveDown(0.5);
heading3("Дэд бүтэц");
tableRow("Байршуулалт", "Node.js server (server.ts + Socket.IO)");
tableRow("Мэдээллийн сан", "MariaDB, localhost:3306");
tableRow("Цагийн бүс", "Asia/Ulaanbaatar (TZ env-р тохируулна)");

// ════════════════════════════════════════════════════════════
// 3. АРХИТЕКТУР
// ════════════════════════════════════════════════════════════

doc.addPage();
heading1("3. Архитектур");

body(
  "Reihen нь Next.js App Router архитектурыг ашигладаг бөгөөд Socket.IO-г Next.js HTTP " +
  "handler-тэй хамт ажиллуулдаг server.ts файлтай. Cron scheduler мөн ижил процесс дотор " +
  "ажилладаг (ENABLE_CRON=true шаардлагатай)."
);

doc.moveDown(0.8);
heading3("Хавтасны бүтэц");
mono(
  "app/                    # Next.js хуудсууд & API\n" +
  "  api/                  # REST API route handlers\n" +
  "    auth/               # Нэвтрэх, бүртгүүлэх, гарах, refresh\n" +
  "    bookings/           # Захиалга CRUD + цуцлах, сунгах\n" +
  "    centers/            # Нийтийн төв, суудал, сэтгэгдэл, тэмцээн\n" +
  "    favorites/          # Дуртай төв нэмэх/хасах\n" +
  "    me/                 # Хэрэглэгчийн статистик\n" +
  "    owner/              # Эзэмшигчийн endpoints\n" +
  "    tournaments/        # Тэмцээн + бүртгэл\n" +
  "    qpay/               # QPay callback\n" +
  "    chat/               # AI чатбот\n" +
  "  centers/[id]/         # Төвийн дэлгэрэнгүй хуудас\n" +
  "  owner/                # Эзэмшигчийн самбар\n" +
  "  profile/              # Тоглогчийн профайл + статистик\n" +
  "  booking/              # Захиалгын хуудас\n" +
  "components/             # Дахин ашиглах UI компонентууд\n" +
  "lib/                    # Хуваалцсан утилитууд\n" +
  "  auth.ts               # JWT, bcrypt, session, role guards\n" +
  "  prisma.ts             # Prisma client singleton\n" +
  "  socket.ts             # Socket.IO server + emit helpers\n" +
  "  cron.ts               # Фон процесс scheduler\n" +
  "  push.ts               # Web Push мэдэгдэл\n" +
  "  payment.ts            # QPay + Balance төлбөр\n" +
  "  subscription.ts       # Багцын хязгаарлалт\n" +
  "  api.ts                # Фронтэнд fetch утилит (CSRF)\n" +
  "  useAuth.ts            # Auth context hook\n" +
  "  useSeatSocket.ts      # Socket.IO суудал hook\n" +
  "  useCountdown.ts       # Тоолуур hook\n" +
  "prisma/\n" +
  "  schema.prisma         # Өгөгдлийн сангийн схем (16 модел)\n" +
  "  seed.ts               # Тестийн өгөгдөл"
);

doc.moveDown(0.8);
heading3("Хүсэлтийн урсгал");
body(
  "1. Клиент apiFetch() ашиглан хүсэлт илгээнэ (CSRF token мутацид)\n" +
  "2. Next.js route handler хүсэлтийг хүлээн авна\n" +
  "3. Нэвтрэлт: getSession() JWT-г cookie/Bearer header-аас задална\n" +
  "4. Валидаци: Zod schema хүсэлтийн body шалгана\n" +
  "5. Бизнес логик: Prisma queries + transactions\n" +
  "6. Бодит цаг: Socket.IO холбогдсон өрөөнд emit хийнэ\n" +
  "7. Мэдэгдэл: Push notification асинхрон илгээнэ\n" +
  "8. Хариу: NextResponse.json() тохирох status code-тэй"
);

// ════════════════════════════════════════════════════════════
// 4. ӨГӨГДЛИЙН САНГИЙН СХЕМ
// ════════════════════════════════════════════════════════════

doc.addPage();
heading1("4. Өгөгдлийн сангийн схем");

body("MariaDB, 16 модел, 7 enum. Бүх ID нь CUID. Цагийн тэмдэг UTC.");

doc.moveDown(0.5);
heading3("Enum-ууд");
mono(
  "Role:             PLAYER | OWNER | ADMIN\n" +
  "SeatStatus:       OPEN | CLOSED | REPAIR | WAITING | OCCUPIED\n" +
  "BookingStatus:    PENDING | CONFIRMED | CANCELLED | NOSHOW\n" +
  "PaymentMethod:    QPAY | BALANCE\n" +
  "PaymentStatus:    PAID | UNPAID\n" +
  "RefundPolicy:     FULL | PARTIAL | NONE\n" +
  "SubPlan:          STARTER | PRO | ENTERPRISE\n" +
  "SubStatus:        ACTIVE | EXPIRED | CANCELLED\n" +
  "TournamentStatus: UPCOMING | REGISTRATION_CLOSED | LIVE |\n" +
  "                  COMPLETED | CANCELLED"
);

doc.moveDown(0.8);
heading3("Үндсэн моделууд");

const models = [
  ["User", "Тоглогч, эзэмшигч, админ. Үлдэгдэл, ирээгүй тоо, нийт тоглосон цаг. Холбоос: захиалга, сэтгэгдэл, дуртай, push, тэмцээн."],
  ["PCCenter", "Тоглоомын төв. Зураг (JSON), GPS координат, үнэлгээ. Давхар, суудлын төрөл, суудал, захиалга, сэтгэгдэл, тэмцээн."],
  ["Floor", "Төв доторх давхар. Давхрын дугаар + нэр. Суудлуудтай холбоотой."],
  ["SeatType", "Үнийн ангилал (жнь: 'Standard', 'VIP'). Цагийн үнэ + оргил цагийн үнэ."],
  ["Seat", "Суудал. Төлөв бодит цагаар хянагдана. posX/posY grid байрлал. freeAt тоолуурт."],
  ["Booking", "Захиалга. Код: #BK + 4 тоо. Төлбөрийн арга, QPay invoice/payment ID, е-баримт."],
  ["BookingSeat", "Олон-олон холбоос: нэг захиалга олон суудалтай."],
  ["CancelPolicy", "Төв тус бүрийн цуцлалтын бодлого: цуцлах хугацаа, ирээгүй хугацаа, буцаан олголт."],
  ["Review", "1-5 үнэлгээ + сэтгэгдэл. Нэг захиалгад нэг. Эзэмшигч хариулж болно."],
  ["Subscription", "Эзэмшигчийн захиалгын багц. maxCenters, maxSeats хязгаарлалт."],
  ["Tournament", "Тэмцээн. Оролцох хураамж, шагнал, багийн хэмжээ, статус машин."],
  ["TournamentTeam", "Тэмцээнд бүртгүүлсэн баг. Ахлагч, төлбөрийн мэдээлэл."],
  ["TournamentMember", "Багийн гишүүн (хэрэглэгч)."],
  ["FavoriteCenter", "Олон-олон: хэрэглэгч олон төвийг дуртайд нэмэх. Push мэдэгдэл."],
  ["PushSubscription", "Web Push бүртгэл. Төхөөрөмж/browser тус бүрд."],
  ["RefreshToken", "JWT refresh token (SHA-256 hash). Олон төхөөрөмж дэмжинэ."],
];

for (const [name, desc] of models) {
  checkPageBreak(40);
  doc.fontSize(10).font("SansBold").fillColor(BLACK).text(name, LM);
  doc.fontSize(9).font("Sans").fillColor(GRAY).text(desc, LM, doc.y, { width: CW, lineGap: 2 });
  doc.moveDown(0.4);
}

// ════════════════════════════════════════════════════════════
// 5. API ЛАВЛАХ
// ════════════════════════════════════════════════════════════

doc.addPage();
heading1("5. API лавлах");
body("Бүх endpoint JSON хариу буцаана. Мутаци CSRF token шаардана. Нэвтрэлт httpOnly cookie эсвэл Bearer token.");

heading2("Нэвтрэлт");
apiRow("POST", "/api/auth/register", "Бүртгүүлэх", "");
apiRow("POST", "/api/auth/login", "Нэвтрэх", "");
apiRow("POST", "/api/auth/logout", "Гарах", "Auth");
apiRow("POST", "/api/auth/refresh", "Token шинэчлэх", "");
apiRow("GET", "/api/auth/me", "Миний мэдээлэл", "Auth");

heading2("Төвүүд (Нийтийн)");
apiRow("GET", "/api/centers", "Төвүүдийн жагсаалт + шүүлт", "");
apiRow("GET", "/api/centers/[id]/seats", "Төвийн дэлгэрэнгүй + суудлууд", "");
apiRow("GET", "/api/centers/[id]/reviews", "Сэтгэгдлүүд", "");
apiRow("GET", "/api/centers/[id]/tournaments", "Тэмцээнүүд", "");

heading2("Захиалга");
apiRow("GET", "/api/bookings", "Идэвхтэй захиалгууд", "Auth");
apiRow("POST", "/api/bookings", "Захиалга үүсгэх", "Auth");
apiRow("PATCH", "/api/bookings/[id]/cancel", "Цуцлах", "Auth");
apiRow("PATCH", "/api/bookings/[id]/extend", "Сунгах", "Auth");
apiRow("GET", "/api/bookings/history", "Түүх (хуудаслалттай)", "Auth");

heading2("Дуртай төвүүд");
apiRow("GET", "/api/favorites", "Дуртай жагсаалт", "Auth");
apiRow("POST", "/api/favorites/[centerId]", "Дуртайд нэмэх", "Auth");
apiRow("DELETE", "/api/favorites/[centerId]", "Дуртайгаас хасах", "Auth");

heading2("Хэрэглэгчийн статистик");
apiRow("GET", "/api/me/stats", "Нэгтгэсэн статистик", "Auth");

heading2("Тэмцээн (Нийтийн)");
apiRow("GET", "/api/tournaments/[id]", "Тэмцээний дэлгэрэнгүй", "");
apiRow("POST", "/api/tournaments/[id]/register", "Баг бүртгүүлэх", "Auth");
apiRow("DELETE", "/api/tournaments/[id]/register", "Бүртгэл цуцлах", "Auth");

heading2("Сэтгэгдэл");
apiRow("POST", "/api/reviews", "Сэтгэгдэл бичих", "Auth");

doc.addPage();
heading2("Эзэмшигчийн endpoints");
apiRow("GET", "/api/owner/dashboard", "Хяналтын самбар", "Owner");
apiRow("GET", "/api/owner/centers", "Миний төвүүд", "Owner");
apiRow("POST", "/api/owner/centers", "Төв үүсгэх", "Owner");
apiRow("GET", "/api/owner/centers/[id]", "Төвийн мэдээлэл", "Owner");
apiRow("PATCH", "/api/owner/centers/[id]", "Төв засах", "Owner");
apiRow("DELETE", "/api/owner/centers/[id]", "Төв устгах", "Owner");
apiRow("POST", "/api/owner/centers/[id]/floors", "Давхар нэмэх", "Owner");
apiRow("PATCH", "/api/owner/centers/[id]/layout", "Layout засах", "Owner");
apiRow("POST", "/api/owner/.../seat-types", "Суудлын төрөл нэмэх", "Owner");
apiRow("GET", "/api/owner/seats", "Суудлын жагсаалт", "Owner");
apiRow("PATCH", "/api/owner/seats/[id]", "Суудал засах", "Owner");
apiRow("PATCH", "/api/owner/seats/[id]/status", "Төлөв солих", "Owner");
apiRow("PATCH", "/api/owner/bookings/[id]/checkin", "Ирсэн гэж тэмдэглэх", "Owner");
apiRow("PATCH", "/api/owner/bookings/[id]/noshow", "Ирээгүй тэмдэглэх", "Owner");
apiRow("PATCH", "/api/owner/policy", "Цуцлалтын бодлого", "Owner");
apiRow("POST", "/api/owner/reviews/[id]/reply", "Хариулт бичих", "Owner");
apiRow("GET", "/api/owner/subscription", "Миний багц", "Owner");
apiRow("POST", "/api/owner/.../upgrade", "Багц дээшлүүлэх", "Owner");

heading2("Эзэмшигчийн тэмцээн");
apiRow("GET", "/api/owner/.../tournaments", "Тэмцээнүүд", "Owner");
apiRow("POST", "/api/owner/.../tournaments", "Тэмцээн үүсгэх", "Owner");
apiRow("GET", "/api/owner/.../{tId}", "Дэлгэрэнгүй", "Owner");
apiRow("PATCH", "/api/owner/.../{tId}", "Засах / статус солих", "Owner");
apiRow("DELETE", "/api/owner/.../{tId}", "Цуцлах + буцаан олголт", "Owner");

heading2("Бусад");
apiRow("POST", "/api/upload", "Файл байршуулах", "Auth");
apiRow("POST", "/api/chat", "AI чатбот", "Auth");
apiRow("POST", "/api/qpay/callback", "QPay webhook", "");
apiRow("PATCH", "/api/admin/users/[id]/role", "Үүрэг солих", "Admin");

// ════════════════════════════════════════════════════════════
// 6. ХУУДСУУД & UI
// ════════════════════════════════════════════════════════════

doc.addPage();
heading1("6. Хуудсууд & UI");
body("Next.js App Router. Бүгд client-side ('use client'). Tailwind CSS, хар-цагаан загвар.");

doc.moveDown(0.5);

const pages = [
  ["/", "Нүүр хуудас. Hero, төвүүдийн жагсаалт шүүлтүүдтэй (дүүрэг, эрэмбэ), анимацтай карт, бодит цагийн суудлын тоо."],
  ["/login", "Нэвтрэх хуудас. Имэйл + нууц үг."],
  ["/register", "Бүртгүүлэх. Үүрэг сонгох (Тоглогч / Эзэмшигч)."],
  ["/booking", "Олон төвөөс захиалга. Төв, суудал, цаг, төлбөрийн арга сонгох."],
  ["/profile", "Тоглогчийн самбар. 6 статистик, 3 таб: Статистик (сарын зарцуулалтын график, топ төвүүд, идэвхтэй захиалга), Түүх (шүүлт + хуудаслалт), Дуртай (карт grid)."],
  ["/centers/[id]", "Төвийн дэлгэрэнгүй. Hero зураг, суудлын grid, захиалгын форм, QPay QR, хүлээх цагийн тоолуур, тэмцээн, сэтгэгдэл. Дуртай товч."],
  ["/centers/.../tournaments/[id]", "Тэмцээний дэлгэрэнгүй. Статистик, шагнал, дүрэм, бүртгэлийн форм, багуудын жагсаалт."],
  ["/owner/dashboard", "Эзэмшигчийн самбар. Өнөөдрийн орлого, захиалга, ачаалал, оргил цагийн график."],
  ["/owner/centers/new", "Шинэ төв үүсгэх форм."],
  ["/owner/centers/[id]", "Төвийн мэдээлэл засах, зураг, тохиргоо."],
  ["/owner/centers/[id]/layout", "Drag-and-drop давхрын зураглал. Суудлыг grid дээр байрлуулах."],
  ["/owner/.../tournaments", "Тэмцээн удирдах. Үүсгэх, статус солих, бүртгэгдсэн багууд, цуцлах."],
  ["/owner/subscription", "Захиалгын багц удирдах. Дээшлүүлэх."],
];

for (const [route, desc] of pages) {
  checkPageBreak(45);
  doc.fontSize(10).font("MonoBold").fillColor(BLACK).text(route, LM);
  doc.fontSize(9).font("Sans").fillColor(GRAY).text(desc, LM, doc.y, { width: CW, lineGap: 2 });
  doc.moveDown(0.5);
}

// ════════════════════════════════════════════════════════════
// 7. БОДИТ ЦАГИЙН БОЛОМЖУУД
// ════════════════════════════════════════════════════════════

doc.addPage();
heading1("7. Бодит цагийн боломжууд");

heading3("Socket.IO архитектур");
body(
  "server.ts нь Socket.IO-г Next.js HTTP handler-тэй хамт ажиллуулна. " +
  "Клиентүүд 'branch:{centerId}' өрөөнд холбогдож тухайн төвийн шинэчлэлтийг хүлээн авна."
);

doc.moveDown(0.5);
heading3("Эвентүүд");
bullet("seat:update — Суудлын төлөв өөрчлөгдөхөд. seatId, status, code агуулна.");
bullet("tournament:update — Тэмцээний статус өөрчлөгдөхөд. tournamentId, status, teamCount.");

doc.moveDown(0.5);
heading3("Фронтэнд hook-ууд");
bullet("useSeatSocket(centerId, onUpdate) — Branch өрөөнд холбогдож seat:update сонсоно.");
bullet("useCountdown(freeAt) — Суудал чөлөөлөгдөх хүртэл минут тоолно. 30 секунд тутам шинэчилнэ.");

doc.moveDown(0.5);
heading3("Хүлээх цагийн тоолуур");
body(
  "Эзэлсэн суудлууд freeAt талбар дээр суурилсан тоолуур харуулна ('12м'). " +
  "5 минутаас бага үлдсэн үед тоолуур анивчина. Статистикийн мөрөнд дараагийн чөлөөтэй суудлын цаг харагдана."
);

// ════════════════════════════════════════════════════════════
// 8. ФОН ПРОЦЕССУУД
// ════════════════════════════════════════════════════════════

heading1("8. Фон процессууд");
body("node-cron ашигладаг. ENABLE_CRON=true шаардлагатай. Asia/Ulaanbaatar цагийн бүсэд ажиллана.");

doc.moveDown(0.5);

const jobs = [
  ["5 мин тутам", "Ирээгүй шалгалт", "CONFIRMED захиалга startTime + noShowMinutes-аас хоцорсон бол суудлуудыг суллаж, NOSHOW болгоно. noShowCount нэмнэ."],
  ["1 мин тутам", "1 цагийн сануулга", "55-65 минутын дараа эхлэх захиалгуудад push: '1 цагийн дараа тоглолт'."],
  ["1 мин тутам", "15 минутын анхааруулга", "12-18 минутын дараа эхлэх захиалгуудад push: '15 минутын дараа!'."],
  ["1 мин тутам", "Тоглолт дуусгах", "Дууссан захиалгын суудлуудыг суллана. totalPlayHours нэмнэ. Үнэлгээ өгөх хүсэлт илгээнэ. Дуртай төвийн хэрэглэгчдэд суудал чөлөөлөгдсөн мэдэгдэл."],
  ["1 мин тутам", "Тэмцээний шилжилт", "UPCOMING -> LIVE (startTime өнгөрсөн). LIVE -> COMPLETED (endTime өнгөрсөн). Бүх гишүүдэд push мэдэгдэл."],
];

for (const [schedule, name, desc] of jobs) {
  checkPageBreak(50);
  doc.fontSize(10).font("SansBold").fillColor(BLACK).text(`${name}  `, LM, doc.y, { continued: true });
  doc.font("Sans").fillColor(LIGHT).text(`(${schedule})`);
  doc.fontSize(9).font("Sans").fillColor(GRAY).text(desc, LM, doc.y, { width: CW, lineGap: 2 });
  doc.moveDown(0.5);
}

doc.moveDown(0.3);
heading3("Давхардал шалгалт");
body("TTLSet in-memory map давхар мэдэгдлээс хамгаална. Сануулга 2 цаг, дуртай мэдэгдэл 30 мин TTL. Cleanup 5 мин тутам.");

// ════════════════════════════════════════════════════════════
// 9. ТӨЛБӨРИЙН ИНТЕГРАЦ
// ════════════════════════════════════════════════════════════

doc.addPage();
heading1("9. Төлбөрийн интеграц");

heading3("Төлбөрийн аргууд");
bullet("QPay — Монголын хамгийн алдартай төлбөрийн гарц. QR код + банкны deeplink. Webhook: /api/qpay/callback.");
bullet("Balance — Апп дотоод түрийвч. user.balance-аас шууд хасна. Шууд баталгаажна.");

doc.moveDown(0.5);
heading3("Төлбөрийн урсгал");
body(
  "1. Хэрэглэгч суудал, цаг, төлбөрийн арга сонгоно\n" +
  "2. POST /api/bookings -> processPayment(userId, amount, method, ref)\n" +
  "3. QPay: Invoice үүсгэж, QR зураг + deeplink буцаана. PENDING төлөв\n" +
  "4. QPay: Клиент poll хийнэ. Callback -> PAID, CONFIRMED болно\n" +
  "5. Balance: user.balance-аас шууд хасна. CONFIRMED болно\n\n" +
  "Буцаан олголт: processRefund() цуцлалт дээр төлбөр буцаана. " +
  "Balance-д буцааж нэмнэ. QPay нь qpayPaymentId ашиглана."
);

doc.moveDown(0.5);
heading3("Тэмцээний төлбөр");
body(
  "Оролцох хураамж ижил processPayment/processRefund системээр ажиллана. " +
  "Тэмцээн цуцлагдахад paymentStatus=PAID бүх багуудад автомат буцаан олголт хийнэ."
);

// ════════════════════════════════════════════════════════════
// 10. АЮУЛГҮЙ БАЙДАЛ
// ════════════════════════════════════════════════════════════

heading1("10. Аюулгүй байдал");

bullet("JWT access token (15 мин) + refresh token (7 хоног, hash-лэгдсэн)");
bullet("bcrypt нууц үг hash (12 давсны тойрог)");
bullet("5 удаа буруу оролдлого -> 15 мин түгжээ");
bullet("httpOnly cookies (веб) + Bearer token (гар утас/API)");
bullet("CSRF token бүх мутаци хүсэлтэд (POST, PATCH, DELETE)");
bullet("Үүргэд суурилсан хандалт: getSession(), requireOwner(), assertCenterOwner()");
bullet("Zod оролтын валидаци бүх API endpoint-д");
bullet("Prisma параметржүүлсэн query (SQL injection хамгаалалт)");
bullet("Refresh token SHA-256 hash-ээр хадгална (хэзээ ч plaintext биш)");
bullet("Cascade delete бүрэн бүтэн байдлыг хамгаална");

// ════════════════════════════════════════════════════════════
// 11. ОНЦЛОХ БОЛОМЖУУД
// ════════════════════════════════════════════════════════════

doc.addPage();
heading1("11. Онцлох боломжууд");

heading2("Дуртай төвүүд");
body(
  "Хэрэглэгч тоглоомын төвүүдийг зүрхэн товчоор хадгална. Дуртай төвүүд нүүр хуудсанд " +
  "зүрхэн тэмдэгтэй, профайлын Дуртай табд харагдана.\n\n" +
  "Push мэдэгдэл илгээгдэх үед:\n" +
  "  - Дуртай төвд суудал чөлөөлөгдөхөд (30 мин-д 1 удаа)\n" +
  "  - Дуртай төвд шинэ тэмцээн үүссэн үед"
);

doc.moveDown(0.5);
heading2("Тоглогчийн статистик самбар");
body(
  "Профайл хуудас дэлгэрэнгүй аналитик харуулна:\n" +
  "  - 6 гол үзүүлэлт: нийт цаг, зарцуулалт, захиалга, ирээгүй, дуртай, үлдэгдэл\n" +
  "  - Сарын зарцуулалтын график (сүүлийн 6 сар, CSS)\n" +
  "  - Топ 3 хамгийн их очсон төвүүд\n" +
  "  - Хуудаслалттай захиалгын түүх, статусаар шүүлт"
);

doc.moveDown(0.5);
heading2("Тэмцээний систем");
body(
  "Эзэмшигчид тэмцээн зохион байгуулна:\n" +
  "  - Тоглоом, багийн хэмжээ (solo-10v10), хураамж, шагналын сан\n" +
  "  - Статус: UPCOMING -> REGISTRATION_CLOSED -> LIVE -> COMPLETED\n" +
  "  - Автомат шилжилт cron-р (startTime, endTime)\n" +
  "  - QPay / Balance-р оролцох хураамж\n" +
  "  - Цуцлалт дээр автомат буцаан олголт\n" +
  "  - Статус өөрчлөгдөхөд оролцогчдод push мэдэгдэл"
);

doc.moveDown(0.5);
heading2("Бодит цагийн суудал удирдлага");
body(
  "Socket.IO бүх холбогдсон клиентүүдэд суудлын шинэчлэлтийг шууд илгээнэ. " +
  "Давхрын зураглал засварлагч суудлыг grid дээр байрлуулах боломж олгоно. " +
  "Эзэлсэн суудлууд тоолуур харуулна."
);

doc.moveDown(0.5);
heading2("Захиалгын багцууд");
mono(
  "Багц          Төвүүд  Суудал  Тэмцээн  Үнэ\n" +
  "STARTER       1       30      0        Үнэгүй\n" +
  "PRO           5       100     5        Төлбөртэй\n" +
  "ENTERPRISE    999     999     999      Тусгай"
);

// ════════════════════════════════════════════════════════════
// АРЫН НҮҮР
// ════════════════════════════════════════════════════════════

doc.addPage();
doc.rect(0, 0, 595.28, 841.89).fill(BLACK);

doc.fontSize(48).font("SansBold").fillColor("#FFFFFF").text("REIHEN", LM, 350, { align: "center", width: CW });
doc.fontSize(12).font("Sans").fillColor("#666666").text("BOOK. PLAY. WIN.", LM, doc.y + 12, { align: "center", width: CW, characterSpacing: 4 });
doc.fontSize(9).fillColor("#444444").text("Улаанбаатарт бүтээв", LM, doc.y + 50, { align: "center", width: CW });
doc.fontSize(9).fillColor("#444444").text(`${new Date().getFullYear()} Reihen`, LM, doc.y + 8, { align: "center", width: CW });

// ─── Дуусгах ───
doc.end();

stream.on("finish", () => {
  console.log(`PDF үүсгэгдлээ: ${OUTPUT}`);
  console.log(`Хэмжээ: ${(fs.statSync(OUTPUT).size / 1024).toFixed(0)} KB`);
});
