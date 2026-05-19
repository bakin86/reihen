import { Prisma, PrismaClient, SeatStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const hash = (pw: string) => bcrypt.hashSync(pw, 12);

// ── helpers ────────────────────────────────────────────────────────────────

function daysAgo(n: number, h = 14) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(h, 0, 0, 0);
  return d;
}
function hoursFromNow(h: number) {
  return new Date(Date.now() + h * 3_600_000);
}
function daysFromNow(d: number, h = 14) {
  const t = new Date();
  t.setDate(t.getDate() + d);
  t.setHours(h, 0, 0, 0);
  return t;
}

/** Place seats on a grid; first-floor seats are busier */
function makeSeats(
  count: number,
  prefix: string,
  centerId: string,
  floorId: string,
  typeId: string,
  cols = 5,
  occupiedRatio = 0.35,
  waitingRatio = 0.1
): Prisma.SeatCreateManyInput[] {
  return Array.from({ length: count }, (_, i) => {
    const occ  = Math.floor(count * occupiedRatio);
    const wait = Math.floor(count * (occupiedRatio + waitingRatio));
    const status: SeatStatus = i < occ ? "OCCUPIED" : i < wait ? "WAITING" : "OPEN";
    return {
      centerId, floorId, typeId,
      number: `${prefix}${i + 1}`,
      posX: i % cols,
      posY: Math.floor(i / cols),
      status,
      freeAt: status === "OCCUPIED" ? hoursFromNow((i % 3) + 1) : null,
    };
  });
}

// ── main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log("🌱  Seeding Reihen — diploma demo data...\n");

  // ── 1. Users ──────────────────────────────────────────────────────────────

  const admin = await prisma.user.upsert({
    where: { email: "admin@reihen.mn" },
    update: {},
    create: {
      name: "Систем Админ", email: "admin@reihen.mn", phone: "80000000",
      password: hash("admin123"), role: "ADMIN", balance: 0,
    },
  });

  // Owners
  const owner1 = await prisma.user.upsert({
    where: { email: "gankky@gmail.com" },
    update: {},
    create: {
      name: "Gankky", email: "gankky@gmail.com", phone: "95230978",
      password: hash("owner123"), role: "OWNER", balance: 3_200_000,
    },
  });
  const owner2 = await prisma.user.upsert({
    where: { email: "sarnai@reihen.mn" },
    update: {},
    create: {
      name: "Сарнай Б.", email: "sarnai@reihen.mn", phone: "99445566",
      password: hash("owner123"), role: "OWNER", balance: 1_800_000,
    },
  });

  // Demo player — rich history for charts
  const demo = await prisma.user.upsert({
    where: { email: "demo@reihen.mn" },
    update: {},
    create: {
      name: "Батбаяр Г.", email: "demo@reihen.mn", phone: "99001122",
      password: hash("demo123"), role: "PLAYER", balance: 145_000,
    },
  });

  // Supporting players
  const playerDefs = [
    { name: "Мөнхбат Э.",      email: "munkhbat@gmail.com",     phone: "95100001", balance: 55_000  },
    { name: "Отгонбаяр Ч.",    email: "otgonbayar@gmail.com",   phone: "95100002", balance: 130_000 },
    { name: "Энхжин С.",       email: "enkhjin@gmail.com",      phone: "95100003", balance: 85_000  },
    { name: "Тэмүүлэн Б.",     email: "temuulen@gmail.com",     phone: "95100004", balance: 40_000  },
    { name: "Номин-Эрдэнэ О.", email: "nomin@gmail.com",        phone: "95100005", balance: 72_000  },
    { name: "Баярсайхан Г.",   email: "bayarsaikhan@gmail.com", phone: "95100006", balance: 98_000  },
    { name: "Дөлгөөн Э.",      email: "dolgoon@gmail.com",      phone: "95100007", balance: 28_000  },
    { name: "Анхбаяр М.",      email: "ankhbayar@gmail.com",    phone: "95100008", balance: 110_000 },
    { name: "Уянга Ч.",        email: "uyanga@gmail.com",       phone: "95100009", balance: 18_000  },
    { name: "Зандан Б.",       email: "zandan@gmail.com",       phone: "95100010", balance: 62_000  },
  ];
  const players = await Promise.all(
    playerDefs.map((p) =>
      prisma.user.upsert({
        where: { email: p.email }, update: {},
        create: { ...p, password: hash("player123"), role: "PLAYER" },
      })
    )
  );

  // Staff
  const staff1 = await prisma.user.upsert({
    where: { email: "tulgaa@reihen.mn" },
    update: {},
    create: {
      name: "Тулгаа Б.", email: "tulgaa@reihen.mn", phone: "95900001",
      password: hash("staff123"), role: "STAFF",
    },
  });
  const staff2 = await prisma.user.upsert({
    where: { email: "oyuka@reihen.mn" },
    update: {},
    create: {
      name: "Оюука Д.", email: "oyuka@reihen.mn", phone: "95900002",
      password: hash("staff123"), role: "STAFF",
    },
  });
  console.log(`  Users: 1 admin · 2 owners · 1 demo · ${playerDefs.length} players · 2 staff`);

  // ── 2. Subscriptions ──────────────────────────────────────────────────────

  const now = new Date();
  const exp2m = new Date(now); exp2m.setMonth(exp2m.getMonth() + 2);
  const exp1m = new Date(now); exp1m.setMonth(exp1m.getMonth() + 1);

  await Promise.all([
    prisma.subscription.upsert({
      where: { userId: owner1.id }, update: {},
      create: {
        userId: owner1.id, plan: "ENTERPRISE", status: "ACTIVE",
        maxCenters: 10, maxSeats: 500, monthlyPrice: 599_000,
        paymentMethod: "QPAY", reference: "ENT-2026-001",
        startsAt: now, expiresAt: exp2m,
      },
    }),
    prisma.subscription.upsert({
      where: { userId: owner2.id }, update: {},
      create: {
        userId: owner2.id, plan: "PRO", status: "ACTIVE",
        maxCenters: 5, maxSeats: 200, monthlyPrice: 249_000,
        paymentMethod: "QPAY", reference: "PRO-2026-002",
        startsAt: now, expiresAt: exp1m,
      },
    }),
  ]);

  // ── 3. PC Centers ─────────────────────────────────────────────────────────

  type CenterDef = {
    name: string; address: string; district: string; desc: string;
    rating: number; lat: number; lng: number; owner: typeof owner1;
    verified: boolean; imgIdx: number;
    floors: string[];
    types: { name: string; price: number; peak: number; desc: string }[];
    cancelMins: number; noShowMins: number;
    refund: "FULL" | "PARTIAL" | "NONE"; maxSeats: number;
  };

  // Curated Unsplash images — gaming / tech setups
  const imgs = [
    ["https://images.unsplash.com/photo-1542751371-adc38448a05e?w=900","https://images.unsplash.com/photo-1587202372634-32705e3bf49c?w=900"],
    ["https://images.unsplash.com/photo-1593305841991-05c297ba4575?w=900","https://images.unsplash.com/photo-1511512578047-dfb367046420?w=900"],
    ["https://images.unsplash.com/photo-1612287230202-1ff1d85d1bdf?w=900","https://images.unsplash.com/photo-1616588589676-62b3bd4ff6d2?w=900"],
    ["https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=900","https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=900"],
    ["https://images.unsplash.com/photo-1598550476439-6847785fcea6?w=900","https://images.unsplash.com/photo-1542751371-adc38448a05e?w=900"],
    ["https://images.unsplash.com/photo-1580327344181-c1163234e5a0?w=900","https://images.unsplash.com/photo-1593305841991-05c297ba4575?w=900"],
    ["https://images.unsplash.com/photo-1560419015-7c427e8ae5ba?w=900","https://images.unsplash.com/photo-1612287230202-1ff1d85d1bdf?w=900"],
    ["https://images.unsplash.com/photo-1547394765-185e1e68f34e?w=900","https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=900"],
    ["https://images.unsplash.com/photo-1504639725590-34d0984388bd?w=900","https://images.unsplash.com/photo-1587202372634-32705e3bf49c?w=900"],
    ["https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=900","https://images.unsplash.com/photo-1598550476439-6847785fcea6?w=900"],
    ["https://images.unsplash.com/photo-1536148935331-408321065b18?w=900","https://images.unsplash.com/photo-1616588589676-62b3bd4ff6d2?w=900"],
    ["https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=900","https://images.unsplash.com/photo-1560419015-7c427e8ae5ba?w=900"],
  ];

  const centerDefs: CenterDef[] = [
    // ── owner1: 7 centers ───────────────────────────────────────────────────
    {
      name: "Reihen Pro Center",
      address: "Бага тойруу 14, Peace Avenue оргил",
      district: "Сүхбаатар",
      desc: "Reihen сүлжээний нэрэмжит flagship center. RTX 4090, 240Hz, Herman Miller. 24/7 нээлттэй.",
      rating: 4.9, lat: 47.9184, lng: 106.9177,
      owner: owner1, verified: true, imgIdx: 0,
      floors: ["1-р давхар · Standard", "2-р давхар · VIP"],
      types: [
        { name: "Standard",   price: 3_500, peak: 4_500, desc: "RTX 4070, 144Hz, HyperX headset, DXRacer" },
        { name: "VIP",        price: 6_000, peak: 8_000, desc: "RTX 4080, 240Hz, Herman Miller, private booth" },
        { name: "Streaming",  price: 9_000, peak:12_000, desc: "RTX 4090, dual 4K, capture card, soundproof cabin" },
      ],
      cancelMins: 30, noShowMins: 60, refund: "FULL", maxSeats: 10,
    },
    {
      name: "Nexus Gaming Hub",
      address: "Чингисийн өргөн чөлөө 5, Suite 210",
      district: "Сүхбаатар",
      desc: "Esports-д зориулсан. 1Gbps оптик интернэт, tournament-grade gear, 24/7.",
      rating: 4.7, lat: 47.9200, lng: 106.9155,
      owner: owner1, verified: true, imgIdx: 1,
      floors: ["Main Hall", "Tournament Stage"],
      types: [
        { name: "Standard",   price: 3_500, peak: 4_500, desc: "RTX 4070, 165Hz, Cherry MX keyboard" },
        { name: "Tournament", price: 7_000, peak: 9_000, desc: "RTX 4080 Ti, 240Hz, stage lighting, stream-ready" },
      ],
      cancelMins: 15, noShowMins: 45, refund: "PARTIAL", maxSeats: 10,
    },
    {
      name: "Arena X",
      address: "Дамбадаржаагийн гудамж 22, 3-р давхар",
      district: "Баянзүрх",
      desc: "Баянзүрхийн тэргүүлэх gaming center. 18 суудал, хоёр давхар, тав тухтай орчин.",
      rating: 4.5, lat: 47.9105, lng: 106.9455,
      owner: owner1, verified: true, imgIdx: 2,
      floors: ["Ground Floor", "Upper Floor"],
      types: [
        { name: "Standard", price: 3_000, peak: 4_000, desc: "RTX 4060 Ti, 144Hz, HyperX Cloud" },
        { name: "Pro",      price: 5_500, peak: 7_000, desc: "RTX 4080, 240Hz, Steelseries Prime setup" },
      ],
      cancelMins: 30, noShowMins: 60, refund: "FULL", maxSeats: 10,
    },
    {
      name: "Cyber Base",
      address: "Баянгол дүүрэг, 6-р хороо, Хан-Уул гудамж 8",
      district: "Баянгол",
      desc: "Баянголын хамгийн том gaming center. 14 суудал, кофе бар, шуурхай WiFi.",
      rating: 4.3, lat: 47.9095, lng: 106.8750,
      owner: owner1, verified: true, imgIdx: 3,
      floors: ["1F · Standard", "2F · Elite"],
      types: [
        { name: "Standard", price: 2_800, peak: 3_500, desc: "RTX 3070, 144Hz, mechanical keyboard" },
        { name: "Elite",    price: 5_000, peak: 6_500, desc: "RTX 4070, 165Hz, ultrawide monitor" },
      ],
      cancelMins: 20, noShowMins: 45, refund: "PARTIAL", maxSeats: 10,
    },
    {
      name: "Zero Latency",
      address: "Энхтайвны өргөн чөлөө 45Б, 2-р давхар",
      district: "Хан-Уул",
      desc: "360Hz дэлгэц, 0.1ms response. Pro players-д зориулсан хурдны тэмцээний center.",
      rating: 4.8, lat: 47.9025, lng: 106.9210,
      owner: owner1, verified: true, imgIdx: 4,
      floors: ["Pro Floor", "Amateur Floor"],
      types: [
        { name: "Amateur", price: 3_500, peak: 4_500, desc: "RTX 4070, 240Hz, low-latency setup" },
        { name: "Pro",     price: 8_000, peak:10_000, desc: "RTX 4090, 360Hz, 0.1ms, Finalmouse, Artisan pad" },
      ],
      cancelMins: 15, noShowMins: 30, refund: "PARTIAL", maxSeats: 10,
    },
    {
      name: "Storm Center",
      address: "Чингэлтэй дүүрэг, 12-р хороо, 3-р байр",
      district: "Чингэлтэй",
      desc: "Soundproof cabin-уудтай. Streamer болон content creator-т хамгийн тохиромжтой.",
      rating: 4.4, lat: 47.9250, lng: 106.9090,
      owner: owner1, verified: true, imgIdx: 5,
      floors: ["Stream Floor"],
      types: [
        { name: "Standard", price: 3_000, peak: 4_000, desc: "RTX 4060, 144Hz, ring light included" },
        { name: "Streamer", price: 7_000, peak: 9_000, desc: "RTX 4090, capture card, green screen, 4K webcam" },
      ],
      cancelMins: 30, noShowMins: 60, refund: "FULL", maxSeats: 10,
    },
    {
      name: "Pixel District",
      address: "Баянзүрх дүүрэг, 18-р хороо, Нарны зам 3",
      district: "Баянзүрх",
      desc: "RGB дизайн, нарийн тохируулсан тоног. Баялаг атмосфер, найзуудтайгаа ирэхэд тохиромжтой.",
      rating: 4.2, lat: 47.9060, lng: 106.9520,
      owner: owner1, verified: false, imgIdx: 6,
      floors: ["Main Floor"],
      types: [
        { name: "Standard", price: 2_500, peak: 3_200, desc: "RTX 3070, 144Hz, RGB full setup" },
        { name: "Premium",  price: 4_500, peak: 5_800, desc: "RTX 4070, 165Hz, 32\" curved" },
      ],
      cancelMins: 30, noShowMins: 60, refund: "FULL", maxSeats: 10,
    },

    // ── owner2: 4 centers ───────────────────────────────────────────────────
    {
      name: "Level Up Gaming",
      address: "Хан-Уул дүүрэг, Зайсан, Олон улсын гудамж 12",
      district: "Хан-Уул",
      desc: "Зайсангийн хэт орчинд. Cinema-dark room, surround sound, premium chair.",
      rating: 4.6, lat: 47.8875, lng: 106.9305,
      owner: owner2, verified: true, imgIdx: 7,
      floors: ["Cinema Hall", "VIP Room"],
      types: [
        { name: "Cinema",  price: 4_500, peak: 6_000, desc: "RTX 4070 Ti, 165Hz, 7.1 surround sound" },
        { name: "VIP Box", price: 9_000, peak:12_000, desc: "Private 4-seat room, RTX 4080 ×4, mini bar" },
      ],
      cancelMins: 30, noShowMins: 60, refund: "PARTIAL", maxSeats: 10,
    },
    {
      name: "Alpha Station",
      address: "Сонгинохайрхан дүүрэг, 14-р хороо, Ард Аймгийн гудамж 7",
      district: "Сонгинохайрхан",
      desc: "Баруун дүүргийн тэргүүлэх gaming center. Хямд, хурдан, найрсаг орчин.",
      rating: 4.1, lat: 47.9225, lng: 106.8360,
      owner: owner2, verified: false, imgIdx: 8,
      floors: ["Main Floor"],
      types: [
        { name: "Standard", price: 2_500, peak: 3_000, desc: "RTX 3060, 144Hz, comfortable chair" },
        { name: "Premium",  price: 3_800, peak: 4_800, desc: "RTX 4060, 165Hz, wide screen" },
      ],
      cancelMins: 30, noShowMins: 60, refund: "FULL", maxSeats: 10,
    },
    {
      name: "Voltage Gaming",
      address: "Сүхбаатар дүүрэг, 4-р хороо, Олимпийн гудамж 6",
      district: "Сүхбаатар",
      desc: "Хотын төвд, оюутнуудад 15% хөнгөлөлт. 24 цаг нээлттэй, шөнийн тариф байдаг.",
      rating: 4.0, lat: 47.9195, lng: 106.9135,
      owner: owner2, verified: false, imgIdx: 9,
      floors: ["Ground Floor"],
      types: [
        { name: "Standard", price: 2_800, peak: 3_500, desc: "RTX 3070, 144Hz, student-friendly" },
      ],
      cancelMins: 60, noShowMins: 90, refund: "FULL", maxSeats: 10,
    },
    {
      name: "Pro Station",
      address: "Чингэлтэй дүүрэг, 8-р хороо, Их Сургуулийн гудамж 14",
      district: "Чингэлтэй",
      desc: "Их сургуулийн ойролцоо. Оюутан, залуучуудад зориулсан хямд, тав тухтай gaming cafe.",
      rating: 3.9, lat: 47.9275, lng: 106.9055,
      owner: owner2, verified: false, imgIdx: 10,
      floors: ["1F · Main", "2F · Premium"],
      types: [
        { name: "Standard", price: 2_500, peak: 3_000, desc: "RTX 3060 Ti, 144Hz" },
        { name: "Premium",  price: 4_000, peak: 5_000, desc: "RTX 4060 Ti, 165Hz, bigger desk" },
      ],
      cancelMins: 45, noShowMins: 75, refund: "FULL", maxSeats: 10,
    },
  ];

  console.log(`Creating ${centerDefs.length} centers...`);
  type CenterWithLayout = Prisma.PCCenterGetPayload<{ include: { floors: true; seatTypes: true } }>;
  const centers: CenterWithLayout[] = [];

  for (let ci = 0; ci < centerDefs.length; ci++) {
    const d = centerDefs[ci];
    const c = await prisma.pCCenter.create({
      data: {
        name: d.name, address: d.address, district: d.district,
        description: d.desc, images: imgs[ci % imgs.length],
        rating: d.rating, lat: d.lat, lng: d.lng,
        ownerId: d.owner.id, isVerified: d.verified,
        floors:    { create: d.floors.map((name, i) => ({ floorNumber: i + 1, name })) },
        seatTypes: { create: d.types.map((t) => ({ name: t.name, pricePerHour: t.price, peakHourPrice: t.peak, description: t.desc })) },
        cancelPolicy: { create: { cancelMinutes: d.cancelMins, noShowMinutes: d.noShowMins, refundPolicy: d.refund, maxSeatsPerBooking: d.maxSeats } },
      },
      include: { floors: true, seatTypes: true },
    });
    centers.push(c);
  }
  console.log(`  ${centers.length} centers created`);

  // ── 4. Seats ──────────────────────────────────────────────────────────────

  // Seat counts per floor (first floor bigger, upper floors smaller)
  const countByFloorIdx = [14, 10, 8, 6];
  let totalSeats = 0;

  for (const c of centers) {
    const rows: Prisma.SeatCreateManyInput[] = [];
    for (let fi = 0; fi < c.floors.length; fi++) {
      const floor  = c.floors[fi];
      const count  = countByFloorIdx[Math.min(fi, countByFloorIdx.length - 1)];
      const typeId = c.seatTypes[fi % c.seatTypes.length].id;
      const prefix = String.fromCharCode(65 + fi); // A, B, C...
      const occ    = fi === 0 ? 0.40 : 0.20;
      rows.push(...makeSeats(count, prefix, c.id, floor.id, typeId, 5, occ, 0.10));
    }
    const r = await prisma.seat.createMany({ data: rows });
    totalSeats += r.count;
  }
  console.log(`  ${totalSeats} seats created`);

  // ── 5. Staff assignments ──────────────────────────────────────────────────

  const reihenPro = centers[0];
  const nexus     = centers[1];
  const levelUp   = centers[7];

  await prisma.centerStaff.createMany({
    data: [
      { userId: staff1.id, centerId: reihenPro.id, canCheckin: true,  canSeatStatus: true,  canViewBookings: true  },
      { userId: staff1.id, centerId: nexus.id,     canCheckin: true,  canSeatStatus: false, canViewBookings: true  },
      { userId: staff2.id, centerId: levelUp.id,   canCheckin: true,  canSeatStatus: true,  canViewBookings: true  },
    ],
  });
  console.log("  Staff assigned to 3 centers");

  // ── 6. Bookings ───────────────────────────────────────────────────────────
  // A) Demo player — 6 months of history for the monthly chart

  // Helper: get the first open seat of a center
  const seatMap = new Map<string, string[]>(); // centerId → [seatId, ...]
  for (const c of centers) {
    const s = await prisma.seat.findMany({
      where: { centerId: c.id, status: { in: ["OPEN", "WAITING"] } },
      select: { id: true, typeId: true },
      take: 10,
    });
    seatMap.set(c.id, s.map((x) => x.id));
  }

  // Seat type price lookup
  const typePrice = new Map<string, number>();
  for (const c of centers) {
    for (const t of c.seatTypes) typePrice.set(t.id, t.pricePerHour);
  }

  async function createBooking(opts: {
    code: string; userId: string; centerId: string; seatId: string;
    startTime: Date; hours: number; status: "CONFIRMED" | "CANCELLED" | "NOSHOW";
    method?: "QPAY" | "BALANCE";
  }) {
    const endTime = new Date(opts.startTime.getTime() + opts.hours * 3_600_000);
    const seat = await prisma.seat.findUnique({ where: { id: opts.seatId }, select: { typeId: true } });
    const price = (typePrice.get(seat!.typeId) ?? 3_000) * opts.hours;
    return prisma.booking.create({
      data: {
        code: opts.code,
        userId: opts.userId,
        centerId: opts.centerId,
        startTime: opts.startTime,
        endTime,
        hours: opts.hours,
        totalPrice: price,
        status: opts.status,
        paymentMethod: opts.method ?? "QPAY",
        paymentStatus: "PAID",
        cancelledAt:  opts.status === "CANCELLED" ? new Date(opts.startTime.getTime() - 3_600_000) : null,
        cancelReason: opts.status === "CANCELLED" ? "Тоглогч цуцалсан" : null,
        bookingSeats: { create: [{ seatId: opts.seatId }] },
      },
    });
  }

  const getSeat = (centerId: string, idx = 0) => seatMap.get(centerId)?.[idx % (seatMap.get(centerId)?.length ?? 1)] ?? "";

  let bookingSeq = 0;
  const CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const code = () => {
    bookingSeq++;
    // Use timestamp + sequence for guaranteed uniqueness in seed
    const ts = Date.now().toString(36).toUpperCase().slice(-4);
    const seq = String(bookingSeq).padStart(3, "0");
    return `#BK-${ts}${seq}`;
  };

  // Demo player monthly bookings — spread across 6 months for chart
  type BookingSpec = { dAgo: number; h: number; ci: number; status: "CONFIRMED" | "CANCELLED" | "NOSHOW"; method?: "QPAY" | "BALANCE" };

  const demoBookings: BookingSpec[] = [
    // 5 months ago
    { dAgo: 152, h: 3, ci: 0, status: "CONFIRMED", method: "QPAY"    },
    { dAgo: 148, h: 2, ci: 1, status: "CONFIRMED", method: "BALANCE" },
    { dAgo: 145, h: 4, ci: 2, status: "CONFIRMED", method: "QPAY"    },
    // 4 months ago
    { dAgo: 122, h: 2, ci: 0, status: "CONFIRMED", method: "BALANCE" },
    { dAgo: 118, h: 3, ci: 4, status: "CONFIRMED", method: "QPAY"    },
    { dAgo: 115, h: 2, ci: 1, status: "CANCELLED"                    },
    { dAgo: 110, h: 4, ci: 0, status: "CONFIRMED", method: "QPAY"    },
    // 3 months ago
    { dAgo:  90, h: 3, ci: 2, status: "CONFIRMED", method: "BALANCE" },
    { dAgo:  85, h: 2, ci: 0, status: "CONFIRMED", method: "QPAY"    },
    { dAgo:  82, h: 5, ci: 1, status: "CONFIRMED", method: "QPAY"    },
    { dAgo:  78, h: 2, ci: 3, status: "NOSHOW"                       },
    // 2 months ago
    { dAgo:  60, h: 4, ci: 0, status: "CONFIRMED", method: "BALANCE" },
    { dAgo:  55, h: 3, ci: 4, status: "CONFIRMED", method: "QPAY"    },
    { dAgo:  52, h: 2, ci: 2, status: "CONFIRMED", method: "QPAY"    },
    { dAgo:  48, h: 3, ci: 1, status: "CONFIRMED", method: "BALANCE" },
    // 1 month ago
    { dAgo:  30, h: 2, ci: 0, status: "CONFIRMED", method: "QPAY"    },
    { dAgo:  28, h: 4, ci: 4, status: "CONFIRMED", method: "QPAY"    },
    { dAgo:  25, h: 3, ci: 2, status: "CONFIRMED", method: "BALANCE" },
    { dAgo:  22, h: 2, ci: 1, status: "CANCELLED"                    },
    { dAgo:  18, h: 5, ci: 0, status: "CONFIRMED", method: "QPAY"    },
    // This month
    { dAgo:  12, h: 3, ci: 4, status: "CONFIRMED", method: "BALANCE" },
    { dAgo:   9, h: 2, ci: 0, status: "CONFIRMED", method: "QPAY"    },
    { dAgo:   6, h: 4, ci: 1, status: "CONFIRMED", method: "QPAY"    },
    { dAgo:   3, h: 2, ci: 2, status: "CONFIRMED", method: "BALANCE" },
  ];

  const demoBookingRecords = [];
  for (const b of demoBookings) {
    const c = centers[b.ci];
    const sid = getSeat(c.id, 0);
    if (!sid) continue;
    const rec = await createBooking({
      code: code(), userId: demo.id, centerId: c.id, seatId: sid,
      startTime: daysAgo(b.dAgo, 15), hours: b.h, status: b.status, method: b.method,
    });
    demoBookingRecords.push(rec);
  }

  // B) Active bookings for demo player (shown in profile "active" section)
  const activeStart = new Date(Date.now() - 1 * 3_600_000); // started 1h ago
  const activeSeat  = getSeat(centers[0].id, 5);
  if (activeSeat) {
    await prisma.booking.create({
      data: {
        code: code(), userId: demo.id, centerId: centers[0].id,
        startTime: activeStart, endTime: hoursFromNow(2),
        hours: 3, totalPrice: 3_500 * 3, status: "CONFIRMED",
        paymentMethod: "QPAY", paymentStatus: "PAID",
        bookingSeats: { create: [{ seatId: activeSeat }] },
      },
    });
  }

  // C) Other players — past bookings to populate the system
  const otherBkDefs: { playerIdx: number; ci: number; dAgo: number; h: number; status: "CONFIRMED" | "CANCELLED" | "NOSHOW" }[] = [
    { playerIdx: 0, ci: 0, dAgo: 5,  h: 2, status: "CONFIRMED" },
    { playerIdx: 1, ci: 1, dAgo: 7,  h: 3, status: "CONFIRMED" },
    { playerIdx: 2, ci: 2, dAgo: 3,  h: 4, status: "CONFIRMED" },
    { playerIdx: 3, ci: 3, dAgo: 10, h: 2, status: "CONFIRMED" },
    { playerIdx: 4, ci: 4, dAgo: 2,  h: 3, status: "CONFIRMED" },
    { playerIdx: 5, ci: 5, dAgo: 6,  h: 2, status: "CONFIRMED" },
    { playerIdx: 6, ci: 6, dAgo: 8,  h: 4, status: "CONFIRMED" },
    { playerIdx: 7, ci: 7, dAgo: 4,  h: 2, status: "CONFIRMED" },
    { playerIdx: 8, ci: 0, dAgo: 14, h: 3, status: "CONFIRMED" },
    { playerIdx: 9, ci: 1, dAgo: 9,  h: 2, status: "CONFIRMED" },
    { playerIdx: 0, ci: 3, dAgo: 20, h: 4, status: "CANCELLED" },
    { playerIdx: 2, ci: 5, dAgo: 15, h: 2, status: "NOSHOW"    },
    { playerIdx: 1, ci: 2, dAgo: 25, h: 3, status: "CONFIRMED" },
    { playerIdx: 4, ci: 6, dAgo: 11, h: 2, status: "CONFIRMED" },
    { playerIdx: 3, ci: 4, dAgo: 18, h: 4, status: "CONFIRMED" },
  ];

  for (const b of otherBkDefs) {
    const c   = centers[b.ci];
    const sid = getSeat(c.id, b.playerIdx + 1);
    if (!sid) continue;
    await createBooking({
      code: code(), userId: players[b.playerIdx].id, centerId: c.id, seatId: sid,
      startTime: daysAgo(b.dAgo, 16), hours: b.h, status: b.status,
    });
  }

  // D) Today's bookings — spread across the day so owner dashboard shows real activity
  //    startTime relative to today's date at various hours
  const todayH = (hour: number) => {
    const d = new Date(); d.setHours(hour, 0, 0, 0); return d;
  };
  const todayBookings: { userId: string; ci: number; startHour: number; h: number; status: "CONFIRMED" | "CANCELLED" | "NOSHOW"; method: "QPAY" | "BALANCE" }[] = [
    { userId: players[0].id, ci: 0, startHour:  9, h: 2, status: "CONFIRMED", method: "BALANCE" },
    { userId: players[1].id, ci: 0, startHour: 10, h: 3, status: "CONFIRMED", method: "QPAY"    },
    { userId: players[2].id, ci: 0, startHour: 11, h: 2, status: "CONFIRMED", method: "BALANCE" },
    { userId: players[3].id, ci: 0, startHour: 13, h: 4, status: "CONFIRMED", method: "QPAY"    },
    { userId: players[4].id, ci: 0, startHour: 14, h: 2, status: "CANCELLED", method: "QPAY"    },
    { userId: players[5].id, ci: 1, startHour: 10, h: 3, status: "CONFIRMED", method: "BALANCE" },
    { userId: players[6].id, ci: 1, startHour: 12, h: 2, status: "CONFIRMED", method: "QPAY"    },
    { userId: players[7].id, ci: 1, startHour: 14, h: 4, status: "CONFIRMED", method: "BALANCE" },
    { userId: players[8].id, ci: 2, startHour: 11, h: 2, status: "CONFIRMED", method: "QPAY"    },
    { userId: players[9].id, ci: 2, startHour: 15, h: 3, status: "CONFIRMED", method: "BALANCE" },
    { userId: players[0].id, ci: 4, startHour: 12, h: 2, status: "CONFIRMED", method: "QPAY"    },
    { userId: players[1].id, ci: 7, startHour: 10, h: 3, status: "CONFIRMED", method: "BALANCE" },
    { userId: players[2].id, ci: 3, startHour: 13, h: 2, status: "NOSHOW",    method: "QPAY"    },
  ];

  for (const b of todayBookings) {
    const c   = centers[b.ci];
    const sid = getSeat(c.id, (todayBookings.indexOf(b) + 3) % 8);
    if (!sid) continue;
    const st = todayH(b.startHour);
    const endTime = new Date(st.getTime() + b.h * 3_600_000);
    const seat = await prisma.seat.findUnique({ where: { id: sid }, select: { typeId: true } });
    const price = (typePrice.get(seat!.typeId) ?? 3_000) * b.h;
    await prisma.booking.create({
      data: {
        code: code(), userId: b.userId, centerId: c.id,
        startTime: st, endTime, hours: b.h, totalPrice: price,
        status: b.status, paymentMethod: b.method, paymentStatus: "PAID",
        cancelledAt:  b.status === "CANCELLED" ? new Date(st.getTime() - 1_800_000) : null,
        cancelReason: b.status === "CANCELLED" ? "Тоглогч цуцалсан" : null,
        bookingSeats: { create: [{ seatId: sid }] },
      },
    });
  }

  // E) Unreviewed completed booking for demo player (so review prompt shows on center page)
  const unreviewedSeat = getSeat(centers[1].id, 7);
  if (unreviewedSeat) {
    await prisma.booking.create({
      data: {
        code: code(), userId: demo.id, centerId: centers[1].id,
        startTime: daysAgo(1, 16), endTime: daysAgo(1, 19),
        hours: 3, totalPrice: 3_500 * 3, status: "CONFIRMED",
        paymentMethod: "BALANCE", paymentStatus: "PAID",
        bookingSeats: { create: [{ seatId: unreviewedSeat }] },
      },
    });
  }

  // F) PENDING bookings (awaiting QPay payment) — visible in owner dashboard
  const pendingSeat0 = getSeat(centers[0].id, 8);
  const pendingSeat1 = getSeat(centers[1].id, 9);
  if (pendingSeat0) {
    const st = new Date(Date.now() + 30 * 60_000); // 30 min from now
    await prisma.booking.create({
      data: {
        code: code(), userId: players[5].id, centerId: centers[0].id,
        startTime: st, endTime: new Date(st.getTime() + 2 * 3_600_000),
        hours: 2, totalPrice: 3_500 * 2, status: "PENDING",
        paymentMethod: "QPAY", paymentStatus: "UNPAID",
        bookingSeats: { create: [{ seatId: pendingSeat0 }] },
      },
    });
  }
  if (pendingSeat1) {
    const st = new Date(Date.now() + 60 * 60_000); // 1h from now
    await prisma.booking.create({
      data: {
        code: code(), userId: players[8].id, centerId: centers[1].id,
        startTime: st, endTime: new Date(st.getTime() + 3 * 3_600_000),
        hours: 3, totalPrice: 3_500 * 3, status: "PENDING",
        paymentMethod: "QPAY", paymentStatus: "UNPAID",
        bookingSeats: { create: [{ seatId: pendingSeat1 }] },
      },
    });
  }

  console.log(`  ${bookingSeq} bookings created`);

  // Update totalPlayHours + noShowCount on users
  const [noshows, playhrs] = await Promise.all([
    prisma.booking.groupBy({ by: ["userId"], where: { status: "NOSHOW" }, _count: true }),
    prisma.booking.groupBy({ by: ["userId"], where: { status: "CONFIRMED", endTime: { lt: new Date() } }, _sum: { hours: true } }),
  ]);
  await Promise.all([
    ...noshows.map((ns) => prisma.user.update({ where: { id: ns.userId }, data: { noShowCount: ns._count } })),
    ...playhrs.filter((p) => p._sum.hours).map((p) =>
      prisma.user.update({ where: { id: p.userId }, data: { totalPlayHours: p._sum.hours! } })
    ),
  ]);

  // ── 7. Favorites ──────────────────────────────────────────────────────────

  // Demo player favorites top 3 centers
  const demoFavs = [0, 1, 4]; // Reihen Pro, Nexus, Zero Latency
  await prisma.favoriteCenter.createMany({
    data: [
      ...demoFavs.map((ci) => ({ userId: demo.id,       centerId: centers[ci].id })),
      { userId: players[0].id, centerId: centers[1].id },
      { userId: players[1].id, centerId: centers[0].id },
      { userId: players[2].id, centerId: centers[7].id },
      { userId: players[3].id, centerId: centers[2].id },
      { userId: players[4].id, centerId: centers[4].id },
      { userId: players[5].id, centerId: centers[0].id },
      { userId: players[6].id, centerId: centers[5].id },
      { userId: players[7].id, centerId: centers[3].id },
    ],
    skipDuplicates: true,
  });
  console.log(`  Favorites seeded`);

  // ── 8. Reviews ────────────────────────────────────────────────────────────

  const reviewData: { comment: string; rating: number; ownerReply?: string }[] = [
    {
      rating: 5,
      comment: "Маш гайхалтай! RTX 4090 суудал дээр Cyberpunk тоглоод гайгүй болсон. Ажилтнууд маш найрсаг, орчин цэвэрхэн.",
      ownerReply: "Баярлалаа! Та бидний хамгийн дуртай үйлчлүүлэгч. Дахин ирнэ гэдэгт итгэж байна!",
    },
    {
      rating: 5,
      comment: "VIP cabin маш тухтай байлаа. Herman Miller сандал дээр 6 цаг тоглоод ч хөл нурасангүй. Streaming setup ч бас top!",
      ownerReply: "VIP туршлага таалагдсанд баярлалаа. Удахгүй шинэ сандал авах гэж байна!",
    },
    {
      rating: 5,
      comment: "Tournament stage дээр CS2 тоглолоо. 240Hz дэлгэц, zero lag. Амьдралдаа хамгийн сайн gaming experience.",
    },
    {
      rating: 4,
      comment: "Сайн газар, үнэ боломжийн. Зөвхөн parking жаахан хэцүү байдаг. Компьютер болон интернэт top зэрэглэлийн.",
      ownerReply: "Санаа зовоход баярлалаа. Parking асуудлыг шийдэх талаар холбогдох газартай ярьж байна!",
    },
    {
      rating: 5,
      comment: "Найзуудтайгаа 5v5 CS2 тоглолоо. Tournament stage нь яг arena маягтай! Дахиж ирнэ, заавал.",
    },
    {
      rating: 4,
      comment: "Орчин цэвэрхэн, хурдан интернэт. Ажилтан Тулгаа маш туслага байлаа. Үнэ бага зэрэг өндөрдсөн мэт ч гэсэн хэвийн.",
    },
    {
      rating: 5,
      comment: "Streamer setup туршиж үзлээ — RTX 4090, 4K webcam, green screen. Бүгд бэлэн байдаг, өөрөө юм авчрах шаардлагагүй!",
      ownerReply: "Streamer зочдод зориулсан setup-д баяртай байна. Удахгүй YouTube дээр холбоос хуваалцаарай!",
    },
    {
      rating: 4,
      comment: "360Hz дэлгэц анх удаа туршлаа. Ялгаа маш мэдрэгдэж байсан! Valorant Silver → Platinum болтлоо хэрэглэнэ.",
    },
    {
      rating: 5,
      comment: "Хотын төвд, захиалга маш хурдан баталгааждаг. App ашиглаад 2 минутад суудал захиалсан. Маш тохиромжтой систем.",
    },
    {
      rating: 3,
      comment: "Компьютер сайн ч гэсэн нэг дэлгэц жаахан гэрэлтэй байсан. Дараагийн удаа ирэхэд сайжирсан байна гэж найдаж байна.",
      ownerReply: "Санааг хуваалцсанд баярлалаа. Тухайн дэлгэцийг аль хэдийн солих захиалга өгсөн байна!",
    },
    {
      rating: 5,
      comment: "VIP Box дотор 4 хүн Private party хийлээ. Mini bar, RTX 4080 ×4 — бүгд perfect. Маш санал болгоно!",
    },
    {
      rating: 4,
      comment: "Баянзүрхэд байдаг учраас ойр. Arena X-ийн upper floor quiet байдаг нь тоглоход тохиромжтой. Үнэ зохистой.",
    },
  ];

  // Get completed bookings for reviews
  const completedBks = await prisma.booking.findMany({
    where: { status: "CONFIRMED", endTime: { lt: new Date() } },
    select: { id: true, userId: true, centerId: true },
    orderBy: { createdAt: "desc" },
    take: reviewData.length,
  });

  for (let i = 0; i < completedBks.length; i++) {
    const bk  = completedBks[i];
    const rev = reviewData[i % reviewData.length];
    await prisma.review.create({
      data: {
        userId: bk.userId, centerId: bk.centerId, bookingId: bk.id,
        rating: rev.rating, comment: rev.comment, ownerReply: rev.ownerReply ?? null,
      },
    });
  }

  // Recalculate center ratings from actual reviews
  for (const c of centers) {
    const agg = await prisma.review.aggregate({ _avg: { rating: true }, where: { centerId: c.id } });
    if (agg._avg.rating != null) {
      await prisma.pCCenter.update({ where: { id: c.id }, data: { rating: agg._avg.rating } });
    }
  }
  console.log(`  ${completedBks.length} reviews seeded`);

  // ── 9. Tournaments ────────────────────────────────────────────────────────

  // LIVE tournament — happening right now
  const liveT = await prisma.tournament.create({
    data: {
      centerId: nexus.id,
      name: "Nexus Spring Championship 2026",
      description: "5v5 CS2 тэмцээн. 8 баг, Double elimination bracket. Эхний байр 500,000₮ авна. Одоо шууд явагдаж байна!",
      game: "CS2",
      startTime: new Date(Date.now() - 2 * 3_600_000),
      endTime:   new Date(Date.now() + 6 * 3_600_000),
      maxTeams: 8, teamSize: 5, entryFee: 20_000, prizePool: 500_000,
      prizeDescription: "🥇 300,000₮ · 🥈 150,000₮ · 🥉 50,000₮",
      status: "LIVE",
    },
  });

  // UPCOMING tournaments
  const upcomingT1 = await prisma.tournament.create({
    data: {
      centerId: reihenPro.id,
      name: "Reihen Solo Showdown — Valorant",
      description: "16 тоглогчийн Valorant 1v1 тэмцээн. Single elimination. Эхний 3 байр шагнал авна.",
      game: "Valorant",
      startTime: daysFromNow(7, 14),
      endTime:   daysFromNow(7, 22),
      maxTeams: 16, teamSize: 1, entryFee: 5_000, prizePool: 200_000,
      prizeDescription: "🥇 120,000₮ · 🥈 60,000₮ · 🥉 20,000₮",
      status: "UPCOMING",
    },
  });

  await prisma.tournament.create({
    data: {
      centerId: centers[4].id, // Zero Latency
      name: "Zero Latency FPS Open 2026",
      description: "CS2 болон Valorant хосолсон FPS тэмцээн. 32 тоглогч, group stage → knockout.",
      game: "CS2 / Valorant",
      startTime: daysFromNow(14, 10),
      endTime:   daysFromNow(14, 22),
      maxTeams: 32, teamSize: 1, entryFee: 8_000, prizePool: 400_000,
      prizeDescription: "🥇 250,000₮ · 🥈 100,000₮ · 🥉 50,000₮",
      status: "UPCOMING",
    },
  });

  await prisma.tournament.create({
    data: {
      centerId: centers[7].id, // Level Up
      name: "Dota 2 Team Cup — Spring",
      description: "5v5 Dota 2 тэмцээн. 8 баг, Round-robin group stage + Playoff.",
      game: "Dota 2",
      startTime: daysFromNow(10, 13),
      endTime:   daysFromNow(10, 23),
      maxTeams: 8, teamSize: 5, entryFee: 15_000, prizePool: 300_000,
      prizeDescription: "🥇 180,000₮ · 🥈 80,000₮ · 🥉 40,000₮",
      status: "UPCOMING",
    },
  });

  // REGISTRATION_CLOSED
  await prisma.tournament.create({
    data: {
      centerId: centers[2].id, // Arena X
      name: "Arena X Monthly — April",
      description: "Сарын тогтмол CS2 тэмцээн. Бүртгэл дүүрсэн. Тэмцээн удахгүй эхэлнэ.",
      game: "CS2",
      startTime: daysFromNow(2, 14),
      endTime:   daysFromNow(2, 22),
      maxTeams: 4, teamSize: 5, entryFee: 10_000, prizePool: 100_000,
      status: "REGISTRATION_CLOSED",
    },
  });

  // Register teams in upcoming + live tournaments
  // Demo player is in the live tournament
  const liveTeam1 = await prisma.tournamentTeam.create({
    data: {
      tournamentId: liveT.id,
      name: "Team Reihen",
      playerNames: ["Batbayar", "Munkhbat", "Otgonbayar", "Enkhjin", "Temuulen"],
      captainId: demo.id,
      paymentStatus: "PAID", paymentMethod: "QPAY",
      members: {
        create: [demo.id, players[0].id, players[1].id, players[2].id, players[3].id]
          .map((uid) => ({ userId: uid })),
      },
    },
  });

  const liveTeam2 = await prisma.tournamentTeam.create({
    data: {
      tournamentId: liveT.id,
      name: "Nexus Squad",
      playerNames: ["Nomin", "Bayarsaikhan", "Dolgoon", "Ankhbayar", "Uyanga"],
      captainId: players[4].id,
      paymentStatus: "PAID", paymentMethod: "BALANCE",
      members: {
        create: [players[4].id, players[5].id, players[6].id, players[7].id, players[8].id]
          .map((uid) => ({ userId: uid })),
      },
    },
  });

  const liveTeam3 = await prisma.tournamentTeam.create({
    data: {
      tournamentId: liveT.id,
      name: "Arena Wolves",
      playerNames: ["Zandan", "Munkhbat", "Enkhjin", "Dolgoon", "Uyanga"],
      captainId: players[9].id,
      paymentStatus: "PAID", paymentMethod: "BALANCE",
      members: {
        create: [players[9].id, players[0].id, players[2].id, players[6].id, players[8].id]
          .map((uid) => ({ userId: uid })),
      },
    },
  });

  const liveTeam4 = await prisma.tournamentTeam.create({
    data: {
      tournamentId: liveT.id,
      name: "Zero Ping",
      playerNames: ["Ankhbayar", "Bayarsaikhan", "Otgonbayar", "Temuulen", "Nomin"],
      captainId: players[7].id,
      paymentStatus: "PAID", paymentMethod: "QPAY",
      members: {
        create: [players[7].id, players[5].id, players[1].id, players[3].id, players[4].id]
          .map((uid) => ({ userId: uid })),
      },
    },
  });

  await prisma.tournamentMatch.createMany({
    data: [
      {
        tournamentId: liveT.id,
        round: 1,
        matchNumber: 1,
        teamAId: liveTeam1.id,
        teamBId: liveTeam2.id,
        winnerTeamId: liveTeam1.id,
        scoreA: 13,
        scoreB: 9,
        status: "COMPLETED",
      },
      {
        tournamentId: liveT.id,
        round: 1,
        matchNumber: 2,
        teamAId: liveTeam3.id,
        teamBId: liveTeam4.id,
        scoreA: 7,
        scoreB: 7,
        status: "LIVE",
      },
      {
        tournamentId: liveT.id,
        round: 2,
        matchNumber: 1,
        teamAId: liveTeam1.id,
        status: "PENDING",
      },
    ],
  });

  // Demo player registers for upcoming solo tourney
  await prisma.tournamentTeam.create({
    data: {
      tournamentId: upcomingT1.id,
      playerNames: ["Batbayar"],
      name: "Батбаяр Г.",
      captainId: demo.id,
      paymentStatus: "PAID", paymentMethod: "QPAY",
      members: { create: [{ userId: demo.id }] },
    },
  });

  console.log("  6 tournaments seeded (1 LIVE · 3 UPCOMING · 1 REGISTRATION_CLOSED · 1 pending-round)");

  // ── Summary ───────────────────────────────────────────────────────────────

  console.log("\n" + "━".repeat(62));
  console.log("  REIHEN — DEMO CREDENTIALS");
  console.log("━".repeat(62));
  console.log("  ROLE       EMAIL                      PASSWORD");
  console.log("  ─────────────────────────────────────────────────────────");
  console.log("  Admin      admin@reihen.mn             admin123");
  console.log("  Owner 1    gankky@gmail.com            owner123   (ENTERPRISE · 7 centers · Clerk-ready)");
  console.log("  Owner 2    sarnai@reihen.mn            owner123   (PRO · 4 centers)");
  console.log("  Staff      tulgaa@reihen.mn            staff123");
  console.log("  Demo       demo@reihen.mn              demo123    ← main demo account");
  console.log("  Player     munkhbat@gmail.com          player123");
  console.log("━".repeat(62));
  console.log(`  ${centers.length} centers · ${totalSeats} seats · ${bookingSeq} bookings · ${completedBks.length} reviews`);
  console.log("  Demo player: 6 months history · unreviewed booking · 3 favorites · 1 live tournament");
  console.log("  Today: 13 bookings across 5 centers · 2 PENDING QPay bookings");
  console.log("━".repeat(62) + "\n");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
