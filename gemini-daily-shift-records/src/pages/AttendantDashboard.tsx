import { useState, useEffect, type Dispatch, type SetStateAction } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { useMutation } from '@tanstack/react-query';
import { useAtom } from 'jotai';
import { userAtom } from '../store/auth';
import { Select, SelectTrigger, SelectContent, SelectItem } from '@/components/ui/select';
import { useLocation } from 'wouter';
import { cn } from '@/lib/utils';
import { useTheme } from '../contexts/ThemeContext';
import { GlobalBackground } from '../components/GlobalBackground';
import { Moon, Sun } from 'lucide-react';
  

interface PaymentEntry {
  name: string;
  amount: string;
}



const AttendantDashboard = () => {
  const { isDarkMode, toggleDarkMode } = useTheme();
  // --- Multi-pump state and handlers ---
  type PumpReading = { pumpId: string; opening: number; closing: number };
  const [pumpReadings, setPumpReadings] = useState<PumpReading[]>([]);
  const [showPumpModal, setShowPumpModal] = useState(false);
  const [modalPumpId, setModalPumpId] = useState("");
  const [modalOpening, setModalOpening] = useState("");
  const [modalClosing, setModalClosing] = useState("");
  const [modalError, setModalError] = useState("");

  // Add or update a pump reading
  const handleAddPumpReading = () => {
    setModalError("");
    if (!modalPumpId) {
      setModalError("Please select a pump");
      return;
    }
    if (modalOpening === "" || modalClosing === "") {
      setModalError("Enter both opening and closing");
      return;
    }
    const opening = parseFloat(modalOpening);
    const closing = parseFloat(modalClosing);
    if (isNaN(opening) || isNaN(closing)) {
      setModalError("Invalid meter values");
      return;
    }
    if (closing < opening) {
      setModalError("Closing must be >= opening");
      return;
    }
    // Prevent duplicate pump
    if (pumpReadings.some(r => r.pumpId === modalPumpId)) {
      setModalError("Pump already added");
      return;
    }
    setPumpReadings([...pumpReadings, { pumpId: modalPumpId, opening, closing }]);
    setShowPumpModal(false);
    setModalPumpId("");
    setModalOpening("");
    setModalClosing("");
  };

  // Remove a pump reading
  const handleRemovePump = (id: string) => {
    setPumpReadings(pumpReadings.filter(r => r.pumpId !== id));
  };
  const [user, setUser] = useAtom(userAtom);
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(true);
  const [showReadings, setShowReadings] = useState(false);
  const [shift, setShift] = useState<'day' | 'night'>('day');

  const [cash, setCash] = useState('');
  const [prepayments, setPrepayments] = useState<PaymentEntry[]>([{ name: '', amount: '' }]);
  const [credits, setCredits] = useState<PaymentEntry[]>([{ name: '', amount: '' }]);
  const [myFuelCards, setMyFuelCards] = useState<PaymentEntry[]>([{ name: '', amount: '' }]);
  const [fdhCards, setFdhCards] = useState<PaymentEntry[]>([{ name: '', amount: '' }]);
  const [nationalBankCards, setNationalBankCards] = useState<PaymentEntry[]>([{ name: '', amount: '' }]);
  const [moPayments, setMoPayments] = useState<PaymentEntry[]>([{ name: '', amount: '' }]);

  const [pumps, setPumps] = useState<any[]>([]);
  const [loadingPumps, setLoadingPumps] = useState(true);
  const [pumpError, setPumpError] = useState<string | null>(null);

  const [submitted, setSubmitted] = useState(false);
  const [submissions, setSubmissions] = useState<any[]>([]);
const [expandedDates, setExpandedDates] = useState<{ [date: string]: boolean }>({});
const [fixNotifications, setFixNotifications] = useState<any[]>([]);
const [showSubmissions, setShowSubmissions] = useState(false);
const [showNotifications, setShowNotifications] = useState(false);

// Track viewed notifications
const [viewedNotifications, setViewedNotifications] = useState(false);

  // Own Use Entries State
type OwnUseEntry =
  | { type: 'vehicle'; registration: string; volume: string; fuelType: 'petrol' | 'diesel' }
  | { type: 'genset'; hours: string; volume: string; fuelType: 'petrol' | 'diesel' }
  | { type: 'lawnmower'; gardener: string; volume: string; fuelType: 'petrol' | 'diesel' };

const [ownUseEntries, setOwnUseEntries] = useState<OwnUseEntry[]>([
  { type: 'vehicle', registration: '', volume: '', fuelType: 'petrol' },
]);

function updateOwnUseEntry(idx: number, field: string, value: any) {
  const newEntries = [...ownUseEntries];
  newEntries[idx] = { ...newEntries[idx], [field]: value };
  setOwnUseEntries(newEntries);
}

function addOwnUseEntry(type: 'vehicle' | 'genset' | 'lawnmower') {
  if (type === 'vehicle') setOwnUseEntries([...ownUseEntries, { type: 'vehicle', registration: '', volume: '', fuelType: 'petrol' }]);
  if (type === 'genset') setOwnUseEntries([...ownUseEntries, { type: 'genset', hours: '', volume: '', fuelType: 'petrol' }]);
  if (type === 'lawnmower') setOwnUseEntries([...ownUseEntries, { type: 'lawnmower', gardener: '', volume: '', fuelType: 'petrol' }]);
}

function removeOwnUseEntry(idx: number) {
  setOwnUseEntries(ownUseEntries.filter((_, i) => i !== idx));
}

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    const sessionExpiry = localStorage.getItem('sessionExpiry');

    if (savedUser && sessionExpiry) {
      const expiryTime = parseInt(sessionExpiry, 10);
      const currentTime = Date.now();

      if (currentTime < expiryTime) {
        setUser(JSON.parse(savedUser));
        setLoading(false);
      } else {
        localStorage.removeItem('user');
        localStorage.removeItem('sessionExpiry');
        setUser(null);
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }, [setUser]);

  useEffect(() => {
    if (!user && !loading) {
      setTimeout(() => setLocation("/"), 1000);
    }
  }, [user, loading, setLocation]);

  useEffect(() => {
    let mounted =true;
    const fetchPumps = async () => {
      setLoadingPumps(true);
      setPumpError(null);
      const { data, error } = await supabase.from('pumps').select('*');
      if (!mounted) return;
      if (error) {
        setPumpError('Failed to load pumps');
        setPumps([]);
      } else {
        setPumps(data || []);
      }
      setLoadingPumps(false);
    };
    fetchPumps();
    return () => { mounted = false; };
  }, []);


  useEffect(() => {
  async function fetchSubmissions() {
    if (!user) return;
    const { data, error } = await supabase
      .from('shifts')
      .select('*')
      .eq('attendant_id', user.id)
      .order('shift_date', { ascending: false });
    if (!error && data) {
      setSubmissions(data);
      // Find submissions with fix requested
        const fixNotifications = submissions.filter(
      (s) => s.fix_reason && !s.is_approved
      );

      setFixNotifications(fixNotifications);

    }
  }
  fetchSubmissions();
}, [user, submitted]);

  

  const handleNumericChange = (e: React.ChangeEvent<HTMLInputElement>, setter: (value: string) => void) => {
  const value = e.target.value;
  if (value === '' || /^\d*\.?\d*$/.test(value)) {
    setter(value);
  }
};

  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('sessionExpiry');
    setUser(null);
    setLocation('/');
  };

    // Add a state to track submitted pumps for the day
const [, setSubmittedPumps] = useState<string[]>([]);

// Fetch already submitted pumps for this attendant, date, and shift
useEffect(() => {
  async function fetchSubmittedPumps() {
    if (!user) return;
  // Use local date for today
  const now = new Date();
  const today = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
    const { data, error } = await supabase
      .from('shifts')
      .select('pump_id')
      .eq('attendant_id', user.id)
      .eq('shift_date', today)
      .eq('shift_type', shift); // Only consider current shift type
    if (!error && data) {
      setSubmittedPumps(data.map((row: any) => String(row.pump_id)));
    }
  }
  fetchSubmittedPumps();
}, [user, submitted, shift]);

  // Map of pumpId to boolean: isFixing for each pump in pumpReadings
  const isFixingMap: Record<string, boolean> = {};
  for (const r of pumpReadings) {
    isFixingMap[r.pumpId] = !!submissions.find(
      (s) =>
        String(s.pump_id) === String(r.pumpId) &&
        s.shift_type === shift &&
        s.fix_reason &&
        !s.is_approved
    );
  }



  const submitShift = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('User not logged in');
      if (!pumpReadings.length) throw new Error('No pump readings entered');

      // Check for duplicate submissions for any pump (any attendant)
  // Use local date for today
  const now = new Date();
  const today = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
      for (const r of pumpReadings) {
        // Query shifts table for any record with this pump, date, and shift type
        const { data: existingShifts, error: checkError } = await supabase
          .from('shifts')
          .select('id')
          .eq('pump_id', r.pumpId)
          .eq('shift_date', today)
          .eq('shift_type', shift);
        if (checkError) throw checkError;
        if (existingShifts && existingShifts.length > 0) {
          // Find pump name for error message
          const pump = pumps.find(p => String(p.id) === String(r.pumpId));
          const pumpName = pump?.name || r.pumpId;
          throw new Error(`A shift for pump ${pumpName} has already been submitted for this shift.`);
        }
        if (isNaN(r.opening) || isNaN(r.closing)) {
          throw new Error(`Invalid meter readings for pump ${r.pumpId}`);
        }
        if (r.closing < r.opening) {
          throw new Error(`Closing reading must be greater than opening reading for pump ${r.pumpId}`);
        }
      }

      // Submit each pump reading as a separate shift
      for (const r of pumpReadings) {
        const pump = pumps.find(p => String(p.id) === String(r.pumpId));
        if (!pump) throw new Error(`Pump not found for id ${r.pumpId}`);
        const payload = {
          pump_id: r.pumpId,
          attendant_id: user.id,
          shift_type: shift,
          shift_date: today,
          opening_reading: r.opening,
          closing_reading: r.closing,
          fuel_price: pump.price,
          is_approved: false,
          supervisor_id: null,
          fix_reason: null,
          cash_received: Number(cash) || 0,
          prepayment_received: prepayments.reduce((sum, p) => sum + Number(p.amount || 0), 0),
          credit_received: credits.reduce((sum, c) => sum + Number(c.amount || 0), 0),
          fuel_card_received: myFuelCards.reduce((sum, c) => sum + Number(c.amount || 0), 0),
          fdh_card_received: fdhCards.reduce((sum, c) => sum + Number(c.amount || 0), 0),
          national_bank_card_received: nationalBankCards.reduce((sum, c) => sum + Number(c.amount || 0), 0),
          mo_payment_received: moPayments.reduce((sum, m) => sum + Number(m.amount || 0), 0),
        };
        const { data: shiftInsertResult, error } = await supabase.from('shifts').insert([payload]).select('id');
        if (error) {
          throw error;
        }
        if (shiftInsertResult && shiftInsertResult.length > 0) {
          const shiftId = shiftInsertResult[0].id;
          for (const entry of ownUseEntries) {
            const ownUsePayload = {
              shift_id: shiftId,
              type: entry.type,
              ...(entry.type === 'vehicle' ? {
                registration: entry.registration,
                volume: entry.volume,
                fuel_type: entry.fuelType,
                amount: getOwnUseAmount(entry)
              } : {}),
              ...(entry.type === 'genset' ? {
                hours: entry.hours,
                volume: entry.volume,
                fuel_type: entry.fuelType,
                amount: getOwnUseAmount(entry)
              } : {}),
              ...(entry.type === 'lawnmower' ? {
                gardener: entry.gardener,
                volume: entry.volume,
                fuel_type: entry.fuelType,
                amount: getOwnUseAmount(entry)
              } : {})
            };
            await supabase.from('own_use').insert([ownUsePayload]);
          }
        }
      }
      return true;
    },
    onSuccess: async () => {
      alert('Submitted successfully!');
      setSubmitted(true);
      setPumpReadings([]);
      setCash('');
      setPrepayments([{ name: '', amount: '' }]);
      setCredits([{ name: '', amount: '' }]);
      setMyFuelCards([{ name: '', amount: '' }]);
      setFdhCards([{ name: '', amount: '' }]);
      setNationalBankCards([{ name: '', amount: '' }]);
      setMoPayments([{ name: '', amount: '' }]);
      setOwnUseEntries([{ type: 'vehicle', registration: '', volume: '', fuelType: 'petrol' }]);
      localStorage.removeItem('shiftDraft');
    },
    onError: (error: any) => {
      console.error('Submit error:', error);
      alert('Failed to submit shift: ' + (error?.message || JSON.stringify(error)));
    },
  });


useEffect(() => {
  if (submitted) {  // Check the state value, not the setter
    const timer = setTimeout(() => {
      setSubmitted(false);
      setLocation('/attendant');
    }, 2000);
    return () => clearTimeout(timer);
  }
}, [submitted, setLocation]);  // Include submitted in dependencies

  function handleSaveDraft() {
    const draft = {
      pumpReadings,
      cash,
      prepayments,
      credits,
      myFuelCards,
      fdhCards,
      nationalBankCards,
      moPayments,
      ownUseEntries,
      shift,
      shift_date: new Date().toISOString().slice(0, 10),
    };
    localStorage.setItem('shiftDraft', JSON.stringify(draft));
    // Show success notification
    const notification = document.createElement('div');
    notification.className = 'fixed top-4 right-4 bg-green-600 text-white px-6 py-3 rounded-xl shadow-lg z-50 font-semibold';
    notification.textContent = '✅ Draft saved successfully!';
    document.body.appendChild(notification);
    setTimeout(() => {
      notification.remove();
    }, 3000);
  }
  
  useEffect(() => {
    const savedDraft = localStorage.getItem('shiftDraft');
    if (savedDraft) {
      try {
        const draft = JSON.parse(savedDraft);
        if (draft) {
          setPumpReadings(draft.pumpReadings || []);
          setCash(draft.cash || '');
          setPrepayments(draft.prepayments || [{ name: '', amount: '' }]);
          setCredits(draft.credits || [{ name: '', amount: '' }]);
          setMyFuelCards(draft.myFuelCards || [{ name: '', amount: '' }]);
          setFdhCards(draft.fdhCards || [{ name: '', amount: '' }]);
          setNationalBankCards(draft.nationalBankCards || [{ name: '', amount: '' }]);
          setMoPayments(draft.moPayments || [{ name: '', amount: '' }]);
          setOwnUseEntries(draft.ownUseEntries || [{ type: 'vehicle', registration: '', volume: '', fuelType: 'petrol' }]);
          setShift(draft.shift || 'day');
        }
      } catch (error) {
        console.error('Error loading draft:', error);
      }
    }
  }, []);


  if (loading || !user) {
    return (
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
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-8 shadow-xl border border-gray-200">
            <svg className="animate-spin h-12 w-12 text-blue-600 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
            </svg>
            <p className="text-gray-900 font-semibold">Loading...</p>
          </div>
        </div>
      </>
    );
  }


  function updateList(list: PaymentEntry[], setList: Dispatch<SetStateAction<PaymentEntry[]>>, idx: number, field: string, value: string) {
  const newList = [...list];
  newList[idx] = { ...newList[idx], [field]: value };
  setList(newList);
}

function addEntry(list: PaymentEntry[], setList: Dispatch<SetStateAction<PaymentEntry[]>>) {
  setList([...list, { name: '', amount: '' }]);
}


  function getFuelPrice(fuelType: 'petrol' | 'diesel') {
    // Try to find a pump with the matching type (case-insensitive, partial match)
    let pump = pumps.find(p =>
      p.type && typeof p.type === 'string' &&
      p.type.toLowerCase().includes(fuelType)
    );
    // If not found, try fallback: look for a pump whose name includes the fuelType
    if (!pump) {
      pump = pumps.find(p =>
        p.name && typeof p.name === 'string' &&
        p.name.toLowerCase().includes(fuelType)
      );
    }
    // If still not found, fallback to first available pump with a price
    if (!pump && pumps.length > 0) {
      pump = pumps.find(p => typeof p.price !== 'undefined');
    }
    return pump && typeof pump.price !== 'undefined' ? Number(pump.price) : 0;
  }

  function getOwnUseAmount(
    entry:
      | { type: 'vehicle'; registration: string; volume: string; fuelType: 'petrol' | 'diesel' }
      | { type: 'genset'; hours: string; volume: string; fuelType: 'petrol' | 'diesel' }
      | { type: 'lawnmower'; gardener: string; volume: string; fuelType: 'petrol' | 'diesel' }
  ): number {
    const price = getFuelPrice(entry.fuelType);
    const volume = parseFloat(entry.volume) || 0;
    return Math.round(Number(price) * volume);
  }

  return (
    <>
      <GlobalBackground />
      {/* Foreground content */}
      <div className="relative min-h-screen w-full p-2 sm:p-4 space-y-4 z-10">
        {/* Header with clean styling */}
        <div className={cn(
          "flex flex-col sm:flex-row justify-between items-center mb-4 gap-2 sm:gap-0 rounded-2xl p-4 shadow-lg border backdrop-blur-xl",
          isDarkMode 
            ? "bg-white/5 border-white/10 text-white" 
            : "bg-white/20 border-white/30 text-gray-900"
        )}>
          <h2 className="text-xl font-bold">
            👋 Welcome, {user?.username || 'Guest'}!
          </h2>

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

            <div className="relative">
              <button
                className={cn(
                  "relative p-2 rounded-xl transition-all shadow-md",
                  isDarkMode 
                    ? "bg-orange-500/20 hover:bg-orange-500/30 text-orange-400" 
                    : "bg-orange-100 hover:bg-orange-200 text-orange-600"
                )}
                onClick={() => {
                  setShowNotifications(true);
                  setViewedNotifications(true);
                }}
                title="Fix Requests"
              >
                <svg width="24" height="24" fill="none" viewBox="0 0 24 24">
                  <path d="M12 22c1.1 0 2-.9 2-2h-4a2 2 0 0 0 2 2zm6-6V11c0-3.07-1.63-5.64-5-6.32V4a1 1 0 1 0-2 0v.68C7.63 5.36 6 7.92 6 11v5l-1.29 1.29A1 1 0 0 0 6 19h12a1 1 0 0 0 .71-1.71L18 16z" fill="currentColor"/>
                </svg>
                {fixNotifications.length > 0 && !viewedNotifications && (
                  <span className="absolute -top-1 -right-1 bg-red-600 text-white rounded-full text-xs px-2 py-0.5 font-bold shadow-md">
                    {fixNotifications.length}
                  </span>
                )}
              </button>
            </div>
            
            <Button
              onClick={handleLogout}
              className={cn(
                "rounded-xl px-4 py-2 font-semibold transition-all duration-200",
                isDarkMode
                  ? "bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30"
                  : "bg-red-100/80 hover:bg-red-200/90 text-red-800 border border-red-300"
              )}
            >
              🚪 Log Out
            </Button>
          </div>
        </div>

        {/* Notification Modal with modern styling */}
        {showNotifications && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4" onClick={() => setShowNotifications(false)}>
            <div
              className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl w-full max-w-md p-6 relative border border-white/30"
              onClick={e => e.stopPropagation()}
            >
              <button
                className="absolute top-3 right-3 text-gray-400 hover:text-red-600 text-3xl font-bold transition-colors"
                onClick={() => setShowNotifications(false)}
                aria-label="Close"
              >
                ×
              </button>
              <h3 className="font-bold text-2xl mb-4 text-gray-900">🔔 Notifications</h3>
              {fixNotifications.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-6xl mb-4">✅</div>
                  <p className="text-gray-600 text-lg">No fix requests.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {fixNotifications.map((n) => (
                    <button
                      key={n.id}
                      className="w-full text-left px-4 py-3 rounded-xl bg-gradient-to-r from-orange-50 to-yellow-50 hover:from-orange-100 hover:to-yellow-100 border-2 border-orange-300 transition-all shadow-md hover:shadow-lg"
                      onClick={() => {
                        setShowNotifications(false);
                        setViewedNotifications(true);
                        setShowSubmissions(false);
                        setShift(n.shift_type);
                        setExpandedDates((prev) => ({ ...prev, [n.shift_date]: true }));
                      }}
                    >
                      <div className="font-bold text-orange-900 mb-1">🔧 Fix requested for Pump {n.pump_id}</div>
                      <div className="text-sm text-gray-700">{n.shift_type === 'day' ? '☀️ Day' : '🌙 Night'} shift • 📅 {n.shift_date}</div>
                      <div className="text-sm text-orange-700 font-semibold mt-1">Reason: {n.fix_reason}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}    

        {/* Action Bar with clean styling */}
        <div className={cn(
          "rounded-2xl p-4 shadow-lg border backdrop-blur-xl mb-4",
          isDarkMode 
            ? "bg-white/5 border-white/10" 
            : "bg-white/20 border-white/30"
        )}>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label className={cn(
                "font-semibold text-sm",
                isDarkMode ? "text-gray-300" : "text-gray-700"
              )}>🔄 Shift:</label>
              <Select value={shift} onValueChange={val => setShift(val as 'day' | 'night')}>
                <SelectTrigger className={cn(
                  "w-36 rounded-xl border backdrop-blur-sm",
                  isDarkMode 
                    ? "bg-white/10 border-white/20 text-white" 
                    : "bg-white/30 border-white/40 text-gray-900"
                )}>
                  {shift === 'day' ? '☀️ Day Shift' : '🌙 Night Shift'}
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">☀️ Day Shift</SelectItem>
                  <SelectItem value="night">🌙 Night Shift</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex gap-2 ml-auto">
              <Button
                variant="outline"
                className={cn(
                  "rounded-xl px-4 py-2 font-semibold shadow-sm transition-all duration-200 border",
                  isDarkMode
                    ? "bg-white/10 hover:bg-white/20 text-white border-white/20"
                    : "bg-white/70 hover:bg-white/90 text-gray-900 border-gray-300"
                )}
                onClick={() => setShowReadings(true)}
              >
                ⛽ Enter Readings
              </Button>

              <Button
                variant="outline"
                className={cn(
                  "rounded-xl px-4 py-2 font-semibold shadow-sm transition-all duration-200 border",
                  showSubmissions 
                    ? isDarkMode
                      ? "bg-white/20 hover:bg-white/30 text-white border-white/30"
                      : "bg-gray-200/80 hover:bg-gray-300/90 text-gray-900 border-gray-400"
                    : isDarkMode
                      ? "bg-white/10 hover:bg-white/20 text-white border-white/20"
                      : "bg-white/70 hover:bg-white/90 text-gray-900 border-gray-300"
                )}
                onClick={() => {
                  setShowSubmissions(!showSubmissions);
                  setShowReadings(false);
                }}
              >
                {showSubmissions ? '🏠 Home' : '📋 My Submissions'}
              </Button>
            </div>
          </div>
        </div>
     

        {showReadings && (
          <div className="space-y-4">
            <div className="flex gap-3 mb-4">
              <Button
                variant="outline"
                className="bg-white/80 backdrop-blur-md hover:bg-white text-gray-900 rounded-xl px-4 py-2 font-semibold shadow-md hover:shadow-lg border-gray-200"
                onClick={() => {
                  setShowReadings(false);
                }}
              >
                🏠 Home
              </Button>
              <Button
                variant="outline"
                className="bg-white/70 hover:bg-white/90 hover:scale-[1.02] text-gray-900 rounded-xl px-4 py-2 font-semibold shadow-sm border border-gray-300 transition-all duration-200 active:scale-[0.98]"
                onClick={handleSaveDraft}
              >
                💾 Save Draft
              </Button>
            </div>

            {/* Multi-pump entry section */}
            <div className="space-y-4">
              <Button
                variant="default"
                className="bg-white/70 hover:bg-white/90 hover:scale-[1.02] text-gray-900 font-bold rounded-2xl px-8 py-4 flex items-center justify-center text-lg shadow-sm border border-gray-300 transition-all duration-200 active:scale-[0.98]"
                onClick={() => setShowPumpModal(true)}
              >
                <span className="mr-2 text-2xl">+</span> Add Pump
              </Button>

              {/* Modal for adding pump reading */}
              {showPumpModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4" onClick={() => setShowPumpModal(false)}>
                  <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl w-full max-w-md p-6 relative border border-white/30" onClick={e => e.stopPropagation()}>
                    <button className="absolute top-3 right-3 text-gray-400 hover:text-red-600 text-3xl font-bold transition-colors" onClick={() => setShowPumpModal(false)} aria-label="Close">×</button>
                    <h3 className="font-bold text-2xl mb-4 text-gray-900">⛽ Add Pump Reading</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block font-semibold text-gray-700 mb-2">Pump</label>
                        {loadingPumps ? (
                          <div className="text-gray-600 p-3 bg-gray-50 rounded-xl">Loading pumps...</div>
                        ) : pumpError ? (
                          <div className="text-red-600 p-3 bg-red-50 rounded-xl">{pumpError}</div>
                        ) : (
                          <select className="w-full border-2 border-gray-200 rounded-xl p-3 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" value={modalPumpId} onChange={e => setModalPumpId(e.target.value)}>
                            <option value="">Select pump</option>
                            {pumps.map(p => (
                              <option key={p.id} value={p.id} disabled={pumpReadings.some(r => r.pumpId === String(p.id))}>
                                {p.name} {pumpReadings.some(r => r.pumpId === String(p.id)) && '(Added)'}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                      <div>
                        <label className="block font-semibold text-gray-700 mb-2">Opening Meter</label>
                        <Input type="number" value={modalOpening} onChange={e => setModalOpening(e.target.value)} placeholder="Opening reading" className="rounded-xl border-2 border-gray-200 p-3" />
                      </div>
                      <div>
                        <label className="block font-semibold text-gray-700 mb-2">Closing Meter</label>
                        <Input type="number" value={modalClosing} onChange={e => setModalClosing(e.target.value)} placeholder="Closing reading" className="rounded-xl border-2 border-gray-200 p-3" />
                      </div>
                      {modalError && <div className="text-red-600 text-sm bg-red-50 p-3 rounded-xl font-semibold">⚠️ {modalError}</div>}
                      <Button className="mt-2 w-full bg-white/70 hover:bg-white/90 hover:scale-[1.01] text-gray-900 rounded-xl py-3 font-semibold shadow-sm border border-gray-300 transition-all duration-200 active:scale-[0.99]" onClick={handleAddPumpReading} disabled={loadingPumps || !!pumpError}>
                        Add Pump
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Cards for each pump reading */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pumpReadings.map((r, _idx) => {
                  const pump = pumps.find(p => String(p.id) === String(r.pumpId));
                  const volume = r.closing - r.opening;
                  const expected = pump ? volume * Number(pump.price) : 0;
                  return (
                    <Card key={r.pumpId} className="bg-white/90 backdrop-blur-md shadow-lg hover:shadow-xl transition-all rounded-2xl border border-blue-200">
                      <CardContent className="space-y-3 p-5">
                        <div className="flex justify-between items-center">
                          <h3 className="font-bold text-lg text-gray-900 flex items-center gap-2">
                            <span className="text-2xl">⛽</span>
                            {pump?.name}{pump?.type ? ` (${pump.type})` : ''}
                          </h3>
                          <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg" onClick={() => handleRemovePump(r.pumpId)}>
                            🗑️ Remove
                          </Button>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div className="bg-blue-50 rounded-lg p-2">Opening: <strong className="text-blue-900">{r.opening}</strong></div>
                          <div className="bg-green-50 rounded-lg p-2">Closing: <strong className="text-green-900">{r.closing}</strong></div>
                          <div className="bg-purple-50 rounded-lg p-2">Volume: <strong className="text-purple-900">{!isNaN(volume) ? volume.toLocaleString() : 0}L</strong></div>
                          <div className="bg-orange-50 rounded-lg p-2">Expected: <strong className="text-orange-900">{!isNaN(expected) ? expected.toLocaleString() : 0}</strong></div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Consolidated summary below cards */}
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 backdrop-blur-md rounded-2xl p-6 shadow-lg border border-blue-200 mt-4">
                <h3 className="font-bold text-2xl mb-4 text-gray-900 flex items-center gap-2">
                  <span className="text-3xl">📊</span>
                  Consolidated Summary
                </h3>
                {(() => {
                  const totalVolume = pumpReadings.reduce((sum, r) => sum + (r.closing - r.opening), 0);
                  const totalExpected = pumpReadings.reduce((sum, r) => {
                    const pump = pumps.find(p => String(p.id) === String(r.pumpId));
                    return sum + ((r.closing - r.opening) * (pump ? Number(pump.price) : 0));
                  }, 0);
                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-white rounded-xl p-4 shadow-md">
                        <div className="text-sm text-gray-600 font-semibold">Total Volume</div>
                        <div className="text-3xl font-bold text-blue-900">{!isNaN(totalVolume) ? totalVolume.toLocaleString() : 0}</div>
                        <div className="text-sm text-gray-500">litres</div>
                      </div>
                      <div className="bg-white rounded-xl p-4 shadow-md">
                        <div className="text-sm text-gray-600 font-semibold">Expected Return</div>
                        <div className="text-3xl font-bold text-green-900">{!isNaN(totalExpected) ? totalExpected.toLocaleString() : 0}</div>
                        <div className="text-sm text-gray-500">MWK</div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          {/* Multi-pump entry section end */}

            <Card className="bg-white/90 backdrop-blur-md shadow-lg rounded-2xl border border-yellow-200">
              <CardContent className="space-y-3 p-5">
                <h3 className="font-bold text-xl text-gray-900 flex items-center gap-2">
                  <span className="text-2xl">💵</span>
                  Cash Sales
                </h3>
                <Input
                  type="number"
                  value={cash}
                  onChange={e => handleNumericChange(e, setCash)}
                  placeholder="Total Cash Received"
                  className="text-black bg-white border-2 border-gray-200 rounded-xl p-3 focus:ring-2 focus:ring-yellow-500"
                />
              </CardContent>
            </Card>

            <Card className="bg-white/90 backdrop-blur-md shadow-lg rounded-2xl border border-green-200">
              <CardContent className="space-y-3 p-5">
                <h3 className="font-bold text-xl text-gray-900 flex items-center gap-2">
                  <span className="text-2xl">💳</span>
                  Prepayments
                </h3>
                {prepayments.map((p, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <Input
                      className="text-black bg-white border-2 border-gray-200 rounded-xl p-3"
                      placeholder="Customer Name"
                      value={p.name}
                      onChange={e => updateList(prepayments, setPrepayments, idx, 'name', e.target.value)}
                    />
                    <Input
                      className="text-black bg-white border-2 border-gray-200 rounded-xl p-3"
                      type="number"
                      placeholder="Amount"
                      value={p.amount}
                      onChange={e => handleNumericChange(e, (val) =>
                        updateList(prepayments, setPrepayments, idx, 'amount', val)
                      )}
                    />
                    <span className="ml-2 text-green-700 text-sm min-w-[70px] text-right font-bold">
                      {p.amount && !isNaN(Number(p.amount)) ? Number(p.amount).toLocaleString() : ''}
                    </span>
                  </div>
                ))}
                <Button onClick={() => addEntry(prepayments, setPrepayments)} className="bg-white/70 hover:bg-white/90 hover:scale-[1.02] text-gray-900 rounded-xl font-semibold shadow-sm border border-gray-300 transition-all duration-200 active:scale-[0.98]">
                  + Add Prepayment
                </Button>
              </CardContent>
            </Card>
            <Card className="bg-white/90 backdrop-blur-md shadow-lg rounded-2xl border border-blue-200">
              <CardContent className="space-y-3 p-5">
                <h3 className="font-bold text-xl text-gray-900 flex items-center gap-2">
                  <span className="text-2xl">🏦</span>
                  Credit Sales
                </h3>
                {credits.map((c, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <Input
                      className="text-black bg-white border-2 border-gray-200 rounded-xl p-3"
                      placeholder="Customer Name"
                      value={c.name}
                      onChange={e => updateList(credits, setCredits, idx, 'name', e.target.value)}
                    />
                    <Input
                      className="text-black bg-white border-2 border-gray-200 rounded-xl p-3"
                      type="number"
                      placeholder="Amount"
                      value={c.amount}
                      onChange={e => handleNumericChange(e, (val) =>
                        updateList(credits, setCredits, idx, 'amount', val)
                      )}
                    />
                    <span className="ml-2 text-blue-700 text-sm min-w-[70px] text-right font-bold">
                      {c.amount && !isNaN(Number(c.amount)) ? Number(c.amount).toLocaleString() : ''}
                    </span>
                  </div>
                ))}
                <Button onClick={() => addEntry(credits, setCredits)} className="bg-white/70 hover:bg-white/90 hover:scale-[1.02] text-gray-900 rounded-xl font-semibold shadow-sm border border-gray-300 transition-all duration-200 active:scale-[0.98]">
                  + Add Credit
                </Button>
              </CardContent>
            </Card>
            <Card className="bg-white/90 backdrop-blur-md shadow-lg rounded-2xl border border-purple-200">
              <CardContent className="space-y-3 p-5">
                <h3 className="font-bold text-xl text-gray-900 flex items-center gap-2">
                  <span className="text-2xl">⛽</span>
                  My Fuel Card Payments
                </h3>
                {myFuelCards.map((c, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <Input
                      className="text-black bg-white border-2 border-gray-200 rounded-xl p-3"
                      placeholder="Receipt number"
                      value={c.name}
                      onChange={e => updateList(myFuelCards, setMyFuelCards, idx, 'name', e.target.value)}
                    />
                    <Input
                      className="text-black bg-white border-2 border-gray-200 rounded-xl p-3"
                      type="number"
                      placeholder="Amount"
                      value={c.amount}
                      onChange={e => handleNumericChange(e, (val) =>
                        updateList(myFuelCards, setMyFuelCards, idx, 'amount', val)
                      )}
                    />
                    <span className="ml-2 text-purple-700 text-sm min-w-[70px] text-right font-bold">
                      {c.amount && !isNaN(Number(c.amount)) ? Number(c.amount).toLocaleString() : ''}
                    </span>
                  </div>
                ))}
                <Button onClick={() => addEntry(myFuelCards, setMyFuelCards)} className="bg-white/70 hover:bg-white/90 hover:scale-[1.02] text-gray-900 rounded-xl font-semibold text-sm shadow-sm border border-gray-300 transition-all duration-200 active:scale-[0.98]">
                  + Add Fuel Card
                </Button>
              </CardContent>
            </Card>

            <Card className="bg-white/90 backdrop-blur-md shadow-lg rounded-2xl border border-indigo-200">
              <CardContent className="space-y-3 p-5">
                <h3 className="font-bold text-xl text-gray-900 flex items-center gap-2">
                  <span className="text-2xl">🏧</span>
                  FDH Bank Card Payments
                </h3>
                {fdhCards.map((c, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <Input
                      className="text-black bg-white border-2 border-gray-200 rounded-xl p-3"
                      placeholder="Transaction number"
                      value={c.name}
                      onChange={e => updateList(fdhCards, setFdhCards, idx, 'name', e.target.value)}
                    />
                    <Input
                      className="text-black bg-white border-2 border-gray-200 rounded-xl p-3"
                      type="number"
                      placeholder="Amount"
                      value={c.amount}
                      onChange={e => handleNumericChange(e, (val) =>
                        updateList(fdhCards, setFdhCards, idx, 'amount', val)
                      )}
                    />
                    <span className="ml-2 text-indigo-700 text-sm min-w-[70px] text-right font-bold">
                      {c.amount && !isNaN(Number(c.amount)) ? Number(c.amount).toLocaleString() : ''}
                    </span>
                  </div>
                ))}
                <Button onClick={() => addEntry(fdhCards, setFdhCards)} className="bg-white/70 hover:bg-white/90 hover:scale-[1.02] text-gray-900 rounded-xl font-semibold text-sm shadow-sm border border-gray-300 transition-all duration-200 active:scale-[0.98]">+ Add FDH Card Payment</Button>
              </CardContent>
            </Card>

            <Card className="bg-white/90 backdrop-blur-md shadow-lg rounded-2xl border border-pink-200">
              <CardContent className="space-y-3 p-5">
                <h3 className="font-bold text-xl text-gray-900 flex items-center gap-2">
                  <span className="text-2xl">🏦</span>
                  National Bank Card Payments
                </h3>
                {nationalBankCards.map((c, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <Input
                      className="text-black bg-white border-2 border-gray-200 rounded-xl p-3"
                      placeholder="Invoice number"
                      value={c.name}
                      onChange={e => updateList(nationalBankCards, setNationalBankCards, idx, 'name', e.target.value)}
                    />
                    <Input
                      className="text-black bg-white border-2 border-gray-200 rounded-xl p-3"
                      type="number"
                      placeholder="Amount"
                      value={c.amount}
                      onChange={e => handleNumericChange(e, (val) =>
                        updateList(nationalBankCards, setNationalBankCards, idx, 'amount', val)
                      )}
                    />
                    <span className="ml-2 text-pink-700 text-sm min-w-[70px] text-right font-bold">
                      {c.amount && !isNaN(Number(c.amount)) ? Number(c.amount).toLocaleString() : ''}
                    </span>
                  </div>
                ))}
                <Button onClick={() => addEntry(nationalBankCards, setNationalBankCards)} className="bg-white/70 hover:bg-white/90 hover:scale-[1.02] text-gray-900 rounded-xl font-semibold text-sm shadow-sm border border-gray-300 transition-all duration-200 active:scale-[0.98]">+ Add National Bank Card Payment</Button>
              </CardContent>
            </Card>

            <Card className="bg-white/90 backdrop-blur-md shadow-lg rounded-2xl border border-red-200">
              <CardContent className="space-y-3 p-5">
                <h3 className="font-bold text-xl text-gray-900 flex items-center gap-2">
                  <span className="text-2xl">📱</span>
                  MO - Payments
                </h3>
                {moPayments.map((m, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <Input
                      className="text-black bg-white border-2 border-gray-200 rounded-xl p-3"
                      placeholder="Invoice number"
                      value={m.name}
                      onChange={e => updateList(moPayments, setMoPayments, idx, 'name', e.target.value)}
                    />
                    <Input
                      className="text-black bg-white border-2 border-gray-200 rounded-xl p-3"
                      type="number"
                      placeholder="Amount"
                      value={m.amount}
                      onChange={e => handleNumericChange(e, (val) =>
                        updateList(moPayments,setMoPayments, idx, 'amount', val)
                      )}
                    />
                    <span className="ml-2 text-red-700 text-sm min-w-[70px] text-right font-bold">
                      {m.amount && !isNaN(Number(m.amount)) ? Number(m.amount).toLocaleString() : ''}
                    </span>
                  </div>
                ))}
                <Button onClick={() => addEntry(moPayments, setMoPayments)} className="bg-white/70 hover:bg-white/90 hover:scale-[1.02] text-gray-900 rounded-xl font-semibold text-sm shadow-sm border border-gray-300 transition-all duration-200 active:scale-[0.98]">+ Add Mo Payment</Button>
              </CardContent>
            </Card>

            <Card className="bg-white/90 backdrop-blur-md shadow-lg rounded-2xl border border-gray-200">
              <CardContent className="space-y-4 p-5">
                <h3 className="font-bold text-xl text-gray-900 flex items-center gap-2">
                  <span className="text-2xl">🚗</span>
                  Own Use
                </h3>
                {ownUseEntries.map((entry, idx) => (
                  <div key={idx} className="space-y-3 border-b border-gray-200 pb-4 mb-4 bg-gray-50 rounded-xl p-4">
                    <div className="flex justify-between items-center">
                      <h4 className="font-bold capitalize text-gray-900">
                        {entry.type === 'vehicle' && '🚗'} 
                        {entry.type === 'genset' && '⚡'} 
                        {entry.type === 'lawnmower' && '🌱'} 
                        {' '}{entry.type} Use
                      </h4>
                      {ownUseEntries.length > 1 && (
                        <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg" onClick={() => removeOwnUseEntry(idx)}>
                          🗑️ Remove
                        </Button>
                      )}
                    </div>
        {entry.type === 'vehicle' && (
          <>
                    <Input
                      className="text-black bg-white border-2 border-gray-200 rounded-xl p-3"
                      placeholder="Vehicle Registration"
                      value={entry.registration}
                      onChange={e => updateOwnUseEntry(idx, 'registration', e.target.value)}
                    />
                    <Input
                      className="text-black bg-white border-2 border-gray-200 rounded-xl p-3"
                      placeholder="Volume (litres)"
                      type="number"
                      value={entry.volume}
                      onChange={e => updateOwnUseEntry(idx, 'volume', e.target.value)}
                    />
                    <select
                      className="w-full border-2 border-gray-200 rounded-xl p-3 bg-white text-black focus:ring-2 focus:ring-blue-500"
                      value={entry.fuelType}
                      onChange={e => updateOwnUseEntry(idx, 'fuelType', e.target.value)}
                    >
                      <option value="petrol">⛽ Petrol</option>
                      <option value="diesel">🚛 Diesel</option>
                    </select>
                    <div className="bg-blue-50 rounded-lg p-3 mt-2">
                      <span className="text-sm text-gray-600">Amount: </span>
                      <strong className="text-lg text-blue-900">{getOwnUseAmount(entry).toLocaleString()} MWK</strong>
                    </div>
          </>
        )}
        {entry.type === 'genset' && (
          <>
            <Input
              className="text-black bg-white/50"
              placeholder="Hours Used"
              type="number"
              value={entry.hours}
              onChange={e => updateOwnUseEntry(idx, 'hours', e.target.value)}
            />
            <Input
              className="text-black bg-white/50"
              placeholder="Volume (litres)"
              type="number"
              value={entry.volume}
              onChange={e => updateOwnUseEntry(idx, 'volume', e.target.value)}
            />
            <select
              className="w-full border rounded p-2 bg-white/50 text-black"
              value={entry.fuelType}
              onChange={e => updateOwnUseEntry(idx, 'fuelType', e.target.value)}
            >
              <option value="petrol">Petrol</option>
              <option value="diesel">Diesel</option>
            </select>
            <div className="mt-2">
              Amount: <strong>{getOwnUseAmount(entry).toLocaleString()} MWK</strong>
            </div>
          </>
        )}
        {entry.type === 'lawnmower' && (
          <>
            <Input
              className="text-black bg-white/50"
              placeholder="Gardener Name"
              value={entry.gardener}
              onChange={e => updateOwnUseEntry(idx, 'gardener', e.target.value)}
            />
            <Input
              className="text-black bg-white/50"
              placeholder="Volume (litres)"
              type="number"
              value={entry.volume}
              onChange={e => updateOwnUseEntry(idx, 'volume', e.target.value)}
            />
            <select
              className="w-full border rounded p-2 bg-white/50 text-black"
              value={entry.fuelType}
              onChange={e => updateOwnUseEntry(idx, 'fuelType', e.target.value)}
            >
              <option value="petrol">Petrol</option>
              <option value="diesel">Diesel</option>
            </select>
            <div className="mt-2">
              Amount: <strong>{getOwnUseAmount(entry).toLocaleString()} MWK</strong>
            </div>
          </>
        )}
      </div>
    ))}
                <div className="flex gap-2 flex-wrap">
                  <Button size="sm" variant="outline" className="bg-white/70 hover:bg-white/90 hover:scale-[1.02] text-gray-900 rounded-xl font-semibold border border-gray-300 shadow-sm transition-all duration-200 active:scale-[0.98]" onClick={() => addOwnUseEntry('vehicle')}>
                    🚗 + Vehicle
                  </Button>
                  <Button size="sm" variant="outline" className="bg-white/70 hover:bg-white/90 hover:scale-[1.02] text-gray-900 rounded-xl font-semibold border border-gray-300 shadow-sm transition-all duration-200 active:scale-[0.98]" onClick={() => addOwnUseEntry('genset')}>
                    ⚡ + Genset
                  </Button>
                  <Button size="sm" variant="outline" className="bg-white/70 hover:bg-white/90 hover:scale-[1.02] text-gray-900 rounded-xl font-semibold border border-gray-300 shadow-sm transition-all duration-200 active:scale-[0.98]" onClick={() => addOwnUseEntry('lawnmower')}>
                    🌱 + Lawnmower
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="bg-gradient-to-r from-blue-50 to-purple-50 backdrop-blur-md rounded-2xl p-6 shadow-lg border border-blue-200">
              <h3 className="font-bold text-2xl mb-4 text-gray-900 flex items-center gap-2">
                <span className="text-3xl">📊</span>
                Final Summary
              </h3>
              {(() => {
                const totalVolume = pumpReadings.reduce((sum, r) => sum + (r.closing - r.opening), 0);
                const totalExpected = pumpReadings.reduce((sum, r) => {
                  const pump = pumps.find(p => String(p.id) === String(r.pumpId));
                  return sum + ((r.closing - r.opening) * (pump ? Number(pump.price) : 0));
                }, 0);
                const ownUseTotal = ownUseEntries.reduce((sum, entry) => sum + getOwnUseAmount(entry), 0);
                const collected = Number(cash)
                  + prepayments.reduce((sum, p) => sum + Number(p.amount), 0)
                  + credits.reduce((sum, c) => sum + Number(c.amount), 0)
                  + myFuelCards.reduce((sum, c) => sum + Number(c.amount), 0)
                  + fdhCards.reduce((sum, c) => sum + Number(c.amount), 0)
                  + nationalBankCards.reduce((sum, c) => sum + Number(c.amount), 0)
                  + moPayments.reduce((sum, m) => sum + Number(m.amount), 0)
                  + ownUseTotal;
                
                return (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <div className="bg-white rounded-xl p-4 shadow-md">
                        <div className="text-sm text-gray-600 font-semibold">Total Volume</div>
                        <div className="text-2xl font-bold text-blue-900">{!isNaN(totalVolume) ? totalVolume.toLocaleString() : 0}</div>
                        <div className="text-sm text-gray-500">litres</div>
                      </div>
                      <div className="bg-white rounded-xl p-4 shadow-md">
                        <div className="text-sm text-gray-600 font-semibold">Expected Return</div>
                        <div className="text-2xl font-bold text-purple-900">{!isNaN(totalExpected) ? totalExpected.toLocaleString() : 0}</div>
                        <div className="text-sm text-gray-500">MWK</div>
                      </div>
                      <div className="bg-white rounded-xl p-4 shadow-md">
                        <div className="text-sm text-gray-600 font-semibold">Total Collected</div>
                        <div className="text-2xl font-bold text-green-900">{!isNaN(collected) ? collected.toLocaleString() : 0}</div>
                        <div className="text-sm text-gray-500">MWK</div>
                      </div>
                    </div>
                    
                    {collected !== totalExpected && (
                      <div className={cn(
                        "rounded-xl p-4 font-bold text-lg text-center",
                        collected < totalExpected ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
                      )}>
                        {collected < totalExpected ? '⚠️ Shortage' : '✅ Overage'}: {Math.abs(collected - totalExpected).toLocaleString()} MWK
                      </div>
                    )}
                    {collected === totalExpected && (
                      <div className="bg-gray-100 text-gray-700 rounded-xl p-4 font-bold text-lg text-center">
                        ✅ Balanced
                      </div>
                    )}
                    
                    <Button 
                      className="mt-6 w-full bg-black hover:bg-gray-800 hover:scale-[1.01] text-white rounded-2xl py-4 text-lg font-bold shadow-lg border-2 border-black transition-all duration-200 active:scale-[0.99]" 
                      onClick={() => submitShift.mutate()} 
                      disabled={submitShift.isPending}
                    >
                      {submitShift.isPending ? '⏳ Submitting...' : '✅ Submit Shift'}
                    </Button>
                  </>
                );
              })()}
            </div>
          </div>
        )}

        {showSubmissions && (
          <div id="submissions-section" className="mt-4">
            <div className="bg-white/80 backdrop-blur-md rounded-2xl p-6 shadow-lg border border-white/20 mb-4">
              <h2 className="text-2xl font-bold mb-4 flex items-center gap-3 text-gray-900">
                <span className="text-3xl">📋</span>
                <span>My Submissions</span>
                {fixNotifications.length > 0 && !viewedNotifications && (
                  <span className="bg-red-600 text-white rounded-full text-sm px-3 py-1 font-bold shadow-md">
                    {fixNotifications.length} Fix Request{fixNotifications.length > 1 ? 's' : ''}
                  </span>
                )}
              </h2>
              
              {submissions.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">📝</div>
                  <p className="text-gray-600 text-lg">No submissions yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {Object.entries(
                    submissions.reduce<{ [date: string]: any[] }>((acc, s) => {
                      (acc[s.shift_date] = acc[s.shift_date] || []).push(s);
                      return acc;
                    }, {})
                  ).map(([date, records]) => (
                    <div key={date} className="bg-white rounded-2xl shadow-md border border-gray-200 overflow-hidden">
                      <button
                        className="w-full text-left px-5 py-3 font-bold text-lg flex items-center justify-between bg-gradient-to-r from-blue-50 to-purple-50 hover:from-blue-100 hover:to-purple-100 transition-all"
                        onClick={() => setExpandedDates((prev) => ({ ...prev, [date]: !prev[date] }))}
                      >
                        <span className="flex items-center gap-2">
                          <span className="text-2xl">📅</span>
                          {date}
                        </span>
                        <span className="text-gray-500">{expandedDates[date] ? '▲' : '▼'}</span>
                      </button>
                      {expandedDates[date] && (
                        <div className="p-4 space-y-3">
                          {(records as any[]).map((s: any) => {
                            const pumpName = pumps.find(p => String(p.id) === String(s.pump_id))?.name || s.pump_id;
                            return (
                              <div
                                key={s.id}
                                className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-gray-200 pb-3 last:border-0"
                              >
                                <div className="flex-1">
                                  <div className="font-semibold text-gray-900 flex items-center gap-2">
                                    <span className="text-xl">⛽</span>
                                    {pumpName} • {s.shift_type === 'day' ? '☀️ Day' : '🌙 Night'}
                                  </div>
                                  <div className="text-sm text-gray-600 mt-1">
                                    Volume: <strong>{(s.closing_reading - s.opening_reading).toLocaleString()}L</strong>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 mt-2 sm:mt-0">
                                  {s.is_approved ? (
                                    <span className="bg-green-600 text-white px-3 py-1 rounded-full text-sm font-semibold shadow-md">✅ Authorised</span>
                                  ) : s.fix_reason && !s.is_approved ? (
                                    <>
                                      <span className="bg-yellow-600 text-white px-3 py-1 rounded-full text-sm font-semibold shadow-md">🔧 Fix Requested</span>
                                      <Button
                                        className="bg-white/70 hover:bg-white/90 hover:scale-[1.02] text-gray-900 px-4 py-1 rounded-xl text-sm font-semibold shadow-sm border border-gray-300 transition-all duration-200 active:scale-[0.98]"
                                        onClick={async () => {
                                          setShowSubmissions(false);
                                          setShift(s.shift_type);
                                          await supabase.from('shifts').update({ is_approved: false, fix_reason: null }).eq('id', s.id);
                                          if (!user) return;
                                          const { data, error } = await supabase
                                            .from('shifts')
                                            .select('*')
                                            .eq('attendant_id', user.id)
                                            .order('shift_date', { ascending: false });
                                          if (!error && data) {
                                            setSubmissions(data);
                                            setFixNotifications(data.filter((row: any) => row.fix_reason && !row.is_approved));
                                          }
                                        }}
                                      >
                                        Fix Now
                                      </Button>
                                    </>
                                  ) : (
                                    <span className="bg-gray-400 text-white px-3 py-1 rounded-full text-sm font-semibold shadow-md">⏳ Pending</span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default AttendantDashboard;
// Fixed JSX structure and button styling