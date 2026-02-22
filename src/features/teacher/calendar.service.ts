import { prisma } from '@/lib/prisma';

export const TeacherCalendarService = {
    async getAll() {
        return prisma.teacher_calendar.findMany({
            orderBy: { event_date: 'asc' }
        });
    },
    async add(title: string, description: string, event_date: string) {
        return prisma.teacher_calendar.create({
            data: { title, description, event_date: new Date(event_date) }
        });
    },
    async remove(id: number) {
        return prisma.teacher_calendar.delete({ where: { id } });
    }
};
