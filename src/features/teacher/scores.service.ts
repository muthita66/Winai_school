import { prisma } from '@/lib/prisma';

export const TeacherScoresService = {
    // Get teacher's teaching assignments (subjects)
    async getSubjects(teacher_id: number) {
        const assignments = await prisma.teaching_assignments.findMany({
            where: { teacher_id },
            include: {
                subjects: true,
                teachers: { include: { name_prefixes: true } },
                classrooms: { include: { grade_levels: true } },
                semesters: { include: { academic_years: true } },
            }
        });

        return assignments.map(ta => ({
            id: ta.id,
            subject_id: ta.subject_id,
            subject_code: ta.subjects?.subject_code || '',
            subject_name: ta.subjects?.subject_name || '',
            credit: ta.subjects?.credit ? Number(ta.subjects.credit) : 0,
            class_level: ta.classrooms?.grade_levels?.name || '',
            classroom: ta.classrooms?.room_name || '',
            room: ta.classrooms?.room_name || '',
            year: ta.semesters?.academic_years?.year_name || '',
            semester: ta.semesters?.semester_number || 0,
            subjects: ta.subjects ? { ...ta.subjects, name: ta.subjects.subject_name } : null,
            teachers: ta.teachers || null,
            classrooms: ta.classrooms || null,
            semesters: ta.semesters || null,
        }));
    },

    // Get grade categories + assessment items for a teaching assignment
    async getHeaders(teaching_assignment_id: number) {
        const categories = await prisma.grade_categories.findMany({
            where: { teaching_assignment_id },
            include: {
                assessment_items: {
                    orderBy: { id: 'asc' }
                }
            },
            orderBy: { id: 'asc' }
        });

        // Flatten to simple header list
        const headers: any[] = [];
        categories.forEach(cat => {
            cat.assessment_items.forEach(item => {
                headers.push({
                    id: item.id,
                    category_id: cat.id,
                    category_name: cat.name,
                    title: item.name,
                    max_score: Number(item.max_score),
                    weight_percent: Number(cat.weight_percent),
                });
            });
        });
        return headers;
    },

    // Add a new assessment item under a grade category
    async addHeader(
        teaching_assignment_id: number,
        category_name_or_title: string,
        title_or_max: string | number,
        max_score_arg?: number
    ) {
        const isThreeArgShape = typeof title_or_max === 'number' && max_score_arg === undefined;
        const category_name = isThreeArgShape ? 'ทั่วไป' : category_name_or_title;
        const title = isThreeArgShape ? category_name_or_title : String(title_or_max || '');
        const max_score = isThreeArgShape ? Number(title_or_max) : Number(max_score_arg);

        // Find or create grade category
        let category = await prisma.grade_categories.findFirst({
            where: { teaching_assignment_id, name: category_name }
        });

        if (!category) {
            category = await prisma.grade_categories.create({
                data: {
                    teaching_assignment_id,
                    name: category_name,
                    weight_percent: 100,
                }
            });
        }

        return prisma.assessment_items.create({
            data: {
                grade_category_id: category.id,
                name: title,
                max_score: Number.isFinite(max_score) ? max_score : 0,
            }
        });
    },

    // Update assessment item
    async updateHeader(id: number, title: string, max_score: number) {
        return prisma.assessment_items.update({
            where: { id },
            data: { name: title, max_score }
        });
    },

    // Delete assessment item and its scores
    async deleteHeader(id: number) {
        await prisma.student_scores.deleteMany({ where: { assessment_item_id: id } });
        return prisma.assessment_items.delete({ where: { id } });
    },

    // Get students enrolled in a teaching assignment
    async getStudents(teaching_assignment_id: number) {
        const enrollments = await prisma.enrollments.findMany({
            where: { teaching_assignment_id },
            include: {
                students: {
                    include: { name_prefixes: true }
                }
            },
            distinct: ['student_id']
        });

        return enrollments
            .map(e => {
                const s = e.students;
                if (!s) return null;
                return {
                    id: s.id,
                    enrollment_id: e.id,
                    student_code: s.student_code,
                    prefix: s.name_prefixes?.prefix_name || '',
                    first_name: s.first_name,
                    last_name: s.last_name,
                };
            })
            .filter(Boolean)
            .sort((a: any, b: any) => (a.student_code || '').localeCompare(b.student_code || ''));
    },

    // Get scores for an assessment item
    async getScores(assessment_item_id: number) {
        const scores = await prisma.student_scores.findMany({
            where: { assessment_item_id },
            include: {
                enrollments: { select: { student_id: true } }
            }
        });

        return scores.map(s => ({
            id: s.id,
            enrollment_id: s.enrollment_id,
            student_id: s.enrollments?.student_id || 0,
            score: Number(s.score || 0),
            is_missing: s.is_missing || false,
            remark: s.remark || '',
        }));
    },

    // Save scores for an assessment item
    async saveScores(assessment_item_id: number, scores: { enrollment_id?: number; student_id?: number; score: number }[]) {
        const item = await prisma.assessment_items.findUnique({
            where: { id: assessment_item_id },
            select: {
                grade_categories: {
                    select: { teaching_assignment_id: true }
                }
            }
        });
        const teaching_assignment_id = item?.grade_categories?.teaching_assignment_id;

        const studentIds = (scores || [])
            .map((s) => Number(s.student_id))
            .filter((n) => Number.isFinite(n) && n > 0);

        let enrollmentMap = new Map<number, number>();
        if (teaching_assignment_id && studentIds.length > 0) {
            const enrollments = await prisma.enrollments.findMany({
                where: { teaching_assignment_id, student_id: { in: studentIds } },
                select: { id: true, student_id: true },
            });
            enrollmentMap = new Map(enrollments.map((e) => [e.student_id, e.id]));
        }

        for (const sc of scores || []) {
            const enrollment_id =
                (sc.enrollment_id && Number(sc.enrollment_id)) ||
                (sc.student_id ? enrollmentMap.get(Number(sc.student_id)) : undefined);

            if (!enrollment_id) continue;

            const existing = await prisma.student_scores.findFirst({
                where: { assessment_item_id, enrollment_id }
            });
            if (existing) {
                await prisma.student_scores.update({
                    where: { id: existing.id },
                    data: { score: sc.score }
                });
            } else {
                await prisma.student_scores.create({
                    data: {
                        assessment_item_id,
                        enrollment_id,
                        score: sc.score,
                    }
                });
            }
        }
        return { success: true };
    }
};
