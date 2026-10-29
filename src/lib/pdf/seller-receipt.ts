import PDFDocument from "pdfkit";
import QRCode from "qrcode";

export type SellerReceiptPdfInput = {
  receiptNumber: string;
  sellerName: string;
  buyerName?: string;
  itemTitle: string;
  itemDescription?: string;
  quantity: number;
  unitPriceKes: number;
  totalKes: number;
  issuedAt: string;
  verificationUrl: string;
};

const MAX_AMOUNT_KES = 10_000_000_000;
const MAX_QUANTITY = 1_000;
const MAX_URL_LENGTH = 2_048;
const DISCLAIMER =
  "Seller-reported external sale. Lexify School did not process or verify payment. This is not a tax invoice.";

function cleanText(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== "string") {
    throw new TypeError(`${field} must be a string`);
  }

  // PDFKit's built-in Helvetica fonts use WinAnsi. Normalize and bound text,
  // replacing unsupported glyphs and controls rather than passing raw input to PDFKit.
  const cleaned = Array.from(
    value
      .normalize("NFKC")
      .replace(
        /[\u0000-\u001f\u007f-\u009f\u200e\u200f\u202a-\u202e\u2066-\u2069]/g,
        " "
      )
      .replace(/[^\x20-\x7e\u00a0-\u00ff]/g, "?")
      .replace(/\s+/g, " ")
      .trim()
  )
    .slice(0, maxLength)
    .join("");

  return cleaned;
}

function requiredText(
  value: unknown,
  field: string,
  maxLength: number
): string {
  const text = cleanText(value, field, maxLength);
  if (!text) throw new TypeError(`${field} must not be empty`);
  return text;
}

function finiteAmount(value: unknown, field: string, max: number): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > max
  ) {
    throw new RangeError(
      `${field} must be a finite number between 0 and ${max}`
    );
  }
  return Object.is(value, -0) ? 0 : value;
}

function validateUrl(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > MAX_URL_LENGTH ||
    value.trim() !== value
  ) {
    throw new TypeError("verificationUrl must be a public HTTPS URL");
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new TypeError("verificationUrl must be a public HTTPS URL");
  }

  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  const isLocalHost =
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal");
  const isIpLiteral =
    /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname) || hostname.includes(":");
  if (
    parsed.protocol !== "https:" ||
    !hostname ||
    parsed.username ||
    parsed.password ||
    isLocalHost ||
    isIpLiteral
  ) {
    throw new TypeError("verificationUrl must be a public HTTPS URL");
  }

  return value;
}

function dateLabel(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) {
    throw new TypeError("issuedAt must be a valid date");
  }
  return new Intl.DateTimeFormat("en-KE", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(parsed);
}

function kes(value: number): string {
  return `KES ${new Intl.NumberFormat("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: true,
  }).format(value)}`;
}

function quantityLabel(value: number): string {
  return new Intl.NumberFormat("en-KE", {
    maximumFractionDigits: 3,
    useGrouping: true,
  }).format(value);
}

/** Draws the paths and colors from public/lexify-mark.svg in PDFKit coordinates. */
function drawLexifyMark(
  document: PDFKit.PDFDocument,
  x: number,
  y: number,
  size: number
): void {
  document.save();
  document.translate(x, y);
  document.scale(size / 64);

  document
    .lineJoin("round")
    .moveTo(6, 21)
    .lineTo(32, 8)
    .lineTo(58, 21)
    .lineTo(32, 34)
    .closePath()
    .lineWidth(2.5)
    .fillAndStroke("#1E3A8A", "#F59E0B");

  document
    .lineJoin("round")
    .moveTo(14, 29)
    .lineTo(14, 41)
    .bezierCurveTo(22, 48, 32, 48, 32, 48)
    .bezierCurveTo(32, 48, 42, 48, 50, 41)
    .lineTo(50, 29)
    .closePath()
    .lineWidth(3)
    .fillAndStroke("#FFFFFF", "#1E3A8A");

  document
    .lineCap("round")
    .moveTo(9, 24)
    .lineTo(9, 40)
    .lineWidth(3)
    .strokeColor("#F59E0B")
    .stroke();
  document.circle(9, 43, 3).fillColor("#F59E0B").fill();

  document
    .lineCap("round")
    .moveTo(20, 35)
    .bezierCurveTo(25, 38, 28, 39, 32, 39)
    .bezierCurveTo(36, 39, 39, 38, 44, 35)
    .lineWidth(2.5)
    .strokeColor("#1E3A8A")
    .stroke();
  document
    .moveTo(20, 44)
    .bezierCurveTo(24, 47, 28, 48, 32, 48)
    .bezierCurveTo(36, 48, 40, 47, 44, 44)
    .lineWidth(2)
    .strokeColor("#F59E0B")
    .stroke();
  document.restore();
}

function renderPdf(
  qrPng: Buffer,
  input: {
    receiptNumber: string;
    sellerName: string;
    buyerName?: string;
    itemTitle: string;
    itemDescription?: string;
    quantity: number;
    unitPriceKes: number;
    totalKes: number;
    issuedDate: string;
    verificationUrl: string;
  }
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const document = new PDFDocument({
      size: "A4",
      margins: { top: 40, bottom: 40, left: 46, right: 46 },
      info: {
        Title: `Seller receipt ${input.receiptNumber}`,
        Creator: "Lexify School",
      },
      compress: true,
    });
    const chunks: Buffer[] = [];
    document.on("data", chunk => chunks.push(Buffer.from(chunk)));
    document.on("error", reject);
    document.on("end", () => resolve(Buffer.concat(chunks)));

    try {
      const navy = "#1E3A8A";
      const ink = "#17243A";
      const muted = "#536276";
      const amber = "#F59E0B";

      drawLexifyMark(document, 46, 36, 54);
      document
        .fillColor(navy)
        .font("Helvetica-Bold")
        .fontSize(18)
        .text("Lexify School", 111, 48);
      document
        .fillColor(muted)
        .font("Helvetica")
        .fontSize(8.5)
        .text("SELLER-REPORTED RECEIPT", 111, 72);

      document
        .fillColor(navy)
        .font("Helvetica-Bold")
        .fontSize(22)
        .text("SELLER RECEIPT", 315, 39, {
          width: 234,
          align: "right",
        });
      document
        .fillColor(ink)
        .font("Helvetica-Bold")
        .fontSize(9)
        .text("Receipt number", 315, 73, {
          width: 92,
        });
      document
        .fillColor(ink)
        .font("Helvetica")
        .fontSize(9)
        .text(input.receiptNumber, 407, 73, {
          width: 142,
          align: "right",
          lineBreak: false,
        });
      document
        .fillColor(muted)
        .font("Helvetica")
        .fontSize(9)
        .text(`Issue date: ${input.issuedDate}`, 315, 91, {
          width: 234,
          align: "right",
        });

      document
        .moveTo(46, 119)
        .lineTo(549, 119)
        .lineWidth(1)
        .strokeColor("#D8E1EC")
        .stroke();

      document.roundedRect(46, 139, 503, 76, 8).fillColor("#F5F8FC").fill();
      document
        .fillColor(muted)
        .font("Helvetica-Bold")
        .fontSize(8)
        .text("SELLER", 62, 154);
      document
        .fillColor(ink)
        .font("Helvetica-Bold")
        .fontSize(11)
        .text(input.sellerName, 62, 170, {
          width: 218,
          height: 32,
          ellipsis: true,
        });
      document
        .fillColor(muted)
        .font("Helvetica-Bold")
        .fontSize(8)
        .text("BUYER", 302, 154);
      document
        .fillColor(ink)
        .font("Helvetica")
        .fontSize(11)
        .text(input.buyerName || "Not provided", 302, 170, {
          width: 231,
          height: 32,
          ellipsis: true,
        });

      document
        .fillColor(navy)
        .font("Helvetica-Bold")
        .fontSize(12)
        .text("Sale details", 46, 244);
      document
        .roundedRect(46, 267, 503, 150, 8)
        .lineWidth(1)
        .strokeColor("#D8E1EC")
        .stroke();
      document.roundedRect(46, 267, 503, 34, 8).fillColor("#F5F8FC").fill();
      document
        .fillColor(muted)
        .font("Helvetica-Bold")
        .fontSize(8)
        .text("ITEM", 62, 280);
      document.text("QUANTITY", 334, 280, { width: 68, align: "right" });
      document.text("UNIT PRICE", 412, 280, { width: 121, align: "right" });

      document
        .fillColor(ink)
        .font("Helvetica-Bold")
        .fontSize(10.5)
        .text(input.itemTitle, 62, 315, {
          width: 253,
          height: 32,
          ellipsis: true,
        });
      document
        .fillColor(ink)
        .font("Helvetica")
        .fontSize(9.5)
        .text(quantityLabel(input.quantity), 334, 315, {
          width: 68,
          align: "right",
        });
      document.text(kes(input.unitPriceKes), 412, 315, {
        width: 121,
        align: "right",
      });
      document
        .moveTo(62, 341)
        .lineTo(533, 341)
        .lineWidth(0.7)
        .strokeColor("#E5EBF2")
        .stroke();
      document
        .fillColor(muted)
        .font("Helvetica")
        .fontSize(8.5)
        .text("Description", 62, 353);
      document
        .fillColor(ink)
        .font("Helvetica")
        .fontSize(9)
        .text(input.itemDescription || "—", 62, 368, {
          width: 469,
          height: 39,
          ellipsis: true,
          lineGap: 1,
        });

      document.roundedRect(321, 437, 228, 63, 8).fillColor("#FFF7E7").fill();
      document
        .fillColor(muted)
        .font("Helvetica-Bold")
        .fontSize(9)
        .text("TOTAL REPORTED", 337, 451);
      document
        .fillColor(navy)
        .font("Helvetica-Bold")
        .fontSize(18)
        .text(kes(input.totalKes), 337, 466, {
          width: 196,
          align: "right",
          lineBreak: false,
        });

      document.roundedRect(46, 530, 503, 75, 8).fillColor("#FFF7E7").fill();
      document.roundedRect(46, 530, 5, 75, 2).fillColor(amber).fill();
      document
        .fillColor(navy)
        .font("Helvetica-Bold")
        .fontSize(9)
        .text("IMPORTANT DISCLOSURE", 62, 543);
      document
        .fillColor(ink)
        .font("Helvetica-Bold")
        .fontSize(10)
        .text(DISCLAIMER, 62, 560, {
          width: 471,
          height: 36,
          lineGap: 2,
        });

      document
        .moveTo(46, 628)
        .lineTo(549, 628)
        .lineWidth(0.8)
        .strokeColor("#D8E1EC")
        .stroke();
      document
        .fillColor(navy)
        .font("Helvetica-Bold")
        .fontSize(9)
        .text("Verification URL", 46, 649);
      document
        .fillColor(muted)
        .font("Helvetica")
        .fontSize(8)
        .text("Scan the QR code or open this verification URL:", 46, 664, {
          width: 370,
        });
      document
        .fillColor(ink)
        .font("Helvetica")
        .fontSize(7.3)
        .text(input.verificationUrl, 46, 681, {
          width: 370,
          height: 24,
          ellipsis: true,
          lineBreak: false,
        });
      document.image(qrPng, 438, 646, { fit: [96, 96] });
      document
        .fillColor(muted)
        .font("Helvetica")
        .fontSize(8)
        .text("Seller-reported information", 46, 761, {
          width: 503,
          align: "center",
        });

      document.end();
    } catch (error) {
      reject(error);
    }
  });
}

export async function createSellerReceiptPdf(
  input: SellerReceiptPdfInput
): Promise<Buffer> {
  const receiptNumber = requiredText(input.receiptNumber, "receiptNumber", 80);
  const sellerName = requiredText(input.sellerName, "sellerName", 120);
  const buyerName =
    input.buyerName === undefined
      ? undefined
      : cleanText(input.buyerName, "buyerName", 120) || undefined;
  const itemTitle = requiredText(input.itemTitle, "itemTitle", 180);
  const itemDescription =
    input.itemDescription === undefined
      ? undefined
      : cleanText(input.itemDescription, "itemDescription", 400) || undefined;
  const quantity = finiteAmount(input.quantity, "quantity", MAX_QUANTITY);
  if (quantity <= 0) throw new RangeError("quantity must be greater than 0");
  if (!Number.isInteger(quantity)) {
    throw new RangeError("quantity must be a whole number");
  }
  const unitPriceKes = finiteAmount(
    input.unitPriceKes,
    "unitPriceKes",
    MAX_AMOUNT_KES
  );
  const totalKes = finiteAmount(input.totalKes, "totalKes", MAX_AMOUNT_KES);
  const expectedTotal = Number((quantity * unitPriceKes).toFixed(2));
  if (Math.abs(totalKes - expectedTotal) > 0.005) {
    throw new RangeError(
      "totalKes must match quantity multiplied by unitPriceKes"
    );
  }
  const issuedAt = requiredText(input.issuedAt, "issuedAt", 100);
  const issuedDate = dateLabel(issuedAt);
  const verificationUrl = validateUrl(input.verificationUrl);
  const qrPng = await QRCode.toBuffer(verificationUrl, {
    type: "png",
    width: 160,
    margin: 2,
    errorCorrectionLevel: "M",
  });

  return renderPdf(qrPng, {
    receiptNumber,
    sellerName,
    buyerName,
    itemTitle,
    itemDescription,
    quantity,
    unitPriceKes,
    totalKes,
    issuedDate,
    verificationUrl,
  });
}
