import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAtomValue } from "jotai";
import { userAtom } from "../store/auth";
import { useLocation } from "wouter";
import { PreviousSubmissions } from "./PreviousSubmissions";

const fetchSubmissions = async () => {
  const { data, error } = await supabase
    .from("submissions") // Ensure the table name is correct
    .select("*"); // Ensure the query is valid

  if (error) {
    console.error("Error fetching submissions:", error.message);
    throw error;
  }
  return data ?? [];
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
  const user = useAtomValue(userAtom);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  type Submission = {
    id: string;
    shift_date: string;
    attendant_id: string;
    attendant?: { username: string };
    is_approved: boolean;
    pump_id: string;
    pump?: string;
    shift_type: string;
    opening_reading: number;
    closing_reading: number;
    fuel_price?: number;
    cash_received: number;
    prepayment_received: number;
    credit_received: number;
    fix_reason?: string;
  };

  const { data: submissions = [], isLoading, error } = useQuery<Submission[]>({
    queryKey: ["submissions"],
    queryFn: fetchSubmissions,
  });

  const [modal, setModal] = useState<{ open: boolean; submission: Submission | null }>({
    open: false,
    submission: null,
  });
  const [modalReason, setModalReason] = useState<string>("");
  const [pumpMap, setPumpMap] = useState<Record<string, string>>({});
  // Removed unused showPumpDetails state
  const [notification, setNotification] = useState<string>("");
  const [showPrevious, setShowPrevious] = useState<string | null>(null);

  // Fetch pump names for mapping
  useEffect(() => {
    const fetchPumps = async () => {
      const { data, error } = await supabase.from("pumps").select("id, name");
      if (!error && data) {
        const map: Record<string, string> = {};
        data.forEach((p: any) => {
          map[p.id] = p.name;
        });
        setPumpMap(map);
      }
    };
    fetchPumps();
  }, []);

  const approve = useMutation({
    mutationFn: approveSubmission,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["submissions"] });
      setNotification("Submission approved successfully.");
      setTimeout(() => setNotification(""), 2000);
    },
  });

  const request = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      await requestFix({ id, reason });
      setNotification("Attendant notified to fix submission.");
      setTimeout(() => setNotification(""), 2000);
      // Removed setShowPumpDetails as it's unused
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["submissions"] });
      setModal({ open: false, submission: null });
      setModalReason("");
    },
  });

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setLocation("/");
    window.location.reload();
  };

  if (isLoading) return <p>Loading...</p>;
  if (error) return <p className="text-red-600">Error loading submissions</p>;

  const groupedByDate: Record<string, Record<string, { approved: any[]; pending: any[] }>> = {};
  (submissions || []).forEach((sub: any) => {
    const date = sub.shift_date;
    const attendant = sub.attendant?.username || sub.attendant_id || "Unknown Attendant";
    if (!groupedByDate[date]) groupedByDate[date] = {};
    if (!groupedByDate[date][attendant]) groupedByDate[date][attendant] = { approved: [], pending: [] };
    if (sub.is_approved) groupedByDate[date][attendant].approved.push(sub);
    else groupedByDate[date][attendant].pending.push(sub);
  });

  return (
    <div
      className="min-h-screen p-4"
      style={{
        backgroundImage: 'url("/puma.jpg")',
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backgroundAttachment: 'fixed',
        fontFamily: "San Francisco, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
        color: "#111",
      }}
    >
      {/* Header */}
      <div className="flex justify-between items-center mb-4" style={{ borderBottom: "1px solid #d1d1d6", paddingBottom: "0.5rem", marginBottom: "1.5rem" }}>
        <h2 className="text-2xl font-bold">Welcome, {user?.username || "Supervisor"}!</h2>
        <Button onClick={handleLogout} className="bg-red-600 hover:bg-red-700 text-white" style={{ borderRadius: 8, fontWeight: 600 }}>
          Log Out
        </Button>
      </div>

      {/* Notification */}
      {notification && <div className="bg-green-100 text-green-800 p-2 rounded mb-2 text-center">{notification}</div>}

      {/* Modal */}
      {modal.open && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded shadow-lg w-full max-w-md">
            <h2 className="text-lg font-bold mb-2">Request Fix for {modal.submission?.attendant?.username || modal.submission?.attendant_id}</h2>
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
                onClick={() => modal.submission && request.mutate({ id: modal.submission.id, reason: modalReason })}
                disabled={request.isPending || !modalReason.trim() || !modal.submission}
              >
                Submit
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Previous Submissions */}
      <div className="flex items-center gap-4 mb-6">
        <h3 className="font-bold text-lg" style={{ color: "#111" }}>Previous Submissions</h3>
        <input type="date" value={showPrevious || ""} onChange={(e) => setShowPrevious(e.target.value)} className="border rounded px-2 py-1" />
        <Button variant="outline" size="sm" onClick={() => setShowPrevious(showPrevious ? "" : new Date().toISOString().slice(0, 10))}>
          {showPrevious ? "Hide" : "Show"} Previous Submissions
        </Button>
      </div>
      {showPrevious && <PreviousSubmissions date={showPrevious} pumpMap={pumpMap} />}

      {/* Grouped Submissions */}
      {Object.keys(groupedByDate).length === 0 ? (
        <div className="text-center text-gray-500 text-lg mt-12">No shift submissions to review at this time.</div>
      ) : (
        Object.keys(groupedByDate).sort((a, b) => b.localeCompare(a)).map((date) => (
          <div key={date} className="mb-6">
            {Object.keys(groupedByDate[date]).map((attendant) => (
              <div key={attendant} className="mb-4 ml-4">
                <h4 className="font-semibold text-md mb-1">Attendant: {attendant}</h4>
                <div className="mb-2">
                  <span className="font-semibold">Pending:</span>
                  {groupedByDate[date][attendant].pending.length === 0 ? (
                    <span className="ml-2 text-gray-500">None</span>
                  ) : (
                    groupedByDate[date][attendant].pending.map((submission: any) => (
                      <Card key={submission.id} className="bg-white/80 shadow-md" style={{ borderRadius: 12, border: "1px solid #e5e5ea" }}>
                        <CardContent className="space-y-2 p-4" style={{ background: "#fff", borderRadius: 10 }}>
                          <p className="text-lg font-bold">Pump {pumpMap[submission.pump_id] || submission.pump_id || submission.pump || "?"}</p>
                          <p>Shift: {submission.shift_type}</p>
                          <p className="mt-2 font-medium">Cash: <span className="font-bold">{submission.cash_received} MWK</span></p>
                          <p>Prepaid: <span className="font-bold">{submission.prepayment_received} MWK</span></p>
                          <p>Credit: <span className="font-bold">{submission.credit_received} MWK</span></p>
                          <p>Expected: <span className="font-bold">{(submission.closing_reading - submission.opening_reading) * (submission.fuel_price || 0)} MWK</span></p>
                          <div className="flex items-center gap-2 mt-4">
                            <Button onClick={() => approve.mutate(submission.id)} className="bg-green-600 hover:bg-green-700 text-white">
                              <Check className="w-4 h-4" /> Approve
                            </Button>
                            <Button onClick={() => setModal({ open: true, submission })} className="bg-red-600 hover:bg-red-700 text-white">
                              <X className="w-4 h-4" /> Request Fix
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
                <div>
                  <span className="font-semibold">Approved:</span>
                  {groupedByDate[date][attendant].approved.length === 0 ? (
                    <span className="ml-2 text-gray-500">None</span>
                  ) : (
                    groupedByDate[date][attendant]?.approved?.map((submission: any) => (
                      <Card key={submission.id} className="bg-green-50 shadow p-4 my-2">
                        <CardContent>
                          <p className="text-lg font-bold">Pump {pumpMap[submission.pump_id] || submission.pump_id || submission.pump || "?"}</p>
                          <p>Shift: {submission.shift_type}</p>
                          <p className="mt-2 font-medium">Cash: <span className="font-bold">{submission.cash_received} MWK</span></p>
                          <p>Prepaid: <span className="font-bold">{submission.prepayment_received} MWK</span></p>
                          <p>Credit: <span className="font-bold">{submission.credit_received} MWK</span></p>
                          <p>Expected: <span className="font-bold">{(submission.closing_reading - submission.opening_reading) * (submission.fuel_price || 0)} MWK</span></p>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  );
}