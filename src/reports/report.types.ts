export interface RevenueRow {
  readonly storeId: string;
  readonly date: string;
  readonly orderCount: number;
  readonly revenue: number;
}

export interface RevenueReport {
  readonly rows: readonly RevenueRow[];
  readonly totals: {
    readonly orderCount: number;
    readonly revenue: number;
  };
}

export interface MissingDataRow {
  readonly storeId: string;
  readonly date: string;
  readonly reason: string;
}

export interface ReconcileRow {
  readonly orderId: string;
  readonly storeId: string;
  readonly status: string;
  readonly totalAmount: number;
  readonly calculatedTotal: number;
  readonly difference: number;
  readonly createdAtVnDate: string;
}

export interface RejectedRow {
  readonly id: number;
  readonly batchName: string;
  readonly rowIndex: number;
  readonly orderId: string | null;
  readonly reason: string;
  readonly createdAt: string;
}
