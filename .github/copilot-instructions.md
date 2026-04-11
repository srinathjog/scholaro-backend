# Scholaro Preschool — Project Guidelines

> **PRODUCTION SYSTEM** — Real schools are onboarded. Every change must be safe, backward-compatible, and tested before deploy.

## Golden Rules

1. **No destructive changes** — Never drop columns/tables, never rename DB fields without a migration plan
2. **`synchronize: false` in production** — The `DATABASE_URL` path already does this; never change it
3. **Tenant isolation is sacred** — Every query MUST filter by `tenant_id`. Missing tenant filters = data leak across schools
4. **Test before deploy** — Run `npm test` (backend) and `ng build` (frontend) before pushing. If it doesn't build, it doesn't ship

## Architecture

### Monorepo Structure

| Folder | Stack | Purpose |
|--------|-------|---------|
| `scholaro-backend/` | NestJS 11 + TypeORM + PostgreSQL | REST API, multi-tenant |
| `scholaro-frontend/` | Angular 21 + Tailwind CSS + Angular Material | PWA, role-based SPA |

### Multi-Tenancy Model

- **Header-based**: `x-tenant-id` header on every request
- **Middleware**: `TenantMiddleware` extracts header → `req.tenantId`
- **Fallback**: `TenantFallbackInterceptor` fills from JWT if header missing
- **Frontend**: `TenantInterceptor` auto-attaches header to all HTTP calls
- All entities carry a `tenant_id: uuid` column indexed for filtering

### Roles & Auth

| Role | Route prefix | Guard |
|------|-------------|-------|
| `SCHOOL_ADMIN` | `/admin` | `RoleGuard(['SCHOOL_ADMIN'])` |
| `TEACHER` | `/teacher` | `RoleGuard(['TEACHER'])` |
| `PARENT` | `/parent` | `RoleGuard(['PARENT'])` |
| `SUPER_ADMIN` | `/super-admin` | `RoleGuard(['SUPER_ADMIN'])` |

- JWT payload: `{ userId, tenantId, roles[] }`
- Backend: `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles(...)` decorator

### Storage

- **New uploads** → Supabase Storage
- **Legacy uploads** → local `/uploads/` directory (served as static assets)

## Build & Test

### Backend (`scholaro-backend/`)

```bash
npm install
npm run build          # nest build
npm test               # jest (unit)
npm run test:e2e       # jest --config test/jest-e2e.json
npm run start:dev      # nest start --watch
npm run lint           # eslint --fix
```

**Database**: PostgreSQL via `DATABASE_URL` env var (production) or `DB_HOST/DB_PORT/DB_USERNAME/DB_PASSWORD/DB_NAME` (local).

### Frontend (`scholaro-frontend/`)

```bash
npm install
ng serve               # dev server at localhost:4200
ng build               # production build
ng test                # vitest
```

## Conventions

### Backend Patterns

- **Entities**: TypeORM decorators, `@PrimaryGeneratedColumn('uuid')`, snake_case columns, `| undefined` for optional fields
- **Controllers**: `@Headers('x-tenant-id') tenantId: string` parameter on every route, validate with `if (!tenantId) throw new BadRequestException(...)`
- **Services**: Inject repositories via `@InjectRepository()`, always filter `where: { tenant_id: tenantId }`
- **Modules**: One module per domain (students, fees, attendance, etc.), registered in `AppModule`
- **Config**: `@nestjs/config` with `ConfigModule.forRoot({ isGlobal: true })`

### Frontend Patterns

- **Angular 21 standalone components** — no NgModules for feature components
- **Lazy-loaded routes** via `loadComponent: () => import(...).then(m => m.Component)`
- **Styling**: Tailwind CSS + SCSS + Angular Material
- **Services** in `core/services/`, guards in `core/guards/`, interceptors in `core/interceptors/`
- **Features** organized by role: `features/admin/`, `features/teacher/`, `features/parent/`, `features/super-admin/`

### Naming

- Backend: snake_case for DB columns and entity fields, camelCase for TS variables/methods
- Frontend: kebab-case filenames, PascalCase component classes
- Routes: lowercase path segments

## Safety Checklist (Before Every PR)

- [ ] All queries filter by `tenant_id`
- [ ] No `synchronize: true` when `DATABASE_URL` is set
- [ ] `ng build` succeeds with no errors
- [ ] `npm run build` succeeds in backend
- [ ] No hardcoded tenant IDs, API keys, or secrets
- [ ] New endpoints protected with `@UseGuards(JwtAuthGuard, RolesGuard)` and `@Roles(...)`
