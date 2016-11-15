"use strict";

const svg = document.documentElement;
const svgNS = svg.namespaceURI;
const gridSize = 50;
const labelHOffset = gridSize;
const labelVOffset = 6;
const cornerRadius = 10;
const arrowWidth = 25;
const arrowStartOutset = -0.5 * gridSize;
const arrowStartInset = -15;
const arrowEndOutset = 15;
const arrowEndInset = 0.5 * gridSize;
// directions = ['right', 'down', 'left', 'up'];

const graph = {
    blocks: [
        {
            x: 3, y: 1,
            width: 7, height: 6,
            ports: [
                {x: 7, y: 5, dir: 0, label: 'Happen'}
            ]
        },
        {
            x: 4, y: 2,
            width: 2, height: 2,
            ports: [
                {x: 2, y: 1, dir: 0, label: 'Things'}
            ]
        },
        {x: 4, y: 2, width: 2, height: 2, isLid: true}
    ],
    arrows:[],
    connections: []
};

graph.connections.push({
    srcBlock: graph.blocks[1],
    dstBlock: graph.blocks[0],
    srcPort: graph.blocks[1].ports[0],
    dstPort: graph.blocks[0].ports[0]
});

function init() {
    const lower = arrowWidth * 0.4, higher = arrowWidth * 1.4, diff = (higher - lower) * 0.5,
        slopeShadow = document.getElementById('slopeShadow').children[0];
    slopeShadow.setAttribute('d', 'M0,' + (gridSize - lower) * 0.5 + 'l' + gridSize + ',' + (-diff) + 'v' + higher + 'l' + (-gridSize) + ',' + (-diff) + 'v' + lower + 'z');
}

function renderBlock(block) {
    const path = document.createElementNS(svg.namespaceURI, 'rect');
    path.setAttribute('class', (block.isLid) ? 'lid' : 'box');
    path.setAttribute('rx', cornerRadius);
    path.setAttribute('ry', cornerRadius);
    path.setAttribute('x', block.x * gridSize);
    path.setAttribute('y', block.y * gridSize);
    path.setAttribute('width', block.width * gridSize);
    path.setAttribute('height', block.height * gridSize);
    document.getElementById((block.isLid) ? 'lids' : 'boxes').appendChild(path);

    const group = document.getElementById('labels');
    for (var index in block.ports) {
        const port = block.ports[index];

        var label = document.createElementNS(svg.namespaceURI, 'text'),
            angle = port.dir * 90,
            xOffset = (block.x + port.x) * gridSize, yOffset = (block.y + port.y) * gridSize;
        switch (port.dir) {
            case 0:
                xOffset += labelHOffset;
                yOffset += labelVOffset;
                break;
            case 1:
                xOffset -= labelVOffset;
                yOffset += labelHOffset;
                break;
            case 2:
                angle = 0;
                xOffset -= labelHOffset;
                yOffset += labelVOffset;
                break;
            case 3:
                xOffset += labelVOffset;
                yOffset -= labelHOffset;
                break;
        }
        label.setAttribute('class', 'label');
        // label.setAttribute('text-anchor', (slope.dir == 2) ? 'end' : 'start');
        label.setAttribute('transform', 'translate(' + xOffset + ',' + yOffset + ') rotate(' + angle + ')');
        label.textContent = port.label;
        group.appendChild(label);
    }
}

function renderConnection(connection) {
    const
        srcX = connection.srcBlock.x + connection.srcPort.x,
        srcY = connection.srcBlock.y + connection.srcPort.y,
        dstX = connection.dstBlock.x + connection.dstPort.x,
        dstY = connection.dstBlock.y + connection.dstPort.y;

    graph.arrows.push({
        x: srcX, y: srcY,
        segments: [ { dir: 0, distance: dstX-srcX } ],
        slopes: [
            { dir: connection.srcPort.dir, x: srcX, y: srcY },
            { dir: connection.dstPort.dir, x: dstX, y: dstY }
        ]
    });
}

function renderArrow(arrow) {
    var prevDir = arrow.segments[0].dir, xOffset = 0, yOffset = 0;
    if (prevDir == 0 || prevDir == 2) {
        xOffset = arrowStartInset;
        if (prevDir == 2)
            xOffset *= -1;
    } else {
        yOffset = arrowStartInset;
        if (prevDir == 3)
            yOffset *= -1;
    }
    var forward = 'M' + (arrow.x * gridSize + xOffset) + ',' + (arrow.y * gridSize + yOffset), backward = 'z';

    function renderCap(dir, end) {
        var tag, inset, outset, forwardDiagonal, backwardDiagonal,
            diagonalO = arrowWidth * 0.5;
        if (end) {
            inset = -arrowEndInset;
            outset = -arrowEndOutset;
            diagonalO *= -1;
        } else {
            inset = arrowStartInset;
            outset = arrowStartOutset;
        }
        var parallel = outset, diagonalP = outset - inset;
        if (dir == 0 || dir == 1) {
            diagonalO *= -1;
            parallel *= -1;
        }
        if (dir >= 2)
            diagonalP *= -1;
        if (dir == 0 || dir == 2) {
            tag = 'h';
            forwardDiagonal = diagonalP + ',' + diagonalO;
            backwardDiagonal = (-diagonalP) + ',' + diagonalO;
        } else {
            tag = 'v';
            forwardDiagonal = diagonalO + ',' + diagonalP;
            backwardDiagonal = diagonalO + ',' + (-diagonalP);
        }
        if (end) {
            forward += tag + parallel + 'l' + forwardDiagonal;
            backward = 'l' + backwardDiagonal + tag + (-parallel) + backward;
        } else {
            forward += 'l' + forwardDiagonal + tag + parallel;
            backward = tag + (-parallel) + 'l' + backwardDiagonal + backward;
        }
    }

    renderCap(prevDir, false);
    for (const index in arrow.segments) {
        const segment = arrow.segments[index],
            nextDir = segment.dir;
        if (prevDir != -1 && prevDir != nextDir) {
            var radiusF, radiusB, xF, yF,
                srcF = (prevDir >= 2) ? -1 : 1,
                dstF = (nextDir >= 2) ? -1 : 1,
                sweepFlag = ((prevDir + 1) % 4 == nextDir) ? 1 : 0;
            if (sweepFlag == 1) {
                xF = dstF;
                yF = srcF;
            } else {
                xF = srcF;
                yF = dstF;
            }
            radiusF = gridSize * 0.5 + arrowWidth * (sweepFlag - 0.5);
            radiusB = gridSize * 0.5 + arrowWidth * (0.5 - sweepFlag);
            forward += 'a' + radiusF + ',' + radiusF + ',0,0,' + sweepFlag + ',' + (radiusF * xF) + ',' + (radiusF * yF);
            backward = 'a' + radiusB + ',' + radiusB + ',0,0,' + (1 - sweepFlag) + ',' + (-radiusB * xF) + ',' + (-radiusB * yF) + backward;
        }
        if (segment.distance > 0) {
            var tag = (nextDir == 0 || nextDir == 2) ? 'h' : 'v',
                distance = segment.distance * gridSize;
            if (nextDir >= 2)
                distance *= -1;
            forward += tag + distance;
            backward = tag + (-distance) + backward;
        }
        prevDir = nextDir;
    }
    renderCap(prevDir, true);

    const group = document.getElementById('arrows');

    function renderSlope(type, slope) {
        const rect = document.createElementNS(svg.namespaceURI, 'rect');
        rect.setAttribute('transform',
            'translate(' + slope.x * gridSize + ',' + slope.y * gridSize + ') ' +
            'rotate(' + (slope.dir * 90) + ')' +
            'translate(' + (-gridSize) + ',' + gridSize*-0.5 + ')');
        rect.setAttribute('fill', 'url(#' + type + ')');
        rect.setAttribute('width', gridSize);
        rect.setAttribute('height', gridSize);
        group.appendChild(rect);
    }

    for (const index in arrow.slopes)
        renderSlope('slopeShadow', arrow.slopes[index]);

    var path = document.createElementNS(svg.namespaceURI, 'path');
    path.setAttribute('class', 'arrow');
    path.setAttribute('filter', 'url(#arrowShadow)');
    path.setAttribute('d', forward + backward);
    group.appendChild(path);

    for (const index in arrow.slopes)
        renderSlope('slopeDiffuse', arrow.slopes[index]);
}

var render = function (graph) {
    for (const index in graph.blocks)
        renderBlock(graph.blocks[index]);

    graph.arrows = [];
    for (const index in graph.connections)
        renderConnection(graph.connections[index]);

    for (const index in graph.arrows)
        renderArrow(graph.arrows[index]);
};

init();
render(graph);