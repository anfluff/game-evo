# Модель поведения (utility-based) и гены

Этот документ задаёт self-contained модель принятия решений через полезности (utility). Все параметры из раздела “Гены” должны:

1) быть определены,
2) иметь рекомендуемые стартовые значения,
3) использоваться в формулах (решения и/или эволюция).

---

## 0. Гены (параметры особи)

### Нормализация HP и склонности
1. fear_hp_sensitivity — насколько страх растёт при падении hp
2. hunger_hp_sensitivity — насколько голод растёт при падении hp
3. aggression_hp_sensitivity — насколько агрессия растёт при высоком hp
4. exploration_hp_sensitivity — насколько желание исследовать растёт при высоком hp и стагнации
5. risk_tolerance — склонность рисковать при хорошем hp (0..1)
6. recovery_optimism — ожидание “успею найти еду” (0..1)
7. hp_healthy_norm — опорный уровень hp для нормализации

### Веса мотиваций (масштабируют вклад мотиваций в utility)
8. fear_weight — вес страха
9. hunger_weight — вес голода
10. aggression_weight — вес агрессии
11. reproduction_weight — вес размножения
12. exploration_weight — вес исследования

### Атака / каннибализм
13. cannibalism_factor — привлекательность других существ как еды (0..1)
14. attack_margin — минимальное превосходство по hp для атаки (>= 1.0)
15. retaliation_fear — страх ответного удара (0..1)
16. kill_greed — бонус “дожать атаку” при наличии цели (0..1)
17. territoriality — желание “зачищать” ближайшее окружение (0..1)

### Репродукция
18. min_hp_to_divide — порог hp_norm, после которого размножение вообще рассматривается (0..1)
19. division_risk_aversion — избегание деления (0..1)
20. offspring_investment — доля текущего hp, отдаваемая потомку (0..1)
21. reproduction_urgency — насколько сильно хочется плодиться при сытости (0..1)

### Пространство и память
22. diagonal_awareness — как учитывать диагонали (1.0 = диагональ как обычная, 0.0 = игнорировать/штрафовать)
23. distance_decay — затухание влияния расстояния (kernel(d) = distance_decay^d), (0, 1]
24. crowd_preference — предпочтение плотности (0 = одиночество, 1 = плотность), (0..1)
25. inertia_bias — склонность повторять прошлое действие (0..1)

### Стохастика и эволюция
26. decision_noise — амплитуда аддитивного шума к utility (0..1)
27. impulsiveness — вероятность полностью случайного выбора действия (0..1)
28. mutation_resilience — устойчивость к мутациям (0..1)

---

## 0.1 Константы модели (не гены)
epsilon = 1e-3 — защита от деления на ноль
hp_gain_per_energy_unit = 0.1 — сколько hp даёт 1 единица энергии
max_possible_food = 1.0 — нормализация food в [0, 1]
stagnation_threshold = 12 — сколько ходов без улучшения до saturate стагнации

---

## 0.2 Рекомендуемые стартовые значения генов
fear_hp_sensitivity = 1.2
hunger_hp_sensitivity = 1.0
aggression_hp_sensitivity = 0.35
exploration_hp_sensitivity = 0.3
risk_tolerance = 0.3
recovery_optimism = 0.3
hp_healthy_norm = 1.0

fear_weight = 1.3
hunger_weight = 1.1
aggression_weight = 0.9
reproduction_weight = 0.6
exploration_weight = 0.4

cannibalism_factor = 0.8
attack_margin = 1.2
retaliation_fear = 1.0
kill_greed = 0.5
territoriality = 0.3

min_hp_to_divide = 0.5
division_risk_aversion = 0.3
offspring_investment = 0.5
reproduction_urgency = 0.7

diagonal_awareness = 0.5
distance_decay = 0.7
crowd_preference = 0.2
inertia_bias = 0.8

decision_noise = 0.2
impulsiveness = 0.03
mutation_resilience = 0.4

---

# Каждый ход считаем три слоя:
1. Field scores — оценка клеток (в окне вокруг агента)
2. Motivation levels — страх, голод, агрессия…
3. Action utilities — полезность действий
Далее выбор действия.

---

## 1. Оценка клеток (field scores)

Определения:
hp_norm = clamp(our_hp / hp_healthy_norm, 0, 1)
risk_drive = clamp(hp_norm * risk_tolerance, 0, 1)
kernel(distance) = distance_decay^distance
diag_modifier(a,b) = (is_diagonal(a,b) ? diagonal_awareness : 1)

### 1.1 Энергетическая оценка клетки
food[c] = energy_in_cell[c] * hp_gain_per_energy_unit
food_norm[c] = clamp(food[c] / max_possible_food, 0, 1)

### 1.2 Оценка угроз
enemy_hp_norm = enemy_hp / hp_healthy_norm
our_hp_norm = our_hp / hp_healthy_norm
enemy_advantage_at_s = enemy_hp_norm / max(our_hp_norm, epsilon)

threat_raw[c] = sum_over_sources_s(
  enemy_advantage_at_s * kernel(dist(c,s)) * diag_modifier(c,s)
)
threat_norm[c] = clamp(threat_raw[c], 0, 1)

### 1.3 Оценка съедобности (prey)
Здесь используем отношение “мы сильнее/слабее”, а не “враг сильнее”.

our_advantage_at_s = our_hp_norm / max(enemy_hp_norm, epsilon)
attack_feasibility_at_s = our_advantage_at_s / attack_margin
attack_signal_at_s = clamp(attack_feasibility_at_s - 1, 0, 1)

f_retaliation_at_s = clamp(retaliation_fear * enemy_advantage_at_s * (1 - risk_drive), 0, 1)
prey_source_at_s = attack_signal_at_s * cannibalism_factor * territoriality * (1 - f_retaliation_at_s)

prey_raw[c] = sum_over_sources_s(
  prey_source_at_s * kernel(dist(c,s)) * diag_modifier(c,s)
)
prey_norm[c] = clamp(prey_raw[c], 0, 1)

### 1.4 Оценка удовлетворения “пространственного предпочтения”
local_density_norm ∈ [0,1] — доля занятых соседних клеток в окрестности (например, 8 соседей)

space_pref_score[c] = clamp(
  (1 - local_density_norm) * (1 - crowd_preference) + local_density_norm * crowd_preference,
  0,
  1
)

---

## 2. Оценка мотиваций (все мотивации нормализуем в [0,1])

### 2.1 Голод
expected_food = max_over_window(food_norm)
hunger_raw = (1 - hp_norm) * hunger_hp_sensitivity
hunger = clamp(hunger_raw * (1 - recovery_optimism * expected_food), 0, 1)

### 2.2 Страх
max_threat = max_over_window(threat_norm)
fear_raw = max_threat * (1 - hp_norm) * fear_hp_sensitivity
fear = clamp(fear_raw, 0, 1)
fear_effective = clamp(fear * (1 - risk_drive), 0, 1)

### 2.3 Агрессия
max_prey = max_over_window(prey_norm)
aggression = clamp(max_prey * hp_norm * aggression_hp_sensitivity, 0, 1)

### 2.4 Желание плодиться
effective_division_risk_aversion = clamp(division_risk_aversion * (1 - recovery_optimism), 0, 1)

reproduction = 0
if (hp_norm > min_hp_to_divide) {
  reproduction = clamp(
    ((hp_norm - min_hp_to_divide) / max(1 - min_hp_to_divide, epsilon)) *
    reproduction_urgency *
    (1 - effective_division_risk_aversion),
    0,
    1
  )
}

### 2.5 Любознательность (исследование)
turns_without_improvement ∈ [0, stagnation_threshold] — состояние агента
stagnation_factor = clamp(turns_without_improvement / stagnation_threshold, 0, 1)
exploration = clamp(
  hp_norm * exploration_hp_sensitivity + stagnation_factor * exploration_hp_sensitivity,
  0,
  1
)

---

## 3. Оценка действий (action utility)

Для удобства используем нормализованные компоненты: food_norm, threat_norm, prey_norm, space_pref_score.

Веса:
W_hunger = hunger_weight
W_aggression = aggression_weight
W_exploration = exploration_weight
W_fear = fear_weight

### 3.1 Ожидание (wait) — действие в текущей клетке
wait_utility =
  (1 - threat_norm[current_cell]) * (W_fear * fear_effective) +
  space_pref_score[current_cell] * (W_exploration * exploration) -
  (W_hunger * hunger)

### 3.2 Движение (move) — в каждую кандидатную клетку c
move_utility[c] =
  W_hunger * food_norm[c] * hunger +
  W_aggression * prey_norm[c] * aggression +
  W_exploration * space_pref_score[c] * exploration -
  W_fear * threat_norm[c] * fear_effective

### 3.3 Поедание энергии/минералов (mine/consume) — в текущей клетке
mine_utility =
  W_hunger * food_norm[current_cell] * hunger -
  W_fear * threat_norm[current_cell] * fear_effective

### 3.4 Атака/поедание чужака (eat prey) — в клетку c с целью
Комбинируем hunger и aggression; cannibalism_factor уже учтён в prey_norm.

attack_drive =
  (W_aggression * aggression + W_hunger * hunger) / max(W_aggression + W_hunger, epsilon)

eat_prey_utility[c] =
  prey_norm[c] * attack_drive +
  kill_greed * prey_norm[c] -
  W_fear * threat_norm[c] * fear_effective

### 3.5 Деление (divide) — в текущей клетке
offspring_investment влияет на “цену” деления (чем больше отдать, тем больнее по голоду).

divide_utility =
  reproduction_weight * reproduction -
  W_fear * threat_norm[current_cell] * fear_effective -
  W_hunger * hunger * offspring_investment

Эффект деления (модель):
child_hp = our_hp * offspring_investment
parent_hp = our_hp - child_hp

---

## 4. Выбор действия

1) Собираем utilities для всех доступных действий: wait, move(c), mine, eat_prey(c), divide.
2) Нормализуем utility (по необходимости) в диапазон [-1, 1].

### 4.1 Инерция, шум и импульсивность
prev_action_utility — нормализованная utility действия, выбранного на прошлом ходе (0 если нет).

final_utility =
  (1 - inertia_bias) * utility +
  inertia_bias * prev_action_utility +
  random_uniform(-decision_noise, +decision_noise)

Если random_uniform(0,1) < impulsiveness:
  выбрать действие случайно из допустимых.
Иначе:
  выбрать действие с максимальным final_utility.

---

## 5. Эволюция и мутации (использование mutation_resilience)

Пусть базовая сила мутации base_sigma задана для каждого гена (или одинаковая для всех).
mutation_scale = (1 - mutation_resilience)

Для каждого гена g:
g' = clamp(g + normal(0, base_sigma[g] * mutation_scale), min_g, max_g)

Рекомендуемые диапазоны:
- *_weight > 0
- hp_healthy_norm > 0
- attack_margin >= 1
- distance_decay ∈ (0, 1]
- параметры вероятностей ∈ [0, 1]
