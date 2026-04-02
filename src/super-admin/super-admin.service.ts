import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Tenant } from './tenant.entity';

export interface PlatformStats {
  total_schools: number;
  total_schools_active: number;
  total_students_all: number;
  new_signups_this_month: Tenant[];
  schools: {
    id: string;
    name: string;
    subdomain: string;
    status: string;
    student_count: number;
    teacher_count: number;
    created_at: Date;
  }[];
}

@Injectable()
export class SuperAdminService {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    private readonly dataSource: DataSource,
  ) {}

  async getPlatformStats(): Promise<PlatformStats> {
    const [tenants, totalStudents, schoolDetails, newSignups] =
      await Promise.all([
        this.tenantRepo.find({ order: { created_at: 'DESC' } }),
        this.dataSource.query(
          `SELECT COUNT(*) as count FROM students WHERE status = 'active'`,
        ),
        this.dataSource.query(
          `SELECT
             t.id,
             t.name,
             t.subdomain,
             t.status,
             t.created_at,
             COALESCE(s.student_count, 0)::int as student_count,
             COALESCE(tc.teacher_count, 0)::int as teacher_count
           FROM tenants t
           LEFT JOIN (
             SELECT tenant_id, COUNT(*) as student_count
             FROM students WHERE status = 'active'
             GROUP BY tenant_id
           ) s ON s.tenant_id = t.id
           LEFT JOIN (
             SELECT ur.tenant_id, COUNT(DISTINCT ur.user_id) as teacher_count
             FROM user_roles ur
             JOIN roles r ON r.id = ur.role_id AND r.name = 'TEACHER'
             GROUP BY ur.tenant_id
           ) tc ON tc.tenant_id = t.id
           ORDER BY t.created_at DESC`,
        ),
        this.getNewSignups(),
      ]);

    return {
      total_schools: tenants.length,
      total_schools_active: tenants.filter((t) => t.status === 'active').length,
      total_students_all: parseInt(totalStudents[0].count, 10),
      new_signups_this_month: newSignups,
      schools: schoolDetails,
    };
  }

  private async getNewSignups(): Promise<Tenant[]> {
    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

    return this.tenantRepo
      .createQueryBuilder('t')
      .where('t.created_at >= :monthStart', { monthStart })
      .orderBy('t.created_at', 'DESC')
      .getMany();
  }
}
