import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface SchoolStats {
  overview: {
    total_students: number;
    total_teachers: number;
    total_classes: number;
  };
  attendance: {
    today: string;
    total_enrolled: number;
    present_today: number;
    absent_today: number;
    attendance_percentage: number;
  };
  financials: {
    month: string;
    total_due: number;
    total_collected: number;
    collection_rate: number;
    overdue_count: number;
  };
  engagement: {
    activities_last_24h: number;
    photos_last_24h: number;
    active_teachers_last_24h: number;
  };
  alerts: {
    not_checked_out: number;
    students_not_checked_out: { student_name: string; class_name: string }[];
  };
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly dataSource: DataSource) {}

  async getSchoolStats(tenantId: string): Promise<SchoolStats> {
    const [overview, attendance, financials, engagement, alerts] =
      await Promise.all([
        this.getOverview(tenantId),
        this.getAttendance(tenantId),
        this.getFinancials(tenantId),
        this.getEngagement(tenantId),
        this.getAlerts(tenantId),
      ]);

    return { overview, attendance, financials, engagement, alerts };
  }

  private async getOverview(tenantId: string): Promise<SchoolStats['overview']> {
    const [students, teachers, classes] = await Promise.all([
      this.dataSource.query(
        `SELECT COUNT(*) as count FROM students WHERE tenant_id = $1 AND status = 'active'`,
        [tenantId],
      ),
      this.dataSource.query(
        `SELECT COUNT(DISTINCT ur.user_id) as count
         FROM user_roles ur
         JOIN roles r ON r.id = ur.role_id
         JOIN users u ON u.id = ur.user_id AND u.tenant_id = $1 AND u.status = 'active'
         WHERE ur.tenant_id = $1 AND r.name = 'TEACHER'`,
        [tenantId],
      ),
      this.dataSource.query(
        `SELECT COUNT(*) as count FROM classes WHERE tenant_id = $1`,
        [tenantId],
      ),
    ]);

    return {
      total_students: parseInt(students[0].count, 10),
      total_teachers: parseInt(teachers[0].count, 10),
      total_classes: parseInt(classes[0].count, 10),
    };
  }

  private async getAttendance(tenantId: string): Promise<SchoolStats['attendance']> {
    const today = new Date().toISOString().split('T')[0];

    const [enrolledResult, attendanceResult] = await Promise.all([
      this.dataSource.query(
        `SELECT COUNT(*) as count FROM enrollments WHERE tenant_id = $1 AND status = 'active'`,
        [tenantId],
      ),
      this.dataSource.query(
        `SELECT
           COUNT(*) FILTER (WHERE a.status = 'present' OR a.status = 'late') as present,
           COUNT(*) FILTER (WHERE a.status = 'absent') as absent
         FROM attendance a
         WHERE a.tenant_id = $1 AND a.date = $2`,
        [tenantId, today],
      ),
    ]);

    const totalEnrolled = parseInt(enrolledResult[0].count, 10);
    const present = parseInt(attendanceResult[0].present, 10);
    const absent = parseInt(attendanceResult[0].absent, 10);
    const percentage = totalEnrolled > 0
      ? Math.round((present / totalEnrolled) * 100)
      : 0;

    return {
      today,
      total_enrolled: totalEnrolled,
      present_today: present,
      absent_today: absent,
      attendance_percentage: percentage,
    };
  }

  private async getFinancials(tenantId: string): Promise<SchoolStats['financials']> {
    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const monthEnd = nextMonth.toISOString().split('T')[0];
    const monthLabel = now.toLocaleString('en-US', { month: 'long', year: 'numeric' });

    const result = await this.dataSource.query(
      `SELECT
         COALESCE(SUM(amount), 0) as total_due,
         COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) as total_collected,
         COUNT(*) FILTER (WHERE status = 'overdue') as overdue_count
       FROM fees
       WHERE tenant_id = $1
         AND due_date >= $2
         AND due_date < $3`,
      [tenantId, monthStart, monthEnd],
    );

    const totalDue = parseFloat(result[0].total_due);
    const totalCollected = parseFloat(result[0].total_collected);
    const collectionRate = totalDue > 0
      ? Math.round((totalCollected / totalDue) * 100)
      : 0;

    return {
      month: monthLabel,
      total_due: totalDue,
      total_collected: totalCollected,
      collection_rate: collectionRate,
      overdue_count: parseInt(result[0].overdue_count, 10),
    };
  }

  private async getEngagement(tenantId: string): Promise<SchoolStats['engagement']> {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const [activitiesResult, photosResult, teachersResult] = await Promise.all([
      this.dataSource.query(
        `SELECT COUNT(*) as count FROM activities WHERE tenant_id = $1 AND created_at >= $2`,
        [tenantId, since],
      ),
      this.dataSource.query(
        `SELECT COUNT(*) as count
         FROM activity_media am
         JOIN activities a ON a.id = am."activityId"
         WHERE a.tenant_id = $1 AND am.created_at >= $2 AND am.media_type = 'image'`,
        [tenantId, since],
      ),
      this.dataSource.query(
        `SELECT COUNT(DISTINCT created_by) as count
         FROM activities
         WHERE tenant_id = $1 AND created_at >= $2`,
        [tenantId, since],
      ),
    ]);

    return {
      activities_last_24h: parseInt(activitiesResult[0].count, 10),
      photos_last_24h: parseInt(photosResult[0].count, 10),
      active_teachers_last_24h: parseInt(teachersResult[0].count, 10),
    };
  }

  private async getAlerts(tenantId: string): Promise<SchoolStats['alerts']> {
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();
    const hour = now.getHours();

    // Only flag not-checked-out after 2 PM
    if (hour < 14) {
      return { not_checked_out: 0, students_not_checked_out: [] };
    }

    const rows = await this.dataSource.query(
      `SELECT s.first_name || ' ' || s.last_name as student_name, c.name as class_name
       FROM attendance a
       JOIN enrollments e ON e.id = a.enrollment_id
       JOIN students s ON s.id = e.student_id
       JOIN classes c ON c.id = e.class_id
       WHERE a.tenant_id = $1
         AND a.date = $2
         AND (a.status = 'present' OR a.status = 'late')`,
      [tenantId, today],
    );

    return {
      not_checked_out: rows.length,
      students_not_checked_out: rows.map((r: { student_name: string; class_name: string }) => ({
        student_name: r.student_name,
        class_name: r.class_name,
      })),
    };
  }

  async getAttendanceChart(tenantId: string): Promise<{ date: string; present: number; absent: number; total: number }[]> {
    const rows = await this.dataSource.query(
      `WITH dates AS (
         SELECT generate_series(
           CURRENT_DATE - INTERVAL '6 days',
           CURRENT_DATE,
           '1 day'
         )::date AS day
       ),
       enrolled AS (
         SELECT COUNT(*) as total FROM enrollments WHERE tenant_id = $1 AND status = 'active'
       )
       SELECT
         d.day::text as date,
         COALESCE(COUNT(a.id) FILTER (WHERE a.status IN ('present','late')), 0)::int as present,
         COALESCE(COUNT(a.id) FILTER (WHERE a.status = 'absent'), 0)::int as absent,
         (SELECT total FROM enrolled)::int as total
       FROM dates d
       LEFT JOIN attendance a ON a.date = d.day AND a.tenant_id = $1
       GROUP BY d.day
       ORDER BY d.day`,
      [tenantId],
    );

    return rows;
  }
}
