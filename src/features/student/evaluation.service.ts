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
                evaluation_form_types: true,
            },
            orderBy: { id: 'asc' },
        });

        const questions = forms.flatMap((f) =>
            f.evaluation_questions.map((q) => ({
                id: q.id,
                form_id: f.id,
                type: q.question_type || 'scale',
                name: (q.question_text || '').trim(),
            }))
        );

        if (questions.length > 0) {
            const seen = new Set<string>();
            return questions.filter((q) => {
                if (!q.name) return false; // ignore empty questions
                const key = q.name.toLowerCase();
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

        const period_id = await resolveEvaluationPeriodId(year, semester);

        // Raw SQL for evaluation_responses because user_id column is missing
        // Assuming "Competency Results" are evaluations OF the student
        const responsesResult = await prisma.$queryRawUnsafe<any[]>(
            `SELECT * FROM evaluation_responses 
             WHERE target_type = 'STUDENT' 
             AND target_id = $1 
             ${period_id ? `AND period_id = ${period_id}` : ''}
             ORDER BY submitted_at DESC`,
            student_id
        );

        if (responsesResult.length === 0) return [];

        const responseIds = responsesResult.map(r => r.id);
        const [forms, answers] = await Promise.all([
            prisma.evaluation_forms.findMany(),
            prisma.evaluation_answers.findMany({
                where: { response_id: { in: responseIds } },
                include: { evaluation_questions: true }
            })
        ]);

        return responsesResult.map((r) => {
            const form = forms.find(f => f.id === r.form_id);
            const rAnswers = answers.filter(a => a.response_id === r.id);
            return {
                id: r.id,
                form_id: r.form_id,
                form_name: form?.name || '',
                submitted_at: r.submitted_at,
                answers: rAnswers.map((a) => ({
                    question: a.evaluation_questions?.question_text || a.answer_text || '',
                    answer: a.answer_text || '',
                    score: a.score != null ? Number(a.score) : null,
                })),
            };
        });
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
                evaluation_form_types: true,
            },
            orderBy: { id: 'asc' },
        });
        if (forms.length === 0) throw new Error('No evaluation form configured');

        const form =
            forms.find((f) => String(f.evaluation_form_types?.type_code || '').toLowerCase() !== 'advisor') ||
            forms[0];

        const questionByText = new Map<string, number>();
        form.evaluation_questions.forEach((q) => {
            const key = String(q.question_text || '').trim().toLowerCase();
            if (key && !questionByText.has(key)) questionByText.set(key, q.id);
        });

        const period_id = await resolveEvaluationPeriodId(year, semester);

        // Guard: check if student already submitted for this section (prevent duplicates)
        if (section_id) {
            const whereCheck: any = {
                evaluator_user_id: user_id,
                target_type: 'ASSIGNMENT',
                target_id: Number(section_id),
            };
            if (period_id) whereCheck.period_id = period_id;

            const existing = await prisma.evaluation_responses.findFirst({ where: whereCheck });
            if (existing) {
                throw new Error('นักเรียนได้ประเมินวิชานี้ไปแล้ว');
            }
        }

        return prisma.$transaction(async (tx) => {
            // Raw SQL insert because user_id (the submitter) should be evaluator_user_id 
            // and the user_id column is missing
            const result = await tx.$queryRawUnsafe<any[]>(
                `INSERT INTO evaluation_responses (form_id, evaluator_user_id, period_id, target_type, target_id, submitted_at) 
                 VALUES ($1, $2, $3, $4, $5, NOW()) 
                 RETURNING id`,
                form.id, user_id, period_id ?? null, 'ASSIGNMENT', section_id ? Number(section_id) : null
            );
            const responseId = result[0].id;

            for (const item of data || []) {
                const topicName = String(item?.name || '').trim();
                const score = Number(item?.score);
                const question_id = questionByText.get(topicName.toLowerCase()) ?? null;

                await tx.evaluation_answers.create({
                    data: {
                        response_id: responseId,
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
                        response_id: responseId,
                        question_id: null,
                        answer_text: feedbackText,
                        score: null,
                    },
                });
            }

            return { message: 'บันทึกสำเร็จ', response_id: responseId };
        });
    },
    // Get IDs of sections already evaluated by the student (in any period)
    async getEvaluatedSections(student_id: number, year: number, semester: number) {
        if (!student_id) return [];

        const user_id = await getStudentUserId(student_id);
        if (!user_id) return [];

        // Try to narrow by period_id if it exists, otherwise return all targets for this user
        const period_id = await resolveEvaluationPeriodId(year, semester);

        const whereClause: any = {
            evaluator_user_id: user_id,
            target_type: 'ASSIGNMENT',
            target_id: { not: null }
        };
        if (period_id) {
            whereClause.period_id = period_id;
        }

        const evaluated = await prisma.evaluation_responses.findMany({
            where: whereClause,
            select: { target_id: true }
        });

        return evaluated.map(e => e.target_id).filter((id): id is number => id !== null);
    },
};

