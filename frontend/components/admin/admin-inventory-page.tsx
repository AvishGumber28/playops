'use client';

import { useCallback, useEffect, useState, FormEvent } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api, ApiError, EquipmentItem } from '@/lib/api';
import { showToast, ToastStack } from '@/components/ui/toast';
import { Panel } from '@/components/equipment/panel';

// FR-008 (Equipment Booking) - Sports Admin side, Inventory only. Split
// out from the combined Equipment page so Inventory and Bookings
// (Pending/Active/Returned - see admin-bookings-page.tsx) are their own
// nav destinations.
export function AdminInventoryPage() {
  const { token } = useAuth();
  const [items, setItems] = useState<EquipmentItem[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setItems(await api.listEquipment(token));
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Could not load inventory.');
    }
  }, [token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setAddError(null);
    setAdding(true);
    try {
      await api.addEquipmentItem(token, name, Number(quantity));
      showToast(`Added ${name.trim()} to inventory.`, 'success');
      setName('');
      setQuantity('');
      await load();
    } catch (err) {
      setAddError(err instanceof ApiError ? err.message : 'Something went wrong.');
    } finally {
      setAdding(false);
    }
  }

  if (loadError) {
    return <p className="text-sm text-red-400">{loadError}</p>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-white">Inventory</h1>
      <p className="mt-1 text-sm text-white/50">
        Every item the Sports Department stocks, and what&apos;s currently available to book.
      </p>

      <Panel title="Add Item">
        <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-2">
          <div className="min-w-[160px] flex-1">
            <label htmlFor="eq-name" className="text-xs font-medium text-white/70">
              Item name
            </label>
            <input
              id="eq-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="e.g. Volleyball"
              className="mt-1 w-full rounded-md border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-playops-amber"
            />
          </div>
          <div className="w-32">
            <label htmlFor="eq-qty" className="text-xs font-medium text-white/70">
              Starting qty
            </label>
            <input
              id="eq-qty"
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
              placeholder="10"
              className="mt-1 w-full rounded-md border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-playops-amber"
            />
          </div>
          <button
            type="submit"
            disabled={adding || !name || !quantity}
            className="rounded-md bg-playops-amber px-4 py-2 text-sm font-semibold text-playops-charcoal hover:bg-playops-amber/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {adding ? 'Adding…' : 'Add Item'}
          </button>
        </form>
        {addError && <p className="mt-2 text-sm text-red-400">{addError}</p>}
      </Panel>

      <div className="mt-6">
        <Panel title={`Items (${items?.length ?? 0})`}>
          {items === null ? (
            <p className="text-sm text-white/40">Loading…</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-white/40">No equipment added yet — add your first item above.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-[10px] font-bold uppercase tracking-wide text-white/40">
                    <th className="pb-2">Item</th>
                    <th className="pb-2">Total</th>
                    <th className="pb-2">Available</th>
                    <th className="pb-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {items.map((item) => (
                    <InventoryRow key={item.id} item={item} onChanged={load} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>

      <ToastStack />
    </div>
  );
}

function InventoryRow({ item, onChanged }: { item: EquipmentItem; onChanged: () => Promise<void> }) {
  const { token } = useAuth();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.name);
  const [total, setTotal] = useState(String(item.totalQuantity));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function startEdit() {
    setName(item.name);
    setTotal(String(item.totalQuantity));
    setError(null);
    setEditing(true);
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setError(null);
    setSaving(true);
    try {
      await api.updateEquipmentItem(token, item.id, name, Number(total));
      showToast(`Updated ${name.trim()}.`, 'success');
      setEditing(false);
      await onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!token) return;
    if (!window.confirm(`Delete ${item.name} from inventory? This can't be undone.`)) return;
    setError(null);
    setDeleting(true);
    try {
      await api.deleteEquipmentItem(token, item.id);
      showToast(`Deleted ${item.name} from inventory.`, 'success');
      await onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong.');
      setDeleting(false);
    }
  }

  if (editing) {
    return (
      <tr>
        <td colSpan={4} className="py-2">
          <form onSubmit={handleSave} className="flex flex-wrap items-end gap-2">
            <div className="min-w-[140px] flex-1">
              <label className="text-[10px] font-medium text-white/50">Item name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="mt-1 w-full rounded-md border border-white/15 bg-white/5 px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-playops-amber"
              />
            </div>
            <div className="w-28">
              <label className="text-[10px] font-medium text-white/50">Total qty</label>
              <input
                type="number"
                min={1}
                value={total}
                onChange={(e) => setTotal(e.target.value)}
                required
                className="mt-1 w-full rounded-md border border-white/15 bg-white/5 px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-playops-amber"
              />
            </div>
            <button
              type="submit"
              disabled={saving || !name || !total}
              className="rounded-md bg-playops-amber px-3 py-1.5 text-xs font-semibold text-playops-charcoal hover:bg-playops-amber/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-md border border-white/20 px-3 py-1.5 text-xs text-white/70 hover:bg-white/10"
            >
              Cancel
            </button>
          </form>
          {error && <p className="mt-1 text-[11px] text-red-400">{error}</p>}
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td className="py-2 text-white">{item.name}</td>
      <td className="py-2 text-white/60">{item.totalQuantity}</td>
      <td
        className={
          'py-2 font-medium ' + (item.availableQuantity === 0 ? 'text-red-400' : 'text-emerald-400')
        }
      >
        {item.availableQuantity}
      </td>
      <td className="py-2 text-right">
        <button
          type="button"
          onClick={startEdit}
          className="mr-3 text-xs text-playops-amber hover:underline"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className="text-xs text-red-400 hover:underline disabled:opacity-50"
        >
          {deleting ? 'Deleting…' : 'Delete'}
        </button>
        {error && !editing && <p className="mt-1 text-[11px] text-red-400">{error}</p>}
      </td>
    </tr>
  );
}
