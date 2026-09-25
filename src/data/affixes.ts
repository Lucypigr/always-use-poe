import type { ModKind, StatKey } from '../stats/stats';

/**
 * Affix (mod) definitions.
 *
 * Mirrors Path of Exile's modifier model:
 *  - each mod is a prefix, suffix, implicit, corrupted implicit or unique mod
 *  - mods belong to a group; an item can only carry one mod per group
 *  - tiers are gated by item level and each tier has its own weight
 *  - spawn tags restrict which item bases can roll the mod
 *  - "local" stats modify the item they're on (weapon damage, armour values…)
 */

export type ModType = 'prefix' | 'suffix' | 'implicit' | 'corrupted' | 'unique';

export interface ModStat {
  stat: StatKey;
  kind: ModKind;
  /** Which rolled value feeds this stat (default 0). Ignored for flags / fixed values. */
  idx?: number;
  /** Multiplier applied to the rolled value (e.g. -1 for "reduced"). */
  mult?: number;
  /** Fixed value instead of a rolled one. */
  value?: number;
}

export interface ModTierDef {
  ilvl: number;
  values: [number, number][];
  weight?: number;
}

export interface MapEffect {
  target: 'monster' | 'player';
  quant: number;
  rarity: number;
  packSize?: number;
}

export interface ModDef {
  id: string;
  type: ModType;
  group: string;
  /** One template per line; {0}, {1}… are replaced with rolled values. */
  text: string[];
  stats: ModStat[];
  tiers: ModTierDef[];
  /** Item tags that allow this mod to spawn. */
  spawn: string[];
  /** Base spawn weight (default 1000). */
  weight?: number;
  /** Value multipliers by item tag (e.g. two-handed weapons roll bigger flat damage). */
  scale?: Record<string, number>;
  /** Affix names, lowest tier first. */
  names?: string[];
  /** Number of decimals for rolled values (default 0). */
  decimals?: number;
  mapEffect?: MapEffect;
}

const t = (ilvl: number, lo: number, hi: number, weight?: number): ModTierDef => ({ ilvl, values: [[lo, hi]], weight });
const t2 = (ilvl: number, a: [number, number], b: [number, number]): ModTierDef => ({ ilvl, values: [a, b] });
const s = (stat: StatKey, kind: ModKind = 'flat', idx = 0, mult = 1): ModStat => ({ stat, kind, idx, mult });
const fl = (stat: StatKey): ModStat => ({ stat, kind: 'flag', value: 1 });

type ModInput = Omit<ModDef, 'group' | 'text'> & { group?: string; text: string | string[] };
const mod = (m: ModInput): ModDef => ({ ...m, group: m.group ?? m.id, text: Array.isArray(m.text) ? m.text : [m.text] });

// Shared tier tables -------------------------------------------------------------------------

const ARMOUR_ARMOUR = [t(1, 6, 15), t(11, 16, 40), t(18, 41, 70), t(26, 71, 110), t(35, 111, 160), t(44, 161, 220), t(54, 221, 290), t(63, 291, 360), t(72, 361, 440)];
const DEF_INC = [t(3, 15, 26), t(17, 27, 42), t(29, 43, 55), t(42, 56, 67), t(56, 68, 79), t(70, 80, 92), t(78, 93, 100)];
const RES = [t(1, 6, 11), t(12, 12, 17), t(24, 18, 23), t(36, 24, 29), t(48, 30, 35), t(60, 36, 41), t(72, 42, 45), t(80, 46, 48)];
const ATTR = [t(1, 8, 12), t(11, 13, 17), t(22, 18, 22), t(33, 23, 27), t(44, 28, 32), t(55, 33, 37), t(66, 38, 42), t(74, 43, 50)];
const PCT_DMG = [t(2, 10, 19), t(12, 20, 29), t(24, 30, 39), t(36, 40, 49), t(48, 50, 59), t(60, 60, 69), t(72, 70, 79)];
const ADDED_ATTACK = [t2(1, [1, 2], [3, 4]), t2(12, [3, 5], [7, 8]), t2(20, [5, 7], [10, 12]), t2(28, [6, 9], [13, 16]), t2(35, [8, 11], [16, 19]), t2(44, [10, 13], [20, 23]), t2(52, [12, 16], [24, 28]), t2(64, [15, 20], [30, 35]), t2(75, [18, 24], [36, 42])];
const ADDED_LIGHTNING = [t2(1, [1, 1], [4, 6]), t2(13, [1, 2], [10, 14]), t2(19, [1, 3], [18, 24]), t2(28, [2, 4], [28, 36]), t2(35, [2, 5], [38, 46]), t2(44, [3, 6], [50, 58]), t2(52, [3, 8], [62, 72]), t2(64, [4, 9], [76, 88]), t2(75, [5, 11], [92, 106])];
const ADDED_LOCAL = [t2(1, [1, 2], [3, 4]), t2(12, [3, 5], [7, 9]), t2(20, [5, 7], [11, 14]), t2(28, [8, 11], [16, 20]), t2(35, [10, 14], [21, 25]), t2(44, [13, 18], [27, 32]), t2(52, [17, 22], [34, 40]), t2(64, [21, 28], [42, 50]), t2(75, [26, 35], [52, 62])];
const ADDED_COLD_LOCAL = ADDED_LOCAL.map((x) => ({ ...x, values: x.values.map(([a, b]) => [Math.max(1, Math.round(a * 0.85)), Math.max(1, Math.round(b * 0.85))] as [number, number]) }));
const ADDED_LIGHTNING_LOCAL = ADDED_LIGHTNING.map((x) => ({ ...x, values: x.values.map(([a, b]) => [Math.max(1, Math.round(a * 1.1)), Math.round(b * 1.1)] as [number, number]) }));

const ARMOUR_ALL = ['armour'];
const JEWELLERY = ['ring', 'amulet', 'belt'];
const CASTER = ['wand', 'sceptre', 'staff', 'dagger'];
const TWO_HAND_SCALE = { two_hand: 1.75, wand: 0.75 };
const STAFF_SCALE = { staff: 1.5 };

export const AFFIXES: ModDef[] = [
  // =========================================================================================
  // PREFIXES
  // =========================================================================================
  mod({
    id: 'life', type: 'prefix', text: '+{0} to maximum Life', stats: [s('life')],
    spawn: ['helmet', 'body_armour', 'gloves', 'boots', 'shield', 'belt', 'amulet', 'ring', 'quiver'],
    tiers: [t(1, 3, 9), t(5, 10, 19), t(11, 20, 29), t(18, 30, 39), t(24, 40, 49), t(30, 50, 59), t(36, 60, 69), t(44, 70, 79), t(54, 80, 89), t(64, 90, 99), t(73, 100, 109)],
    names: ['Hardy', 'Hale', 'Sturdy', 'Stalwart', 'Robust', 'Vital', 'Vigorous', 'Thriving', 'Resilient', 'Indomitable', "Titan's"],
  }),
  mod({
    id: 'mana', type: 'prefix', text: '+{0} to maximum Mana', stats: [s('mana')],
    spawn: ['helmet', 'gloves', 'boots', 'ring', 'amulet', ...CASTER],
    tiers: [t(1, 15, 19), t(11, 20, 24), t(17, 25, 29), t(23, 30, 34), t(29, 35, 39), t(35, 40, 44), t(42, 45, 49), t(51, 50, 54), t(60, 55, 59), t(69, 60, 64)],
    names: ['Beryl', 'Cobalt', 'Azure', 'Lapis', 'Cerulean', 'Aqueous', 'Opaline', 'Gentian', 'Indigo', 'Mazarine'],
  }),
  mod({
    id: 'es_flat', type: 'prefix', group: 'es_flat', text: '+{0} to maximum Energy Shield', stats: [s('energy_shield')],
    spawn: JEWELLERY,
    tiers: [t(3, 1, 4), t(11, 5, 8), t(17, 9, 12), t(23, 13, 15), t(29, 16, 19), t(35, 20, 22), t(42, 23, 26), t(50, 27, 31), t(59, 32, 37), t(68, 38, 43)],
    names: ['Shining', 'Glimmering', 'Glittering', 'Glowing', 'Radiating', 'Pulsing', 'Seething', 'Blazing', 'Scintillating', 'Incandescent'],
  }),
  mod({
    id: 'es_pct', type: 'prefix', text: '{0}% increased maximum Energy Shield', stats: [s('energy_shield', 'inc')],
    spawn: ['amulet'], weight: 600,
    tiers: [t(3, 2, 4), t(18, 5, 7), t(32, 8, 10), t(50, 11, 13), t(66, 14, 16)],
    names: ['Warding', 'Shielding', 'Aegis', 'Bastion', 'Citadel'],
  }),
  mod({
    id: 'life_pct', type: 'prefix', text: '{0}% increased maximum Life', stats: [s('life', 'inc')],
    spawn: ['amulet', 'belt'], weight: 300,
    tiers: [t(20, 3, 5), t(40, 6, 8), t(60, 9, 10)],
    names: ['Fecund', 'Vivacious', 'Flourishing'],
  }),
  mod({
    id: 'local_armour', type: 'prefix', group: 'local_def_flat', text: '+{0} to Armour', stats: [s('local_armour')],
    spawn: ['str_armour', 'str_dex_armour', 'str_int_armour'], tiers: ARMOUR_ARMOUR,
    names: ['Lacquered', 'Studded', 'Ribbed', 'Fortified', 'Plated', 'Carapaced', 'Encased', 'Enveloped', 'Adamantine'],
  }),
  mod({
    id: 'local_evasion', type: 'prefix', group: 'local_def_flat2', text: '+{0} to Evasion Rating', stats: [s('local_evasion')],
    spawn: ['dex_armour', 'str_dex_armour', 'dex_int_armour'], tiers: ARMOUR_ARMOUR,
    names: ['Agile', "Dancer's", "Acrobat's", 'Fleet', 'Blurred', 'Phased', 'Vaporous', 'Elusive', 'Ethereal'],
  }),
  mod({
    id: 'local_es', type: 'prefix', group: 'local_def_flat3', text: '+{0} to maximum Energy Shield', stats: [s('local_es')],
    spawn: ['int_armour', 'str_int_armour', 'dex_int_armour'],
    tiers: [t(1, 3, 5), t(11, 6, 11), t(17, 12, 17), t(23, 18, 23), t(29, 24, 29), t(35, 30, 35), t(43, 36, 41), t(51, 42, 47), t(60, 48, 53), t(70, 54, 61)],
    names: ['Protective', 'Steadfast', 'Resolute', 'Fearless', 'Dauntless', 'Unwavering', 'Unshakable', 'Unassailable', 'Stoic', 'Sovereign'],
  }),
  mod({
    id: 'local_armour_inc', type: 'prefix', group: 'local_def_inc', text: '{0}% increased Armour', stats: [s('local_armour_inc', 'inc')],
    spawn: ['str_armour'], tiers: DEF_INC,
    names: ['Reinforced', 'Layered', 'Lobstered', 'Buttressed', 'Thickened', 'Girded', 'Impregnable'],
  }),
  mod({
    id: 'local_evasion_inc', type: 'prefix', group: 'local_def_inc', text: '{0}% increased Evasion Rating', stats: [s('local_evasion_inc', 'inc')],
    spawn: ['dex_armour'], tiers: DEF_INC,
    names: ["Shade's", "Ghost's", "Spectre's", "Wraith's", "Phantasm's", "Nightmare's", "Mirage's"],
  }),
  mod({
    id: 'local_es_inc', type: 'prefix', group: 'local_def_inc', text: '{0}% increased Energy Shield', stats: [s('local_es_inc', 'inc')],
    spawn: ['int_armour'], tiers: DEF_INC,
    names: ['Shimmering', 'Iridescent', 'Lustrous', 'Coruscating', 'Gleaming', 'Resplendent', 'Dazzling'],
  }),
  mod({
    id: 'local_ae_inc', type: 'prefix', group: 'local_def_inc', text: '{0}% increased Armour and Evasion', stats: [s('local_def_inc', 'inc')],
    spawn: ['str_dex_armour'], tiers: DEF_INC,
    names: ["Scrapper's", "Brawler's", "Fencer's", "Gladiator's", "Duelist's", "Hero's", "Legend's"],
  }),
  mod({
    id: 'local_aes_inc', type: 'prefix', group: 'local_def_inc', text: '{0}% increased Armour and Energy Shield', stats: [s('local_def_inc', 'inc')],
    spawn: ['str_int_armour'], tiers: DEF_INC,
    names: ['Infixed', 'Ingrained', 'Instilled', 'Infused', 'Inculcated', 'Interpolated', 'Unfaltering'],
  }),
  mod({
    id: 'local_ees_inc', type: 'prefix', group: 'local_def_inc', text: '{0}% increased Evasion and Energy Shield', stats: [s('local_def_inc', 'inc')],
    spawn: ['dex_int_armour'], tiers: DEF_INC,
    names: ['Shadowy', 'Ethereal', 'Unworldly', 'Ephemeral', 'Evanescent', 'Unreal', 'Illusory'],
  }),
  mod({
    id: 'movement_speed', type: 'prefix', text: '{0}% increased Movement Speed', stats: [s('movement_speed', 'inc')],
    spawn: ['boots'], tiers: [t(1, 10, 10), t(15, 15, 15), t(30, 20, 20), t(40, 25, 25), t(55, 30, 30), t(70, 35, 35)],
    names: ["Runner's", "Sprinter's", "Stallion's", "Gazelle's", "Cheetah's", "Hellion's"],
  }),
  mod({
    id: 'local_phys_inc', type: 'prefix', text: '{0}% increased Physical Damage', stats: [s('local_phys_inc', 'inc')],
    spawn: ['attack_weapon', 'bow', 'wand'],
    tiers: [t(1, 40, 49), t(11, 50, 64), t(23, 65, 84), t(35, 85, 109), t(46, 110, 134), t(60, 135, 154), t(73, 155, 179)],
    names: ['Heavy', 'Serrated', 'Wicked', 'Vicious', 'Bloodthirsty', 'Cruel', 'Tyrannical'],
  }),
  mod({
    id: 'local_phys_added', type: 'prefix', text: 'Adds {0} to {1} Physical Damage', stats: [s('local_phys_min', 'flat', 0), s('local_phys_max', 'flat', 1)],
    spawn: ['weapon'], scale: TWO_HAND_SCALE,
    tiers: [t2(1, [1, 2], [3, 4]), t2(8, [2, 3], [5, 7]), t2(16, [4, 5], [8, 10]), t2(25, [5, 7], [11, 15]), t2(35, [7, 10], [15, 18]), t2(45, [9, 12], [19, 22]), t2(55, [11, 15], [23, 27]), t2(65, [13, 18], [27, 32]), t2(75, [16, 21], [32, 38])],
    names: ['Glinting', 'Burnished', 'Polished', 'Honed', 'Gleaming', 'Annealed', 'Razor-sharp', 'Tempered', 'Flaring'],
  }),
  mod({
    id: 'local_fire_added', type: 'prefix', text: 'Adds {0} to {1} Fire Damage', stats: [s('local_fire_min', 'flat', 0), s('local_fire_max', 'flat', 1)],
    spawn: ['weapon'], scale: TWO_HAND_SCALE, tiers: ADDED_LOCAL,
    names: ['Heated', 'Smouldering', 'Smoking', 'Burning', 'Flaming', 'Scorching', 'Incinerating', 'Blasting', 'Cremating'],
  }),
  mod({
    id: 'local_cold_added', type: 'prefix', text: 'Adds {0} to {1} Cold Damage', stats: [s('local_cold_min', 'flat', 0), s('local_cold_max', 'flat', 1)],
    spawn: ['weapon'], scale: TWO_HAND_SCALE, tiers: ADDED_COLD_LOCAL,
    names: ['Frosted', 'Chilled', 'Icy', 'Frigid', 'Freezing', 'Frozen', 'Glaciated', 'Polar', 'Entombing'],
  }),
  mod({
    id: 'local_lightning_added', type: 'prefix', text: 'Adds {0} to {1} Lightning Damage', stats: [s('local_lightning_min', 'flat', 0), s('local_lightning_max', 'flat', 1)],
    spawn: ['weapon'], scale: TWO_HAND_SCALE, tiers: ADDED_LIGHTNING_LOCAL,
    names: ['Humming', 'Buzzing', 'Snapping', 'Crackling', 'Sparking', 'Arcing', 'Shocking', 'Discharging', 'Electrocuting'],
  }),
  mod({
    id: 'attack_phys_added', type: 'prefix', text: 'Adds {0} to {1} Physical Damage to Attacks', stats: [s('attack_phys_min', 'flat', 0), s('attack_phys_max', 'flat', 1)],
    spawn: ['ring', 'amulet', 'gloves', 'quiver'],
    tiers: [t2(5, [1, 1], [2, 2]), t2(13, [1, 2], [3, 3]), t2(19, [2, 3], [4, 5]), t2(28, [3, 4], [6, 7]), t2(35, [4, 5], [7, 8]), t2(44, [5, 6], [9, 10]), t2(52, [6, 7], [11, 12]), t2(64, [7, 9], [13, 15]), t2(75, [9, 11], [16, 19])],
    names: ['Glinting', 'Burnished', 'Polished', 'Honed', 'Gleaming', 'Annealed', 'Razor-sharp', 'Tempered', 'Flaring'],
  }),
  mod({
    id: 'attack_fire_added', type: 'prefix', text: 'Adds {0} to {1} Fire Damage to Attacks', stats: [s('attack_fire_min', 'flat', 0), s('attack_fire_max', 'flat', 1)],
    spawn: ['ring', 'amulet', 'gloves', 'quiver'], tiers: ADDED_ATTACK,
    names: ['Heated', 'Smouldering', 'Smoking', 'Burning', 'Flaming', 'Scorching', 'Incinerating', 'Blasting', 'Cremating'],
  }),
  mod({
    id: 'attack_cold_added', type: 'prefix', text: 'Adds {0} to {1} Cold Damage to Attacks', stats: [s('attack_cold_min', 'flat', 0), s('attack_cold_max', 'flat', 1)],
    spawn: ['ring', 'amulet', 'gloves', 'quiver'], tiers: ADDED_ATTACK,
    names: ['Frosted', 'Chilled', 'Icy', 'Frigid', 'Freezing', 'Frozen', 'Glaciated', 'Polar', 'Entombing'],
  }),
  mod({
    id: 'attack_lightning_added', type: 'prefix', text: 'Adds {0} to {1} Lightning Damage to Attacks', stats: [s('attack_lightning_min', 'flat', 0), s('attack_lightning_max', 'flat', 1)],
    spawn: ['ring', 'amulet', 'gloves', 'quiver'], tiers: ADDED_LIGHTNING,
    names: ['Humming', 'Buzzing', 'Snapping', 'Crackling', 'Sparking', 'Arcing', 'Shocking', 'Discharging', 'Electrocuting'],
  }),
  mod({
    id: 'spell_fire_added', type: 'prefix', text: 'Adds {0} to {1} Fire Damage to Spells', stats: [s('spell_fire_min', 'flat', 0), s('spell_fire_max', 'flat', 1)],
    spawn: CASTER, scale: STAFF_SCALE, tiers: ADDED_ATTACK,
    names: ['Heated', 'Smouldering', 'Smoking', 'Burning', 'Flaming', 'Scorching', 'Incinerating', 'Blasting', 'Cremating'],
  }),
  mod({
    id: 'spell_cold_added', type: 'prefix', text: 'Adds {0} to {1} Cold Damage to Spells', stats: [s('spell_cold_min', 'flat', 0), s('spell_cold_max', 'flat', 1)],
    spawn: CASTER, scale: STAFF_SCALE, tiers: ADDED_ATTACK,
    names: ['Frosted', 'Chilled', 'Icy', 'Frigid', 'Freezing', 'Frozen', 'Glaciated', 'Polar', 'Entombing'],
  }),
  mod({
    id: 'spell_lightning_added', type: 'prefix', text: 'Adds {0} to {1} Lightning Damage to Spells', stats: [s('spell_lightning_min', 'flat', 0), s('spell_lightning_max', 'flat', 1)],
    spawn: CASTER, scale: STAFF_SCALE, tiers: ADDED_LIGHTNING,
    names: ['Humming', 'Buzzing', 'Snapping', 'Crackling', 'Sparking', 'Arcing', 'Shocking', 'Discharging', 'Electrocuting'],
  }),
  mod({
    id: 'spell_damage', type: 'prefix', text: '{0}% increased Spell Damage', stats: [s('spell_damage', 'inc')],
    spawn: [...CASTER, 'amulet'], scale: STAFF_SCALE,
    tiers: [t(2, 10, 19), t(11, 20, 29), t(23, 30, 39), t(35, 40, 49), t(46, 50, 59), t(58, 60, 69), t(64, 70, 74), t(75, 75, 79)],
    names: ["Apprentice's", "Adept's", "Scholar's", "Professor's", "Occultist's", "Incanter's", 'Glyphic', 'Runic'],
  }),
  mod({
    id: 'fire_damage', type: 'prefix', text: '{0}% increased Fire Damage', stats: [s('fire_damage', 'inc')],
    spawn: [...CASTER, 'amulet'], scale: STAFF_SCALE, tiers: PCT_DMG,
    names: ['Searing', 'Sizzling', 'Blistering', 'Cauterising', 'Volcanic', 'Magmatic', 'Pyroclastic'],
  }),
  mod({
    id: 'cold_damage', type: 'prefix', text: '{0}% increased Cold Damage', stats: [s('cold_damage', 'inc')],
    spawn: [...CASTER, 'amulet'], scale: STAFF_SCALE, tiers: PCT_DMG,
    names: ['Bitter', 'Biting', 'Alpine', 'Snowy', 'Hailing', 'Arctic', 'Crystalline'],
  }),
  mod({
    id: 'lightning_damage', type: 'prefix', text: '{0}% increased Lightning Damage', stats: [s('lightning_damage', 'inc')],
    spawn: [...CASTER, 'amulet'], scale: STAFF_SCALE, tiers: PCT_DMG,
    names: ['Charged', 'Hissing', 'Bolting', 'Coursing', 'Striking', 'Thundering', "Stormrider's"],
  }),
  mod({
    id: 'minion_damage', type: 'prefix', text: 'Minions deal {0}% increased Damage', stats: [s('minion_damage', 'inc')],
    spawn: ['wand', 'sceptre', 'staff', 'amulet', 'helmet'], weight: 500, scale: STAFF_SCALE,
    tiers: [t(4, 10, 19), t(15, 20, 29), t(30, 30, 39), t(50, 40, 49), t(65, 50, 59)],
    names: ['Baleful', 'Malicious', 'Malevolent', "Death's", "Necromancer's"],
  }),
  mod({
    id: 'life_leech', type: 'prefix', text: '{0}% of Attack Damage Leeched as Life', stats: [s('life_leech')], decimals: 1,
    spawn: ['ring', 'amulet', 'gloves', 'quiver'], weight: 500,
    tiers: [t(9, 0.2, 0.4), t(22, 0.4, 0.6), t(40, 0.6, 0.8), t(60, 0.8, 1.0)],
    names: ["Remora's", "Lamprey's", "Vampire's", "Parasite's"],
  }),
  mod({
    id: 'socketed_gem_level', type: 'prefix', text: '+{0} to Level of Socketed Gems', stats: [s('socketed_gem_level')],
    spawn: ['body_armour', 'helmet', 'shield', 'two_hand'], weight: 150,
    tiers: [t(30, 1, 1), t(75, 2, 2, 200)],
    names: ["Paragon's", "Exemplar's"],
  }),
  mod({
    id: 'spell_gem_level', type: 'prefix', text: '+{0} to Level of all Spell Skill Gems', stats: [s('spell_gem_level')],
    spawn: ['wand', 'sceptre', 'staff', 'amulet'], weight: 200,
    tiers: [t(35, 1, 1), t(78, 2, 2, 200)],
    names: ["Magister's", "Archmage's"],
  }),

  // =========================================================================================
  // SUFFIXES
  // =========================================================================================
  mod({
    id: 'str', type: 'suffix', text: '+{0} to Strength', stats: [s('str')], tiers: ATTR,
    spawn: ['weapon', 'armour', 'amulet', 'ring', 'belt'],
    names: ['of the Brute', 'of the Wrestler', 'of the Bear', 'of the Lion', 'of the Gorilla', 'of the Goliath', 'of the Leviathan', 'of the Titan'],
  }),
  mod({
    id: 'dex', type: 'suffix', text: '+{0} to Dexterity', stats: [s('dex')], tiers: ATTR,
    spawn: ['weapon', 'armour', 'amulet', 'ring', 'quiver'],
    names: ['of the Mongoose', 'of the Lynx', 'of the Fox', 'of the Falcon', 'of the Panther', 'of the Leopard', 'of the Jaguar', 'of the Phantom'],
  }),
  mod({
    id: 'int', type: 'suffix', text: '+{0} to Intelligence', stats: [s('int')], tiers: ATTR,
    spawn: ['weapon', 'armour', 'amulet', 'ring'],
    names: ['of the Pupil', 'of the Student', 'of the Prodigy', 'of the Augur', 'of the Philosopher', 'of the Sage', 'of the Savant', 'of the Virtuoso'],
  }),
  mod({
    id: 'all_attributes', type: 'suffix', text: '+{0} to all Attributes', stats: [s('all_attributes')], spawn: ['amulet'], weight: 600,
    tiers: [t(1, 1, 4), t(11, 5, 8), t(22, 9, 12), t(33, 13, 16), t(44, 17, 20), t(55, 21, 24), t(66, 25, 28)],
    names: ['of the Clouds', 'of the Sky', 'of the Meteor', 'of the Comet', 'of the Heavens', 'of the Galaxy', 'of the Universe'],
  }),
  mod({
    id: 'fire_res', type: 'suffix', text: '+{0}% to Fire Resistance', stats: [s('fire_res')], tiers: RES,
    spawn: [...ARMOUR_ALL, ...JEWELLERY],
    names: ['of the Whelpling', 'of the Salamander', 'of the Drake', 'of the Kiln', 'of the Furnace', 'of the Volcano', 'of Magma', 'of the Inferno'],
  }),
  mod({
    id: 'cold_res', type: 'suffix', text: '+{0}% to Cold Resistance', stats: [s('cold_res')], tiers: RES,
    spawn: [...ARMOUR_ALL, ...JEWELLERY],
    names: ['of the Frost', 'of the Seal', 'of the Penguin', 'of the Yeti', 'of the Walrus', 'of the Polar Bear', 'of the Ice', 'of the Glacier'],
  }),
  mod({
    id: 'lightning_res', type: 'suffix', text: '+{0}% to Lightning Resistance', stats: [s('lightning_res')], tiers: RES,
    spawn: [...ARMOUR_ALL, ...JEWELLERY],
    names: ['of the Cloud', 'of the Squall', 'of the Storm', 'of the Thunderhead', 'of the Tempest', 'of the Maelstrom', 'of the Lightning', 'of the Stormfront'],
  }),
  mod({
    id: 'all_res', type: 'suffix', text: '+{0}% to all Elemental Resistances', stats: [s('all_ele_res')],
    spawn: ['ring', 'amulet', 'shield'], weight: 600,
    tiers: [t(12, 3, 5), t(24, 6, 8), t(36, 9, 11), t(48, 12, 14), t(60, 15, 16), t(72, 17, 18)],
    names: ['of the Crystal', 'of the Prism', 'of the Kaleidoscope', 'of Variegation', 'of the Rainbow', 'of the Span'],
  }),
  mod({
    id: 'chaos_res', type: 'suffix', text: '+{0}% to Chaos Resistance', stats: [s('chaos_res')],
    spawn: [...ARMOUR_ALL, ...JEWELLERY], weight: 250,
    tiers: [t(16, 5, 10), t(30, 11, 15), t(44, 16, 20), t(56, 21, 25), t(68, 26, 30), t(80, 31, 35)],
    names: ['of the Lost', 'of Banishment', 'of Eviction', 'of Expulsion', 'of Warding', 'of the Void'],
  }),
  mod({
    id: 'local_attack_speed', type: 'suffix', group: 'attack_speed', text: '{0}% increased Attack Speed', stats: [s('local_attack_speed', 'inc')],
    spawn: ['attack_weapon', 'bow', 'wand'],
    tiers: [t(1, 5, 7), t(11, 8, 10), t(22, 11, 13), t(30, 14, 16), t(37, 17, 19), t(45, 20, 22), t(60, 23, 25), t(77, 26, 27)],
    names: ['of Skill', 'of Ease', 'of Mastery', 'of Grandmastery', 'of Renown', 'of Acclaim', 'of Fame', 'of Infamy'],
  }),
  mod({
    id: 'attack_speed', type: 'suffix', group: 'attack_speed', text: '{0}% increased Attack Speed', stats: [s('attack_speed', 'inc')],
    spawn: ['gloves', 'quiver', 'ring'], weight: 500,
    tiers: [t(1, 5, 7), t(18, 8, 10), t(35, 11, 13), t(55, 14, 16)],
    names: ['of Skill', 'of Ease', 'of Mastery', 'of Grandmastery'],
  }),
  mod({
    id: 'cast_speed', type: 'suffix', text: '{0}% increased Cast Speed', stats: [s('cast_speed', 'inc')],
    spawn: [...CASTER, 'amulet', 'ring'], scale: STAFF_SCALE,
    tiers: [t(2, 5, 8), t(15, 9, 12), t(30, 13, 16), t(40, 17, 20), t(55, 21, 24), t(72, 25, 28)],
    names: ['of Talent', 'of Nimbleness', 'of Expertise', 'of Legerdemain', 'of Prestidigitation', 'of Sortilege'],
  }),
  mod({
    id: 'local_crit', type: 'suffix', group: 'crit_chance', text: '{0}% increased Critical Strike Chance', stats: [s('local_crit', 'inc')],
    spawn: ['weapon'],
    tiers: [t(1, 10, 14), t(20, 15, 19), t(30, 20, 24), t(44, 25, 29), t(58, 30, 34), t(72, 35, 38)],
    names: ['of Needling', 'of Stinging', 'of Piercing', 'of Puncturing', 'of Penetrating', 'of Incision'],
  }),
  mod({
    id: 'crit_chance', type: 'suffix', group: 'crit_chance', text: '{0}% increased Global Critical Strike Chance', stats: [s('crit_chance', 'inc')],
    spawn: ['amulet', 'quiver'],
    tiers: [t(5, 10, 14), t(20, 15, 19), t(30, 20, 24), t(44, 25, 29), t(58, 30, 34), t(72, 35, 38)],
    names: ['of Needling', 'of Stinging', 'of Piercing', 'of Puncturing', 'of Penetrating', 'of Incision'],
  }),
  mod({
    id: 'crit_multi', type: 'suffix', text: '+{0}% to Global Critical Strike Multiplier', stats: [s('crit_multi')],
    spawn: ['weapon', 'amulet', 'quiver'],
    tiers: [t(8, 8, 12), t(21, 13, 19), t(31, 20, 24), t(45, 25, 29), t(59, 30, 34), t(74, 35, 38)],
    names: ['of Ire', 'of Anger', 'of Rage', 'of Fury', 'of Ferocity', 'of Destruction'],
  }),
  mod({
    id: 'spell_crit', type: 'suffix', text: '{0}% increased Critical Strike Chance for Spells', stats: [s('spell_crit_chance', 'inc')],
    spawn: CASTER, scale: STAFF_SCALE,
    tiers: [t(11, 10, 19), t(21, 20, 39), t(28, 40, 59), t(41, 60, 79), t(59, 80, 99), t(76, 100, 109)],
    names: ['of Menace', 'of Havoc', 'of Disaster', 'of Calamity', 'of Ruin', 'of Unmaking'],
  }),
  mod({
    id: 'accuracy', type: 'suffix', text: '+{0} to Accuracy Rating', stats: [s('accuracy')],
    spawn: ['attack_weapon', 'bow', 'helmet', 'gloves', 'ring', 'quiver', 'amulet'],
    tiers: [t(1, 5, 15), t(12, 16, 60), t(20, 61, 100), t(26, 101, 130), t(33, 131, 165), t(41, 166, 200), t(50, 201, 250), t(63, 251, 320), t(76, 321, 400)],
    names: ['of Calm', 'of Steadiness', 'of Accuracy', 'of Precision', 'of the Sniper', 'of the Marksman', 'of the Deadeye', 'of the Ranger', 'of the Assassin'],
  }),
  mod({
    id: 'life_regen', type: 'suffix', text: 'Regenerate {0} Life per second', stats: [s('life_regen')], decimals: 1,
    spawn: ['amulet', 'ring', 'body_armour', 'helmet', 'shield', 'belt'],
    tiers: [t(1, 1, 2), t(7, 2.1, 8), t(19, 8.1, 16), t(31, 16.1, 24), t(44, 24.1, 32), t(55, 32.1, 48), t(68, 48.1, 64), t(78, 64.1, 80)],
    names: ['of the Newt', 'of the Lizard', 'of the Flatworm', 'of the Starfish', 'of the Hydra', 'of the Troll', 'of the Phoenix', 'of the Undying'],
  }),
  mod({
    id: 'mana_regen', type: 'suffix', text: '{0}% increased Mana Regeneration Rate', stats: [s('mana_regen', 'inc')],
    spawn: ['ring', 'amulet', 'shield', ...CASTER], scale: STAFF_SCALE,
    tiers: [t(2, 10, 19), t(18, 20, 29), t(29, 30, 39), t(42, 40, 49), t(55, 50, 59), t(79, 60, 69)],
    names: ['of Excitement', 'of Joy', 'of Elation', 'of Bliss', 'of Euphoria', 'of Nirvana'],
  }),
  mod({
    id: 'life_on_kill', type: 'suffix', text: 'Gain {0} Life per Enemy Killed', stats: [s('life_on_kill')], spawn: ['weapon'],
    tiers: [t(1, 2, 4), t(20, 5, 8), t(40, 9, 14), t(60, 15, 20)],
    names: ['of Rejuvenation', 'of Restoration', 'of Regrowth', 'of Nourishment'],
  }),
  mod({
    id: 'mana_on_kill', type: 'suffix', text: 'Gain {0} Mana per Enemy Killed', stats: [s('mana_on_kill')], spawn: ['weapon', 'ring'],
    tiers: [t(1, 1, 2), t(20, 3, 4), t(40, 5, 6), t(60, 7, 8)],
    names: ['of Absorption', 'of Osmosis', 'of Consumption', 'of Assimilation'],
  }),
  mod({
    id: 'item_rarity', type: 'suffix', text: '{0}% increased Rarity of Items found', stats: [s('item_rarity', 'inc')],
    spawn: ['helmet', 'gloves', 'boots', 'ring', 'amulet'],
    tiers: [t(2, 6, 10), t(20, 11, 14), t(39, 15, 20), t(53, 21, 26), t(75, 27, 30)],
    names: ['of Plunder', 'of Raiding', 'of Archaeology', 'of Excavation', 'of Windfall'],
  }),
  mod({
    id: 'local_block', type: 'suffix', text: '+{0}% Chance to Block', stats: [s('local_block')], spawn: ['shield'],
    tiers: [t(1, 1, 2), t(15, 3, 4), t(30, 5, 6), t(50, 7, 8)],
    names: ['of Deflection', 'of Parrying', 'of the Bulwark', 'of the Citadel'],
  }),
  mod({
    id: 'projectile_speed', type: 'suffix', text: '{0}% increased Projectile Speed', stats: [s('projectile_speed', 'inc')], spawn: ['quiver', 'wand'],
    tiers: [t(10, 10, 17), t(20, 18, 25), t(40, 26, 33), t(60, 34, 40)],
    names: ['of Flight', 'of Propulsion', 'of the Zephyr', 'of the Gale'],
  }),
  mod({
    id: 'elemental_damage', type: 'suffix', text: '{0}% increased Elemental Damage', stats: [s('elemental_damage', 'inc')],
    spawn: ['ring', 'amulet', 'belt', 'quiver'],
    tiers: [t(4, 5, 10), t(15, 11, 20), t(30, 21, 30), t(60, 31, 37)],
    names: ['of Elements', 'of Harmony', 'of Convergence', 'of Confluence'],
  }),
  mod({
    id: 'flask_charges_gained', type: 'suffix', text: '{0}% increased Flask Charges gained', stats: [s('flask_charges', 'inc')], spawn: ['belt'],
    tiers: [t(8, 10, 20), t(30, 21, 30), t(50, 31, 40)],
    names: ['of Refilling', 'of Replenishing', 'of Plenty'],
  }),
  mod({
    id: 'ignite_chance', type: 'suffix', group: 'ailment_chance', text: '{0}% chance to Ignite', stats: [s('ignite_chance')],
    spawn: ['wand', 'sceptre', 'staff', 'bow', 'dagger'], weight: 500,
    tiers: [t(15, 5, 10), t(35, 11, 15), t(55, 16, 20)], names: ['of Ignition', 'of Combustion', 'of Conflagration'],
  }),
  mod({
    id: 'freeze_chance', type: 'suffix', group: 'ailment_chance', text: '{0}% chance to Freeze', stats: [s('freeze_chance')],
    spawn: ['wand', 'sceptre', 'staff', 'bow', 'dagger'], weight: 500,
    tiers: [t(15, 5, 10), t(35, 11, 15), t(55, 16, 20)], names: ['of Rime', 'of Hoarfrost', 'of Glaciation'],
  }),
  mod({
    id: 'shock_chance', type: 'suffix', group: 'ailment_chance', text: '{0}% chance to Shock', stats: [s('shock_chance')],
    spawn: ['wand', 'sceptre', 'staff', 'bow', 'dagger'], weight: 500,
    tiers: [t(15, 5, 10), t(35, 11, 15), t(55, 16, 20)], names: ['of Static', 'of Voltage', 'of Electrocution'],
  }),

  // =========================================================================================
  // FLASK MODS
  // =========================================================================================
  mod({
    id: 'flask_charges_max', type: 'prefix', group: 'flask_charges', text: '+{0} to Maximum Charges', stats: [s('flask_local_charges')],
    spawn: ['flask'], tiers: [t(1, 5, 10), t(20, 11, 15), t(40, 16, 20)], names: ['Ample', 'Capacious', 'Bountiful'],
  }),
  mod({
    id: 'flask_charge_use', type: 'prefix', group: 'flask_charges', text: '{0}% reduced Charges used', stats: [s('flask_local_charge_use', 'inc', 0, -1)],
    spawn: ['flask'], tiers: [t(3, 10, 15), t(20, 16, 20), t(40, 21, 25)], names: ['Frugal', 'Thrifty', 'Economical'],
  }),
  mod({
    id: 'flask_duration', type: 'prefix', group: 'flask_main', text: '{0}% increased Duration', stats: [s('flask_local_duration', 'inc')],
    spawn: ['utility_flask'], tiers: [t(5, 15, 20), t(25, 21, 30), t(45, 31, 40)], names: ['Prolonged', 'Lingering', 'Enduring'],
  }),
  mod({
    id: 'flask_instant', type: 'prefix', group: 'flask_main', text: ['Instant Recovery', '{0}% reduced Amount Recovered'],
    stats: [fl('flask_local_instant'), s('flask_local_amount', 'inc', 0, -1)],
    spawn: ['recovery_flask'], tiers: [t(10, 25, 25)], names: ['Surging'],
  }),
  mod({
    id: 'flask_amount', type: 'prefix', group: 'flask_main', text: '{0}% increased Amount Recovered', stats: [s('flask_local_amount', 'inc')],
    spawn: ['recovery_flask'], tiers: [t(1, 15, 25), t(20, 26, 35), t(40, 36, 45)], names: ['Potent', 'Concentrated', 'Saturated'],
  }),
  mod({
    id: 'flask_speed', type: 'prefix', group: 'flask_main', text: '{0}% increased Recovery rate', stats: [s('flask_local_speed', 'inc')],
    spawn: ['recovery_flask'], tiers: [t(1, 20, 30), t(22, 31, 45), t(44, 46, 60)], names: ['Hastened', 'Quickened', 'Accelerated'],
  }),
  mod({
    id: 'flask_bleed', type: 'suffix', group: 'flask_suffix', text: 'Immunity to Bleeding during Effect', stats: [fl('flask_local_bleed_immune')],
    spawn: ['flask'], tiers: [{ ilvl: 8, values: [] }], names: ['of Staunching'],
  }),
  mod({
    id: 'flask_freeze', type: 'suffix', group: 'flask_suffix', text: 'Immunity to Freeze and Chill during Effect', stats: [fl('flask_local_freeze_immune')],
    spawn: ['flask'], tiers: [{ ilvl: 4, values: [] }], names: ['of Thawing'],
  }),
  mod({
    id: 'flask_armour', type: 'suffix', group: 'flask_suffix', text: '{0}% increased Armour during Effect', stats: [s('flask_local_armour', 'inc')],
    spawn: ['flask'], tiers: [t(6, 40, 50), t(30, 51, 60), t(60, 61, 70)], names: ['of Iron Skin', 'of Steel Skin', 'of Adamantite Skin'],
  }),
  mod({
    id: 'flask_evasion', type: 'suffix', group: 'flask_suffix', text: '{0}% increased Evasion Rating during Effect', stats: [s('flask_local_evasion', 'inc')],
    spawn: ['flask'], tiers: [t(6, 40, 50), t(30, 51, 60), t(60, 61, 70)], names: ['of Reflexes', 'of Instinct', 'of Foresight'],
  }),
  mod({
    id: 'flask_move', type: 'suffix', group: 'flask_suffix', text: '{0}% increased Movement Speed during Effect', stats: [s('flask_local_move', 'inc')],
    spawn: ['flask'], tiers: [t(5, 6, 8), t(25, 9, 12), t(50, 13, 16)], names: ['of Adrenaline', 'of Haste', 'of Swiftness'],
  }),

  // =========================================================================================
  // MAP MODS — make the area harder in exchange for more loot
  // =========================================================================================
  mod({
    id: 'map_life', type: 'prefix', text: 'Monsters have {0}% more Life', stats: [s('monster_life', 'more')], spawn: ['map'],
    tiers: [t(1, 30, 40)], names: ['Fecund'], mapEffect: { target: 'monster', quant: 8, rarity: 4 },
  }),
  mod({
    id: 'map_damage', type: 'prefix', text: 'Monsters deal {0}% increased Damage', stats: [s('monster_damage', 'inc')], spawn: ['map'],
    tiers: [t(1, 20, 30)], names: ['Savage'], mapEffect: { target: 'monster', quant: 8, rarity: 5 },
  }),
  mod({
    id: 'map_speed', type: 'prefix', text: 'Monsters have {0}% increased Attack, Cast and Movement Speed', stats: [s('monster_speed', 'inc')], spawn: ['map'],
    tiers: [t(1, 15, 20)], names: ['Fleet'], mapEffect: { target: 'monster', quant: 7, rarity: 4 },
  }),
  mod({
    id: 'map_extra_fire', type: 'prefix', group: 'map_extra', text: 'Monsters deal {0}% extra Physical Damage as Fire', stats: [s('phys_as_extra_fire')], spawn: ['map'],
    tiers: [t(1, 40, 50)], names: ['Burning'], mapEffect: { target: 'monster', quant: 6, rarity: 4 },
  }),
  mod({
    id: 'map_extra_cold', type: 'prefix', group: 'map_extra', text: 'Monsters deal {0}% extra Physical Damage as Cold', stats: [s('phys_as_extra_cold')], spawn: ['map'],
    tiers: [t(1, 40, 50)], names: ['Freezing'], mapEffect: { target: 'monster', quant: 6, rarity: 4 },
  }),
  mod({
    id: 'map_extra_lightning', type: 'prefix', group: 'map_extra', text: 'Monsters deal {0}% extra Physical Damage as Lightning', stats: [s('phys_as_extra_lightning')], spawn: ['map'],
    tiers: [t(1, 40, 50)], names: ['Shocking'], mapEffect: { target: 'monster', quant: 6, rarity: 4 },
  }),
  mod({
    id: 'map_pack_size', type: 'prefix', text: '+{0}% Monster Pack Size', stats: [s('pack_size', 'inc')], spawn: ['map'],
    tiers: [t(1, 15, 25)], names: ['Crowded'], mapEffect: { target: 'monster', quant: 10, rarity: 0, packSize: 1 },
  }),
  mod({
    id: 'map_armoured', type: 'prefix', text: 'Monsters have +{0}% Physical Damage Reduction', stats: [s('phys_damage_reduction')], spawn: ['map'],
    tiers: [t(1, 20, 30)], names: ['Armoured'], mapEffect: { target: 'monster', quant: 6, rarity: 3 },
  }),
  mod({
    id: 'map_resistant', type: 'prefix', text: 'Monsters have +{0}% to all Elemental Resistances', stats: [s('all_ele_res')], spawn: ['map'],
    tiers: [t(1, 20, 30)], names: ['Resistant'], mapEffect: { target: 'monster', quant: 6, rarity: 3 },
  }),
  mod({
    id: 'map_exposure', type: 'suffix', text: 'Players have -{0}% to all Elemental Resistances', stats: [s('all_ele_res', 'flat', 0, -1)], spawn: ['map'],
    tiers: [t(1, 10, 20)], names: ['of Exposure'], mapEffect: { target: 'player', quant: 7, rarity: 4 },
  }),
  mod({
    id: 'map_frailty', type: 'suffix', text: 'Players have -{0}% to all maximum Elemental Resistances', stats: [s('max_all_ele_res', 'flat', 0, -1)], spawn: ['map'],
    tiers: [t(1, 5, 10)], names: ['of Frailty'], mapEffect: { target: 'player', quant: 9, rarity: 5 },
  }),
  mod({
    id: 'map_drought', type: 'suffix', text: 'Players gain {0}% reduced Flask Charges', stats: [s('flask_charges', 'inc', 0, -1)], spawn: ['map'],
    tiers: [t(1, 30, 50)], names: ['of Drought'], mapEffect: { target: 'player', quant: 6, rarity: 3 },
  }),
  mod({
    id: 'map_impotence', type: 'suffix', text: 'Players have {0}% less Area of Effect', stats: [s('area_of_effect', 'more', 0, -1)], spawn: ['map'],
    tiers: [t(1, 15, 25)], names: ['of Impotence'], mapEffect: { target: 'player', quant: 6, rarity: 3 },
  }),
  mod({
    id: 'map_vulnerability', type: 'suffix', text: 'Players take {0}% increased Damage', stats: [s('damage_taken', 'inc')], spawn: ['map'],
    tiers: [t(1, 10, 15)], names: ['of Vulnerability'], mapEffect: { target: 'player', quant: 8, rarity: 5 },
  }),
  mod({
    id: 'map_enfeeble', type: 'suffix', text: 'Players deal {0}% less Damage', stats: [s('damage', 'more', 0, -1)], spawn: ['map'],
    tiers: [t(1, 10, 15)], names: ['of Enfeeblement'], mapEffect: { target: 'player', quant: 8, rarity: 5 },
  }),

  // =========================================================================================
  // IMPLICITS (values supplied by the item base)
  // =========================================================================================
  ...(
    [
      ['imp_life', '+{0} to maximum Life', [s('life')]],
      ['imp_mana', '+{0} to maximum Mana', [s('mana')]],
      ['imp_es', '+{0} to maximum Energy Shield', [s('energy_shield')]],
      ['imp_fire_res', '+{0}% to Fire Resistance', [s('fire_res')]],
      ['imp_cold_res', '+{0}% to Cold Resistance', [s('cold_res')]],
      ['imp_lightning_res', '+{0}% to Lightning Resistance', [s('lightning_res')]],
      ['imp_chaos_res', '+{0}% to Chaos Resistance', [s('chaos_res')]],
      ['imp_fire_cold_res', '+{0}% to Fire and Cold Resistances', [s('fire_res'), s('cold_res')]],
      ['imp_all_res', '+{0}% to all Elemental Resistances', [s('all_ele_res')]],
      ['imp_rarity', '{0}% increased Rarity of Items found', [s('item_rarity', 'inc')]],
      ['imp_crit_chance', '{0}% increased Global Critical Strike Chance', [s('crit_chance', 'inc')]],
      ['imp_attack_phys', 'Adds {0} to {1} Physical Damage to Attacks', [s('attack_phys_min', 'flat', 0), s('attack_phys_max', 'flat', 1)]],
      ['imp_attack_fire', 'Adds {0} to {1} Fire Damage to Attacks', [s('attack_fire_min', 'flat', 0), s('attack_fire_max', 'flat', 1)]],
      ['imp_life_regen', 'Regenerate {0} Life per second', [s('life_regen')]],
      ['imp_mana_regen', '{0}% increased Mana Regeneration Rate', [s('mana_regen', 'inc')]],
      ['imp_str', '+{0} to Strength', [s('str')]],
      ['imp_dex', '+{0} to Dexterity', [s('dex')]],
      ['imp_int', '+{0} to Intelligence', [s('int')]],
      ['imp_str_int', '+{0} to Strength and Intelligence', [s('str'), s('int')]],
      ['imp_str_dex', '+{0} to Strength and Dexterity', [s('str'), s('dex')]],
      ['imp_dex_int', '+{0} to Dexterity and Intelligence', [s('dex'), s('int')]],
      ['imp_all_attr', '+{0} to all Attributes', [s('all_attributes')]],
      ['imp_phys_damage', '{0}% increased Global Physical Damage', [s('phys_damage', 'inc')]],
      ['imp_flask_effect', '{0}% increased Flask Effect Duration', [s('flask_duration', 'inc')]],
      ['imp_spell_damage', '{0}% increased Spell Damage', [s('spell_damage', 'inc')]],
      ['imp_elemental_damage', '{0}% increased Elemental Damage', [s('elemental_damage', 'inc')]],
      ['imp_accuracy', '+{0} to Accuracy Rating', [s('accuracy')]],
      ['imp_life_on_hit', 'Grants {0} Life per Enemy Hit', [s('life_on_hit')]],
      ['imp_block', '+{0}% Chance to Block Attack Damage', [s('block')]],
      ['imp_proj_speed', '{0}% increased Projectile Speed', [s('projectile_speed', 'inc')]],
    ] as [string, string, ModStat[]][]
  ).map(([id, text, stats]) => mod({ id, type: 'implicit', text, stats, spawn: [], tiers: [t(1, 0, 0)] })),

  // =========================================================================================
  // CORRUPTED IMPLICITS
  // =========================================================================================
  mod({ id: 'cor_gem_level', type: 'corrupted', text: '+{0} to Level of Socketed Gems', stats: [s('socketed_gem_level')], spawn: ['body_armour', 'helmet', 'weapon', 'shield'], tiers: [t(1, 1, 1)] }),
  mod({ id: 'cor_life_pct', type: 'corrupted', text: '{0}% increased maximum Life', stats: [s('life', 'inc')], spawn: ['amulet', 'belt', 'body_armour'], tiers: [t(1, 4, 7)] }),
  mod({ id: 'cor_max_res', type: 'corrupted', text: '+{0}% to all maximum Elemental Resistances', stats: [s('max_all_ele_res')], spawn: ['shield', 'body_armour'], weight: 300, tiers: [t(1, 1, 2)] }),
  mod({ id: 'cor_attack_speed', type: 'corrupted', text: '{0}% increased Attack Speed', stats: [s('attack_speed', 'inc')], spawn: ['gloves', 'quiver', 'weapon'], tiers: [t(1, 6, 10)] }),
  mod({ id: 'cor_move', type: 'corrupted', text: '{0}% increased Movement Speed', stats: [s('movement_speed', 'inc')], spawn: ['boots'], tiers: [t(1, 5, 10)] }),
  mod({ id: 'cor_all_res', type: 'corrupted', text: '+{0}% to all Elemental Resistances', stats: [s('all_ele_res')], spawn: ['ring', 'amulet', 'belt', 'helmet', 'boots', 'gloves'], tiers: [t(1, 8, 16)] }),
  mod({ id: 'cor_damage', type: 'corrupted', text: '{0}% increased Damage', stats: [s('damage', 'inc')], spawn: ['ring', 'amulet', 'weapon'], tiers: [t(1, 10, 20)] }),
  mod({ id: 'cor_crit', type: 'corrupted', text: '{0}% increased Global Critical Strike Chance', stats: [s('crit_chance', 'inc')], spawn: ['weapon', 'amulet', 'quiver', 'helmet'], tiers: [t(1, 20, 30)] }),
  mod({ id: 'cor_es', type: 'corrupted', text: '+{0} to maximum Energy Shield', stats: [s('energy_shield')], spawn: ['helmet', 'gloves', 'boots', 'ring'], tiers: [t(1, 20, 40)] }),
  mod({ id: 'cor_phys_red', type: 'corrupted', text: '{0}% additional Physical Damage Reduction', stats: [s('phys_damage_reduction')], spawn: ['body_armour', 'shield', 'belt'], tiers: [t(1, 2, 4)] }),
  mod({ id: 'cor_projectiles', type: 'corrupted', text: 'Skills fire an additional Projectile', stats: [s('additional_projectiles')], spawn: ['quiver', 'wand', 'bow'], weight: 200, tiers: [t(1, 1, 1)] }),
  mod({ id: 'cor_aoe', type: 'corrupted', text: '{0}% increased Area of Effect', stats: [s('area_of_effect', 'inc')], spawn: ['amulet', 'gloves', 'helmet', 'weapon'], tiers: [t(1, 8, 15)] }),
];

const registry = new Map<string, ModDef>();
for (const m of AFFIXES) {
  if (registry.has(m.id)) throw new Error(`Duplicate mod id ${m.id}`);
  registry.set(m.id, m);
}

export function registerMods(mods: ModDef[]): void {
  for (const m of mods) {
    if (registry.has(m.id)) throw new Error(`Duplicate mod id ${m.id}`);
    registry.set(m.id, m);
  }
}

export function getMod(id: string): ModDef {
  const m = registry.get(id);
  if (!m) throw new Error(`Unknown mod: ${id}`);
  return m;
}

export function allMods(): ModDef[] {
  return [...registry.values()];
}

export { mod as defineMod, t as tier, t2 as tier2, s as modStat, fl as modFlag };
