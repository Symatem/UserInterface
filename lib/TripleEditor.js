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

    this.fetchResource('../../CppCodeBase/build/Symatem.wasm', 'arraybuffer').then(function(event) {
        new Symatem(new Uint8Array(event.target.response)).then(function(symatemInstance) {
            this.symatem = symatemInstance;
            const result = this.symatem.deserializeBlob(document.getElementById('code').innerText);
            this.showSymbol((result[0]) ? result[0] : result);
            this.wireSymbolsAndSyncGraph();
        }.bind(this));
    }.bind(this));
}

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

module.exports.prototype.showSymbol = function(symbol) {
    const panel = { type: 'entity', leftSide: [], rightSide: [], symbol: symbol },
          queryResult = this.symatem.query(this.symatem.queryMask.MVV, symbol, 0, 0);
    for(let i = 0; i < queryResult.length; i += 2) {
        let segement = { type: 'attribute', symbol: queryResult[i] };
        segement.onactivation = this.handleLabelActivation.bind(this, panel, segement);
        panel.leftSide.push(segement);
        segement = { type: 'value', symbol: queryResult[i+1] };
        segement.onactivation = this.handleLabelActivation.bind(this, panel, segement);
        panel.rightSide.push(segement);
    }
    panel.onactivation = this.handleLabelActivation.bind(this, panel, panel);
    this.wiredPanels.initializePanel(panel);
    this.panelIndex.set(symbol, panel);
    this.indexLabel(panel);
    for(let i = 0; i < panel.leftSide.length; ++i) {
        this.indexLabel(panel.leftSide[i]);
        this.indexLabel(panel.rightSide[i]);
    }
    /*panel.label.onclick = function() {
        let blob = prompt('Edit blob:', panel.label.textContent);
        if(blob != null) {
            if(blob.length == 0)
                blob = undefined;
            else if(!Number.isNaN(parseFloat(blob)))
                blob = parseFloat(blob);
            else if(!Number.isNaN(parseInt(blob)))
                blob = parseInt(blob);
            this.symatem.writeBlob(panel.symbol, blob);
            for(const segement of this.labelIndex.get(panel.symbol))
                this.syncLabel(segement);
        }
    }.bind(this);*/
};

module.exports.prototype.hideSymbol = function(symbol) {
    const panel = this.panelIndex.get(symbol);
    this.unindexLabel(panel);
    for(let i = 0; i < panel.leftSide.length; ++i) {
        this.unindexLabel(panel.leftSide[i]);
        this.unindexLabel(panel.rightSide[i]);
    }
    this.panelIndex.delete(symbol);
    this.wiredPanels.delete(panel);
};

module.exports.prototype.handleLabelActivation = function(panel, segment) {
    if(panel == segment)
        return;
    if(this.panelIndex.has(segment.symbol)) {
        this.hideSymbol(segment.symbol);
        this.wiredPanels.syncGraph();
    } else {
        this.showSymbol(segment.symbol);
        this.wireSymbolsAndSyncGraph();
    }
};

module.exports.prototype.wireSymbolsAndSyncGraph = function() {
    for(const pair of this.panelIndex) {
        const panel = pair[1];
        for(let i = 0; i < panel.leftSide.length; ++i) {
            const leftSegment = panel.leftSide[i],
                  rightSegment = panel.rightSide[i];
            if(leftSegment.wiresPerPanel.size == 0 && this.panelIndex.has(leftSegment.symbol))
                this.wiredPanels.createWireHelper('attribute', panel, this.panelIndex.get(leftSegment.symbol), -i-1, 0);
            if(rightSegment.wiresPerPanel.size == 0 && this.panelIndex.has(rightSegment.symbol))
                this.wiredPanels.createWireHelper('value', panel, this.panelIndex.get(rightSegment.symbol), i+1, 0);
        }
    }
    this.wiredPanels.syncGraph();
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

if(process.browser)
    new module.exports(document.currentScript.parentNode);
