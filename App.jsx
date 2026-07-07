import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  Wallet,
  Users,
  HeartHandshake,
  CreditCard,
  Landmark,
  PiggyBank,
  ShieldAlert,
  Plus,
  Trash2,
  Scale,
  CheckCircle2,
  History,
  Download,
  Upload,
  FileBarChart,
  Save,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

const fmt = (n) => {
  const v = Number.isFinite(n) ? n : 0;
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(
    Math.round(v)
  );
};

const todayISO = () => new Date().toISOString().slice(0, 10);
const currentMonthKey = () => new Date().toISOString().slice(0, 7); // YYYY-MM
const monthLabel = (key) => {
  if (!key) return "";
  const [y, m] = key.split("-");
  const names = [
    "جانفي", "فيفري", "مارس", "أفريل", "ماي", "جوان",
    "جويلية", "أوت", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
  ];
  return `${names[Number(m) - 1] || m} ${y}`;
};

let uid = 100;
const nextId = () => uid++;

const STORAGE_KEY = "salary-ledger-data-v1";

const defaultState = () => ({
  salary: 111000,
  mother: 10000,
  alimony: 5000,
  installments: [
    {
      id: nextId(),
      entity: "",
      monthly: 12600,
      total: 12,
      remaining: 12,
      payments: [],
    },
  ],
  debts: [
    {
      id: nextId(),
      entity: "",
      totalAmount: 0,
      monthly: 0,
      paid: 0,
      payments: [],
    },
  ],
  rows: [
    { id: nextId(), label: "مصاريف الأسرة", percent: 58.6 },
    { id: nextId(), label: "القسط الشهري", percent: 11.4 },
    { id: nextId(), label: "سداد الدين المنفصل", percent: 18.0 },
    { id: nextId(), label: "ادخار للطوارئ", percent: 4.5 },
    { id: nextId(), label: "احتياطي للمصاريف غير المتوقعة", percent: 7.5 },
  ],
  monthlyReports: [],
});

function loadInitialState() {
  if (typeof window === "undefined") return defaultState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    // بذرة المعرّفات كي لا تتضارب الهويات الجديدة مع المخزنة
    const allIds = [
      ...(parsed.installments || []).map((i) => i.id),
      ...(parsed.debts || []).map((d) => d.id),
      ...(parsed.rows || []).map((r) => r.id),
      ...(parsed.monthlyReports || []).map((m) => m.id),
    ].filter((n) => typeof n === "number");
    if (allIds.length) uid = Math.max(uid, ...allIds) + 1;
    return { ...defaultState(), ...parsed };
  } catch {
    return defaultState();
  }
}

export default function SalaryLedger() {
  const initial = useRef(loadInitialState());

  const [salary, setSalary] = useState(initial.current.salary);
  const [mother, setMother] = useState(initial.current.mother);
  const [alimony, setAlimony] = useState(initial.current.alimony);

  const [installments, setInstallments] = useState(initial.current.installments);

  const [debts, setDebts] = useState(initial.current.debts);

  const [rows, setRows] = useState(initial.current.rows);

  const [monthlyReports, setMonthlyReports] = useState(initial.current.monthlyReports);

  const [openHistoryId, setOpenHistoryId] = useState(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const importInputRef = useRef(null);

  // حفظ تلقائي في التخزين المحلي للجهاز عند أي تغيير
  useEffect(() => {
    const data = { salary, mother, alimony, installments, debts, rows, monthlyReports };
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // تجاهل أخطاء التخزين (مثلاً في وضع التصفح الخاص)
    }
  }, [salary, mother, alimony, installments, debts, rows, monthlyReports]);

  const installmentsTotal = useMemo(
    () => installments.reduce((s, i) => s + (Number(i.monthly) || 0), 0),
    [installments]
  );
  const debtsMonthlyTotal = useMemo(
    () => debts.reduce((s, d) => s + (Number(d.monthly) || 0), 0),
    [debts]
  );

  const totalFixed = mother + alimony + installmentsTotal + debtsMonthlyTotal;
  const remaining = salary - totalFixed;

  const installmentsRemainingTotal = useMemo(
    () =>
      installments.reduce(
        (s, i) => s + (Number(i.monthly) || 0) * (Number(i.remaining) || 0),
        0
      ),
    [installments]
  );
  const debtsRemainingTotal = useMemo(
    () =>
      debts.reduce(
        (s, d) => s + ((Number(d.totalAmount) || 0) - (Number(d.paid) || 0)),
        0
      ),
    [debts]
  );

  const percentTotal = rows.reduce((s, r) => s + (Number(r.percent) || 0), 0);
  const amountTotal = rows.reduce(
    (s, r) => s + (salary * (Number(r.percent) || 0)) / 100,
    0
  );

  const updateInstallment = (id, field, value) =>
    setInstallments((list) =>
      list.map((i) => (i.id === id ? { ...i, [field]: value } : i))
    );
  const addInstallment = () =>
    setInstallments((l) => [
      ...l,
      { id: nextId(), entity: "", monthly: 0, total: 0, remaining: 0, payments: [] },
    ]);
  const removeInstallment = (id) =>
    setInstallments((l) => l.filter((i) => i.id !== id));

  const payInstallment = (id) =>
    setInstallments((list) =>
      list.map((i) => {
        if (i.id !== id) return i;
        if ((Number(i.remaining) || 0) <= 0) return i;
        const payments = [
          ...(i.payments || []),
          { date: todayISO(), amount: Number(i.monthly) || 0 },
        ];
        return { ...i, remaining: (Number(i.remaining) || 0) - 1, payments };
      })
    );
  const undoInstallmentPayment = (id) =>
    setInstallments((list) =>
      list.map((i) => {
        if (i.id !== id || !(i.payments || []).length) return i;
        const payments = i.payments.slice(0, -1);
        return { ...i, remaining: (Number(i.remaining) || 0) + 1, payments };
      })
    );

  const updateDebt = (id, field, value) =>
    setDebts((list) =>
      list.map((d) => (d.id === id ? { ...d, [field]: value } : d))
    );
  const addDebt = () =>
    setDebts((l) => [
      ...l,
      { id: nextId(), entity: "", totalAmount: 0, monthly: 0, paid: 0, payments: [] },
    ]);
  const removeDebt = (id) => setDebts((l) => l.filter((d) => d.id !== id));

  const payDebt = (id) =>
    setDebts((list) =>
      list.map((d) => {
        if (d.id !== id) return d;
        const rem = (Number(d.totalAmount) || 0) - (Number(d.paid) || 0);
        if (rem <= 0) return d;
        const amount = Math.min(Number(d.monthly) || 0, rem);
        if (amount <= 0) return d;
        const payments = [...(d.payments || []), { date: todayISO(), amount }];
        return { ...d, paid: (Number(d.paid) || 0) + amount, payments };
      })
    );
  const undoDebtPayment = (id) =>
    setDebts((list) =>
      list.map((d) => {
        if (d.id !== id || !(d.payments || []).length) return d;
        const last = d.payments[d.payments.length - 1];
        const payments = d.payments.slice(0, -1);
        return { ...d, paid: (Number(d.paid) || 0) - last.amount, payments };
      })
    );

  const updateRow = (id, value) =>
    setRows((list) =>
      list.map((r) => (r.id === id ? { ...r, percent: value } : r))
    );

  const percentOk = Math.abs(percentTotal - 100) < 0.05;

  // نسخة احتياطية للبيانات
  const exportBackup = () => {
    const data = { salary, mother, alimony, installments, debts, rows, monthlyReports };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `نسخة-احتياطية-${todayISO()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const triggerImport = () => importInputRef.current?.click();

  const importBackup = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (typeof parsed.salary === "number") setSalary(parsed.salary);
        if (typeof parsed.mother === "number") setMother(parsed.mother);
        if (typeof parsed.alimony === "number") setAlimony(parsed.alimony);
        if (Array.isArray(parsed.installments)) setInstallments(parsed.installments);
        if (Array.isArray(parsed.debts)) setDebts(parsed.debts);
        if (Array.isArray(parsed.rows)) setRows(parsed.rows);
        if (Array.isArray(parsed.monthlyReports)) setMonthlyReports(parsed.monthlyReports);
        window.alert("تم استرجاع النسخة الاحتياطية بنجاح.");
      } catch {
        window.alert("تعذّرت قراءة الملف. تأكد أنه ملف نسخة احتياطية صالح (JSON).");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // تقرير شهري عن الوضعية المالية
  const currentMonth = currentMonthKey();
  const existingReportThisMonth = monthlyReports.find((r) => r.month === currentMonth);

  const saveMonthlyReport = () => {
    const snapshot = {
      id: existingReportThisMonth ? existingReportThisMonth.id : nextId(),
      month: currentMonth,
      savedAt: todayISO(),
      salary,
      mother,
      alimony,
      installmentsTotal,
      debtsMonthlyTotal,
      totalFixed,
      remaining,
      installmentsRemainingTotal,
      debtsRemainingTotal,
    };
    setMonthlyReports((list) => {
      const others = list.filter((r) => r.month !== currentMonth);
      return [...others, snapshot].sort((a, b) => (a.month < b.month ? 1 : -1));
    });
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2200);
  };

  const deleteMonthlyReport = (id) =>
    setMonthlyReports((list) => list.filter((r) => r.id !== id));

  return (
    <div dir="rtl" lang="ar" className="ledger-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Reem+Kufi:wght@400..700&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap');

        .ledger-root {
          --ink: #16241F;
          --bg: #F2F5EF;
          --panel: #FFFFFF;
          --emerald: #0F5C46;
          --emerald-dark: #0B4536;
          --gold: #B8912E;
          --brick: #A5432B;
          --line: #D9DECB;
          --muted: #667066;
          font-family: 'IBM Plex Sans Arabic', sans-serif;
          background: var(--bg);
          color: var(--ink);
          min-height: 100vh;
          padding: 28px 16px 60px;
        }
        .ledger-root * { box-sizing: border-box; }
        .kufi { font-family: 'Reem Kufi', sans-serif; }
        .tab-num { font-variant-numeric: tabular-nums; }

        .wrap { max-width: 880px; margin: 0 auto; }

        .eyebrow {
          font-size: 12px;
          letter-spacing: 0.12em;
          color: var(--emerald);
          font-weight: 600;
          text-transform: uppercase;
          margin-bottom: 6px;
        }
        .title {
          font-size: 30px;
          font-weight: 700;
          color: var(--emerald-dark);
          margin: 0 0 22px;
        }

        .receipt {
          background: var(--panel);
          border: 1px solid var(--line);
          border-radius: 18px;
          padding: 26px 26px 22px;
          position: relative;
          box-shadow: 0 10px 30px -18px rgba(15,92,70,0.35);
          margin-bottom: 14px;
        }
        .receipt::after {
          content: "";
          position: absolute;
          left: 0; right: 0; bottom: -11px;
          height: 22px;
          background-image: radial-gradient(circle at 12px 0, transparent 10px, var(--bg) 10.5px);
          background-size: 24px 22px;
          background-repeat: repeat-x;
        }

        .salary-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
        }
        .salary-label { font-size: 13px; color: var(--muted); font-weight: 600; }
        .salary-input {
          font-family: 'IBM Plex Sans Arabic', sans-serif;
          font-size: 34px;
          font-weight: 700;
          color: var(--emerald-dark);
          border: none;
          outline: none;
          background: transparent;
          width: 220px;
          text-align: right;
        }
        .salary-input:focus { border-bottom: 2px solid var(--emerald); }
        .unit { font-size: 15px; color: var(--muted); font-weight: 500; }

        .divider-strip {
          margin-top: 26px;
          padding-top: 16px;
          border-top: 1px dashed var(--line);
          display: flex;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
        }
        .stat { text-align: center; flex: 1; min-width: 140px; }
        .stat-label { font-size: 12px; color: var(--muted); margin-bottom: 4px; }
        .stat-value { font-size: 20px; font-weight: 700; }
        .stat-value.pos { color: var(--emerald); }
        .stat-value.neg { color: var(--brick); }

        .section { margin-top: 34px; }
        .section-head {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 12px;
        }
        .section-head h2 {
          font-size: 17px;
          font-weight: 700;
          margin: 0;
          color: var(--emerald-dark);
        }
        .section-head svg { color: var(--emerald); flex-shrink: 0; }

        .card {
          background: var(--panel);
          border: 1px solid var(--line);
          border-radius: 14px;
          padding: 16px 18px;
          margin-bottom: 10px;
        }
        .card.accent-gold { border-right: 4px solid var(--gold); }
        .card.accent-brick { border-right: 4px solid var(--brick); }
        .card.accent-emerald { border-right: 4px solid var(--emerald); }

        .row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .row-3 { display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 10px; }

        label.f-label {
          font-size: 11.5px;
          color: var(--muted);
          font-weight: 600;
          display: block;
          margin-bottom: 4px;
        }
        input.f-input, input.f-text {
          width: 100%;
          border: 1px solid var(--line);
          border-radius: 8px;
          padding: 8px 10px;
          font-size: 14px;
          font-family: inherit;
          color: var(--ink);
          background: #FBFCFA;
        }
        input.f-input:focus, input.f-text:focus {
          outline: none;
          border-color: var(--emerald);
          background: #fff;
        }

        .fixed-simple {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
        }
        .fixed-simple .who { display: flex; align-items: center; gap: 10px; font-weight: 600; }
        .fixed-simple input { width: 140px; text-align: left; }

        .list-title-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }
        .list-title-row .who { display: flex; gap: 8px; align-items: center; font-weight: 700; font-size: 14px; }
        .add-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12.5px;
          font-weight: 600;
          color: var(--emerald);
          background: #EAF3EE;
          border: none;
          border-radius: 8px;
          padding: 6px 10px;
          cursor: pointer;
        }
        .add-btn:hover { background: #DCEBE2; }
        .remove-btn {
          background: none;
          border: none;
          color: var(--brick);
          cursor: pointer;
          padding: 6px;
          display: flex;
          align-items: center;
          border-radius: 6px;
        }
        .remove-btn:hover { background: #F5E6E1; }

        .entity-remaining {
          margin-top: 8px;
          font-size: 12.5px;
          color: var(--muted);
          display: flex;
          gap: 16px;
          flex-wrap: wrap;
        }
        .entity-remaining b { color: var(--ink); }

        table.plan {
          width: 100%;
          border-collapse: collapse;
          background: var(--panel);
          border: 1px solid var(--line);
          border-radius: 14px;
          overflow: hidden;
        }
        table.plan th {
          background: var(--emerald-dark);
          color: #fff;
          font-size: 13px;
          font-weight: 600;
          padding: 10px 12px;
          text-align: right;
        }
        table.plan td {
          padding: 9px 12px;
          border-bottom: 1px solid var(--line);
          font-size: 13.5px;
        }
        table.plan tr:last-child td { border-bottom: none; }
        table.plan input.pct-input {
          width: 64px;
          text-align: center;
          border: 1px solid var(--line);
          border-radius: 6px;
          padding: 4px 6px;
          font-size: 13px;
        }
        table.plan tfoot td {
          font-weight: 700;
          background: #F3F6F0;
          color: var(--emerald-dark);
        }
        .warn-badge {
          display: inline-block;
          margin-right: 8px;
          font-size: 11.5px;
          color: var(--brick);
          font-weight: 600;
        }

        .pay-actions {
          margin-top: 10px;
          display: flex;
          align-items: center;
          gap: 14px;
          flex-wrap: wrap;
        }
        .pay-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12.5px;
          font-weight: 700;
          color: #fff;
          background: var(--emerald);
          border: none;
          border-radius: 8px;
          padding: 7px 12px;
          cursor: pointer;
        }
        .pay-btn:hover { background: var(--emerald-dark); }
        .pay-btn:disabled { background: #B7C4BC; cursor: not-allowed; }
        .link-btn {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 12px;
          font-weight: 600;
          color: var(--muted);
          background: none;
          border: none;
          cursor: pointer;
          padding: 4px 2px;
          text-decoration: underline;
        }
        .link-btn:hover { color: var(--ink); }
        .pay-history {
          list-style: none;
          margin: 8px 0 0;
          padding: 8px 10px;
          background: #F6F8F4;
          border-radius: 8px;
          font-size: 12.5px;
          max-height: 160px;
          overflow-y: auto;
        }
        .pay-history li {
          display: flex;
          justify-content: space-between;
          padding: 3px 0;
          border-bottom: 1px dashed var(--line);
        }
        .pay-history li:last-child { border-bottom: none; }

        .backup-actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }
        .btn-solid {
          display: flex;
          align-items: center;
          gap: 7px;
          font-size: 13.5px;
          font-weight: 700;
          color: #fff;
          background: var(--emerald);
          border: none;
          border-radius: 10px;
          padding: 10px 16px;
          cursor: pointer;
        }
        .btn-solid:hover { background: var(--emerald-dark); }
        .btn-outline {
          display: flex;
          align-items: center;
          gap: 7px;
          font-size: 13.5px;
          font-weight: 700;
          color: var(--emerald-dark);
          background: #fff;
          border: 1.5px solid var(--emerald);
          border-radius: 10px;
          padding: 10px 16px;
          cursor: pointer;
        }
        .btn-outline:hover { background: #EAF3EE; }
        .backup-hint {
          font-size: 12.5px;
          color: var(--muted);
          margin-top: 10px;
        }
        .saved-flash {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          color: var(--emerald);
          font-weight: 700;
          font-size: 12.5px;
          margin-right: 10px;
        }

        table.report {
          width: 100%;
          border-collapse: collapse;
          background: var(--panel);
          border: 1px solid var(--line);
          border-radius: 14px;
          overflow: hidden;
          font-size: 13px;
        }
        table.report th {
          background: var(--emerald-dark);
          color: #fff;
          font-weight: 600;
          padding: 9px 10px;
          text-align: center;
        }
        table.report td {
          padding: 8px 10px;
          border-bottom: 1px solid var(--line);
          text-align: center;
        }
        table.report tr:last-child td { border-bottom: none; }
        table.report .neg { color: var(--brick); font-weight: 700; }
        table.report .pos { color: var(--emerald); font-weight: 700; }
        table.report button.del {
          background: none;
          border: none;
          color: var(--brick);
          cursor: pointer;
        }
        .empty-note {
          font-size: 13px;
          color: var(--muted);
          padding: 14px;
          text-align: center;
        }

        @media (max-width: 640px) {
          .row-2, .row-3 { grid-template-columns: 1fr; }
          .divider-strip { justify-content: flex-start; }
          .salary-input { width: 160px; font-size: 26px; }
          table.report { font-size: 11.5px; }
        }
      `}</style>

      <div className="wrap">
        <div className="eyebrow kufi">مسيّر الراتب الشخصي</div>
        <h1 className="title kufi">توزيع الراتب والالتزامات</h1>

        {/* Hero receipt */}
        <div className="receipt">
          <div className="salary-row">
            <div>
              <div className="salary-label">الراتب الشهري</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <input
                  className="salary-input tab-num"
                  type="number"
                  value={salary}
                  onChange={(e) => setSalary(Number(e.target.value) || 0)}
                />
                <span className="unit">دج</span>
              </div>
            </div>
            <Wallet size={34} color="#0F5C46" />
          </div>

          <div className="divider-strip">
            <div className="stat">
              <div className="stat-label">إجمالي الالتزامات الثابتة</div>
              <div className="stat-value tab-num">{fmt(totalFixed)} دج</div>
            </div>
            <div className="stat">
              <div className="stat-label">المتبقي بعد الالتزامات</div>
              <div className={`stat-value tab-num ${remaining >= 0 ? "pos" : "neg"}`}>
                {fmt(remaining)} دج
              </div>
            </div>
          </div>
        </div>

        {/* Fixed obligations */}
        <div className="section">
          <div className="section-head">
            <Scale size={18} />
            <h2>الالتزامات الشهرية الثابتة</h2>
          </div>

          <div className="card accent-gold">
            <div className="fixed-simple">
              <div className="who">
                <Users size={16} color="#B8912E" />
                مبلغ للأم
              </div>
              <input
                className="f-input tab-num"
                type="number"
                value={mother}
                onChange={(e) => setMother(Number(e.target.value) || 0)}
              />
            </div>
          </div>

          <div className="card accent-brick">
            <div className="fixed-simple">
              <div className="who">
                <HeartHandshake size={16} color="#A5432B" />
                مبلغ النفقة
              </div>
              <input
                className="f-input tab-num"
                type="number"
                value={alimony}
                onChange={(e) => setAlimony(Number(e.target.value) || 0)}
              />
            </div>
          </div>

          {/* Installments */}
          <div className="list-title-row">
            <div className="who">
              <CreditCard size={16} color="#0F5C46" />
              أقساط التقسيط
            </div>
            <button className="add-btn" onClick={addInstallment}>
              <Plus size={14} /> إضافة جهة
            </button>
          </div>

          {installments.map((it) => (
            <div className="card accent-emerald" key={it.id}>
              <div className="row-3">
                <div>
                  <label className="f-label">الجهة</label>
                  <input
                    className="f-text"
                    type="text"
                    placeholder="مثال: بنك القرض الشعبي"
                    value={it.entity}
                    onChange={(e) => updateInstallment(it.id, "entity", e.target.value)}
                  />
                </div>
                <div>
                  <label className="f-label">القسط الشهري (دج)</label>
                  <input
                    className="f-input tab-num"
                    type="number"
                    value={it.monthly}
                    onChange={(e) =>
                      updateInstallment(it.id, "monthly", Number(e.target.value) || 0)
                    }
                  />
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "flex-end" }}>
                  <button className="remove-btn" onClick={() => removeInstallment(it.id)} title="حذف">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              <div className="row-2" style={{ marginTop: 10 }}>
                <div>
                  <label className="f-label">عدد الأقساط الإجمالي</label>
                  <input
                    className="f-input tab-num"
                    type="number"
                    value={it.total}
                    onChange={(e) =>
                      updateInstallment(it.id, "total", Number(e.target.value) || 0)
                    }
                  />
                </div>
                <div>
                  <label className="f-label">عدد الأقساط المتبقي</label>
                  <input
                    className="f-input tab-num"
                    type="number"
                    value={it.remaining}
                    onChange={(e) =>
                      updateInstallment(it.id, "remaining", Number(e.target.value) || 0)
                    }
                  />
                </div>
              </div>
              <div className="entity-remaining">
                <span>
                  المتبقي من الدين الإجمالي التقديري:{" "}
                  <b className="tab-num">
                    {fmt((Number(it.monthly) || 0) * (Number(it.remaining) || 0))} دج
                  </b>
                </span>
                <span>
                  دفعات مسجَّلة: <b className="tab-num">{(it.payments || []).length}</b>
                </span>
              </div>
              <div className="pay-actions">
                <button
                  className="pay-btn"
                  onClick={() => payInstallment(it.id)}
                  disabled={(Number(it.remaining) || 0) <= 0}
                >
                  <CheckCircle2 size={14} /> تسجيل دفعة هذا الشهر
                </button>
                {(it.payments || []).length > 0 && (
                  <button className="link-btn" onClick={() => undoInstallmentPayment(it.id)}>
                    تراجع عن آخر دفعة
                  </button>
                )}
                {(it.payments || []).length > 0 && (
                  <button
                    className="link-btn"
                    onClick={() => setOpenHistoryId(openHistoryId === `i-${it.id}` ? null : `i-${it.id}`)}
                  >
                    {openHistoryId === `i-${it.id}` ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    سجل الدفعات
                  </button>
                )}
              </div>
              {openHistoryId === `i-${it.id}` && (it.payments || []).length > 0 && (
                <ul className="pay-history">
                  {it.payments.slice().reverse().map((p, idx) => (
                    <li key={idx}>
                      <span>{p.date}</span>
                      <span className="tab-num">{fmt(p.amount)} دج</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}

          {/* Debts */}
          <div className="list-title-row" style={{ marginTop: 18 }}>
            <div className="who">
              <Landmark size={16} color="#A5432B" />
              الديون
            </div>
            <button className="add-btn" onClick={addDebt}>
              <Plus size={14} /> إضافة دين
            </button>
          </div>

          {debts.map((d) => {
            const rem = (Number(d.totalAmount) || 0) - (Number(d.paid) || 0);
            return (
              <div className="card accent-brick" key={d.id}>
                <div className="row-3">
                  <div>
                    <label className="f-label">الجهة المدينة</label>
                    <input
                      className="f-text"
                      type="text"
                      placeholder="مثال: قريب / زميل"
                      value={d.entity}
                      onChange={(e) => updateDebt(d.id, "entity", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="f-label">المبلغ الإجمالي (دج)</label>
                    <input
                      className="f-input tab-num"
                      type="number"
                      value={d.totalAmount}
                      onChange={(e) => updateDebt(d.id, "totalAmount", Number(e.target.value) || 0)}
                    />
                  </div>
                  <div style={{ display: "flex", gap: 6, alignItems: "flex-end" }}>
                    <button className="remove-btn" onClick={() => removeDebt(d.id)} title="حذف">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <div className="row-2" style={{ marginTop: 10 }}>
                  <div>
                    <label className="f-label">دفعة السداد الشهرية (دج)</label>
                    <input
                      className="f-input tab-num"
                      type="number"
                      value={d.monthly}
                      onChange={(e) => updateDebt(d.id, "monthly", Number(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <label className="f-label">إجمالي ما تم دفعه (دج)</label>
                    <input
                      className="f-input tab-num"
                      type="number"
                      value={d.paid}
                      onChange={(e) => updateDebt(d.id, "paid", Number(e.target.value) || 0)}
                    />
                  </div>
                </div>
                <div className="entity-remaining">
                  <span>
                    المبلغ المتبقي: <b className="tab-num">{fmt(rem)} دج</b>
                  </span>
                  <span>
                    دفعات مسجَّلة: <b className="tab-num">{(d.payments || []).length}</b>
                  </span>
                </div>
                <div className="pay-actions">
                  <button
                    className="pay-btn"
                    onClick={() => payDebt(d.id)}
                    disabled={rem <= 0 || !(Number(d.monthly) > 0)}
                  >
                    <CheckCircle2 size={14} /> تسجيل دفعة هذا الشهر
                  </button>
                  {(d.payments || []).length > 0 && (
                    <button className="link-btn" onClick={() => undoDebtPayment(d.id)}>
                      تراجع عن آخر دفعة
                    </button>
                  )}
                  {(d.payments || []).length > 0 && (
                    <button
                      className="link-btn"
                      onClick={() => setOpenHistoryId(openHistoryId === `d-${d.id}` ? null : `d-${d.id}`)}
                    >
                      {openHistoryId === `d-${d.id}` ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                      سجل الدفعات
                    </button>
                  )}
                </div>
                {openHistoryId === `d-${d.id}` && (d.payments || []).length > 0 && (
                  <ul className="pay-history">
                    {d.payments.slice().reverse().map((p, idx) => (
                      <li key={idx}>
                        <span>{p.date}</span>
                        <span className="tab-num">{fmt(p.amount)} دج</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>

        {/* Percentage plan table */}
        <div className="section">
          <div className="section-head">
            <PiggyBank size={18} />
            <h2>خطة توزيع الراتب حسب النسب</h2>
          </div>

          <table className="plan">
            <thead>
              <tr>
                <th>البند</th>
                <th>النسبة</th>
                <th>المبلغ (دج)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.label}</td>
                  <td>
                    <input
                      className="pct-input tab-num"
                      type="number"
                      step="0.1"
                      value={r.percent}
                      onChange={(e) => updateRow(r.id, Number(e.target.value) || 0)}
                    />
                    <span style={{ marginRight: 4 }}>%</span>
                  </td>
                  <td className="tab-num">{fmt((salary * (Number(r.percent) || 0)) / 100)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>
                  المجموع
                  {!percentOk && (
                    <span className="warn-badge">
                      <ShieldAlert size={12} style={{ verticalAlign: "-2px" }} /> النسب لا تساوي 100%
                    </span>
                  )}
                </td>
                <td className="tab-num">{percentTotal.toFixed(1)}%</td>
                <td className="tab-num">{fmt(amountTotal)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Monthly financial report */}
        <div className="section">
          <div className="section-head">
            <FileBarChart size={18} />
            <h2>التقرير الشهري عن الوضعية المالية</h2>
          </div>

          <div className="card accent-emerald">
            <div className="fixed-simple" style={{ flexWrap: "wrap" }}>
              <div className="who">
                <History size={16} color="#0F5C46" />
                شهر {monthLabel(currentMonth)}
                {existingReportThisMonth && (
                  <span style={{ fontWeight: 400, color: "var(--muted)", fontSize: 12 }}>
                    (تم حفظ تقرير لهذا الشهر بتاريخ {existingReportThisMonth.savedAt})
                  </span>
                )}
              </div>
              <div>
                <button className="btn-solid" onClick={saveMonthlyReport}>
                  <Save size={15} />
                  {existingReportThisMonth ? "تحديث تقرير هذا الشهر" : "حفظ تقرير هذا الشهر"}
                </button>
                {savedFlash && (
                  <span className="saved-flash">
                    <CheckCircle2 size={14} /> تم الحفظ
                  </span>
                )}
              </div>
            </div>
            <div className="backup-hint">
              يلتقط التقرير صورة للوضع الحالي: الراتب، الالتزامات الشهرية، الباقي بعد الالتزامات، ومجموع المتبقي من الأقساط والديون.
            </div>
          </div>

          {monthlyReports.length === 0 ? (
            <div className="card">
              <div className="empty-note">لا توجد تقارير محفوظة بعد. اضغط "حفظ تقرير هذا الشهر" لبدء الأرشيف الشهري.</div>
            </div>
          ) : (
            <div className="card" style={{ overflowX: "auto" }}>
              <table className="report">
                <thead>
                  <tr>
                    <th>الشهر</th>
                    <th>الراتب</th>
                    <th>الالتزامات الثابتة</th>
                    <th>الباقي بعد الالتزامات</th>
                    <th>متبقي الأقساط</th>
                    <th>متبقي الديون</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyReports.map((r) => (
                    <tr key={r.id}>
                      <td>{monthLabel(r.month)}</td>
                      <td className="tab-num">{fmt(r.salary)}</td>
                      <td className="tab-num">{fmt(r.totalFixed)}</td>
                      <td className={`tab-num ${r.remaining >= 0 ? "pos" : "neg"}`}>{fmt(r.remaining)}</td>
                      <td className="tab-num">{fmt(r.installmentsRemainingTotal)}</td>
                      <td className="tab-num">{fmt(r.debtsRemainingTotal)}</td>
                      <td>
                        <button className="del" onClick={() => deleteMonthlyReport(r.id)} title="حذف التقرير">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Backup */}
        <div className="section">
          <div className="section-head">
            <Download size={18} />
            <h2>نسخة احتياطية للبيانات</h2>
          </div>
          <div className="card">
            <div className="backup-actions">
              <button className="btn-solid" onClick={exportBackup}>
                <Download size={15} /> تنزيل نسخة احتياطية
              </button>
              <button className="btn-outline" onClick={triggerImport}>
                <Upload size={15} /> استيراد نسخة احتياطية
              </button>
              <input
                ref={importInputRef}
                type="file"
                accept="application/json"
                style={{ display: "none" }}
                onChange={importBackup}
              />
            </div>
            <div className="backup-hint">
              تُحفظ بياناتك تلقائيًا على هذا الجهاز. يمكنك أيضًا تنزيل ملف JSON كنسخة احتياطية لنقل البيانات إلى جهاز آخر أو استرجاعها لاحقًا.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
