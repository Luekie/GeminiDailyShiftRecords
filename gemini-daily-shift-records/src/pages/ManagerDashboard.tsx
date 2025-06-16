import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectTrigger, SelectContent, SelectItem } from "@/components/ui/select";
import { cn } from "../lib/utils";
import { supabase } from "../lib/supabase";
import { useAtomValue } from "jotai";
import { userAtom } from "../store/auth";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

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
  const [shift, setShift] = useState("day");
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().slice(0, 10);
  });
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attendants] = useState<any[]>([]);
  const [selectedAttendant, setSelectedAttendant] = useState<string>("");

  const { data: summaries, isLoading, error: queryError } = useQuery({
    queryKey: ["manager", shift],
    queryFn: () => fetchSummaries(shift),
  });

  useEffect(() => {
    const fetchRecords = async () => {
      setLoading(true);
      setError(null);
      const { data, error } = await supabase
        .from("shifts")
        .select("*, attendant:attendant_id(username)")
        .eq("shift_date", selectedDate)
        .order("shift_date", { ascending: false });
      if (error) {
        setError("Failed to fetch records");
        setRecords([]);
      } else {
        setRecords(data || []);
      }
      setLoading(false);
    };
    fetchRecords();
  }, [selectedDate]);

  // Logout function
  const handleLogout = async () => {
    await supabase.auth.signOut();
    setLocation("/");
    window.location.reload();
  };

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
      rec.pump_id,
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

  // Simple bar graph for performance (total collected per attendant)
  const graphData = (() => {
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

  const attendant = summaries?.find((s: any) => s.attendantName === selected);

  return (
    <div className="p-4 grid gap-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">
          Welcome, {user?.username || "Administrator"}!
        </h2>
        <Button
          onClick={handleLogout}
          className="bg-red-600 hover:bg-red-700 text-white"
        >
          Log Out
        </Button>
      </div>
      <Select onValueChange={(val) => setShift(val)} defaultValue="day">
        <SelectTrigger className="w-40">
          {shift.toUpperCase()} Shift
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="day">Day</SelectItem>
          <SelectItem value="night">Night</SelectItem>
        </SelectContent>
      </Select>

      <div className="flex items-center gap-4 mb-4">
        <label className="font-semibold">Select Date:</label>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="border rounded px-2 py-1"
        />
        <label className="font-semibold ml-4">Attendant:</label>
        <select
          value={selectedAttendant}
          onChange={(e) => setSelectedAttendant(e.target.value)}
          className="border rounded px-2 py-1"
        >
          <option value="">All</option>
          {attendants.map((a) => (
            <option key={a.id} value={a.id}>
              {a.username}
            </option>
          ))}
        </select>
        <Button onClick={downloadCSV} className="ml-4">
          Download CSV
        </Button>
      </div>
      {/* Simple bar graph */}
      <div className="mb-4">
        <h3 className="font-semibold mb-2">
          Performance (Total Collected per Attendant)
        </h3>
        <div className="flex items-end gap-4 h-40">
          {graphData.length === 0 ? (
            <span className="text-gray-400">No data</span>
          ) : (
            graphData.map(([name, value]) => (
              <div key={name} className="flex flex-col items-center">
                <div
                  className="bg-blue-500 w-8"
                  style={{ height: `${Math.max(10, value / 1000)}px` }}
                  title={value.toLocaleString() + " MWK"}
                ></div>
                <span className="text-xs mt-1">{name}</span>
              </div>
            ))
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <h2 className="font-bold text-xl">Attendants</h2>
          {isLoading && <p>Loading...</p>}
          {queryError && (
            <p className="text-red-600">Error loading summaries</p>
          )}
          {summaries?.map((s: any) => (
            <Card
              key={s.attendantName}
              onClick={() => setSelected(s.attendantName)}
              className={cn(
                "p-3 cursor-pointer",
                selected === s.attendantName && "border-2 border-blue-500"
              )}
            >
              <CardContent>{s.attendantName}</CardContent>
            </Card>
          ))}
        </div>

        {attendant && (
          <div className="space-y-2">
            <h2 className="font-bold text-xl">
              Summary for {attendant.attendantName}
            </h2>
            <Card className="p-4">
              <CardContent className="space-y-2">
                <p>Shift: {attendant.shift}</p>
                <p>Date: {attendant.date}</p>
                <p>Opening Total: {attendant.openingTotal} MWK</p>
                <p>Closing Total: {attendant.closingTotal} MWK</p>
                <p>Expected Return: {attendant.expectedTotal} MWK</p>
                <p>Cash Collected: {attendant.cashTotal} MWK</p>
                <p>Prepaid:</p>
                <ul className="ml-4 list-disc">
                  {attendant.prepaids.map((p: any, idx: number) => (
                    <li key={idx}>
                      {p.name} - {p.amount} MWK
                    </li>
                  ))}
                </ul>
                <p>Credit:</p>
                <ul className="ml-4 list-disc">
                  {attendant.credits.map((c: any, idx: number) => (
                    <li key={idx}>
                      {c.name} - {c.amount} MWK
                    </li>
                  ))}
                </ul>
                <p
                  className={
                    attendant.difference >= 0
                      ? "text-green-600"
                      : "text-red-600"
                  }
                >
                  {attendant.difference >= 0
                    ? `Overage: +${attendant.difference}`
                    : `Shortage: ${attendant.difference}`}
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <div className="mt-8">
        <h2 className="font-bold text-xl mb-4">Shift Records</h2>
        {loading ? (
          <p>Loading records...</p>
        ) : error ? (
          <p className="text-red-600">{error}</p>
        ) : filteredRecords.length === 0 ? (
          <p className="text-gray-500">No records for this day.</p>
        ) : (
          <div className="space-y-2">
            {filteredRecords.map((rec, idx) => (
              <div
                key={rec.id || idx}
                className="border rounded p-2 bg-white shadow"
              >
                <div className="font-semibold">
                  Attendant: {rec.attendant?.username || rec.attendant_id}
                </div>
                <div>Pump: {rec.pump_id}</div>
                <div>Shift: {rec.shift_type}</div>
                <div>Date: {rec.shift_date}</div>
                <div>
                  Opening: {rec.opening_reading} | Closing:{" "}
                  {rec.closing_reading}
                </div>
                <div>
                  Cash: {rec.cash_received} | Prepaid:{" "}
                  {rec.prepayment_received} | Credit: {rec.credit_received}
                </div>
                <div>
                  Expected:{" "}
                  {(rec.closing_reading - rec.opening_reading) *
                    (rec.fuel_price || 0)}{" "}
                  MWK
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
