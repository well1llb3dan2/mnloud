import mongoose from 'mongoose';
import FlexSearch from 'flexsearch';
import config from '../config/index.js';
import { Strain, StrainMatch } from '../models/index.js';

let strainsConnection;
let strainsConnectionPromise;
let strainsIndex;
let strainsDocs;
let strainsIndexBuiltAt;
let strainsIndexCollection;
let strainsAiCache = new Map();
let strainsCollectionMissingLogged = false;

const sanitizeJsonString = (input) => {
  let inString = false;
  let escape = false;
  let output = '';
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if (escape) {
      output += ch;
      escape = false;
      continue;
    }
    if (ch === '\\') {
      output += ch;
      escape = true;
      continue;
    }
    if (ch === '"') {
      output += ch;
      inString = !inString;
      continue;
    }
    if (inString && (ch === '\n' || ch === '\r')) {
      output += ' ';
      continue;
    }
    output += ch;
  }
  return output;
};

const extractJsonValue = (input) => {
  const start = input.search(/[\[{]/);
  if (start < 0) return null;
  const startChar = input[start];
  const endChar = startChar === '{' ? '}' : ']';
  let inString = false;
  let escape = false;
  let depth = 0;
  for (let i = start; i < input.length; i += 1) {
    const ch = input[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === '\\') {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
    }
    if (!inString) {
      if (ch === startChar) depth += 1;
      if (ch === endChar) depth -= 1;
      if (depth === 0) {
        return input.slice(start, i + 1);
      }
    }
  }
  return null;
};

function repairJson(input) {
  let text = input.trim();
  const start = text.search(/[\[{]/);
  if (start > 0) text = text.slice(start);

  text = text.replace(/,\s*json\b/gi, '');
  text = text.replace(/\bjson\b/gi, '');
  text = text.replace(/"([^"]+)"\s+"([^"]*)"/g, '"$1":"$2"');
  text = text.replace(/"([^"]+)"\s*:\s*(?=[,}\]])/g, '"$1":""');

  let inString = false;
  let escape = false;
  let braceDepth = 0;
  let bracketDepth = 0;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === '\\') {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
    }
    if (!inString) {
      if (ch === '{') braceDepth += 1;
      if (ch === '}') braceDepth -= 1;
      if (ch === '[') bracketDepth += 1;
      if (ch === ']') bracketDepth -= 1;
    }
  }

  if (inString) text += '"';
  if (braceDepth > 0) text += '}'.repeat(braceDepth);
  if (bracketDepth > 0) text += ']'.repeat(bracketDepth);

  text = text.replace(/,\s*(\}|\])/g, '$1');
  return text;
}

const tryParseJson = (input) => {
  const candidate = extractJsonValue(input) || input;
  const sanitized = sanitizeJsonString(candidate);
  try {
    return JSON.parse(sanitized);
  } catch (err) {
    const repaired = repairJson(sanitized);
    const extracted = extractJsonValue(repaired) || repaired;
    try {
      return JSON.parse(extracted);
    } catch (retryErr) {
      for (let i = 0; i < repaired.length; i += 1) {
        const ch = repaired[i];
        if (ch !== '{' && ch !== '[') continue;
        const chunk = extractJsonValue(repaired.slice(i));
        if (!chunk) continue;
        try {
          return JSON.parse(chunk);
        } catch (chunkErr) {
          // try next candidate
        }
      }
      throw retryErr;
    }
  }
};

const normalizeAiList = (value) => {
  if (Array.isArray(value)) return value.filter(Boolean).map(String);
  if (typeof value === 'string') {
    return value
      .split(/[\n,]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
};

const normalizeAiThc = (value) => {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.min(value, 35);
  }
  if (typeof value === 'string') {
    const matches = value.match(/\d+(?:\.\d+)?/g);
    if (!matches || matches.length === 0) return '';
    const numbers = matches.map((item) => Number(item)).filter((n) => !Number.isNaN(n));
    if (numbers.length === 0) return '';
    return Math.min(Math.max(...numbers), 35);
  }
  return '';
};

const normalizeAiStrain = (item) => ({
  name: typeof item?.name === 'string' ? item.name : '',
  aliases: normalizeAiList(item?.aliases),
  variety: typeof item?.variety === 'string' ? item.variety : '',
  thc_percent: normalizeAiThc(item?.thc_percent ?? item?.thc ?? item?.thcPercentage ?? item?.thcPercent),
  effects: normalizeAiList(item?.effects),
  flavors: normalizeAiList(item?.flavors),
  may_relieve: normalizeAiList(item?.may_relieve ?? item?.medical_purpose ?? item?.medicalPurpose),
  terpenes: normalizeAiList(item?.terpenes),
  lineage: typeof item?.lineage === 'string' ? item.lineage : '',
  description: typeof item?.description === 'string' ? item.description : '',
});

const upsertStrainDetails = async (strain) => {
  if (!strain?.name) return;
  const nameLower = String(strain.name).trim().toLowerCase();
  if (!nameLower) return;
  const payload = {
    name: strain.name,
    nameLower,
    variety: strain.variety || '',
    thc_percent: strain.thc_percent === '' ? undefined : strain.thc_percent,
    effects: Array.isArray(strain.effects) ? strain.effects : [],
    flavors: Array.isArray(strain.flavors) ? strain.flavors : [],
    may_relieve: Array.isArray(strain.may_relieve) ? strain.may_relieve : [],
    terpenes: Array.isArray(strain.terpenes) ? strain.terpenes : [],
    lineage: strain.lineage || '',
    description: strain.description || '',
  };

  const { nameLower: lowerKey, ...setPayload } = payload;

  await Strain.findOneAndUpdate(
    { nameLower },
    { $set: setPayload, $setOnInsert: { nameLower: lowerKey } },
    { upsert: true, new: true }
  );
};

const normalizeStoredStrain = (item) => ({
  name: typeof item?.name === 'string' ? item.name : '',
  aliases: normalizeAiList(item?.aliases),
  variety: typeof item?.variety === 'string' ? item.variety : '',
  thc_percent: normalizeAiThc(item?.thc_percent ?? item?.thc ?? item?.thcPercentage ?? item?.thcPercent),
  effects: normalizeAiList(item?.effects),
  flavors: normalizeAiList(item?.flavors),
  may_relieve: normalizeAiList(item?.may_relieve ?? item?.medical_purpose ?? item?.medicalPurpose),
  terpenes: normalizeAiList(item?.terpenes),
  lineage: typeof item?.lineage === 'string' ? item.lineage : '',
  description: typeof item?.description === 'string' ? item.description : '',
});

const resolveModel = (model) => {
  if (!model) return 'gemini-2.5-flash';
  if (model.toLowerCase().includes('gemini-3-pro')) return 'gemini-2.5-flash';
  return model;
};

const truncateLog = (value, maxLength = 1200) => {
  if (!value) return '';
  const text = String(value);
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}…[truncated ${text.length - maxLength} chars]`;
};

const escapeRegExp = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const runAiPrompt = async ({
  apiKey,
  model,
  prompt,
  temperature = 0.2,
  maxOutputTokens = 1024,
  useSearch = true,
  responseMimeType,
}) => {
  const finalModel = resolveModel(model);
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${finalModel}:generateContent?key=${apiKey}`;
  const generationConfig = {
    temperature,
    maxOutputTokens,
  };
  if (responseMimeType) {
    generationConfig.responseMimeType = responseMimeType;
  }
  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig,
  };
  if (useSearch) {
    body.tools = [{ google_search: {} }];
  }
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error('[StrainsAI] API error', response.status, text);
    const error = new Error('AI request failed');
    error.status = response.status;
    error.details = text;
    throw error;
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';
  return text.replace(/```json\s*/i, '').replace(/```/g, '').trim();
};

const getStrainsConnection = async () => {
  if (strainsConnection && strainsConnection.readyState === 1) {
    return strainsConnection;
  }

  if (!strainsConnectionPromise) {
    strainsConnection = mongoose.createConnection(config.strains.uri);
    strainsConnectionPromise = strainsConnection.asPromise();
  }

  await strainsConnectionPromise;
  return strainsConnection;
};

const getStrainsCollectionName = async (conn) => {
  const collections = await conn.db.listCollections().toArray();
  if (!collections.length) return null;

  const preferred = collections.find(
    (col) => col.name && col.name.toLowerCase() === 'strains'
  );

  return (preferred || collections[0]).name;
};

const extractStrainName = (item) => {
  if (!item) return '';
  if (typeof item === 'string') return item;
  return (
    item.name ||
    item.strain ||
    item.strainName ||
    item.title ||
    item.displayName ||
    item.label ||
    ''
  );
};

const normalizeStrainKey = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');


const applyAliasRules = (value) => {
  let v = normalizeStrainKey(value);
  if (!v) return '';

  const rules = [
    { pattern: /zkittlez|zkittles|zkittle|skittlez|skittles|skittle/g, replace: 'skittles' },
    { pattern: /cookies/g, replace: 'cookie' },
    { pattern: /chemdawg|chemdog|chemdawg|chemda?wg/g, replace: 'chemdog' },
  ];

  rules.forEach((rule) => {
    v = v.replace(rule.pattern, rule.replace);
  });

  return v;
};

const getVotesCount = (item) => {
  const value = item?.votes_count ?? item?.votes ?? item?.votesCount ?? item?.vote_count;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const dedupeStrains = (strains) => {
  const groups = new Map();

  strains.forEach((item) => {
    const name = extractStrainName(item);
    const aliases = Array.isArray(item.aliases) ? item.aliases : (item.aliases ? [item.aliases] : []);
    const keyCandidates = [name, ...aliases]
      .map((entry) => applyAliasRules(entry))
      .filter(Boolean)
      .sort();
    const key = keyCandidates[0];
    if (!key) return;

    const votes = getVotesCount(item);
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, {
        item,
        votes,
        names: new Set(name ? [name] : []),
      });
      aliases.forEach((alias) => {
        if (alias) groups.get(key).names.add(alias);
      });
      return;
    }

    if (name) existing.names.add(name);
    aliases.forEach((alias) => {
      if (alias) existing.names.add(alias);
    });
    if (votes > existing.votes) {
      existing.item = item;
      existing.votes = votes;
    }
  });

  return [...groups.values()].map((group) => {
    const primaryName = extractStrainName(group.item);
    const aliases = [...group.names].filter((n) => n && n !== primaryName);
    return {
      ...group.item,
      name: primaryName || group.item.name,
      aliases,
    };
  });
};

const buildStrainsIndex = async () => {
  const conn = await getStrainsConnection();
  const collectionName = await getStrainsCollectionName(conn);

  if (!collectionName) {
    console.warn('[Strains] No collection found for index build');
    return { collectionName: null, total: 0 };
  }

  const maxIndex = Math.min(
    parseInt(process.env.STRAINS_INDEX_LIMIT || '50000', 10),
    200000
  );

  const strains = await conn.db
    .collection(collectionName)
    .find({})
    .limit(maxIndex)
    .toArray();

  const index = new FlexSearch.Document({
    tokenize: 'forward',
    cache: 1000,
    document: {
      id: 'id',
      index: [
        'name',
        'strain',
        'strainName',
        'title',
        'displayName',
        'label',
        'aliases',
        'variety',
        'type',
        'strain_type',
        'effects',
        'flavors',
        'may_relieve',
      ],
    },
  });

  const docs = new Map();
  strains.forEach((doc, idx) => {
    const id = doc?._id?.toString() || `${idx}`;
    const aliases = Array.isArray(doc.aliases)
      ? doc.aliases.filter(Boolean)
      : (doc.aliases ? [doc.aliases] : []);
    const record = {
      id,
      name: extractStrainName(doc),
      strain: doc.strain || '',
      strainName: doc.strainName || '',
      title: doc.title || '',
      displayName: doc.displayName || '',
      label: doc.label || '',
      aliases,
      variety: doc.variety || doc.strain_type || doc.type || '',
      type: doc.type || '',
      strain_type: doc.strain_type || '',
      effects: Array.isArray(doc.effects) ? doc.effects : [],
      flavors: Array.isArray(doc.flavors) ? doc.flavors : [],
      may_relieve: Array.isArray(doc.may_relieve) ? doc.may_relieve : [],
      raw: doc,
    };
    docs.set(id, record);
    index.add(record);
  });

  strainsIndex = index;
  strainsDocs = docs;
  strainsIndexBuiltAt = new Date().toISOString();
  strainsIndexCollection = collectionName;

  return { collectionName, total: docs.size };
};



export const getStrains = async (req, res) => {
  try {
    const rawQuery = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 200);
    const conn = await getStrainsConnection();
    const collectionName = await getStrainsCollectionName(conn);

    if (!collectionName) {
      if (!strainsCollectionMissingLogged) {
        console.warn('[Strains] No collection found');
        strainsCollectionMissingLogged = true;
      }
      return res.json({ strains: [], count: 0, query: rawQuery || undefined });
    }

    if (rawQuery) {
      if (!strainsIndex || !strainsDocs || strainsIndexCollection !== collectionName) {
        await buildStrainsIndex();
      }

      if (!strainsIndex || !strainsDocs) {
        return res.json({ strains: [], count: 0, query: rawQuery || undefined });
      }

      const results = strainsIndex.search(rawQuery, { limit: Math.max(limit, 20), enrich: true });
      const hits = new Map();
      results.forEach((group) => {
        group.result.forEach((result) => {
          const doc = strainsDocs.get(String(result.id));
          if (doc) hits.set(String(result.id), doc.raw || doc);
        });
      });

      const strains = Array.from(hits.values());
      const deduped = dedupeStrains(strains).slice(0, limit);

      return res.json({
        collection: strainsIndexCollection || collectionName,
        sample: deduped[0] || null,
        strains: deduped,
        count: deduped.length,
        query: rawQuery || undefined,
        index: {
          total: strainsDocs.size,
          builtAt: strainsIndexBuiltAt,
        },
      });
    }

    const strains = await conn.db
      .collection(collectionName)
      .find({})
      .limit(limit)
      .toArray();

    const deduped = dedupeStrains(strains);

    return res.json({
      collection: collectionName,
      sample: deduped[0] || null,
      strains: deduped,
      count: deduped.length,
      query: rawQuery || undefined,
    });
  } catch (error) {
    console.error('Strains fetch error:', error);
    return res.status(500).json({ message: 'Failed to fetch strains.' });
  }
};

const normalizeListValue = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (typeof value === 'string') {
    return value
      .split(/[\n,]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
};

const addToSet = (set, value) => {
  normalizeListValue(value).forEach((item) => set.add(item));
};

export const getStrainFilters = async (req, res) => {
  try {
    const conn = await getStrainsConnection();
    const collectionName = await getStrainsCollectionName(conn);

    if (!collectionName) {
      if (!strainsCollectionMissingLogged) {
        console.warn('[Strains] No collection found');
        strainsCollectionMissingLogged = true;
      }
      return res.json({ effects: [], flavors: [], may_relieve: [], terpenes: [] });
    }

    const effectsSet = new Set();
    const flavorsSet = new Set();
    const reliefSet = new Set();
    const terpenesSet = new Set();

    const cursor = conn.db.collection(collectionName).find({}, {
      projection: {
        effects: 1,
        flavors: 1,
        may_relieve: 1,
        medical_purpose: 1,
        terpenes: 1,
      },
    });

    for await (const doc of cursor) {
      addToSet(effectsSet, doc.effects);
      addToSet(flavorsSet, doc.flavors);
      addToSet(reliefSet, doc.may_relieve);
      addToSet(reliefSet, doc.medical_purpose);
      addToSet(terpenesSet, doc.terpenes);
    }

    const sortAlpha = (values) => Array.from(values).sort((a, b) => a.localeCompare(b));

    return res.json({
      effects: sortAlpha(effectsSet),
      flavors: sortAlpha(flavorsSet),
      may_relieve: sortAlpha(reliefSet),
      terpenes: sortAlpha(terpenesSet),
    });
  } catch (error) {
    console.error('Strain filters fetch error:', error);
    return res.status(500).json({ message: 'Failed to fetch strain filters.' });
  }
};

export const getStrainsFromAi = async (req, res) => {
  try {
    const query = typeof req.query.name === 'string'
      ? req.query.name.trim().toLowerCase()
      : typeof req.query.q === 'string'
      ? req.query.q.trim().toLowerCase()
      : '';
    const forceRefresh = String(req.query.forceRefresh || '').toLowerCase() === '1'
      || String(req.query.forceRefresh || '').toLowerCase() === 'true';
    console.log('[StrainsAI] details request', { query });
    const cacheTtlMs = parseInt(process.env.GOOGLE_AI_STUDIO_CACHE_TTL_MS || '3600000', 10);

    if (!query) {
      return res.json({ strain: null, query });
    }

    const apiKey = process.env.GOOGLE_AI_STUDIO_API_KEY;
    const model = resolveModel(process.env.GOOGLE_AI_STUDIO_MODEL || 'gemini-2.5-flash');
    if (!apiKey) {
      return res.status(500).json({ message: 'Missing GOOGLE_AI_STUDIO_API_KEY.' });
    }

    const cacheKey = `details:${model}:${query}`;
    const cached = strainsAiCache.get(cacheKey);
    if (!forceRefresh && cached && Date.now() - cached.timestamp < cacheTtlMs) {
      return res.json({ strain: cached.strain, query, cached: true });
    }

    const stored = await Strain.findOne({ nameLower: query }).lean();
    if (!forceRefresh && stored) {
      const normalized = normalizeStoredStrain(stored);
      strainsAiCache.set(cacheKey, { timestamp: Date.now(), strain: normalized });
      return res.json({ strain: normalized, query, cached: false, source: 'db' });
    }

    const baseResearchPrompt = (searchQuery) => `You are a cannabis strain research assistant. Use live Google Search grounding to find the closest real strain match. Search: "${searchQuery}".\n\nWrite a detailed report with the following labeled sections (one per line):\nName:\nAliases:\nVariety (sativa/indica/hybrid):\nTHC Percent:\nEffects:\nFlavors:\nMedical Purpose:\nTerpenes:\nLineage:\nDescription:\n\nRequirements:\n- Use grounded sources; do not hallucinate.\n- Provide at least 3 effects, 3 flavors, and 3 terpenes when available.\n- Do not leave sections blank; if truly unavailable, write "Unknown".\n- Description must be 2-3 short sentences.\n- You MUST include every labeled section in the output, even if "Unknown".\n- You MUST output something; never return an empty response.\nReturn plain text only (no JSON, no code fences).`;

    const jsonPromptFromResearch = (researchText) => `Convert the report below into JSON ONLY for ONE strain object with fields: name, aliases (array), variety (sativa/indica/hybrid), thc_percent (number, max 35), effects (array), flavors (array), medical_purpose (array), terpenes (array), lineage (string), description (string).\n\nRules:\n- Convert lists into arrays (comma-separated or semicolon-separated items).\n- If a section is "Unknown", use "Unknown" or ["Unknown"].\n- Preserve the Description text exactly as provided (2-3 short sentences).\n- Do not include any extra keys or text.\n\nReport:\n${researchText}`;

    let cleanedText = '';
    let researchText = '';
    try {
      const searchQueries = [
        `${query} cannabis strain`,
        `${query} strain`,
        `${query} weed strain`,
        `${query} marijuana strain`,
      ];
      let attempt = 0;
      for (const searchQuery of searchQueries) {
        attempt += 1;
        const researchPrompt = baseResearchPrompt(searchQuery);
        console.log('[StrainsAI] details research prompt', researchPrompt);
        researchText = await runAiPrompt({ apiKey, model, prompt: researchPrompt, temperature: 0.1, maxOutputTokens: 2048, useSearch: true });
        console.log('[StrainsAI] details research response', researchText);
        if (researchText && researchText.trim()) {
          break;
        }
        console.warn('[StrainsAI] empty research response', { attempt, query, searchQuery });
      }

      if (!researchText || !researchText.trim()) {
        return res.status(502).json({ message: 'AI research response was empty.' });
      }

      const jsonPrompt = jsonPromptFromResearch(researchText);
      console.log('[StrainsAI] details json prompt', jsonPrompt);
      cleanedText = await runAiPrompt({
        apiKey,
        model,
        prompt: jsonPrompt,
        temperature: 0,
        maxOutputTokens: 2048,
        useSearch: false,
        responseMimeType: 'application/json',
      });
      console.log('[StrainsAI] details json response', cleanedText);
    } catch (error) {
      if (error?.status === 429) {
        return res.status(429).json({
          message: 'AI quota exceeded. Update billing or set GOOGLE_AI_STUDIO_MODEL=gemini-2.5-flash.',
        });
      }
      return res.status(500).json({ message: 'AI request failed.' });
    }

    let strain;
    try {
      const parsed = tryParseJson(cleanedText);
      const parsedItem = Array.isArray(parsed) ? parsed[0] : parsed;
      strain = normalizeAiStrain(parsedItem || {});
    } catch (err) {
      console.warn('[StrainsAI] JSON parse failed (fallback to regex)', err);
      const pickString = (key) => {
        const safeKey = escapeRegExp(key);
        const match = cleanedText.match(new RegExp(`"${safeKey}"\\s*:\\s*"([^\"]+)"`, 'i'));
        return match ? match[1] : '';
      };
      const pickArray = (key) => {
        const safeKey = escapeRegExp(key);
        const match = cleanedText.match(new RegExp(`"${safeKey}"\\s*:\\s*\\[([^\\]]*)\\]`, 'i'));
        if (!match) return [];
        return match[1]
          .split(',')
          .map((item) => item.replace(/"/g, '').trim())
          .filter(Boolean);
      };
      strain = normalizeAiStrain({
        name: pickString('name') || query,
        aliases: pickArray('aliases'),
        variety: pickString('variety'),
        thc_percent: pickString('thc_percent') || pickString('thc'),
        effects: pickArray('effects'),
        flavors: pickArray('flavors'),
        may_relieve: pickArray('medical_purpose') || pickArray('may_relieve'),
        terpenes: pickArray('terpenes'),
        lineage: pickString('lineage'),
        description: pickString('description'),
      });
      if (!strain.name) {
        return res.status(502).json({ message: 'AI response parse failed.' });
      }
    }

    const hasMissingDetails = (item) => {
      if (!item) return true;
      const missingEffects = !item.effects || item.effects.length === 0;
      const missingFlavors = !item.flavors || item.flavors.length === 0;
      const missingTerpenes = !item.terpenes || item.terpenes.length === 0;
      const missingLineage = !item.lineage || !item.lineage.trim();
      const missingDescription = !item.description || !item.description.trim();
      const missingThc = item.thc_percent === '' || item.thc_percent === null || item.thc_percent === undefined;
      return missingEffects || missingFlavors || missingTerpenes || missingLineage || missingDescription || missingThc;
    };

    if (hasMissingDetails(strain)) {
      const repairPrompt = `Fill in missing strain details using live Google Search grounding. Search: "${strain.name || query} cannabis strain".\n\nYou MUST return JSON ONLY for ONE strain object with the same fields: name, aliases (array), variety (sativa/indica/hybrid), thc_percent (number, max 35), effects (array), flavors (array), medical_purpose (array), terpenes (array), lineage (string), description (string).\nDo not return empty arrays/strings unless absolutely unavailable; if truly unavailable, use "Unknown" or ["Unknown"].\nDescription must be 2-3 short sentences.\nUse this existing data as a starting point and fill missing fields:\n${JSON.stringify(strain)}\n\nReturn JSON only, no extra text or code fences.`;

      try {
        console.log('[StrainsAI] details repair prompt', repairPrompt);
        const repairText = await runAiPrompt({
          apiKey,
          model,
          prompt: repairPrompt,
          temperature: 0,
          maxOutputTokens: 2048,
          useSearch: false,
          responseMimeType: 'application/json',
        });
        console.log('[StrainsAI] details repair response', repairText);
        const parsed = tryParseJson(repairText);
        const parsedItem = Array.isArray(parsed) ? parsed[0] : parsed;
        strain = normalizeAiStrain({ ...strain, ...(parsedItem || {}) });
      } catch (error) {
        console.warn('[StrainsAI] repair prompt failed', error);
      }
    }

    if (!strain.effects.length) strain.effects = ['Unknown'];
    if (!strain.flavors.length) strain.flavors = ['Unknown'];
    if (!strain.terpenes.length) strain.terpenes = ['Unknown'];
    if (!strain.may_relieve.length) strain.may_relieve = ['Unknown'];
    if (!strain.lineage) strain.lineage = 'Unknown';
    if (!strain.description) strain.description = 'Unknown';

    try {
      await upsertStrainDetails(strain);
    } catch (err) {
      console.warn('[StrainsAI] strain upsert failed', err?.message || err);
    }

    strainsAiCache.set(cacheKey, { timestamp: Date.now(), strain });
    return res.json({ strain, query, cached: false });
  } catch (error) {
    console.error('Strains AI fetch error:', error);
    return res.status(500).json({ message: 'Failed to fetch strains from AI.' });
  }
};

export const getStrainMatchesFromAi = async (req, res) => {
  try {
    const query = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';
    const forceRefresh = String(req.query.forceRefresh || '').toLowerCase() === '1'
      || String(req.query.forceRefresh || '').toLowerCase() === 'true';
    const limit = 5;
    const cacheTtlMs = parseInt(process.env.GOOGLE_AI_STUDIO_CACHE_TTL_MS || '3600000', 10);

    if (!query) {
      return res.json({ matches: [], count: 0, query });
    }

    const cachedMatch = await StrainMatch.findOne({ queryLower: query }).lean();
    if (!forceRefresh && cachedMatch?.matches?.length) {
      return res.json({
        matches: cachedMatch.matches.slice(0, limit),
        count: Math.min(cachedMatch.matches.length, limit),
        query,
        cached: true,
        source: 'db',
      });
    }

    const apiKey = process.env.GOOGLE_AI_STUDIO_API_KEY;
    const matchModel = resolveModel(
      process.env.GOOGLE_AI_STUDIO_MATCH_MODEL ||
      process.env.GOOGLE_AI_STUDIO_MODEL ||
      'gemini-1.5-flash'
    );
    if (!apiKey) {
      return res.status(500).json({ message: 'Missing GOOGLE_AI_STUDIO_API_KEY.' });
    }

    const cacheKey = `matches:${matchModel}:${query}:${limit}`;
    const cached = strainsAiCache.get(cacheKey);
    if (!forceRefresh && cached && Date.now() - cached.timestamp < cacheTtlMs) {
      return res.json({ matches: cached.matches, count: cached.matches.length, query, cached: true });
    }

    const researchPrompt = `You are a cannabis strain research assistant. Use live Google Search grounding to find the closest real strain matches. Search: "${query} cannabis strain".\n\nWrite a concise list of multiple matches (aim for ${limit}). If you cannot find ${limit} real matches, include closely related or similar strain names. For each match, provide labeled lines in this exact order:\nName:\nAliases:\nVariety (sativa/indica/hybrid):\n---\n\nRequirements:\n- Use grounded sources; do not hallucinate.\n- Return at least 2 matches when possible.\n- Do not leave any label blank; use "Unknown" when necessary.\nReturn plain text only (no JSON, no code fences).`;

    const jsonPromptFromResearch = (researchText) => `Convert the research list below into JSON ONLY as an array of up to ${limit} objects with fields: name, aliases (array), variety (sativa/indica/hybrid).\n\nRules:\n- Convert lists into arrays (comma-separated or semicolon-separated items).\n- If a section is "Unknown", use "Unknown" or ["Unknown"].\n- Do not include any extra keys or text.\n- Return at least 2 objects when possible.\n\nResearch list:\n${researchText}`;

    let cleanedText = '';
    let researchText = '';
    try {
      const maxAttempts = 3;
      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        console.log('[StrainsAI] matches research prompt', researchPrompt);
        researchText = await runAiPrompt({
          apiKey,
          model: matchModel,
          prompt: researchPrompt,
          temperature: 0.2,
          maxOutputTokens: 1024,
          useSearch: true,
        });
        console.log('[StrainsAI] matches research response', researchText);
        if (researchText && researchText.trim()) break;
        console.warn('[StrainsAI] empty matches response', { attempt, query });
      }
      if (!researchText || !researchText.trim()) {
        return res.status(502).json({ message: 'AI matches response was empty.' });
      }

      const jsonPrompt = jsonPromptFromResearch(researchText);
      console.log('[StrainsAI] matches json prompt', jsonPrompt);
      cleanedText = await runAiPrompt({
        apiKey,
        model: matchModel,
        prompt: jsonPrompt,
        temperature: 0,
        maxOutputTokens: 1024,
        useSearch: false,
        responseMimeType: 'application/json',
      });
      console.log('[StrainsAI] matches json response', cleanedText);
    } catch (error) {
      if (error?.status === 429) {
        return res.status(429).json({
          message: 'AI quota exceeded. Update billing or set GOOGLE_AI_STUDIO_MATCH_MODEL=gemini-1.5-flash.',
        });
      }
      return res.status(500).json({ message: 'AI request failed.' });
    }

    let matches = [];
    try {
      const parsed = tryParseJson(cleanedText);
      const list = Array.isArray(parsed) ? parsed : parsed ? [parsed] : [];
      matches = list.map((item) => ({
        name: typeof item?.name === 'string' ? item.name : '',
        aliases: normalizeAiList(item?.aliases),
        variety: typeof item?.variety === 'string' ? item.variety : '',
      })).filter((item) => item.name);
    } catch (err) {
      console.warn('[StrainsAI] JSON parse failed (fallback to regex)', err);
      const nameMatches = [...cleanedText.matchAll(/"name"\s*:\s*"([^"]+)"/gi)]
        .map((m) => m[1])
        .filter(Boolean);
      const uniqueNames = Array.from(new Set(nameMatches)).slice(0, limit);
      matches = uniqueNames.map((name) => ({ name, aliases: [], variety: '' }));
      if (matches.length === 0) {
        return res.status(502).json({ message: 'AI response parse failed.' });
      }
    }

    const limited = matches.slice(0, limit);
    try {
      await StrainMatch.findOneAndUpdate(
        { queryLower: query },
        {
          $set: {
            query,
            matches: limited,
          },
          $setOnInsert: { queryLower: query },
        },
        { upsert: true, new: true }
      );
    } catch (err) {
      console.warn('[StrainsAI] match cache upsert failed', err?.message || err);
    }
    strainsAiCache.set(cacheKey, { timestamp: Date.now(), matches: limited });
    return res.json({ matches: limited, count: limited.length, query, cached: false });
  } catch (error) {
    console.error('Strains AI fetch error:', error);
    return res.status(500).json({ message: 'Failed to fetch strains from AI.' });
  }
};
