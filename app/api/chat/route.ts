import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

const GROQ_API_KEY = process.env.GROQ_API_KEY ?? "";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

const SYSTEM_PROMPT = `Чи бол Reihen PC Gaming Center-ийн AI туслах. Монгол хэлээр ярина.

Чиний үүрэг:
- Хэрэглэгчдэд PC gaming center-ийн үйлчилгээний талаар мэдээлэл өгөх
- Захиалга хийхэд туслах (center хайх, суудал сонгох, цаг товлох)
- Төлбөр, үнийн талаар тайлбарлах
- Техникийн асуудалд туслах
- Сул суудал хайхад туслах — бодит мэдээллийг системээс авч өгнө

Чухал мэдээлэл:
- Reihen нь Монголын PC gaming center захиалгын платформ
- Хэрэглэгчид center хайж, суудал сонгож, цаг захиалж болно
- Төлбөрийг QPay эсвэл Balance-ээр хийнэ
- Захиалга хийхийн тулд бүртгүүлж нэвтрэх шаардлагатай
- Хэрэглэгч суудал хайвал доорх [LIVE DATA] хэсгийг ашиглан бодит мэдээлэл өг
- Захиалга хийхийг зөвлөхдөө [LIVE DATA]-аас ирсэн бодит линкийг шууд өг. Линкийг өөрчлөх, тайлбарлах хэрэггүй — яг байгаагаар нь хэл.

Товч, найрсаг, тодорхой хариулт өг. Хэрэв мэдэхгүй зүйл асуувал шударгаар хэл.`;

// Detect seat/center search intent and extract desired count
function parseSeatQuery(text: string): { wantSeats: number; district?: string } | null {
  const lower = text.toLowerCase();
  // Match patterns like "10 сул суудал", "5 суудал", "сул суудал", "суудал хайх", "суудал байна уу", "center хайх"
  const keywords = ["суудал", "суудлын", "seat", "center", "газар", "тоглох", "сул", "хайх", "байна уу", "захиалах"];
  if (!keywords.some((k) => lower.includes(k))) return null;

  // Extract number
  const numMatch = text.match(/(\d+)\s*(сул|суудал|seat|ширээ)/i);
  const wantSeats = numMatch ? parseInt(numMatch[1], 10) : 1;

  // Extract district
  const districts = [
    "баянзүрх", "сүхбаатар", "хан-уул", "баянгол", "чингэлтэй", "сонгинохайрхан",
    "налайх", "багануур", "багахангай"
  ];
  const district = districts.find((d) => lower.includes(d));

  return { wantSeats: Math.max(1, Math.min(wantSeats, 100)), district };
}

async function fetchLiveData(query: { wantSeats: number; district?: string }): Promise<string> {
  const centers = await prisma.pCCenter.findMany({
    where: query.district ? { district: { contains: query.district } } : {},
    include: {
      seatTypes: { select: { name: true, pricePerHour: true } },
      seats: { where: { status: "OPEN" }, select: { id: true } },
      _count: { select: { seats: true, reviews: true } },
    },
    orderBy: [{ rating: "desc" }],
    take: 20,
  });

  const results = centers
    .map((c) => ({
      id: c.id,
      name: c.name,
      district: c.district,
      address: c.address,
      rating: c.rating,
      totalSeats: c._count.seats,
      openSeats: c.seats.length,
      reviewCount: c._count.reviews,
      minPrice: c.seatTypes.reduce(
        (m, t) => (m === null || t.pricePerHour < m ? t.pricePerHour : m),
        null as number | null
      ),
      seatTypes: c.seatTypes.map((t) => `${t.name}: ${t.pricePerHour.toLocaleString()}₮/цаг`),
    }))
    .filter((c) => c.openSeats >= query.wantSeats);

  if (results.length === 0) {
    return `\n[LIVE DATA] Хайлт: ${query.wantSeats}+ сул суудал${query.district ? ` (${query.district})` : ""}.\nОдоогоор ${query.wantSeats}+ сул суудалтай газар олдсонгүй. Бага тоогоор хайхыг зөвлө.`;
  }

  const lines = results.slice(0, 8).map((c) =>
    `• ${c.name} (${c.district}) — ${c.openSeats}/${c.totalSeats} сул, ${c.minPrice?.toLocaleString() ?? "?"}₮/цаг, ⭐${c.rating?.toFixed(1) ?? "—"}, захиалах: /booking?center=${c.id}`
  );

  return `\n[LIVE DATA] Хайлт: ${query.wantSeats}+ сул суудал${query.district ? ` (${query.district})` : ""}. ${results.length} газар олдлоо:\n${lines.join("\n")}`;
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

    // Check if the latest user message is asking about seats/centers
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
        max_tokens: 1024,
        stream: true,
      }),
    });

    if (!groqRes.ok || !groqRes.body) {
      const err = await groqRes.text().catch(() => "Groq API error");
      return Response.json({ error: err }, { status: groqRes.status });
    }

    // Pipe Groq SSE → client SSE
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
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ text })}\n\n`)
                  );
                }
              } catch {
                // skip malformed
              }
            }
          }
          controller.close();
        } catch {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: "Stream error" })}\n\n`)
          );
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
