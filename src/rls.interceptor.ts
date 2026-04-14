import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { DataSource } from 'typeorm';

/**
 * Sets the PostgreSQL session variable `app.current_tenant` on a dedicated
 * query runner so that Row-Level Security (RLS) policies can enforce
 * tenant isolation at the database level.
 *
 * The query runner is wrapped in a transaction with SET LOCAL so the
 * variable only lives for the duration of this request. It is stored
 * on `req.queryRunner` / `req.entityManager` for services that need
 * tenant-scoped raw SQL through a guaranteed-isolated connection.
 *
 * NOTE: Standard @InjectRepository() calls use their own pool connections
 * and are NOT automatically covered by this SET LOCAL. They are still
 * protected by the application-level tenant_id filters in every service.
 * RLS acts as a database-level safety net for any raw queries routed
 * through the request's query runner.
 */
@Injectable()
export class RlsInterceptor implements NestInterceptor {
  constructor(private readonly dataSource: DataSource) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const tenantId: string | undefined = request.tenantId;

    if (!tenantId) {
      return next.handle();
    }

    return new Observable((subscriber) => {
      const queryRunner = this.dataSource.createQueryRunner();

      queryRunner
        .connect()
        .then(() => queryRunner.startTransaction())
        .then(() =>
          queryRunner.query(
            `SELECT set_config('app.current_tenant', $1, true)`,
            [tenantId],
          ),
        )
        .then(() => {
          request.queryRunner = queryRunner;
          request.entityManager = queryRunner.manager;

          next.handle().subscribe({
            next(value) {
              subscriber.next(value);
            },
            error: async (err) => {
              await queryRunner.rollbackTransaction().catch(() => {});
              await queryRunner.release().catch(() => {});
              subscriber.error(err);
            },
            complete: async () => {
              await queryRunner.commitTransaction().catch(() => {});
              await queryRunner.release().catch(() => {});
              subscriber.complete();
            },
          });
        })
        .catch(async (err) => {
          await queryRunner.release().catch(() => {});
          subscriber.error(err);
        });
    });
  }
}
