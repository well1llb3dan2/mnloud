import mongoose from 'mongoose';
import config from '../src/config/index.js';

const ENDPOINT = 'https://query.wikidata.org/sparql';
const DEFAULT_QID = 'Q12706044'; // cannabis strain (update if needed)
const DEFAULT_TERM = 'cannabis strain';

const normalizeKey = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');

const extractName = (doc) =>
  doc?.name || doc?.strain || doc?.strainName || doc?.title || doc?.displayName || doc?.label || '';

const getCollectionName = async (conn) => {
  const collections = await conn.db.listCollections().toArray();
  const preferred = collections.find((col) => col.name?.toLowerCase() === 'strains');
  return (preferred || collections[0])?.name || null;
};

const buildQuery = (qid) => `
SELECT ?item ?itemLabel ?altLabel WHERE {
  ?item wdt:P31/wdt:P279* wd:${qid} .
  OPTIONAL { ?item skos:altLabel ?altLabel FILTER(LANG(?altLabel) = "en") }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
`;

const fetchWikidata = async (qid) => {
  const query = buildQuery(qid);
  const url = `${ENDPOINT}?format=json&query=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Loud-Strains-Alias-Importer/1.0' } });
  if (!res.ok) {
    throw new Error(`Wikidata query failed: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  return data?.results?.bindings || [];
};

const resolveQidFromTerm = async (term) => {
  const url = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(
    term
  )}&language=en&format=json&limit=5`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Loud-Strains-Alias-Importer/1.0' } });
  if (!res.ok) {
    throw new Error(`Wikidata search failed: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  const first = data?.search?.[0];
  return first?.id || null;
};

const run = async () => {
  const apply = process.argv.includes('--apply');
  const limitArg = process.argv.find((arg) => arg.startsWith('--limit='));
  const qidArg = process.argv.find((arg) => arg.startsWith('--qid='));
  const termArg = process.argv.find((arg) => arg.startsWith('--term='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : null;
  const term = termArg ? termArg.split('=')[1] : DEFAULT_TERM;
  let qid = qidArg ? qidArg.split('=')[1] : DEFAULT_QID;

  if (!qidArg) {
    const resolved = await resolveQidFromTerm(term);
    if (resolved) {
      qid = resolved;
      console.log(`Resolved QID from term "${term}": ${qid}`);
    } else {
      console.warn(`No QID found for term "${term}". Using default QID ${qid}.`);
    }
  }

  const conn = await mongoose.createConnection(config.strains.uri).asPromise();
  const collectionName = await getCollectionName(conn);
  if (!collectionName) {
    console.error('No strains collection found.');
    process.exit(1);
  }

  const docs = await conn.db.collection(collectionName).find({}).toArray();
  const nameIndex = new Map();

  docs.forEach((doc) => {
    const name = extractName(doc);
    const key = normalizeKey(name);
    if (!key) return;
    if (!nameIndex.has(key)) nameIndex.set(key, []);
    nameIndex.get(key).push(doc);
  });

  const bindings = await fetchWikidata(qid);
  console.log(`Wikidata rows returned: ${bindings.length}`);
  const rows = limit && Number.isFinite(limit) ? bindings.slice(0, limit) : bindings;

  const updates = [];
  let matched = 0;
  let updated = 0;

  rows.forEach((row) => {
    const label = row?.itemLabel?.value;
    const altLabel = row?.altLabel?.value;
    if (!label) return;

    const key = normalizeKey(label);
    const targets = nameIndex.get(key) || [];
    if (!targets.length) return;

    matched += targets.length;
    targets.forEach((doc) => {
      const current = Array.isArray(doc.aliases) ? doc.aliases : doc.aliases ? [doc.aliases] : [];
      const next = new Set(current);
      if (altLabel) next.add(altLabel);

      if (next.size !== current.length) {
        updated += 1;
        updates.push({
          updateOne: {
            filter: { _id: doc._id },
            update: { $set: { aliases: [...next] } },
          },
        });
      }
    });
  });

  if (apply && updates.length) {
    await conn.db.collection(collectionName).bulkWrite(updates, { ordered: false });
  }

  console.log(`${apply ? 'Updated' : 'Would update'} ${updated} strains from Wikidata.`);
  console.log(`Matched ${matched} strain docs using QID ${qid}.`);
  if (bindings.length === 0) {
    console.warn('No Wikidata rows returned. Try a different QID with --qid=Qxxxx.');
  }

  await conn.close();
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
