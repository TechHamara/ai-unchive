import { DescriptorGenerator } from './aia_reader.js';
import { View } from '../views/view.js';

export class AIProject {
    constructor(name) {
        this.name = name;
        this.screens = [];
        this.extensions = [];
        this.assets = [];
    }

    addAssets(assets) {
        for (let asset of assets) {
            this.addAsset(asset);
        }
    }

    addScreens(screens) {
        for (let screen of screens) {
            this.addScreen(screen);
        }
    }

    addExtensions(extensions) {
        for (let ext of extensions) {
            this.addExtension(ext);
        }
    }

    addAsset(asset) {
        if (!(asset instanceof AIAsset)) {
            throw new TypeError('Attempt to add ' + typeof asset + ' to AIProject');
        }
        this.assets.push(asset);
    }

    addScreen(screen) {
        if (!(screen instanceof AIScreen)) {
            throw new TypeError('Attempt to add ' + typeof screen + ' to AIProject');
        }
        this.screens.push(screen);
    }

    addExtension(extension) {
        if (!(extension instanceof AIExtension)) {
            throw new TypeError('Attempt to add ' + typeof extension + ' to AIProject');
        }
        this.extensions.push(extension);
    }
}

export class AIScreen {
    async init(scm, bky, name, project) {
        this.addToProject(project);
        this.form = await this.generateSchemeData(scm);
        this.generateBlocks(bky);
        this.name = name;
        if (name == null) {
            throw new TypeError('Screen name cannot be null!');
        }
        return this;
    }

    addToProject(project) {
        if (!(project instanceof AIProject)) {
            throw new TypeError('Attempt to set ' + typeof project + ' as project of AIScreen');
        }
        this.project = project;
    }

    async generateSchemeData(scm) {
        const json = JSON.parse(scm.substring(9, scm.length - 3));
        return this.generateComponent(json.Properties);
    }

    async generateComponent(properties) {
        let origin;
        const extension = this.project.extensions.find(ext =>
            ext.name.split('.').pop() === properties.$Type
        );

        if (extension != null) {
            var descriptor = extension.descriptorJSON;
            origin = 'EXTENSION';
        } else {
            origin = 'BUILT-IN';
        }

        const component = new Component(properties.$Name, properties.$Type, properties.Uuid || 0, origin);
        component.properties = await component.loadProperties(properties, descriptor || null);

        for (let child of properties.$Components || []) {
            component.addChild(await this.generateComponent(child));
        }

        return component;
    }

    generateBlocks(bky) {
        this.blocks = bky;
    }
}

class Component {
    constructor(name, type, uid, origin) {
        this.name = name;
        this.type = type;
        this.uid = uid;
        this.children = [];
        this.origin = origin;
        this.properties = [];
        this.faulty = false;
    }

    loadProperties(propertyJSON, descriptorJSON) {
        return new Promise(async (resolve, reject) => {
            if (AIProject.descriptorJSON == null) {
                AIProject.descriptorJSON = await DescriptorGenerator.generate();
            }

            const worker = new Worker('unchive/property_processor.js');

            try {
                const descriptor = descriptorJSON || AIProject.descriptorJSON.find(d =>
                    d.type === 'com.google.appinventor.components.runtime.' + this.type
                );

                worker.postMessage({
                    type: this.name,
                    propertyJSON: propertyJSON,
                    descriptorJSON: (descriptor?.properties) || []
                });
            } catch (error) {
                console.log('Error in ' + this.name + '(' + this.uid + ' / ' + this.type + '), message: ' + error.message);
                this.faulty = true;
                resolve([]);
                worker.terminate();
            }

            worker.addEventListener('message', (e) => {
                resolve(e.data.properties);
                worker.terminate();
            });
        });
    }

    addChild(child) {
        if (!(child instanceof Component)) {
            throw new TypeError('Attempt to add ' + typeof child + ' to Component.');
        }
        this.children.push(child);
    }
}

export class AIExtension {
    constructor(name, descriptorJSON) {
        this.name = name;
        this.descriptorJSON = descriptorJSON;
    }
}

export class AIAsset {
    constructor(name, type, blob) {
        this.name = name;
        this.type = type;
        this.blob = blob;
        this.size = blob.size;
        this.url = '';
    }

    getURL() {
        if (this.url === '') {
            this.url = URL.createObjectURL(this.blob);
        }
        return this.url;
    }

    revokeURL() {
        URL.revokeObjectURL(this.url);
    }
}

export class BlocklyWorkspace {
    constructor(blocks) {
        this.workspaceView = new View('DIV');
        this.loaded = false;
        this.blocks = blocks;
        this.faulty = false;
        this.validTypes = ['global_declaration', 'component_event', 'procedures_defnoreturn', 'procedures_defreturn', 'component_method', 'component_set_get'];
    }

    initializeWorkspace() {
        if (this.loaded) {
            this.resizeWorkspace();
        } else {
            this.loaded = true;
            this.workspace = Blockly.inject(this.workspaceView.domElement, {
                toolbox: false,
                trashcan: false,
                readOnly: true,
                scrollbars: false
            });
            this.workspace.setScale(1);
            this.workspace.getDescriptor = (type) => {
                let descriptor = AIProject.descriptorJSON.find(d =>
                    d.type === 'com.google.appinventor.components.runtime.' + type
                );
                if (descriptor == null) {
                    for (let ext of RootPanel.project?.extensions || []) {
                        if (ext.name.split('.').pop() === type) {
                            return ext.descriptorJSON;
                        }
                    }
                }
                return descriptor;
            };
            this.addBlocksToWorkspace();
            this.resizeWorkspace();
        }
    }

    addBlocksToWorkspace() {
        try {
            Blockly.Xml.domToBlock(this.blocks, this.workspace).setCollapsed(false);
        } catch (error) {
            this.faulty = true;
        } finally {
            if (this.validTypes.indexOf(this.blocks.getAttribute('type')) === -1) {
                this.faulty = true;
            }
        }
    }

    resizeWorkspace() {
        const metrics = this.workspace.getMetrics();
        this.workspaceView.setAttribute('style',
            'height: ' + metrics.contentHeight + 'px;width: ' + metrics.contentWidth + 'px;'
        );
        Blockly.svgResize(this.workspace);
    }

    getWorkspaceView() {
        return this.workspaceView;
    }
}