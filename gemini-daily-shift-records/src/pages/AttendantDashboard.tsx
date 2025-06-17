import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { useMutation } from '@tanstack/react-query';
import { useAtom } from 'jotai';
import { userAtom } from '../store/auth';
import { Select, SelectTrigger, SelectContent, SelectItem } from '@/components/ui/select';
import { useLocation } from 'wouter';

const AttendantDashboard = () => {
  const [user, setUser] = useAtom(userAtom);
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(true);

  const [shift, setShift] = useState<'day' | 'night'>('day');
  const [selectedPumpId, setSelectedPumpId] = useState<string>("");
  const [reading, setReading] = useState({ opening: 0, closing: 0 });
  const [cash, setCash] = useState('');
  const [prepayments, setPrepayments] = useState([{ name: '', amount: '' }]);
  const [credits, setCredits] = useState([{ name: '', amount: '' }]);
  const [myFuelCards, setMyFuelCards] = useState([{ name: '', amount: '' }]);
  const [fdhCards, setFdhCards] = useState([{ name: '', amount: '' }]);
  const [nationalBankCards, setNationalBankCards] = useState([{ name: '', amount: '' }]);
  const [submitted, setSubmitted] = useState(false);
  const [pumps, setPumps] = useState<any[]>([]);
  const [loadingPumps, setLoadingPumps] = useState(true);
  const [pumpError, setPumpError] = useState<string | null>(null);

  const selectedPump = pumps.find(p => String(p.id) === selectedPumpId);

  function updateList<T extends { [key: string]: any }>(
    list: T[],
    setList: (val: T[]) => void,
    idx: number,
    field: string,
    value: any
  ) {
    const newList = [...list];
    newList[idx] = { ...newList[idx], [field]: value };
    setList(newList);
  }

  function addEntry<T extends { name: string; amount: string }>(list: T[], setList: (val: T[]) => void) {
    setList([...list, { name: '', amount: '' } as T]);
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
    const fetchPumps = async () => {
      setLoadingPumps(true);
      setPumpError(null);
      const { data, error } = await supabase.from('pumps').select('*');
      if (error) {
        setPumpError('Failed to load pumps');
        setPumps([]);
      } else {
        setPumps(data || []);
      }
      setLoadingPumps(false);
    };
    fetchPumps();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('sessionExpiry');
    setUser(null);
    setLocation('/');
  };

    const submitShift = useMutation({
    mutationFn: async () => {
      if (!selectedPump) throw new Error('No pump selected');
      if (!user) throw new Error('User not logged in');

      const payload = {
        pump_id: selectedPump.id,
        attendant_id: user.id,
        shift_type: shift,
        shift_date: new Date().toISOString().slice(0, 10),
        opening_reading: reading.opening,
        closing_reading: reading.closing,
        fuel_price: selectedPump.price, // ✅ This field is required by the DB
        cash_received: Number(cash) || 0,
        prepayment_received: prepayments.reduce((sum, p) => sum + Number(p.amount || 0), 0),
        credit_received: credits.reduce((sum, c) => sum + Number(c.amount || 0), 0),
        fuel_card_received: myFuelCards.reduce((sum, c) => sum + Number(c.amount || 0), 0),
        fdh_card_received: fdhCards.reduce((sum, c) => sum + Number(c.amount || 0), 0),
        national_bank_card_received: nationalBankCards.reduce((sum, c) => sum + Number(c.amount || 0), 0),
        is_approved: false,
        supervisor_id: null,
        fix_reason: null,
      };

      console.log("Submitting payload:", payload); // ✅ Helpful debug log
      const { error } = await supabase.from('shifts').insert([payload]);
      if (error) {
        console.error("Supabase insert error:", error); // ✅ Helpful debug log
        throw error;
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
    },
    onError: (error: any) => {
      console.error('Submit error:', error);
      alert('Failed to submit shift: ' + (error?.message || JSON.stringify(error)));
    },
  });

  useEffect(() => {
    if (submitted) {
      setTimeout(() => {
        setSubmitted(false);
        setLocation('/attendant');
      }, 2000);
    }
  }, [submitted, setLocation]);

    function handleSaveDraft() {
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
    const draft = JSON.parse(savedDraft);
    setSelectedPumpId(draft.pump_id);
    setReading({ opening: draft.opening_reading, closing: draft.closing_reading });
    setCash(draft.cash);
    setPrepayments(draft.prepayments);
    setCredits(draft.credits);
    setMyFuelCards(draft.myFuelCards);
    setFdhCards(draft.fdhCards);
    setNationalBankCards(draft.nationalBankCards);
    setShift(draft.shift);
  }
}, []);


  return (
    <div className="min-h-screen p-4" style={{
       backgroundImage: 'url("/puma.jpg")', // Replace with your image path
    backgroundSize: 'cover', // Ensures the image covers the entire screen
    backgroundPosition: 'center', // Centers the image
    backgroundRepeat: 'no-repeat',
      
      fontFamily: 'San Francisco, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
      color: '#111',
    }}>
      <div className="flex justify-between items-center mb-4" style={{
        borderBottom: '1px solid #d1d1d6',
        paddingBottom: '0.5rem',
        marginBottom: '1.5rem',
      }}>
        <h2 className="text-2xl font-bold mb-2">
          Welcome, {user ? user.username : 'Guest'}!
        </h2>
        <Button
          onClick={handleLogout}
          className="bg-red-600 hover:bg-red-700 text-white"
          style={{ borderRadius: 8, fontWeight: 600 }}
        >
          Log Out
        </Button>
      </div>
      <div className="flex gap-4 items-center mb-4">
        <label className="font-semibold" style={{ color: '#222' }}>Select Shift:</label>
        <Select value={shift} onValueChange={val => setShift(val as 'day' | 'night')}>
          <SelectTrigger className="w-32 bg-white/50 ">{shift.toUpperCase()} Shift</SelectTrigger>
          <SelectContent>
            <SelectItem value="day">Day</SelectItem>
            <SelectItem value="night">Night</SelectItem>
          </SelectContent>
        </Select>
        <label className="font-semibold ml-8" style={{ color: '#222' }}>
          Select Pump:
        </label>
        {loadingPumps ? (
          <p>Loading pumps...</p>
        ) : pumpError ? (
          <p className="text-red-600">{pumpError}</p>
        ) : (
          <Select value={selectedPumpId} onValueChange={setSelectedPumpId}>
            <SelectTrigger className="w-64 bg-white/50" style={{ borderRadius: 8, border: '1px solid #e5e5ea', color: "black" }}>
              {selectedPumpId
                ? pumps.find(p => String(p.id) === selectedPumpId)?.name
                : 'Choose a pump'}
            </SelectTrigger>
            <SelectContent>
              {pumps.map(p => (
                <SelectItem key={String(p.id)} value={String(p.id)}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      {selectedPump && (
        <div className="space-y-4 ">
          <div className="flex gap-2 mb-2">
            <Button
              variant="outline"
              className="bg-white/50"
              onClick={() => setSelectedPumpId("")}
            >
              ← Back to Pump Selection
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
                onChange={e => setReading(r => ({ ...r, opening: parseFloat(e.target.value) }))}
              />
              <Input
                type="number"
                placeholder="Closing Meter"
                value={reading.closing}
                onChange={e => setReading(r => ({ ...r, closing: parseFloat(e.target.value) }))}
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
                  onChange={e => setCash(e.target.value)}
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
                    onChange={e => updateList(prepayments, setPrepayments, idx, 'amount', e.target.value)}
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
                    onChange={e => updateList(credits, setCredits, idx, 'amount', e.target.value)}
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
                    onChange={e => updateList(myFuelCards, setMyFuelCards, idx, 'amount', e.target.value)}
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
                    onChange={e => updateList(fdhCards, setFdhCards, idx, 'amount', e.target.value)}
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
                    onChange={e => updateList(nationalBankCards, setNationalBankCards, idx, 'amount', e.target.value)}
                  />
                </div>
              ))}
              <Button onClick={() => addEntry(nationalBankCards, setNationalBankCards)}>+ Add National Bank Card Payment</Button>
            </CardContent>
          </Card>
          <div className="p-4 border rounded-lg space-y-2 bg-white/50 shadow">
            <h3 className="font-semibold text-xl">Summary</h3>
            {(() => {
              // Calculate expected amount from readings and pump price
              const expected = selectedPump ? (Number(reading.closing) - Number(reading.opening)) * Number(selectedPump.price) : 0;
              // Calculate total collected
              const collected = Number(cash)
                + prepayments.reduce((sum, p) => sum + Number(p.amount), 0)
                + credits.reduce((sum, c) => sum + Number(c.amount), 0)
                + myFuelCards.reduce((sum, c) => sum + Number(c.amount), 0)
                + fdhCards.reduce((sum, c) => sum + Number(c.amount), 0)
                + nationalBankCards.reduce((sum, c) => sum + Number(c.amount), 0);
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
