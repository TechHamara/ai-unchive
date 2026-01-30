import { View } from '../view.js';
import { Label, Button, Downloader, AssetFormatter } from '../widgets.js';
import { NodeList } from './node_list.js';
import { BlocklyWorkspace } from '../../unchive/ai_project.js';

export class Node extends View {
    static async promiseNode(caption, subText) {
        return new Node(caption, subText);
    }

    constructor(caption, subText) {
        super('DIV');
        this.captionView = new Label();
        this.addView(this.captionView);
        this.addStyleName('unchive-node');
        this.subText = subText || '';
        this.setCaption(caption);
    }

    setCaption(caption) {
        this.caption = caption;
        this.captionView.setHTML(caption + '<br><small>' + this.subText + '</small>');
    }

    setSubText(subText) {
        this.subText = subText;
        this.captionView.setHTML(this.caption + '<br><small>' + subText + '</small>');
    }

    setNodeList(nodeList) {
        this.containerNodeList = nodeList;
    }
}

export class HeaderNode extends Node {
    static async promiseNode(caption, icon) {
        return new HeaderNode(caption, icon);
    }

    constructor(caption, icon) {
        super(caption);
        this.iconView = new Label('<i class="material-icons">' + icon + '</i>', true);
        this.insertView(this.iconView, 1);
    }

    addClickListener(callback) {
        this.domElement.addEventListener('click', (e) => {
            callback(e);
        });
    }
}

class PropertyNode extends Node {
    static async promiseNode(name, value) {
        return new PropertyNode(name, value);
    }

    constructor(name, value) {
        super(Messages[name + 'Properties'] || name);
        this.captionView.addStyleName('unchive-property-node__property-name');
        this.valueView = new Label(value);
        this.valueView.addStyleName('unchive-property-node__property-value');
        this.addView(this.valueView);
        this.addStyleName('unchive-property-node');
    }
}

export class ChainedNode extends Node {
    static async promiseNode(caption, subText, data) {
        return new ChainedNode(caption, subText, data);
    }

    constructor(caption, subText, data) {
        super(caption, subText);
        this.addStyleName('unchive-node--chained');
        this.arrowLabel = new Label('<i class="material-icons">keyboard_arrow_right</i>', true);
        this.arrowLabel.addStyleName('unchive-node__icon--right');
        this.addView(this.arrowLabel);
        this.domElement.addEventListener('click', (e) => {
            this.open();
        });
        this.initializeChain(data);
    }

    open() {
        if (!this.chainNodeList.visible) {
            this.setChainVisible(true);
            if (this.containerNodeList.activeNode && this.containerNodeList.activeNode instanceof ChainedNode) {
                this.containerNodeList.activeNode.setChainVisible(false);
            }
            this.containerNodeList.setActiveNode(this);
        }
    }

    setChainVisible(visible) {
        this.chainNodeList.setVisible(visible);
        if (visible) {
            RootPanel.nodeListContainer.addView(this.chainNodeList);
        } else if (RootPanel.nodeListContainer.hasView(this.chainNodeList)) {
            RootPanel.nodeListContainer.removeView(this.chainNodeList);
            if (this.chainNodeList.activeNode instanceof ChainedNode) {
                this.chainNodeList.activeNode.setChainVisible(false);
            }
            this.chainNodeList.setActiveNode(undefined);
        }
    }

    async initializeChain(data) {
        this.chainNodeList = new NodeList();
        this.generateChain(data);
        this.setChainVisible(false);
    }

    async generateChain(data) { }
}

class ComponentNode extends ChainedNode {
    static async promiseNode(name, type, data) {
        return new ComponentNode(name, type, data);
    }

    constructor(name, type, data) {
        super(name, Messages[type.charAt(0).toLowerCase() + type.slice(1) + 'ComponentPallette'] || type, data);
        if (data.faulty) {
            this.arrowLabel.setHTML('<i class="material-icons">error</i>');
            this.addStyleName('unchive-node--faulty');
        }
    }

    async generateChain(data) {
        this.generatePropertyNodes(data.properties);
    }

    async generatePropertyNodes(properties) {
        try {
            for (let prop of properties) {
                let node = PropertyNode.promiseNode(
                    prop.name,
                    prop.editorType === 'color' ? prop.value.replace('&H', '#') : prop.value
                );
                this.chainNodeList.addNodeAsync(node);
                if (properties.indexOf(prop) === 0) {
                    node.then((n) => {
                        this.firstPropertyNode = n.domElement;
                        n.addStyleName('unchive-node--first-of-type');
                    });
                }
            }
        } catch (e) {
            console.log('Error in ' + this.caption + ', message: ' + e.message);
        }
    }
}

class ContainerNode extends ComponentNode {
    static async promiseNode(name, type, data) {
        return new ContainerNode(name, type, data);
    }

    async generateChain(data) {
        this.createHeader();
        this.generateChildNodes(data.children);
        this.generatePropertyNodes(data.properties);
        this.header.addClickListener((e) => {
            this.firstPropertyNode.scrollIntoView({ block: 'start', behavior: 'smooth' });
        });
    }

    async createHeader() {
        this.header = new HeaderNode('Jump to properties', 'double_arrow');
        this.header.addStyleName('unchive-node--component-container--header');
        this.chainNodeList.addNode(this.header);
    }

    async generateChildNodes(children) {
        for (let child of children) {
            if (child.children[0] != null) {
                this.chainNodeList.addNodeAsync(ContainerNode.promiseNode(child.name, child.type, child));
            } else {
                this.chainNodeList.addNodeAsync(ComponentNode.promiseNode(child.name, child.type, child));
            }
        }
    }
}

export class ScreenNode extends ContainerNode {
    static async promiseNode(screen) {
        return new ScreenNode(screen);
    }

    constructor(screen) {
        if (screen.name !== 'Screen1') {
            screen.form.properties = screen.form.properties.filter(p =>
                p.name !== 'AccentColor' && p.name !== 'AppId' && p.name !== 'Icon' &&
                p.name !== 'MinSdk' && p.name !== 'PackageName' && p.name !== 'PrimaryColor' &&
                p.name !== 'PrimaryColorDark' && p.name !== 'ReceiveSharedText' &&
                p.name !== 'ShowListsAsJson' && p.name !== 'Sizing' && p.name !== 'SplashEnabled' &&
                p.name !== 'SplashIcon' && p.name !== 'Theme' && p.name !== 'TutorialURL' &&
                p.name !== 'VersionCode' && p.name !== 'VersionName'
            );
        }
        super(screen.name, Messages.screenComponentPallette, screen);
    }

    async generateChain(screen) {
        this.createHeader();
        this.chainNodeList.addNode(new WorkspaceNode(screen.blocks));
        this.generateChildNodes(screen.form.children);
        this.generatePropertyNodes(screen.form.properties);
        this.header.addClickListener((e) => {
            this.firstPropertyNode.scrollIntoView({ block: 'start', behavior: 'smooth' });
        });
    }
}

class WorkspaceNode extends ChainedNode {
    static async promiseNode(blocks) {
        return new WorkspaceNode(blocks);
    }

    constructor(blocks) {
        super('Blocks', '', new DOMParser().parseFromString(blocks, 'text/xml'));
        this.chainNodeList.addStyleName('node-list--blocks-list');
    }

    async generateChain(xmlDoc) {
        this.createHeader();
        this.blockNodes = [];
        const xmlElement = xmlDoc.getElementsByTagName('xml')[0];
        for (let child of xmlElement.children) {
            if (child.tagName === 'block') {
                let node = BlockNode.promiseNode(child);
                this.blockNodes.push(node);
                this.chainNodeList.addNodeAsync(node);
            }
        }
    }

    createHeader() {
        this.isGridView = true;
        this.zoomLevel = 1;

        // Container for controls
        this.header = new HeaderNode('', 'grid_view'); // Icon handled manually
        this.header.addStyleName('unchive-node--component-container--header');
        // Clear default content
        this.header.domElement.innerHTML = '';
        this.header.domElement.style.display = 'flex';
        this.header.domElement.style.alignItems = 'center';
        this.header.domElement.style.justifyContent = 'space-between';
        this.header.domElement.style.gap = '8px';
        this.header.domElement.style.padding = '8px 16px';

        // Toggle Button
        const toggleBtn = document.createElement('div');
        toggleBtn.innerHTML = '<i class="material-icons">grid_view</i>';
        toggleBtn.style.cursor = 'pointer';
        toggleBtn.style.padding = '8px';
        toggleBtn.title = "Toggle View";
        toggleBtn.onclick = () => this.toggleView(toggleBtn);
        this.toggleBtnIcon = toggleBtn.querySelector('i');

        // Zoom Controls Container
        const zoomControls = document.createElement('div');
        zoomControls.style.display = 'flex';
        zoomControls.style.alignItems = 'center';
        zoomControls.style.gap = '8px';

        // Zoom Out
        const zoomOutBtn = document.createElement('div');
        zoomOutBtn.innerHTML = '<i class="material-icons">remove</i>';
        zoomOutBtn.style.cursor = 'pointer';
        zoomOutBtn.style.padding = '8px';
        zoomOutBtn.onclick = () => this.applyZoom(-0.1);

        // Zoom Label
        this.zoomLabel = document.createElement('span');
        this.zoomLabel.textContent = '100%';
        this.zoomLabel.style.minWidth = '45px';
        this.zoomLabel.style.textAlign = 'center';
        this.zoomLabel.style.fontSize = '14px';

        // Zoom In
        const zoomInBtn = document.createElement('div');
        zoomInBtn.innerHTML = '<i class="material-icons">add</i>';
        zoomInBtn.style.cursor = 'pointer';
        zoomInBtn.style.padding = '8px';
        zoomInBtn.onclick = () => this.applyZoom(0.1);

        // Append components
        zoomControls.appendChild(zoomOutBtn);
        zoomControls.appendChild(this.zoomLabel);
        zoomControls.appendChild(zoomInBtn);

        this.header.domElement.appendChild(toggleBtn);
        this.header.domElement.appendChild(zoomControls);

        this.chainNodeList.addNode(this.header);
    }

    toggleView(btn) {
        this.isGridView = !this.isGridView;
        if (this.isGridView) {
            this.chainNodeList.removeStyleName('node-list--list-view');
            this.toggleBtnIcon.textContent = 'grid_view';
        } else {
            this.chainNodeList.addStyleName('node-list--list-view');
            this.toggleBtnIcon.textContent = 'view_list';
        }
    }

    applyZoom(delta) {
        this.zoomLevel += delta;
        this.zoomLevel = Math.min(Math.max(0.2, this.zoomLevel), 3); // Clamp 20% - 300%

        // Update Label
        this.zoomLabel.textContent = `${Math.round(this.zoomLevel * 100)}%`;

        // Apply Zoom to the Node List content (excluding header ideally, but header is inside list)
        // Ideally we want to zoom the BLOCKS only.
        // Let's iterate over blockNodes and zoom them?
        // Or set zoom on the container but inverse zoom on header?
        // Easiest for now: Apply zoom to container. Header will zoom too, which is okay, 
        // OR we can make header sticky/inverse scale. 
        // Better: Apply css property 'zoom' to the container.

        // Note: 'zoom' is non-standard but works well for this in Chrome/Edge. 
        // For standard, use transform: scale() with transform-origin: top left.
        // However, transform: scale() breaks layout flow (scrollbars don't adjust). 
        // 'zoom' readjusts layout. We'll use 'zoom' as user is likely on Chrome/Android WebView.

        // We need to apply zoom to the nodes, NOT the header.
        // But nodes are siblings of header in chainNodeList.
        // Let's apply a style to all 'unchive-block-node' elements?
        // Or wrap blocks in a div? changing DOM structure is risky.

        // Let's try zooming the whole list first.
        this.chainNodeList.domElement.style.zoom = this.zoomLevel;

        // If header becomes too small/big, we can inverse scale it.
        // block-node download button might also need inverse scale if we zoom out too much?
    }

    setChainVisible(visible) {
        super.setChainVisible(visible);
        if (visible) {
            // Apply Zoom Interactivity
            // We removed custom pan logic to allow native scrolling.
            this.setupZoom();

            for (let nodePromise of this.blockNodes) {
                nodePromise.then((node) => {
                    node.initializeWorkspace();
                });
            }
        }
    }

    setupZoom() {
        // Disabled custom pan logic to fix vertical scrolling
        const container = this.chainNodeList.domElement;
        container.style.overflow = ''; // Ensure native scroll works
        container.style.cursor = 'default';
        container.style.touchAction = 'auto';
    }
}

class BlockNode extends Node {
    static async promiseNode(blockElement) {
        return new BlockNode(blockElement);
    }

    constructor(blockElement) {
        super();
        this.removeStyleName('unchive-node'); // Remove default list style
        this.addStyleName('unchive-block-node');

        // Extract block type or name for the label
        let blockLabel = blockElement.getAttribute('type');

        // Try to find more specific name (e.g. for component events/methods)
        // XML usually looks like <block type="component_event"><field name="COMPONENT_SELECTOR">Button1</field>...</block>
        // Or specific mutation logic.

        // Simple heuristic: If it has a 'type' attribute, use that. 
        // We can prettify it: 'component_event' -> 'Component Event'
        // Or look for a key field.

        if (blockLabel) {
            // Optional: format label
            // blockLabel = blockLabel.replace(/_/g, ' '); 
            this.setCaption(blockLabel);
        } else {
            this.setCaption('Block');
        }

        // Container for preview logic
        this.previewContainer = new View('DIV');
        this.previewContainer.addStyleName('unchive-block-node__preview');
        this.addView(this.previewContainer);

        this.blockElement = blockElement;
        this.workspace = new BlocklyWorkspace(blockElement);

        // Add download button
        this.downloadButton = new Button('download', true);
        this.downloadButton.addStyleName('block-node__download-btn');
        this.downloadButton.domElement.title = 'Download block as PNG';
        this.downloadButton.addClickListener((e) => {
            e.stopPropagation();
            this.downloadAsPNG();
        });
        this.addView(this.downloadButton);

        this.previewContainer.addView(this.workspace.getWorkspaceView());
    }

    initializeWorkspace() {
        this.workspace.initializeWorkspace();
        if (this.workspace.faulty) {
            this.addStyleName('unchive-block-node--faulty');
        }
    }

    async downloadAsPNG() {
        const svg = this.domElement.querySelector('svg.blocklySvg');
        if (!svg) {
            console.error('No SVG found');
            return;
        }

        try {
            // Get block type for filename
            const blockType = this.blockElement.getAttribute('type') || 'block';
            const filename = `${blockType}_${Date.now()}.png`;

            // Convert SVG to PNG with proper styling
            const blob = await svgToPngBlob(svg);
            Downloader.downloadBlob(blob, filename);
        } catch (error) {
            console.error('Failed to download block:', error);
        }
    }
}

/**
 * Convert SVG element to PNG blob with proper styling
 * Fixed: Properly copies CSS styles and avoids black fill
 */
export async function svgToPngBlob(svgElement, scale = 2) {
    return new Promise((resolve, reject) => {
        try {
            // Get SVG content Bounding Box
            let bbox;
            // Try to find the inner workspace canvas or block canvas to get precise content size
            // Note: blocklyBlockCanvas works for main blocks, but let's check for any content group
            const contentGroup = svgElement.querySelector('.blocklyBlockCanvas') ||
                svgElement.querySelector('.blocklyWorkspace') ||
                svgElement;

            try {
                // getBBox gives the bounding box of the content in user units
                bbox = contentGroup.getBBox();
            } catch (e) {
                // Fallback if getBBox fails (e.g. on outer SVG in some contexts)
                bbox = { x: 0, y: 0, width: 100, height: 100 };
                // Using getBoundingClientRect as fallback
                const rect = svgElement.getBoundingClientRect();
                bbox.width = rect.width;
                bbox.height = rect.height;
            }

            const padding = 20;

            // Dimensions including padding matches the content size
            const width = (bbox.width + padding * 2) * scale;
            const height = (bbox.height + padding * 2) * scale;

            // Clone and prepare SVG
            const svgClone = svgElement.cloneNode(true);
            svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

            // Set viewBox to the bounding box of the content so it renders fully
            // x, y, width, height. We subtract padding from x/y to effectively add padding around content
            svgClone.setAttribute('viewBox', `${bbox.x - padding} ${bbox.y - padding} ${bbox.width + padding * 2} ${bbox.height + padding * 2}`);

            svgClone.setAttribute('width', width);
            svgClone.setAttribute('height', height);

            // Add inline styles from the page
            const styleElement = document.createElement('style');
            let cssText = '';

            // Copy relevant CSS rules
            try {
                for (const sheet of document.styleSheets) {
                    try {
                        for (const rule of sheet.cssRules || []) {
                            if (rule.cssText && rule.cssText.includes('blockly')) {
                                cssText += rule.cssText + '\n';
                            }
                        }
                    } catch (e) {
                        // Cross-origin stylesheets may throw
                    }
                }
            } catch (e) {
                console.warn('Could not copy stylesheets:', e);
            }

            // Add essential styles for proper rendering
            cssText += `
        .blocklySvg { background: transparent !important; }
        .blocklyMainBackground { fill: transparent !important; stroke: none !important; }
        .blocklyPath { stroke-width: 1px; }
        text { font-family: sans-serif; }
      `;

            styleElement.textContent = cssText;
            svgClone.insertBefore(styleElement, svgClone.firstChild);

            // Serialize SVG
            const svgData = new XMLSerializer().serializeToString(svgClone);
            const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(svgBlob);

            // Create image and canvas
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');

                // Clear canvas (transparent background)
                ctx.clearRect(0, 0, width, height);

                // Draw SVG image
                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob((blob) => {
                    URL.revokeObjectURL(url);
                    if (blob) {
                        resolve(blob);
                    } else {
                        reject(new Error('Failed to create PNG blob'));
                    }
                }, 'image/png');
            };

            img.onerror = (e) => {
                URL.revokeObjectURL(url);
                console.error('Image load error:', e);
                reject(new Error('Failed to load SVG as image'));
            };

            img.src = url;
        } catch (error) {
            console.error('SVG to PNG error:', error);
            reject(error);
        }
    });
}

export class AdditionalListNode extends ChainedNode {
    static async promiseNode(caption, data, generator, onOpen) {
        return new AdditionalListNode(caption, data, generator, onOpen);
    }

    constructor(caption, data, generator, onOpen) {
        super(caption, '', [data, generator]);
        this.onOpen = onOpen;
    }

    async generateChain(args) {
        if (args[0] && args[1]) {
            args[1].call(this, args[0]);
        }
    }

    setChainVisible(visible) {
        super.setChainVisible(visible);
        if (visible && this.onOpen) {
            this.onOpen();
        }
    }
}

export class ExtensionNode extends Node {
    constructor(name, type, description) {
        super(name, type);
        this.addStyleName('unchive-extension-node');
        this.descriptionView = new Label(description);
        this.addView(this.descriptionView);
    }
}

export class AssetNode extends Node {
    constructor(name, type, size, url) {
        AssetNode.initConstants();
        super(name + '.' + type, '');
        this.assetName = name + '.' + type;
        this.assetSize = size;
        this.generatePreview(url, type);
        this.addStyleName('unchive-asset-node');
    }

    generatePreview(url, type) {
        let preview;
        if (AssetNode.supportedImageTypes.indexOf(type) !== -1) {
            preview = new View('IMG');
        } else if (AssetNode.supportedVideoTypes.indexOf(type) !== -1) {
            preview = new View('VIDEO');
        } else if (AssetNode.supportedAudioTypes.indexOf(type) !== -1) {
            preview = new View('AUDIO');
        } else {
            preview = new Label('Asset cannot be previewed. Click to download');
        }

        preview.setAttribute('src', url);
        preview.addStyleName('asset-preview');
        preview.domElement.addEventListener('click', (e) => {
            Downloader.downloadURL(url, this.assetName);
        });
        this.addView(preview);

        if (this.assetSize > 15000000) {
            this.addStyleName('unchive-asset--large-node');
            this.setSubText('<i class="material-icons">warning</i>' + AssetFormatter.formatSize(this.assetSize));
        } else {
            this.setSubText(AssetFormatter.formatSize(this.assetSize));
        }
    }

    static initConstants() {
        this.supportedImageTypes = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'bmp'];
        this.supportedVideoTypes = ['mp4', 'avi', '3gp', 'flv', 'wmv'];
        this.supportedAudioTypes = ['mp3', 'ogg', 'wav', 'wma'];
    }
}

export class SummaryNode extends Node {
    static async promiseNode(title, content) {
        return new SummaryNode(title, content);
    }

    constructor(title, content) {
        super(title, '');
        this.addStyleName('unchive-summary-node');
        this.contentWrapper = new View('DIV');
        this.addView(this.contentWrapper);
        this.contentWrapper.domElement.innerHTML = content;
    }
}