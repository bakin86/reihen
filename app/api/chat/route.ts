import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

const GROQ_API_KEY = process.env.GROQ_API_KEY ?? "";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

const SYSTEM_PROMPT = `Чи бол Reihen PC Gaming Center платформын AI туслах. Монгол хэлээр ярина.

Чиний үүрэг:
- Хэрэглэгчдэд PC gaming center-ийн талаар бодит мэдээлэл өгөх
- Захиалга хийхэд туслах — center хайж, суудал, цаг сонгоход туслах
- Төлбөр, үнийн талаар тайлбарлах
- Сул суудал хайхад туслах — [LIVE DATA]-аас ЗӨВХӨН бодит тоо хэрэглэ

Дүрэм:
- [LIVE DATA] байхгүй бол суудлын тоо, үнэ, нэр зохиомол мэдээлэл хэлэх ХОРИОТОЙ
- Хэрэглэгч center-ийн нэр, суудлын тоо, үнэ асуувал [LIVE DATA]-аас л хариулна
- Центрийн линк өгөхдөө яг [LIVE DATA]-д байгаа линкийг ашиглана — өөрчлөх хориотой
- Хэрэв [LIVE DATA] байхгүй бол "Одоогоор мэдээлэл авах боломжгүй байна" гэж хэл

Платформын ерөнхий мэдээлэл:
- Reihen нь Монголын PC gaming center захиалгын платформ
- Хэрэглэгчид center хайж, суудал сонгож, цаг захиалж болно
- Төлбөрийг QPay эсвэл Balance-ээр хийнэ
- Захиалга хийхийн тулд бүртгүүлж нэвтрэх шаардлагатай
- Нүүр хуудас дээр бүх center-ийг харж болно

Товч, найрсаг, тодорхой хариулт өг.`;

// Detect seat/center search intent — broader keyword matching
function parseSeatQuery(text: string): { wantSeats: number; district?: string } | null {
  const lower = text.toLowerCase();

  const keywords = [
    "суудал", "суудлын", "seat", "center", "газар", "тоглох", "сул", "хайх",
    "байна уу", "захиалах", "хаана", "центр", "gaming", "pc", "үнэ", "хямд",
    "нээлттэй", "available", "хэдэн", "хэд",
  ];
  if (!keywords.some((k) => lower.includes(k))) return null;

  const numMatch = text.match(/(\d+)\s*(сул|суудал|seat|ширээ|хүн|тоглогч)/i);
  const wantSeats = numMatch ? parseInt(numMatch[1], 10) : 1;

  const districts = [
    "баянзүрх", "сүхбаатар", "хан-уул", "баянгол", "чингэлтэй", "сонгинохайрхан",
    "налайх", "багануур", "багахангай",
  ];
  const district = districts.find((d) => lower.includes(d));

  return { wantSeats: Math.max(1, Math.min(wantSeats, 50)), district };
}

async function fetchLiveData(query: { wantSeats: number; district?: string }): Promise<string> {
  const centers = await prisma.pCCenter.findMany({
    where: query.district ? { district: { contains: query.district, mode: "insensitive" } } : {},
    include: {
      seatTypes: { select: { name: true, pricePerHour: true } },
      seats: {
        select: { id: true, status: true },
      },
      _count: { select: { reviews: true } },
    },
    orderBy: [{ rating: "desc" }],
    take: 20,
  });

  const results = centers.map((c) => {
    const openSeats  = c.seats.filter((s) => s.status === "OPEN").length;
    const totalSeats = c.seats.length;
    const minPrice = c.seatTypes.reduce(
      (m, t) => (m === null || t.pricePerHour < m ? t.pricePerHour : m),
      null as number | null
    );
    return { id: c.id, name: c.name, district: c.district, address: c.address, rating: c.rating, totalSeats, openSeats, reviewCount: c._count.reviews, minPrice, seatTypes: c.seatTypes };
  }).filter((c) => c.openSeats >= query.wantSeats);

  if (results.length === 0) {
    // Show all centers even if not enough open seats
    const all = centers.map((c) => {
      const openSeats  = c.seats.filter((s) => s.status === "OPEN").length;
      const totalSeats = c.seats.length;
      const minPrice = c.seatTypes.reduce((m, t) => (m === null || t.pricePerHour < m ? t.pricePerHour : m), null as number | null);
      return { id: c.id, name: c.name, district: c.district, rating: c.rating, totalSeats, openSeats, minPrice };
    });
    const lines = all.slice(0, 6).map((c) =>
      `• ${c.name} (${c.district}) — ${c.openSeats}/${c.totalSeats} сул суудал, ${c.minPrice?.toLocaleString() ?? "?"}₮/цаг, ⭐${c.rating?.toFixed(1) ?? "—"} → /centers/${c.id}`
    );
    return `\n[LIVE DATA] ${query.wantSeats}+ сул суудалтай газар одоогоор байхгүй байна. Бусад center-үүд:\n${lines.join("\n")}`;
  }

  const lines = results.slice(0, 6).map((c) =>
    `• ${c.name} (${c.district}) — ${c.openSeats}/${c.totalSeats} сул суудал, ${c.minPrice?.toLocaleString() ?? "?"}₮/цаг, ⭐${c.rating?.toFixed(1) ?? "—"} → /centers/${c.id}`
  );

  return `\n[LIVE DATA] ${query.wantSeats}+ сул суудалтай center-үүд${query.district ? ` (${query.district})` : ""} (${results.length} газар):\n${lines.join("\n")}`;
}

export async function POST(req: NextRequest) {
  if (!GROQ_API_KEY) {
    return Response.json({ error: "GROQ_API_KEY not configured" }, { status: 500 });
  }

  try {
    const { messages } = await req.json();
    if (!Array.isArray(messages) || messages.length === 0) {
      return Response.json({ error: "Messages required" }, { status: 400 });
    }

    const cleaned = messages.map((m: { role: string; content: string }) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: String(m.content).slice(0, 2000),
    }));

    // Check latest user message for seat/center query
    const lastUserMsg = cleaned.filter((m: { role: string }) => m.role === "user").pop();
    let liveContext = "";
    if (lastUserMsg) {
      const query = parseSeatQuery(lastUserMsg.content);
      if (query) {
        try {
          liveContext = await fetchLiveData(query);
        } catch {
          liveContext = "\n[LIVE DATA] Мэдээлэл авахад алдаа гарлаа.";
        }
      }
    }

    const systemPrompt = SYSTEM_PROMPT + liveContext;

    const groqRes = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "system", content: systemPrompt }, ...cleaned],
        max_tokens: 800,
        stream: true,
        temperature: 0.3,
      }),
    });

    if (!groqRes.ok || !groqRes.body) {
      const err = await groqRes.text().catch(() => "Groq API error");
      return Response.json({ error: err }, { status: groqRes.status });
    }

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const reader = groqRes.body.getReader();

    const readable = new ReadableStream({
      async start(controller) {
        let buffer = "";
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              const payload = line.slice(6).trim();
              if (payload === "[DONE]") {
                controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                break;
              }
              try {
                const chunk = JSON.parse(payload);
                const text = chunk.choices?.[0]?.delta?.content;
                if (text) {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
                }
              } catch { /* skip malformed */ }
            }
          }
          controller.close();
        } catch {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "Stream error" })}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch {
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
