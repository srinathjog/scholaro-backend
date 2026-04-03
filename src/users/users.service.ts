import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { UserRole } from './user-role.entity';
import { Role } from './role.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserRole)
    private readonly userRoleRepo: Repository<UserRole>,
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
    private readonly dataSource: DataSource,
  ) {}

  async getStaff(tenantId: string) {
    return this.dataSource.query(
      `SELECT u.id, u.name, u.email, u.status, u.created_at,
              STRING_AGG(r.name, ', ') as roles
       FROM users u
       JOIN user_roles ur ON ur.user_id = u.id AND ur.tenant_id = $1
       JOIN roles r ON r.id = ur.role_id
       WHERE u.tenant_id = $1
       AND u.id NOT IN (
         SELECT ur2.user_id FROM user_roles ur2
         JOIN roles r2 ON r2.id = ur2.role_id
         WHERE ur2.tenant_id = $1 AND r2.name = 'PARENT'
       )
       GROUP BY u.id
       ORDER BY u.created_at DESC`,
      [tenantId],
    );
  }

  async assignRole(userId: string, roleName: string, tenantId: string) {
    // Find role
    const role = await this.roleRepo.findOne({ where: { name: roleName } });
    if (!role) throw new NotFoundException('Role not found');
    // Prevent duplicate
    const exists = await this.userRoleRepo.findOne({
      where: { user_id: userId, role_id: role.id, tenant_id: tenantId },
    });
    if (exists) throw new ConflictException('User already has this role');
    // Assign role
    const userRole = this.userRoleRepo.create({
      user_id: userId,
      role_id: role.id,
      tenant_id: tenantId,
    });
    return this.userRoleRepo.save(userRole);
  }
}
