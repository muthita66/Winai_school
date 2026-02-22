import { prisma } from '@/lib/prisma';

function toNum(v: any) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
}

function hasValue(v: any) {
    return v !== null && v !== undefined && String(v).trim() !== '';
}

function termKey(year?: number | null, semester?: number | null) {
    return `${year ?? ''}-${semester ?? ''}`;
}

function gradePoint(grade: any): number | null {
    if (grade == null) return null;
    const text = String(grade).trim();
    const direct = Number(text);
    if (Number.isFinite(direct)) return direct;
    const map: Record<string, number> = { A: 4, 'B+': 3.5, B: 3, 'C+': 2.5, C: 2, 'D+': 1.5, D: 1, F: 0 };
    return map[text.toUpperCase()] ?? null;
}

function normalizeAttendanceStatus(status: any) {
    const s = String(status ?? '').trim().toLowerCase();
    if (!s) return 'unknown';
    if (['present', 'p', 'มา', 'เข้าเรียน'].includes(s)) return 'present';
    if (['absent', 'a', 'ขาด'].includes(s)) return 'absent';
    if (['late', 'l', 'สาย'].includes(s)) return 'late';
    if (['leave', 'ลา'].includes(s)) return 'leave';
    return 'unknown';
}

function scoreClassLabel(value: any) {
    const n = toNum(value);
    if (n > 0) return 'positive';
    if (n < 0) return 'negative';
    return 'neutral';
}

function parseVaccinationsJson(value: any): any[] {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    try {
        if (typeof value === 'string') {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed : [];
        }
        return Array.isArray(value) ? value : [];
    } catch {
        return [];
    }
}

export const TeacherStudentsService = {
    async getAdvisoryStudents(teacher_id: number, year?: number, semester?: number) {
        let targetYear = year;
        let targetSemester = semester;

        if (!targetYear || !targetSemester) {
            const latest = await prisma.teacher_advisors.findFirst({
                where: { teacher_id },
                orderBy: [{ year: 'desc' }, { semester: 'desc' }, { id: 'desc' }]
            });
            if (!latest) return [];
            targetYear = latest.year;
            targetSemester = latest.semester;
        }

        const advisorRecs = await prisma.teacher_advisors.findMany({
            where: { teacher_id, year: targetYear, semester: targetSemester }
        });
        if (advisorRecs.length === 0) return [];

        const conditions = advisorRecs.map(a => ({
            class_level: a.class_level,
            room: a.room || undefined
        }));

        return prisma.students.findMany({
            where: { OR: conditions },
            orderBy: [{ class_level: 'asc' }, { room: 'asc' }, { student_code: 'asc' }]
        });
    },

    async getStudentProfile(student_id: number) {
        return prisma.students.findUnique({
            where: { id: student_id }
        });
    },

    async getStudentProfileForTeacher(teacher_id: number, student_id: number) {
        const student = await prisma.students.findUnique({
            where: { id: student_id }
        });
        if (!student) return null;

        const advisor = await prisma.teacher_advisors.findFirst({
            where: {
                teacher_id,
                class_level: student.class_level || '',
                OR: [
                    { room: student.room || null },
                    { room: null }
                ]
            },
            orderBy: [{ year: 'desc' }, { semester: 'desc' }, { id: 'desc' }]
        });

        if (!advisor) return null;

        const [
            advisorHistory,
            registrations,
            grades,
            scoreRows,
            attendanceRows,
            conductRows,
            fitnessRows,
            studentHealthRows,
            legacyHealthRows,
            vaccinationRows,
            advisorEvalRows,
            subjectEvalRows,
            competencyResults,
            competencyFeedbackRows
        ] = await Promise.all([
            prisma.teacher_advisors.findMany({
                where: {
                    teacher_id,
                    class_level: student.class_level || '',
                    OR: [{ room: student.room || null }, { room: null }]
                },
                orderBy: [{ year: 'desc' }, { semester: 'desc' }, { id: 'desc' }],
                take: 10
            }),
            prisma.registrations.findMany({
                where: { student_id },
                include: {
                    subject_sections: {
                        include: {
                            subjects: true,
                            teachers: {
                                select: { id: true, prefix: true, first_name: true, last_name: true, department: true }
                            }
                        }
                    }
                },
                orderBy: [{ year: 'desc' }, { semester: 'desc' }, { id: 'desc' }],
                take: 80
            }),
            prisma.grades.findMany({
                where: { student_id },
                include: {
                    subject_sections: {
                        include: {
                            subjects: true,
                            teachers: {
                                select: { id: true, prefix: true, first_name: true, last_name: true, department: true }
                            }
                        }
                    }
                },
                orderBy: { id: 'desc' },
                take: 80
            }),
            prisma.scores.findMany({
                where: { student_id },
                include: {
                    score_items: {
                        include: {
                            subject_sections: {
                                include: { subjects: true }
                            }
                        }
                    }
                },
                orderBy: { id: 'desc' },
                take: 120
            }),
            prisma.attendance.findMany({
                where: { student_id },
                include: {
                    subject_sections: {
                        include: { subjects: true }
                    }
                },
                orderBy: [{ date: 'desc' }, { id: 'desc' }],
                take: 180
            }),
            prisma.student_conduct.findMany({
                where: { student_id },
                orderBy: [{ log_date: 'desc' }, { id: 'desc' }],
                take: 100
            }),
            prisma.student_fitness_tests.findMany({
                where: { student_id },
                orderBy: [{ year: 'desc' }, { semester: 'desc' }, { created_at: 'desc' }, { id: 'desc' }],
                take: 120
            }),
            prisma.student_health.findMany({
                where: { student_id },
                orderBy: [{ updated_at: 'desc' }, { id: 'desc' }],
                take: 5
            }),
            prisma.health_records.findMany({
                where: { student_id },
                orderBy: [{ updated_at: 'desc' }, { id: 'desc' }],
                take: 5
            }),
            prisma.student_vaccinations.findMany({
                where: { student_id },
                orderBy: [{ vaccine_date: 'desc' }, { id: 'desc' }],
                take: 30
            }),
            prisma.advisor_evaluation_results.findMany({
                where: { student_id },
                orderBy: [{ year: 'desc' }, { semester: 'desc' }, { created_at: 'desc' }, { id: 'desc' }],
                take: 120
            }),
            prisma.subject_evaluation_results.findMany({
                where: { student_id },
                include: {
                    subject_sections: { include: { subjects: true } }
                },
                orderBy: [{ year: 'desc' }, { semester: 'desc' }, { created_at: 'desc' }, { id: 'desc' }],
                take: 120
            }),
            prisma.competency_results.findMany({
                where: { student_id },
                orderBy: [{ year: 'desc' }, { semester: 'desc' }, { id: 'desc' }],
                take: 200
            }),
            prisma.competency_feedback.findMany({
                where: { student_id },
                orderBy: [{ year: 'desc' }, { semester: 'desc' }, { created_at: 'desc' }, { id: 'desc' }],
                take: 80
            })
        ]);

        const latestAdvisor = advisorHistory[0] || advisor;

        const registrationSummary = (() => {
            const mapped = registrations.map((r) => ({
                id: r.id,
                status: r.status,
                year: r.year,
                semester: r.semester,
                section_id: r.section_id,
                subject_code: r.subject_sections?.subjects?.subject_code || null,
                subject_name: r.subject_sections?.subjects?.name || null,
                class_level: r.subject_sections?.class_level || null,
                classroom: r.subject_sections?.classroom || null,
                room: r.subject_sections?.room || null,
                teacher_name: r.subject_sections?.teachers
                    ? `${r.subject_sections.teachers.prefix || ''}${r.subject_sections.teachers.first_name || ''} ${r.subject_sections.teachers.last_name || ''}`.trim()
                    : null
            }));
            const termMap = new Map<string, { year: number | null; semester: number | null; count: number }>();
            mapped.forEach((r) => {
                const key = termKey(r.year, r.semester);
                const cur = termMap.get(key) || { year: r.year ?? null, semester: r.semester ?? null, count: 0 };
                cur.count += 1;
                termMap.set(key, cur);
            });
            const terms = Array.from(termMap.values()).sort((a, b) => (toNum(b.year) - toNum(a.year)) || (toNum(b.semester) - toNum(a.semester)));
            const latestTerm = terms[0] || null;
            const latestTermRegistrations = latestTerm
                ? mapped.filter((r) => r.year === latestTerm.year && r.semester === latestTerm.semester).slice(0, 20)
                : [];
            return {
                count: mapped.length,
                latest_term: latestTerm,
                term_counts: terms.slice(0, 8),
                latest_term_registrations: latestTermRegistrations,
                recent_registrations: mapped.slice(0, 20)
            };
        })();

        const gradesSummary = (() => {
            const mapped = grades.map((g) => {
                const sec = g.subject_sections;
                const gp = gradePoint(g.grade);
                return {
                    id: g.id,
                    section_id: g.section_id,
                    year: sec?.year ?? null,
                    semester: sec?.semester ?? null,
                    subject_code: sec?.subjects?.subject_code || null,
                    subject_name: sec?.subjects?.name || null,
                    class_level: sec?.class_level || null,
                    classroom: sec?.classroom || null,
                    total_score: toNum(g.total_score),
                    grade: g.grade ?? null,
                    grade_point: gp
                };
            }).sort((a, b) => (toNum(b.year) - toNum(a.year)) || (toNum(b.semester) - toNum(a.semester)) || (b.id - a.id));

            const points = mapped.map((m) => m.grade_point).filter((v): v is number => v !== null);
            const avgPoint = points.length ? Math.round((points.reduce((s, v) => s + v, 0) / points.length) * 100) / 100 : null;
            const dist = mapped.reduce<Record<string, number>>((acc, m) => {
                const key = String(m.grade ?? '-');
                acc[key] = (acc[key] || 0) + 1;
                return acc;
            }, {});
            const latestTerm = mapped[0] ? { year: mapped[0].year, semester: mapped[0].semester } : null;
            const latestTermGrades = latestTerm ? mapped.filter((m) => m.year === latestTerm.year && m.semester === latestTerm.semester) : [];

            return {
                count: mapped.length,
                average_grade_point: avgPoint,
                latest_term: latestTerm,
                latest_term_grades: latestTermGrades.slice(0, 20),
                recent_grades: mapped.slice(0, 20),
                distribution: dist
            };
        })();

        const scoreSummary = (() => {
            const latestPerItem = new Map<number, any>();
            for (const row of scoreRows) {
                if (!row.item_id) continue;
                if (!latestPerItem.has(row.item_id)) latestPerItem.set(row.item_id, row);
            }
            const items = Array.from(latestPerItem.values()).map((row) => ({
                id: row.id,
                item_id: row.item_id,
                score: toNum(row.score),
                title: row.score_items?.title || null,
                max_score: toNum(row.score_items?.max_score),
                section_id: row.score_items?.section_id || null,
                year: row.score_items?.subject_sections?.year ?? null,
                semester: row.score_items?.subject_sections?.semester ?? null,
                subject_code: row.score_items?.subject_sections?.subjects?.subject_code || null,
                subject_name: row.score_items?.subject_sections?.subjects?.name || null
            })).sort((a, b) => (toNum(b.year) - toNum(a.year)) || (toNum(b.semester) - toNum(a.semester)) || ((b.id || 0) - (a.id || 0)));
            const latestTerm = items[0] ? { year: items[0].year, semester: items[0].semester } : null;
            const latestTermItems = latestTerm ? items.filter((i) => i.year === latestTerm.year && i.semester === latestTerm.semester) : [];
            return {
                count: items.length,
                latest_term: latestTerm,
                latest_term_items: latestTermItems.slice(0, 20),
                recent_items: items.slice(0, 20)
            };
        })();

        const attendanceSummary = (() => {
            const recent = attendanceRows.slice(0, 30).map((a) => ({
                id: a.id,
                date: a.date,
                status: a.status,
                normalized_status: normalizeAttendanceStatus(a.status),
                section_id: a.section_id,
                subject_code: a.subject_sections?.subjects?.subject_code || null,
                subject_name: a.subject_sections?.subjects?.name || null,
                class_level: a.subject_sections?.class_level || null,
                classroom: a.subject_sections?.classroom || null
            }));
            const counts = { total: attendanceRows.length, present: 0, absent: 0, late: 0, leave: 0, unknown: 0 };
            attendanceRows.forEach((a) => {
                const key = normalizeAttendanceStatus(a.status) as keyof typeof counts;
                if (key in counts) counts[key] += 1;
            });
            const attendanceRate = counts.total ? Math.round((counts.present / counts.total) * 10000) / 100 : null;
            const monthMap = new Map<string, any>();
            attendanceRows.forEach((a) => {
                if (!a.date) return;
                const d = new Date(a.date);
                const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                const bucket = monthMap.get(ym) || { month: ym, total: 0, present: 0, absent: 0, late: 0, leave: 0 };
                bucket.total += 1;
                const key = normalizeAttendanceStatus(a.status);
                if (key === 'present') bucket.present += 1;
                if (key === 'absent') bucket.absent += 1;
                if (key === 'late') bucket.late += 1;
                if (key === 'leave') bucket.leave += 1;
                monthMap.set(ym, bucket);
            });
            const monthly = Array.from(monthMap.values()).sort((a, b) => b.month.localeCompare(a.month)).slice(0, 6);
            return { ...counts, attendance_rate: attendanceRate, recent, monthly };
        })();

        const conductSummary = (() => {
            const total = conductRows.reduce((sum, r) => sum + toNum(r.point), 0);
            const positive = conductRows.filter((r) => toNum(r.point) > 0).reduce((sum, r) => sum + toNum(r.point), 0);
            const negative = Math.abs(conductRows.filter((r) => toNum(r.point) < 0).reduce((sum, r) => sum + toNum(r.point), 0));
            return {
                count: conductRows.length,
                total_points: total,
                positive_points: positive,
                negative_points: negative,
                recent: conductRows.slice(0, 20).map((r) => ({
                    id: r.id,
                    log_date: r.log_date,
                    event: r.event,
                    point: r.point,
                    point_type: scoreClassLabel(r.point)
                }))
            };
        })();

        const healthSummary = (() => {
            const latestNew = studentHealthRows[0] || null;
            const latestLegacy = legacyHealthRows[0] || null;
            const vaccinationsFromLegacy = latestLegacy ? parseVaccinationsJson((latestLegacy as any).vaccinations) : [];
            const latestVaccinations = vaccinationRows.slice(0, 10).map((v) => ({
                id: v.id,
                vaccine_name: v.vaccine_name,
                vaccine_date: v.vaccine_date,
                status: v.status
            }));
            const merged = {
                weight: hasValue(latestLegacy?.weight) ? latestLegacy?.weight : latestNew?.weight,
                height: hasValue(latestLegacy?.height) ? latestLegacy?.height : latestNew?.height,
                blood_pressure: hasValue(latestLegacy?.blood_pressure) ? latestLegacy?.blood_pressure : latestNew?.blood_pressure,
                blood_type: hasValue(latestLegacy?.blood_type) ? latestLegacy?.blood_type : latestNew?.blood_type,
                allergies: hasValue(latestLegacy?.allergies) ? latestLegacy?.allergies : latestNew?.allergies,
                chronic_illness: hasValue(latestLegacy?.chronic_illness) ? latestLegacy?.chronic_illness : latestNew?.chronic_illness,
                vision_left: (latestLegacy as any)?.vision_left ?? null,
                vision_right: (latestLegacy as any)?.vision_right ?? null,
                updated_at: latestLegacy?.updated_at || latestNew?.updated_at || null
            } as any;
            const weight = toNum(merged.weight);
            const heightCm = toNum(merged.height);
            const bmi = weight > 0 && heightCm > 0 ? Math.round((weight / ((heightCm / 100) * (heightCm / 100))) * 100) / 100 : null;
            return {
                latest: merged,
                bmi,
                has_health_data: Object.values(merged).some((v) => hasValue(v)),
                vaccinations: latestVaccinations.length > 0 ? latestVaccinations : vaccinationsFromLegacy,
                has_allergy_or_chronic: hasValue(merged.allergies) || hasValue(merged.chronic_illness)
            };
        })();

        const fitnessSummary = (() => {
            const latestPerTest = new Map<string, any>();
            for (const row of fitnessRows) {
                if (!latestPerTest.has(row.test_name)) latestPerTest.set(row.test_name, row);
            }
            const latestRows = Array.from(latestPerTest.values());
            const latestTerm = fitnessRows[0] ? { year: fitnessRows[0].year, semester: fitnessRows[0].semester } : null;
            const latestTermRows = latestTerm ? fitnessRows.filter((r) => r.year === latestTerm.year && r.semester === latestTerm.semester) : [];
            const statusCounts = fitnessRows.reduce<Record<string, number>>((acc, row) => {
                const key = txtOrDash(row.status);
                acc[key] = (acc[key] || 0) + 1;
                return acc;
            }, {});
            return {
                count: fitnessRows.length,
                latest_term: latestTerm,
                latest_term_rows: latestTermRows.slice(0, 20).map((r) => ({
                    id: r.id,
                    test_name: r.test_name,
                    result_value: r.result_value,
                    standard_value: r.standard_value,
                    status: r.status,
                    created_at: r.created_at,
                    year: r.year,
                    semester: r.semester
                })),
                latest_by_test: latestRows.slice(0, 20).map((r) => ({
                    id: r.id,
                    test_name: r.test_name,
                    result_value: r.result_value,
                    standard_value: r.standard_value,
                    status: r.status,
                    created_at: r.created_at,
                    year: r.year,
                    semester: r.semester
                })),
                status_counts: statusCounts
            };
        })();

        const advisorEvaluationSummary = (() => {
            const latestTerm = advisorEvalRows[0] ? { year: advisorEvalRows[0].year, semester: advisorEvalRows[0].semester } : null;
            const latestRows = latestTerm
                ? advisorEvalRows.filter((r) => r.year === latestTerm.year && r.semester === latestTerm.semester)
                : [];
            const scores = advisorEvalRows.map((r) => (r.score == null ? null : toNum(r.score))).filter((v): v is number => v !== null);
            const latestScores = latestRows.map((r) => (r.score == null ? null : toNum(r.score))).filter((v): v is number => v !== null);
            return {
                count: advisorEvalRows.length,
                latest_term: latestTerm,
                average_score: scores.length ? Math.round((scores.reduce((s, v) => s + v, 0) / scores.length) * 100) / 100 : null,
                latest_term_average_score: latestScores.length ? Math.round((latestScores.reduce((s, v) => s + v, 0) / latestScores.length) * 100) / 100 : null,
                recent: advisorEvalRows.slice(0, 20).map((r) => ({
                    id: r.id,
                    topic: r.topic,
                    score: r.score,
                    year: r.year,
                    semester: r.semester,
                    created_at: r.created_at
                }))
            };
        })();

        const subjectEvaluationSummary = (() => {
            const latestTerm = subjectEvalRows[0] ? { year: subjectEvalRows[0].year, semester: subjectEvalRows[0].semester } : null;
            const latestRows = latestTerm
                ? subjectEvalRows.filter((r) => r.year === latestTerm.year && r.semester === latestTerm.semester)
                : [];
            const scores = subjectEvalRows.map((r) => (r.score == null ? null : toNum(r.score))).filter((v): v is number => v !== null);
            const latestScores = latestRows.map((r) => (r.score == null ? null : toNum(r.score))).filter((v): v is number => v !== null);
            return {
                count: subjectEvalRows.length,
                latest_term: latestTerm,
                average_score: scores.length ? Math.round((scores.reduce((s, v) => s + v, 0) / scores.length) * 100) / 100 : null,
                latest_term_average_score: latestScores.length ? Math.round((latestScores.reduce((s, v) => s + v, 0) / latestScores.length) * 100) / 100 : null,
                recent: subjectEvalRows.slice(0, 20).map((r) => ({
                    id: r.id,
                    topic: r.topic,
                    score: r.score,
                    year: r.year,
                    semester: r.semester,
                    created_at: r.created_at,
                    section_id: r.section_id,
                    subject_code: r.subject_sections?.subjects?.subject_code || null,
                    subject_name: r.subject_sections?.subjects?.name || null
                }))
            };
        })();

        const competencySummary = (() => {
            const latest = competencyResults[0] ? { year: competencyResults[0].year ?? null, semester: competencyResults[0].semester ?? null } : null;
            const latestResults = latest
                ? competencyResults.filter((r) => r.year === latest.year && r.semester === latest.semester)
                : [];
            const latestFeedback = latest
                ? competencyFeedbackRows.filter((r) => r.year === latest.year && r.semester === latest.semester)
                : [];
            const scores = latestResults.map((r) => (r.score == null ? null : toNum(r.score))).filter((v): v is number => v !== null);
            return {
                result_count: competencyResults.length,
                feedback_count: competencyFeedbackRows.length,
                latest_term: latest,
                latest_term_average_score: scores.length ? Math.round((scores.reduce((s, v) => s + v, 0) / scores.length) * 100) / 100 : null,
                latest_term_results: latestResults.slice(0, 30).map((r) => ({
                    id: r.id,
                    name: r.name,
                    score: r.score,
                    section_id: r.section_id,
                    year: r.year,
                    semester: r.semester
                })),
                latest_term_feedback: latestFeedback.slice(0, 10).map((r) => ({
                    id: r.id,
                    feedback: r.feedback,
                    section_id: r.section_id,
                    year: r.year,
                    semester: r.semester,
                    created_at: r.created_at
                }))
            };
        })();

        const alerts = (() => {
            const list: string[] = [];
            if ((attendanceSummary.attendance_rate ?? 100) < 80 && attendanceSummary.total > 0) list.push('เสี่ยงขาดเรียน');
            if ((gradesSummary.average_grade_point ?? 4) < 2 && gradesSummary.count > 0) list.push('ผลการเรียนต้องติดตาม');
            if (healthSummary.has_allergy_or_chronic) list.push('มีข้อมูลสุขภาพที่ควรระวัง');
            if (conductSummary.negative_points >= 5) list.push('มีคะแนนพฤติกรรมเชิงลบสะสม');
            if (fitnessSummary.count > 0 && Object.keys(fitnessSummary.status_counts).some((k) => /ควรปรับปรุง|ต่ำกว่าเกณฑ์/i.test(k))) {
                list.push('สมรรถภาพบางรายการควรติดตาม');
            }
            return list;
        })();

        const timeline = (() => {
            const events: Array<{ date: Date | null; type: string; title: string; detail?: string }> = [];
            attendanceSummary.recent.forEach((a: any) => {
                events.push({
                    date: a.date ? new Date(a.date) : null,
                    type: 'attendance',
                    title: `เช็คชื่อ: ${a.status || '-'}`,
                    detail: [a.subject_code, a.subject_name].filter(Boolean).join(' ')
                });
            });
            conductSummary.recent.forEach((c: any) => {
                events.push({
                    date: c.log_date ? new Date(c.log_date) : null,
                    type: 'conduct',
                    title: `พฤติกรรม ${toNum(c.point) >= 0 ? '+' : ''}${toNum(c.point)} คะแนน`,
                    detail: c.event || undefined
                });
            });
            fitnessSummary.latest_by_test.forEach((f: any) => {
                events.push({
                    date: f.created_at ? new Date(f.created_at) : null,
                    type: 'fitness',
                    title: `สมรรถภาพ: ${f.test_name}`,
                    detail: [f.result_value, f.standard_value ? `เกณฑ์ ${f.standard_value}` : null, f.status].filter(Boolean).join(' | ')
                });
            });
            advisorEvaluationSummary.recent.slice(0, 8).forEach((r: any) => {
                events.push({
                    date: r.created_at ? new Date(r.created_at) : null,
                    type: 'advisor_eval',
                    title: `ประเมินที่ปรึกษา: ${r.topic}`,
                    detail: r.score != null ? `คะแนน ${r.score}` : undefined
                });
            });
            subjectEvaluationSummary.recent.slice(0, 8).forEach((r: any) => {
                events.push({
                    date: r.created_at ? new Date(r.created_at) : null,
                    type: 'subject_eval',
                    title: `ประเมินรายวิชา: ${r.topic}`,
                    detail: [r.subject_code, r.subject_name, r.score != null ? `คะแนน ${r.score}` : null].filter(Boolean).join(' | ')
                });
            });
            competencySummary.latest_term_feedback.slice(0, 5).forEach((r: any) => {
                events.push({
                    date: r.created_at ? new Date(r.created_at) : null,
                    type: 'competency_feedback',
                    title: 'ข้อเสนอแนะสมรรถนะ',
                    detail: r.feedback || undefined
                });
            });
            healthSummary.latest?.updated_at && events.push({
                date: new Date(healthSummary.latest.updated_at),
                type: 'health',
                title: 'อัปเดตข้อมูลสุขภาพ',
                detail: [healthSummary.latest.weight ? `นน. ${healthSummary.latest.weight}` : null, healthSummary.latest.height ? `สส. ${healthSummary.latest.height}` : null].filter(Boolean).join(' | ')
            });
            (healthSummary.vaccinations || []).slice(0, 5).forEach((v: any) => {
                const vaccineDate = (v as any).vaccine_date || (v as any).date || null;
                events.push({
                    date: vaccineDate ? new Date(vaccineDate) : null,
                    type: 'vaccine',
                    title: `วัคซีน: ${(v as any).vaccine_name || (v as any).name || '-'}`,
                    detail: (v as any).status || undefined
                });
            });

            return events
                .filter((e) => e.date && !Number.isNaN(e.date.getTime()))
                .sort((a, b) => (b.date!.getTime() - a.date!.getTime()))
                .slice(0, 30)
                .map((e) => ({ ...e, date: e.date }));
        })();

        const profileCompletion = (() => {
            const fields = [
                student.prefix, student.first_name, student.last_name, student.gender, student.birthday,
                student.phone, student.address, student.parent_name, student.parent_phone,
                student.class_level, student.room
            ];
            const filled = fields.filter(hasValue).length;
            return {
                filled,
                total: fields.length,
                percent: Math.round((filled / fields.length) * 100)
            };
        })();

        return {
            ...student,
            extended_profile: {
                advisory: {
                    current: latestAdvisor,
                    history: advisorHistory
                },
                alerts,
                profile_completion: profileCompletion,
                registrations: registrationSummary,
                grades: gradesSummary,
                scores: scoreSummary,
                attendance: attendanceSummary,
                conduct: conductSummary,
                health: healthSummary,
                fitness: fitnessSummary,
                evaluations: {
                    advisor: advisorEvaluationSummary,
                    subject: subjectEvaluationSummary,
                    competency: competencySummary
                },
                timeline
            }
        };
    }
};

function txtOrDash(v: any) {
    const t = String(v ?? '').trim();
    return t || '-';
}
