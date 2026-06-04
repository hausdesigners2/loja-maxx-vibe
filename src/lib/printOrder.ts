import { formatBRL } from "./format";
import type { OrderRow } from "@/pages/AdminDashboardPage";

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendente",
  paid: "Pago",
  delivered: "Entregue",
  cancelled: "Cancelado",
  awaiting_machine: "À receber na Maquininha",
};

export function printOrder(o: OrderRow, size: "58mm" | "80mm" = "80mm") {
  const width = size === "58mm" ? "58mm" : "80mm";
  const fontSize = size === "58mm" ? "11px" : "12px";
  const dt = new Date(o.created_at).toLocaleString("pt-BR");

  const itemsHtml = (o.order_items || []).map((it) => `
    <div class="row">
      <span>${it.quantity}x ${escape(it.product_name)}</span>
      <span>${formatBRL(Number(it.subtotal))}</span>
    </div>
  `).join("");

  const addr = [o.customer_address, o.customer_complement].filter(Boolean).join(" — ");
  const city = [o.customer_city, o.customer_state].filter(Boolean).join("/");

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Pedido ${o.order_number ?? ""}</title>
  <style>
    @page { size: ${width} auto; margin: 2mm; }
    * { box-sizing: border-box; }
    body { font-family: 'Courier New', monospace; width: ${width}; margin: 0; padding: 2mm; font-size: ${fontSize}; color: #000; }
    h1 { font-size: 14px; text-align: center; margin: 0 0 4px; }
    .center { text-align: center; }
    .row { display: flex; justify-content: space-between; gap: 4px; }
    .sep { border-top: 1px dashed #000; margin: 4px 0; }
    .b { font-weight: bold; }
    .tot { font-size: 14px; font-weight: bold; }
    @media print { body { padding: 0; } }
  </style></head><body>
    <h1>PEDIDO ${o.order_number != null ? "#" + o.order_number : ""}</h1>
    <div class="center">${dt}</div>
    <div class="sep"></div>
    <div class="b">Cliente:</div>
    <div>${escape(o.customer_name)}</div>
    <div>Tel: ${escape(o.customer_phone)}</div>
    <div>${escape(addr)}</div>
    ${city ? `<div>${escape(city)}</div>` : ""}
    <div class="sep"></div>
    <div class="b">Itens:</div>
    ${itemsHtml}
    <div class="sep"></div>
    <div class="row tot"><span>TOTAL</span><span>${formatBRL(Number(o.total))}</span></div>
    <div class="row"><span>Pagamento:</span><span>${escape(o.payment_method)}</span></div>
    ${o.payment_method === "Dinheiro" && o.change_for != null ? `<div class="row"><span>Troco para:</span><span>${formatBRL(Number(o.change_for))}</span></div>` : ""}
    <div class="row"><span>Status:</span><span>${STATUS_LABEL[o.status] ?? o.status}</span></div>
    ${o.notes ? `<div class="sep"></div><div class="b">Observações:</div><div>${escape(o.notes)}</div>` : ""}
    <div class="sep"></div>
    <div class="center">Obrigado pela preferência!</div>
    <script>window.onload = () => { window.print(); setTimeout(() => window.close(), 300); };</script>
  </body></html>`;

  const w = window.open("", "_blank", "width=420,height=640");
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
}

function escape(s: string | null | undefined) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
