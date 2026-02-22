import { prisma } from '@/lib/prisma';

export const RegistrationService = {
    async searchSubjects(keyword: string, year?: number, semester?: number, class_level?: string, room?: string) {
        // Find matching subjects
        const subjectsMatch = await prisma.subjects.findMany({
            where: {
                OR: [
                    { subject_code: { contains: keyword, mode: 'insensitive' } },
                    { name: { contains: keyword, mode: 'insensitive' } },
                ],
            },
            select: { id: true }
        });
        const subjectIds = subjectsMatch.map(s => s.id);

        if (subjectIds.length === 0) return [];

        const whereClause: any = { subject_id: { in: subjectIds } };
        if (year) whereClause.year = year;
        if (semester) whereClause.semester = semester;
        if (class_level) whereClause.class_level = class_level;

        // Let's not strict enforce room on search, they might want to see other rooms
        // if (room) whereClause.classroom = room;

        const sections = await prisma.subject_sections.findMany({
            where: whereClause,
            include: {
                subjects: true,
                teachers: true
            },
            orderBy: [
                { subjects: { subject_code: 'asc' } },
                { day_of_week: 'asc' }
            ]
        });

        const grouped: Record<string, any> = {};
        sections.forEach((sec: any) => {
            const subjectCode = sec.subjects.subject_code;
            if (!grouped[subjectCode]) {
                grouped[subjectCode] = {
                    subject_id: sec.subject_id,
                    section_id: sec.id,
                    subject_code: subjectCode,
                    subject_name: sec.subjects.name,
                    credit: sec.subjects.credit,
                    teacher_name: sec.teachers ? `${sec.teachers.first_name} ${sec.teachers.last_name}` : null,
                    schedules: []
                };
            }
            const scheduleStr = `${sec.day_of_week}|${sec.time_range}`;
            const exists = grouped[subjectCode].schedules.some(
                (s: any) => `${s.day_of_week}|${s.time_range}` === scheduleStr
            );
            if (!exists) {
                grouped[subjectCode].schedules.push({
                    section_id: sec.id,
                    day_of_week: sec.day_of_week,
                    time_range: sec.time_range
                });
            }
        });

        return Object.values(grouped);
    },

    async browseSubjects(year: number, semester: number, class_level: string, room: string) {
        const whereClause: any = { year, semester };
        if (class_level) whereClause.class_level = class_level;

        // If room is specified, we either want sections strictly for that room, 
        // OR sections for the class_level where the room is empty/null (meaning it applies to all rooms)
        if (room) {
            whereClause.OR = [
                { room: room },
                { classroom: room },
                { room: '' },
                { room: null },
                { classroom: '' },
                { classroom: null }
            ];
        }

        const sections = await prisma.subject_sections.findMany({
            where: whereClause,
            include: {
                subjects: true,
                teachers: true
            },
            orderBy: [
                { subjects: { subject_code: 'asc' } },
                { day_of_week: 'asc' }
            ]
        });

        const grouped: Record<string, any> = {};
        sections.forEach((sec: any) => {
            const subjectCode = sec.subjects.subject_code;
            if (!grouped[subjectCode]) {
                grouped[subjectCode] = {
                    subject_id: sec.subject_id,
                    section_id: sec.id,
                    subject_code: subjectCode,
                    subject_name: sec.subjects.name,
                    credit: sec.subjects.credit,
                    teacher_name: sec.teachers ? `${sec.teachers.first_name} ${sec.teachers.last_name}` : null,
                    schedules: []
                };
            }
            const scheduleStr = `${sec.day_of_week}|${sec.time_range}`;
            const exists = grouped[subjectCode].schedules.some(
                (s: any) => `${s.day_of_week}|${s.time_range}` === scheduleStr
            );
            if (!exists) {
                grouped[subjectCode].schedules.push({
                    section_id: sec.id,
                    day_of_week: sec.day_of_week,
                    time_range: sec.time_range
                });
            }
        });

        return Object.values(grouped);
    },

    async addToCart(student_id: number, section_id: number, year: number, semester: number) {
        if (!student_id || !section_id || !year || !semester) {
            throw new Error("Missing required parameters for adding to cart");
        }

        // 1. Get info about the section
        const section = await prisma.subject_sections.findUnique({
            where: { id: section_id }
        });

        if (!section) {
            throw new Error("Section not found");
        }

        // 2. Find all sections of the same subject for that class/room in that year/semester
        const sectionsToInsert = await prisma.subject_sections.findMany({
            where: {
                subject_id: section.subject_id,
                year,
                semester,
                class_level: section.class_level,
                classroom: section.classroom
            }
        });

        let addedCount = 0;
        let addedData = [];

        for (const sec of sectionsToInsert) {
            // Check if already in cart/registered
            const exists = await prisma.registrations.findFirst({
                where: {
                    student_id,
                    section_id: sec.id,
                    year,
                    semester
                }
            });

            if (!exists) {
                const newReg = await prisma.registrations.create({
                    data: {
                        student_id,
                        section_id: sec.id,
                        year,
                        semester,
                        status: 'cart'
                    }
                });
                addedCount++;
                addedData.push(newReg);
            }
        }

        return { added_rows: addedCount, data: addedData };
    },

    async getCart(student_id: number, year: number, semester: number) {
        if (!student_id) return [];
        return prisma.registrations.findMany({
            where: {
                student_id,
                year,
                semester,
                status: 'cart'
            },
            include: {
                subject_sections: {
                    include: {
                        subjects: true,
                        teachers: true
                    }
                }
            }
        });
    },

    async getRegistered(student_id: number, year: number, semester: number) {
        if (!student_id) return [];
        return prisma.registrations.findMany({
            where: {
                student_id,
                year,
                semester,
                status: 'registered'
            },
            include: {
                subject_sections: {
                    include: {
                        subjects: true,
                        teachers: true
                    }
                }
            }
        });
    },

    async confirmCart(student_id: number, year: number, semester: number) {
        if (!student_id || !year || !semester) throw new Error("Missing required parameters");
        const result = await prisma.registrations.updateMany({
            where: {
                student_id,
                year,
                semester,
                status: 'cart'
            },
            data: {
                status: 'registered'
            }
        });
        return { updated: result.count };
    },

    async removeCartItem(id: number) {
        if (!id) throw new Error("Invalid item ID");
        return prisma.registrations.delete({
            where: { id }
        });
    },

    async getAdvisor(student_id: number, year?: number, semester?: number) {
        if (!student_id) return { advisors: [] };

        const student = await prisma.students.findUnique({
            where: { id: student_id }
        });
        if (!student) throw new Error("Student not found");

        const whereClause: any = {
            class_level: student.class_level,
            room: student.room || ""
        };

        if (year && semester) {
            whereClause.year = year;
            whereClause.semester = semester;
        } else {
            // Default to latest advisor term for this student's class/room to avoid returning mixed history.
            const latestAdvisor = await prisma.teacher_advisors.findFirst({
                where: whereClause,
                orderBy: [
                    { year: 'desc' },
                    { semester: 'desc' },
                    { id: 'desc' }
                ]
            });
            if (latestAdvisor) {
                whereClause.year = latestAdvisor.year;
                whereClause.semester = latestAdvisor.semester;
            }
        }

        const advisors = await prisma.teacher_advisors.findMany({
            where: whereClause,
            include: {
                teachers: true
            },
            orderBy: [
                { year: 'desc' },
                { semester: 'desc' },
                { teachers: { teacher_code: 'asc' } }
            ]
        });

        return advisors.map(adv => ({
            id: adv.id,
            year: adv.year,
            semester: adv.semester,
            teacher_code: adv.teachers.teacher_code,
            first_name: adv.teachers.first_name,
            last_name: adv.teachers.last_name
        }));
    }
};
