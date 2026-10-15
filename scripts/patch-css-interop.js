const fs = require('fs');
const path = require('path');

const targetFile = path.join(
  __dirname,
  '..',
  'node_modules',
  'react-native-css-interop',
  'dist',
  'runtime',
  'native',
  'render-component.js'
);

if (fs.existsSync(targetFile)) {
  let content = fs.readFileSync(targetFile, 'utf8');
  if (content.includes('for (const entry of Object.entries(value))')) {
    content = content.replace(
      /function printUpgradeWarning\(warning, originalProps\) \{[\s\S]*?function getDebugReplacer\(\) \{/,
      `function printUpgradeWarning(warning, originalProps) {
    try {
        console.warn(\`CssInterop upgrade warning: \${warning}\`);
    } catch {
        // Ignore
    }
}
function stringify(object) {
    try {
        const seen = new WeakSet();
        return JSON.stringify(object, function replace(key, value) {
            try {
                if (!(value !== null && typeof value === "object")) {
                    return value;
                }
                if (seen.has(value)) {
                    return "[Circular]";
                }
                seen.add(value);
                const newValue = Array.isArray(value) ? [] : {};
                const keys = Object.getOwnPropertyNames(value);
                for (const k of keys) {
                    try {
                        const descriptor = Object.getOwnPropertyDescriptor(value, k);
                        if (descriptor && typeof descriptor.get === 'function') {
                            newValue[k] = "[Getter]";
                            continue;
                        }
                        newValue[k] = replace(k, value[k]);
                    } catch {
                        newValue[k] = "[Unreadable]";
                    }
                }
                seen.delete(value);
                return newValue;
            } catch {
                return "[Unreadable]";
            }
        }, 2);
    } catch {
        return "[Props]";
    }
}
function getDebugReplacer() {`
    );
    fs.writeFileSync(targetFile, content, 'utf8');
    console.log('Successfully patched react-native-css-interop stringify');
  }
}
