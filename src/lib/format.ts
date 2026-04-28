export const formatBRL = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const finalPrice = (price: number, discount: number) =>
  Math.max(0, price * (1 - (discount || 0) / 100));
