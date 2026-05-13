import webpush from "web-push";
import { prisma } from "./prisma";

const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const priv = process.env.VAPID_PRIVATE_KEY;
const subject = process.env.VAPID_SUBJECT ?? "mailto:admin@reihen.mn";

if (pub && priv) {
  try {
    webpush.setVapidDetails(subject, pub, priv);
  } catch {
    // invalid VAPID keys in dev — ignored
  }
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

/** Send push to every subscription a user owns. No-op if keys not configured. */
export async function sendPushToUser(userId: string, payload: PushPayload) {
  if (!pub || !priv) {
    console.log(`[push:mock] → user=${userId}`, payload);
    return { sent: 0, mocked: true };
  }
  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  let sent = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload)
        );
        sent += 1;
      } catch (e: any) {
        if (e?.statusCode === 404 || e?.statusCode === 410) {
          await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
        }
      }
    })
  );
  return { sent, mocked: false };
}

export { webpush };
