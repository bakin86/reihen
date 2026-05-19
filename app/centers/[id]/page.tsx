"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";
import { SeatCell, SeatLegend, type SeatStatus } from "@/components/SeatCell";
import { useSeatSocket, type SeatUpdate } from "@/lib/useSeatSocket";
import { useAuth } from "@/lib/useAuth";
import { useCountdown } from "@/lib/useCountdown";
import { apiFetch } from "@/lib/api";
import { getMainImage, getImagesByTag, IMAGE_TAGS, type CenterImage, type ImageTag } from "@/lib/image-types";

const Confetti = dynamic(() => import("@/components/Confetti").then((m) => m.Confetti), { ssr: false });

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
  lat: number | null;
  lng: number | null;
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
  const [recentlyUpdatedSeats, setRecentlyUpdatedSeats] = useState<Set<string>>(new Set());

  // Star rating + comment
  const [myUnreviewedBookingId, setMyUnreviewedBookingId] = useState<string | null>(null);
  const [hoverStar, setHoverStar] = useState(0);
  const [selectedRating, setSelectedRating] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [ratingPending, setRatingPending] = useState(false);
  const [ratingError, setRatingError] = useState("");

  // Multi-seat selection + booking
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [start, setStart] = useState<string | null>(null);
  const [hours, setHoursVal] = useState(1);
  const [method, setMethod] = useState<"QPAY" | "BALANCE">("QPAY");
  const [qpaySurchargePct, setQpaySurchargePct] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [error, setError] = useState("");
  const [bookingCode, setBookingCode] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  // QPay payment pending state
  const [qpayPending, setQpayPending] = useState<{
    bookingId: string;
    code: string;
    qrImage?: string;
    shortUrl?: string;
    deeplinks?: { name: string; link: string }[];
    invoiceId?: string;
  } | null>(null);

  const loadCenterSeats = useCallback((isInitial = false) => {
    apiFetch<{ center: CenterInfo; seats: SeatData[]; qpaySurchargePct: number }>(`/api/centers/${params.id}/seats`)
      .then(({ center: c, seats: s, qpaySurchargePct: pct }) => {
        setCenter(c);
        setSeats(s);
        setQpaySurchargePct(pct ?? 1);
        setLoadFailed(false);
        if (s.length) setFloor(s[0].floor.floorNumber);
      })
      .catch(() => { if (isInitial) setLoadFailed(true); });
  }, [params.id]);

  useEffect(() => {
    loadCenterSeats(true);
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
      apiFetch<{ favorited: boolean }>(`/api/favorites/${params.id}`, { token })
        .then(({ favorited }) => setIsFav(favorited))
        .catch(() => {});
    }
  }, [params.id, token, loadCenterSeats]);

  useEffect(() => {
    const interval = setInterval(loadCenterSeats, 4_000);
    return () => clearInterval(interval);
  }, [loadCenterSeats]);

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
      setRecentlyUpdatedSeats((prev) => new Set(prev).add(u.id));
      window.setTimeout(() => {
        setRecentlyUpdatedSeats((prev) => {
          const next = new Set(prev);
          next.delete(u.id);
          return next;
        });
      }, 950);
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
  const baseTotal = pickedSeats.reduce((sum, s) => sum + s.type.pricePerHour * hours, 0);
  const surcharge = method === "QPAY" ? Math.round(baseTotal * qpaySurchargePct / 100) : 0;
  const total = baseTotal + surcharge;
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

  const submitReview = async () => {
    if (!myUnreviewedBookingId || ratingPending || selectedRating === 0) return;
    setRatingPending(true);
    setRatingError("");
    try {
      await apiFetch("/api/reviews", {
        method: "POST",
        token,
        body: JSON.stringify({
          bookingId: myUnreviewedBookingId,
          rating: selectedRating,
          ...(reviewComment.trim() ? { comment: reviewComment.trim() } : {}),
        }),
      });
      setRatingSubmitted(true);
      setMyUnreviewedBookingId(null);
      setReviewComment("");
      setCenter((c) =>
        c ? { ...c, reviewCount: c.reviewCount + 1, rating: parseFloat(((c.rating * reviews.length + selectedRating) / (reviews.length + 1)).toFixed(2)) } : c
      );
    } catch (err: any) {
      setRatingError(err.message ?? "Үнэлгээ илгээж чадсангүй");
    } finally {
      setRatingPending(false);
    }
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

  // Error state
  if (loadFailed && !center) {
    return (
      <main className="ui-page-dark flex min-h-screen flex-col items-center justify-center gap-6 text-white">
        <Link href="/" className="text-[10px] uppercase tracking-[0.3em] text-white/30 hover:text-white transition-colors">← HOME</Link>
        <p className="display text-3xl text-white/60">CENTER NOT FOUND</p>
        <button
          onClick={() => { setLoadFailed(false); loadCenterSeats(true); }}
          className="border border-white/20 px-6 py-2.5 text-[10px] uppercase tracking-[0.3em] text-white/50 hover:border-white/40 hover:text-white transition-colors"
        >
          RETRY
        </button>
      </main>
    );
  }

  // Loading state
  if (!center) {
    return (
      <main className="ui-page-dark flex min-h-screen items-center justify-center text-white">
        <div className="space-y-3 text-center">
          <div className="display text-2xl animate-pulse text-white/70">LOADING...</div>
          <div className="h-px w-24 mx-auto bg-white/10 overflow-hidden">
            <div className="h-full w-1/2 bg-white/40 animate-[ticker_1s_linear_infinite]" />
          </div>
        </div>
      </main>
    );
  }

  // QPay payment pending — show QR + deeplinks
  if (qpayPending && center) {
    return (
      <main className="ui-page-dark flex min-h-screen flex-col items-center justify-center p-6 text-white">
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
          className="anim-fade-up anim-d3 ui-button ui-button-primary mt-8 w-full max-w-sm"
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
      <main className="ui-page-dark flex min-h-screen flex-col items-center justify-center p-10 text-white">
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
            className="ui-button border border-white/20 text-white hover:bg-white hover:text-black"
          >
            HOME
          </Link>
          <button
            onClick={() => { setBookingCode(null); setSelectedIds([]); setStart(null); setError(""); }}
            className="ui-button ui-button-primary"
          >
            ДАХИН ЗАХИАЛАХ
          </button>
        </div>
      </main>
    );
  }

  const heroImg = getMainImage(center.images);
  const allUrls = getImagesByTag(center.images);
  const occupancyPct = seats.length > 0 ? Math.round(((seats.length - openCount) / seats.length) * 100) : 0;
  const hasLayout = seats.some((s) => s.posX !== null && s.posY !== null);
  const primarySeatTypes = center.seatTypes.slice(0, 3).map((t) => t.name).join(" / ");
  const mapSrc = center.lat != null && center.lng != null ? getOsmEmbedUrl(center.lat, center.lng, 16) : null;

  return (
    <main className="ui-page-dark text-white">
      {/* ─── HERO: Full-width image with overlay ─── */}
      <section className="relative h-[78vh] min-h-[560px] overflow-hidden bg-black">
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
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-black/10" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_18%,rgba(74,222,128,0.18),transparent_34%)]" />

        {/* Nav overlay */}
        <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-6 py-5 md:px-12">
          <Link href="/" className="ui-button border border-white/10 bg-black/30 text-white/60 hover:border-white/30 hover:text-white">
            ← HOME
          </Link>
          <div className="flex items-center gap-4">
            {user && (
              <button
                onClick={toggleFav}
                title={isFav ? "Дуртайгаас хасах" : "Дуртайд нэмэх"}
                className={`flex h-10 w-10 items-center justify-center rounded-lg border text-sm transition-all duration-300 ${
                  isFav
                    ? "border-white/40 bg-white/10 text-white"
                    : "border-white/20 bg-black/30 text-white/60 hover:border-white/40 hover:text-white"
                }`}
              >
                {isFav ? "♥" : "♡"}
              </button>
            )}
            <button
              onClick={copyLink}
              className="ui-button border border-white/10 bg-black/30 text-white/60 hover:border-white/30 hover:text-white"
            >
              {copied ? "COPIED!" : "SHARE"}
            </button>
            <button
              type="button"
              onClick={() => window.scrollTo({ top: document.getElementById("seats-section")?.offsetTop ?? 0, behavior: "smooth" })}
              className="ui-button border border-white bg-white text-black hover:border-green-400 hover:bg-green-400"
            >
              BOOK →
            </button>
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

          <h1
            className="anim-hero anim-d1 mt-3 font-black text-white"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(48px, 10vw, 160px)",
              lineHeight: 0.85,
              letterSpacing: "-0.05em",
              fontWeight: 900,
            }}
          >
            {center.name.toUpperCase()}
          </h1>

          <div className="anim-fade-up anim-d3 mt-4 flex flex-wrap items-center gap-4">
            <span className="ui-kbd mono text-sm text-white/80">{center.address}</span>
            <span className="ui-kbd mono text-sm text-green-300">{openCount}/{seats.length} open</span>
            {minPrice !== null && <span className="ui-kbd mono text-sm text-white/70">from {minPrice.toLocaleString()}₮/цаг</span>}
            {center.description && (
              <span className="hidden max-w-sm text-sm text-white/50 md:block">{center.description}</span>
            )}
          </div>
        </div>
      </section>

      {/* ─── STATS BAR ─── */}
      <section className="relative grid grid-cols-2 border-b border-white/10 bg-[#0d0d0d] md:grid-cols-4">
        {[
          { n: String(seats.length), l: "СУУДАЛ", green: false },
          { n: String(openCount), l: "СУЛ", green: openCount > 0 },
          { n: minPrice !== null ? `${minPrice.toLocaleString()}₮` : "—", l: "НЭГ ЦАГ", green: false },
          { n: `${occupancyPct}%`, l: "АШИГЛАЛТ", green: occupancyPct < 75 },
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

      <section className="border-b border-white/10 bg-[#090909] px-4 py-4 md:px-8">
        <div className="grid gap-3 md:grid-cols-4">
          {[
            { label: "LIVE SYNC", value: "Staff update", detail: "Суудлын төлөв staff dashboard-аас шинэчлэгдэнэ." },
            { label: "CONFLICT SAFE", value: "Backend check", detail: "Захиалах мөчид давхар цагийг дахин шалгана." },
            { label: "LAYOUT", value: hasLayout ? "Mapped" : "Grid", detail: hasLayout ? "Owner layout editor-оор байрлал тааруулсан." : "Автомат grid харагдац ашиглаж байна." },
            { label: "SETUP", value: primarySeatTypes || "PC seats", detail: "Seat type бүр өөр үнэтэй байж болно." },
          ].map((item, index) => (
            <div key={item.label} className="anim-card ui-panel-dark p-4" style={{ animationDelay: `${index * 0.06}s` }}>
              <div className="text-[8px] uppercase tracking-[0.26em] text-white/25">{item.label}</div>
              <div className="mt-2 text-sm font-black text-white">{item.value}</div>
              <p className="mt-2 text-xs leading-relaxed text-white/35">{item.detail}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── GALLERY STRIP with tag tabs ─── */}
      {allUrls.length > 1 && (
        <GalleryStrip images={center.images} centerName={center.name} onClickImage={(i: number) => setImgIdx(i)} />
      )}

      {/* ─── SEAT TYPES PRICING ─── */}
      {mapSrc && center.lat != null && center.lng != null && (
        <section className="border-b border-white/10 bg-[#0a0a0a]">
          <div className="grid grid-cols-1 md:grid-cols-[360px_1fr]">
            <div className="border-white/10 p-6 md:border-r md:p-8">
              <p className="text-[9px] uppercase tracking-[0.28em] text-white/25">Location</p>
              <h2 className="display mt-3 text-3xl text-white">MAP</h2>
              <p className="mt-4 text-sm leading-relaxed text-white/45">{center.address}</p>
              <a
                href={getGoogleMapsUrl(center.lat, center.lng)}
                target="_blank"
                rel="noreferrer"
                className="mt-6 inline-flex rounded-full border border-white/15 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/55 transition-colors hover:border-white hover:text-white"
              >
                Open in Google Maps
              </a>
            </div>
            <div className="relative h-[340px] overflow-hidden bg-white/[0.03] md:h-[420px]">
              <iframe
                title={`${center.name} map`}
                src={mapSrc}
                className="absolute inset-0 h-full w-full border-0 grayscale"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </div>
        </section>
      )}

      {center.seatTypes.length > 0 && (
        <section className="anim-fade-up border-b border-white/10 bg-[#0d0d0d] p-4 md:p-6">
          <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {center.seatTypes.map((t, i) => (
              <div
                key={t.id}
                className={`anim-fade-up ui-panel-dark p-5 text-center md:p-6 ${i === 0 ? "md:row-span-2 flex flex-col justify-center" : ""}`}
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
          <div className="mb-5 grid gap-3 md:grid-cols-3">
            <div className="ui-panel-dark p-4">
              <div className="text-[8px] uppercase tracking-[0.25em] text-white/25">STEP 01</div>
              <div className="mt-1 text-sm font-black text-white">Суудал сонго</div>
            </div>
            <div className="ui-panel-dark p-4">
              <div className="text-[8px] uppercase tracking-[0.25em] text-white/25">STEP 02</div>
              <div className="mt-1 text-sm font-black text-white">Цагаа тохируул</div>
            </div>
            <div className="ui-panel-dark p-4">
              <div className="text-[8px] uppercase tracking-[0.25em] text-white/25">STEP 03</div>
              <div className="mt-1 text-sm font-black text-white">Backend дахин шалгана</div>
            </div>
          </div>

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
                className="w-full overflow-x-auto border border-white/5 bg-black/30 p-4"
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
            <div className="grid grid-cols-4 gap-2 border border-white/5 bg-black/30 p-4 md:grid-cols-8 lg:grid-cols-10">
              {view.map((s) => (
                <SeatCell
                  key={s.id}
                  number={s.number}
                  status={s.status}
                  freeAt={s.freeAt}
                  selected={selectedIds.includes(s.id)}
                  recentlyUpdated={recentlyUpdatedSeats.has(s.id)}
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
          <div className="sticky top-24 p-6 md:p-8">
            {pickedSeats.length > 0 ? (
              <div className="anim-fade-up ui-panel-dark space-y-5 p-5">
                {/* Selected seats */}
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-4">
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
                        className={`mono py-2 text-[10px] transition-colors ${
                          start === h
                            ? "rounded-lg bg-white text-black"
                            : "rounded-lg border border-white/[0.08] text-white/50 hover:bg-white/10"
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
                        className={`mono flex-1 py-2 text-xs transition-colors ${
                          hours === h
                            ? "rounded-lg bg-white text-black"
                            : "rounded-lg border border-white/[0.08] text-white/50 hover:bg-white/10"
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
                    <button
                      onClick={() => setMethod("QPAY")}
                      className={`py-2 text-[10px] uppercase tracking-[0.3em] transition-colors ${
                        method === "QPAY"
                          ? "rounded-lg bg-white text-black"
                          : "rounded-lg border border-white/[0.08] text-white/50 hover:bg-white/10"
                      }`}
                    >
                      QPAY +{qpaySurchargePct}%
                    </button>
                    <button
                      onClick={() => setMethod("BALANCE")}
                      className={`py-2 text-[10px] uppercase tracking-[0.3em] transition-colors ${
                        method === "BALANCE"
                          ? "rounded-lg bg-white text-black"
                          : "rounded-lg border border-white/[0.08] text-white/50 hover:bg-white/10"
                      }`}
                    >
                      ҮЛДЭГДЭЛ
                    </button>
                  </div>
                  {method === "QPAY" && surcharge > 0 && (
                    <p className="mt-1.5 text-[9px] text-white/30">
                      +{surcharge.toLocaleString()}₮ QPay шимтгэл · Үлдэгдлээр төлбөл хямд
                    </p>
                  )}
                </div>

                {/* Total */}
                <div className="border-y border-white/10 py-4">
                  <div className="flex items-end justify-between">
                    <div>
                      <span className="text-[10px] uppercase tracking-[0.3em] text-white/30">TOTAL</span>
                      <div className="mono mt-1 text-[10px] text-white/25">
                        {pickedSeats.length} seat{pickedSeats.length > 1 ? "s" : ""} × {hours}ц
                        {surcharge > 0 && ` · +${surcharge.toLocaleString()}₮ шимтгэл`}
                      </div>
                    </div>
                    <div className="display mono text-4xl">{total.toLocaleString()}₮</div>
                  </div>
                </div>

                {error && (
                  <div className="border border-red-500/20 bg-red-500/10 p-3 text-[10px] uppercase tracking-[0.3em] text-red-400">
                    {error}
                  </div>
                )}

                {/* Submit */}
                {!token ? (
                  <Link
                    href="/login"
                    className="ui-button ui-button-primary w-full"
                  >
                    НЭВТЭРЧ ЗАХИАЛАХ →
                  </Link>
                ) : (
                  <button
                    onClick={confirmBooking}
                    disabled={!canSubmit}
                    className="ui-button ui-button-primary w-full disabled:opacity-40"
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
              <div className="ui-panel-dark border-dashed p-8 text-center">
                <p className="text-sm text-white/45">Суудал сонгоно уу</p>
                <p className="mono mt-2 text-[10px] text-white/20">TAP SEATS TO SELECT & BOOK</p>
                <p className="mt-4 text-xs leading-relaxed text-white/30">
                  Суудал сонгоод эхлэх цаг, хугацаа, төлбөрийн аргаа тохируулна.
                </p>
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
                  className={`group mb-3 flex flex-col justify-between break-inside-avoid border transition-colors ${heightClass} ${
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

        {/* Review widget — only for users with unreviewed completed bookings */}
        {myUnreviewedBookingId && !ratingSubmitted && (
          <div className="mx-4 mb-4 rounded-2xl border border-yellow-400/20 bg-yellow-400/[0.06] px-5 py-5 md:mx-8">
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-yellow-200/70 mb-3">Үнэлгээ өгөх</div>
            <div className="flex items-center gap-1 mb-4" aria-label="Star rating">
              {[1, 2, 3, 4, 5].map((s) => {
                const active = s <= (hoverStar || selectedRating);
                return (
                  <button
                    key={s}
                    type="button"
                    disabled={ratingPending}
                    onMouseEnter={() => setHoverStar(s)}
                    onMouseLeave={() => setHoverStar(0)}
                    onFocus={() => setHoverStar(s)}
                    onBlur={() => setHoverStar(0)}
                    onClick={() => setSelectedRating(s)}
                    aria-label={`${s} од өгөх`}
                    className={`flex h-11 w-11 items-center justify-center rounded-xl text-3xl transition-all duration-200 disabled:cursor-wait disabled:opacity-55 ${
                      active
                        ? "bg-yellow-400/12 text-yellow-300 shadow-[0_0_24px_rgba(250,204,21,0.10)]"
                        : "text-white/18 hover:bg-white/[0.05] hover:text-yellow-300/70"
                    }`}
                  >
                    ★
                  </button>
                );
              })}
            </div>
            <textarea
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value)}
              disabled={ratingPending}
              maxLength={500}
              placeholder="Сэтгэгдэл бичнэ үү... (заавал биш)"
              rows={3}
              className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/80 placeholder-white/25 outline-none focus:border-yellow-400/30 focus:ring-0 disabled:opacity-50 mb-3"
            />
            <div className="flex items-center justify-between gap-3">
              {ratingError ? (
                <span className="text-[10px] uppercase tracking-[0.18em] text-red-300">{ratingError}</span>
              ) : (
                <span className="text-[10px] text-white/30">{reviewComment.length}/500</span>
              )}
              <button
                type="button"
                onClick={submitReview}
                disabled={ratingPending || selectedRating === 0}
                className="rounded-xl bg-yellow-400/15 px-5 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-yellow-300 transition-all hover:bg-yellow-400/25 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {ratingPending ? "Илгээж байна..." : "Илгээх"}
              </button>
            </div>
          </div>
        )}
        {ratingSubmitted && (
          <div className="mx-4 mb-4 flex items-center gap-3 rounded-2xl border border-yellow-400/20 bg-yellow-400/[0.06] px-5 py-4 md:mx-8">
            <span className="text-yellow-400 text-lg">★</span>
            <span className="text-[11px] text-white/55">Үнэлгээ илгээгдлээ. Баярлалаа!</span>
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
          <div className="ui-panel-dark w-full max-w-md p-6">
            <p className="mb-3 text-[9px] uppercase tracking-[0.3em] text-yellow-300/70">АНХААРУУЛГА</p>
            <p className="text-sm text-white/70 leading-relaxed mb-2">
              Захиалга баталгаажсаны дараа та{" "}
              <span className="text-white font-bold">{center.noShowMinutes} минутын</span> дотор ирэх ёстой.
            </p>
            <p className="text-sm text-white/50 leading-relaxed mb-4">
              Хэрэв та заасан хугацаанд амжиж ирэхгүй тохиолдолд бид хариуцлага хүлээхгүй бөгөөд захиалга цуцлагдана.
            </p>
            <div className="mb-6 rounded-lg border border-white/[0.08] bg-white/[0.03] px-4 py-3">
              <p className="text-[10px] text-white/30 leading-relaxed">
                Таны төлбөрийн <span className="text-white/60 font-semibold">50%</span> нь тухайн PC центрт шилжихийг анхаарна уу.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowWarning(false)}
                className="ui-button flex-1 border border-white/10 text-white/40 hover:text-white"
              >
                БУЦАХ
              </button>
              <button
                onClick={submitBooking}
                className="ui-button ui-button-primary flex-1"
              >
                ЗӨВШӨӨРЧ ЗАХИАЛАХ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── BOTTOM CTA ─── */}
      <section className="sticky bottom-0 z-30 border-t border-white/10 bg-black/80 backdrop-blur-xl">
        <div className="flex flex-col gap-4 px-6 py-4 md:flex-row md:items-center md:justify-between md:px-12">
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
              <span className="mono text-sm text-white/50">
                {pickedSeats.length} seat · {total.toLocaleString()}₮
              </span>
              <button
                onClick={() => window.scrollTo({ top: document.getElementById("seats-section")?.offsetTop ?? 0, behavior: "smooth" })}
                className="ui-button ui-button-primary"
              >
                ЗАХИАЛАХ ↑
              </button>
            </div>
          ) : (
            <button
              onClick={() => window.scrollTo({ top: document.getElementById("seats-section")?.offsetTop ?? 0, behavior: "smooth" })}
              className="ui-button border border-white/20 text-white hover:bg-white hover:text-black"
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

function getOsmEmbedUrl(lat: number, lng: number, zoom: number) {
  const delta = zoom >= 16 ? 0.006 : 0.018;
  const bbox = [
    lng - delta,
    lat - delta,
    lng + delta,
    lat + delta,
  ].map((value) => value.toFixed(6)).join("%2C");
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat.toFixed(6)}%2C${lng.toFixed(6)}`;
}

function getGoogleMapsUrl(lat: number, lng: number) {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
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
            className={`px-3 py-1 text-[9px] uppercase tracking-[0.2em] transition-all ${
              activeTab === "all" ? "bg-white/[0.08] text-white" : "text-white/25 hover:text-white/40"
            }`}
          >
            ALL ({allUrls.length})
          </button>
          {tagCounts.map((t) => (
            <button
              key={t.value}
              onClick={() => setActiveTab(t.value)}
              className={`px-3 py-1 text-[9px] uppercase tracking-[0.2em] transition-all ${
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
              className="relative aspect-[3/2] h-28 flex-shrink-0 overflow-hidden transition-transform duration-300 hover:scale-[1.02] md:h-36"
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
