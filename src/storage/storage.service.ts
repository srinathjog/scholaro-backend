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
   * Generate a Supabase signed upload URL for direct client-to-Supabase upload.
   * The caller uploads the file bytes directly to the returned signedUrl via PUT.
   * Returns the signed URL plus the final public URL the client should store.
   */
  async createSignedUploadUrl(
    tenantId: string,
    contentType: string,
  ): Promise<{ signedUrl: string; path: string; publicUrl: string }> {
    const ext = contentType.includes('video') ? 'mp4' : 'jpg';
    const path = `${tenantId}/activity_${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;

    const { data, error } = await this.supabase.storage
      .from(this.bucket)
      .createSignedUploadUrl(path);

    if (error || !data?.signedUrl) {
      this.logger.error(`Failed to create signed URL: ${error?.message}`);
      throw new Error(`Could not generate upload URL: ${error?.message}`);
    }

    const { data: publicData } = this.supabase.storage
      .from(this.bucket)
      .getPublicUrl(path);

    return { signedUrl: data.signedUrl, path, publicUrl: publicData.publicUrl };
  }

  /**
   * Upload a school document (PDF, image, etc.) to the `school-documents` bucket.
   * This bucket has no MIME-type restrictions, unlike `activity-media`.
   * The bucket is created automatically on first use via the service-role key.
   */
  async uploadDocument(
    buffer: Buffer,
    filename: string,
    contentType: string,
    tenantId: string,
  ): Promise<string> {
    const docBucket = 'school-documents';

    // Ensure the bucket exists — idempotent, safe to call on every upload.
    // We silently ignore "already exists" errors.
    const { error: bucketError } = await this.supabase.storage.createBucket(docBucket, {
      public: true,
      allowedMimeTypes: null as any, // no MIME restrictions
    });
    if (bucketError && !bucketError.message.includes('already exists')) {
      this.logger.warn(`Could not create school-documents bucket: ${bucketError.message}`);
    }

    const uniqueName = `doc_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const ext = filename.includes('.') ? filename.split('.').pop() : 'pdf';
    const path = `${tenantId}/${uniqueName}.${ext}`;

    const { error } = await this.supabase.storage
      .from(docBucket)
      .upload(path, buffer, { contentType, upsert: false, cacheControl: '3600' });

    if (error) {
      this.logger.error(`Document upload failed: ${error.message}`);
      throw new Error(`Upload failed: ${error.message}`);
    }

    const { data } = this.supabase.storage.from(docBucket).getPublicUrl(path);
    return data.publicUrl;
  }

  /**
   * Upload a file buffer to Supabase Storage (activity-media bucket — images/videos only).
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
