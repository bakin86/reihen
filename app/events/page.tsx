"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { NavBar } from "@/components/NavBar";
import { apiFetch } from "@/lib/api";

type EventStatus = "UPCOMING" | "REGISTRATION_CLOSED" | "LIVE" | "COMPLETED" | "CANCELLED";

interface EventItem {
  id: string;
  name: string;
  description: string | null;
  game: string;
  startTime: string;
  endTime: string | null;
  maxTeams: number;
  teamSize: number;
  entryFee: number;
  prizePool: number;
  prizeDescription: string | null;
  status: EventStatus;
  center: {
    id: string;
    name: string;
    district: string;
    address: string;
  };
  _count: { teams: number };
}

const STATUS_LABEL: Record<EventStatus, string> = {
  UPCOMING: "БҮРТГЭЛ НЭЭЛТТЭЙ",
  REGISTRATION_CLOSED: "БҮРТГЭЛ ХААГДСАН",
  LIVE: "ЯГ ОДОО",
  COMPLETED: "ДУУССАН",
  CANCELLED: "ЦУЦЛАГДСАН",
};

const FILTERS = ["ALL", "LIVE", "UPCOMING", "REGISTRATION_CLOSED"] as const;
type Filter = (typeof FILTERS)[number];

export default function EventsPage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("ALL");

  useEffect(() => {
    apiFetch<{ events: EventItem[] }>("/api/events")
      .then((data) => setEvents(data.events))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (filter === "ALL") return events;
    return events.filter((event) => event.status === filter);
  }, [events, filter]);

  const liveCount = events.filter((event) => event.status === "LIVE").length;
  const openCount = events.filter((event) => event.status === "UPCOMING").length;
  const totalPrize = events.reduce((sum, event) => sum + event.prizePool, 0);

  return (
    <main className="ui-page-dark text-white">
      <NavBar dark />

      <section className="relative overflow-hidden border-b border-white/10 px-6 pb-10 pt-32 md:px-12 md:pb-14">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.2em] text-white/30 transition-colors hover:text-white/70"
        >
          ← Нүүр
        </Link>
        <div className="pointer-events-none absolute inset-x-6 top-24 h-px bg-white/10 md:inset-x-12" />
        <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="display text-5xl leading-none md:text-8xl">EVENTS</h1>
            <p className="mt-5 max-w-2xl text-sm leading-relaxed text-white/45">
              PC center-үүдийн тэмцээн, event, live registration-уудыг нэг дороос харж бүртгүүлнэ.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 md:min-w-[380px]">
            <Stat label="LIVE" value={liveCount.toString()} tone="green" />
            <Stat label="OPEN" value={openCount.toString()} tone="white" />
            <Stat label="PRIZE" value={`${totalPrize.toLocaleString()}₮`} tone="yellow" />
          </div>
        </div>
      </section>

      <section className="border-b border-white/10 px-4 py-4 md:px-8">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((item) => (
            <button
              key={item}
              onClick={() => setFilter(item)}
              className={`rounded-lg border px-4 py-2 text-[10px] uppercase tracking-[0.18em] transition-colors ${
                filter === item
                  ? "border-white bg-white text-black"
                  : "border-white/[0.12] bg-white/[0.06] text-white/55 hover:border-white/30 hover:bg-white/[0.10] hover:text-white"
              }`}
            >
              {item === "ALL" ? "БҮГД" : STATUS_LABEL[item]}
            </button>
          ))}
        </div>
      </section>

      <section className="px-4 py-6 md:px-8">
        {loading ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-64 animate-pulse rounded-lg border border-white/5 bg-white/[0.03]" />
            ))}
          </div>
        ) : filtered.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((event, index) => (
              <EventCard key={event.id} event={event} index={index} />
            ))}
          </div>
        ) : (
          <div className="flex min-h-[320px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 text-center">
            <h2 className="display text-3xl">EVENT АЛГА</h2>
            <p className="mt-2 max-w-md text-sm text-white/35">
              Одоогоор энэ filter дээр event байхгүй байна. Owner dashboard-оос тэмцээн үүсгэж болно.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: "green" | "yellow" | "white" }) {
  const color = tone === "green" ? "text-green-400" : tone === "yellow" ? "text-yellow-400" : "text-white";
  return (
    <div className="ui-panel-dark p-4">
      <div className={`display truncate text-2xl ${color}`}>{value}</div>
      <div className="mt-1 text-[9px] uppercase tracking-[0.25em] text-white/25">{label}</div>
    </div>
  );
}

function EventCard({ event, index }: { event: EventItem; index: number }) {
  const isLive = event.status === "LIVE";
  const isFull = event._count.teams >= event.maxTeams;
  const slotsLeft = Math.max(0, event.maxTeams - event._count.teams);
  const date = new Date(event.startTime);

  return (
    <Link
      href={`/centers/${event.center.id}/tournaments/${event.id}`}
      className={`anim-card ui-panel-dark group flex min-h-[280px] flex-col justify-between p-5 transition-all duration-300 hover:-translate-y-1 ${
        isLive
          ? "border-green-500/30 bg-green-500/[0.05] shadow-[0_0_32px_rgba(34,197,94,0.06)]"
          : "hover:border-white/15 hover:bg-white/[0.04]"
      }`}
      style={{ animationDelay: `${index * 0.04}s` }}
    >
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <span
              className={`rounded-full px-2.5 py-1 text-[9px] uppercase tracking-widest ${
                isLive
                  ? "bg-green-500/20 text-green-300"
                  : event.status === "UPCOMING"
                  ? "bg-yellow-500/10 text-yellow-300"
                  : "bg-white/5 text-white/35"
              }`}
            >
              {STATUS_LABEL[event.status]}
            </span>
            <span className="rounded-full bg-white/5 px-2.5 py-1 text-[9px] uppercase tracking-widest text-white/35">
              {event.game}
            </span>
          </div>
          <span className="text-xl text-white/15 transition-colors group-hover:text-white/60">→</span>
        </div>

        <h2 className="display mt-5 text-3xl leading-tight text-white">{event.name}</h2>
        <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-white/40">
          {event.description || `${event.center.name} дээр зохион байгуулагдах ${event.game} event.`}
        </p>
      </div>

      <div>
        <div className="mt-8 grid grid-cols-2 gap-2 text-xs">
          <Info label="CENTER" value={event.center.name} />
          <Info label="DATE" value={date.toLocaleDateString("mn-MN", { month: "short", day: "numeric" })} />
          <Info label="TIME" value={date.toLocaleTimeString("mn-MN", { hour: "2-digit", minute: "2-digit" })} />
          <Info label="TEAMS" value={`${event._count.teams}/${event.maxTeams}`} />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="rounded-lg bg-white/5 px-2.5 py-1.5 text-[10px] text-white/45">
            {event.teamSize === 1 ? "SOLO" : `${event.teamSize}v${event.teamSize}`}
          </span>
          <span className="rounded-lg bg-white/5 px-2.5 py-1.5 text-[10px] text-white/45">
            {event.entryFee > 0 ? `${event.entryFee.toLocaleString()}₮ ENTRY` : "FREE ENTRY"}
          </span>
          {event.prizePool > 0 && (
            <span className="rounded-lg bg-yellow-500/10 px-2.5 py-1.5 text-[10px] text-yellow-300">
              {event.prizePool.toLocaleString()}₮ PRIZE
            </span>
          )}
        </div>

        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            className={`h-full rounded-full ${isFull ? "bg-red-400" : "bg-green-400"}`}
            style={{ width: `${Math.min(100, (event._count.teams / event.maxTeams) * 100)}%` }}
          />
        </div>
        <div className="mt-2 text-[10px] uppercase tracking-widest text-white/25">
          {isFull ? "БҮРТГЭЛ ДҮҮРСЭН" : `${slotsLeft} slot үлдсэн`}
        </div>
      </div>
    </Link>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/5 bg-black/25 p-3">
      <div className="text-[8px] uppercase tracking-[0.22em] text-white/20">{label}</div>
      <div className="mt-1 truncate text-sm text-white/70">{value}</div>
    </div>
  );
}
