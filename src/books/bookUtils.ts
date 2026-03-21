import mammoth from "mammoth";
import {
  GlobalWorkerOptions,
  getDocument,
} from "pdfjs-dist/legacy/build/pdf.mjs";
import pdfWorkerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";
import type { VRSettings } from "../types";

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const READER_CANVAS_SIZE = 1600;
const READER_INSET_X = 118;
const READER_INSET_Y = 110;
const READER_TEXT_WIDTH = READER_CANVAS_SIZE - READER_INSET_X * 2;
const SOFT_MARGIN = 140;

type BookFormat = "docx" | "fb2" | "html" | "pdf" | "txt";
type BlockTone =
  | "heading"
  | "meta"
  | "paragraph"
  | "quote"
  | "subtitle"
  | "title";

export type BookBlock = {
  tone: BlockTone;
  text: string;
};

export type BookContent = {
  kind: "document";
  fileKey: string;
  fileName: string;
  format: BookFormat;
  title: string;
  blocks: BookBlock[];
};

type BlockStyle = {
  align: CanvasTextAlign;
  color: string;
  font: string;
  lineHeight: number;
  marginBottom: number;
  marginTop: number;
  maxWidth: number;
  x: number;
};

type ReaderLine = {
  align: CanvasTextAlign;
  color: string;
  font: string;
  lineHeight: number;
  text: string;
  x: number;
  y: number;
};

export type ReaderLayout = {
  lines: ReaderLine[];
  maxScrollTop: number;
  totalHeight: number;
};

type PdfTextItemLike = {
  hasEOL?: boolean;
  height?: number;
  str: string;
  transform: number[];
  width?: number;
};

type ReaderTypography = Pick<VRSettings, "readerFontFamily" | "readerFontSize">;

const createBlockStyles = (
  typography: ReaderTypography,
): Record<BlockTone, BlockStyle> => {
  const baseSize = typography.readerFontSize;
  const family =
    typography.readerFontFamily === "serif"
      ? "'Georgia', 'Times New Roman', serif"
      : "'Space Grotesk', sans-serif";
  const titleSize = Math.round(baseSize * 1.7);
  const subtitleSize = Math.round(baseSize * 1.18);
  const headingSize = Math.round(baseSize * 1.24);
  const metaSize = Math.max(24, Math.round(baseSize * 0.72));
  const quoteSize = Math.max(30, Math.round(baseSize * 0.94));

  return {
    title: {
      font: `700 ${titleSize}px ${family}`,
      color: "#22170a",
      lineHeight: Math.round(titleSize * 1.28),
      marginTop: 0,
      marginBottom: Math.round(baseSize * 0.9),
      maxWidth: READER_TEXT_WIDTH,
      x: READER_CANVAS_SIZE / 2,
      align: "center",
    },
    subtitle: {
      font: `600 ${subtitleSize}px ${family}`,
      color: "#5b4421",
      lineHeight: Math.round(subtitleSize * 1.34),
      marginTop: Math.round(baseSize * 0.2),
      marginBottom: Math.round(baseSize * 0.6),
      maxWidth: READER_TEXT_WIDTH,
      x: READER_CANVAS_SIZE / 2,
      align: "center",
    },
    heading: {
      font: `700 ${headingSize}px ${family}`,
      color: "#2b1d0c",
      lineHeight: Math.round(headingSize * 1.32),
      marginTop: Math.round(baseSize * 0.55),
      marginBottom: Math.round(baseSize * 0.44),
      maxWidth: READER_TEXT_WIDTH,
      x: READER_INSET_X,
      align: "left",
    },
    meta: {
      font: `600 ${metaSize}px 'JetBrains Mono', monospace`,
      color: "#79603a",
      lineHeight: Math.round(metaSize * 1.4),
      marginTop: 0,
      marginBottom: Math.round(baseSize * 0.7),
      maxWidth: READER_TEXT_WIDTH,
      x: READER_CANVAS_SIZE / 2,
      align: "center",
    },
    paragraph: {
      font: `400 ${baseSize}px ${family}`,
      color: "#251a0d",
      lineHeight: Math.round(baseSize * 1.45),
      marginTop: 0,
      marginBottom: Math.round(baseSize * 0.48),
      maxWidth: READER_TEXT_WIDTH,
      x: READER_INSET_X,
      align: "left",
    },
    quote: {
      font: `400 italic ${quoteSize}px ${family}`,
      color: "#4f3b1f",
      lineHeight: Math.round(quoteSize * 1.42),
      marginTop: Math.round(baseSize * 0.16),
      marginBottom: Math.round(baseSize * 0.52),
      maxWidth: READER_TEXT_WIDTH - 80,
      x: READER_INSET_X + 40,
      align: "left",
    },
  };
};

const blockTags = new Set([
  "article",
  "aside",
  "blockquote",
  "body",
  "div",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "header",
  "li",
  "main",
  "nav",
  "ol",
  "p",
  "pre",
  "section",
  "ul",
]);

const normalizeWhitespace = (value: string) =>
  value
    .replace(/\r/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ ]{2,}/g, " ")
    .trim();

const normalizeInlineText = (value: string) =>
  normalizeWhitespace(
    value
      .replace(/\s+/g, " ")
      .replace(/ ?([,.;:!?])/g, "$1")
      .replace(/([([{]) /g, "$1")
      .replace(/ {2,}/g, " "),
  );

const fileBaseName = (fileName: string) =>
  fileName.replace(/\.[^/.]+$/, "").trim() || "Книга";

const buildFileKey = (file: File) =>
  [file.name, file.size, file.type || "unknown"].join(":");

const asArrayBuffer = async (file: File) => {
  const buffer = await file.arrayBuffer();
  return buffer.slice(0);
};

const pushBlock = (blocks: BookBlock[], tone: BlockTone, text: string) => {
  const normalized =
    tone === "paragraph" || tone === "quote"
      ? normalizeInlineText(text)
      : normalizeWhitespace(text);
  if (!normalized) {
    return;
  }
  blocks.push({ tone, text: normalized });
};

const extractHtmlBlocks = (node: Node, blocks: BookBlock[]) => {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = normalizeInlineText(node.textContent ?? "");
    if (text && node.parentNode?.nodeName.toLowerCase() === "body") {
      pushBlock(blocks, "paragraph", text);
    }
    return;
  }

  if (!(node instanceof Element)) {
    return;
  }

  const tag = node.tagName.toLowerCase();
  if (!blockTags.has(tag)) {
    Array.from(node.childNodes).forEach((child) =>
      extractHtmlBlocks(child, blocks),
    );
    return;
  }

  if (tag === "p") {
    pushBlock(blocks, "paragraph", node.textContent ?? "");
    return;
  }

  if (tag === "blockquote") {
    pushBlock(blocks, "quote", node.textContent ?? "");
    return;
  }

  if (tag === "li") {
    pushBlock(blocks, "paragraph", `• ${node.textContent ?? ""}`);
    return;
  }

  if (tag === "pre") {
    pushBlock(blocks, "quote", node.textContent ?? "");
    return;
  }

  if (/^h[1-6]$/.test(tag)) {
    const level = Number(tag[1]);
    pushBlock(
      blocks,
      level <= 2 ? "heading" : "subtitle",
      node.textContent ?? "",
    );
    return;
  }

  Array.from(node.childNodes).forEach((child) =>
    extractHtmlBlocks(child, blocks),
  );
};

const parseHtmlDocument = (
  html: string,
  fileName: string,
  format: "docx" | "html",
): BookContent => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const title = normalizeWhitespace(
    doc.querySelector("title")?.textContent ??
      doc.querySelector("h1")?.textContent ??
      fileBaseName(fileName),
  );
  const blocks: BookBlock[] = [];

  extractHtmlBlocks(doc.body || doc.documentElement, blocks);

  if (blocks.length === 0) {
    pushBlock(
      blocks,
      "paragraph",
      doc.body?.innerText ?? doc.documentElement.textContent ?? "",
    );
  }

  return {
    kind: "document",
    fileKey: "",
    fileName,
    format,
    title: title || fileBaseName(fileName),
    blocks,
  };
};

const parseTxt = (text: string, fileName: string): BookContent => {
  const chunks = normalizeWhitespace(text)
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);

  const blocks = chunks.map<BookBlock>((textChunk) => ({
    tone: "paragraph",
    text: normalizeInlineText(textChunk),
  }));

  if (blocks.length === 0) {
    blocks.push({ tone: "paragraph", text: "Файл пустой." });
  }

  return {
    kind: "document",
    fileKey: "",
    fileName,
    format: "txt",
    title: fileBaseName(fileName),
    blocks,
  };
};

const findFb2Children = (root: Element, localName: string) =>
  Array.from(root.getElementsByTagName("*")).filter(
    (node) => node.localName === localName,
  );

const parseFb2 = (text: string, fileName: string): BookContent => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, "application/xml");
  const parseError = doc.querySelector("parsererror");
  if (parseError) {
    throw new Error("Некорректный FB2 файл");
  }

  const title =
    findFb2Children(
      doc.documentElement,
      "book-title",
    )[0]?.textContent?.trim() || fileBaseName(fileName);

  const body = findFb2Children(doc.documentElement, "body")[0];
  const blocks: BookBlock[] = [];

  const walk = (node: Node) => {
    if (!(node instanceof Element)) {
      return;
    }

    const name = node.localName ?? node.nodeName.toLowerCase();
    if (name === "title") {
      const content = Array.from(node.children)
        .map((child) => child.textContent ?? "")
        .join(" ");
      pushBlock(blocks, "heading", content);
      return;
    }

    if (name === "subtitle") {
      pushBlock(blocks, "subtitle", node.textContent ?? "");
      return;
    }

    if (
      name === "epigraph" ||
      name === "cite" ||
      name === "stanza" ||
      name === "poem"
    ) {
      pushBlock(blocks, "quote", node.textContent ?? "");
      return;
    }

    if (name === "p" || name === "v") {
      pushBlock(blocks, "paragraph", node.textContent ?? "");
      return;
    }

    Array.from(node.childNodes).forEach(walk);
  };

  if (body) {
    Array.from(body.childNodes).forEach(walk);
  }

  if (blocks.length === 0) {
    const fallback = doc.documentElement.textContent ?? "";
    pushBlock(blocks, "paragraph", fallback);
  }

  return {
    kind: "document",
    fileKey: "",
    fileName,
    format: "fb2",
    title,
    blocks,
  };
};

const parseDocx = async (file: File) => {
  const result = await mammoth.convertToHtml({
    arrayBuffer: await asArrayBuffer(file),
  });
  const parsed = parseHtmlDocument(result.value, file.name, "docx");
  if (parsed.blocks.length === 0) {
    throw new Error("Не удалось извлечь текст из DOCX");
  }
  return parsed;
};

const splitLongWord = (
  context: CanvasRenderingContext2D,
  word: string,
  maxWidth: number,
) => {
  const chunks: string[] = [];
  let rest = word;

  while (rest.length > 0) {
    let sliceLength = rest.length;
    while (
      sliceLength > 1 &&
      context.measureText(rest.slice(0, sliceLength)).width > maxWidth
    ) {
      sliceLength -= 1;
    }
    chunks.push(rest.slice(0, sliceLength));
    rest = rest.slice(sliceLength);
  }

  return chunks;
};

const wrapText = (
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
) => {
  const words = normalizeWhitespace(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (context.measureText(candidate).width <= maxWidth) {
      line = candidate;
      continue;
    }

    if (line) {
      lines.push(line);
      line = "";
    }

    if (context.measureText(word).width <= maxWidth) {
      line = word;
      continue;
    }

    const pieces = splitLongWord(context, word, maxWidth);
    for (const piece of pieces.slice(0, -1)) {
      lines.push(piece);
    }
    line = pieces[pieces.length - 1] ?? "";
  }

  if (line) {
    lines.push(line);
  }

  return lines.length > 0 ? lines : [""];
};

const getMeasureContext = () => {
  if (typeof document === "undefined") {
    return null;
  }
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  return canvas.getContext("2d");
};

const uniqueBlocks = (blocks: BookBlock[], title: string) => {
  const normalizedTitle = normalizeWhitespace(title).toLowerCase();
  return blocks.filter((block, index) => {
    if (index !== 0) {
      return true;
    }
    return normalizeWhitespace(block.text).toLowerCase() !== normalizedTitle;
  });
};

const finalizeBook = (book: BookContent, file: File): BookContent => ({
  ...book,
  fileKey: buildFileKey(file),
  blocks: uniqueBlocks(book.blocks, book.title),
});

type PdfLine = {
  fontSize: number;
  text: string;
  y: number;
};

const parsePdfPageLines = (items: PdfTextItemLike[]) => {
  const rows: Array<{
    items: Array<{ fontSize: number; text: string; width: number; x: number }>;
    y: number;
  }> = [];

  const sorted = [...items]
    .filter((item) => normalizeInlineText(item.str).length > 0)
    .sort((left, right) => {
      const y = right.transform[5] - left.transform[5];
      if (Math.abs(y) > 0.5) {
        return y;
      }
      if (!left.transform[4] || !right.transform[4]) {
        return;
      }
      return left.transform[4] - right.transform[4];
    });

  for (const item of sorted) {
    const y = item.transform[5];
    const fontSize = Math.max(
      10,
      Math.abs(item.height ?? item.transform[0] ?? item.transform[3] ?? 16),
    );
    const tolerance = Math.max(3, fontSize * 0.35);
    const row = rows.find(
      (candidate) => Math.abs(candidate.y - y) <= tolerance,
    );
    const normalizedText = normalizeInlineText(item.str);
    const payload = {
      text: normalizedText,
      x: item.transform[4],
      width: Math.max(
        item.width ?? normalizedText.length * fontSize * 0.42,
        fontSize * 0.35,
      ),
      fontSize,
    };

    if (row) {
      row.items.push(payload);
    } else {
      rows.push({ y, items: [payload] });
    }
  }

  return rows
    .sort((left, right) => right.y - left.y)
    .map<PdfLine>((row) => {
      const parts = row.items.sort((left, right) => left.x - right.x);
      let text = "";
      let fontSize = 0;
      let prevEnd = 0;

      for (const part of parts) {
        const gap = part.x - prevEnd;
        if (text && gap > Math.max(2, part.fontSize * 0.15)) {
          text += " ";
        }
        text += part.text;
        prevEnd = part.x + part.width;
        fontSize = Math.max(fontSize, part.fontSize);
      }

      return {
        text: normalizeInlineText(text),
        y: row.y,
        fontSize,
      };
    })
    .filter((line) => line.text.length > 0);
};

const mergePdfLinesToBlocks = (lines: PdfLine[], blocks: BookBlock[]) => {
  if (lines.length === 0) {
    return;
  }

  const fontSizes = lines
    .map((line) => line.fontSize)
    .sort((left, right) => left - right);
  const median = fontSizes[Math.floor(fontSizes.length / 2)] ?? 16;

  let buffer = "";
  let previous: PdfLine | null = null;

  const flushBuffer = () => {
    if (!buffer) {
      return;
    }
    pushBlock(blocks, "paragraph", buffer);
    buffer = "";
  };

  for (const line of lines) {
    const isHeading = line.fontSize >= median * 1.35 && line.text.length <= 90;
    if (isHeading) {
      flushBuffer();
      pushBlock(blocks, "heading", line.text);
      previous = line;
      continue;
    }

    if (!previous) {
      buffer = line.text;
      previous = line;
      continue;
    }

    const gap = previous.y - line.y;
    const paragraphBreak =
      gap > Math.max(previous.fontSize, line.fontSize) * 1.4;
    if (paragraphBreak) {
      flushBuffer();
      buffer = line.text;
      previous = line;
      continue;
    }

    if (buffer.endsWith("-")) {
      buffer = `${buffer.slice(0, -1)}${line.text}`;
    } else {
      buffer = `${buffer} ${line.text}`;
    }
    previous = line;
  }

  flushBuffer();
};

const parsePdf = async (file: File) => {
  const loadingTask = getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
  });

  try {
    const pdf = await loadingTask.promise;
    const blocks: BookBlock[] = [];

    for (let pageIndex = 1; pageIndex <= pdf.numPages; pageIndex += 1) {
      const page = await pdf.getPage(pageIndex);
      const textContent = await page.getTextContent();
      const pageLines = parsePdfPageLines(
        textContent.items.filter(
          (item): item is PdfTextItemLike => "str" in item,
        ),
      );

      if (pageLines.length > 0) {
        mergePdfLinesToBlocks(pageLines, blocks);
      }
    }

    if (blocks.length === 0) {
      throw new Error("В PDF не найден текстовый слой");
    }

    const firstHeading = blocks.find((block) => block.tone === "heading")?.text;

    return {
      kind: "document" as const,
      fileKey: "",
      fileName: file.name,
      format: "pdf" as const,
      title: firstHeading || fileBaseName(file.name),
      blocks,
    };
  } finally {
    await loadingTask.destroy();
  }
};

export const parseBookFile = async (file: File): Promise<BookContent> => {
  const extension = file.name.toLowerCase().split(".").pop() ?? "";

  if (file.type === "application/pdf" || extension === "pdf") {
    return finalizeBook(await parsePdf(file), file);
  }

  if (extension === "docx") {
    return finalizeBook(await parseDocx(file), file);
  }

  if (extension === "txt" || file.type.startsWith("text/plain")) {
    return finalizeBook(parseTxt(await file.text(), file.name), file);
  }

  if (extension === "fb2" || file.type.includes("xml")) {
    return finalizeBook(parseFb2(await file.text(), file.name), file);
  }

  if (
    extension === "html" ||
    extension === "htm" ||
    file.type.includes("html")
  ) {
    return finalizeBook(
      parseHtmlDocument(await file.text(), file.name, "html"),
      file,
    );
  }

  throw new Error("Поддерживаются PDF, FB2, TXT, DOCX и HTML файлы");
};

export const createReaderLayout = (
  book: BookContent,
  typography: ReaderTypography,
): ReaderLayout => {
  const context = getMeasureContext();
  if (!context) {
    return {
      lines: [],
      totalHeight: READER_CANVAS_SIZE,
      maxScrollTop: 0,
    };
  }

  const blockStyles = createBlockStyles(typography);
  const lines: ReaderLine[] = [];
  let cursorY = READER_INSET_Y;

  const addBlock = (tone: BlockTone, text: string) => {
    const style = blockStyles[tone];
    context.font = style.font;
    cursorY += style.marginTop;

    const wrappedLines = wrapText(context, text, style.maxWidth);
    for (const line of wrappedLines) {
      lines.push({
        align: style.align,
        color: style.color,
        font: style.font,
        lineHeight: style.lineHeight,
        text: line,
        x: style.x,
        y: cursorY,
      });
      cursorY += style.lineHeight;
    }

    cursorY += style.marginBottom;
  };

  addBlock("title", book.title);
  addBlock("meta", `${book.fileName} · ${book.format.toUpperCase()}`);

  for (const block of book.blocks) {
    addBlock(block.tone, block.text);
  }

  cursorY += SOFT_MARGIN;

  return {
    lines,
    totalHeight: Math.max(READER_CANVAS_SIZE, cursorY),
    maxScrollTop: Math.max(0, cursorY - READER_CANVAS_SIZE),
  };
};

const drawRoundedRect = (
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) => {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(
    x + width,
    y + height,
    x + width - radius,
    y + height,
  );
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
};

export const drawReaderToCanvas = (
  canvas: HTMLCanvasElement,
  layout: ReaderLayout,
  scrollTop: number,
) => {
  const width = READER_CANVAS_SIZE;
  const height = READER_CANVAS_SIZE;
  const clampedScrollTop = Math.min(
    layout.maxScrollTop,
    Math.max(0, scrollTop),
  );

  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }

  const background = context.createLinearGradient(0, 0, 0, height);
  background.addColorStop(0, "#ecd9a1");
  background.addColorStop(1, "#d8bb75");
  context.fillStyle = background;
  context.fillRect(0, 0, width, height);

  context.save();
  drawRoundedRect(context, 36, 36, width - 72, height - 72, 46);
  context.fillStyle = "#f8edc2";
  context.fill();
  context.restore();

  context.save();
  context.strokeStyle = "rgba(95, 67, 28, 0.12)";
  context.lineWidth = 4;
  drawRoundedRect(context, 36, 36, width - 72, height - 72, 46);
  context.stroke();
  context.restore();

  const viewportTop = clampedScrollTop - 80;
  const viewportBottom = clampedScrollTop + height + 80;

  context.save();
  context.translate(0, -clampedScrollTop);

  for (const line of layout.lines) {
    const lineBottom = line.y + line.lineHeight;
    if (lineBottom < viewportTop || line.y > viewportBottom) {
      continue;
    }
    context.font = line.font;
    context.textAlign = line.align;
    context.textBaseline = "top";
    context.fillStyle = line.color;
    context.fillText(line.text, line.x, line.y);
  }

  context.restore();

  const progress =
    layout.maxScrollTop > 0 ? clampedScrollTop / layout.maxScrollTop : 1;
  context.fillStyle = "rgba(98, 71, 24, 0.14)";
  context.fillRect(width - 32, 54, 8, height - 108);
  context.fillStyle = "#7b5718";
  context.fillRect(width - 32, 54, 8, Math.max(48, (height - 108) * progress));
};

export const readerCanvasSize = READER_CANVAS_SIZE;
