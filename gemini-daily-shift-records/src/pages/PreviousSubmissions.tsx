import { Card, CardContent } from "@/components/ui/card";
import { usePreviousSubmissions } from "@/lib/usePreviousSubmissions";
import { Check } from "lucide-react";


export function PreviousSubmissions({ date, pumpMap }: { date: string; pumpMap: Record<string, string> }) {
  const { data, isLoading, error } = usePreviousSubmissions(date);

  if (isLoading) return <div className="text-gray-500 mb-2">Loading previous submissions...</div>;
  if (error) return <div className="text-red-600 mb-2">Error loading previous submissions</div>;
  if (!data || data.length === 0) return <div className="text-gray-400 mb-2">No previous submissions for this date.</div>;

  return (
    <div
      className="mb-4 p-4 rounded-xl"
      style={{
         backgroundImage: 'url("/puma.jpg")', // Replace with your image path
         backgroundSize: 'cover', // Ensures the image covers the entire screen
         backgroundPosition: 'center', // Centers the image
         backgroundRepeat: 'no-repeat',
         backgroundAttachment: 'fixed',
        fontFamily:
          "San Francisco, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
        color: "#111",
      }}
    >
      <div className="font-semibold text-blue-700 mb-1">Previous Submissions:</div>
      {data.map((sub: any) => (
        <Card
          key={sub.id}
          className="bg-white/80 border shadow-sm mb-2"
          style={{ borderRadius: 12, border: "1px solid #e5e5ea" }}
        >
          <CardContent style={{ background: "#fff", borderRadius: 10 }}>
            <div className="flex items-center justify-between">
              <div>
                <span className="font-bold">{sub.attendant?.username || sub.attendant_id}</span> - Pump{" "}
                {pumpMap[sub.pump_id] || sub.pump_id}
              </div>
              {sub.is_approved && <Check className="text-green-600 w-4 h-4" />}
            </div>
            <div className="text-sm text-gray-700">
              Shift: {sub.shift_type} | Opening: {sub.opening_reading} | Closing: {sub.closing_reading} | Cash:{" "}
              {sub.cash_received} | Prepaid: {sub.prepayment_received} | Credit: {sub.credit_received}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
