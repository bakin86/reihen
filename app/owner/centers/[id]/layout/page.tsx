"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/useAuth";
import { apiFetch } from "@/lib/api";

interface SeatData {
  id: string;
  number: string;
  status: string;
  floor: { id: string; floorNumber: number; name: string };
  type: { id: string; name: string; pricePerHour: number };
  posX: number | null;
  posY: number | null;
}

interface CenterInfo {
  id: string;
  name: string;
}

const MIN_COLS = 6;
const MAX_COLS = 24;
const MIN_ROWS = 4;
const MAX_ROWS = 16;

export default function LayoutEditorPage({ params }: { params: { id: string } }) {
  const { token } = useAuth();
  const [center, setCenter] = useState<CenterInfo | null>(null);
  const [seats, setSeats] = useState<SeatData[]>([]);
  const [floor, setFloor] = useState<number>(1);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Multi-select placed seats on grid
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Multi-pick from sidebar: queue of unplaced seat IDs to place one-by-one
  const [pickQueue, setPickQueue] = useState<string[]>([]);
  const [hoverCell, setHoverCell] = useState<{ x: number; y: number } | null>(null);

  // Grid size
  const [cols, setCols] = useState(12);
  const [rows, setRows] = useState(8);
  const [cellSize, setCellSize] = useState(56);
  const gridRef = useRef<HTMLDivElement>(null);

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  };

  const clearAll_ = useCallback(() => {
    setSelected(new Set());
    setPickQueue([]);
  }, []);

  useEffect(() => {
    apiFetch<{ center: CenterInfo; seats: SeatData[] }>(`/api/centers/${params.id}/seats`)
      .then(({ center: c, seats: s }) => {
        setCenter(c);
        setSeats(s);
        if (s.length) setFloor(s[0].floor.floorNumber);
        const maxX = Math.max(MIN_COLS - 1, ...s.filter(x => x.posX !== null).map(x => x.posX!));
        const maxY = Math.max(MIN_ROWS - 1, ...s.filter(x => x.posY !== null).map(x => x.posY!));
        setCols(Math.min(MAX_COLS, maxX + 2));
        setRows(Math.min(MAX_ROWS, maxY + 2));
      })
      .catch(() => {});
  }, [params.id]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") clearAll_();
      if ((e.key === "Delete" || e.key === "Backspace") && selected.size > 0) {
        setSeats((prev) =>
          prev.map((s) => selected.has(s.id) ? { ...s, posX: null, posY: null } : s)
        );
        setDirty(true);
        setSaved(false);
        flash(`${selected.size} суудал арилгасан`);
        clearAll_();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selected, clearAll_]);

  const floors = useMemo(
    () =>
      Array.from(new Set(seats.map((s) => s.floor.floorNumber)))
        .sort()
        .map((n) => ({ n, name: seats.find((s) => s.floor.floorNumber === n)!.floor.name })),
    [seats]
  );

  const floorSeats = seats.filter((s) => s.floor.floorNumber === floor);
  const placed = floorSeats.filter((s) => s.posX !== null && s.posY !== null);
  const unplaced = floorSeats.filter((s) => s.posX === null || s.posY === null);

  const occupancy = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of placed) map.set(`${s.posX},${s.posY}`, s.id);
    return map;
  }, [placed]);

  const placeSeat = useCallback((seatId: string, x: number, y: number) => {
    setSeats((prev) =>
      prev.map((s) => {
        if (s.id === seatId) return { ...s, posX: x, posY: y };
        if (s.posX === x && s.posY === y && s.id !== seatId) return { ...s, posX: null, posY: null };
        return s;
      })
    );
    setDirty(true);
    setSaved(false);
  }, []);

  const unplaceSelected = useCallback(() => {
    if (selected.size === 0) return;
    setSeats((prev) =>
      prev.map((s) => selected.has(s.id) ? { ...s, posX: null, posY: null } : s)
    );
    setDirty(true);
    setSaved(false);
    flash(`${selected.size} суудал арилгасан`);
    clearAll_();
  }, [selected, clearAll_]);

  // Move selected group by delta
  const moveSelected = useCallback((dx: number, dy: number) => {
    if (selected.size === 0) return;
    const selSeats = placed.filter((s) => selected.has(s.id));
    const outOfBounds = selSeats.some((s) => {
      const nx = s.posX! + dx, ny = s.posY! + dy;
      return nx < 0 || nx >= cols || ny < 0 || ny >= rows;
    });
    if (outOfBounds) return;
    const selIds = new Set(selSeats.map((s) => s.id));
    const blocked = selSeats.some((s) => {
      const occ = occupancy.get(`${s.posX! + dx},${s.posY! + dy}`);
      return occ && !selIds.has(occ);
    });
    if (blocked) return;
    setSeats((prev) =>
      prev.map((s) =>
        selected.has(s.id) && s.posX !== null && s.posY !== null
          ? { ...s, posX: s.posX + dx, posY: s.posY + dy }
          : s
      )
    );
    setDirty(true);
    setSaved(false);
  }, [selected, placed, occupancy, cols, rows]);

  // Arrow keys
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (selected.size === 0) return;
      const map: Record<string, [number, number]> = {
        ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1],
      };
      const d = map[e.key];
      if (d) { e.preventDefault(); moveSelected(d[0], d[1]); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selected, moveSelected]);

  // Toggle placed seat selection
  const toggleSelect = useCallback((seatId: string, multi: boolean) => {
    setSelected((prev) => {
      const next = new Set(multi ? prev : []);
      if (prev.has(seatId) && multi) next.delete(seatId);
      else next.add(seatId);
      return next;
    });
    setPickQueue([]);
  }, []);

  // Toggle sidebar seat in pick queue
  const togglePick = useCallback((seatId: string, multi: boolean) => {
    setSelected(new Set());
    setPickQueue((prev) => {
      if (multi) {
        // Ctrl+click: add/remove from queue
        return prev.includes(seatId) ? prev.filter((id) => id !== seatId) : [...prev, seatId];
      }
      // Plain click: toggle single or start fresh
      return prev.length === 1 && prev[0] === seatId ? [] : [seatId];
    });
  }, []);

  // Select all unplaced into pick queue
  const pickAllUnplaced = useCallback(() => {
    setSelected(new Set());
    const sorted = [...unplaced].sort((a, b) =>
      a.number.localeCompare(b.number, undefined, { numeric: true, sensitivity: "base" })
    );
    setPickQueue(sorted.map((s) => s.id));
    flash(`${sorted.length} суудал сонгосон — grid дээр дарж нэг нэгээр байрлуулна уу`);
  }, [unplaced]);

  // The next seat to be placed from queue
  const nextPick = pickQueue.length > 0 ? seats.find((s) => s.id === pickQueue[0]) : null;

  // Click on grid cell
  const handleCellClick = useCallback((x: number, y: number, e: React.MouseEvent) => {
    const existing = occupancy.get(`${x},${y}`);
    const multi = e.ctrlKey || e.metaKey || e.shiftKey;

    // If pick queue active, place next seat here
    if (pickQueue.length > 0 && !existing) {
      const nextId = pickQueue[0];
      const nextSeat = seats.find((s) => s.id === nextId);
      placeSeat(nextId, x, y);
      const remaining = pickQueue.slice(1);
      setPickQueue(remaining);
      if (remaining.length === 0) {
        flash("Бүгд байрлуулсан!");
      } else {
        flash(`${nextSeat?.number} байрлуулсан · ${remaining.length} үлдсэн`);
      }
      setHoverCell(null);
      return;
    }

    // Click occupied cell: toggle selection
    if (existing) {
      toggleSelect(existing, multi);
      return;
    }

    // Selected placed seats + click empty: move group
    if (selected.size > 0 && !multi) {
      const selSeats = placed.filter((s) => selected.has(s.id));
      if (selSeats.length > 0) {
        const minX = Math.min(...selSeats.map((s) => s.posX!));
        const minY = Math.min(...selSeats.map((s) => s.posY!));
        const dx = x - minX, dy = y - minY;
        const fits = selSeats.every((s) => {
          const nx = s.posX! + dx, ny = s.posY! + dy;
          if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) return false;
          const occ = occupancy.get(`${nx},${ny}`);
          return !occ || selected.has(occ);
        });
        if (fits) { moveSelected(dx, dy); return; }
      }
    }

    // No queue, no selection: auto-place first unplaced
    if (unplaced.length > 0) {
      placeSeat(unplaced[0].id, x, y);
      flash(`${unplaced[0].number} байрлуулсан`);
    } else {
      clearAll_();
    }
  }, [pickQueue, seats, selected, occupancy, unplaced, placed, placeSeat, toggleSelect, moveSelected, clearAll_, cols, rows]);

  // Drag
  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }, []);
  const getGridPos = useCallback((cx: number, cy: number) => {
    if (!gridRef.current) return null;
    const r = gridRef.current.getBoundingClientRect();
    const x = Math.floor((cx - r.left) / cellSize), y = Math.floor((cy - r.top) / cellSize);
    return (x >= 0 && x < cols && y >= 0 && y < rows) ? { x, y } : null;
  }, [cellSize, cols, rows]);
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    if (!id) return;
    const pos = getGridPos(e.clientX, e.clientY);
    if (pos) placeSeat(id, pos.x, pos.y);
  }, [getGridPos, placeSeat]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const placedSeats = floorSeats.filter((s) => s.posX !== null && s.posY !== null)
        .map((s) => ({ id: s.id, posX: s.posX!, posY: s.posY! }));
      const clearIds = floorSeats.filter((s) => s.posX === null || s.posY === null).map((s) => s.id);
      await apiFetch(`/api/owner/centers/${params.id}/layout`, {
        method: "PATCH", token, body: JSON.stringify({ seats: placedSeats, clearIds }),
      });
      setSaved(true); setDirty(false);
      flash("Layout хадгалагдлаа!");
    } catch { flash("Хадгалж чадсангүй"); }
    finally { setSaving(false); }
  };

  const applyLayout = (idToPos: Map<string, { x: number; y: number }>, label: string) => {
    setSeats((prev) => prev.map((s) => { const p = idToPos.get(s.id); return p ? { ...s, posX: p.x, posY: p.y } : s; }));
    setDirty(true); setSaved(false); clearAll_();
    flash(label);
  };

  const autoArrange = () => {
    const sorted = [...floorSeats].sort((a, b) =>
      a.number.localeCompare(b.number, undefined, { numeric: true, sensitivity: "base" })
    );
    const m = new Map<string, { x: number; y: number }>();
    let c = 0, r = 0;
    for (const s of sorted) { m.set(s.id, { x: c, y: r }); c++; if (c >= cols) { c = 0; r++; } }
    applyLayout(m, "Бүх суудал дугаарын дарааллаар байрлуулсан");
  };

  // 5vs5 layout: two teams facing each other with gap in the middle
  //  Team A (5)   [gap]   Team B (5)
  //  then next 10, etc.
  const layout5v5 = () => {
    const sorted = [...floorSeats].sort((a, b) =>
      a.number.localeCompare(b.number, undefined, { numeric: true, sensitivity: "base" })
    );
    const m = new Map<string, { x: number; y: number }>();
    const teamSize = 5;
    const gap = 2; // columns between teams
    const teamACols = teamSize; // 5 seats = 5 columns (1 row per team)
    const groupWidth = teamACols + gap + teamACols; // 5 + 2 + 5 = 12
    let groupRow = 0;
    let i = 0;
    while (i < sorted.length) {
      // Team A: left side, seats in a row
      for (let t = 0; t < teamSize && i < sorted.length; t++, i++) {
        m.set(sorted[i].id, { x: t, y: groupRow });
      }
      // Team B: right side, seats in a row (mirrored so they "face" team A)
      for (let t = 0; t < teamSize && i < sorted.length; t++, i++) {
        m.set(sorted[i].id, { x: teamACols + gap + (teamSize - 1 - t), y: groupRow });
      }
      groupRow += 2; // gap between groups
    }
    // Auto-resize grid if needed
    const maxX = Math.max(...Array.from(m.values()).map((p) => p.x));
    const maxY = Math.max(...Array.from(m.values()).map((p) => p.y));
    if (maxX + 1 > cols) setCols(Math.min(MAX_COLS, maxX + 2));
    if (maxY + 1 > rows) setRows(Math.min(MAX_ROWS, maxY + 2));
    applyLayout(m, "5vs5 байрлал тохируулсан");
  };

  // Classroom: rows of seats all facing one direction
  const layoutClassroom = () => {
    const sorted = [...floorSeats].sort((a, b) =>
      a.number.localeCompare(b.number, undefined, { numeric: true, sensitivity: "base" })
    );
    const m = new Map<string, { x: number; y: number }>();
    const perRow = Math.min(cols, Math.max(5, Math.ceil(Math.sqrt(sorted.length * 2))));
    let c = 0, r = 0;
    for (const s of sorted) {
      m.set(s.id, { x: c, y: r });
      c++;
      if (c >= perRow) { c = 0; r += 2; } // double spacing between rows
    }
    const maxY = Math.max(...Array.from(m.values()).map((p) => p.y));
    if (maxY + 1 > rows) setRows(Math.min(MAX_ROWS, maxY + 2));
    applyLayout(m, "Анги байрлал тохируулсан");
  };

  // Tournament: pairs of 2 facing each other (1v1 stations)
  const layout1v1 = () => {
    const sorted = [...floorSeats].sort((a, b) =>
      a.number.localeCompare(b.number, undefined, { numeric: true, sensitivity: "base" })
    );
    const m = new Map<string, { x: number; y: number }>();
    const pairsPerRow = Math.min(Math.floor(cols / 3), 4);
    let pairIdx = 0;
    let i = 0;
    while (i < sorted.length) {
      const rowOffset = Math.floor(pairIdx / pairsPerRow) * 3;
      const colOffset = (pairIdx % pairsPerRow) * 3;
      if (i < sorted.length) m.set(sorted[i].id, { x: colOffset, y: rowOffset });
      i++;
      if (i < sorted.length) m.set(sorted[i].id, { x: colOffset + 1, y: rowOffset });
      i++;
      pairIdx++;
    }
    const maxX = Math.max(0, ...Array.from(m.values()).map((p) => p.x));
    const maxY = Math.max(0, ...Array.from(m.values()).map((p) => p.y));
    if (maxX + 1 > cols) setCols(Math.min(MAX_COLS, maxX + 2));
    if (maxY + 1 > rows) setRows(Math.min(MAX_ROWS, maxY + 2));
    applyLayout(m, "1v1 байрлал тохируулсан");
  };

  const clearLayout = () => {
    setSeats((prev) => prev.map((s) => s.floor.floorNumber === floor ? { ...s, posX: null, posY: null } : s));
    setDirty(true); setSaved(false); clearAll_();
    flash("Бүх суудал арилгасан");
  };

  const selectAllPlaced = () => {
    setSelected(new Set(placed.map((s) => s.id)));
    setPickQueue([]);
    flash(`${placed.length} суудал сонгосон`);
  };

  if (!center) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="display text-2xl animate-pulse">LOADING...</div>
      </main>
    );
  }

  const mode = pickQueue.length > 0 ? "picking" : selected.size > 0 ? "selected" : "idle";
  const pickQueueSet = new Set(pickQueue);

  return (
    <main className="min-h-screen bg-white text-black select-none">
      {/* Toast */}
      {toast && (
        <div className="fixed left-1/2 top-6 z-50 -translate-x-1/2 anim-fade-up border border-black bg-white px-6 py-3 text-xs uppercase tracking-[0.3em] shadow-lg">
          {toast}
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-black bg-white px-4 py-3 md:px-8">
        <div className="flex items-center gap-3">
          <Link href={`/owner/centers/${params.id}`} className="text-xs uppercase tracking-[0.3em] text-gray hover:text-black">← БУЦАХ</Link>
          <div className="hidden md:block">
            <h1 className="display text-lg">{center.name.toUpperCase()}</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {dirty && !saved && <span className="h-2 w-2 rounded-full bg-yellow-400" title="Unsaved" />}
          {saved && <span className="h-2 w-2 rounded-full bg-green-500" title="Saved" />}
          <button onClick={handleSave} disabled={saving || !dirty}
            className="btn-pop bg-black px-5 py-2 text-[10px] uppercase tracking-[0.3em] text-white disabled:opacity-30">
            {saving ? "..." : "ХАДГАЛАХ"}
          </button>
        </div>
      </header>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 border-b border-black px-4 py-2 md:px-8">
        <div className="flex items-center gap-1 border-r border-black/20 pr-3">
          {floors.map((f) => (
            <button key={f.n} onClick={() => { setFloor(f.n); clearAll_(); }}
              className={`px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] transition-colors ${
                floor === f.n ? "bg-black text-white" : "text-gray hover:bg-black/5"
              }`}>
              {f.name || `ДАВХАР ${f.n}`}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 border-r border-black/20 pr-3">
          <div className="h-1.5 w-20 overflow-hidden bg-black/10">
            <div className="h-full bg-black transition-all" style={{ width: `${floorSeats.length ? (placed.length / floorSeats.length) * 100 : 0}%` }} />
          </div>
          <span className="mono text-[10px] text-gray">{placed.length}/{floorSeats.length}</span>
        </div>
        <button onClick={autoArrange} className="px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] text-gray hover:bg-black/5 hover:text-black transition-colors">АВТОМАТ</button>
        <button onClick={layout5v5} className="px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] text-gray hover:bg-black/5 hover:text-black transition-colors">5vs5</button>
        <button onClick={layoutClassroom} className="px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] text-gray hover:bg-black/5 hover:text-black transition-colors">АНГИ</button>
        <button onClick={layout1v1} className="px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] text-gray hover:bg-black/5 hover:text-black transition-colors">1v1</button>
        <button onClick={clearLayout} className="px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] text-gray hover:bg-black/5 hover:text-black transition-colors">ЦЭВЭРЛЭХ</button>
        <button onClick={selectAllPlaced} className="px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] text-gray hover:bg-black/5 hover:text-black transition-colors">БҮГД СОНГОХ</button>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[9px] text-gray">GRID</span>
          <button onClick={() => setCols((c) => Math.max(MIN_COLS, c - 1))} className="h-6 w-6 border border-black/20 text-xs hover:bg-black/5">−</button>
          <span className="mono text-[10px]">{cols}×{rows}</span>
          <button onClick={() => setCols((c) => Math.min(MAX_COLS, c + 1))} className="h-6 w-6 border border-black/20 text-xs hover:bg-black/5">+</button>
          <button onClick={() => setRows((r) => Math.max(MIN_ROWS, r - 1))} className="h-6 w-6 border border-black/20 text-[9px] hover:bg-black/5">↑</button>
          <button onClick={() => setRows((r) => Math.min(MAX_ROWS, r + 1))} className="h-6 w-6 border border-black/20 text-[9px] hover:bg-black/5">↓</button>
          <span className="text-[9px] text-gray ml-2">ХЭМЖЭЭ</span>
          <input type="range" min={36} max={72} value={cellSize} onChange={(e) => setCellSize(Number(e.target.value))} className="w-16 accent-black" />
        </div>
      </div>

      {/* Mode indicator */}
      {mode !== "idle" && (
        <div className={`flex items-center justify-between px-4 py-2 text-[10px] uppercase tracking-[0.3em] md:px-8 ${
          mode === "picking" ? "bg-blue-50 text-blue-700" : "bg-yellow-50 text-yellow-700"
        }`}>
          <span>
            {mode === "picking"
              ? `${pickQueue.length} СОНГОСОН · ДАРААГИЙН: "${nextPick?.number}" — GRID ДЭЭР ДАРЖ НЭГ НЭГЭЭР БАЙРЛУУЛНА УУ`
              : `${selected.size} СОНГОСОН — СУМААР ЗӨӨХ · DELETE АРИЛГАХ · ХООСОН НҮД ДАРЖ ЗӨӨХ`}
          </span>
          <div className="flex items-center gap-3">
            {mode === "selected" && (
              <button onClick={unplaceSelected} className="font-black text-red-600 hover:underline">АРИЛГАХ ({selected.size})</button>
            )}
            <button onClick={clearAll_} className="font-black hover:underline">БОЛИХ</button>
          </div>
        </div>
      )}

      <div className="flex flex-1">
        {/* Sidebar */}
        <aside className="w-44 flex-shrink-0 border-r border-black bg-[#fafafa] md:w-52">
          <div className="sticky top-[95px] max-h-[calc(100vh-95px)] overflow-y-auto p-3 md:p-4">
            <p className="text-[10px] uppercase tracking-[0.3em] text-gray mb-1">БАЙРЛУУЛААГҮЙ ({unplaced.length})</p>
            <p className="text-[9px] text-gray/60 mb-3">Дарж сонгоод grid дээр дарна уу · Ctrl+Click олноор</p>

            {unplaced.length === 0 ? (
              <div className="border border-dashed border-green-300 bg-green-50 p-4 text-center">
                <span className="text-lg">✓</span>
                <p className="mt-1 text-[10px] text-green-600">Бүгд байрласан!</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-1.5">
                  {unplaced.map((s) => {
                    const inQueue = pickQueueSet.has(s.id);
                    const isNext = pickQueue[0] === s.id;
                    return (
                      <button
                        key={s.id}
                        onClick={(e) => togglePick(s.id, e.ctrlKey || e.metaKey || e.shiftKey)}
                        draggable
                        onDragStart={(e) => { e.dataTransfer.setData("text/plain", s.id); e.dataTransfer.effectAllowed = "move"; }}
                        className={`flex aspect-square items-center justify-center border text-[10px] font-black transition-all relative ${
                          isNext
                            ? "border-blue-500 bg-blue-500 text-white scale-105 shadow-md"
                            : inQueue
                            ? "border-blue-400 bg-blue-100 text-blue-700"
                            : "border-black/30 bg-white hover:border-black hover:bg-black hover:text-white"
                        }`}
                        title={`${s.number} · ${s.type.name} · Ctrl+Click олноор`}
                      >
                        {s.number}
                        {inQueue && (
                          <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center bg-blue-500 text-[7px] text-white rounded-full">
                            {pickQueue.indexOf(s.id) + 1}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-3 flex gap-1.5">
                  <button onClick={pickAllUnplaced}
                    className="flex-1 border border-blue-400 py-2 text-[9px] uppercase tracking-[0.2em] text-blue-600 hover:bg-blue-500 hover:text-white transition-colors">
                    БҮГД СОНГОХ
                  </button>
                  <button onClick={autoArrange}
                    className="flex-1 border border-black/30 py-2 text-[9px] uppercase tracking-[0.2em] text-gray hover:bg-black hover:text-white transition-colors">
                    АВТОМАТ
                  </button>
                </div>
              </>
            )}
          </div>
        </aside>

        {/* Grid */}
        <div className="flex-1 overflow-auto p-4 md:p-8">
          {floorSeats.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center text-center">
              <p className="display text-2xl text-gray/40">СУУДАЛ БАЙХГҮЙ</p>
              <p className="mt-2 text-xs text-gray">Энэ давхарт суудал нэмнэ үү</p>
              <Link href={`/owner/centers/${params.id}#seats`}
                className="mt-4 border border-black px-6 py-3 text-[10px] uppercase tracking-[0.3em] hover:bg-black hover:text-white transition-colors">
                СУУДАЛ НЭМЭХ →
              </Link>
            </div>
          ) : (
            <>
              <div
                ref={gridRef}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                className="relative mx-auto border border-black/20"
                style={{ width: cols * cellSize, height: rows * cellSize }}
              >
                {/* Grid cells */}
                {Array.from({ length: rows }).map((_, row) =>
                  Array.from({ length: cols }).map((_, col) => {
                    const key = `${col},${row}`;
                    const occupiedId = occupancy.get(key);
                    const isHover = hoverCell?.x === col && hoverCell?.y === row;
                    const canDrop = !occupiedId && (pickQueue.length > 0 || selected.size > 0 || unplaced.length > 0);

                    return (
                      <div
                        key={key}
                        onClick={(e) => handleCellClick(col, row, e)}
                        onMouseEnter={() => canDrop ? setHoverCell({ x: col, y: row }) : setHoverCell(null)}
                        onMouseLeave={() => setHoverCell(null)}
                        className={`absolute border-r border-b transition-colors ${
                          occupiedId ? "border-black/5"
                            : isHover && canDrop ? "border-black/10 bg-blue-100/60 cursor-pointer"
                            : canDrop ? "border-black/10 cursor-pointer hover:bg-black/3"
                            : "border-black/10"
                        }`}
                        style={{ left: col * cellSize, top: row * cellSize, width: cellSize, height: cellSize }}
                      >
                        {isHover && canDrop && !occupiedId && (
                          <div className="flex h-full w-full items-center justify-center text-[9px] text-blue-400 font-black">
                            {nextPick?.number ?? (selected.size > 0 ? `${selected.size}↗` : unplaced[0]?.number ?? "+")}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}

                {/* Row/col labels */}
                {Array.from({ length: rows }).map((_, row) => (
                  <div key={`r${row}`} className="absolute flex items-center justify-center mono text-[8px] text-gray/40 pointer-events-none"
                    style={{ left: -16, top: row * cellSize, width: 16, height: cellSize }}>{row + 1}</div>
                ))}
                {Array.from({ length: cols }).map((_, col) => (
                  <div key={`c${col}`} className="absolute flex items-center justify-center mono text-[8px] text-gray/40 pointer-events-none"
                    style={{ left: col * cellSize, top: -14, width: cellSize, height: 14 }}>{String.fromCharCode(65 + (col % 26))}</div>
                ))}

                {/* Placed seats */}
                {placed.map((s) => {
                  const isSel = selected.has(s.id);
                  return (
                    <div
                      key={s.id}
                      onClick={(e) => { e.stopPropagation(); toggleSelect(s.id, e.ctrlKey || e.metaKey || e.shiftKey); }}
                      draggable
                      onDragStart={(e) => { e.dataTransfer.setData("text/plain", s.id); e.dataTransfer.effectAllowed = "move"; }}
                      className={`absolute flex cursor-pointer items-center justify-center font-black transition-all group ${
                        isSel ? "bg-yellow-400 text-black border-2 border-yellow-600 z-20 shadow-lg"
                          : s.status === "OPEN" ? "bg-white text-black border border-black hover:border-2 hover:z-10"
                          : s.status === "OCCUPIED" ? "bg-black text-white border border-black"
                          : s.status === "REPAIR" ? "bg-white text-gray border border-dashed border-gray"
                          : "bg-gray/10 text-gray/50 border border-gray/20"
                      }`}
                      style={{
                        left: s.posX! * cellSize + 2, top: s.posY! * cellSize + 2,
                        width: cellSize - 4, height: cellSize - 4,
                        fontSize: cellSize > 48 ? 12 : 10,
                      }}
                      title={`${s.number} · ${s.type.name} · Ctrl+Click олноор`}
                    >
                      {s.number}
                      {isSel && (
                        <span className="absolute -left-1 -top-1 flex h-3.5 w-3.5 items-center justify-center bg-yellow-600 text-[7px] text-white z-30">✓</span>
                      )}
                      {!isSel && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setSeats(p => p.map(x => x.id === s.id ? { ...x, posX: null, posY: null } : x)); setDirty(true); setSaved(false); }}
                          className="absolute -right-1.5 -top-1.5 hidden h-4 w-4 items-center justify-center bg-black text-[8px] text-white group-hover:flex hover:bg-red-600 z-30"
                          title="Арилгах">✕</button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-[9px] uppercase tracking-[0.2em] text-gray/50">
                <span className="flex items-center gap-1.5"><span className="h-3 w-3 border border-black bg-white" /> СУЛ</span>
                <span className="flex items-center gap-1.5"><span className="h-3 w-3 border border-black bg-black" /> ТОГЛОЖ БУЙ</span>
                <span className="flex items-center gap-1.5"><span className="h-3 w-3 border border-dashed border-gray bg-white" /> ЗАСВАР</span>
                <span className="flex items-center gap-1.5"><span className="h-3 w-3 border-2 border-yellow-600 bg-yellow-400" /> СОНГОСОН</span>
                <span className="flex items-center gap-1.5"><span className="h-3 w-3 border border-blue-500 bg-blue-100" /> ДАРААЛАЛ</span>
                <span>·</span>
                <span>CTRL+CLICK ОЛНООР</span>
                <span>·</span>
                <span>СУМААР ЗӨӨХ</span>
                <span>·</span>
                <span>DELETE АРИЛГАХ</span>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
