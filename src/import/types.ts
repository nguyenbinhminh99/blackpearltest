export interface RawTopping {
  readonly sku?: unknown;
  readonly name?: unknown;
  readonly qty?: unknown;
  readonly unit_price?: unknown;
}

export interface RawItem {
  readonly sku?: unknown;
  readonly name?: unknown;
  readonly qty?: unknown;
  readonly unit_price?: unknown;
  readonly toppings?: unknown;
}

export interface RawOrder {
  readonly order_id?: unknown;
  readonly store_id?: unknown;
  readonly created_at?: unknown;
  readonly updated_at?: unknown;
  readonly status?: unknown;
  readonly channel?: unknown;
  readonly items?: unknown;
  readonly discount_amount?: unknown;
  readonly total_amount?: unknown;
}

export interface BatchFile {
  readonly pulled_at?: unknown;
  readonly orders?: unknown;
}

export type OrderStatusValue = 'completed' | 'cancelled';
export type OrderChannelValue = 'tai_quay' | 'grab' | 'shopeefood';

export interface ValidatedOrder {
  readonly orderId: string;
  readonly storeId: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly status: OrderStatusValue;
  readonly channel: OrderChannelValue;
  readonly items: readonly RawItem[];
  readonly discountAmount: number;
  readonly totalAmount: number;
  readonly calculatedTotal: number;
  readonly createdAtVnDate: string;
}

export interface RejectedOrder {
  readonly rowIndex: number;
  readonly orderId: string | null;
  readonly reason: string;
  readonly rawPayload: unknown;
}

export interface ImportSummary {
  readonly batchName: string;
  readonly pulledAt: Date | null;
  readonly totalRows: number;
  readonly inserted: number;
  readonly updated: number;
  readonly skippedStale: number;
  readonly rejected: number;
}
