import {
  OrderChannelValue,
  OrderStatusValue,
  RawItem,
  RawOrder,
  RejectedOrder,
  ValidatedOrder,
} from './types';

const VALID_STATUSES: ReadonlySet<string> = new Set(['completed', 'cancelled']);
const VALID_CHANNELS: ReadonlySet<string> = new Set([
  'tai_quay',
  'grab',
  'shopeefood',
]);

export function calculateExpectedTotal(
  items: readonly RawItem[],
  discountAmount: number,
): number {
  let sum = 0;
  for (const item of items) {
    const toppings = Array.isArray(item.toppings) ? item.toppings : [];
    let toppingSum = 0;
    for (const topping of toppings) {
      if (
        typeof topping !== 'object' ||
        topping === null ||
        typeof topping.qty !== 'number' ||
        typeof topping.unit_price !== 'number'
      ) {
        continue;
      }
      toppingSum += topping.qty * topping.unit_price;
    }
    if (typeof item.qty !== 'number' || typeof item.unit_price !== 'number') {
      continue;
    }
    sum += item.qty * (item.unit_price + toppingSum);
  }
  return sum - discountAmount;
}

export function toVietnamDate(utcDate: Date): string {
  const vnMs = utcDate.getTime() + 7 * 60 * 60 * 1000;
  return new Date(vnMs).toISOString().slice(0, 10);
}

function isFiniteInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

function parseDate(value: unknown, field: string): Date {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${field} không hợp lệ`);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${field} không parse được: ${value}`);
  }
  return date;
}

function validateItems(items: unknown): readonly RawItem[] {
  if (!Array.isArray(items)) {
    throw new Error('items phải là mảng');
  }
  for (const item of items) {
    if (typeof item !== 'object' || item === null) {
      throw new Error('phần tử items không hợp lệ');
    }
    const typed = item as RawItem;
    if (typeof typed.qty !== 'number' || typeof typed.unit_price !== 'number') {
      throw new Error('item thiếu qty/unit_price số');
    }
    if (typed.toppings !== undefined && !Array.isArray(typed.toppings)) {
      throw new Error('toppings phải là mảng');
    }
  }
  return items as readonly RawItem[];
}

export function validateOrder(
  raw: unknown,
  rowIndex: number,
): ValidatedOrder | RejectedOrder {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return {
      rowIndex,
      orderId: null,
      reason: 'Bản ghi không phải object',
      rawPayload: raw,
    };
  }

  const order = raw as RawOrder;
  const orderId =
    typeof order.order_id === 'string' ? order.order_id : null;

  try {
    if (typeof order.order_id !== 'string' || order.order_id.trim() === '') {
      throw new Error('thiếu order_id');
    }
    if (typeof order.store_id !== 'string' || order.store_id.trim() === '') {
      throw new Error('thiếu store_id');
    }
    if (
      typeof order.status !== 'string' ||
      !VALID_STATUSES.has(order.status)
    ) {
      throw new Error(`status không hợp lệ: ${String(order.status)}`);
    }
    if (
      typeof order.channel !== 'string' ||
      !VALID_CHANNELS.has(order.channel)
    ) {
      throw new Error(`channel không hợp lệ: ${String(order.channel)}`);
    }
    if (!isFiniteInteger(order.discount_amount)) {
      throw new Error('discount_amount phải là số nguyên');
    }
    if (!isFiniteInteger(order.total_amount)) {
      throw new Error(
        `total_amount phải là số nguyên, nhận được: ${JSON.stringify(order.total_amount)}`,
      );
    }

    const createdAt = parseDate(order.created_at, 'created_at');
    const updatedAt = parseDate(order.updated_at, 'updated_at');
    const items = validateItems(order.items);
    const calculatedTotal = calculateExpectedTotal(
      items,
      order.discount_amount,
    );

    return {
      orderId: order.order_id,
      storeId: order.store_id,
      createdAt,
      updatedAt,
      status: order.status as OrderStatusValue,
      channel: order.channel as OrderChannelValue,
      items,
      discountAmount: order.discount_amount,
      totalAmount: order.total_amount,
      calculatedTotal,
      createdAtVnDate: toVietnamDate(createdAt),
    };
  } catch (error) {
    const reason =
      error instanceof Error ? error.message : 'Lỗi validation không xác định';
    return {
      rowIndex,
      orderId,
      reason,
      rawPayload: raw,
    };
  }
}

export function isRejectedOrder(
  value: ValidatedOrder | RejectedOrder,
): value is RejectedOrder {
  return 'reason' in value && 'rowIndex' in value;
}
