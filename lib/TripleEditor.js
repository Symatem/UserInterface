'use strict';

let WiredPanels = require('WiredPanels'),
    Symatem = require('./Symatem.js');

module.exports = function(element) {
    if(typeof WebAssembly !== 'object') {
        console.log('WebAssembly is not supported or disabled.');
        return;
    }

    this.wiredPanels = new WiredPanels(element);
    this.panelIndex = new Map;

    document.addEventListener('dragover', function(event) {
        event.stopPropagation();
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
    }, false);
    document.addEventListener('drop', module.exports.prototype.loadImage, false);

    this.fetchResource('../../CppCodeBase/build/Symatem.wasm', 'arraybuffer').then(function(event) {
        Symatem.initImage(new Uint8Array(event.target.response)).then(function() {
            const result = Symatem.deserialize(document.getElementById('code').innerText);
            this.showSymbol((result[0]) ? result[0] : result);
            this.wireSymbolsAndSyncGraph();
        }.bind(this));
    }.bind(this));
}

module.exports.prototype.syncLabel = function(label, symbol) {
    const type = Symatem.query(Symatem.queryMask.MMV, symbol, Symatem.symbolByName.BlobType, 0);
    if(type.length == 0) {
        label.textContent = '#'+symbol;
        label.classList.add('disabled');
    } else {
        const blob = Symatem.readBlob(symbol),
              dataView = new DataView(blob.buffer);
        label.classList.remove('disabled');
        switch(type[0]) {
            case Symatem.symbolByName.Natural:
                label.textContent = dataView.getUint32(0, true);
                break;
            case Symatem.symbolByName.Integer:
                label.textContent = dataView.getInt32(0, true);
                break;
            case Symatem.symbolByName.Float:
                label.textContent = dataView.getFloat32(0, true);
                break;
            case Symatem.symbolByName.UTF8:
                label.textContent = Symatem.uint8ArrayToString(blob);
                break;
        }
    }
};

module.exports.prototype.syncPanelLabels = function(panel) {
    this.syncLabel(panel.label, panel.symbol);
    for(let i = 0; i < panel.leftSide.length; ++i) {
        this.syncLabel(panel.leftSide[i].label, panel.leftSide[i].symbol);
        this.syncLabel(panel.rightSide[i].label, panel.rightSide[i].symbol);
    }
};

module.exports.prototype.showSymbol = function(symbol) {
    const panel = { type: 'entity', leftSide: [], rightSide: [], symbol: symbol },
          queryResult = Symatem.query(Symatem.queryMask.MVV, symbol, 0, 0);
    for(let i = 0; i < queryResult.length; i += 2) {
        let segement = {type: 'attribute', symbol: queryResult[i]};
        segement.onactivation = this.handleLabelActivation.bind(this, panel, segement);
        panel.leftSide.push(segement);
        segement = {type: 'value', symbol: queryResult[i+1]};
        segement.onactivation = this.handleLabelActivation.bind(this, panel, segement);
        panel.rightSide.push(segement);
    }
    panel.onactivation = this.handleLabelActivation.bind(this, panel, panel);
    this.wiredPanels.initializePanel(panel);
    this.panelIndex.set(symbol, panel);
    this.syncPanelLabels(panel);
    // panel.label.onclick = function() {
        // TODO: Enable editing of panel.label.textContent
    // };
};

module.exports.prototype.hideSymbol = function(symbol) {
    const panel = this.panelIndex.get(symbol);
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
          file = new Blob([Symatem.saveImage()]);
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
        Symatem.loadImage(new Uint8Array(reader.result));
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

// TODO
new module.exports(document.currentScript.parentNode);
