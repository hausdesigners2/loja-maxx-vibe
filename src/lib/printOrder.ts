import { formatBRL } from "./format";
import type { OrderRow } from "@/pages/AdminDashboardPage";
export type { OrderRow };

const STORE_NAME = "LOJAS MAXX";

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendente",
  paid: "Pago",
  delivered: "Entregue",
  cancelled: "Cancelado",
  awaiting_machine: "A receber na Maquininha",
};

export function printOrder(o: OrderRow, size: "58mm" | "80mm" = "58mm") {
  const is58 = size === "58mm";
  // Printable area (paper - margins). 58mm roll ≈ 48mm printable.
  const pageWidth = is58 ? "58mm" : "80mm";
  const contentWidth = is58 ? "48mm" : "72mm";
  const fontSize = is58 ? "11px" : "12px";
  const lineH = is58 ? "1.25" : "1.3";

  const dt = new Date(o.created_at).toLocaleString("pt-BR");
  const addr = [o.customer_address, o.customer_complement].filter(Boolean).join(" - ");
  const city = [o.customer_city, o.customer_state].filter(Boolean).join("/");

  const itemsHtml = (o.order_items || []).map((it) => {
    const unit = it.unit_price != null ? Number(it.unit_price) : Number(it.subtotal) / Math.max(1, it.quantity);
    return `
      <div class="item">
        <div class="iname">${escape(it.product_name)}</div>
        <div class="row">
          <span>${it.quantity} x ${formatBRL(unit)}</span>
          <span>${formatBRL(Number(it.subtotal))}</span>
        </div>
      </div>`;
  }).join("");

  const html = `<!doctype html><html><head><meta charset="utf-8">
<title>Pedido ${o.order_number ?? ""}</title>
<style>
  @page { size: ${pageWidth} auto; margin: 0; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body {
    font-family: 'Courier New', ui-monospace, monospace;
    width: ${contentWidth};
    margin: 0 auto;
    padding: 2mm 0;
    font-size: ${fontSize};
    line-height: ${lineH};
    color: #000;
    -webkit-print-color-adjust: exact;
    word-wrap: break-word;
    overflow-wrap: anywhere;
  }
  * { box-sizing: border-box; }
  .center { text-align: center; }
  .b { font-weight: bold; }
  .store { font-size: 14px; font-weight: bold; text-align: center; letter-spacing: 1px; }
  .h { font-size: 12px; font-weight: bold; text-align: center; margin-top: 2px; }
  .sep { border-top: 1px dashed #000; margin: 4px 0; }
  .row { display: flex; justify-content: space-between; gap: 4px; }
  .item { margin-bottom: 2px; }
  .iname { font-weight: bold; }
  .tot { font-size: 13px; font-weight: bold; }
  .label { font-weight: bold; }
  @media print { body { padding: 0; } }
</style></head><body>
  <div class="store">${escape(STORE_NAME)}</div>
  <div class="h">PEDIDO${o.order_number != null ? " #" + o.order_number : ""}</div>
  <div class="center">${dt}</div>
  <div class="sep"></div>

  <div class="label">CLIENTE</div>
  <div>${escape(o.customer_name)}</div>
  <div>Tel: ${escape(o.customer_phone)}</div>
  ${addr ? `<div>${escape(addr)}</div>` : ""}
  ${city ? `<div>${escape(city)}</div>` : ""}
  <div class="sep"></div>

  <div class="label">ITENS</div>
  ${itemsHtml}
  <div class="sep"></div>

  <div class="row tot"><span>TOTAL</span><span>${formatBRL(Number(o.total))}</span></div>
  <div class="row"><span class="label">Pagto:</span><span>${escape(o.payment_method)}</span></div>
  ${o.payment_method === "Dinheiro" && o.change_for != null ? `<div class="row"><span>Troco p/:</span><span>${formatBRL(Number(o.change_for))}</span></div>` : ""}
  <div class="row"><span class="label">Status:</span><span>${STATUS_LABEL[o.status] ?? o.status}</span></div>

  ${o.notes ? `<div class="sep"></div><div class="label">OBS:</div><div>${escape(o.notes)}</div>` : ""}

  <div class="sep"></div>
  <div class="center">Obrigado pela preferencia!</div>
  <div style="height:6mm"></div>
  <script>window.onload = () => { window.print(); setTimeout(() => window.close(), 300); };</script>
</body></html>`;

  const w = window.open("", "_blank", "width=380,height=640");
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
}

function escape(s: string | null | undefined) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
