import {
  Controller,
  Get,
  Header,
  NotFoundException,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { resolve } from 'path';
import { CsvReportType, ReportsService } from './reports.service';
import {
  MissingDataRow,
  ReconcileRow,
  RejectedRow,
  RevenueReport,
} from './report.types';

const CSV_TYPES: ReadonlySet<string> = new Set([
  'revenue',
  'missing',
  'reconcile',
  'rejected',
]);

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('revenue')
  getRevenue(
    @Query('store_id') storeId?: string,
    @Query('from') fromDate?: string,
    @Query('to') toDate?: string,
  ): Promise<RevenueReport> {
    return this.reportsService.getRevenue(storeId, fromDate, toDate);
  }

  @Get('missing')
  getMissing(
    @Query('store_id') storeId?: string,
    @Query('from') fromDate?: string,
    @Query('to') toDate?: string,
  ): Promise<readonly MissingDataRow[]> {
    return this.reportsService.getMissingData(storeId, fromDate, toDate);
  }

  @Get('reconcile')
  getReconcile(
    @Query('store_id') storeId?: string,
    @Query('from') fromDate?: string,
    @Query('to') toDate?: string,
  ): Promise<readonly ReconcileRow[]> {
    return this.reportsService.getReconcile(storeId, fromDate, toDate);
  }

  @Get('rejected')
  getRejected(
    @Query('batch_name') batchName?: string,
  ): Promise<readonly RejectedRow[]> {
    return this.reportsService.getRejected(batchName);
  }

  @Get('stores')
  getStores(): Promise<readonly string[]> {
    return this.reportsService.getStores();
  }

  @Get('csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async downloadCsv(
    @Query('type') type: string,
    @Query('store_id') storeId: string | undefined,
    @Query('from') fromDate: string | undefined,
    @Query('to') toDate: string | undefined,
    @Res({ passthrough: false }) res: Response,
  ): Promise<void> {
    if (!CSV_TYPES.has(type)) {
      throw new NotFoundException(
        'type phải là revenue | missing | reconcile | rejected',
      );
    }

    const file = await this.reportsService.buildCsvReport(
      type as CsvReportType,
      storeId,
      fromDate,
      toDate,
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.filename}"`,
    );
    res.send(file.content);
  }

  @Post('export-csv')
  async exportCsv(
    @Query('store_id') storeId?: string,
    @Query('from') fromDate?: string,
    @Query('to') toDate?: string,
  ): Promise<{ files: readonly string[] }> {
    const outputDir = resolve(process.cwd(), 'reports');
    const files = await this.reportsService.exportAllCsv(
      outputDir,
      storeId,
      fromDate,
      toDate,
    );
    return { files };
  }
}
