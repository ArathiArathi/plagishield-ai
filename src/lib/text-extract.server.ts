/**
 * Server-only plain-text extraction for uploaded documents.
 * Supports TXT/MD/CSV directly, DOCX (zip + deflate-raw) and PDF
 * (FlateDecode streams + text-showing operators) using Web Streams only,
 * so it runs inside the edge/worker runtime with no native dependencies.
 */

async function inflate(bytes: Uint8Array, format: "deflate" | "deflate-raw" | "gzip"): Promise<Uint8Array> {
  const ds = new DecompressionStream(format);
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  const writer = ds.writable.getWriter();
  void writer.write(copy);
  void writer.close();
  return new Uint8Array(await new Response(ds.readable).arrayBuffer());
}


function decodeUtf8(bytes: Uint8Array) {
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

/* ------------------------------------------------------------------ DOCX */

type ZipEntry = { name: string; data: Uint8Array };

async function readZipEntry(bytes: Uint8Array, wanted: string): Promise<ZipEntry | null> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // Scan local file headers (PK\x03\x04)
  for (let i = 0; i + 30 < bytes.length; i++) {
    if (bytes[i] !== 0x50 || bytes[i + 1] !== 0x4b || bytes[i + 2] !== 0x03 || bytes[i + 3] !== 0x04) continue;
    const method = view.getUint16(i + 8, true);
    let compressedSize = view.getUint32(i + 18, true);
    const nameLen = view.getUint16(i + 26, true);
    const extraLen = view.getUint16(i + 28, true);
    const nameStart = i + 30;
    const name = decodeUtf8(bytes.subarray(nameStart, nameStart + nameLen));
    const dataStart = nameStart + nameLen + extraLen;
    if (name !== wanted) continue;
    if (compressedSize === 0) {
      // streamed entry — read until next local header / central directory
      let end = bytes.length;
      for (let j = dataStart; j + 4 < bytes.length; j++) {
        if (bytes[j] === 0x50 && bytes[j + 1] === 0x4b && (bytes[j + 2] === 0x03 || bytes[j + 2] === 0x01 || bytes[j + 2] === 0x07)) {
          end = j;
          break;
        }
      }
      compressedSize = end - dataStart;
    }
    const raw = bytes.subarray(dataStart, dataStart + compressedSize);
    if (method === 0) return { name, data: raw };
    if (method === 8) {
      try {
        return { name, data: await inflate(raw, "deflate-raw") };
      } catch {
        return null;
      }
    }
    return null;
  }
  return null;
}

async function extractDocx(bytes: Uint8Array): Promise<string> {
  const entry = await readZipEntry(bytes, "word/document.xml");
  if (!entry) return "";
  const xml = decodeUtf8(entry.data);
  return xml
    .replace(/<w:p[ >]/g, "\n<w:p ")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<w:tab[^>]*\/>/g, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/* ------------------------------------------------------------------- PDF */

function latin1(bytes: Uint8Array) {
  let s = "";
  const chunk = 8192;
  for (let i = 0; i < bytes.length; i += chunk) {
    s += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return s;
}

function pdfUnescape(value: string) {
  return value
    .replace(/\\([nrtbf])/g, (_, c) => ({ n: "\n", r: "\n", t: "\t", b: "", f: "" }[c as string] ?? ""))
    .replace(/\\(\d{1,3})/g, (_, o) => String.fromCharCode(parseInt(o, 8)))
    .replace(/\\(.)/g, "$1");
}

function pdfTextFromContent(content: string): string {
  let out = "";
  // (text) Tj   |   [(a) -2 (b)] TJ
  const re = /\((?:\\.|[^\\()])*\)/g;
  const blocks = content.split(/(?:\bET\b|\bTd\b|\bTD\b|\bT\*\b)/);
  for (const block of blocks) {
    const parts = block.match(re);
    if (!parts) continue;
    const line = parts.map((p) => pdfUnescape(p.slice(1, -1))).join("");
    if (line.trim()) out += line + "\n";
  }
  return out;
}

async function extractPdf(bytes: Uint8Array): Promise<string> {
  const raw = latin1(bytes);
  let text = "";
  const streamRe = /stream\r?\n?/g;
  let m: RegExpExecArray | null;
  let extracted = 0;
  while ((m = streamRe.exec(raw)) !== null && extracted < 400) {
    const start = m.index + m[0].length;
    const end = raw.indexOf("endstream", start);
    if (end < 0) break;
    streamRe.lastIndex = end;
    const slice = bytes.subarray(start, end);
    extracted += 1;
    let content = "";
    if (slice[0] === 0x78) {
      try {
        content = decodeUtf8(await inflate(slice, "deflate"));
      } catch {
        content = "";
      }
    } else {
      content = latin1(slice);
    }
    if (!content) continue;
    if (!/(Tj|TJ)/.test(content)) continue;
    text += pdfTextFromContent(content);
  }
  return text.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

/* ---------------------------------------------------------------- public */

export async function extractText(buffer: ArrayBuffer, fileName: string): Promise<{ text: string; method: string }> {
  const bytes = new Uint8Array(buffer);
  const ext = (fileName.split(".").pop() ?? "").toLowerCase();

  let rawText = "";
  let method = "plain-text";

  if (ext === "docx") {
    rawText = await extractDocx(bytes);
    if (rawText.length > 40) method = "docx-xml";
  }
  if (!rawText && (ext === "pdf" || (bytes[0] === 0x25 && bytes[1] === 0x50))) {
    rawText = await extractPdf(bytes);
    if (rawText.length > 40) method = "pdf-content-stream";
  }

  if (!rawText) {
    const plain = decodeUtf8(bytes)
      .replace(/\u0000/g, "")
      .replace(/[^\S\n]+/g, " ")
      .trim();
    rawText = plain.replace(/[^\x09\x0A\x0D\x20-\x7E\u00A0-\u024F\u2018-\u201D\u2013\u2014]/g, "");
    method = "plain-text";
  }

  // CRITICAL: Strip null bytes (\u0000) and control characters that trigger Postgres error 22P05
  const sanitized = rawText
    .replace(/\0/g, "")
    .replace(/\u0000/g, "")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, " ")
    .trim();

  return { text: sanitized, method };
}
