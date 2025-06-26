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
  const [user, setUser] = useAtom(userAtom);
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(true);

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

  const selectedPump = pumps.find(p => String(p.id) === selectedPumpId);
  const [submitted, setSubmitted] = useState(false);

  // Own Use Entries State
type OwnUseEntry =
  | { type: 'vehicle'; registration: string; volume: string; amount: string }
  | { type: 'genset'; hours: string; volume: string; amount: string }
  | { type: 'lawnmower'; gardener: string; volume: string; amount: string };

const [ownUseEntries, setOwnUseEntries] = useState<OwnUseEntry[]>([
  { type: 'vehicle', registration: '', volume: '', amount: '' },
]);

function updateOwnUseEntry(idx: number, field: string, value: any) {
  const newEntries = [...ownUseEntries];
  newEntries[idx] = { ...newEntries[idx], [field]: value };
  setOwnUseEntries(newEntries);
}

function addOwnUseEntry(type: 'vehicle' | 'genset' | 'lawnmower') {
  if (type === 'vehicle') setOwnUseEntries([...ownUseEntries, { type: 'vehicle', registration: '', volume: '', amount: '' }]);
  if (type === 'genset') setOwnUseEntries([...ownUseEntries, { type: 'genset', hours: '', volume: '', amount: '' }]);
  if (type === 'lawnmower') setOwnUseEntries([...ownUseEntries, { type: 'lawnmower', gardener: '', volume: '', amount: '' }]);
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
const [submittedPumps, setSubmittedPumps] = useState<string[]>([]);

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

  const submitShift = useMutation({
    mutationFn: async () => {
      if (!selectedPump) throw new Error('No pump selected');
      if (!user) throw new Error('User not logged in');
      if (submittedPumps.includes(String(selectedPump.id))) {
        throw new Error('You have already submitted for this pump today.');
      }
      if (isNaN(reading.opening) || isNaN(reading.closing)) {
        throw new Error('Invalid meter readings');
      }
      if (reading.closing < reading.opening) {
        throw new Error('Closing reading must be greater than opening reading');
      }

      const payload = {
        pump_id: selectedPump.id,
        attendant_id: user.id,
        shift_type: shift,
        shift_date: new Date().toISOString().slice(0, 10),
        opening_reading: reading.opening,
        closing_reading: reading.closing,
        fuel_price: selectedPump.price, 
       
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

      console.log("Submitting payload:", payload);  
      const { data: shiftInsertResult, error } = await supabase.from('shifts').insert([payload]).select('id');
      if (error) {
        console.error("Supabase insert error:", error);
        throw error;
      }

      // Submit each own use entry individually to the 'own_use' table, linked to the shift
      if (shiftInsertResult && shiftInsertResult.length > 0) {
        const shiftId = shiftInsertResult[0].id;
        for (const entry of ownUseEntries) {
          const ownUsePayload = {
            shift_id: shiftId,
            type: entry.type,
            ...(entry.type === 'vehicle' ? {
              registration: entry.registration,
              volume: entry.volume,
              amount: entry.amount
            } : {}),
            ...(entry.type === 'genset' ? {
              hours: entry.hours,
              volume: entry.volume,
              amount: entry.amount
            } : {}),
            ...(entry.type === 'lawnmower' ? {
              gardener: entry.gardener,
              volume: entry.volume,
              amount: entry.amount
            } : {})
          };
          const { error: ownUseError } = await supabase.from('own_use').insert([ownUsePayload]);
          if (ownUseError) {
            console.error('Own use insert error:', ownUseError);
            // Optionally, you can throw or continue
          }
        }
      }

      return true;
    },
    onSuccess: () => {
      alert('Shift submitted successfully!'); // ✅ Feedback to user
      setSubmitted(true);
      setSelectedPumpId("");
      setReading({ opening: 0, closing: 0 });
      setCash('');
      setPrepayments([{ name: '', amount: '' }]);
      setCredits([{ name: '', amount: '' }]);
      setMyFuelCards([{ name: '', amount: '' }]);
      setFdhCards([{ name: '', amount: '' }]);
      setNationalBankCards([{ name: '', amount: '' }]);
      setMoPayments([{ name: '', amount: '' }]);
      setOwnUseEntries([{ type: 'vehicle', registration: '', volume: '', amount: '' }]);
      localStorage.removeItem('shiftDraft'); // Clear draft on successful submit
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

  return (

    <div className=" relative min-h-screen w-full p-4 space-y-4 ">

    
      <div className="flex flex-wrap items-center justify-between gap-2 px-2">
      <h2 className="text-base font-semibold text-white">
        Welcome, {user?.username || 'Guest'}!
      </h2>
      <Button
        onClick={handleLogout}
        className=" justify-end bg-red-600 text-white hover:bg-red-700 rounded-md text-sm px-3 py-1"
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

  <div className="flex items-center space-x-4 ml-4"> {/* Group for pump selector with left margin */}
    <label className="font-semibold whitespace-nowrap" style={{ color: '#222' }}>
      Select Pump:
    </label>
    
    {loadingPumps ? (
      <p className="whitespace-nowrap">Loading pumps...</p>
    ) : pumpError ? (
      <p className="text-red-600 whitespace-nowrap">{pumpError}</p>
    ) : (
      <Select value={selectedPumpId}
       onValueChange={(value) => {
        setSelectedPumpId(value);
       }}>
        <SelectTrigger className="w-64 bg-white/50" style={{ borderRadius: 8, border: '1px solid #e5e5ea', color: "black" }}>
          {selectedPumpId
            ? pumps.find(p => String(p.id) === selectedPumpId)?.name
            : 'Choose a pump'}
        </SelectTrigger>
        <SelectContent>
          {pumps.map(p => (
            <SelectItem key={String(p.id)} value={String(p.id)} disabled={submittedPumps.includes(String(p.id))}>
              {p.name} {submittedPumps.includes(String(p.id)) && '(Already submitted)'}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )}
  </div>
</div>
     

    {selectedPump && (
        <div className="space-y-4 ">
          <div className="flex gap-2 mb-2">
            <Button
              variant="outline"
              className="bg-white/50"
              onClick={() => {
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
          <Card className="bg-white/50 shadow-md" style={{ borderRadius: 12, border: '1px solid #e5e5ea' }}>
            <CardContent className="space-y-2 p-4">
              <h3 className="font-semibold">{selectedPump.name}{selectedPump.type ? ` (${selectedPump.type})` : ''}</h3>
              <Input
                type="number"
                placeholder="Opening Meter"
                value={reading.opening}
                onChange={e => setReading(r => ({ ...r, opening: parseFloat(e.target.value)}))}
              />
              <Input
                type="number"
                placeholder="Closing Meter"
                value={reading.closing}
                onChange={e => setReading(r => ({ ...r, closing: parseFloat(e.target.value)}))}
              />
              <p>
                <strong>Volume Sold: {(!isNaN(reading.closing - reading.opening) ? (reading.closing - reading.opening).toLocaleString() : 0)} litres</strong>
              </p>
              <p>
                Expected: <strong>{((Number(reading.closing) - Number(reading.opening)) * Number(selectedPump.price)).toLocaleString()} MWK</strong>
              </p>
            </CardContent>
          </Card>

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
                <div key={idx} className="flex gap-2">
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
                <div key={idx} className="flex gap-2">
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
                <div key={idx} className="flex gap-2">
                  <Input
                    className="text-black bg-white/50"
                    placeholder="Customer Name"
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
                </div>
              ))}
              <Button onClick={() => addEntry(myFuelCards, setMyFuelCards)}>+ Add My Fuel Card Payment</Button>

              <h4 className="font-semibold text-sm mt-4">FDH Bank Card Payments</h4>
              {fdhCards.map((c, idx) => (
                <div key={idx} className="flex gap-2">
                  <Input
                    className="text-black bg-white/50"
                    placeholder="Customer Name"
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
                </div>
              ))}
              <Button onClick={() => addEntry(fdhCards, setFdhCards)}>+ Add FDH Card Payment</Button>

              <h4 className="font-semibold text-sm mt-4">National Bank Card Payments</h4>
              {nationalBankCards.map((c, idx) => (
                <div key={idx} className="flex gap-2">
                  <Input
                    className="text-black bg-white/50"
                    placeholder="Customer Name"
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
                </div>
              ))}
              <Button onClick={() => addEntry(nationalBankCards, setNationalBankCards)}>+ Add National Bank Card Payment</Button>

             <h4 className="font-semibold text-sm mt-4">MO - Payments </h4>
              {moPayments.map((m, idx) => (
                <div key={idx} className="flex gap-2">
                  <Input
                    className="text-black bg-white/50"
                    placeholder="Customer Name"
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
            <Input
             className="text-black bg-white/50"
              placeholder="Amount (MWK)"
              type="number"
              value={entry.amount}
              onChange={e => updateOwnUseEntry(idx, 'amount', e.target.value)}
            />
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
            <Input
             className="text-black bg-white/50"
              placeholder="Amount (MWK)"
              type="number"
              value={entry.amount}
              onChange={e => updateOwnUseEntry(idx, 'amount', e.target.value)}
            />
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
            <Input
             className="text-black bg-white/50"
              placeholder="Amount (MWK)"
              type="number"
              value={entry.amount}
              onChange={e => updateOwnUseEntry(idx, 'amount', e.target.value)}
            />
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
              // Calculate expected amount from readings and pump price
              const expected = selectedPump ? (Number(reading.closing) - Number(reading.opening)) * Number(selectedPump.price) : 0;
              // Calculate total collected
              const ownUseTotal = ownUseEntries.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
              const collected = Number(cash)
                + prepayments.reduce((sum, p) => sum + Number(p.amount), 0)
                + credits.reduce((sum, c) => sum + Number(c.amount), 0)
                + myFuelCards.reduce((sum, c) => sum + Number(c.amount), 0)
                + fdhCards.reduce((sum, c) => sum + Number(c.amount), 0)
                + nationalBankCards.reduce((sum, c) => sum + Number(c.amount), 0)
                + moPayments.reduce((sum, m) => sum + Number(m.amount), 0)
                + ownUseTotal;
              // Calculate volume
              const volume = Number(reading.closing) - Number(reading.opening);
              // Calculate balance
              let balanceLabel = 'Balanced';
              let balanceClass = 'text-gray-800';
              if (collected < expected) {
                balanceLabel = `Shortage: ${(expected - collected).toLocaleString()}`;
                balanceClass = 'text-red-600';
              } else if (collected > expected) {
                balanceLabel = `Overage: ${(collected - expected).toLocaleString()}`;
                balanceClass = 'text-green-600';
              }
              return (
                <>
                  <p>Volume Sold: <strong>{!isNaN(volume) ? volume.toLocaleString() : 0} litres</strong></p>
                  <p>Expected Return: <strong>{!isNaN(expected) ? expected.toLocaleString() : 0} MWK</strong></p>
                  <p>Total Collected: <strong>{!isNaN(collected) ? collected.toLocaleString() : 0} MWK</strong></p>
                  <p>
                    {collected < expected && (
                      <>
                        Balance: <strong className={cn('ml-2', balanceClass)}>{balanceLabel}</strong>
                      </>
                    )}
                    {collected > expected && (
                      <>
                        Balance: <strong className={cn('ml-2', balanceClass)}>{balanceLabel}</strong>
                      </>
                    )}
                    {collected === expected && (
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



      
      
      

     </div>
    
  );
};

export default AttendantDashboard;





