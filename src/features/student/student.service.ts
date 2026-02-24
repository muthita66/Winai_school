import { prisma } from '@/lib/prisma';

export const StudentService = {
    async getAllStudents() {
        const students = await prisma.students.findMany({
            take: 50,
            orderBy: { student_code: 'asc' },
            include: {
                name_prefixes: true,
                classrooms: {
                    include: { grade_levels: true }
                },
                genders: true,
                student_statuses: true,
            }
        });

        return students.map(s => ({
            id: s.id,
            student_code: s.student_code,
            prefix: s.name_prefixes?.prefix_name || '',
            first_name: s.first_name,
            last_name: s.last_name,
            gender: s.genders?.name || '',
            class_level: s.classrooms?.grade_levels?.name || '',
            room: s.classrooms?.room_name || '',
            status: s.student_statuses?.status_name || '',
            phone: s.phone || '',
        }));
    },

    async getStudentById(student_code: string) {
        const s = await prisma.students.findUnique({
            where: { student_code },
            include: {
                name_prefixes: true,
                classrooms: {
                    include: { grade_levels: true }
                },
                genders: true,
                student_statuses: true,
            }
        });
        if (!s) return null;
        return {
            id: s.id,
            student_code: s.student_code,
            prefix: s.name_prefixes?.prefix_name || '',
            first_name: s.first_name,
            last_name: s.last_name,
            gender: s.genders?.name || '',
            class_level: s.classrooms?.grade_levels?.name || '',
            room: s.classrooms?.room_name || '',
            status: s.student_statuses?.status_name || '',
            phone: s.phone || '',
            address: s.address || '',
            date_of_birth: s.date_of_birth,
        };
    },
};
