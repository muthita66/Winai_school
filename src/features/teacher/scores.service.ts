import { prisma } from '@/lib/prisma';

export const TeacherScoresService = {
    async getSubjects(teacher_id: number) {
        return prisma.subject_sections.findMany({
            where: { teacher_id },
            include: { subjects: true }
        });
    },
    async getHeaders(section_id: number) {
        return prisma.score_items.findMany({
            where: { section_id },
            orderBy: { id: 'asc' }
        });
    },
    async addHeader(section_id: number, title: string, max_score: number) {
        return prisma.score_items.create({
            data: { section_id, title, max_score }
        });
    },
    async updateHeader(id: number, title: string, max_score: number) {
        return prisma.score_items.update({
            where: { id },
            data: { title, max_score }
        });
    },
    async deleteHeader(id: number) {
        await prisma.scores.deleteMany({ where: { item_id: id } });
        return prisma.score_items.delete({ where: { id } });
    },
    async getStudents(section_id: number) {
        const regs = await prisma.registrations.findMany({
            where: { section_id },
            include: { students: true },
            distinct: ['student_id']
        });
        return regs
            .map(r => r.students)
            .filter(Boolean)
            .sort((a: any, b: any) => (a.student_code || '').localeCompare(b.student_code || ''));
    },
    async getScores(header_id: number) {
        return prisma.scores.findMany({ where: { item_id: header_id } });
    },
    async saveScores(header_id: number, scores: { student_id: number; score: number }[]) {
        for (const sc of scores) {
            await prisma.scores.deleteMany({
                where: { item_id: header_id, student_id: sc.student_id }
            });
            await prisma.scores.create({
                data: { item_id: header_id, student_id: sc.student_id, score: sc.score }
            });
        }
        return { success: true };
    }
};
