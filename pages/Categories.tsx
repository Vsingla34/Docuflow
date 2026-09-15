import React, { useState } from 'react';
import { useAssetStore } from '../store/AssetStore';
import { AssetCategory, AssetVariant, DepreciationMethod } from '../types';
import { ListToolbar, TableCard, THead, Tr, Td } from '../components/ui/Table';
import { Pill } from '../components/ui/Badge';
import { Modal } from '../components/ui/Overlay';
import { Field, Input, Select, TextArea, Checkbox, PrimaryButton, SecondaryButton, LinkButton } from '../components/ui/FormControls';
import { EmptyState } from '../components/ui/EmptyState';
import Icon from '../components/icons/Icon';
import { formatCurrency, uid } from '../lib/format';
import { useToast } from '../components/ui/Toast';

const emptyCategory = (): AssetCategory => ({
  id: '', code: '', name: '', description: '', depreciationMethod: DepreciationMethod.SLM, usefulLifeYears: 5,
  salvageValuePct: 5, capitalizationThreshold: 5000, requiresAmc: false, requiresSerialNumber: true, trackComponents: false, active: true,
});

const emptyVariant = (categoryId: string): AssetVariant => ({
  id: '', categoryId, code: '', name: '', manufacturer: '', modelNumber: '', specifications: [], standardCost: 0, warrantyMonths: 12, uom: 'Nos', active: true,
});

const Categories: React.FC = () => {
  const { state, saveCategory, saveVariant } = useAssetStore();
  const { categories, variants, assets } = state;
  const showToast = useToast();

  const [tab, setTab] = useState<'categories' | 'variants'>('categories');
  const [catModal, setCatModal] = useState<AssetCategory | null>(null);
  const [varModal, setVarModal] = useState<AssetVariant | null>(null);

  const assetCount = (categoryId: string) => assets.filter(a => a.categoryId === categoryId).length;

  return (
    <div>
      <div className="flex gap-1 mb-5 bg-slate-200/60 p-1 rounded-lg w-fit">
        {(['categories', 'variants'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-1.5 text-sm font-semibold rounded-md capitalize transition-colors ${tab === t ? 'bg-white shadow-sm text-primary' : 'text-text-light'}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'categories' ? (
        <>
          <ListToolbar title="Categories" count={categories.length}>
            <PrimaryButton icon={<Icon name="plus" className="w-4 h-4" />} onClick={() => setCatModal(emptyCategory())}>New Category</PrimaryButton>
          </ListToolbar>
          <TableCard>
            <THead columns={['Code', 'Name', 'Parent', 'Depreciation', 'Useful Life', 'Assets', 'Flags', '']} />
            <tbody>
              {categories.map(cat => (
                <Tr key={cat.id}>
                  <Td className="font-mono text-xs">{cat.code}</Td>
                  <Td className="font-medium">{cat.name}</Td>
                  <Td className="text-text-light">{categories.find(c => c.id === cat.parentId)?.name || '—'}</Td>
                  <Td>{cat.depreciationMethod}</Td>
                  <Td>{cat.usefulLifeYears} yrs</Td>
                  <Td>{assetCount(cat.id)}</Td>
                  <Td>
                    <div className="flex gap-1 flex-wrap">
                      {cat.requiresAmc && <Pill label="AMC" tone="green" />}
                      {cat.requiresSerialNumber && <Pill label="Serial" tone="blue" />}
                      {cat.trackComponents && <Pill label="Components" tone="purple" />}
                      {!cat.active && <Pill label="Inactive" tone="gray" />}
                    </div>
                  </Td>
                  <Td><LinkButton onClick={() => setCatModal(cat)}>Edit</LinkButton></Td>
                </Tr>
              ))}
            </tbody>
          </TableCard>
        </>
      ) : (
        <>
          <ListToolbar title="Variants" count={variants.length}>
            <PrimaryButton icon={<Icon name="plus" className="w-4 h-4" />} onClick={() => setVarModal(emptyVariant(categories[0]?.id || ''))}>New Variant</PrimaryButton>
          </ListToolbar>
          {variants.length === 0 ? <EmptyState title="No variants yet" /> : (
            <TableCard>
              <THead columns={['Code', 'Name', 'Category', 'Manufacturer', 'Standard Cost', 'Warranty', '']} />
              <tbody>
                {variants.map(v => (
                  <Tr key={v.id}>
                    <Td className="font-mono text-xs">{v.code}</Td>
                    <Td className="font-medium">{v.name}</Td>
                    <Td>{categories.find(c => c.id === v.categoryId)?.name || '—'}</Td>
                    <Td>{v.manufacturer}</Td>
                    <Td>{formatCurrency(v.standardCost)}</Td>
                    <Td>{v.warrantyMonths} mo</Td>
                    <Td><LinkButton onClick={() => setVarModal(v)}>Edit</LinkButton></Td>
                  </Tr>
                ))}
              </tbody>
            </TableCard>
          )}
        </>
      )}

      {catModal && (
        <CategoryModal
          category={catModal}
          categories={categories}
          onClose={() => setCatModal(null)}
          onSave={cat => { saveCategory(cat); showToast('Category saved.'); setCatModal(null); }}
        />
      )}
      {varModal && (
        <VariantModal
          variant={varModal}
          categories={categories}
          onClose={() => setVarModal(null)}
          onSave={v => { saveVariant(v); showToast('Variant saved.'); setVarModal(null); }}
        />
      )}
    </div>
  );
};

const CategoryModal: React.FC<{ category: AssetCategory; categories: AssetCategory[]; onClose: () => void; onSave: (c: AssetCategory) => void }> = ({ category, categories, onClose, onSave }) => {
  const [form, setForm] = useState(category);
  return (
    <Modal isOpen onClose={onClose} title={category.id ? 'Edit Category' : 'New Category'} wide>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Code" required><Input value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="e.g. ITL" /></Field>
        <Field label="Name" required><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></Field>
        <Field label="Parent Category" className="col-span-2">
          <Select value={form.parentId || ''} onChange={e => setForm({ ...form, parentId: e.target.value || undefined })}>
            <option value="">None (top-level)</option>
            {categories.filter(c => c.id !== form.id).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
        <Field label="Description" className="col-span-2"><TextArea rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></Field>
        <Field label="Depreciation Method">
          <Select value={form.depreciationMethod} onChange={e => setForm({ ...form, depreciationMethod: e.target.value as DepreciationMethod })}>
            {Object.values(DepreciationMethod).map(m => <option key={m} value={m}>{m}</option>)}
          </Select>
        </Field>
        <Field label="Useful Life (years)"><Input type="number" min={1} value={form.usefulLifeYears} onChange={e => setForm({ ...form, usefulLifeYears: Number(e.target.value) })} /></Field>
        <Field label="Salvage Value (%)"><Input type="number" min={0} max={100} value={form.salvageValuePct} onChange={e => setForm({ ...form, salvageValuePct: Number(e.target.value) })} /></Field>
        <Field label="Capitalisation Threshold (₹)"><Input type="number" min={0} value={form.capitalizationThreshold} onChange={e => setForm({ ...form, capitalizationThreshold: Number(e.target.value) })} /></Field>
        <div className="col-span-2 flex flex-wrap gap-4 pt-1">
          <Checkbox label="Requires AMC tracking" checked={form.requiresAmc} onChange={v => setForm({ ...form, requiresAmc: v })} />
          <Checkbox label="Requires serial number" checked={form.requiresSerialNumber} onChange={v => setForm({ ...form, requiresSerialNumber: v })} />
          <Checkbox label="Tracks components" checked={form.trackComponents} onChange={v => setForm({ ...form, trackComponents: v })} />
          <Checkbox label="Active" checked={form.active} onChange={v => setForm({ ...form, active: v })} />
        </div>
      </div>
      <div className="flex justify-end gap-3 pt-5">
        <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
        <PrimaryButton disabled={!form.code || !form.name} onClick={() => onSave({ ...form, id: form.id || uid('cat') })}>Save Category</PrimaryButton>
      </div>
    </Modal>
  );
};

const VariantModal: React.FC<{ variant: AssetVariant; categories: AssetCategory[]; onClose: () => void; onSave: (v: AssetVariant) => void }> = ({ variant, categories, onClose, onSave }) => {
  const [form, setForm] = useState(variant);
  return (
    <Modal isOpen onClose={onClose} title={variant.id ? 'Edit Variant' : 'New Variant'} wide>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Category" required className="col-span-2">
          <Select value={form.categoryId} onChange={e => setForm({ ...form, categoryId: e.target.value })}>
            {categories.filter(c => !categories.some(x => x.parentId === c.id)).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
        <Field label="Code" required><Input value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} /></Field>
        <Field label="Name" required><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></Field>
        <Field label="Manufacturer"><Input value={form.manufacturer} onChange={e => setForm({ ...form, manufacturer: e.target.value })} /></Field>
        <Field label="Model Number"><Input value={form.modelNumber} onChange={e => setForm({ ...form, modelNumber: e.target.value })} /></Field>
        <Field label="Standard Cost (₹)"><Input type="number" min={0} value={form.standardCost} onChange={e => setForm({ ...form, standardCost: Number(e.target.value) })} /></Field>
        <Field label="Warranty (months)"><Input type="number" min={0} value={form.warrantyMonths} onChange={e => setForm({ ...form, warrantyMonths: Number(e.target.value) })} /></Field>
      </div>
      <div className="flex justify-end gap-3 pt-5">
        <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
        <PrimaryButton disabled={!form.code || !form.name || !form.categoryId} onClick={() => onSave({ ...form, id: form.id || uid('var') })}>Save Variant</PrimaryButton>
      </div>
    </Modal>
  );
};

export default Categories;
