// Markdown Documentation Page - Simple Preview/Raw toggle like docGen2.html reference
// Shows markdown documentation with preview mode and raw code toggle

import { View } from './view.js';
import { Label, Button, Dialog, Downloader } from './widgets.js';
import { ExtensionViewer } from '../unchive/extension_viewer.js';

/**
 * MarkdownDocsPage - Documentation page with Preview/Raw toggle
 * Similar to docGen2.html reference design
 */
export class MarkdownDocsPage extends View {
    constructor(extensions) {
        super('DIV');
        this.extensions = extensions || [];
        this.viewers = this.extensions.map(ext => new ExtensionViewer(ext));
        this.setStyleName('markdown-docs-page');

        // State
        this.viewMode = 'preview'; // 'preview' or 'raw'
        this.markdownContent = '';

        this.render();
    }

    render() {
        this.clear();

        if (this.viewers.length === 0) {
            this.addView(new Label('No extension documentation available.'));
            return;
        }

        // Generate markdown content
        this.markdownContent = this.viewers.map(v => v.generateMarkdown(false)).join('\n\n---\n\n');

        // Header
        this.header = new DocsHeader(this);
        this.addView(this.header);

        // Main content container
        this.mainContent = new View('DIV');
        this.mainContent.setStyleName('markdown-docs-main');
        this.addView(this.mainContent);

        // Toolbar with toggle and action buttons
        this.toolbar = new DocsToolbar(this);
        this.mainContent.addView(this.toolbar);

        // Content wrapper
        this.contentWrapper = new View('DIV');
        this.contentWrapper.setStyleName('markdown-docs-wrapper');
        this.mainContent.addView(this.contentWrapper);

        // Preview area (rendered markdown)
        this.previewArea = new View('DIV');
        this.previewArea.setStyleName('markdown-preview-area');
        this.previewArea.addStyleName('markdown-body');
        this.contentWrapper.addView(this.previewArea);

        // Raw code textarea
        this.rawArea = new View('TEXTAREA');
        this.rawArea.setStyleName('markdown-raw-area');
        this.rawArea.domElement.spellcheck = false;
        this.rawArea.domElement.value = this.markdownContent;
        this.rawArea.setVisible(false);
        this.contentWrapper.addView(this.rawArea);

        // Render preview
        this.renderPreview();
    }

    renderPreview() {
        // Use marked.js library for proper GitHub-style markdown rendering
        if (typeof marked !== 'undefined') {
            // Configure marked for GitHub-style rendering
            marked.setOptions({
                breaks: true,
                gfm: true, // GitHub Flavored Markdown
                headerIds: true,
                mangle: false
            });

            // Parse markdown to HTML using marked.js
            const html = marked.parse(this.markdownContent);
            this.previewArea.domElement.innerHTML = html;
        } else {
            // Fallback if marked.js is not loaded
            console.warn('marked.js not loaded, using fallback rendering');
            let html = this.markdownContent
                .replace(/^### (.*)$/gm, '<h3>$1</h3>')
                .replace(/^## (.*)$/gm, '<h2>$1</h2>')
                .replace(/^# (.*)$/gm, '<h1>$1</h1>')
                .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
                .replace(/`([^`]+)`/g, '<code>$1</code>')
                .replace(/^\* (.*)$/gm, '<li>$1</li>')
                .replace(/\n\n/g, '<br><br>')
                .replace(/\n/g, '<br>');
            this.previewArea.domElement.innerHTML = html;
        }
    }

    setViewMode(mode) {
        this.viewMode = mode;
        if (mode === 'preview') {
            // Sync textarea content back to markdownContent if edited
            this.markdownContent = this.rawArea.domElement.value;
            this.renderPreview();
            this.previewArea.setVisible(true);
            this.rawArea.setVisible(false);
        } else {
            this.previewArea.setVisible(false);
            this.rawArea.setVisible(true);
        }
        this.toolbar.updateToggle(mode);
    }

    copyToClipboard() {
        const text = this.rawArea.domElement.value || this.markdownContent;
        navigator.clipboard.writeText(text).then(() => {
            this.showToast('Copied to clipboard!');
        }).catch(() => {
            // Fallback
            this.rawArea.domElement.select();
            document.execCommand('copy');
            this.showToast('Copied to clipboard!');
        });
    }

    downloadMarkdown() {
        const info = this.viewers[0]?.getInfo();
        const filename = `${(info?.name || 'extension').replace(/[^a-zA-Z0-9]/g, '_')}-docs.md`;
        const content = this.rawArea.domElement.value || this.markdownContent;
        const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
        Downloader.downloadBlob(blob, filename);
        this.showToast('Download started!');
    }

    showToast(message) {
        // Create toast if not exists
        if (!this.toast) {
            this.toast = new View('DIV');
            this.toast.setStyleName('docs-toast');
            this.addView(this.toast);
        }

        this.toast.domElement.innerHTML = `
            <i class="material-icons">check_circle</i>
            <span>${message}</span>
        `;
        this.toast.addStyleName('docs-toast--visible');

        setTimeout(() => {
            this.toast.removeStyleName('docs-toast--visible');
        }, 3000);
    }

    goBack() {
        if (typeof RootPanel !== 'undefined' && RootPanel.showMainScreen) {
            RootPanel.showMainScreen();
        }
    }
}

/**
 * DocsHeader - Header with back button and title
 */
class DocsHeader extends View {
    constructor(page) {
        super('DIV');
        this.page = page;
        this.setStyleName('markdown-docs-header');
        this.render();
    }

    render() {
        // Left section
        const left = new View('DIV');
        left.setStyleName('markdown-docs-header__left');

        // Back button
        const backBtn = new Button('arrow_back', true);
        backBtn.addStyleName('markdown-docs-header__back');
        backBtn.domElement.title = 'Back to Home';
        backBtn.addClickListener(() => this.page.goBack());
        left.addView(backBtn);

        // Title
        const info = this.page.viewers[0]?.getInfo();
        const title = new Label(info?.name || 'Documentation');
        title.addStyleName('markdown-docs-header__title');
        left.addView(title);

        this.addView(left);
    }
}

/**
 * DocsToolbar - Toggle buttons and action buttons
 */
class DocsToolbar extends View {
    constructor(page) {
        super('DIV');
        this.page = page;
        this.setStyleName('markdown-docs-toolbar');
        this.render();
    }

    render() {
        // Toggle container
        this.toggleContainer = new View('DIV');
        this.toggleContainer.setStyleName('markdown-docs-toggle');

        // Preview button
        this.previewBtn = new Button('Preview', false);
        this.previewBtn.addStyleName('markdown-docs-toggle__btn');
        this.previewBtn.addStyleName('markdown-docs-toggle__btn--active');
        this.previewBtn.domElement.innerHTML = '<i class="material-icons">visibility</i> Preview';
        this.previewBtn.addClickListener(() => this.page.setViewMode('preview'));
        this.toggleContainer.addView(this.previewBtn);

        // Raw button
        this.rawBtn = new Button('Raw Code', false);
        this.rawBtn.addStyleName('markdown-docs-toggle__btn');
        this.rawBtn.domElement.innerHTML = '<i class="material-icons">code</i> Raw Code';
        this.rawBtn.addClickListener(() => this.page.setViewMode('raw'));
        this.toggleContainer.addView(this.rawBtn);

        this.addView(this.toggleContainer);

        // Action buttons container
        const actionsContainer = new View('DIV');
        actionsContainer.setStyleName('markdown-docs-actions');

        // Copy button
        const copyBtn = new Button('Copy', false);
        copyBtn.addStyleName('markdown-docs-action-btn');
        copyBtn.addStyleName('markdown-docs-action-btn--secondary');
        copyBtn.domElement.innerHTML = '<i class="material-icons">content_copy</i> Copy';
        copyBtn.addClickListener(() => this.page.copyToClipboard());
        actionsContainer.addView(copyBtn);

        // Download button
        const downloadBtn = new Button('Download', false);
        downloadBtn.addStyleName('markdown-docs-action-btn');
        downloadBtn.addStyleName('markdown-docs-action-btn--primary');
        downloadBtn.domElement.innerHTML = '<i class="material-icons">download</i> Download';
        downloadBtn.addClickListener(() => this.page.downloadMarkdown());
        actionsContainer.addView(downloadBtn);

        this.addView(actionsContainer);
    }

    updateToggle(mode) {
        if (mode === 'preview') {
            this.previewBtn.addStyleName('markdown-docs-toggle__btn--active');
            this.rawBtn.removeStyleName('markdown-docs-toggle__btn--active');
        } else {
            this.previewBtn.removeStyleName('markdown-docs-toggle__btn--active');
            this.rawBtn.addStyleName('markdown-docs-toggle__btn--active');
        }
    }
}
