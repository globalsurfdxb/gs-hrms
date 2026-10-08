'use client';

import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { useOrg } from '@/context/OrgContext';
import { LocationDef } from '@/lib/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, EmptyState, Button } from '@/components/ui/Card';
import { StatStrip } from '@/components/ui/StatStrip';
import { Drawer } from '@/components/ui/Drawer';
import { BuildingIcon, EditIcon, MapPinIcon, PeopleIcon, PlusIcon, ReceiptIcon, SearchIcon, ShieldIcon, XIcon } from '@/components/icons';

const CURRENCIES = ['AED', 'INR', 'USD', 'SAR', 'QAR', 'OMR', 'KWD', 'BHD', 'GBP', 'EUR'];

const TEMPLATE_LABEL: Record<LocationDef['template'], string> = {
  uae: 'UAE-style — visa, Emirates ID, WPS payroll',
  india: 'India-style — Aadhaar, PAN, PF payroll',
};

const blankLoc = (): LocationDef => ({
  id: '',
  name: '',
  city: '',
  currency: 'AED',
  phoneCode: '',
  phoneDigits: 9,
  workingHours: '09:00 – 18:00, Mon–Fri',
  seating: [],
  template: 'uae',
  system: false,
});

function Fg({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="fg">
      <label>
        {label} {required && <span className="req">*</span>}
      </label>
      {children}
    </div>
  );
}

export default function AdminSettingsPage() {
  const { location: currentLocation } = useApp();
  const { locations, locationUsage, addLocation, updateLocation, removeLocation } = useOrg();

  const [locOpen, setLocOpen] = useState(false);
  const [locMode, setLocMode] = useState<'add' | 'edit'>('add');
  const [locDraft, setLocDraft] = useState<LocationDef>(blankLoc());
  const [locError, setLocError] = useState('');
  const [locNotice, setLocNotice] = useState('');
  const [seatInput, setSeatInput] = useState('');
  const [locQ, setLocQ] = useState('');
  const [locTpl, setLocTpl] = useState<'all' | LocationDef['template']>('all');

  const locNeedle = locQ.trim().toLowerCase();
  const shownLocs = locations.filter(
    (l) => (locTpl === 'all' || l.template === locTpl) && (!locNeedle || `${l.name} ${l.city} ${l.currency} ${l.phoneCode}`.toLowerCase().includes(locNeedle))
  );

  const openAddLoc = () => {
    setLocDraft(blankLoc());
    setSeatInput('');
    setLocMode('add');
    setLocError('');
    setLocOpen(true);
  };

  const openEditLoc = (l: LocationDef) => {
    setLocDraft({ ...l, seating: [...l.seating] });
    setSeatInput('');
    setLocMode('edit');
    setLocError('');
    setLocOpen(true);
  };

  const hasSeat = (list: string[], v: string) => list.some((x) => x.toLowerCase() === v.toLowerCase());

  const addSeat = () => {
    const v = seatInput.trim();
    if (!v) return;
    if (hasSeat(locDraft.seating, v)) {
      setLocError(`"${v}" is already in the seating list.`);
      return;
    }
    setLocDraft({ ...locDraft, seating: [...locDraft.seating, v] });
    setSeatInput('');
    setLocError('');
  };

  const saveLoc = () => {
    const name = locDraft.name.trim();
    if (!name) {
      setLocError('Location name is required.');
      return;
    }
    if (locations.some((l) => l.id !== locDraft.id && l.name.toLowerCase() === name.toLowerCase())) {
      setLocError(`A location called "${name}" already exists.`);
      return;
    }
    const code = locDraft.phoneCode.trim().replace(/\s+/g, '');
    if (!/^\+\d{1,4}$/.test(code)) {
      setLocError('Enter the phone country code, e.g. +966.');
      return;
    }
    if (!Number.isInteger(locDraft.phoneDigits) || locDraft.phoneDigits < 6 || locDraft.phoneDigits > 15) {
      setLocError('Phone number length must be between 6 and 15 digits.');
      return;
    }
    const pending = seatInput.trim();
    const seating = pending && !hasSeat(locDraft.seating, pending) ? [...locDraft.seating, pending] : locDraft.seating;
    const record: LocationDef = { ...locDraft, name, city: locDraft.city.trim(), phoneCode: code, workingHours: locDraft.workingHours.trim(), seating };
    if (locMode === 'add') addLocation(record);
    else updateLocation(record);
    setLocNotice('');
    setLocOpen(false);
  };

  const deleteLoc = (l: LocationDef) => {
    const u = locationUsage(l.id);
    const used = [u.companies && `${u.companies} company(ies)`, u.departments && `${u.departments} department(s)`, u.employees && `${u.employees} employee(s)`].filter(Boolean);
    if (used.length) {
      setLocNotice(`Can't delete ${l.name}: it is used by ${used.join(', ')}. Move them to another location first.`);
      return;
    }
    if (currentLocation === l.id) {
      setLocNotice(`Can't delete ${l.name} while it is the selected location in the top bar. Switch the top-bar location first.`);
      return;
    }
    setLocNotice('');
    removeLocation(l.id);
  };

  return (
    <div>
      <PageHeader
        eyebrow="Administration"
        title="System Settings"
        description="Locations your organization operates in — currency, phone format, working hours and seating."
        actions={
          <Button variant="primary" onClick={openAddLoc}>
            <PlusIcon /> Add location
          </Button>
        }
      />

      <div className="ad-strip">
        <StatStrip
          items={[
            { label: 'Locations', value: locations.length, icon: <MapPinIcon />, tone: 'blue', hint: `${locations.filter((l) => l.system).length} built-in` },
            { label: 'Currencies', value: new Set(locations.map((l) => l.currency)).size, icon: <ReceiptIcon />, tone: 'green' },
            { label: 'Seating locations', value: locations.reduce((n, l) => n + l.seating.length, 0), icon: <BuildingIcon />, tone: 'purple' },
            { label: 'Employees covered', value: locations.reduce((n, l) => n + locationUsage(l.id).employees, 0), icon: <PeopleIcon />, tone: 'amber' },
          ]}
        />
      </div>

      <Card>
        <CardHeader title="Locations" sub="Offices and countries you operate in" />
        <div className="tbar">
          <div className="tsearch">
            <SearchIcon />
            <input value={locQ} onChange={(e) => setLocQ(e.target.value)} placeholder="Find a location, city or currency…" />
          </div>
          <div className="subseg" style={{ margin: 0 }} role="group" aria-label="Form rules">
            <button className={locTpl === 'all' ? 'on' : ''} onClick={() => setLocTpl('all')}>
              All
            </button>
            <button className={locTpl === 'uae' ? 'on' : ''} onClick={() => setLocTpl('uae')}>
              UAE-style
            </button>
            <button className={locTpl === 'india' ? 'on' : ''} onClick={() => setLocTpl('india')}>
              India-style
            </button>
          </div>
          <span className="ad-tb-ct">
            {shownLocs.length} of {locations.length} locations
          </span>
        </div>
        {locNotice && (
          <div className="note-box warn" style={{ margin: '12px 16px 0' }}>
            <ShieldIcon />
            <div>{locNotice}</div>
          </div>
        )}
        {shownLocs.length === 0 ? (
          <EmptyState
            icon={<MapPinIcon />}
            title={locations.length === 0 ? 'No locations yet' : 'No locations match'}
            description={locations.length === 0 ? 'Add the first office or country your organization operates in.' : 'Try a different search or switch the form rules filter back to All.'}
          />
        ) : (
          <div className="ad-locs">
            {shownLocs.map((l) => {
              const u = locationUsage(l.id);
              return (
                <div key={l.id} className="ad-loc">
                  <div className="ad-loc-h">
                    <span className="ad-ic" style={{ background: l.template === 'uae' ? '#e7f0fc' : '#e7f6ee', color: l.template === 'uae' ? '#2f6fd6' : '#1f9d63' }}>
                      <MapPinIcon />
                    </span>
                    <div className="tx">
                      <div className="nm">
                        {l.name}
                        {l.system && <span className="ad-pill">Built-in</span>}
                        {currentLocation === l.id && <span className="ad-pill blue">Selected</span>}
                      </div>
                      <div className="ct">{l.city || 'No city set'}</div>
                    </div>
                  </div>
                  <div className="ad-loc-b">
                    <div>
                      <div className="k">Currency</div>
                      <div className="v">{l.currency}</div>
                    </div>
                    <div>
                      <div className="k">Phone</div>
                      <div className="v">
                        {l.phoneCode} · {l.phoneDigits} digits
                      </div>
                    </div>
                    <div className="full">
                      <div className="k">Working hours</div>
                      <div className="v">{l.workingHours || 'Not set'}</div>
                    </div>
                    <div className="full">
                      <div className="k">Employee form rules</div>
                      <div className="v">{TEMPLATE_LABEL[l.template]}</div>
                    </div>
                    <div className="full">
                      <div className="k">Seating locations ({l.seating.length})</div>
                      {l.seating.length === 0 ? (
                        <div className="v" style={{ color: 'var(--faint)', fontWeight: 400 }}>
                          None added yet
                        </div>
                      ) : (
                        <div className="ad-seats">
                          {l.seating.map((s) => (
                            <span key={s} className="ad-pill">
                              {s}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="ad-loc-f">
                    <span>
                      {u.employees} employee{u.employees === 1 ? '' : 's'} · {u.departments} dept{u.departments === 1 ? '' : 's'} · {u.companies} compan{u.companies === 1 ? 'y' : 'ies'}
                    </span>
                    <div className="rt">
                      <button className="icon-act" onClick={() => openEditLoc(l)} title="Edit">
                        <EditIcon />
                      </button>
                      {l.system ? (
                        <span className="icon-act" title="Built-in locations can't be deleted" style={{ cursor: 'default', color: 'var(--faint)' }}>
                          <ShieldIcon />
                        </span>
                      ) : (
                        <button className="icon-act" onClick={() => deleteLoc(l)} title="Delete">
                          <XIcon />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Drawer
        open={locOpen}
        onClose={() => setLocOpen(false)}
        title={locMode === 'add' ? 'Add location' : 'Edit location'}
        description={locMode === 'add' ? 'It will appear in onboarding, departments, companies and the top-bar selector.' : `Editing ${locDraft.name || 'location'}.`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setLocOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={saveLoc}>
              {locMode === 'add' ? 'Add location' : 'Save changes'}
            </Button>
          </>
        }
      >
        <div className="form-grid">
          <div className="fg full">
            <Fg label="Location name" required>
              <input
                value={locDraft.name}
                onChange={(e) => {
                  setLocDraft({ ...locDraft, name: e.target.value });
                  if (locError) setLocError('');
                }}
                placeholder="e.g. Saudi Arabia"
                style={locError && !locDraft.name.trim() ? { borderColor: 'var(--danger)' } : undefined}
              />
            </Fg>
          </div>
          <Fg label="City / office">
            <input value={locDraft.city} onChange={(e) => setLocDraft({ ...locDraft, city: e.target.value })} placeholder="e.g. Riyadh" />
          </Fg>
          <Fg label="Default currency">
            <select value={locDraft.currency} onChange={(e) => setLocDraft({ ...locDraft, currency: e.target.value })}>
              {CURRENCIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Fg>
          <Fg label="Phone country code" required>
            <input
              value={locDraft.phoneCode}
              onChange={(e) => {
                setLocDraft({ ...locDraft, phoneCode: e.target.value });
                if (locError) setLocError('');
              }}
              placeholder="e.g. +966"
            />
          </Fg>
          <Fg label="Phone number length">
            <input type="number" min={6} max={15} value={locDraft.phoneDigits} onChange={(e) => setLocDraft({ ...locDraft, phoneDigits: Number(e.target.value) })} />
          </Fg>
          <div className="fg full">
            <Fg label="Working hours">
              <input value={locDraft.workingHours} onChange={(e) => setLocDraft({ ...locDraft, workingHours: e.target.value })} placeholder="e.g. 09:00 – 18:00, Mon–Fri" />
            </Fg>
          </div>
          <div className="fg full">
            <Fg label="Seating locations">
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  style={{ flex: 1, minWidth: 0 }}
                  value={seatInput}
                  onChange={(e) => {
                    setSeatInput(e.target.value);
                    if (locError) setLocError('');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addSeat();
                    }
                  }}
                  placeholder="e.g. 901, SIT Tower, Dubai"
                />
                <Button onClick={addSeat}>
                  <PlusIcon /> Add
                </Button>
              </div>
              {locDraft.seating.length === 0 ? (
                <span className="hint">No seating locations yet. Employees at this location cannot be given a seat until you add one.</span>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                  {locDraft.seating.map((seat) => (
                    <div key={seat} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: '7px 10px', fontSize: 13 }}>
                      <span>{seat}</span>
                      <button
                        type="button"
                        className="icon-act"
                        title="Remove"
                        onClick={() => setLocDraft({ ...locDraft, seating: locDraft.seating.filter((x) => x !== seat) })}
                      >
                        <XIcon />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </Fg>
          </div>
          <div className="fg full">
            <Fg label="Employee form rules">
              <select value={locDraft.template} disabled={locDraft.system} onChange={(e) => setLocDraft({ ...locDraft, template: e.target.value as LocationDef['template'] })}>
                <option value="uae">{TEMPLATE_LABEL.uae}</option>
                <option value="india">{TEMPLATE_LABEL.india}</option>
              </select>
              <span className="hint">Decides which identity, bank and salary fields onboarding collects for employees at this location.</span>
            </Fg>
          </div>
        </div>
        {locError && <div style={{ marginTop: 10, fontSize: 12, color: 'var(--danger)' }}>{locError}</div>}
      </Drawer>
    </div>
  );
}
