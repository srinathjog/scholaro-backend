import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Teacher } from './teacher.entity';

@Injectable()
export class TeachersService {
  constructor(
    @InjectRepository(Teacher)
    private readonly teacherRepository: Repository<Teacher>,
  ) {}

  async create(teacherData: Partial<Teacher>): Promise<Teacher> {
    const teacher = this.teacherRepository.create(teacherData);
    return this.teacherRepository.save(teacher);
  }

  // Add more methods as needed
}
