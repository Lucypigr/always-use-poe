/**
 * Stat & modifier engine.
 *
 * Every source of power in the game (item affixes, passives, gems, auras, flasks,
 * monster mods) is expressed as a list of StatMods. A StatSheet aggregates them and
 * answers queries using Path of Exile style math:
 *
 *   final = (base + Σflat) × (1 + Σincreased/100) × Π(1 + more/100)
 *
 * "increased"/"reduced" modifiers are additive with each other, "more"/"less"
 * modifiers are multiplicative with each other.
 */

export const DAMAGE_TYPES = ['phys', 'fire', 'cold', 'lightning', 'chaos'] as const;
export type DamageType = (typeof DAMAGE_TYPES)[number];
export const ELEMENTS = ['fire', 'cold', 'lightning'] as const;
export type Element = (typeof ELEMENTS)[number];

export type StatKey =
  // attributes
  | 'str' | 'dex' | 'int' | 'all_attributes'
  // pools
  | 'life' | 'mana' | 'energy_shield' | 'life_regen' | 'life_regen_pct' | 'mana_regen' | 'es_recharge'
  | 'es_recharge_delay'
  // defences
  | 'armour' | 'evasion' | 'block' | 'defences' | 'phys_damage_reduction' | 'damage_taken'
  | 'fire_res' | 'cold_res' | 'lightning_res' | 'chaos_res' | 'all_ele_res'
  | 'max_fire_res' | 'max_cold_res' | 'max_lightning_res' | 'max_all_ele_res'
  // generic damage scaling (used with "inc" and "more")
  | 'damage' | 'phys_damage' | 'fire_damage' | 'cold_damage' | 'lightning_damage' | 'chaos_damage'
  | 'elemental_damage' | 'spell_damage' | 'attack_damage' | 'melee_damage' | 'projectile_damage'
  | 'area_damage' | 'dot_damage' | 'burning_damage' | 'bleed_damage' | 'poison_damage' | 'minion_damage'
  | 'damage_vs_chilled' | 'damage_vs_ailing' | 'two_handed_damage' | 'bow_damage' | 'wand_damage' | 'melee_phys_damage'
  // flat added damage to attacks / spells
  | 'attack_phys_min' | 'attack_phys_max' | 'attack_fire_min' | 'attack_fire_max'
  | 'attack_cold_min' | 'attack_cold_max' | 'attack_lightning_min' | 'attack_lightning_max'
  | 'attack_chaos_min' | 'attack_chaos_max'
  | 'spell_phys_min' | 'spell_phys_max' | 'spell_fire_min' | 'spell_fire_max'
  | 'spell_cold_min' | 'spell_cold_max' | 'spell_lightning_min' | 'spell_lightning_max'
  | 'spell_chaos_min' | 'spell_chaos_max'
  // damage gained as extra
  | 'phys_as_extra_fire' | 'phys_as_extra_cold' | 'phys_as_extra_lightning' | 'phys_as_extra_chaos'
  | 'ele_as_extra_chaos' | 'phys_to_fire' | 'phys_to_cold' | 'phys_to_lightning' | 'phys_to_chaos'
  // speed
  | 'attack_speed' | 'cast_speed' | 'movement_speed' | 'projectile_speed' | 'skill_duration'
  // crit & accuracy
  | 'crit_chance' | 'spell_crit_chance' | 'crit_multi' | 'accuracy' | 'base_crit_flat'
  // leech / on-hit / on-kill
  | 'life_leech' | 'mana_leech' | 'life_on_hit' | 'life_on_kill' | 'mana_on_kill' | 'es_on_kill'
  // skill modifiers
  | 'area_of_effect' | 'additional_projectiles' | 'pierce' | 'chain' | 'fork' | 'repeats'
  | 'mana_cost' | 'reservation' | 'culling_strike' | 'knockback' | 'spell_gem_level' | 'gem_level'
  // ailments
  | 'ignite_chance' | 'freeze_chance' | 'shock_chance' | 'bleed_chance' | 'poison_chance'
  | 'ailment_duration' | 'chill_effect' | 'shock_effect' | 'cannot_ailment'
  | 'fire_pen' | 'cold_pen' | 'lightning_pen'
  // loot & misc
  | 'item_rarity' | 'item_quantity' | 'flask_charges' | 'flask_recovery' | 'flask_effect' | 'flask_duration'
  | 'light_radius' | 'stun_immune' | 'onslaught' | 'splash' | 'minion_life' | 'minion_count' | 'minion_speed'
  | 'monster_life' | 'monster_damage' | 'monster_speed' | 'pack_size'
  // keystone flags
  | 'ks_blood_pact' | 'ks_unerring' | 'ks_hollow_vessel' | 'ks_ironclad' | 'ks_phantom_step'
  | 'ks_arcane_ward' | 'ks_close_quarters' | 'ks_elemental_overload' | 'ks_wrath_of_ages'
  | 'headhunter'
  // item-local stats (never applied to the character directly)
  | 'local_phys_min' | 'local_phys_max' | 'local_phys_inc' | 'local_fire_min' | 'local_fire_max'
  | 'local_cold_min' | 'local_cold_max' | 'local_lightning_min' | 'local_lightning_max'
  | 'local_chaos_min' | 'local_chaos_max' | 'local_attack_speed' | 'local_crit' | 'local_accuracy'
  | 'local_armour' | 'local_armour_inc' | 'local_evasion' | 'local_evasion_inc' | 'local_es' | 'local_es_inc'
  | 'local_def_inc' | 'local_block' | 'socketed_gem_level' | 'local_life_leech'
  // flask-local
  | 'flask_local_amount' | 'flask_local_instant' | 'flask_local_charges' | 'flask_local_charge_use'
  | 'flask_local_duration' | 'flask_local_speed' | 'flask_local_bleed_immune' | 'flask_local_freeze_immune'
  | 'flask_local_armour' | 'flask_local_evasion' | 'flask_local_move';

export type ModKind = 'flat' | 'inc' | 'more' | 'flag';

export interface StatMod {
  stat: StatKey;
  kind: ModKind;
  value: number;
}

export const flat = (stat: StatKey, value: number): StatMod => ({ stat, kind: 'flat', value });
export const inc = (stat: StatKey, value: number): StatMod => ({ stat, kind: 'inc', value });
export const more = (stat: StatKey, value: number): StatMod => ({ stat, kind: 'more', value });
export const flag = (stat: StatKey): StatMod => ({ stat, kind: 'flag', value: 1 });

export const isLocalStat = (s: StatKey): boolean => s.startsWith('local_') || s.startsWith('flask_local_') || s === 'socketed_gem_level';

export class StatSheet {
  private flats = new Map<StatKey, number>();
  private incs = new Map<StatKey, number>();
  private mores = new Map<StatKey, number>();
  private flags = new Set<StatKey>();

  constructor(mods: readonly StatMod[] = []) {
    this.addAll(mods);
  }

  add(m: StatMod): this {
    switch (m.kind) {
      case 'flat':
        this.flats.set(m.stat, (this.flats.get(m.stat) ?? 0) + m.value);
        break;
      case 'inc':
        this.incs.set(m.stat, (this.incs.get(m.stat) ?? 0) + m.value);
        break;
      case 'more':
        this.mores.set(m.stat, (this.mores.get(m.stat) ?? 1) * (1 + m.value / 100));
        break;
      case 'flag':
        this.flags.add(m.stat);
        break;
    }
    return this;
  }

  addAll(mods: readonly StatMod[]): this {
    for (const m of mods) this.add(m);
    return this;
  }

  clone(): StatSheet {
    const s = new StatSheet();
    s.flats = new Map(this.flats);
    s.incs = new Map(this.incs);
    s.mores = new Map(this.mores);
    s.flags = new Set(this.flags);
    return s;
  }

  flat(stat: StatKey): number {
    return this.flats.get(stat) ?? 0;
  }

  /** Sum of increased/reduced (as a percentage) across all given stats. */
  inc(...stats: StatKey[]): number {
    let t = 0;
    for (const s of stats) t += this.incs.get(s) ?? 0;
    return t;
  }

  /** Product of more/less multipliers across the given stats (1 = no change). */
  more(...stats: StatKey[]): number {
    let t = 1;
    for (const s of stats) t *= this.mores.get(s) ?? 1;
    return t;
  }

  has(stat: StatKey): boolean {
    return this.flags.has(stat);
  }

  /** Full PoE-style evaluation of a stat. */
  calc(stat: StatKey, base = 0, incStats: StatKey[] = [stat], moreStats: StatKey[] = [stat]): number {
    const total = base + this.flat(stat);
    return total * Math.max(0, 1 + this.inc(...incStats) / 100) * this.more(...moreStats);
  }

  /** Debug/inspection helper: every stat touched by this sheet. */
  entries(): { stat: StatKey; flat: number; inc: number; more: number; flag: boolean }[] {
    const keys = new Set<StatKey>([...this.flats.keys(), ...this.incs.keys(), ...this.mores.keys(), ...this.flags]);
    return [...keys].map((k) => ({
      stat: k,
      flat: this.flat(k),
      inc: this.inc(k),
      more: this.more(k),
      flag: this.flags.has(k),
    }));
  }
}
