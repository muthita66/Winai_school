import { prisma } from '@/lib/prisma';

async function getStudentUserId(student_id: number) {
    if (!student_id) return null;
    const student = await prisma.students.findUnique({
        where: { id: student_id },
        select: { user_id: true },
    });
    return student?.user_id ?? null;
}

async function resolveEvaluationPeriodId(year?: number, semester?: number) {
    if (!year || !semester) return null;
    const period = await prisma.evaluation_periods.findFirst({
        where: {
            semesters: {
                semester_number: semester,
                academic_years: { year_name: String(year) },
            },
        },
        select: { id: true },
        orderBy: { id: 'desc' },
    });
    return period?.id ?? null;
}

export const LearningResultsService = {
    // Advisor evaluation (1-5 scale)
    async getAdvisorEvaluation(student_id: number, year?: number, semester?: number) {
        if (!student_id) return [];

        const user_id = await getStudentUserId(student_id);
        if (!user_id) return [];

        const where: any = {
            user_id,
            evaluation_forms: { is: { type: 'advisor' } },
        };
        const period_id = await resolveEvaluationPeriodId(year, semester);
        if (period_id) where.period_id = period_id;

        const responses = await prisma.evaluation_responses.findMany({
            where,
            include: {
                evaluation_answers: {
                    include: { evaluation_questions: true },
                },
                evaluation_forms: true,
            },
            orderBy: { submitted_at: 'desc' },
            take: 1,
        });

        if (responses.length === 0) return [];

        return responses[0].evaluation_answers
            .map((a) => ({
                name: a.evaluation_questions?.question_text || a.answer_text || '',
                score: a.score != null ? Number(a.score) : 0,
            }))
            .filter((a) => a.name && Number.isFinite(a.score));
    },

    // Subject-level result derived from assessment scores (normalized to 1-5 for current UI)
    async getSubjectEvaluation(
        student_id: number,
        teaching_assignment_id?: number,
        year?: number,
        semester?: number,
        subject_id?: number
    ) {
        if (!student_id) return [];

        const enrollmentWhere: any = { student_id };
        if (teaching_assignment_id) {
            enrollmentWhere.teaching_assignment_id = teaching_assignment_id;
        }
        if (subject_id || year || semester) {
            enrollmentWhere.teaching_assignments = {};
            if (subject_id) enrollmentWhere.teaching_assignments.subject_id = subject_id;
            if (semester) enrollmentWhere.teaching_assignments.semesters = { semester_number: semester };
            if (year) {
                enrollmentWhere.teaching_assignments.semesters = {
                    ...(enrollmentWhere.teaching_assignments.semesters || {}),
                    academic_years: { year_name: String(year) },
                };
            }
        }

        const enrollments = await prisma.enrollments.findMany({
            where: enrollmentWhere,
            include: {
                student_scores: {
                    include: {
                        assessment_items: {
                            include: { grade_categories: true },
                        },
                    },
                },
                teaching_assignments: {
                    include: {
                        subjects: true,
                        semesters: { include: { academic_years: true } },
                    },
                },
            },
        });

        const results: any[] = [];

        enrollments.forEach((enrollment) => {
            const ta = enrollment.teaching_assignments;
            const subject = ta.subjects;
            const categoryScores = new Map<string, { total: number; max: number }>();

            enrollment.student_scores.forEach((score) => {
                const catName = score.assessment_items?.grade_categories?.name || 'อื่นๆ';
                const existing = categoryScores.get(catName) || { total: 0, max: 0 };
                existing.total += Number(score.score || 0);
                existing.max += Number(score.assessment_items?.max_score || 0);
                categoryScores.set(catName, existing);
            });

            categoryScores.forEach((scores, catName) => {
                const percentage = scores.max > 0 ? Math.round((scores.total / scores.max) * 10000) / 100 : 0;
                const normalizedScore = Math.max(0, Math.min(5, Math.round((percentage / 20) * 100) / 100));

                results.push({
                    topic: catName,
                    name: catName,
                    score: normalizedScore,
                    subject_code: subject?.subject_code || '',
                    subject_name: subject?.subject_name || '',
                    category: catName,
                    total_score: scores.total,
                    max_score: scores.max,
                    percentage,
                    year: ta.semesters?.academic_years?.year_name || '',
                    semester: ta.semesters?.semester_number || 0,
                });
            });
        });

        return results;
    },
};
