import { prisma } from '@/lib/prisma';

export const ConductService = {
    async getScore(student_id: number) {
        if (!student_id) return { score: 0, additions: 0, deductions: 0 };

        const records = await prisma.behavior_records.findMany({
            where: { student_id },
            include: { behavior_rules: true }
        });

        let additions = 0;
        let deductions = 0;

        records.forEach(r => {
            const points = r.behavior_rules?.points || 0;
            const type = r.behavior_rules?.type || '';
            if (type === 'REWARD' || type === 'reward' || points > 0) {
                additions += Math.abs(points);
            } else {
                deductions += Math.abs(points);
            }
        });

        // Base score of 100 + rewards - deductions
        const score = 100 + additions - deductions;

        return { score, additions, deductions };
    },

    async getHistory(student_id: number) {
        if (!student_id) return [];
        const records = await prisma.behavior_records.findMany({
            where: { student_id },
            include: {
                behavior_rules: true,
                users: {
                    select: { username: true }
                }
            },
            orderBy: { incident_date: 'desc' }
        });

        return records.map(r => ({
            id: r.id,
            date: r.incident_date,
            time: r.incident_time,
            rule_code: r.behavior_rules?.rule_code || '',
            rule_name: r.behavior_rules?.name || '',
            category: r.behavior_rules?.category || '',
            type: r.behavior_rules?.type || '',
            points: r.behavior_rules?.points || 0,
            location: r.location || '',
            remark: r.remark || '',
            status: r.status || '',
            reported_by: r.users?.username || '',
        }));
    }
};
