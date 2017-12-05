import WiredPanels from '../WiredPanels/WiredPanels.js';
import NativeBackend from '../SymatemJS/NativeBackend.js';
import FuzzySearchIndex from './FuzzySearchIndex.js';
const backend = new NativeBackend(),
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
    let entry;
    if(!symbolIndex.has(symbol)) {
        entry = {'symbol': symbol};
        symbolIndex.set(symbol, entry);
    } else
        entry = symbolIndex.get(symbol);
    if(entry.label && forceUpdate != undefined)
        labelIndex.delete(entry);
    if(!entry.label || forceUpdate) {
        const data = backend.getData(symbol);
        if(data) {
            entry.label = NativeBackend.encodeText(data);
            labelIndex.add(entry);
        } else {
            const namespaceIdentity = NativeBackend.namespaceOfSymbol(symbol),
                  identity = NativeBackend.identityOfSymbol(symbol);
            entry.label.textContent = namespaceIdentity+' : '+identity;
        }
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
    const namespaceIdentity = NativeBackend.namespaceOfSymbol(symbol),
          identity = NativeBackend.identityOfSymbol(symbol);
    panel.label.textContent = namespaceIdentity+' : '+identity;
    nodesToAdd.add(panel);
    const topSocket = panel.topSocket = wiredPanels.createSocket();
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
    for(const triple of backend.queryTriples(NativeBackend.queryMask.VMI, [0, panel.symbol, 0]))
        connectWires(triple, 'leftSockets');
    for(const triple of backend.queryTriples(NativeBackend.queryMask.VIM, [0, 0, panel.symbol]))
        connectWires(triple, 'rightSockets');
    for(const triple of backend.queryTriples(NativeBackend.queryMask.MVV, [panel.symbol, 0, 0]))
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

function addTripleTemplate(panel, nodesToAdd) {
    const sockets = [];
    for(let i = 0; i < 2; ++i) {
        const socket = wiredPanels.createSocket();
        socket.panel = panel;
        socket.orientation = (i == 0) ? 'left' : 'right';
        nodesToAdd.add(socket);
        sockets.push(socket);
    }
    return sockets;
}

function fillTripleTemplate(socket, symbol, forward) {
    if(forward) {
        socket.symbol = symbol;
        socket.label.textContent = labelOfSymbol(socket.symbol).label;
    }
    const triple = [];
    getOppositeSocket(socket, triple);
    setSocketVisibility(socket, forward);
    if(!forward) {
        delete socket.symbol;
        socket.label.textContent = '';
    }
    wiredPanels.updatePanelGeometry(socket.panel);
    if(triple[1] != undefined && triple[2] != undefined)
        backend.setTriple(triple, forward);
}

function linkSymbol(update, forward) {
    if(forward) {
        backend.manifestSymbol(update.symbol);
        backend.setData(update.symbol, update.data);
        for(const triple of update.triples)
            backend.setTriple(triple, true);
    } else
        backend.unlinkSymbol(update.symbol);
    labelOfSymbol(update.symbol, forward);
}

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

function openSearch(socket) {
    let selection, searchInput;
    function accept() {
        closeModal();
        if(selection == undefined)
            return;
        let update, symbol = options.childNodes[selection].entry.symbol;
        const create = (symbol == undefined);
        if(create) {
            searchInput = searchInput.split(':');
            symbol = backend.createSymbol(parseInt(searchInput[0]));
            update = {
                'symbol': symbol,
                'data': NativeBackend.decodeText(searchInput[1]),
                'triples': []
            };
            backend.setData(update.symbol, update.data);
        }
        const nodesToAdd = new Set(),
              panel = addPanel(nodesToAdd, symbol);
        if(socket) {
            const wire = wiredPanels.createWire();
            wire.srcSocket = panel.topSocket;
            wire.dstSocket = socket;
            nodesToAdd.add(wire);
        }
        wiredPanels.changeGraphUndoable(nodesToAdd, [], function(forward) {
            setPanelVisibility(panel, forward);
            if(create)
                linkSymbol(update, forward);
            if(socket)
                fillTripleTemplate(socket, panel.symbol, forward);
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
        if(event) {
            event.stopPropagation();
            switch(event.keyCode) {
                case 13: // Enter
                case 27: // Escape
                case 38: // Up
                case 40: // Down
                    return;
            }
        }
        searchInput = search.textContent.replace('\xA0', ' ');
        const results = labelIndex.get(searchInput),
              split = searchInput.split(':');
        if(split.length === 2 && !isNaN(parseInt(split[0])) && split[1].length > 0)
            results.unshift({'entry': {'label': 'Create'}});
        options.innerHTML = '';
        selection = (results.length > 0) ? 0 : undefined;
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
            element.addEventListener('click', function(event) {
                selection = i;
                accept();
            });
            if(i === selection)
                element.classList.add('selected');
        }
    };
    search.onkeyup();
    openModal(accept);
    search.focus();
}

function toggleFullscreen() {
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
}



const wiredPanels = new WiredPanels({}, {
    activate(node) {
        const nodesToAdd = new Set(),
              nodesToRemove = new Set(),
              updates = new Set();
        for(const node of wiredPanels.selection) {
            if(node.type === 'panel') {
                nodesToRemove.add(node);
                continue;
            }
            if(wiredPanels.selection.has(node.panel))
                continue;
            if(node.orientation === 'top')
                updates.add(node);
            else if(node.symbol == undefined)
                openSearch(node);
            else if(node.wiresPerPanel.size === 0)
                addPanel(nodesToAdd, node.symbol);
        }
        function accept() {
            // TODO
            const update = modalContent.update, nodesToAdd = new Set(), nodesToRemove = new Set();
            update.to = modalContent.getElementsByTagName('div')[0].innerText;
            if(update.to != update.from) {
                update.next = NativeBackend.decodeText(update.to);
                let prevEncoding = [update.symbol, NativeBackend.symbolByName.Encoding, undefined],
                    nextEncoding = [update.symbol, NativeBackend.symbolByName.Encoding, undefined];
                prevEncoding[2] = backend.getSolitary(prevEncoding[0], prevEncoding[1]);
                backend.setData(update.symbol, update.next);
                nextEncoding[2] = backend.getSolitary(nextEncoding[0], nextEncoding[1]);
                if(prevEncoding[2] != nextEncoding[2]) {
                    if(prevEncoding[2] != undefined)
                        unlinkedTriple(nodesToRemove, prevEncoding);
                    if(nextEncoding[2] != undefined)
                        linkedTriple(nodesToAdd, nextEncoding);
                }
                wiredPanels.changeGraphUndoable(nodesToAdd, nodesToRemove, function(forward) {
                    backend.setData(update.symbol, forward ? update.next : update.prev);
                    updateLabels(update.symbol, true);
                    setNodesVisibility(nodesToAdd, forward);
                    setNodesVisibility(nodesToRemove, !forward);
                });
            }
            closeModal();
        }
        if(updates.size === 1) {
            const update = {'panel': updates.values().next().value};
            update.symbol = update.panel.symbol;
            update.prev = backend.getData(update.symbol);
            update.from = NativeBackend.encodeText(update.prev);
            modalContent.update = update;

            // TODO
            modalContent.innerHTML = `<div contentEditable="true">${update.from.replace('\n', '<br/>')}</div>`;
            // makeListCollapsable(ul);

            openModal(accept);
        }
        if(nodesToAdd.size > 0 || nodesToRemove.size > 0)
            wiredPanels.changeGraphUndoable(nodesToAdd, nodesToRemove, function(forward) {
                for(const node of nodesToAdd)
                    if(node.type === 'panel')
                        setPanelVisibility(node, forward);
                for(const node of nodesToRemove)
                    if(node.type === 'panel')
                        setPanelVisibility(node, !forward);
            });
    },
    remove() {
        const nodesToHide = new Set(),
              tripleTemplates = new Set(),
              triples = new Set(),
              updates = new Set();
        for(const node of wiredPanels.selection)
            if(node.type === 'wire')
                wiredPanels.setNodeSelected(node, false);
        for(const node of wiredPanels.selection)
            switch(node.type) {
                case 'socket':
                    if(wiredPanels.selection.has(node.panel))
                        continue;
                    switch(node.orientation) {
                        case 'top':
                            wiredPanels.setNodeSelected(node, false);
                            break;
                        case 'left':
                        case 'right': {
                            const triple = [], oppositeSocket = getOppositeSocket(node, triple);
                            if(wiredPanels.selection.has(oppositeSocket)) {
                                if(node.symbol != undefined)
                                    nodesToHide.add(node);
                                if(triple[1] != undefined && triple[2] != undefined)
                                    triples.add(triple);
                            } else {
                                wiredPanels.setNodeSelected(node, false);
                                if(node.wiresPerPanel.size > 0) {
                                    const wire = node.wiresPerPanel.values().next().value.keys().next().value;
                                    nodesToHide.add(wire);
                                    wiredPanels.selection.add(wire);
                                }
                                tripleTemplates.add({'socket': node, 'symbol': node.symbol});
                            }
                        } break;
                    }
                    break;
                case 'panel':
                    const update = {
                        'panel': node,
                        'symbol': node.symbol,
                        'data': backend.getData(node.symbol),
                        'triples': [...backend.queryTriples(NativeBackend.queryMask.MVV, [node.symbol, 0, 0])]
                    };
                    updates.add(update);
                    nodesToHide.add(node);
                    break;
            }
        if(nodesToHide.size > 0 || triples.size > 0 || tripleTemplates.size > 0 || updates.size > 0)
            return function(forward) {
                setNodesVisibility(nodesToHide, !forward);
                for(const triple of triples)
                    backend.setTriple(triple, !forward);
                for(const tripleTemplate of tripleTemplates)
                    fillTripleTemplate(tripleTemplate.socket, tripleTemplate.symbol, !forward);
                for(const update of updates)
                    linkSymbol(update, !forward);
            };
    },
    wireDrag(socket) {
        return true;
    },
    wireConnect(node, wire, nodesToAdd) {
        if(node.type === 'panel') {
            if(wire.srcSocket.orientation !== 'top') {
                const srcSocket = node.topSockets[0];
                node = wire.srcSocket;
                wire.srcSocket = srcSocket;
            } else {
                const rect = wiredPanels.boundingRectOfPanel(node),
                      diffX = wire.dstSocket.primaryElement.x-(rect[0]+rect[1])/2,
                      diffY = wire.dstSocket.primaryElement.y-(rect[2]+rect[3])/2,
                      sockets = addTripleTemplate(node, nodesToAdd);
                wire.dstSocket = (diffX < 0) ? sockets[0] : sockets[1];
                wire.dstSocket.symbol = wire.srcSocket.symbol;
                wire.dstSocket.label.textContent = labelOfSymbol(wire.dstSocket.symbol).label;
                return setSocketVisibility.bind(this, wire.dstSocket);
            }
        } else if(wire.srcSocket.orientation !== 'top') {
            if(node.orientation !== 'top' || wire.srcSocket.symbol != undefined)
                return;
            const srcSocket = node;
            node = wire.srcSocket;
            wire.srcSocket = srcSocket;
        }
        if(node.symbol == undefined) {
            wire.dstSocket = node;
            return fillTripleTemplate.bind(this, wire.dstSocket, wire.srcSocket.symbol);
        }
    },
    paste(files) {
        files = files.files;
        if(!files || files.length !== 1)
            return false;
        for(const file of files) {
            const reader = new FileReader();
            reader.onload = function(event) {
                backend.decodeJson(event.target.result);
            };
            reader.readAsText(file);
        }
        return true;
    },
    metaS(event) {
        const string = backend.encodeJson();
        NativeBackend.downloadAsFile(string, 'Symatem.json');
    },
    metaF(event) {
        if(event.shiftKey)
            toggleFullscreen();
        else
            openSearch();
    }
});

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
document.body.insertBefore(wiredPanels.svg, modal);

modalNegative.addEventListener('click', closeModal);
menuItems[0].addEventListener('click', wiredPanels.undo);
menuItems[1].addEventListener('click', wiredPanels.redo);
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
    wiredPanels.eventListeners.activate();
});
menuItems[6].addEventListener('click', wiredPanels.eventListeners.metaF);
menuItems[7].addEventListener('click', wiredPanels.deleteSelected);
menuItems[8].addEventListener('click', wiredPanels.eventListeners.metaS);
menuItems[8].setAttribute('draggable', 'true');
menuItems[8].addEventListener('dragstart', function(event) {
    const string = backend.encodeJson();
    event.dataTransfer.setData('text/plain', string);
    event.dataTransfer.setData('application/json', string);
    event.dataTransfer.effectAllowed = 'all';
});
openFiles.addEventListener('change', function(event) {
    wiredPanels.eventListeners.paste(event.target);
});
{
    const label = document.createElement('label'),
          li = menuItems[9];
    label.setAttribute('for', openFiles.getAttribute('id'));
    li.parentNode.insertBefore(label, li);
    label.appendChild(li);
}
menuItems[10].addEventListener('click', toggleFullscreen);
