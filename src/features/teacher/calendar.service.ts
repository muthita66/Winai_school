import { prisma } from '@/lib/prisma';

export const TeacherCalendarService = {
    async getAll() {
        const events = await prisma.events.findMany({
            orderBy: { start_datetime: 'asc' },
            include: {
                users: { select: { username: true } }
            }
        });

        return events.map(e => ({
            id: e.id,
            title: e.title,
            description: e.description || '',
            event_date: e.start_datetime,
            end_date: e.end_datetime,
            location: e.location || '',
            is_all_day: e.is_all_day || false,
            created_by: e.users?.username || '',
        }));
    },

    async add(title: string, description: string, event_date: string, userId?: number | null) {
        const startDate = new Date(event_date);
        const endDate = new Date(event_date);
        endDate.setHours(23, 59, 59);

        return prisma.events.create({
            data: {
                title,
                description,
                start_datetime: startDate,
                end_datetime: endDate,
                visibility: 'public',
                is_all_day: true,
                created_by: userId ?? null,
            }
        });
    },

    async remove(id: number) {
        // Delete related records first
        await prisma.event_participants.deleteMany({ where: { event_id: id } });
        await prisma.event_targets.deleteMany({ where: { event_id: id } });
        await prisma.activity_evaluation_link.deleteMany({ where: { event_id: id } });
        return prisma.events.delete({ where: { id } });
    }
};
