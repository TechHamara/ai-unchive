import { View } from './view.js';
import { Label, Button, Dialog, Downloader } from './widgets.js';
import { ExtensionViewer, BlockExporter, MockBlockRenderer } from '../unchive/extension_viewer.js';
import { BlocklyWorkspace } from '../unchive/ai_project.js';
import { svgToPngBlob } from './nodes/node.js'; // Use the robust one from node.js

/**
 * ExtensionDocsPage - Documentation page with professional Tabbed UI
 * Now uses REAL Blockly Rendering!
 */
export class ExtensionDocsPage extends View {
    constructor(extensions) {
        super('DIV');
        this.extensions = extensions || [];
        this.viewers = this.extensions.map(ext => new ExtensionViewer(ext));
        this.allBlocks = []; // Will store references to BlockCards for export
        this.setStyleName('extension-docs-page');

        // State
        this.activeViewerIndex = 0;

        this.render();
    }

    render() {
        this.clear();

        if (this.viewers.length === 0) {
            this.addView(new Label('No extension documentation available.'));
            return;
        }

        // Header bar
        this.header = new DocsHeader(this);
        this.addView(this.header);

        // Main content
        this.content = new View('DIV');
        this.content.setStyleName('extension-docs-content');
        this.addView(this.content);

        // Sidebar if needed
        if (this.viewers.length > 1) {
            this.addStyleName('has-sidebar');
            this.sidebar = new SidebarNav(this.viewers, (index) => {
                const el = document.getElementById(`ext-section-${index}`);
                if (el) el.scrollIntoView({ behavior: 'smooth' });
            });
            this.insertView(this.sidebar, 1);
        }

        // Render each extension
        this.viewers.forEach((viewer, index) => {
            const section = new ExtensionSection(viewer, this);
            section.domElement.id = `ext-section-${index}`;
            this.content.addView(section);
        });
    }

    // Called by BlockCard to register itself
    registerBlockCard(card) {
        this.allBlocks.push(card);
    }

    async downloadAllBlocks() {
        if (this.allBlocks.length === 0) {
            new Dialog('No blocks', 'No blocks available to download').open();
            return;
        }

        const info = this.viewers[0]?.getInfo();
        const filename = `${(info?.name || 'Extensions').replace(/[^a-zA-Z0-9]/g, '_')}_All_Blocks.zip`;
        const blocksData = [];

        // Collect SVGs from rendered blocks
        for (const card of this.allBlocks) {
            const svg = card.getSvg();
            if (svg) {
                blocksData.push({
                    name: card.filename || card.title.replace(/[^a-zA-Z0-9]/g, '_'),
                    svg: svg
                });
            }
        }

        try {
            // Re-using BlockExporter from existing utils, passing our gathered SVGs
            await BlockExporter.exportAllToZip(blocksData, filename);
        } catch (error) {
            console.error('Failed to export blocks:', error);
            new Dialog('Export Error', 'Failed to export blocks: ' + error.message).open();
        }
    }

    downloadMarkdown() {
        if (this.viewers.length > 0) {
            this.viewers[0].downloadMarkdown();
        }
    }

    async downloadFullDocumentation() {
        if (this.viewers.length === 0) {
            new Dialog('No documentation', 'No documentation available to download').open();
            return;
        }

        const info = this.viewers[0]?.getInfo();
        const filename = `${(info?.name || 'Extensions').replace(/[^a-zA-Z0-9]/g, '_')}_Full_Docs.zip`;

        const files = [];

        // Add markdown content with image references
        const markdownContent = this.viewers.map(viewer => viewer.generateMarkdown(true)).join('\n\n---\n\n');
        files.push({ name: 'documentation.md', content: markdownContent, type: 'text/markdown' });

        // Add block images
        for (const card of this.allBlocks) {
            const svg = card.getSvg();
            if (svg) {
                const blob = await svgToPngBlob(svg);
                files.push({
                    name: `blocks/${card.filename || card.title.replace(/[^a-zA-Z0-9]/g, '_')}.png`,
                    content: blob,
                    type: 'image/png'
                });
            }
        }

        try {
            await Downloader.downloadZip(filename, files);
        } catch (error) {
            console.error('Failed to export full documentation:', error);
            new Dialog('Export Error', 'Failed to export full documentation: ' + error.message).open();
        }
    }
}

class DocsHeader extends View {
    constructor(page) {
        super('DIV');
        this.page = page;
        this.setStyleName('docs-toolbar');
        this.addStyleName('extension-header');
        this.render();
    }

    render() {
        const left = new View('DIV');
        left.setStyleName('extension-header__left');
        const title = new Label('Extensions Documentation');
        title.addStyleName('extension-header__title');
        left.addView(title);
        this.addView(left);

        const right = new View('DIV');
        right.setStyleName('extension-header__right');

        // Download Full Docs with Blocks button
        const fullDocsBtn = new Button('library_books', true);
        fullDocsBtn.addStyleName('extension-header__action-btn');
        fullDocsBtn.domElement.title = 'Download Full Docs with Block Images (ZIP)';
        fullDocsBtn.addClickListener(() => this.page.downloadFullDocumentation());
        right.addView(fullDocsBtn);

        const mdBtn = new Button('description', true);
        mdBtn.addStyleName('extension-header__action-btn');
        mdBtn.domElement.title = 'Download Markdown Only';
        mdBtn.addClickListener(() => this.page.downloadMarkdown());
        right.addView(mdBtn);

        const zipBtn = new Button('folder_zip', true);
        zipBtn.addStyleName('extension-header__action-btn');
        zipBtn.domElement.title = 'Download All Blocks Only';
        zipBtn.addClickListener(() => this.page.downloadAllBlocks());
        right.addView(zipBtn);

        this.addView(right);
    }
}

class SidebarNav extends View {
    constructor(viewers, onSelect) {
        super('DIV');
        this.setStyleName('docs-sidebar');
        this.viewers = viewers;
        this.onSelect = onSelect;
        this.render();
    }
    render() {
        const header = new Label('JUMP TO');
        header.addStyleName('docs-sidebar__header');
        this.addView(header);

        const list = new View('DIV');
        list.setStyleName('docs-sidebar__list');

        this.viewers.forEach((v, i) => {
            const item = new View('DIV');
            item.setStyleName('docs-sidebar__item');
            const l = new Label(v.getInfo().name);
            item.addView(l);
            item.domElement.addEventListener('click', () => this.onSelect(i));
            list.addView(item);
        });
        this.addView(list);
    }
}

class ExtensionSection extends View {
    constructor(viewer, page) {
        super('DIV');
        this.viewer = viewer;
        this.page = page;
        this.setStyleName('extension-section');
        this.render();
    }

    render() {
        const info = this.viewer.getInfo();

        this.infoCard = new ExtensionInfoCard(info);
        this.addView(this.infoCard);

        this.statsBar = new ExtensionStatsBar(info);
        this.addView(this.statsBar);

        this.tabContainer = new View('DIV');
        this.tabContainer.setStyleName('extension-tabs');
        this.addView(this.tabContainer);

        this.tabs = new TabNavigation(['Events', 'Methods', 'Properties', 'Documentation']);
        this.tabs.onTabChange = (tab) => this.showTab(tab);
        this.tabContainer.addView(this.tabs);

        this.tabContentWrapper = new View('DIV');
        this.tabContentWrapper.setStyleName('extension-tab-content-wrapper');
        this.tabContainer.addView(this.tabContentWrapper);

        this.tabContents = {
            Events: new BlockGrid(),
            Methods: new BlockGrid(),
            Properties: new BlockGrid(),
            Documentation: new View('DIV')
        };

        for (const key in this.tabContents) {
            this.tabContents[key].setStyleName('extension-tab-content');
            this.tabContentWrapper.addView(this.tabContents[key]);
        }

        this.renderBlocks(info.events, this.tabContents.Events, 'event');
        this.renderBlocks(info.methods, this.tabContents.Methods, 'method');
        this.renderProperties(info.properties, this.tabContents.Properties);
        this.renderProperties(info.blockProperties, this.tabContents.Properties);

        this.renderDocumentation(this.tabContents.Documentation);

        this.showTab('Events');
    }

    showTab(tabName) {
        for (const key in this.tabContents) {
            this.tabContents[key].setVisible(key === tabName);
        }
    }

    renderBlocks(items, container, type) {
        if (!items || items.length === 0) {
            // Only show empty state if container is completely empty (might be called multiple times)
            if (container.children && container.children.length === 0) {
                // container.addView(new EmptyState('block', `No ${type}s available`));
            }
            return;
        }
        const extName = this.viewer.getInfo().name;
        const safeExtName = extName.replace(/[^a-zA-Z0-9]/g, '_');

        items.forEach(item => {
            // Generate XML for Real Blockly
            const xml = XmlGenerator.generate(type, extName, item);
            const desc = this.viewer.cleanDescription(item.description);
            const filename = `${type}_${safeExtName}_${item.name}`;
            const card = new BlockCard(item, type, xml, this.page, filename, extName);
            container.addView(card);
        });
    }

    renderProperties(props, container) {
        if (!props || props.length === 0) {
            // Only show empty state if container completely empty
            // But managing this properly across multiple calls is tricky. 
            // Ideally we shouldn't show "No properties" if we successfully rendered some from the other list.
            // We'll skip empty state logic here for simplicity or handle it better.
            return;
        }
        const extName = this.viewer.getInfo().name;
        const safeExtName = extName.replace(/[^a-zA-Z0-9]/g, '_');

        props.forEach(prop => {
            const desc = this.viewer.cleanDescription(prop.description);

            // Getter
            if (prop.rw !== 'write-only') {
                const getXml = XmlGenerator.generate('property', extName, prop, 'get');
                const getFilename = `property_get_${safeExtName}_${prop.name}`;
                container.addView(new BlockCard(prop, 'property', getXml, this.page, getFilename, extName, 'get'));
            }

            // Setter
            if (prop.rw !== 'read-only') {
                const setXml = XmlGenerator.generate('property', extName, prop, 'set');
                const setFilename = `property_set_${safeExtName}_${prop.name}`;
                container.addView(new BlockCard(prop, 'property', setXml, this.page, setFilename, extName, 'set'));
            }
        });
    }

    renderDocumentation(container) {
        container.setStyleName('extension-documentation');
        container.addStyleName('markdown-body'); // Optional hook for CSS
        const html = this.viewer.generateHtmlDocumentation();
        container.domElement.innerHTML = html;
        // Basic styling injection if needed, or rely on styles.css
        container.domElement.style.padding = '20px';
        container.domElement.style.backgroundColor = 'white';
        container.domElement.style.borderRadius = '8px';
        container.domElement.style.marginTop = '16px';
        container.domElement.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
        container.domElement.style.color = '#333';
        container.domElement.style.lineHeight = '1.6';
    }
}

/**
 * XmlGenerator - Generates Blockly XML for extension components
 */
class XmlGenerator {
    static generate(type, extName, item, access) {
        const instance = `${extName}1`; // Dummy instance
        let blockType, mutation;

        if (type === 'event') {
            blockType = 'component_event';
            mutation = `<mutation component_type="${extName}" event_name="${item.name}" is_generic="false" instance_name="${instance}"></mutation>`;
        } else if (type === 'method') {
            blockType = 'component_method';
            mutation = `<mutation component_type="${extName}" method_name="${item.name}" is_generic="false" instance_name="${instance}"></mutation>`;
        } else if (type === 'property') {
            blockType = 'component_set_get';
            mutation = `<mutation component_type="${extName}" set_or_get="${access}" property_name="${item.name}" is_generic="false" instance_name="${instance}"></mutation>`;
        }

        return `<xml><block type="${blockType}">${mutation}<field name="COMPONENT_SELECTOR">${instance}</field></block></xml>`;
    }
}

class ExtensionInfoCard extends View {
    constructor(info) {
        super('DIV');
        this.setStyleName('extension-info-card');
        const gradient = new View('DIV');
        gradient.setStyleName('extension-info-card__gradient');
        this.addView(gradient);
        const content = new View('DIV');
        content.setStyleName('extension-info-card__content');
        const icon = new View('DIV');
        icon.setStyleName('extension-info-card__icon');
        icon.domElement.innerHTML = '<i class="material-icons">extension</i>';
        content.addView(icon);
        const text = new View('DIV');
        text.setStyleName('extension-info-card__text');
        const name = new Label(info.name);
        name.addStyleName('extension-info-card__name');
        text.addView(name);
        const type = new Label(info.type);
        type.addStyleName('extension-info-card__type');
        text.addView(type);
        const version = new Label(`Version ${info.versionName}`);
        version.addStyleName('extension-info-card__version');
        text.addView(version);

        if (info.author) {
            const author = new Label(`Author: ${info.author}`);
            author.addStyleName('extension-info-card__author');
            text.addView(author);
        }
        if (info.dateBuilt) {
            const date = new Label(`Built: ${info.dateBuilt.split('T')[0]}`);
            date.addStyleName('extension-info-card__date');
            text.addView(date);
        }

        content.addView(text);
        this.addView(content);
        if (info.description) {
            const desc = new Label(info.description);
            desc.addStyleName('extension-info-card__description');
            this.addView(desc);
        }
    }
}

class ExtensionStatsBar extends View {
    constructor(info) {
        super('DIV');
        this.setStyleName('extension-stats-bar');
        this.addStat('event', 'Events', (info.events || []).length);
        this.addStat('bolt', 'Methods', (info.methods || []).length);
        this.addStat('tune', 'Properties', (info.properties || []).length);
    }
    addStat(icon, label, count) {
        const stat = new View('DIV');
        stat.setStyleName('extension-stats-bar__stat');
        stat.domElement.innerHTML = `<i class="material-icons">${icon}</i><span class="extension-stats-bar__count">${count}</span><span class="extension-stats-bar__label">${label}</span>`;
        this.addView(stat);
    }
}

class TabNavigation extends View {
    constructor(tabs) {
        super('DIV');
        this.tabs = tabs;
        this.activeTab = tabs[0];
        this.buttons = {};
        this.setStyleName('tab-navigation');
        this.render();
    }
    render() {
        this.tabs.forEach(tab => {
            const btn = new Button(tab, false);
            btn.addStyleName('tab-navigation__tab');
            if (tab === this.activeTab) btn.addStyleName('tab-navigation__tab--active');
            btn.addClickListener(() => this.setActive(tab));
            this.buttons[tab] = btn;
            this.addView(btn);
        });
    }
    setActive(tab) {
        this.buttons[this.activeTab].removeStyleName('tab-navigation__tab--active');
        this.activeTab = tab;
        this.buttons[this.activeTab].addStyleName('tab-navigation__tab--active');
        if (this.onTabChange) this.onTabChange(tab);
    }
}

class BlockGrid extends View {
    constructor() {
        super('DIV');
        this.setStyleName('block-grid');
    }
}

/**
 * BlockCard - Displays real Blockly Block
 */
class BlockCard extends View {
    constructor(item, type, xmlString, page, filename, extensionName, accessMode) {
        super('DIV');
        this.item = item;
        this.title = (accessMode === 'get' ? 'Get ' : accessMode === 'set' ? 'Set ' : '') + item.name;
        this.description = item.description; // Description passed in constructor before was cleaned, now we might assume clean or raw. 
        // Actually, item is raw. Let's rely on page.viewer if needed, or just let render handle cleaning if I imported viewer.
        // Wait, I don't have access to viewer.cleanDescription here easily unless I pass it.
        // I will stick to item.description for now, assuming raw description is fine or clean it simply.
        // Better: Caller cleaned description? No I removed that. I should rely on item.

        this.type = type;
        this.xmlString = xmlString;
        this.page = page;
        this.filename = filename;
        this.extensionName = extensionName;
        this.accessMode = accessMode; // specific for properties

        this.setStyleName('block-card');
        this.addStyleName(`block-card--${type}`);

        if (page) page.registerBlockCard(this);

        this.render();
    }

    render() {
        const header = new View('DIV');
        header.setStyleName('block-card__header');

        const label = new Label(this.title);
        label.addStyleName('block-card__title');
        header.addView(label);

        const dlBtn = new Button('download', true);
        dlBtn.addStyleName('block-card__download-btn');
        dlBtn.domElement.title = "Download PNG";
        dlBtn.addClickListener((e) => {
            e.stopPropagation();
            this.download();
        });
        header.addView(dlBtn);
        this.addView(header);

        const preview = new View('DIV');
        preview.setStyleName('block-card__preview');

        // Instantiate Real Blockly Workspace for visual preview
        try {
            const xml = new DOMParser().parseFromString(this.xmlString, 'text/xml');
            this.workspace = new BlocklyWorkspace(xml.documentElement);
            const wsView = this.workspace.getWorkspaceView();
            preview.addView(wsView);
            setTimeout(() => {
                this.workspace.initializeWorkspace();
                if (this.workspace.faulty) {
                    this.addStyleName('block-card--faulty');
                    preview.domElement.innerHTML = '<div style="color:red;padding:10px;">Error rendering block</div>';
                }
            }, 50);
        } catch (e) {
            console.error(e);
            preview.domElement.innerText = "Error loading block";
        }
        this.addView(preview);

        // Description
        if (this.description) {
            // Simple cleanup
            const cleanDesc = this.description.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
            const desc = new Label(cleanDesc, true);
            desc.addStyleName('block-card__description');
            this.addView(desc);
        }

        this.renderDetails();
    }

    renderDetails() {
        // Parameters Table
        if (this.item.params && this.item.params.length > 0) {
            const table = this.createTable(['Parameter', 'Type'], this.item.params.map(p => [p.name, p.type || 'any']));
            const lbl = new Label('Parameters:');
            lbl.addStyleName('block-card__subtitle');
            this.addView(lbl);
            this.addView(table);
        }

        // Return Type
        if (this.item.returnType && this.item.returnType !== 'void') {
            const retInfo = new Label(`Returns: <b>${this.item.returnType}</b>`, true);
            retInfo.addStyleName('block-card__return-info');
            this.addView(retInfo);
        }

        // Options for Properties
        if (this.item.helper && this.item.helper.type === 'OPTION_LIST' && this.item.helper.data) {
            const options = this.item.helper.data.options || [];
            if (options.length > 0) {
                const table = this.createTable(['Option', 'Value', 'Description'], options.map(o => [o.name, o.value, o.description || '-']));
                const lbl = new Label('Available Options:');
                lbl.addStyleName('block-card__subtitle');
                this.addView(lbl);
                this.addView(table);
            }
        }
    }

    createTable(headers, rows) {
        const table = new View('TABLE');
        table.setStyleName('block-card__table');

        const thead = new View('THEAD');
        const trHead = new View('TR');
        headers.forEach(h => {
            const th = new View('TH');
            th.domElement.innerText = h;
            trHead.addView(th);
        });
        thead.addView(trHead);
        table.addView(thead);

        const tbody = new View('TBODY');
        rows.forEach(row => {
            const tr = new View('TR');
            row.forEach(cell => {
                const td = new View('TD');
                td.domElement.innerText = cell;
                tr.addView(td);
            });
            tbody.addView(tr);
        });
        table.addView(tbody);
        return table;
    }

    getSvg() {
        // Use MockBlockRenderer for robust export
        try {
            if (this.type === 'event') {
                return MockBlockRenderer.createEventBlock(this.item, this.extensionName);
            } else if (this.type === 'method') {
                return MockBlockRenderer.createMethodBlock(this.item, this.extensionName);
            } else if (this.type === 'property') {
                if (this.accessMode === 'set') return MockBlockRenderer.createPropertySetterBlock(this.item, this.extensionName);
                if (this.accessMode === 'get') return MockBlockRenderer.createPropertyGetterBlock(this.item, this.extensionName);
                // Fallback if accessMode is not set but title implies it?
                // Current logic sets accessMode.
                // Fallback if prop.rw...
            }
        } catch (e) {
            console.error('Mock rendering failed', e);
        }

        // Fallback to real workspace if mock fails (unlikely)
        if (this.workspace && !this.workspace.faulty && this.workspace.workspace) {
            return this.workspace.workspace.getParentSvg();
        }
        return null;
    }

    async download() {
        const filename = `${(this.filename || this.title.replace(/[^a-zA-Z0-9]/g, '_'))}.png`;
        const svg = this.getSvg();
        if (!svg) return;

        try {
            // Use MockBlockRenderer's svgToPngBlob which is robust
            const blob = await MockBlockRenderer.svgToPngBlob(svg);
            Downloader.downloadBlob(blob, filename);
        } catch (e) {
            console.error(e);
            new Dialog('Export Error', 'Failed to export block: ' + e.message).open();
        }
    }
}

class EmptyState extends View {
    constructor(icon, msg) {
        super('DIV');
        this.setStyleName('empty-state');
        this.domElement.innerHTML = `<i class="material-icons">${icon}</i><p>${msg}</p>`;
    }
}
