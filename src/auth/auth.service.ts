import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { UserRole } from '../users/user-role.entity';
import { Role } from '../users/role.entity';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';

interface RegisterUserDto {
  name: string;
  email: string;
  password: string;
}

interface LoginDto {
  email: string;
  password: string;
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
    private readonly jwtService: JwtService,
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
    const { email, password } = loginDto;

    // SUPER_ADMIN: login without tenant_id
    let user: User | null = null;
    if (!tenantId) {
      user = await this.userRepository.findOne({ where: { email } });
    } else {
      user = await this.userRepository.findOne({
        where: { email, tenant_id: tenantId },
      });
    }
    if (!user) throw new UnauthorizedException('Invalid credentials');

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) throw new UnauthorizedException('Invalid credentials');

    // Get all user roles (for SUPER_ADMIN, query without tenant filter)
    const whereClause: any = { user_id: user.id };
    if (tenantId) {
      whereClause.tenant_id = tenantId;
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
      roles: roleNames, // array of roles
    };
    const token = await this.jwtService.signAsync(payload);
    return { access_token: token, roles: roleNames };
  }
}
