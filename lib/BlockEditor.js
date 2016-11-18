"use strict";

const svg = document.documentElement;
const gridSize = 50;
const labelHOffset = gridSize;
const labelVOffset = 6;
const cornerRadius = 10;
const arrowWidth = 25;
const arrowStartOutset = -0.5 * gridSize;
const arrowStartInset = -15;
const arrowEndOutset = 15;
const arrowEndInset = 0.5 * gridSize;
//const directions = ['right', 'down', 'left', 'up'];

const graph = {
    blocks: [
        {
            x: 3, y: 1,
            width: 7, height: 6,
            ports: [
                { direction: 0, distance: 0, label: 'Happen'}
            ]
        },
        {
            x: 4, y: 2,
            width: 2, height: 2,
            ports: [
                { direction: 0, distance: 0, label: 'Things'}
            ]
        },
        {
            x: 4, y: 2,
            width: 2, height: 2,
            isLid: true,
            ports: []
        }
    ],
    arrows:[],
    connections: []
};

graph.connections.push({
    sourceBlock: graph.blocks[1],
    destinationBlock: graph.blocks[0],
    sourcePort: graph.blocks[1].ports[0],
    destinationPort: graph.blocks[0].ports[0]
});

function init() {
    const lower = arrowWidth * 0.4;
    const higher = arrowWidth * 1.4;
    const diff = (higher - lower) * 0.5;
    const slopeShadow = document.getElementById('slopeShadow').children[0];
    slopeShadow.setAttribute('d', 'M0,' + (gridSize - lower) * 0.5 + 'l' + gridSize + ',' + (-diff) + 'v' + higher + 'l' + (-gridSize) + ',' + (-diff) + 'v' + lower + 'z');
}

function getCoordinatesOfPort(block, port) {
    let coordinates = { x: block.x, y: block.y };
    switch (port.direction) {
        case 0:
            coordinates.x += block.width;
        case 2:
            coordinates.y += Math.floor(block.height)/2+port.distance;
        break;
        case 1:
            coordinates.y += block.height;
        case 3:
            coordinates.x += Math.floor(block.width)/2+port.distance;
            break;
    }
    return coordinates;
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
    for (const port of block.ports) {
        const label = document.createElementNS(svg.namespaceURI, 'text');
        const angle = (port.direction == 2) ? 0 : port.direction * 90;
        const coordinates = getCoordinatesOfPort(block, port);
        let xOffset = coordinates.x * gridSize;
        let yOffset = coordinates.y * gridSize;
        if (port.direction == 0 || port.direction == 2) {
            xOffset += labelHOffset * ((port.direction == 2) ? -1 : 1);
            yOffset += labelVOffset;
        } else {
            const factor = (port.direction == 3) ? -1 : 1;
            xOffset -= labelVOffset * factor;
            yOffset += labelHOffset * factor;
        }
        label.setAttribute('class', 'label');
        // label.setAttribute('text-anchor', (slope.direction == 2) ? 'end' : 'start');
        label.setAttribute('transform', 'translate(' + xOffset + ',' + yOffset + ') rotate(' + angle + ')');
        label.textContent = port.label;
        group.appendChild(label);
    }
}

function renderConnection(connection) {
    const sourceCoordinates = getCoordinatesOfPort(connection.sourceBlock, connection.sourcePort);
    const destinationCoordinates = getCoordinatesOfPort(connection.destinationBlock, connection.destinationPort);
    const arrow = {
        x: sourceCoordinates.x - 1, y: sourceCoordinates.y,
        segments: [],
        slopes: [
            {direction: connection.sourcePort.direction, x: sourceCoordinates.x, y: sourceCoordinates.y},
            {direction: connection.destinationPort.direction, x: destinationCoordinates.x, y: destinationCoordinates.y}
        ]
    };

    arrow.segments.push({direction: 0, distance: 3});
    arrow.segments.push({direction: 1, distance: destinationCoordinates.y - sourceCoordinates.y - 1});
    arrow.segments.push({direction: 0, distance: 3});

    graph.arrows.push(arrow);
}

function renderArrow(arrow) {
    let prevDir = arrow.segments[0].direction;
    let xOffset = 0;
    let yOffset = 0;
    if (prevDir == 0 || prevDir == 2) {
        xOffset = arrowStartInset;
        if (prevDir == 2)
            xOffset *= -1;
    } else {
        yOffset = arrowStartInset;
        if (prevDir == 3)
            yOffset *= -1;
    }
    let forward = 'M' + (arrow.x * gridSize + xOffset) + ',' + (arrow.y * gridSize + yOffset), backward = 'z';

    function renderCap(direction, end) {
        let tag;
        let inset;
        let outset;
        let forwardDiagonal;
        let backwardDiagonal;
        let diagonalO = arrowWidth * 0.5;
        if (end) {
            inset = -arrowEndInset;
            outset = -arrowEndOutset;
            diagonalO *= -1;
        } else {
            inset = arrowStartInset;
            outset = arrowStartOutset;
        }
        var parallel = outset, diagonalP = outset - inset;
        if (direction == 0 || direction == 3)
            diagonalO *= -1;
        if (direction < 2)
            parallel *= -1;
        else
            diagonalP *= -1;
        if (direction == 0 || direction == 2) {
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
    for (const segment of arrow.segments) {
        const nextDir = segment.direction;
        if (prevDir != -1 && prevDir != nextDir) {
            let radiusF;
            let radiusB;
            let xF;
            let yF;
            let srcF = (prevDir >= 2) ? -1 : 1;
            let dstF = (nextDir >= 2) ? -1 : 1;
            let sweepFlag = ((prevDir + 1) % 4 == nextDir) ? 1 : 0;
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
            const tag = (nextDir == 0 || nextDir == 2) ? 'h' : 'v';
            let distance = segment.distance * gridSize;
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
            'rotate(' + (slope.direction * 90) + ')' +
            'translate(' + (-gridSize) + ',' + gridSize*-0.5 + ')');
        rect.setAttribute('fill', 'url(#' + type + ')');
        rect.setAttribute('width', gridSize);
        rect.setAttribute('height', gridSize);
        group.appendChild(rect);
    }

    for (const slope of arrow.slopes)
        renderSlope('slopeShadow', slope);

    const path = document.createElementNS(svg.namespaceURI, 'path');
    path.setAttribute('class', 'arrow');
    path.setAttribute('filter', 'url(#arrowShadow)');
    path.setAttribute('d', forward + backward);
    group.appendChild(path);

    for (const slope of arrow.slopes)
        renderSlope('slopeDiffuse', slope);
}

var render = function (graph) {
    for (const block of graph.blocks)
        renderBlock(block);

    for (const connection of graph.connections)
        renderConnection(connection);

    for (const arrow of graph.arrows)
        renderArrow(arrow);
};

init();
render(graph);
