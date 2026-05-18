import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";

type SeatMirror = {
  id: string;
  status: string;
  code?: string;
  freeAt?: string | Date | null;
};

type BookingMirror = {
  id: string;
  status: string;
  paymentStatus?: string;
  code?: string;
};

type TournamentMirror = {
  id: string;
  status: string;
  teamCount: number;
};

function parseServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    try {
      return JSON.parse(Buffer.from(raw, "base64").toString("utf8"));
    } catch {
      return null;
    }
  }
}

function getAdminDb() {
  const databaseURL = process.env.FIREBASE_DATABASE_URL ?? process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL;
  const serviceAccount = parseServiceAccount();
  if (!databaseURL || !serviceAccount) return null;

  const app = getApps()[0] ?? initializeApp({
    credential: cert(serviceAccount),
    databaseURL,
  });

  return getDatabase(app);
}

export async function publishSeatUpdateToFirebase(centerId: string, seat: SeatMirror) {
  const db = getAdminDb();
  if (!db) return;

  await db.ref(`reihen/centers/${centerId}/seats/${seat.id}`).set({
    ...seat,
    freeAt: seat.freeAt instanceof Date ? seat.freeAt.toISOString() : seat.freeAt ?? null,
    updatedAt: Date.now(),
  });
}

export async function publishBookingUpdateToFirebase(centerId: string, booking: BookingMirror) {
  const db = getAdminDb();
  if (!db) return;

  await db.ref(`reihen/centers/${centerId}/bookings/${booking.id}`).set({
    ...booking,
    updatedAt: Date.now(),
  });
}

export async function publishTournamentUpdateToFirebase(centerId: string, tournament: TournamentMirror) {
  const db = getAdminDb();
  if (!db) return;

  await db.ref(`reihen/centers/${centerId}/tournaments/${tournament.id}`).set({
    ...tournament,
    updatedAt: Date.now(),
  });
}
