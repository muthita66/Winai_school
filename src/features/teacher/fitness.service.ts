import { prisma } from '@/lib/prisma';

export const TeacherFitnessService = {
    async getStudentsForTest(teacher_id: number, class_level: string, room: string) {
        return prisma.students.findMany({
            where: { class_level, room },
            orderBy: { student_code: 'asc' },
            include: {
                student_fitness_tests: {
                    where: { teacher_id }
                }
            }
        });
    },
    async saveFitnessTest(data: {
        student_id: number; teacher_id: number; test_name: string;
        result_value: string; standard_value: string; status: string;
        year: number; semester: number;
    }) {
        return prisma.student_fitness_tests.create({ data });
    }
};
