"use client";

import { useState, useEffect } from "react";
import { StudentApiService } from "@/services/student-api.service";
import toast from "react-hot-toast";
import { Skeleton } from "@/components/Skeleton";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface HealthFeatureProps {
    session: any;
}

export function HealthFeature({ session }: HealthFeatureProps) {
    const student = session;

    const queryClient = useQueryClient();
    const [isEditing, setIsEditing] = useState(false);

    // Query
    const healthQuery = useQuery({
        queryKey: ["student", "health"],
        queryFn: () => StudentApiService.getHealth(),
    });

    // Mutation
    const updateHealthMutation = useMutation({
        mutationFn: (data: any) => StudentApiService.updateHealth(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["student", "health"] });
            setIsEditing(false);
            toast.success("อัปเดตข้อมูลสุขภาพสำเร็จ");
        },
        onError: (error: any) => {
            console.error("Failed to update health", error);
            toast.error("ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่");
        },
    });

    // Form State (Sync with query data)
    const [formData, setFormData] = useState({
        weight: "",
        height: "",
        blood_type: "",
        allergies: "",
        chronic_illness: "",
        vaccinations: [] as { name: string, date: string, status: string }[]
    });

    useEffect(() => {
        if (healthQuery.data) {
            setFormData({
                weight: healthQuery.data.weight?.toString() || "",
                height: healthQuery.data.height?.toString() || "",
                blood_type: healthQuery.data.blood_type || "",
                allergies: healthQuery.data.allergies || "",
                chronic_illness: healthQuery.data.chronic_illness || "",
                vaccinations: Array.isArray(healthQuery.data.vaccinations) ? healthQuery.data.vaccinations : []
            });
        }
    }, [healthQuery.data]);

    const healthData = healthQuery.data;
    const isLoading = healthQuery.isLoading;
    const fetchError = healthQuery.error ? (healthQuery.error as any).message : null;

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleVaccineChange = (index: number, field: string, value: string) => {
        const newVaccines = [...formData.vaccinations];
        newVaccines[index] = { ...newVaccines[index], [field]: value };
        setFormData(prev => ({ ...prev, vaccinations: newVaccines }));
    };

    const addVaccine = () => {
        setFormData(prev => ({
            ...prev,
            vaccinations: [...prev.vaccinations, { name: "", date: "", status: "" }]
        }));
    };

    const removeVaccine = (index: number) => {
        const newVaccines = formData.vaccinations.filter((_, i) => i !== index);
        setFormData(prev => ({ ...prev, vaccinations: newVaccines }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validation
        const w = parseFloat(formData.weight);
        const h = parseFloat(formData.height);

        if (formData.weight && (isNaN(w) || w <= 0)) {
            toast.error("น้ำหนักต้องมากกว่า 0");
            return;
        }
        if (formData.height && (isNaN(h) || h <= 0)) {
            toast.error("ส่วนสูงต้องมากกว่า 0");
            return;
        }

        // Clean up empty vaccine names
        const cleanVaccines = formData.vaccinations.filter(v => v.name.trim() !== "");

        updateHealthMutation.mutate({
            ...formData,
            weight: formData.weight ? w : null,
            height: formData.height ? h : null,
            vaccinations: cleanVaccines
        });
    };

    // Calculate BMI
    let bmi = 0;
    let bmiText = "-";
    let bmiColor = "text-slate-500";

    if (healthData && healthData.weight && healthData.height > 0) {
        const hMeters = healthData.height / 100;
        bmi = healthData.weight / (hMeters * hMeters);

        if (bmi < 18.5) {
            bmiText = "น้ำหนักน้อย";
            bmiColor = "text-amber-500";
        } else if (bmi < 25) {
            bmiText = "ปกติ";
            bmiColor = "text-green-500";
        } else if (bmi < 30) {
            bmiText = "น้ำหนักเกิน";
            bmiColor = "text-orange-500";
        } else {
            bmiText = "โรคอ้วน";
            bmiColor = "text-red-500";
        }
    }

    const fitnessList = healthData?.fitness || [];
    const vaccinesList = healthData?.vaccinations || [];

    if (isLoading) {
        return (
            <div className="space-y-6">
                <section className="bg-gradient-to-br from-pink-600 to-rose-800 rounded-3xl p-8 shadow-lg">
                    <Skeleton variant="rounded" className="h-6 w-20 mb-4 bg-white/20" />
                    <Skeleton variant="rounded" className="h-8 w-48 mb-2 bg-white/20" />
                    <Skeleton variant="rounded" className="h-4 w-72 bg-white/20" />
                </section>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    {[...Array(5)].map((_, i) => (
                        <div key={i} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
                            <Skeleton variant="rounded" className="h-4 w-16 mb-2" />
                            <Skeleton variant="rounded" className="h-8 w-full" />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (fetchError || !healthData) {
        return (
            <div className="bg-white rounded-2xl p-12 shadow-sm border border-slate-200 flex flex-col items-center justify-center text-red-500">
                <p>{fetchError || "ไม่พบข้อมูลสุขภาพ"}</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 print:space-y-4">
            {/* Hero Section */}
            <section className="bg-gradient-to-br from-pink-600 to-rose-800 rounded-3xl p-8 text-white shadow-lg relative overflow-hidden print:bg-none print:text-black print:p-0 print:shadow-none print:border-b print:border-black print:rounded-none">
                <div className="relative z-10 flex flex-col md:flex-row gap-6 justify-between items-start md:items-center">
                    <div>
                        <div className="inline-block bg-white/20 px-3 py-1 rounded-full text-sm font-medium mb-4 backdrop-blur-sm border border-white/20 print:hidden">
                            Health
                        </div>
                        <h1 className="text-3xl font-bold mb-2 print:text-2xl">สมุดบันทึกสุขภาพ</h1>
                        <p className="text-pink-100 print:hidden">
                            ติดตามค่าสุขภาพและอัปเดตข้อมูลของคุณ
                        </p>
                    </div>
                    <button
                        onClick={() => window.print()}
                        className="bg-white/20 hover:bg-white/30 text-white backdrop-blur-md border border-white/30 px-6 py-2.5 rounded-xl font-medium transition-colors flex items-center gap-2 print:hidden"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                        พิมพ์รายงาน
                    </button>
                </div>

                {/* Decoration */}
                <div className="absolute top-0 right-0 w-64 h-full bg-white opacity-5 transform -skew-x-12 translate-x-20"></div>
                <div className="absolute -bottom-12 -right-12 w-48 h-48 bg-rose-500 rounded-full blur-2xl opacity-50"></div>
                <svg className="absolute top-1/2 right-12 transform -translate-y-1/2 w-32 h-32 text-white/10" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
            </section>

            {/* Editing Form */}
            {isEditing && (
                <section className="bg-white p-6 rounded-2xl shadow-sm border border-rose-200">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-bold text-slate-800">แก้ไขข้อมูลสุขภาพ</h3>
                        <button onClick={() => setIsEditing(false)} className="text-slate-400 hover:text-slate-600">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">น้ำหนัก (กก.)</label>
                                <input
                                    type="number"
                                    name="weight"
                                    step="0.1"
                                    value={formData.weight}
                                    onChange={handleInputChange}
                                    className="w-full border border-slate-300 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">ส่วนสูง (ซม.)</label>
                                <input
                                    type="number"
                                    name="height"
                                    step="0.1"
                                    value={formData.height}
                                    onChange={handleInputChange}
                                    className="w-full border border-slate-300 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">กรุ๊ปเลือด</label>
                                <input
                                    type="text"
                                    name="blood_type"
                                    value={formData.blood_type}
                                    onChange={handleInputChange}
                                    className="w-full border border-slate-300 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">ประวัติแพ้ยา/อาหาร</label>
                                <textarea
                                    name="allergies"
                                    value={formData.allergies}
                                    onChange={handleInputChange}
                                    rows={3}
                                    className="w-full border border-slate-300 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500 resize-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">โรคประจำตัว</label>
                                <textarea
                                    name="chronic_illness"
                                    value={formData.chronic_illness}
                                    onChange={handleInputChange}
                                    rows={3}
                                    className="w-full border border-slate-300 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500 resize-none"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-4">ประวัติการได้รับวัคซีน</label>
                            <div className="space-y-3 mb-4 max-h-60 overflow-y-auto pr-2">
                                {formData.vaccinations.map((vac, idx) => (
                                    <div key={idx} className="flex gap-3 items-center group">
                                        <input
                                            type="text"
                                            placeholder="ชื่อวัคซีน"
                                            value={vac.name}
                                            onChange={(e) => handleVaccineChange(idx, "name", e.target.value)}
                                            className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-rose-500"
                                        />
                                        <input
                                            type="date"
                                            value={vac.date}
                                            onChange={(e) => handleVaccineChange(idx, "date", e.target.value)}
                                            className="w-40 border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-rose-500"
                                        />
                                        <input
                                            type="text"
                                            placeholder="สถานะ"
                                            value={vac.status}
                                            onChange={(e) => handleVaccineChange(idx, "status", e.target.value)}
                                            className="w-32 border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-rose-500"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => removeVaccine(idx)}
                                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                        </button>
                                    </div>
                                ))}
                                {formData.vaccinations.length === 0 && (
                                    <div className="text-center py-4 bg-slate-50 border border-dashed border-slate-300 rounded-xl text-slate-500 text-sm">
                                        ยังไม่มีข้อมูลวัคซีน
                                    </div>
                                )}
                            </div>
                            <button
                                type="button"
                                onClick={addVaccine}
                                className="text-sm border border-rose-300 text-rose-600 bg-rose-50 hover:bg-rose-100 px-4 py-2 rounded-lg font-medium transition-colors"
                            >
                                + เพิ่มวัคซีน
                            </button>
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                            <button
                                type="button"
                                onClick={() => setIsEditing(false)}
                                disabled={updateHealthMutation.isPending}
                                className="px-6 py-2.5 rounded-xl text-slate-600 font-medium hover:bg-slate-100 transition-colors"
                            >
                                ยกเลิก
                            </button>
                            <button
                                type="submit"
                                disabled={updateHealthMutation.isPending}
                                className="px-6 py-2.5 rounded-xl bg-rose-600 text-white font-medium hover:bg-rose-700 transition-colors flex items-center gap-2"
                            >
                                {updateHealthMutation.isPending ? "กำลังบันทึก..." : "บันทึกข้อมูลสุขภาพ"}
                            </button>
                        </div>
                    </form>
                </section>
            )}

            {/* View Mode Stats Grid */}
            {!isEditing && (
                <>
                    <section>
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 bg-rose-50 text-rose-600 rounded-lg">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                            </div>
                            <h3 className="text-lg font-bold text-slate-800">สรุปสุขภาพวันนี้</h3>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
                                <div className="text-slate-500 text-sm font-medium mb-1">BMI</div>
                                <div className="text-3xl font-bold text-slate-800">{bmi > 0 ? bmi.toFixed(1) : "-"}</div>
                            </div>
                            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
                                <div className="text-slate-500 text-sm font-medium mb-1">สถานะ</div>
                                <div className={`text-xl font-bold mt-2 ${bmiColor}`}>{bmiText}</div>
                            </div>
                            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
                                <div className="text-slate-500 text-sm font-medium mb-1">น้ำหนัก (กก.)</div>
                                <div className="text-3xl font-bold text-slate-800">{healthData?.weight || "-"}</div>
                            </div>
                            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
                                <div className="text-slate-500 text-sm font-medium mb-1">ส่วนสูง (ซม.)</div>
                                <div className="text-3xl font-bold text-slate-800">{healthData?.height || "-"}</div>
                            </div>
                        </div>
                    </section>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Medical Info */}
                        <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                            <div className="flex justify-between items-center mb-6">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-rose-50 text-rose-600 rounded-lg">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                    </div>
                                    <h3 className="text-lg font-bold text-slate-800">ข้อมูลทางการแพทย์</h3>
                                </div>
                                <button
                                    onClick={() => setIsEditing(true)}
                                    className="text-sm font-medium text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-3 py-1.5 rounded-lg transition-colors border border-rose-200"
                                >
                                    แก้ไข
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div className="flex justify-between items-center py-3 border-b border-slate-100">
                                    <span className="text-slate-500">กรุ๊ปเลือด</span>
                                    <span className="font-semibold text-slate-800">{healthData?.blood_type || "-"}</span>
                                </div>
                                <div className="flex justify-between items-center py-3 border-b border-slate-100">
                                    <span className="text-slate-500">ประวัติแพ้ยา/อาหาร</span>
                                    <span className={`font-semibold ${healthData?.allergies ? "text-rose-600" : "text-slate-800"}`}>
                                        {healthData?.allergies || "-"}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center py-3 border-b border-slate-100">
                                    <span className="text-slate-500">โรคประจำตัว</span>
                                    <span className={`font-semibold ${healthData?.chronic_illness ? "text-amber-600" : "text-slate-800"}`}>
                                        {healthData?.chronic_illness || "-"}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center py-3">
                                    <span className="text-slate-500">ค่าสายตา (ซ้าย/ขวา)</span>
                                    <span className="font-semibold text-slate-800">
                                        {(healthData?.vision_left || healthData?.vision_right)
                                            ? `${healthData.vision_left || "-"} / ${healthData.vision_right || "-"}`
                                            : "-"}
                                    </span>
                                </div>
                            </div>
                        </section>

                        {/* Vaccines */}
                        <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-2 bg-teal-50 text-teal-600 rounded-lg">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                                </div>
                                <h3 className="text-lg font-bold text-slate-800">ประวัติการได้รับวัคซีน</h3>
                            </div>

                            <div className="overflow-x-auto rounded-xl border border-slate-200">
                                <table className="w-full text-sm text-left">
                                    <thead className="text-xs text-slate-500 bg-slate-50 border-b border-slate-200">
                                        <tr>
                                            <th className="px-4 py-3 font-medium">ชื่อวัคซีน</th>
                                            <th className="px-4 py-3 font-medium text-center">วันที่ได้รับ</th>
                                            <th className="px-4 py-3 font-medium text-center">สถานะ</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {vaccinesList.length === 0 ? (
                                            <tr>
                                                <td colSpan={3} className="px-4 py-6 text-center text-slate-500">
                                                    ยังไม่มีข้อมูล
                                                </td>
                                            </tr>
                                        ) : (
                                            vaccinesList.map((v: any, idx: number) => (
                                                <tr key={idx}>
                                                    <td className="px-4 py-3 font-medium">{v.name || "-"}</td>
                                                    <td className="px-4 py-3 text-center">{v.date || "-"}</td>
                                                    <td className="px-4 py-3 text-center">{v.status || "-"}</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </section>
                    </div>

                    {/* Fitness Tests */}
                    <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" /></svg>
                            </div>
                            <h3 className="text-lg font-bold text-slate-800">ผลทดสอบสมรรถภาพทางกาย</h3>
                        </div>

                        <div className="overflow-x-auto rounded-xl border border-slate-200">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-slate-500 bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        <th className="px-6 py-4 font-medium">รายการทดสอบ</th>
                                        <th className="px-6 py-4 font-medium text-center">ผลล่าสุด</th>
                                        <th className="px-6 py-4 font-medium text-center">เกณฑ์</th>
                                        <th className="px-6 py-4 font-medium text-center">สถานะ</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {fitnessList.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                                                ยังไม่มีข้อมูล
                                            </td>
                                        </tr>
                                    ) : (
                                        fitnessList.map((f: any, idx: number) => {
                                            const statusClass = f.status === "ผ่าน" || f.status === "ดี" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-700";
                                            return (
                                                <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                                    <td className="px-6 py-4 font-medium text-slate-800">
                                                        {f.test_name || f.name || "-"}
                                                    </td>
                                                    <td className="px-6 py-4 text-center">{f.result_value ?? f.result ?? "-"}</td>
                                                    <td className="px-6 py-4 text-center">{f.standard_value ?? f.standard ?? "-"}</td>
                                                    <td className="px-6 py-4 text-center">
                                                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusClass}`}>
                                                            {f.status || "-"}
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </section>
                </>
            )}
        </div>
    );
}
