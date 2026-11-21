/**
 * config.js — Application constants & configuration
 */
export const CONFIG = {
  appName: 'POS Pro',
  defaultShopName: 'রহমান ফ্যাশন শোরুম',
  apiBase: '/api',
};

export const COLORS = [
  '#2dd4bf', '#3b82f6', '#f59e0b', '#ec4899', '#a855f7',
  '#22c55e', '#06b6d4', '#f97316', '#8b5cf6', '#eab308',
  '#14b8a6', '#6366f1',
];

export const CATEGORIES = [
  'শার্ট', 'প্যান্ট', 'পাঞ্জাবি', 'শাড়ি', 'থ্রি-পিস',
  'বাচ্চাদের', 'লুঙ্গি', 'কুর্তি', 'জ্যাকেট', 'টাই', 'বেল্ট', 'অন্যান্য',
];

export const EMOJIS = {
  'শার্ট': '👔', 'প্যান্ট': '👖', 'পাঞ্জাবি': '🧥', 'শাড়ি': '🥻',
  'থ্রি-পিস': '👗', 'বাচ্চাদের': '👕', 'লুঙ্গি': '🩳', 'কুর্তি': '👚',
  'জ্যাকেট': '🧥', 'টাই': '👔', 'বেল্ট': '🩹', 'অন্যান্য': '🛍️',
};

export const WEEKDAYS = ['রবিবার','সোমবার','মঙ্গলবার','বুধবার','বৃহস্পতিবার','শুক্রবার','শনিবার'];
export const WEEKDAYS_SHORT = ['রবি','সোম','মঙ্গল','বুধ','বৃহ','শুক্র','শনি'];
export const MONTHS = ['জানুয়ারি','ফেব্রুয়ারি','মার্চ','এপ্রিল','মে','জুন','জুলাই','আগস্ট','সেপ্টেম্বর','অক্টোবর','নভেম্বর','ডিসেম্বর'];

export const NAV_MODULES = [
  { id: 'home',      icon: '🏠', label: 'হোম' },
  { id: 'billing',   icon: '🛒', label: 'বিলিং' },
  { id: 'history',   icon: '🧾', label: 'হিস্ট্রি' },
  { id: 'khata',     icon: '📒', label: 'খাতা' },
  { id: 'products',  icon: '📦', label: 'পণ্য' },
  { id: 'stock',     icon: '📊', label: 'স্টক' },
  { id: 'customers', icon: '👥', label: 'কাস্টমার' },
  { id: 'returns',   icon: '↩️', label: 'রিটার্ন' },
  { id: 'reports',   icon: '📈', label: 'রিপোর্ট' },
  { id: 'expense',   icon: '💸', label: 'খরচ' },
  { id: 'shift',     icon: '⏰', label: 'ক্যাশ' },
  { id: 'files',     icon: '🗂️', label: 'ফাইল' },
];
