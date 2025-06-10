import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

const fetchSubmissions = async () => {
  const { data, error } = await supabase
    .from("shifts")
    .select("*, attendant:attendant_id(username)")
    .eq("is_approved", false)
    .order("shift_date", { ascending: false });
  if (error) throw error;
  return data;
};

const approveSubmission = async (id: string) => {
  const { data, error } = await supabase
    .from("shifts")
    .update({ is_approved: true })
    .eq("id", id)
    .select();
  if (error) throw error;
  return data;
};

const requestFix = async ({ id, reason }: { id: string; reason: string }) => {
  const { data, error } = await supabase
    .from("shifts")
    .update({ fix_reason: reason })
    .eq("id", id)
    .select();
  if (error) throw error;
  return data;
};

export default function SupervisorApproval() {
  const queryClient = useQueryClient();
  const { data: submissions, isLoading, error } = useQuery({
    queryKey: ["submissions"],
    queryFn: fetchSubmissions,
  });
  const [modal, setModal] = useState<{ open: boolean; submission: any | null }>({
    open: false,
    submission: null,
  });
  const [modalReason, setModalReason] = useState("");
  const [pumpMap, setPumpMap] = useState<Record<string, string>>({});

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

  const approve = useMutation({
    mutationFn: approveSubmission,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["submissions"] }),
  });

  const request = useMutation({
    mutationFn: requestFix,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["submissions"] });
      setModal({ open: false, submission: null });
      setModalReason("");
    },
  });

  if (isLoading) return <p>Loading...</p>;
  if (error) return <p className="text-red-600">Error loading submissions</p>;

  // Group submissions by attendant and pump (no fallback to sub.id)
  const grouped = (submissions || []).reduce((acc: any, sub: any) => {
    if (!sub.pump_id) return acc; // skip if pump_id is missing
    const key = `${sub.attendant_id}-${sub.pump_id}`;
    acc[key] = acc[key] || [];
    acc[key].push(sub);
    return acc;
  }, {});

  return (
    <div className="grid gap-4 p-4">
      {/* Modal for request fix */}
      {modal.open && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded shadow-lg w-full max-w-md">
            <h2 className="text-lg font-bold mb-2">
              Request Fix for{" "}
              {modal.submission.attendant?.username || modal.submission.attendant_id} - Pump{" "}
              {pumpMap[modal.submission.pump_id] || modal.submission.pump_id || modal.submission.pump || "?"}
            </h2>
            <p className="mb-2">
              Shift: {modal.submission.shift_type} | Date: {modal.submission.shift_date}
            </p>
            <textarea
              className="w-full border rounded p-2 mb-4"
              rows={3}
              placeholder="Reason for revision"
              value={modalReason}
              onChange={(e) => setModalReason(e.target.value)}
            />
            <div className="flex gap-2 justify-end">
              <Button onClick={() => setModal({ open: false, submission: null })} variant="outline">
                Cancel
              </Button>
              <Button
                className="bg-red-600 hover:bg-red-700 text-white"
                onClick={() => request.mutate({ id: modal.submission.id, reason: modalReason })}
                disabled={request.isPending || !modalReason.trim()}
              >
                Submit
              </Button>
            </div>
          </div>
        </div>
      )}
      {/* Grouped submissions view */}
      {Object.values(grouped).length > 0 ? (
        (Object.values(grouped) as any[][]).map((group) => {
          const submission = group[0];
          return (
            <Card key={submission.id} className="bg-white shadow p-4">
              <CardContent>
                <p className="text-lg font-bold">
                  {submission.attendant?.username || submission.attendant_id || "Unknown Attendant"} - Pump{" "}
                  {pumpMap[submission.pump_id] || submission.pump_id || submission.pump || "?"}
                </p>
                <p>Shift: {submission.shift_type} | Date: {submission.shift_date}</p>
                <p className="mt-2 font-medium">
                  Cash: <span className="font-bold">{submission.cash_received} MWK</span>
                </p>
                <p>
                  Prepaid: <span className="font-bold">{submission.prepayment_received} MWK</span>
                </p>
                <p>
                  Credit: <span className="font-bold">{submission.credit_received} MWK</span>
                </p>
                <p>
                  Expected:{" "}
                  <span className="font-bold">
                    {submission.expected_amount || ((submission.closing_reading - submission.opening_reading) * (submission.fuel_price || 0))} MWK
                  </span>
                </p>
                <p>
                  Collected:{" "}
                  <span className="font-bold">
                    {(submission.cash_received + submission.prepayment_received + submission.credit_received + (submission.fuel_card_received || 0))} MWK
                  </span>
                </p>
                <p>
                  Opening: <span className="font-bold">{submission.opening_reading}</span> | Closing:{" "}
                  <span className="font-bold">{submission.closing_reading}</span> | Price:{" "}
                  <span className="font-bold">{submission.fuel_price}</span>
                </p>
                <div className="flex items-center gap-2 mt-4">
                  <Button
                    onClick={() => approve.mutate(submission.id)}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    <Check className="w-4 h-4" /> Approve
                  </Button>
                  <Button
                    onClick={() => setModal({ open: true, submission })}
                    className="bg-red-600 hover:bg-red-700 text-white"
                  >
                    <X className="w-4 h-4" /> Request Fix
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })
      ) : (
        <p className="text-center text-gray-500">No pending submissions.</p>
      )}
    </div>
  );
}
