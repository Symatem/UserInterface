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
                element.ondblclick = function() {
                    const input = prompt('Blob:');
                    if(input == null || (input[0] != '"' && input.indexOf(';') > -1))
                        return;
                    const result = this.symatem.deserializeHRL(input);
                    if(result.length == 0)
                        this.showSymbols([this.symatem.call('createSymbol')]);
                    else
                        this.showSymbols((result[0]) ? result : [result]);
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

module.exports.prototype.setBlob = function(symbol, blob) {
    const oldType = this.symatem.getBlobType(symbol);
    this.symatem.setBlob(symbol, blob);
    if(!this.panelIndex.has(symbol))
        return;
    const newType = this.symatem.getBlobType(symbol);
    if(oldType != newType) {
        if(oldType != 0) {
            this.unlinkTriple(symbol, this.symatem.symbolByName.BlobType, oldType, true);
            this.wiredPanels.syncGraph();
        }
        if(newType != 0)
            this.linkTriple(symbol, this.symatem.symbolByName.BlobType, newType, true);
    }
    const label = this.getLabel(symbol);
    for(const segment of this.labelIndex.get(symbol))
        this.indexLabel(segment, label);
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

module.exports.prototype.linkTriple = function(entity, attribute, value, onlyVisual) {
    if(!onlyVisual)
        this.symatem.call('link', entity, attribute, value);
    if(!this.panelIndex.has(entity))
        return;
    const panel = this.panelIndex.get(entity);
    this.generateSegment(panel, attribute, value);
    this.wiredPanels.syncPanel(panel);
    this.wireSegment(panel, panel.leftSide.length-1);
    this.wiredPanels.tickGraph();
};

module.exports.prototype.unlinkTriple = function(entity, attribute, value, onlyVisual) {
    if(!onlyVisual)
        this.symatem.call('unlink', entity, attribute, value);
    if(!this.panelIndex.has(entity))
        return;
    const panel = this.panelIndex.get(entity), referenceCount =
        this.symatem.queryCount(this.symatem.queryMask.MVV, entity, 0, 0)+
        this.symatem.queryCount(this.symatem.queryMask.VMV, 0, entity, 0)+
        this.symatem.queryCount(this.symatem.queryMask.VVM, 0, 0, entity);
    if(referenceCount == 0)
        this.hideSymbol(entity);
    else for(let index = 0; index < panel.leftSide.length; ++index)
        if(panel.leftSide[index].symbol == attribute && panel.rightSide[index].symbol == value) {
            this.removeSegment(panel, index);
            break;
        }
};

module.exports.prototype.getLabel = function(symbol, cap = 16) {
    let label = this.symatem.serializeBlob(symbol);
    if(cap > 0 && label.length > cap+1)
        label = label.substr(0, cap)+'…';
    return label;
};

module.exports.prototype.indexLabel = function(segment, label) {
    let set = this.labelIndex.get(segment.symbol);
    if(!set) {
        set = new Set([segment]);
        this.labelIndex.set(segment.symbol, set);
        label = this.getLabel(segment.symbol);
    } else if(!label) {
        label = set.keys().next().value.label.textContent;
        set.add(segment);
    }
    segment.label.textContent = label;
    if(label[0] == '#')
        segment.label.classList.add('disabled');
    else
        segment.label.classList.remove('disabled');
};

module.exports.prototype.unindexLabel = function(segment) {
    let set = this.labelIndex.get(segment.symbol);
    if(set) {
        set.delete(segment);
        if(set.size == 0)
            this.labelIndex.delete(segment.symbol);
    }
};

module.exports.prototype.panelActivationHandler = function(type, element, node) {
    if(type == 'panels') {
        const string = prompt('Blob:', this.getLabel(node.symbol, null));
        if(string == null)
            return;
        this.setBlob(node.symbol, this.symatem.deserializeBlob(string));
    } else {
        const symbols = this.symatem.queryArray(this.symatem.queryMask.VIM, 0, 0, node.symbol)
                .concat(this.symatem.queryArray(this.symatem.queryMask.VMI, 0, node.symbol, 0));
        this.showSymbols(symbols);
    }
};

module.exports.prototype.socketActivationHandler = function(type, element, node) {
    if(!node.symbol)
        return;
    if(this.panelIndex.has(node.symbol)) {
        this.hideSymbol(node.symbol);
        this.wiredPanels.syncGraph();
    } else
        this.showSymbols([node.symbol]);
};

module.exports.prototype.panelDeletionHandler = function(type, element, panel) {
    let results = this.symatem.queryArray(this.symatem.queryMask.VVM, 0, 0, panel.symbol);
    for(let i = 0; i < results.length; i += 2)
        this.unlinkTriple(results[i], results[i+1], panel.symbol, true);
    results = this.symatem.queryArray(this.symatem.queryMask.VMV, 0, panel.symbol, 0);
    for(let i = 0; i < results.length; i += 2)
        this.unlinkTriple(results[i], panel.symbol, results[i+1], true);
    this.hideSymbol(panel.symbol);
    this.symatem.call('releaseSymbol', panel.symbol);
};

module.exports.prototype.socketDeletionHandler = function(type, element, socket) {
    const index = Math.abs(this.wiredPanels.getIndexOfSocket(socket.panel, socket))-1,
          leftSocket = socket.panel.leftSide[index],
          rightSocket = socket.panel.rightSide[index];
    if(leftSocket.symbol && rightSocket.symbol)
        this.unlinkTriple(socket.panel.symbol, leftSocket.symbol, rightSocket.symbol);
    else
        this.removeSegment(socket.panel, index);
};

module.exports.prototype.panelWireConnectHandler = function(type, element, dstPanel, wire) {
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
        if(coSocket.symbol != undefined) {
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
            this.symatem.call('link', entity, attribute, value);
        }
        srcSocket.symbol = dstPanel.symbol;
        srcSocket.onactivation = this.socketActivationHandler.bind(this);
        this.indexLabel(srcSocket);
        this.wiredPanels.createWireHelper(srcSocket.type, srcPanel, dstPanel, index, 0);
    } else
        return;
    this.wiredPanels.tickGraph();
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
        this.indexLabel(panel);
        panel.onactivation = this.panelActivationHandler.bind(this);
        panel.ondeletion = this.panelDeletionHandler.bind(this);
        panel.onwireconnect = this.panelWireConnectHandler.bind(this);
    }
    for(const pair of this.panelIndex) {
        const panel = pair[1];
        for(let index = 0; index < panel.leftSide.length; ++index)
            this.wireSegment(panel, index);
    }
    this.wiredPanels.syncGraph();
};

module.exports.prototype.hideSymbol = function(symbol) {
    const panel = this.panelIndex.get(symbol);
    this.unindexLabel(panel);
    for(let index = 0; index < panel.leftSide.length; ++index) {
        this.unindexLabel(panel.leftSide[index]);
        this.unindexLabel(panel.rightSide[index]);
    }
    this.panelIndex.delete(symbol);
    this.wiredPanels.delete(panel);
};

module.exports.prototype.hideAllSymbols = function() {
    for(const pair of this.panelIndex)
        this.wiredPanels.delete(pair[1]);
    this.wiredPanels.syncGraph();
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
        this.indexLabel(leftSocket);
    if(rightSocket.symbol && !rightSocket.label.textContent)
        this.indexLabel(rightSocket);
    if(leftSocket.wiresPerPanel.size == 0 && this.panelIndex.has(leftSocket.symbol))
        this.wiredPanels.createWireHelper('attribute', panel, this.panelIndex.get(leftSocket.symbol), -index-1, 0);
    if(rightSocket.wiresPerPanel.size == 0 && this.panelIndex.has(rightSocket.symbol))
        this.wiredPanels.createWireHelper('value', panel, this.panelIndex.get(rightSocket.symbol), index+1, 0);
};

module.exports.prototype.removeSegment = function(panel, index) {
    const leftSocket = panel.leftSide[index],
          rightSocket = panel.rightSide[index];
    this.unindexLabel(leftSocket);
    this.unindexLabel(rightSocket);
    leftSocket.deathFlag = true;
    rightSocket.deathFlag = true;
    this.wiredPanels.syncPanel(panel);
};

module.exports.prototype.saveImage = function() {
    const file = new Blob([this.symatem.saveImage()], {type: 'octet/stream'}),
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
        this.symatem.loadImage(new Uint8Array(reader.result));
        this.hideAllSymbols();
        this.showSymbols([1]); // TODO
    }.bind(this);
    reader.onerror = function(error) {
        console.log(error);
    }.bind(this);
    reader.readAsArrayBuffer(file);
};

if(process.browser)
    new module.exports(document.currentScript.parentNode).then(function(ontologyEditor) {
        const codeExamples = document.getElementById('codeExamples');
        const codeInput = document.getElementById('code');
        const element = ontologyEditor.wiredPanels.svg.parentNode;
        function loadFromText() {
            ontologyEditor.hideAllSymbols();
            ontologyEditor.symatem.resetImage();
            const result = ontologyEditor.symatem.deserializeHRL(codeInput.innerText);
            ontologyEditor.showSymbols((result[0]) ? result : [result]);
            Prism.highlightElement(codeInput);
        }
        codeExamples.onchange = function() {
            ontologyEditor.fetchResource(codeExamples.value, 'text').then(function(result) {
                codeInput.innerHTML = result;
                loadFromText();
            });
        };
        codeExamples.onchange();
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
