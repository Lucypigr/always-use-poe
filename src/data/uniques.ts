import type { SocketColor } from '../items/types';
import { defineMod, modFlag, modStat, registerMods, tier } from './affixes';

/** Unique-only modifiers (regular affixes can also be reused by uniques). */
registerMods([
  defineMod({ id: 'u_extra_projectile', type: 'unique', text: 'Skills fire {0} additional Projectiles', stats: [modStat('additional_projectiles')], spawn: [], tiers: [tier(1, 1, 1)] }),
  defineMod({ id: 'u_phys_as_fire', type: 'unique', text: 'Gain {0}% of Physical Damage as Extra Fire Damage', stats: [modStat('phys_as_extra_fire')], spawn: [], tiers: [tier(1, 0, 0)] }),
  defineMod({ id: 'u_phys_as_cold', type: 'unique', text: 'Gain {0}% of Physical Damage as Extra Cold Damage', stats: [modStat('phys_as_extra_cold')], spawn: [], tiers: [tier(1, 0, 0)] }),
  defineMod({ id: 'u_block', type: 'unique', text: '+{0}% Chance to Block Attack Damage', stats: [modStat('block')], spawn: [], tiers: [tier(1, 0, 0)] }),
  defineMod({ id: 'u_burning', type: 'unique', text: '{0}% increased Burning Damage', stats: [modStat('burning_damage', 'inc')], spawn: [], tiers: [tier(1, 0, 0)] }),
  defineMod({ id: 'u_flask_duration', type: 'unique', text: '{0}% increased Flask Effect Duration', stats: [modStat('flask_duration', 'inc')], spawn: [], tiers: [tier(1, 0, 0)] }),
  defineMod({ id: 'u_phys_reduction', type: 'unique', text: '{0}% additional Physical Damage Reduction', stats: [modStat('phys_damage_reduction')], spawn: [], tiers: [tier(1, 0, 0)] }),
  defineMod({ id: 'u_life_on_hit', type: 'unique', text: 'Gain {0} Life per Enemy Hit with Attacks', stats: [modStat('life_on_hit')], spawn: [], tiers: [tier(1, 0, 0)] }),
  defineMod({ id: 'u_move_speed', type: 'unique', text: '{0}% increased Movement Speed', stats: [modStat('movement_speed', 'inc')], spawn: [], tiers: [tier(1, 0, 0)] }),
  defineMod({ id: 'u_life_leech', type: 'unique', text: '{0}% of Attack Damage Leeched as Life', stats: [modStat('life_leech')], spawn: [], tiers: [tier(1, 0, 0)], decimals: 1 }),
  defineMod({ id: 'u_damage_taken', type: 'unique', text: '{0}% increased Damage taken', stats: [modStat('damage_taken', 'inc')], spawn: [], tiers: [tier(1, 0, 0)] }),
  defineMod({ id: 'u_minion_life', type: 'unique', text: 'Minions have {0}% increased maximum Life', stats: [modStat('minion_life', 'inc')], spawn: [], tiers: [tier(1, 0, 0)] }),
  defineMod({ id: 'u_minion_count', type: 'unique', text: '+{0} to maximum number of Minions', stats: [modStat('minion_count')], spawn: [], tiers: [tier(1, 0, 0)] }),
  defineMod({ id: 'u_aoe', type: 'unique', text: '{0}% increased Area of Effect', stats: [modStat('area_of_effect', 'inc')], spawn: [], tiers: [tier(1, 0, 0)] }),
  defineMod({ id: 'u_pierce', type: 'unique', text: 'Projectiles Pierce {0} additional Targets', stats: [modStat('pierce')], spawn: [], tiers: [tier(1, 0, 0)] }),
  defineMod({ id: 'u_hollow_vessel', type: 'unique', text: ['Hollow Vessel', 'Maximum Life becomes 1, Immune to Chaos Damage'], stats: [modFlag('ks_hollow_vessel')], spawn: [], tiers: [{ ilvl: 1, values: [] }] }),
  defineMod({ id: 'u_phantom_step', type: 'unique', text: ['Phantom Step', '30% chance to avoid Hits, 50% less Armour and Energy Shield'], stats: [modFlag('ks_phantom_step')], spawn: [], tiers: [{ ilvl: 1, values: [] }] }),
  defineMod({ id: 'u_close_quarters', type: 'unique', text: ['Close Quarters', 'Projectiles deal up to 40% more damage to nearby targets, less to distant ones'], stats: [modFlag('ks_close_quarters')], spawn: [], tiers: [{ ilvl: 1, values: [] }] }),
]);

export interface UniqueDef {
  id: string;
  name: string;
  base: string;
  level?: number;
  mods: { mod: string; values: [number, number][] }[];
  sockets?: { colors: SocketColor[]; linked: boolean };
  flavour: string;
  dropWeight?: number;
}

export const UNIQUES: UniqueDef[] = [
  {
    id: 'blank_canvas', name: 'The Blank Canvas', base: 'body_armour_int_1',
    mods: [], sockets: { colors: ['W', 'W', 'W', 'W', 'W', 'W'], linked: true }, dropWeight: 40,
    flavour: 'Every masterpiece begins with nothing at all.',
  },
  {
    id: 'gilded_brow', name: 'Gilded Brow', base: 'helmet_dex_0',
    mods: [{ mod: 'local_evasion', values: [[20, 30]] }, { mod: 'all_res', values: [[30, 36]] }, { mod: 'item_rarity', values: [[15, 20]] }, { mod: 'u_damage_taken', values: [[10, 10]] }],
    flavour: 'A fool\'s crown shines brightest.',
  },
  {
    id: 'windstride', name: 'Windstride', base: 'boots_dex_1',
    mods: [{ mod: 'dex', values: [[20, 30]] }, { mod: 'local_evasion_inc', values: [[30, 50]] }, { mod: 'life', values: [[30, 45]] }, { mod: 'u_move_speed', values: [[20, 30]] }],
    flavour: 'The wind never asks where the road leads.',
  },
  {
    id: 'emberheart', name: 'Emberheart', base: 'ring_ruby', level: 12,
    mods: [{ mod: 'attack_fire_added', values: [[4, 8], [10, 16]] }, { mod: 'u_phys_as_fire', values: [[8, 12]] }, { mod: 'fire_res', values: [[20, 30]] }],
    flavour: 'It beats still, long after its owner stopped.',
  },
  {
    id: 'wyrmfang', name: 'Wyrmfang', base: 'bow_2',
    mods: [{ mod: 'local_phys_inc', values: [[100, 140]] }, { mod: 'local_phys_added', values: [[5, 10], [15, 25]] }, { mod: 'u_extra_projectile', values: [[1, 1]] }, { mod: 'local_attack_speed', values: [[8, 12]] }],
    flavour: 'Carved from the jaw of a sky-serpent, it still hungers.',
  },
  {
    id: 'stormcaller', name: "Stormcaller's Rod", base: 'sceptre_1',
    mods: [{ mod: 'spell_lightning_added', values: [[1, 3], [40, 55]] }, { mod: 'cast_speed', values: [[15, 20]] }, { mod: 'shock_chance', values: [[20, 20]] }, { mod: 'int', values: [[20, 30]] }],
    flavour: 'Raise it high, and the heavens answer.',
  },
  {
    id: 'bloodthirst', name: 'Bloodthirst', base: 'two_hand_axe_2',
    mods: [{ mod: 'local_phys_inc', values: [[150, 190]] }, { mod: 'u_life_leech', values: [[1, 1.5]] }, { mod: 'local_attack_speed', values: [[10, 15]] }, { mod: 'str', values: [[25, 35]] }],
    flavour: 'It does not care whose blood, only that it flows.',
  },
  {
    id: 'frostbound', name: 'Frostbound Heart', base: 'amulet_lapis', level: 24,
    mods: [{ mod: 'cold_damage', values: [[25, 35]] }, { mod: 'freeze_chance', values: [[15, 15]] }, { mod: 'cold_res', values: [[30, 35]] }, { mod: 'int', values: [[20, 30]] }],
    flavour: 'Some hearts are colder than the grave.',
  },
  {
    id: 'thornback', name: 'Thornback Plate', base: 'body_armour_str_2',
    mods: [{ mod: 'local_armour_inc', values: [[150, 200]] }, { mod: 'life', values: [[60, 80]] }, { mod: 'u_block', values: [[5, 5]] }, { mod: 'u_phys_reduction', values: [[5, 8]] }],
    flavour: 'Strike me, and bleed for it.',
  },
  {
    id: 'veil_whispers', name: 'Veil of Whispers', base: 'gloves_dex_int_1',
    mods: [{ mod: 'attack_speed', values: [[10, 15]] }, { mod: 'crit_chance', values: [[25, 35]] }, { mod: 'u_life_on_hit', values: [[3, 5]] }, { mod: 'dex', values: [[25, 30]] }],
    flavour: 'The last thing they hear is nothing at all.',
  },
  {
    id: 'unbroken_oath', name: 'The Unbroken Oath', base: 'shield_str_int_2',
    mods: [{ mod: 'local_block', values: [[6, 8]] }, { mod: 'all_res', values: [[12, 16]] }, { mod: 'life', values: [[50, 70]] }, { mod: 'local_aes_inc', values: [[60, 80]] }],
    flavour: 'A promise kept is a wall unbreached.',
  },
  {
    id: 'keeper_ashes', name: 'Keeper of Ashes', base: 'staff_2',
    mods: [{ mod: 'spell_damage', values: [[60, 80]] }, { mod: 'fire_damage', values: [[40, 50]] }, { mod: 'ignite_chance', values: [[20, 20]] }, { mod: 'u_burning', values: [[40, 50]] }],
    flavour: 'All things return to ash. It merely hastens them.',
  },
  {
    id: 'glass_fang', name: 'Glass Fang', base: 'dagger_1',
    mods: [{ mod: 'local_crit', values: [[60, 80]] }, { mod: 'crit_multi', values: [[40, 50]] }, { mod: 'local_lightning_added', values: [[3, 5], [30, 40]] }, { mod: 'spell_damage', values: [[40, 50]] }],
    flavour: 'Fragile, like the lives it ends.',
  },
  {
    id: 'voidsilk', name: 'Voidsilk Vestments', base: 'body_armour_int_3',
    mods: [{ mod: 'local_es_inc', values: [[180, 220]] }, { mod: 'local_es', values: [[60, 80]] }, { mod: 'int', values: [[30, 40]] }, { mod: 'u_hollow_vessel', values: [] }],
    flavour: 'Empty the vessel, and the void fills it.',
  },
  {
    id: 'mirebound', name: 'Mirebound Girdle', base: 'belt_leather',
    mods: [{ mod: 'life', values: [[40, 60]] }, { mod: 'str', values: [[25, 35]] }, { mod: 'flask_charges_gained', values: [[20, 30]] }, { mod: 'u_flask_duration', values: [[15, 20]] }],
    flavour: 'Dredged from the swamp, still heavy with its gifts.',
  },
  {
    id: 'hollow_king', name: 'Crown of the Hollow King', base: 'helmet_str_int_2',
    mods: [{ mod: 'socketed_gem_level', values: [[1, 1]] }, { mod: 'local_es', values: [[50, 70]] }, { mod: 'all_attributes', values: [[20, 30]] }, { mod: 'mana_regen', values: [[20, 30]] }],
    flavour: 'He ruled nothing, and so nothing could be taken.',
  },
  {
    id: 'shadowmantle', name: 'Shadowmantle', base: 'body_armour_dex_int_2',
    mods: [{ mod: 'local_ees_inc', values: [[120, 160]] }, { mod: 'dex', values: [[30, 40]] }, { mod: 'life', values: [[40, 60]] }, { mod: 'u_phantom_step', values: [] }],
    flavour: 'Where it passes, blades find only air.',
  },
  {
    id: 'tidebreaker', name: 'Tidebreaker', base: 'two_hand_mace_1',
    mods: [{ mod: 'local_phys_inc', values: [[120, 160]] }, { mod: 'local_cold_added', values: [[8, 12], [18, 26]] }, { mod: 'u_phys_as_cold', values: [[15, 20]] }, { mod: 'u_aoe', values: [[15, 25]] }],
    flavour: 'The sea does not stop. Neither does its hammer.',
  },
  {
    id: 'bone_herald', name: 'Bone Herald', base: 'wand_1',
    mods: [{ mod: 'minion_damage', values: [[30, 40]] }, { mod: 'u_minion_life', values: [[20, 30]] }, { mod: 'u_minion_count', values: [[1, 1]] }, { mod: 'int', values: [[15, 25]] }],
    flavour: 'The dead remember whoever calls them first.',
  },
  {
    id: 'quill_of_ruin', name: 'Quill of Ruin', base: 'quiver_barbed',
    mods: [{ mod: 'u_pierce', values: [[2, 2]] }, { mod: 'crit_multi', values: [[20, 30]] }, { mod: 'life', values: [[40, 60]] }, { mod: 'u_close_quarters', values: [] }],
    flavour: 'Close enough to see their eyes. Close enough to end them.',
  },
];

export const UNIQUE_BY_ID: Record<string, UniqueDef> = Object.fromEntries(UNIQUES.map((u) => [u.id, u]));
