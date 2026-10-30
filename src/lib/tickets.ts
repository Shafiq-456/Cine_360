// Ticket helpers: QR generation (encodes ONLY the opaque ticket code — no PII/payment data).
import QRCode from "qrcode";

export async function ticketQRDataUrl(code: string): Promise<string> {
  return QRCode.toDataURL(code, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 320,
    color: { dark: "#0B0D12", light: "#FFFFFF" },
  });
}
