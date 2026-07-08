// load package.json to get the version number
import { readFileSync } from 'fs';
import path from 'path';

import { environConfig } from '../environ';

const packageJsonPath = path.join(environConfig.serverDir, 'package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

export const version = packageJson.version;