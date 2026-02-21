const db = require('./init');

const DEFAULT_ROLES = [
  { id: 'developer', en: 'Developer', uk: 'Розробник' },
  { id: 'pm', en: 'Project Manager', uk: 'Проєкт-менеджер' },
  { id: 'designer', en: 'Designer', uk: 'Дизайнер' },
  { id: 'student', en: 'Student', uk: 'Студент' },
  { id: 'other', en: 'Other', uk: 'Інше' },
];

const DEFAULT_EXPERIENCE = [
  { id: 'beginner', en: 'Beginner', uk: 'Початківець' },
  { id: 'intermediate', en: 'Intermediate', uk: 'Середній' },
  { id: 'advanced', en: 'Advanced', uk: 'Просунутий' },
  { id: 'expert', en: 'Expert', uk: 'Експерт' },
];

const DEFAULT_INTERESTS = [
  { id: 'ai-models', en: 'AI Models', uk: 'ШІ Моделі' },
  { id: 'coding-tools', en: 'Coding Tools', uk: 'Інструменти коду' },
  { id: 'agents', en: 'AI Agents', uk: 'ШІ Агенти' },
  { id: 'prompt-eng', en: 'Prompt Engineering', uk: 'Промпт-інженерія' },
  { id: 'career', en: 'Career', uk: "Кар'єра" },
];

const stmts = {
  get: db.prepare('SELECT value FROM settings WHERE key = ?'),
  set: db.prepare('INSERT INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP'),
};

function getSetting(key) {
  const row = stmts.get.get(key);
  return row ? JSON.parse(row.value) : null;
}

function setSetting(key, value) {
  stmts.set.run(key, JSON.stringify(value));
}

// Seed defaults if not already set
function seedDefaults() {
  if (!getSetting('roles')) setSetting('roles', DEFAULT_ROLES);
  if (!getSetting('experience')) setSetting('experience', DEFAULT_EXPERIENCE);
  if (!getSetting('interests')) setSetting('interests', DEFAULT_INTERESTS);
}

seedDefaults();

// Getter helpers — always read from DB (live)
function getRoles() {
  return getSetting('roles') || DEFAULT_ROLES;
}

function getExperience() {
  return getSetting('experience') || DEFAULT_EXPERIENCE;
}

function getInterests() {
  return getSetting('interests') || DEFAULT_INTERESTS;
}

function setRoles(arr) { setSetting('roles', arr); }
function setExperienceList(arr) { setSetting('experience', arr); }
function setInterests(arr) { setSetting('interests', arr); }

// Add an option to a list
function addOption(settingKey, id, en, uk) {
  const list = getSetting(settingKey) || [];
  if (list.find(item => item.id === id)) return false;
  list.push({ id, en, uk });
  setSetting(settingKey, list);
  return true;
}

// Remove an option from a list
function removeOption(settingKey, id) {
  const list = getSetting(settingKey) || [];
  const idx = list.findIndex(item => item.id === id);
  if (idx === -1) return false;
  list.splice(idx, 1);
  setSetting(settingKey, list);
  return true;
}

module.exports = {
  getSetting, setSetting, seedDefaults,
  getRoles, getExperience, getInterests,
  setRoles, setExperienceList, setInterests,
  addOption, removeOption,
};
