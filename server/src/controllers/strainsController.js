import mongoose from 'mongoose';
import FlexSearch from 'flexsearch';
import config from '../config/index.js';

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
  export const getStrainsFromAi = async (req, res) => {
    try {
      const query = typeof req.query.name === 'string'
        ? req.query.name.trim()
        : typeof req.query.q === 'string'
        ? req.query.q.trim()
        : '';
      const cacheTtlMs = parseInt(process.env.GOOGLE_AI_STUDIO_CACHE_TTL_MS || '3600000', 10);

      if (!query) {
        return res.json({ strain: null, query });
      }

      const apiKey = process.env.GOOGLE_AI_STUDIO_API_KEY;
      const model = process.env.GOOGLE_AI_STUDIO_MODEL || 'gemini-2.5-flash';
      if (!apiKey) {
        return res.status(500).json({ message: 'Missing GOOGLE_AI_STUDIO_API_KEY.' });
      }

      const cacheKey = `details:${model}:${query}`;
      const cached = strainsAiCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < cacheTtlMs) {
        return res.json({ strain: cached.strain, query, cached: true });
      }

      const prompt = `You are a cannabis strain research assistant. Use live Google Search grounding to find the closest real strain match. Search: "${query} cannabis strain".\n\nReturn JSON ONLY for ONE strain object with fields: name, aliases (array), variety (sativa/indica/hybrid), thc_percent (number, max 35), effects (array), flavors (array), medical_purpose (array), terpenes (array), lineage (string), description (string).\nKeep description to 1-2 sentences max. If a field is unknown, return an empty string or empty array. Do not include extra text or code fences.`;

      let cleanedText = '';
      try {
        cleanedText = await runAiPrompt({ apiKey, model, prompt, temperature: 0.2, maxOutputTokens: 1024 });
      } catch (error) {
        return res.status(500).json({ message: 'AI request failed.' });
      }

      let strain;
      try {
        const parsed = tryParseJson(cleanedText);
        const parsedItem = Array.isArray(parsed) ? parsed[0] : parsed;
        strain = normalizeAiStrain(parsedItem || {});
      } catch (err) {
        const retryPrompt = `Return MINIFIED JSON ONLY (no code fences, no commentary). One object with fields: name, aliases (array), variety (sativa/indica/hybrid), thc_percent (number, max 35), effects (array), flavors (array), medical_purpose (array), terpenes (array), lineage, description (<= 200 chars). Search: "${query} cannabis strain".`;
        try {
          const retryText = await runAiPrompt({ apiKey, model, prompt: retryPrompt, temperature: 0.1, maxOutputTokens: 512 });
          const parsed = tryParseJson(retryText);
          const parsedItem = Array.isArray(parsed) ? parsed[0] : parsed;
          strain = normalizeAiStrain(parsedItem || {});
        } catch (retryErr) {
          console.warn('[StrainsAI] JSON parse failed, retrying with strict prompt', err);
          console.error('[StrainsAI] Retry JSON parse failed', retryErr, cleanedText);
          return res.status(500).json({ message: 'AI response parse failed.' });
        }
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
      const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
      const limit = Math.min(parseInt(req.query.limit || '5', 10), 10);
      const cacheTtlMs = parseInt(process.env.GOOGLE_AI_STUDIO_CACHE_TTL_MS || '3600000', 10);

      if (!query) {
        return res.json({ matches: [], count: 0, query });
      }

      const apiKey = process.env.GOOGLE_AI_STUDIO_API_KEY;
      const model = process.env.GOOGLE_AI_STUDIO_MODEL || 'gemini-2.5-flash';
      if (!apiKey) {
        return res.status(500).json({ message: 'Missing GOOGLE_AI_STUDIO_API_KEY.' });
      }

      const cacheKey = `matches:${model}:${query}:${limit}`;
      const cached = strainsAiCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < cacheTtlMs) {
        return res.json({ matches: cached.matches, count: cached.matches.length, query, cached: true });
      }

      const prompt = `You are a cannabis strain research assistant. Use live Google Search grounding to find the closest real strain matches. Search: "${query} cannabis strain".\n\nReturn JSON ONLY as an array of up to ${limit} objects with fields: name, aliases (array), variety (sativa/indica/hybrid). If fewer than ${limit} matches exist, return fewer. Do not include extra text or code fences.`;

      let cleanedText = '';
      try {
        cleanedText = await runAiPrompt({ apiKey, model, prompt, temperature: 0.2, maxOutputTokens: 512 });
      } catch (error) {
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
        const retryPrompt = `Return MINIFIED JSON ONLY. Array of up to ${limit} objects with fields: name, aliases (array), variety. Search: "${query} cannabis strain".`;
        try {
          const retryText = await runAiPrompt({ apiKey, model, prompt: retryPrompt, temperature: 0.1, maxOutputTokens: 256 });
          const parsed = tryParseJson(retryText);
          const list = Array.isArray(parsed) ? parsed : parsed ? [parsed] : [];
          matches = list.map((item) => ({
            name: typeof item?.name === 'string' ? item.name : '',
            aliases: normalizeAiList(item?.aliases),
            variety: typeof item?.variety === 'string' ? item.variety : '',
          })).filter((item) => item.name);
        } catch (retryErr) {
          console.warn('[StrainsAI] JSON parse failed, retrying with strict prompt', err);
          console.error('[StrainsAI] Retry JSON parse failed', retryErr, cleanedText);
          return res.status(500).json({ message: 'AI response parse failed.' });
        }
      }

      const limited = matches.slice(0, limit);
      strainsAiCache.set(cacheKey, { timestamp: Date.now(), matches: limited });
      return res.json({ matches: limited, count: limited.length, query, cached: false });
    } catch (error) {
      console.error('Strains AI fetch error:', error);
      return res.status(500).json({ message: 'Failed to fetch strains from AI.' });
    }
  };
      return res.json({ strains: [], count: 0, query });
    }

    const apiKey = process.env.GOOGLE_AI_STUDIO_API_KEY;
    const model = process.env.GOOGLE_AI_STUDIO_MODEL || 'gemini-2.5-flash';
    if (!apiKey) {
      return res.status(500).json({ message: 'Missing GOOGLE_AI_STUDIO_API_KEY.' });
    import mongoose from 'mongoose';
    import FlexSearch from 'flexsearch';
    import config from '../config/index.js';

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
        return JSON.parse(repaired);
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

    const runAiPrompt = async ({ apiKey, model, prompt, temperature = 0.2, maxOutputTokens = 1024 }) => {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          tools: [{ google_search: {} }],
          generationConfig: {
            temperature,
            maxOutputTokens,
          },
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        console.error('[StrainsAI] API error', response.status, text);
        throw new Error('AI request failed');
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

    export const getStrainsFromAi = async (req, res) => {
      try {
        const query = typeof req.query.name === 'string'
          ? req.query.name.trim()
          : typeof req.query.q === 'string'
          ? req.query.q.trim()
          : '';
        const cacheTtlMs = parseInt(process.env.GOOGLE_AI_STUDIO_CACHE_TTL_MS || '3600000', 10);

        if (!query) {
          return res.json({ strain: null, query });
        }

        const apiKey = process.env.GOOGLE_AI_STUDIO_API_KEY;
        const model = process.env.GOOGLE_AI_STUDIO_MODEL || 'gemini-2.5-flash';
        if (!apiKey) {
          return res.status(500).json({ message: 'Missing GOOGLE_AI_STUDIO_API_KEY.' });
        }

        const cacheKey = `details:${model}:${query}`;
        const cached = strainsAiCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < cacheTtlMs) {
          return res.json({ strain: cached.strain, query, cached: true });
        }

        const prompt = `You are a cannabis strain research assistant. Use live Google Search grounding to find the closest real strain match. Search: "${query} cannabis strain".\n\nReturn JSON ONLY for ONE strain object with fields: name, aliases (array), variety (sativa/indica/hybrid), thc_percent (number, max 35), effects (array), flavors (array), medical_purpose (array), terpenes (array), lineage (string), description (string).\nKeep description to 1-2 sentences max. If a field is unknown, return an empty string or empty array. Do not include extra text or code fences.`;

        let cleanedText = '';
        try {
          cleanedText = await runAiPrompt({ apiKey, model, prompt, temperature: 0.2, maxOutputTokens: 1024 });
        } catch (error) {
          return res.status(500).json({ message: 'AI request failed.' });
        }

        let strain;
        try {
          const parsed = tryParseJson(cleanedText);
          const parsedItem = Array.isArray(parsed) ? parsed[0] : parsed;
          strain = normalizeAiStrain(parsedItem || {});
        } catch (err) {
          const retryPrompt = `Return MINIFIED JSON ONLY (no code fences, no commentary). One object with fields: name, aliases (array), variety (sativa/indica/hybrid), thc_percent (number, max 35), effects (array), flavors (array), medical_purpose (array), terpenes (array), lineage, description (<= 200 chars). Search: "${query} cannabis strain".`;
          try {
            const retryText = await runAiPrompt({ apiKey, model, prompt: retryPrompt, temperature: 0.1, maxOutputTokens: 512 });
            const parsed = tryParseJson(retryText);
            const parsedItem = Array.isArray(parsed) ? parsed[0] : parsed;
            strain = normalizeAiStrain(parsedItem || {});
          } catch (retryErr) {
            console.warn('[StrainsAI] JSON parse failed, retrying with strict prompt', err);
            console.error('[StrainsAI] Retry JSON parse failed', retryErr, cleanedText);
            return res.status(500).json({ message: 'AI response parse failed.' });
          }
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
        const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
        const limit = Math.min(parseInt(req.query.limit || '5', 10), 10);
        const cacheTtlMs = parseInt(process.env.GOOGLE_AI_STUDIO_CACHE_TTL_MS || '3600000', 10);

        if (!query) {
          return res.json({ matches: [], count: 0, query });
        }

        const apiKey = process.env.GOOGLE_AI_STUDIO_API_KEY;
        const model = process.env.GOOGLE_AI_STUDIO_MODEL || 'gemini-2.5-flash';
        if (!apiKey) {
          return res.status(500).json({ message: 'Missing GOOGLE_AI_STUDIO_API_KEY.' });
        }

        const cacheKey = `matches:${model}:${query}:${limit}`;
        const cached = strainsAiCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < cacheTtlMs) {
          return res.json({ matches: cached.matches, count: cached.matches.length, query, cached: true });
        }

        const prompt = `You are a cannabis strain research assistant. Use live Google Search grounding to find the closest real strain matches. Search: "${query} cannabis strain".\n\nReturn JSON ONLY as an array of up to ${limit} objects with fields: name, aliases (array), variety (sativa/indica/hybrid). If fewer than ${limit} matches exist, return fewer. Do not include extra text or code fences.`;

        let cleanedText = '';
        try {
          cleanedText = await runAiPrompt({ apiKey, model, prompt, temperature: 0.2, maxOutputTokens: 512 });
        } catch (error) {
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
          const retryPrompt = `Return MINIFIED JSON ONLY. Array of up to ${limit} objects with fields: name, aliases (array), variety. Search: "${query} cannabis strain".`;
          try {
            const retryText = await runAiPrompt({ apiKey, model, prompt: retryPrompt, temperature: 0.1, maxOutputTokens: 256 });
            const parsed = tryParseJson(retryText);
            const list = Array.isArray(parsed) ? parsed : parsed ? [parsed] : [];
            matches = list.map((item) => ({
              name: typeof item?.name === 'string' ? item.name : '',
              aliases: normalizeAiList(item?.aliases),
              variety: typeof item?.variety === 'string' ? item.variety : '',
            })).filter((item) => item.name);
          } catch (retryErr) {
            console.warn('[StrainsAI] JSON parse failed, retrying with strict prompt', err);
            console.error('[StrainsAI] Retry JSON parse failed', retryErr, cleanedText);
            return res.status(500).json({ message: 'AI response parse failed.' });
          }
        }

        const limited = matches.slice(0, limit);
        strainsAiCache.set(cacheKey, { timestamp: Date.now(), matches: limited });
        return res.json({ matches: limited, count: limited.length, query, cached: false });
      } catch (error) {
        console.error('Strains AI fetch error:', error);
        return res.status(500).json({ message: 'Failed to fetch strains from AI.' });
      }
    };
