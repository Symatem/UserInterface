'use strict';

let LinkedBoxes = require('LinkedBoxes');

module.exports = function(element) {
    this.linkedBoxes = new LinkedBoxes(element);
    this.nodeIndex = new Map;

    this.showSymbol(1485);
    this.linkSymbolsAndSyncGraph();
    this.linkedBoxes.cursorNode = this.linkedBoxes.nodes[0];
    this.linkedBoxes.setCursorIndex(0);
}

module.exports.prototype.syncLabel = function(label, symbol) {
    const symbolName = this.data.symbolNames[symbol];
    if(symbolName != undefined) {
        label.textContent = symbolName;
        label.classList.remove('gray');
    } else {
        label.textContent = '#'+symbol;
        label.classList.add('gray');
    }
};

module.exports.prototype.syncNodeLabels = function(node) {
    this.syncLabel(node.label, node.symbol);
    for(let i = 0; i < node.leftSide.length; ++i) {
        this.syncLabel(node.leftSide[i].label, node.leftSide[i].symbol);
        this.syncLabel(node.rightSide[i].label, node.rightSide[i].symbol);
    }
};

module.exports.prototype.showSymbol = function(symbol) {
    const node = {leftSide:[], rightSide:[], symbol:symbol};
    for(let i = 0; i < this.data.triples.length; ++i) {
        if(this.data.triples[i][0] != symbol)
            continue;
        node.leftSide.push({symbol:this.data.triples[i][1]});
        node.rightSide.push({symbol:this.data.triples[i][2]});
    }
    this.linkedBoxes.initializeNode(node);
    this.nodeIndex.set(symbol, node);
    for(let i = 0; i < node.lines.length; ++i)
        node.lines[i].classList.add('red');
    node.rect.classList.add('red');
    node.circle.classList.add('red');
    node.circle.onactivation = this.handleLabelActivation.bind(this, node, node);
    for(let i = 0; i < node.leftSide.length; ++i) {
        node.leftSide[i].circle.classList.add('green');
        node.leftSide[i].circle.onactivation = this.handleLabelActivation.bind(this, node, node.leftSide[i]);
        node.rightSide[i].circle.classList.add('blue');
        node.rightSide[i].circle.onactivation = this.handleLabelActivation.bind(this, node, node.rightSide[i]);
    }
    this.syncNodeLabels(node);
};

module.exports.prototype.hideSymbol = function(symbol) {
    const node = this.nodeIndex.get(symbol);
    this.nodeIndex.delete(symbol);
    this.linkedBoxes.delete(node);
};

module.exports.prototype.handleLabelActivation = function(node, segment) {
    if(node == segment) {
        this.linkedBoxes.cursorNode = node;
        this.linkedBoxes.setCursorIndex(0);
        return;
    }
    if(this.nodeIndex.has(segment.symbol)) {
        this.hideSymbol(segment.symbol);
        this.linkedBoxes.syncGraph();
    } else {
        this.showSymbol(segment.symbol);
        this.linkSymbolsAndSyncGraph();
    }
};

module.exports.prototype.linkSymbolsAndSyncGraph = function() {
    for(const pair of this.nodeIndex) {
        const node = pair[1];
        for(let i = 0; i < node.leftSide.length; ++i) {
            const leftSegment = node.leftSide[i],
                  rightSegment = node.rightSide[i];
            if(leftSegment.circle.linksPerNode.size == 0 && this.nodeIndex.has(leftSegment.symbol)) {
                const link = this.linkedBoxes.createLinkHelper(node, this.nodeIndex.get(leftSegment.symbol), -i-1, 0);
                link.path.classList.add('green');
            }
            if(rightSegment.circle.linksPerNode.size == 0 && this.nodeIndex.has(rightSegment.symbol)) {
                const link = this.linkedBoxes.createLinkHelper(node, this.nodeIndex.get(rightSegment.symbol), i+1, 0);
                link.path.classList.add('blue');
            }
        }
    }
    this.linkedBoxes.syncGraph();
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
