/**
 * accounts.js — the 5 cashbook accounts (labels / icons / colours)
 */
export const ACCOUNTS = [
  { id: 'cash',   label: 'নগদ ক্যাশ', icon: '💵', color: '#22c55e' },
  { id: 'bkash',  label: 'bKash',     icon: '📱', color: '#ec4899' },
  { id: 'nagad',  label: 'Nagad',     icon: '📲', color: '#f97316' },
  { id: 'rocket', label: 'Rocket',    icon: '🚀', color: '#a855f7' },
  { id: 'bank',   label: 'ব্যাংক',    icon: '🏦', color: '#3b82f6' },
];

export const accountLabel = id => (ACCOUNTS.find(a => a.id === id) || ACCOUNTS[0]).label;

/** <option> list for a select */
export const accountOptions = (selected = 'cash') =>
  ACCOUNTS.map(a => `<option value="${a.id}" ${a.id === selected ? 'selected' : ''}>${a.icon} ${a.label}</option>`).join('');

/** Bengali names for ledger entry types */
export const ENTRY_LABELS = {
  opening: 'ওপেনিং ব্যালেন্স',
  sale: 'বিক্রি',
  sale_cancel: 'বিল বাতিল',
  collection: 'বাকি আদায়',
  expense: 'খরচ',
  transfer_in: 'ট্রান্সফার (ইন)',
  transfer_out: 'ট্রান্সফার (আউট)',
  adjustment: 'ক্যাশ অ্যাডজাস্টমেন্ট',
};
