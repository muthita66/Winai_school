import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export const AuthService = {
    async authenticateUser(code: string, password: string, role: string) {
        let user = null;
        let payload = null;

        if (role === 'student') {
            const student = await prisma.students.findUnique({
                where: { student_code: code }
            });
            if (student && await bcrypt.compare(password, student.password_hash)) {
                user = student;
                const fullName = [student.prefix, student.first_name, student.last_name].filter(Boolean).join(' ').trim();
                payload = {
                    id: student.id,
                    code: student.student_code,
                    role: 'student',
                    name: fullName || student.student_code,
                    photo_url: student.photo_url,
                    class_level: student.class_level,
                    room: student.room
                };
            }
        } else if (role === 'teacher') {
            const teacher = await prisma.teachers.findUnique({
                where: { teacher_code: code }
            });
            if (teacher && await bcrypt.compare(password, teacher.password_hash)) {
                user = teacher;
                const fullName = [teacher.prefix, teacher.first_name, teacher.last_name].filter(Boolean).join(' ').trim();
                payload = {
                    id: teacher.id,
                    code: teacher.teacher_code,
                    role: 'teacher',
                    name: fullName || teacher.teacher_code,
                    photo_url: teacher.photo_url
                };
            }
        } else if (role === 'director') {
            const director = await prisma.directors.findUnique({
                where: { director_code: code }
            });
            if (director && await bcrypt.compare(password, director.password_hash)) {
                user = director;
                const fullName = [director.first_name, director.last_name].filter(Boolean).join(' ').trim();
                payload = {
                    id: director.id,
                    code: director.director_code,
                    role: 'director',
                    name: fullName || director.director_code,
                    photo_url: director.photo_url
                };
            }
        }

        if (!user) {
            throw new Error('Invalid credentials or user not found');
        }

        return payload;
    }
};
