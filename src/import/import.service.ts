import { Injectable, Logger } from '@nestjs/common';
import { readFile } from 'fs/promises';
import { basename } from 'path';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { isRejectedOrder, validateOrder } from './order-validator';
import {
  BatchFile,
  ImportSummary,
  RejectedOrder,
  ValidatedOrder,
} from './types';

@Injectable()
export class ImportService {
  private readonly logger = new Logger(ImportService.name);

  constructor(private readonly prisma: PrismaService) {}

  async importFile(filePath: string): Promise<ImportSummary> {
    const batchName = basename(filePath);
    this.logger.log(`Bắt đầu import ${batchName}`);

    const rawText = await readFile(filePath, 'utf8');
    const parsed = JSON.parse(rawText) as BatchFile;

    if (!Array.isArray(parsed.orders)) {
      throw new Error(`File ${batchName} thiếu mảng orders`);
    }

    const pulledAt =
      typeof parsed.pulled_at === 'string'
        ? new Date(parsed.pulled_at)
        : null;

    // Re-import cùng batch: làm mới danh sách lỗi để báo cáo rejected không bị nhân đôi.
    await this.prisma.importError.deleteMany({ where: { batchName } });

    let inserted = 0;
    let updated = 0;
    let skippedStale = 0;
    const rejected: RejectedOrder[] = [];

    for (let index = 0; index < parsed.orders.length; index += 1) {
      const result = validateOrder(parsed.orders[index], index);
      if (isRejectedOrder(result)) {
        rejected.push(result);
        this.logger.warn(
          `[${batchName}#${index}] từ chối ${result.orderId ?? 'N/A'}: ${result.reason}`,
        );
        continue;
      }

      const outcome = await this.upsertOrder(result, batchName);
      if (outcome === 'inserted') inserted += 1;
      else if (outcome === 'updated') updated += 1;
      else skippedStale += 1;
    }

    if (rejected.length > 0) {
      await this.prisma.importError.createMany({
        data: rejected.map((item) => ({
          batchName,
          rowIndex: item.rowIndex,
          orderId: item.orderId,
          reason: item.reason,
          rawPayload: item.rawPayload as Prisma.InputJsonValue,
        })),
      });
    }

    const finishedAt = new Date();
    await this.prisma.importRun.create({
      data: {
        batchName,
        pulledAt,
        totalRows: parsed.orders.length,
        inserted,
        updated,
        skippedStale,
        rejected: rejected.length,
        finishedAt,
      },
    });

    const summary: ImportSummary = {
      batchName,
      pulledAt,
      totalRows: parsed.orders.length,
      inserted,
      updated,
      skippedStale,
      rejected: rejected.length,
    };

    this.logger.log(
      `Xong ${batchName}: inserted=${inserted}, updated=${updated}, stale=${skippedStale}, rejected=${rejected.length}`,
    );
    return summary;
  }

  private async upsertOrder(
    order: ValidatedOrder,
    batchName: string,
  ): Promise<'inserted' | 'updated' | 'skipped'> {
    const existing = await this.prisma.order.findUnique({
      where: { orderId: order.orderId },
      select: { updatedAt: true },
    });

    if (existing && existing.updatedAt > order.updatedAt) {
      return 'skipped';
    }

    const data = {
      storeId: order.storeId,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      status: order.status,
      channel: order.channel,
      items: order.items as Prisma.InputJsonValue,
      discountAmount: order.discountAmount,
      totalAmount: order.totalAmount,
      calculatedTotal: order.calculatedTotal,
      createdAtVnDate: order.createdAtVnDate,
      sourceBatch: batchName,
    };

    if (!existing) {
      await this.prisma.order.create({
        data: {
          orderId: order.orderId,
          ...data,
        },
      });
      return 'inserted';
    }

    if (existing.updatedAt.getTime() === order.updatedAt.getTime()) {
      await this.prisma.order.update({
        where: { orderId: order.orderId },
        data,
      });
      return 'updated';
    }

    await this.prisma.order.update({
      where: { orderId: order.orderId },
      data,
    });
    return 'updated';
  }
}
