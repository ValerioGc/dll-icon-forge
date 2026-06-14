const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const reportPath = path.join(repoRoot, 'src-tauri/target/llvm-cov/lcov.info');
const sourceRootMarker = '/src-tauri/';

const report = fs.readFileSync(reportPath, 'utf8');
const normalised = report.replace(/^SF:(.+)$/gm, (_line, sourcePath) => {
    const portablePath = sourcePath.replaceAll('\\', '/');
    const markerIndex = portablePath.lastIndexOf(sourceRootMarker);

    if (markerIndex === -1)
        return `SF:${portablePath}`;

    return `SF:${portablePath.slice(markerIndex + 1)}`;
});

fs.writeFileSync(reportPath, normalised);
