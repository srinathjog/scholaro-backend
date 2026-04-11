---
applyTo: "scholaro-backend/src/**/*.entity.ts"
description: "Enforces Scholaro entity conventions: tenant_id, uuid PK, snake_case columns, | undefined pattern"
---

# Entity Conventions

- Always use `@PrimaryGeneratedColumn('uuid')` for the primary key
- Always include a `tenant_id` column with `@Index()`:
  ```ts
  @Index()
  @Column({ type: 'uuid' })
  tenant_id: string | undefined;
  ```
- Use snake_case for all column names
- Use `| undefined` for all field types (not `?` optional marker)
- Use `@CreateDateColumn()` for `created_at` timestamps
- Use explicit `type` in `@Column()` decorators (e.g., `{ type: 'varchar', length: 255 }`)
- Never add `synchronize: true` or auto-migration logic in entities
