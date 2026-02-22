import { prisma } from '@/lib/prisma';

export const TeacherEvaluationService = {
    async getTeachingEvaluation(teacher_id: number, year?: number, semester?: number) {
        const where: any = { teacher_id };
        if (year) where.year = year;
        if (semester) where.semester = semester;
        return prisma.subject_evaluation_results.findMany({
            where,
            include: { subject_sections: { include: { subjects: true } } },
            orderBy: [{ year: 'desc' }, { semester: 'desc' }, { id: 'desc' }]
        });
    },
    async getAdvisorEvaluation(teacher_id: number, year?: number, semester?: number) {
        const where: any = { teacher_id };
        if (year) where.year = year;
        if (semester) where.semester = semester;
        return prisma.advisor_evaluation_results.findMany({
            where,
            include: { students: true },
            orderBy: [{ year: 'desc' }, { semester: 'desc' }, { id: 'desc' }]
        });
    }
};
