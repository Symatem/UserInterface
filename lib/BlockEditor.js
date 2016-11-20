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

const directions = {
    right: 0,
    down: 1,
    left: 2,
    up: 3
};

const unitType = {
    closed: 0,
    openOnHover: 1,
    open: 2,
    invisible: 3
};

const socketType = {
    in: 0,
    out: 1
};

const unit = (label, x, y, width, height, sockets = [], type = unitType.closed, units = [], wires = []) => ({
    label: label,
    x: x,
    y: y,
    width: width,
    height: height,
    sockets: sockets,
    type: type,
    units: units,
    wires: wires,
    inputs: sockets.filter(it => it.type === socketType.in),
    outputs: sockets.filter(it => it.type === socketType.out)
});

const wire = (sourceUnit, sourceSocket, destinationUnit, destinationSocket, lengthToFirstCurve) => ({
    sourceUnit: sourceUnit,
    sourceSocket: sourceSocket,
    destinationUnit: destinationUnit,
    destinationSocket: destinationSocket,
    lengthToFirstCurve: lengthToFirstCurve
});

const socket = (label, distance, direction, type) => ({
    label: label, distance: distance, direction: direction, type: type
});

const input = (label, distance = 0, direction = directions.left) => socket(label, distance, direction, socketType.in);
const output = (label, distance = 0, direction = directions.right) => socket(label, distance, direction, socketType.out);

const exampleUnit = function () {
    const upperInnerY = 3;
    const lowerInnerY = 7;

    const read = (y)=> unit(
        'label', 3, y, 3, 2,
        [
            output('')
        ]
    );
    const readA = read(upperInnerY);
    const readB = read(lowerInnerY);

    const someAlgorithm = unit(
        'some_algorithm', 15, 3, 5, 6,
        [
            input('a', -2),
            input('b', 2),
            output('')
        ]
    );

    const preprocess = (y)=> unit(
        'preprocess', 10, y, 3, 2,
        [
            input(''),
            output('')
        ],
        unitType.closed
    );

    const preprocessA = preprocess(upperInnerY);
    const preprocessB = preprocess(lowerInnerY);

    const process = unit(
        'process', 9, 2, 13, 8,
        [
            input('a', -2),
            input('b', 2),
            output('result')
        ],
        unitType.openOnHover,
        [preprocessA, preprocessB, someAlgorithm]
    );

    process.wires = [
        wire(process, process.inputs[0], preprocessA, preprocessA.inputs[0]),
        wire(process, process.inputs[1], preprocessB, preprocessB.inputs[0]),
        wire(preprocessA, preprocessA.outputs[0], someAlgorithm, someAlgorithm.inputs[0]),
        wire(preprocessB, preprocessB.outputs[0], someAlgorithm, someAlgorithm.inputs[1]),
        wire(someAlgorithm, someAlgorithm.outputs[0], process, process.outputs[0])
    ];

    const frame = unit(
        '', 1, 1, 24, 10,
        [
            output('')
        ],
        unitType.invisible,
        [readA, readB, process]
    );

    frame.wires = [
        wire(readA, readA.outputs[0], process, process.inputs[0]),
        wire(readB, readB.outputs[0], process, process.inputs[1]),
        wire(process, process.outputs[0], frame, frame.outputs[0])
    ];

    return frame
};

const init = function () {
    const lower = arrowWidth * 0.4;
    const higher = arrowWidth * 1.4;
    const diff = (higher - lower) * 0.5;
    const slopeShadow = document.getElementById('slopeShadow').children[0];
    slopeShadow.setAttribute('d', 'M0,' + (gridSize - lower) * 0.5 + 'l' + gridSize + ',' + (-diff) + 'v' + higher + 'l' + (-gridSize) + ',' + (-diff) + 'v' + lower + 'z');
};

const socketPosition = function (unit, socket) {
    let position = { x: unit.x, y: unit.y };
    switch (socket.direction) {
        case 0:
            position.x += unit.width;
        case 2:
            position.y += Math.floor(unit.height/2)+socket.distance;
        break;
        case 1:
            position.y += unit.height;
        case 3:
            position.x += Math.floor(unit.width/2)+socket.distance;
            break;
    }
    return position;
};

const renderLoweringOrLid = function (unit, isLid) {
    const path = document.createElementNS(svg.namespaceURI, 'rect');
    path.setAttribute('class', (isLid) ? 'lid' : 'box');
    path.setAttribute('rx', cornerRadius);
    path.setAttribute('ry', cornerRadius);
    path.setAttribute('x', unit.x * gridSize);
    path.setAttribute('y', unit.y * gridSize);
    path.setAttribute('width', unit.width * gridSize);
    path.setAttribute('height', unit.height * gridSize);
    document.getElementById((isLid) ? 'lids' : 'boxes').appendChild(path);

    const group = document.getElementById('labels');
    for (const port of unit.sockets) {
        const label = document.createElementNS(svg.namespaceURI, 'text');
        const angle = (port.direction == 2) ? 0 : port.direction * 90;
        const position = socketPosition(unit, port);
        let xOffset = position.x * gridSize;
        let yOffset = position.y * gridSize;
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
};

const renderArrow = function (arrow) {
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
            'translate(' + slope.position.x * gridSize + ',' + slope.position.y * gridSize + ') ' +
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
};

const renderLowering = function (unit) {
    renderLoweringOrLid(unit, false);
};

const renderLid = function (unit) {
    renderLoweringOrLid(unit, true);
};

const renderUnit = function (unit) {
    if (unit.type == unitType.open || unit.type == unitType.openOnHover)
        renderLowering(unit);

    for (const subunit of unit.units)
        renderUnit(subunit);

    if (unit.type == unitType.openOnHover || unit.type == unitType.closed)
        renderLid(unit);

    for (const wire of unit.wires) {
        const sourcePosition = socketPosition(wire.sourceUnit, wire.sourceSocket);
        const destinationPosition = socketPosition(wire.destinationUnit, wire.destinationSocket);
        const arrow = {
            x: sourcePosition.x, y: sourcePosition.y,
            segments: [
                {direction: directions.right, distance: destinationPosition.x - sourcePosition.x}
            ],
            slopes: [
                {direction: wire.sourceSocket.direction, position: sourcePosition},
                {direction: wire.destinationSocket.direction, position: destinationPosition}
            ]
        };

        renderArrow(arrow);
    }
};

init();
renderUnit(exampleUnit());
