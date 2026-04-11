---
description: "Scaffold a new NestJS backend module with entity, controller, service, DTO, and module following Scholaro patterns"
---

# New Backend Module

Create a new NestJS module in `scholaro-backend/src/{{ moduleName }}/` with these files:

1. **Entity** (`{{ moduleName }}.entity.ts`): uuid PK, `tenant_id` with `@Index()`, snake_case columns, `| undefined` types
2. **DTO** (`dto/create-{{ moduleName }}.dto.ts`): class-validator decorators
3. **Service** (`{{ moduleName }}.service.ts`): `@InjectRepository()`, all queries filter by `tenant_id`
4. **Controller** (`{{ moduleName }}.controller.ts`): `@UseGuards(JwtAuthGuard, RolesGuard)`, `@Roles(...)`, `@Headers('x-tenant-id')` on every route, tenant validation
5. **Module** (`{{ moduleName }}.module.ts`): imports `TypeOrmModule.forFeature([Entity])`, exports service

Then register the module in `app.module.ts`.

## Input

- **moduleName**: {{ moduleName }}
- **roles**: Which roles can access this module (e.g., SCHOOL_ADMIN, TEACHER)
- **fields**: List of entity fields with types
