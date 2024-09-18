import fs from 'node:fs';
import path from 'node:path';
import { ApiClient } from './api.js';
import { getCollections } from './logic.js';
import { pascalCase, singularize, generateJSDocComment, shouldIncludeField, determineFieldType } from './utils.js';

export const DEFAULT_DIRECTUS_URL =  'http://localhost:8055';
export const DEFAULT_OUTPUT_FILE = path.join('.', 'directus-schema.ts');

/**
 * Generates TypeScript types from Directus collections.
 *
 * @param {Object} options - Configuration options.
 * @param {string} options.outputPath - Path to the output file.
 * @param {string} options.directusUrl - URL of the Directus API.
 * @param {string} options.directusToken - Token for the Directus API.
 * @returns {Promise<string>} - A promise that resolves to the generated TypeScript types.
 */
export async function generateDirectusTypes({
    outputPath = DEFAULT_OUTPUT_FILE,
    directusUrl = DEFAULT_DIRECTUS_URL,
    directusToken = 'admin'
}): Promise<string> {
	try {
        const api = new ApiClient(directusUrl, directusToken);
		const collections = await getCollections(api);
		let output = '';

		Object.values(collections).forEach((collection) => {
			const isSingleton = collection.meta?.singleton;
			const typeName = pascalCase(isSingleton ? collection.collection : singularize(collection.collection));

			output += `export interface ${typeName} {\n`;

			collection.fields.filter(shouldIncludeField).forEach((field) => {
				const jsDocComment = generateJSDocComment(field);
				const fieldType = determineFieldType(field);
				const isRequired = field.schema?.is_primary_key || field.meta?.required;
				const isNullable = field.schema?.is_nullable && !isRequired;
				const fieldName = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(field.field) ? field.field : `'${field.field}'`;
				const typeAnnotation = `${fieldType}${isNullable ? ' | null' : ''}`;
				output += `${jsDocComment}\t${fieldName}${isRequired ? '' : '?'}: ${typeAnnotation};\n`;
			});

			output += '}\n\n';
		});

		output += 'export interface Schema {\n';

		Object.values(collections).forEach((collection) => {
			const isSingleton = collection.meta?.singleton;
			const typeName = pascalCase(isSingleton ? collection.collection : singularize(collection.collection));
			output += `\t${collection.collection}: ${typeName}${isSingleton ? '' : '[]'};\n`;
		});

		output += '}\n';

        if (outputPath) {
            fs.writeFileSync(outputPath, output);
            console.log(`Directus types generated successfully at ${outputPath}!`);
        }

        return output;
	} catch (error) {
		console.error('Error generating Directus types:', error);
        throw error
	}
}