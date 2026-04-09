import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { UserRole } from '../users/user-role.entity';
import { Role } from '../users/role.entity';
import { Tenant } from '../super-admin/tenant.entity';
import { JwtService } from '@nestjs/jwt';
import { MailService } from '../mail/mail.service';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

interface RegisterUserDto {
  name: string;
  email: string;
  password: string;
}

interface LoginDto {
  email: string;
  password: string;
  school_code?: string;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(UserRole)
    private readonly userRoleRepository: Repository<UserRole>,
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
  ) {}

  async register(registerDto: RegisterUserDto, tenantId: string) {
    const { name, email, password } = registerDto;
    // Check for duplicate email in tenant
    const existing = await this.userRepository.findOne({
      where: { email, tenant_id: tenantId },
    });
    if (existing)
      throw new ConflictException('Email already registered for this tenant');

    // Hash password
    const password_hash = await bcrypt.hash(password, 10);
    // Save user
    const user = this.userRepository.create({
      name,
      email,
      password_hash,
      tenant_id: tenantId,
    });
    const savedUser = await this.userRepository.save(user);

    // Assign default role (SCHOOL_ADMIN)
    let role = await this.roleRepository.findOne({
      where: { name: 'SCHOOL_ADMIN' },
    });
    if (!role) {
      role = this.roleRepository.create({ name: 'SCHOOL_ADMIN' });
      role = await this.roleRepository.save(role);
    }
    const userRole = this.userRoleRepository.create({
      tenant_id: tenantId,
      user_id: savedUser.id,
      role_id: role.id,
    });
    await this.userRoleRepository.save(userRole);
    return savedUser;
  }

  async login(loginDto: LoginDto, tenantId: string) {
    const { email, password, school_code } = loginDto;

    // Resolve school_code to tenant UUID if provided
    let resolvedTenantId = tenantId;
    if (school_code) {
      const tenant = await this.tenantRepository.findOne({
        where: { tenant_code: school_code.toUpperCase() },
      });
      if (!tenant) throw new UnauthorizedException('Invalid school code');
      resolvedTenantId = tenant.id;
    }

    // SUPER_ADMIN: login without tenant_id
    let user: User | null = null;
    if (!resolvedTenantId) {
      user = await this.userRepository.findOne({ where: { email } });
    } else {
      user = await this.userRepository.findOne({
        where: { email, tenant_id: resolvedTenantId },
      });
    }
    if (!user) throw new UnauthorizedException('Invalid credentials');

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) throw new UnauthorizedException('Invalid credentials');

    // Get all user roles (for SUPER_ADMIN, query without tenant filter)
    const whereClause: any = { user_id: user.id };
    if (resolvedTenantId) {
      whereClause.tenant_id = resolvedTenantId;
    }
    const userRoles = await this.userRoleRepository.find({
      where: whereClause,
      relations: ['role'],
    });
    const roleNames = userRoles.map(ur => ur.role?.name).filter(Boolean);

    // Create JWT payload
    const payload = {
      userId: user.id,
      tenantId: user.tenant_id,
      roles: roleNames,
      isFirstLogin: user.is_first_login,
    };
    const token = await this.jwtService.signAsync(payload);

    // Resolve tenant name for branding
    let tenantName = '';
    if (user.tenant_id) {
      const t = await this.tenantRepository.findOne({ where: { id: user.tenant_id } });
      if (t) tenantName = t.name;
    }

    return { access_token: token, roles: roleNames, tenant_name: tenantName };
  }

  async requestPasswordReset(email: string, tenantId: string, schoolCode?: string) {
    // Resolve school_code to tenant UUID if provided
    let resolvedTenantId = tenantId;
    if (schoolCode) {
      const tenant = await this.tenantRepository.findOne({
        where: { tenant_code: schoolCode.toUpperCase() },
      });
      if (!tenant) {
        return { message: 'If that email exists, a reset link has been sent.' };
      }
      resolvedTenantId = tenant.id;
    }

    const user = await this.userRepository.findOne({
      where: { email, tenant_id: resolvedTenantId },
    });
    if (!user) {
      // Return success even if user not found to prevent email enumeration
      return { message: 'If that email exists, a reset link has been sent.' };
    }

    // Generate a secure UUID as the reset token
    const token = crypto.randomUUID();
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    user.reset_password_token = token;
    user.reset_password_expires = expires;
    await this.userRepository.save(user);

    // Look up school name for the email
    const tenant = await this.tenantRepository.findOne({ where: { id: resolvedTenantId } });
    const schoolName = tenant?.name || 'Your School';

    // Fire-and-forget — don't block request on email delivery
    this.mailService.sendResetPasswordEmail(email, token, schoolName);

    return { message: 'If that email exists, a reset link has been sent.' };
  }

  async resetPassword(token: string, newPassword: string, tenantId: string, schoolCode?: string) {
    if (!token || !newPassword) {
      throw new BadRequestException('Token and new password are required.');
    }

    // Resolve school_code to tenant UUID if provided
    let resolvedTenantId = tenantId;
    if (schoolCode) {
      const tenant = await this.tenantRepository.findOne({
        where: { tenant_code: schoolCode.toUpperCase() },
      });
      if (!tenant) {
        throw new BadRequestException('Invalid or expired reset token.');
      }
      resolvedTenantId = tenant.id;
    }

    // Find the user by plaintext token + tenant
    const user = await this.userRepository.findOne({
      where: { reset_password_token: token, tenant_id: resolvedTenantId },
    });

    if (!user || !user.reset_password_expires || user.reset_password_expires < new Date()) {
      throw new BadRequestException('Invalid or expired reset token.');
    }

    user.password_hash = await bcrypt.hash(newPassword, 10);
    user.reset_password_token = null;
    user.reset_password_expires = null;
    await this.userRepository.save(user);

    return { message: 'Password has been reset successfully.' };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found.');

    const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isMatch) throw new BadRequestException('Current password is incorrect.');

    user.password_hash = await bcrypt.hash(newPassword, 10);
    user.is_first_login = false;
    await this.userRepository.save(user);

    return { message: 'Password changed successfully.' };
  }
}
