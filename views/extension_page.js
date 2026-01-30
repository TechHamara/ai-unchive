// Extension Page - Professional UI Component for displaying extension documentation
// Updated to use Authentic Blockly Rendering

import { View } from './view.js';
import { Label, Button, Dialog, Downloader } from './widgets.js';
import { ExtensionViewer, BlockExporter } from '../unchive/extension_viewer.js';
import { BlocklyWorkspace } from '../unchive/ai_project.js'; // Authentic Workspace
import { svgToPngBlob } from './nodes/node.js'; // Robust PNG export

/**
 * ExtensionPage - Main page for extension documentation with professional UI
 */
export class ExtensionPage extends View {
    constructor(extensions) {
        super('DIV');
        this.extensions = extensions;
        this.viewers = extensions.map(ext => new ExtensionViewer(ext));
        this.allBlocks = []; // Stores references to BlockCards
        this.setStyleName('extension-page');
        this.render();
    }

    render() {
        // Header bar
        this.header = new ExtensionHeader(this);
        this.addView(this.header);

        // Main content
        this.content = new View('DIV');
        this.content.setStyleName('extension-page__content');
        this.addView(this.content);

        // Render each extension
        for (const viewer of this.viewers) {
            const section = new ExtensionSection(viewer, this);
            this.content.addView(section);
        }
    }

    /**
     * Register a block card for bulk download lookup
     */
    registerBlockCard(card) {
        this.allBlocks.push(card);
    }

    /**
     * Download all blocks as PNG ZIP
     */
    async downloadAllBlocks() {
        if (this.allBlocks.length === 0) {
            new Dialog('No blocks', 'No blocks available to download').open();
            return;
        }

        const info = this.viewers[0]?.getInfo();
        const filename = `${(info?.name || 'extension').replace(/[^a-zA-Z0-9]/g, '_')}_blocks.zip`;
        const blocksData = [];

        // Collect SVGs from rendered blocks
        for (const card of this.allBlocks) {
            const svg = card.getSvg();
            if (svg) {
                blocksData.push({
                    name: card.title.replace(/[^a-zA-Z0-9]/g, '_'),
                    svg: svg
                });
            }
        }

        if (blocksData.length === 0) {
            new Dialog('Export Error', 'No valid block SVGs found to export.').open();
            return;
        }

        try {
            await BlockExporter.exportAllToZip(blocksData, filename);
        } catch (error) {
            console.error('Failed to export blocks:', error);
            new Dialog('Export Error', 'Failed to export blocks: ' + error.message).open();
        }
    }

    /**
     * Download markdown documentation
     */
    downloadMarkdown() {
        if (this.viewers.length > 0) {
            this.viewers[0].downloadMarkdown();
        }
    }

    /**
     * Go back to main screen
     */
    goBack() {
        if (typeof RootPanel !== 'undefined' && RootPanel.showMainScreen) {
            RootPanel.showMainScreen();
        }
    }
}

/**
 * ExtensionHeader - Professional header bar
 */
class ExtensionHeader extends View {
    constructor(page) {
        super('DIV');
        this.page = page;
        this.setStyleName('extension-header');
        this.render();
    }

    render() {
        // Left section
        const leftSection = new View('DIV');
        leftSection.setStyleName('extension-header__left');

        // Back button
        this.backButton = new Button('arrow_back', true);
        this.backButton.addStyleName('extension-header__back-btn');
        this.backButton.domElement.title = 'Back to Home';
        this.backButton.addClickListener(() => this.page.goBack());
        leftSection.addView(this.backButton);

        // Title
        const info = this.page.viewers[0]?.getInfo() || { name: 'Extension' };
        this.title = new Label(info.name);
        this.title.addStyleName('extension-header__title');
        leftSection.addView(this.title);

        this.addView(leftSection);

        // Right section - action buttons
        const rightSection = new View('DIV');
        rightSection.setStyleName('extension-header__right');

        // Download MD button
        const mdBtn = new Button('description', true);
        mdBtn.addStyleName('extension-header__action-btn');
        mdBtn.domElement.title = 'Download Markdown Documentation';
        mdBtn.addClickListener(() => this.page.downloadMarkdown());
        rightSection.addView(mdBtn);

        // Download all blocks button
        const zipBtn = new Button('folder_zip', true);
        zipBtn.addStyleName('extension-header__action-btn');
        zipBtn.domElement.title = 'Download All Blocks as ZIP';
        zipBtn.addClickListener(() => this.page.downloadAllBlocks());
        rightSection.addView(zipBtn);

        this.addView(rightSection);
    }
}

/**
 * ExtensionSection - Section displaying extension info and blocks
 */
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
        const extName = info.name;

        // Extension info card
        this.infoCard = new ExtensionInfoCard(info);
        this.addView(this.infoCard);

        // Stats bar
        this.statsBar = new ExtensionStatsBar(info);
        this.addView(this.statsBar);

        // Tab container
        this.tabContainer = new View('DIV');
        this.tabContainer.setStyleName('extension-tabs');
        this.addView(this.tabContainer);

        // Tab navigation
        this.tabs = new TabNavigation(['Events', 'Methods', 'Properties']);
        this.tabs.onTabChange = (tab) => this.showTab(tab);
        this.tabContainer.addView(this.tabs);

        // Tab content wrapper
        this.tabContentWrapper = new View('DIV');
        this.tabContentWrapper.setStyleName('extension-tab-content-wrapper');
        this.tabContainer.addView(this.tabContentWrapper);

        // Tab content containers
        this.tabContents = {
            Events: new BlockGrid('Events'),
            Methods: new BlockGrid('Methods'),
            Properties: new BlockGrid('Properties')
        };

        for (const key in this.tabContents) {
            this.tabContents[key].setStyleName('extension-tab-content');
            this.tabContentWrapper.addView(this.tabContents[key]);
        }

        // Render blocks for each category
        this.renderBlocks(info.events, this.tabContents.Events, 'event', extName);
        this.renderBlocks(info.methods, this.tabContents.Methods, 'method', extName);
        this.renderProperties(info.properties, this.tabContents.Properties, extName);

        // Show first tab by default
        this.showTab('Events');
    }

    showTab(tabName) {
        for (const key in this.tabContents) {
            this.tabContents[key].setVisible(key === tabName);
        }
    }

    renderBlocks(items, container, type, extName) {
        if (!items || items.length === 0) {
            container.addView(new EmptyState('block', `No ${type}s available`));
            return;
        }

        items.forEach(item => {
            // Generate XML for Real Blockly
            const xml = XmlGenerator.generate(type, extName, item);
            const desc = this.viewer.cleanDescription(item.description || '');
            const card = new BlockCard(item.name, desc, type, xml, this.page);
            container.addView(card);
        });
    }

    renderProperties(props, container, extName) {
        if (!props || props.length === 0) {
            container.addView(new EmptyState('tune', 'No properties available'));
            return;
        }

        props.forEach(prop => {
            const desc = this.viewer.cleanDescription(prop.description || '');

            // Getter
            const getXml = XmlGenerator.generate('property', extName, prop, 'get');
            container.addView(new BlockCard(`Get ${prop.name}`, desc, 'property', getXml, this.page));

            // Setter
            if (prop.rw !== 'read-only') {
                const setXml = XmlGenerator.generate('property', extName, prop, 'set');
                container.addView(new BlockCard(`Set ${prop.name}`, desc, 'property', setXml, this.page));
            }
        });
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

/**
 * ExtensionInfoCard - Card showing extension info
 */
class ExtensionInfoCard extends View {
    constructor(info) {
        super('DIV');
        this.setStyleName('extension-info-card');

        // Gradient background
        const gradient = new View('DIV');
        gradient.setStyleName('extension-info-card__gradient');
        this.addView(gradient);

        // Content
        const content = new View('DIV');
        content.setStyleName('extension-info-card__content');

        // Icon placeholder
        const icon = new View('DIV');
        icon.setStyleName('extension-info-card__icon');
        icon.domElement.innerHTML = '<i class="material-icons">extension</i>';
        content.addView(icon);

        // Text content
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

        content.addView(text);
        this.addView(content);

        // Description
        if (info.description && info.description !== 'No description available') {
            const desc = new Label(info.description);
            desc.addStyleName('extension-info-card__description');
            this.addView(desc);
        }
    }
}

/**
 * ExtensionStatsBar - Stats bar showing counts
 */
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
        stat.domElement.innerHTML = `
      <i class="material-icons">${icon}</i>
      <span class="extension-stats-bar__count">${count}</span>
      <span class="extension-stats-bar__label">${label}</span>
    `;
        this.addView(stat);
    }
}

/**
 * TabNavigation - Tab navigation component
 */
class TabNavigation extends View {
    constructor(tabs) {
        super('DIV');
        this.tabNames = tabs;
        this.activeTab = tabs[0];
        this.onTabChange = null;
        this.setStyleName('tab-navigation');
        this.render();
    }

    render() {
        this.tabButtons = {};
        for (const tab of this.tabNames) {
            const btn = new Button(tab, false);
            btn.addStyleName('tab-navigation__tab');
            if (tab === this.activeTab) {
                btn.addStyleName('tab-navigation__tab--active');
            }
            btn.addClickListener(() => this.setActiveTab(tab));
            this.tabButtons[tab] = btn;
            this.addView(btn);
        }
    }

    setActiveTab(tab) {
        for (const key in this.tabButtons) {
            if (key === tab) {
                this.tabButtons[key].addStyleName('tab-navigation__tab--active');
            } else {
                this.tabButtons[key].removeStyleName('tab-navigation__tab--active');
            }
        }

        this.activeTab = tab;
        if (this.onTabChange) {
            this.onTabChange(tab);
        }
    }
}

/**
 * BlockGrid - Grid container for block cards
 */
class BlockGrid extends View {
    constructor(category) {
        super('DIV');
        this.setStyleName('block-grid');
        this.category = category;
    }
}

/**
 * BlockCard - Card displaying REAL Blockly Block
 */
class BlockCard extends View {
    constructor(title, description, type, xmlString, page) {
        super('DIV');
        this.title = title;
        this.xmlString = xmlString;
        this.page = page;
        this.setStyleName('block-card');
        this.addStyleName(`block-card--${type}`);

        if (page) page.registerBlockCard(this);

        this.render(title, description);
    }

    render(title, description) {
        const header = new View('DIV');
        header.setStyleName('block-card__header');

        const label = new Label(title);
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

        // Instantiate Real Blockly Workspace
        try {
            const xml = new DOMParser().parseFromString(this.xmlString, 'text/xml');
            this.workspace = new BlocklyWorkspace(xml.documentElement);

            // Add workspace view
            const wsView = this.workspace.getWorkspaceView();
            preview.addView(wsView);

            // Trigger initialization
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

        if (description) {
            const desc = new Label(description, true);
            desc.addStyleName('block-card__description');
            this.addView(desc);
        }
    }

    getSvg() {
        if (this.workspace && !this.workspace.faulty && this.workspace.workspace) {
            return this.workspace.workspace.getParentSvg();
        }
        return null;
    }

    async download() {
        const filename = `${this.title.replace(/[^a-zA-Z0-9]/g, '_')}.png`;
        const svg = this.getSvg();
        if (!svg) return;

        try {
            const blob = await svgToPngBlob(svg);
            Downloader.downloadBlob(blob, filename);
        } catch (e) {
            console.error(e);
        }
    }
}

/**
 * EmptyState - Empty state placeholder
 */
class EmptyState extends View {
    constructor(icon, message) {
        super('DIV');
        this.setStyleName('empty-state');
        this.domElement.innerHTML = `
      <i class="material-icons">${icon}</i>
      <p>${message}</p>
    `;
    }
}
