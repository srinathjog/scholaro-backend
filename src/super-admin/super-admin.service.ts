import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Tenant } from './tenant.entity';
import { OnboardSchoolDto } from './dto/onboard-school.dto';
import * as bcrypt from 'bcryptjs';

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

  async getAllTenants() {
    return this.dataSource.query(
      `SELECT
         t.id,
         t.name,
         t.subdomain,
         t.status,
         t.created_at,
         a.admin_email,
         a.admin_name
       FROM tenants t
       LEFT JOIN LATERAL (
         SELECT u.email as admin_email, u.name as admin_name
         FROM users u
         JOIN user_roles ur ON ur.user_id = u.id AND ur.tenant_id = t.id
         JOIN roles r ON r.id = ur.role_id AND r.name = 'SCHOOL_ADMIN'
         WHERE u.tenant_id = t.id
         LIMIT 1
       ) a ON true
       ORDER BY t.created_at DESC`,
    );
  }

  async updateTenantStatus(tenantId: string, status: string) {
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    if (!tenant) {
      throw new NotFoundException(`Tenant ${tenantId} not found`);
    }
    tenant.status = status;
    return this.tenantRepo.save(tenant);
  }

  async onboardNewSchool(dto: OnboardSchoolDto) {
    // Check subdomain uniqueness
    const existing = await this.tenantRepo.findOne({
      where: { subdomain: dto.subdomain },
    });
    if (existing) {
      throw new ConflictException(
        `Subdomain "${dto.subdomain}" is already taken`,
      );
    }

    const tempPassword = 'Welcome@2026';

    return this.dataSource.transaction(async (manager) => {
      // 1. Create tenant
      const tenant = manager.create('tenants', {
        name: dto.schoolName,
        subdomain: dto.subdomain,
        status: 'active',
      });
      const savedTenant = await manager.save('tenants', tenant);
      const tenantId = (savedTenant as any).id;

      // 2. Create admin user
      const passwordHash = await bcrypt.hash(tempPassword, 10);
      const user = manager.create('users', {
        tenant_id: tenantId,
        name: dto.adminName,
        email: dto.adminEmail,
        password_hash: passwordHash,
        status: 'active',
      });
      const savedUser = await manager.save('users', user);
      const userId = (savedUser as any).id;

      // 3. Find or create SCHOOL_ADMIN role
      let role = await manager.findOne('roles', {
        where: { name: 'SCHOOL_ADMIN' },
      });
      if (!role) {
        role = await manager.save('roles', { name: 'SCHOOL_ADMIN' });
      }

      // 4. Assign SCHOOL_ADMIN role
      await manager.save('user_roles', {
        tenant_id: tenantId,
        user_id: userId,
        role_id: (role as any).id,
      });

      return {
        tenant_id: tenantId,
        school_name: dto.schoolName,
        subdomain: dto.subdomain,
        admin_email: dto.adminEmail,
        temporary_password: tempPassword,
      };
    });
  }
}
