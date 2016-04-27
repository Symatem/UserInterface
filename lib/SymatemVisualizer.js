'use strict';

let WiredPanels = require('WiredPanels');

module.exports = function(element) {
    this.wiredPanels = new WiredPanels(element);
    this.panelIndex = new Map;

    this.showSymbol(1485);
    this.wireSymbolsAndSyncGraph();
    this.wiredPanels.cursorPanel = this.wiredPanels.panels[0];
    this.wiredPanels.setCursorIndex(0);
}

module.exports.prototype.syncLabel = function(label, symbol) {
    const symbolName = this.data.symbolNames[symbol];
    if(symbolName != undefined) {
        label.textContent = symbolName;
        label.classList.remove('disabled');
    } else {
        label.textContent = '#'+symbol;
        label.classList.add('disabled');
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
    const panel = {leftSide:[], rightSide:[], symbol:symbol};
    for(let i = 0; i < this.data.triples.length; ++i) {
        if(this.data.triples[i][0] != symbol)
            continue;
        panel.leftSide.push({symbol:this.data.triples[i][1]});
        panel.rightSide.push({symbol:this.data.triples[i][2]});
    }
    this.wiredPanels.initializePanel(panel);
    this.panelIndex.set(symbol, panel);
    for(let i = 0; i < panel.lines.length; ++i)
        panel.lines[i].classList.add('entity');
    panel.rect.classList.add('entity');
    panel.socket.classList.add('entity');
    panel.socket.onactivation = this.handleLabelActivation.bind(this, panel, panel);
    for(let i = 0; i < panel.leftSide.length; ++i) {
        panel.leftSide[i].socket.classList.add('attribute');
        panel.leftSide[i].socket.onactivation = this.handleLabelActivation.bind(this, panel, panel.leftSide[i]);
        panel.rightSide[i].socket.classList.add('value');
        panel.rightSide[i].socket.onactivation = this.handleLabelActivation.bind(this, panel, panel.rightSide[i]);
    }
    this.syncPanelLabels(panel);
};

module.exports.prototype.hideSymbol = function(symbol) {
    const panel = this.panelIndex.get(symbol);
    this.panelIndex.delete(symbol);
    this.wiredPanels.delete(panel);
};

module.exports.prototype.handleLabelActivation = function(panel, segment) {
    if(panel == segment) {
        this.wiredPanels.cursorPanel = panel;
        this.wiredPanels.setCursorIndex(0);
        return;
    }
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
            if(leftSegment.socket.wiresPerPanel.size == 0 && this.panelIndex.has(leftSegment.symbol)) {
                const wire = this.wiredPanels.createWireHelper(panel, this.panelIndex.get(leftSegment.symbol), -i-1, 0);
                wire.path.classList.add('attribute');
            }
            if(rightSegment.socket.wiresPerPanel.size == 0 && this.panelIndex.has(rightSegment.symbol)) {
                const wire = this.wiredPanels.createWireHelper(panel, this.panelIndex.get(rightSegment.symbol), i+1, 0);
                wire.path.classList.add('value');
            }
        }
    }
    this.wiredPanels.syncGraph();
};

module.exports.prototype.data = {
    symbolNames:{
        13:'Procedure',
        14:'Execute',
        15:'Next',
        16:'Static',
        17:'Dynamic',
        18:'Input',
        19:'Output',
        23:'Count',
        32:'Create',
        35:'Pop',
        36:'Branch',
        54:'CloneBlob',
        62:'LessThan',
        64:'Comparandum',
        72:'Add',
        74:'Subtract',
        75:'Minuend',
        76:'Subtrahend',
        1485:'FiboRec',
        1590:'#a',
        1601:'#b',
        1816:2,
        2775:1
    },
    triples:[
        [1485, 14, 1537],
        [1537, 13, 32],
        [1612, 19, 1590],
        [1612, 19, 1601],
        [1537, 16, 1612],
        [1537, 15, 1691],
        [1691, 13, 62],
        [1743, 19, 1590],
        [1743, 18, 18],
        [1691, 17, 1743],
        [1831, 64, 1816],
        [1691, 16, 1831],
        [1691, 15, 1902],
        [1902, 13, 36],
        [1952, 18, 1590],
        [1902, 17, 1952],
        [2024, 13, 54],
        [2069, 18, 18],
        [2069, 19, 19],
        [2024, 17, 2069],
        [2024, 15, 2148],
        [2148, 13, 35],
        [2211, 23, 1816],
        [2148, 16, 2211],
        [2256, 36, 2024],
        [1902, 16, 2256],
        [1902, 15, 2327],
        [2327, 13, 74],
        [2377, 19, 1590],
        [2377, 75, 18],
        [2327, 17, 2377],
        [2462, 76, 1816],
        [2327, 16, 2462],
        [2327, 15, 2531],
        [2531, 13, 1485],
        [2581, 19, 1590],
        [2581, 18, 1590],
        [2531, 17, 2581],
        [2531, 15, 2660],
        [2660, 13, 74],
        [2708, 19, 1601],
        [2708, 75, 18],
        [2660, 17, 2708],
        [2790, 76, 2775],
        [2660, 16, 2790],
        [2660, 15, 2859],
        [2859, 13, 1485],
        [2907, 19, 1601],
        [2907, 18, 1601],
        [2859, 17, 2907],
        [2859, 15, 2990],
        [2990, 13, 72],
        [3040, 19, 19],
        [3040, 18, 1590],
        [3040, 18, 1601],
        [2990, 17, 3040]
    ]
};
