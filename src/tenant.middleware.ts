import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const tenantId = req.headers['x-tenant-id'];
    req['tenantId'] = typeof tenantId === 'string' ? tenantId : Array.isArray(tenantId) ? tenantId[0] : undefined;
    next();
  }
}

/**
 * Global guard-level hook: after JWT auth sets req.user,
 * backfill req['tenantId'] from the JWT if the header was missing.
 * Use as a NestJS interceptor so it runs after guards.
 */
import { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class TenantFallbackInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    if (!req['tenantId'] && req.user?.tenantId) {
      req['tenantId'] = req.user.tenantId;
    }
    return next.handle();
  }
}
