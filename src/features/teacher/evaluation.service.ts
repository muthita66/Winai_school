import { prisma } from '@/lib/prisma';
import { TeacherStudentsService } from '@/features/teacher/students.service';

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

function toNum(value: unknown, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function formatRoomLabel(classLevel?: string | null, room?: string | null) {
    const level = String(classLevel || '').trim();
    const roomValue = String(room || '').trim();
    if (!level && !roomValue) return '-';
    if (!roomValue) return level || '-';
    if (!level) return roomValue;
    if (roomValue === level || roomValue.startsWith(`${level}/`)) return roomValue;
    return `${level}/${roomValue}`;
}

export const TeacherEvaluationService = {
    async getTeachingEvaluation(teacher_id: number, year?: number, semester?: number) {
        try {
            const assignments = await prisma.teaching_assignments.findMany({
                where: {
                    teacher_id,
                    ...(year || semester ? {
                        semesters: {
                            ...(year ? { academic_years: { year_name: String(year) } } : {}),
                            ...(semester ? { semester_number: semester } : {}),
                        }
                    } : {})
                },
                include: {
                    subjects: true,
                    classrooms: { include: { grade_levels: true } },
                    semesters: { include: { academic_years: true } },
                }
            });

            // Pre-fetch the teaching evaluation form ID
            const teachingForm = await prisma.evaluation_forms.findFirst({
                where: { evaluation_form_types: { type_code: 'teaching' } },
                select: { id: true }
            });

            const results: any[] = [];
            for (const ta of assignments) {
                // Use Raw SQL to count because counts with relation filters on evaluation_responses fail due to missing user_id column
                const countResult = await prisma.$queryRawUnsafe<any[]>(
                    `SELECT COUNT(*)::int as count FROM evaluation_responses 
                     WHERE target_type = 'ASSIGNMENT' 
                     AND target_id = $1 
                     ${teachingForm ? `AND form_id = ${teachingForm.id}` : ''}`,
                    ta.id
                );
                const count = countResult[0]?.count || 0;

                results.push({
                    teaching_assignment_id: ta.id,
                    subject_code: ta.subjects?.subject_code || '',
                    subject_name: ta.subjects?.subject_name || '',
                    class_level: ta.classrooms?.grade_levels?.name || '',
                    room: ta.classrooms?.room_name || '',
                    year: ta.semesters?.academic_years?.year_name || '',
                    semester: ta.semesters?.semester_number || 0,
                    evaluations_count: count,
                });
            }
            return results;
        } catch (error: any) {
            console.error("[TeacherEvaluationService] Error in getTeachingEvaluation:", error);
            throw error;
        }
    },

    async getTeachingEvaluationResults(teacher_id: number, section_id?: number, year?: number, semester?: number) {
        // Use Raw SQL for evaluation_responses to avoid missing user_id column
        let sql = `SELECT * FROM evaluation_responses WHERE target_type = 'ASSIGNMENT' `;
        const params: any[] = [];

        if (section_id) {
            sql += ` AND target_id = $1 `;
            params.push(section_id);
        } else {
            const assignments = await prisma.teaching_assignments.findMany({
                where: {
                    teacher_id,
                    ...(year || semester ? {
                        semesters: {
                            ...(year ? { academic_years: { year_name: String(year) } } : {}),
                            ...(semester ? { semester_number: semester } : {}),
                        }
                    } : {})
                },
                select: { id: true }
            });
            const ids = assignments.map(a => a.id);
            if (ids.length > 0) {
                sql += ` AND target_id IN (${ids.join(',')}) `;
            } else {
                return { summary: [], comments: [] };
            }
        }

        // Fetch teaching form ID
        const teachingForm = await prisma.evaluation_forms.findFirst({
            where: { evaluation_form_types: { type_code: 'teaching' } },
            select: { id: true }
        });
        if (teachingForm) {
            sql += ` AND form_id = ${teachingForm.id} `;
        }

        sql += ` ORDER BY submitted_at DESC `;

        const responses: any[] = await prisma.$queryRawUnsafe(sql, ...params);

        // Fetch answers for these responses
        const responseIds = responses.map(r => r.id);
        if (responseIds.length === 0) return { summary: [], comments: [] };

        const allAnswers = await prisma.evaluation_answers.findMany({
            where: { response_id: { in: responseIds } },
            include: { evaluation_questions: true }
        });

        const topicScores = new Map<string, { total: number; count: number }>();
        const comments: any[] = [];

        for (const r of responses) {
            const rAnswers = allAnswers.filter(a => a.response_id === r.id);
            for (const a of rAnswers) {
                if (a.score != null) {
                    const topic = a.evaluation_questions?.question_text || a.answer_text || 'อื่นๆ';
                    const current = topicScores.get(topic) || { total: 0, count: 0 };
                    topicScores.set(topic, {
                        total: current.total + Number(a.score),
                        count: current.count + 1
                    });
                } else if (a.answer_text) {
                    comments.push({
                        text: a.answer_text,
                        submitted_at: r.submitted_at
                    });
                }
            }
        }

        return {
            summary: Array.from(topicScores.entries()).map(([topic, val]) => ({
                topic,
                count: val.count,
                total: val.total,
                average: val.count ? Number((val.total / val.count).toFixed(2)) : 0
            })),
            comments: comments.sort((a, b) => b.submitted_at.getTime() - a.submitted_at.getTime())
        };
    },

    async getSectionStudentsForEvaluation(teacher_id: number, section_id: number, year: number, semester: number) {
        // Find students enrolled in this assignment (no status filter - status values may vary)
        const enrolledStudents = await prisma.enrollments.findMany({
            where: {
                teaching_assignment_id: section_id,
            },
            include: {
                students: {
                    include: { name_prefixes: true }
                }
            }
        });

        const period_id = await resolveEvaluationPeriodId(year, semester);
        const teacher = await prisma.teachers.findUnique({ where: { id: teacher_id }, select: { user_id: true } });
        const teacher_user_id = teacher?.user_id;

        const results = [];
        const formIds = (await prisma.evaluation_forms.findMany({
            where: { evaluation_form_types: { type_code: 'teacher_eval_student' } },
            select: { id: true }
        })).map(f => f.id);

        for (const enrollment of enrolledStudents) {
            const s = enrollment.students;

            // Raw SQL because user_id is missing and we need to check if this student was evaluated
            // In teacher evaluates student, target_id IS the student ID
            const latestEvalResult = await prisma.$queryRawUnsafe<any[]>(
                `SELECT submitted_at FROM evaluation_responses 
                 WHERE evaluator_user_id = $1 
                 AND target_type = 'SUBJECT_STUDENT' 
                 AND target_id = $2 
                 ${period_id ? `AND period_id = ${period_id}` : ''}
                 ${formIds.length > 0 ? `AND form_id IN (${formIds.join(',')})` : ''}
                 ORDER BY submitted_at DESC LIMIT 1`,
                teacher_user_id, s.id
            );

            const latestEval = latestEvalResult[0] || null;

            results.push({
                id: s.id,
                student_code: s.student_code,
                name: `${s.name_prefixes?.prefix_name || ''}${s.first_name} ${s.last_name}`,
                evaluated: !!latestEval,
                submitted_at: latestEval?.submitted_at || null
            });
        }
        return results;
    },

    async ensureSubjectEvaluationForm() {
        const existing = await prisma.evaluation_forms.findFirst({
            where: { evaluation_form_types: { type_code: 'teacher_eval_student' } },
            include: { evaluation_questions: { orderBy: { id: 'asc' } } },
        });
        if (existing) return existing;

        return prisma.evaluation_forms.create({
            data: {
                name: 'การประเมินนักเรียนรายวิชา',
                evaluation_form_types: { connect: { type_code: 'teacher_eval_student' } },
                evaluation_questions: {
                    create: [
                        { question_text: 'ความตั้งใจเรียน', question_type: 'rating' },
                        { question_text: 'การมีส่วนร่วมในชั้นเรียน', question_type: 'rating' },
                        { question_text: 'ความรับผิดชอบต่องานที่ได้รับมอบหมาย', question_type: 'rating' },
                        { question_text: 'ทักษะและการประยุกต์ใช้ความรู้', question_type: 'rating' },
                        { question_text: 'ศีลธรรมและระเบียบวินัย', question_type: 'rating' },
                    ]
                }
            },
            include: { evaluation_questions: { orderBy: { id: 'asc' } } }
        });
    },

    async getSubjectEvaluationTemplate(teacher_id: number, student_id: number, section_id: number, year: number, semester: number) {
        try {
            const [form, period_id] = await Promise.all([
                this.ensureSubjectEvaluationForm(),
                resolveEvaluationPeriodId(year, semester)
            ]);

            const [student, teacher] = await Promise.all([
                prisma.students.findUnique({ where: { id: student_id }, select: { user_id: true } }),
                prisma.teachers.findUnique({ where: { id: teacher_id }, select: { user_id: true } })
            ]);

            if (!teacher) throw new Error('ไม่พบข้อมูลครู');
            if (!student) throw new Error('ไม่พบข้อมูลนักเรียน');

            // Raw SQL for evaluation_responses because user_id column is missing
            // For SUBJECT_STUDENT, target_id stores the student ID
            const latestResponseResult = await prisma.$queryRawUnsafe<any[]>(
                `SELECT id, submitted_at FROM evaluation_responses 
                 WHERE form_id = $1 
                 AND evaluator_user_id = $2 
                 AND target_type = 'SUBJECT_STUDENT' 
                 AND target_id = $3 
                 ${period_id ? `AND period_id = ${Number(period_id)}` : ''}
                 ORDER BY submitted_at DESC LIMIT 1`,
                form.id, teacher.user_id, student_id
            );
            const latestResponse = latestResponseResult[0] || null;

            let current: any[] = [];
            let feedback = '';

            if (latestResponse) {
                const answers = await prisma.evaluation_answers.findMany({
                    where: { response_id: latestResponse.id },
                    include: { evaluation_questions: true }
                });
                current = answers
                    .filter(a => a.score != null)
                    .map(a => ({ name: a.evaluation_questions?.question_text || a.answer_text, score: Number(a.score) }));
                feedback = answers.find(a => a.score == null)?.answer_text || '';
            }

            const topics = form.evaluation_questions.map(q => ({ id: q.id, name: q.question_text }));

            return {
                form_id: form.id,
                topics,
                current,
                feedback,
                submitted_at: latestResponse?.submitted_at || null
            };
        } catch (error: any) {
            console.error("[TeacherEvaluationService] Error in getSubjectEvaluationTemplate:", error);
            throw error;
        }
    },

    async submitSubjectEvaluation(payload: {
        teacher_id: number;
        student_id: number;
        section_id: number;
        year: number;
        semester: number;
        data: { name: string; score: number }[];
        feedback?: string;
    }) {
        const { teacher_id, student_id, section_id, year, semester, data, feedback } = payload;
        const [student, teacher, form, period_id] = await Promise.all([
            prisma.students.findUnique({ where: { id: student_id }, select: { user_id: true } }),
            prisma.teachers.findUnique({ where: { id: teacher_id }, select: { user_id: true } }),
            this.ensureSubjectEvaluationForm(),
            resolveEvaluationPeriodId(year, semester)
        ]);

        if (!student || !teacher) throw new Error('Student or teacher not found');

        const questionByText = new Map<string, number>();
        form.evaluation_questions.forEach(q => questionByText.set(q.question_text.toLowerCase(), q.id));

        return prisma.$transaction(async (tx) => {
            // Raw SQL insert because user_id (student user id) is missing from table
            // We store student ID in target_id for SUBJECT_STUDENT
            const result = await tx.$queryRawUnsafe<any[]>(
                `INSERT INTO evaluation_responses (form_id, evaluator_user_id, target_type, target_id, period_id, submitted_at) 
                 VALUES ($1, $2, $3, $4, $5, NOW()) 
                 RETURNING id`,
                form.id, teacher.user_id, 'SUBJECT_STUDENT', student_id, period_id ?? null
            );
            const responseId = result[0].id;

            for (const item of data) {
                const qid = questionByText.get(item.name.toLowerCase()) || null;
                await tx.evaluation_answers.create({
                    data: {
                        response_id: responseId,
                        question_id: qid,
                        answer_text: qid ? null : item.name,
                        score: item.score
                    }
                });
            }

            if (feedback) {
                await tx.evaluation_answers.create({
                    data: {
                        response_id: responseId,
                        answer_text: feedback,
                        score: null
                    }
                });
            }

            return { success: true, response_id: responseId };
        });
    },

    async getAdvisorEvaluation(teacher_id: number, year?: number, semester?: number) {
        const teacher = await prisma.teachers.findUnique({
            where: { id: teacher_id },
            select: { user_id: true },
        });
        if (!teacher) return [];

        const period_id = await resolveEvaluationPeriodId(year, semester);
        const teacherUserId = teacher.user_id ? Number(teacher.user_id) : 0;
        const targetIds = [teacher_id, teacherUserId].filter((n) => Number.isFinite(n) && n > 0);
        if (targetIds.length === 0) return [];

        const responseIdRows = await prisma.$queryRawUnsafe<Array<{ id: number }>>(
            `
            SELECT er.id
            FROM public.evaluation_responses er
            INNER JOIN public.evaluation_forms ef ON ef.id = er.form_id
            LEFT JOIN public.evaluation_form_types eft ON eft.id = ef.form_type_id
            WHERE LOWER(COALESCE(eft.type_code, '')) = 'advisor'
              AND UPPER(COALESCE(er.target_type, '')) = 'TEACHER'
              AND er.target_id IN (${targetIds.join(',')})
              ${period_id ? `AND er.period_id = ${Number(period_id)}` : ''}
            ORDER BY er.submitted_at DESC NULLS LAST, er.id DESC
            `
        );

        const responseIds = (responseIdRows || []).map((r) => Number(r.id)).filter((n) => n > 0);
        if (responseIds.length === 0) return [];

        const responses = await prisma.evaluation_responses.findMany({
            where: { id: { in: responseIds } },
            include: {
                evaluation_answers: {
                    include: { evaluation_questions: true },
                    orderBy: { id: 'asc' },
                },
                users: { select: { username: true } },
                evaluation_periods: {
                    include: {
                        semesters: { include: { academic_years: true } },
                    },
                },
            },
            orderBy: [{ submitted_at: 'desc' }, { id: 'desc' }],
        });

        const rows: any[] = [];
        for (const r of responses) {
            const yearName = r.evaluation_periods?.semesters?.academic_years?.year_name || '';
            const semesterNo = r.evaluation_periods?.semesters?.semester_number || 0;
            for (const a of r.evaluation_answers || []) {
                if (a.score == null) continue;
                rows.push({
                    response_id: r.id,
                    topic: a.evaluation_questions?.question_text || a.answer_text || 'ไม่ระบุหัวข้อ',
                    score: Number(a.score),
                    submitted_at: r.submitted_at,
                    submitted_by: r.users?.username || '',
                    year: yearName ? Number(yearName) || yearName : '',
                    semester: semesterNo ? Number(semesterNo) : '',
                });
            }
        }

        return rows;
    },

    async getAdvisorStudentEvaluationResults(teacher_id: number, year?: number, semester?: number) {
        const [teacher, advisoryStudents, period_id] = await Promise.all([
            prisma.teachers.findUnique({
                where: { id: teacher_id },
                select: { user_id: true },
            }),
            TeacherStudentsService.getAdvisoryStudents(teacher_id),
            resolveEvaluationPeriodId(year, semester),
        ]);

        const teacherUserId = Number(teacher?.user_id || 0);
        if (!teacherUserId || !advisoryStudents.length) return [];

        const studentMap = new Map<number, any>();
        const studentIds = advisoryStudents
            .map((s: any) => {
                const id = Number(s.id);
                if (id > 0) studentMap.set(id, s);
                return id;
            })
            .filter((id: number) => id > 0);

        if (!studentIds.length) return [];

        const responseRows = await prisma.$queryRawUnsafe<Array<{
            id: number;
            target_id: number | null;
            submitted_at: Date | null;
            year: string | null;
            semester: number | null;
        }>>(
            `
            SELECT
                er.id,
                er.target_id,
                er.submitted_at,
                ay.year_name AS year,
                sem.semester_number AS semester
            FROM public.evaluation_responses er
            INNER JOIN public.evaluation_forms ef ON ef.id = er.form_id
            LEFT JOIN public.evaluation_form_types eft ON eft.id = ef.form_type_id
            LEFT JOIN public.evaluation_periods ep ON ep.id = er.period_id
            LEFT JOIN public.semesters sem ON sem.id = ep.semester_id
            LEFT JOIN public.academic_years ay ON ay.id = sem.academic_year_id
            WHERE LOWER(COALESCE(eft.type_code, '')) = 'advisor'
              AND UPPER(COALESCE(er.target_type, '')) = 'STUDENT'
              AND er.evaluator_user_id = ${teacherUserId}
              AND er.target_id IN (${studentIds.join(',')})
              ${period_id ? `AND er.period_id = ${Number(period_id)}` : ''}
            ORDER BY er.submitted_at DESC NULLS LAST, er.id DESC
            `
        );

        const latestByKey = new Map<string, typeof responseRows[number]>();
        for (const row of responseRows || []) {
            const studentId = Number(row.target_id || 0);
            if (!studentId) continue;
            const rowYear = String(row.year || year || '').trim();
            const rowSemester = Number(row.semester || semester || 0) || 0;
            const key = period_id
                ? `${studentId}`
                : `${studentId}:${rowYear || '-'}:${rowSemester || 0}`;
            if (!latestByKey.has(key)) latestByKey.set(key, row);
        }

        const latestResponses = Array.from(latestByKey.values());
        const responseIds = latestResponses.map((r) => Number(r.id)).filter((n) => n > 0);
        if (!responseIds.length) return [];

        const answers = await prisma.evaluation_answers.findMany({
            where: { response_id: { in: responseIds } },
            include: { evaluation_questions: true },
            orderBy: [{ response_id: 'asc' }, { id: 'asc' }],
        });

        const answersByResponse = new Map<number, any[]>();
        for (const answer of answers) {
            const rid = Number(answer.response_id || 0);
            if (!rid) continue;
            if (!answersByResponse.has(rid)) answersByResponse.set(rid, []);
            answersByResponse.get(rid)!.push(answer);
        }

        return latestResponses
            .map((row) => {
                const studentId = Number(row.target_id || 0);
                const student = studentMap.get(studentId);
                if (!student) return null;

                const responseAnswers = answersByResponse.get(Number(row.id)) || [];
                const topics = responseAnswers
                    .filter((a) => a.score != null)
                    .map((a) => ({
                        name: a.evaluation_questions?.question_text || a.answer_text || 'ไม่ระบุหัวข้อ',
                        score: Number(a.score),
                    }))
                    .filter((a) => a.name && Number.isFinite(a.score));

                const feedback = responseAnswers.find((a) => a.score == null && String(a.answer_text || '').trim())?.answer_text || '';
                const totalScore = topics.reduce((sum, t) => sum + Number(t.score || 0), 0);
                const averageScore = topics.length ? Number((totalScore / topics.length).toFixed(2)) : 0;

                return {
                    response_id: Number(row.id),
                    student_id: studentId,
                    student_code: student.student_code || '',
                    student_name: `${student.prefix || ''}${student.first_name || ''} ${student.last_name || ''}`.trim(),
                    class_level: student.class_level || '',
                    room: student.room || '',
                    room_label: formatRoomLabel(student.class_level || '', student.room || ''),
                    year: row.year ? (Number(row.year) || row.year) : (year ?? ''),
                    semester: Number(row.semester || semester || 0) || '',
                    submitted_at: row.submitted_at || null,
                    topics,
                    feedback: String(feedback || ''),
                    topic_count: topics.length,
                    average_score: averageScore,
                    total_score: totalScore,
                };
            })
            .filter(Boolean)
            .sort((a: any, b: any) => {
                const byYear = toNum(b.year) - toNum(a.year);
                if (byYear !== 0) return byYear;
                const bySemester = toNum(b.semester) - toNum(a.semester);
                if (bySemester !== 0) return bySemester;
                return String(a.student_code || '').localeCompare(String(b.student_code || ''));
            });
    },
};
