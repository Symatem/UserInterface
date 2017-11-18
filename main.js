import WiredPanels from '../WiredPanels/WiredPanels.js';
import NativeBackend from '../SymatemJS/NativeBackend.js';
import FuzzySearchIndex from './FuzzySearchIndex.js';
const backend = new NativeBackend(),
      symbolSpace = backend.createSymbolSpace(),
      symbolIndex = new Map(),
      labelIndex = new FuzzySearchIndex();

function makeListCollapsable(ul) {
    for(const child of ul.getElementsByTagName('ul'))
        if(child.parentNode.parentNode === ul)
            makeListCollapsable(child);
    const parent = ul.parentNode, triangle = parent.getElementsByClassName('triangle')[0];
    if(!triangle || triangle.parentNode !== parent)
        return;
    ul.style.height = 'auto';
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
    triangle.onclick = click;
    if(triangle.nextElementSibling)
        triangle.nextElementSibling.onclick = click;
}

function labelOfSymbol(symbol, forceUpdate) {
    const data = backend.getData(symbolSpace, symbol);
    let entry;
    if(!symbolIndex.has(symbol)) {
        entry = {'symbol': symbol};
        symbolIndex.set(symbol, entry);
    } else
        entry = symbolIndex.get(symbol);
    if(entry.label && forceUpdate)
        labelIndex.delete(entry);
    if(!entry.label || forceUpdate) {
        entry.label = data ? NativeBackend.encodeText(data) : `#${symbol}`;
        labelIndex.add(entry);
    }
    return entry;
}

function updateLabels(symbol, updateGeometry=false) {
    const entry = labelOfSymbol(symbol, true),
          panels = new Set();
    for(const socket of entry.labels) {
        socket.label.textContent = entry.label;
        panels.add(socket.panel);
    }
    if(updateGeometry)
        for(const panel of panels)
            wiredPanels.updatePanelGeometry(panel);
}

function setSocketVisibility(socket, visible) {
    if(visible) {
        let entry;
        if(!symbolIndex.has(socket.symbol)) {
            entry = {'symbol': symbol, 'labels': new Set()};
            symbolIndex.set(socket.symbol, entry);
        } else {
            entry = symbolIndex.get(socket.symbol);
            if(!entry.labels)
                entry.labels = new Set();
        }
        entry.labels.add(socket);
    } else {
        const entry = symbolIndex.get(socket.symbol);
        entry.labels.delete(socket);
        if(entry.labels.size === 0)
            delete entry.labels;
    }
}

function setPanelVisibility(panel, visible) {
    if(visible) {
        if(!symbolIndex.has(panel.symbol))
            symbolIndex.set(panel.symbol, {'symbol': symbol, 'panel': panel});
        else
            symbolIndex.get(panel.symbol).panel = panel;
    } else if(symbolIndex.has(panel.symbol))
        delete symbolIndex.get(panel.symbol).panel;
    for(const socket of panel.sockets)
        setSocketVisibility(socket, visible);
}

function setNodesVisibility(nodes, visibility) {
    for(const node of nodes)
        switch(node.type) {
            case 'socket':
                setSocketVisibility(node, visibility);
                break;
            case 'panel':
                setPanelVisibility(node, visibility);
                break;
        }
}

function linkedTriple(nodesToAdd, triple, panel) {
    if(!panel) {
        panel = getPanel(triple[0]);
        if(!panel)
            return;
    }
    for(let i = 1; i < 3; ++i) {
        const socket = wiredPanels.createSocket();
        socket.panel = panel;
        socket.orientation = (i === 1) ? 'left' : 'right';
        socket.symbol = triple[i];
        socket.label.textContent = labelOfSymbol(socket.symbol).label;
        nodesToAdd.add(socket);
        const srcPanel = getPanel(socket.symbol);
        if(srcPanel) {
            const wire = wiredPanels.createWire();
            wire.srcSocket = srcPanel.topSockets[0];
            wire.dstSocket = socket;
            nodesToAdd.add(wire);
        }
    }
}

function unlinkedTriple(nodesToRemove, triple, panel) {
    if(!panel) {
        panel = getPanel(triple[0]);
        if(!panel)
            return;
    }
    for(let i = 0; i < panel.leftSockets.length; ++i)
        if(panel.leftSockets[i].symbol === triple[1] && panel.rightSockets[i].symbol === triple[2]) {
            nodesToRemove.add(panel.leftSockets[i]);
            nodesToRemove.add(panel.rightSockets[i]);
            return;
        }
}

function getPanel(symbol) {
    if(!symbolIndex.has(symbol))
        return;
    return symbolIndex.get(symbol).panel;
}

function addPanel(nodesToAdd, symbol) {
    let panel = getPanel(symbol);
    if(panel)
        return panel;

    panel = wiredPanels.createPanel();
    panel.symbol = symbol;
    nodesToAdd.add(panel);

    const sockets = [];
    const topSocket = wiredPanels.createSocket();
    topSocket.panel = panel;
    topSocket.orientation = 'top';
    topSocket.symbol = panel.symbol;
    topSocket.label.textContent = labelOfSymbol(topSocket.symbol).label;
    nodesToAdd.add(topSocket);

    function connectWires(triple, side) {
        const panel = getPanel(triple[0]);
        if(!panel)
            return;
        for(const socket of panel[side])
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
      modalContent = document.getElementById('modalContent'),
      modalPositive = document.getElementById('modalPositive'),
      modalNegative = document.getElementById('modalNegative'),
      menu = document.getElementById('menu'),
      menuItems = menu.getElementsByTagName('li'),
      openFiles = document.createElement('input');
openFiles.setAttribute('id', 'openFiles');
openFiles.setAttribute('type', 'file');
menu.appendChild(openFiles);
menu.removeAttribute('style');
menu.classList.add('fadeIn');
makeListCollapsable(menu.getElementsByTagName('ul')[0]);

function openModal(accept) {
    modalPositive.onclick = accept;
    modal.removeAttribute('style');
    modal.classList.remove('fadeOut');
    modal.classList.add('fadeIn');
}
function closeModal() {
    modal.classList.remove('fadeIn');
    modal.classList.add('fadeOut');
}
modalNegative.addEventListener('click', closeModal);
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
    let selection = -1;
    function accept() {
        closeModal();
        if(selection < 0)
            return;
        const nodesToAdd = new Set(),
              panel = addPanel(nodesToAdd, options.childNodes[selection].entry.symbol);
        wiredPanels.changeGraphUndoable(nodesToAdd, [], function(forward) {
            setPanelVisibility(panel, forward);
        });
    }

    modalContent.innerHTML = '';
    const search = document.createElement('div'),
          options = document.createElement('div');
    modalContent.appendChild(search);
    modalContent.appendChild(options);
    options.setAttribute('id', 'search');
    search.setAttribute('contentEditable', 'true');
    search.setAttribute('style', 'min-width: 100px; min-height: 20px;');
    search.onkeydown = function(event) {
        event.stopPropagation();
        switch(event.keyCode) {
            case 13: // Enter
                search.blur();
                accept();
                break;
            case 27: // Escape
                search.blur();
                closeModal();
                break;
            case 38: // Up
                if(selection < 0)
                    break;
                options.childNodes[selection].classList.remove('selected');
                if(--selection < 0)
                    selection = options.childNodes.length-1;
                options.childNodes[selection].classList.add('selected');
                break;
            case 40: // Down
                if(selection < 0)
                    break;
                options.childNodes[selection].classList.remove('selected');
                if(++selection >= options.childNodes.length)
                    selection = 0;
                options.childNodes[selection].classList.add('selected');
                break;
            default:
                return;
        }
        event.preventDefault();
    };
    search.onkeyup = function(event) {
        event.stopPropagation();
        switch(event.keyCode) {
            case 13: // Enter
            case 27: // Escape
            case 38: // Up
            case 40: // Down
                return;
        }
        if(selection >= 0) {
            options.childNodes[selection].classList.remove('selected');
            selection = -1;
        }
        options.innerHTML = '';
        options.addEventListener('click', accept);
        const results = labelIndex.get(search.textContent);
        for(let i = 0; i < results.length; ++i) {
            const element = document.createElement('div');
            options.appendChild(element);
            element.entry = results[i].entry;
            element.textContent = element.entry.label;
            element.addEventListener('mouseover', function(event) {
                options.childNodes[selection].classList.remove('selected');
                selection = i;
                options.childNodes[selection].classList.add('selected');
            });
            if(i == 0) {
                selection = i;
                element.classList.add('selected');
            }
        }
    };
    openModal(accept);
});
menuItems[6].addEventListener('click', function() {
    wiredPanels.eventListeners.activate();
});
menuItems[7].addEventListener('click', function() {
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
menuItems[8].addEventListener('click', function() {
    wiredPanels.deleteSelected();
});
menuItems[9].addEventListener('click', function() {
    const string = backend.encodeJsonFromSymbolSpace(symbolSpace);
    NativeBackend.downloadAsFile(string, 'Symatem.json');
});
menuItems[9].setAttribute('draggable', 'true');
menuItems[9].addEventListener('dragstart', function(event) {
    const string = backend.encodeJsonFromSymbolSpace(symbolSpace);
    event.dataTransfer.setData('text/plain', string);
    event.dataTransfer.setData('application/json', string);
    event.dataTransfer.effectAllowed = 'all';
});
openFiles.addEventListener('change', function(event) {
    wiredPanels.eventListeners.paste(event.target);
});
{
    const label = document.createElement('label'),
          li = menuItems[10];
    label.setAttribute('for', openFiles.getAttribute('id'));
    li.parentNode.insertBefore(label, li);
    label.appendChild(li);
}
menuItems[11].addEventListener('click', function() {
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

const wiredPanels = new WiredPanels({}, {
    activate(node) {
        const nodesToAdd = new Set(),
              panels = new Set();
        for(const node of wiredPanels.selection) {
            if(node.type === 'panel')
                panels.add(node);
            else if(node.type === 'socket' && node.orientation !== 'top' && node.wiresPerPanel.size === 0 && node.symbol !== undefined)
                addPanel(nodesToAdd, node.symbol);
        }
        function accept() {
            // TODO
            const update = modalContent.update, nodesToAdd = new Set(), nodesToRemove = new Set();
            update.to = modalContent.getElementsByTagName('div')[0].innerText;
            if(update.to != update.from) {
                update.next = NativeBackend.decodeText(update.to);
                let prevEncoding = [update.symbol, backend.symbolByName.Encoding, undefined],
                    nextEncoding = [update.symbol, backend.symbolByName.Encoding, undefined];
                prevEncoding[2] = backend.getSolitary(symbolSpace, prevEncoding[0], prevEncoding[1]);
                backend.setData(symbolSpace, update.symbol, update.next);
                nextEncoding[2] = backend.getSolitary(symbolSpace, nextEncoding[0], nextEncoding[1]);
                if(prevEncoding[2] != nextEncoding[2]) {
                    if(prevEncoding[2] != undefined)
                        unlinkedTriple(nodesToRemove, prevEncoding);
                    if(nextEncoding[2] != undefined)
                        linkedTriple(nodesToAdd, nextEncoding);
                }
                wiredPanels.changeGraphUndoable(nodesToAdd, nodesToRemove, function(forward) {
                    backend.setData(symbolSpace, update.symbol, forward ? update.next : update.prev);
                    updateLabels(update.symbol, true);
                    setNodesVisibility(nodesToAdd, forward);
                    setNodesVisibility(nodesToRemove, !forward);
                });
            }
            closeModal();
        }
        if(panels.size === 1) {
            const update = {'panel': panels.values().next().value};
            update.symbol = update.panel.symbol;
            update.prev = backend.getData(symbolSpace, update.symbol);
            update.from = labelOfSymbol(update.symbol).label;
            modalContent.update = update;

            // TODO
            modalContent.innerHTML = `<div contentEditable="true">${update.from.replace('\n', '<br/>')}</div>`;
            // makeListCollapsable(ul);

            openModal(accept);
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
            setNodesVisibility(nodesToSelect, !forward);
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
            wire.dstSocket.label.textContent = labelOfSymbol(wire.dstSocket.symbol).label;
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
                if(forward) {
                    node.symbol = symbol;
                    node.label.textContent = labelOfSymbol(node.symbol).label;
                }
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
document.body.insertBefore(wiredPanels.svg, modal);
