import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAtomValue } from 'jotai';
import { userAtom } from '../store/auth';
import { useLocation } from 'wouter';

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
  const [modal, setModal] = useState<{ open: boolean; submission: Submission | null }>(
    {
      open: false,
      submission: null,
    }
  );
  const [modalReason, setModalReason] = useState<string>("");
  const [pumpMap, setPumpMap] = useState<Record<string, string>>({});
  const [showPumpDetails, setShowPumpDetails] = useState<Submission | null>(null);
  const [notification, setNotification] = useState<string>("");

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["submissions"] });
      setNotification("Submission approved successfully.");
      setTimeout(() => setNotification(""), 2000);
    },
  });

  const request = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      // Update shift with fix_reason
      await requestFix({ id, reason });
      // Notify attendant (simulate notification)
      setNotification("Attendant notified to fix submission.");
      setTimeout(() => setNotification(""), 2000);
      // Find and show pump details
      const submission = (submissions ?? []).find((s: any) => s.id === id) ?? null;
      setShowPumpDetails(submission);
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["submissions"] });
      setModal({ open: false, submission: null });
      setModalReason("");
    },
  });

  // Logout function
  const handleLogout = async () => {
    await supabase.auth.signOut();
    setLocation("/");
    window.location.reload();
  };

  if (isLoading) return <p>Loading...</p>;
  if (error) return <p className="text-red-600">Error loading submissions</p>;

  // Group submissions by date, then by attendant, then by approval status
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
    <div className="grid gap-4 p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">
          Welcome, {user?.username || "Supervisor"}!
        </h2>
        <Button
          onClick={handleLogout}
          className="bg-red-600 hover:bg-red-700 text-white"
        >
          Log Out
        </Button>
      </div>
      {notification && (
        <div className="bg-green-100 text-green-800 p-2 rounded mb-2 text-center">{notification}</div>
      )}
      {/* Modal for request fix */}
      {modal.open && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded shadow-lg w-full max-w-md">
            <h2 className="text-lg font-bold mb-2">
              Request Fix for{" "}
              {modal.submission ? (modal.submission.attendant?.username || modal.submission.attendant_id) : ""} - Pump{" "}
              {modal.submission ? (pumpMap[modal.submission.pump_id] || modal.submission.pump_id || modal.submission.pump) : "?"}
            </h2>
            <p className="mb-2">
              Shift: {modal.submission?.shift_type} | Date: {modal.submission?.shift_date}
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
                onClick={() => modal.submission && request.mutate({ id: modal.submission.id, reason: modalReason })}
                disabled={request.isPending || !modalReason.trim() || !modal.submission}
              >
                Submit
              </Button>
            </div>
          </div>
        </div>
      )}
      {/* Show pump details after request fix */}
      {showPumpDetails && (
        <div className="bg-white border rounded shadow p-4 mb-4">
          <h3 className="font-bold mb-2">Pump Details</h3>
          <p>Attendant: {showPumpDetails.attendant?.username || showPumpDetails.attendant_id}</p>
          <p>Pump: {pumpMap[showPumpDetails.pump_id] || showPumpDetails.pump_id}</p>
          <p>Shift: {showPumpDetails.shift_type}</p>
          <p>Date: {showPumpDetails.shift_date}</p>
          <p>Opening: {showPumpDetails.opening_reading} | Closing: {showPumpDetails.closing_reading}</p>
          <p>Cash: {showPumpDetails.cash_received} | Prepaid: {showPumpDetails.prepayment_received} | Credit: {showPumpDetails.credit_received}</p>
          <p>Expected: {(showPumpDetails.closing_reading - showPumpDetails.opening_reading) * (showPumpDetails.fuel_price || 0)} MWK</p>
          <Button className="mt-2" onClick={() => setShowPumpDetails(null)}>Close</Button>
        </div>
      )}
      {/* Grouped by date, then by attendant, then by approval status */}
      {Object.keys(groupedByDate).sort((a, b) => b.localeCompare(a)).map(date => (
        <div key={date} className="mb-6">
          <h3 className="font-bold text-lg mb-2">Date: {date}</h3>
          {Object.keys(groupedByDate[date]).map(attendant => (
            <div key={attendant} className="mb-4 ml-4">
              <h4 className="font-semibold text-md mb-1">Attendant: {attendant}</h4>
              <div className="mb-2">
                <span className="font-semibold">Pending:</span>
                {groupedByDate[date][attendant].pending.length === 0 ? (
                  <span className="ml-2 text-gray-500">None</span>
                ) : (
                  groupedByDate[date][attendant].pending.map((submission: any) => (
                    <Card key={submission.id} className="bg-white shadow p-4 my-2">
                      <CardContent>
                        <p className="text-lg font-bold">
                          Pump {pumpMap[submission.pump_id] || submission.pump_id || submission.pump || "?"}
                        </p>
                        <p>Shift: {submission.shift_type}</p>
                        <p className="mt-2 font-medium">
                          Cash: <span className="font-bold">{submission.cash_received} MWK</span>
                        </p>
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
                {groupedByDate[date][attendant]?.approved?.length === 0 ? (
                  <span className="ml-2 text-gray-500">None</span>
                ) : (
                  groupedByDate[date][attendant]?.approved?.map((submission: any) => (
                    <Card key={submission.id} className="bg-green-50 shadow p-4 my-2">
                      <CardContent>
                        <p className="text-lg font-bold">
                          Pump {pumpMap[submission.pump_id] || submission.pump_id || submission.pump || "?"}
                        </p>
                        <p>Shift: {submission.shift_type}</p>
                        <p className="mt-2 font-medium">
                          Cash: <span className="font-bold">{submission.cash_received} MWK</span>
                        </p>
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
      ))}
    </div>
  );
}
