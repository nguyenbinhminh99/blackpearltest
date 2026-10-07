import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import {
  MissingDataRow,
  ReconcileRow,
  RejectedRow,
  RevenueReport,
  RevenueRow,
} from './report.types';

const KNOWN_STORES = ['CH01', 'CH02', 'CH03', 'CH04', 'CH05'] as const;

export type CsvReportType =
  | 'revenue'
  | 'missing'
  | 'reconcile'
  | 'rejected';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getRevenue(
    storeId?: string,
    fromDate?: string,
    toDate?: string,
  ): Promise<RevenueReport> {
    const where = this.buildDateStoreFilter(storeId, fromDate, toDate, true);

    const grouped = await this.prisma.order.groupBy({
      by: ['storeId', 'createdAtVnDate'],
      where,
      _count: { orderId: true },
      _sum: { totalAmount: true },
      orderBy: [{ createdAtVnDate: 'asc' }, { storeId: 'asc' }],
    });

    const rows: RevenueRow[] = grouped.map((row) => ({
      storeId: row.storeId,
      date: row.createdAtVnDate,
      orderCount: row._count.orderId,
      revenue: row._sum.totalAmount ?? 0,
    }));

    const totals = rows.reduce(
      (acc, row) => ({
        orderCount: acc.orderCount + row.orderCount,
        revenue: acc.revenue + row.revenue,
      }),
      { orderCount: 0, revenue: 0 },
    );

    return { rows, totals };
  }

  async getMissingData(
    storeId?: string,
    fromDate?: string,
    toDate?: string,
  ): Promise<readonly MissingDataRow[]> {
    const bounds = await this.resolveDateBounds(fromDate, toDate);
    if (!bounds) {
      return [];
    }

    const stores = storeId ? [storeId] : [...KNOWN_STORES];
    const dates = enumerateDates(bounds.from, bounds.to);

    const existing = await this.prisma.order.findMany({
      where: {
        storeId: { in: stores },
        createdAtVnDate: { gte: bounds.from, lte: bounds.to },
      },
      select: { storeId: true, createdAtVnDate: true },
      distinct: ['storeId', 'createdAtVnDate'],
    });

    const present = new Set(
      existing.map((row) => `${row.storeId}|${row.createdAtVnDate}`),
    );

    const missing: MissingDataRow[] = [];
    for (const date of dates) {
      for (const store of stores) {
        if (!present.has(`${store}|${date}`)) {
          missing.push({
            storeId: store,
            date,
            reason: 'Không có đơn nào trong ngày',
          });
        }
      }
    }
    return missing;
  }

  async getReconcile(
    storeId?: string,
    fromDate?: string,
    toDate?: string,
  ): Promise<readonly ReconcileRow[]> {
    const where = this.buildDateStoreFilter(storeId, fromDate, toDate, false);
    const orders = await this.prisma.order.findMany({
      where,
      select: {
        orderId: true,
        storeId: true,
        status: true,
        totalAmount: true,
        calculatedTotal: true,
        createdAtVnDate: true,
      },
      orderBy: [{ createdAtVnDate: 'asc' }, { orderId: 'asc' }],
    });

    return orders
      .filter((order) => order.totalAmount !== order.calculatedTotal)
      .map((order) => ({
        orderId: order.orderId,
        storeId: order.storeId,
        status: order.status,
        totalAmount: order.totalAmount,
        calculatedTotal: order.calculatedTotal,
        difference: order.totalAmount - order.calculatedTotal,
        createdAtVnDate: order.createdAtVnDate,
      }));
  }

  async getRejected(batchName?: string): Promise<readonly RejectedRow[]> {
    const errors = await this.prisma.importError.findMany({
      where: batchName ? { batchName } : undefined,
      orderBy: [{ batchName: 'asc' }, { rowIndex: 'asc' }, { id: 'asc' }],
    });

    return errors.map((error) => ({
      id: error.id,
      batchName: error.batchName,
      rowIndex: error.rowIndex,
      orderId: error.orderId,
      reason: error.reason,
      createdAt: error.createdAt.toISOString(),
    }));
  }

  async getStores(): Promise<readonly string[]> {
    const rows = await this.prisma.order.findMany({
      select: { storeId: true },
      distinct: ['storeId'],
      orderBy: { storeId: 'asc' },
    });
    return rows.map((row) => row.storeId);
  }

  async buildCsvReport(
    type: CsvReportType,
    storeId?: string,
    fromDate?: string,
    toDate?: string,
  ): Promise<{ readonly filename: string; readonly content: string }> {
    if (type === 'revenue') {
      const revenue = await this.getRevenue(storeId, fromDate, toDate);
      return {
        filename: 'revenue_by_store_date.csv',
        content: this.toCsv(
          ['store_id', 'date', 'order_count', 'revenue'],
          [
            ...revenue.rows.map((row) => [
              row.storeId,
              row.date,
              row.orderCount,
              row.revenue,
            ]),
            ['TOTAL', '', revenue.totals.orderCount, revenue.totals.revenue],
          ],
        ),
      };
    }

    if (type === 'missing') {
      const missing = await this.getMissingData(storeId, fromDate, toDate);
      return {
        filename: 'missing_data_warnings.csv',
        content: this.toCsv(
          ['store_id', 'date', 'reason'],
          missing.map((row) => [row.storeId, row.date, row.reason]),
        ),
      };
    }

    if (type === 'reconcile') {
      const reconcile = await this.getReconcile(storeId, fromDate, toDate);
      return {
        filename: 'reconcile_mismatches.csv',
        content: this.toCsv(
          [
            'order_id',
            'store_id',
            'status',
            'total_amount',
            'calculated_total',
            'difference',
            'created_at_vn_date',
          ],
          reconcile.map((row) => [
            row.orderId,
            row.storeId,
            row.status,
            row.totalAmount,
            row.calculatedTotal,
            row.difference,
            row.createdAtVnDate,
          ]),
        ),
      };
    }

    const rejected = await this.getRejected();
    return {
      filename: 'rejected_records.csv',
      content: this.toCsv(
        ['id', 'batch_name', 'row_index', 'order_id', 'reason', 'created_at'],
        rejected.map((row) => [
          row.id,
          row.batchName,
          row.rowIndex,
          row.orderId ?? '',
          row.reason,
          row.createdAt,
        ]),
      ),
    };
  }

  async exportAllCsv(
    outputDir: string,
    storeId?: string,
    fromDate?: string,
    toDate?: string,
  ): Promise<readonly string[]> {
    await mkdir(outputDir, { recursive: true });
    const types: CsvReportType[] = [
      'revenue',
      'missing',
      'reconcile',
      'rejected',
    ];
    const paths: string[] = [];
    for (const type of types) {
      const file = await this.buildCsvReport(type, storeId, fromDate, toDate);
      const filePath = join(outputDir, file.filename);
      await writeFile(filePath, file.content, 'utf8');
      paths.push(filePath);
    }
    return paths;
  }

  private buildDateStoreFilter(
    storeId: string | undefined,
    fromDate: string | undefined,
    toDate: string | undefined,
    completedOnly: boolean,
  ): Prisma.OrderWhereInput {
    const where: Prisma.OrderWhereInput = {};
    if (completedOnly) {
      where.status = 'completed';
    }
    if (storeId) {
      where.storeId = storeId;
    }
    if (fromDate || toDate) {
      where.createdAtVnDate = {
        ...(fromDate ? { gte: fromDate } : {}),
        ...(toDate ? { lte: toDate } : {}),
      };
    }
    return where;
  }

  private async resolveDateBounds(
    fromDate?: string,
    toDate?: string,
  ): Promise<{ from: string; to: string } | null> {
    if (fromDate && toDate) {
      return { from: fromDate, to: toDate };
    }

    const agg = await this.prisma.order.aggregate({
      _min: { createdAtVnDate: true },
      _max: { createdAtVnDate: true },
    });

    const minDate = fromDate ?? agg._min.createdAtVnDate;
    const maxDate = toDate ?? agg._max.createdAtVnDate;
    if (!minDate || !maxDate) {
      return null;
    }
    return { from: minDate, to: maxDate };
  }

  private toCsv(
    headers: readonly string[],
    rows: readonly (readonly (string | number)[])[],
  ): string {
    const escape = (value: string | number): string => {
      const text = String(value);
      if (text.includes(',') || text.includes('"') || text.includes('\n')) {
        return `"${text.replace(/"/g, '""')}"`;
      }
      return text;
    };
    const lines = [
      headers.join(','),
      ...rows.map((row) => row.map(escape).join(',')),
    ];
    // BOM giúp Excel Windows đọc đúng tiếng Việt
    return `\uFEFF${lines.join('\n')}\n`;
  }
}

function enumerateDates(from: string, to: string): string[] {
  const dates: string[] = [];
  const cursor = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`);
  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}
