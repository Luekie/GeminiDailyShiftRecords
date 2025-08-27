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
  // Calculate difference
  for (const key in grouped) {
    const g = grouped[key];
    const collected = g.cashTotal + g.prepaids.reduce((s: number, p: any) => s + p.amount, 0) + g.credits.reduce((s: number, c: any) => s + c.amount, 0);
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
  <div className="min-h-screen p-2 sm:p-4" style={{
      backgroundImage: 'url("/puma.jpg")',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
      backgroundAttachment: 'fixed',
      fontFamily: 'San Francisco, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
      color: '#111',
    }}>
  <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-2 sm:gap-0" style={{
        borderBottom: '1px solid #d1d1d6',
        paddingBottom: '0.5rem',
        marginBottom: '1.5rem',
      }}>
        <h2 className="text-2xl font-bold">
          Welcome, {user?.username || "Administrator"}!
        </h2>
  <div className="flex flex-col sm:flex-row gap-2 items-center">
          <Button
            onClick={() => setShowAllModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white"
            style={{ borderRadius: 8, fontWeight: 600 }}
          >
            Show All Records
          </Button>
          <Button
            onClick={handleLogout}
            className="bg-red-600 hover:bg-red-700 text-white"
            style={{ borderRadius: 8, fontWeight: 600 }}
          >
            Log Out
          </Button>
        </div>
      </div>
      {/* Show All Records Modal */}
      {showAllModal && (
  <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-2">
          <div className="bg-white rounded-xl shadow-lg max-w-3xl w-full max-h-[80vh] overflow-y-auto p-2 sm:p-6 relative">
            <button
              className="absolute top-2 right-2 text-gray-500 hover:text-red-600 text-2xl font-bold"
              onClick={() => setShowAllModal(false)}
              aria-label="Close"
            >
              ×
            </button>
            <h2 className="text-xl font-bold mb-2 sm:mb-4">All Records for {selectedDate}</h2>
            {records.length === 0 ? (
              <p className="text-gray-600">No records for this day.</p>
            ) : (
              <div className="space-y-2 sm:space-y-4">
                {records.map((rec, idx) => (
                  <div key={rec.id || idx} className="border-b pb-2 sm:pb-3 mb-2 sm:mb-3">
                    <div className="font-semibold text-blue-700 text-lg flex flex-col sm:flex-row gap-1 sm:gap-2 items-start sm:items-center">
                      <span className="bg-blue-100 text-blue-800 rounded-full px-2 py-0.5 mr-2">{idx + 1}</span>
                      {rec.attendant?.username || rec.attendant_id} <span className="text-gray-500">|</span> {pumpMap[rec.pump_id] || rec.pump_id}
                      <span className="text-gray-500">|</span> {rec.shift_type?.toUpperCase()} Shift
                      <span className="text-gray-500">|</span> {rec.shift_date}
                      <span className="text-gray-500">|</span> {rec.shift_type === 'day' ? '6:30am - 3:30pm' : '3:30pm - 6:30am'}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mt-2 text-sm">
                      <div>Cash: <span className="font-bold">{rec.cash_received?.toLocaleString() ?? 0} MWK</span></div>
                      <div>Prepaid: <span className="font-bold">{rec.prepayment_received?.toLocaleString() ?? 0} MWK</span></div>
                      <div>Credit: <span className="font-bold">{rec.credit_received?.toLocaleString() ?? 0} MWK</span></div>
                      <div>Fuel Card: <span className="font-bold">{rec.fuel_card_received?.toLocaleString() ?? 0} MWK</span></div>
                      <div>FDH Card: <span className="font-bold">{rec.fdh_card_received?.toLocaleString() ?? 0} MWK</span></div>
                      <div>National Bank Card: <span className="font-bold">{rec.national_bank_card_received?.toLocaleString() ?? 0} MWK</span></div>
                      <div>MO Payment: <span className="font-bold">{rec.mo_payment_received?.toLocaleString() ?? 0} MWK</span></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      {/* Filter Bar: Shift, Date, Attendant, Export */}
      <div className="flex flex-wrap items-center gap-4 mb-6 bg-white/50 rounded-lg p-3 shadow">
        <label className="font-semibold" style={{ color: '#333' }}>Shift:</label>
        <Select onValueChange={(val) => setShift(val)} value={shift}>
          <SelectTrigger className="w-32">
            {shift === "all" ? "All Shifts" : shift.toUpperCase() + " Shift"}
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="day">Day</SelectItem>
            <SelectItem value="night">Night</SelectItem>
          </SelectContent>
        </Select>
        <label className="font-semibold ml-2" style={{ color: '#333' }}>Date:</label>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="border rounded px-2 py-1 w-40" />
        <label className="font-semibold ml-2" style={{ color: '#333' }}>
          Attendant:
        </label>
        <select
          value={selectedAttendant}
          onChange={(e) => setSelectedAttendant(e.target.value)}
          className="border rounded px-2 py-1 w-40"
        >
          <option value="">All</option>
          {attendants.map((a) => (
            <option key={a.id} value={a.id}>
              {a.username}
            </option>
          ))}
        </select>
        <Button onClick={downloadCSV} className="ml-2 flex items-center gap-2">
          <Download className="w-4 h-4" /> Download CSV
        </Button>
        <Button onClick={downloadXLS} className="ml-2 flex items-center gap-2">
          <FileText className="w-4 h-4" /> Download XLS
        </Button>
        
      </div>
      {/* Attendants and Shift Records at the top */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Card className="bg-white/50">
          <CardContent>
            <h2 className="font-bold text-xl">Attendants</h2>
            {isLoading && (
              <div className="flex items-center justify-center py-8">
                <svg className="animate-spin h-10 w-10 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                </svg>
              </div>
            )}
            {queryError && (
              <p className="text-red-600">Error loading summaries</p>
            )}
            {filteredRecords.length === 0 ? (
              <p className="text-white">No attendants for this day.</p>
            ) : (
              Array.from(new Set(filteredRecords.map(r => r.attendant?.username || r.attendant_id))).map((attendantName) => (
                <Card
                  key={attendantName}
                  onClick={() => setSelected(selected === attendantName ? null : attendantName)}
                  className={cn(
                    "p-3 cursor-pointer bg-white/50",
                    selected === attendantName && "border-2 border-blue-500"
                  )}
                >
                  <CardContent>{attendantName}</CardContent>
                </Card>
              ))
            ) }
          </CardContent>
        </Card>
        <Card className="bg-white/50">
          <CardContent>
            <h2 className="font-bold text-xl mb-4 flex items-center gap-4">Shift Records
              {selectedRecords.size > 0 && (
                <Button onClick={handleDeleteSelected} className="ml-4 bg-red-600 hover:bg-red-700 text-white">Delete Selected</Button>
              )}
            </h2>
            {loading ? (
              <p>Loading records...</p>
            ) : error ? (
              <p className="text-red-600">{error}</p>
            ) : filteredRecords.length === 0 ? (
              <p className="text-white">No records for this day.</p>
            ) : (
              <div className="space-y-2">
                {filteredRecords.map((submission, idx) => (
                  <details key={submission.id || idx} className="mb-2 rounded-xl bg-white/70 shadow p-4 transition-all">
                    <summary className="cursor-pointer text-lg font-bold text-blue-700 flex items-center gap-2">
                      <input
                        type="checkbox"
                        className="mr-2"
                        checked={selectedRecords.has(submission.id)}
                        onChange={e => handleSelectRecord(submission.id, e.target.checked)}
                        onClick={e => e.stopPropagation()}
                      />
                      <User className="w-5 h-5 text-blue-400" />
                      Attendant: {submission.attendant?.username || submission.attendant_id || 'Unknown Attendant'}
                      <ChevronDown className="ml-2 w-4 h-4 text-gray-400" />
                      <span className="text-base font-normal text-gray-500 ml-2">
                        <Fuel className="inline w-4 h-4 text-green-400 mr-1" />
                        {pumpMap[submission.pump_id] || submission.pump_id || submission.pump || '?'}
                        , {submission.shift_type}, {submission.shift_date}
                      </span>
                    </summary>
                    <div className="mt-3 space-y-1 text-base">
                      <p><CreditCard className="inline w-4 h-4 text-yellow-500 mr-1" /> Cash: <span className="font-bold text-gray-900">{submission.cash_received} MWK</span></p>
                      <p><CreditCard className="inline w-4 h-4 text-green-500 mr-1" /> Prepaid: <span className="font-bold text-gray-900">{submission.prepayment_received} MWK</span></p>
                      <p><CreditCard className="inline w-4 h-4 text-blue-500 mr-1" /> Credit: <span className="font-bold text-gray-900">{submission.credit_received} MWK</span></p>
                      <p>Fuel Card: <span className="font-bold text-gray-900">{submission.fuel_card_received || 0} MWK</span></p>
                      <p>FDH Card: <span className="font-bold text-gray-900">{submission.fdh_card_received || 0} MWK</span></p>
                      <p>National Bank Card: <span className="font-bold text-gray-900">{submission.national_bank_card_received || 0} MWK</span></p>
                      <p>MO Payment: <span className="font-bold text-gray-900">{submission.mo_payment_received || 0} MWK</span></p>
                      <p>Own Use Total: <span className="font-bold text-gray-900">{submission.own_use_total || 0} MWK</span></p>
                      {submission.own_use && Array.isArray(submission.own_use) && submission.own_use.length > 0 && (
                        <div>
                          <p className="font-semibold mt-2">Own Use Details:</p>
                          <ul className="ml-4 list-disc">
                            {submission.own_use.map((item: any, idx: number) => (
                              <li key={idx}>{item.description || 'Own Use'}: {item.amount} L</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {typeof submission.overage === 'number' && (
                        <p className="text-green-600 font-bold flex items-center"><TrendingUp className="w-4 h-4 mr-1" /> Overage: +{submission.overage} MWK</p>
                      )}
                      {typeof submission.shortage === 'number' && (
                        <p className="text-red-600 font-bold flex items-center"><TrendingDown className="w-4 h-4 mr-1" /> Shortage: {submission.shortage} MWK</p>
                      )}
                    </div>
                  </details>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      {/* Attendant summary after records */}
      {attendant && selected && (
        <Card className="bg-white/50 p-6 shadow-lg border border-blue-200 mb-8 rounded-2xl">
          <CardContent className="space-y-3 p-4 rounded-xl">
            <h2 className="font-bold text-2xl mb-3 flex items-center gap-2 text-blue-800">
              <User className="w-7 h-7 text-blue-400" /> Summary for {attendant.attendantName}
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-2">
              <div className="flex flex-col items-center bg-white/80 rounded-xl p-3 shadow">
                <span className="text-gray-500 text-xs">Shift</span>
                <span className="font-semibold text-blue-700 text-lg">{attendant.shift}</span>
              </div>
              <div className="flex flex-col items-center bg-white/80 rounded-xl p-3 shadow">
                <span className="text-gray-500 text-xs">Date</span>
                <span className="font-semibold text-blue-700 text-lg">{attendant.date}</span>
              </div>
              <div className="flex flex-col items-center bg-white/80 rounded-xl p-3 shadow">
                <span className="text-gray-500 text-xs">Opening Total</span>
                <span className="font-semibold text-blue-700 text-lg">{attendant.openingTotal.toLocaleString()} MWK</span>
              </div>
              <div className="flex flex-col items-center bg-white/80 rounded-xl p-3 shadow">
                <span className="text-gray-500 text-xs">Closing Total</span>
                <span className="font-semibold text-blue-700 text-lg">{attendant.closingTotal.toLocaleString()} MWK</span>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-2">
              <div className="flex flex-col items-center bg-blue-50 rounded-xl p-3 shadow">
                <CreditCard className="text-yellow-500 mb-1" />
                <span className="text-gray-500 text-xs">Cash</span>
                <span className="font-bold text-lg">{attendant.cashTotal?.toLocaleString() ?? 0} MWK</span>
              </div>
              <div className="flex flex-col items-center bg-green-50 rounded-xl p-3 shadow">
                <CreditCard className="text-green-500 mb-1" />
                <span className="text-gray-500 text-xs">Prepaid</span>
                <span className="font-bold text-lg">{attendant.prepaids.reduce((sum: number, p: any) => sum + (p.amount || 0), 0).toLocaleString()} MWK</span>
              </div>
              <div className="flex flex-col items-center bg-blue-100 rounded-xl p-3 shadow">
                <CreditCard className="text-blue-500 mb-1" />
                <span className="text-gray-500 text-xs">Credit</span>
                <span className="font-bold text-lg">{attendant.credits.reduce((sum: number, c: any) => sum + (c.amount || 0), 0).toLocaleString()} MWK</span>
              </div>
              <div className="flex flex-col items-center bg-purple-50 rounded-xl p-3 shadow">
                <CreditCard className="text-purple-500 mb-1" />
                <span className="text-gray-500 text-xs">Fuel Card</span>
                <span className="font-bold text-lg">{attendant.fuel_card_received?.toLocaleString() ?? 0} MWK</span>
              </div>
              <div className="flex flex-col items-center bg-pink-50 rounded-xl p-3 shadow">
                <CreditCard className="text-pink-500 mb-1" />
                <span className="text-gray-500 text-xs">FDH Card</span>
                <span className="font-bold text-lg">{attendant.fdh_card_received?.toLocaleString() ?? 0} MWK</span>
              </div>
              <div className="flex flex-col items-center bg-indigo-50 rounded-xl p-3 shadow">
                <CreditCard className="text-indigo-500 mb-1" />
                <span className="text-gray-500 text-xs">National Bank Card</span>
                <span className="font-bold text-lg">{attendant.national_bank_card_received?.toLocaleString() ?? 0} MWK</span>
              </div>
              <div className="flex flex-col items-center bg-red-50 rounded-xl p-3 shadow">
                <CreditCard className="text-red-500 mb-1" />
                <span className="text-gray-500 text-xs">MO Payment</span>
                <span className="font-bold text-lg">{attendant.mo_payment_received?.toLocaleString() ?? 0} MWK</span>
              </div>
              <div className="flex flex-col items-center bg-gray-100 rounded-xl p-3 shadow">
                <CreditCard className="text-gray-700 mb-1" />
                <span className="text-gray-500 text-xs">Own Use Total</span>
                <span className="font-bold text-lg">{attendant.own_use_total?.toLocaleString() ?? 0} MWK</span>
              </div>
            </div>
            <div className="bg-white/50 rounded-xl p-4 mt-2 flex flex-col gap-2">
              <p className="font-semibold text-blue-700 mb-1">Expected Return: <span className="font-bold">{attendant.expectedTotal.toLocaleString()} MWK</span></p>
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
      {/* Charts and summary cards below */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
        <Card className="bg-white/50">
          <CardContent>
            <h3 className="font-semibold mb-2">Performance (Total Collected per Attendant)</h3>
            <div className="flex items-end gap-4 h-40 mt-6"> {/* Added mt-6 for top margin */}
              {graphData.length === 0 ? (
                <span className="text-white">No data</span>
              ) : (
                (() => {
                  const maxValue = Math.max(...graphData.map(([, value]) => Number(value)));
                  const maxHeight = 110; // Reduced from 140 to 110
                  return graphData.map(([name, value]) => (
                    <div key={name} className="flex flex-col items-center">
                      <div
                        className="bg-blue-500 w-8 transition-all duration-300"
                        style={{
                          height: maxValue > 0 ? `${Math.max(10, (Number(value) / maxValue) * maxHeight)}px` : '10px',
                        }}
                        title={Number(value).toLocaleString() + " MWK"}
                      ></div>
                      <span className="text-xs mt-1">{name}</span>
                      <span className="text-xs font-bold">{Number(value).toLocaleString()}</span>
                    </div>
                  ));
                })
              ())}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white/50">
          <CardContent>
            <h3 className="font-semibold mb-2">Sales Graph (Total Collected per Attendant per Date)</h3>
            <div className="w-full h-64 rounded shadow p-2">
              {salesGraphData.length === 0 ? (
                <div className="flex items-center justify-center h-full text-gray-500">No data available</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={salesGraphData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    {Array.from(new Set(filteredRecords.map(r => r.attendant?.username || r.attendant_id))).map((a, idx) => (
                      <Line key={a} type="monotone" dataKey={a} stroke={`hsl(${(idx * 60) % 360}, 70%, 50%)`} strokeWidth={2} dot={false} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-4">
        <Card className="bg-white/50">
          <CardContent>
            {volumeData.length === 0 ? (
              <div className="flex items-center justify-center h-[300px] text-gray-500">No data available</div>
            ) : (
              <PieChart width={300} height={300}>
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
            <div className="text-center font-semibold mt-2">Volume by Pump/Attendant</div>
          </CardContent>
        </Card>
        <Card className="bg-white/50">
          <CardContent>
            {priceData.length === 0 ? (
              <div className="flex items-center justify-center h-[300px] text-gray-500">No data available</div>
            ) : (
              <PieChart width={300} height={300}>
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
            <div className="text-center font-semibold mt-2">Revenue by Pump/Attendant</div>
          </CardContent>
        </Card>
        <Card className="bg-white/50">
          <CardContent>
            {completionPercent === 0 ? (
              <div className="flex items-center justify-center h-[200px] text-gray-500">No data available</div>
            ) : (
              <RadialBarChart
                width={200}
                height={200}
                cx={100}
                cy={100}
                innerRadius={80}
                outerRadius={100}
                barSize={20}
                data={[{ name: 'Completion', value: completionPercent }]}
                startAngle={90}
                endAngle={-270}
              >
                <RadialBar
                  background
                  dataKey="value"
                  fill="#007aff" />
                <Tooltip />
              </RadialBarChart>
            )}
            <div className="text-center font-semibold mt-2">{Math.round(completionPercent)}% Complete</div>
          </CardContent>
        </Card>
      </div>
      {/* Summary Analytics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card className="bg-white/70 shadow border border-gray-200 flex flex-col items-center justify-center p-4">
          <CardContent className="flex flex-col items-center">
            <BarChart2 className="text-blue-500 mb-2" size={32} />
            <div className="text-2xl font-bold">{totalRevenue.toLocaleString()} MWK</div>
            <div className="text-gray-600">Total Revenue</div>
          </CardContent>
        </Card>
        <Card className="bg-white/70 shadow border border-gray-200 flex flex-col items-center justify-center p-4">
          <CardContent className="flex flex-col items-center">
            <Fuel className="text-green-500 mb-2" size={32} />
            <div className="text-2xl font-bold">{totalVolume.toLocaleString()} L</div>
            <div className="text-gray-600">Total Volume</div>
          </CardContent>
        </Card>
        <Card className="bg-white/70 shadow border border-gray-200 flex flex-col items-center justify-center p-4">
          <CardContent className="flex flex-col items-center">
            <TrendingUp className="text-green-600 mb-2" size={32} />
            <div className="text-xl font-bold">Avg Overage</div>
            <div className="text-lg text-green-700">+{avgOverage.toLocaleString()} MWK</div>
            <div className="text-gray-600">Avg per Shift</div>
          </CardContent>
        </Card>
        <Card className="bg-white/70 shadow border border-gray-200 flex flex-col items-center justify-center p-4">
          <CardContent className="flex flex-col items-center">
            <TrendingDown className="text-red-600 mb-2" size={32} />
            <div className="text-xl font-bold">Avg Shortage</div>
            <div className="text-lg text-red-700">{avgShortage.toLocaleString()} MWK</div>
            <div className="text-gray-600">Avg per Shift</div>
          </CardContent>
        </Card>
      </div>
      {/* Payment Type Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card className="bg-white/80 shadow border border-gray-200 flex flex-col items-center justify-center p-4">
          <CardContent className="flex flex-col items-center">
            <CreditCard className="text-yellow-500 mb-2" size={32} />
            <div className="text-xl font-bold">Cash</div>
            <div className="text-2xl font-bold">{summaryTotals.cash.toLocaleString()} MWK</div>
          </CardContent>
        </Card>
        <Card className="bg-white/80 shadow border border-gray-200 flex flex-col items-center justify-center p-4">
          <CardContent className="flex flex-col items-center">
            <CreditCard className="text-green-500 mb-2" size={32} />
            <div className="text-xl font-bold">Prepaid</div>
            <div className="text-2xl font-bold">{summaryTotals.prepaid.toLocaleString()} MWK</div>
          </CardContent>
        </Card>
        <Card className="bg-white/80 shadow border border-gray-200 flex flex-col items-center justify-center p-4">
          <CardContent className="flex flex-col items-center">
            <CreditCard className="text-blue-500 mb-2" size={32} />
            <div className="text-xl font-bold">Credit</div>
            <div className="text-2xl font-bold">{summaryTotals.credit.toLocaleString()} MWK</div>
          </CardContent>
        </Card>
        <Card className="bg-white/80 shadow border border-gray-200 flex flex-col items-center justify-center p-4">
          <CardContent className="flex flex-col items-center">
            <CreditCard className="text-purple-500 mb-2" size={32} />
            <div className="text-xl font-bold">Fuel Card</div>
            <div className="text-2xl font-bold">{summaryTotals.fuelCard.toLocaleString()} MWK</div>
          </CardContent>
        </Card>
        <Card className="bg-white/80 shadow border border-gray-200 flex flex-col items-center justify-center p-4">
          <CardContent className="flex flex-col items-center">
            <CreditCard className="text-pink-500 mb-2" size={32} />
            <div className="text-xl font-bold">FDH Card</div>
            <div className="text-2xl font-bold">{summaryTotals.fdhCard.toLocaleString()} MWK</div>
          </CardContent>
        </Card>
        <Card className="bg-white/80 shadow border border-gray-200 flex flex-col items-center justify-center p-4">
          <CardContent className="flex flex-col items-center">
            <CreditCard className="text-indigo-500 mb-2" size={32} />
            <div className="text-xl font-bold">National Bank Card</div>
            <div className="text-2xl font-bold">{summaryTotals.nationalBankCard.toLocaleString()} MWK</div>
          </CardContent>
        </Card>
        <Card className="bg-white/80 shadow border border-gray-200 flex flex-col items-center justify-center p-4">
          <CardContent className="flex flex-col items-center">
            <CreditCard className="text-red-500 mb-2" size={32} />
            <div className="text-xl font-bold">MO Payment</div>
            <div className="text-2xl font-bold">{summaryTotals.moPayment.toLocaleString()} MWK</div>
          </CardContent>
        </Card>
        <Card className="bg-white/80 shadow border border-gray-200 flex flex-col items-center justify-center p-4">
          <CardContent className="flex flex-col items-center">
            <CreditCard className="text-gray-700 mb-2" size={32} />
            <div className="text-xl font-bold">Own Use Total</div>
            <div className="text-2xl font-bold">{summaryTotals.ownUse.toLocaleString()} MWK</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
