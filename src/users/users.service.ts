import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRole } from './user-role.entity';
import { Role } from './role.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserRole)
    private readonly userRoleRepo: Repository<UserRole>,
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
  ) {}

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
