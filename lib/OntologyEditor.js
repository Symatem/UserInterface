/* jslint node: true, esnext: true */
/* global document, window */
'use strict';

const WiredPanels = require('WiredPanels'),
      Symatem = require('SymatemWasm');

module.exports = function(element) {
    return new Promise(function(fullfill, reject) {
        if(typeof WebAssembly !== 'object') {
            const message = document.createElement('div');
            element.appendChild(message);
            message.innerHTML = 'WebAssembly is a young technology and seems to be unsupported or disabled.<br /><br />';
            const link = document.createElement('a');
            message.appendChild(link);
            link.href = 'http://webassembly.org/demo/';
            link.innerText = 'Learn More';
            reject();
            return;
        }
        this.fetchResource('../public/js/Symatem.wasm', 'arraybuffer').then(function(arraybuffer) {
            new Symatem(new Uint8Array(arraybuffer)).then(function(symatemInstance) {
                this.symatem = symatemInstance;
                this.wiredPanels = new WiredPanels(element);
                this.panelIndex = new Map;
                this.labelIndex = new Map;
                this.symatem.linkedTriple = function(entity, attribute, value) {
                    if(!this.panelIndex.has(entity))
                        return;
                    const panel = this.panelIndex.get(entity);
                    this.generateSegment(panel, attribute, value);
                    this.wiredPanels.syncPanel(panel);
                    this.wireSegment(panel, panel.leftSide.length-1);
                }.bind(this);
                this.symatem.unlinkedTriple = function(entity, attribute, value) {
                    if(!this.panelIndex.has(entity))
                        return;
                    const panel = this.panelIndex.get(entity);
                    for(let index = 0; index < panel.leftSide.length; ++index)
                        if(panel.leftSide[index].symbol == attribute && panel.rightSide[index].symbol == value) {
                            this.removeSegment(panel, index);
                            break;
                        }
                }.bind(this);
                this.symatem.releasedSymbol = this.hideSymbol.bind(this);
                element.ondblclick = function() {
                    const input = prompt('Blob:');
                    if(input == null || (input[0] != '"' && input.indexOf(';') > -1))
                        return;
                    const result = this.symatem.deserializeHRL(input);
                    if(result.length == 0)
                        this.showSymbols([this.symatem.createSymbol()]);
                    else
                        this.showSymbols((result[0]) ? result : [result]);
                    this.wiredPanels.syncGraph();
                }.bind(this);
                fullfill(this);
            }.bind(this));
        }.bind(this));
    }.bind(this));
}

module.exports.prototype.fetchResource = function(URL, type) {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', URL, true);
    xhr.responseType = type;
    xhr.send(null);
    return new Promise(function(fullfill, reject) {
        xhr.onload = function(event) {
            fullfill(event.target.response);
        };
        xhr.onerror = reject;
    });
    /* return fetch(URL).then(function(response) {
        return response.arrayBuffer();
    }); */
};

module.exports.prototype.setBlob = function(blob, symbol) {
    this.symatem.setBlob(blob, symbol);
    if(!this.panelIndex.has(symbol))
        return;
    const label = this.getLabel(symbol);
    for(const segment of this.labelIndex.get(symbol))
        this.updateLabel(segment, label);
};

/*module.exports.prototype.getTripleOfWire = function(wire) {
    let index = Math.abs(this.wiredPanels.getIndexOfSocket(wire.srcPanel, wire.srcSocket))-1,
        entity = wire.srcPanel.symbol, attribute, value;
    if(wire.srcSocket.type == 'attribute') {
        attribute = wire.srcSocket.symbol;
        value = panel.rightSide[index].symbol;
    } else {
        attribute = panel.leftSide[index].symbol;
        value = wire.srcSocket.symbol;
    }
    return [entity, attribute, value];
};*/

module.exports.prototype.getLabel = function(symbol, cap = 16) {
    let label = this.symatem.serializeBlob(symbol);
    if(cap > 0 && label.length > cap+1)
        label = label.substr(0, cap)+'…';
    return label;
};

module.exports.prototype.updateLabel = function(segment, label) {
    segment.label.textContent = label;
    if(label[0] == '#')
        segment.label.classList.add('disabled');
    else
        segment.label.classList.remove('disabled');
};

module.exports.prototype.addLabel = function(segment) {
    let label, set = this.labelIndex.get(segment.symbol);
    if(!set) {
        set = new Set([segment]);
        this.labelIndex.set(segment.symbol, set);
        label = this.getLabel(segment.symbol);
    } else {
        label = set.keys().next().value.label.textContent;
        set.add(segment);
    }
    this.updateLabel(segment, label);
};

module.exports.prototype.removeLabel = function(segment) {
    let set = this.labelIndex.get(segment.symbol);
    if(set) {
        set.delete(segment);
        if(set.size == 0)
            this.labelIndex.delete(segment.symbol);
    }
};

module.exports.prototype.socketActivationHandler = function(type, element, node) {
    if(!node.symbol)
        return;
    if(this.panelIndex.has(node.symbol))
        this.hideSymbol(node.symbol);
    else
        this.showSymbols([node.symbol]);
    this.wiredPanels.syncGraph();
};

module.exports.prototype.socketDeletionHandler = function(type, element, socket) {
    const index = Math.abs(this.wiredPanels.getIndexOfSocket(socket.panel, socket))-1,
          leftSocket = socket.panel.leftSide[index],
          rightSocket = socket.panel.rightSide[index];
    if(leftSocket.symbol && rightSocket.symbol)
        this.symatem.unlinkTriple(socket.panel.symbol, leftSocket.symbol, rightSocket.symbol);
    else
        this.removeSegment(socket.panel, index);
    this.wiredPanels.syncGraph();
};

module.exports.prototype.showSymbols = function(symbols) {
    for(const symbol of symbols) {
        if(this.panelIndex.has(symbol))
            continue;
        const panel = { type: 'entity', leftSide: [], rightSide: [], symbol: symbol },
              result = this.symatem.queryArray(this.symatem.queryMask.MVV, symbol, 0, 0);
        for(let i = 0; i < result.length; i += 2)
            this.generateSegment(panel, result[i], result[i+1]);
        this.wiredPanels.initializePanel(panel);
        this.panelIndex.set(symbol, panel);
        this.addLabel(panel);
        panel.onactivation = function(type, element, node) {
            if(type == 'panels') {
                const string = prompt('Blob:', this.getLabel(node.symbol, null));
                if(string == null)
                    return;
                this.setBlob(this.symatem.deserializeBlob(string), node.symbol);
            } else {
                const symbols = this.symatem.queryArray(this.symatem.queryMask.VIM, 0, 0, node.symbol)
                        .concat(this.symatem.queryArray(this.symatem.queryMask.VMI, 0, node.symbol, 0));
                this.showSymbols(symbols);
            }
            this.wiredPanels.syncGraph();
        }.bind(this);
        panel.ondeletion = function(type, element, panel) {
            this.symatem.unlinkSymbol(panel.symbol);
            this.wiredPanels.syncGraph();
        }.bind(this);
        panel.onwireconnect = function(type, element, dstPanel, wire) {
            if(wire.srcSocket == dstPanel) {
                const panel = this.panelIndex.get(dstPanel.symbol);
                this.generateSegment(panel);
                this.wiredPanels.syncPanel(panel);
            } else if(!wire.srcSocket.symbol) {
                const srcSocket = wire.srcSocket,
                      entity = srcSocket.panel.symbol,
                      srcPanel = this.panelIndex.get(entity),
                      index = this.wiredPanels.getIndexOfSocket(srcPanel, srcSocket),
                      coSocket = this.wiredPanels.getSocketAtIndex(srcPanel, -index);
                if(coSocket.symbol) {
                    let attribute, value;
                    if(srcSocket.type == 'attribute') {
                        attribute = dstPanel.symbol;
                        value = coSocket.symbol;
                    } else {
                        attribute = coSocket.symbol;
                        value = dstPanel.symbol;
                    }
                    if(this.symatem.queryCount(this.symatem.queryMask.MMM, entity, attribute, value) > 0)
                        return;
                    this.removeSegment(srcPanel, Math.abs(index)-1); // TODO
                    this.symatem.linkTriple(entity, attribute, value);
                } else {
                    srcSocket.symbol = dstPanel.symbol;
                    srcSocket.onactivation = this.socketActivationHandler.bind(this);
                    this.addLabel(srcSocket);
                    this.wiredPanels.createWireHelper(srcSocket.type, srcPanel, dstPanel, index, 0);
                }
            } else
                return;
            this.wiredPanels.syncGraph();
        }.bind(this);
    }
    for(const pair of this.panelIndex) {
        const panel = pair[1];
        for(let index = 0; index < panel.leftSide.length; ++index)
            this.wireSegment(panel, index);
    }
};

module.exports.prototype.hideSymbol = function(symbol) {
    const panel = this.panelIndex.get(symbol);
    if(!panel)
        return false;
    this.removeLabel(panel);
    for(let index = 0; index < panel.leftSide.length; ++index) {
        this.removeLabel(panel.leftSide[index]);
        this.removeLabel(panel.rightSide[index]);
    }
    this.panelIndex.delete(symbol);
    this.wiredPanels.delete(panel);
    return true;
};

module.exports.prototype.hideAllSymbols = function() {
    for(const pair of this.panelIndex)
        this.wiredPanels.delete(pair[1]);
    this.panelIndex.clear();
    this.labelIndex.clear();
};

module.exports.prototype.generateSegment = function(panel, attribute, value) {
    panel.leftSide.push({
        type: 'attribute',
        symbol: attribute,
        onactivation: this.socketActivationHandler.bind(this),
        ondeletion: this.socketDeletionHandler.bind(this)
    });
    panel.rightSide.push({
        type: 'value',
        symbol: value,
        onactivation: this.socketActivationHandler.bind(this),
        ondeletion: this.socketDeletionHandler.bind(this)
    });
};

module.exports.prototype.wireSegment = function(panel, index) {
    const leftSocket = panel.leftSide[index],
          rightSocket = panel.rightSide[index];
    if(leftSocket.symbol && !leftSocket.label.textContent)
        this.addLabel(leftSocket);
    if(rightSocket.symbol && !rightSocket.label.textContent)
        this.addLabel(rightSocket);
    if(leftSocket.wiresPerPanel.size == 0 && this.panelIndex.has(leftSocket.symbol))
        this.wiredPanels.createWireHelper('attribute', panel, this.panelIndex.get(leftSocket.symbol), -index-1, 0);
    if(rightSocket.wiresPerPanel.size == 0 && this.panelIndex.has(rightSocket.symbol))
        this.wiredPanels.createWireHelper('value', panel, this.panelIndex.get(rightSocket.symbol), index+1, 0);
};

module.exports.prototype.removeSegment = function(panel, index) {
    const leftSocket = panel.leftSide[index],
          rightSocket = panel.rightSide[index];
    this.removeLabel(leftSocket);
    this.removeLabel(rightSocket);
    leftSocket.deathFlag = true;
    rightSocket.deathFlag = true;
    this.wiredPanels.syncPanel(panel);
};

module.exports.prototype.saveImage = function() {
    const file = new Blob([this.symatem.encodeOntologyBinary()], {type: 'octet/stream'}),
          url = URL.createObjectURL(file);
    if(navigator.userAgent.toLowerCase().indexOf('firefox') > -1) {
        window.open(url, '_blank');
    } else {
        const a = document.createElement('a');
        a.href = url;
        a.download = 'Ontology';
        a.click();
    }
    URL.revokeObjectURL(url);
};

module.exports.prototype.loadImage = function(event) {
    event.stopPropagation();
    event.preventDefault();
    const input = event.dataTransfer || event.target;
    if(!input || !input.files || input.files.length != 1)
        return;
    const file = input.files[0], reader = new FileReader();
    reader.onload = function(event) {
        this.hideAllSymbols();
        this.symatem.resetImage();
        this.symatem.decodeOntologyBinary(new Uint8Array(reader.result));
        this.showSymbols([1]); // TODO
        this.wiredPanels.syncGraph();
    }.bind(this);
    reader.onerror = function(error) {
        console.log(error);
    }.bind(this);
    reader.readAsArrayBuffer(file);
};

if(process.browser)
    new module.exports(document.currentScript.parentNode).then(function(ontologyEditor) {
        const codeInput = document.getElementById('code');
        const element = ontologyEditor.wiredPanels.svg.parentNode;
        function loadFromText() {
            ontologyEditor.hideAllSymbols();
            ontologyEditor.symatem.resetImage();
            const result = ontologyEditor.symatem.deserializeHRL(codeInput.innerText);
            ontologyEditor.showSymbols((result[0]) ? result : [result]);
            ontologyEditor.wiredPanels.syncGraph();
            Prism.highlightElement(codeInput);
        }
        ontologyEditor.fetchResource(codeInput.innerText, 'text').then(function(result) {
            codeInput.innerText = result;
            loadFromText();
        });
        const startEditingCode = function() {
            codeInput.innerHTML = '<textarea style="width: 100%;" rows="32">'+codeInput.innerText+'</textarea>';
            codeInput.parentNode.onclick = undefined;
            codeInput.childNodes[0].onblur = stopEditingCode;
        };
        const stopEditingCode = function() {
            codeInput.innerHTML = codeInput.childNodes[0].value;
            codeInput.parentNode.onclick = startEditingCode;
            loadFromText();
        };
        codeInput.parentNode.onclick = startEditingCode;
        document.getElementById('saveImage').onclick = function(event) {
            ontologyEditor.saveImage();
        };
        element.addEventListener('dragover', function(event) {
            event.stopPropagation();
            event.preventDefault();
            event.dataTransfer.dropEffect = 'copy';
        }, false);
        element.addEventListener('drop', ontologyEditor.loadImage.bind(ontologyEditor), false);
    });
