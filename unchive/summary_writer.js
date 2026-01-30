import { SummaryNode, AssetNode, HeaderNode, ScreenNode, ChainedNode } from '../views/nodes/node.js';
import { View } from '../views/view.js';
import { Label, Dialog, AssetFormatter, Downloader } from '../views/widgets.js';

export class SummaryWriter {
    static async generateSummmaryNodesForProject(project, nodeList) {
        this.header = new HeaderNode('Download summary', 'save_alt');
        this.header.addStyleName('unchive-summary-node__header');
        nodeList.addNode(this.header);

        this.header.addClickListener(() => {
            SummaryHTMLWriter.writeProjectSummary(project);
        });

        nodeList.addNodeAsync(SummaryNode.promiseNode('Stats', this.generateStats(project)));
        nodeList.addNodeAsync(SummaryNode.promiseNode('Most used components', this.generateMostUsed(project)));
        nodeList.addNodeAsync(SummaryNode.promiseNode('% of blocks by screen', this.generateCodeShare(project).getHTML()));
        nodeList.addNodeAsync(SummaryNode.promiseNode('Assets by type', this.generateAssetTypeShare(project).getHTML()));
        nodeList.addNodeAsync(SummaryNode.promiseNode('% of built-in components', this.generateNativeShare(project).getHTML()));
        nodeList.addNodeAsync(SummaryNode.promiseNode('Block usage by type', this.getBlockTypeShare(project).getHTML()));
    }

    static generateStats(project) {
        const container = new View('DIV');
        container.addView(new SummaryItem('Number of screens', project.screens.length));
        container.addView(new SummaryItem('Number of extensions', project.extensions.length));

        let blockCount = 0;
        for (let screen of project.screens) {
            blockCount += Array.from(new DOMParser().parseFromString(screen.blocks, 'text/xml').getElementsByTagName('block')).length;
        }
        container.addView(new SummaryItem('Total number of blocks', blockCount));

        let assetSize = 0;
        for (let asset of project.assets) {
            assetSize += asset.size;
        }
        container.addView(new SummaryItem('Number of assets', project.assets.length));
        container.addView(new SummaryItem('Total size of assets', AssetFormatter.formatSize(assetSize)));

        return container.domElement.innerHTML;
    }

    static generateMostUsed(project) {
        const container = new View('DIV');
        const components = [];

        function countComponents(component) {
            const existing = components.find(c => c[0] === component.type);
            if (existing) {
                existing[1]++;
            } else {
                components.push([component.type, 1]);
            }
            for (let child of component.children) {
                countComponents(child);
            }
        }

        for (let screen of project.screens) {
            countComponents(screen.form);
        }

        components.sort((a, b) => b[1] - a[1]);

        for (let i = 0; i < 8 && i < components.length; i++) {
            const comp = components[i];
            container.addView(new SummaryItem(
                Messages[comp[0][0].toLowerCase() + comp[0].slice(1) + 'ComponentPallette'] || comp[0],
                comp[1]
            ));
        }

        return container.domElement.innerHTML;
    }

    static generateCodeShare(project) {
        const data = [['Screen', 'Percentage']];
        for (let screen of project.screens) {
            const blockCount = Array.from(new DOMParser().parseFromString(screen.blocks, 'text/xml').getElementsByTagName('block')).length;
            data.push([screen.name, blockCount]);
        }
        return new SummaryChart(data);
    }

    static generateAssetTypeShare(project) {
        const data = [['Asset type', 'Percentage']];
        for (let asset of project.assets) {
            const existing = data.find(d => d[0] === asset.type.toLowerCase());
            if (existing) {
                existing[1]++;
            } else {
                data.push([asset.type.toLowerCase(), 1]);
            }
        }
        return new SummaryChart(data);
    }

    static generateNativeShare(project) {
        const builtin = ['Built-in', 0];
        const extension = ['Extensions', 0];

        function countOrigins(component, ext, native) {
            if (component.origin === 'EXTENSION') {
                ext[1]++;
            } else {
                native[1]++;
            }
            for (let child of component.children) {
                countOrigins(child, ext, native);
            }
        }

        for (let screen of project.screens) {
            countOrigins(screen.form, extension, builtin);
        }

        return new SummaryChart([['Type', 'Percentage'], builtin, extension]);
    }

    static getBlockTypeShare(project) {
        let events = 0, methods = 0, properties = 0, procedures = 0, variables = 0;

        for (let screen of project.screens) {
            const doc = new DOMParser().parseFromString(screen.blocks, 'text/xml');
            events += Array.from(doc.querySelectorAll('block[type="component_event"]')).length;
            methods += Array.from(doc.querySelectorAll('block[type="component_method"]')).length;
            properties += Array.from(doc.querySelectorAll('block[type="component_set_get"]')).length;
            procedures += Array.from(doc.querySelectorAll('block[type="procedures_defnoreturn"], block[type="procedures_defreturn"]')).length;
            variables += Array.from(doc.querySelectorAll('block[type="global_declaration"]')).length;
        }

        return new SummaryChart(
            [['Type', 'Percentage'], ['Events', events], ['Methods', methods], ['Properties', properties], ['Variables', variables], ['Procedures', procedures]],
            [Blockly.COLOUR_EVENT, Blockly.COLOUR_METHOD, Blockly.COLOUR_SET, 'rgb(244, 81, 30)', '#AAA']
        );
    }
}

class SummaryItem extends Label {
    constructor(label, value) {
        super(`${label} <span>${value}</span>`, true);
        this.addStyleName('summary-item');
    }
}

class SummaryChart extends View {
    constructor(data, colors) {
        super('DIV');

        const chartData = google.visualization.arrayToDataTable(data);
        this.options = {
            legend: { position: 'right', textStyle: { color: 'black' } },
            pieSliceTextStyle: { color: '#000', background: '#FFF' },
            pieHole: 0.5,
            width: 260,
            chartArea: { left: 0, top: 20, width: '100%', height: '100%' },
            enableInteractivity: false
        };

        if (colors) {
            this.options.colors = colors;
        }

        this.chart = new google.visualization.PieChart(this.domElement);
        this.chart.draw(chartData, this.options);
    }

    getHTML() {
        return this.domElement.outerHTML;
    }

    getChartHTML() {
        const svg = this.domElement.getElementsByTagName('svg')[0];
        svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        return svg.outerHTML;
    }
}

class SummaryHTMLWriter {
    static writeProjectSummary(project) {
        const dialog = new Dialog('Generating summary...', 'This may take a while');
        setTimeout(() => dialog.open(), 1);

        setTimeout(() => {
            const html = [];
            const blobs = [];

            html.push('<html>');
            html.push(`<head><title>Project Summary for ${project.name}</title></head>`);
            html.push('<body>');
            html.push('<div style="text-align:center;width:100%;">');
            html.push(`<h1 style="margin-bottom:0">${project.name} - Project Summary</h1>`);
            html.push('<h5 style="margin-top:0">');
            html.push(`Summary generated on ${this.getDateTime()}`);
            html.push('</h5></div>');

            this.writeTOContents(html, project);
            this.writeStats(html, project);
            this.writeInsights(html, blobs, project);

            this.writeScreens(html, blobs, project).then(() => {
                if (project.extensions.length) {
                    this.writeExtensions(html, project);
                }
                this.writeStyles(html, blobs);
                html.push('</body></html>');

                blobs.push([new Blob([html.join('')], { type: 'image/svg+xml' }), `${project.name}.html`]);
                this.zipAllBlobs(blobs);
                dialog.close();
            });
        }, 20);
    }

    static getDateTime() {
        const date = new Date();
        return date.getDate() + '/' + (date.getMonth() + 1) + '/' + date.getFullYear() + ' @ ' + date.getHours() + ':' + date.getMinutes();
    }

    static writeTOContents(html, project) {
        html.push('<h3>Table of Contents</h3>');
        html.push('<ol>');
        html.push('<li><a href="#stats">Project stats</a></li>');
        html.push('<li><a href="#insights">Insights</a></li>');
        html.push('<li>Screens</li><ol>');
        for (let screen of project.screens) {
            html.push(`<li><a href="#screen-${screen.name}">${screen.name}</a></li>`);
        }
        html.push('</ol>');
        if (project.extensions.length) {
            html.push('<li><a href="#exts">Extensions summary</a></li>');
        }
        html.push('</ol>');
    }

    static writeStats(html, project) {
        html.push('<a name="stats"></a>');
        html.push('<h3>Project stats</h3>');
        html.push(SummaryWriter.generateStats(project).replace(/<p/g, '<li').replace(/\/p>/g, '/li>'));
        html.push('<h4>Most used components</h4>');
        html.push(SummaryWriter.generateMostUsed(project).replace(/<p/g, '<li').replace(/\/p>/g, '/li>'));
    }

    static writeInsights(html, blobs, project) {
        html.push('<a name="insights"></a>');
        html.push('<h3>Insights</h3>');

        blobs.push([new Blob([SummaryWriter.generateCodeShare(project).getChartHTML()], { type: 'image/svg+xml' }), 'code_share.svg']);
        blobs.push([new Blob([SummaryWriter.generateAssetTypeShare(project).getChartHTML()], { type: 'image/svg+xml' }), 'asset_type_share.svg']);
        blobs.push([new Blob([SummaryWriter.generateNativeShare(project).getChartHTML()], { type: 'image/svg+xml' }), 'native_share.svg']);
        blobs.push([new Blob([SummaryWriter.getBlockTypeShare(project).getChartHTML()], { type: 'image/svg+xml' }), 'block_type_share.svg']);

        html.push('<div style="display:inline-block">');
        html.push('<div class="chart"><img src="code_share.svg"></img>');
        html.push('<p>Percentage of blocks by screen</p></div>');
        html.push('<div class="chart"><img src="asset_type_share.svg"></img>');
        html.push('<p>Types of assets by frequency</p></div>');
        html.push('</div>');
        html.push('<div style="display:inline-block">');
        html.push('<div class="chart"><img src="native_share.svg"></img>');
        html.push('<p>Percentage of built-in components vs extensions used</p></div>');
        html.push('<div class="chart"><img src="block_type_share.svg"></img>');
        html.push('<p>Percentage of blocks by type</p></div>');
        html.push('</div>');
    }

    static async writeScreens(html, blobs, project) {
        let screenIndex = 0;
        for (let node of RootPanel.primaryNodeList.nodes) {
            if (node instanceof ScreenNode) {
                html.push(`<a name="screen-${node.caption}"></a>`);
                html.push(`<h3>${node.caption}</h3>`);
                html.push('<h4>Components</h4>');
                html.push('<ul>');
                this.writeComponent(html, project.screens.find(s => s.name === node.caption).form);
                html.push('</ul><br>');
                html.push('<h4>Blocks</h4>');

                node.open();
                node.chainNodeList.nodes[1].open();

                let blockIndex = 0;
                for (let block of node.chainNodeList.nodes[1].chainNodeList.nodes) {
                    block.initializeWorkspace();
                    html.push(`<img src="block_${screenIndex}_${blockIndex}.png">`);

                    let svgContent = block.domElement.children[1].children[0].innerHTML.replace(/&nbsp;/g, ' ');
                    const styles = [];
                    styles.push(`<style>${document.head.children[0].innerHTML}</style>`);
                    styles.push('<style>.blocklyMainBackground{stroke-width:0}.blocklySvg{position:relative;width:100%}</style>');
                    svgContent = svgContent.substring(0, svgContent.indexOf('</svg>')) + styles.join('') + '</svg>';

                    const svgBlob = new Blob([svgContent], { type: 'image/svg+xml' });
                    blobs.push([await this.svgToPngBlob(svgBlob), `block_${screenIndex}_${blockIndex}.png`]);
                    html.push('<p class="blk-cap"></p>');
                    blockIndex++;
                }
                screenIndex++;
            }
        }
        RootPanel.primaryNodeList.nodes.slice(-1)[0].open();
    }

    static svgToPngBlob(svgBlob) {
        return new Promise((resolve, reject) => {
            const url = URL.createObjectURL(svgBlob);
            const img = document.createElement('img');
            img.style.position = 'absolute';
            img.style.top = '-9999px';
            document.body.appendChild(img);

            img.onload = function () {
                const canvas = document.createElement('canvas');
                canvas.width = img.clientWidth;
                canvas.height = img.clientHeight;
                canvas.getContext('2d').drawImage(img, 0, 0);
                canvas.toBlob(function (blob) {
                    resolve(blob);
                    document.body.removeChild(img);
                }, 'image/png');
            };
            img.src = url;
        });
    }

    static writeComponent(html, component) {
        html.push(`<li>${component.name} <small>(${component.type})</small></li>`);
        for (let child of component.children) {
            html.push('<ul>');
            this.writeComponent(html, child);
            html.push('</ul>');
        }
    }

    static writeExtensions(html, project) {
        html.push('<a name="exts"></a>');
        html.push('<h3>Extensions summary</h3>');
        for (let ext of project.extensions) {
            html.push(`<li>${ext.name}<ul><li>${ext.descriptorJSON.helpString}</li></ul></li>`);
        }
    }

    static writeStyles(html, blobs) {
        html.push('<style>body{max-width:1000px;margin:0 auto;border:1px solid #DDD;padding:20px;font-family: sans-serif}span::before{content:": "}.chart{display:block;margin:0 40px;}.blk-cap:empty::after{content:"[Caption]"; font-style:italic;color:#888}@media print{.blk-cap:empty{display:none}}@page{margin-bottom:0}</style>');
        html.push('<script>document.designMode = "on"<\/script>');
    }

    static zipAllBlobs(blobs) {
        zip.createWriter(new zip.BlobWriter('application/zip'), (writer) => {
            this.zipBlob(writer, blobs);
        });
    }

    static zipBlob(writer, blobs) {
        if (blobs.length > 0) {
            const blob = blobs.pop();
            writer.add(blob[1], new zip.BlobReader(blob[0]), () => {
                this.zipBlob(writer, blobs);
            });
        } else {
            writer.close((blob) => {
                Downloader.downloadBlob(blob, 'project.zip');
            });
        }
    }
}