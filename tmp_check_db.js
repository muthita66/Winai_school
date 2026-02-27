const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    try {
        const years = await prisma.academic_years.findMany();
        console.log('YEARS_START');
        console.log(JSON.stringify(years));
        console.log('YEARS_END');
    } catch (err) {
        console.error(err);
    } finally {
        await prisma.$disconnect();
    }
}
main();
