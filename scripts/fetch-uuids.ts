/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { DataSource } from 'typeorm';
import { Student } from '../src/students/student.entity';
// import { Class } from '../src/classes/class.entity';
// import { Section } from '../src/sections/section.entity';
// import { AcademicYear } from '../src/academic-years/academic-year.entity';

const dataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [Student], // Add Class, Section, AcademicYear when available
});

async function fetchUUIDs() {
  await dataSource.initialize();

  const students = await dataSource.getRepository(Student).find();

  // Use raw SQL queries if entities are not defined
  const classes = await dataSource.query('SELECT * FROM classes');
  const sections = await dataSource.query('SELECT * FROM sections');
  const academicYears = await dataSource.query('SELECT * FROM academic_years');

  console.log(
    'Students:',
    students.map((s) => ({ id: s.id, name: `${s.first_name} ${s.last_name}` })),
  );

  console.log('Classes:', classes);
  console.log('Sections:', sections);
  console.log('Academic Years:', academicYears);

  await dataSource.destroy();
}

fetchUUIDs().catch(console.error);
