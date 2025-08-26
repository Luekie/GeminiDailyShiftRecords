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
  

interface PaymentEntry {
  name: string;
  amount: string;
}


interface Reading {
  opening: number;
  closing: number;
}


const AttendantDashboard = () => {
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
  const [selectedPumpId, setSelectedPumpId] = useState<string>("");
  const [reading, setReading] = useState<Reading>({ opening: 0, closing: 0 });
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
    const today = new Date().toISOString().slice(0, 10);
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
      const today = new Date().toISOString().slice(0, 10);
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
      setSelectedPumpId("");
      setReading({ opening: 0, closing: 0 });
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
    if (!selectedPumpId) {
      alert('Please select a pump first');
      return;
    }

    const draft = {
      pump_id: selectedPumpId,
      opening_reading: reading.opening,
      closing_reading: reading.closing,
      cash,
      prepayments,
      credits,
      myFuelCards,
      fdhCards,
      nationalBankCards,
      shift,
      shift_date: new Date().toISOString().slice(0, 10),
    };
    localStorage.setItem('shiftDraft', JSON.stringify(draft));
    alert('Draft saved!');
  }
  
  useEffect(() => {
    const savedDraft = localStorage.getItem('shiftDraft');
    if (savedDraft) {
      try {
        const draft = JSON.parse(savedDraft);
        if (draft) {
          setSelectedPumpId(draft.pump_id || "");
          setReading({ 
            opening: Number(draft.opening_reading) || 0, 
            closing: Number(draft.closing_reading) || 0 
          });
          setCash(draft.cash || '');
          setPrepayments(draft.prepayments || [{ name: '', amount: '' }]);
          setCredits(draft.credits || [{ name: '', amount: '' }]);
          setMyFuelCards(draft.myFuelCards || [{ name: '', amount: '' }]);
          setFdhCards(draft.fdhCards || [{ name: '', amount: '' }]);
          setNationalBankCards(draft.nationalBankCards || [{ name: '', amount: '' }]);
          
        }
      } catch (error) {
        console.error('Error loading draft:', error);
      }
    }
  }, []);

   if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
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

    <div className=" relative min-h-screen w-full p-4 space-y-4 ">

    
      <div className="flex flex-wrap items-center justify-between gap-2 px-2">
      <h2 className="text-base font-semibold text-white">
        Welcome, {user?.username || 'Guest'}!
      </h2>

      
    <div className="relative">
  <button
    className="justify-center"
    onClick={() => {
      setShowNotifications(true);
      setViewedNotifications(true); // Mark notifications as viewed
    }}
    title="Fix Requests"
  >
    <svg width="28" height="28" fill="none" viewBox="0 0 24 24">
      <path d="M12 22c1.1 0 2-.9 2-2h-4a2 2 0 0 0 2 2zm6-6V11c0-3.07-1.63-5.64-5-6.32V4a1 1 0 1 0-2 0v.68C7.63 5.36 6 7.92 6 11v5l-1.29 1.29A1 1 0 0 0 6 19h12a1 1 0 0 0 .71-1.71L18 16z" fill="#f59e42"/>
    </svg>
    {fixNotifications.length > 0 && !viewedNotifications && (
      <span className="absolute top-0 right-0 bg-red-600 text-white rounded-full text-xs px-1.5 py-0.5">
        {fixNotifications.length}
      </span>
    )}
  </button>
  {/* Notification Modal Popup */}
  {showNotifications && (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowNotifications(false)}>
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-md mx-auto p-4 relative"
        style={{ minWidth: 320 }}
        onClick={e => e.stopPropagation()}
      >
        <button
          className="absolute top-2 right-2 text-gray-500 hover:text-gray-800 text-xl font-bold"
          onClick={() => setShowNotifications(false)}
          aria-label="Close"
        >
          ×
        </button>
        <div className="font-bold text-lg mb-2 text-gray-800">Notifications</div>
        {fixNotifications.length === 0 ? (
          <div className="p-4 text-gray-500 text-center">No fix requests.</div>
        ) : (
          <div className="space-y-2">
            {fixNotifications.map((n) => (
              <button
                key={n.id}
                className="w-full text-left px-4 py-2 rounded bg-orange-50 hover:bg-orange-100 border border-orange-200 flex flex-col"
                onClick={() => {
                  setShowNotifications(false);
                  setViewedNotifications(true); // Mark notifications as viewed
                  setShowSubmissions(false); // Hide submissions section
                  setSelectedPumpId(String(n.pump_id));
                  setShift(n.shift_type);
                  setReading({ opening: n.opening_reading, closing: n.closing_reading });
                  setExpandedDates((prev) => ({ ...prev, [n.shift_date]: true }));
                  setTimeout(() => {
                    // Only scroll to pump section, not submissions
                  }, 100);
                }}
              >
                <span className="font-medium text-orange-800">Fix requested for Pump {n.pump_id} ({n.shift_type} shift)</span>
                <span className="text-xs text-gray-600">{n.shift_date}</span>
                <span className="text-xs text-orange-700">Reason: {n.fix_reason}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )}
</div>


      

 
      <Button
        onClick={handleLogout}
        className=" flex justify-right bg-red-600 text-white hover:bg-red-700 rounded-md text-sm px-3 py-1"
      >
        Log Out
      </Button>
    </div>

    

      <div className="flex items-center mb-6 gap-4"> {/* Increased bottom margin and gap */}
        <div className="flex items-center space-x-4"> {/* Group for shift selector with spacing */}
          <label className="font-semibold whitespace-nowrap" style={{ color: '#222' }}>
            Select Shift:
          </label>
          <Select value={shift} onValueChange={val => setShift(val as 'day' | 'night')}>
            <SelectTrigger className="w-32 bg-white/50">
              {shift.toUpperCase()} Shift
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Day</SelectItem>
              <SelectItem value="night">Night</SelectItem>
            </SelectContent>
          </Select>
        </div>
       
        <Button
          variant="outline"
          className="bg-white/50 ml-4"
          onClick={() => setShowReadings(true)}
        >
          Enter Pump Readings

        </Button>

        <Button
          variant="outline"
          className="bg-white/50 ml-4"
          onClick={() => {
            setShowSubmissions(!showSubmissions);
            setShowReadings(false);
          }}
        >
          {showSubmissions ? 'Hide Submissions' : 'My Submissions'}
        </Button>
      </div>
     

    {showReadings &&(
        <div className="space-y-4 ">
          <div className="flex gap-2 mb-2">
            <Button
              variant="outline"
              className="bg-white/50"
              onClick={() => {
                setShowReadings(false);
                setSelectedPumpId("");
              }}
            >
              home
            </Button>
            <Button
              variant="outline"
              className="bg-white/50"
              onClick={handleSaveDraft}
            >
              Save Draft
            </Button>
          </div>

          {/* Multi-pump entry section start */}
          <div className="space-y-4">
            <Button
              variant="outline"
              className="bg-white/50 mb-4"
              onClick={() => setShowPumpModal(true)}
            >
              add pump
            </Button>

            {/* Modal for adding pump reading */}
            {showPumpModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowPumpModal(false)}>
                <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-auto p-6 relative" onClick={e => e.stopPropagation()}>
                  <button className="absolute top-2 right-2 text-gray-500 hover:text-gray-800 text-xl font-bold" onClick={() => setShowPumpModal(false)} aria-label="Close">×</button>
                  <h3 className="font-semibold mb-4">Add Pump Reading</h3>
                  <div className="space-y-3">
                    <label className="block font-medium">Pump</label>
                    {loadingPumps ? (
                      <div className="text-gray-600">Loading pumps...</div>
                    ) : pumpError ? (
                      <div className="text-red-600">{pumpError}</div>
                    ) : (
                      <select className="w-full border rounded p-2" value={modalPumpId} onChange={e => setModalPumpId(e.target.value)}>
                        <option value="">Select pump</option>
                        {pumps.map(p => (
                          <option key={p.id} value={p.id} disabled={pumpReadings.some(r => r.pumpId === String(p.id))}>
                            {p.name} {pumpReadings.some(r => r.pumpId === String(p.id)) && '(Added)'}
                          </option>
                        ))}
                      </select>
                    )}
                    <label className="block font-medium">Opening Meter</label>
                    <Input type="number" value={modalOpening} onChange={e => setModalOpening(e.target.value)} placeholder="Opening" />
                    <label className="block font-medium">Closing Meter</label>
                    <Input type="number" value={modalClosing} onChange={e => setModalClosing(e.target.value)} placeholder="Closing" />
                    {modalError && <div className="text-red-600 text-sm">{modalError}</div>}
                    <Button className="mt-2 w-full" onClick={handleAddPumpReading} disabled={loadingPumps || !!pumpError}>Add</Button>
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
                  <Card key={r.pumpId} className="bg-white/50 shadow-md" style={{ borderRadius: 12, border: '1px solid #e5e5ea' }}>
                    <CardContent className="space-y-2 p-4">
                      <div className="flex justify-between items-center">
                        <h3 className="font-semibold">{pump?.name}{pump?.type ? ` (${pump.type})` : ''}</h3>
                        <Button size="sm" variant="ghost" onClick={() => handleRemovePump(r.pumpId)}>Remove</Button>
                      </div>
                      <div>Opening: <strong>{r.opening}</strong></div>
                      <div>Closing: <strong>{r.closing}</strong></div>
                      <div>Volume Sold: <strong>{!isNaN(volume) ? volume.toLocaleString() : 0} litres</strong></div>
                      <div>Expected: <strong>{!isNaN(expected) ? expected.toLocaleString() : 0} MWK</strong></div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Consolidated summary below cards */}
            <div className="p-4 border rounded-lg space-y-2 bg-white/50 shadow mt-4">
              <h3 className="font-semibold text-xl">Consolidated Summary</h3>
              {(() => {
                const totalVolume = pumpReadings.reduce((sum, r) => sum + (r.closing - r.opening), 0);
                const totalExpected = pumpReadings.reduce((sum, r) => {
                  const pump = pumps.find(p => String(p.id) === String(r.pumpId));
                  return sum + ((r.closing - r.opening) * (pump ? Number(pump.price) : 0));
                }, 0);
                return (
                  <>
                    <p>Total Volume: <strong>{!isNaN(totalVolume) ? totalVolume.toLocaleString() : 0} litres</strong></p>
                    <p>Total Expected Return: <strong>{!isNaN(totalExpected) ? totalExpected.toLocaleString() : 0} MWK</strong></p>
                  </>
                );
              })()}
            </div>
          </div>
          {/* Multi-pump entry section end */}

          <Card className="bg-white/50 shadow-md">
            <CardContent className="space-y-2 p-4">
              <h3 className="font-semibold">Cash Sales</h3> {/* Add a heading */}
              <div className="flex gap-2 ">
                <Input
                  type="number"
                  value={cash}
                  onChange={e => handleNumericChange(e, setCash)}
                  placeholder="Total Cash Received"
                  className="text-black bg-white/40"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/50 shadow-md">
            <CardContent className="space-y-2 p-4">
              <h3 className="font-semibold">Prepayments</h3>
              {prepayments.map((p, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <Input
                    className="text-black bg-white/50"
                    placeholder="Customer Name"
                    value={p.name}
                    onChange={e => updateList(prepayments, setPrepayments, idx, 'name', e.target.value)}
                  />
                  <Input
                    className="text-black bg-white/50"
                    type="number"
                    placeholder="Amount"
                    value={p.amount}
                    onChange={e => handleNumericChange(e, (val) =>
                      updateList(prepayments, setPrepayments, idx, 'amount', val)
                    )}
                  />
                  <span className="ml-2 text-gray-700 text-sm min-w-[70px] text-right">
                    {p.amount && !isNaN(Number(p.amount)) ? Number(p.amount).toLocaleString() : ''}
                  </span>
                </div>
              ))}
              <Button onClick={() => addEntry(prepayments, setPrepayments)}>+ Add Prepayment</Button>
              {/* Save prepayments as array in DB */}
            </CardContent>
          </Card>
          <Card className="bg-white/50 shadow-md">
            <CardContent className="space-y-2 p-4">
              <h3 className="font-semibold">Credit Sales</h3>
              {credits.map((c, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <Input
                    className="text-black bg-white/50"
                    placeholder="Customer Name"
                    value={c.name}
                    onChange={e => updateList(credits, setCredits, idx, 'name', e.target.value)}
                  />
                  <Input
                    className="text-black bg-white/50"
                    type="number"
                    placeholder="Amount"
                    value={c.amount}
                    onChange={e => handleNumericChange(e, (val) =>
                      updateList(credits, setCredits, idx, 'amount', val)
                    )}
                  />
                  <span className="ml-2 text-gray-700 text-sm min-w-[70px] text-right">
                    {c.amount && !isNaN(Number(c.amount)) ? Number(c.amount).toLocaleString() : ''}
                  </span>
                </div>
              ))}
              <Button onClick={() => addEntry(credits, setCredits)}>+ Add Credit</Button>
              {/* Save credits as array in DB */}
            </CardContent>
          </Card>
          <Card className="bg-white/50 shadow-md">
            <CardContent className="space-y-2 p-4">
              <h3 className="font-semibold">Card Payments</h3>
              <h4 className="font-semibold text-sm mt-2">My Fuel Card Payments</h4>
              {myFuelCards.map((c, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <Input
                    className="text-black bg-white/50"
                    placeholder="Receipt number"
                    value={c.name}
                    onChange={e => updateList(myFuelCards, setMyFuelCards, idx, 'name', e.target.value)}
                  />
                  <Input
                    className="text-black bg-white/50"
                    type="number"
                    placeholder="Amount"
                    value={c.amount}
                    onChange={e => handleNumericChange(e, (val) =>
                      updateList(myFuelCards, setMyFuelCards, idx, 'amount', val)
                    )}
                  />
                  <span className="ml-2 text-gray-700 text-sm min-w-[70px] text-right">
                    {c.amount && !isNaN(Number(c.amount)) ? Number(c.amount).toLocaleString() : ''}
                  </span>
                </div>
              ))}
              <Button onClick={() => addEntry(myFuelCards, setMyFuelCards)}>+ Add My Fuel Card Payment</Button>

              <h4 className="font-semibold text-sm mt-4">FDH Bank Card Payments</h4>
              {fdhCards.map((c, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <Input
                    className="text-black bg-white/50"
                    placeholder="Transaction number"
                    value={c.name}
                    onChange={e => updateList(fdhCards, setFdhCards, idx, 'name', e.target.value)}
                  />
                  <Input
                    className="text-black bg-white/50"
                    type="number"
                    placeholder="Amount"
                    value={c.amount}
                    onChange={e => handleNumericChange(e, (val) =>
                      updateList(fdhCards, setFdhCards, idx, 'amount', val)
                    )}
                  />
                  <span className="ml-2 text-gray-700 text-sm min-w-[70px] text-right">
                    {c.amount && !isNaN(Number(c.amount)) ? Number(c.amount).toLocaleString() : ''}
                  </span>
                </div>
              ))}
              <Button onClick={() => addEntry(fdhCards, setFdhCards)}>+ Add FDH Card Payment</Button>

              <h4 className="font-semibold text-sm mt-4">National Bank Card Payments</h4>
              {nationalBankCards.map((c, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <Input
                    className="text-black bg-white/50"
                    placeholder="Invoice number"
                    value={c.name}
                    onChange={e => updateList(nationalBankCards, setNationalBankCards, idx, 'name', e.target.value)}
                  />
                  <Input
                    className="text-black bg-white/50"
                    type="number"
                    placeholder="Amount"
                    value={c.amount}
                    onChange={e => handleNumericChange(e, (val) =>
                      updateList(nationalBankCards, setNationalBankCards, idx, 'amount', val)
                    )}
                  />
                  <span className="ml-2 text-gray-700 text-sm min-w-[70px] text-right">
                    {c.amount && !isNaN(Number(c.amount)) ? Number(c.amount).toLocaleString() : ''}
                  </span>
                </div>
              ))}
              <Button onClick={() => addEntry(nationalBankCards, setNationalBankCards)}>+ Add National Bank Card Payment</Button>

             <h4 className="font-semibold text-sm mt-4">MO - Payments </h4>
              {moPayments.map((m, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <Input
                    className="text-black bg-white/50"
                    placeholder="Invoice number"
                    value={m.name}
                    onChange={e => updateList(moPayments, setMoPayments, idx, 'name', e.target.value)}
                  />
                  <Input
                    className="text-black bg-white/50"
                    type="number"
                    placeholder="Amount"
                    value={m.amount}
                    onChange={e => handleNumericChange(e, (val) =>
                      updateList(moPayments,setMoPayments, idx, 'amount', val)
                    )}
                  />
                  <span className="ml-2 text-gray-700 text-sm min-w-[70px] text-right">
                    {m.amount && !isNaN(Number(m.amount)) ? Number(m.amount).toLocaleString() : ''}
                  </span>
                </div>
              ))}
              <Button onClick={() => addEntry(moPayments, setMoPayments)}>+ Add Mo Payment</Button>

 

            </CardContent>
          </Card>

          <Card className="bg-white/50 shadow-md">
  <CardContent className="space-y-4 p-4">
    <h3 className="text-lg font-semibold">Own Use</h3>
    {ownUseEntries.map((entry, idx) => (
      <div key={idx} className="space-y-2 border-b pb-2 mb-2  rounded-lg p-3"> {/* Added bg-gray-100, rounded, p-3 */}
        <div className="flex justify-between items-center">
          <h4 className="font-semibold capitalize">{entry.type} Use</h4>
          {ownUseEntries.length > 1 && (
            <Button size="sm" variant="ghost" onClick={() => removeOwnUseEntry(idx)}>
              Remove
            </Button>
          )}
        </div>
        {entry.type === 'vehicle' && (
          <>
            <Input
              className="text-black bg-white/50"
              placeholder="Vehicle Registration"
              value={entry.registration}
              onChange={e => updateOwnUseEntry(idx, 'registration', e.target.value)}
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
    <div className="flex gap-2">
      <Button size="sm" variant="outline" onClick={() => addOwnUseEntry('vehicle')}>+ Vehicle</Button>
      <Button size="sm" variant="outline" onClick={() => addOwnUseEntry('genset')}>+ Genset</Button>
      <Button size="sm" variant="outline" onClick={() => addOwnUseEntry('lawnmower')}>+ Lawnmower</Button>
    </div>
    {/* Submit Own Use button removed as requested */}
  </CardContent>
</Card>

          <div className="p-4 border rounded-lg space-y-2 bg-white/50 shadow">
            <h3 className="font-semibold text-xl">Summary</h3>
            {(() => {
              // Calculate total expected and total volume from all pump readings
              const totalVolume = pumpReadings.reduce((sum, r) => sum + (r.closing - r.opening), 0);
              const totalExpected = pumpReadings.reduce((sum, r) => {
                const pump = pumps.find(p => String(p.id) === String(r.pumpId));
                return sum + ((r.closing - r.opening) * (pump ? Number(pump.price) : 0));
              }, 0);
              // Calculate total collected
              const ownUseTotal = ownUseEntries.reduce((sum, entry) => sum + getOwnUseAmount(entry), 0);
              const collected = Number(cash)
                + prepayments.reduce((sum, p) => sum + Number(p.amount), 0)
                + credits.reduce((sum, c) => sum + Number(c.amount), 0)
                + myFuelCards.reduce((sum, c) => sum + Number(c.amount), 0)
                + fdhCards.reduce((sum, c) => sum + Number(c.amount), 0)
                + nationalBankCards.reduce((sum, c) => sum + Number(c.amount), 0)
                + moPayments.reduce((sum, m) => sum + Number(m.amount), 0)
                + ownUseTotal;
              // Calculate average price per litre
              // Calculate balance
              let balanceLabel = 'Balanced';
              let balanceClass = 'text-gray-800';
              if (collected < totalExpected) {
                balanceLabel = `Shortage: ${(totalExpected - collected).toLocaleString()} MWK`;
                balanceClass = 'text-red-600';
              } else if (collected > totalExpected) {
                balanceLabel = `Overage: ${(collected - totalExpected).toLocaleString()} MWK`;
                balanceClass = 'text-green-600';
              }
              return (
                <>
                  <p>Total Volume Sold: <strong>{!isNaN(totalVolume) ? totalVolume.toLocaleString() : 0} litres</strong></p>
                  <p>Total Expected Return: <strong>{!isNaN(totalExpected) ? totalExpected.toLocaleString() : 0} MWK</strong></p>
                  <p>Total Collected: <strong>{!isNaN(collected) ? collected.toLocaleString() : 0} MWK</strong></p>
                  <p>
                    {collected < totalExpected && (
                      <>
                        Balance: <strong className={cn('ml-2', balanceClass)}>{balanceLabel}</strong>
                      </>
                    )}
                    {collected > totalExpected && (
                      <>
                        Balance: <strong className={cn('ml-2', balanceClass)}>{balanceLabel}</strong>
                      </>
                    )}
                    {collected === totalExpected && (
                      <>
                        Balance: <strong className={cn('ml-2', balanceClass)}>{balanceLabel}</strong>
                      </>
                    )}
                  </p>
                </>
              );
            })()}
            <Button className="mt-4" onClick={() => submitShift.mutate()} disabled={submitShift.isPending}>
              {submitShift.isPending ? 'Submitting...' : 'Submit Shift'}
            </Button>
          </div>
        </div>
      )}

      {showSubmissions && (
<div id="submissions-section" className="mt-8">
  <h2 className="text-lg font-bold mb-2 flex items-center gap-2">
    <span>My Submissions</span>
    {fixNotifications.length > 0 && !viewedNotifications && (
      <span className="bg-red-600 text-white rounded-full text-xs px-2 py-0.5">
        {fixNotifications.length} Fix Request{fixNotifications.length > 1 ? 's' : ''}
      </span>
    )}
  </h2>
  {Object.entries(
    submissions.reduce<{ [date: string]: any[] }>((acc, s) => {
      (acc[s.shift_date] = acc[s.shift_date] || []).push(s);
      return acc;
    }, {})
  ).map(([date, records]) => (
    <div key={date} className="mb-4 border rounded-lg bg-white/60">
      <button
        className="w-full text-left px-4 py-2 font-semibold flex items-center justify-between"
        onClick={() => setExpandedDates((prev) => ({ ...prev, [date]: !prev[date] }))}
      >
        <span>{date}</span>
        <span>{expandedDates[date] ? '▲' : '▼'}</span>
      </button>
      {expandedDates[date] && (
        <div className="px-4 pb-2">
          {(records as any[]).map((s: any) => {
            const pumpName = pumps.find(p => String(p.id) === String(s.pump_id))?.name || s.pump_id;
            return (
              <div
                key={s.id}
                className="flex items-center justify-between border-b py-2"
              >
                <div>
                  <div className="font-medium">
                    Pump: {pumpName} | Shift: {s.shift_type}
                  </div>
                  <div className="text-xs text-gray-600">
                    Volume: {(s.closing_reading - s.opening_reading).toLocaleString()}L
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* Approval/Fix Status */}
                  {s.is_approved ? (
                    <span className="bg-green-500 text-white px-2 py-0.5 rounded-full text-xs">Authorised</span>
                  ) : s.fix_reason && !s.is_approved ? (
                    <>
                      <span className="bg-yellow-500 text-white px-2 py-0.5 rounded-full text-xs">Fix Requested</span>
                      <Button
                        className="ml-2 bg-orange-600 text-white px-3 py-0.5 rounded-full text-xs font-semibold"
                        onClick={async () => {
                          setShowSubmissions(false); // Hide submissions section
                          setSelectedPumpId(String(s.pump_id));
                          setShift(s.shift_type);
                          setReading({ opening: s.opening_reading, closing: s.closing_reading });
                          // Mark as fixed in DB by clearing fix_reason and is_fixed, set to pending
                          await supabase.from('shifts').update({ is_approved: false, fix_reason: null }).eq('id', s.id);
                          // Refetch submissions
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
                        Fix
                      </Button>
                    </>
                  ) : (
                    <span className="bg-gray-400 text-white px-2 py-0.5 rounded-full text-xs">Pending</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  ))}
  {submissions.length === 0 && (
    <div className="text-gray-500 text-sm">No submissions yet.</div>
  )}
</div>
)}



      
      
      

     </div>
    
  );
};

export default AttendantDashboard;


