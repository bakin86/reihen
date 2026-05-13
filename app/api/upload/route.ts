import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { requireOwner, authErrorResponse, AuthError } from "@/lib/auth";

const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/avif"];

function detectMime(bytes: Uint8Array): string | null {
  if (bytes.length < 12) return null;

  // JPEG: FF D8 FF
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) return "image/jpeg";

  // PNG: 89 50 4E 47
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) return "image/png";

  // WEBP: RIFF at 0-3 AND "WEBP" at bytes 8-11 (full signature, not just RIFF)
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) return "image/webp";

  // AVIF: ftyp box with "avif" or "avis" brand
  const ftyp = String.fromCharCode(...bytes.slice(4, 12));
  if (ftyp.startsWith("ftyp") && (ftyp.includes("avif") || ftyp.includes("avis"))) return "image/avif";

  return null;
}

// POST /api/upload — owner-only image upload
export async function POST(req: Request) {
  try {
    await requireOwner(req); // only OWNER or ADMIN can upload

    const formData = await req.formData();
    const files = formData.getAll("files") as File[];

    if (!files.length) {
      return NextResponse.json({ error: "No files" }, { status: 400 });
    }
    if (files.length > 10) {
      return NextResponse.json({ error: "Max 10 files per upload" }, { status: 400 });
    }

    const dir = path.join(process.cwd(), "public", "uploads", "centers");
    await mkdir(dir, { recursive: true });

    const urls: string[] = [];

    for (const file of files) {
      // Check declared MIME type
      if (!ALLOWED_MIME.includes(file.type)) {
        return NextResponse.json(
          { error: `Invalid file type: ${file.type}. Use JPG, PNG, WebP, or AVIF.` },
          { status: 400 }
        );
      }
      if (file.size > MAX_SIZE) {
        return NextResponse.json(
          { error: `File too large: ${file.name}. Max 5MB.` },
          { status: 400 }
        );
      }

      const bytes = new Uint8Array(await file.arrayBuffer());

      // Verify actual file content matches claimed type (magic byte check)
      const realMime = detectMime(bytes);
      if (!realMime || !ALLOWED_MIME.includes(realMime)) {
        return NextResponse.json(
          { error: `File content does not match type for: ${file.name}` },
          { status: 400 }
        );
      }

      // Use detected type for extension, not user-provided filename
      const EXT_MAP: Record<string, string> = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
        "image/avif": "avif",
      };
      const ext = EXT_MAP[realMime] ?? "jpg";
      const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      await writeFile(path.join(dir, name), bytes);
      urls.push(`/uploads/centers/${name}`);
    }

    return NextResponse.json({ urls });
  } catch (e) {
    if (e instanceof AuthError) return authErrorResponse(e);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
