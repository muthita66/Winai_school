"use client";

import { useState, useEffect } from "react";
import { StudentApiService } from "@/services/student-api.service";
import toast from "react-hot-toast";
import { getAcademicSemesterDefault, getAcademicYearOptionsForStudent, getCurrentAcademicYearBE } from "@/features/student/academic-term";

interface EvaluationFeatureProps {
    session: any;
}

export function EvaluationFeature({ session }: EvaluationFeatureProps) {
    const student = session;

    // Select state
    const [year, setYear] = useState<number>(getCurrentAcademicYearBE());
    const [semester, setSemester] = useState<number>(getAcademicSemesterDefault());
    const yearOptions = getAcademicYearOptionsForStudent(session.class_level, year);

    // Data state
    const [registeredSubjects, setRegisteredSubjects] = useState<any[]>([]);
    const [selectedSection, setSelectedSection] = useState<any | null>(null);
    const [topics, setTopics] = useState<string[]>([]);
    const [evalStatus, setEvalStatus] = useState<boolean>(false);

    const [isLoadingInit, setIsLoadingInit] = useState(true);
    const [isLoadingTopics, setIsLoadingTopics] = useState(false);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form state
    const [scores, setScores] = useState<Record<string, number>>({});
    const [feedback, setFeedback] = useState("");

    // Initialize
    useEffect(() => {
        const initData = async () => {
            setIsLoadingInit(true);
            try {
                // Fetch registered subjects for dropdown
                const regs = await StudentApiService.getRegistered(year, semester);

                // Deduplicate by subject_code to prevent duplicate dropdown entries
                const uniqueRegs: any[] = [];
                const seenSubjectCodes = new Set();
                if (regs && Array.isArray(regs)) {
                    regs.forEach(r => {
                        if (r.subject_code && !seenSubjectCodes.has(r.subject_code)) {
                            seenSubjectCodes.add(r.subject_code);
                            uniqueRegs.push(r);
                        }
                    });
                }
                setRegisteredSubjects(uniqueRegs);

                // Fetch evaluation topics
                await fetchTopics();
                setFetchError(null);
            } catch (err: any) {
                console.error("Failed to load initial evaluation data", err);
                setFetchError(err.message || "เกิดข้อผิดพลาดในการโหลดข้อมูลแบบประเมิน");
                setRegisteredSubjects([]);
            } finally {
                setIsLoadingInit(false);
            }
        };
        initData();
    }, [year, semester]);
    const fetchTopics = async () => {
        setIsLoadingTopics(true);
        try {
            const result = await StudentApiService.getEvaluationTopics(year, semester);
            if (result && Array.isArray(result)) {
                const topicNames = result.map(t => t.name).filter(n => n && n.trim().length > 0);
                setTopics(topicNames);

                // Initialize score state
                const initScores: Record<string, number> = {};
                topicNames.forEach(t => initScores[t] = 0);
                setScores(initScores);
            }
        } catch (error) {
            console.error("Failed to load topics", error);
        } finally {
            setIsLoadingTopics(false);
        }
    };

    const handleSubjectChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
        const sectionId = parseInt(e.target.value);
        if (!sectionId) {
            setSelectedSection(null);
            setEvalStatus(false);
            return;
        }

        const subject = registeredSubjects.find(s => s.section_id === sectionId);
        setSelectedSection(subject || null);

        // Reset scores
        const initScores: Record<string, number> = {};
        topics.forEach(t => initScores[t] = 0);
        setScores(initScores);
        setFeedback("");

        // Check if already evaluated
        if (subject) {
            try {
                const results = await StudentApiService.getEvaluationStatus(year, semester, sectionId);
                setEvalStatus(results && results.length > 0);
            } catch (err) {
                console.error("Failed to load evaluation status", err);
            }
        }
    };

    const handleScoreChange = (topicName: string, value: number) => {
        setScores(prev => ({
            ...prev,
            [topicName]: value
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!selectedSection) {
            toast.error("กรุณาเลือกวิชาก่อนส่งประเมิน");
            return;
        }

        if (topics.length === 0) {
            toast.error("ไม่พบข้อคำถามในการประเมิน");
            return;
        }

        // Validate all questions answered
        const unanswered = topics.filter(t => scores[t] === 0);
        if (unanswered.length > 0) {
            toast.error("กรุณาตอบแบบประเมินให้ครบทุกข้อ");
            return;
        }

        setIsSubmitting(true);
        try {
            const dataToSubmit = topics.map(t => ({
                name: t,
                score: scores[t]
            }));

            await StudentApiService.submitEvaluation(
                dataToSubmit,
                year,
                semester,
                selectedSection.section_id,
                feedback
            );

            toast.success("ส่งแบบประเมินสำเร็จ ขอบคุณสำหรับความร่วมมือ");
            setEvalStatus(true);

            // Note: Old logic didn't clear the form on success, it just updated status
            // We'll reset the score inputs if necessary but keeping them is fine too if status shows "done"

        } catch (error) {
            console.error("Failed to submit evaluation", error);
            toast.error("เกิดข้อผิดพลาดในการบันทึก กรุณาลองใหม่");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoadingInit) {
        return (
            <div className="bg-white rounded-2xl p-12 shadow-sm border border-slate-200 flex flex-col items-center justify-center text-slate-500">
                <svg className="w-8 h-8 animate-spin text-teal-600 mb-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p>กำลังเตรียมข้อมูลประเมิน...</p>
            </div>
        );
    }

    if (fetchError) {
        return (
            <div className="bg-white rounded-2xl p-12 shadow-sm border border-slate-200 flex flex-col items-center justify-center text-red-500">
                <p>{fetchError}</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Hero Section */}
            <section className="bg-gradient-to-br from-teal-600 to-emerald-800 rounded-3xl p-8 text-white shadow-lg relative overflow-hidden">
                <div className="relative z-10 flex flex-col md:flex-row md:justify-between md:items-start gap-6">
                    <div>
                        <div className="inline-block bg-white/20 px-3 py-1 rounded-full text-sm font-medium mb-4 backdrop-blur-sm border border-white/20">
                            Evaluation
                        </div>
                        <h1 className="text-3xl font-bold mb-2">แบบประเมินประสิทธิภาพการสอน</h1>
                        <p className="text-teal-100">
                            ช่วยกันพัฒนาคุณภาพการเรียนการสอนด้วยคะแนนประเมิน
                        </p>
                    </div>

                    <div className="bg-white/10 backdrop-blur-md rounded-2xl p-5 border border-white/20 min-w-[200px]">
                        <div className="text-teal-100 text-sm font-medium mb-2">สถานะ</div>
                        {evalStatus ? (
                            <div className="text-xl font-bold text-white flex items-center gap-2">
                                <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                ประเมินแล้ว
                            </div>
                        ) : (
                            <div className="text-xl font-bold text-yellow-300 flex items-center gap-2">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                รอการประเมิน
                            </div>
                        )}
                    </div>
                </div>

                {/* Decoration */}
                <div className="absolute top-0 right-0 w-64 h-full bg-white opacity-5 transform -skew-x-12 translate-x-20"></div>
                <div className="absolute -bottom-12 -right-12 w-48 h-48 bg-emerald-500 rounded-full blur-2xl opacity-50"></div>
                <svg className="absolute top-1/2 right-1/4 transform -translate-y-1/2 w-48 h-48 text-white/5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            </section>

            {/* Selection Section */}
            <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-teal-50 text-teal-600 rounded-lg">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-800">เลือกปี/เทอมและรายวิชา</h3>
                        <p className="text-slate-500 text-sm">ข้อมูลลงทะเบียน</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">ปีการศึกษา</label>
                        <select
                            value={year}
                            onChange={(e) => {
                                setYear(parseInt(e.target.value));
                            }}
                            className="w-full border border-slate-300 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-slate-50 appearance-none"
                            style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: `right 0.5rem center`, backgroundRepeat: `no-repeat`, backgroundSize: `1.5em 1.5em` }}
                        >
                            {yearOptions.map((y) => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">ภาคเรียน</label>
                        <select
                            value={semester}
                            onChange={(e) => {
                                setSemester(parseInt(e.target.value));
                            }}
                            className="w-full border border-slate-300 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-slate-50 appearance-none"
                            style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: `right 0.5rem center`, backgroundRepeat: `no-repeat`, backgroundSize: `1.5em 1.5em` }}
                        >
                            <option value={1}>1</option>
                            <option value={2}>2</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">วิชาที่ลงทะเบียนเรียน</label>
                        <select
                            value={selectedSection?.section_id || ""}
                            onChange={handleSubjectChange}
                            className="w-full border border-slate-300 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-slate-50 appearance-none"
                            style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: `right 0.5rem center`, backgroundRepeat: `no-repeat`, backgroundSize: `1.5em 1.5em` }}
                        >
                            <option value="" disabled>-- กรุณาเลือกวิชา --</option>
                            {registeredSubjects.map(sub => (
                                <option key={sub.section_id} value={sub.section_id}>
                                    {sub.subject_code} - {sub.subject_name}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </section>

            {/* Teacher Info */}
            <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-800">ข้อมูลผู้สอน</h3>
                        <p className="text-slate-500 text-sm">รายละเอียดรายวิชา</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl border border-slate-100 bg-slate-50 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                        </div>
                        <div>
                            <div className="text-slate-500 text-sm font-medium">อาจารย์ผู้สอน</div>
                            <div className="text-lg font-bold text-slate-800">{selectedSection?.teacher_name || "กรุณาเลือกวิชา"}</div>
                        </div>
                    </div>
                    <div className="p-4 rounded-xl border border-slate-100 bg-slate-50 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                        </div>
                        <div>
                            <div className="text-slate-500 text-sm font-medium">รายวิชา</div>
                            <div className="text-lg font-bold text-slate-800">{selectedSection?.subject_name || "-"}</div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Evaluation Form */}
            <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-800">รายการประเมิน</h3>
                        <p className="text-slate-500 text-sm">ตอบแบบประเมิน - 5: ดีมาก, 4: ดี, 3: ปานกลาง, 2: พอใช้, 1: ปรับปรุง</p>
                    </div>
                </div>

                {isLoadingTopics ? (
                    <div className="text-center py-12 text-slate-500">
                        <svg className="w-8 h-8 animate-spin mx-auto text-indigo-500 mb-4" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        กำลังโหลดหัวข้อประเมิน...
                    </div>
                ) : (
                    <form onSubmit={handleSubmit}>
                        <div className="overflow-x-auto rounded-xl border border-slate-200 mb-6">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-slate-500 bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        <th className="px-6 py-4 font-medium w-1/2 min-w-[300px]">หัวข้อประเมิน</th>
                                        <th className="px-3 py-4 font-medium text-center">5<br /><span className="text-[10px] text-slate-400">ดีมาก</span></th>
                                        <th className="px-3 py-4 font-medium text-center">4<br /><span className="text-[10px] text-slate-400">ดี</span></th>
                                        <th className="px-3 py-4 font-medium text-center">3<br /><span className="text-[10px] text-slate-400">ปานกลาง</span></th>
                                        <th className="px-3 py-4 font-medium text-center">2<br /><span className="text-[10px] text-slate-400">พอใช้</span></th>
                                        <th className="px-3 py-4 font-medium text-center">1<br /><span className="text-[10px] text-slate-400">ปรับปรุง</span></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {topics.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                                                ยังไม่มีหัวข้อประเมินการสอน
                                            </td>
                                        </tr>
                                    ) : (
                                        topics.map((topic, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-6 py-4 font-medium text-slate-700">
                                                    {idx + 1}. {topic}
                                                </td>
                                                {[5, 4, 3, 2, 1].map(val => (
                                                    <td key={val} className="px-3 py-4 text-center">
                                                        <label className="flex justify-center items-center w-full h-full cursor-pointer group">
                                                            <input
                                                                type="radio"
                                                                name={`topic-${idx}`}
                                                                value={val}
                                                                checked={scores[topic] === val}
                                                                onChange={() => handleScoreChange(topic, val)}
                                                                className="w-5 h-5 text-teal-600 bg-slate-100 border-slate-300 focus:ring-teal-500 cursor-pointer"
                                                                required
                                                            />
                                                        </label>
                                                    </td>
                                                ))}
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <div className="mb-6">
                            <label className="block text-sm font-medium text-slate-700 mb-2">ข้อเสนอแนะเพิ่มเติม (ถ้ามี)</label>
                            <textarea
                                value={feedback}
                                onChange={(e) => setFeedback(e.target.value)}
                                rows={4}
                                className="w-full border border-slate-300 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-slate-50"
                                placeholder="พิมพ์ข้อเสนอแนะของคุณ..."
                            ></textarea>
                        </div>

                        <div className="flex justify-end pt-4 border-t border-slate-100">
                            <button
                                type="submit"
                                disabled={isSubmitting || !selectedSection || topics.length === 0}
                                className={`px-6 py-3 rounded-xl font-medium transition-colors flex items-center gap-2
                                    ${(isSubmitting || !selectedSection || topics.length === 0)
                                        ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                                        : "bg-teal-600 text-white hover:bg-teal-700"}`}
                            >
                                {isSubmitting ? (
                                    <>
                                        <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        กำลังบันทึก...
                                    </>
                                ) : "ส่งแบบประเมิน"}
                            </button>
                        </div>
                    </form>
                )}
            </section>
        </div>
    );
}
