import { prisma } from '@/lib/prisma';

export const TeacherGradeCutService = {
    async getThresholds(section_id: number) {
        return prisma.grade_thresholds.findFirst({
            where: { section_id }
        });
    },
    async saveThresholds(section_id: number, thresholds: any) {
        const existing = await prisma.grade_thresholds.findFirst({ where: { section_id } });
        if (existing) {
            return prisma.grade_thresholds.update({
                where: { id: existing.id },
                data: thresholds
            });
        }
        return prisma.grade_thresholds.create({
            data: { section_id, ...thresholds }
        });
    },
    async getGradeSummary(section_id: number) {
        const students = await prisma.registrations.findMany({
            where: { section_id },
            include: { students: true },
            distinct: ['student_id']
        });

        const scoreItems = await prisma.score_items.findMany({
            where: { section_id },
            include: { scores: true }
        });

        const thresholds = await prisma.grade_thresholds.findFirst({ where: { section_id } });

        return students.map(reg => {
            const student = reg.students;
            if (!student) return null;

            let totalScore = 0;
            let maxPossible = 0;

            scoreItems.forEach(item => {
                const sc = item.scores.find(s => s.student_id === student.id);
                if (sc) totalScore += Number(sc.score || 0);
                maxPossible += Number(item.max_score || 0);
            });

            const pct = maxPossible > 0 ? (totalScore / maxPossible) * 100 : 0;
            const grade = calculateGrade(pct, thresholds);

            return {
                student_id: student.id,
                student_code: student.student_code,
                first_name: student.first_name,
                last_name: student.last_name,
                total_score: totalScore,
                max_possible: maxPossible,
                percentage: Math.round(pct * 100) / 100,
                grade
            };
        }).filter(Boolean);
    },
    async calculateAndSaveGrades(section_id: number) {
        const summary = await this.getGradeSummary(section_id);
        for (const s of summary) {
            if (!s) continue;
            const existing = await prisma.grades.findFirst({
                where: { student_id: s.student_id, section_id }
            });
            if (existing) {
                await prisma.grades.update({
                    where: { id: existing.id },
                    data: { total_score: s.total_score, grade: s.grade }
                });
            } else {
                await prisma.grades.create({
                    data: {
                        student_id: s.student_id,
                        section_id,
                        total_score: s.total_score,
                        grade: s.grade
                    }
                });
            }
        }
        return { success: true, count: summary.length };
    }
};

function calculateGrade(pct: number, thresholds: any): string {
    if (!thresholds) {
        if (pct >= 80) return '4';
        if (pct >= 75) return '3.5';
        if (pct >= 70) return '3';
        if (pct >= 65) return '2.5';
        if (pct >= 60) return '2';
        if (pct >= 55) return '1.5';
        if (pct >= 50) return '1';
        return '0';
    }
    if (pct >= (thresholds.a || 80)) return '4';
    if (pct >= (thresholds.b_plus || 75)) return '3.5';
    if (pct >= (thresholds.b || 70)) return '3';
    if (pct >= (thresholds.c_plus || 65)) return '2.5';
    if (pct >= (thresholds.c || 60)) return '2';
    if (pct >= (thresholds.d_plus || 55)) return '1.5';
    if (pct >= (thresholds.d || 50)) return '1';
    return '0';
}
