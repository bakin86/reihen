"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/useAuth";
import { apiFetch, ApiError } from "@/lib/api";
import { ImageUpload } from "@/components/ImageUpload";
import type { CenterImage } from "@/lib/image-types";

interface FloorInput {
  floorNumber: number;
  name: string;
}

interface SeatTypeInput {
  name: string;
  pricePerHour: number;
  description: string;
}

const DISTRICTS = [
  "Баянгол",
  "Баянзүрх",
  "Сүхбаатар",
  "Хан-Уул",
  "Чингэлтэй",
  "Сонгинохайрхан",
];

export default function NewCenterPage() {
  const { user, token, loading: authLoading } = useAuth();
  const router = useRouter();

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [district, setDistrict] = useState(DISTRICTS[0]);
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<CenterImage[]>([]);

  const [floors, setFloors] = useState<FloorInput[]>([{ floorNumber: 1, name: "1-р давхар" }]);
  const [seatTypes, setSeatTypes] = useState<SeatTypeInput[]>([
    { name: "Standard", pricePerHour: 3500, description: "" },
  ]);

  const [cancelMinutes, setCancelMinutes] = useState(30);
  const [noShowMinutes, setNoShowMinutes] = useState(60);
  const [refundPolicy, setRefundPolicy] = useState<"FULL" | "PARTIAL" | "NONE">("FULL");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Floor helpers
  const addFloor = () =>
    setFloors((f) => [...f, { floorNumber: f.length + 1, name: `${f.length + 1}-р давхар` }]);
  const removeFloor = (i: number) =>
    setFloors((f) => f.filter((_, idx) => idx !== i).map((fl, idx) => ({ ...fl, floorNumber: idx + 1 })));
  const updateFloor = (i: number, key: keyof FloorInput, val: string | number) =>
    setFloors((f) => f.map((fl, idx) => (idx === i ? { ...fl, [key]: val } : fl)));

  // SeatType helpers
  const addType = () =>
    setSeatTypes((t) => [...t, { name: "", pricePerHour: 3000, description: "" }]);
  const removeType = (i: number) =>
    setSeatTypes((t) => t.filter((_, idx) => idx !== i));
  const updateType = (i: number, key: keyof SeatTypeInput, val: string | number) =>
    setSeatTypes((t) => t.map((st, idx) => (idx === i ? { ...st, [key]: val } : st)));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setError("");
    setSubmitting(true);
    try {
      const res = await apiFetch<{ center: { id: string } }>("/api/owner/centers", {
        method: "POST",
        token,
        body: JSON.stringify({
          name,
          address,
          district,
          description: description || undefined,
          images,
          floors,
          seatTypes: seatTypes.map((t) => ({
            name: t.name,
            pricePerHour: t.pricePerHour,
            description: t.description || undefined,
            images: [],
          })),
          cancelPolicy: { cancelMinutes, noShowMinutes, refundPolicy },
        }),
      });
      router.push(`/owner/centers/${res.center.id}`);
    } catch (err: any) {
      if (err instanceof ApiError && err.data?.redirectTo) {
        router.push(err.data.redirectTo);
        return;
      }
      setError(err.message ?? "Failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) return null;
  if (!user || (user.role !== "OWNER" && user.role !== "ADMIN")) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-6">
        <h1 className="display text-5xl">OWNERS ONLY</h1>
        <Link href="/login" className="text-xs uppercase tracking-[0.3em] text-gray">НЭВТРЭХ →</Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white text-black">
      <header className="grid grid-cols-[auto_1fr_auto] items-center border-b border-black px-6 py-4 md:px-12">
        <Link href="/owner/dashboard" className="text-xs uppercase tracking-[0.3em]">← DASHBOARD</Link>
        <span className="display text-center text-xl">NEW CENTER</span>
        <Link href="/owner/subscription" className="text-xs uppercase tracking-[0.3em] text-gray">SUBSCRIPTION</Link>
      </header>

      <form onSubmit={submit}>
        {/* Split: Info | Preview */}
        <section className="grid grid-cols-1 border-b border-black md:grid-cols-[3fr_2fr]">
          <div className="border-black p-8 md:border-r md:p-12">
            <p className="text-xs uppercase tracking-[0.3em] text-gray">01 · GENERAL</p>

            <div className="mt-6 space-y-6">
              <Field label="CENTER NAME" value={name} onChange={setName} placeholder="REIHEN ONE" required />
              <Field label="ADDRESS" value={address} onChange={setAddress} placeholder="Бага тойруу 14, СБД" required />
              <div>
                <label className="text-xs uppercase tracking-[0.3em] text-gray">DISTRICT</label>
                <select
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  className="mt-2 block w-full border-b-2 border-black bg-transparent pb-3 text-lg font-black outline-none"
                >
                  {DISTRICTS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs uppercase tracking-[0.3em] text-gray">DESCRIPTION</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  maxLength={2000}
                  className="mt-2 block w-full border-b-2 border-black bg-transparent pb-3 text-sm outline-none placeholder:text-gray"
                  placeholder="24/7 үйл ажиллагаатай, 144Hz мониторууд..."
                />
              </div>
              {/* Photos */}
              <div>
                <label className="mb-3 block text-xs uppercase tracking-[0.3em] text-gray">
                  PHOTOS <span className="mono">({images.length}/8)</span>
                </label>
                {token && <ImageUpload images={images} onChange={setImages} token={token} max={8} />}
              </div>
            </div>
          </div>

          <div className="bg-black p-8 text-white md:p-12">
            <p className="text-xs uppercase tracking-[0.3em] text-gray">PREVIEW</p>
            <h2 className="display mt-6 text-5xl md:text-7xl">
              {name ? name.toUpperCase() : "YOUR CENTER"}
            </h2>
            <div className="mono mt-8 text-xs text-gray">
              <p>{address || "ADDRESS"}</p>
              <p>{district}</p>
              <p className="mt-4">{floors.length} FLOOR{floors.length > 1 ? "S" : ""}</p>
              <p>{seatTypes.length} SEAT TYPE{seatTypes.length > 1 ? "S" : ""}</p>
              <p>{images.length} PHOTO{images.length !== 1 ? "S" : ""}</p>
            </div>
          </div>
        </section>

        {/* Floors */}
        <section className="border-b border-black p-8 md:p-12">
          <div className="flex items-end justify-between">
            <p className="text-xs uppercase tracking-[0.3em] text-gray">02 · FLOORS</p>
            <button
              type="button"
              onClick={addFloor}
              className="border border-black px-4 py-2 text-[10px] uppercase tracking-[0.3em] hover:bg-black hover:text-white"
            >
              + ADD FLOOR
            </button>
          </div>
          <div className="mt-6 space-y-4">
            {floors.map((f, i) => (
              <div key={i} className="grid grid-cols-[3rem_1fr_auto] items-end gap-4 border-b border-black pb-4">
                <div className="display text-3xl">{String(f.floorNumber).padStart(2, "0")}</div>
                <input
                  value={f.name}
                  onChange={(e) => updateFloor(i, "name", e.target.value)}
                  required
                  className="border-b-2 border-black bg-transparent pb-2 text-lg font-black outline-none"
                  placeholder="Floor name"
                />
                {floors.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeFloor(i)}
                    className="text-xs uppercase tracking-[0.3em] text-gray hover:text-black"
                  >
                    REMOVE
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Seat types */}
        <section className="border-b border-black p-8 md:p-12">
          <div className="flex items-end justify-between">
            <p className="text-xs uppercase tracking-[0.3em] text-gray">03 · SEAT TYPES</p>
            <button
              type="button"
              onClick={addType}
              className="border border-black px-4 py-2 text-[10px] uppercase tracking-[0.3em] hover:bg-black hover:text-white"
            >
              + ADD TYPE
            </button>
          </div>
          <div className="mt-6 space-y-6">
            {seatTypes.map((t, i) => (
              <div key={i} className="border border-black p-6">
                <div className="grid grid-cols-[1fr_auto] items-start gap-4">
                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] uppercase tracking-[0.3em] text-gray">TYPE NAME</label>
                      <input
                        value={t.name}
                        onChange={(e) => updateType(i, "name", e.target.value)}
                        required
                        className="mt-1 block w-full border-b-2 border-black bg-transparent pb-2 text-xl font-black outline-none"
                        placeholder="Standard / VIP / Streaming"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-[0.3em] text-gray">PRICE PER HOUR (₮)</label>
                      <input
                        type="number"
                        value={t.pricePerHour}
                        onChange={(e) => updateType(i, "pricePerHour", Number(e.target.value))}
                        required
                        min={0}
                        className="mono mt-1 block w-full border-b-2 border-black bg-transparent pb-2 text-xl font-black outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-[0.3em] text-gray">DESCRIPTION</label>
                      <input
                        value={t.description}
                        onChange={(e) => updateType(i, "description", e.target.value)}
                        className="mt-1 block w-full border-b border-black bg-transparent pb-2 text-sm outline-none placeholder:text-gray"
                        placeholder="RTX 4080, 144Hz, Herman Miller..."
                      />
                    </div>
                  </div>
                  {seatTypes.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeType(i)}
                      className="text-xs uppercase tracking-[0.3em] text-gray hover:text-black"
                    >
                      REMOVE
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Cancel policy */}
        <section className="border-b border-black p-8 md:p-12">
          <p className="text-xs uppercase tracking-[0.3em] text-gray">04 · CANCEL POLICY</p>
          <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-3">
            <div>
              <label className="text-[10px] uppercase tracking-[0.3em] text-gray">CANCEL BEFORE (MIN)</label>
              <input
                type="number"
                value={cancelMinutes}
                onChange={(e) => setCancelMinutes(Number(e.target.value))}
                min={0}
                max={1440}
                className="mono mt-2 block w-full border-b-2 border-black bg-transparent pb-2 text-2xl font-black outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-[0.3em] text-gray">NO-SHOW AFTER (MIN)</label>
              <input
                type="number"
                value={noShowMinutes}
                onChange={(e) => setNoShowMinutes(Number(e.target.value))}
                min={0}
                max={1440}
                className="mono mt-2 block w-full border-b-2 border-black bg-transparent pb-2 text-2xl font-black outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-[0.3em] text-gray">REFUND POLICY</label>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {(["FULL", "PARTIAL", "NONE"] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRefundPolicy(r)}
                    className={`border border-black py-3 text-xs uppercase tracking-[0.3em] ${
                      refundPolicy === r ? "bg-black text-white" : "hover:bg-black hover:text-white"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Submit */}
        <section className="p-8 md:p-12">
          {error && (
            <div className="mb-6 border border-black bg-black p-4 text-xs uppercase tracking-[0.3em] text-white">
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={submitting || !name || !address}
            className="w-full bg-black px-6 py-6 text-sm uppercase tracking-[0.3em] text-white disabled:opacity-40 md:w-auto md:px-16"
          >
            {submitting ? "CREATING..." : "CREATE CENTER →"}
          </button>
          <p className="mt-4 text-[10px] uppercase tracking-[0.3em] text-gray">
            * REQUIRES ACTIVE SUBSCRIPTION
          </p>
        </section>
      </form>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="text-xs uppercase tracking-[0.3em] text-gray">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        className="mt-2 block w-full border-b-2 border-black bg-transparent pb-3 text-xl font-black outline-none placeholder:text-gray"
      />
    </div>
  );
}
