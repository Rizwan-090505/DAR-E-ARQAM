// --- STYLING CONSTANTS ---
export const BADGE_STYLES = {
  'Inquiry':        'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-900/50',
  'Test Scheduled': 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-900/50',
  'Test Clear':     'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-900/50',
  'Admission':      'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-900/20 dark:text-violet-300 dark:border-violet-900/50',
};

export const FILTERS = ["All", "Inquiry", "Test Scheduled", "Test Clear", "Admission"];

export const INPUT_STYLES = "w-full bg-gray-50 border border-gray-300 text-gray-900 rounded-lg px-3 py-2 text-sm font-medium placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all shadow-sm";

// --- HELPER: TIMEZONE (GMT+5) ---
export const getPakistanDate = () => {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const pkOffset = 5 * 60 * 60 * 1000; // GMT+5
  return new Date(utc + pkOffset);
};
