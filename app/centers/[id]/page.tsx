"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { SeatCell, SeatLegend, type SeatStatus } from "@/components/SeatCell";
import { Confetti } from "@/components/Confetti";
import { useSeatSocket, type SeatUpdate } from "@/lib/useSeatSocket";
import { useAuth } from "@/lib/useAuth";
import { useCountdown } from "@/lib/useCountdown";
import { apiFetch } from "@/lib/api";
import { getMainImage, getImagesByTag, IMAGE_TAGS, type CenterImage, type ImageTag } from "@/lib/image-types";

interface SeatData {
  id: string;
  number: string;
  status: SeatStatus;
  floor: { id: string; floorNumber: number; name: string };
  type: { id: string; name: string; pricePerHour: number };
  freeAt: string | null;
  posX: number | null;
  posY: number | null;
  currentUser: { maskedName: string } | null;
}

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  ownerReply: string | null;
  createdAt: string;
  user: { name: string };
}

interface CenterInfo {
  id: string;
  name: string;
  images: CenterImage[] | string[];
  district: string;
  address: string;
  description: string | null;
  rating: number;
  reviewCount: number;
  seatTypes: { id: string; name: string; pricePerHour: number; peakHourPrice: number | null }[];
  maxSeatsPerBooking: number;
  noShowMinutes: number;
  cancelMinutes: number;
}

const HOURS = Array.from({ length: 14 }, (_, i) => `${String(10 + i).padStart(2, "0")}:00`);

export default function CenterPage({ params }: { params: { id: string } }) {
  const { user, token } = useAuth();
  const [center, setCenter] = useState<CenterInfo | null>(null);
  const [seats, setSeats] = useState<SeatData[]>([]);
  const [floor, setFloor] = useState<number>(1);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [tournaments, setTournaments] = useState<{ id: string; name: string; game: string; startTime: string; status: string; maxTeams: number; teamSize: number; entryFee: number; prizePool: number; _count: { teams: number } }[]>([]);
  const [imgIdx, setImgIdx] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [isFav, setIsFav] = useState(false);

  // Star rating
  const [myUnreviewedBookingId, setMyUnreviewedBookingId] = useState<string | null>(null);
  const [hoverStar, setHoverStar] = useState(0);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [ratingPending, setRatingPending] = useState(false);

  // Multi-seat selection + booking
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [start, setStart] = useState<string | null>(null);
  const [hours, setHoursVal] = useState(1);
  const [method, setMethod] = useState<"QPAY" | "BALANCE">("QPAY");
  const [submitting, setSubmitting] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [error, setError] = useState("");
  const [bookingCode, setBookingCode] = useState<string | null>(null);

  // QPay payment pending state
  const [qpayPending, setQpayPending] = useState<{
    bookingId: string;
    code: string;
    qrImage?: string;
    shortUrl?: string;
    deeplinks?: { name: string; link: string }[];
    invoiceId?: string;
  } | null>(null);

  useEffect(() => {
    apiFetch<{ center: CenterInfo; seats: SeatData[] }>(`/api/centers/${params.id}/seats`)
      .then(({ center: c, seats: s }) => {
        setCenter(c);
        setSeats(s);
        if (s.length) setFloor(s[0].floor.floorNumber);
      })
      .catch(() => {});
    apiFetch<{ reviews: Review[]; myUnreviewedBookingId: string | null }>(`/api/centers/${params.id}/reviews`, { token: token ?? undefined })
      .then(({ reviews: r, myUnreviewedBookingId: bid }) => {
        setReviews(r);
        setMyUnreviewedBookingId(bid);
      })
      .catch(() => {});
    apiFetch<{ tournaments: typeof tournaments }>(`/api/centers/${params.id}/tournaments`)
      .then(({ tournaments: t }) => setTournaments(t))
      .catch(() => {});
    if (token) {
      apiFetch<{ centers: { id: string }[] }>("/api/favorites", { token })
        .then(({ centers: favs }) => setIsFav(favs.some((f) => f.id === params.id)))
        .catch(() => {});
    }
  }, [params.id, token]);

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const toggleFav = async () => {
    if (!token) return;
    const next = !isFav;
    setIsFav(next);
    try {
      await apiFetch(`/api/favorites/${params.id}`, {
        method: next ? "POST" : "DELETE",
        token,
      });
    } catch {
      setIsFav(!next); // revert on error
    }
  };

  // Socket — auto-deselect seats that become unavailable
  const handleUpdate = useCallback(
    (u: SeatUpdate) => {
      setSeats((prev) =>
        prev.map((s) =>
          s.id === u.id ? { ...s, status: u.status, freeAt: u.freeAt ?? s.freeAt } : s
        )
      );
      if (u.status !== "OPEN") {
        setSelectedIds((prev) => prev.filter((id) => id !== u.id));
      }
    },
    []
  );
  useSeatSocket(params.id, handleUpdate);

  const floors = useMemo(
    () =>
      Array.from(new Set(seats.map((s) => s.floor.floorNumber)))
        .sort()
        .map((n) => ({ n, name: seats.find((s) => s.floor.floorNumber === n)!.floor.name })),
    [seats]
  );
  const view = seats.filter((s) => s.floor.floorNumber === floor);
  const openCount = seats.filter((s) => s.status === "OPEN").length;

  // Earliest seat that will free up
  const nextFreeAt = useMemo(() => {
    const now = Date.now();
    const times = seats
      .filter((s) => s.status === "OCCUPIED" && s.freeAt)
      .map((s) => new Date(s.freeAt!).getTime())
      .filter((t) => t > now)
      .sort((a, b) => a - b);
    return times.length > 0 ? new Date(times[0]).toISOString() : null;
  }, [seats]);
  const nextFreeMin = useCountdown(nextFreeAt);

  const minPrice = seats.reduce(
    (m, s) => (m === null || s.type.pricePerHour < m ? s.type.pricePerHour : m),
    null as number | null
  );

  const pickedSeats = seats.filter((s) => selectedIds.includes(s.id));
  const total = pickedSeats.reduce((sum, s) => sum + s.type.pricePerHour * hours, 0);
  const allOpen = pickedSeats.every((s) => s.status === "OPEN");
  const canSubmit = pickedSeats.length > 0 && allOpen && start && !submitting && token;

  const maxSeats = center?.maxSeatsPerBooking ?? 10;
  const toggleSeat = (id: string, status: SeatStatus) => {
    if (status !== "OPEN") return;
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= maxSeats) return prev; // enforce limit
      return [...prev, id];
    });
  };

  const confirmBooking = () => {
    if (!canSubmit || !start) return;
    setShowWarning(true);
  };

  const submitBooking = async () => {
    setShowWarning(false);
    if (!canSubmit || !start) return;
    setError("");
    setSubmitting(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const startTime = new Date(`${today}T${start}:00`);
      const res = await apiFetch<{
        booking: { id: string; code: string; status: string };
        payment: {
          pending?: boolean;
          qrImage?: string;
          shortUrl?: string;
          deeplinks?: { name: string; link: string }[];
          invoiceId?: string;
        };
      }>("/api/bookings", {
        method: "POST",
        token,
        body: JSON.stringify({
          seatIds: selectedIds,
          startTime: startTime.toISOString(),
          hours,
          paymentMethod: method,
        }),
      });

      if (res.payment?.pending) {
        // QPay: show QR screen, poll for confirmation
        setQpayPending({
          bookingId: res.booking.id,
          code: res.booking.code,
          qrImage: res.payment.qrImage,
          shortUrl: res.payment.shortUrl,
          deeplinks: res.payment.deeplinks,
          invoiceId: res.payment.invoiceId,
        });
      } else {
        setBookingCode(res.booking.code);
      }
    } catch (err: any) {
      setError(err.message ?? "Booking failed");
    } finally {
      setSubmitting(false);
    }
  };

  // Poll booking status when QPay payment is pending
  useEffect(() => {
    if (!qpayPending || !token) return;
    const interval = setInterval(async () => {
      try {
        const res = await apiFetch<{
          bookings: { id: string; code: string; status: string; paymentStatus: string }[];
        }>("/api/bookings?limit=5", { token });
        const found = res.bookings.find((b) => b.id === qpayPending.bookingId);
        if (found && found.paymentStatus === "PAID") {
          clearInterval(interval);
          setQpayPending(null);
          setBookingCode(found.code);
        }
      } catch { /* ignore polling errors */ }
    }, 3000);
    return () => clearInterval(interval);
  }, [qpayPending, token]);

  // Loading state
  if (!center) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="space-y-3 text-center">
          <div className="display text-2xl animate-pulse">LOADING...</div>
          <div className="h-1 w-24 mx-auto bg-black/10 overflow-hidden">
            <div className="h-full w-1/2 bg-black animate-[ticker_1s_linear_infinite]" />
          </div>
        </div>
      </main>
    );
  }

  // QPay payment pending — show QR + deeplinks
  if (qpayPending && center) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-black p-6 text-white">
        <p className="anim-fade-up text-xs uppercase tracking-[0.3em] text-white/40">ТӨЛБӨР ХҮЛЭЭГДЭЖ БАЙНА</p>
        <div className="anim-scale-in mt-6 display text-2xl">{center.name.toUpperCase()}</div>
        <p className="anim-fade-up anim-d1 mono mt-2 text-sm text-white/50">
          {qpayPending.code} · {total.toLocaleString()}₮
        </p>

        {/* QR Code */}
        <div className="anim-scale-in anim-d2 mt-8 bg-white p-4">
          {qpayPending.qrImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`data:image/png;base64,${qpayPending.qrImage}`} alt="QPay QR" className="h-52 w-52" />
          ) : qpayPending.shortUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qpayPending.shortUrl} alt="QPay QR" className="h-52 w-52" />
          ) : (
            <div className="flex h-52 w-52 items-center justify-center text-black text-xs">QR NOT AVAILABLE</div>
          )}
        </div>

        {/* Check payment button (mock/sandbox — triggers auto-confirm) */}
        <button
          onClick={async () => {
            if (!qpayPending.invoiceId) return;
            try {
              await fetch(`/api/qpay/callback?qpay_payment_id=${qpayPending.invoiceId}&mock=1`);
            } catch {}
          }}
          className="anim-fade-up anim-d3 btn-pop mt-8 w-full max-w-sm border border-white py-4 text-xs uppercase tracking-[0.3em] text-white hover:bg-white hover:text-black transition-colors"
        >
          ТӨЛБӨР ШАЛГАХ
        </button>

        {/* Polling indicator */}
        <div className="anim-fade-up anim-d4 mt-6 flex items-center gap-3">
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-green-500" />
          </span>
          <span className="text-[10px] uppercase tracking-[0.3em] text-white/40">
            АВТОМАТ ШАЛГАЖ БАЙНА...
          </span>
        </div>

        <button
          onClick={() => { setQpayPending(null); setError(""); }}
          className="mt-6 text-[10px] uppercase tracking-[0.3em] text-white/30 hover:text-white"
        >
          БУЦАХ
        </button>
      </main>
    );
  }

  // Booking success
  if (bookingCode && center) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-black p-10 text-white">
        <Confetti />
        <p className="anim-fade-up text-xs uppercase tracking-[0.3em] text-gray">CONFIRMED</p>
        <div className="anim-scale-in anim-d1 anim-success display mono mt-6 text-[20vw] md:text-[12vw]">{bookingCode}</div>
        <p className="anim-fade-up anim-d2 mt-4 display text-xl text-white/60">{center.name.toUpperCase()}</p>
        <p className="anim-fade-up anim-d3 mt-4 text-sm text-gray">
          {pickedSeats.map((s) => s.number).join(", ")} · {start} · {hours}ц · {total.toLocaleString()}₮
        </p>
        <div className="anim-fade-up anim-d4 mt-12 flex gap-4">
          <Link
            href="/"
            className="btn-pop border border-white px-6 py-4 text-xs uppercase tracking-[0.3em] hover:bg-white hover:text-black"
          >
            HOME
          </Link>
          <button
            onClick={() => { setBookingCode(null); setSelectedIds([]); setStart(null); setError(""); }}
            className="btn-pop bg-white px-6 py-4 text-xs uppercase tracking-[0.3em] text-black"
          >
            ДАХИН ЗАХИАЛАХ
          </button>
        </div>
      </main>
    );
  }

  const heroImg = getMainImage(center.images);
  const allUrls = getImagesByTag(center.images);

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white">
      {/* ─── HERO: Full-width image with overlay ─── */}
      <section className="relative h-[70vh] min-h-[500px] overflow-hidden bg-black">
        {heroImg ? (
          <Image
            src={heroImg}
            alt={center.name}
            fill
            priority
            className="anim-fade-in object-cover"
            sizes="100vw"
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-black/20" />

        {/* Nav overlay */}
        <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-6 py-5 md:px-12">
          <Link href="/" className="text-xs uppercase tracking-[0.3em] text-white/70 hover:text-white transition-colors">
            ← HOME
          </Link>
          <div className="flex items-center gap-4">
            {user && (
              <button
                onClick={toggleFav}
                title={isFav ? "Дуртайгаас хасах" : "Дуртайд нэмэх"}
                className={`flex h-8 w-8 items-center justify-center rounded-full border text-sm transition-all duration-300 ${
                  isFav
                    ? "border-red-400/60 bg-red-400/10 text-red-400"
                    : "border-white/20 bg-black/30 text-white/60 hover:border-white/40 hover:text-white"
                }`}
              >
                {isFav ? "♥" : "♡"}
              </button>
            )}
            <button
              onClick={copyLink}
              className="text-xs uppercase tracking-[0.3em] text-white/70 hover:text-white transition-colors"
            >
              {copied ? "COPIED!" : "SHARE"}
            </button>
            <Link
              href={`/booking?center=${params.id}`}
              className="btn-pop border border-white px-5 py-2.5 text-xs uppercase tracking-[0.3em] text-white hover:bg-white hover:text-black transition-colors"
            >
              BOOK →
            </Link>
          </div>
        </div>

        {/* Hero content */}
        <div className="absolute inset-x-0 bottom-0 z-10 p-6 md:p-12">
          <div className="flex items-center gap-3">
            <span className="anim-fade-up text-[10px] uppercase tracking-[0.3em] text-white/60">
              {center.district}
            </span>
            <span className="anim-fade-up anim-d1 flex items-center gap-1 mono text-xs text-white/60">
              {center.rating.toFixed(1)} ★ ({center.reviewCount})
            </span>
            {/* Live dot */}
            <span className="anim-fade-in anim-d3 relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
            </span>
            <span className="anim-fade-in anim-d3 text-[10px] uppercase tracking-[0.3em] text-white/40">LIVE</span>
          </div>

          <h1 className="anim-hero anim-d1 display mt-3 text-6xl text-white md:text-[10vw] md:leading-[0.85]">
            {center.name.toUpperCase()}
          </h1>

          <div className="anim-fade-up anim-d3 mt-4 flex flex-wrap items-center gap-6">
            <span className="mono text-sm text-white">{center.address}</span>
            {center.description && (
              <span className="hidden max-w-sm text-sm text-white/50 md:block">{center.description}</span>
            )}
          </div>
        </div>
      </section>

      {/* ─── STATS BAR ─── */}
      <section className="relative grid grid-cols-4 border-b border-black bg-[#0d0d0d]">
        {[
          { n: String(seats.length), l: "СУУДАЛ", green: false },
          { n: String(openCount), l: "СУЛ", green: openCount > 0 },
          { n: minPrice !== null ? `${minPrice.toLocaleString()}₮` : "—", l: "НЭГ ЦАГ", green: false },
          { n: openCount > 0 ? "ОДОО" : nextFreeMin != null ? `~${nextFreeMin}м` : "—", l: "ДАРААГИЙН", green: openCount > 0 },
        ].map(({ n, l, green }, i) => (
          <div
            key={i}
            className={`anim-count anim-d${i + 1} flex flex-col items-center justify-center border-white/10 p-4 [&:not(:last-child)]:border-r md:p-8`}
          >
            <div className={`display mono text-2xl md:text-5xl flex items-center gap-2 ${green ? "text-green-400" : "text-white"}`}>
              {green && i === 1 && (
                <span className="relative flex h-1.5 w-1.5 shrink-0">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-60" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-green-400" />
                </span>
              )}
              {n}
            </div>
            <div className="mt-1 text-[9px] uppercase tracking-[0.3em] text-white/30 md:mt-2 md:text-[10px]">{l}</div>
          </div>
        ))}
      </section>

      {/* ─── GALLERY STRIP with tag tabs ─── */}
      {allUrls.length > 1 && (
        <GalleryStrip images={center.images} centerName={center.name} onClickImage={(i: number) => setImgIdx(i)} />
      )}

      {/* ─── SEAT TYPES PRICING ─── */}
      {center.seatTypes.length > 0 && (
        <section className="anim-fade-up border-b border-white/10 bg-[#0d0d0d] p-4 md:p-6">
          <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {center.seatTypes.map((t, i) => (
              <div
                key={t.id}
                className={`anim-fade-up rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5 md:p-6 text-center ${i === 0 ? "md:row-span-2 flex flex-col justify-center" : ""}`}
                style={{ animationDelay: `${i * 0.08}s` }}
              >
                <div className="text-[10px] uppercase tracking-[0.3em] text-white/40">{t.name}</div>
                <div className={`display mono mt-2 text-white ${i === 0 ? "text-4xl md:text-5xl" : "text-2xl md:text-3xl"}`}>{t.pricePerHour.toLocaleString()}₮</div>
                <div className="text-[10px] text-white/30">/цаг</div>
                {t.peakHourPrice && (
                  <div className="mt-2 rounded-full bg-yellow-500/10 px-3 py-1 text-[10px] text-yellow-400 inline-block mx-auto">
                    PEAK: {t.peakHourPrice.toLocaleString()}₮
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ─── FLOOR TABS ─── */}
      <section className="border-b border-white/10 bg-[#0d0d0d] px-6 md:px-12">
        <div className="flex items-center justify-between py-4">
          <div className="flex gap-8">
            {floors.map((f) => (
              <button
                key={f.n}
                onClick={() => setFloor(f.n)}
                data-active={floor === f.n}
                className="underline-tab text-sm uppercase tracking-[0.3em] text-white data-[active=false]:text-white/30"
              >
                {f.name || `FLOOR 0${f.n}`}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
            </span>
            <span className="mono text-xs text-white/50">
              {view.filter((s) => s.status === "OPEN").length}/{view.length} OPEN
            </span>
          </div>
        </div>
      </section>

      {/* ─── SEAT GRID + BOOKING PANEL ─── */}
      <section id="seats-section" className="grid grid-cols-1 md:grid-cols-[2fr_1fr]">
        <div className="border-white/10 bg-[#0d0d0d] p-6 md:border-r md:p-12">
          {/* Selection toolbar */}
          <div className="mb-6 flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-[0.3em] text-white/40">СУУДАЛ СОНГОХ <span className="mono">({selectedIds.length}/{maxSeats})</span></p>
            {selectedIds.length > 0 && (
              <div className="flex items-center gap-3">
                <span className="mono text-xs text-white/60">{selectedIds.length} SELECTED</span>
                <button
                  onClick={() => setSelectedIds([])}
                  className="text-[10px] uppercase tracking-[0.3em] text-white/30 hover:text-white"
                >
                  CLEAR
                </button>
              </div>
            )}
          </div>

          {/* Positioned layout if seats have posX/posY, otherwise auto-grid */}
          {view.some((s) => s.posX !== null && s.posY !== null) ? (() => {
            const positioned = view.filter((s) => s.posX !== null && s.posY !== null);
            const maxCol = Math.max(...positioned.map((s) => s.posX!)) + 1;
            const maxRow = Math.max(...positioned.map((s) => s.posY!)) + 1;
            return (
              <div
                className="w-full overflow-x-auto rounded-xl border border-white/5 bg-black/30 p-4"
              >
                <div
                  className="grid gap-2 mx-auto"
                  style={{
                    gridTemplateColumns: `repeat(${maxCol}, minmax(56px, 1fr))`,
                    gridTemplateRows: `repeat(${maxRow}, minmax(56px, 1fr))`,
                    maxWidth: Math.max(maxCol * 72, 320),
                  }}
                >
                  {Array.from({ length: maxRow * maxCol }, (_, i) => {
                    const col = i % maxCol;
                    const row = Math.floor(i / maxCol);
                    const seat = positioned.find((s) => s.posX === col && s.posY === row);
                    return seat ? (
                      <div
                        key={`${col}-${row}`}
                        style={{ gridColumn: col + 1, gridRow: row + 1 }}
                      >
                        <SeatCell
                          number={seat.number}
                          status={seat.status}
                          freeAt={seat.freeAt}
                          selected={selectedIds.includes(seat.id)}
                          onClick={() => toggleSeat(seat.id, seat.status)}
                        />
                      </div>
                    ) : (
                      <div key={`empty-${col}-${row}`} style={{ gridColumn: col + 1, gridRow: row + 1 }} />
                    );
                  })}
                </div>
              </div>
            );
          })() : (
            <div className="grid grid-cols-4 gap-2 rounded-xl border border-white/5 bg-black/30 p-4 md:grid-cols-8 lg:grid-cols-10">
              {view.map((s) => (
                <SeatCell
                  key={s.id}
                  number={s.number}
                  status={s.status}
                  freeAt={s.freeAt}
                  selected={selectedIds.includes(s.id)}
                  onClick={() => toggleSeat(s.id, s.status)}
                />
              ))}
            </div>
          )}
          {view.length === 0 && (
            <p className="py-12 text-center text-sm text-white/30">NO SEATS ON THIS FLOOR</p>
          )}
          <div className="mt-8">
            <SeatLegend />
          </div>
        </div>

        {/* Sticky booking panel */}
        <aside className="border-t border-white/10 bg-[#0a0a0a] md:border-t-0">
          <div className="sticky top-0 p-6 md:p-8">
            {pickedSeats.length > 0 ? (
              <div className="anim-fade-up space-y-5">
                {/* Selected seats */}
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
                  <p className="text-[10px] uppercase tracking-[0.3em] text-white/30">SEATS</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {pickedSeats.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => setSelectedIds((prev) => prev.filter((x) => x !== s.id))}
                        className="group flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-black text-white transition-colors hover:bg-white hover:text-black"
                      >
                        {s.number}
                        <span className="text-[10px] text-white/30 group-hover:text-black/50">✕</span>
                      </button>
                    ))}
                  </div>
                  <div className="mono mt-2 text-[10px] text-white/25">
                    {pickedSeats.map((s) => `${s.type.name}: ${s.type.pricePerHour.toLocaleString()}₮/h`).join(" · ")}
                  </div>
                </div>

                {/* Start time */}
                <div>
                  <p className="text-[10px] uppercase tracking-[0.3em] text-white/30">ЭХЛЭХ ЦАГ</p>
                  <div className="mt-2 grid grid-cols-4 gap-1">
                    {HOURS.map((h) => (
                      <button
                        key={h}
                        onClick={() => setStart(h)}
                        className={`mono rounded-lg py-2 text-[10px] transition-colors ${
                          start === h
                            ? "bg-white text-black"
                            : "border border-white/[0.08] text-white/50 hover:bg-white/10"
                        }`}
                      >
                        {h}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Hours */}
                <div>
                  <p className="text-[10px] uppercase tracking-[0.3em] text-white/30">ЦАГ</p>
                  <div className="mt-2 flex gap-1">
                    {[1, 2, 3, 4, 6, 8].map((h) => (
                      <button
                        key={h}
                        onClick={() => setHoursVal(h)}
                        className={`mono flex-1 rounded-lg py-2 text-xs transition-colors ${
                          hours === h
                            ? "bg-white text-black"
                            : "border border-white/[0.08] text-white/50 hover:bg-white/10"
                        }`}
                      >
                        {h}ц
                      </button>
                    ))}
                  </div>
                </div>

                {/* Payment */}
                <div>
                  <p className="text-[10px] uppercase tracking-[0.3em] text-white/30">ТӨЛБӨР</p>
                  <div className="mt-2 grid grid-cols-2 gap-1">
                    {(["QPAY", "BALANCE"] as const).map((m) => (
                      <button
                        key={m}
                        onClick={() => setMethod(m)}
                        className={`rounded-lg py-2 text-[10px] uppercase tracking-[0.3em] transition-colors ${
                          method === m
                            ? "bg-white text-black"
                            : "border border-white/[0.08] text-white/50 hover:bg-white/10"
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Total */}
                <div className="border-y border-white/10 py-4">
                  <div className="flex items-end justify-between">
                    <div>
                      <span className="text-[10px] uppercase tracking-[0.3em] text-white/30">TOTAL</span>
                      <div className="mono mt-1 text-[10px] text-white/25">
                        {pickedSeats.length} seat{pickedSeats.length > 1 ? "s" : ""} × {hours}ц
                      </div>
                    </div>
                    <div className="display mono text-4xl">{total.toLocaleString()}₮</div>
                  </div>
                </div>

                {error && (
                  <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-[10px] uppercase tracking-[0.3em] text-red-400">
                    {error}
                  </div>
                )}

                {/* Submit */}
                {!token ? (
                  <Link
                    href="/login"
                    className="block w-full rounded-xl bg-white py-4 text-center text-xs uppercase tracking-[0.3em] text-black hover:bg-white/90 transition-colors"
                  >
                    НЭВТЭРЧ ЗАХИАЛАХ →
                  </Link>
                ) : (
                  <button
                    onClick={confirmBooking}
                    disabled={!canSubmit}
                    className="btn-pop w-full rounded-xl bg-white py-4 text-xs uppercase tracking-[0.3em] text-black disabled:opacity-40 hover:bg-white/90 transition-colors"
                  >
                    {submitting
                      ? "PROCESSING..."
                      : !start
                      ? "ЦАГ СОНГОНО УУ"
                      : `ЗАХИАЛАХ · ${pickedSeats.length} СУУДАЛ →`}
                  </button>
                )}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-white/10 p-8 text-center">
                <p className="text-sm text-white/30">Суудал сонгоно уу</p>
                <p className="mono mt-2 text-[10px] text-white/20">TAP SEATS TO SELECT & BOOK</p>
              </div>
            )}
          </div>
        </aside>
      </section>

      {/* ─── DESCRIPTION (if long) ─── */}
      {center.description && center.description.length > 60 && (
        <section className="border-t border-white/10 bg-[#0a0a0a]">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr]">
            <div className="border-white/10 p-6 md:border-r md:p-12">
              <h2 className="display text-2xl text-white">ABOUT</h2>
            </div>
            <div className="p-6 md:p-12">
              <p className="max-w-2xl text-sm leading-relaxed text-white/50">{center.description}</p>
            </div>
          </div>
        </section>
      )}

      {/* ─── TOURNAMENTS ─── */}
      {tournaments.length > 0 && (
        <section className="border-t border-white/10 bg-[#0a0a0a]">
          <div className="flex items-center justify-between px-6 py-5 md:px-8">
            <h2 className="display text-2xl text-white md:text-4xl">TOURNAMENTS</h2>
            <span className="text-[10px] text-white/30">{tournaments.length} ТЭМЦЭЭН</span>
          </div>
          <div className="columns-1 gap-3 px-4 pb-4 md:columns-2 lg:columns-3">
            {tournaments.map((t, i) => {
              const isLive = t.status === "LIVE";
              const heightClass = isLive ? "min-h-[200px]" : t.prizePool > 0 ? "min-h-[180px]" : "min-h-[140px]";
              return (
                <Link
                  key={t.id}
                  href={`/centers/${params.id}/tournaments/${t.id}`}
                  className={`group mb-3 flex flex-col justify-between break-inside-avoid rounded-2xl border transition-colors ${heightClass} ${
                    isLive
                      ? "border-green-500/30 bg-green-500/[0.05] hover:bg-green-500/[0.08]"
                      : "border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.05]"
                  } p-5`}
                  style={{ animationDelay: `${i * 0.06}s` }}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2.5 py-0.5 text-[9px] uppercase tracking-widest ${
                        isLive
                          ? "bg-green-500/20 text-green-400 animate-pulse"
                          : t.status === "UPCOMING"
                          ? "bg-yellow-500/10 text-yellow-400"
                          : "bg-white/5 text-white/30"
                      }`}>
                        {t.status === "UPCOMING" ? "УДАХГҮЙ" : isLive ? "LIVE" : t.status}
                      </span>
                      <span className="mono text-[10px] text-white/25">{t.game}</span>
                    </div>
                    <h3 className="display mt-2 text-lg text-white">{t.name}</h3>
                    <div className="mono mt-2 flex flex-wrap gap-3 text-[10px] text-white/30">
                      <span>{new Date(t.startTime).toLocaleDateString("mn-MN")}</span>
                      <span>{t._count.teams}/{t.maxTeams} баг</span>
                      <span>{t.teamSize === 1 ? "Solo" : `${t.teamSize}v${t.teamSize}`}</span>
                    </div>
                  </div>
                  <div className="mt-3 flex items-end justify-between">
                    <div className="flex gap-3">
                      {t.entryFee > 0 && (
                        <span className="rounded-lg bg-white/5 px-2 py-1 text-[9px] text-white/40">{t.entryFee.toLocaleString()}₮ ENTRY</span>
                      )}
                      {t.prizePool > 0 && (
                        <span className="rounded-lg bg-yellow-500/10 px-2 py-1 text-[9px] text-yellow-400">{t.prizePool.toLocaleString()}₮ PRIZE</span>
                      )}
                    </div>
                    <span className="text-xs text-white/20 group-hover:text-white/50 transition-colors">→</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* ─── REVIEWS ─── */}
      <section className="border-t border-white/10 bg-[#0a0a0a]">
        <div className="flex items-center justify-between px-6 py-5 md:px-8">
          <h2 className="display text-2xl text-white md:text-4xl">REVIEWS</h2>
          {center && (
            <div className="flex items-center gap-3">
              <span className="mono text-sm text-white">{center.rating.toFixed(1)} ★</span>
              <span className="text-[10px] text-white/30">{reviews.length} REVIEWS</span>
            </div>
          )}
        </div>

        {/* Star rating widget — only for users with unreviewed completed bookings */}
        {myUnreviewedBookingId && !ratingSubmitted && (
          <div className="mx-4 mb-4 flex items-center gap-4 border border-white/10 bg-white/[0.03] px-5 py-4 md:mx-8">
            <span className="text-[10px] uppercase tracking-[0.2em] text-white/40 shrink-0">ҮНЭЛЭХ</span>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <button
                  key={s}
                  disabled={ratingPending}
                  onMouseEnter={() => setHoverStar(s)}
                  onMouseLeave={() => setHoverStar(0)}
                  onClick={async () => {
                    if (ratingPending) return;
                    setRatingPending(true);
                    try {
                      await apiFetch("/api/reviews", {
                        method: "POST", token,
                        body: JSON.stringify({ bookingId: myUnreviewedBookingId, rating: s }),
                      });
                      setRatingSubmitted(true);
                      setCenter((c) => c ? { ...c, rating: parseFloat(((c.rating * reviews.length + s) / (reviews.length + 1)).toFixed(2)) } : c);
                    } catch { /* ignore */ } finally {
                      setRatingPending(false);
                    }
                  }}
                  className={`text-2xl transition-colors ${s <= (hoverStar || 0) ? "text-yellow-400" : "text-white/15"}`}
                >
                  ★
                </button>
              ))}
            </div>
            <span className="text-[10px] text-white/25">Та энэ газрыг үнэлнэ үү</span>
          </div>
        )}
        {ratingSubmitted && (
          <div className="mx-4 mb-4 flex items-center gap-3 border border-white/10 bg-white/[0.03] px-5 py-4 md:mx-8">
            <span className="text-yellow-400 text-lg">★</span>
            <span className="text-[11px] text-white/40">Үнэлгээ илгээгдлээ. Баярлалаа!</span>
          </div>
        )}

        {reviews.length > 0 && (
          <div className="columns-1 gap-3 px-4 pb-6 md:columns-2 lg:columns-3">
            {reviews.slice(0, 12).map((r, i) => (
              <div
                key={r.id}
                className="anim-fade-up mb-3 break-inside-avoid border border-white/[0.06] bg-white/[0.03] p-4"
                style={{ animationDelay: `${i * 0.05}s` }}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-[10px] font-black text-white">
                    {r.user.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black text-white truncate">{r.user.name}</span>
                      <span className="mono text-[10px] text-yellow-400">{"★".repeat(r.rating)}<span className="text-white/15">{"★".repeat(5 - r.rating)}</span></span>
                    </div>
                    <span className="text-[9px] text-white/20">
                      {new Date(r.createdAt).toLocaleDateString("mn-MN")}
                    </span>
                  </div>
                </div>
                {r.ownerReply && (
                  <div className="mt-3 border-l-2 border-white/10 pl-3">
                    <span className="text-[9px] uppercase tracking-[0.2em] text-white/25">Эзний хариу</span>
                    <p className="mt-1 text-xs leading-relaxed text-white/35">{r.ownerReply}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ─── NO-SHOW WARNING MODAL ─── */}
      {showWarning && center && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4">
          <div className="w-full max-w-sm border border-white/10 bg-[#111] p-6">
            <p className="text-[9px] uppercase tracking-[0.3em] text-white/30 mb-3">АНХААРУУЛГА</p>
            <p className="text-sm text-white/70 leading-relaxed mb-2">
              Захиалга баталгаажсаны дараа та{" "}
              <span className="text-white font-bold">{center.noShowMinutes} минутын</span> дотор ирэх ёстой.
            </p>
            <p className="text-sm text-white/50 leading-relaxed mb-6">
              Хэрэв та заасан хугацаанд амжиж ирэхгүй тохиолдолд бид хариуцлага хүлээхгүй бөгөөд захиалга цуцлагдана.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowWarning(false)}
                className="flex-1 border border-white/10 py-3 text-[10px] uppercase tracking-[0.25em] text-white/30 hover:text-white transition-colors"
              >
                БУЦАХ
              </button>
              <button
                onClick={submitBooking}
                className="flex-1 bg-white py-3 text-[10px] uppercase tracking-[0.25em] text-black hover:bg-white/90 transition-colors"
              >
                ЗӨВШӨӨРЧ ЗАХИАЛАХ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── BOTTOM CTA ─── */}
      <section className="border-t border-white/10 bg-[#050505]">
        <div className="flex items-center justify-between px-6 py-8 md:px-12">
          <div>
            <span className="text-[10px] uppercase tracking-[0.3em] text-white/30">
              {center.district}
            </span>
            <div className="display mt-1 text-2xl text-white md:text-4xl">
              {center.name.toUpperCase()}
            </div>
          </div>
          {pickedSeats.length > 0 ? (
            <div className="flex items-center gap-4">
              <span className="mono text-sm text-white/40">
                {pickedSeats.length} seat · {total.toLocaleString()}₮
              </span>
              <button
                onClick={() => window.scrollTo({ top: document.getElementById("seats-section")?.offsetTop ?? 0, behavior: "smooth" })}
                className="btn-pop rounded-xl bg-white px-8 py-4 text-xs uppercase tracking-[0.3em] text-black hover:bg-white/90 transition-colors"
              >
                ЗАХИАЛАХ ↑
              </button>
            </div>
          ) : (
            <button
              onClick={() => window.scrollTo({ top: document.getElementById("seats-section")?.offsetTop ?? 0, behavior: "smooth" })}
              className="btn-pop rounded-xl border border-white/20 px-8 py-4 text-xs uppercase tracking-[0.3em] text-white hover:bg-white hover:text-black transition-colors"
            >
              СУУДАЛ СОНГОХ ↑
            </button>
          )}
        </div>
      </section>

      {/* ─── LIGHTBOX ─── */}
      {imgIdx !== null && allUrls.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95" onClick={() => setImgIdx(null)}>
          <button onClick={() => setImgIdx(null)} className="absolute right-6 top-6 z-10 text-xs uppercase tracking-[0.3em] text-white/70 hover:text-white">
            CLOSE ✕
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setImgIdx((p) => p !== null && p > 0 ? p - 1 : allUrls.length - 1); }}
            className="absolute left-4 z-10 flex h-12 w-12 items-center justify-center text-2xl text-white/60 hover:text-white md:left-8"
          >
            ←
          </button>
          <div className="relative h-[80vh] w-[90vw] max-w-5xl">
            <Image
              src={allUrls[imgIdx]}
              alt={`${center.name} ${imgIdx + 1}`}
              fill
              className="anim-scale-in object-contain"
              sizes="90vw"
            />
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); setImgIdx((p) => p !== null ? (p + 1) % allUrls.length : null); }}
            className="absolute right-4 z-10 flex h-12 w-12 items-center justify-center text-2xl text-white/60 hover:text-white md:right-8"
          >
            →
          </button>
          <div className="absolute bottom-6 flex items-center gap-2">
            {allUrls.map((_, i) => (
              <button
                key={i}
                onClick={(e) => { e.stopPropagation(); setImgIdx(i); }}
                className={`h-1.5 rounded-full transition-all ${imgIdx === i ? "w-6 bg-white" : "w-1.5 bg-white/20 hover:bg-white/50"}`}
              />
            ))}
          </div>
        </div>
      )}
    </main>
  );
}

function GalleryStrip({
  images,
  centerName,
  onClickImage,
}: {
  images: CenterImage[] | string[];
  centerName: string;
  onClickImage: (i: number) => void;
}) {
  const [activeTab, setActiveTab] = useState<ImageTag | "all">("all");
  const allUrls = getImagesByTag(images);

  // Determine available tags
  const isLegacy = allUrls.length > 0 && (typeof (images as any)[0] === "string");
  const typed = isLegacy ? [] : (images as CenterImage[]);
  const tagCounts = IMAGE_TAGS.map((t) => ({
    ...t,
    count: typed.filter((img) => img.tag === t.value).length,
  })).filter((t) => t.count > 0);

  const filtered = activeTab === "all"
    ? allUrls
    : getImagesByTag(images, activeTab);

  return (
    <section className="border-b border-white/[0.04] p-4 md:p-6">
      {/* Tag tabs */}
      {tagCounts.length > 1 && (
        <div className="mb-4 flex gap-2">
          <button
            onClick={() => setActiveTab("all")}
            className={`rounded-full px-3 py-1 text-[9px] uppercase tracking-[0.2em] transition-all ${
              activeTab === "all" ? "bg-white/[0.08] text-white" : "text-white/25 hover:text-white/40"
            }`}
          >
            ALL ({allUrls.length})
          </button>
          {tagCounts.map((t) => (
            <button
              key={t.value}
              onClick={() => setActiveTab(t.value)}
              className={`rounded-full px-3 py-1 text-[9px] uppercase tracking-[0.2em] transition-all ${
                activeTab === t.value ? "bg-white/[0.08] text-white" : "text-white/25 hover:text-white/40"
              }`}
            >
              {t.label} ({t.count})
            </button>
          ))}
        </div>
      )}

      {/* Scrollable strip */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {filtered.map((url, i) => {
          const realIdx = allUrls.indexOf(url);
          return (
            <button
              key={i}
              onClick={() => onClickImage(realIdx >= 0 ? realIdx : i)}
              className="relative aspect-[3/2] h-28 flex-shrink-0 overflow-hidden rounded-xl transition-transform duration-300 hover:scale-[1.02] md:h-36"
            >
              <Image
                src={url}
                alt={`${centerName} ${i + 1}`}
                fill
                className="object-cover"
                sizes="200px"
              />
            </button>
          );
        })}
      </div>
    </section>
  );
}
