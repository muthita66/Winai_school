"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { TeacherApiService } from "@/services/teacher-api.service";

function toNum(v: any) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
}

export function ScoreInputFeature({ session }: { session: any }) {
    const searchParams = useSearchParams();
    const sectionId = Number(searchParams.get("section_id"));
    const hasValidSectionId = Number.isFinite(sectionId) && sectionId > 0;

    const [sectionInfo, setSectionInfo] = useState<any | null>(null);
    const [headers, setHeaders] = useState<any[]>([]);
    const [students, setStudents] = useState<any[]>([]);
    const [selectedHeaderId, setSelectedHeaderId] = useState<number | null>(null);
    const [scoreMap, setScoreMap] = useState<Record<number, string>>({});
    const [originalScoreMap, setOriginalScoreMap] = useState<Record<number, string>>({});
    const [loading, setLoading] = useState(true);
    const [scoreLoading, setScoreLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [studentSearch, setStudentSearch] = useState("");

    const [newHeaderTitle, setNewHeaderTitle] = useState("");
    const [newHeaderMax, setNewHeaderMax] = useState(100);
    const [addingHeader, setAddingHeader] = useState(false);

    const [editHeaderTitle, setEditHeaderTitle] = useState("");
    const [editHeaderMax, setEditHeaderMax] = useState(100);
    const [updatingHeader, setUpdatingHeader] = useState(false);

    const [pickerSections, setPickerSections] = useState<any[]>([]);
    const [pickerLoading, setPickerLoading] = useState(false);
    const [pickerError, setPickerError] = useState<string | null>(null);
    const [pickerSearch, setPickerSearch] = useState("");
    const [pickerYearFilter, setPickerYearFilter] = useState("all");
    const [pickerSemesterFilter, setPickerSemesterFilter] = useState("all");

    const activeHeader = headers.find((h) => h.id === selectedHeaderId) || null;
    const activeMax = toNum(activeHeader?.max_score);

    const filteredStudents = students.filter((s) => {
        if (!studentSearch.trim()) return true;
        const q = studentSearch.trim().toLowerCase();
        return [s.student_code, s.first_name, s.last_name].some((v) =>
            String(v ?? "").toLowerCase().includes(q)
        );
    });

    const filledCount = students.filter((s) => {
        const raw = scoreMap[s.id];
        return raw != null && raw !== "";
    }).length;

    const invalidCount = students.filter((s) => {
        const raw = scoreMap[s.id];
        if (raw == null || raw === "") return false;
        const n = Number(raw);
        return !Number.isFinite(n) || n < 0 || (activeMax > 0 && n > activeMax);
    }).length;

    const changedCount = students.filter((s) => (scoreMap[s.id] ?? "") !== (originalScoreMap[s.id] ?? "")).length;

    const totalHeaderMax = headers.reduce((sum, h) => sum + toNum(h.max_score), 0);

    const pickerYears = Array.from(
        new Set(pickerSections.map((s) => String(s?.year ?? "")).filter(Boolean))
    ).sort((a, b) => Number(b) - Number(a));

    const pickerSemesters = Array.from(
        new Set(pickerSections.map((s) => String(s?.semester ?? "")).filter(Boolean))
    ).sort((a, b) => Number(a) - Number(b));

    const filteredPickerSections = pickerSections.filter((s) => {
        if (pickerYearFilter !== "all" && String(s?.year ?? "") !== pickerYearFilter) return false;
        if (pickerSemesterFilter !== "all" && String(s?.semester ?? "") !== pickerSemesterFilter) return false;
        if (!pickerSearch.trim()) return true;
        const q = pickerSearch.trim().toLowerCase();
        return [s?.subjects?.subject_code, s?.subjects?.name, s?.class_level, s?.classroom, s?.room]
            .map((v) => String(v ?? "").toLowerCase())
            .join(" ")
            .includes(q);
    });

    const loadBaseData = async () => {
        if (!hasValidSectionId) return;
        setLoading(true);
        setError(null);
        try {
            const [sections, headerRows, studentRows] = await Promise.all([
                TeacherApiService.getTeacherSubjects(session.id),
                TeacherApiService.getScoreHeaders(sectionId),
                TeacherApiService.getSectionStudents(sectionId),
            ]);

            const nextHeaders = Array.isArray(headerRows) ? headerRows : [];
            const nextStudents = Array.isArray(studentRows) ? studentRows : [];
            const nextSections = Array.isArray(sections) ? sections : [];

            setSectionInfo(nextSections.find((s: any) => s.id === sectionId) || null);
            setHeaders(nextHeaders);
            setStudents(nextStudents);
            setSelectedHeaderId((prev) => {
                if (prev && nextHeaders.some((h: any) => h.id === prev)) return prev;
                return nextHeaders[0]?.id ?? null;
            });
        } catch {
            setError("ไม่สามารถโหลดข้อมูลหน้าบันทึกคะแนนได้");
            setHeaders([]);
            setStudents([]);
        } finally {
            setLoading(false);
        }
    };

    const loadScores = async (headerId: number) => {
        setScoreLoading(true);
        try {
            const rows = await TeacherApiService.getScores(headerId);
            const map: Record<number, string> = {};
            (rows || []).forEach((r: any) => {
                if (r?.student_id) map[r.student_id] = r.score == null ? "" : String(r.score);
            });
            setScoreMap(map);
            setOriginalScoreMap(map);
        } catch {
            setError("ไม่สามารถโหลดคะแนนของหัวข้อที่เลือกได้");
            setScoreMap({});
            setOriginalScoreMap({});
        } finally {
            setScoreLoading(false);
        }
    };

    useEffect(() => {
        if (hasValidSectionId) return;

        let active = true;
        (async () => {
            setPickerLoading(true);
            setPickerError(null);
            try {
                const data = await TeacherApiService.getTeacherSubjects(session.id);
                if (!active) return;
                setPickerSections(Array.isArray(data) ? data : []);
            } catch {
                if (!active) return;
                setPickerSections([]);
                setPickerError("ไม่สามารถโหลดรายการ Section สำหรับบันทึกคะแนนได้");
            } finally {
                if (active) setPickerLoading(false);
            }
        })();

        return () => {
            active = false;
        };
    }, [hasValidSectionId, session.id]);

    useEffect(() => {
        if (!hasValidSectionId) return;
        loadBaseData();
    }, [hasValidSectionId, sectionId, session.id]);

    useEffect(() => {
        if (!selectedHeaderId) {
            setScoreMap({});
            setOriginalScoreMap({});
            return;
        }
        loadScores(selectedHeaderId);
    }, [selectedHeaderId]);

    useEffect(() => {
        if (!activeHeader) {
            setEditHeaderTitle("");
            setEditHeaderMax(100);
            return;
        }
        setEditHeaderTitle(String(activeHeader.title || ""));
        setEditHeaderMax(toNum(activeHeader.max_score) || 100);
    }, [activeHeader?.id, activeHeader?.title, activeHeader?.max_score]);

    const handleAddHeader = async () => {
        const title = newHeaderTitle.trim();
        if (!title) return alert("กรุณากรอกชื่อหัวข้อคะแนน");
        if (toNum(newHeaderMax) <= 0) return alert("คะแนนเต็มต้องมากกว่า 0");

        setAddingHeader(true);
        try {
            const created = await TeacherApiService.addScoreHeader(sectionId, title, toNum(newHeaderMax));
            setNewHeaderTitle("");
            setNewHeaderMax(100);
            await loadBaseData();
            if (created?.id) setSelectedHeaderId(created.id);
        } catch {
            alert("เพิ่มหัวข้อคะแนนไม่สำเร็จ");
        } finally {
            setAddingHeader(false);
        }
    };

    const handleUpdateHeader = async () => {
        if (!activeHeader) return;
        const title = editHeaderTitle.trim();
        const max = toNum(editHeaderMax);
        if (!title) return alert("กรุณากรอกชื่อหัวข้อคะแนน");
        if (max <= 0) return alert("คะแนนเต็มต้องมากกว่า 0");

        setUpdatingHeader(true);
        try {
            await TeacherApiService.updateScoreHeader(activeHeader.id, title, max);
            await loadBaseData();
        } catch {
            alert("แก้ไขหัวข้อคะแนนไม่สำเร็จ");
        } finally {
            setUpdatingHeader(false);
        }
    };

    const handleDeleteHeader = async (id: number) => {
        const target = headers.find((h) => h.id === id);
        if (!confirm(`ลบหัวข้อคะแนน \"${target?.title || "รายการนี้"}\" ?`)) return;

        try {
            await TeacherApiService.deleteScoreHeader(id);
            if (selectedHeaderId === id) setSelectedHeaderId(null);
            await loadBaseData();
        } catch {
            alert("ลบหัวข้อคะแนนไม่สำเร็จ");
        }
    };

    const handleSaveScores = async () => {
        if (!activeHeader) return;
        if (invalidCount > 0) return alert("มีคะแนนไม่ถูกต้อง กรุณาตรวจสอบก่อนบันทึก");

        setSaving(true);
        try {
            await TeacherApiService.saveScores(
                activeHeader.id,
                students.map((s) => {
                    const raw = scoreMap[s.id];
                    const n = raw == null || raw === "" ? 0 : Number(raw);
                    return {
                        student_id: s.id,
                        score: activeMax > 0 ? Math.max(0, Math.min(activeMax, toNum(n))) : Math.max(0, toNum(n)),
                    };
                })
            );
            setOriginalScoreMap({ ...scoreMap });
            alert("บันทึกคะแนนเรียบร้อย");
        } catch {
            alert("บันทึกคะแนนไม่สำเร็จ");
        } finally {
            setSaving(false);
        }
    };

    const validFilledCount = students.filter((s) => {
        const raw = scoreMap[s.id];
        if (raw == null || raw === "") return false;
        const n = Number(raw);
        return Number.isFinite(n) && n >= 0 && (activeMax <= 0 || n <= activeMax);
    }).length;

    const fillPercent = students.length ? Math.round((filledCount / students.length) * 100) : 0;
    const readyPercent = students.length ? Math.round((validFilledCount / students.length) * 100) : 0;

    const handleFillEmptyWithZero = () => {
        if (!activeHeader) return;
        setScoreMap((prev) => {
            const next = { ...prev };
            students.forEach((s) => {
                if ((next[s.id] ?? "") === "") next[s.id] = "0";
            });
            return next;
        });
    };

    const handleRestoreFromSaved = () => {
        setScoreMap({ ...originalScoreMap });
    };

    if (!hasValidSectionId) {
        return (
            <div className="space-y-6">
                <section className="rounded-3xl bg-gradient-to-br from-amber-500 via-orange-500 to-red-500 p-8 text-white shadow-lg relative overflow-hidden">
                    <div className="absolute inset-y-0 right-[-4rem] w-80 bg-white/10 skew-x-[-18deg]" />
                    <div className="relative z-10">
                        <div className="inline-flex rounded-full bg-white/20 px-3 py-1 text-sm font-semibold">
                            Score Input Console
                        </div>
                        <h1 className="mt-4 text-3xl font-bold">ศูนย์บันทึกคะแนน</h1>
                        <p className="mt-2 text-orange-50">
                            เลือก Section เพื่อเข้าหน้าแก้ไขคะแนนแบบตาราง และจัดการหัวข้อคะแนนโดยตรง
                        </p>
                        <div className="mt-4 flex flex-wrap gap-2 text-sm">
                            <span className="rounded-full bg-white/15 px-3 py-1">โหมดนี้เน้นการกรอกคะแนน</span>
                            <Link href="/teacher/scores" className="rounded-full bg-white px-3 py-1 font-medium text-orange-700 hover:bg-orange-50">
                                ไปหน้าข้อมูลคะแนน (หน้าเลือกงาน)
                            </Link>
                        </div>
                    </div>
                </section>

                <section className="grid grid-cols-1 xl:grid-cols-[360px_minmax(0,1fr)] gap-6">
                    <div className="space-y-6">
                        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                            <h2 className="font-bold text-slate-800">ขั้นตอนใช้งานบันทึกคะแนน</h2>
                            <div className="mt-4 space-y-3">
                                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                                    <div className="text-xs font-semibold text-amber-700">1. เลือก Section</div>
                                    <div className="mt-1 text-sm text-slate-700">เลือกห้องเรียน/วิชาที่ต้องการกรอกคะแนน</div>
                                </div>
                                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                    <div className="text-xs font-semibold text-slate-700">2. สร้างหัวข้อคะแนน</div>
                                    <div className="mt-1 text-sm text-slate-700">เช่น งาน, สอบย่อย, กลางภาค, ปลายภาค</div>
                                </div>
                                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                    <div className="text-xs font-semibold text-slate-700">3. กรอกคะแนนและบันทึก</div>
                                    <div className="mt-1 text-sm text-slate-700">ใช้ตารางกรอกคะแนนและแถบบันทึกด้านล่าง</div>
                                </div>
                            </div>
                        </section>

                        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                            <h2 className="font-bold text-slate-800">ตัวกรอง Section</h2>
                            <div className="mt-4 space-y-3">
                                <input
                                    value={pickerSearch}
                                    onChange={(e) => setPickerSearch(e.target.value)}
                                    placeholder="ค้นหารหัสวิชา / ชื่อวิชา / ชั้น"
                                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 outline-none focus:ring-2 focus:ring-amber-500"
                                />
                                <div className="grid grid-cols-2 gap-3">
                                    <select
                                        value={pickerYearFilter}
                                        onChange={(e) => setPickerYearFilter(e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 px-4 py-2.5 outline-none focus:ring-2 focus:ring-amber-500"
                                    >
                                        <option value="all">ทุกปีการศึกษา</option>
                                        {pickerYears.map((y) => (
                                            <option key={y} value={y}>{y}</option>
                                        ))}
                                    </select>
                                    <select
                                        value={pickerSemesterFilter}
                                        onChange={(e) => setPickerSemesterFilter(e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 px-4 py-2.5 outline-none focus:ring-2 focus:ring-amber-500"
                                    >
                                        <option value="all">ทุกภาคเรียน</option>
                                        {pickerSemesters.map((s) => (
                                            <option key={s} value={s}>ภาค {s}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="mt-4 grid grid-cols-2 gap-3">
                                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                    <div className="text-xs text-slate-500">Section ทั้งหมด</div>
                                    <div className="mt-1 text-xl font-bold text-slate-800">{pickerSections.length}</div>
                                </div>
                                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                    <div className="text-xs text-slate-500">ตรงตัวกรอง</div>
                                    <div className="mt-1 text-xl font-bold text-slate-800">{filteredPickerSections.length}</div>
                                </div>
                            </div>
                        </section>
                    </div>

                    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                        <div className="border-b border-slate-200 px-5 py-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                            <div>
                                <h2 className="font-bold text-slate-800">เลือก Section เพื่อเข้าหน้าแก้ไขคะแนน</h2>
                                <p className="text-sm text-slate-500">หน้านี้พาไปหน้า editor โดยตรง ไม่ใช่หน้า overview</p>
                            </div>
                            <Link href="/teacher/scores" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                                เปิดหน้าข้อมูลคะแนน
                            </Link>
                        </div>

                        {pickerError && (
                            <div className="m-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                                {pickerError}
                            </div>
                        )}

                        {pickerLoading ? (
                            <div className="p-12 text-center text-slate-500">กำลังโหลดรายการ Section...</div>
                        ) : filteredPickerSections.length === 0 ? (
                            <div className="p-12 text-center text-slate-500">
                                {pickerSections.length === 0 ? "ยังไม่มี Section ที่สอน" : "ไม่พบรายการตามตัวกรอง"}
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100">
                                {filteredPickerSections.map((s) => (
                                    <div key={s.id} className="px-5 py-4 hover:bg-slate-50/70 transition-colors">
                                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                            <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-mono text-slate-700">
                                                        {s?.subjects?.subject_code || "-"}
                                                    </span>
                                                    <span className="rounded-lg border border-orange-200 bg-orange-50 px-2.5 py-1 text-xs font-semibold text-orange-700">
                                                        Section #{s.id}
                                                    </span>
                                                </div>
                                                <h3 className="mt-2 truncate text-base font-bold text-slate-900">
                                                    {s?.subjects?.name || "ไม่ระบุชื่อวิชา"}
                                                </h3>
                                                <p className="mt-1 text-sm text-slate-500">
                                                    ชั้น {s?.class_level || "-"} / ห้อง {s?.classroom || "-"} • ห้องเรียน {s?.room || "-"} • ปี {s?.year || "-"} ภาค {s?.semester || "-"}
                                                </p>
                                            </div>
                                            <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                                                <Link
                                                    href={`/teacher/score_input?section_id=${s.id}`}
                                                    className="rounded-xl bg-amber-500 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-amber-600"
                                                >
                                                    เริ่มบันทึกคะแนน
                                                </Link>
                                                <Link
                                                    href={`/teacher/grade_cut?section_id=${s.id}`}
                                                    className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-center text-sm font-semibold text-indigo-700 hover:bg-indigo-100"
                                                >
                                                    ไปหน้าตัดเกรด
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
        <div className="space-y-6 pb-24">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0">
                        <div className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                            Score Editor
                        </div>
                        <h1 className="mt-3 text-2xl font-bold text-slate-900">บันทึกคะแนน</h1>
                        <p className="mt-1 text-sm text-slate-500">
                            หน้าแก้ไขคะแนนแบบตารางสำหรับกรอกคะแนนรายนักเรียนและจัดการหัวข้อคะแนน
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2 text-sm">
                            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">Section #{sectionId}</span>
                            {sectionInfo?.subjects?.subject_code && (
                                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
                                    {sectionInfo.subjects.subject_code}
                                </span>
                            )}
                            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
                                {sectionInfo?.class_level || "-"}/{sectionInfo?.classroom || "-"}
                            </span>
                            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
                                ปี {sectionInfo?.year || "-"} ภาค {sectionInfo?.semester || "-"}
                            </span>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full xl:w-auto">
                        <Link href="/teacher/scores" className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-center text-slate-700 hover:bg-slate-50">
                            กลับหน้าข้อมูลคะแนน
                        </Link>
                        <Link href={`/teacher/grade_cut?section_id=${sectionId}`} className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-center text-white hover:bg-indigo-700">
                            ไปหน้าตัดเกรด
                        </Link>
                    </div>
                </div>
            </section>

            {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">{error}</div>}

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
                    <div>
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <h2 className="font-bold text-slate-800">สถานะการกรอกคะแนน</h2>
                                <p className="text-sm text-slate-500">เน้นการแก้ไขและบันทึกคะแนน ไม่ใช่หน้าเลือก Section</p>
                            </div>
                            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${invalidCount > 0 ? "border border-red-200 bg-red-50 text-red-700" : changedCount > 0 ? "border border-amber-200 bg-amber-50 text-amber-700" : "border border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
                                {invalidCount > 0 ? "ต้องตรวจสอบ" : changedCount > 0 ? "มีรายการค้างบันทึก" : "พร้อมบันทึก"}
                            </span>
                        </div>
                        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><div className="text-xs text-slate-500">นักเรียน</div><div className="mt-1 text-xl font-bold text-slate-800">{students.length}</div></div>
                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><div className="text-xs text-slate-500">หัวข้อคะแนน</div><div className="mt-1 text-xl font-bold text-slate-800">{headers.length}</div><div className="text-[11px] text-slate-500">เต็มรวม {totalHeaderMax}</div></div>
                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><div className="text-xs text-slate-500">กรอกแล้ว</div><div className="mt-1 text-xl font-bold text-slate-800">{activeHeader ? `${filledCount}/${students.length}` : "-"}</div><div className="text-[11px] text-slate-500">{fillPercent}%</div></div>
                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><div className="text-xs text-slate-500">พร้อมบันทึก</div><div className={`mt-1 text-xl font-bold ${invalidCount > 0 ? "text-red-600" : "text-emerald-700"}`}>{activeHeader ? validFilledCount : 0}</div><div className="text-[11px] text-slate-500">{readyPercent}% ถูกต้อง</div></div>
                        </div>
                    </div>
                    <div className="space-y-3">
                        <div>
                            <label className="mb-1 block text-xs font-medium text-slate-500">หัวข้อที่กำลังแก้ไข (เลือกสลับเร็ว)</label>
                            <select
                                value={selectedHeaderId ?? ""}
                                onChange={(e) => setSelectedHeaderId(e.target.value ? Number(e.target.value) : null)}
                                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                            >
                                <option value="">เลือกหัวข้อคะแนน</option>
                                {headers.map((h) => (
                                    <option key={h.id} value={h.id}>
                                        {h.title} (เต็ม {toNum(h.max_score)})
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <button onClick={handleFillEmptyWithZero} disabled={!activeHeader || scoreLoading || saving} className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50">
                                เติม 0 ให้ช่องว่าง
                            </button>
                            <button onClick={handleRestoreFromSaved} disabled={saving || changedCount === 0} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                                คืนค่าจากที่บันทึกล่าสุด
                            </button>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                            <div className="text-xs text-slate-500">หัวข้อที่เลือก</div>
                            <div className="mt-1 text-sm font-semibold text-slate-800">{activeHeader?.title || "ยังไม่ได้เลือกหัวข้อคะแนน"}</div>
                            <div className="mt-1 text-xs text-slate-500">{activeHeader ? `คะแนนเต็ม ${activeMax}` : "เลือกจากรายการเพื่อเริ่มกรอกคะแนน"}</div>
                        </div>
                    </div>
                </div>
            </section>

            <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_1fr] gap-6">
                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="font-bold text-slate-800">หัวข้อคะแนน</h2>
                            <p className="text-sm text-slate-500">สร้างและเลือกหัวข้อที่ต้องการกรอกคะแนน</p>
                        </div>
                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">{headers.length} รายการ</span>
                    </div>

                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-[1fr_120px_auto] gap-3 items-end">
                        <div>
                            <label className="block text-xs text-slate-500 font-medium mb-1">ชื่อหัวข้อใหม่</label>
                            <input value={newHeaderTitle} onChange={(e) => setNewHeaderTitle(e.target.value)} placeholder="เช่น สอบกลางภาค" className="w-full rounded-xl border border-slate-200 px-4 py-2.5 outline-none focus:ring-2 focus:ring-emerald-500" />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-500 font-medium mb-1">เต็ม</label>
                            <input type="number" min={1} value={newHeaderMax} onChange={(e) => setNewHeaderMax(Number(e.target.value))} className="w-full rounded-xl border border-slate-200 px-4 py-2.5 outline-none focus:ring-2 focus:ring-emerald-500" />
                        </div>
                        <button onClick={handleAddHeader} disabled={addingHeader} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">{addingHeader ? "กำลังเพิ่ม..." : "เพิ่ม"}</button>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-2">
                        {headers.map((h) => {
                            const active = selectedHeaderId === h.id;
                            return (
                                <div key={h.id} className={`flex items-center gap-1 rounded-xl border px-2 py-1 ${active ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white"}`}>
                                    <button onClick={() => setSelectedHeaderId(h.id)} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${active ? "text-emerald-700" : "text-slate-700 hover:bg-slate-50"}`}>
                                        {h.title} <span className="text-xs opacity-80">({toNum(h.max_score)})</span>
                                    </button>
                                    <button onClick={() => handleDeleteHeader(h.id)} className="rounded-md px-2 py-1 text-xs text-red-500 hover:bg-red-50">ลบ</button>
                                </div>
                            );
                        })}
                    </div>

                    {!loading && headers.length === 0 && (
                        <div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center text-slate-500">
                            ยังไม่มีหัวข้อคะแนน กรุณาเพิ่มหัวข้อก่อนเริ่มกรอกคะแนน
                        </div>
                    )}
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h2 className="font-bold text-slate-800">แก้ไขหัวข้อที่เลือก</h2>
                    <p className="mt-1 text-sm text-slate-500">ปรับชื่อหัวข้อและคะแนนเต็มของหัวข้อปัจจุบัน</p>

                    {!activeHeader ? (
                        <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500">
                            เลือกหัวข้อคะแนนจากรายการก่อน
                        </div>
                    ) : (
                        <div className="mt-4 space-y-4">
                            <div>
                                <label className="block text-xs text-slate-500 font-medium mb-1">ชื่อหัวข้อ</label>
                                <input value={editHeaderTitle} onChange={(e) => setEditHeaderTitle(e.target.value)} className="w-full rounded-xl border border-slate-200 px-4 py-2.5 outline-none focus:ring-2 focus:ring-emerald-500" />
                            </div>
                            <div>
                                <label className="block text-xs text-slate-500 font-medium mb-1">คะแนนเต็ม</label>
                                <input type="number" min={1} value={editHeaderMax} onChange={(e) => setEditHeaderMax(Number(e.target.value))} className="w-full rounded-xl border border-slate-200 px-4 py-2.5 outline-none focus:ring-2 focus:ring-emerald-500" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><div className="text-xs text-slate-500">กรอกแล้ว</div><div className="mt-1 text-lg font-bold text-slate-800">{filledCount}/{students.length}</div></div>
                                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><div className="text-xs text-slate-500">คะแนนเต็มหัวข้อ</div><div className="mt-1 text-lg font-bold text-slate-800">{activeMax}</div></div>
                            </div>
                            <button onClick={handleUpdateHeader} disabled={updatingHeader} className="w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50">{updatingHeader ? "กำลังบันทึก..." : "บันทึกการแก้ไขหัวข้อ"}</button>
                        </div>
                    )}
                </section>
            </div>

            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="border-b border-slate-200 px-5 py-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <h2 className="font-bold text-slate-800">กรอกคะแนนรายนักเรียน</h2>
                        <p className="text-sm text-slate-500">
                            {activeHeader ? `หัวข้อ: ${activeHeader.title} • คะแนนเต็ม ${activeMax}` : "เลือกหัวข้อคะแนนก่อนเริ่มกรอก"}
                        </p>
                    </div>
                    <input value={studentSearch} onChange={(e) => setStudentSearch(e.target.value)} placeholder="ค้นหานักเรียน" className="w-full lg:w-72 rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>

                {loading ? (
                    <div className="p-10 text-center text-slate-500">กำลังโหลดข้อมูล...</div>
                ) : students.length === 0 ? (
                    <div className="p-10 text-center text-slate-500">ไม่พบนักเรียนใน Section นี้</div>
                ) : !activeHeader ? (
                    <div className="p-10 text-center text-slate-500">กรุณาเลือกหัวข้อคะแนนก่อน</div>
                ) : scoreLoading ? (
                    <div className="p-10 text-center text-slate-500">กำลังโหลดคะแนนของหัวข้อที่เลือก...</div>
                ) : filteredStudents.length === 0 ? (
                    <div className="p-10 text-center text-slate-500">ไม่พบนักเรียนตามคำค้นหา</div>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[760px]">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200">
                                        <th className="px-5 py-3 text-left text-sm font-semibold text-slate-600">#</th>
                                        <th className="px-5 py-3 text-left text-sm font-semibold text-slate-600">รหัสนักเรียน</th>
                                        <th className="px-5 py-3 text-left text-sm font-semibold text-slate-600">ชื่อ-นามสกุล</th>
                                        <th className="px-5 py-3 text-center text-sm font-semibold text-slate-600">คะแนน</th>
                                        <th className="px-5 py-3 text-center text-sm font-semibold text-slate-600">% หัวข้อ</th>
                                        <th className="px-5 py-3 text-center text-sm font-semibold text-slate-600">สถานะ</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredStudents.map((s, i) => {
                                        const raw = scoreMap[s.id] ?? "";
                                        const originalRaw = originalScoreMap[s.id] ?? "";
                                        const n = raw === "" ? null : Number(raw);
                                        const invalid = raw !== "" && (!Number.isFinite(n) || (n as number) < 0 || (activeMax > 0 && (n as number) > activeMax));
                                        const pct = n != null && Number.isFinite(n) && activeMax > 0 ? Math.round((((n as number) / activeMax) * 100) * 100) / 100 : null;
                                        const changed = raw !== originalRaw;

                                        return (
                                            <tr
                                                key={s.id}
                                                className={`border-b border-slate-100 ${
                                                    invalid
                                                        ? "bg-red-50/40"
                                                        : changed
                                                          ? "bg-amber-50/30"
                                                          : "hover:bg-slate-50/80"
                                                }`}
                                            >
                                                <td className="px-5 py-3 text-sm text-slate-500">{i + 1}</td>
                                                <td className="px-5 py-3 text-sm font-mono text-slate-700">{s.student_code}</td>
                                                <td className="px-5 py-3 text-sm font-medium text-slate-800">{s.first_name} {s.last_name}</td>
                                                <td className="px-5 py-3 text-center">
                                                    <input
                                                        type="number"
                                                        min={0}
                                                        max={activeMax || undefined}
                                                        value={raw}
                                                        onChange={(e) => setScoreMap((prev) => ({ ...prev, [s.id]: e.target.value }))}
                                                        className={`w-24 rounded-lg border px-3 py-1.5 text-center outline-none focus:ring-2 ${
                                                            invalid
                                                                ? "border-red-300 bg-red-50 text-red-700 focus:ring-red-400"
                                                                : changed
                                                                  ? "border-amber-300 bg-amber-50 text-amber-800 focus:ring-amber-400"
                                                                  : "border-slate-200 focus:ring-emerald-500"
                                                        }`}
                                                    />
                                                </td>
                                                <td className="px-5 py-3 text-center text-sm text-slate-700">{pct == null ? "-" : `${pct}%`}</td>
                                                <td className="px-5 py-3 text-center">
                                                    {invalid ? (
                                                        <span className="rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">ไม่ถูกต้อง</span>
                                                    ) : raw === "" ? (
                                                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">ยังไม่กรอก</span>
                                                    ) : changed ? (
                                                        <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">แก้ไขแล้ว</span>
                                                    ) : (
                                                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">บันทึกแล้ว</span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        <div className="border-t border-slate-200 px-5 py-4 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                            <div className="text-sm text-slate-500">
                                แสดง {filteredStudents.length}/{students.length} คน • เปลี่ยนแปลง {changedCount} รายการ
                                {invalidCount > 0 && <span className="ml-2 text-red-600">• มีข้อมูลผิด {invalidCount} รายการ</span>}
                            </div>
                            <div className="text-xs text-slate-500">
                                ใช้แถบบันทึกด้านล่างเพื่อบันทึกหรือยกเลิกการแก้ไข
                            </div>
                        </div>
                    </>
                )}
            </section>

            <section className="sticky bottom-4 z-20">
                <div className="rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 shadow-lg backdrop-blur">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="min-w-0">
                            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Save Bar</div>
                            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                                <span className="text-slate-700">
                                    หัวข้อ: <span className="font-semibold">{activeHeader?.title || "-"}</span>
                                </span>
                                <span className={changedCount > 0 ? "text-amber-700" : "text-slate-600"}>
                                    เปลี่ยนแปลง {activeHeader ? changedCount : 0} รายการ
                                </span>
                                <span className={invalidCount > 0 ? "text-red-700" : "text-slate-600"}>
                                    ข้อมูลผิด {invalidCount}
                                </span>
                                <span className="text-slate-600">
                                    พร้อมบันทึก {activeHeader ? validFilledCount : 0}/{students.length || 0}
                                </span>
                            </div>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2">
                            <button
                                onClick={handleRestoreFromSaved}
                                disabled={saving || changedCount === 0}
                                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                            >
                                ยกเลิกการแก้ไข
                            </button>
                            <button
                                onClick={handleSaveScores}
                                disabled={saving || invalidCount > 0 || !activeHeader}
                                className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                            >
                                {saving ? "กำลังบันทึก..." : "บันทึกคะแนน"}
                            </button>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}
