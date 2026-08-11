const EDIT_WINDOW_MS = 48 * 60 * 60 * 1000;

export const getDprTimestamp = (dpr) => {
  const raw = dpr?.createdAt || dpr?.updatedAt;
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const canEditDPR = (dpr, userRole) => {
  if (!dpr) return true;
  if (userRole === 'admin') return true;
  const created = getDprTimestamp(dpr);
  if (!created) return true;
  return Date.now() - created.getTime() < EDIT_WINDOW_MS;
};

export const getEditLockMessage = (dpr) => {
  const created = getDprTimestamp(dpr);
  if (!created) return 'This DPR can no longer be edited (48-hour window expired).';
  const lockAt = new Date(created.getTime() + EDIT_WINDOW_MS);
  return `Edit locked after ${lockAt.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })} (48 hours from creation).`;
};

export const getLastNDays = (n = 5) => {
  const days = [];
  for (let i = 0; i < n; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().split('T')[0]);
  }
  return days;
};

export const formatProcessSummary = (processEntries = []) => {
  if (!processEntries.length) return 'No process logged';
  const preview = processEntries
    .slice(0, 2)
    .map((e) => `${e.work} (${e.quantity} ${e.unit})`)
    .join(', ');
  return processEntries.length > 2 ? `${preview} +${processEntries.length - 2} more` : preview;
};
