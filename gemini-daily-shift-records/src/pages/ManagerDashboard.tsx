import { useEffect, useState } from "react";
import { useQuery }  from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectTrigger, SelectContent, SelectItem } from "@/components/ui/select";
import { cn } from "../lib/utils";
import { supabase } from "../lib/supabase";
import { useAtomValue } from "jotai";
import { userAtom } from "../store/auth";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend, PieChart, Pie, Cell, RadialBarChart, RadialBar } from 'recharts';
import { fetchShiftsForDate } from "@/lib/useFetchShiftsForDate";
import * as XLSX from 'xlsx';
import { Download, User, Fuel, CreditCard, TrendingUp, TrendingDown, BarChart2, FileText, ChevronDown } from "lucide-react";


const fetchSummaries = async (shift: string) => {
  // Fetch all shifts for the selected shift type
  const { data, error } = await supabase
    .from("shifts")
    .select("*, attendant:attendant_id(username)")
    .eq("shift_type", shift)
    .order("shift_date", { ascending: false });
  if (error) throw error;
  // Group by attendant and date
  const grouped: Record<string, any> = {};
  for (const row of data) {
    const key = `${row.attendant_id}-${row.shift_date}`;
    if (!grouped[key]) {
      grouped[key] = {
        attendantName: row.attendant?.username || row.attendant_id,
        shift: row.shift_type,
        date: row.shift_date,
        openingTotal: 0,
        closingTotal: 0,
        expectedTotal: 0,
        cashTotal: 0,
        prepaids: [],
        credits: [],
        difference: 0,
      };
    }
    grouped[key].openingTotal += row.opening_reading || 0;
    grouped[key].closingTotal += row.closing_reading || 0;
    grouped[key].expectedTotal += (row.closing_reading - row.opening_reading) * (row.fuel_price || 0);
    grouped[key].cashTotal += row.cash_received || 0;
    if (row.prepayment_received) {
      grouped[key].prepaids.push({ name: "Prepaid", amount: row.prepayment_received });
    }
    if (row.credit_received) {
      grouped[key].credits.push({ name: "Credit", amount: row.credit_received });
    }
  }
  // Calculate difference including all payment types
  for (const key in grouped) {
    const g = grouped[key];
    const collected = g.cashTotal 
      + g.prepaids.reduce((s: number, p: any) => s + p.amount, 0) 
      + g.credits.reduce((s: number, c: any) => s + c.amount, 0)
      + (g.fuel_card_received || 0)
      + (g.fdh_card_received || 0)
      + (g.national_bank_card_received || 0)
      + (g.mo_payment_received || 0)
      + (g.own_use_total || 0);
    g.difference = collected - g.expectedTotal;
  }
  return Object.values(grouped);
};

export default function ManagerDashboard() {
  const user = useAtomValue(userAtom);
  const [, setLocation] = useLocation();
  const [shift, setShift] = useState("all");
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().slice(0, 10);
  });
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attendants, setAttendants] = useState<any[]>([]);
  const [selectedAttendant, setSelectedAttendant] = useState<string>("");
  const [pumpMap, setPumpMap] = useState<Record<string, string>>({});
  const [selectedRecords, setSelectedRecords] = useState<Set<string | number>>(new Set());
  const [showAllModal, setShowAllModal] = useState(false);

  const { data: summaries, isLoading, error: queryError } = useQuery({
    queryKey: ["manager", shift],
    queryFn: () => shift === "all"
      ? Promise.all([fetchSummaries("day"), fetchSummaries("night")]).then(arr => arr.flat())
      : fetchSummaries(shift),
  });
const COLORS = [
  '#007aff', '#34c759', '#ff9500', '#ff2d55',
  '#5856d6', '#5ac8fa', '#af52de', '#ffcc00'
];

// Compute submissions and pumps from records
const submissions = records;
const pumps = Array.from(new Set(records.map((rec) => rec.pump_id)));
const submittedPumps = new Set(submissions.map((sub: any) => sub.pump_id));
const completionPercent = pumps.length > 0 ? (submittedPumps.size / pumps.length) * 100 : 0;

  useEffect(() => {
  const fetchRecords = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchShiftsForDate(selectedDate);
      setRecords(data || []);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch records');
      setRecords([]);
    }
    setLoading(false);
  };
  fetchRecords();
}, [selectedDate]);


  // Fetch pump names for mapping
  useEffect(() => {
    const fetchPumps = async () => {
      const { data, error } = await supabase.from('pumps').select('id, name');
      if (!error && data) {
        const map: Record<string, string> = {};
        data.forEach((p: any) => { map[p.id] = p.name; });
        setPumpMap(map);
      }
    };
    fetchPumps();
  }, []);

  // Fetch attendants for dropdown
  useEffect(() => {
    const fetchAttendants = async () => {
      const { data, error } = await supabase.from('users').select('id, username').eq('role', 'attendant');
      if (!error && data) {
        setAttendants(data);
      }
    };
    fetchAttendants();
  }, []);

// Logout function
const handleLogout = async () => {
  await supabase.auth.signOut();
  setLocation("/");
};

// Pie chart data
const volumeData = submissions.map((sub: any) => ({
  name: `${pumpMap[sub.pump_id] ?? sub.pump_id} - ${sub.attendant?.username ?? sub.attendant_id}`,
  value: Number(sub.closing_reading ?? sub.closing) - Number(sub.opening_reading ?? sub.opening),
}));
const priceData = submissions.map((sub: any) => ({
  name: `${pumpMap[sub.pump_id] ?? sub.pump_id} - ${sub.attendant?.username ?? sub.attendant_id}`,
  value: Number(sub.cash_received ?? sub.cash ?? 0) + Number(sub.prepayment_received ?? sub.prepaid ?? 0) + Number(sub.credit_received ?? sub.credit ?? 0),
}));

  // Filtered records by attendant
  const filteredRecords = selectedAttendant
    ? records.filter((r) => r.attendant_id === selectedAttendant)
    : records;

  // Download CSV
  const downloadCSV = () => {
    const headers = [
      "Attendant",
      "Pump",
      "Shift",
      "Date",
      "Opening",
      "Closing",
      "Cash",
      "Prepaid",
      "Credit",
      "Expected",
    ];
    const rows = filteredRecords.map((rec) => [
      rec.attendant?.username || rec.attendant_id,
      pumpMap[rec.pump_id] || rec.pump_id,
      rec.shift_type,
      rec.shift_date,
      rec.opening_reading,
      rec.closing_reading,
      rec.cash_received,
      rec.prepayment_received,
      rec.credit_received,
      (rec.closing_reading - rec.opening_reading) * (rec.fuel_price || 0),
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `records_${selectedDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Download XLS
  const downloadXLS = () => {
    const headers = [
      "Attendant",
      "Pump",
      "Shift",
      "Date",
      "Opening (L)",
      "Closing (L)",
      "Cash",
      "Prepaid",
      "Credit",
      "Expected (MWK)",
      "Prepaid Names",
      "Credit Names"
    ];
    const rows = filteredRecords.map((rec) => [
      String(rec.attendant?.username || rec.attendant_id),
      String(pumpMap[rec.pump_id] || rec.pump_id),
      String(rec.shift_type),
      rec.shift_date ? String(rec.shift_date) : '',
      `'${rec.opening_reading}`,
      `'${rec.closing_reading}`,
      `'${rec.cash_received}`,
      `'${rec.prepayments ? rec.prepayments.reduce((sum: number, p: { amount: any; }) => sum + Number(p.amount), 0) : rec.prepayment_received}`,
      `'${rec.credits ? rec.credits.reduce((sum: number, c: { amount: any; }) => sum + Number(c.amount), 0) : rec.credit_received}`,
      `'${(rec.closing_reading - rec.opening_reading) * (rec.fuel_price || 0)}`,
      rec.prepayments ? rec.prepayments.map((p: { name: any; }) => p.name).join('; ') : '',
      rec.credits ? rec.credits.map((c: { name: any; }) => c.name).join('; ') : ''
    ]);
    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Records");
    XLSX.writeFile(workbook, `records_${selectedDate}.xls`, { bookType: 'xls' });
  };

  // Simple bar graph for performance (total collected per attendant)
  const graphData: [string, number][] = (() => {
    const map: Record<string, number> = {};
    filteredRecords.forEach((r) => {
      const name = r.attendant?.username || r.attendant_id;
      map[name] =
        (map[name] || 0) +
        (Number(r.cash_received) +
          Number(r.prepayment_received) +
          Number(r.credit_received));
    });
    return Object.entries(map);
  })();

  // Prepare sales data for graph (total collected per attendant per date)
  const salesGraphData = (() => {
    // Group by date, then sum per attendant
    const map: Record<string, Record<string, number>> = {};
    filteredRecords.forEach((r) => {
      const date = r.shift_date;
      const name = r.attendant?.username || r.attendant_id;
      if (!map[date]) map[date] = {};
      map[date][name] =
        (map[date][name] || 0) +
        (Number(r.cash_received) + Number(r.prepayment_received) + Number(r.credit_received));
    });
    // Convert to array of { date, [attendant1]: value, [attendant2]: value, ... }
    const dates = Object.keys(map).sort();
    const attendantsList = Array.from(new Set(filteredRecords.map(r => r.attendant?.username || r.attendant_id)));
    return dates.map(date => {
      const row: any = { date };
      attendantsList.forEach(a => { row[a] = map[date][a] || 0; });
      return row;
    });
  })();

  const attendant = summaries?.find((s: any) => s.attendantName === selected);

  // Add summary analytics calculation
const totalRevenue = filteredRecords.reduce((sum, r) => sum + Number(r.cash_received || 0) + Number(r.prepayment_received || 0) + Number(r.credit_received || 0), 0);
const totalVolume = filteredRecords.reduce((sum, r) => sum + ((Number(r.closing_reading || 0) - Number(r.opening_reading || 0))), 0);
const avgOverage = filteredRecords.filter(r => typeof r.overage === 'number').reduce((sum, r, _, arr) => sum + (r.overage || 0) / arr.length, 0);
const avgShortage = filteredRecords.filter(r => typeof r.shortage === 'number').reduce((sum, r, _, arr) => sum + (r.shortage || 0) / arr.length, 0);

// Calculate payment type totals for summary
const summaryTotals = filteredRecords.reduce((acc, rec) => {
  acc.cash += Number(rec.cash_received || 0);
  acc.prepaid += Number(rec.prepayment_received || 0);
  acc.credit += Number(rec.credit_received || 0);
  acc.fuelCard += Number(rec.fuel_card_received || 0);
  acc.fdhCard += Number(rec.fdh_card_received || 0);
  acc.nationalBankCard += Number(rec.national_bank_card_received || 0);
  acc.moPayment += Number(rec.mo_payment_received || 0);
  acc.ownUse += Number(rec.own_use_total || 0);
  return acc;
}, { cash: 0, prepaid: 0, credit: 0, fuelCard: 0, fdhCard: 0, nationalBankCard: 0, moPayment: 0, ownUse: 0 });

  const handleSelectRecord = (id: string | number, checked: boolean) => {
    setSelectedRecords(prev => {
      const newSet = new Set(prev);
      if (checked) newSet.add(id);
      else newSet.delete(id);
      return newSet;
    });
  };

  const handleDeleteSelected = async () => {
    if (selectedRecords.size === 0) return;
    if (!window.confirm('Are you sure you want to delete the selected records?')) return;
    setLoading(true);
    const ids = Array.from(selectedRecords);
    const { error } = await supabase.from('shifts').delete().in('id', ids);
    if (error) {
      alert('Failed to delete records: ' + error.message);
    } else {
      setRecords(records.filter(r => !selectedRecords.has(r.id)));
      setSelectedRecords(new Set());
    }
    setLoading(false);
  };

  return (
    <>
      {/* Fixed background image */}
      <div
        className="fixed inset-0 w-full h-full z-0"
        style={{
          backgroundImage: 'url("/puma.jpg")',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          backgroundAttachment: 'fixed',
        }}
        aria-hidden="true"
      />
      {/* Foreground content */}
      <div className="relative min-h-screen w-full p-2 sm:p-4 space-y-4 z-10" style={{
        fontFamily: 'San Francisco, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
      }}>
        {/* Header with glassmorphism */}
        <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-2 sm:gap-0 bg-white/80 backdrop-blur-md rounded-2xl p-4 shadow-lg border border-white/20">
          <h2 className="text-2xl font-bold text-gray-900">
            Welcome, {user?.username || "Administrator"}!
          </h2>
          <div className="flex flex-col sm:flex-row gap-2 items-center">
            <Button
              onClick={() => setShowAllModal(true)}
              className="bg-white/70 hover:bg-white/90 hover:scale-[1.02] text-gray-900 rounded-xl px-4 py-2 font-semibold shadow-sm border border-gray-300 transition-all duration-200 active:scale-[0.98]"
            >
              📋 All Records
            </Button>
            <Button
              onClick={handleLogout}
              className="bg-red-100/70 hover:bg-red-200/90 hover:scale-[1.02] text-red-800 rounded-xl px-4 py-2 font-semibold shadow-sm border border-red-300 transition-all duration-200 active:scale-[0.98]"
            >
              🚪 Log Out
            </Button>
          </div>
        </div>
        {/* Show All Records Modal */}
        {showAllModal && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center px-2">
            <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl max-w-4xl w-full max-h-[85vh] overflow-y-auto p-4 sm:p-6 relative border border-white/30">
              <button
                className="absolute top-3 right-3 text-gray-400 hover:text-red-600 text-3xl font-bold transition-colors"
                onClick={() => setShowAllModal(false)}
                aria-label="Close"
              >
                ×
              </button>
              <h2 className="text-2xl font-bold mb-4 text-gray-900">📊 All Records for {selectedDate}</h2>
              {records.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">📭</div>
                  <p className="text-gray-600 text-lg">No records for this day.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {records.map((rec, idx) => (
                    <div key={rec.id || idx} className="bg-gradient-to-r from-blue-50 to-white rounded-xl p-4 shadow-sm border border-blue-100 hover:shadow-md transition-shadow">
                      <div className="font-semibold text-blue-700 text-base flex flex-wrap gap-2 items-center mb-3">
                        <span className="bg-blue-600 text-white rounded-full px-3 py-1 text-sm font-bold">{idx + 1}</span>
                        <span className="font-bold">{rec.attendant?.username || rec.attendant_id}</span>
                        <span className="text-gray-400">•</span>
                        <span>{pumpMap[rec.pump_id] || rec.pump_id}</span>
                        <span className="text-gray-400">•</span>
                        <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded-lg text-sm">{rec.shift_type?.toUpperCase()}</span>
                        <span className="text-gray-400">•</span>
                        <span className="text-gray-600 text-sm">{rec.shift_date}</span>
                        <span className="text-gray-400">•</span>
                        <span className="text-gray-500 text-xs">{rec.shift_type === 'day' ? '☀️ 6:30am - 3:30pm' : '🌙 3:30pm - 6:30am'}</span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        <div className="bg-white rounded-lg p-2 shadow-sm">💵 Cash: <span className="font-bold text-green-700">{rec.cash_received?.toLocaleString() ?? 0}</span></div>
                        <div className="bg-white rounded-lg p-2 shadow-sm">💳 Prepaid: <span className="font-bold text-blue-700">{rec.prepayment_received?.toLocaleString() ?? 0}</span></div>
                        <div className="bg-white rounded-lg p-2 shadow-sm">🏦 Credit: <span className="font-bold text-purple-700">{rec.credit_received?.toLocaleString() ?? 0}</span></div>
                        <div className="bg-white rounded-lg p-2 shadow-sm">⛽ Fuel Card: <span className="font-bold text-orange-700">{rec.fuel_card_received?.toLocaleString() ?? 0}</span></div>
                        <div className="bg-white rounded-lg p-2 shadow-sm">🏧 FDH: <span className="font-bold text-indigo-700">{rec.fdh_card_received?.toLocaleString() ?? 0}</span></div>
                        <div className="bg-white rounded-lg p-2 shadow-sm">🏦 Nat. Bank: <span className="font-bold text-pink-700">{rec.national_bank_card_received?.toLocaleString() ?? 0}</span></div>
                        <div className="bg-white rounded-lg p-2 shadow-sm">📱 MO: <span className="font-bold text-red-700">{rec.mo_payment_received?.toLocaleString() ?? 0}</span></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
        {/* Filter Bar with iOS styling */}
        <div className="bg-white/80 backdrop-blur-md rounded-2xl p-4 shadow-lg border border-white/20 mb-6">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="font-semibold text-gray-700 text-sm">🔄 Shift:</label>
              <Select onValueChange={(val) => setShift(val)} value={shift}>
                <SelectTrigger className="w-32 rounded-xl bg-white/70 border-gray-200">
                  {shift === "all" ? "All Shifts" : shift.toUpperCase() + " Shift"}
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="day">☀️ Day</SelectItem>
                  <SelectItem value="night">🌙 Night</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center gap-2">
              <label className="font-semibold text-gray-700 text-sm">📅 Date:</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="border border-gray-200 rounded-xl px-3 py-2 bg-white/70 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>
            
            <div className="flex items-center gap-2">
              <label className="font-semibold text-gray-700 text-sm">👤 Attendant:</label>
              <select
                value={selectedAttendant}
                onChange={(e) => setSelectedAttendant(e.target.value)}
                className="border border-gray-200 rounded-xl px-3 py-2 bg-white/70 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              >
                <option value="">All Attendants</option>
                {attendants.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.username}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="flex gap-2 ml-auto">
              <Button onClick={downloadCSV} className="bg-white/70 hover:bg-white/90 hover:scale-[1.02] text-gray-900 rounded-xl px-4 py-2 flex items-center gap-2 font-semibold shadow-sm border border-gray-300 transition-all duration-200 active:scale-[0.98]">
                <Download className="w-4 h-4" /> CSV
              </Button>
              <Button onClick={downloadXLS} className="bg-white/70 hover:bg-white/90 hover:scale-[1.02] text-gray-900 rounded-xl px-4 py-2 flex items-center gap-2 font-semibold shadow-sm border border-gray-300 transition-all duration-200 active:scale-[0.98]">
                <FileText className="w-4 h-4" /> XLS
              </Button>
            </div>
          </div>
        </div>
        {/* Attendants and Shift Records with modern cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Card className="bg-white/80 backdrop-blur-md rounded-2xl shadow-lg border border-white/20">
            <CardContent className="p-6">
              <h2 className="font-bold text-2xl mb-4 text-gray-900 flex items-center gap-2">
                <User className="w-6 h-6 text-blue-600" />
                Attendants
              </h2>
              {isLoading && (
                <div className="flex items-center justify-center py-12">
                  <svg className="animate-spin h-12 w-12 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                  </svg>
                </div>
              )}
              {queryError && (
                <div className="text-center py-8">
                  <p className="text-red-600 font-semibold">⚠️ Error loading summaries</p>
                </div>
              )}
              {filteredRecords.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">👥</div>
                  <p className="text-gray-600 text-lg">No attendants for this day.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {Array.from(new Set(filteredRecords.map(r => r.attendant?.username || r.attendant_id))).map((attendantName) => (
                    <Card
                      key={attendantName}
                      onClick={() => setSelected(selected === attendantName ? null : attendantName)}
                      className={cn(
                        "p-4 cursor-pointer bg-gradient-to-r from-white to-blue-50 hover:from-blue-50 hover:to-blue-100 transition-all duration-200 rounded-xl shadow-sm hover:shadow-md border",
                        selected === attendantName ? "border-2 border-blue-600 ring-2 ring-blue-200" : "border-gray-200"
                      )}
                    >
                      <CardContent className="flex items-center gap-3 p-0">
                        <div className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center font-bold text-white",
                          selected === attendantName ? "bg-blue-600" : "bg-gray-400"
                        )}>
                          {attendantName.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-semibold text-gray-900">{attendantName}</span>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          <Card className="bg-white/80 backdrop-blur-md rounded-2xl shadow-lg border border-white/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-2xl text-gray-900 flex items-center gap-2">
                  <FileText className="w-6 h-6 text-green-600" />
                  Shift Records
                </h2>
                {selectedRecords.size > 0 && (
                  <Button onClick={handleDeleteSelected} className="bg-red-100/70 hover:bg-red-200/90 hover:scale-[1.02] text-red-800 rounded-xl px-4 py-2 font-semibold shadow-sm border border-red-300 transition-all duration-200 active:scale-[0.98]">
                    🗑️ Delete ({selectedRecords.size})
                  </Button>
                )}
              </div>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <svg className="animate-spin h-12 w-12 text-green-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                  </svg>
                </div>
              ) : error ? (
                <div className="text-center py-8">
                  <p className="text-red-600 font-semibold">⚠️ {error}</p>
                </div>
              ) : filteredRecords.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">📝</div>
                  <p className="text-gray-600 text-lg">No records for this day.</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                  {filteredRecords.map((submission, idx) => (
                    <details key={submission.id || idx} className="group rounded-xl bg-gradient-to-r from-white to-green-50 shadow-sm hover:shadow-md transition-all border border-gray-200">
                      <summary className="cursor-pointer p-4 flex items-center gap-3 list-none">
                        <input
                          type="checkbox"
                          className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          checked={selectedRecords.has(submission.id)}
                          onChange={e => handleSelectRecord(submission.id, e.target.checked)}
                          onClick={e => e.stopPropagation()}
                        />
                        <div className="flex-1">
                          <div className="font-bold text-gray-900 flex items-center gap-2 flex-wrap">
                            <User className="w-5 h-5 text-blue-600" />
                            <span>{submission.attendant?.username || submission.attendant_id || 'Unknown'}</span>
                            <span className="text-gray-400">•</span>
                            <Fuel className="w-4 h-4 text-green-600" />
                            <span className="text-sm font-normal text-gray-600">{pumpMap[submission.pump_id] || submission.pump_id || '?'}</span>
                            <span className="text-gray-400">•</span>
                            <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded-lg text-xs font-semibold">{submission.shift_type?.toUpperCase()}</span>
                            <span className="text-gray-400">•</span>
                            <span className="text-sm text-gray-500">{submission.shift_date}</span>
                          </div>
                        </div>
                        <ChevronDown className="w-5 h-5 text-gray-400 group-open:rotate-180 transition-transform" />
                      </summary>
                      <div className="px-4 pb-4 pt-2 space-y-2 border-t border-gray-100">
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div className="flex items-center gap-2 bg-white rounded-lg p-2">
                            <CreditCard className="w-4 h-4 text-yellow-500" />
                            <span>Cash: <strong className="text-gray-900">{submission.cash_received?.toLocaleString() || 0}</strong></span>
                          </div>
                          <div className="flex items-center gap-2 bg-white rounded-lg p-2">
                            <CreditCard className="w-4 h-4 text-green-500" />
                            <span>Prepaid: <strong className="text-gray-900">{submission.prepayment_received?.toLocaleString() || 0}</strong></span>
                          </div>
                          <div className="flex items-center gap-2 bg-white rounded-lg p-2">
                            <CreditCard className="w-4 h-4 text-blue-500" />
                            <span>Credit: <strong className="text-gray-900">{submission.credit_received?.toLocaleString() || 0}</strong></span>
                          </div>
                          <div className="flex items-center gap-2 bg-white rounded-lg p-2">
                            <CreditCard className="w-4 h-4 text-purple-500" />
                            <span>Fuel Card: <strong className="text-gray-900">{submission.fuel_card_received?.toLocaleString() || 0}</strong></span>
                          </div>
                        </div>
                        {(typeof submission.overage === 'number' || typeof submission.shortage === 'number') && (
                          <div className="mt-2">
                            {typeof submission.overage === 'number' && (
                              <div className="bg-green-50 text-green-700 font-bold flex items-center gap-2 p-2 rounded-lg">
                                <TrendingUp className="w-5 h-5" /> Overage: +{submission.overage.toLocaleString()} MWK
                              </div>
                            )}
                            {typeof submission.shortage === 'number' && (
                              <div className="bg-red-50 text-red-700 font-bold flex items-center gap-2 p-2 rounded-lg">
                                <TrendingDown className="w-5 h-5" /> Shortage: {submission.shortage.toLocaleString()} MWK
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </details>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        {/* Attendant summary with modern glassmorphism */}
        {attendant && selected && (
          <Card className="bg-white/90 backdrop-blur-md p-6 shadow-2xl border border-blue-200 mb-8 rounded-3xl">
            <CardContent className="space-y-4 p-4">
              <h2 className="font-bold text-3xl mb-4 flex items-center gap-3 text-blue-900">
                <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white text-xl">
                  {attendant.attendantName.charAt(0).toUpperCase()}
                </div>
                Summary for {attendant.attendantName}
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="flex flex-col items-center bg-gradient-to-br from-blue-50 to-white rounded-2xl p-4 shadow-md hover:shadow-lg transition-shadow">
                  <span className="text-gray-500 text-xs font-semibold uppercase tracking-wide">Shift</span>
                  <span className="font-bold text-blue-700 text-xl mt-1">{attendant.shift === 'day' ? '☀️ Day' : '🌙 Night'}</span>
                </div>
                <div className="flex flex-col items-center bg-gradient-to-br from-purple-50 to-white rounded-2xl p-4 shadow-md hover:shadow-lg transition-shadow">
                  <span className="text-gray-500 text-xs font-semibold uppercase tracking-wide">Date</span>
                  <span className="font-bold text-purple-700 text-xl mt-1">{attendant.date}</span>
                </div>
                <div className="flex flex-col items-center bg-gradient-to-br from-green-50 to-white rounded-2xl p-4 shadow-md hover:shadow-lg transition-shadow">
                  <span className="text-gray-500 text-xs font-semibold uppercase tracking-wide">Opening</span>
                  <span className="font-bold text-green-700 text-xl mt-1">{attendant.openingTotal.toLocaleString()}</span>
                </div>
                <div className="flex flex-col items-center bg-gradient-to-br from-orange-50 to-white rounded-2xl p-4 shadow-md hover:shadow-lg transition-shadow">
                  <span className="text-gray-500 text-xs font-semibold uppercase tracking-wide">Closing</span>
                  <span className="font-bold text-orange-700 text-xl mt-1">{attendant.closingTotal.toLocaleString()}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <div className="flex flex-col items-center bg-gradient-to-br from-yellow-50 to-white rounded-2xl p-3 shadow-md hover:shadow-lg transition-all">
                  <CreditCard className="text-yellow-600 mb-1" size={24} />
                  <span className="text-gray-500 text-xs font-semibold">Cash</span>
                  <span className="font-bold text-lg text-yellow-700">{attendant.cashTotal?.toLocaleString() ?? 0}</span>
                </div>
                <div className="flex flex-col items-center bg-gradient-to-br from-green-50 to-white rounded-2xl p-3 shadow-md hover:shadow-lg transition-all">
                  <CreditCard className="text-green-600 mb-1" size={24} />
                  <span className="text-gray-500 text-xs font-semibold">Prepaid</span>
                  <span className="font-bold text-lg text-green-700">{attendant.prepaids.reduce((sum: number, p: any) => sum + (p.amount || 0), 0).toLocaleString()}</span>
                </div>
                <div className="flex flex-col items-center bg-gradient-to-br from-blue-50 to-white rounded-2xl p-3 shadow-md hover:shadow-lg transition-all">
                  <CreditCard className="text-blue-600 mb-1" size={24} />
                  <span className="text-gray-500 text-xs font-semibold">Credit</span>
                  <span className="font-bold text-lg text-blue-700">{attendant.credits.reduce((sum: number, c: any) => sum + (c.amount || 0), 0).toLocaleString()}</span>
                </div>
                <div className="flex flex-col items-center bg-gradient-to-br from-purple-50 to-white rounded-2xl p-3 shadow-md hover:shadow-lg transition-all">
                  <CreditCard className="text-purple-600 mb-1" size={24} />
                  <span className="text-gray-500 text-xs font-semibold">Fuel Card</span>
                  <span className="font-bold text-lg text-purple-700">{attendant.fuel_card_received?.toLocaleString() ?? 0}</span>
                </div>
                <div className="flex flex-col items-center bg-gradient-to-br from-pink-50 to-white rounded-2xl p-3 shadow-md hover:shadow-lg transition-all">
                  <CreditCard className="text-pink-600 mb-1" size={24} />
                  <span className="text-gray-500 text-xs font-semibold">FDH Card</span>
                  <span className="font-bold text-lg text-pink-700">{attendant.fdh_card_received?.toLocaleString() ?? 0}</span>
                </div>
                <div className="flex flex-col items-center bg-gradient-to-br from-indigo-50 to-white rounded-2xl p-3 shadow-md hover:shadow-lg transition-all">
                  <CreditCard className="text-indigo-600 mb-1" size={24} />
                  <span className="text-gray-500 text-xs font-semibold">Nat. Bank</span>
                  <span className="font-bold text-lg text-indigo-700">{attendant.national_bank_card_received?.toLocaleString() ?? 0}</span>
                </div>
                <div className="flex flex-col items-center bg-gradient-to-br from-red-50 to-white rounded-2xl p-3 shadow-md hover:shadow-lg transition-all">
                  <CreditCard className="text-red-600 mb-1" size={24} />
                  <span className="text-gray-500 text-xs font-semibold">MO Payment</span>
                  <span className="font-bold text-lg text-red-700">{attendant.mo_payment_received?.toLocaleString() ?? 0}</span>
                </div>
                <div className="flex flex-col items-center bg-gradient-to-br from-gray-100 to-white rounded-2xl p-3 shadow-md hover:shadow-lg transition-all">
                  <CreditCard className="text-gray-700 mb-1" size={24} />
                  <span className="text-gray-500 text-xs font-semibold">Own Use</span>
                  <span className="font-bold text-lg text-gray-700">{attendant.own_use_total?.toLocaleString() ?? 0}</span>
                </div>
              </div>
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl p-5 mt-4 shadow-md">
                <p className="font-semibold text-blue-900 mb-3 text-lg">Expected Return: <span className="font-bold text-2xl">{attendant.expectedTotal.toLocaleString()} MWK</span></p>
                {/* Overage/Shortage visually highlighted */}
                {typeof attendant.difference === 'number' && (
                <p className={attendant.difference >= 0 ? "text-green-600 font-bold flex items-center" : "text-red-600 font-bold flex items-center"}>
                  {attendant.difference >= 0 ? <TrendingUp className="w-5 h-5 mr-1" /> : <TrendingDown className="w-5 h-5 mr-1" />}
                  {attendant.difference >= 0 ? `Overage: +${attendant.difference.toLocaleString()} MWK` : `Shortage: ${attendant.difference.toLocaleString()} MWK`}
                </p>
              )}
              {/* List details for Prepaid and Credit if present */}
              {attendant.prepaids.length > 0 && (
                <>
                  <p className="font-semibold mt-2">Prepaid Details:</p>
                  <ul className="ml-4 list-disc">
                    {attendant.prepaids.map((p: any, idx: number) => (
                      <li key={idx}>{p.name} - {p.amount.toLocaleString()} MWK</li>
                    ))}
                  </ul>
                </>
              )}
              {attendant.credits.length > 0 && (
                <>
                  <p className="font-semibold mt-2">Credit Details:</p>
                  <ul className="ml-4 list-disc">
                    {attendant.credits.map((c: any, idx: number) => (
                      <li key={idx}>{c.name} - {c.amount.toLocaleString()} MWK</li>
                    ))}
                  </ul>
                </>
              )}
              </div>
            </CardContent>
          </Card>
        )}
        {/* Charts and summary cards with modern styling */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <Card className="bg-white/80 backdrop-blur-md rounded-2xl shadow-lg border border-white/20">
            <CardContent className="p-6">
              <h3 className="font-bold text-xl mb-4 text-gray-900 flex items-center gap-2">
                <BarChart2 className="w-5 h-5 text-blue-600" />
                Performance Overview
              </h3>
              <div className="flex items-end gap-4 h-40 justify-center">
                {graphData.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="text-4xl mb-2">📊</div>
                    <span className="text-gray-500">No data available</span>
                  </div>
                ) : (
                  (() => {
                    const maxValue = Math.max(...graphData.map(([, value]) => Number(value)));
                    const maxHeight = 110;
                    return graphData.map(([name, value]) => (
                      <div key={name} className="flex flex-col items-center group">
                        <div
                          className="bg-gradient-to-t from-blue-600 to-blue-400 w-10 rounded-t-lg transition-all duration-300 group-hover:from-blue-700 group-hover:to-blue-500 shadow-md"
                          style={{
                            height: maxValue > 0 ? `${Math.max(10, (Number(value) / maxValue) * maxHeight)}px` : '10px',
                          }}
                          title={Number(value).toLocaleString() + " MWK"}
                        ></div>
                        <span className="text-xs mt-2 font-medium text-gray-700">{name}</span>
                        <span className="text-xs font-bold text-blue-600">{Number(value).toLocaleString()}</span>
                      </div>
                    ));
                  })()
                )}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white/80 backdrop-blur-md rounded-2xl shadow-lg border border-white/20">
            <CardContent className="p-6">
              <h3 className="font-bold text-xl mb-4 text-gray-900 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-600" />
                Sales Trend
              </h3>
              <div className="w-full h-64 rounded-xl bg-white/50 p-2">
                {salesGraphData.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full">
                    <div className="text-4xl mb-2">📈</div>
                    <span className="text-gray-500">No data available</span>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={salesGraphData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="date" style={{ fontSize: '12px' }} />
                      <YAxis style={{ fontSize: '12px' }} />
                      <Tooltip />
                      <Legend />
                      {Array.from(new Set(filteredRecords.map(r => r.attendant?.username || r.attendant_id))).map((a, idx) => (
                        <Line key={a} type="monotone" dataKey={a} stroke={`hsl(${(idx * 60) % 360}, 70%, 50%)`} strokeWidth={3} dot={{ r: 4 }} />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <Card className="bg-white/80 backdrop-blur-md rounded-2xl shadow-lg border border-white/20">
            <CardContent className="p-6">
              <h3 className="font-bold text-lg mb-3 text-gray-900 text-center">📊 Volume Distribution</h3>
              {volumeData.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[280px]">
                  <div className="text-4xl mb-2">⛽</div>
                  <span className="text-gray-500">No data available</span>
                </div>
              ) : (
                <PieChart width={300} height={280}>
                  <Pie
                    data={volumeData}
                    dataKey="value"
                    nameKey="name"
                    label
                  >
                    {volumeData.map((_entry: any, idx: number) => (
                      <Cell key={`cell-vol-${idx}`} fill={COLORS[idx % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              )}
            </CardContent>
          </Card>
          <Card className="bg-white/80 backdrop-blur-md rounded-2xl shadow-lg border border-white/20">
            <CardContent className="p-6">
              <h3 className="font-bold text-lg mb-3 text-gray-900 text-center">💰 Revenue Distribution</h3>
              {priceData.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[280px]">
                  <div className="text-4xl mb-2">💵</div>
                  <span className="text-gray-500">No data available</span>
                </div>
              ) : (
                <PieChart width={300} height={280}>
                  <Pie
                    data={priceData}
                    dataKey="value"
                    nameKey="name"
                    label
                  >
                    {priceData.map((_entry: any, idx: number) => (
                      <Cell key={`cell-price-${idx}`} fill={COLORS[idx % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              )}
            </CardContent>
          </Card>
          <Card className="bg-white/80 backdrop-blur-md rounded-2xl shadow-lg border border-white/20">
            <CardContent className="p-6">
              <h3 className="font-bold text-lg mb-3 text-gray-900 text-center">✅ Completion Rate</h3>
              {completionPercent === 0 ? (
                <div className="flex flex-col items-center justify-center h-[280px]">
                  <div className="text-4xl mb-2">📋</div>
                  <span className="text-gray-500">No data available</span>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <RadialBarChart
                    width={280}
                    height={220}
                    cx={140}
                    cy={110}
                    innerRadius={70}
                    outerRadius={90}
                    barSize={18}
                    data={[{ name: 'Completion', value: completionPercent }]}
                    startAngle={90}
                    endAngle={-270}
                  >
                    <RadialBar
                      background
                      dataKey="value"
                      fill="#007aff"
                      cornerRadius={10}
                    />
                    <Tooltip />
                  </RadialBarChart>
                  <div className="text-center mt-2">
                    <div className="text-4xl font-bold text-blue-600">{Math.round(completionPercent)}%</div>
                    <div className="text-sm text-gray-600 font-semibold">Shifts Completed</div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        {/* Summary Analytics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <Card className="bg-gradient-to-br from-blue-50 to-white backdrop-blur-md shadow-lg border border-blue-200 rounded-2xl hover:shadow-xl transition-all">
            <CardContent className="flex flex-col items-center p-6">
              <div className="w-14 h-14 bg-blue-600 rounded-full flex items-center justify-center mb-3">
                <BarChart2 className="text-white" size={28} />
              </div>
              <div className="text-3xl font-bold text-blue-900">{totalRevenue.toLocaleString()}</div>
              <div className="text-sm text-gray-600 font-semibold mt-1">Total Revenue (MWK)</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-green-50 to-white backdrop-blur-md shadow-lg border border-green-200 rounded-2xl hover:shadow-xl transition-all">
            <CardContent className="flex flex-col items-center p-6">
              <div className="w-14 h-14 bg-green-600 rounded-full flex items-center justify-center mb-3">
                <Fuel className="text-white" size={28} />
              </div>
              <div className="text-3xl font-bold text-green-900">{totalVolume.toLocaleString()}</div>
              <div className="text-sm text-gray-600 font-semibold mt-1">Total Volume (Litres)</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-emerald-50 to-white backdrop-blur-md shadow-lg border border-emerald-200 rounded-2xl hover:shadow-xl transition-all">
            <CardContent className="flex flex-col items-center p-6">
              <div className="w-14 h-14 bg-emerald-600 rounded-full flex items-center justify-center mb-3">
                <TrendingUp className="text-white" size={28} />
              </div>
              <div className="text-2xl font-bold text-emerald-900">+{avgOverage.toLocaleString()}</div>
              <div className="text-sm text-gray-600 font-semibold mt-1">Avg Overage (MWK)</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-red-50 to-white backdrop-blur-md shadow-lg border border-red-200 rounded-2xl hover:shadow-xl transition-all">
            <CardContent className="flex flex-col items-center p-6">
              <div className="w-14 h-14 bg-red-600 rounded-full flex items-center justify-center mb-3">
                <TrendingDown className="text-white" size={28} />
              </div>
              <div className="text-2xl font-bold text-red-900">{avgShortage.toLocaleString()}</div>
              <div className="text-sm text-gray-600 font-semibold mt-1">Avg Shortage (MWK)</div>
            </CardContent>
          </Card>
        </div>
        {/* Payment Type Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-4 mb-6">
          <Card className="bg-gradient-to-br from-yellow-50 to-white backdrop-blur-md shadow-md border border-yellow-200 rounded-2xl hover:shadow-lg transition-all">
            <CardContent className="flex flex-col items-center p-4">
              <CreditCard className="text-yellow-600 mb-2" size={24} />
              <div className="text-sm font-semibold text-gray-600">Cash</div>
              <div className="text-xl font-bold text-yellow-900">{summaryTotals.cash.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-green-50 to-white backdrop-blur-md shadow-md border border-green-200 rounded-2xl hover:shadow-lg transition-all">
            <CardContent className="flex flex-col items-center p-4">
              <CreditCard className="text-green-600 mb-2" size={24} />
              <div className="text-sm font-semibold text-gray-600">Prepaid</div>
              <div className="text-xl font-bold text-green-900">{summaryTotals.prepaid.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-blue-50 to-white backdrop-blur-md shadow-md border border-blue-200 rounded-2xl hover:shadow-lg transition-all">
            <CardContent className="flex flex-col items-center p-4">
              <CreditCard className="text-blue-600 mb-2" size={24} />
              <div className="text-sm font-semibold text-gray-600">Credit</div>
              <div className="text-xl font-bold text-blue-900">{summaryTotals.credit.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-purple-50 to-white backdrop-blur-md shadow-md border border-purple-200 rounded-2xl hover:shadow-lg transition-all">
            <CardContent className="flex flex-col items-center p-4">
              <CreditCard className="text-purple-600 mb-2" size={24} />
              <div className="text-sm font-semibold text-gray-600">Fuel Card</div>
              <div className="text-xl font-bold text-purple-900">{summaryTotals.fuelCard.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-pink-50 to-white backdrop-blur-md shadow-md border border-pink-200 rounded-2xl hover:shadow-lg transition-all">
            <CardContent className="flex flex-col items-center p-4">
              <CreditCard className="text-pink-600 mb-2" size={24} />
              <div className="text-sm font-semibold text-gray-600">FDH Card</div>
              <div className="text-xl font-bold text-pink-900">{summaryTotals.fdhCard.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-indigo-50 to-white backdrop-blur-md shadow-md border border-indigo-200 rounded-2xl hover:shadow-lg transition-all">
            <CardContent className="flex flex-col items-center p-4">
              <CreditCard className="text-indigo-600 mb-2" size={24} />
              <div className="text-sm font-semibold text-gray-600">Nat. Bank</div>
              <div className="text-xl font-bold text-indigo-900">{summaryTotals.nationalBankCard.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-red-50 to-white backdrop-blur-md shadow-md border border-red-200 rounded-2xl hover:shadow-lg transition-all">
            <CardContent className="flex flex-col items-center p-4">
              <CreditCard className="text-red-600 mb-2" size={24} />
              <div className="text-sm font-semibold text-gray-600">MO Payment</div>
              <div className="text-xl font-bold text-red-900">{summaryTotals.moPayment.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-gray-100 to-white backdrop-blur-md shadow-md border border-gray-200 rounded-2xl hover:shadow-lg transition-all">
            <CardContent className="flex flex-col items-center p-4">
              <CreditCard className="text-gray-700 mb-2" size={24} />
              <div className="text-sm font-semibold text-gray-600">Own Use</div>
              <div className="text-xl font-bold text-gray-900">{summaryTotals.ownUse.toLocaleString()}</div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
