import { prisma } from '@/lib/prisma';

export const DirectorService = {
    // --- Dashboard Summary ---
    async getSummary() {
        const students = await prisma.students.count();
        const teachers = await prisma.teachers.count();
        const subjects = await prisma.subjects.count();
        let activities = 0;
        try { const actResult: any[] = await prisma.$queryRawUnsafe('SELECT COUNT(*)::int AS count FROM school_activities'); activities = actResult[0]?.count || 0; } catch { }

        let income = 0, expense = 0;
        try {
            const incomeResult: any[] = await prisma.$queryRawUnsafe(`SELECT COALESCE(SUM(amount),0) AS total FROM finance_records WHERE type ILIKE 'income' OR type = 'รายรับ'`);
            income = Number(incomeResult[0]?.total || 0);
            const expenseResult: any[] = await prisma.$queryRawUnsafe(`SELECT COALESCE(SUM(amount),0) AS total FROM finance_records WHERE type ILIKE 'expense' OR type = 'รายจ่าย'`);
            expense = Number(expenseResult[0]?.total || 0);
        } catch (e) { /* table may not exist */ }

        const male = await prisma.students.count({ where: { gender: { contains: 'ชาย', mode: 'insensitive' } } });
        const female = await prisma.students.count({ where: { gender: { contains: 'หญิง', mode: 'insensitive' } } });

        return { students, teachers, subjects, activities, income, expense, male, female };
    },

    // --- Teachers CRUD ---
    async getTeachers(search?: string) {
        return prisma.teachers.findMany({
            where: search ? {
                OR: [
                    { teacher_code: { contains: search, mode: 'insensitive' } },
                    { first_name: { contains: search, mode: 'insensitive' } },
                    { last_name: { contains: search, mode: 'insensitive' } }
                ]
            } : undefined,
            orderBy: { teacher_code: 'asc' }
        });
    },
    async createTeacher(data: any) {
        const bcrypt = await import('bcryptjs');
        const hash = await bcrypt.hash(data.password || '1234', 10);
        return prisma.teachers.create({ data: { ...data, password: undefined, password_hash: hash } });
    },
    async updateTeacher(id: number, data: any) {
        const updateData = { ...data, id: undefined, password: undefined };
        if (data.password) {
            const bcrypt = await import('bcryptjs');
            updateData.password_hash = await bcrypt.hash(data.password, 10);
        }
        return prisma.teachers.update({ where: { id }, data: updateData });
    },
    async deleteTeacher(id: number) {
        return prisma.teachers.delete({ where: { id } });
    },

    // --- Students CRUD ---
    async getStudents(filters?: { search?: string; class_level?: string; room?: string }) {
        const where: any = {};
        if (filters?.search) {
            where.OR = [
                { student_code: { contains: filters.search, mode: 'insensitive' } },
                { first_name: { contains: filters.search, mode: 'insensitive' } },
                { last_name: { contains: filters.search, mode: 'insensitive' } }
            ];
        }
        if (filters?.class_level) where.class_level = filters.class_level;
        if (filters?.room) where.room = filters.room;
        return prisma.students.findMany({ where, orderBy: { student_code: 'asc' } });
    },
    async createStudent(data: any) {
        const bcrypt = await import('bcryptjs');
        const hash = await bcrypt.hash(data.password || '1234', 10);
        return prisma.students.create({ data: { ...data, password: undefined, password_hash: hash, classroom: data.room } });
    },
    async updateStudent(id: number, data: any) {
        const updateData = { ...data, id: undefined, password: undefined };
        if (data.password) {
            const bcrypt = await import('bcryptjs');
            updateData.password_hash = await bcrypt.hash(data.password, 10);
        }
        return prisma.students.update({ where: { id }, data: updateData });
    },
    async deleteStudent(id: number) {
        await prisma.registrations.deleteMany({ where: { student_id: id } });
        await prisma.attendance.deleteMany({ where: { student_id: id } });
        await prisma.grades.deleteMany({ where: { student_id: id } });
        await prisma.scores.deleteMany({ where: { student_id: id } });
        try { await prisma.$queryRawUnsafe('DELETE FROM student_conduct WHERE student_id = $1', id); } catch { }
        try { await prisma.$queryRawUnsafe('DELETE FROM student_health WHERE student_id = $1', id); } catch { }
        return prisma.students.delete({ where: { id } });
    },

    // --- Student Count ---
    async getStudentCount() {
        const groups = await prisma.students.groupBy({
            by: ['class_level', 'room'],
            _count: { id: true },
            orderBy: [{ class_level: 'asc' }, { room: 'asc' }]
        });
        return groups.map(g => ({ class_level: g.class_level, room: g.room, total: g._count.id }));
    },

    // --- Subjects CRUD ---
    async getSubjects(filters?: any) {
        const where: any = {};
        if (filters?.search) {
            where.OR = [
                { subject_code: { contains: filters.search, mode: 'insensitive' } },
                { name: { contains: filters.search, mode: 'insensitive' } }
            ];
        }
        if (filters?.level) where.level = filters.level;
        if (filters?.group) where.subject_group = filters.group;
        return prisma.subjects.findMany({ where, orderBy: { subject_code: 'asc' } });
    },
    async createSubject(data: any) {
        return prisma.subjects.create({ data });
    },
    async updateSubject(id: number, data: any) {
        return prisma.subjects.update({ where: { id }, data: { ...data, id: undefined } });
    },
    async deleteSubject(id: number) {
        return prisma.subjects.delete({ where: { id } });
    },

    // --- Curriculum (Sections) ---
    async getSections(year?: number, semester?: number) {
        const where: any = {};
        if (year) where.year = year;
        if (semester) where.semester = semester;
        return prisma.subject_sections.findMany({
            where,
            include: { subjects: true, teachers: true },
            orderBy: [{ year: 'desc' }, { semester: 'desc' }, { id: 'desc' }]
        });
    },
    async createSection(data: any) {
        return prisma.subject_sections.create({ data });
    },
    async updateSection(id: number, data: any) {
        return prisma.subject_sections.update({ where: { id }, data: { ...data, id: undefined } });
    },
    async deleteSection(id: number) {
        await prisma.$queryRawUnsafe(`DELETE FROM scores WHERE item_id IN (SELECT id FROM score_items WHERE section_id = ${id})`);
        await prisma.score_items.deleteMany({ where: { section_id: id } });
        await prisma.grades.deleteMany({ where: { section_id: id } });
        await prisma.registrations.deleteMany({ where: { section_id: id } });
        return prisma.subject_sections.delete({ where: { id } });
    },

    // --- Advisors ---
    async getAdvisors(year?: number, semester?: number) {
        const where: any = {};
        if (year) where.year = year;
        if (semester) where.semester = semester;
        return prisma.teacher_advisors.findMany({
            where,
            include: { teachers: true },
            orderBy: [{ year: 'desc' }, { semester: 'desc' }, { class_level: 'asc' }]
        });
    },
    async createAdvisor(data: any) {
        return prisma.teacher_advisors.create({ data });
    },
    async updateAdvisor(id: number, data: any) {
        return prisma.teacher_advisors.update({ where: { id }, data: { ...data, id: undefined } });
    },
    async deleteAdvisor(id: number) {
        return prisma.teacher_advisors.delete({ where: { id } });
    },

    // --- Activities (raw SQL) ---
    async getActivities() {
        try { return await prisma.$queryRawUnsafe('SELECT * FROM school_activities ORDER BY id DESC'); } catch { return []; }
    },
    async createActivity(data: any) {
        try { await prisma.$queryRawUnsafe('INSERT INTO school_activities(name, date, location, note, category) VALUES($1,$2,$3,$4,$5)', data.name, data.date || null, data.location || '', data.note || '', data.category || ''); return { success: true }; } catch { return { success: false }; }
    },
    async updateActivity(id: number, data: any) {
        try {
            await prisma.$queryRawUnsafe(
                'UPDATE school_activities SET name = $1, date = $2, location = $3, note = $4, category = $5 WHERE id = $6',
                data.name || '', data.date || null, data.location || '', data.note || '', data.category || '', id
            );
            return { success: true };
        } catch { return { success: false }; }
    },
    async deleteActivity(id: number) {
        try { await prisma.$queryRawUnsafe('DELETE FROM school_activities WHERE id = $1', id); return { success: true }; } catch { return { success: false }; }
    },

    // --- Projects (raw SQL since table may not be in Prisma) ---
    async getProjects(year?: number, semester?: number) {
        let sql = 'SELECT * FROM projects';
        const conditions: string[] = [];
        if (year) conditions.push(`year = ${year}`);
        if (semester) conditions.push(`semester = ${semester}`);
        if (conditions.length) sql += ` WHERE ${conditions.join(' AND ')}`;
        sql += ' ORDER BY year DESC, semester DESC, id DESC';
        try { return await prisma.$queryRawUnsafe(sql); } catch { return []; }
    },
    async createProject(data: any) {
        try {
            const result: any = await prisma.$queryRawUnsafe(
                `INSERT INTO projects(name, year, semester, objective, department, budget_total, budget_used) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
                data.name, data.year || null, data.semester || null, data.objective || '', data.department || '', data.budget_total || 0, data.budget_used || 0
            );
            return { success: true, id: result[0]?.id };
        } catch { return { success: false }; }
    },
    async updateProject(id: number, data: any) {
        try {
            await prisma.$queryRawUnsafe(
                `UPDATE projects SET name = $1, year = $2, semester = $3, objective = $4, department = $5, budget_total = $6, budget_used = $7 WHERE id = $8`,
                data.name || '', data.year || null, data.semester || null, data.objective || '', data.department || '', data.budget_total || 0, data.budget_used || 0, id
            );
            return { success: true };
        } catch { return { success: false }; }
    },
    async deleteProject(id: number) {
        try { await prisma.$queryRawUnsafe(`DELETE FROM projects WHERE id = $1`, id); return { success: true }; } catch { return { success: false }; }
    },

    // --- Finance (raw SQL since table may not be in Prisma) ---
    async getFinanceRecords() {
        try { return await prisma.$queryRawUnsafe('SELECT * FROM finance_records ORDER BY id DESC'); } catch { return []; }
    },
    async createFinanceRecord(data: any) {
        try {
            await prisma.$queryRawUnsafe(
                `INSERT INTO finance_records(title, type, amount, note, record_date) VALUES($1,$2,$3,$4,$5)`,
                data.title, data.type, data.amount || 0, data.note || '', data.record_date || new Date().toISOString().slice(0, 10)
            );
            return { success: true };
        } catch { return { success: false }; }
    },
    async updateFinanceRecord(id: number, data: any) {
        try {
            await prisma.$queryRawUnsafe(
                `UPDATE finance_records SET title = $1, type = $2, amount = $3, note = $4, record_date = $5 WHERE id = $6`,
                data.title || '', data.type || '', data.amount || 0, data.note || '', data.record_date || new Date().toISOString().slice(0, 10), id
            );
            return { success: true };
        } catch { return { success: false }; }
    },
    async deleteFinanceRecord(id: number) {
        try { await prisma.$queryRawUnsafe(`DELETE FROM finance_records WHERE id = $1`, id); return { success: true }; } catch { return { success: false }; }
    },

    // --- Evaluation (raw SQL) ---
    async getEvaluationSummary(year?: number, semester?: number) {
        try {
            if (year && semester) {
                return await prisma.$queryRawUnsafe('SELECT * FROM competency_topics WHERE year = $1 AND semester = $2 ORDER BY order_index ASC', year, semester);
            }
            return await prisma.$queryRawUnsafe('SELECT * FROM competency_topics ORDER BY year DESC, semester DESC, order_index ASC');
        } catch { return []; }
    }
};
