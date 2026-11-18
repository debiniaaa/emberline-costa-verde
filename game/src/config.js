// EMBERLINE: Costa Verde — config.js
// One job: every tunable number, palette, story line and mission definition.
// Nothing here touches the scene; other modules read these constants.

export const SAVE_KEY = 'emberline-costa-verde-save-v1';

export const WORLD = {
  size: 720,            // playable square, metres, centred on origin
  roadGap: 80,          // distance between parallel streets
  roadWidth: 12,
  sidewalk: 3,
  beachZ: 300,          // south of this line: sand, then ocean
  oceanZ: 340,
  blockInset: 10,       // buildings keep this far inside a block
};

export const PALETTE = {
  skyTop: 0x2e4a7a,
  skyHorizon: 0xff9a5c,
  fog: 0xe88a5a,
  sun: 0xffd27a,
  ocean: 0x1d6f8e,
  sand: 0xe8c98f,
  asphalt: 0x2b2b30,
  sidewalk: 0x8a8578,
  building: [0xd8b48f, 0xc98f6b, 0x9fb4c7, 0xe0d3b8, 0xb98a7a, 0x7fa08a, 0xd9a066, 0xa8a0b8],
  glass: 0x2c3e55,
  car: [0xc23b2e, 0x2e6fc2, 0xe8c33a, 0x3aa655, 0xe8e8e8, 0x222226, 0x7a4fc2, 0xe07b2e],
  pedShirt: [0xd94f4f, 0x4f7fd9, 0x54b06a, 0xe0b13c, 0x9b59d0, 0xdddddd, 0x333333],
};

export const PLAYER = {
  walkSpeed: 7,
  sprintSpeed: 11,
  jumpSpeed: 8,
  gravity: 22,
  health: 100,
  pistolDamage: 34,
  pistolAmmo: 12,
  punchDamage: 12,
  punchRange: 2.2,
  shootRange: 90,
};

export const CAR = {
  accel: 26,
  brake: 42,
  reverseAccel: 14,
  maxSpeed: 42,
  maxReverse: 12,
  steer: 0.55,
  grip: 6.5,
  drag: 0.35,
};

export const WANTED = {
  decayDelay: 14,      // seconds of no crime before stars start falling
  decayStep: 9,         // seconds per star lost while hidden
  bustSeconds: 2.6,     // police close + player slow this long = busted
  bustRange: 8,
  maxPoliceCars: 6,
  heliAtStars: 3,
};

// The story of Costa Verde. All names, places and people are original.
export const STORY = {
  city: 'Costa Verde',
  hero: 'Marina Sol',
  fixer: 'Rico Vega',
  rival: 'Don Esteban Marlow',
  intro: 'Marina Sol came back to Costa Verde with a stolen sedan, a dead phone and one name on a list: the man who burned her brother\'s garage. Rico Vega has the jobs. The city has the rest.',
};

export const DIALOGUE = {
  m1: [
    ['RICO VEGA', 'Marina. You made it back. The garage job pays if you can drive.'],
    ['MARINA SOL', 'I can drive. What do you need?'],
    ['RICO VEGA', 'A ride. Any car on this street — take it, bring it to my garage. No cops, no dents.'],
  ],
  m2: [
    ['RICO VEGA', 'Three packages, three corners of the city. The buyers do not wait.'],
    ['MARINA SOL', 'Clock\'s ticking. I\'m on it.'],
  ],
  m3: [
    ['RICO VEGA', 'I lifted a till from Marlow\'s boys. They are coming for me. Get me out — and lose the tail.'],
    ['MARINA SOL', 'Get in. And keep your head down.'],
  ],
  m4: [
    ['RICO VEGA', 'Marlow\'s shops pay him protection money. Lean on three of them. They will see sense.'],
    ['MARINA SOL', 'A friendly chat. With my fists.'],
  ],
  m5: [
    ['RICO VEGA', 'A truck full of Marlow\'s hardware sits at the docks. Take it. His guards will object.'],
    ['MARINA SOL', 'Then they can object to my pistol.'],
  ],
  m6: [
    ['RICO VEGA', 'Marlow\'s courier is running the coast road with a briefcase. Stop that car. Bring me the case.'],
    ['MARINA SOL', 'One car, one case. Easy.'],
  ],
  m7: [
    ['RICO VEGA', 'The informant is meeting us at the plaza. Marlow\'s hitters will be there first. Keep him alive.'],
    ['MARINA SOL', 'Nobody dies on my watch tonight.'],
  ],
  m8: [
    ['RICO VEGA', 'This is it. Marlow\'s compound, the marina. Burn his ledger, take his money, and get out before the whole city wakes up.'],
    ['MARINA SOL', 'For my brother. For the garage. Tonight it ends.'],
  ],
};

// Mission definitions. Stage types:
//  goto: reach a marker | enterCar: get in any car | stealCar: take the marked car
//  driveTo: reach a marker while driving | deliver: reach markers in order (timer)
//  intimidate: punch/shoot near marked NPCs | kill: eliminate N armed enemies
//  tail: ram the marked car until it stops | survive: lose your wanted level
//  plant: stand at the marker for some seconds | pickup: grab the marked item
export const MISSIONS = [
  {
    id: 1, title: 'First Wheels', giver: 'Rico Vega', reward: 500,
    brief: 'Steal any car on the street and bring it to Rico\'s garage.',
    stages: [
      { type: 'stealCar', text: 'Steal a car (walk up and press E)' },
      { type: 'driveTo', x: -120, z: -80, radius: 9, text: 'Drive to Rico\'s garage' },
    ],
  },
  {
    id: 2, title: 'Courier Run', giver: 'Rico Vega', reward: 800, timer: 150,
    brief: 'Deliver three packages across Costa Verde before the clock runs out.',
    stages: [
      { type: 'deliver', x: 160, z: 120, radius: 8, text: 'Deliver package 1/3 — Palm Court' },
      { type: 'deliver', x: -200, z: 160, radius: 8, text: 'Deliver package 2/3 — West Marina' },
      { type: 'deliver', x: 40, z: -240, radius: 8, text: 'Deliver package 3/3 — North Gate' },
    ],
  },
  {
    id: 3, title: 'Getaway Driver', giver: 'Rico Vega', reward: 1200,
    brief: 'Pick Rico up outside the bank, then lose the police and reach the safehouse.',
    stages: [
      { type: 'goto', x: 80, z: 40, radius: 8, text: 'Pick Rico up at the bank' },
      { type: 'survive', text: 'Lose the wanted level' },
      { type: 'driveTo', x: -240, z: -200, radius: 10, text: 'Reach the safehouse' },
    ],
  },
  {
    id: 4, title: 'The Shakedown', giver: 'Rico Vega', reward: 1000,
    brief: 'Lean on three of Marlow\'s shopkeepers until they pay up.',
    stages: [
      { type: 'intimidate', count: 3, text: 'Intimidate shopkeepers (0/3) — punch or shoot near them' },
    ],
  },
  {
    id: 5, title: 'Harbor Heist Setup', giver: 'Rico Vega', reward: 1500,
    brief: 'Steal the hardware truck from the docks and fight past the guards.',
    stages: [
      { type: 'kill', count: 4, text: 'Deal with the dock guards (0/4)' },
      { type: 'stealCar', truck: true, text: 'Steal the hardware truck' },
      { type: 'driveTo', x: -120, z: -80, radius: 10, text: 'Deliver the truck to Rico\'s garage' },
    ],
  },
  {
    id: 6, title: 'High-Speed Chase', giver: 'Rico Vega', reward: 1800,
    brief: 'Run Marlow\'s courier off the coast road and take the briefcase.',
    stages: [
      { type: 'tail', text: 'Ram the courier\'s car until it stops' },
      { type: 'pickup', text: 'Grab the briefcase' },
      { type: 'driveTo', x: -120, z: -80, radius: 10, text: 'Bring the briefcase to Rico\'s garage' },
    ],
  },
  {
    id: 7, title: 'The Informant', giver: 'Rico Vega', reward: 2000,
    brief: 'Protect the informant at the plaza while Marlow\'s hitters close in.',
    stages: [
      { type: 'goto', x: 0, z: 0, radius: 10, text: 'Meet the informant at Sol Plaza' },
      { type: 'kill', count: 6, waves: 2, text: 'Protect the informant — stop the hitters (0/6)' },
    ],
  },
  {
    id: 8, title: 'Emberline Finale', giver: 'Rico Vega', reward: 5000,
    brief: 'Hit Marlow\'s compound at the marina, burn the ledger, and escape the city.',
    stages: [
      { type: 'kill', count: 8, waves: 3, text: 'Clear the compound guards (0/8)' },
      { type: 'plant', seconds: 6, x: 240, z: 240, radius: 8, text: 'Plant the charges on the ledger vault' },
      { type: 'survive', text: 'Escape — lose the 5-star wanted level' },
    ],
  },
];

export const SIDE_JOBS = {
  taxi: { fare: 150, text: 'Taxi fare — drive the passenger to the marker' },
  courier: { fare: 200, text: 'Courier drop — deliver the parcel' },
};

export const SHOPS = [
  { x: -40, z: 0, kind: 'ammo', label: 'IRONWORKS ARMS — ammo $100' },
  { x: 120, z: -160, kind: 'health', label: 'SOL CLINIC — heal $100' },
];

// Deterministic RNG so the city is identical on every load.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
