import { prisma } from '@/lib/prisma';

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
        const period_id = await resolveEvaluationPeriodId(year, semester);
        const responseRows = await prisma.$queryRawUnsafe<Array<{ id: number }>>(
            `
            SELECT er.id
            FROM public.evaluation_responses er
            INNER JOIN public.evaluation_forms ef ON ef.id = er.form_id
            WHERE LOWER(COALESCE(ef.type, '')) = 'advisor'
              AND UPPER(COALESCE(er.target_type, '')) = 'STUDENT'
              AND er.target_id = ${Number(student_id)}
              ${period_id ? `AND er.period_id = ${Number(period_id)}` : ''}
            ORDER BY er.submitted_at DESC NULLS LAST, er.id DESC
            LIMIT 1
            `
        );

        const latestResponseId = responseRows?.[0]?.id;
        if (!latestResponseId) return [];

        const answers = await prisma.evaluation_answers.findMany({
            where: { response_id: latestResponseId },
            include: { evaluation_questions: true },
            orderBy: { id: 'asc' },
        });

        return answers
            .filter((a) => a.score != null)
            .map((a) => ({
                name: a.evaluation_questions?.question_text || a.answer_text || '',
                score: Number(a.score),
            }))
            .filter((a) => a.name && Number.isFinite(a.score));
    },

    // Subject-level results derived from actual teacher evaluations
    async getSubjectEvaluation(
        student_id: number,
        teaching_assignment_id?: number,
        year?: number,
        semester?: number,
        subject_id?: number
    ) {
        if (!student_id) return [];

        const student = await prisma.students.findUnique({
            where: { id: student_id },
            select: { user_id: true }
        });

        if (!student) return [];

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
                teaching_assignments: {
                    include: {
                        subjects: true,
                        semesters: { include: { academic_years: true } },
                        teachers: true
                    },
                },
            },
        });

        if (enrollments.length === 0) return [];

        const period_id = await resolveEvaluationPeriodId(year, semester);

        // Fetch teaching forms for evaluating students
        const formIds = (await prisma.evaluation_forms.findMany({
            where: { type: 'teacher_eval_student' },
            select: { id: true }
        })).map(f => f.id);

        if (formIds.length === 0) return [];

        const results: any[] = [];

        // For each enrollment, find the latest evaluation response
        for (const enrollment of enrollments) {
            const ta = enrollment.teaching_assignments;
            const subject = ta.subjects;
            const teacher = ta.teachers;

            // Raw SQL because user_id (evaluator) might not be strictly checked if we just want evaluations targeting this student
            // For SUBJECT_STUDENT, target_id is the student ID, and evaluator_user_id is the teacher's user_id
            let sql = `SELECT id, submitted_at FROM evaluation_responses 
                       WHERE target_type = 'SUBJECT_STUDENT' 
                       AND target_id = $1
                       AND form_id IN (${formIds.join(',')})`;
            const params: any[] = [student_id];

            if (teacher?.user_id) {
                sql += ` AND evaluator_user_id = $2`;
                params.push(teacher.user_id);
            }
            if (period_id) {
                sql += ` AND period_id = $${params.length + 1}`;
                params.push(Number(period_id));
            }

            sql += ` ORDER BY submitted_at DESC LIMIT 1`;

            const latestResponseResult = await prisma.$queryRawUnsafe<any[]>(sql, ...params);
            const latestResponse = latestResponseResult[0];

            if (!latestResponse) continue; // No evaluation for this subject

            const answers = await prisma.evaluation_answers.findMany({
                where: { response_id: latestResponse.id },
                include: { evaluation_questions: true }
            });

            const topics = answers
                .filter(a => a.score != null)
                .map(a => ({
                    name: a.evaluation_questions?.question_text || a.answer_text,
                    score: Number(a.score)
                }));

            const feedback = answers.find(a => a.score == null)?.answer_text || '';
            const totalScore = topics.reduce((sum, t) => sum + (t.score || 0), 0);
            const avgScore = topics.length > 0 ? (totalScore / topics.length).toFixed(2) : 0;

            results.push({
                subject_code: subject?.subject_code || '',
                subject_name: subject?.subject_name || '',
                teacher_name: `${teacher?.first_name || ''} ${teacher?.last_name || ''}`.trim(),
                topics,
                feedback,
                average_score: Number(avgScore),
                submitted_at: latestResponse.submitted_at,
                year: ta.semesters?.academic_years?.year_name || '',
                semester: ta.semesters?.semester_number || 0,
            });
        }

        return results;
    },
};
