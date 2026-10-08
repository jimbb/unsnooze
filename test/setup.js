// Preloaded into every test process (see package.json "test"). Running the
// suite from inside an unsnooze-managed pane inherits UNSNOOZE_* overrides
// (e.g. UNSNOOZE_NOTIFICATIONS=off) that silently change config defaults;
// tests set the ones they need themselves.
for (const key of Object.keys(process.env)) {
  if (key.startsWith('UNSNOOZE_')) delete process.env[key];
}
