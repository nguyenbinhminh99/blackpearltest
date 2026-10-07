import { NestFactory } from '@nestjs/core';
import { resolve } from 'path';
import { AppModule } from './app.module';
import { ImportService } from './import/import.service';
import { ReportsService } from './reports/reports.service';

async function run(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    throw new Error(
      'Cách dùng: npm run import -- <file1.json> [file2.json ...] [--export]',
    );
  }

  const exportCsv = args.includes('--export');
  const files = args.filter((arg) => arg !== '--export');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'warn', 'error'],
  });

  try {
    const importService = app.get(ImportService);
    for (const file of files) {
      const summary = await importService.importFile(resolve(file));
      // eslint-disable-next-line no-console
      console.log(JSON.stringify(summary, null, 2));
    }

    if (exportCsv) {
      const reportsService = app.get(ReportsService);
      const filesWritten = await reportsService.exportAllCsv(
        resolve(process.cwd(), 'reports'),
      );
      // eslint-disable-next-line no-console
      console.log('Đã xuất CSV:', filesWritten);
    }
  } finally {
    await app.close();
  }
}

void run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  // eslint-disable-next-line no-console
  console.error(message);
  process.exit(1);
});
