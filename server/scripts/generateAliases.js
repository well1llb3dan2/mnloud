import mongoose from 'mongoose';
import config from '../src/config/index.js';

const aliasRules = [
  {
    name: 'zkittlez/skittles variants',
    variants: ['zkittlez', 'zkittles', 'zkittle', 'skittlez', 'skittles', 'skittle'],
  },
  {
    name: 'cookies/cookie',
    variants: ['cookies', 'cookie'],
  },
  {
    name: 'chemdog/chemdawg',
    variants: ['chemdog', 'chemdawg', 'chem dawg', 'chem dog'],
  },
  {
    name: 'girl scout cookies variants',
    variants: ['girl scout cookies', 'girl scouts', 'gsc', 'gs cookies'],
  },
  {
    name: 'gorilla glue #4 variants',
    variants: ['gorilla glue', 'gg4', 'gg#4', 'original glue'],
  },
  {
    name: 'sour diesel variants',
    variants: ['sour diesel', 'sour d', 'sour diesle'],
  },
  {
    name: 'white widow variants',
    variants: ['white widow', 'ww'],
  },
  {
    name: 'northern lights variants',
    variants: ['northern lights', 'nl'],
  },
  {
    name: 'blue dream variants',
    variants: ['blue dream', 'bd'],
  },
  {
    name: 'granddaddy purple variants',
    variants: ['granddaddy purple', 'granddaddy purp', 'granddaddy', 'gdp'],
  },
  {
    name: 'og kush variants',
    variants: ['og kush', 'ogk', 'o.g. kush', 'og'],
  },
  {
    name: 'wedding cake variants',
    variants: ['wedding cake', 'pink cookies'],
  },
  {
    name: 'do si dos variants',
    variants: ['do si dos', 'dosi dos', 'do si do', 'dosi'],
  },
  {
    name: 'zkittlez x gelato variants',
    variants: ['gelato', 'gelato 33', 'gelato #33'],
  },
  {
    name: 'runtz variants',
    variants: ['runtz', 'runtz OG', 'runtz og', 'rainbow runtz'],
  },
  {
    name: 'kush mints variants',
    variants: ['kush mints', 'km', 'kushmint'],
  },
  {
    name: 'mac variants',
    variants: ['miracle alien cookies', 'mac', 'mac 1', 'mac#1'],
  },
  {
    name: 'gelato x kush hybrids shorthand',
    variants: ['gelato', 'gelat0'],
  },
  {
    name: 'purple punch variants',
    variants: ['purple punch', 'pp'],
  },
  {
    name: 'tahoe og variants',
    variants: ['tahoe og', 'tahoe'],
  },
  {
    name: 'trainwreck variants',
    variants: ['trainwreck', 'train wreck'],
  },
  {
    name: 'ak-47 variants',
    variants: ['ak-47', 'ak47'],
  },
  {
    name: 'pineapple express variants',
    variants: ['pineapple express', 'pineapple xpress', 'pineapple xp'],
  },
  {
    name: 'jack herer variants',
    variants: ['jack herer', 'jack'],
  },
  {
    name: 'london pound cake variants',
    variants: ['london pound cake', 'lpc'],
  },
  {
    name: 'oreoz variants',
    variants: ['oreoz', 'oreos'],
  },
  {
    name: 'strawberry cough variants',
    variants: ['strawberry cough', 'strawberry', 'strawb cough'],
  },
  {
    name: 'gelato cake variants',
    variants: ['gelato cake', 'gelato cak3'],
  },
  {
    name: 'blueberry variants',
    variants: ['blueberry', 'blue berry', 'bb'],
  },
  {
    name: 'lilac diesel variants',
    variants: ['lilac diesel', 'lilac'],
  },
  {
    name: 'banana og variants',
    variants: ['banana og', 'banana o.g.'],
  },
  {
    name: 'purple haze variants',
    variants: ['purple haze', 'purp haze'],
  },
  {
    name: 'sunset sherbet variants',
    variants: ['sunset sherbet', 'sherbet', 'sherb', 'sherbert'],
  },
  {
    name: 'cereal milk variants',
    variants: ['cereal milk', 'cerealmilk'],
  },
  {
    name: 'slurricane variants',
    variants: ['slurricane', 'sluricane'],
  },
  {
    name: 'zkittlez x runtz variants',
    variants: ['zkittlez', 'skittles', 'runtz'],
  },
  {
    name: 'triangle kush variants',
    variants: ['triangle kush', 'triangle', 'tk'],
  },
  {
    name: 'gelato 41 variants',
    variants: ['gelato 41', 'gelato #41'],
  },
  {
    name: 'gelato 45 variants',
    variants: ['gelato 45', 'gelato #45'],
  },
  {
    name: 'haze variants',
    variants: ['haze', 'hazey'],
  },
  {
    name: 'ice cream cake variants',
    variants: ['ice cream cake', 'icc'],
  },
  {
    name: 'biscotti variants',
    variants: ['biscotti', 'biscotti og'],
  },
  {
    name: 'gary payton variants',
    variants: ['gary payton', 'gp'],
  },
  {
    name: 'lemon cherry gelato variants',
    variants: ['lemon cherry gelato', 'lcg'],
  },
  {
    name: 'gelato variants',
    variants: ['gelato', 'gelato 33', 'gelato #33', 'gelato 41', 'gelato #41', 'gelato 45', 'gelato #45'],
  },
  {
    name: 'sunset sherbet variants',
    variants: ['sunset sherbet', 'sherbet', 'sherb', 'sherbert'],
  },
  {
    name: 'sundae driver variants',
    variants: ['sundae driver', 'sundae'],
  },
  {
    name: 'apple fritter variants',
    variants: ['apple fritter', 'applefritter'],
  },
  {
    name: 'gmo variants',
    variants: ['gmo', 'garlic cookies', 'gmo cookies'],
  },
  {
    name: 'skywalker og variants',
    variants: ['skywalker og', 'skywalker'],
  },
  {
    name: 'sfv og variants',
    variants: ['sfv og', 'sfv'],
  },
  {
    name: 'la confidential variants',
    variants: ['la confidential', 'l.a. confidential', 'la conf'],
  },
  {
    name: 'pound cake variants',
    variants: ['pound cake', 'london pound cake', 'lpc'],
  },
  {
    name: 'kush family variants',
    variants: ['kush', 'og', 'og kush', 'sfv og', 'tahoe og', 'skywalker og'],
  },
  {
    name: 'death star variants',
    variants: ['death star', 'deathstar'],
  },
  {
    name: 'apple fritter variants',
    variants: ['apple fritter', 'applefritter'],
  },
  {
    name: 'zkittlez x gelato shorthand',
    variants: ['zkittlez', 'skittles', 'gelato'],
  },
];

const normalize = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const normalizeKey = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');

const extractName = (doc) =>
  doc?.name || doc?.strain || doc?.strainName || doc?.title || doc?.displayName || doc?.label || '';

const tokenize = (value) => normalize(value).split(/\s+/).filter(Boolean);

const addAliasVariants = (name, aliases) => {
  const tokens = tokenize(name);
  if (!tokens.length) return aliases;

  aliasRules.forEach((rule) => {
    const matched = rule.variants.find((variant) => tokens.includes(normalize(variant)));
    if (matched) {
      rule.variants.forEach((variant) => {
        if (normalizeKey(variant) !== normalizeKey(name)) {
          aliases.add(variant);
        }
      });
    }
  });

  return aliases;
};

const buildAliasesForDoc = (doc) => {
  const name = extractName(doc);
  const aliases = new Set(Array.isArray(doc.aliases) ? doc.aliases : doc.aliases ? [doc.aliases] : []);

  addAliasVariants(name, aliases);

  return [...aliases]
    .map((alias) => alias.trim())
    .filter(Boolean)
    .filter((alias) => normalizeKey(alias) !== normalizeKey(name));
};

const run = async () => {
  const apply = process.argv.includes('--apply');
  const limitArg = process.argv.find((arg) => arg.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : null;

  const conn = await mongoose.createConnection(config.strains.uri).asPromise();
  const collections = await conn.db.listCollections().toArray();
  const preferred = collections.find((col) => col.name?.toLowerCase() === 'strains');
  const collectionName = (preferred || collections[0])?.name;

  if (!collectionName) {
    console.error('No strains collection found.');
    process.exit(1);
  }

  const cursor = conn.db.collection(collectionName).find({});
  if (limit && Number.isFinite(limit)) cursor.limit(limit);
  const docs = await cursor.toArray();

  let updated = 0;
  for (const doc of docs) {
    const aliases = buildAliasesForDoc(doc);
    const current = Array.isArray(doc.aliases) ? doc.aliases : doc.aliases ? [doc.aliases] : [];

    const next = Array.from(new Set([...current, ...aliases]));
    if (next.length !== current.length) {
      updated += 1;
      if (apply) {
        await conn.db
          .collection(collectionName)
          .updateOne({ _id: doc._id }, { $set: { aliases: next } });
      }
    }
  }

  console.log(`${apply ? 'Updated' : 'Would update'} ${updated} strains with aliases.`);
  await conn.close();
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
