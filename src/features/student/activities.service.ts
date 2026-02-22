import { prisma } from '@/lib/prisma';

export const ActivitiesService = {
    async getAllActivities() {
        return prisma.school_activities.findMany({
            orderBy: {
                id: 'desc'
            }
        });
    }
};
