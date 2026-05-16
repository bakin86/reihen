import { prisma } from "./prisma";
import type { Prisma } from "@prisma/client";
import type { SessionPayload } from "./auth";

type AuditInput = {
  session: SessionPayload;
  centerId?: string | null;
  ownerId: string;
  action: string;
  targetType: string;
  targetId?: string | null;
  message: string;
  metadata?: Prisma.InputJsonObject;
};

export async function writeAuditLog(input: AuditInput) {
  await prisma.auditLog.create({
    data: {
      ownerId: input.ownerId,
      centerId: input.centerId ?? null,
      actorId: input.session.sub,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId ?? null,
      message: input.message,
      metadata: input.metadata ?? {},
    },
  });
}
