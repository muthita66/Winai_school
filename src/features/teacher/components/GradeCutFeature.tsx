"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { TeacherApiService } from "@/services/teacher-api.service";

const DEFAULT_THRESHOLDS = { a: 80, b_plus: 75, b: 70, c_plus: 65, c: 60, d_plus: 55, d: 50 };

const num = (v: any) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
};
const txt = (v: any) => String(v ?? "").trim();

function badgeColor(grade: string) {
    if (grade === "4") return "bg-green-50 text-green-700 border-green-200";
    if (grade === "3.5") return "bg-emerald-50 text-emerald-700 border-emerald-200";
    if (grade === "3") return "bg-teal-50 text-teal-700 border-teal-200";
    if (grade === "2.5") return "bg-blue-50 text-blue-700 border-blue-200";
    if (grade === "2") return "bg-sky-50 text-sky-700 border-sky-200";
    if (grade === "1.5") return "bg-amber-50 text-amber-700 border-amber-200";
    if (grade === "1") return "bg-orange-50 text-orange-700 border-orange-200";
    return "bg-rose-50 text-rose-700 border-rose-200";
}

export function GradeCutFeature({ session }: { session: any }) {
    const searchParams = useSearchParams();
    const sectionId = Number(searchParams.get("section_id"));
    const hasSection = Number.isFinite(sectionId) && sectionId > 0;

    const [sections, setSections] = useState<any[]>([]);
    const [sectionsLoading, setSectionsLoading] = useState(true);
    const [sectionsError, setSectionsError] = useState<string | null>(null);
    const [sectionSearch, setSectionSearch] = useState("");
    const [yearFilter, setYearFilter] = useState("all");
    const [semesterFilter, setSemesterFilter] = useState("all");

    const [sectionInfo, setSectionInfo] = useState<any | null>(null);
    const [headerCount, setHeaderCount] = useState(0);
    const [thresholds, setThresholds] = useState<any>(DEFAULT_THRESHOLDS);
    const [summary, setSummary] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [savingThresholds, setSavingThresholds] = useState(false);
    const [calculating, setCalculating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showDetails, setShowDetails] = useState(false);
    const [studentSearch, setStudentSearch] = useState("");

    useEffect(() => {
        let active = true;
        (async () => {
            setSectionsLoading(true);
            setSectionsError(null);
            try {
                const data = await TeacherApiService.getTeacherSubjects(session.id);
                if (!active) return;
                setSections(Array.isArray(data) ? data : []);
            } catch {
                if (!active) return;
                setSectionsError("ไม่สามารถโหลดรายการ Section ได้");
                setSections([]);
            } finally {
                if (active) setSectionsLoading(false);
            }
        })();
        return () => {
            active = false;
        };
    }, [session.id]);

    useEffect(() => {
        if (!hasSection) {
            setLoading(false);
            setError(null);
            setSectionInfo(null);
            setSummary([]);
            setHeaderCount(0);
            return;
        }
        const found = sections.find((s) => s.id === sectionId) || null;
        setSectionInfo(found);
        (async () => {
            setLoading(true);
            setError(null);
            try {
                const [headers, thresholdData, summaryRows] = await Promise.all([
                    TeacherApiService.getScoreHeaders(sectionId),
                    TeacherApiService.getGradeThresholds(sectionId),
                    TeacherApiService.getGradeSummary(sectionId),
                ]);
                setHeaderCount(Array.isArray(headers) ? headers.length : 0);
                setThresholds(thresholdData ? { ...DEFAULT_THRESHOLDS, ...thresholdData } : DEFAULT_THRESHOLDS);
                setSummary(Array.isArray(summaryRows) ? summaryRows : []);
            } catch {
                setError("ไม่สามารถโหลดข้อมูลตัดเกรดของ Section นี้ได้");
                setSummary([]);
            } finally {
                setLoading(false);
            }
        })();
    }, [hasSection, sectionId, sections]);

    const years = useMemo(
        () => Array.from(new Set(sections.map((s) => txt(s.year)).filter(Boolean))).sort((a, b) => num(b) - num(a)),
        [sections]
    );
    const semesters = useMemo(
        () => Array.from(new Set(sections.map((s) => txt(s.semester)).filter(Boolean))).sort((a, b) => num(a) - num(b)),
        [sections]
    );

    const filteredSections = useMemo(() => {
        const q = sectionSearch.trim().toLowerCase();
        return sections.filter((s) => {
            if (yearFilter !== "all" && txt(s.year) !== yearFilter) return false;
            if (semesterFilter !== "all" && txt(s.semester) !== semesterFilter) return false;
            if (!q) return true;
            return [s?.subjects?.subject_code, s?.subjects?.name, s?.class_level, s?.classroom, s?.room]
                .map((v) => txt(v).toLowerCase())
                .join(" ")
                .includes(q);
        });
    }, [sections, sectionSearch, yearFilter, semesterFilter]);

    const thresholdValid =
        num(thresholds.a) >= num(thresholds.b_plus) &&
        num(thresholds.b_plus) >= num(thresholds.b) &&
        num(thresholds.b) >= num(thresholds.c_plus) &&
        num(thresholds.c_plus) >= num(thresholds.c) &&
        num(thresholds.c) >= num(thresholds.d_plus) &&
        num(thresholds.d_plus) >= num(thresholds.d);

    const stats = useMemo(() => {
        const count = summary.length;
        const avgPct = count ? Math.round((summary.reduce((s, r) => s + num(r.percentage), 0) / count) * 100) / 100 : 0;
        const passCount = summary.filter((r) => num(r.percentage) >= num(thresholds.d)).length;
        const maxPossible = count ? num(summary[0]?.max_possible) : 0;
        const avgScore = count ? Math.round((summary.reduce((s, r) => s + num(r.total_score), 0) / count) * 100) / 100 : 0;
        const distribution = summary.reduce<Record<string, number>>((acc, r) => {
            const k = String(r.grade ?? "0");
            acc[k] = (acc[k] || 0) + 1;
            return acc;
        }, {});
        return { count, avgPct, passCount, maxPossible, avgScore, distribution };
    }, [summary, thresholds.d]);

    const filteredSummary = useMemo(() => {
        const q = studentSearch.trim().toLowerCase();
        if (!q) return summary;
        return summary.filter((r) => [r.student_code, r.first_name, r.last_name, r.grade].some((v) => txt(v).toLowerCase().includes(q)));
    }, [summary, studentSearch]);

    const saveThresholds = async () => {
        if (!thresholdValid) return alert("ลำดับเกณฑ์คะแนนไม่ถูกต้อง");
        setSavingThresholds(true);
        try {
            await TeacherApiService.saveGradeThresholds(sectionId, thresholds);
            alert("บันทึกเกณฑ์ตัดเกรดเรียบร้อย");
        } catch {
            alert("บันทึกเกณฑ์ตัดเกรดไม่สำเร็จ");
        } finally {
            setSavingThresholds(false);
        }
    };

    const calculateGrades = async () => {
        if (!thresholdValid) return alert("ลำดับเกณฑ์คะแนนไม่ถูกต้อง");
        if (headerCount === 0) return alert("ยังไม่มีหัวข้อคะแนนใน Section นี้");
        setCalculating(true);
        try {
            await TeacherApiService.calculateGrades(sectionId);
            const rows = await TeacherApiService.getGradeSummary(sectionId);
            setSummary(Array.isArray(rows) ? rows : []);
            alert("คำนวณและบันทึกเกรดเรียบร้อย");
        } catch {
            alert("คำนวณเกรดไม่สำเร็จ");
        } finally {
            setCalculating(false);
        }
    };

    if (!hasSection) {
        return (
            <div className="space-y-6">
                <section className="rounded-3xl bg-gradient-to-br from-indigo-600 via-blue-700 to-cyan-700 p-8 text-white shadow-lg relative overflow-hidden">
                    <div className="absolute inset-y-0 right-[-4rem] w-80 bg-white/10 skew-x-[-18deg]" />
                    <div className="relative z-10">
                        <div className="inline-flex rounded-full bg-white/20 px-3 py-1 text-sm font-semibold">
                            Grade Cut Console
                        </div>
                        <h1 className="mt-4 text-3xl font-bold">ศูนย์ตัดเกรด</h1>
                        <p className="mt-2 text-indigo-50">
                            เลือก Section เพื่อกำหนดเกณฑ์คะแนน ดูการกระจายเกรด และคำนวณเกรดโดยตรง
                        </p>
                        <div className="mt-4 flex flex-wrap gap-2 text-sm">
                            <span className="rounded-full bg-white/15 px-3 py-1">โหมดนี้เน้นการตัดเกรด</span>
                            <Link href="/teacher/scores" className="rounded-full bg-white px-3 py-1 font-medium text-indigo-700 hover:bg-indigo-50">
                                ไปหน้าข้อมูลคะแนน (หน้าเลือกงาน)
                            </Link>
                        </div>
                    </div>
                </section>

                <section className="grid grid-cols-1 xl:grid-cols-[360px_minmax(0,1fr)] gap-6">
                    <div className="space-y-6">
                        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                            <h2 className="font-bold text-slate-800">ขั้นตอนใช้งานตัดเกรด</h2>
                            <div className="mt-4 space-y-3">
                                <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-3">
                                    <div className="text-xs font-semibold text-indigo-700">1. เลือก Section</div>
                                    <div className="mt-1 text-sm text-slate-700">เลือกวิชา/ห้องที่ต้องการตัดเกรด</div>
                                </div>
                                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                    <div className="text-xs font-semibold text-slate-700">2. ตั้งค่าเกณฑ์ตัดเกรด</div>
                                    <div className="mt-1 text-sm text-slate-700">กำหนดเปอร์เซ็นต์ขั้นต่ำของ A, B+, B ... D</div>
                                </div>
                                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                    <div className="text-xs font-semibold text-slate-700">3. คำนวณและตรวจสอบผลลัพธ์</div>
                                    <div className="mt-1 text-sm text-slate-700">ดูการกระจายเกรดและรายละเอียดนักเรียนก่อนยืนยัน</div>
                                </div>
                            </div>
                        </section>

                        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                            <h2 className="font-bold text-slate-800">ตัวกรอง Section</h2>
                            <div className="mt-4 space-y-3">
                                <input
                                    value={sectionSearch}
                                    onChange={(e) => setSectionSearch(e.target.value)}
                                    placeholder="ค้นหารหัสวิชา / ชื่อวิชา / ชั้น"
                                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                                <div className="grid grid-cols-2 gap-3">
                                    <select
                                        value={yearFilter}
                                        onChange={(e) => setYearFilter(e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500"
                                    >
                                        <option value="all">ทุกปีการศึกษา</option>
                                        {years.map((y) => (
                                            <option key={y} value={y}>{y}</option>
                                        ))}
                                    </select>
                                    <select
                                        value={semesterFilter}
                                        onChange={(e) => setSemesterFilter(e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500"
                                    >
                                        <option value="all">ทุกภาคเรียน</option>
                                        {semesters.map((s) => (
                                            <option key={s} value={s}>ภาค {s}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="mt-4 grid grid-cols-2 gap-3">
                                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                    <div className="text-xs text-slate-500">Section ทั้งหมด</div>
                                    <div className="mt-1 text-xl font-bold text-slate-800">{sections.length}</div>
                                </div>
                                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                    <div className="text-xs text-slate-500">ตรงตัวกรอง</div>
                                    <div className="mt-1 text-xl font-bold text-slate-800">{filteredSections.length}</div>
                                </div>
                            </div>
                        </section>
                    </div>

                    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                        <div className="border-b border-slate-200 px-5 py-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                            <div>
                                <h2 className="font-bold text-slate-800">เลือก Section เพื่อเข้าหน้าตัดเกรด</h2>
                                <p className="text-sm text-slate-500">หน้านี้พาไปหน้า workflow ตัดเกรดโดยตรง ไม่ใช่หน้า overview</p>
                            </div>
                            <Link href="/teacher/score_input" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                                เปิดศูนย์บันทึกคะแนน
                            </Link>
                        </div>

                        {sectionsError && (
                            <div className="m-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                                {sectionsError}
                            </div>
                        )}

                        {sectionsLoading ? (
                            <div className="p-12 text-center text-slate-500">กำลังโหลดรายการ Section...</div>
                        ) : filteredSections.length === 0 ? (
                            <div className="p-12 text-center text-slate-500">
                                {sections.length === 0 ? "ยังไม่มี Section ที่สอน" : "ไม่พบรายการตามตัวกรอง"}
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100">
                                {filteredSections.map((s) => (
                                    <div key={s.id} className="px-5 py-4 hover:bg-slate-50/70 transition-colors">
                                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                            <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-mono text-slate-700">
                                                        {s?.subjects?.subject_code || "-"}
                                                    </span>
                                                    <span className="rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">
                                                        Section #{s.id}
                                                    </span>
                                                </div>
                                                <h3 className="mt-2 truncate text-base font-bold text-slate-900">
                                                    {s?.subjects?.name || "ไม่ระบุชื่อวิชา"}
                                                </h3>
                                                <p className="mt-1 text-sm text-slate-500">
                                                    ชั้น {txt(s.class_level) || "-"} / ห้อง {txt(s.classroom) || "-"} • ห้องเรียน {txt(s.room) || "-"} • ปี {txt(s.year) || "-"} ภาค {txt(s.semester) || "-"}
                                                </p>
                                            </div>
                                            <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                                                <Link
                                                    href={`/teacher/grade_cut?section_id=${s.id}`}
                                                    className="rounded-xl bg-indigo-600 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-indigo-700"
                                                >
                                                    เริ่มตัดเกรด
                                                </Link>
                                                <Link
                                                    href={`/teacher/score_input?section_id=${s.id}`}
                                                    className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-center text-sm font-semibold text-amber-700 hover:bg-amber-100"
                                                >
                                                    ไปหน้าบันทึกคะแนน
                                                </Link>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                </section>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <section className="rounded-3xl bg-gradient-to-br from-indigo-600 via-blue-700 to-cyan-700 p-8 text-white shadow-lg relative overflow-hidden">
                <div className="absolute inset-y-0 right-[-3rem] w-72 bg-white/10 skew-x-[-18deg]" />
                <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:justify-between">
                    <div>
                        <div className="inline-flex rounded-full bg-white/20 px-3 py-1 text-sm font-medium mb-4">ตัดเกรด</div>
                        <h1 className="text-3xl font-bold">ตัดเกรด</h1>
                        <p className="mt-2 text-indigo-50">กำหนดเกณฑ์คะแนนและคำนวณเกรดของ Section นี้</p>
                        <div className="mt-4 flex flex-wrap gap-2 text-sm">
                            <span className="rounded-full bg-white/15 px-3 py-1">Section #{sectionId}</span>
                            {sectionInfo && <span className="rounded-full bg-white/15 px-3 py-1">{sectionInfo.subjects?.subject_code || "-"} | {txt(sectionInfo.class_level) || "-"} / {txt(sectionInfo.classroom) || "-"} | ปี {txt(sectionInfo.year) || "-"} ภาค {txt(sectionInfo.semester) || "-"}</span>}
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 h-fit">
                        <Link href="/teacher/grade_cut" className="rounded-xl border border-white/20 bg-white/15 px-4 py-2.5 text-sm font-semibold text-center hover:bg-white/25">ศูนย์ตัดเกรด</Link>
                        <Link href={`/teacher/score_input?section_id=${sectionId}`} className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-center text-indigo-700 hover:bg-indigo-50">ไปหน้าบันทึกคะแนน</Link>
                    </div>
                </div>
            </section>

            {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">{error}</div>}

            <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="text-sm text-slate-500">นักเรียน</div><div className="mt-2 text-3xl font-bold text-slate-800">{stats.count}</div><div className="mt-1 text-xs text-slate-500">หัวข้อคะแนน {headerCount} รายการ</div></div>
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="text-sm text-slate-500">ค่าเฉลี่ย (%)</div><div className="mt-2 text-3xl font-bold text-slate-800">{stats.avgPct}</div><div className="mt-1 text-xs text-slate-500">คะแนนเฉลี่ยรวม {stats.avgScore}</div></div>
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="text-sm text-slate-500">ผ่านเกณฑ์ขั้นต่ำ (D)</div><div className="mt-2 text-3xl font-bold text-slate-800">{stats.passCount}/{stats.count || 0}</div><div className="mt-1 text-xs text-slate-500">D = {num(thresholds.d)}%</div></div>
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="text-sm text-slate-500">คะแนนเต็มรวม</div><div className="mt-2 text-3xl font-bold text-slate-800">{stats.maxPossible}</div><div className="mt-1 text-xs text-slate-500">Section ปัจจุบัน</div></div>
            </section>

            {!thresholdValid && <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800">ลำดับเกณฑ์คะแนนไม่ถูกต้อง โดย A ต้องมากกว่าหรือเท่ากับ B+ ไล่ลงมาจนถึง D</div>}

            <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_1fr] gap-6">
                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div><h2 className="font-bold text-slate-800">ตั้งค่าเกณฑ์ตัดเกรด</h2><p className="text-sm text-slate-500">กำหนดเปอร์เซ็นต์ขั้นต่ำของแต่ละเกรด</p></div>
                        <button onClick={() => setThresholds(DEFAULT_THRESHOLDS)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">รีเซ็ตค่าแนะนำ</button>
                    </div>
                    <div className="mt-4 grid grid-cols-2 md:grid-cols-4 xl:grid-cols-2 2xl:grid-cols-4 gap-3">
                        {[
                            ["a", "A (4.0)"], ["b_plus", "B+ (3.5)"], ["b", "B (3.0)"], ["c_plus", "C+ (2.5)"],
                            ["c", "C (2.0)"], ["d_plus", "D+ (1.5)"], ["d", "D (1.0)"],
                        ].map(([key, label]) => (
                            <div key={key} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                <div className="text-xs font-semibold text-slate-500">{label}</div>
                                <input type="number" value={thresholds[key] ?? ""} onChange={(e) => setThresholds({ ...thresholds, [key]: Number(e.target.value) })} className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-center font-bold outline-none focus:ring-2 focus:ring-indigo-500" />
                                <div className="mt-1 text-[11px] text-slate-500">% ขั้นต่ำ</div>
                            </div>
                        ))}
                    </div>
                    <div className="mt-5 flex flex-col sm:flex-row gap-2">
                        <button onClick={saveThresholds} disabled={savingThresholds || !thresholdValid} className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50">{savingThresholds ? "กำลังบันทึก..." : "บันทึกเกณฑ์"}</button>
                        <button onClick={calculateGrades} disabled={calculating || !thresholdValid || headerCount === 0} className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">{calculating ? "กำลังคำนวณ..." : "คำนวณเกรด"}</button>
                    </div>
                    {headerCount === 0 && <p className="mt-3 text-sm text-amber-700">Section นี้ยังไม่มีหัวข้อคะแนน กรุณาบันทึกคะแนนก่อน</p>}
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h2 className="font-bold text-slate-800">การกระจายเกรด</h2>
                    <p className="mt-1 text-sm text-slate-500">สรุปจำนวนนักเรียนในแต่ละช่วงเกรด</p>
                    {loading ? <div className="mt-4 text-sm text-slate-500">กำลังโหลด...</div> : summary.length === 0 ? (
                        <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500">ยังไม่มีข้อมูลสรุปคะแนน</div>
                    ) : (
                        <div className="mt-4 space-y-3">
                            {["4", "3.5", "3", "2.5", "2", "1.5", "1", "0"].map((grade) => {
                                const count = stats.distribution[grade] || 0;
                                const pct = stats.count ? (count / stats.count) * 100 : 0;
                                return (
                                    <div key={grade}>
                                        <div className="mb-1 flex items-center justify-between text-sm">
                                            <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${badgeColor(grade)}`}>เกรด {grade}</span>
                                            <span className="text-slate-600">{count} ({Math.round(pct)}%)</span>
                                        </div>
                                        <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-cyan-500" style={{ width: `${pct}%` }} /></div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>
            </div>

            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="px-5 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div><h2 className="font-bold text-slate-800">รายละเอียดนักเรียน (ไม่บังคับ)</h2><p className="text-sm text-slate-500">ซ่อนไว้ก่อนเพื่อให้หน้านี้โฟกัสการตัดเกรด</p></div>
                    <button onClick={() => setShowDetails((v) => !v)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">{showDetails ? "ซ่อนรายละเอียด" : "แสดงรายละเอียด"}</button>
                </div>
                {showDetails && (
                    <>
                        <div className="border-t border-slate-200 px-5 py-4"><input value={studentSearch} onChange={(e) => setStudentSearch(e.target.value)} placeholder="ค้นหานักเรียน / เกรด" className="w-full lg:w-80 rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" /></div>
                        {loading ? <div className="p-10 text-center text-slate-500">กำลังโหลด...</div> : filteredSummary.length === 0 ? <div className="p-10 text-center text-slate-500">ไม่พบข้อมูลนักเรียน</div> : (
                            <div className="overflow-x-auto border-t border-slate-200">
                                <table className="w-full min-w-[860px]">
                                    <thead><tr className="bg-slate-50 border-b border-slate-200"><th className="px-4 py-3 text-left text-sm font-semibold text-slate-600">รหัส</th><th className="px-4 py-3 text-left text-sm font-semibold text-slate-600">ชื่อ-สกุล</th><th className="px-4 py-3 text-center text-sm font-semibold text-slate-600">คะแนนรวม/เต็ม</th><th className="px-4 py-3 text-center text-sm font-semibold text-slate-600">%</th><th className="px-4 py-3 text-center text-sm font-semibold text-slate-600">เกรด</th></tr></thead>
                                    <tbody>
                                        {filteredSummary.map((s, i) => <tr key={`${s.student_id}-${i}`} className="border-b border-slate-100 hover:bg-slate-50/70"><td className="px-4 py-3 text-sm font-mono text-slate-700">{s.student_code}</td><td className="px-4 py-3 text-sm font-medium text-slate-800">{s.first_name} {s.last_name}</td><td className="px-4 py-3 text-center text-sm text-slate-700">{num(s.total_score)}/{num(s.max_possible)}</td><td className="px-4 py-3 text-center text-sm text-slate-700">{num(s.percentage)}%</td><td className="px-4 py-3 text-center"><span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${badgeColor(String(s.grade ?? "0"))}`}>{String(s.grade ?? "0")}</span></td></tr>)}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </>
                )}
            </section>
        </div>
    );
}
