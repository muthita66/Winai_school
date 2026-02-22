import { fetchApi } from './api-client';

export const TeacherApiService = {
    // --- Dashboard ---
    async getDashboardSummary(teacher_id: number) {
        return fetchApi<any>(`/api/teacher/dashboard?action=summary&teacher_id=${teacher_id}`);
    },

    // --- Calendar ---
    async getCalendarEvents() {
        return fetchApi<any[]>('/api/teacher/calendar');
    },
    async addCalendarEvent(data: { title: string; description: string; event_date: string }) {
        return fetchApi<any>('/api/teacher/calendar', { method: 'POST', body: JSON.stringify(data) });
    },
    async deleteCalendarEvent(id: number) {
        return fetchApi<any>(`/api/teacher/calendar?action=delete&id=${id}`, { method: 'DELETE' });
    },

    // --- Exam Calendar ---
    async getExamSchedule(teacher_id: number) {
        return fetchApi<any[]>(`/api/teacher/exam-calendar?teacher_id=${teacher_id}`);
    },

    // --- Students (advisor) ---
    async getAdvisoryStudents(teacher_id: number, year?: number, semester?: number) {
        const params = new URLSearchParams();
        params.set('teacher_id', String(teacher_id));
        if (year) params.set('year', String(year));
        if (semester) params.set('semester', String(semester));
        return fetchApi<any[]>(`/api/teacher/students?${params.toString()}`);
    },

    // --- Student Profile ---
    async getStudentProfile(student_id: number, teacher_id?: number) {
        const params = new URLSearchParams();
        params.set('student_id', String(student_id));
        if (teacher_id) params.set('teacher_id', String(teacher_id));
        return fetchApi<any>(`/api/teacher/student-profile?${params.toString()}`);
    },

    // --- Scores ---
    async getTeacherSubjects(teacher_id: number) {
        return fetchApi<any[]>(`/api/teacher/scores?action=subjects&teacher_id=${teacher_id}`);
    },
    async getScoreHeaders(section_id: number) {
        return fetchApi<any[]>(`/api/teacher/scores?action=headers&section_id=${section_id}`);
    },
    async getSectionStudents(section_id: number) {
        return fetchApi<any[]>(`/api/teacher/scores?action=students&section_id=${section_id}`);
    },
    async getScores(header_id: number) {
        return fetchApi<any[]>(`/api/teacher/scores?action=scores&header_id=${header_id}`);
    },
    async addScoreHeader(section_id: number, header_name: string, max_score: number) {
        return fetchApi<any>('/api/teacher/scores', {
            method: 'POST',
            body: JSON.stringify({ action: 'header_add', section_id, header_name, max_score })
        });
    },
    async updateScoreHeader(id: number, title: string, max_score: number) {
        return fetchApi<any>('/api/teacher/scores', {
            method: 'POST',
            body: JSON.stringify({ action: 'header_update', id, title, max_score })
        });
    },
    async deleteScoreHeader(id: number) {
        return fetchApi<any>(`/api/teacher/scores?action=header_delete&id=${id}`, { method: 'DELETE' });
    },
    async saveScores(header_id: number, scores: { student_id: number; score: number }[]) {
        return fetchApi<any>('/api/teacher/scores', {
            method: 'POST',
            body: JSON.stringify({ action: 'save', header_id, scores })
        });
    },

    // --- Grade Cut ---
    async getGradeThresholds(section_id: number) {
        return fetchApi<any>(`/api/teacher/grade-cut?action=thresholds&section_id=${section_id}`);
    },
    async getGradeSummary(section_id: number) {
        return fetchApi<any[]>(`/api/teacher/grade-cut?action=summary&section_id=${section_id}`);
    },
    async saveGradeThresholds(section_id: number, thresholds: any) {
        return fetchApi<any>('/api/teacher/grade-cut', {
            method: 'POST',
            body: JSON.stringify({ action: 'save_thresholds', section_id, thresholds })
        });
    },
    async calculateGrades(section_id: number) {
        return fetchApi<any>('/api/teacher/grade-cut', {
            method: 'POST',
            body: JSON.stringify({ action: 'calculate', section_id })
        });
    },

    // --- Fitness ---
    async getFitnessStudents(teacher_id: number, class_level: string, room: string) {
        return fetchApi<any[]>(`/api/teacher/fitness?action=students&teacher_id=${teacher_id}&class_level=${class_level}&room=${room}`);
    },
    async saveFitnessTest(data: any) {
        return fetchApi<any>('/api/teacher/fitness', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },

    // --- Attendance ---
    async getAttendanceStudents(teacher_id: number, section_id: number, date: string) {
        return fetchApi<any[]>(`/api/teacher/attendance?action=list&teacher_id=${teacher_id}&section_id=${section_id}&date=${date}`);
    },
    async saveAttendance(data: any[]) {
        return fetchApi<any>('/api/teacher/attendance', {
            method: 'POST',
            body: JSON.stringify({ records: data })
        });
    },

    // --- Teaching Evaluation ---
    async getTeachingEvaluation(teacher_id: number, year?: number, semester?: number) {
        const params = new URLSearchParams();
        params.set('teacher_id', String(teacher_id));
        if (year) params.set('year', String(year));
        if (semester) params.set('semester', String(semester));
        return fetchApi<any[]>(`/api/teacher/teaching-evaluation?${params.toString()}`);
    },

    // --- Advisor Evaluation ---
    async getAdvisorEvaluation(teacher_id: number, year?: number, semester?: number) {
        const params = new URLSearchParams();
        params.set('teacher_id', String(teacher_id));
        if (year) params.set('year', String(year));
        if (semester) params.set('semester', String(semester));
        return fetchApi<any[]>(`/api/teacher/advisor-evaluation?${params.toString()}`);
    },
};
