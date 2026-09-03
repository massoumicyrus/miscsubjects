#!/usr/bin/env node
// LAW: /api/opos and /api/opos?format=drop must return valid JSON with no null
// artifacts in key nested fields.

const PRODUCTION_ORIGIN = 'https://miscsubjects.com';

function okField(value) {
  return value != null && (typeof value !== 'object' || Object.keys(value).length > 0);
}

async function check() {
  const failures = [];
  for (const path of ['/api/opos', '/api/opos?format=drop']) {
    try {
      const res = await fetch(PRODUCTION_ORIGIN + path);
      if (res.status !== 200) {
        failures.push({ where: path, status: res.status, error: 'non-200' });
        continue;
      }
      const text = await res.text();
      let json;
      try {
        json = JSON.parse(text);
      } catch (e) {
        failures.push({ where: path, error: 'invalid JSON: ' + e.message });
        continue;
      }
      const required = ['identity', 'object_classes', 'tap_and_go'];
      for (const key of required) {
        if (!okField(json[key])) {
          failures.push({ where: path, field: key, error: 'missing or empty' });
        }
      }
    } catch (e) {
      failures.push({ where: path, error: 'fetch failed: ' + e.message });
    }
  }

  if (failures.length) {
    console.error(JSON.stringify({ ok: false, law: 'OPOS_RENDER_LAW', failures }, null, 2));
    process.exit(1);
  }
  console.log(JSON.stringify({ ok: true, law: 'OPOS_RENDER_LAW', checked: '/api/opos, /api/opos?format=drop' }));
}

check();
