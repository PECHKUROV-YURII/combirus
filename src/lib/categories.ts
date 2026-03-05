export const EVENT_CATEGORIES = [
  { value: "sport", label: "Спорт" },
  { value: "music", label: "Музыка" },
  { value: "education", label: "Образование" },
  { value: "games", label: "Игры" },
  { value: "networking", label: "Нетворкинг" },
  { value: "art", label: "Искусство" },
  { value: "outdoor", label: "На природе" },
  { value: "food", label: "Еда и напитки" },
  { value: "tech", label: "Технологии" },
  { value: "other", label: "Другое" },
] as const;

export const EVENT_LEVELS = [
  { value: "any", label: "Не важно" },
  { value: "beginner", label: "Начинающий" },
  { value: "intermediate", label: "Средний" },
  { value: "advanced", label: "Продвинутый" },
] as const;

export function getCategoryLabel(value: string) {
  return EVENT_CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

export function getLevelLabel(value: string) {
  return EVENT_LEVELS.find((l) => l.value === value)?.label ?? value;
}
