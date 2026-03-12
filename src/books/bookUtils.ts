export type TextBookContent = {
  kind: "text";
  format: "html" | "fb2";
  pages: string[];
};

export type PdfBookContent = {
  kind: "pdf";
  objectUrl: string;
};

export type BookContent = TextBookContent | PdfBookContent;

const PAGE_SIZE = 1800;

const normalizeWhitespace = (value: string) =>
  value
    .replace(/\r/g, "")
    .replace(/\t/g, " ")
    .replace(/\u00a0/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ ]{2,}/g, " ")
    .trim();

const paginateText = (text: string) => {
  const paragraphs = normalizeWhitespace(text)
    .split(/\n\n+/)
    .map((item) => item.trim())
    .filter(Boolean);

  if (paragraphs.length === 0) {
    return ["Файл пустой."];
  }

  const pages: string[] = [];
  let bucket = "";

  for (const paragraph of paragraphs) {
    const candidate = bucket ? `${bucket}\n\n${paragraph}` : paragraph;
    if (candidate.length > PAGE_SIZE && bucket) {
      pages.push(bucket);
      bucket = paragraph;
    } else if (candidate.length > PAGE_SIZE) {
      pages.push(candidate.slice(0, PAGE_SIZE));
      bucket = candidate.slice(PAGE_SIZE);
    } else {
      bucket = candidate;
    }
  }

  if (bucket) {
    pages.push(bucket);
  }

  return pages.length > 0 ? pages : ["Не удалось подготовить страницы."];
};

const parseFb2 = (text: string) => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, "application/xml");
  const parseError = doc.querySelector("parsererror");
  if (parseError) {
    throw new Error("Некорректный FB2 файл");
  }

  const nodes = Array.from(doc.getElementsByTagName("*"));
  const titleNode = nodes.find((node) => node.localName === "book-title");
  const title = titleNode?.textContent?.trim() || "Книга";

  const lines = nodes
    .filter((node) => node.localName === "p" || node.localName === "subtitle" || node.localName === "title")
    .map((node) => node.textContent?.trim() ?? "")
    .filter(Boolean);

  const content = [title, ...lines].join("\n\n");
  return paginateText(content);
};

const parseHtml = (text: string) => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, "text/html");
  const title = doc.querySelector("title")?.textContent?.trim();
  const body = doc.body?.innerText ?? doc.documentElement?.textContent ?? text;
  const content = title ? `${title}\n\n${body}` : body;
  return paginateText(content);
};

export const parseBookFile = async (file: File): Promise<BookContent> => {
  const extension = file.name.toLowerCase().split(".").pop() ?? "";

  if (file.type === "application/pdf" || extension === "pdf") {
    return {
      kind: "pdf",
      objectUrl: URL.createObjectURL(file)
    };
  }

  const text = await file.text();
  if (extension === "fb2" || file.type.includes("xml")) {
    return {
      kind: "text",
      format: "fb2",
      pages: parseFb2(text)
    };
  }

  if (extension === "html" || extension === "htm" || file.type.includes("html")) {
    return {
      kind: "text",
      format: "html",
      pages: parseHtml(text)
    };
  }

  throw new Error("Поддерживаются только pdf, fb2 и html файлы");
};

const wrapText = (
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
) => {
  const words = text.split(/\s+/).filter(Boolean);
  let line = "";
  let cursorY = y;

  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    const metrics = context.measureText(testLine);

    if (metrics.width > maxWidth && line) {
      context.fillText(line, x, cursorY);
      line = word;
      cursorY += lineHeight;
      continue;
    }

    line = testLine;
  }

  if (line) {
    context.fillText(line, x, cursorY);
    cursorY += lineHeight;
  }

  return cursorY;
};

export const drawBookPageToCanvas = (
  canvas: HTMLCanvasElement,
  pageText: string,
  fileName: string,
  page: number,
  pageCount: number
) => {
  const width = 1200;
  const height = 1200;
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return;
  }

  ctx.fillStyle = "#f8f5e9";
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "#111";
  ctx.font = "bold 34px 'Space Grotesk', sans-serif";
  const safeName = fileName.length > 48 ? `${fileName.slice(0, 45)}...` : fileName;
  ctx.fillText(safeName, 48, 62);

  ctx.font = "24px 'JetBrains Mono', monospace";
  ctx.fillStyle = "#666";
  ctx.fillText(`Страница ${page}/${pageCount}`, 48, 102);

  ctx.strokeStyle = "#d9d2b6";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(44, 120);
  ctx.lineTo(width - 44, 120);
  ctx.stroke();

  const paragraphs = pageText.split(/\n{2,}/).filter(Boolean);
  let y = 160;
  const maxY = height - 60;

  ctx.font = "30px 'Space Grotesk', sans-serif";
  ctx.fillStyle = "#1a1a1a";

  for (const paragraph of paragraphs) {
    const nextY = wrapText(ctx, paragraph, 52, y, width - 104, 40);
    y = nextY + 20;
    if (y >= maxY) {
      break;
    }
  }
};
