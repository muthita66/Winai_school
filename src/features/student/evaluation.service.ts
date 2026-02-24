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

export const EvaluationService = {
    // Get question topics (flattened) for current UI
    async getTopics(year?: number, semester?: number) {
        void year;
        void semester;

        const forms = await prisma.evaluation_forms.findMany({
            include: {
                evaluation_questions: { orderBy: { id: 'asc' } },
            },
            orderBy: { id: 'asc' },
        });

        const questions = forms.flatMap((f) =>
            f.evaluation_questions.map((q) => ({
                id: q.id,
                form_id: f.id,
                type: q.question_type || 'scale',
                name: q.question_text,
            }))
        );

        if (questions.length > 0) {
            const seen = new Set<string>();
            return questions.filter((q) => {
                const key = `${q.form_id}:${q.name}`;
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });
        }

        return forms.map((f) => ({
            id: f.id,
            form_id: f.id,
            type: 'scale',
            name: f.name,
        }));
    },

    // Used by frontend only to check if student has submitted evaluation already
    async getCompetencyResults(student_id: number, year?: number, semester?: number, section_id?: number | null) {
        if (!student_id) return [];
        void section_id;

        const user_id = await getStudentUserId(student_id);
        if (!user_id) return [];

        const whereClause: any = { user_id };
        const period_id = await resolveEvaluationPeriodId(year, semester);
        if (period_id) whereClause.period_id = period_id;

        const responses = await prisma.evaluation_responses.findMany({
            where: whereClause,
            include: {
                evaluation_forms: true,
                evaluation_answers: {
                    include: { evaluation_questions: true },
                },
            },
            orderBy: { submitted_at: 'desc' },
        });

        return responses.map((r) => ({
            id: r.id,
            form_id: r.form_id,
            form_name: r.evaluation_forms?.name || '',
            submitted_at: r.submitted_at,
            answers: r.evaluation_answers.map((a) => ({
                question: a.evaluation_questions?.question_text || a.answer_text || '',
                answer: a.answer_text || '',
                score: a.score != null ? Number(a.score) : null,
            })),
        }));
    },

    // Submit from current frontend payload: [{name, score}] + year/semester/section_id + feedback
    async submitEvaluation(
        student_id: number,
        year: number,
        semester: number,
        section_id: number | null,
        data: { name: string; score: number }[],
        feedback?: string
    ) {
        if (!student_id || !year || !semester) {
            throw new Error('Missing required evaluation parameters');
        }
        void section_id;

        const user_id = await getStudentUserId(student_id);
        if (!user_id) throw new Error('Student not found');

        const forms = await prisma.evaluation_forms.findMany({
            include: {
                evaluation_questions: { select: { id: true, question_text: true } },
            },
            orderBy: { id: 'asc' },
        });
        if (forms.length === 0) throw new Error('No evaluation form configured');

        const form =
            forms.find((f) => String(f.type || '').toLowerCase() !== 'advisor') ||
            forms[0];

        const questionByText = new Map<string, number>();
        form.evaluation_questions.forEach((q) => {
            const key = String(q.question_text || '').trim().toLowerCase();
            if (key && !questionByText.has(key)) questionByText.set(key, q.id);
        });

        const period_id = await resolveEvaluationPeriodId(year, semester);

        return prisma.$transaction(async (tx) => {
            const response = await tx.evaluation_responses.create({
                data: {
                    form_id: form.id,
                    user_id,
                    period_id: period_id ?? null,
                },
            });

            for (const item of data || []) {
                const topicName = String(item?.name || '').trim();
                const score = Number(item?.score);
                const question_id = questionByText.get(topicName.toLowerCase()) ?? null;

                await tx.evaluation_answers.create({
                    data: {
                        response_id: response.id,
                        question_id,
                        answer_text: question_id ? null : (topicName || null),
                        score: Number.isFinite(score) ? score : null,
                    },
                });
            }

            const feedbackText = String(feedback || '').trim();
            if (feedbackText) {
                await tx.evaluation_answers.create({
                    data: {
                        response_id: response.id,
                        question_id: null,
                        answer_text: feedbackText,
                        score: null,
                    },
                });
            }

            return { message: 'บันทึกสำเร็จ', response_id: response.id };
        });
    },
};
