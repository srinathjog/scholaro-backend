export class CreateActivityWithMediaDto {
  tenant_id!: string;
  class_id!: string;
  section_id?: string;
  title!: string;
  description?: string;
  activity_type!: string;
  created_by!: string;
  media_urls!: string[];
}
