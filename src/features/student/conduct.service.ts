import { prisma } from '@/lib/prisma';

export const ConductService = {
    async getScore(student_id: number) {
        if (!student_id) return { score: 0 };
        const result = await prisma.student_conduct.aggregate({
            _sum: {
                point: true
            },
            where: {
                student_id: student_id
            }
        });

        return {
            score: result._sum.point || 0
        };
    },

    // 2. Get conduct history
    async getHistory(student_id: number) {
        if (!student_id) return [];
        return prisma.student_conduct.findMany({
            where: {
                student_id: student_id
            },
            orderBy: {
                log_date: 'desc'
            }
        });
    }
};
