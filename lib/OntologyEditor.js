'use strict';

const WiredPanels = require('WiredPanels'),
      Symatem = require('SymatemWasm');

module.exports = function(element) {
    if(typeof WebAssembly !== 'object') {
        const message = document.createElement('div');
        element.appendChild(message);
        message.innerHTML = 'WebAssembly is a young technology and seems to be unsupported or disabled.<br /><br />';
        const link = document.createElement('a');
        message.appendChild(link);
        link.href = 'http://webassembly.org/demo/';
        link.innerText = 'Learn More';
        return;
    }

    this.wiredPanels = new WiredPanels(element);
    this.panelIndex = new Map;
    this.labelIndex = new Map;

    document.addEventListener('dragover', function(event) {
        event.stopPropagation();
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
    }, false);
    document.addEventListener('drop', module.exports.prototype.loadImage, false);

    this.fetchResource('../public/js/Symatem.wasm', 'arraybuffer').then(function(event) {
        new Symatem(new Uint8Array(event.target.response)).then(function(symatemInstance) {
            this.symatem = symatemInstance;
            const result = this.symatem.deserializeBlob(document.getElementById('code').innerText);
            this.showSymbols((result[0]) ? result : [result]);
        }.bind(this));
    }.bind(this));
}

module.exports.prototype.fetchResource = function(URL, type) {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', URL, true);
    xhr.responseType = type;
    xhr.send(null);
    return new Promise(function(fullfill, reject) {
        xhr.onload = fullfill;
        xhr.onerror = reject;
    });
};

module.exports.prototype.labelEventHandler = function(type, element, node) {
    if(type == 'panels') {
        // TODO: Relink BlobType
        let blob = prompt('Edit blob:', node.label.textContent);
        if(blob != null) {
            if(blob.length == 0)
                blob = undefined;
            else if(!Number.isNaN(parseFloat(blob)))
                blob = parseFloat(blob);
            else if(!Number.isNaN(parseInt(blob)))
                blob = parseInt(blob);
            this.symatem.writeBlob(node.symbol, blob);
            for(const segement of this.labelIndex.get(node.symbol))
                this.syncLabel(segement);
        }
        return;
    }
    if(node.rect) {
        this.hideSymbol(node.symbol);
        this.wiredPanels.syncGraph();
    } else if(this.panelIndex.has(node.symbol)) {
        const symbols = this.symatem.query(this.symatem.queryMask.VIM, 0, 0, node.symbol)
                .concat(this.symatem.query(this.symatem.queryMask.VMI, 0, node.symbol, 0));
        this.showSymbols(symbols);
    } else
        this.showSymbols([node.symbol]);
};

module.exports.prototype.getTripleOfWire = function(wire) {
    let socketIndex = -this.wiredPanels.getIndexOfSocket(wire.srcPanel, wire.srcSocket),
        entity = wire.srcPanel.symbol, attribute, value;
    if(wire.srcSocket.type == 'attribute') {
        attribute = wire.srcSocket.symbol;
        value = this.wiredPanels.getSocketAtIndex(wire.srcPanel, socketIndex).symbol;
    } else {
        attribute = this.wiredPanels.getSocketAtIndex(wire.srcPanel, socketIndex).symbol;
        value = wire.srcSocket.symbol;
    }
    return [entity, attribute, value];
};

module.exports.prototype.linkTriple = function(entity, attribute, value) {
    this.symatem.call('link', entity, attribute, value);
    if(!this.panelIndex.has(entity))
        return;
    const panel = this.panelIndex.get(entity);
    // TODO
    panel.leftSide.push({ type: 'attribute', symbol: attribute });
    panel.rightSide.push({ type: 'value', symbol: value });
    this.wireSegment(panel, panel.leftSide.length-1);
};

module.exports.prototype.unlinkTriple = function(entity, attribute, value) {
    this.symatem.call('unlink', entity, attribute, value);
    if(!this.panelIndex.has(entity))
        return;
    const panel = this.panelIndex.get(entity), referenceCount =
        this.symatem.query(this.symatem.queryMask.MVV, entity, 0, 0, true)+
        this.symatem.query(this.symatem.queryMask.VMV, 0, entity, 0, true)+
        this.symatem.query(this.symatem.queryMask.VVM, 0, 0, entity, true);
    if(referenceCount == 0)
        this.hideSymbol(node.symbol);
    else for(let index = 0; index < panel.leftSide.length; ++index)
        if(panel.leftSide[index].symbol == attribute && panel.rightSide[index].symbol == value) {
            this.removeSegment(panel, index);
            break;
        }
};

module.exports.prototype.syncLabel = function(segment) {
    const string = this.symatem.serializeBlob(segment.symbol);
    if(typeof string === 'undefined') {
        segment.label.classList.add('disabled');
        segment.label.textContent = '#'+segment.symbol;
    } else {
        segment.label.classList.remove('disabled');
        segment.label.textContent = string;
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
        panel.onactivation = this.labelEventHandler.bind(this);
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

module.exports.prototype.removeSegment = function(panel, index) {
    const leftSegment = panel.leftSide[index],
          rightSegment = panel.rightSide[index];
    this.unindexLabel(leftSegment);
    this.unindexLabel(rightSegment);
    leftSegment.deathFlag = true;
    rightSegment.deathFlag = true;
    this.wiredPanels.syncPanel(panel);
    this.wiredPanels.syncGraph();
};

module.exports.prototype.wireSegment = function(panel, index) {
    const leftSegment = panel.leftSide[index],
          rightSegment = panel.rightSide[index];
    this.indexLabel(leftSegment);
    this.indexLabel(rightSegment);
    leftSegment.onactivation = this.labelEventHandler.bind(this);
    rightSegment.onactivation = this.labelEventHandler.bind(this);
    if(leftSegment.wiresPerPanel.size == 0 && this.panelIndex.has(leftSegment.symbol))
        this.wiredPanels.createWireHelper('attribute', panel, this.panelIndex.get(leftSegment.symbol), -index-1, 0);
    if(rightSegment.wiresPerPanel.size == 0 && this.panelIndex.has(rightSegment.symbol))
        this.wiredPanels.createWireHelper('value', panel, this.panelIndex.get(rightSegment.symbol), index+1, 0);
};

module.exports.prototype.saveImage = function() {
    const a = document.createElement('a'),
          file = new Blob([this.symatem.saveImage()]);
    a.href = URL.createObjectURL(file);
    a.download = 'Image';
    a.click();
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
    };
    reader.onerror = function(error) {
        console.log(error);
    };
    reader.readAsArrayBuffer(file);
};

if(process.browser)
    new module.exports(document.currentScript.parentNode);
