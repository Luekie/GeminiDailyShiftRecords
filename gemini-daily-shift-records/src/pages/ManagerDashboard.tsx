import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectTrigger, SelectContent, SelectItem } from "@/components/ui/select";
import { cn } from "../lib/utils";
import Layout from "../components/Layout";
import { supabase } from "../lib/supabase";

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
  const [shift, setShift] = useState("day");
  const [selected, setSelected] = useState<string | null>(null);

  const { data: summaries, isLoading, error } = useQuery({
    queryKey: ["manager", shift],
    queryFn: () => fetchSummaries(shift),
  });

  // Debug output
  console.log("summaries", summaries);
  console.log("isLoading", isLoading);
  console.log("error", error);

  const attendant = summaries?.find((s: any) => s.attendantName === selected);

  return (
    <Layout role="manager">
      <div className="p-4 grid gap-4">
        <Select onValueChange={(val) => setShift(val)} defaultValue="day">
          <SelectTrigger className="w-40">{shift.toUpperCase()} Shift</SelectTrigger>
          <SelectContent>
            <SelectItem value="day">Day</SelectItem>
            <SelectItem value="night">Night</SelectItem>
          </SelectContent>
        </Select>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <h2 className="font-bold text-xl">Attendants</h2>
            {isLoading && <p>Loading...</p>}
            {error && <p className="text-red-600">Error loading summaries</p>}
            {summaries?.map((s: any) => (
              <Card
                key={s.attendantName}
                onClick={() => setSelected(s.attendantName)}
                className={cn("p-3 cursor-pointer", selected === s.attendantName && "border-2 border-blue-500")}
              >
                <CardContent>{s.attendantName}</CardContent>
              </Card>
            ))}
          </div>

          {attendant && (
            <div className="space-y-2">
              <h2 className="font-bold text-xl">Summary for {attendant.attendantName}</h2>
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
                      <li key={idx}>{p.name} - {p.amount} MWK</li>
                    ))}
                  </ul>
                  <p>Credit:</p>
                  <ul className="ml-4 list-disc">
                    {attendant.credits.map((c: any, idx: number) => (
                      <li key={idx}>{c.name} - {c.amount} MWK</li>
                    ))}
                  </ul>
                  <p className={attendant.difference >= 0 ? "text-green-600" : "text-red-600"}>
                    {attendant.difference >= 0 ? `Overage: +${attendant.difference}` : `Shortage: ${attendant.difference}`}
                  </p>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
