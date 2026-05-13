export type Role = "CUSTOMER" | "STAFF" | "MANAGER" | "ADMIN";

export type SeatStatus = "AVAILABLE" | "OCCUPIED" | "RESERVED" | "MAINTENANCE" | "OFFLINE";

export type SeatTier = "STANDARD" | "PREMIUM" | "VIP" | "STREAMING" | "CONSOLE";

export type BookingStatus =
  | "PENDING"
  | "CONFIRMED"
  | "ACTIVE"
  | "COMPLETED"
  | "CANCELLED"
  | "NO_SHOW";

export type PaymentMethod = "CASH" | "QPAY" | "KHANBANK" | "GOLOMT" | "CARD" | "WALLET";

export interface SeatUpdateEvent {
  id: string;
  branchId: string;
  status: SeatStatus;
  code?: string;
}

export interface ApiError {
  error: string;
  code?: string;
}
