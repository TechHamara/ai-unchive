// AIX Reader - Parse App Inventor Extension (.aix) files
// Uses same logic pattern as AIAReader for consistency

import { AIExtension } from './ai_project.js';

export class AIXReader {
    /**
     * Read and parse an .aix extension file
     * @param {Blob|string} source - The .aix file blob or URL
     * @returns {Promise<AIExtension[]>} - Array of parsed extensions
     */
    static async read(source) {
        return new Promise((resolve, reject) => {
            const reader = source instanceof Blob
                ? new zip.BlobReader(source)
                : new zip.HttpReader(source);

            zip.createReader(reader, (zipReader) => {
                zipReader.getEntries(async (entries) => {
                    if (entries.length) {
                        try {
                            // Log entries for debugging
                            console.log('=== AIX File Contents ===');
                            entries.forEach(e => console.log(e.filename));
                            console.log('========================');

                            // Filter JSON files only (same as AIAReader)
                            const jsonEntries = entries.filter(e => this.getFileType(e) === 'json');
                            console.log('JSON files found:', jsonEntries.length);

                            const extensions = await this.generateExtensions(jsonEntries);
                            zipReader.close();

                            if (extensions.length === 0) {
                                reject(new Error('No extension found. Make sure .aix contains components.json'));
                            } else {
                                resolve(extensions);
                            }
                        } catch (error) {
                            zipReader.close();
                            console.error('Parse error:', error);
                            reject(error);
                        }
                    } else {
                        zipReader.close();
                        reject(new Error('Empty .aix file'));
                    }
                });
            }, (error) => {
                reject(new Error('Failed to read .aix: ' + error));
            });
        });
    }

    /**
     * Generate extensions from JSON entries (same logic as AIAReader.generateExtensions)
     */
    static async generateExtensions(entries) {
        const buildInfos = [];
        const descriptors = [];
        const extensions = [];

        // Read all JSON files
        for (let entry of entries) {
            try {
                const content = await this.getFileContent(entry);
                const filename = this.getFileName(entry);

                console.log('Processing JSON file:', entry.filename, '-> filename:', filename);

                // Check for component_build_info(s).json
                if (filename === 'component_build_infos' || filename === 'component_build_info') {
                    console.log('Found build info:', entry.filename);
                    buildInfos.push({
                        name: this.getExtensionFolder(entry),
                        info: JSON.parse(content)
                    });
                }
                // Check for components.json or component.json
                else if (filename === 'components' || filename === 'component') {
                    console.log('Found descriptor:', entry.filename);
                    descriptors.push({
                        name: this.getExtensionFolder(entry),
                        descriptor: JSON.parse(content)
                    });
                }
            } catch (error) {
                console.error('Error reading:', entry.filename, error);
            }
        }

        console.log('Build infos found:', buildInfos.length);
        console.log('Descriptors found:', descriptors.length);

        // Create extensions from build infos (same as AIAReader)
        for (let buildInfo of buildInfos) {
            if (Array.isArray(buildInfo.info)) {
                for (let i = 0; i < buildInfo.info.length; i++) {
                    const info = buildInfo.info[i];
                    const descriptor = descriptors.find(d => d.name === buildInfo.name);
                    if (descriptor) {
                        const desc = Array.isArray(descriptor.descriptor)
                            ? descriptor.descriptor[i]
                            : descriptor.descriptor;
                        extensions.push(new AIExtension(info.type, desc));
                    }
                }
            } else {
                const descriptor = descriptors.find(d => d.name === buildInfo.name);
                if (descriptor) {
                    const desc = Array.isArray(descriptor.descriptor)
                        ? descriptor.descriptor[0]
                        : descriptor.descriptor;
                    extensions.push(new AIExtension(buildInfo.info.type, desc));
                }
            }
        }

        // Fallback: if no buildInfo but we have descriptors, use descriptors directly
        if (extensions.length === 0 && descriptors.length > 0) {
            console.log('Using descriptors directly (no build info)');
            for (let desc of descriptors) {
                const data = Array.isArray(desc.descriptor) ? desc.descriptor : [desc.descriptor];
                for (let d of data) {
                    extensions.push(new AIExtension(d.type || d.name || 'Extension', d));
                }
            }
        }

        console.log('Extensions created:', extensions.length);
        return extensions;
    }

    /**
     * Get file content as text (same as AIAReader)
     */
    static getFileContent(entry, writer = new zip.TextWriter()) {
        return new Promise((resolve, reject) => {
            entry.getData(writer, (content) => {
                resolve(content);
            });
        });
    }

    /**
     * Get file extension (same as AIAReader)
     */
    static getFileType(entry) {
        return entry.filename.split('.').pop().toLowerCase();
    }

    /**
     * Get filename without extension (same as AIAReader)
     */
    static getFileName(entry) {
        return entry.filename.split('/').pop().split('.')[0];
    }

    /**
     * Get extension folder name from path
     * e.g., "com/example/MyExtension/files/component_build_infos.json" -> "MyExtension"
     */
    static getExtensionFolder(entry) {
        const parts = entry.filename.split('/');
        // Find the folder that contains the JSON files
        // Usually structure is: com/company/ExtensionName/files/file.json
        // or: com/company/ExtensionName/file.json
        if (parts.length >= 3) {
            // Return the 3rd folder (extension name typically)
            return parts[2] || parts[1] || parts[0];
        }
        return parts[0];
    }
}
