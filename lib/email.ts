import { Resend } from "resend";

const FROM = process.env.RESEND_FROM ?? "Reihen <noreply@reihen.mn>";

export async function sendPasswordResetEmail(email: string, resetUrl: string): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    // Dev fallback — log to console
    console.log(`[email:dev] password reset for ${email}: ${resetUrl}`);
    return;
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({
    from: FROM,
    to: email,
    subject: "Нууц үг сэргээх — Reihen",
    html: `
<!DOCTYPE html>
<html lang="mn">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:system-ui,-apple-system,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:48px 24px">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%">

        <!-- Logo -->
        <tr><td style="padding-bottom:40px">
          <span style="font-size:20px;font-weight:900;letter-spacing:-0.02em;color:#ffffff">REIHEN</span>
        </td></tr>

        <!-- Divider -->
        <tr><td style="border-top:1px solid rgba(255,255,255,0.08);padding-bottom:40px"></td></tr>

        <!-- Body -->
        <tr><td>
          <p style="margin:0 0 8px;font-size:11px;text-transform:uppercase;letter-spacing:0.3em;color:rgba(255,255,255,0.3)">
            Нууц үг сэргээх
          </p>
          <h1 style="margin:0 0 24px;font-size:28px;font-weight:900;color:#ffffff;letter-spacing:-0.02em;line-height:1.1">
            Нууц үгээ шинэчлэх
          </h1>
          <p style="margin:0 0 32px;font-size:14px;line-height:1.7;color:rgba(255,255,255,0.45)">
            Та нууц үг сэргээх хүсэлт илгээсэн байна.<br>
            Доорх товч дарж шинэ нууц үг тохируулаарай.<br>
            Хүсэлт илгээгээгүй бол энэ имэйлийг үл тоомсорлоно уу.
          </p>

          <!-- CTA Button -->
          <table cellpadding="0" cellspacing="0" style="margin-bottom:32px">
            <tr><td style="background:#ffffff;padding:0">
              <a href="${resetUrl}"
                style="display:inline-block;padding:14px 36px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.25em;color:#000000;text-decoration:none">
                НУУЦ ҮГ ШИНЭЧЛЭХ
              </a>
            </td></tr>
          </table>

          <p style="margin:0 0 8px;font-size:12px;color:rgba(255,255,255,0.25)">
            Эсвэл доорх холбоосыг хуулж хөтөч дээр нээнэ үү:
          </p>
          <p style="margin:0 0 40px;font-size:11px;color:rgba(255,255,255,0.2);word-break:break-all">
            ${resetUrl}
          </p>
        </td></tr>

        <!-- Divider -->
        <tr><td style="border-top:1px solid rgba(255,255,255,0.06);padding-top:32px">
          <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.15)">
            Энэ холбоос <strong style="color:rgba(255,255,255,0.25)">15 минут</strong> хүчинтэй.<br>
            © ${new Date().getFullYear()} Reihen · Улаанбаатар
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`,
  });
}
