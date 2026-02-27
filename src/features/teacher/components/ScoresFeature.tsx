"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TeacherApiService } from "@/services/teacher-api.service";

function normalizeText(value: any) {
    return String(value ?? "").trim().toLowerCase();
}

function formatSectionLabel(section: any) {
    const level = section?.class_level || "-";
    const classroom = section?.classroom?.split('/').pop() || section?.classroom || "-";
    return `ชั้น ${level}/${classroom}`;
}



export function ScoresFeature({ session }: { session: any }) {
    const [subjects, setSubjects] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [yearFilter, setYearFilter] = useState<string>("all");
    const [semesterFilter, setSemesterFilter] = useState<string>("all");
    const [levelFilter, setLevelFilter] = useState<string>("all");
    const [classroomFilter, setClassroomFilter] = useState<string>("all");
    const [subjectFilter, setSubjectFilter] = useState<string>("all");

    useEffect(() => {
        let active = true;

        const run = async () => {
            setLoading(true);
            setError(null);
            try {
                const data = await TeacherApiService.getTeacherSubjects(session.id);
                if (!active) return;
                setSubjects(Array.isArray(data) ? data : []);
            } catch {
                if (!active) return;
                setError("ไม่สามารถโหลดรายการวิชาที่สอนได้");
                setSubjects([]);
            } finally {
                if (active) setLoading(false);
            }
        };

        run();
        return () => {
            active = false;
        };
    }, [session.id]);

    const years = Array.from(
        new Set(subjects.map((s) => String(s.year ?? "")).filter(Boolean))
    ).sort((a, b) => Number(b) - Number(a));

    const semesters = Array.from(
        new Set(subjects.map((s) => String(s.semester ?? "")).filter(Boolean))
    ).sort((a, b) => Number(a) - Number(b));

    const levels = Array.from(
        new Set(subjects.map((s) => String(s.class_level ?? "")).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b));

    const classrooms = Array.from(
        new Set(subjects.map((s) => String(s.classroom ?? "")).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b));

    const subjectOptions = Array.from(
        new Set(subjects.map((s) => `${s?.subjects?.subject_code}|${s?.subjects?.name}`))
    ).sort().map(val => {
        const [code, name] = val.split("|");
        return { code, name };
    });

    const filteredSubjects = subjects
        .filter((s) => {
            if (yearFilter !== "all" && String(s.year) !== yearFilter) return false;
            if (semesterFilter !== "all" && String(s.semester) !== semesterFilter) return false;
            if (levelFilter !== "all" && String(s.class_level) !== levelFilter) return false;
            if (classroomFilter !== "all" && String(s.classroom) !== classroomFilter) return false;
            if (subjectFilter !== "all" && s?.subjects?.subject_code !== subjectFilter) return false;

            if (!search.trim()) return true;
            const q = normalizeText(search);
            const haystack = [
                s?.subjects?.subject_code,
                s?.subjects?.name,
                s?.class_level,
                s?.classroom,
                s?.room,
                s?.year,
                s?.semester,
            ]
                .map(normalizeText)
                .join(" ");
            return haystack.includes(q);
        })
        .sort((a, b) => {
            const yearDiff = Number(b?.year || 0) - Number(a?.year || 0);
            if (yearDiff !== 0) return yearDiff;
            const semDiff = Number(b?.semester || 0) - Number(a?.semester || 0);
            if (semDiff !== 0) return semDiff;
            return String(a?.subjects?.subject_code || "").localeCompare(String(b?.subjects?.subject_code || ""));
        });

    const uniqueSubjects = new Set(
        subjects.map((s) => `${s?.subjects?.subject_code || ""}|${s?.subjects?.name || ""}`)
    ).size;

    const currentYearSections = subjects.filter((s) => String(s.year) === (years[0] || "")).length;

    return (
        <div className="space-y-6">
            <section className="rounded-3xl bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 p-8 text-white shadow-lg relative overflow-hidden">
                <div className="absolute inset-y-0 right-[-4rem] w-72 bg-white/10 skew-x-[-18deg]" />
                <div className="relative z-10">
                    <div className="inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-sm font-medium mb-4">
                        Score Workspace
                    </div>
                    <h1 className="text-3xl font-bold">ข้อมูลรายวิชา</h1>
                    <p className="mt-2 text-emerald-50">
                        เลือกรายวิชา/Section เพื่อไปยังหน้าบันทึกคะแนน หรือหน้าตัดเกรด
                    </p>
                </div>
            </section>


            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
                    <div className="md:col-span-2 lg:col-span-1">
                        <label className="block text-xs font-medium text-slate-500 mb-1">ค้นหา</label>
                        <div className="relative">
                            <input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="พิมพ์..."
                                className="w-full rounded-xl border border-slate-200 pl-9 pr-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm"
                            />
                            <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">รายวิชา</label>
                        <select
                            value={subjectFilter}
                            onChange={(e) => setSubjectFilter(e.target.value)}
                            className="w-full rounded-xl border border-slate-200 px-2 py-2 outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50/50 text-sm"
                        >
                            <option value="all">ทั้งหมด</option>
                            {subjectOptions.map((opt) => (
                                <option key={opt.code} value={opt.code}>{opt.code} - {opt.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">ปีการศึกษา</label>
                        <select
                            value={yearFilter}
                            onChange={(e) => setYearFilter(e.target.value)}
                            className="w-full rounded-xl border border-slate-200 px-2 py-2 outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50/50 text-sm"
                        >
                            <option value="all">ทั้งหมด</option>
                            {years.map((y) => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">ภาคเรียน</label>
                        <select
                            value={semesterFilter}
                            onChange={(e) => setSemesterFilter(e.target.value)}
                            className="w-full rounded-xl border border-slate-200 px-2 py-2 outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50/50 text-sm"
                        >
                            <option value="all">ทั้งหมด</option>
                            {semesters.map((s) => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">ระดับชั้น</label>
                        <select
                            value={levelFilter}
                            onChange={(e) => setLevelFilter(e.target.value)}
                            className="w-full rounded-xl border border-slate-200 px-2 py-2 outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50/50 text-sm"
                        >
                            <option value="all">ทั้งหมด</option>
                            {levels.map((l) => (
                                <option key={l} value={l}>
                                    {l}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">ห้อง</label>
                        <select
                            value={classroomFilter}
                            onChange={(e) => setClassroomFilter(e.target.value)}
                            className="w-full rounded-xl border border-slate-200 px-2 py-2 outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50/50 text-sm"
                        >
                            <option value="all">ทั้งหมด</option>
                            {classrooms.map((c) => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                    </div>
                </div>

            </section>

            {error && (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
                    {error}
                </div>
            )}

            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                    <div>
                        <h2 className="font-bold text-slate-800">รายการรายวิชา / Section</h2>
                        <p className="text-sm text-slate-500">จำนวน {filteredSubjects.length} รายการ</p>
                    </div>
                    {(search || yearFilter !== "all" || semesterFilter !== "all" || levelFilter !== "all" || classroomFilter !== "all" || subjectFilter !== "all") && (
                        <button
                            onClick={() => {
                                setSearch("");
                                setYearFilter("all");
                                setSemesterFilter("all");
                                setLevelFilter("all");
                                setClassroomFilter("all");
                                setSubjectFilter("all");
                            }}
                            className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                        >
                            ล้างตัวกรอง
                        </button>
                    )}
                </div>

                {loading ? (
                    <div className="p-10 text-center text-slate-500">กำลังโหลดรายการวิชาที่สอน...</div>
                ) : filteredSubjects.length === 0 ? (
                    <div className="p-10 text-center text-slate-500">
                        {subjects.length === 0 ? "ยังไม่มีรายวิชาที่สอน" : "ไม่พบรายการตามตัวกรองที่เลือก"}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 p-4">
                        {filteredSubjects.map((s) => (
                            <div
                                key={s.id}
                                className="rounded-2xl border border-slate-200 p-5 bg-gradient-to-b from-white to-slate-50/60 hover:shadow-md hover:border-emerald-200 transition-all"
                            >
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div>
                                        <div className="inline-flex items-center rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-mono text-slate-600">
                                            {s?.subjects?.subject_code || "-"}
                                        </div>
                                        <h3 className="mt-2 text-lg font-bold text-slate-800">
                                            {s?.subjects?.name || "ไม่ระบุชื่อรายวิชา"}
                                        </h3>
                                    </div>

                                </div>

                                <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
                                    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                                        <div className="text-xs text-slate-500">Section ID</div>
                                        <div className="text-sm font-semibold text-slate-700">{s.id}</div>
                                    </div>
                                    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                                        <div className="text-xs text-slate-500">ชั้น / ห้อง</div>
                                        <div className="text-sm font-semibold text-slate-700">
                                            {s.class_level || "-"} / {s.classroom?.split('/').pop() || s.classroom || "-"}
                                        </div>
                                    </div>
                                    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                                        <div className="text-xs text-slate-500">ภาคเรียน</div>
                                        <div className="text-sm font-semibold text-slate-700">
                                            {s.year || "-"} / {s.semester || "-"}
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-4 flex flex-col sm:flex-row gap-2">
                                    <Link
                                        href={`/teacher/score_input?section_id=${s.id}`}
                                        className="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-emerald-700 transition-colors"
                                    >
                                        บันทึกคะแนน
                                    </Link>
                                    <Link
                                        href={`/teacher/grade_cut?section_id=${s.id}`}
                                        className="flex-1 rounded-xl bg-indigo-600 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
                                    >
                                        ตัดเกรด
                                    </Link>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}
