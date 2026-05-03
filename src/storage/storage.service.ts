import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly supabase: SupabaseClient;
  private readonly bucket = 'activity-media';

  constructor(private readonly configService: ConfigService) {
    const url = this.configService.get<string>('SUPABASE_URL')!;
    const key = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY')!;
    this.supabase = createClient(url, key);
  }

  /**
   * Upload a file buffer to Supabase Storage.
   * Returns the public URL of the uploaded file.
   */
  async upload(
    buffer: Buffer,
    filename: string,
    contentType: string,
    tenantId: string,
  ): Promise<string> {
    const uniqueName = `activity_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const ext = filename.includes('.') ? filename.split('.').pop() : 'jpg';
    const path = `${tenantId}/${uniqueName}.${ext}`;
    console.log('Uploading file as:', path);

    const { error } = await this.supabase.storage
      .from(this.bucket)
      .upload(path, buffer, {
        contentType,
        upsert: false,
        cacheControl: '3600',
      });

    if (error) {
      this.logger.error(`Supabase upload failed: ${error.message}`);
      throw new Error(`Upload failed: ${error.message}`);
    }

    const { data } = this.supabase.storage
      .from(this.bucket)
      .getPublicUrl(path);

    return data.publicUrl;
  }
}
