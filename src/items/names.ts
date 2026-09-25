import type { RNG } from '../core/rng';
import type { ItemClass } from './types';

/** Random rare item names: "<Prefix word> <class-flavoured suffix word>". */

const FIRST = [
  'Agony', 'Apocalypse', 'Ashen', 'Beast', 'Behemoth', 'Blight', 'Blood', 'Bramble', 'Brimstone', 'Brood', 'Carrion',
  'Cataclysm', 'Chimeric', 'Corpse', 'Corruption', 'Damnation', 'Death', 'Demon', 'Dire', 'Dragon', 'Dread', 'Doom',
  'Dusk', 'Eagle', 'Ember', 'Empyrean', 'Fate', 'Foe', 'Gale', 'Ghoul', 'Gloom', 'Glyph', 'Golem', 'Grim', 'Hate',
  'Havoc', 'Honour', 'Horror', 'Hypnotic', 'Kraken', 'Loath', 'Maelstrom', 'Mind', 'Miracle', 'Morbid', 'Oblivion',
  'Onslaught', 'Pain', 'Pandemonium', 'Phoenix', 'Plague', 'Rage', 'Rapture', 'Raven', 'Rune', 'Skull', 'Sol', 'Soul',
  'Sorrow', 'Spirit', 'Storm', 'Tempest', 'Thunder', 'Torment', 'Vengeance', 'Victory', 'Viper', 'Vortex', 'Woe', 'Wrath',
];

const SECOND: Partial<Record<ItemClass, string[]>> = {
  helmet: ['Brow', 'Corona', 'Crest', 'Crown', 'Veil', 'Visor', 'Horn', 'Dome', 'Cowl', 'Glance'],
  body_armour: ['Carapace', 'Coat', 'Hide', 'Husk', 'Shell', 'Pelt', 'Mantle', 'Wrap', 'Skin', 'Cloak', 'Jack', 'Vest'],
  gloves: ['Grasp', 'Grip', 'Hand', 'Fist', 'Touch', 'Clutches', 'Palm', 'Mitts', 'Talons', 'Paw'],
  boots: ['Trail', 'Stride', 'Tread', 'Spur', 'March', 'Road', 'Track', 'Pace', 'Slippers', 'Walk'],
  shield: ['Aegis', 'Bulwark', 'Guard', 'Ward', 'Tower', 'Wall', 'Emblem', 'Badge', 'Watch', 'Refuge'],
  one_hand_sword: ['Bane', 'Edge', 'Fang', 'Razor', 'Song', 'Skewer', 'Slicer', 'Spike', 'Blade'],
  two_hand_sword: ['Bane', 'Edge', 'Fang', 'Razor', 'Song', 'Skewer', 'Slicer', 'Spike', 'Blade'],
  one_hand_axe: ['Bite', 'Cleaver', 'Edge', 'Reaver', 'Splitter', 'Hunger', 'Sever'],
  two_hand_axe: ['Bite', 'Cleaver', 'Edge', 'Reaver', 'Splitter', 'Hunger', 'Sever'],
  one_hand_mace: ['Bash', 'Blast', 'Brand', 'Crusher', 'Mallet', 'Knell', 'Batter', 'Wreck'],
  two_hand_mace: ['Bash', 'Blast', 'Brand', 'Crusher', 'Mallet', 'Knell', 'Batter', 'Wreck'],
  sceptre: ['Call', 'Chant', 'Hymn', 'Rod', 'Song', 'Cane', 'Scepter', 'Heart'],
  bow: ['Arc', 'Branch', 'Fling', 'Guardian', 'Mark', 'Stinger', 'Siege', 'Thunder', 'Strike'],
  wand: ['Branch', 'Cry', 'Needle', 'Spire', 'Stinger', 'Song', 'Charm', 'Bite'],
  staff: ['Beam', 'Branch', 'Pillar', 'Pole', 'Spire', 'Weaver', 'Goad', 'Call'],
  dagger: ['Barb', 'Etcher', 'Fang', 'Needle', 'Stinger', 'Point', 'Pricker', 'Slicer'],
  claw: ['Fang', 'Hook', 'Talon', 'Rake', 'Scratch', 'Gutter', 'Ripper', 'Grasp'],
  ring: ['Band', 'Circle', 'Coil', 'Knot', 'Loop', 'Spiral', 'Turn', 'Whorl', 'Eye'],
  amulet: ['Beads', 'Charm', 'Choker', 'Collar', 'Heart', 'Idol', 'Locket', 'Pendant', 'Talisman', 'Torc'],
  belt: ['Bind', 'Buckle', 'Clasp', 'Cord', 'Lash', 'Strap', 'Tether', 'Girdle', 'Belt'],
  quiver: ['Arrow', 'Barb', 'Bite', 'Bolt', 'Dart', 'Flight', 'Hail', 'Point', 'Sliver', 'Thirst'],
  map: ['Sanctum', 'Hollow', 'Reach', 'Depths', 'Spire', 'Wastes', 'Vault', 'Mire'],
};

export function rareName(rng: RNG, cls: ItemClass): string {
  const second = SECOND[cls] ?? ['Relic', 'Charm', 'Token'];
  return `${rng.pick(FIRST)} ${rng.pick(second)}`;
}

const MONSTER_A = ['Gore', 'Blood', 'Rot', 'Grim', 'Ash', 'Bone', 'Dread', 'Night', 'Bile', 'Fester', 'Skull', 'Storm', 'Frost', 'Venom', 'Soot', 'Carrion'];
const MONSTER_B = ['maw', 'fang', 'gut', 'claw', 'hide', 'spine', 'eye', 'tooth', 'belly', 'grin', 'heart', 'howl', 'shriek', 'wing'];
const MONSTER_C = ['the Wretched', 'the Hungering', 'the Defiler', 'the Unyielding', 'the Rotten', 'the Cruel', 'the Vile', 'the Ravenous', 'the Blighted', 'the Accursed'];

export function rareMonsterName(rng: RNG): string {
  return `${rng.pick(MONSTER_A)}${rng.pick(MONSTER_B)} ${rng.pick(MONSTER_C)}`;
}
