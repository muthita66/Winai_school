import { prisma } from '@/lib/prisma';

export const TeacherDashboardService = {
    async getSummary(teacher_id: number) {
        const studentCount = await prisma.registrations.findMany({
            where: {
                subject_sections: { teacher_id }
            },
            select: { student_id: true },
            distinct: ['student_id']
        });

        const subjectCount = await prisma.subject_sections.count({
            where: { teacher_id }
        });

        const calendarEvents = await prisma.teacher_calendar.findMany({
            orderBy: { event_date: 'asc' }
        });

        const scoreItemCount = await prisma.score_items.count({
            where: {
                subject_sections: { teacher_id }
            }
        });

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const upcomingEvents = calendarEvents.filter(e => e.event_date && new Date(e.event_date) >= today);

        return {
            students: studentCount.length,
            subjects: subjectCount,
            scoreItems: scoreItemCount,
            allEvents: calendarEvents.length,
            upcomingEvents: upcomingEvents.length,
            recentEvents: upcomingEvents.slice(0, 5)
        };
    }
};
