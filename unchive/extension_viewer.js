// Extension Viewer - Generate documentation and blocks for App Inventor extensions

import { View } from '../views/view.js';
import { Label, Button, Downloader } from '../views/widgets.js';

/**
 * ExtensionViewer - Main class for viewing and documenting extensions
 */
export class ExtensionViewer {
    constructor(extension) {
        this.extension = extension;
        this.descriptor = extension.descriptorJSON || {};
    }

    getInfo() {
        const desc = this.descriptor;
        return {
            name: desc.name || 'Unknown Extension',
            type: this.extension.name || desc.type || 'Unknown',
            version: desc.version || 1,
            versionName: desc.versionName || String(desc.version || 1),
            description: this.cleanDescription(desc.helpString || desc.helpUrl || ''),
            dateBuilt: desc.dateBuilt,
            author: desc.author || 'Unknown',
            events: desc.events || [],
            methods: desc.methods || [],
            properties: desc.properties || [],
            blockProperties: desc.blockProperties || []
        };
    }

    cleanDescription(text) {
        if (!text) return 'No description available';
        return text.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim() || 'No description available';
    }

    /**
     * Generate markdown documentation with block image references
     * @param {boolean} includeImages - Whether to include block image references
     */
    generateMarkdown(includeImages = false) {
        const info = this.getInfo();
        const lines = [];
        const safeName = info.name.replace(/[^a-zA-Z0-9]/g, '_');

        // Header - professional centered design
        lines.push(`<div align="center">`);
        lines.push(``);
        lines.push(`# 🧩 ${info.name}`);
        lines.push(``);
        lines.push(`**An extension for MIT App Inventor 2**`);
        lines.push(``);
        if (info.description) {
            lines.push(`> ${this.cleanDescription(info.description)}`);
            lines.push(``);
        }
        lines.push(`</div>`);
        lines.push('');

        // Specifications - professional inline format
        lines.push('## 📝 Specifications');
        lines.push('');
        lines.push(`| 📦 Package | \`${info.type}\` |`);
        lines.push(`| :--- | :--- |`);
        lines.push(`| ⚙️ Version | \`${info.versionName}\` |`);
        if (info.author) lines.push(`| 👤 Author | ${info.author} |`);
        if (info.minSdk) lines.push(`| 📱 Min API | ${info.minSdk} |`);
        lines.push(`| 📅 Updated | ${info.dateBuilt ? info.dateBuilt.split('T')[0] : new Date().toISOString().split('T')[0]} |`);
        lines.push('');

        // Events
        if (info.events.length > 0) {
            lines.push(`## <kbd>Events:</kbd>`);
            lines.push(`**${info.name}** has total ${info.events.length} events.`);
            lines.push('');

            info.events.forEach((event, index) => {
                lines.push(`### ${index + 1}. ${event.name}`);
                if (event.description) lines.push(`${this.cleanDescription(event.description)}`);
                lines.push('');

                if (includeImages) {
                    lines.push(`![${event.name}](blocks/event_${safeName}_${event.name}.png)`);
                    lines.push('');
                }

                const params = event.params || [];
                if (params.length > 0) {
                    lines.push('| Parameter | Type |');
                    lines.push('| - | - |');
                    for (const p of params) lines.push(`| ${p.name} | ${p.type || 'any'} |`);
                    lines.push('');
                }
            });
        }

        // Methods
        if (info.methods.length > 0) {
            lines.push(`## <kbd>Methods:</kbd>`);
            lines.push(`**${info.name}** has total ${info.methods.length} methods.`);
            lines.push('');

            info.methods.forEach((method, index) => {
                lines.push(`### ${index + 1}. ${method.name}`);
                if (method.description) lines.push(`${this.cleanDescription(method.description)}`);
                lines.push('');

                if (includeImages) {
                    lines.push(`![${method.name}](blocks/method_${safeName}_${method.name}.png)`);
                    lines.push('');
                }

                const params = method.params || [];
                if (params.length > 0) {
                    lines.push('| Parameter | Type |');
                    lines.push('| - | - |');
                    for (const p of params) lines.push(`| ${p.name} | ${p.type || 'any'} |`);
                    lines.push('');
                }

                if (method.returnType && method.returnType !== 'void') {
                    lines.push(`* Returns: \`${method.returnType}\``);
                    lines.push('');
                }
            });
        }

        // Setters (Block Properties)
        if (info.blockProperties.length > 0) {
            lines.push(`## <kbd>Setters:</kbd>`);
            lines.push(`**${info.name}** has total ${info.blockProperties.length} setter properties.`);
            lines.push('');

            info.blockProperties.forEach((prop, index) => {
                lines.push(`### ${index + 1}. ${prop.name}`);
                if (prop.description) lines.push(`${this.cleanDescription(prop.description)}`);
                lines.push('');

                if (includeImages) {
                    if (prop.rw !== 'write-only') {
                        lines.push(`![Get ${prop.name}](blocks/property_get_${safeName}_${prop.name}.png)`);
                    }
                    if (prop.rw !== 'read-only') {
                        lines.push(`![Set ${prop.name}](blocks/property_set_${safeName}_${prop.name}.png)`);
                    }
                    lines.push('');
                }

                // Input type
                if (prop.type) {
                    lines.push(`* Input type: \`${prop.type}\``);
                }

                // Helper logic
                if (prop.helper) {
                    const helperData = prop.helper.data;
                    let helperTypeName = "";

                    // Determine Type Name
                    if (helperData && helperData.tag) {
                        helperTypeName = helperData.tag;
                    } else if (helperData && helperData.key) {
                        helperTypeName = helperData.key;
                    } else if (prop.helper.type && prop.helper.type !== "OPTION_LIST") {
                        helperTypeName = prop.helper.type;
                    }

                    if (helperTypeName) {
                        lines.push(`* Helper type: \`${helperTypeName}\``);
                    }

                    // Determine Enums
                    let enums = [];
                    if (helperData && helperData.options && Array.isArray(helperData.options)) {
                        enums = helperData.options.map(opt => opt.name);
                    } else if (helperData && Array.isArray(helperData)) {
                        enums = helperData;
                    } else if (helperData && helperData.keys && Array.isArray(helperData.keys)) {
                        enums = helperData.keys;
                    } else if (prop.helper.keys && Array.isArray(prop.helper.keys)) {
                        enums = prop.helper.keys;
                    }

                    if (enums && enums.length > 0) {
                        const enumString = enums.map(item => `\`${item}\``).join(', ');
                        lines.push(`* Helper enums: ${enumString}`);
                    }
                }

                lines.push('');
            });
        }

        // Regular Properties (Getters)
        if (info.properties.length > 0) {
            lines.push(`## <kbd>Properties:</kbd>`);
            lines.push(`**${info.name}** has total ${info.properties.length} properties.`);
            lines.push('');

            info.properties.forEach((prop, index) => {
                lines.push(`### ${index + 1}. ${prop.name}`);
                if (prop.description) lines.push(`${this.cleanDescription(prop.description)}`);
                lines.push('');

                if (prop.type) {
                    lines.push(`* Type: \`${prop.type}\``);
                }
                if (prop.rw) {
                    lines.push(`* Access: \`${prop.rw}\``);
                }
                lines.push('');
            });
        }

        // No items message if empty
        if (info.events.length === 0 && info.methods.length === 0 && info.blockProperties.length === 0 && info.properties.length === 0) {
            lines.push('');
            lines.push('> No events, methods, or properties found in this extension.');
            lines.push('');
        }

        // Professional Footer
        lines.push('');
        lines.push('---');
        lines.push('');
        lines.push('<div align="center">');
        lines.push('<br>');
        lines.push('<p>');
        lines.push('📄 <strong>Documentation generated with</strong> <a href="https://techhamara.github.io/ai-unchive/" target="_blank">ai-unchive</a>');
        lines.push('</p>');
        lines.push('<p>');
        lines.push('<sub>🛠️ Built for MIT App Inventor 2 & its distributions</sub>');
        lines.push('</p>');
        lines.push('</div>');
        lines.push('');

        return lines.join('\n');
    }

    generateHtmlDocumentation() {
        const md = this.generateMarkdown(false);
        let html = md
            .replace(/^# (.*$)/gim, '<h1>$1</h1>')
            .replace(/^## (.*$)/gim, '<h2>$1</h2>')
            .replace(/^### (.*$)/gim, '<h3>$1</h3>')
            .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
            .replace(/`([^`]*)`/gim, '<code>$1</code>')
            .replace(/<kbd>/gim, '<kbd>').replace(/<\/kbd>/gim, '</kbd>')
            .replace(/\n\n/gim, '<br><br>');
        return md.replace(/\n/g, '<br>');
    }

    downloadMarkdown() {
        const markdown = this.generateMarkdown(false);
        const info = this.getInfo();
        const filename = `${info.name.replace(/[^a-zA-Z0-9]/g, '_')}_docs.md`;
        const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
        Downloader.downloadBlob(blob, filename);
    }

    /**
     * Get all block definitions for generating PNGs
     */
    getBlockDefinitions() {
        const info = this.getInfo();
        const blocks = [];
        const safeName = info.name.replace(/[^a-zA-Z0-9]/g, '_');

        // Events
        for (const event of info.events) {
            blocks.push({
                type: 'event',
                name: event.name,
                filename: `event_${safeName}_${event.name}`,
                data: event
            });
        }

        // Methods
        for (const method of info.methods) {
            blocks.push({
                type: 'method',
                name: method.name,
                filename: `method_${safeName}_${method.name}`,
                data: method
            });
        }

        // Block Properties
        for (const prop of info.blockProperties) {
            if (prop.rw !== 'write-only') {
                blocks.push({
                    type: 'property_get',
                    name: `Get ${prop.name}`,
                    filename: `property_get_${safeName}_${prop.name}`,
                    data: prop
                });
            }
            if (prop.rw !== 'read-only') {
                blocks.push({
                    type: 'property_set',
                    name: `Set ${prop.name}`,
                    filename: `property_set_${safeName}_${prop.name}`,
                    data: prop
                });
            }
        }

        return blocks;
    }
}

/**
 * MockBlockRenderer - Creates visual SVG blocks for extensions
 */
export class MockBlockRenderer {

    static COLORS = {
        event: '#C49000',
        method: '#5C6BC0',
        property_get: '#43A047',
        property_set: '#388E3C'
    };

    static createEventBlock(event, componentName) {
        const params = event.params || [];
        const h = 40 + params.length * 24;
        const w = Math.max(200, (componentName + event.name).length * 7 + 80);

        const svg = this.createSvg(w + 20, h + 20);

        // Block shape - event (hat block)
        const path = this.createPath(
            `M10,20 Q10,10 20,10 L${w - 10},10 Q${w},10 ${w},20 L${w},${h} L${w - 30},${h} l-5,8 l-20,0 l-5,-8 L10,${h} Z`,
            this.COLORS.event
        );
        svg.appendChild(path);

        // Title
        svg.appendChild(this.createText(`when ${componentName}.${event.name}`, 18, 30, 'bold'));

        // Parameters
        let y = 54;
        for (const p of params) {
            svg.appendChild(this.createText(p.name, 24, y));
            svg.appendChild(this.createSocket(w - 55, y - 14, 45, 18));
            y += 24;
        }

        return svg;
    }

    static createMethodBlock(method, componentName) {
        const params = method.params || [];
        const h = 36 + params.length * 24;
        const w = Math.max(180, (componentName + method.name).length * 7 + 60);

        const svg = this.createSvg(w + 20, h + 20);

        // Block shape with notches
        const path = this.createPath(
            `M10,10 L25,10 l5,-8 l20,0 l5,8 L${w},10 L${w},${h} L45,${h} l-5,8 l-20,0 l-5,-8 L10,${h} Z`,
            this.COLORS.method
        );
        svg.appendChild(path);

        // Title
        svg.appendChild(this.createText(`call ${componentName}.${method.name}`, 16, 28, 'bold'));

        // Parameters
        let y = 52;
        for (const p of params) {
            svg.appendChild(this.createText(p.name, 22, y));
            svg.appendChild(this.createSocket(w - 55, y - 14, 45, 18));
            y += 24;
        }

        return svg;
    }

    static createPropertyGetterBlock(prop, componentName) {
        const w = Math.max(140, (componentName + prop.name).length * 6 + 40);

        const svg = this.createSvg(w + 30, 50);

        // Reporter block (rounded with output)
        const path = this.createPath(
            `M10,10 L${w},10 L${w},18 L${w + 10},25 L${w},32 L${w},40 L10,40 L10,32 L0,25 L10,18 Z`,
            this.COLORS.property_get
        );
        svg.appendChild(path);

        svg.appendChild(this.createText(`${componentName}.${prop.name}`, 18, 30, 'bold'));

        return svg;
    }

    static createPropertySetterBlock(prop, componentName) {
        const w = Math.max(200, (componentName + prop.name).length * 6 + 100);

        const svg = this.createSvg(w + 20, 55);

        // Setter block with notches
        const path = this.createPath(
            `M10,10 L25,10 l5,-8 l20,0 l5,8 L${w},10 L${w},45 L45,45 l-5,8 l-20,0 l-5,-8 L10,45 Z`,
            this.COLORS.property_set
        );
        svg.appendChild(path);

        svg.appendChild(this.createText(`set ${componentName}.${prop.name} to`, 16, 32, 'bold'));
        svg.appendChild(this.createSocket(w - 55, 18, 45, 18));

        return svg;
    }

    // Helper methods
    static createSvg(width, height) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', width);
        svg.setAttribute('height', height);
        svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
        svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        svg.classList.add('mock-block-svg');
        return svg;
    }

    static createPath(d, fill) {
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', d);
        path.setAttribute('fill', fill);
        path.setAttribute('stroke', this.darkenColor(fill));
        path.setAttribute('stroke-width', '1');
        return path;
    }

    static createText(content, x, y, weight = 'normal') {
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', x);
        text.setAttribute('y', y);
        text.setAttribute('fill', '#FFFFFF');
        text.setAttribute('font-family', 'Arial, sans-serif');
        text.setAttribute('font-size', '12');
        text.setAttribute('font-weight', weight);
        text.textContent = content;
        return text;
    }

    static createSocket(x, y, w, h) {
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', x);
        rect.setAttribute('y', y);
        rect.setAttribute('width', w);
        rect.setAttribute('height', h);
        rect.setAttribute('rx', '4');
        rect.setAttribute('fill', 'rgba(255,255,255,0.3)');
        return rect;
    }

    static darkenColor(hex) {
        const num = parseInt(hex.slice(1), 16);
        const r = Math.max(0, (num >> 16) - 40);
        const g = Math.max(0, ((num >> 8) & 0x00FF) - 40);
        const b = Math.max(0, (num & 0x0000FF) - 40);
        return `#${(r << 16 | g << 8 | b).toString(16).padStart(6, '0')}`;
    }

    /**
     * Convert SVG to PNG blob
     */
    static async svgToPngBlob(svgElement, scale = 2) {
        return new Promise((resolve, reject) => {
            try {
                const w = (parseInt(svgElement.getAttribute('width')) || 200) * scale;
                const h = (parseInt(svgElement.getAttribute('height')) || 50) * scale;

                // Clone and set namespace
                const clone = svgElement.cloneNode(true);
                clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
                clone.setAttribute('width', w);
                clone.setAttribute('height', h);

                // Serialize to string
                const svgString = new XMLSerializer().serializeToString(clone);
                const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
                const url = URL.createObjectURL(svgBlob);

                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = w;
                    canvas.height = h;

                    const ctx = canvas.getContext('2d');
                    // White background
                    ctx.fillStyle = '#FFFFFF';
                    ctx.fillRect(0, 0, w, h);
                    // Draw image
                    ctx.drawImage(img, 0, 0, w, h);

                    canvas.toBlob((blob) => {
                        URL.revokeObjectURL(url);
                        if (blob) {
                            resolve(blob);
                        } else {
                            reject(new Error('Canvas toBlob failed'));
                        }
                    }, 'image/png');
                };

                img.onerror = (e) => {
                    URL.revokeObjectURL(url);
                    console.error('Image load error:', e);
                    reject(new Error('Failed to load SVG image'));
                };

                img.src = url;
            } catch (err) {
                console.error('svgToPngBlob error:', err);
                reject(err);
            }
        });
    }
}

/**
 * BlockExporter - Export blocks as ZIP
 */
export class BlockExporter {
    static async exportAllToZip(blocks, filename) {
        return new Promise((resolve, reject) => {
            zip.createWriter(new zip.BlobWriter('application/zip'), async (writer) => {
                try {
                    for (let i = 0; i < blocks.length; i++) {
                        const block = blocks[i];
                        const blob = await MockBlockRenderer.svgToPngBlob(block.svg);
                        const name = `${i}_${block.name.replace(/[^a-zA-Z0-9]/g, '_')}.png`;
                        await new Promise((res, rej) => {
                            writer.add(name, new zip.BlobReader(blob), res, rej);
                        });
                    }
                    writer.close((blob) => {
                        Downloader.downloadBlob(blob, filename);
                        resolve();
                    });
                } catch (err) {
                    console.error('ZIP error:', err);
                    reject(err);
                }
            }, reject);
        });
    }
}
