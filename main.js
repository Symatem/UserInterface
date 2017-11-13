import WiredPanels from '../WiredPanels/WiredPanels.js';
import NativeBackend from '../SymatemJS/NativeBackend.js';
const backend = new NativeBackend(),
      symbolSpace = backend.createSymbolSpace(),
      panelIndex = new Map(), labelIndex = new Map();

function makeListCollapsable(ul) {
    for(const child of ul.getElementsByTagName('ul'))
        if(child.parentNode.parentNode === ul)
            makeListCollapsable(child);

    const parent = ul.parentNode, triangle = parent.getElementsByClassName('triangle')[0];
    if(!triangle || triangle.parentNode !== parent)
        return;

    const height = ul.offsetHeight;
    ul.setAttribute('height', height);
    ul.style.height = 0;

    function click(event) {
        let height = parseInt(ul.getAttribute('height'));
        const collapse = parent.classList.contains('open');
        if(collapse)
            parent.classList.remove('open');
        else
            parent.classList.add('open');
        ul.style.height = (collapse) ? 0 : height;
        if(collapse)
            height *= -1;
        for(let ul = parent.parentNode; ul.tagName === 'UL'; ul = ul.parentNode.parentNode) {
            const value = parseInt(ul.getAttribute('height'))+height;
            ul.setAttribute('height', value);
            ul.style.height = value;
        }
        event.stopPropagation();
    };
    triangle.addEventListener('click', click);
    triangle.nextElementSibling.addEventListener('click', click);
}

function labelForData(data, symbol) {
    return data ? NativeBackend.encodeText(data) : `#${symbol}`;
}

function updateLabels(symbol, updateGeometry=false) {
    const panels = new Set(),
          string = labelForData(backend.getData(symbolSpace, symbol), symbol);
    for(const socket of labelIndex.get(symbol)) {
        socket.label.textContent = string;
        panels.add(socket.panel);
    }
    if(updateGeometry)
        for(const panel of panels)
            wiredPanels.updatePanelGeometry(panel);
}

function setSocketVisibility(socket, visible) {
    if(visible) {
        if(!labelIndex.has(socket.symbol)) {
            const labels = new Set();
            labelIndex.set(socket.symbol, labels);
            labels.add(socket);
            updateLabels(socket.symbol);
        } else {
            const labels = labelIndex.get(socket.symbol);
            labels.add(socket);
            socket.label.textContent = labels.values().next().value.label.textContent;
        }
    } else {
        const labels = labelIndex.get(socket.symbol);
        labels.delete(socket);
        if(labels.size === 0)
            labelIndex.delete(socket.symbol);
    }
}

function linkedTriple(nodesToAdd, triple, panel) {
    if(panel == undefined) {
        if(!panelIndex.has(triple[0]))
            return;
        panel = panelIndex.get(triple[0]);
    }
    for(let i = 1; i < 3; ++i) {
        const socket = wiredPanels.createSocket();
        socket.panel = panel;
        socket.orientation = (i === 1) ? 'left' : 'right';
        socket.symbol = triple[i];
        nodesToAdd.add(socket);
        if(panelIndex.has(socket.symbol)) {
            const wire = wiredPanels.createWire();
            wire.srcSocket = panelIndex.get(socket.symbol).topSockets[0];
            wire.dstSocket = socket;
            nodesToAdd.add(wire);
        }
    }
}

function unlinkedTriple(nodesToRemove, triple, panel) {
    if(panel == undefined) {
        if(!panelIndex.has(triple[0]))
            return;
        panel = panelIndex.get(triple[0]);
    }
    for(let i = 0; i < panel.leftSockets.length; ++i)
        if(panel.leftSockets[i].symbol === triple[1] && panel.rightSockets[i].symbol === triple[2]) {
            nodesToRemove.add(panel.leftSockets[i]);
            nodesToRemove.add(panel.rightSockets[i]);
            return;
        }
}

function setPanelVisibility(panel, visible) {
    if(visible)
        panelIndex.set(panel.symbol, panel);
    else
        panelIndex.delete(panel.symbol);
    for(const socket of panel.sockets)
        setSocketVisibility(socket, visible);
}

function addPanel(nodesToAdd, symbol) {
    if(panelIndex.has(symbol))
        return panelIndex.get(symbol);

    const panel = wiredPanels.createPanel();
    panel.symbol = symbol;
    nodesToAdd.add(panel);

    const sockets = [];
    const topSocket = wiredPanels.createSocket();
    topSocket.panel = panel;
    topSocket.orientation = 'top';
    topSocket.symbol = panel.symbol;
    nodesToAdd.add(topSocket);

    function connectWires(triple, side) {
        if(!panelIndex.has(triple[0]))
            return;
        const sockets = panelIndex.get(triple[0])[side];
        for(const socket of sockets)
            if(socket.symbol === symbol) {
                const wire = wiredPanels.createWire();
                wire.srcSocket = topSocket;
                wire.dstSocket = socket;
                nodesToAdd.add(wire);
            }
    }
    for(const triple of backend.queryTriples(symbolSpace, NativeBackend.queryMask.VMI, [0, panel.symbol, 0]))
        connectWires(triple, 'leftSockets');
    for(const triple of backend.queryTriples(symbolSpace, NativeBackend.queryMask.VIM, [0, 0, panel.symbol]))
        connectWires(triple, 'rightSockets');
    for(const triple of backend.queryTriples(symbolSpace, NativeBackend.queryMask.MVV, [panel.symbol, 0, 0]))
        linkedTriple(nodesToAdd, triple, panel);

    return panel;
}

function getOppositeSocket(socket, triple) {
    let oppositeSocket;
    triple.push(socket.panel.symbol);
    if(socket.orientation === 'left') {
        const index = socket.panel.leftSockets.indexOf(socket);
        oppositeSocket = socket.panel.rightSockets[index];
        triple.push(socket.symbol);
        triple.push(oppositeSocket.symbol);
    } else {
        const index = socket.panel.rightSockets.indexOf(socket);
        oppositeSocket = socket.panel.leftSockets[index];
        triple.push(oppositeSocket.symbol);
        triple.push(socket.symbol);
    }
    return oppositeSocket;
}

const modal = document.getElementById('modal'),
      menu = document.getElementById('menu'),
      menuItems = menu.getElementsByTagName('li'),
      openFiles = document.createElement('input');
openFiles.setAttribute('id', 'openFiles');
openFiles.setAttribute('type', 'file');
menu.appendChild(openFiles);
menu.removeAttribute('style');
menu.classList.add('fadeIn');
makeListCollapsable(menu.getElementsByTagName('ul')[0]);

document.getElementById('modalPositive').addEventListener('click', function(event) {
    // TODO
    modal.classList.remove('fadeIn');
    modal.classList.add('fadeOut');
});
document.getElementById('modalNegative').addEventListener('click', function(event) {
    // TODO
    modal.classList.remove('fadeIn');
    modal.classList.add('fadeOut');
});

menuItems[0].addEventListener('click', function() {
    wiredPanels.undo();
});
menuItems[1].addEventListener('click', function() {
    wiredPanels.redo();
});
menuItems[2].addEventListener('click', function() {
    // TODO paste
});
menuItems[3].addEventListener('click', function() {
    // TODO copy
});
menuItems[4].addEventListener('click', function() {
    // TODO cut
});
menuItems[5].addEventListener('click', function() {
    // TODO find
});
menuItems[6].addEventListener('click', function() {
    const nodesToAdd = new Set(),
          panel = addPanel(nodesToAdd, backend.createSymbol(symbolSpace));
    wiredPanels.changeGraphUndoable(nodesToAdd, [], function(forward) {
        if(forward)
            backend.createSymbol(symbolSpace, panel.symbol);
        else
            backend.unlinkSymbol(symbolSpace, panel.symbol);
        setPanelVisibility(panel, forward);
    });
});
menuItems[7].addEventListener('click', function() {
    wiredPanels.deleteSelected();
});
menuItems[8].addEventListener('click', function() {
    const string = backend.encodeJsonFromSymbolSpace(symbolSpace);
    NativeBackend.downloadAsFile(string, 'Symatem.json');
});
menuItems[8].setAttribute('draggable', 'true');
menuItems[8].addEventListener('dragstart', function(event) {
    const string = backend.encodeJsonFromSymbolSpace(symbolSpace);
    event.dataTransfer.setData('text/plain', string);
    event.dataTransfer.setData('application/json', string);
    event.dataTransfer.effectAllowed = 'all';
});
openFiles.addEventListener('change', function(event) {
    wiredPanels.eventListeners.paste(event.target);
});
menuItems[10].addEventListener('click', function() {
    let element = document.fullscreenElement || document.mozFullScreenElement || document.webkitFullscreenElement;
    if(element) {
        if(document.exitFullscreen)
            document.exitFullscreen();
        else if(document.mozCancelFullScreen)
            document.mozCancelFullScreen();
        else if(document.webkitExitFullscreen)
            document.webkitExitFullscreen();
        return;
    }
    element = document.documentElement;
    if(element.requestFullscreen)
        element.requestFullscreen();
    else if(element.mozRequestFullScreen)
        element.mozRequestFullScreen();
    else if(element.webkitRequestFullscreen)
        element.webkitRequestFullscreen();
});
{
    const label = document.createElement('label'),
          li = menuItems[9];
    label.setAttribute('for', openFiles.getAttribute('id'));
    li.parentNode.insertBefore(label, li);
    label.appendChild(li);
}

const wiredPanels = new WiredPanels(document.getElementById('ground'), {}, {
    activate(node) {
        const nodesToAdd = new Set(),
              panels = new Set();
        for(const node of wiredPanels.selection) {
            if(node.type === 'panel')
                panels.add(node);
            else if(node.type === 'socket' && node.orientation !== 'top' && node.wiresPerPanel.size === 0 && node.symbol !== undefined)
                addPanel(nodesToAdd, node.symbol);
        }
        if(panels.size === 1) {
            const firstTime = modal.getAttribute('style') != undefined;
            modal.removeAttribute('style');
            modal.classList.remove('fadeOut');
            modal.classList.add('fadeIn');
            if(firstTime)
                makeListCollapsable(modal.getElementsByTagName('ul')[0]);
            // TODO
        }
        if(nodesToAdd.size > 0)
            wiredPanels.changeGraphUndoable(nodesToAdd, [], function(forward) {
                for(const node of nodesToAdd)
                    if(node.type === 'panel')
                        setPanelVisibility(node, forward);
            });
    },
    remove() {
        const nodesToDeselect = new Set();
        for(const node of wiredPanels.selection)
            if(node.type === 'wire')
                nodesToDeselect.add(node);

        const nodesToSelect = new Set(), triples = new Set(), panels = new Set();
        for(const node of wiredPanels.selection)
            switch(node.type) {
                case 'socket':
                    if(wiredPanels.selection.has(node.panel)) {
                        nodesToDeselect.add(node);
                        continue;
                    }
                    switch(node.orientation) {
                        case 'top':
                            nodesToSelect.add(node.panel);
                            break;
                        case 'left':
                        case 'right': {
                            nodesToSelect.add(node);
                            const triple = [], oppositeSocket = getOppositeSocket(node, triple);
                            if(!wiredPanels.selection.has(oppositeSocket))
                                nodesToSelect.add(oppositeSocket);
                            if(triple[1] != undefined && triple[2] != undefined)
                                triples.add(triple);
                        } break;
                    }
                    break;
                case 'panel':
                    const update = {
                        'panel': node,
                        'symbol': node.symbol,
                        'data': backend.getData(symbolSpace, node.symbol),
                        'triples': [...backend.queryTriples(symbolSpace, NativeBackend.queryMask.MVV, [node.symbol, 0, 0])]
                    };
                    panels.add(update);
                    nodesToSelect.add(node);
                    break;
            }

        wiredPanels.setSelected(nodesToDeselect, false);
        for(const panel of nodesToSelect)
            wiredPanels.selection.add(panel);

        return function(forward) {
            for(const node of nodesToSelect)
                switch(node.type) {
                    case 'panel':
                        setPanelVisibility(node, !forward);
                        break;
                    case 'socket':
                        setSocketVisibility(node, !forward);
                        break;
                }
            for(const triple of triples)
                backend.setTriple(symbolSpace, !forward, triple);
            for(const update of panels) {
                if(forward)
                    backend.unlinkSymbol(symbolSpace, update.symbol);
                else {
                    backend.createSymbol(symbolSpace, update.symbol);
                    backend.setData(symbolSpace, update.symbol, update.data);
                    for(const triple of update.triples)
                        backend.setTriple(symbolSpace, true, triple);
                }
            }
        };
    },
    wireDrag(socket) {
        return socket.orientation === 'top';
    },
    wireConnect(node, wire, nodesToAdd) {
        if(node.type === 'panel') {
            const rect = wiredPanels.boundingRectOfPanel(node),
                  diffX = wire.dstSocket.primaryElement.x-(rect[0]+rect[1])/2,
                  diffY = wire.dstSocket.primaryElement.y-(rect[2]+rect[3])/2;

            wire.dstSocket = wiredPanels.createSocket();
            wire.dstSocket.panel = node;
            wire.dstSocket.orientation = (diffX < 0) ? 'left' : 'right';
            wire.dstSocket.symbol = wire.srcSocket.symbol;
            nodesToAdd.add(wire.dstSocket);
            const socket = wire.dstSocket;

            const oppositeSocket = wiredPanels.createSocket();
            oppositeSocket.panel = node;
            oppositeSocket.orientation = (diffX >= 0) ? 'left' : 'right';
            nodesToAdd.add(oppositeSocket);

            return function(forward) {
                setSocketVisibility(socket, forward);
            };
        } else if(node.type === 'socket') {
            if(node.symbol != undefined)
                return;
            const symbol = wire.srcSocket.symbol;
            wire.dstSocket = node;
            wire.dstSocket.symbol = symbol;
            const triple = [], oppositeSocket = getOppositeSocket(node, triple);
            return function(forward) {
                backend.setTriple(symbolSpace, forward, triple);
                if(forward)
                    node.symbol = symbol;
                setSocketVisibility(node, forward);
                if(!forward) {
                    delete node.symbol;
                    node.label.textContent = '';
                }
                wiredPanels.updatePanelGeometry(node.panel);
            };
        }
    },
    paste(files) {
        files = files.files;
        if(!files || files.length !== 1)
            return false;
        for(const file of files) {
            const reader = new FileReader();
            reader.onload = function(event) {
                backend.decodeJsonIntoSymbolSpace(symbolSpace, event.target.result);
            };
            reader.readAsText(file);
        }
        return true;
    }
});
