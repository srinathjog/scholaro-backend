import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

export interface JwtPayload {
  userId: string;
  tenantId: string;
  roles: string[];
  // add other fields if needed
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'changeme',
    });
  }

  validate(payload: JwtPayload) {
    // Return user info for request.user
    return {
      userId: payload.userId,
      tenantId: payload.tenantId,
      roles: payload.roles,
    };
  }
}
