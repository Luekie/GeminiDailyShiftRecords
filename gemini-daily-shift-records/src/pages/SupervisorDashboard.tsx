import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, X, Moon, Sun } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAtomValue } from "jotai";
import { userAtom } from "../store/auth";
import { useLocation } from "wouter";
import { fetchShiftsForDate } from "@/lib/useFetchShiftsForDate";
import { cn } from "@/lib/utils";
import { useTheme } from '../contexts/ThemeContext';
import { GlobalBackground } from '../components/GlobalBackground';


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
  const { isDarkMode, toggleDarkMode } = useTheme();

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

  // Helper to calculate expected and collected - includes all payment types
  function getBalance(submission: any) {
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
    <>
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
      <div className="relative min-h-screen flex items-center justify-center z-10">
        <div className="bg-white/80 backdrop-blur-md rounded-2xl p-8 shadow-2xl">
          <svg className="animate-spin h-12 w-12 text-blue-600 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
          </svg>
          <p className="text-gray-900 font-semibold">Loading submissions...</p>
        </div>
      </div>
    </>
  );
  
  if (error) return (
    <>
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
      <div className="relative min-h-screen flex items-center justify-center z-10 p-4">
        <div className="bg-white/80 backdrop-blur-md rounded-2xl p-8 shadow-2xl text-center">
          <div className="text-6xl mb-4">⚠️</div>
          <p className="text-red-600 font-bold text-xl">Error loading submissions</p>
          <p className="text-gray-600 mt-2">Please try refreshing the page</p>
        </div>
      </div>
    </>
  );

  return (
    <>
      <GlobalBackground />
      {/* Foreground content */}
      <div className="relative min-h-screen w-full p-2 sm:p-4 space-y-4 z-10" style={{
        fontFamily: "San Francisco, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
      }}>
        {/* Header with glassmorphism */}
        <div className={cn(
          "flex flex-col sm:flex-row justify-between items-center mb-4 gap-2 sm:gap-0 rounded-2xl p-4 shadow-lg border backdrop-blur-xl",
          isDarkMode 
            ? "bg-white/5 border-white/10 text-white" 
            : "bg-white/20 border-white/30 text-gray-900"
        )}>
          <h2 className="text-2xl font-bold">👋 Welcome, Supervisor {user?.username || ""}!</h2>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleDarkMode}
              className={cn(
                "rounded-xl p-2 transition-all duration-200",
                isDarkMode 
                  ? "hover:bg-white/10 text-white" 
                  : "hover:bg-white/20 text-gray-700"
              )}
            >
              {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </Button>
            
            <Button onClick={handleLogout} className={cn(
              "rounded-xl px-4 py-2 font-semibold shadow-sm border transition-all duration-200",
              isDarkMode
                ? "bg-red-500/20 hover:bg-red-500/30 text-red-400 border-red-500/30"
                : "bg-red-100/70 hover:bg-red-200/90 text-red-800 border-red-300"
            )}>
              🚪 Log Out
            </Button>
          </div>
        </div>
        {/* Filter Bar with iOS styling */}
        <div className="bg-white/80 backdrop-blur-md rounded-2xl p-4 shadow-lg border border-white/20 mb-6">
          <div className="flex flex-wrap items-center gap-4">
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
              <label className="font-semibold text-gray-700 text-sm">🔄 Shift:</label>
              <select 
                value={shiftFilter} 
                onChange={e => setShiftFilter(e.target.value as 'all' | 'day' | 'night')} 
                className="border border-gray-200 rounded-xl px-3 py-2 bg-white/70 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              >
                <option value="all">All Shifts</option>
                <option value="day">☀️ Day Shift</option>
                <option value="night">🌙 Night Shift</option>
              </select>
            </div>
          </div>
        </div>
        
        {/* Section buttons with modern tabs */}
        <div className="flex flex-wrap gap-3 mb-6">
          <Button 
            variant={section === 'pending' ? 'default' : 'outline'} 
            onClick={() => setSection('pending')}
            className={cn(
              "rounded-xl px-6 py-3 font-semibold shadow-sm transition-all duration-200 border active:scale-[0.98]",
              section === 'pending' 
                ? 'bg-orange-100/70 hover:bg-orange-200/90 hover:scale-[1.02] text-orange-800 border-orange-300' 
                : 'bg-white/70 hover:bg-white/90 hover:scale-[1.02] text-gray-700 border-gray-300'
            )}
          >
            ⏳ Pending ({pending.length})
          </Button>
          <Button 
            variant={section === 'authorised' ? 'default' : 'outline'} 
            onClick={() => { setSection('authorised'); setAuthorisedAttendant(null); setAuthorisedPump(null); }}
            className={cn(
              "rounded-xl px-6 py-3 font-semibold shadow-sm transition-all duration-200 border active:scale-[0.98]",
              section === 'authorised' 
                ? 'bg-green-100/70 hover:bg-green-200/90 hover:scale-[1.02] text-green-800 border-green-300' 
                : 'bg-white/70 hover:bg-white/90 hover:scale-[1.02] text-gray-700 border-gray-300'
            )}
          >
            ✅ Authorised ({authorised.length})
          </Button>
          <Button 
            variant={section === 'fix' ? 'default' : 'outline'} 
            onClick={() => setSection('fix')}
            className={cn(
              "rounded-xl px-6 py-3 font-semibold shadow-sm transition-all duration-200 border active:scale-[0.98]",
              section === 'fix' 
                ? 'bg-yellow-100/70 hover:bg-yellow-200/90 hover:scale-[1.02] text-yellow-800 border-yellow-300' 
                : 'bg-white/70 hover:bg-white/90 hover:scale-[1.02] text-gray-700 border-gray-300'
            )}
          >
            🔧 Fix Requests ({requestedFix.length})
          </Button>
        </div>
        {notification && (
          <div className="bg-green-100 border border-green-300 text-green-800 p-4 rounded-2xl mb-4 text-center font-semibold shadow-md animate-pulse">
            ✅ {notification}
          </div>
        )}
        {/* Section content with modern cards */}
        {section === 'authorised' && (
          <div>
            {Object.keys(authorisedByAttendantAndPump).length === 0 ? (
              <div className="text-center py-12 bg-white/70 backdrop-blur-md rounded-2xl shadow-lg">
                <div className="text-6xl mb-4">📭</div>
                <p className="text-gray-600 text-lg font-semibold">No authorised shifts yet</p>
              </div>
            ) : !authorisedAttendant ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.keys(authorisedByAttendantAndPump).map((attendant) => (
                  <Card 
                    key={attendant} 
                    className="bg-white/80 backdrop-blur-md hover:bg-white/90 cursor-pointer transition-all shadow-md hover:shadow-xl rounded-2xl border border-white/20"
                    onClick={() => setAuthorisedAttendant(attendant)}
                  >
                    <CardContent className="p-6 flex items-center gap-4">
                      <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center text-white text-xl font-bold">
                        {attendant.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-bold text-lg text-gray-900">{attendant}</div>
                        <div className="text-sm text-gray-600">{Object.keys(authorisedByAttendantAndPump[attendant]).length} pump(s)</div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : !authorisedPump ? (
              <div>
                <Button 
                  variant="outline" 
                  className="bg-white/70 hover:bg-white/90 hover:scale-[1.02] text-gray-900 mb-4 rounded-xl px-4 py-2 font-semibold shadow-sm border border-gray-300 transition-all duration-200 active:scale-[0.98]" 
                  onClick={() => setAuthorisedAttendant(null)}
                >
                  ← Back to Attendants
                </Button>
                <h3 className="font-bold text-xl mb-4 text-gray-900">Pumps for {authorisedAttendant}:</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {Object.keys(authorisedByAttendantAndPump[authorisedAttendant]).map(pump => (
                    <Button 
                      key={pump} 
                      variant="outline" 
                      className="bg-white/70 hover:bg-blue-50/90 hover:scale-[1.02] rounded-xl p-4 h-auto font-semibold shadow-md hover:shadow-lg transition-all duration-200 active:scale-[0.98]" 
                      onClick={() => setAuthorisedPump(pump)}
                    >
                      ⛽ {pump}
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <Button 
                  className="mb-4 bg-white/70 hover:bg-white/90 hover:scale-[1.02] text-gray-900 rounded-xl px-4 py-2 font-semibold shadow-sm border border-gray-300 transition-all duration-200 active:scale-[0.98]" 
                  onClick={() => setAuthorisedPump(null)}
                >
                  ← Back to Pumps
                </Button>
                <h3 className="font-bold text-xl mb-4 text-gray-900">📊 History for {authorisedAttendant} - {authorisedPump}:</h3>
                <div className="space-y-4">
                  {authorisedByAttendantAndPump[authorisedAttendant][authorisedPump].map((submission: any, idx: number) => (
                    <Card key={submission.id} className="bg-white/90 backdrop-blur-md shadow-lg hover:shadow-xl transition-all rounded-2xl border border-green-200">
                      <CardContent className="space-y-3 p-5">
                        <div className="flex items-center gap-3 mb-3">
                          <span className="bg-green-600 text-white rounded-full px-3 py-1 text-sm font-bold">#{idx + 1}</span>
                          <span className="font-bold text-gray-900">📅 {submission.shift_date}</span>
                          <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-lg text-sm font-semibold">{submission.shift_type === 'day' ? '☀️ Day' : '🌙 Night'}</span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                          <div className="bg-gradient-to-br from-yellow-50 to-white rounded-lg p-2">💵 Cash: <strong>{submission.cash_received?.toLocaleString()}</strong></div>
                          <div className="bg-gradient-to-br from-green-50 to-white rounded-lg p-2">💳 Prepaid: <strong>{submission.prepayment_received?.toLocaleString()}</strong></div>
                          <div className="bg-gradient-to-br from-blue-50 to-white rounded-lg p-2">🏦 Credit: <strong>{submission.credit_received?.toLocaleString()}</strong></div>
                          <div className="bg-gradient-to-br from-purple-50 to-white rounded-lg p-2">⛽ Fuel Card: <strong>{(submission.fuel_card_received || 0).toLocaleString()}</strong></div>
                        </div>
                        <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-4 mt-3">
                          <p className="text-sm text-gray-600">Expected: <span className="font-bold text-gray-900 text-lg">{getBalance(submission).expected.toLocaleString()} MWK</span></p>
                          <p className="text-sm text-gray-600">Collected: <span className="font-bold text-gray-900 text-lg">{getBalance(submission).collected.toLocaleString()} MWK</span></p>
                          <div className="mt-2">
                            {getBalance(submission).label !== 'Balanced' ? (
                              <div className={cn(
                                "font-bold text-lg p-2 rounded-lg",
                                getBalance(submission).label === 'Shortage' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                              )}>
                                {getBalance(submission).label === 'Shortage' ? '⚠️' : '✅'} {getBalance(submission).label}: {getBalance(submission).value.toLocaleString()} MWK
                              </div>
                            ) : (
                              <div className="bg-gray-100 text-gray-700 font-bold text-lg p-2 rounded-lg">✅ Balanced</div>
                            )}
                          </div>
                        </div>
                        {submission.own_use && Array.isArray(submission.own_use) && submission.own_use.length > 0 && (
                          <div className="bg-gray-50 rounded-xl p-3 mt-2">
                            <h4 className="font-semibold text-gray-900 mb-2">🚗 Own Use Details:</h4>
                            <ul className="space-y-1 text-sm">
                              {submission.own_use.map((ou: any, idx: number) => (
                                <li key={idx} className="flex items-start gap-2">
                                  <span className="text-yellow-600">•</span>
                                  <span>
                                    {ou.type === 'vehicle' && `Vehicle: ${ou.registration || ''}, `}
                                    {ou.type === 'genset' && `Genset: ${ou.hours || ''} hours, `}
                                    {ou.type === 'lawnmower' && `Lawnmower: ${ou.gardener || ''}, `}
                                    Volume: {ou.volume}L, Amount: {ou.amount} MWK
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        {section === 'pending' && (
          <div>
            {pending.length === 0 ? (
              <div className="text-center py-12 bg-white/70 backdrop-blur-md rounded-2xl shadow-lg">
                <div className="text-6xl mb-4">✅</div>
                <p className="text-gray-600 text-lg font-semibold">All caught up! No pending approvals.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pending.map((submission: any) => (
                  <Card key={submission.id} className="bg-white/90 backdrop-blur-md shadow-lg hover:shadow-xl transition-all rounded-2xl border border-orange-200">
                    <CardContent className="space-y-3 p-5">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-orange-600 rounded-full flex items-center justify-center text-white font-bold">
                            {(submission.attendant?.username || submission.attendant_id || 'U').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-lg font-bold text-gray-900">{submission.attendant?.username || submission.attendant_id || 'Unknown Attendant'}</p>
                            <p className="text-sm text-gray-600">⛽ {pumpMap[submission.pump_id] || submission.pump_id || '?'} • {submission.shift_type === 'day' ? '☀️ Day' : '🌙 Night'} • 📅 {submission.shift_date}</p>
                            {submission.created_at && (
                              <p className="text-xs text-gray-500">⏰ {new Date(submission.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</p>
                            )}
                          </div>
                        </div>
                        <span className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-sm font-semibold">⏳ Pending</span>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                        <div className="bg-gradient-to-br from-yellow-50 to-white rounded-lg p-2">💵 Cash: <strong>{submission.cash_received?.toLocaleString()}</strong></div>
                        <div className="bg-gradient-to-br from-green-50 to-white rounded-lg p-2">💳 Prepaid: <strong>{submission.prepayment_received?.toLocaleString()}</strong></div>
                        <div className="bg-gradient-to-br from-blue-50 to-white rounded-lg p-2">🏦 Credit: <strong>{submission.credit_received?.toLocaleString()}</strong></div>
                        <div className="bg-gradient-to-br from-purple-50 to-white rounded-lg p-2">⛽ Fuel Card: <strong>{(submission.fuel_card_received || 0).toLocaleString()}</strong></div>
                      </div>
                      {submission.own_use && Array.isArray(submission.own_use) && submission.own_use.length > 0 && (
                        <div className="bg-gray-50 rounded-xl p-3 mt-2">
                          <h4 className="font-semibold text-gray-900 mb-2">🚗 Own Use Details:</h4>
                          <ul className="space-y-1 text-sm">
                            {submission.own_use.map((ou: any, idx: number) => (
                              <li key={idx} className="flex items-start gap-2">
                                <span className="text-blue-600">•</span>
                                <span>
                                  {ou.type === 'vehicle' && `Vehicle: ${ou.registration || ''}, `}
                                  {ou.type === 'genset' && `Genset: ${ou.hours || ''} hours, `}
                                  {ou.type === 'lawnmower' && `Lawnmower: ${ou.gardener || ''}, `}
                                  Volume: {ou.volume}L, Amount: {ou.amount} MWK
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-4 mt-3">
                        <p className="text-sm text-gray-600">Expected: <span className="font-bold text-gray-900 text-lg">{getBalance(submission).expected.toLocaleString()} MWK</span></p>
                        <p className="text-sm text-gray-600">Collected: <span className="font-bold text-gray-900 text-lg">{getBalance(submission).collected.toLocaleString()} MWK</span></p>
                        <div className="mt-2">
                          {getBalance(submission).label !== 'Balanced' ? (
                            <div className={cn(
                              "font-bold text-lg p-2 rounded-lg",
                              getBalance(submission).label === 'Shortage' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                            )}>
                              {getBalance(submission).label === 'Shortage' ? '⚠️' : '✅'} {getBalance(submission).label}: {getBalance(submission).value.toLocaleString()} MWK
                            </div>
                          ) : (
                            <div className="bg-gray-100 text-gray-700 font-bold text-lg p-2 rounded-lg">✅ Balanced</div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3 mt-4 pt-4 border-t border-gray-200">
                        <Button 
                          onClick={() => authorise.mutate(submission.id)} 
                          className="flex-1 bg-green-100/70 hover:bg-green-200/90 hover:scale-[1.02] text-green-800 rounded-xl px-4 py-3 font-semibold shadow-sm border border-green-300 transition-all duration-200 active:scale-[0.98]"
                        >
                          <Check className="w-5 h-5 mr-2" /> Authorise
                        </Button>
                        <Button 
                          onClick={() => setModal({ open: true, submission })} 
                          className="flex-1 bg-red-100/70 hover:bg-red-200/90 hover:scale-[1.02] text-red-800 rounded-xl px-4 py-3 font-semibold shadow-sm border border-red-300 transition-all duration-200 active:scale-[0.98]"
                        >
                          <X className="w-5 h-5 mr-2" /> Request Fix
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
        {section === 'fix' && (
          <div>
            {requestedFix.length === 0 ? (
              <div className="text-center py-12 bg-white/70 backdrop-blur-md rounded-2xl shadow-lg">
                <div className="text-6xl mb-4">🎉</div>
                <p className="text-gray-600 text-lg font-semibold">No fix requests pending</p>
              </div>
            ) : (
              <div className="space-y-4">
                {requestedFix.map((submission: any) => (
                  <Card key={submission.id} className="bg-gradient-to-r from-yellow-50 to-orange-50 backdrop-blur-md shadow-lg hover:shadow-xl transition-all rounded-2xl border-2 border-yellow-300">
                    <CardContent className="space-y-3 p-5">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-yellow-600 rounded-full flex items-center justify-center text-white font-bold">
                            {(submission.attendant?.username || submission.attendant_id || 'U').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-lg font-bold text-gray-900">{submission.attendant?.username || submission.attendant_id || 'Unknown Attendant'}</p>
                            <p className="text-sm text-gray-600">⛽ {pumpMap[submission.pump_id] || submission.pump_id || '?'} • {submission.shift_type === 'day' ? '☀️ Day' : '🌙 Night'} • 📅 {submission.shift_date}</p>
                          </div>
                        </div>
                        <span className="bg-yellow-600 text-white px-3 py-1 rounded-full text-sm font-semibold">🔧 Fix Requested</span>
                      </div>
                      
                      <div className="bg-red-100 border-l-4 border-red-600 rounded-lg p-3 mb-3">
                        <p className="font-semibold text-red-900">⚠️ Reason for Fix:</p>
                        <p className="text-red-800 font-bold mt-1">{submission.fix_reason}</p>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                        <div className="bg-white rounded-lg p-2">💵 Cash: <strong>{submission.cash_received?.toLocaleString()}</strong></div>
                        <div className="bg-white rounded-lg p-2">💳 Prepaid: <strong>{submission.prepayment_received?.toLocaleString()}</strong></div>
                        <div className="bg-white rounded-lg p-2">🏦 Credit: <strong>{submission.credit_received?.toLocaleString()}</strong></div>
                        <div className="bg-white rounded-lg p-2">⛽ Fuel Card: <strong>{(submission.fuel_card_received || 0).toLocaleString()}</strong></div>
                      </div>
                      
                      <div className="bg-white rounded-xl p-4 mt-3">
                        <p className="text-sm text-gray-600">Expected: <span className="font-bold text-gray-900 text-lg">{getBalance(submission).expected.toLocaleString()} MWK</span></p>
                        <p className="text-sm text-gray-600">Collected: <span className="font-bold text-gray-900 text-lg">{getBalance(submission).collected.toLocaleString()} MWK</span></p>
                        <div className="mt-2">
                          {getBalance(submission).label !== 'Balanced' ? (
                            <div className={cn(
                              "font-bold text-lg p-2 rounded-lg",
                              getBalance(submission).label === 'Shortage' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                            )}>
                              {getBalance(submission).label === 'Shortage' ? '⚠️' : '✅'} {getBalance(submission).label}: {getBalance(submission).value.toLocaleString()} MWK
                            </div>
                          ) : (
                            <div className="bg-gray-100 text-gray-700 font-bold text-lg p-2 rounded-lg">✅ Balanced</div>
                          )}
                        </div>
                      </div>
                      {submission.own_use && Array.isArray(submission.own_use) && submission.own_use.length > 0 && (
                        <div className="bg-gray-50 rounded-xl p-3 mt-2">
                          <h4 className="font-semibold text-gray-900 mb-2">🚗 Own Use Details:</h4>
                          <ul className="space-y-1 text-sm">
                            {submission.own_use.map((ou: any, idx: number) => (
                              <li key={idx} className="flex items-start gap-2">
                                <span className="text-yellow-600">•</span>
                                <span>
                                  {ou.type === 'vehicle' && `Vehicle: ${ou.registration || ''}, `}
                                  {ou.type === 'genset' && `Genset: ${ou.hours || ''} hours, `}
                                  {ou.type === 'lawnmower' && `Lawnmower: ${ou.gardener || ''}, `}
                                  Volume: {ou.volume}L, Amount: {ou.amount} MWK
                                </span>
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
          </div>
        )}
        {/* Modal for request fix with modern styling */}
        {modal.open && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 px-4">
            <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl w-full max-w-md p-6 border border-white/30">
              <h2 className="text-xl font-bold mb-4 text-gray-900">🔧 Request Fix for {modal.submission?.attendant?.username || modal.submission?.attendant_id}</h2>
              <textarea
                className="w-full border-2 border-gray-200 rounded-xl p-3 mb-4 focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                rows={4}
                placeholder="Describe what needs to be fixed..."
                value={modalReason}
                onChange={(e) => setModalReason(e.target.value)}
              />
              <div className="flex gap-3 justify-end">
                <Button 
                  onClick={() => setModal({ open: false, submission: null })} 
                  variant="outline"
                  className="rounded-xl px-4 py-2 font-semibold bg-white/70 hover:bg-white/90 hover:scale-[1.02] text-gray-900 border border-gray-300 shadow-sm transition-all duration-200 active:scale-[0.98]"
                >
                  Cancel
                </Button>
                <Button
                  className="bg-red-100/70 hover:bg-red-200/90 hover:scale-[1.02] text-red-800 rounded-xl px-4 py-2 font-semibold shadow-sm border border-red-300 transition-all duration-200 active:scale-[0.98]"
                  onClick={() => modal.submission && request.mutate({ id: modal.submission.id, reason: modalReason })}
                  disabled={request.isPending || !modalReason.trim() || !modal.submission}
                >
                  {request.isPending ? 'Submitting...' : 'Submit Request'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}