import { Card, CardContent } from "@/components/ui/card";
import { usePreviousSubmissions } from "@/lib/usePreviousSubmissions";
import { Check } from "lucide-react";


export function PreviousSubmissions({ date, pumpMap }: { date: string; pumpMap: Record<string, string> }) {
  const { data, isLoading, error } = usePreviousSubmissions(date);

  if (isLoading) return (
    <div className="min-h-[120px] flex items-center justify-center">
      <svg className="animate-spin h-8 w-8 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
      </svg>
    </div>
  );
  if (error) return <div className="text-red-600 mb-2">Error loading previous submissions</div>;
  if (!data || data.length === 0) return <div className="text-gray-400 mb-2">No previous submissions for this date.</div>;

  return (
    <div
      className="mb-4 p-2 sm:p-4 rounded-xl"
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
      <div className="font-semibold text-blue-700 mb-1">Previous Submissions (Authorised):</div>
      {data.map((sub: any) => (
        <Card
          key={sub.id}
          className="bg-white/50 border shadow-sm mb-2 w-full"
          style={{ borderRadius: 12, border: "1px solid #e5e5ea", background: "rgba(255,255,255,0.5)" }}
        >
          <CardContent style={{ background: "rgba(255,255,255,0.7)", borderRadius: 10 }} className="p-2 sm:p-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-bold">{sub.attendant?.username || sub.attendant_id}</span> - Pump{" "}
                {pumpMap[sub.pump_id] || sub.pump_id}
              </div>
              {sub.is_approved && <span className="text-green-700 font-semibold ml-2">Authorised <Check className="inline w-4 h-4 align-text-bottom" /></span>}
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
