const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// `supabase/` holds Deno sources: `npm:` import specifiers, `Deno.*` globals,
// and `.ts` extensions on relative imports. The client only ever imports
// *types* from there (see src/domain/wire.ts), which Babel erases, so Metro
// should never be asked to resolve any of it. Block it so a stray value
// import fails loudly at bundle time rather than at runtime on a device.
config.resolver.blockList = [/\/supabase\/functions\/.*/];

module.exports = withNativeWind(config, { input: './global.css' });
