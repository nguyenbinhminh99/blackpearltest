import { Body, Controller, Post } from '@nestjs/common';
import { IsNotEmpty, IsString } from 'class-validator';
import { resolve } from 'path';
import { ImportService } from './import.service';
import { ImportSummary } from './types';

class ImportFileDto {
  @IsString()
  @IsNotEmpty()
  path!: string;
}

@Controller('import')
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  @Post()
  async importFile(@Body() body: ImportFileDto): Promise<ImportSummary> {
    const absolutePath = resolve(body.path);
    return this.importService.importFile(absolutePath);
  }
}
