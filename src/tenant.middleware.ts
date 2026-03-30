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
