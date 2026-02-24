import { prisma } from '@/lib/prisma';

export const RegistrationService = {
    // Search available teaching assignments (subjects to enroll)
    async searchSubjects(keyword: string, semesterId?: number) {
        const where: any = {
            status: 'open',
        };

        if (semesterId) {
            where.semester_id = semesterId;
        }

        if (keyword) {
            where.subjects = {
                OR: [
                    { subject_code: { contains: keyword, mode: 'insensitive' } },
                    { subject_name: { contains: keyword, mode: 'insensitive' } },
                ]
            };
        }

        const assignments = await prisma.teaching_assignments.findMany({
            where,
            include: {
                subjects: true,
                teachers: { include: { name_prefixes: true } },
                classrooms: { include: { grade_levels: true } },
                semesters: { include: { academic_years: true } },
                enrollments: { select: { id: true } },
            },
            orderBy: { id: 'asc' }
        });

        return assignments.map(ta => {
            const teacher = ta.teachers;
            const teacherName = [teacher?.name_prefixes?.prefix_name, teacher?.first_name, teacher?.last_name]
                .filter(Boolean).join(' ');
            return {
                id: ta.id,
                section_id: ta.id,
                subject_id: ta.subject_id,
                subject_code: ta.subjects?.subject_code || '',
                subject_name: ta.subjects?.subject_name || '',
                credit: ta.subjects?.credit ? Number(ta.subjects.credit) : 0,
                teacher_name: teacherName,
                teacher_code: teacher?.teacher_code || '',
                class_level: ta.classrooms?.grade_levels?.name || '',
                room: ta.classrooms?.room_name || '',
                capacity: ta.capacity || 0,
                enrolled_count: ta.enrollments?.length || 0,
                year: ta.semesters?.academic_years?.year_name || '',
                semester: ta.semesters?.semester_number || 0,
                status: ta.status || 'open',
            };
        });
    },

    // Browse subjects for a specific classroom
    async browseSubjects(semesterId: number, classroomId?: number) {
        const where: any = {
            semester_id: semesterId,
            status: 'open',
        };
        if (classroomId) {
            where.classroom_id = classroomId;
        }

        const assignments = await prisma.teaching_assignments.findMany({
            where,
            include: {
                subjects: true,
                teachers: { include: { name_prefixes: true } },
                classrooms: { include: { grade_levels: true } },
                semesters: { include: { academic_years: true } },
                enrollments: { select: { id: true } },
                class_schedules: {
                    include: { day_of_weeks: true, periods: true, rooms: true }
                }
            },
            orderBy: { subjects: { subject_code: 'asc' } }
        });

        return assignments.map(ta => {
            const teacher = ta.teachers;
            const teacherName = [teacher?.name_prefixes?.prefix_name, teacher?.first_name, teacher?.last_name]
                .filter(Boolean).join(' ');
            const schedules = ta.class_schedules.map(cs => ({
                section_id: ta.id,
                day: cs.day_of_weeks?.day_name_th || '',
                period: cs.periods?.period_name || '',
                room: cs.rooms?.room_name || '',
            }));

            return {
                id: ta.id,
                section_id: ta.id,
                subject_id: ta.subject_id,
                subject_code: ta.subjects?.subject_code || '',
                subject_name: ta.subjects?.subject_name || '',
                credit: ta.subjects?.credit ? Number(ta.subjects.credit) : 0,
                teacher_name: teacherName,
                class_level: ta.classrooms?.grade_levels?.name || '',
                room: ta.classrooms?.room_name || '',
                capacity: ta.capacity || 0,
                enrolled_count: ta.enrollments?.length || 0,
                schedules,
                status: ta.status || 'open',
            };
        });
    },

    // Enroll student into a teaching assignment
    async addToCart(student_id: number, teaching_assignment_id: number) {
        // Check if already enrolled
        const existing = await prisma.enrollments.findFirst({
            where: { student_id, teaching_assignment_id }
        });
        if (existing) {
            throw new Error('ลงทะเบียนวิชานี้แล้ว');
        }

        return prisma.enrollments.create({
            data: {
                student_id,
                teaching_assignment_id,
                status: 'enrolled',
            }
        });
    },

    // Get enrolled subjects
    async getRegistered(student_id: number, semesterId?: number) {
        const where: any = { student_id };
        if (semesterId) {
            where.teaching_assignments = { semester_id: semesterId };
        }

        const enrollments = await prisma.enrollments.findMany({
            where,
            include: {
                teaching_assignments: {
                    include: {
                        subjects: true,
                        teachers: { include: { name_prefixes: true } },
                        classrooms: { include: { grade_levels: true } },
                        semesters: { include: { academic_years: true } },
                        class_schedules: {
                            include: { day_of_weeks: true, periods: true, rooms: true }
                        }
                    }
                }
            },
            orderBy: { enrolled_at: 'desc' }
        });

        return enrollments.map(e => {
            const ta = e.teaching_assignments;
            const teacher = ta.teachers;
            const teacherName = [teacher?.name_prefixes?.prefix_name, teacher?.first_name, teacher?.last_name]
                .filter(Boolean).join(' ');
            const schedules = ta.class_schedules.map(cs => ({
                day: cs.day_of_weeks?.day_name_th || '',
                period: cs.periods?.period_name || '',
                room: cs.rooms?.room_name || '',
            }));

            return {
                enrollment_id: e.id,
                status: e.status || 'enrolled',
                enrolled_at: e.enrolled_at,
                teaching_assignment_id: ta.id,
                section_id: ta.id,
                subject_id: ta.subject_id,
                subject_code: ta.subjects?.subject_code || '',
                subject_name: ta.subjects?.subject_name || '',
                credit: ta.subjects?.credit ? Number(ta.subjects.credit) : 0,
                teacher_name: teacherName,
                class_level: ta.classrooms?.grade_levels?.name || '',
                room: ta.classrooms?.room_name || '',
                year: ta.semesters?.academic_years?.year_name || '',
                semester: ta.semesters?.semester_number || 0,
                schedules,
            };
        });
    },

    // Remove enrollment
    async removeEnrollment(enrollment_id: number) {
        return prisma.enrollments.delete({ where: { id: enrollment_id } });
    },

    // Backward-compatible alias used by /api/student/registration/remove/[id]
    async removeCartItem(enrollment_id: number) {
        return this.removeEnrollment(enrollment_id);
    },

    // Get advisor info for student's classroom
    async getAdvisor(student_id: number, year?: number, semester?: number) {
        if (!student_id) return [];

        const student = await prisma.students.findUnique({
            where: { id: student_id },
            select: { classroom_id: true }
        });

        if (!student?.classroom_id) return [];

        // Find teachers who have teaching assignments for this classroom
        // In presentATOM, advisors are not a separate table
        // We return teachers who teach this classroom
        const where: any = { classroom_id: student.classroom_id };
        if (year != null && semester != null) {
            where.semesters = {
                semester_number: semester,
                academic_years: { year_name: String(year) },
            };
        }

        const assignments = await prisma.teaching_assignments.findMany({
            where,
            select: {
                teachers: {
                    include: { name_prefixes: true }
                }
            },
            distinct: ['teacher_id']
        });

        return assignments.map(a => {
            const t = a.teachers;
            return {
                teacher_code: t.teacher_code,
                name: [t.name_prefixes?.prefix_name, t.first_name, t.last_name].filter(Boolean).join(' '),
                phone: t.phone || '',
            };
        });
    },

    // Get active semester
    async getActiveSemester() {
        const semester = await prisma.semesters.findFirst({
            where: { is_active: true },
            include: { academic_years: true },
            orderBy: { id: 'desc' }
        });
        if (!semester) return null;
        return {
            id: semester.id,
            year: semester.academic_years?.year_name || '',
            semester_number: semester.semester_number,
            academic_year_id: semester.academic_year_id,
        };
    }
};
