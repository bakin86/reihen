"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/useAuth";
import { apiFetch, ApiError } from "@/lib/api";
import { useRouter } from "next/navigation";
import { SeatCell, type SeatStatus } from "@/components/SeatCell";
import { ImageUpload } from "@/components/ImageUpload";
import type { CenterImage } from "@/lib/image-types";

interface Floor { id: string; floorNumber: number; name: string }
interface SeatType { id: string; name: string; pricePerHour: number; description: string | null }
interface Seat {
  id: string; number: string; status: SeatStatus;
  floor: { id: string; floorNumber: number; name: string };
  type: { id: string; name: string; pricePerHour: number };
}
interface Center {
  id: string; name: string; address: string; district: string; description: string | null;
  images: CenterImage[] | string[];
  floors: Floor[]; seatTypes: SeatType[]; seats: Seat[];
  cancelPolicy: { cancelMinutes: number; noShowMinutes: number; maxSeatsPerBooking: number; refundPolicy: string } | null;
  _count: { bookings: number; reviews: number };
}

const DISTRICTS = ["Баянгол", "Баянзүрх", "Сүхбаатар", "Хан-Уул", "Чингэлтэй", "Сонгинохайрхан"];
const STATUSES: SeatStatus[] = ["OPEN", "CLOSED", "REPAIR", "WAITING", "OCCUPIED"];

export default function CenterManagePage({ params }: { params: { id: string } }) {
  const { token, user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [center, setCenter] = useState<Center | null>(null);

  // General info
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [district, setDistrict] = useState("");
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<CenterImage[]>([]);

  // UI state
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ text: string; err?: boolean } | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [selectedSeat, setSelectedSeat] = useState<string | null>(null);
  const [seatFloorFilter, setSeatFloorFilter] = useState<string>("all");

  // Inline add states
  const [newFloorName, setNewFloorName] = useState("");
  const [newTypeName, setNewTypeName] = useState("");
  const [newTypePrice, setNewTypePrice] = useState(3500);
  const [bulkFloor, setBulkFloor] = useState("");
  const [bulkType, setBulkType] = useState("");
  const [bulkCount, setBulkCount] = useState(10);
  const [bulkPrefix, setBulkPrefix] = useState("");
  const [bulkStart, setBulkStart] = useState(1);
  const [showBulkAdd, setShowBulkAdd] = useState(false);

  const showToast = (text: string, err = false) => {
    setToast({ text, err });
    setTimeout(() => setToast(null), 2500);
  };
  const toggle = (key: string) => setCollapsed((c) => ({ ...c, [key]: !c[key] }));

  // Fetch
  useEffect(() => {
    if (!token) return;
    apiFetch<{ center: Center }>(`/api/owner/centers/${params.id}`, { token })
      .then(({ center: c }) => {
        setCenter(c);
        setName(c.name); setAddress(c.address); setDistrict(c.district);
        setDescription(c.description ?? "");
        // Support legacy string[] and new CenterImage[] formats
        if (Array.isArray(c.images)) {
          if (c.images.length === 0) setImages([]);
          else if (typeof c.images[0] === "string") {
            // Migrate legacy: first = main, rest = interior
            setImages((c.images as string[]).map((url, i) => ({ url, tag: i === 0 ? "main" : "interior" } as CenterImage)));
          } else {
            setImages(c.images as CenterImage[]);
          }
        } else {
          setImages([]);
        }
      })
      .catch(() => {});
  }, [token, params.id]);

  useEffect(() => {
    if (center?.floors.length && !bulkFloor) setBulkFloor(center.floors[0].id);
    if (center?.seatTypes.length && !bulkType) setBulkType(center.seatTypes[0].id);
  }, [center, bulkFloor, bulkType]);

  // ─── ACTIONS ──────────────────────────────────────────────

  const saveInfo = async () => {
    if (!token) return;
    setSaving(true);
    try {
      const { center: c } = await apiFetch<{ center: any }>(`/api/owner/centers/${params.id}`, {
        method: "PATCH", token,
        body: JSON.stringify({ name, address, district, description: description || null, images }),
      });
      setCenter((prev) => prev ? { ...prev, ...c } : prev);
      showToast("Center info saved");
    } catch (e: any) { showToast(e.message, true); }
    setSaving(false);
  };

  const addFloor = async () => {
    if (!token || !center) return;
    setSaving(true);
    const nextNum = (center.floors.length ? Math.max(...center.floors.map((f) => f.floorNumber)) : 0) + 1;
    try {
      const { floor } = await apiFetch<{ floor: Floor }>(`/api/owner/centers/${params.id}/floors`, {
        method: "POST", token,
        body: JSON.stringify({ floorNumber: nextNum, name: newFloorName || `${nextNum}-р давхар` }),
      });
      setCenter((c) => c ? { ...c, floors: [...c.floors, floor] } : c);
      setNewFloorName("");
      showToast("Floor added");
    } catch (e: any) {
      if (e instanceof ApiError && e.data?.redirectTo) { router.push(e.data.redirectTo); return; }
      showToast(e.message, true);
    }
    setSaving(false);
  };

  const renameFloor = async (floorId: string, floorName: string) => {
    if (!token) return;
    try {
      await apiFetch(`/api/owner/centers/${params.id}/floors`, {
        method: "PATCH", token, body: JSON.stringify({ floorId, name: floorName }),
      });
      setCenter((c) => c ? { ...c, floors: c.floors.map((f) => f.id === floorId ? { ...f, name: floorName } : f) } : c);
    } catch (e: any) { showToast(e.message, true); }
  };

  const deleteFloor = async (floorId: string) => {
    if (!token) return;
    try {
      await apiFetch(`/api/owner/centers/${params.id}/floors`, {
        method: "DELETE", token, body: JSON.stringify({ floorId }),
      });
      setCenter((c) => c ? { ...c, floors: c.floors.filter((f) => f.id !== floorId) } : c);
      showToast("Floor deleted");
    } catch (e: any) { showToast(e.message, true); }
  };

  const addType = async () => {
    if (!token) return;
    setSaving(true);
    try {
      const { seatType } = await apiFetch<{ seatType: SeatType }>(`/api/owner/centers/${params.id}/seat-types`, {
        method: "POST", token,
        body: JSON.stringify({ name: newTypeName || "Standard", pricePerHour: newTypePrice }),
      });
      setCenter((c) => c ? { ...c, seatTypes: [...c.seatTypes, seatType] } : c);
      setNewTypeName(""); setNewTypePrice(3500);
      showToast("Seat type added");
    } catch (e: any) {
      if (e instanceof ApiError && e.data?.redirectTo) { router.push(e.data.redirectTo); return; }
      showToast(e.message, true);
    }
    setSaving(false);
  };

  const updateType = async (typeId: string, data: { name?: string; pricePerHour?: number }) => {
    if (!token) return;
    try {
      const { seatType } = await apiFetch<{ seatType: SeatType }>(`/api/owner/centers/${params.id}/seat-types`, {
        method: "PATCH", token, body: JSON.stringify({ typeId, ...data }),
      });
      setCenter((c) => c ? { ...c, seatTypes: c.seatTypes.map((t) => t.id === typeId ? seatType : t) } : c);
      showToast("Type updated");
    } catch (e: any) { showToast(e.message, true); }
  };

  const deleteType = async (typeId: string) => {
    if (!token) return;
    try {
      await apiFetch(`/api/owner/centers/${params.id}/seat-types`, {
        method: "DELETE", token, body: JSON.stringify({ typeId }),
      });
      setCenter((c) => c ? { ...c, seatTypes: c.seatTypes.filter((t) => t.id !== typeId) } : c);
      showToast("Type deleted");
    } catch (e: any) { showToast(e.message, true); }
  };

  const changeSeatStatus = async (seatId: string, status: SeatStatus) => {
    if (!token) return;
    setSaving(true);
    try {
      await apiFetch(`/api/owner/seats/${seatId}/status`, {
        method: "PATCH", token, body: JSON.stringify({ status }),
      });
      setCenter((c) => c ? { ...c, seats: c.seats.map((s) => s.id === seatId ? { ...s, status } : s) } : c);
    } catch (e: any) { showToast(e.message, true); }
    setSaving(false);
  };

  const bulkSetStatus = async (floorId: string, status: SeatStatus) => {
    if (!token || !center) return;
    setSaving(true);
    const floorSeats = center.seats.filter((s) => s.floor.id === floorId);
    try {
      await Promise.all(
        floorSeats.map((s) =>
          apiFetch(`/api/owner/seats/${s.id}/status`, {
            method: "PATCH", token, body: JSON.stringify({ status }),
          })
        )
      );
      setCenter((c) =>
        c ? { ...c, seats: c.seats.map((s) => s.floor.id === floorId ? { ...s, status } : s) } : c
      );
      showToast(`All seats on floor set to ${status}`);
    } catch (e: any) { showToast(e.message, true); }
    setSaving(false);
  };

  const addSeats = async () => {
    if (!token) return;
    setSaving(true);
    try {
      const { created } = await apiFetch<{ created: number; seats: Seat[] }>("/api/owner/seats", {
        method: "POST", token,
        body: JSON.stringify({
          centerId: params.id, floorId: bulkFloor, typeId: bulkType,
          count: bulkCount, startNumber: bulkStart, prefix: bulkPrefix || undefined,
        }),
      });
      const { center: c } = await apiFetch<{ center: Center }>(`/api/owner/centers/${params.id}`, { token });
      setCenter(c);
      setBulkStart((n) => n + bulkCount);
      showToast(`${created} seats created`);
      setShowBulkAdd(false);
    } catch (e: any) {
      if (e instanceof ApiError && e.data?.redirectTo) { router.push(e.data.redirectTo); return; }
      showToast(e.message, true);
    }
    setSaving(false);
  };

  const deleteSeat = async (seatId: string) => {
    if (!token) return;
    try {
      await apiFetch(`/api/owner/seats/${seatId}`, { method: "DELETE", token });
      setCenter((c) => c ? { ...c, seats: c.seats.filter((s) => s.id !== seatId) } : c);
      if (selectedSeat === seatId) setSelectedSeat(null);
    } catch (e: any) { showToast(e.message, true); }
  };

  // ─── GUARDS ───────────────────────────────────────────────

  if (authLoading) return null;
  if (!user || (user.role !== "OWNER" && user.role !== "ADMIN")) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-6">
        <h1 className="display text-5xl">OWNERS ONLY</h1>
        <Link href="/login" className="text-xs uppercase tracking-[0.3em] text-gray">НЭВТРЭХ →</Link>
      </main>
    );
  }

  const sel = selectedSeat ? center?.seats.find((s) => s.id === selectedSeat) : null;
  const filteredFloors = center?.floors ?? [];

  return (
    <main className="min-h-screen bg-white text-black">
      {/* Toast */}
      {toast && (
        <div className={`fixed left-1/2 top-6 z-50 -translate-x-1/2 px-6 py-3 text-xs uppercase tracking-[0.3em] shadow-lg transition-all ${
          toast.err ? "bg-black text-white" : "border border-black bg-white text-black"
        }`}>
          {toast.text}
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-40 grid grid-cols-[auto_1fr_auto] items-center border-b border-black bg-white px-6 py-4 md:px-12">
        <Link href="/owner/dashboard" className="text-xs uppercase tracking-[0.3em]">← DASHBOARD</Link>
        <span className="display text-center text-xl">{center?.name?.toUpperCase() ?? "..."}</span>
        <Link href={`/centers/${params.id}`} className="text-xs uppercase tracking-[0.3em] text-gray">VIEW →</Link>
      </header>

      {/* Quick stats bar */}
      {center && (
        <div className="flex gap-8 border-b border-black px-6 py-3 md:px-12">
          {[
            [`${center.seats.length}`, "SEATS"],
            [`${center.floors.length}`, "FLOORS"],
            [`${center.seatTypes.length}`, "TYPES"],
            [`${center.seats.filter((s) => s.status === "OPEN").length}`, "OPEN"],
            [`${center._count.bookings}`, "BOOKINGS"],
          ].map(([n, l]) => (
            <div key={l} className="flex items-baseline gap-2">
              <span className="mono text-lg font-black">{n}</span>
              <span className="text-[9px] uppercase tracking-[0.3em] text-gray">{l}</span>
            </div>
          ))}
        </div>
      )}

      {/* Jump nav */}
      <div className="flex gap-4 border-b border-black px-6 py-3 md:px-12">
        {["info", "floors", "types", "seats", "policy"].map((s) => (
          <a key={s} href={`#${s}`}
            className="text-[10px] uppercase tracking-[0.3em] text-gray hover:text-black">
            {s === "types" ? "SEAT TYPES" : s === "policy" ? "POLICY" : s.toUpperCase()}
          </a>
        ))}
        <Link href={`/owner/centers/${params.id}/layout`}
          className="text-[10px] uppercase tracking-[0.3em] text-gray hover:text-black">
          LAYOUT EDITOR
        </Link>
        <Link href={`/owner/centers/${params.id}/tournaments`}
          className="text-[10px] uppercase tracking-[0.3em] text-gray hover:text-black">
          TOURNAMENTS
        </Link>
      </div>

      <div className="divide-y divide-black">
        {/* ─── GENERAL INFO ──────────────────────────────── */}
        <section id="info">
          <button onClick={() => toggle("info")}
            className="flex w-full items-center justify-between px-6 py-5 md:px-12">
            <h2 className="display text-2xl">GENERAL INFO</h2>
            <span className="text-xs text-gray">{collapsed.info ? "+" : "−"}</span>
          </button>
          {!collapsed.info && center && (
            <div className="px-6 pb-8 md:px-12">
              <div className="grid max-w-3xl gap-5 md:grid-cols-2">
                <div>
                  <label className="text-[10px] uppercase tracking-[0.3em] text-gray">NAME</label>
                  <input value={name} onChange={(e) => setName(e.target.value)}
                    className="mt-1 block w-full border-b-2 border-black bg-transparent pb-2 text-lg font-black outline-none" />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-[0.3em] text-gray">DISTRICT</label>
                  <select value={district} onChange={(e) => setDistrict(e.target.value)}
                    className="mt-1 block w-full border-b-2 border-black bg-transparent pb-2 text-lg font-black outline-none">
                    {DISTRICTS.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="text-[10px] uppercase tracking-[0.3em] text-gray">ADDRESS</label>
                  <input value={address} onChange={(e) => setAddress(e.target.value)}
                    className="mt-1 block w-full border-b-2 border-black bg-transparent pb-2 text-lg font-black outline-none" />
                </div>
                <div className="md:col-span-2">
                  <label className="text-[10px] uppercase tracking-[0.3em] text-gray">DESCRIPTION</label>
                  <textarea value={description} onChange={(e) => setDescription(e.target.value)}
                    rows={2} maxLength={2000}
                    className="mt-1 block w-full border-b-2 border-black bg-transparent pb-2 text-sm outline-none placeholder:text-gray" />
                </div>
              </div>
              {/* Images */}
              <div className="mt-6 max-w-3xl">
                <label className="mb-3 block text-[10px] uppercase tracking-[0.3em] text-gray">
                  PHOTOS <span className="mono">({images.length}/8)</span>
                </label>
                <ImageUpload images={images} onChange={setImages} token={token!} max={8} />
              </div>
              <button onClick={saveInfo} disabled={saving}
                className="mt-6 bg-black px-8 py-4 text-[10px] uppercase tracking-[0.3em] text-white disabled:opacity-40">
                {saving ? "SAVING..." : "SAVE CHANGES"}
              </button>
            </div>
          )}
        </section>

        {/* ─── FLOORS ────────────────────────────────────── */}
        <section id="floors">
          <button onClick={() => toggle("floors")}
            className="flex w-full items-center justify-between px-6 py-5 md:px-12">
            <h2 className="display text-2xl">
              FLOORS <span className="mono ml-2 text-sm font-normal text-gray">{center?.floors.length ?? 0}</span>
            </h2>
            <span className="text-xs text-gray">{collapsed.floors ? "+" : "−"}</span>
          </button>
          {!collapsed.floors && center && (
            <div className="px-6 pb-8 md:px-12">
              {center.floors.map((f) => {
                const sc = center.seats.filter((s) => s.floor.id === f.id).length;
                return <FloorRow key={f.id} floor={f} seatCount={sc}
                  onRename={(n) => renameFloor(f.id, n)} onDelete={() => deleteFloor(f.id)} />;
              })}
              {/* Inline add */}
              <div className="mt-4 flex items-end gap-3">
                <input value={newFloorName} onChange={(e) => setNewFloorName(e.target.value)}
                  placeholder={`${(center.floors.length || 0) + 1}-р давхар`}
                  onKeyDown={(e) => { if (e.key === "Enter") addFloor(); }}
                  className="flex-1 border-b border-gray bg-transparent pb-2 text-sm outline-none placeholder:text-gray focus:border-black" />
                <button onClick={addFloor} disabled={saving}
                  className="px-4 py-2 text-[10px] uppercase tracking-[0.3em] text-gray hover:text-black disabled:opacity-40">
                  + ADD FLOOR
                </button>
              </div>
            </div>
          )}
        </section>

        {/* ─── SEAT TYPES ────────────────────────────────── */}
        <section id="types">
          <button onClick={() => toggle("types")}
            className="flex w-full items-center justify-between px-6 py-5 md:px-12">
            <h2 className="display text-2xl">
              SEAT TYPES <span className="mono ml-2 text-sm font-normal text-gray">{center?.seatTypes.length ?? 0}</span>
            </h2>
            <span className="text-xs text-gray">{collapsed.types ? "+" : "−"}</span>
          </button>
          {!collapsed.types && center && (
            <div className="px-6 pb-8 md:px-12">
              <div className="space-y-3">
                {center.seatTypes.map((t) => (
                  <TypeRow key={t.id} type={t}
                    seatCount={center.seats.filter((s) => s.type.id === t.id).length}
                    onUpdate={(data) => updateType(t.id, data)}
                    onDelete={() => deleteType(t.id)} />
                ))}
              </div>
              {/* Inline add */}
              <div className="mt-4 flex items-end gap-3">
                <input value={newTypeName} onChange={(e) => setNewTypeName(e.target.value)} placeholder="Type name"
                  onKeyDown={(e) => { if (e.key === "Enter") addType(); }}
                  className="flex-1 border-b border-gray bg-transparent pb-2 text-sm outline-none placeholder:text-gray focus:border-black" />
                <div className="flex items-end gap-1">
                  <input type="number" value={newTypePrice} onChange={(e) => setNewTypePrice(Number(e.target.value))} min={0}
                    className="mono w-20 border-b border-gray bg-transparent pb-2 text-right text-sm outline-none focus:border-black" />
                  <span className="pb-2 text-xs text-gray">₮/h</span>
                </div>
                <button onClick={addType} disabled={saving}
                  className="px-4 py-2 text-[10px] uppercase tracking-[0.3em] text-gray hover:text-black disabled:opacity-40">
                  + ADD TYPE
                </button>
              </div>
            </div>
          )}
        </section>

        {/* ─── SEATS ─────────────────────────────────────── */}
        <section id="seats">
          <button onClick={() => toggle("seats")}
            className="flex w-full items-center justify-between px-6 py-5 md:px-12">
            <h2 className="display text-2xl">
              SEATS <span className="mono ml-2 text-sm font-normal text-gray">{center?.seats.length ?? 0}</span>
            </h2>
            <span className="text-xs text-gray">{collapsed.seats ? "+" : "−"}</span>
          </button>
          {!collapsed.seats && center && (
            <div className="px-6 pb-8 md:px-12">
              {/* Toolbar: floor filter + bulk add toggle */}
              <div className="mb-6 flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase tracking-[0.3em] text-gray">FLOOR:</span>
                  <select value={seatFloorFilter} onChange={(e) => setSeatFloorFilter(e.target.value)}
                    className="border-b border-black bg-transparent pb-1 text-sm font-black outline-none">
                    <option value="all">ALL</option>
                    {center.floors.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                </div>
                {/* Status legend */}
                <div className="flex items-center gap-3">
                  {STATUSES.map((st) => {
                    const count = center.seats.filter((s) =>
                      (seatFloorFilter === "all" || s.floor.id === seatFloorFilter) && s.status === st
                    ).length;
                    if (count === 0) return null;
                    return (
                      <span key={st} className="mono text-[10px] text-gray">
                        <span className={`mr-1 inline-block h-2 w-2 ${
                          st === "OPEN" ? "bg-green-500" : st === "OCCUPIED" ? "bg-red-500" :
                          st === "WAITING" ? "bg-yellow-500" : st === "REPAIR" ? "bg-orange-500" : "bg-gray"
                        }`} />
                        {count} {st}
                      </span>
                    );
                  })}
                </div>
                <div className="ml-auto flex gap-2">
                  <Link href={`/owner/centers/${params.id}/layout`}
                    className="border border-black px-4 py-2 text-[10px] uppercase tracking-[0.3em] hover:bg-black hover:text-white">
                    LAYOUT EDITOR
                  </Link>
                  <button onClick={() => setShowBulkAdd(!showBulkAdd)}
                    className="border border-black px-4 py-2 text-[10px] uppercase tracking-[0.3em] hover:bg-black hover:text-white">
                    {showBulkAdd ? "CLOSE" : "+ ADD SEATS"}
                  </button>
                </div>
              </div>

              {/* Bulk add panel (collapsible) */}
              {showBulkAdd && (
                <div className="mb-6 border border-black bg-[#fafafa] p-5">
                  <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
                    <div>
                      <label className="text-[10px] uppercase tracking-[0.3em] text-gray">FLOOR</label>
                      <select value={bulkFloor} onChange={(e) => setBulkFloor(e.target.value)}
                        className="mt-1 block w-full border-b border-black bg-transparent pb-2 text-sm font-black outline-none">
                        {center.floors.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-[0.3em] text-gray">TYPE</label>
                      <select value={bulkType} onChange={(e) => setBulkType(e.target.value)}
                        className="mt-1 block w-full border-b border-black bg-transparent pb-2 text-sm font-black outline-none">
                        {center.seatTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-[0.3em] text-gray">PREFIX</label>
                      <input value={bulkPrefix} onChange={(e) => setBulkPrefix(e.target.value)} placeholder="A"
                        className="mono mt-1 block w-full border-b border-black bg-transparent pb-2 text-sm font-black outline-none placeholder:text-gray" />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-[0.3em] text-gray">START #</label>
                      <input type="number" value={bulkStart} onChange={(e) => setBulkStart(Number(e.target.value))} min={1}
                        className="mono mt-1 block w-full border-b border-black bg-transparent pb-2 text-sm font-black outline-none" />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-[0.3em] text-gray">COUNT</label>
                      <input type="number" value={bulkCount} onChange={(e) => setBulkCount(Number(e.target.value))} min={1} max={200}
                        className="mono mt-1 block w-full border-b border-black bg-transparent pb-2 text-sm font-black outline-none" />
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="mono text-xs text-gray">
                      {bulkPrefix}{bulkStart} ... {bulkPrefix}{bulkStart + bulkCount - 1} ({bulkCount})
                    </span>
                    <button onClick={addSeats} disabled={saving || !bulkFloor || !bulkType}
                      className="bg-black px-6 py-3 text-[10px] uppercase tracking-[0.3em] text-white disabled:opacity-40">
                      {saving ? "..." : `CREATE ${bulkCount}`}
                    </button>
                  </div>
                </div>
              )}

              {/* Seat grid + status panel side by side on desktop */}
              <div className="grid grid-cols-1 gap-6 md:grid-cols-[1fr_280px]">
                {/* Grid */}
                <div>
                  {filteredFloors
                    .filter((f) => seatFloorFilter === "all" || f.id === seatFloorFilter)
                    .map((f) => {
                    const floorSeats = center.seats.filter((s) => s.floor.id === f.id);
                    if (floorSeats.length === 0 && seatFloorFilter !== "all") return null;
                    return (
                      <div key={f.id} className="mb-8">
                        <div className="mb-3 flex items-center justify-between">
                          <span className="text-xs font-black uppercase tracking-[0.2em]">{f.name}</span>
                          <div className="flex items-center gap-2">
                            <span className="mono text-[10px] text-gray">{floorSeats.length}</span>
                            {/* Bulk floor status */}
                            <select
                              value=""
                              onChange={(e) => { if (e.target.value) bulkSetStatus(f.id, e.target.value as SeatStatus); }}
                              className="border-b border-gray bg-transparent pb-0.5 text-[10px] text-gray outline-none"
                            >
                              <option value="">SET ALL...</option>
                              {STATUSES.map((st) => <option key={st} value={st}>{st}</option>)}
                            </select>
                          </div>
                        </div>
                        {floorSeats.length === 0 && (
                          <p className="text-sm text-gray">No seats on this floor.</p>
                        )}
                        <div className="grid grid-cols-6 gap-2.5 rounded-xl bg-[#0d0d0d] p-4 md:grid-cols-8 lg:grid-cols-10">
                          {floorSeats.map((s) => (
                            <div key={s.id} className="group relative">
                              <SeatCell
                                number={s.number}
                                status={s.status}
                                selected={selectedSeat === s.id}
                                onClick={() => setSelectedSeat(selectedSeat === s.id ? null : s.id)}
                              />
                              <button
                                onClick={(e) => { e.stopPropagation(); deleteSeat(s.id); }}
                                className="absolute -right-1 -top-1 hidden h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[9px] text-white group-hover:flex"
                                title="Delete"
                              >
                                x
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Sticky status panel (right side) */}
                <div className="md:sticky md:top-20 md:self-start">
                  {sel ? (
                    <div className="border border-black p-5">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="display text-3xl">{sel.number}</div>
                          <div className="mono mt-1 text-[10px] text-gray">
                            {sel.type.name} · {sel.floor.name}
                          </div>
                          <div className="mono mt-1 text-[10px] text-gray">
                            {sel.type.pricePerHour.toLocaleString()}₮/h
                          </div>
                        </div>
                        <button onClick={() => setSelectedSeat(null)}
                          className="text-[10px] text-gray hover:text-black">x</button>
                      </div>
                      <div className="mt-5 space-y-2">
                        {STATUSES.map((st) => (
                          <button
                            key={st}
                            disabled={saving}
                            onClick={() => changeSeatStatus(selectedSeat!, st)}
                            className={`block w-full border border-black py-2.5 text-[10px] uppercase tracking-widest transition-colors disabled:opacity-40 ${
                              sel.status === st
                                ? "bg-black text-white"
                                : "hover:bg-black hover:text-white"
                            }`}
                          >
                            {st}
                          </button>
                        ))}
                      </div>
                      <button
                        onClick={() => deleteSeat(selectedSeat!)}
                        className="mt-4 w-full py-2 text-[10px] uppercase tracking-widest text-gray hover:text-black"
                      >
                        DELETE SEAT
                      </button>
                    </div>
                  ) : (
                    <div className="border border-dashed border-gray p-5 text-center">
                      <p className="text-xs text-gray">Click a seat to change its status</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>

        {/* ─── POLICY ───────────────────────────────────── */}
        <section id="policy">
          <button onClick={() => toggle("policy")}
            className="flex w-full items-center justify-between px-6 py-5 md:px-12">
            <h2 className="display text-2xl">POLICY</h2>
            <span className="text-xs text-gray">{collapsed.policy ? "+" : "−"}</span>
          </button>
          {!collapsed.policy && center && (
            <PolicySection
              centerId={center.id}
              initial={center.cancelPolicy}
              token={token!}
              onSaved={(p) => {
                setCenter((c) => c ? { ...c, cancelPolicy: p } : c);
                showToast("Policy saved");
              }}
            />
          )}
        </section>
      </div>
    </main>
  );
}

// ─── Subcomponents ───────────────────────────────────────────

function FloorRow({ floor, seatCount, onRename, onDelete }: {
  floor: { id: string; floorNumber: number; name: string };
  seatCount: number; onRename: (name: string) => void; onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(floor.name);
  return (
    <div className="flex items-center gap-4 border-b border-gray/30 py-3">
      <span className="mono w-8 text-xs text-gray">{String(floor.floorNumber).padStart(2, "0")}</span>
      {editing ? (
        <input value={name} onChange={(e) => setName(e.target.value)} autoFocus
          onBlur={() => { onRename(name); setEditing(false); }}
          onKeyDown={(e) => { if (e.key === "Enter") { onRename(name); setEditing(false); } }}
          className="flex-1 border-b border-black bg-transparent pb-1 text-sm font-black outline-none" />
      ) : (
        <button onClick={() => setEditing(true)} className="flex-1 text-left text-sm font-black hover:underline">
          {floor.name}
        </button>
      )}
      <span className="mono text-[10px] text-gray">{seatCount} seats</span>
      <button onClick={onDelete} disabled={seatCount > 0}
        className="text-[10px] uppercase tracking-[0.3em] text-gray hover:text-black disabled:opacity-20">
        DELETE
      </button>
    </div>
  );
}

function TypeRow({ type, seatCount, onUpdate, onDelete }: {
  type: { id: string; name: string; pricePerHour: number };
  seatCount: number;
  onUpdate: (data: { name?: string; pricePerHour?: number }) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(type.name);
  const [price, setPrice] = useState(type.pricePerHour);
  return (
    <div className="flex items-center gap-4 border-b border-gray/30 py-3">
      {editing ? (
        <>
          <input value={name} onChange={(e) => setName(e.target.value)} autoFocus
            className="flex-1 border-b border-black bg-transparent pb-1 text-sm font-black outline-none" />
          <div className="flex items-end gap-1">
            <input type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))} min={0}
              className="mono w-20 border-b border-black bg-transparent pb-1 text-right text-sm font-black outline-none" />
            <span className="text-[10px] text-gray">₮/h</span>
          </div>
          <button onClick={() => { onUpdate({ name, pricePerHour: price }); setEditing(false); }}
            className="text-[10px] uppercase tracking-[0.3em] hover:underline">SAVE</button>
          <button onClick={() => { setName(type.name); setPrice(type.pricePerHour); setEditing(false); }}
            className="text-[10px] uppercase tracking-[0.3em] text-gray">CANCEL</button>
        </>
      ) : (
        <>
          <button onClick={() => setEditing(true)} className="flex-1 text-left text-sm font-black hover:underline">
            {type.name}
          </button>
          <span className="mono text-xs text-gray">{type.pricePerHour.toLocaleString()}₮/h</span>
          <span className="mono text-[10px] text-gray">{seatCount} seats</span>
          <button onClick={() => setEditing(true)}
            className="text-[10px] uppercase tracking-[0.3em] text-gray hover:text-black">EDIT</button>
          <button onClick={onDelete} disabled={seatCount > 0}
            className="text-[10px] uppercase tracking-[0.3em] text-gray hover:text-black disabled:opacity-20">DELETE</button>
        </>
      )}
    </div>
  );
}

function PolicySection({
  centerId, initial, token, onSaved,
}: {
  centerId: string;
  initial: Center["cancelPolicy"];
  token: string;
  onSaved: (p: NonNullable<Center["cancelPolicy"]>) => void;
}) {
  const [cancelMin, setCancelMin] = useState(initial?.cancelMinutes ?? 30);
  const [noShowMin, setNoShowMin] = useState(initial?.noShowMinutes ?? 60);
  const [maxSeats, setMaxSeats] = useState(initial?.maxSeatsPerBooking ?? 10);
  const [refund, setRefund] = useState(initial?.refundPolicy ?? "FULL");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const { policy } = await apiFetch<{ policy: any }>("/api/owner/policy", {
        method: "PATCH",
        token,
        body: JSON.stringify({
          centerId,
          cancelMinutes: cancelMin,
          noShowMinutes: noShowMin,
          maxSeatsPerBooking: maxSeats,
          refundPolicy: refund,
        }),
      });
      onSaved(policy);
    } catch { /* */ }
    setSaving(false);
  };

  return (
    <div className="space-y-6 px-6 pb-8 md:px-12">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {/* Max seats per booking */}
        <div>
          <label className="text-[10px] uppercase tracking-[0.3em] text-gray">MAX SEATS / BOOKING</label>
          <div className="mt-2 flex items-center gap-3">
            <button onClick={() => setMaxSeats((v) => Math.max(1, v - 1))}
              className="flex h-10 w-10 items-center justify-center border border-black text-lg hover:bg-black hover:text-white">−</button>
            <span className="display mono text-3xl w-12 text-center">{maxSeats}</span>
            <button onClick={() => setMaxSeats((v) => Math.min(50, v + 1))}
              className="flex h-10 w-10 items-center justify-center border border-black text-lg hover:bg-black hover:text-white">+</button>
          </div>
        </div>

        {/* Cancel minutes */}
        <div>
          <label className="text-[10px] uppercase tracking-[0.3em] text-gray">CANCEL WINDOW (MIN)</label>
          <input type="number" value={cancelMin} min={0} max={1440}
            onChange={(e) => setCancelMin(Number(e.target.value))}
            className="mt-2 block w-full border border-black px-4 py-2.5 mono text-sm outline-none focus:ring-1 focus:ring-black" />
        </div>

        {/* No-show minutes */}
        <div>
          <label className="text-[10px] uppercase tracking-[0.3em] text-gray">NO-SHOW TIMEOUT (MIN)</label>
          <input type="number" value={noShowMin} min={0} max={1440}
            onChange={(e) => setNoShowMin(Number(e.target.value))}
            className="mt-2 block w-full border border-black px-4 py-2.5 mono text-sm outline-none focus:ring-1 focus:ring-black" />
        </div>

        {/* Refund policy */}
        <div>
          <label className="text-[10px] uppercase tracking-[0.3em] text-gray">REFUND POLICY</label>
          <div className="mt-2 flex gap-1">
            {["FULL", "PARTIAL", "NONE"].map((r) => (
              <button key={r} onClick={() => setRefund(r)}
                className={`flex-1 border border-black py-2.5 text-[10px] uppercase tracking-widest transition-colors ${
                  refund === r ? "bg-black text-white" : "hover:bg-black hover:text-white"
                }`}>
                {r}
              </button>
            ))}
          </div>
        </div>
      </div>

      <button onClick={save} disabled={saving}
        className="btn-pop bg-black px-8 py-3 text-xs uppercase tracking-[0.3em] text-white disabled:opacity-40">
        {saving ? "SAVING..." : "SAVE POLICY"}
      </button>
    </div>
  );
}
