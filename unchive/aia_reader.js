import { AIProject, AIScreen, AIExtension, AIAsset } from './ai_project.js';

export class AIAReader {
    static async read(source) {
        return new Promise(async (resolve, reject) => {
            AIProject.descriptorJSON = await DescriptorGenerator.generate();

            const project = new AIProject();
            const reader = source instanceof Blob
                ? new zip.BlobReader(source)
                : new zip.HttpReader(source);

            zip.createReader(reader, (zipReader) => {
                zipReader.getEntries(async (entries) => {
                    if (entries.length) {
                        project.addExtensions(await this.generateExtensions(
                            entries.filter(e => this.getFileType(e) === 'json')
                        ));
                        project.addScreens(await this.generateScreens(
                            entries.filter(e => this.getFileType(e) === 'scm' || this.getFileType(e) === 'bky'),
                            project
                        ));
                        project.addAssets(await this.generateAssets(
                            entries.filter(e => e.filename.split('/')[0] === 'assets' && e.filename.split('/')[2] == null)
                        ));
                        resolve(project);
                    }
                });
            });
        });
    }

    static async generateScreens(entries, project) {
        const scms = [];
        const bkys = [];
        const screens = [];

        for (let entry of entries) {
            const content = await this.getFileContent(entry);
            if (this.getFileType(entry) === 'scm') {
                scms.push({ name: this.getFileName(entry), scm: content });
            } else if (this.getFileType(entry) === 'bky') {
                bkys.push({ name: this.getFileName(entry), bky: content });
            }
        }

        for (let scm of scms) {
            const screen = new AIScreen();
            const bky = bkys.find(b => b.name === scm.name);
            screens.push(screen.init(scm.scm, bky.bky, scm.name, project));
        }

        return Promise.all(screens);
    }

    static async generateExtensions(entries) {
        const buildInfos = [];
        const descriptors = [];
        const extensions = [];

        for (let entry of entries) {
            const content = await this.getFileContent(entry);
            const filename = this.getFileName(entry);

            if (filename === 'component_build_infos' || filename === 'component_build_info') {
                buildInfos.push({
                    name: entry.filename.split('/')[2],
                    info: JSON.parse(content)
                });
            } else if (filename === 'components' || filename === 'component') {
                descriptors.push({
                    name: entry.filename.split('/')[2],
                    descriptor: JSON.parse(content)
                });
            }
        }

        for (let buildInfo of buildInfos) {
            if (Array.isArray(buildInfo.info)) {
                for (let info of buildInfo.info) {
                    const descriptor = descriptors.find(d => d.name === buildInfo.name);
                    extensions.push(new AIExtension(
                        info.type,
                        descriptor.descriptor[buildInfo.info.indexOf(info)]
                    ));
                }
            } else {
                const descriptor = descriptors.find(d => d.name === buildInfo.name);
                extensions.push(new AIExtension(buildInfo.info.type, descriptor.descriptor));
            }
        }

        return extensions;
    }

    static async generateAssets(entries) {
        const assets = [];

        for (let entry of entries) {
            const content = await this.getFileContent(entry, new zip.BlobWriter());
            assets.push(new AIAsset(this.getFileName(entry), this.getFileType(entry), content));
        }

        return assets;
    }

    static getFileContent(entry, writer = new zip.TextWriter()) {
        return new Promise((resolve, reject) => {
            entry.getData(writer, (content) => {
                resolve(content);
            });
        });
    }

    static getFileType(entry) {
        return entry.filename.split('.').pop();
    }

    static getFileName(entry) {
        return entry.filename.split('/').pop().split('.')[0];
    }
}

export class DescriptorGenerator {
    static generate() {
        return new Promise((resolve, reject) => {
            this.fetchJSON((json) => {
                resolve(JSON.parse(json));
            });
        });
    }

    static fetchJSON(callback) {
        const xhr = new XMLHttpRequest();
        xhr.overrideMimeType('application/json');
        xhr.open('GET', fetchDir('unchive/simple_components.json'), true);
        xhr.onreadystatechange = function () {
            if (xhr.readyState === 4 && xhr.status === 200) {
                callback(xhr.responseText);
            }
        };
        xhr.send(null);
    }
}