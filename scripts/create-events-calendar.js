const { DataSource } = require('typeorm');

const ds = new DataSource({
  type: 'postgres',
  url: 'postgresql://postgres.iunouihhapyioadxtece:Sumadhura$88@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false },
});

ds.initialize().then(async () => {
  const queries = [
    // CREATE TYPE doesn't support IF NOT EXISTS — use DO block instead
    `DO $$ BEGIN
       CREATE TYPE event_type_enum AS ENUM ('holiday', 'event', 'exam', 'ptm');
     EXCEPTION WHEN duplicate_object THEN NULL;
     END $$`,

    `CREATE TABLE IF NOT EXISTS events_calendar (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id   UUID NOT NULL,
      title       VARCHAR(255) NOT NULL,
      description TEXT,
      event_date  DATE NOT NULL,
      type        event_type_enum NOT NULL,
      is_school_closed BOOLEAN NOT NULL DEFAULT false,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE INDEX IF NOT EXISTS idx_events_calendar_tenant_id
       ON events_calendar (tenant_id)`,

    `CREATE INDEX IF NOT EXISTS idx_events_calendar_tenant_date
       ON events_calendar (tenant_id, event_date)`,
  ];

  for (const q of queries) {
    try {
      await ds.query(q);
      console.log('OK:', q.slice(0, 80).replace(/\n/g, ' ').trim());
    } catch (e) {
      console.error('FAIL:', e.message.slice(0, 120));
    }
  }

  await ds.destroy();
  console.log('Done.');
}).catch(err => {
  console.error('Connection failed:', err.message);
  process.exit(1);
});
