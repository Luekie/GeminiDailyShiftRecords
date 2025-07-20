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
              <SelectTrigger className="w-64 bg-white/50" style={{ borderRadius: 8, border: '1px solid #e5e5ea', color: 'black' }}>
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