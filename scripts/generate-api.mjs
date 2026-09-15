#!/usr/bin/env node
// Descarga el openapi.json del backend y regenera src/app/api/.
// Ver ARQUITECTURA.md §13 y ROADMAP.md (W1). No editar el resultado a mano.

import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const schemaUrl = process.env.API_SCHEMA_URL ?? 'http://localhost:8080/v3/api-docs';
const outputDir = join(projectRoot, 'src/app/api');
const cli = join(projectRoot, 'node_modules/.bin/openapi-generator-cli');

console.log(`Descargando el esquema OpenAPI desde ${schemaUrl}...`);

let schema;
try {
  const response = await fetch(schemaUrl);
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  schema = await response.text();
} catch (error) {
  console.error(
    `No se pudo descargar el esquema OpenAPI desde ${schemaUrl}.\n` +
      'Verifica que el backend esté corriendo (docker compose up en shop-backend-service) ' +
      'o define API_SCHEMA_URL apuntando a otro origen.\n' +
      String(error),
  );
  process.exit(1);
}

const tempDir = mkdtempSync(join(tmpdir(), 'openapi-schema-'));
const schemaPath = join(tempDir, 'openapi.json');
writeFileSync(schemaPath, schema);

const additionalProperties = [
  'providedIn=root',
  'useSingleRequestParameter=true',
  'supportsES6=true',
  'stringEnums=true',
  'fileNaming=kebab-case',
].join(',');

try {
  execFileSync(
    cli,
    [
      'generate',
      '-i',
      schemaPath,
      '-g',
      'typescript-angular',
      '-o',
      outputDir,
      '--additional-properties',
      additionalProperties,
    ],
    { stdio: 'inherit', cwd: projectRoot },
  );
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}

// El generador deja ruido de scaffolding pensado para publicar un paquete npm
// aparte. Aquí la carpeta es solo código consumido por esta app: se poda.
const scaffoldNoise = [
  '.openapi-generator',
  '.openapi-generator-ignore',
  'git_push.sh',
  'README.md',
  '.gitignore',
  '.npmignore',
];
for (const name of scaffoldNoise) {
  rmSync(join(outputDir, name), { recursive: true, force: true });
}

console.log(`Cliente generado en ${outputDir}`);

if (process.argv.includes('--check')) {
  // `git diff` ignora archivos sin trackear: sin este intent-to-add, un
  // archivo nuevo generado por el backend pasaría el check en silencio.
  execFileSync('git', ['add', '--intent-to-add', '--', outputDir], { cwd: projectRoot });

  const diff = execFileSync('git', ['diff', '--stat', '--', outputDir], {
    cwd: projectRoot,
    encoding: 'utf8',
  });

  if (diff.trim() !== '') {
    console.error(diff);
    console.error(
      `${outputDir} quedó desactualizado respecto al OpenAPI del backend.\n` +
        'Corre "pnpm api:generate" y commitea el resultado.',
    );
    process.exit(1);
  }

  console.log('src/app/api/ está al día con el OpenAPI del backend.');
}
