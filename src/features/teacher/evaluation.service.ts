import { prisma } from '@/lib/prisma';

export const TeacherEvaluationService = {
    async getTeachingEvaluation(teacher_id: number, year?: number, semester?: number) {
        // Get teaching assignments for this teacher
        const where: any = { teacher_id };
        if (year || semester) {
            where.semesters = {
                ...(year ? { academic_years: { year_name: String(year) } } : {}),
                ...(semester ? { semester_number: semester } : {}),
            };
        }

        const assignments = await prisma.teaching_assignments.findMany({
            where,
            include: {
                subjects: true,
                classrooms: { include: { grade_levels: true } },
                semesters: { include: { academic_years: true } },
            }
        });

        // For each assignment, get evaluation responses
        const results: any[] = [];
        for (const ta of assignments) {
            // Find evaluation forms of type 'teaching'
            const responses = await prisma.evaluation_responses.findMany({
                where: {
                    evaluation_forms: { type: 'teaching' }
                },
                include: {
                    evaluation_answers: {
                        include: { evaluation_questions: true }
                    }
                },
                orderBy: { submitted_at: 'desc' }
            });

            results.push({
                teaching_assignment_id: ta.id,
                subject_code: ta.subjects?.subject_code || '',
                subject_name: ta.subjects?.subject_name || '',
                class_level: ta.classrooms?.grade_levels?.name || '',
                room: ta.classrooms?.room_name || '',
                year: ta.semesters?.academic_years?.year_name || '',
                semester: ta.semesters?.semester_number || 0,
                evaluations_count: responses.length,
            });
        }

        return results;
    },

    async getAdvisorEvaluation(teacher_id: number, year?: number, semester?: number) {
        // Find evaluation responses of type 'advisor' 
        const responses = await prisma.evaluation_responses.findMany({
            where: {
                evaluation_forms: { type: 'advisor' }
            },
            include: {
                evaluation_answers: {
                    include: { evaluation_questions: true }
                },
                evaluation_forms: true,
                users: { select: { username: true } }
            },
            orderBy: { submitted_at: 'desc' }
        });

        return responses.map(r => ({
            id: r.id,
            form_name: r.evaluation_forms?.name || '',
            submitted_by: r.users?.username || '',
            submitted_at: r.submitted_at,
            answers: r.evaluation_answers.map(a => ({
                question: a.evaluation_questions?.question_text || '',
                score: a.score ? Number(a.score) : null,
                answer: a.answer_text || '',
            }))
        }));
    }
};
