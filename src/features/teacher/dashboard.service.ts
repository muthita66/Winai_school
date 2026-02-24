import { prisma } from '@/lib/prisma';

export const TeacherDashboardService = {
    async getSummary(teacher_id: number) {
        // Count distinct students enrolled in this teacher's assignments
        const enrollments = await prisma.enrollments.findMany({
            where: {
                teaching_assignments: { teacher_id }
            },
            select: { student_id: true },
            distinct: ['student_id']
        });

        // Count teaching assignments (subjects)
        const subjectCount = await prisma.teaching_assignments.count({
            where: { teacher_id }
        });

        // Count assessment items across teacher's assignments
        const assessmentCount = await prisma.assessment_items.count({
            where: {
                grade_categories: {
                    teaching_assignments: { teacher_id }
                }
            }
        });

        // Get upcoming events
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const upcomingEvents = await prisma.events.findMany({
            where: {
                start_datetime: { gte: today }
            },
            orderBy: { start_datetime: 'asc' },
            take: 5
        });

        const totalEvents = await prisma.events.count();

        return {
            students: enrollments.length,
            subjects: subjectCount,
            scoreItems: assessmentCount,
            allEvents: totalEvents,
            upcomingEvents: upcomingEvents.length,
            recentEvents: upcomingEvents.map(e => ({
                id: e.id,
                title: e.title,
                date: e.start_datetime,
                event_date: e.start_datetime,
                location: e.location || '',
            }))
        };
    }
};
