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
  const writeAndClose = async () => {
    try {
      await writer.write(copy);
      await writer.close();
    } catch {
      // Stream error will be caught by reader Response
    }
  };
  void writeAndClose();
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

function trimStreamBytes(bytes: Uint8Array): Uint8Array {
  let start = 0;
  let end = bytes.length;
  while (start < end && (bytes[start] === 0x0a || bytes[start] === 0x0d || bytes[start] === 0x20)) {
    start++;
  }
  while (end > start && (bytes[end - 1] === 0x0a || bytes[end - 1] === 0x0d || bytes[end - 1] === 0x20)) {
    end--;
  }
  return bytes.subarray(start, end);
}

function pdfUnescape(value: string) {
  return value
    .replace(/\\([nrtbf])/g, (_, c) => ({ n: "\n", r: "\n", t: "\t", b: "", f: "" }[c as string] ?? ""))
    .replace(/\\(\d{1,3})/g, (_, o) => String.fromCharCode(parseInt(o, 8)))
    .replace(/\\(.)/g, "$1");
}

function decodeHexPdf(hex: string): string {
  const clean = hex.replace(/[^0-9a-fA-F]/g, "");
  if (clean.length < 2) return "";
  const len = Math.floor(clean.length / 2);
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }

  // Check if UTF-16BE (starts with 0xFEFF or has null high bytes like 00 41 00 42)
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder("utf-16be", { fatal: false }).decode(bytes.subarray(2));
  }
  let nullCount = 0;
  for (let i = 0; i < bytes.length; i += 2) {
    if (bytes[i] === 0x00 && bytes[i + 1] !== 0x00) nullCount++;
  }
  if (nullCount >= Math.floor(bytes.length / 4) && bytes.length >= 4) {
    return new TextDecoder("utf-16be", { fatal: false }).decode(bytes);
  }

  // Fallback to utf-8 / latin1
  return decodeUtf8(bytes);
}

function pdfTextFromContent(content: string): string {
  let out = "";
  // Match both literal strings (...) and hex strings <...>
  // Also handle TJ array patterns: [(text) -100 (more)] TJ or [<0041> 5 <0042>] TJ
  const blocks = content.split(/(?:\bET\b|\bTd\b|\bTD\b|\bT\*\b)/);
  for (const block of blocks) {
    const tokenRe = /\((?:\\.|[^\\()])*\)|<[0-9a-fA-F\s]+>|(-?\d+(?:\.\d+)?)/g;
    let m: RegExpExecArray | null;
    let line = "";
    while ((m = tokenRe.exec(block)) !== null) {
      const match = m[0];
      if (match.startsWith("(") && match.endsWith(")")) {
        line += pdfUnescape(match.slice(1, -1));
      } else if (match.startsWith("<") && match.endsWith(">")) {
        line += decodeHexPdf(match.slice(1, -1));
      } else {
        // Kerning number: large negative spacing represents word gap
        const num = parseFloat(match);
        if (num < -120 && line.length > 0 && !line.endsWith(" ")) {
          line += " ";
        }
      }
    }
    if (line.trim()) out += line.trim() + "\n";
  }
  return out;
}

async function extractPdf(bytes: Uint8Array): Promise<string> {
  const raw = latin1(bytes);
  let text = "";
  // Ensure we match 'stream' but NOT 'endstream'
  const streamRe = /(?<!end)stream\r?\n/g;
  let m: RegExpExecArray | null;
  let extracted = 0;

  while ((m = streamRe.exec(raw)) !== null && extracted < 500) {
    const start = m.index + m[0].length;
    const end = raw.indexOf("endstream", start);
    if (end < 0) break;
    streamRe.lastIndex = end + 9;
    const slice = trimStreamBytes(bytes.subarray(start, end));
    extracted += 1;
    let content = "";

    // 1. Try zlib inflate
    try {
      content = decodeUtf8(await inflate(slice, "deflate"));
    } catch {
      // 2. Try raw deflate
      try {
        content = decodeUtf8(await inflate(slice, "deflate-raw"));
      } catch {
        content = latin1(slice);
      }
    }

    if (!content) continue;
    if (/(Tj|TJ|'|")/.test(content)) {
      text += pdfTextFromContent(content) + "\n";
    }
  }

  // Fallback: If content streams didn't extract enough words, scan uncompressed PDF text blocks
  if (text.replace(/\s+/g, " ").trim().length < 50) {
    // Scan for all (literal text) occurrences across readable parts of the PDF
    const literalMatches = raw.match(/\((?:\\.|[^\\()]){4,}\)\s*(?:Tj|'|")/g) ?? [];
    if (literalMatches.length > 0) {
      const fallbackLines = literalMatches
        .map((lm) => {
          const inner = lm.match(/\((?:\\.|[^\\()])*\)/)?.[0];
          return inner ? pdfUnescape(inner.slice(1, -1)) : "";
        })
        .filter((l) => l.trim().length > 2);
      text += "\n" + fallbackLines.join(" ");
    }
  }

  return text.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

/* ---------------------------------------------------------------- public */

export async function extractText(buffer: ArrayBuffer, fileName: string): Promise<{ text: string; method: string }> {
  const bytes = new Uint8Array(buffer);
  const ext = (fileName.split(".").pop() ?? "").toLowerCase();
  const isPdf = ext === "pdf" || (bytes[0] === 0x25 && bytes[1] === 0x50);

  let rawText = "";
  let method = "plain-text";

  if (ext === "docx") {
    rawText = await extractDocx(bytes);
    if (rawText.length > 40) method = "docx-xml";
  }
  if (!rawText && isPdf) {
    rawText = await extractPdf(bytes);
    if (rawText.length > 40) method = "pdf-content-stream";
  }

  // Only decode raw binary as UTF-8 for plaintext files — NEVER decode raw PDF byte streams as English text
  if (!rawText && !isPdf && ext !== "docx") {
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
