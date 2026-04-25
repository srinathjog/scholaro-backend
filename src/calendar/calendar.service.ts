import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as ExcelJS from 'exceljs';
import { EventsCalendar, EventType } from './event.entity';

@Injectable()
export class CalendarService {
  constructor(
    @InjectRepository(EventsCalendar)
    private readonly eventRepo: Repository<EventsCalendar>,
  ) {}

  // ─── Queries ─────────────────────────────────────────────────────────────────

  /**
   * Returns all events for the tenant, optionally filtered by month + year.
   * Ordered by event_date ascending so the frontend gets a ready-to-display list.
   */
  async getEvents(
    tenantId: string,
    month?: string,
    year?: string,
  ): Promise<EventsCalendar[]> {
    const qb = this.eventRepo
      .createQueryBuilder('ev')
      .where('ev.tenant_id = :tenantId', { tenantId })
      .orderBy('ev.event_date', 'ASC');

    if (month && year) {
      const m = month.padStart(2, '0');
      qb.andWhere(`TO_CHAR(ev.event_date, 'YYYY-MM') = :ym`, {
        ym: `${year}-${m}`,
      });
    }

    return qb.getMany();
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private toNodeBuffer(buf: Buffer | ArrayBuffer | Uint8Array): Buffer {
    if (Buffer.isBuffer(buf)) return buf;
    if (buf instanceof Uint8Array) return Buffer.from(buf);
    if (buf instanceof ArrayBuffer) return Buffer.from(new Uint8Array(buf));
    throw new BadRequestException('Invalid file buffer type');
  }

  private cellToString(val: unknown): string {
    if (val === null || val === undefined) return '';
    if (val instanceof Date) return val.toISOString().split('T')[0];
    if (typeof val === 'object') {
      const obj = val as Record<string, unknown>;
      if (obj['text']) return String(obj['text']);
      if (obj['result'] !== undefined) return String(obj['result']);
    }
    return String(val).trim();
  }

  /**
   * Parses DD-MM-YYYY, DD/MM/YYYY, or YYYY-MM-DD into a YYYY-MM-DD string
   * suitable for a PostgreSQL `date` column.
   */
  private parseDate(raw: string): string {
    const trimmed = raw.trim();

    // Already YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

    // DD-MM-YYYY or DD/MM/YYYY
    const dmyMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (dmyMatch) {
      const [, d, m, y] = dmyMatch;
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }

    throw new Error(
      `Invalid date format: "${raw}". Expected DD-MM-YYYY or YYYY-MM-DD.`,
    );
  }

  /**
   * Normalises a raw type string to the EventType enum value.
   * e.g. 'Holiday', 'HOLIDAY', 'holiday' → EventType.HOLIDAY
   */
  private normaliseType(raw: string): EventType {
    const upper = raw.trim().toUpperCase() as keyof typeof EventType;
    if (EventType[upper] !== undefined) return EventType[upper];
    throw new Error(
      `Unknown event type: "${raw}". Allowed: holiday, event, exam, ptm.`,
    );
  }

  // ─── Bulk Upload ──────────────────────────────────────────────────────────────

  /**
   * Accepts an .xlsx or .csv file buffer.
   *
   * Expected columns (row 1 = header):
   *   Date (DD-MM-YYYY) | Title | Type | Description
   *
   * Upsert logic: if a row with the same tenant_id + title + event_date already
   * exists, update its description and type; otherwise insert a new record.
   *
   * Returns { success: true, count: number }
   */
  async bulkUploadEvents(
    fileBuffer: Buffer | ArrayBuffer | Uint8Array,
    tenantId: string,
  ): Promise<{ success: true; count: number }> {
    const workbook = new ExcelJS.Workbook();
    const nodeBuffer = this.toNodeBuffer(fileBuffer);

    try {
      await workbook.xlsx.load(nodeBuffer as any);
    } catch {
      try {
        const csvContent = nodeBuffer.toString('utf-8');
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const stream = new (require('stream').Readable)();
        stream.push(csvContent);
        stream.push(null);
        await workbook.csv.read(stream);
      } catch {
        throw new BadRequestException(
          'Unable to parse file. Please upload a valid .xlsx or .csv file.',
        );
      }
    }

    const worksheet = workbook.worksheets[0];
    if (!worksheet) throw new BadRequestException('No worksheet found in file.');

    const rowErrors: Array<{ row: number; error: string }> = [];
    let count = 0;

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // skip header

      const values = Array.isArray(row.values) ? row.values.slice(1) : [];
      const rawDate = this.cellToString(values[0]);
      const rawTitle = this.cellToString(values[1]);
      const rawType = this.cellToString(values[2]);
      const rawDesc = this.cellToString(values[3]);

      if (!rawDate && !rawTitle && !rawType) return; // blank row — skip silently

      const missing: string[] = [];
      if (!rawDate) missing.push('Date');
      if (!rawTitle) missing.push('Title');
      if (!rawType) missing.push('Type');

      if (missing.length) {
        rowErrors.push({
          row: rowNumber,
          error: `Missing required columns: ${missing.join(', ')}`,
        });
        return;
      }

      // Validate / parse — collect errors without aborting the whole upload
      let eventDate: string;
      try {
        eventDate = this.parseDate(rawDate);
      } catch (e: unknown) {
        rowErrors.push({ row: rowNumber, error: (e as Error).message });
        return;
      }

      let type: EventType;
      try {
        type = this.normaliseType(rawType);
      } catch (e: unknown) {
        rowErrors.push({ row: rowNumber, error: (e as Error).message });
        return;
      }

      const title = rawTitle.trim();
      const description = rawDesc || undefined;

      // Queue upsert (fire-and-forget inside eachRow; we resolve below)
      // We collect promises and await them after the loop.
      (row as unknown as { _promise?: Promise<void> })._promise = (async () => {
        const existing = await this.eventRepo.findOne({
          where: { tenant_id: tenantId, title, event_date: eventDate },
        });

        if (existing) {
          await this.eventRepo.update(existing.id as string, {
            description,
            type,
          });
        } else {
          const entity = this.eventRepo.create({
            tenant_id: tenantId,
            title,
            event_date: eventDate,
            type,
            description,
          });
          await this.eventRepo.save(entity);
        }
        count++;
      })();
    });

    // Collect all async promises queued during eachRow
    const promises: Promise<void>[] = [];
    worksheet.eachRow((row) => {
      const p = (row as unknown as { _promise?: Promise<void> })._promise;
      if (p) promises.push(p);
    });
    await Promise.all(promises);

    if (rowErrors.length > 0 && count === 0) {
      // All rows failed
      throw new BadRequestException({
        message: 'All rows failed validation. No records were saved.',
        errors: rowErrors,
      });
    }

    return { success: true, count };
  }
}
