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
                    const symbol = this.symatem.call('createSymbol');
                    if(this.editBlobOfSymbol(symbol, '#'+symbol))
                        this.showSymbols([symbol]);
                    else
                        this.symatem.call('releaseSymbol', symbol);
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
    for(const segement of this.labelIndex.get(symbol))
        this.syncLabel(segement);
};

module.exports.prototype.editBlobOfSymbol = function(symbol, blob) {
    const string = prompt('Blob:', blob);
    if(string == null)
        return false;
    if(string.length > 2 && string[0] == '"' && string[string.length-1] == '"')
        blob = string.substr(1, string.length-2);
    else if(!Number.isNaN(parseFloat(string)))
        blob = parseFloat(string);
    else if(!Number.isNaN(parseInt(string)))
        blob = parseInt(string);
    else
        blob = undefined;
    this.setBlob(symbol, blob);
    return true;
};

module.exports.prototype.getTripleOfWire = function(wire) {
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
};

module.exports.prototype.linkTriple = function(entity, attribute, value, onlyVisual) {
    if(!onlyVisual)
        this.symatem.call('link', entity, attribute, value);
    if(!this.panelIndex.has(entity))
        return;
    const panel = this.panelIndex.get(entity);
    panel.leftSide.push({ type: 'attribute', symbol: attribute });
    panel.rightSide.push({ type: 'value', symbol: value });
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
        this.symatem.query(this.symatem.queryMask.MVV, entity, 0, 0, true)+
        this.symatem.query(this.symatem.queryMask.VMV, 0, entity, 0, true)+
        this.symatem.query(this.symatem.queryMask.VVM, 0, 0, entity, true);
    if(referenceCount == 0)
        this.hideSymbol(entity);
    else for(let index = 0; index < panel.leftSide.length; ++index)
        if(panel.leftSide[index].symbol == attribute && panel.rightSide[index].symbol == value) {
            this.removeSegment(panel, index);
            break;
        }
};

module.exports.prototype.syncLabel = function(segment) {
    const blob = this.symatem.getBlob(segment.symbol);
    if(typeof blob === 'undefined') {
        segment.label.classList.add('disabled');
        segment.label.textContent = '#'+segment.symbol;
    } else {
        segment.label.classList.remove('disabled');
        segment.label.textContent = (typeof blob === 'string') ? '"'+blob+'"' : ''+blob;
    }
};

module.exports.prototype.indexLabel = function(segement) {
    let set = this.labelIndex.get(segement.symbol);
    if(!set) {
        set = new Set;
        this.labelIndex.set(segement.symbol, set);
    }
    set.add(segement);
    this.syncLabel(segement);
};

module.exports.prototype.unindexLabel = function(segement) {
    let set = this.labelIndex.get(segement.symbol);
    if(set)
        set.delete(segement);
};

module.exports.prototype.panelActivationHandler = function(type, element, node) {
    if(type == 'panels')
        this.editBlobOfSymbol(node.symbol, node.label.textContent);
    else if(node.rect) {
        const symbols = this.symatem.query(this.symatem.queryMask.VIM, 0, 0, node.symbol)
                .concat(this.symatem.query(this.symatem.queryMask.VMI, 0, node.symbol, 0));
        this.showSymbols(symbols);
    }
};

module.exports.prototype.socketActivationHandler = function(type, element, node) {
    if(this.panelIndex.has(node.symbol)) {
        this.hideSymbol(node.symbol);
        this.wiredPanels.syncGraph();
    } else
        this.showSymbols([node.symbol]);
};

module.exports.prototype.panelDeletionHandler = function(type, element, panel) {
    let results = this.symatem.query(this.symatem.queryMask.VVM, 0, 0, panel.symbol);
    for(let i = 0; i < results.length; i += 2)
        this.unlinkTriple(results[i], results[i+1], panel.symbol, true);
    results = this.symatem.query(this.symatem.queryMask.VMV, 0, panel.symbol, 0);
    for(let i = 0; i < results.length; i += 2)
        this.unlinkTriple(results[i], panel.symbol, results[i+1], true);
    this.hideSymbol(panel.symbol);
    this.symatem.call('releaseSymbol', panel.symbol);
};

module.exports.prototype.socketDeletionHandler = function(type, element, socket) {
    const index = Math.abs(this.wiredPanels.getIndexOfSocket(socket.panel, socket))-1,
          leftSocket = socket.panel.leftSide[index],
          rightSocket = socket.panel.rightSide[index];
    this.unlinkTriple(socket.panel.symbol, leftSocket.symbol, rightSocket.symbol);
};

module.exports.prototype.panelWireConnectHandler = function(type, element, node, wire) {
    // this.linkTriple(node.symbol, , );
    // TODO
};

module.exports.prototype.showSymbols = function(symbols) {
    for(const symbol of symbols) {
        if(this.panelIndex.has(symbol))
            continue;
        const panel = { type: 'entity', leftSide: [], rightSide: [], symbol: symbol },
              queryResult = this.symatem.query(this.symatem.queryMask.MVV, symbol, 0, 0);
        for(let i = 0; i < queryResult.length; i += 2) {
            panel.leftSide.push({ type: 'attribute', symbol: queryResult[i] });
            panel.rightSide.push({ type: 'value', symbol: queryResult[i+1] });
        }
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

module.exports.prototype.removeSegment = function(panel, index) {
    const leftSocket = panel.leftSide[index],
          rightSocket = panel.rightSide[index];
    this.unindexLabel(leftSocket);
    this.unindexLabel(rightSocket);
    leftSocket.deathFlag = true;
    rightSocket.deathFlag = true;
    this.wiredPanels.syncPanel(panel);
};

module.exports.prototype.wireSegment = function(panel, index) {
    const leftSocket = panel.leftSide[index],
          rightSocket = panel.rightSide[index];
    this.indexLabel(leftSocket);
    this.indexLabel(rightSocket);
    leftSocket.onactivation = this.socketActivationHandler.bind(this);
    rightSocket.onactivation = this.socketActivationHandler.bind(this);
    leftSocket.ondeletion = this.socketDeletionHandler.bind(this);
    rightSocket.ondeletion = this.socketDeletionHandler.bind(this);
    if(leftSocket.wiresPerPanel.size == 0 && this.panelIndex.has(leftSocket.symbol))
        this.wiredPanels.createWireHelper('attribute', panel, this.panelIndex.get(leftSocket.symbol), -index-1, 0);
    if(rightSocket.wiresPerPanel.size == 0 && this.panelIndex.has(rightSocket.symbol))
        this.wiredPanels.createWireHelper('value', panel, this.panelIndex.get(rightSocket.symbol), index+1, 0);
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
        const codeInput = document.getElementById('code');
        const element = ontologyEditor.wiredPanels.svg.parentNode;
        function loadFromText() {
            const result = ontologyEditor.symatem.deserializeBlob(codeInput.innerText);
            ontologyEditor.showSymbols((result[0]) ? result : [result]);
        }
        loadFromText();
        const startEditingCode = function() {
            codeInput.innerHTML = '<textarea style="width: 100%;" rows="32">'+codeInput.innerText+'</textarea>';
            codeInput.parentNode.onclick = undefined;
            codeInput.childNodes[0].onblur = stopEditingCode;
        };
        const stopEditingCode = function() {
            codeInput.innerHTML = codeInput.childNodes[0].value;
            codeInput.parentNode.onclick = startEditingCode;
            ontologyEditor.symatem.resetImage();
            ontologyEditor.hideAllSymbols();
            loadFromText();
            Prism.highlightElement(codeInput);
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