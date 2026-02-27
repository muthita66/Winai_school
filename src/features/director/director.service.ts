import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

function formatTimePart(value: Date | null | undefined) {
    if (!value) return '';
    const d = new Date(value);
    const hh = String(d.getUTCHours()).padStart(2, '0');
    const mm = String(d.getUTCMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
}

function roomOnlyLabel(classLevel: string, roomName: string) {
    const level = String(classLevel || '').trim();
    const room = String(roomName || '').trim();
    if (!room) return '';
    if (level && room.startsWith(`${level}/`)) return room.slice(level.length + 1).trim();
    const slash = room.lastIndexOf('/');
    return slash >= 0 ? room.slice(slash + 1).trim() : room;
}

async function resolveAdvisorTerm(year?: number, semester?: number) {
    const normalizedYear = Number(year);
    const normalizedSemester = Number(semester);

    if (Number.isFinite(normalizedYear) && Number.isFinite(normalizedSemester)) {
        return { year: normalizedYear, semester: normalizedSemester };
    }

    const current = await prisma.semesters.findFirst({
        where: { is_active: true },
        include: { academic_years: { select: { year_name: true } } },
        orderBy: { id: 'desc' },
    }) || await prisma.semesters.findFirst({
        include: { academic_years: { select: { year_name: true } } },
        orderBy: { id: 'desc' },
    });

    const fallbackYear = new Date().getFullYear() + 543;
    return {
        year: Number(current?.academic_years?.year_name) || fallbackYear,
        semester: Number(current?.semester_number) || 1,
    };
}

function mapAdvisorRecord(
    row: any,
    term: { year: number; semester: number }
) {
    return {
        id: row.id,
        teacher_id: row.teacher_id,
        classroom_id: row.classroom_id,
        class_level: String(row.classrooms?.grade_levels?.name || ''),
        room: roomOnlyLabel(
            String(row.classrooms?.grade_levels?.name || ''),
            String(row.classrooms?.room_name || '')
        ),
        year: term.year,
        semester: term.semester,
        teachers: row.teachers || null,
    };
}

function parseTimeRange(value: unknown) {
    const raw = String(value || '').trim();
    if (!raw) return null;
    const m = raw.match(/^(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/);
    if (!m) return null;
    return { start: m[1], end: m[2] };
}

async function resolveSemesterIdFromPayload(data: any) {
    if (data?.semester_id) {
        const semesterId = Number(data.semester_id);
        if (Number.isFinite(semesterId) && semesterId > 0) return semesterId;
    }

    const year = data?.year != null ? Number(data.year) : NaN;
    const semester = data?.semester != null ? Number(data.semester) : NaN;
    if (!Number.isFinite(year) || !Number.isFinite(semester)) {
        throw new Error('กรุณาระบุปีการศึกษาและภาคเรียน');
    }

    const found = await prisma.semesters.findFirst({
        where: {
            semester_number: semester,
            academic_years: { year_name: String(year) },
        },
        select: { id: true },
        orderBy: { id: 'desc' },
    });

    if (!found) throw new Error(`ไม่พบภาคเรียน ปี ${year} ภาค ${semester}`);
    return found.id;
}

async function resolveClassroomIdFromPayload(data: any) {
    if (data?.classroom_id !== undefined && data?.classroom_id !== null && String(data.classroom_id) !== '') {
        const classroomId = Number(data.classroom_id);
        if (Number.isFinite(classroomId) && classroomId > 0) return classroomId;
    }

    const classLevel = String(data?.class_level || '').trim();
    const classroomName = String(data?.classroom || '').trim();
    if (!classLevel && !classroomName) return null;
    if (!classLevel || !classroomName) return null;

    const classrooms = await prisma.classrooms.findMany({
        include: {
            grade_levels: { select: { name: true } },
        },
    });

    const classroom = classrooms.find((c) => {
        const levelName = String(c.grade_levels?.name || '');
        const fullRoomName = String(c.room_name || '');
        const shortRoomName = roomOnlyLabel(levelName, fullRoomName);
        if (classLevel && levelName !== classLevel) return false;
        return fullRoomName === classroomName || shortRoomName === classroomName;
    }) || classrooms.find((c) => String(c.room_name || '') === classroomName);

    if (!classroom) {
        throw new Error(`ไม่พบห้องเรียน ${classLevel}/${classroomName}`);
    }

    return classroom.id;
}

async function upsertSingleClassSchedule(teachingAssignmentId: number, data: any) {
    const dayName = String(data?.day_of_week || '').trim();
    const range = parseTimeRange(data?.time_range);

    if (!dayName || !range) return;

    const [day, periods] = await Promise.all([
        prisma.day_of_weeks.findFirst({
            where: {
                OR: [
                    { day_name_th: dayName },
                    { day_name_en: dayName },
                    { short_name: dayName },
                ],
            },
            select: { id: true },
        }),
        prisma.periods.findMany({ select: { id: true, start_time: true, end_time: true } }),
    ]);

    if (!day) return;

    const period = periods.find((p) => {
        const start = formatTimePart(p.start_time);
        const end = formatTimePart(p.end_time);
        return start === range.start && end === range.end;
    });

    if (!period) return;

    const existing = await prisma.class_schedules.findFirst({
        where: { teaching_assignment_id: teachingAssignmentId },
        orderBy: { id: 'asc' },
        select: { id: true },
    });

    if (existing) {
        await prisma.class_schedules.update({
            where: { id: existing.id },
            data: {
                day_id: day.id,
                period_id: period.id,
            },
        });
        return;
    }

    await prisma.class_schedules.create({
        data: {
            teaching_assignment_id: teachingAssignmentId,
            day_id: day.id,
            period_id: period.id,
        },
    });
}

export const DirectorService = {
    // --- Dashboard Summary ---
    async getSummary() {
        const students = await prisma.students.count();
        const teachers = await prisma.teachers.count();
        const subjects = await prisma.subjects.count();
        const activities = await prisma.events.count();

        // Gender counts through genders relation
        const maleGender = await prisma.genders.findFirst({ where: { name: { contains: 'ชาย', mode: 'insensitive' } } });
        const femaleGender = await prisma.genders.findFirst({ where: { name: { contains: 'หญิง', mode: 'insensitive' } } });

        const male = maleGender ? await prisma.students.count({ where: { gender_id: maleGender.id } }) : 0;
        const female = femaleGender ? await prisma.students.count({ where: { gender_id: femaleGender.id } }) : 0;

        return { students, teachers, subjects, activities, income: 0, expense: 0, male, female };
    },

    // --- Teachers CRUD ---
    async getTeachers(search?: string) {
        const where: any = {};
        if (search) {
            where.OR = [
                { teacher_code: { contains: search, mode: 'insensitive' } },
                { first_name: { contains: search, mode: 'insensitive' } },
                { last_name: { contains: search, mode: 'insensitive' } },
            ];
        }
        const rows = await prisma.teachers.findMany({
            where,
            include: {
                name_prefixes: true,
                teacher_positions: true,
                departments: true,
                learning_subject_groups: true,
            },
            orderBy: { teacher_code: 'asc' }
        });

        return rows.map(r => ({
            ...r,
            prefix: r.name_prefixes?.prefix_name || '',
            department: r.departments?.department_name || '',
            position: r.teacher_positions?.title || '',
            learning_subject_group: r.learning_subject_groups?.group_name || '',
        }));
    },

    async createTeacher(data: any) {
        const hash = await bcrypt.hash(data.password || '1234', 10);

        // Create user first
        const user = await prisma.users.create({
            data: {
                username: data.teacher_code,
                email: data.email || `${data.teacher_code}@school.local`,
                password_hash: hash,
                role_id: data.role_id || 2, // Teacher role
            }
        });

        // Then create teacher linked to user
        const lastTeacher = await prisma.teachers.findFirst({ orderBy: { id: 'desc' } });
        const newId = (lastTeacher?.id || 0) + 1;

        return prisma.teachers.create({
            data: {
                id: newId,
                user_id: user.id,
                teacher_code: data.teacher_code,
                first_name: data.first_name,
                last_name: data.last_name,
                phone: data.phone || null,
                prefix_id: data.prefix_id || null,
                position_id: data.position_id || null,
                department_id: data.department_id || null,
                learning_subject_group_id: data.learning_subject_group_id || null,
            }
        });
    },

    async updateTeacher(id: number, data: any) {
        const updateData: any = {};
        if (data.first_name) updateData.first_name = data.first_name;
        if (data.last_name) updateData.last_name = data.last_name;
        if (data.phone !== undefined) updateData.phone = data.phone;
        if (data.prefix_id !== undefined) updateData.prefix_id = data.prefix_id;
        if (data.position_id !== undefined) updateData.position_id = data.position_id;
        if (data.department_id !== undefined) updateData.department_id = data.department_id;
        if (data.status) updateData.status = data.status;

        // Update password on users table if provided
        if (data.password) {
            const teacher = await prisma.teachers.findUnique({ where: { id }, select: { user_id: true } });
            if (teacher?.user_id) {
                const hash = await bcrypt.hash(data.password, 10);
                await prisma.users.update({ where: { id: teacher.user_id }, data: { password_hash: hash } });
            }
        }

        return prisma.teachers.update({ where: { id }, data: updateData });
    },

    async deleteTeacher(id: number) {
        const teacher = await prisma.teachers.findUnique({ where: { id }, select: { user_id: true } });
        await prisma.teachers.delete({ where: { id } });
        if (teacher?.user_id) {
            await prisma.users.delete({ where: { id: teacher.user_id } }).catch(() => { });
        }
    },

    // --- Students CRUD ---
    async getStudents(filters?: { search?: string; class_level?: string; room?: string }) {
        const where: any = {};
        if (filters?.search) {
            where.OR = [
                { student_code: { contains: filters.search, mode: 'insensitive' } },
                { first_name: { contains: filters.search, mode: 'insensitive' } },
                { last_name: { contains: filters.search, mode: 'insensitive' } },
            ];
        }
        if (filters?.class_level || filters?.room) {
            where.classrooms = {};
            if (filters.class_level) {
                where.classrooms.grade_levels = { name: filters.class_level };
            }
            if (filters.room) {
                where.classrooms.room_name = filters.room;
            }
        }
        const rows = await prisma.students.findMany({
            where,
            include: {
                name_prefixes: true,
                classrooms: { include: { grade_levels: true } },
                genders: true,
                student_statuses: true,
            },
            orderBy: { student_code: 'asc' }
        });

        return rows.map(r => ({
            ...r,
            prefix: r.name_prefixes?.prefix_name || '',
            class_level: r.classrooms?.grade_levels?.name || '',
            room: r.classrooms?.room_name || '',
            gender: r.genders?.name || '',
            status: r.student_statuses?.status_name || '',
        }));
    },

    async createStudent(data: any) {
        const hash = await bcrypt.hash(data.password || '1234', 10);

        // Create user first
        const user = await prisma.users.create({
            data: {
                username: data.student_code,
                email: data.email || `${data.student_code}@school.local`,
                password_hash: hash,
                role_id: data.role_id || 1, // Student role
            }
        });

        const lastStudent = await prisma.students.findFirst({ orderBy: { id: 'desc' } });
        const newStudentId = (lastStudent?.id || 0) + 1;

        return prisma.students.create({
            data: {
                id: newStudentId,
                user_id: user.id,
                student_code: data.student_code,
                first_name: data.first_name,
                last_name: data.last_name,
                date_of_birth: data.date_of_birth ? new Date(data.date_of_birth) : null,
                phone: data.phone || null,
                address: data.address || null,
                classroom_id: data.classroom_id || null,
                prefix_id: data.prefix_id || null,
                gender_id: data.gender_id || null,
                status_id: data.status_id || null,
            }
        });
    },

    async updateStudent(id: number, data: any) {
        const updateData: any = {};
        if (data.first_name) updateData.first_name = data.first_name;
        if (data.last_name) updateData.last_name = data.last_name;
        if (data.phone !== undefined) updateData.phone = data.phone;
        if (data.address !== undefined) updateData.address = data.address;
        if (data.classroom_id !== undefined) updateData.classroom_id = data.classroom_id;
        if (data.prefix_id !== undefined) updateData.prefix_id = data.prefix_id;
        if (data.gender_id !== undefined) updateData.gender_id = data.gender_id;
        if (data.status_id !== undefined) updateData.status_id = data.status_id;
        if (data.date_of_birth) updateData.date_of_birth = new Date(data.date_of_birth);

        // Update password on users table if provided
        if (data.password) {
            const student = await prisma.students.findUnique({ where: { id }, select: { user_id: true } });
            if (student?.user_id) {
                const hash = await bcrypt.hash(data.password, 10);
                await prisma.users.update({ where: { id: student.user_id }, data: { password_hash: hash } });
            }
        }

        return prisma.students.update({ where: { id }, data: updateData });
    },

    async deleteStudent(id: number) {
        const student = await prisma.students.findUnique({ where: { id }, select: { user_id: true } });
        // Delete related records
        await prisma.behavior_records.deleteMany({ where: { student_id: id } });
        await prisma.enrollments.deleteMany({ where: { student_id: id } });
        await prisma.students.delete({ where: { id } });
        if (student?.user_id) {
            await prisma.users.delete({ where: { id: student.user_id } }).catch(() => { });
        }
    },

    // --- Student Count ---
    async getStudentCount() {
        const students = await prisma.students.findMany({
            include: {
                classrooms: { include: { grade_levels: true } }
            }
        });

        // Group by class_level + room
        const counts = new Map<string, { class_level: string; room: string; total: number }>();
        students.forEach(s => {
            const level = s.classrooms?.grade_levels?.name || 'ไม่ระบุ';
            const room = s.classrooms?.room_name || 'ไม่ระบุ';
            const key = `${level}-${room}`;
            const existing = counts.get(key) || { class_level: level, room, total: 0 };
            existing.total++;
            counts.set(key, existing);
        });

        return Array.from(counts.values()).sort((a, b) => {
            if (a.class_level !== b.class_level) return a.class_level.localeCompare(b.class_level);
            return a.room.localeCompare(b.room);
        });
    },

    // --- Subjects CRUD ---
    async getSubjects(filters?: any) {
        const where: any = {};
        if (filters?.search) {
            where.OR = [
                { subject_code: { contains: filters.search, mode: 'insensitive' } },
                { subject_name: { contains: filters.search, mode: 'insensitive' } },
            ];
        }
        const rows = await prisma.subjects.findMany({
            where,
            include: {
                learning_subject_groups: true,
                subject_categories: true,
                evaluation_types: true,
                teaching_assignments: {
                    include: { classrooms: { include: { grade_levels: true } } },
                    take: 1
                }
            },
            orderBy: { subject_code: 'asc' }
        });

        return rows.map(r => ({
            ...r,
            name: r.subject_name,
            subject_type: r.subject_categories?.category_name || '',
            subject_group: r.learning_subject_groups?.group_name || '',
            level: r.teaching_assignments?.[0]?.classrooms?.grade_levels?.name || '',
        }));
    },

    async createSubject(data: any) {
        const lastSubject = await prisma.subjects.findFirst({ orderBy: { id: 'desc' } });
        const newSubjectId = (lastSubject?.id || 0) + 1;

        return prisma.subjects.create({
            data: {
                id: newSubjectId,
                subject_code: data.subject_code,
                subject_name: data.subject_name,
                credit: data.credit || 1.0,
                learning_subject_group_id: data.learning_subject_group_id || null,
                subject_categories_id: data.subject_categories_id || null,
                evaluation_type_id: data.evaluation_type_id || null,
            }
        });
    },

    async updateSubject(id: number, data: any) {
        const updateData: any = {};
        if (data.subject_name) updateData.subject_name = data.subject_name;
        if (data.credit !== undefined) updateData.credit = data.credit;
        if (data.learning_subject_group_id !== undefined) updateData.learning_subject_group_id = data.learning_subject_group_id;
        if (data.subject_categories_id !== undefined) updateData.subject_categories_id = data.subject_categories_id;
        return prisma.subjects.update({ where: { id }, data: updateData });
    },

    async deleteSubject(id: number) {
        return prisma.subjects.delete({ where: { id } });
    },

    // --- Curriculum (Teaching Assignments) ---
    async getSections(yearOrSemesterId?: number, semesterNumber?: number) {
        const where: any = {};
        if (typeof semesterNumber === 'number' && typeof yearOrSemesterId === 'number') {
            const semester = await prisma.semesters.findFirst({
                where: {
                    semester_number: semesterNumber,
                    academic_years: { year_name: String(yearOrSemesterId) },
                },
                select: { id: true },
                orderBy: { id: 'desc' },
            });
            if (semester) where.semester_id = semester.id;
            else where.semester_id = -1; // no match -> empty result
        } else if (yearOrSemesterId) {
            // Backward compatible: treat first arg as semester_id
            where.semester_id = yearOrSemesterId;
        }

        return prisma.teaching_assignments.findMany({
            where,
            include: {
                subjects: true,
                teachers: { include: { name_prefixes: true } },
                classrooms: { include: { grade_levels: true } },
                semesters: { include: { academic_years: true } },
                class_schedules: {
                    include: {
                        day_of_weeks: true,
                        periods: true,
                    },
                    orderBy: [{ day_id: 'asc' }, { period_id: 'asc' }],
                },
                enrollments: { select: { id: true } },
            },
            orderBy: [{ semester_id: 'desc' }, { id: 'desc' }]
        }).then((rows) => rows.map((row) => {
            const firstSchedule = row.class_schedules?.[0];
            const dayName = firstSchedule?.day_of_weeks?.day_name_th || '';
            const timeRange = firstSchedule?.periods
                ? `${formatTimePart(firstSchedule.periods.start_time)}-${formatTimePart(firstSchedule.periods.end_time)}`
                : '';

            return {
                ...row,
                year: row.semesters?.academic_years?.year_name || '',
                semester: row.semesters?.semester_number || null,
                class_level: row.classrooms?.grade_levels?.name || '',
                classroom: row.classrooms?.room_name || '',
                day_of_week: dayName,
                time_range: timeRange,
                subjects: row.subjects ? { ...row.subjects, name: row.subjects.subject_name } : row.subjects,
            };
        }));
    },

    async createSection(data: any) {
        const subject_id = Number(data?.subject_id);
        const teacher_id = Number(data?.teacher_id);
        if (!Number.isFinite(subject_id) || subject_id <= 0) throw new Error('กรุณาเลือกรายวิชา');
        if (!Number.isFinite(teacher_id) || teacher_id <= 0) throw new Error('กรุณาเลือกผู้สอน');

        const semester_id = await resolveSemesterIdFromPayload(data);
        const classroom_id = await resolveClassroomIdFromPayload(data);

        const created = await prisma.teaching_assignments.create({
            data: {
                subject_id,
                teacher_id,
                semester_id,
                classroom_id,
                capacity: data.capacity || null,
                status: data.status || 'open',
            }
        });

        await upsertSingleClassSchedule(created.id, data);
        return created;
    },

    async updateSection(id: number, data: any) {
        const updateData: any = {};
        if (data.subject_id !== undefined) {
            const subject_id = Number(data.subject_id);
            if (!Number.isFinite(subject_id) || subject_id <= 0) throw new Error('subject_id ไม่ถูกต้อง');
            updateData.subject_id = subject_id;
        }
        if (data.teacher_id !== undefined) {
            const teacher_id = Number(data.teacher_id);
            if (!Number.isFinite(teacher_id) || teacher_id <= 0) throw new Error('teacher_id ไม่ถูกต้อง');
            updateData.teacher_id = teacher_id;
        }
        if (
            data.classroom_id !== undefined ||
            data.class_level !== undefined ||
            data.classroom !== undefined
        ) {
            updateData.classroom_id = await resolveClassroomIdFromPayload(data);
        }
        if (
            data.semester_id !== undefined ||
            data.year !== undefined ||
            data.semester !== undefined
        ) {
            updateData.semester_id = await resolveSemesterIdFromPayload(data);
        }
        if (data.capacity !== undefined) updateData.capacity = data.capacity;
        if (data.status) updateData.status = data.status;

        const updated = await prisma.teaching_assignments.update({ where: { id }, data: updateData });
        await upsertSingleClassSchedule(id, data);
        return updated;
    },

    async deleteSection(id: number) {
        // Delete related records
        await prisma.student_scores.deleteMany({
            where: { assessment_items: { grade_categories: { teaching_assignment_id: id } } }
        });
        await prisma.assessment_items.deleteMany({
            where: { grade_categories: { teaching_assignment_id: id } }
        });
        await prisma.grade_categories.deleteMany({ where: { teaching_assignment_id: id } });
        await prisma.attendance_records.deleteMany({
            where: { attendance_sessions: { teaching_assignment_id: id } }
        });
        await prisma.attendance_sessions.deleteMany({ where: { teaching_assignment_id: id } });
        await prisma.class_schedules.deleteMany({ where: { teaching_assignment_id: id } });
        await prisma.final_grades.deleteMany({
            where: { enrollments: { teaching_assignment_id: id } }
        });
        await prisma.enrollments.deleteMany({ where: { teaching_assignment_id: id } });
        return prisma.teaching_assignments.delete({ where: { id } });
    },

    // --- Advisors (use classroom_advisors + classrooms/levels) ---
    async getAdvisors(year?: number, semester?: number) {
        const term = await resolveAdvisorTerm(year, semester);
        const rows = await prisma.classroom_advisors.findMany({
            include: {
                teachers: {
                    include: { name_prefixes: true },
                },
                classrooms: {
                    include: {
                        grade_levels: true,
                    },
                },
            },
            orderBy: { id: 'asc' },
        });

        return rows
            .map((row) => mapAdvisorRecord(row, term))
            .sort((a, b) =>
                String(a.class_level || '').localeCompare(String(b.class_level || ''), 'th')
                || String(a.room || '').localeCompare(String(b.room || ''), 'th')
                || Number(a.id) - Number(b.id)
            );
    },

    async createAdvisor(data: any) {
        const teacher_id = Number(data?.teacher_id);
        const class_level = String(data?.class_level || '').trim();
        const room = String(data?.room || '').trim();
        const term = await resolveAdvisorTerm(
            data?.year != null ? Number(data.year) : undefined,
            data?.semester != null ? Number(data.semester) : undefined
        );

        if (!Number.isFinite(teacher_id) || teacher_id <= 0) throw new Error('teacher_id is required');
        if (!class_level) throw new Error('class_level is required');
        if (!room) throw new Error('room is required');

        const teacher = await prisma.teachers.findUnique({
            where: { id: teacher_id },
            select: { id: true },
        });
        if (!teacher) throw new Error('Teacher not found');

        const classroom_id = await resolveClassroomIdFromPayload({
            class_level,
            classroom: room,
        });
        if (!classroom_id) throw new Error('Classroom not found');

        const duplicate = await prisma.classroom_advisors.findFirst({
            where: {
                teacher_id,
                classroom_id,
            },
            select: { id: true },
        });
        if (duplicate) throw new Error('Advisor assignment already exists');

        const created = await prisma.classroom_advisors.create({
            data: {
                teacher_id,
                classroom_id,
            },
            include: {
                teachers: { include: { name_prefixes: true } },
                classrooms: { include: { grade_levels: true } },
            },
        });

        return mapAdvisorRecord(created, term);
    },

    async updateAdvisor(id: number, data: any) {
        if (!id || Number.isNaN(Number(id))) throw new Error('id is required');

        const teacher_id = Number(data?.teacher_id);
        const class_level = String(data?.class_level || '').trim();
        const room = String(data?.room || '').trim();
        const term = await resolveAdvisorTerm(
            data?.year != null ? Number(data.year) : undefined,
            data?.semester != null ? Number(data.semester) : undefined
        );

        if (!Number.isFinite(teacher_id) || teacher_id <= 0) throw new Error('teacher_id is required');
        if (!class_level) throw new Error('class_level is required');
        if (!room) throw new Error('room is required');

        const existing = await prisma.classroom_advisors.findUnique({
            where: { id },
            select: { id: true },
        });
        if (!existing) throw new Error('Advisor record not found');

        const classroom_id = await resolveClassroomIdFromPayload({
            class_level,
            classroom: room,
        });
        if (!classroom_id) throw new Error('Classroom not found');

        const duplicate = await prisma.classroom_advisors.findFirst({
            where: {
                id: { not: id },
                teacher_id,
                classroom_id,
            },
            select: { id: true },
        });
        if (duplicate) throw new Error('Advisor assignment already exists');

        const updated = await prisma.classroom_advisors.update({
            where: { id },
            data: {
                teacher_id,
                classroom_id,
            },
            include: {
                teachers: { include: { name_prefixes: true } },
                classrooms: { include: { grade_levels: true } },
            },
        });

        return mapAdvisorRecord(updated, term);
    },

    async deleteAdvisor(id: number) {
        if (!id || Number.isNaN(Number(id))) throw new Error('id is required');

        const existing = await prisma.classroom_advisors.findUnique({
            where: { id },
            select: { id: true },
        });
        if (!existing) throw new Error('Advisor record not found');

        return prisma.classroom_advisors.delete({ where: { id } });
    },

    // --- Activities (Events) ---
    async getActivities() {
        const rows = await prisma.events.findMany({
            include: { users: { select: { username: true } } },
            orderBy: { start_datetime: 'desc' }
        });

        return rows.map(r => ({
            id: r.id,
            name: r.title,
            date: r.start_datetime,
            location: r.location || '',
            category: r.visibility || 'ทั่วไป',
            note: r.description || '',
            created_by: r.users?.username || '',
        }));
    },

    async createActivity(data: any) {
        return prisma.events.create({
            data: {
                title: data.title || data.name,
                description: data.description || data.note || '',
                start_datetime: data.start_date ? new Date(data.start_date) : new Date(),
                end_datetime: data.end_date ? new Date(data.end_date) : new Date(),
                location: data.location || '',
                visibility: data.visibility || 'public',
                is_all_day: data.is_all_day ?? true,
                created_by: data.created_by || null,
            }
        });
    },

    async updateActivity(id: number, data: any) {
        const updateData: any = {};
        if (data.title || data.name) updateData.title = data.title || data.name;
        if (data.description !== undefined) updateData.description = data.description;
        if (data.start_date) updateData.start_datetime = new Date(data.start_date);
        if (data.end_date) updateData.end_datetime = new Date(data.end_date);
        if (data.location !== undefined) updateData.location = data.location;
        return prisma.events.update({ where: { id }, data: updateData });
    },

    async deleteActivity(id: number) {
        await prisma.event_participants.deleteMany({ where: { event_id: id } });
        await prisma.event_targets.deleteMany({ where: { event_id: id } });
        await prisma.activity_evaluation_link.deleteMany({ where: { event_id: id } });
        return prisma.events.delete({ where: { id } });
    },

    // --- Projects (no table in presentATOM) ---
    async getProjects(year?: number, semester?: number) { void year; void semester; return []; },
    async createProject(data: any) { return { success: false, message: 'ไม่มีตารางโครงการในระบบ' }; },
    async updateProject(id: number, data: any) { return { success: false }; },
    async deleteProject(id: number) { return { success: false }; },

    // --- Finance (no table in presentATOM) ---
    async getFinanceRecords() { return []; },
    async createFinanceRecord(data: any) { return { success: false, message: 'ไม่มีตารางการเงินในระบบ' }; },
    async updateFinanceRecord(id: number, data: any) { return { success: false }; },
    async deleteFinanceRecord(id: number) { return { success: false }; },

    // --- Evaluation Summary ---
    async getEvaluationSummary(year?: number, semester?: number) {
        void year;
        void semester;
        const forms = await prisma.evaluation_forms.findMany({
            include: {
                evaluation_questions: { select: { id: true } },
                evaluation_responses: { select: { id: true } },
            },
            orderBy: { id: 'asc' }
        });

        return forms.map(f => ({
            id: f.id,
            name: f.name,
            type: f.type,
            questions_count: f.evaluation_questions.length,
            responses_count: f.evaluation_responses.length,
        }));
    }
};
