---
applyTo: "scholaro-backend/src/**/*.controller.ts"
description: "Enforces Scholaro controller conventions: tenant header, guards, role decorators"
---

# Controller Conventions

- Every controller must have `@UseGuards(JwtAuthGuard, RolesGuard)` and `@Roles(...)` at class or method level
- Every route must extract tenant: `@Headers('x-tenant-id') tenantId: string`
- Every route must validate tenant:
  ```ts
  if (!tenantId) throw new BadRequestException('Missing x-tenant-id header');
  ```
- Pass `tenantId` to every service method — never let services query without it
- Never hardcode tenant IDs
- Use `@Param()`, `@Body()`, `@Query()` with proper DTOs validated by class-validator
