import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAtomValue } from "jotai";
import { userAtom } from "../store/auth";
import { useLocation } from "wouter";
import { fetchShiftsForDate } from "@/lib/useFetchShiftsForDate";


const authoriseSubmission = async (id: string) => {
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

  const [selectedDate, setSelectedDate] = useState(() => {
  const today = new Date();
  return today.toISOString().slice(0, 10);
});

const { data: submissions = [], isLoading, error } = useQuery({
  queryKey: ['submissions', selectedDate],
  queryFn: () => fetchShiftsForDate(selectedDate),
});

  const [modal, setModal] = useState<{ open: boolean; submission: Submission | null }>({
    open: false,
    submission: null,
  });
  const [modalReason, setModalReason] = useState<string>("");
  const [pumpMap, setPumpMap] = useState<Record<string, string>>({});
  const [notification, setNotification] = useState<string>("");
  const [shiftFilter, setShiftFilter] = useState<'all' | 'day' | 'night'>('all');
  // Section selection state
const [section, setSection] = useState<'authorised' | 'pending' | 'fix'>('pending');

  // Flat filtered submissions
  const filteredSubmissions = (submissions || []).filter((sub: any) => {
    if (shiftFilter !== 'all' && sub.shift_type !== shiftFilter) return false;
    // Only show submissions for the selected date
    if (sub.shift_date !== selectedDate) return false;
    return true;
  });

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

  const authorise = useMutation({
    mutationFn: authoriseSubmission,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["submissions"] });
      setNotification("Submission Authorised successfully.");
      setTimeout(() => setNotification(""), 2000);
    },
  });

  const request = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      await requestFix({ id, reason });
      setNotification("Attendant notified to fix submission.");
      setTimeout(() => setNotification(""), 2000);
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

  // Categorize submissions
  const authorised = filteredSubmissions.filter((s: any) => s.is_approved);
  const pending = filteredSubmissions.filter((s: any) => !s.is_approved && !s.fix_reason);
  const requestedFix = filteredSubmissions.filter((s: any) => !!s.fix_reason);

  // State for approved history drilldown
  const [authorisedAttendant, setAuthorisedAttendant] = useState<string | null>(null);
  const [authorisedPump, setAuthorisedPump] = useState<string | null>(null);

  // Group approved by attendant and pump
  const authorisedByAttendant: Record<string, any[]> = {};
  authorised.forEach((s: any) => {
    const attendant = s.attendant?.username || s.attendant_id || 'Unknown Attendant';
    if (!authorisedByAttendant[attendant]) authorisedByAttendant[attendant] = [];
    authorisedByAttendant[attendant].push(s);
  });

  const authorisedByAttendantAndPump: Record<string, Record<string, any[]>> = {};
  Object.entries(authorisedByAttendant).forEach(([attendant, subs]) => {
    authorisedByAttendantAndPump[attendant] = {};
    subs.forEach((s: any) => {
      const pump = pumpMap[s.pump_id] || s.pump_id || s.pump || '?';
      if (!authorisedByAttendantAndPump[attendant][pump]) authorisedByAttendantAndPump[attendant][pump] = [];
      authorisedByAttendantAndPump[attendant][pump].push(s);
    });
  });

  // Helper to calculate expected and collected
  function getBalance(submission: { closing_reading: any; opening_reading: any; fuel_price: any; cash_received: any; prepayment_received: any; credit_received: any; fuel_card_received: any; fdh_card_received: any; national_bank_card_received: any; mo_payment_received: any; own_use_total: any; }) {
    const expected = (Number(submission.closing_reading) - Number(submission.opening_reading)) * Number(submission.fuel_price || 0);
    const collected = Number(submission.cash_received || 0)
      + Number(submission.prepayment_received || 0)
      + Number(submission.credit_received || 0)
      + Number(submission.fuel_card_received || 0)
      + Number(submission.fdh_card_received || 0)
      + Number(submission.national_bank_card_received || 0)
      + Number(submission.mo_payment_received || 0)
      + Number(submission.own_use_total || 0);
    let label = 'Balanced';
    let value = 0;
    if (collected < expected) {
      label = 'Shortage';
      value = expected - collected;
    } else if (collected > expected) {
      label = 'Overage';
      value = collected - expected;
    }
    return { label, value, expected, collected };
  }

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center">
      <svg className="animate-spin h-10 w-10 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
      </svg>
    </div>
  );
  if (error) return <p className="text-red-600">Error loading submissions</p>;

  return (
    <div
  className="min-h-screen p-2 sm:p-4"
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
  <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-2 sm:gap-0" style={{ borderBottom: "1px solid #d1d1d6", paddingBottom: "0.5rem", marginBottom: "1.5rem" }}>
        <h2 className="text-2xl font-bold">Welcome, Supervisor {user?.username || ""}!</h2>
        <Button onClick={handleLogout} className="bg-red-600 hover:bg-red-700 text-white" style={{ borderRadius: 8, fontWeight: 600 }}>
          Log Out
        </Button>
      </div>
  <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 mb-6">
        <label className="font-semibold">Select Date to Review:</label>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="border rounded px-2 py-1"
        />
        <label className="font-semibold ml-4">Shift:</label>
        <select value={shiftFilter} onChange={e => setShiftFilter(e.target.value as 'all' | 'day' | 'night')} className="border rounded px-2 py-1">
          <option value="all">All</option>
          <option value="day">Day</option>
          <option value="night">Night</option>
        </select>
      </div>
      {/* Section buttons */}
  <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 mb-6">
  <Button variant={section === 'pending' ? 'default' : 'outline'} onClick={() => setSection('pending')}>Pending Authorisation</Button>
  <Button variant={section === 'authorised' ? 'default' : 'outline'} onClick={() => { setSection('authorised'); setAuthorisedAttendant(null); setAuthorisedPump(null); }}>Authorised Shifts (History)</Button>
  <Button variant={section === 'fix' ? 'default' : 'outline'} onClick={() => setSection('fix')}>Requested for Fix</Button>
      </div>
      {notification && <div className="bg-green-100 text-green-800 p-2 rounded mb-2 text-center">{notification}</div>}
      {/* Section content */}
      {section === 'authorised' && (
        <div>
          {Object.keys(authorisedByAttendantAndPump).length === 0 ? (
      <div className="ml-2 sm:ml-6 mt-2 text-white font-semibold ">None</div>
          ) : !authorisedAttendant ? (
            <ol className="list-decimal ml-2 sm:ml-6 mt-2">
              {Object.keys(authorisedByAttendantAndPump).map((attendant) => (
                <li key={attendant} className="mb-2">
                  <Button variant="outline" className="bg-white/60 text-black" onClick={() => setAuthorisedAttendant(attendant)}>{attendant}</Button>
                </li>
              ))}
            </ol>
          ) : !authorisedPump ? (
            <div className="ml-2 sm:ml-6 mt-2">
              <Button variant="outline" className="bg-white/50 text-black mb-2" onClick={() => setAuthorisedAttendant(null)}>Back to Attendants</Button>
              <div className="font-semibold mb-2">Pumps for {authorisedAttendant}:</div>
              {Object.keys(authorisedByAttendantAndPump[authorisedAttendant]).map(pump => (
                <Button key={pump} variant="outline" className="bg-white/60 m-1" onClick={() => setAuthorisedPump(pump)}>{pump}</Button>
              ))}
            </div>
          ) : (
            <div className="ml-2 sm:ml-6 mt-2">
              <Button className="mb-2" onClick={() => setAuthorisedPump(null)}>Back to Pumps</Button>
              <div className="font-semibold mb-2">History for {authorisedAttendant} - {authorisedPump}:</div>
              {authorisedByAttendantAndPump[authorisedAttendant][authorisedPump].map((submission: any, idx: number) => (
                <div key={submission.id} className="mb-2">
                  <CardContent className="space-y-2 p-4 shadow-md" style={{ background: "rgba(255,255,255,0.7)", borderRadius: 10 }}>
                    <p className="font-bold">#{idx + 1} Date: {submission.shift_date} | Shift: {submission.shift_type}</p>
                    <p>Cash: <span className="font-bold">{submission.cash_received} MWK</span></p>
                    <p>Prepaid: <span className="font-bold">{submission.prepayment_received} MWK</span></p>
                    <p>Credit: <span className="font-bold">{submission.credit_received} MWK</span></p>
                    <p>Fuel Card: <span className="font-bold">{submission.fuel_card_received || 0} MWK</span></p>
                    <p>FDH Card: <span className="font-bold">{submission.fdh_card_received || 0} MWK</span></p>
                    <p>National Bank Card: <span className="font-bold">{submission.national_bank_card_received || 0} MWK</span></p>
                    <p>MO Payment: <span className="font-bold">{submission.mo_payment_received || 0} MWK</span></p>
                    <p>Own Use Total: <span className="font-bold">{submission.own_use_total || 0} MWK</span></p>
                    <p>Expected: <span className="font-bold">{getBalance(submission).expected.toLocaleString()} MWK</span></p>
                    <p>Total Collected: <span className="font-bold">{getBalance(submission).collected.toLocaleString()} MWK</span></p>
                    <p>
                      {getBalance(submission).label !== 'Balanced' ? (
                        <span className={getBalance(submission).label === 'Shortage' ? 'text-red-600 font-bold' : 'text-green-600 font-bold'}>
                          {getBalance(submission).label}: {getBalance(submission).value.toLocaleString()} MWK
                        </span>
                      ) : (
                        <span className="text-gray-700 font-bold">Balanced</span>
                      )}
                    </p>
                    {submission.own_use && Array.isArray(submission.own_use) && submission.own_use.length > 0 && (
                      <div className="mt-2">
                        <h4 className="font-semibold">Own Use Details:</h4>
                        <ul className="list-disc ml-6">
                          {submission.own_use.map((ou: any, idx: number) => (
                            <li key={idx}>
                              {ou.type === 'vehicle' && `Vehicle: ${ou.registration || ''}, `}
                              {ou.type === 'genset' && `Genset: ${ou.hours || ''} hours, `}
                              {ou.type === 'lawnmower' && `Lawnmower: ${ou.gardener || ''}, `}
                              Volume: {ou.volume}L, Amount: {ou.amount} MWK
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {section === 'pending' && (
        <div>
          {pending.length === 0 ? <div className="ml-6 mt-2 text-white font-semibold text-xl">None</div> :
            pending.map((submission: any) => (
              <div key={submission.id} className="mb-2">
                <CardContent className="space-y-2 p-4 shadow-md" style={{ background: "rgba(255,255,255,0.7)", borderRadius: 10 }}>
                  <p className="text-lg font-bold">Attendant: {submission.attendant?.username || submission.attendant_id || 'Unknown Attendant'}</p>
                  <p>Pump: {pumpMap[submission.pump_id] || submission.pump_id || submission.pump || '?'}</p>
                  <p>Shift: {submission.shift_type}</p>
                  <p>Date: {submission.shift_date}{submission.created_at ? `, Time: ${new Date(submission.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : ''}</p>
                  <p>Cash: <span className="font-bold">{submission.cash_received} MWK</span></p>
                  <p>Prepaid: <span className="font-bold">{submission.prepayment_received} MWK</span></p>
                  <p>Credit: <span className="font-bold">{submission.credit_received} MWK</span></p>
                  <p>Fuel Card: <span className="font-bold">{submission.fuel_card_received || 0} MWK</span></p>
                  <p>FDH Card: <span className="font-bold">{submission.fdh_card_received || 0} MWK</span></p>
                  <p>National Bank Card: <span className="font-bold">{submission.national_bank_card_received || 0} MWK</span></p>
                  <p>MO Payment: <span className="font-bold">{submission.mo_payment_received || 0} MWK</span></p>
                  <p>Own Use Total: <span className="font-bold">{submission.own_use_total || 0} MWK</span></p>
                  <p>Expected: <span className="font-bold">{getBalance(submission).expected.toLocaleString()} MWK</span></p>
                  <p>Total Collected: <span className="font-bold">{getBalance(submission).collected.toLocaleString()} MWK</span></p>
                  <p>
                    {getBalance(submission).label !== 'Balanced' ? (
                      <span className={getBalance(submission).label === 'Shortage' ? 'text-red-600 font-bold' : 'text-green-600 font-bold'}>
                        {getBalance(submission).label}: {getBalance(submission).value.toLocaleString()} MWK
                      </span>
                    ) : (
                      <span className="text-gray-700 font-bold">Balanced</span>
                    )}
                  </p>
                  {submission.own_use && Array.isArray(submission.own_use) && submission.own_use.length > 0 && (
                    <div className="mt-2">
                      <h4 className="font-semibold">Own Use Details:</h4>
                      <ul className="list-disc ml-6">
                        {submission.own_use.map((ou: any, idx: number) => (
                          <li key={idx}>
                            {ou.type === 'vehicle' && `Vehicle: ${ou.registration || ''}, `}
                            {ou.type === 'genset' && `Genset: ${ou.hours || ''} hours, `}
                            {ou.type === 'lawnmower' && `Lawnmower: ${ou.gardener || ''}, `}
                            Volume: {ou.volume}L, Amount: {ou.amount} MWK
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-4">
                    <Button onClick={() => authorise.mutate(submission.id)} className="bg-green-600 hover:bg-green-700 text-white">
                      <Check className="w-4 h-4" /> Authorise
                    </Button>
                    <Button onClick={() => setModal({ open: true, submission })} className="bg-red-600 hover:bg-red-700 text-white">
                      <X className="w-4 h-4" /> Request Fix
                    </Button>
                  </div>
                </CardContent>
              </div>
            ))}
        </div>
      )}
      {section === 'fix' && (
        <div>
          {requestedFix.length === 0 ? <div className="ml-6 mt-2 text-white font-semibold text-xl">None</div> :
            requestedFix.map((submission: any) => (
              <Card key={submission.id} className="bg-yellow-50 shadow-md mb-4" style={{ borderRadius: 12, border: "1px solid #e5e5ea" }}>
                <CardContent className="space-y-2 p-4" style={{ background: "#fffbe6", borderRadius: 10 }}>
                  <p className="text-lg font-bold">Attendant: {submission.attendant?.username || submission.attendant_id || 'Unknown Attendant'}</p>
                  <p>Pump: {pumpMap[submission.pump_id] || submission.pump_id || submission.pump || '?'}</p>
                  <p>Shift: {submission.shift_type}</p>
                  <p>Date: {submission.shift_date}</p>
                  <p>Reason: <span className="font-bold text-red-600">{submission.fix_reason}</span></p>
                  <p>Cash: <span className="font-bold">{submission.cash_received} MWK</span></p>
                  <p>Prepaid: <span className="font-bold">{submission.prepayment_received} MWK</span></p>
                  <p>Credit: <span className="font-bold">{submission.credit_received} MWK</span></p>
                  <p>Fuel Card: <span className="font-bold">{submission.fuel_card_received || 0} MWK</span></p>
                  <p>FDH Card: <span className="font-bold">{submission.fdh_card_received || 0} MWK</span></p>
                  <p>National Bank Card: <span className="font-bold">{submission.national_bank_card_received || 0} MWK</span></p>
                  <p>MO Payment: <span className="font-bold">{submission.mo_payment_received || 0} MWK</span></p>
                  <p>Own Use Total: <span className="font-bold">{submission.own_use_total || 0} MWK</span></p>
                  <p>Expected: <span className="font-bold">{getBalance(submission).expected.toLocaleString()} MWK</span></p>
                  <p>Total Collected: <span className="font-bold">{getBalance(submission).collected.toLocaleString()} MWK</span></p>
                  <p>
                    {getBalance(submission).label !== 'Balanced' ? (
                      <span className={getBalance(submission).label === 'Shortage' ? 'text-red-600 font-bold' : 'text-green-600 font-bold'}>
                        {getBalance(submission).label}: {getBalance(submission).value.toLocaleString()} MWK
                      </span>
                    ) : (
                      <span className="text-gray-700 font-bold">Balanced</span>
                    )}
                  </p>
                  {submission.own_use && Array.isArray(submission.own_use) && submission.own_use.length > 0 && (
                    <div className="mt-2">
                      <h4 className="font-semibold">Own Use Details:</h4>
                      <ul className="list-disc ml-6">
                        {submission.own_use.map((ou: any, idx: number) => (
                          <li key={idx}>
                            {ou.type === 'vehicle' && `Vehicle: ${ou.registration || ''}, `}
                            {ou.type === 'genset' && `Genset: ${ou.hours || ''} hours, `}
                            {ou.type === 'lawnmower' && `Lawnmower: ${ou.gardener || ''}, `}
                            Volume: {ou.volume}L, Amount: {ou.amount} MWK
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
        </div>
      )}
      {/* Modal for request fix */}
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
    </div>
  );
}